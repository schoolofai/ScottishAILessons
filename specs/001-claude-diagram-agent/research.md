# Research: Claude Diagram Generation Agent

**Date**: 2025-10-31
**Feature**: Claude Diagram Generation Agent
**Branch**: `001-claude-diagram-agent`

This document resolves all NEEDS CLARIFICATION items from the technical context phase of plan.md.

---

## 1. Claude SDK Subagent Configuration

**Decision**: Use 2 subagents (Diagram Author, Visual Critic) registered via `AgentDefinition` with Claude SDK's `agents` parameter

**Rationale**:
- Claude SDK provides native subagent support through `ClaudeAgentOptions.agents` dictionary
- Each subagent is registered with a name (key) and AgentDefinition (description + prompt)
- Main agent delegates to subagents using `@subagent_name` syntax in prompts
- Pattern proven in lesson_author_claude_client.py with 3 subagents (research, author, critic)

**Code Example** (from claud_author_agent/src/lesson_author_claude_client.py:88-119):

```python
def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
    """Load subagent definitions with prompts."""
    prompts_dir = Path(__file__).parent / "prompts"

    subagents = {
        "diagram_author_subagent": AgentDefinition(
            description="Generate JSXGraph JSON visualizations and render to images using DiagramScreenshot service",
            prompt=(prompts_dir / "diagram_generation_subagent.md").read_text()
        ),
        "visual_critic_subagent": AgentDefinition(
            description="Analyze rendered diagram images across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)",
            prompt=(prompts_dir / "visual_critic_subagent.md").read_text()
        )
    }

    return subagents

# Usage in ClaudeAgentOptions
options = ClaudeAgentOptions(
    model='claude-sonnet-4-5',
    agents=self._get_subagent_definitions(),
    # ... other options
)
```

**Subagent Delegation Pattern**:
- Main agent prompt uses `@subagent_name` to delegate tasks
- Example: `"Delegate diagram generation to @diagram_author_subagent for card_001"`
- Claude SDK automatically routes to appropriate subagent and returns results to main agent

