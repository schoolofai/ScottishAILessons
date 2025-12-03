# Diagram Author Nano - REWRITE SPEC

## 🔴 STATUS: REWRITE REQUIRED

The previous implementation deviated from the Claude Agent SDK architecture. This spec defines a proper rewrite following the same pattern as `diagram_author_claude_client.py`.

**Date**: December 1, 2025

---

## Problem Statement

The current nano implementation incorrectly:
1. Uses **Python code to craft prompts** (`PromptArchitectAgent`, `_build_gemini_prompt()`)
2. Uses **direct Anthropic API calls** for visual critique (`visual_critic_claude.py`)
3. Calls **Gemini API from Python** instead of through a Claude Agent SDK tool

This violates the core principle: **Let Claude handle generative tasks, not Python code**.

---

## Target Architecture

Follow the **same pattern** as `diagram_author_claude_client.py`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIAGRAM AUTHOR NANO - CORRECT ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRE-PROCESSING (Python - unchanged)                                        │
│  ─────────────────────────────────────                                      │
│  1. fetch_lesson_template() → lesson_template.json                          │
│  2. EligibilityAnalyzerAgent → eligible_cards.json                          │
│  3. Create isolated workspace                                               │
│                                                                             │
│  AGENT EXECUTION (Claude Agent SDK)                                         │
│  ─────────────────────────────────────                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MAIN ORCHESTRATOR AGENT                      │   │
│  │                                                                      │   │
│  │  Reads: lesson_template.json, eligible_cards.json                   │   │
│  │  Orchestrates: 2 subagents per card                                 │   │
│  │  Writes: diagrams_output.json                                       │   │
│  │                                                                      │   │
│  │  ┌──────────────────────┐      ┌──────────────────────┐            │   │
│  │  │  @gemini_subagent    │      │  @visual_critic      │            │   │
│  │  │                      │      │    _subagent         │            │   │
│  │  │  - Receives card     │      │                      │            │   │
│  │  │    context           │      │  - Reads PNG from    │            │   │
│  │  │  - Generates prompt  │      │    workspace         │            │   │
│  │  │    (GENERATIVE)      │      │  - Context-aware     │            │   │
│  │  │  - Calls MCP tool    │      │    critique          │            │   │
│  │  │  - Saves PNG         │      │  - Returns score     │            │   │
│  │  └──────────────────────┘      └──────────────────────┘            │   │
│  │           │                              │                          │   │
│  │           │   mcp__gemini__generate      │   Read tool (PNG)        │   │
│  │           ▼                              ▼                          │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                    MCP TOOL: gemini_generate                 │  │   │
│  │  │                                                              │  │   │
│  │  │  - Receives: prompt (string)                                 │  │   │
│  │  │  - Calls: Gemini API (gemini-3-pro-image-preview)           │  │   │
│  │  │  - Saves: PNG to workspace/diagrams/{card_id}_{context}.png │  │   │
│  │  │  - Returns: {success, image_path, error}                    │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  POST-PROCESSING (Python - unchanged)                                       │
│  ─────────────────────────────────────                                      │
│  4. batch_upsert_diagrams() → Appwrite                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Principle: NO Python Prompt Crafting

**WRONG** (current implementation):
```python
# Python code crafting prompts - ANTI-PATTERN
prompt = f"Create diagram for {card.title}..."
gemini.generate(prompt)
```

**CORRECT** (target implementation):
```
Main Agent → @gemini_subagent with card context
Gemini Subagent (Claude) → Analyzes card, crafts prompt GENERATIVELY
Gemini Subagent → Calls mcp__gemini__generate tool with crafted prompt
```

The **Claude agent** decides what to draw and how to phrase the Gemini prompt - NOT Python code.

---

## Components to Create

### 1. Gemini MCP Tool (`src/tools/gemini_mcp_tool.py`)

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool(
    name="generate_diagram",
    description="Generate a diagram image using Gemini API",
    schema={
        "prompt": str,           # Natural language prompt for Gemini
        "output_filename": str,  # Where to save (e.g., "card_001_lesson.png")
        "aspect_ratio": str,     # "16:9" default
    }
)
async def generate_diagram(args):
    """
    1. Call Gemini API with prompt
    2. Save PNG to workspace/diagrams/{output_filename}
    3. Return {success: bool, image_path: str, error: str|None}
    """
```

### 2. Gemini Subagent Prompt (`src/prompts/gemini_subagent.md`)

```markdown
# Gemini Diagram Generation Subagent

You are a diagram generation specialist for Scottish secondary education.

## Your Task
Generate educational diagrams by:
1. Analyzing the card content provided
2. Deciding what visual elements are needed
3. Crafting a detailed Gemini prompt (YOU do this, not Python code)
4. Calling mcp__gemini__generate tool
5. Returning the image path

## Context-Aware Generation

### For LESSON diagrams:
- Show ALL values including answers
- Include comprehensive teaching elements
- Use color coding for emphasis
- Add formula references where helpful

### For CFU diagrams:
- Show ONLY given values
- Use "?" where student calculates
- NO answer values visible
- Minimal, focused design

## Scottish Color Palette (MANDATORY)
- Primary: #0066CC (blue)
- Answers: #28a745 (green)
- Attention: #FFA500 (orange)
- Errors: #DC3545 (red)
- Grid: #6c757d (gray)
- Background: #FFFFFF (white)

## Tool Usage
Call: mcp__gemini__generate
- prompt: Your crafted visual description
- output_filename: {card_id}_{context}_{index}.png
- aspect_ratio: "16:9"

