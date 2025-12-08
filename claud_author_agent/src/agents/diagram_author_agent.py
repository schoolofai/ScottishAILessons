"""Diagram Author Agent - Orchestrates diagram generation with iterative critique.

Takes classification output and generates diagrams using MCP tools (desmos, matplotlib,
jsxgraph, plotly), then validates each diagram with the Diagram Critic subagent.
Implements iterative improvement until critic passes or max iterations reached.

Input: classification_output.json, mock_exam.json
Output: diagrams/ directory with PNG files, diagram_manifest.json

Uses Claude Agent SDK with MCP tool servers for rendering.
"""

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

# SDK configuration - set before import
# Disable SDK initialize timeout - we want correctness, not speed
os.environ.setdefault("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "600000")  # 10 minutes

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..tools.diagram_classifier_schema_models import (
    DiagramClassificationResult,
    QuestionClassification,
    DIAGRAM_CLASSIFICATION_OUTPUT_FILE
)
from ..subagents.diagram_author_subagent import DiagramAuthorSubagent
from ..subagents.diagram_critic_subagent import DiagramCriticSubagent

# Import MCP server creation functions for SDK-based server config
from ..tools.matplotlib_tool import create_matplotlib_server
from ..tools.desmos_tool import create_desmos_server
from ..tools.jsxgraph_tool import create_jsxgraph_server
from ..tools.plotly_tool import create_plotly_server
from ..tools.imagen_tool import create_imagen_server

logger = logging.getLogger(__name__)

# Constants
MAX_ITERATIONS_PER_DIAGRAM = 5
DIAGRAM_MANIFEST_FILE = "diagram_manifest.json"


@dataclass
class DiagramResult:
    """Result for a single diagram generation."""
    question_id: str
    question_number: int
    tool: str
    success: bool
    iterations: int
    final_score: float = 0.0
    image_path: Optional[str] = None
    error: Optional[str] = None
    critic_notes: List[str] = field(default_factory=list)


@dataclass
class DiagramAuthorResult:
    """Complete result from diagram authoring."""
    success: bool
    total_diagrams: int
    successful_diagrams: int
    failed_diagrams: int
    total_iterations: int
    diagrams: List[DiagramResult] = field(default_factory=list)
    manifest_path: Optional[str] = None
    error: Optional[str] = None


class DiagramAuthorAgent:
    """Agent for generating diagrams with iterative critique.

    Workflow per diagram:
    1. Extract question content and classification
    2. Call MCP rendering tool (desmos/matplotlib/jsxgraph/plotly)
    3. Invoke DiagramCriticSubagent to evaluate result
    4. If REFINE, update prompt/parameters and regenerate
    5. Repeat until ACCEPT or max iterations

    Uses Claude's Read tool for critic (multimodal image viewing).
    """

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns_per_diagram: int = 25,  # Increased from 15 - matplotlib workaround needs more turns
        max_iterations: int = MAX_ITERATIONS_PER_DIAGRAM,
        rendering_api_base: str = "http://localhost:3001",
        rendering_api_key: str = ""
    ):
        """Initialize Diagram Author Agent.

        Args:
            workspace_path: Path to workspace with classification_output.json
            model: Claude model to use
            max_turns_per_diagram: Max turns per diagram generation
            max_iterations: Max refinement iterations per diagram
            rendering_api_base: Base URL for rendering API
            rendering_api_key: API key for rendering service
        """
        self.workspace_path = Path(workspace_path)
        self.model = model
        self.max_turns = max_turns_per_diagram
        self.max_iterations = max_iterations
        self.rendering_api_base = rendering_api_base
        self.rendering_api_key = rendering_api_key

        # Initialize subagent helpers
        self.author_helper = DiagramAuthorSubagent()
        self.critic_helper = DiagramCriticSubagent()

        # Ensure diagrams directory exists
        self.diagrams_dir = self.workspace_path / "diagrams"
        self.diagrams_dir.mkdir(exist_ok=True)

        # Load prompts
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.author_prompt = (prompts_dir / "diagram_author_agent_prompt.md").read_text()

    async def execute(self) -> DiagramAuthorResult:
        """Execute diagram generation for all classified questions.

        Returns:
            DiagramAuthorResult with all diagram outcomes

        Raises:
            RuntimeError: If critical failure (fail-fast)
        """
        logger.info("=" * 60)
        logger.info("DIAGRAM AUTHOR AGENT - Starting execution")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Max iterations per diagram: {self.max_iterations}")
        logger.info("=" * 60)

        # Load classification output
        classification_file = self.workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
        if not classification_file.exists():
            raise RuntimeError(f"Missing input file: {classification_file}")

        with open(classification_file) as f:
            classification_data = json.load(f)

        classification = DiagramClassificationResult.model_validate(classification_data)

        # Filter to questions needing diagrams
        questions_needing_diagrams = [
            c for c in classification.classifications
            if c.tool != "NONE"
        ]

        if not questions_needing_diagrams:
            logger.info("No diagrams needed - all questions classified as NONE")
            return DiagramAuthorResult(
                success=True,
                total_diagrams=0,
                successful_diagrams=0,
                failed_diagrams=0,
                total_iterations=0
            )

        logger.info(f"📊 Processing {len(questions_needing_diagrams)} diagrams")

        # Load mock exam for question content
        mock_exam_file = self.workspace_path / "mock_exam.json"
        if not mock_exam_file.exists():
            raise RuntimeError(f"Missing input file: {mock_exam_file}")

        with open(mock_exam_file) as f:
            mock_exam_data = json.load(f)

        # Build question lookup
        question_lookup = self._build_question_lookup(mock_exam_data)

        # Process each diagram
        results: List[DiagramResult] = []
        total_iterations = 0

        for idx, classification_item in enumerate(questions_needing_diagrams):
            logger.info(f"\n🎨 Processing diagram {idx + 1}/{len(questions_needing_diagrams)}")
            logger.info(f"   Question {classification_item.question_number}: {classification_item.tool}")

            question_content = question_lookup.get(classification_item.question_id, {})

            try:
                result = await self._generate_diagram_with_critique(
                    classification=classification_item,
                    question_content=question_content
                )
                results.append(result)
                total_iterations += result.iterations

                status = "✅" if result.success else "❌"
                logger.info(f"{status} Q{result.question_number}: {result.iterations} iterations, score={result.final_score:.2f}")

            except Exception as e:
                logger.error(f"❌ Failed to generate diagram for Q{classification_item.question_number}: {e}")
                results.append(DiagramResult(
                    question_id=classification_item.question_id,
                    question_number=classification_item.question_number,
                    tool=classification_item.tool,
                    success=False,
                    iterations=0,
                    error=str(e)
                ))

        # Calculate summary
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful

        # Write manifest
        manifest_path = self._write_manifest(results, classification.total_questions)

        logger.info("=" * 60)
        logger.info("DIAGRAM AUTHOR - Complete")
        logger.info(f"   Total diagrams: {len(results)}")
        logger.info(f"   Successful: {successful}")
        logger.info(f"   Failed: {failed}")
        logger.info(f"   Total iterations: {total_iterations}")
        logger.info(f"   Manifest: {manifest_path}")
        logger.info("=" * 60)

        return DiagramAuthorResult(
            success=failed == 0,
            total_diagrams=len(results),
            successful_diagrams=successful,
            failed_diagrams=failed,
            total_iterations=total_iterations,
            diagrams=results,
            manifest_path=str(manifest_path)
        )

    async def _generate_diagram_with_critique(
        self,
        classification: QuestionClassification,
        question_content: Dict[str, Any]
    ) -> DiagramResult:
        """Generate single diagram with iterative critique loop.

        Args:
            classification: Classification for this question
            question_content: Question content from mock exam

        Returns:
            DiagramResult with outcome
        """
        tool = classification.tool
        question_id = classification.question_id
        question_number = classification.question_number
        correction_prompt: Optional[str] = None
        critic_notes: List[str] = []

        for iteration in range(1, self.max_iterations + 1):
            logger.info(f"   📝 Iteration {iteration}/{self.max_iterations}")

            # Step 1: Generate diagram
            try:
                image_path = await self._render_diagram(
                    classification=classification,
                    question_content=question_content,
                    correction_prompt=correction_prompt,
                    iteration=iteration
                )
            except Exception as e:
                logger.error(f"   Render failed: {e}")
                return DiagramResult(
                    question_id=question_id,
                    question_number=question_number,
                    tool=tool,
                    success=False,
                    iterations=iteration,
                    error=f"Render failed: {e}",
                    critic_notes=critic_notes
                )

            # Step 2: Critique the diagram
            try:
                critique_result = await self._critique_diagram(
                    image_path=image_path,
                    classification=classification,
                    question_content=question_content,
                    iteration=iteration
                )
            except Exception as e:
                # FAIL-FAST: Do not silently accept diagrams when critique fails
                # This was a false-positive anti-pattern - critique must succeed
                logger.error(f"   ❌ Critique failed: {e}")
                return DiagramResult(
                    question_id=question_id,
                    question_number=question_number,
                    tool=tool,
                    success=False,  # FIXED: Fail when critique fails (no false positive)
                    iterations=iteration,
                    final_score=0.0,  # FIXED: Zero score for failed critique
                    image_path=image_path,
                    error=f"Critique failed: {e}",
                    critic_notes=critic_notes + [f"Critique failed: {e}"]
                )

            # Step 3: Check acceptance
            decision = critique_result.get("decision", "REJECT")
            final_score = critique_result.get("final_score", 0.0)

            logger.info(f"   Critique: {decision}, score={final_score:.2f}")

            if self.critic_helper.should_accept(critique_result, iteration):
                return DiagramResult(
                    question_id=question_id,
                    question_number=question_number,
                    tool=tool,
                    success=True,
                    iterations=iteration,
                    final_score=final_score,
                    image_path=image_path,
                    critic_notes=critic_notes
                )

            # Step 4: Prepare for refinement or prompt overhaul
            if decision == "REJECT":
                # REJECT triggers PROMPT OVERHAUL, not termination
                # The original prompt was fundamentally flawed - we need to regenerate it
                # with a completely different approach based on the critical feedback
                critical = critique_result.get("critical_issues", ["Unknown critical issue"])
                critic_notes.append(f"Iteration {iteration}: REJECT - {critical[0]} (triggering prompt overhaul)")

                # Build overhaul prompt that emphasizes fundamental changes
                correction_prompt = self._build_overhaul_prompt(critique_result, classification)
                logger.info(f"   🔄 REJECT triggered prompt overhaul for iteration {iteration + 1}")
                continue  # Continue to next iteration with overhauled prompt

            # REFINE - get correction prompt for next iteration (incremental changes)
            correction_prompt = self.critic_helper.get_correction_prompt(critique_result)
            specific_changes = critique_result.get("specific_changes", [])
            if specific_changes:
                critic_notes.append(f"Iteration {iteration}: {specific_changes[0]}")

        # Max iterations reached without acceptance
        logger.warning(f"   Max iterations reached without full acceptance")
        return DiagramResult(
            question_id=question_id,
            question_number=question_number,
            tool=tool,
            success=True,  # Accept at max iterations (progressive threshold)
            iterations=self.max_iterations,
            final_score=final_score,
            image_path=image_path,
            critic_notes=critic_notes + ["Accepted at max iterations with progressive threshold"]
        )

    async def _render_diagram(
        self,
        classification: QuestionClassification,
        question_content: Dict[str, Any],
        correction_prompt: Optional[str],
        iteration: int
    ) -> str:
        """Render a diagram using the appropriate MCP tool.

        Args:
            classification: Diagram classification
            question_content: Question content
            correction_prompt: Feedback from previous critique
            iteration: Current iteration number

        Returns:
            Path to generated image

        Raises:
            RuntimeError: If rendering fails
        """
        tool = classification.tool
        question_id = classification.question_id

        # Build prompt for rendering agent
        prompt = self._build_render_prompt(
            classification=classification,
            question_content=question_content,
            correction_prompt=correction_prompt,
            iteration=iteration
        )

        # Get MCP server config for this tool (SDK-based, not subprocess)
        mcp_server_config = self._get_mcp_server_config(tool)

        # Log MCP configuration for debugging
        server_name = mcp_server_config['name']
        server_type = mcp_server_config.get('type', 'unknown')
        logger.info(f"   🔌 MCP Server: {server_name} (type={server_type})")
        logger.debug(f"   MCP server instance: {mcp_server_config.get('instance', 'N/A')}")

        # Configure agent with SDK-based MCP server
        # McpSdkServerConfig format: {'type': 'sdk', 'name': str, 'instance': Server}
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            max_turns=self.max_turns,
            cwd=str(self.workspace_path),
            mcp_servers={server_name: mcp_server_config},
            max_buffer_size=10 * 1024 * 1024  # 10MB - prevent buffer overflow on large messages
        )
        logger.debug(f"   ClaudeAgentOptions configured with MCP server: {list(options.mcp_servers.keys())}")

        # Execute rendering with full message capture for debugging
        conversation_log = []
        async with ClaudeSDKClient(options) as client:
            await client.query(prompt)

            async for message in client.receive_messages():
                # Log all messages for debugging
                msg_type = type(message).__name__
                msg_content = str(message)[:500]  # Truncate for readability
                logger.debug(f"Claude message [{msg_type}]: {msg_content}")
                conversation_log.append({"type": msg_type, "content": msg_content})

                if isinstance(message, ResultMessage):
                    logger.info(f"Result: subtype={message.subtype}, cost=${getattr(message, 'total_cost_usd', 'N/A')}")
                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(f"Render exceeded max turns")
                    break

        # Write conversation log to workspace for debugging
        conv_log_path = self.workspace_path / f"conversation_{question_id}.json"
        with open(conv_log_path, 'w') as f:
            json.dump(conversation_log, f, indent=2)
        logger.debug(f"Conversation log saved to: {conv_log_path}")

        # Verify image was created (support both PNG and JPEG formats)
        # IMAGE_GENERATION (Imagen) returns JPEG, other tools return PNG
        expected_path = None

        # Try common naming patterns with both extensions
        for ext in ["png", "jpg", "jpeg"]:
            candidates = [
                f"{question_id}_question.{ext}",
                f"{question_id}.{ext}",
                f"q{classification.question_number}.{ext}",
                f"q{classification.question_number}_question.{ext}"
            ]
            for filename in candidates:
                candidate_path = self.diagrams_dir / filename
                if candidate_path.exists():
                    expected_path = candidate_path
                    break
            if expected_path:
                break

        if not expected_path:
            # Check for any new image file (PNG or JPG) in diagrams dir
            images = list(self.diagrams_dir.glob("*.png")) + \
                     list(self.diagrams_dir.glob("*.jpg")) + \
                     list(self.diagrams_dir.glob("*.jpeg"))
            if images:
                # Use most recently created
                expected_path = max(images, key=lambda p: p.stat().st_mtime)
            else:
                # Last resort: Check if Claude saved to project root's diagrams/ instead
                project_root_diagrams = Path(__file__).parent.parent.parent / "diagrams"
                if project_root_diagrams.exists():
                    root_images = list(project_root_diagrams.glob(f"*{question_id}*.png")) + \
                                  list(project_root_diagrams.glob(f"*{question_id}*.jpg"))
                    if root_images:
                        # Move file to correct location
                        src_file = root_images[0]
                        dest_file = self.diagrams_dir / src_file.name
                        shutil.move(str(src_file), str(dest_file))
                        logger.warning(f"   ⚠️ Moved diagram from project root to workspace: {dest_file.name}")
                        expected_path = dest_file
                    else:
                        raise RuntimeError(f"No diagram generated for {question_id}")
                else:
                    raise RuntimeError(f"No diagram generated for {question_id}")

        return str(expected_path.absolute())

    async def _critique_diagram(
        self,
        image_path: str,
        classification: QuestionClassification,
        question_content: Dict[str, Any],
        iteration: int
    ) -> Dict[str, Any]:
        """Critique a diagram using the DiagramCriticSubagent.

        Uses Claude's native Read tool for multimodal image viewing.

        Args:
            image_path: Path to diagram image
            classification: Original classification
            question_content: Question content
            iteration: Current iteration

        Returns:
            Critique result dict

        Raises:
            RuntimeError: If critique fails
        """
        # Clean up any stale critique result from previous iterations
        result_path = self.workspace_path / "critique_result.json"
        if result_path.exists():
            result_path.unlink()
            logger.debug(f"   🗑️ Cleaned up stale critique_result.json")

        # Build critique prompt
        prompt = self._build_critique_prompt(
            image_path=image_path,
            classification=classification,
            question_content=question_content,
            iteration=iteration
        )

        # Configure agent (no MCP server needed - uses Read tool)
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            max_turns=10,
            cwd=str(self.workspace_path),
            allowed_tools=['Read', 'Write'],  # Read for image, Write for result
            max_buffer_size=10 * 1024 * 1024  # 10MB - prevent buffer overflow on large messages
        )

        # Execute critique with logging
        logger.info(f"   🔍 Starting critique for {image_path}")
        critique_messages: List[Any] = []

        async with ClaudeSDKClient(options) as client:
            await client.query(prompt)

            async for message in client.receive_messages():
                # Log all messages for debugging
                message_type = type(message).__name__
                content_preview = str(message)[:200] if hasattr(message, '__str__') else 'N/A'
                logger.debug(f"Critique message [{message_type}]: {content_preview}")
                critique_messages.append(message)

                if isinstance(message, ResultMessage):
                    logger.info(f"   🔍 Critique result: subtype={message.subtype}, cost=${getattr(message, 'total_cost_usd', 'N/A')}")
                    if message.subtype == 'error_max_turns':
                        raise RuntimeError("Critique exceeded max turns")
                    break

        # Log critique conversation for debugging
        logger.debug(f"   🔍 Critique completed with {len(critique_messages)} messages")

        # Read result
        result_path = self.workspace_path / "critique_result.json"
        if not result_path.exists():
            # Log detailed error for debugging
            logger.error(f"   ❌ Critique result file not found: {result_path}")
            logger.error(f"   ❌ Workspace contents: {list(self.workspace_path.iterdir())}")
            raise RuntimeError("Critique result not written - agent did not use Write tool")

        with open(result_path) as f:
            return json.load(f)

    def _build_render_prompt(
        self,
        classification: QuestionClassification,
        question_content: Dict[str, Any],
        correction_prompt: Optional[str],
        iteration: int
    ) -> str:
        """Build prompt for diagram rendering."""
        tool = classification.tool
        server_name = self.author_helper.TOOL_TO_SERVER.get(tool, "unknown")

        correction_section = ""
        if correction_prompt:
            correction_section = f"""
## Corrections from Previous Iteration

{correction_prompt}

Apply these corrections in this iteration.
"""

        return f"""{self.author_prompt}

## Current Task

Generate a diagram for this question using {tool}.

**Question ID**: {classification.question_id}
**Question Number**: {classification.question_number}
**Tool**: {tool}
**Iteration**: {iteration}

**Classification Reasoning**: {classification.reasoning.summary if classification.reasoning else 'N/A'}
**Visualization Focus**: {classification.visualization_focus or 'N/A'}
**Key Elements**: {', '.join(classification.diagram_specs.key_elements) if classification.diagram_specs else 'N/A'}

**Question Content**:
```json
{json.dumps(question_content, indent=2)}
```
{correction_section}

## Instructions

1. Use the `mcp__{server_name}__render_*` tool to generate the diagram
2. **IMPORTANT**: Save the diagram to the RELATIVE path: `diagrams/{classification.question_id}_question.png`
   - Use `./diagrams/` NOT absolute paths
   - The current working directory is already set to the workspace
3. The diagram should clearly visualize the mathematical concept for students

Start by analyzing the question, then generate the appropriate diagram.
"""

    def _build_critique_prompt(
        self,
        image_path: str,
        classification: QuestionClassification,
        question_content: Dict[str, Any],
        iteration: int
    ) -> str:
        """Build prompt for diagram critique."""
        diagram_type = self.critic_helper.TOOL_TO_DIAGRAM_TYPE.get(
            classification.tool, "function_graph"
        )
        threshold = self.critic_helper.get_threshold_for_iteration(iteration)

        return f"""You are the Diagram Critic Subagent.

## Task

Evaluate the generated diagram for educational quality.

**Image Path**: {image_path}
**Diagram Type**: {diagram_type}
**Context**: question
**Iteration**: {iteration}
**Acceptance Threshold**: {threshold:.2f}

**Original Question**:
```json
{json.dumps(question_content, indent=2)}
```

**Classification**:
- Tool: {classification.tool}
- Focus: {classification.visualization_focus or 'N/A'}
- Key Elements: {', '.join(classification.diagram_specs.key_elements) if classification.diagram_specs else 'N/A'}

## Instructions

1. Use the Read tool to view the image: Read(file_path="{image_path}")
2. Evaluate across 4 dimensions (0.0-1.0 each):
   - **clarity**: Is the diagram clear and easy to understand?
   - **accuracy**: Does it correctly represent the mathematical concept?
   - **pedagogy**: Does it support student learning?
   - **aesthetics**: Is it visually appealing and well-formatted?
3. Calculate final_score as weighted average: clarity(0.35) + accuracy(0.35) + pedagogy(0.20) + aesthetics(0.10)
4. Make a decision:
   - ACCEPT: final_score >= {threshold:.2f} and no critical issues
   - ACCEPT_WITH_NOTES: Acceptable with minor concerns
   - REFINE: Needs improvement (list specific_changes)
   - REJECT: Critical issues prevent use

5. **CRITICAL**: Use the Write tool to save your critique to the file `critique_result.json`

## Output Format

You MUST use the Write tool to create the file `critique_result.json` with this exact structure:

```json
{{
  "decision": "ACCEPT|REFINE|ACCEPT_WITH_NOTES|REJECT",
  "final_score": 0.85,
  "dimension_scores": {{
    "clarity": 0.9,
    "accuracy": 0.85,
    "pedagogy": 0.8,
    "aesthetics": 0.75
  }},
  "strengths": ["Clear axis labels", "..."],
  "improvements": ["Could add grid lines", "..."],
  "specific_changes": ["Add x-axis label", "..."],
  "critical_issues": [],
  "iteration_notes": "Iteration {iteration}: ..."
}}
```

## Required Steps

1. First, use Read tool to view the image at `{image_path}`
2. Analyze the diagram based on the 4 dimensions
3. Calculate the final_score using the weighted formula
4. **MUST**: Use Write tool to create `critique_result.json` - DO NOT just output JSON in your response

Example Write tool invocation:
```
Write(file_path="critique_result.json", content="{{JSON content here}}")
```

Start by viewing the image, then write your critique result to the file.
"""

    def _build_overhaul_prompt(
        self,
        critique_result: Dict[str, Any],
        classification: QuestionClassification
    ) -> str:
        """Build an emphatic prompt for fundamental approach overhaul after REJECT.

        Unlike REFINE which suggests incremental changes, REJECT means the entire
        approach was fundamentally flawed. This prompt instructs the agent to
        completely rethink and regenerate the image prompt from scratch.

        For IMAGE_GENERATION (Imagen), this is especially important because:
        - Adding/removing annotations requires a completely different prompt
        - Changing the visual concept requires new scene description
        - Minor prompt tweaks often don't change Imagen output significantly

        Args:
            critique_result: The critique that caused the REJECT decision
            classification: Original diagram classification

        Returns:
            Emphatic overhaul instructions for the next iteration
        """
        critical_issues = critique_result.get("critical_issues", ["Unknown critical issue"])
        improvements = critique_result.get("improvements", [])
        iteration_notes = critique_result.get("iteration_notes", "")

        # Build list of what went wrong
        issues_list = "\n".join(f"   - {issue}" for issue in critical_issues)
        improvements_list = "\n".join(f"   - {imp}" for imp in improvements[:3])

        # Tool-specific guidance for overhaul
        tool_guidance = ""
        if classification.tool == "IMAGE_GENERATION":
            tool_guidance = """
**IMAGE_GENERATION (Imagen) Specific Overhaul Guidance:**
- If annotations/labels were rejected: Create a PURE SCENE image with NO text, numbers, or mathematical notation
- If the concept was misrepresented: Start fresh with a completely different visual metaphor
- If dimensions/angles were wrong: Describe the scene differently, let the image speak without measurements
- Imagen responds better to descriptive scene prompts than technical specifications
- Example overhaul: Instead of "ladder at 60° with 3m height labeled", try "A red aluminum ladder leaning against a white brick wall in a sunny garden, viewed from the side"
"""
        elif classification.tool == "MATPLOTLIB":
            tool_guidance = """
**MATPLOTLIB Specific Overhaul Guidance:**
- If labels were wrong: Rewrite the entire figure setup with correct axis configuration
- If the plot type was inappropriate: Choose a completely different visualization approach
- If scale was off: Rebuild coordinate system from scratch
- Consider using different matplotlib components (patches, annotations, transforms)
"""

        return f"""
# ⚠️ CRITICAL: PROMPT OVERHAUL REQUIRED ⚠️

The previous diagram was **REJECTED** due to fundamental issues that cannot be fixed with minor adjustments.
You must **COMPLETELY REDESIGN** your approach for this iteration.

## Why the Previous Attempt Failed

**Critical Issues:**
{issues_list}

**Reviewer Notes:**
{iteration_notes}

## What Must Change

DO NOT simply tweak the previous prompt - that approach has FAILED.

Instead, you must:
1. **RETHINK** the entire visual concept from the ground up
2. **ELIMINATE** the problematic elements completely (don't just reduce them)
3. **REDESIGN** the prompt to achieve the educational goal in a fundamentally different way

{tool_guidance}

## Specific Improvements Required

{improvements_list if improvements else "   - Address all critical issues listed above"}

## Your Task

Generate a **COMPLETELY NEW** diagram that:
- Addresses ALL critical issues (not just some)
- Uses a DIFFERENT approach than before
- Achieves the same educational goal through an alternative visual strategy

**DO NOT** make incremental changes to the previous prompt.
**DO** write an entirely new prompt that avoids all the rejected elements.
"""

    def _get_mcp_server_config(self, tool: str) -> Dict[str, Any]:
        """Get MCP server configuration for a tool type.

        Uses SDK-based MCP server instances (McpSdkServerConfig) instead of
        subprocess spawning (McpStdioServerConfig) for reliable tool registration.

        The SDK-based approach passes the server instance directly to the Claude
        Agent SDK, ensuring tools are properly registered and available.

        Returns:
            Dict with 'type': 'sdk', 'name': str, 'instance': Server
        """
        workspace_path = str(self.workspace_path)
        api_base_url = self.rendering_api_base
        api_key = self.rendering_api_key or ""

        if tool == "DESMOS":
            return create_desmos_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
        elif tool == "MATPLOTLIB":
            return create_matplotlib_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
        elif tool == "JSXGRAPH":
            return create_jsxgraph_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
        elif tool == "PLOTLY":
            return create_plotly_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
        elif tool == "IMAGE_GENERATION":
            return create_imagen_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
        else:
            raise ValueError(f"Unknown tool type: {tool}")

    def _build_question_lookup(self, mock_exam_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Build lookup from question_id to question content."""
        lookup = {}
        for section in mock_exam_data.get("sections", []):
            for question in section.get("questions", []):
                qid = question.get("question_id")
                if qid:
                    lookup[qid] = question
        return lookup

    def _write_manifest(self, results: List[DiagramResult], total_questions: int) -> Path:
        """Write diagram manifest to workspace."""
        manifest = {
            "total_questions": total_questions,
            "diagrams_generated": len(results),
            "successful": sum(1 for r in results if r.success),
            "failed": sum(1 for r in results if not r.success),
            "diagrams": []
        }

        for result in results:
            manifest["diagrams"].append({
                "question_id": result.question_id,
                "question_number": result.question_number,
                "tool": result.tool,
                "success": result.success,
                "iterations": result.iterations,
                "final_score": result.final_score,
                "image_path": result.image_path,
                "error": result.error,
                "critic_notes": result.critic_notes
            })

        manifest_path = self.workspace_path / DIAGRAM_MANIFEST_FILE
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)

        return manifest_path


async def run_diagram_author(
    workspace_path: Path,
    rendering_api_base: str = "http://localhost:3001",
    rendering_api_key: str = ""
) -> DiagramAuthorResult:
    """Run diagram author agent and return result.

    Args:
        workspace_path: Path to workspace with classification_output.json
        rendering_api_base: Base URL for rendering API
        rendering_api_key: API key for rendering service

    Returns:
        DiagramAuthorResult

    Raises:
        RuntimeError: If agent fails
    """
    agent = DiagramAuthorAgent(
        workspace_path=workspace_path,
        rendering_api_base=rendering_api_base,
        rendering_api_key=rendering_api_key
    )
    return await agent.execute()
