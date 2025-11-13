# Lesson Author Validation Enforcement Specification

**Status**: Ready for Implementation
**Priority**: High
**Created**: 2025-01-13
**Related Files**:
- `src/prompts/lesson_author_prompt_v2.md`
- `src/prompts/schemas/lesson_template_schema.md`
- `src/lesson_author_claude_client.py`

---

## Problem Statement

The lesson author agent is skipping the validation step and producing schema-invalid templates, wasting tokens in the critic loop.

### Current Issues

1. **Agent skips validation**: Step 5 (validation) in prompt is optional in practice, agent goes directly to Step 6 (critic)
2. **Schema errors found too late**: Critic finds 31 schema errors that validation would catch deterministically
3. **Token waste**: Validation costs ~500 tokens vs critic evaluation ~5,000-10,000 tokens per run
4. **No enforcement mechanism**: Neither prompt nor orchestrator enforces validation

### Evidence from Production

**Workspace**: `20251113_141232`

**Critic findings** (`critic_result.json`):
- All 6 CFU objects missing required `rubric` field
- All misconceptions using wrong field name: `correction` instead of `clarification`
- All misconceptions missing required `id` field
- Total: 31 schema errors (validator shows max 10 per run)

**Missing artifact**: `validation_result.json` - NOT CREATED (agent skipped validation step entirely)

---

## Root Causes

### 1. Validation Not Enforced
**Location**: `lesson_author_prompt_v2.md` lines 180-198