## Output
Write result to workspace:
{
  "success": true,
  "image_path": "/path/to/diagram.png",
  "prompt_used": "The prompt you crafted"
}
```

### 3. Visual Critic Subagent Prompt (`src/prompts/visual_critic_subagent_nano.md`)

Same as existing `visual_critic_subagent.md` but:
- Feedback is VISUAL descriptions (not code changes)
- Uses Read tool to view PNG
- Context-aware (lesson vs CFU) scoring

### 4. Main Orchestrator Prompt (`src/prompts/nano_diagram_author_prompt.md`)

```markdown
# Diagram Author Nano - Main Orchestrator

## Workspace Files
- lesson_template.json: Full lesson template
- eligible_cards.json: Cards needing diagrams

## Pipeline (per eligible card)
1. Read card from eligible_cards.json
2. For each diagram_context in card.diagram_contexts:
   a. Call @gemini_subagent with card content + context
   b. Call @visual_critic_subagent to critique PNG
   c. If score < 0.85 and iteration < 10:
      - Get visual feedback
      - Call @gemini_subagent with feedback for refinement
   d. If score >= 0.85: Accept
   e. If iteration >= 10: Reject

3. Write diagrams_output.json with all results

## Output Schema
diagrams_output.json:
[
  {
    "card_id": "...",
    "diagram_context": "lesson|cfu",
    "image_path": "...",
    "visual_critique_score": 0.87,
    "critique_iterations": 3,
    "success": true
  }
]
```

### 5. Updated Client (`src/diagram_author_nano_client.py`)

```python
class DiagramAuthorNanoAgent:
    """Claude Agent SDK-based diagram generation with Gemini."""

    def _get_subagent_definitions(self):
        return {
            "gemini_subagent": AgentDefinition(
                description="Generates diagrams via Gemini API",
                prompt=(prompts_dir / "gemini_subagent.md").read_text()
            ),
            "visual_critic_subagent": AgentDefinition(
                description="Critiques diagram quality",
                prompt=(prompts_dir / "visual_critic_subagent_nano.md").read_text()
            )
        }

    def _get_mcp_servers(self, workspace_path):
        return {
            "gemini": create_gemini_mcp_server(workspace_path)
        }

    async def execute(self, courseId, order, card_order=None):
        # Pre-processing (unchanged)
        lesson_template = await fetch_lesson_template(...)
        eligible_cards = await eligibility_agent.analyze(...)

        # Write to workspace
        workspace.write("lesson_template.json", lesson_template)
        workspace.write("eligible_cards.json", eligible_cards)

        # Agent execution (Claude SDK orchestrates everything)
        options = ClaudeAgentOptions(
            agents=self._get_subagent_definitions(),
            mcp_servers=self._get_mcp_servers(workspace_path),
            allowed_tools=["Read", "Write", "Glob", "mcp__gemini__generate_diagram"],
            cwd=str(workspace_path),
            permission_mode="bypassPermissions",
            max_turns=500
        )

        async with ClaudeSDKClient(options) as client:
            result = await client.process_prompt(orchestrator_prompt)

        # Post-processing (unchanged)
        diagrams = workspace.read("diagrams_output.json")
        await batch_upsert_diagrams(diagrams)
```

---

## Files to DELETE (incorrect implementation)

| File | Reason |
|------|--------|
| `src/utils/visual_critic_claude.py` | Direct Anthropic API - wrong pattern |
| `src/prompt_architect_agent.py` | Python prompt crafting - wrong pattern |
| `src/prompts/prompt_architect.md` | Not needed - Claude does this generatively |

---

## Files to CREATE

| File | Purpose |
|------|---------|
| `src/tools/gemini_mcp_tool.py` | MCP tool wrapping Gemini API |
| `src/prompts/gemini_subagent.md` | Subagent for diagram generation |
| `src/prompts/visual_critic_subagent_nano.md` | Visual critique (visual feedback) |
| `src/prompts/nano_diagram_author_prompt.md` | Main orchestrator prompt |

---

## Files to MODIFY

| File | Change |
|------|--------|
| `src/diagram_author_nano_client.py` | Rewrite to use Claude SDK pattern |

---

## Files to KEEP (unchanged)

| File | Reason |
|------|--------|
| `src/eligibility_analyzer_agent.py` | Already uses Claude SDK correctly |
| `src/utils/gemini_client.py` | API client (used by MCP tool) |
| `src/utils/gemini_image_generator.py` | Image generation (used by MCP tool) |
| `src/utils/diagram_upserter.py` | Post-processing |
| `src/utils/diagram_extractor.py` | Pre-processing |

---

## Implementation Order

| Phase | Task |
|-------|------|
| 1 | Create `gemini_mcp_tool.py` with generate_diagram tool |
| 2 | Create `gemini_subagent.md` prompt |
| 3 | Create `visual_critic_subagent_nano.md` prompt |
| 4 | Create `nano_diagram_author_prompt.md` orchestrator |
| 5 | Rewrite `diagram_author_nano_client.py` |
| 6 | Delete incorrect files |
| 7 | Test end-to-end |

---

## Key Differences from Original Diagram Author

| Aspect | Original (JSXGraph) | Nano (Gemini) |
|--------|---------------------|---------------|
| Image Source | JSXGraph JSON → DiagramScreenshot | Gemini API |
| MCP Tool | `diagram_screenshot` | `gemini_generate` |
| Feedback Format | Code changes | Visual descriptions |
| Subagents | researcher + generation + critic | generation + critic |
