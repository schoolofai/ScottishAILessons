"""Diagram generation utility for Phase 3 of integrated lesson authoring.

This utility orchestrates:
1. Diagram Generation Subagent (JSXGraph JSON creation)
2. DiagramScreenshot MCP (PNG rendering)
3. Diagram Critic Subagent (4D quality validation with iterative refinement)

Implements graceful failure mode: diagrams don't block lesson completion.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

logger = logging.getLogger(__name__)


class DiagramGenerator:
    """Generates and critiques diagrams for lesson cards.

    Orchestrates the complete diagram generation pipeline:
    - Generation: Creates JSXGraph JSON via subagent
    - Rendering: Converts JSON to PNG via DiagramScreenshot MCP
    - Critique: Validates quality via critic subagent (iterative refinement)

    Implements graceful failure: failed diagrams don't block lesson authoring.
    """

    def __init__(
        self,
        mcp_config_path: Path,
        workspace_path: Path,
        max_iterations: int = 3,
        score_threshold: float = 0.85
    ):
        """Initialize diagram generator.

        Args:
            mcp_config_path: Path to .mcp.json
            workspace_path: Isolated workspace directory
            max_iterations: Max critique iterations per diagram (default: 3)
            score_threshold: Quality threshold (default: 0.85)
        """
        self.mcp_config_path = mcp_config_path
        self.workspace_path = workspace_path
        self.max_iterations = max_iterations
        self.score_threshold = score_threshold

        logger.info(f"Initialized DiagramGenerator (max_iterations={max_iterations}, threshold={score_threshold})")

    async def generate_diagrams_for_lesson(
        self,
        lesson_template: Dict[str, Any],
        subagent_definitions: Dict[str, AgentDefinition],
        mcp_servers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate diagrams for all eligible cards in lesson template.

        Args:
            lesson_template: Complete lesson template with diagram_eligible flags
            subagent_definitions: Dict of AgentDefinition objects (must include diagram_generation_subagent, diagram_critic_subagent)
            mcp_servers: Dict of MCP servers (must include diagram-screenshot)

        Returns:
            {
                "diagrams_generated": int,
                "diagrams_failed": int,
                "failed_card_ids": List[str],
                "total_eligible": int
            }
        """
        # Filter eligible cards
        eligible_cards = [
            card for card in lesson_template.get("cards", [])
            if card.get("diagram_eligible", False)
        ]

        total_eligible = len(eligible_cards)

        if total_eligible == 0:
            logger.info("No cards require diagrams - skipping Phase 3")
            return {
                "diagrams_generated": 0,
                "diagrams_failed": 0,
                "failed_card_ids": [],
                "total_eligible": 0
            }

        logger.info(f"Phase 3: Generating diagrams for {total_eligible} eligible cards")

        diagrams_generated = 0
        diagrams_failed = 0
        failed_card_ids = []

        # Process each card
        for card in eligible_cards:
            card_id = card.get("id", "UNKNOWN")

            try:
                # Generate and critique diagram
                diagram_metadata = await self._generate_single_diagram(
                    card=card,
                    lesson_template=lesson_template,
                    subagent_definitions=subagent_definitions,
                    mcp_servers=mcp_servers
                )

                # Update card with diagram metadata
                card["diagram_metadata"] = diagram_metadata

                if diagram_metadata["generation_status"] == "success":
                    diagrams_generated += 1
                    logger.info(
                        f"✅ Diagram generated for {card_id} "
                        f"(score: {diagram_metadata.get('visual_critique_score', 0):.2f}, "
                        f"iterations: {diagram_metadata.get('critique_iterations', 0)})"
                    )
                else:
                    diagrams_failed += 1
                    failed_card_ids.append(card_id)
                    logger.warning(
                        f"⚠️ Diagram generation failed for {card_id}: "
                        f"{diagram_metadata.get('error_message', 'Unknown error')}"
                    )

            except Exception as e:
                # GRACEFUL FAILURE: Log error but continue to next card
                logger.error(f"❌ Exception during diagram generation for {card_id}: {e}", exc_info=True)
                card["diagram_metadata"] = {
                    "generation_status": "failed",
                    "error_message": str(e)
                }
                diagrams_failed += 1
                failed_card_ids.append(card_id)

        # Update lesson_template.json with diagram metadata
        lesson_template_path = self.workspace_path / "lesson_template.json"
        with open(lesson_template_path, 'w') as f:
            json.dump(lesson_template, f, indent=2)

        logger.info(
            f"Phase 3 complete: {diagrams_generated}/{total_eligible} diagrams generated, "
            f"{diagrams_failed} failed (graceful degradation)"
        )

        return {
            "diagrams_generated": diagrams_generated,
            "diagrams_failed": diagrams_failed,
            "failed_card_ids": failed_card_ids,
            "total_eligible": total_eligible
        }

    async def _generate_single_diagram(
        self,
        card: Dict[str, Any],
        lesson_template: Dict[str, Any],
        subagent_definitions: Dict[str, AgentDefinition],
        mcp_servers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate and critique a single diagram with iterative refinement.

        Args:
            card: Card object with diagram_description
            lesson_template: Full lesson for context
            subagent_definitions: Dict of AgentDefinition objects
            mcp_servers: Dict of MCP servers

        Returns:
            diagram_metadata dict with generation results
        """
        card_id = card.get("id", "UNKNOWN")
        diagram_description = card.get("diagram_description", "")
        diagram_context = card.get("diagram_context", "function_visualization")

        # Initialize metadata
        current_jsxgraph_json = None
        current_png_path = None
        final_score = 0.0
        final_feedback = ""

        # Iterative generation + critique loop
        for iteration in range(self.max_iterations):
            logger.info(f"Diagram iteration {iteration + 1}/{self.max_iterations} for {card_id}")

            # Step 1: Generate JSXGraph JSON (or refine if iteration > 0)
            jsxgraph_json = await self._call_diagram_generation_subagent(
                card=card,
                lesson_template=lesson_template,
                diagram_description=diagram_description,
                diagram_context=diagram_context,
                previous_jsxgraph=current_jsxgraph_json,
                critique_feedback=final_feedback if iteration > 0 else None,
                subagent_definitions=subagent_definitions,
                mcp_servers=mcp_servers
            )

            # Step 2: Render PNG via DiagramScreenshot MCP
            png_path = await self._render_diagram_png(
                jsxgraph_json=jsxgraph_json,
                card_id=card_id,
                mcp_servers=mcp_servers
            )

            # Step 3: Critique diagram (4D scoring)
            critique_result = await self._call_diagram_critic_subagent(
                jsxgraph_json=jsxgraph_json,
                png_path=png_path,
                card=card,
                lesson_template=lesson_template,
                subagent_definitions=subagent_definitions,
                mcp_servers=mcp_servers
            )

            # Update tracking variables
            current_jsxgraph_json = jsxgraph_json
            current_png_path = png_path
            final_score = critique_result["overall_score"]
            final_feedback = critique_result["feedback"]

            logger.info(f"Critique score: {final_score:.2f} (threshold: {self.score_threshold})")

            # Check if threshold met
            if final_score >= self.score_threshold:
                logger.info(f"✅ Diagram passed critique at iteration {iteration + 1}")
                return {
                    "jsxgraph_json": current_jsxgraph_json,
                    "image_path": str(current_png_path),
                    "visual_critique_score": final_score,
                    "critique_iterations": iteration + 1,
                    "critique_feedback": final_feedback,
                    "generation_status": "success"
                }

        # Max iterations reached without meeting threshold
        logger.warning(
            f"⚠️ Diagram for {card_id} did not reach {self.score_threshold} threshold "
            f"after {self.max_iterations} iterations (final score: {final_score:.2f})"
        )

        # Return best attempt (still mark as success if we have a valid diagram)
        if current_jsxgraph_json and current_png_path:
            return {
                "jsxgraph_json": current_jsxgraph_json,
                "image_path": str(current_png_path),
                "visual_critique_score": final_score,
                "critique_iterations": self.max_iterations,
                "critique_feedback": final_feedback,
                "generation_status": "success"  # Accept even if below threshold
            }
        else:
            return {
                "generation_status": "failed",
                "error_message": f"No valid diagram produced after {self.max_iterations} iterations"
            }

    async def _call_diagram_generation_subagent(
        self,
        card: Dict[str, Any],
        lesson_template: Dict[str, Any],
        diagram_description: str,
        diagram_context: str,
        previous_jsxgraph: Optional[Dict[str, Any]],
        critique_feedback: Optional[str],
        subagent_definitions: Dict[str, AgentDefinition],
        mcp_servers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call diagram generation subagent to create/refine JSXGraph JSON.

        Args:
            card: Card object
            lesson_template: Full lesson context
            diagram_description: Rich description from lesson author
            diagram_context: Card type context
            previous_jsxgraph: Previous diagram JSON (if refinement iteration)
            critique_feedback: Feedback from previous critique (if refinement)
            subagent_definitions: Dict of AgentDefinition objects
            mcp_servers: Dict of MCP servers

        Returns:
            JSXGraph JSON definition

        Raises:
            Exception: If subagent execution fails
        """
        logger.info(f"Calling diagram_generation_subagent for card {card.get('id')}")

        # Prepare context files in workspace
        card_file = self.workspace_path / "current_card.json"
        with open(card_file, 'w') as f:
            json.dump(card, f, indent=2)

        # Build prompt context
        if critique_feedback:
            context_message = f"""You are refining a diagram that needs improvement.

CARD TO DIAGRAM:
See current_card.json for the complete card content.

DIAGRAM DESCRIPTION (from lesson author):
{diagram_description}

DIAGRAM CONTEXT: {diagram_context}

PREVIOUS DIAGRAM (needs refinement):
{json.dumps(previous_jsxgraph, indent=2)}

CRITIQUE FEEDBACK:
{critique_feedback}

Your task: Refine the diagram to address the critique feedback while maintaining the core pedagogical intent.
"""
        else:
            context_message = f"""You are generating a new diagram for a lesson card.

CARD TO DIAGRAM:
See current_card.json for the complete card content.

DIAGRAM DESCRIPTION (from lesson author):
{diagram_description}

DIAGRAM CONTEXT: {diagram_context}

LESSON CONTEXT:
- Course: {lesson_template.get('courseId', 'N/A')}
- Lesson: {lesson_template.get('title', 'N/A')}
- Lesson Type: {lesson_template.get('lesson_type', 'N/A')}

Your task: Generate JSXGraph JSON that visualizes this card's concept clearly and pedagogically.
"""

        # Get subagent definition
        if "diagram_generation_subagent" not in subagent_definitions:
            raise ValueError("diagram_generation_subagent not found in subagent_definitions")

        subagent_def = subagent_definitions["diagram_generation_subagent"]

        # Create SDK client
        sdk_client = ClaudeSDKClient(
            base_options=ClaudeAgentOptions(
                workspace_path=str(self.workspace_path),
                mcp_servers=mcp_servers,
                agent_definition=subagent_def,
                model="claude-sonnet-4-5-20250929",
                temperature=0.0
            )
        )

        # Execute subagent
        result: ResultMessage = await sdk_client.execute(context_message)

        # Parse JSXGraph JSON from result
        # The diagram generation subagent should write diagram_output.json
        diagram_output_file = self.workspace_path / "diagram_output.json"

        if not diagram_output_file.exists():
            raise Exception("diagram_generation_subagent did not produce diagram_output.json")

        with open(diagram_output_file, 'r') as f:
            jsxgraph_json = json.load(f)

        logger.info(f"✅ Diagram generation complete for {card.get('id')}")
        return jsxgraph_json

    async def _render_diagram_png(
        self,
        jsxgraph_json: Dict[str, Any],
        card_id: str,
        mcp_servers: Dict[str, Any]
    ) -> Path:
        """Render JSXGraph JSON to PNG via DiagramScreenshot MCP.

        Args:
            jsxgraph_json: JSXGraph JSON definition
            card_id: Card identifier for filename
            mcp_servers: Dict of MCP servers

        Returns:
            Path to rendered PNG file

        Raises:
            Exception: If rendering fails
        """
        logger.info(f"Rendering diagram PNG for {card_id}")

        # The DiagramScreenshot MCP tool is already configured with workspace path
        # Tool name: mcp__diagram-screenshot__render_diagram
        # This tool will write PNG to {workspace}/diagrams/{card_id}_lesson.png

        # NOTE: Since we're in Python utility code, we can't directly call MCP tools
        # The MCP tools are only available within Claude Agent SDK execution context
        # So we need to trigger this via the subagent, OR use direct HTTP call

        # For now, we'll use direct HTTP call to DiagramScreenshot service
        import requests
        import os

        DIAGRAM_SCREENSHOT_URL = os.getenv("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")

        render_url = f"{DIAGRAM_SCREENSHOT_URL}/api/v1/render"

        payload = {
            "diagram": jsxgraph_json,
            "options": {
                "width": 1200,
                "height": 800,
                "format": "png",
                "scale": 2,
                "backgroundColor": "#ffffff"
            }
        }

        try:
            response = requests.post(render_url, json=payload, timeout=30)
            response.raise_for_status()

            response_data = response.json()

            if not response_data.get("success"):
                raise Exception(f"Diagram rendering failed: {response_data.get('error', {}).get('message', 'Unknown error')}")

            # Write PNG file to workspace
            import base64
            image_base64 = response_data["image"]
            png_bytes = base64.b64decode(image_base64)

            diagrams_dir = self.workspace_path / "diagrams"
            diagrams_dir.mkdir(parents=True, exist_ok=True)

            png_file = diagrams_dir / f"{card_id}_lesson.png"
            png_file.write_bytes(png_bytes)

            logger.info(f"✅ Diagram rendered: {png_file}")
            return png_file

        except requests.RequestException as e:
            raise Exception(f"Failed to render diagram via DiagramScreenshot service: {str(e)}")

    async def _call_diagram_critic_subagent(
        self,
        jsxgraph_json: Dict[str, Any],
        png_path: Path,
        card: Dict[str, Any],
        lesson_template: Dict[str, Any],
        subagent_definitions: Dict[str, AgentDefinition],
        mcp_servers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call diagram critic subagent for 4D quality scoring.

        Args:
            jsxgraph_json: JSXGraph JSON definition
            png_path: Path to rendered PNG
            card: Card object
            lesson_template: Full lesson context
            subagent_definitions: Dict of AgentDefinition objects
            mcp_servers: Dict of MCP servers

        Returns:
            {
                "scores": {
                    "clarity": float,
                    "accuracy": float,
                    "pedagogy": float,
                    "aesthetics": float
                },
                "overall_score": float,
                "feedback": str,
                "dimension_issues": Dict[str, List[str]]
            }

        Raises:
            Exception: If critique fails
        """
        logger.info(f"Calling diagram_critic_subagent for card {card.get('id')}")

        # Prepare critique context
        critique_context = {
            "card": card,
            "lesson_title": lesson_template.get("title"),
            "lesson_type": lesson_template.get("lesson_type"),
            "jsxgraph_json": jsxgraph_json,
            "png_path": str(png_path)
        }

        critique_file = self.workspace_path / "critique_context.json"
        with open(critique_file, 'w') as f:
            json.dump(critique_context, f, indent=2)

        context_message = f"""You are critiquing a diagram for pedagogical quality.

CONTEXT:
See critique_context.json for card content, lesson context, and diagram JSON.

DIAGRAM IMAGE:
{png_path}

Your task: Score the diagram across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)
and provide detailed feedback for improvement if needed.

Output your critique to critique_result.json.
"""

        # Get subagent definition
        if "diagram_critic_subagent" not in subagent_definitions:
            raise ValueError("diagram_critic_subagent not found in subagent_definitions")

        subagent_def = subagent_definitions["diagram_critic_subagent"]

        # Create SDK client
        sdk_client = ClaudeSDKClient(
            base_options=ClaudeAgentOptions(
                workspace_path=str(self.workspace_path),
                mcp_servers=mcp_servers,
                agent_definition=subagent_def,
                model="claude-sonnet-4-5-20250929",
                temperature=0.0
            )
        )

        # Execute subagent
        result: ResultMessage = await sdk_client.execute(context_message)

        # Parse critique result
        critique_result_file = self.workspace_path / "critique_result.json"

        if not critique_result_file.exists():
            raise Exception("diagram_critic_subagent did not produce critique_result.json")

        with open(critique_result_file, 'r') as f:
            critique_result = json.load(f)

        logger.info(f"✅ Diagram critique complete: score={critique_result.get('overall_score', 0):.2f}")
        return critique_result
