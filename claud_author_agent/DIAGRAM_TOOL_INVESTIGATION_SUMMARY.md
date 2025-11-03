# Diagram Rendering "Parameter Format Issue" Investigation Summary

**Date**: 2025-11-03
**Issue**: All 10 diagram upserts failed with "image_base64 is required"
**Root Cause**: Agent failed to generate PNG images, claiming "parameter format incompatibility"

---

## 🔍 Investigation Findings

### 1. ✅ DiagramScreenshot Service is Working Perfectly

**Test Results**:
- Service running at `http://localhost:3001` (PID 14510)
- Health check: ✅ 200 OK
- Test render: ✅ SUCCESS (returned 32,732 char base64 PNG in 1.2s)
- Service location: `/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/diagramScreenshot/`

**Conclusion**: The service is fully operational and can render JSXGraph diagrams correctly.

---

### 2. ✅ MCP Tool Schema is Correctly Defined

**Tool Definition** (`src/tools/diagram_screenshot_tool.py:155-162`):
```python
@tool(
    "render_diagram",
    "Render JSXGraph diagram JSON to PNG image...",
    {
        "diagram": dict,   # ← Correct: dict type
        "options": dict    # ← Correct: dict type
    }
)
```

**Actual Schema Inspection**:
```python
tool.input_schema = {
    'diagram': <class 'dict'>,
    'options': <class 'dict'>
}
```

**Conclusion**: The tool schema correctly specifies dict (object) parameters, NOT string parameters.

---

### 3. ✅ Agent Prompt Shows Correct Usage

**Subagent Prompt** (`src/prompts/diagram_generation_subagent.md:210-231`):
```markdown
mcp__diagram-screenshot__render_diagram
{
  "diagram": {                    # ← Object, not string
    "board": {...},
    "elements": [...]
  }
}
```

**Conclusion**: The prompt correctly instructs the agent to pass JSON objects, not strings.

---

### 4. ❌ Agent's Claim is INCORRECT

**Agent's Technical Note** (`workspace/exec_20251103_001153/diagrams_output.json:358`):
> "PNG image rendering unavailable due to MCP tool parameter format incompatibility. The mcp__diagram-screenshot__render_diagram tool expects JSON object parameters, but the schema defines string parameters."

**Reality**:
- The schema defines **dict (object)** parameters, NOT strings
- The service accepts and renders diagrams correctly when called directly
- No actual tool call error messages were logged

**Conclusion**: The agent either:
1. Never actually attempted to call the tool
2. Encountered a different error and misinterpreted it
3. Misunderstood how Python `dict` type maps to MCP's JSON Schema

---

## 🤔 Possible Root Causes

### Hypothesis A: MCP Schema Type Serialization Issue

**Problem**: Python `dict` type may not serialize correctly to MCP's JSON Schema format

**Evidence**:
- MCP protocol uses JSON Schema, which requires `{"type": "object"}` for dictionaries
- Claude SDK may be sending `"dict"` (string) instead of proper JSON Schema type
- Agent interprets this as "parameter should be a string" instead of "parameter should be an object"

**Test Needed**: Inspect the actual MCP messages sent between Claude SDK and agent

### Hypothesis B: Agent Hallucination

**Problem**: Agent fabricated a technical excuse without actually trying the tool

**Evidence**:
- No actual error messages from tool calls in workspace
- All 10 diagrams have valid JSXGraph JSON but null images
- Agent's error description is backwards ("tool expects objects, schema defines strings" when it's the opposite)

**Test Needed**: Re-run with verbose logging to capture actual tool call attempts

### Hypothesis C: Silent Tool Call Failure

**Problem**: Agent called tool correctly but received unexpected error response

**Evidence**:
- Service was running during execution
- Agent successfully generated JSXGraph JSON (shows it understood the task)
- Agent chose to proceed without images instead of failing hard

**Test Needed**: Add error logging to diagram_screenshot_tool.py to capture all requests