**Issue**:
- Validation is documented as "Step 5"
- BUT it's optional in practice - no blocking mechanism
- Agent can skip directly to "Step 6: Critic"
- No file-write requirement (agent doesn't save validation results)

### 2. Edit-Only Strategy Unclear
**Location**: `lesson_author_prompt_v2.md` lines 142-145

**Issue**:
- Instruction buried mid-prompt
- No clear explanation of WHY (preserves structure, saves tokens)
- Agent may be using Write tool instead of Edit tool
- This recreates entire file → causes schema format errors

### 3. No Orchestrator Guard
**Location**: `lesson_author_claude_client.py` lines 295-620

**Issue**:
- Python orchestrator starts agent and waits for completion
- No check for validation_result.json existence
- No verification that validation passed
- Silent failure if agent skips workflow steps

### 4. Confusing "v2" Terminology
**Location**: Multiple prompt files

**Issue**:
- Prompts reference "v2 schema" without explaining v1
- Agent doesn't understand version context
- Creates confusion about which format to use
- Agent likely learned old format from training data

---

## Proposed Solution

### Phase 1: Remove "v2" Terminology

**Files to Update**:
- `src/prompts/lesson_author_prompt_v2.md`
- `src/prompts/schemas/lesson_template_schema.md`
- `src/prompts/lesson_critic_prompt_v2.md`

**Changes**:
- Remove all "v2" references
- Replace with "current schema" or "required format"
- State requirements directly without version context
- Explain errors in terms of "correct vs incorrect field names"

**Example Change**:
```markdown
# Before
The v2 schema uses 'clarification' instead of 'correction'

# After
Required field: 'clarification' (not 'correction')
```

### Phase 2: Make Validation Mandatory

**File**: `src/prompts/lesson_author_prompt_v2.md`

**Changes**:

1. **Add blocking language** (Step 5):
   ```markdown
   ### Step 5: MANDATORY Schema Validation

   🚨 **CRITICAL CHECKPOINT - DO NOT SKIP THIS STEP**

   You MUST validate before proceeding to critic.
   The critic cannot run if schema is invalid.
   ```

2. **Add file-write requirement**:
   ```markdown
   2. **Save validation result** (required for audit trail):
      Write tool:
        file_path: "/workspace/validation_result.json"
        content: <paste FULL validation response JSON>
   ```

3. **Add validation checklist**:
   ```markdown
   **Validation Checklist (Must Complete Before Critic)**:
   - [ ] Called mcp__validator__validate_lesson_template
   - [ ] Saved validation_result.json
   - [ ] Received `is_valid: true` response
   - [ ] Zero schema errors remaining
   ```

### Phase 3: Clarify Edit-Only Strategy

**File**: `src/prompts/lesson_author_prompt_v2.md`

**Changes**:

1. **Move to top of `<process>` section**
2. **Add explicit prohibition with explanation**:
   ```markdown
   ## 🚫 FORBIDDEN: Write Tool on lesson_template.json

   **NEVER use Write tool** to recreate lesson_template.json
   - ❌ Write recreates entire file → format errors
   - ❌ Write wastes tokens (full rewrite)
   - ❌ Write loses preprocessor's structure

   **ALWAYS use Edit tool**
   - ✅ Edit modifies specific fields only
   - ✅ Edit preserves schema structure
   - ✅ Edit is token-efficient
   ```

### Phase 4: Add Orchestrator Guard

**File**: `src/lesson_author_claude_client.py`

**Location**: After agent execution completes (around line 620)

**Add Post-Execution Check**:
```python
# Verify validation step was completed
validation_file = workspace_path / "validation_result.json"

if not validation_file.exists():
    logger.warning(
        "⚠️ PROMPT ADHERENCE ISSUE: Agent did not create validation_result.json"
    )
    logger.warning("Agent may have skipped validation step (Step 5 in prompt)")
else:
    # Verify validation passed
    with open(validation_file) as f:
        validation_result = json.load(f)

    if not validation_result.get("is_valid", False):
        logger.warning(
            f"⚠️ Agent proceeded to critic despite validation failure: "
            f"{validation_result.get('total_errors')} errors found"
        )
    else:
        logger.info("✅ Validation passed before critic (correct workflow)")
```

**Note**: This is a post-execution check (not enforcement) because the agent runs autonomously.

---

## Implementation Details

### Misconception Field Requirements

**OLD (confusing v2 reference)**:
```markdown
The v2 schema uses 'clarification' instead of 'correction'
```

**NEW (clear required format)**:
```markdown
**Required fields**:
- `id`: Format "MISC_[SUBJECT]_[TOPIC]_NNN" (e.g., "MISC_MATHS_SURDS_001")
- `misconception`: Brief error pattern description
- `clarification`: Corrective explanation (20-50 words)

**Common Errors**:
- ❌ Using "correction" instead of "clarification"
- ❌ Missing "id" field
- ❌ Wrong ID format (must match MISC_[SUBJECT]_[TOPIC]_NNN)
```

### Validation File Requirement

**New Instruction** (add to prompt Step 5):
```markdown
2. **Save validation result** (required for audit trail):

   Immediately after running the validation tool, save the response:

   Write tool:
     file_path: "/workspace/validation_result.json"
     content: <paste the FULL validation response JSON here>

   This creates an audit trail and enables orchestrator verification.
```

### CFU Rubric Requirement

**Clarify in schema** (common error from 20251113_141232):
```markdown
## CFU Structure

Each CFU must have its own rubric (SEPARATE from card-level rubric):

```json
{
  "type": "mcq",
  "id": "CFU_001",
  "stem": "Question text",
  "options": [...],
  "answerIndex": 1,
  "rubric": {
    "total_points": 1,
    "criteria": [
      {
        "description": "Correctly identifies answer",
        "points": 1
      }
    ]
  }
}
```

**Common Error**: Missing `cfu.rubric` field (all CFUs require their own rubric)
```

---

## Success Metrics

### 1. Agent Behavior
- ✅ Always creates `validation_result.json` before calling critic
- ✅ Always fixes errors before proceeding (no schema errors reach critic)
- ✅ Uses Edit tool only (no Write on lesson_template.json)
- ✅ Follows workflow: Fill → Validate → Fix → Re-validate → Critic

### 2. Token Efficiency
- ✅ Zero schema errors reach critic (all caught by validation)
- ✅ ~4,500-9,500 tokens saved per run (avoid expensive critic schema checking)
- ✅ Fewer critic iterations needed (critic focuses on pedagogy only)

### 3. Output Quality
- ✅ All templates pass schema gate on first critic attempt
- ✅ Critic feedback focuses on pedagogical issues (SOW fidelity, quality)
- ✅ Cleaner audit trail (validation_result.json exists in workspace)

---

## Testing Plan

### Test 1: Basic Workflow
```bash
python -m src.lesson_author_cli --courseId course_c84775 --order 7
```

**Verify**:
1. `validation_result.json` exists in workspace
2. `validation_result.json` shows `is_valid: true`
3. `critic_result.json` has `schema_gate.pass: true` (no schema errors)
4. Agent execution logs show Edit tool usage (not Write)

### Test 2: Error Handling
```bash
# Modify blank template to introduce schema error
# Re-run lesson author
```

**Verify**:
1. `validation_result.json` shows `is_valid: false`
2. Agent logs show fix-validate loop (multiple validation calls)
3. Final `validation_result.json` shows `is_valid: true`
4. Critic receives valid template

### Test 3: Orchestrator Guard
```bash
# Check orchestrator logs after execution
grep "validation_result.json" logs/lesson_author.log
```

**Verify**:
1. Log shows "✅ Validation passed before critic" (correct workflow)
2. OR: Log shows "⚠️ PROMPT ADHERENCE ISSUE" (if agent skipped)

---

## Rollback Plan

If agents fail to follow new instructions:

### Option 1: Strengthen Prompt (Low Risk)
- Add more explicit blocking language
- Add examples of correct workflow
- Add negative examples (what NOT to do)

### Option 2: Python Enforcement (Medium Risk)
- Change orchestrator to run validation after card filling
- Block critic invocation if validation fails
- Requires agent architecture changes

### Option 3: Hard Breakpoints (High Risk)
- Add agent checkpoints at Step 5
- Require manual approval before proceeding
- Slows down execution significantly

---

## Related Specifications

- `lesson-author-course-outcomes-refactor-spec.md` - outcomeRefs migration (Phase 1-8)
- `lesson_author_prompt_v2_spec.md` - Prompt design specification
- `LESSON_AUTHOR_AGENT_SPEC.md` - Overall agent architecture

---

## Implementation Checklist

- [ ] Phase 1: Remove "v2" terminology from all prompts
- [ ] Phase 2: Make validation mandatory with file-write requirement
- [ ] Phase 3: Move Edit-only instruction to top of process
- [ ] Phase 4: Add Python orchestrator guard (optional)
- [ ] Test: Run lesson author with course_c84775 order 7
- [ ] Verify: validation_result.json created
- [ ] Verify: Zero schema errors in critic_result.json
- [ ] Document: Update this spec with results

---

## Notes

### Why Not Enforce in Python Mid-Execution?

The lesson author agent runs autonomously via Claude SDK. Python orchestrator:
- Starts the agent
- Waits for completion
- Receives final result

Python CANNOT interrupt mid-execution to enforce validation because:
1. Agent is autonomous (no breakpoints)
2. Claude SDK handles execution internally
3. Would require architecture changes (add checkpoints)

Therefore, we use:
- **Prompt-based enforcement** (primary): Strong language, checklists, blocking instructions
- **Post-execution verification** (secondary): Log warnings if validation skipped

### Why Remove "v2" Terminology?

Agents don't understand version context. Saying "v2 schema" implies:
- There's a v1 schema (agent doesn't know what it is)
- Version history matters (it doesn't - only current format matters)
- Creates confusion about which to use

Better approach:
- State required format directly
- Show correct examples
- Explain common errors (wrong field names)