**Alternatives Considered**:
1. **Single-agent with prompt sections**: Would require manual state management, no clear separation of concerns
2. **LangGraph DeepAgents**: Original implementation, but requires Gemini (we're migrating to Claude)
3. **External orchestration**: Python loop calling separate agents - adds complexity, loses conversation context

---

## 2. Custom HTTP Tool Registration via MCP

**Decision**: Wrap DiagramScreenshot HTTP service as MCP server using `create_sdk_mcp_server()` (like json_validator_tool pattern)

**Rationale**:
- Claude SDK MCP integration provides automatic tool discovery and invocation
- MCP servers can wrap any HTTP service and expose it as a tool
- Pattern proven in claud_author_agent/src/tools/json_validator_tool.py:563-567
- Allows `bypassPermissions` mode to work correctly (no manual permission prompts)
- Consistent with existing Claude agent tools architecture

**Code Example** (adapted from json_validator_tool.py):

```python
# diagram_screenshot_tool.py
from claude_agent_sdk import tool, create_sdk_mcp_server
import requests
import json

DIAGRAM_SCREENSHOT_URL = os.environ.get(
    "DIAGRAM_SCREENSHOT_URL",
    "http://localhost:3001"
)
RENDER_ENDPOINT = f"{DIAGRAM_SCREENSHOT_URL}/api/v1/render"
RENDER_TIMEOUT = 30  # seconds

@tool(
    "render_diagram",
    "Render JSXGraph diagram JSON to PNG image using DiagramScreenshot service",
    {"jsxgraph_json": str}
)
async def render_diagram(args):
    """Render diagram and return base64 PNG."""
    jsxgraph_json = args["jsxgraph_json"]

    try:
        diagram_data = json.loads(jsxgraph_json)

        # Validate structure
        if "diagram" not in diagram_data:
            return {
                "content": [{
                    "type": "text",
                    "text": json.dumps({
                        "success": False,
                        "error": "Missing 'diagram' key in JSON",
                        "error_code": "INVALID_STRUCTURE"
                    })
                }],
                "isError": True
            }

        # Make HTTP request
        response = requests.post(
            RENDER_ENDPOINT,
            json=diagram_data,
            timeout=RENDER_TIMEOUT
        )

        if response.status_code != 200:
            return {
                "content": [{
                    "type": "text",
                    "text": json.dumps({
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                        "error_code": "HTTP_ERROR"
                    })
                }],
                "isError": True
            }

        result = response.json()
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "success": True,
                    "image": result.get("image", ""),
                    "metadata": result.get("metadata", {})
                })
            }]
        }

    except requests.exceptions.Timeout:
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "success": False,
                    "error": f"Rendering timeout after {RENDER_TIMEOUT} seconds",
                    "error_code": "TIMEOUT"
                })
            }],
            "isError": True
        }
    except requests.exceptions.ConnectionError:
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "success": False,
                    "error": f"Cannot connect to DiagramScreenshot service at {DIAGRAM_SCREENSHOT_URL}",
                    "error_code": "CONNECTION_ERROR"
                })
            }],
            "isError": True
        }

# Create MCP server
diagram_screenshot_server = create_sdk_mcp_server(
    name="diagram-screenshot",
    version="1.0.0",
    tools=[render_diagram]
)

# Tool naming: mcp__diagram-screenshot__render_diagram
```

**Registration in Agent** (adapted from lesson_author_claude_client.py:240-244):

```python
# Import the MCP server
from .tools.diagram_screenshot_tool import diagram_screenshot_server

# Register in ClaudeAgentOptions
mcp_servers_for_diagram_author = {
    "diagram-screenshot": diagram_screenshot_server
}

options = ClaudeAgentOptions(
    model='claude-sonnet-4-5',
    agents=self._get_subagent_definitions(),
    mcp_servers=mcp_servers_for_diagram_author,
    allowed_tools=[
        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
        'mcp__diagram-screenshot__render_diagram'
    ],
    # ...
)
```

**Alternatives Considered**:
1. **Direct requests library in prompts**: Agents can't call Python functions directly, only tools
2. **Shell out to curl**: Fragile, no error handling, bypasses Claude SDK tool system
3. **Custom function tool**: Claude SDK doesn't support raw function registration (must use MCP or built-ins)

---

## 3. Quality Threshold Refinement Loop

**Decision**: Manage refinement state in Python orchestrator (NOT agent state), limit to 3 iterations maximum

**Rationale**:
- Claude SDK agents are stateless between executions (unlike LangGraph's state graphs)
- Refinement loop belongs in orchestration layer (diagram_author_claude_client.py), not agent prompt
- Python can track: iteration_count, current_diagram_version, critique_history
- Matches lesson_author pattern: Python manages critic retry loop (max_critic_retries=10)
- Fast-fail after 3 iterations (Constitution Principle I: no fallbacks)

**Implementation Pattern**:

```python
# In DiagramAuthorClaudeAgent.execute()
async def _refine_diagram_with_critic_loop(
    self,
    card_id: str,
    initial_diagram_json: str,
    workspace_path: Path
) -> Dict[str, Any]:
    """Refinement loop managed in Python (not agent)."""

    max_iterations = 3
    quality_threshold = 0.85
    critique_history = []

    current_diagram_json = initial_diagram_json

    for iteration in range(1, max_iterations + 1):
        logger.info(f"Refinement iteration {iteration}/{max_iterations} for {card_id}")

        # Render diagram
        render_result = await self._render_diagram(current_diagram_json)
        if not render_result["success"]:
            raise ValueError(f"Diagram rendering failed: {render_result['error']}")

        image_base64 = render_result["image"]

        # Invoke visual critic subagent
        critique_prompt = self._build_critique_prompt(
            card_id=card_id,
            diagram_json=current_diagram_json,
            image_base64=image_base64,
            iteration=iteration,
            previous_critiques=critique_history
        )

        critique_result = await self.client.query(critique_prompt)
        critique_score = self._extract_score_from_critique(critique_result)

        critique_history.append({
            "iteration": iteration,
            "score": critique_score,
            "feedback": critique_result
        })

        # Check if threshold met
        if critique_score >= quality_threshold:
            logger.info(f"✅ Diagram accepted: score={critique_score}")
            return {
                "success": True,
                "jsxgraph_json": current_diagram_json,
                "image_base64": image_base64,
                "visual_critique_score": critique_score,
                "critique_iterations": iteration,
                "critique_feedback": critique_history
            }

        # Generate improved version (if not final iteration)
        if iteration < max_iterations:
            logger.info(f"Score {critique_score} below threshold, refining...")
            refinement_prompt = self._build_refinement_prompt(
                card_id=card_id,
                current_diagram=current_diagram_json,
                critique_feedback=critique_result
            )
            refined_diagram = await self.client.query(refinement_prompt)
            current_diagram_json = self._extract_jsxgraph_json(refined_diagram)

    # Failed to meet threshold after max iterations
    raise ValueError(
        f"Diagram for {card_id} failed to meet quality threshold (≥{quality_threshold}) "
        f"after {max_iterations} iterations. Best score: {max(c['score'] for c in critique_history)}"
    )
```

**Alternatives Considered**:
1. **Agent-managed iteration**: Agents lack persistent state between invocations, would need complex prompt engineering
2. **LangGraph state reducer**: Not applicable to Claude SDK architecture
3. **Unlimited retries**: Violates Constitution Principle I (fast-fail), wastes tokens

---

## 4. Workspace File Strategy

**Decision**: Copy JSXGraph pattern library JSON files to workspace (NOT embedded in prompts)

**Rationale**:
- Pattern library is 9 files × ~100 lines = ~900 lines of structured JSON
- Embedding in prompts wastes tokens on EVERY subagent invocation
- Copying to workspace enables agent to `Read` examples on-demand (token efficient)
- Matches lesson_author pattern: Course_data.txt (large reference) copied to workspace
- Agent can selectively read only relevant patterns (geometry vs algebra vs statistics)

**Implementation Pattern**:

```python
# In DiagramAuthorClaudeAgent.execute()
def _copy_pattern_library_to_workspace(self, workspace_path: Path) -> None:
    """Copy JSXGraph pattern library to workspace for agent access."""
    import shutil

    patterns_dir = workspace_path / "jsxgraph_patterns"
    patterns_dir.mkdir(exist_ok=True)

    source_patterns = Path(__file__).parent / "data" / "jsxgraph_patterns"

    pattern_files = [
        "geometry_patterns.json",
        "algebra_patterns.json",
        "statistics_patterns.json",
        "scottish_color_palette.json"
    ]

    for pattern_file in pattern_files:
        source_path = source_patterns / pattern_file
        dest_path = patterns_dir / pattern_file

        if not source_path.exists():
            logger.warning(f"Pattern file not found: {pattern_file}")
            continue

        shutil.copy(source_path, dest_path)
        logger.debug(f"  Copied: {pattern_file}")

    logger.info(f"✅ {len(pattern_files)} pattern files ready at: {patterns_dir}")
```

**Workspace Structure**:

```
workspace/{execution_id}/
├── lesson_template.json          # Input: fetched in pre-processing
├── cards_for_diagrams.json       # Extracted: cards needing visualization
├── jsxgraph_patterns/            # Reference library
│   ├── geometry_patterns.json
│   ├── algebra_patterns.json
│   └── statistics_patterns.json
├── diagrams/                     # Output directory
│   ├── card_001_diagram.json     # Generated JSXGraph JSON
│   └── card_001_image.png        # Rendered PNG (optional local copy)
└── critique_history.json         # Refinement tracking
```

**Alternatives Considered**:
1. **Embed in prompts**: Wastes ~5,000 tokens per execution (patterns + formatting)
2. **Remote URL fetch**: Adds network dependency, violates isolated workspace pattern
3. **Database storage**: Over-engineered for static reference data

---

## 5. Batch Mode Architecture

**Decision**: Python loop calling `agent.execute()` sequentially for each lesson (NOT agent-managed iteration)

**Rationale**:
- Matches lesson_author pattern: batch_lesson_generator.py uses Python loop
- Simpler to reason about (Constitution Principle: avoid unnecessary complexity)
- Each lesson gets isolated workspace, independent error handling
- Partial success model: continue processing remaining lessons if one fails
- Python can easily implement dry-run mode (analyze without execution)

**Implementation Pattern**:

```python
# diagram_author_batch.py
class DiagramAuthorBatchProcessor:
    """Batch processing for multiple lessons."""

    def __init__(self, mcp_config_path: str = ".mcp.json"):
        self.agent = DiagramAuthorClaudeAgent(
            mcp_config_path=mcp_config_path,
            persist_workspace=True
        )

    async def process_batch(
        self,
        courseId: str,
        force: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Process all lessons for a course."""

        # Fetch all lesson_templates for courseId
        from .utils.appwrite_mcp import list_appwrite_documents

        lesson_templates = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_templates",
            queries=[f'equal("courseId", "{courseId}")']
        )

        logger.info(f"Found {len(lesson_templates)} lesson templates for {courseId}")

        # Sort by sow_order
        lesson_templates.sort(key=lambda x: x.get("sow_order", 0))

        # Dry-run mode: analyze without execution
        if dry_run:
            return await self._analyze_batch_dry_run(courseId, lesson_templates)

        # Execute for each lesson
        results = []
        errors = []

        for lesson_template in lesson_templates:
            lesson_template_id = lesson_template["lessonTemplateId"]
            sow_order = lesson_template.get("sow_order", 0)

            try:
                # Check if diagrams already exist (unless --force)
                if not force and await self._has_existing_diagrams(lesson_template_id):
                    logger.info(f"⏭️  Skipping {lesson_template_id} (diagrams exist, use --force to regenerate)")
                    continue

                logger.info(f"Processing lesson {lesson_template_id} (order {sow_order})...")

                result = await self.agent.execute(
                    courseId=courseId,
                    lesson_template_id=lesson_template_id
                )

                results.append({
                    "lesson_template_id": lesson_template_id,
                    "sow_order": sow_order,
                    "success": result["success"],
                    "diagrams_generated": result.get("diagrams_generated", 0)
                })

            except Exception as e:
                logger.error(f"❌ Failed to process {lesson_template_id}: {e}")
                errors.append({
                    "lesson_template_id": lesson_template_id,
                    "sow_order": sow_order,
                    "error": str(e)
                })

        return {
            "success": len(errors) == 0,
            "courseId": courseId,
            "total_lessons": len(lesson_templates),
            "lessons_processed": len(results),
            "diagrams_generated": sum(r.get("diagrams_generated", 0) for r in results),
            "errors": errors
        }

    async def _analyze_batch_dry_run(
        self,
        courseId: str,
        lesson_templates: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze batch without execution (cost preview)."""

        lessons_needing_diagrams = []
        estimated_tokens = 0

        for lesson_template in lesson_templates:
            # Analyze cards to estimate diagram count
            cards = lesson_template.get("cards", [])
            eligible_cards = self._count_eligible_cards(cards)

            if eligible_cards > 0:
                lessons_needing_diagrams.append({
                    "lesson_template_id": lesson_template["lessonTemplateId"],
                    "sow_order": lesson_template.get("sow_order", 0),
                    "eligible_cards": eligible_cards
                })

                # Estimate tokens (rough): 5,000 tokens per diagram generation + critique
                estimated_tokens += eligible_cards * 5000

        # Calculate estimated cost (Claude Sonnet 4.5 pricing)
        input_token_cost = (estimated_tokens * 0.6) * (3 / 1_000_000)   # $3/M input tokens (60% input)
        output_token_cost = (estimated_tokens * 0.4) * (15 / 1_000_000)  # $15/M output tokens (40% output)
        estimated_cost_usd = input_token_cost + output_token_cost

        return {
            "dry_run": True,
            "courseId": courseId,
            "total_lessons": len(lesson_templates),
            "lessons_needing_diagrams": len(lessons_needing_diagrams),
            "total_eligible_cards": sum(l["eligible_cards"] for l in lessons_needing_diagrams),
            "estimated_tokens": estimated_tokens,
            "estimated_cost_usd": round(estimated_cost_usd, 2),
            "lessons_details": lessons_needing_diagrams
        }
```

**Alternatives Considered**:
1. **Agent-managed batch**: Agent iterates through lessons internally - loses isolation, complex error recovery
2. **Parallel processing**: Constitution doesn't forbid, but adds complexity (race conditions, resource contention)
3. **Queue-based system**: Over-engineered for MVP scope (50 lessons max)

---

## Summary of Technology Choices

| Decision Area | Choice | Key Benefit |
|--------------|--------|-------------|
| Subagent Architecture | 2 subagents via AgentDefinition | Proven Claude SDK pattern, clear separation |
| HTTP Tool Registration | MCP server wrapper | Consistent with Claude agent tools, auto-discovery |
| Refinement Loop | Python orchestrator | Stateless agents, fast-fail on iteration limit |
| Workspace Strategy | Copy pattern library files | Token efficiency, on-demand access |
| Batch Processing | Python sequential loop | Simple, isolated, partial success model |

All decisions prioritize:
- **Constitution Compliance**: Fast-fail (no fallbacks), code quality (extract utilities), simplicity
- **Pattern Reuse**: Leverage existing lesson_author patterns, avoid reinventing
- **Token Efficiency**: Minimize prompt size, use workspace files for reference data
- **Maintainability**: Clear separation of concerns, stateless agents, Python state management

---

## Next Phase

With all technical unknowns resolved, proceed to **Phase 1: Design Artifacts**:
1. data-model.md (entity definitions)
2. contracts/diagram_screenshot_api.yaml (OpenAPI spec)
3. quickstart.md (CLI usage guide)
4. Update agent context files