---

## 🔧 Recommended Fixes

### Fix #1: Clarify Type Mapping in Prompt (Quick)

**File**: `src/prompts/diagram_generation_subagent.md:199`

**Change**:
```markdown
- 1. **Format as string**: Convert diagram JSON to string for tool call
+ 1. **Pass as JSON object**: Pass diagram as a JSON object (NOT a string)
```

**Add new section**:
```markdown
### CRITICAL: Parameter Types

The render_diagram tool expects:
- `diagram`: JSON object (dict) - NOT a JSON string
- `options`: JSON object (dict) - NOT a JSON string

❌ WRONG:
{
  "diagram": "{\"board\": {...}}",  // String - will fail
  "options": "{}"
}

✅ CORRECT:
{
  "diagram": {"board": {...}},      // Object - will succeed
  "options": {}
}
```

### Fix #2: Add Explicit Type Annotations (Medium)

**File**: `src/tools/diagram_screenshot_tool.py:158-161`

**Change**:
```python
@tool(
    "render_diagram",
    "Render JSXGraph diagram JSON to PNG image...",
    {
        "diagram": {"type": "object", "description": "JSXGraph diagram specification"},
        "options": {"type": "object", "description": "Rendering options"}
    }
)
```

This uses JSON Schema format directly instead of Python `dict` type.

### Fix #3: Add Tool Call Logging (Medium)

**File**: `src/tools/diagram_screenshot_tool.py:163` (inside function)

**Add**:
```python
async def render_diagram(args):
    # Log all tool calls for debugging
    logger.info(f"🔧 render_diagram called with args types: {type(args.get('diagram'))}, {type(args.get('options'))}")
    logger.info(f"🔧 Args preview: diagram keys={list(args.get('diagram', {}).keys())}, options={args.get('options')}")

    try:
        # existing code...
```

### Fix #4: Add Health Check to Agent Workflow (Long-term)

**File**: `src/diagram_author_claude_client.py:240` (before registering MCP tools)

**Add**:
```python
# Verify DiagramScreenshot service is available before starting agent
from src.tools.diagram_screenshot_tool import check_diagram_service_health

health = check_diagram_service_health()
if not health.get('available'):
    raise RuntimeError(
        f"DiagramScreenshot service is not available at {health.get('url')}. "
        f"Error: {health.get('error')}. "
        f"Please start the service before running diagram author."
    )
logger.info(f"✅ DiagramScreenshot service health check passed: {health.get('url')}")
```

---

## 📋 Next Steps

1. **Immediate**: Implement Fix #1 (clarify prompt) - 5 minutes
2. **Short-term**: Implement Fix #2 (JSON Schema types) + Fix #3 (logging) - 15 minutes
3. **Re-run**: Execute diagram author on same lesson to verify fix
4. **Long-term**: Implement Fix #4 (health check) - 10 minutes

---

## 📊 Test Results

### Service Health Test
```bash
$ source .venv/bin/activate && python3 test_diagram_tool.py
✅ Service available: True
✅ HTTP Status: 200
✅ Image (base64) length: 32732 chars
✅ Render time: 1283ms
```

### Tool Schema Inspection
```bash
$ source .venv/bin/activate && python3 -c "..."
input_schema: {'diagram': <class 'dict'>, 'options': <class 'dict'>}
```

### Direct HTTP Call
```bash
$ curl -X POST http://localhost:3001/api/v1/render -H "Content-Type: application/json" -d '...'
✅ {"success": true, "image": "iVBORw0KGgo...", "metadata": {...}}
```

---

## 🎯 Conclusion

The "parameter format issue" is **NOT a real service or schema problem**. The issue is either:
1. A miscommunication between Claude SDK's MCP schema serialization and agent's interpretation
2. Agent fabrication/hallucination of a technical excuse
3. An actual tool call error that wasn't properly logged

**Recommended action**: Implement fixes #1-#3 and re-run to capture actual behavior.
