# Remove Research Subagent - Enable On-Demand WebSearch/WebFetch

**Status**: Ready for Implementation
**Created**: 2025-10-16
**Estimated Time**: 2.5 hours

---

## Executive Summary

Remove the Research Subagent from the SOW authoring pipeline and replace upfront research pack generation with on-demand WebSearch/WebFetch capabilities in the SOW Author. This reduces the pipeline from 3 to 2 subagents, saves tokens, and enables more targeted research during authoring.

---

## Current vs. Desired Architecture

### Current (3 Subagents)

```
Python: Course Data Extractor → Course_data.txt
  ↓
Research Subagent → research_pack_json (web research upfront)
  ↓
SOW Author → authored_sow_json (uses Course_data.txt + research_pack_json)
  ↓
Unified Critic → sow_critic_result_json (validates with all 3 files)
  ↓
Python: Upserter → Appwrite
```

### Desired (2 Subagents)

```
Python: Course Data Extractor → Course_data.txt
  ↓
SOW Author (with WebSearch/WebFetch) → authored_sow_json (uses Course_data.txt, searches on-demand)
  ↓
Unified Critic → sow_critic_result_json (validates with Course_data.txt + authored_sow_json)
  ↓
Python: Upserter → Appwrite
```

---

## Benefits

1. **Token Savings**: No upfront research pack generation (~10-15K tokens saved)
2. **Targeted Research**: Only search for what's needed, when needed
3. **Flexibility**: SOW Author can search for specific context/examples per lesson
4. **Simpler Pipeline**: 2 subagents instead of 3
5. **Faster Execution**: No wait for full research pack before authoring
6. **Better Quality**: Searches are lesson-specific, not generic upfront collection

---

## Implementation Phases

### Phase 1: Update SOW Author Prompt (45 min)

**File**: `src/prompts/sow_author_prompt.md`

#### Changes Required

1. **Remove research_pack_json dependency from `<inputs>`**:
   ```markdown
   <inputs>
   - **Input Format**: Course_data.txt must be pre-populated before agent execution.
   - **CRITICAL PREREQUISITE**: `Course_data.txt` must exist in files state.
   - **NOTE**: Course_data.txt is pre-populated by the orchestrator using Python extraction.
   - Course_data.txt contains official SQA course structure, unit titles, codes, outcomes, assessment standards with full descriptions, and recommended sequence.
   </inputs>
   ```

2. **Remove `<research_pack_field_descriptions>` section entirely**

3. **Update `<process>` step 1**: Remove "Validate Research Pack" fail-fast check
   ```markdown
   1) **Validate Course Data** (FAIL-FAST):
      - Check that `Course_data.txt` exists in files state
      - If missing, STOP and raise error: "Course_data.txt not found. This should have been pre-populated by the orchestrator."
      - **NOTE**: Course_data.txt is created via Python extraction BEFORE agent execution (no subagent needed)
   ```

4. **Update `<process>` step 2** (previously step 3): Change from "Read both files" to "Read Course_data.txt only"
   ```markdown
   2) **Read Course_data.txt**: Read `Course_data.txt` to access official SQA course structure, unit names, codes, outcomes, assessment standards (with full descriptions), recommended sequence, and assessment model.
   ```

5. **Remove `<process>` step 4**: Remove "ask research_subagent for clarifications"

6. **Add new section `<websearch_webfetch_guidance>`**:

```markdown
<websearch_webfetch_guidance>
## On-Demand Research with WebSearch/WebFetch

You have access to WebSearch and WebFetch tools. Use them strategically DURING authoring for lesson-specific needs.

### When to Use WebSearch

#### 1. Scottish Context Examples (per lesson)
- **Search**: "Scottish shop prices 2024 [item]" → Find realistic £ prices for worked examples
- **Search**: "NHS Scotland services [area]" → Find authentic Scottish healthcare contexts
- **Search**: "Edinburgh transport fares 2024" → Find Scottish public transport examples
- **Search**: "Scottish high street prices [shop]" → Tesco, Asda, Primark contexts

**Example Usage**:
When authoring a fractions lesson, search: "Scottish supermarket prices 2024" to find realistic contexts like "A 500g box of cereal costs £2.40 at Tesco"

#### 2. SQA Exemplar Questions and Marking Schemes
- **Search**: "SQA {subject} {level} exemplar questions 2024"
- **Search**: "SQA {subject} {level} past papers {year}"
- **Search**: "SQA {subject} marking instructions {topic}"

**Example Usage**:
When authoring a lesson on algebraic equations, search: "SQA National 5 Mathematics algebraic equations past papers" to find authentic question styles

#### 3. Common Misconceptions (per topic)
- **Search**: "common misconceptions {topic} {subject}"
- **Search**: "teaching {topic} common errors students"
- **Search**: "SQA examiner reports {subject} {level} {topic}"

**Example Usage**:
When authoring a lesson on percentages, search: "common misconceptions teaching percentages" to identify specific errors to address in cards

#### 4. Pedagogical Approaches (per lesson type)
- **Search**: "teaching {topic} one-to-one tutoring strategies"
- **Search**: "CfE {subject} pedagogical approaches {topic}"
- **Search**: "effective {topic} teaching methods Scottish curriculum"

**Example Usage**:
When designing a teach lesson for quadratic equations, search: "teaching quadratic equations one-to-one strategies" for AI tutor-specific approaches

#### 5. Accessibility and Dyslexia-Friendly Approaches
- **Search**: "dyslexia-friendly teaching {topic}"
- **Search**: "plain language {topic} mathematics"
- **Search**: "accessible {topic} teaching Scottish education"

### When to Use WebFetch

- **Following up on specific SQA documentation URLs** from search results
- **Accessing official CfE/SQA resources** when you have exact URLs
- **Reading specific SQA course specifications** or assessment exemplars

### Strategic Research Approach

✅ **DO**:
- Search as you author each lesson (targeted, lesson-specific)
- Search for specific needs (e.g., Scottish contexts for this exact worked example)
- Use Course_data.txt first for official terminology, then search for contexts
- Search for misconceptions when designing CFU strategies for a specific card

❌ **DON'T**:
- Search everything upfront (wasteful tokens)
- Search generically (use Course_data.txt for structure)
- Search for what's already in Course_data.txt (official SQA data)
- Over-search (1-2 targeted searches per lesson is usually sufficient)

### Example Workflow

**Authoring Lesson on Fractions (National 5)**:

1. Read Course_data.txt → Get official outcomes and assessment standards
2. Search: "Scottish supermarket prices 2024" → Find £1.80 for 500ml juice
3. Design worked example: "A 500ml bottle of juice costs £1.80 at Asda. A 2-litre bottle costs £5.20. Which is better value?"
4. Search: "common misconceptions comparing fractions" → Find students often compare numerators only
5. Design CFU: "Which is larger: 3/4 or 5/8? Explain your reasoning."
6. Continue authoring with authentic Scottish contexts

</websearch_webfetch_guidance>
```

7. **Update process steps** to include on-demand research:
   ```markdown
   3) **Strategic On-Demand Research**: As you author each lesson:
      - Use WebSearch for Scottish contexts, exemplars, misconceptions (1-2 searches per lesson)
      - Use WebFetch to access specific SQA documentation if needed
      - Refer to <websearch_webfetch_guidance> for strategic approach

   4) **Parse and Enrich Course Data**: Extract units, outcomes, assessment standards...
   [rest of existing steps, renumbered]
   ```

---

### Phase 2: Update Unified Critic Prompt (30 min)

**File**: `src/prompts/unified_critic_prompt.md`

#### Changes Required

1. **Remove research_pack_json from `<inputs>` required files list**:

**Before**:
```markdown
**Required Files** (Verify existence before starting):
- ✓ `research_pack_json`: The grounding research pack with exemplars, contexts, pedagogical patterns, and policy notes.
- ✓ `Course_data.txt`: Official SQA course structure and policies (CRITICAL - use as validation source).
- ✓ `authored_sow_json`: The SoW draft to critique.
```

**After**:
```markdown
**Required Files** (Verify existence before starting):
- ✓ `Course_data.txt`: Official SQA course structure and policies (CRITICAL - use as validation source).
  * **NOTE**: Course_data.txt is pre-populated by the orchestrator using Python extraction.
- ✓ `authored_sow_json`: The SoW draft to critique.

**NOTE**: Research is performed on-demand by SOW Author using WebSearch/WebFetch. No pre-generated research pack file.
```

2. **Update fail-fast validation (Step 0)**: Remove research_pack_json check

**Before**:
```markdown
**Step 0: Fail-Fast Validation** (REQUIRED):
1. Check that `research_pack_json` exists in files state
   - If missing, return fail-fast response with validation_errors
2. Check that `Course_data.txt` exists in files state
   - If missing, return fail-fast response with validation_errors
```

**After**:
```markdown
**Step 0: Fail-Fast Validation** (REQUIRED):
1. Check that `Course_data.txt` exists in files state
   - If missing, return fail-fast response with validation_errors
   - **NOTE**: Course_data.txt is created via Python extraction BEFORE agent execution
2. Check that `authored_sow_json` is valid JSON
   - If invalid, return fail-fast response
```

3. **Update process (Step 1)**: Change "Read all three files" → "Read both files"

**Before**:
```markdown
**Step 1: Read All Required Files**:
- Read `Course_data.txt`, `research_pack_json`, `authored_sow_json`
- Parse and validate JSON structures
```

**After**:
```markdown
**Step 1: Read Required Files**:
- Read `Course_data.txt` and `authored_sow_json`
- Parse and validate JSON structures
```

4. **Update `<dimension_1_coverage>`**: Remove reference to research pack

**Find and remove** this line:
```markdown
- Does the SoW touch all major themes identified in the research pack?
```

5. **Update `<subagents_available>` section**:

**Before**:
```markdown
No subagents are needed for validation. All inputs are pre-populated:
- `Course_data.txt`: Extracted via Python utility before agent execution
- `research_pack_json`: Created by Research Subagent
- `authored_sow_json`: Created by SOW Author Subagent
```

**After**:
```markdown
No subagents are needed for validation. All inputs are pre-populated:
- `Course_data.txt`: Extracted via Python utility before agent execution
- `authored_sow_json`: Created by SOW Author Subagent (with on-demand WebSearch/WebFetch)

**NOTE**: Research is performed on-demand during authoring. The SOW Author uses WebSearch/WebFetch for Scottish contexts, exemplars, and pedagogical approaches as needed.
```

---

### Phase 3: Update Orchestrator (30 min)

**File**: `src/sow_author_claude_client.py`

#### Changes Required

1. **Class Docstring** (lines 25-50):

**Before**:
```python
"""Autonomous SOW authoring pipeline using Claude Agent SDK.

Pre-processing (Python):
0. Course Data Extractor → Creates Course_data.txt from Appwrite (Python utility)

Pipeline execution (3 subagents):
1. Research Subagent → Creates research_pack_json
2. SOW Author → Creates authored_sow_json
3. Unified Critic → Validates and creates sow_critic_result_json (with retry)

Post-processing (Python):
4. Upserter → Writes to Appwrite default.Authored_SOW (Python utility)
```

**After**:
```python
"""Autonomous SOW authoring pipeline using Claude Agent SDK.

Pre-processing (Python):
0. Course Data Extractor → Creates Course_data.txt from Appwrite (Python utility)

Pipeline execution (2 subagents):
1. SOW Author (with WebSearch/WebFetch) → Creates authored_sow_json
2. Unified Critic → Validates and creates sow_critic_result_json (with retry)

Post-processing (Python):
3. Upserter → Writes to Appwrite default.Authored_SOW (Python utility)

Architecture Notes:
    - Course data extraction: Python (no LLM needed, saves tokens)
    - Upserting: Python (deterministic, no LLM needed)
    - Research: On-demand WebSearch/WebFetch during authoring (targeted, efficient)
    - Only creative/judgmental tasks use LLM agents (authoring, critique)
```

2. **_get_subagent_definitions()** (lines 82-114):

**Before**:
```python
def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
    """Load subagent definitions with prompts.

    Note:
        Course data extraction is now handled by Python utility (no subagent).
        Pipeline reduced from 4 to 3 subagents.
    """
    prompts_dir = Path(__file__).parent / "prompts"

    # Load 3 subagent prompts (course_data_extractor removed - Python handles it)
    subagents = {
        "research_subagent": AgentDefinition(
            description="Research subagent for web research and data collection",
            prompt=(prompts_dir / "research_subagent_prompt.md").read_text()
        ),
        "sow_author": AgentDefinition(
            description="SOW author for creating complete schemes of work",
            prompt=(prompts_dir / "sow_author_prompt.md").read_text()
        ),
        "unified_critic": AgentDefinition(
            description="Unified critic for validating SOW quality",
            prompt=(prompts_dir / "unified_critic_prompt.md").read_text()
        )
    }

    logger.info(f"Loaded {len(subagents)} subagent definitions")
    return subagents
```

**After**:
```python
def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
    """Load subagent definitions with prompts.

    Note:
        Course data extraction handled by Python utility (no subagent).
        Research moved to on-demand WebSearch/WebFetch in SOW Author.
        Pipeline reduced to 2 subagents.
    """
    prompts_dir = Path(__file__).parent / "prompts"

    # Load 2 subagent prompts (research moved to on-demand WebSearch/WebFetch)
    subagents = {
        "sow_author": AgentDefinition(
            description="SOW author with on-demand WebSearch/WebFetch for research",
            prompt=(prompts_dir / "sow_author_prompt.md").read_text()
        ),
        "unified_critic": AgentDefinition(
            description="Unified critic for validating SOW quality",
            prompt=(prompts_dir / "unified_critic_prompt.md").read_text()
        )
    }

    logger.info(f"Loaded {len(subagents)} subagent definitions")
    return subagents
```

3. **_build_initial_prompt()** (lines 403-479):

**Before**:
```python
## Pipeline Execution

Execute the following 3 subagents in sequence:

### 1. Research Subagent
- **Task**: Conduct web research and create research pack v3
- **Output**: `/workspace/research_pack_json`
- **Delegate to**: @research_subagent

### 2. SOW Author
- **Task**: Author complete SOW using inputs
- **Inputs**: `/workspace/Course_data.txt` (pre-populated), `/workspace/research_pack_json`
- **Output**: `/workspace/authored_sow_json`
- **Delegate to**: @sow_author
- **Note**: Course_data.txt already exists - extracted by orchestrator before agent execution

### 3. Unified Critic (with retry loop)
- **Task**: Validate SOW across 5 dimensions
- **Inputs**: All 3 files above
- **Output**: `/workspace/sow_critic_result_json`
- **Delegate to**: @unified_critic
- **Logic**:
  - If overall_pass = false and attempt < {self.max_critic_retries}:
    - Pass feedback to @sow_author for revision
    - Re-run @unified_critic
  - If overall_pass = true OR max attempts reached: proceed to completion
```

**After**:
```python
## Pipeline Execution

Execute the following 2 subagents in sequence:

### 1. SOW Author (with On-Demand Research)
- **Task**: Author complete SOW using Course_data.txt and on-demand WebSearch/WebFetch
- **Inputs**: `/workspace/Course_data.txt` (pre-populated by Python extraction)
- **Output**: `/workspace/authored_sow_json`
- **Delegate to**: @sow_author
- **Research Strategy**:
  - Use WebSearch/WebFetch during authoring for lesson-specific needs
  - Search for Scottish contexts, exemplars, misconceptions as needed
  - 1-2 targeted searches per lesson (not upfront bulk research)
- **Note**: Course_data.txt already exists - extracted by orchestrator before agent execution

### 2. Unified Critic (with retry loop)
- **Task**: Validate SOW across 5 dimensions
- **Inputs**: `/workspace/Course_data.txt`, `/workspace/authored_sow_json`
- **Output**: `/workspace/sow_critic_result_json`
- **Delegate to**: @unified_critic
- **Logic**:
  - If overall_pass = false and attempt < {self.max_critic_retries}:
    - Pass feedback to @sow_author for revision
    - Re-run @unified_critic
  - If overall_pass = true OR max attempts reached: proceed to completion
```

4. **Update final output comment** (line 477):

**Before**:
```python
## Final Output
When all 3 subagents complete successfully, report completion.
The authored SOW will be persisted to Appwrite by the orchestrating system.
```

**After**:
```python
## Final Output
When both subagents complete successfully, report completion.
The authored SOW will be persisted to Appwrite by the orchestrating system.
```

5. **execute() method** (line 206):

**Before**:
```python
# Execute pipeline (now only 3 subagents: research, sow_author, critic)
```

**After**:
```python
# Execute pipeline (2 subagents: sow_author with on-demand research, critic)
```

6. **Message processing** (line 236):

**Before**:
```python
if isinstance(message, ResultMessage):
    # Agent has completed 4 subagents
    logger.info(f"✅ Pipeline completed after {message_count} messages")
    break
```

**After**:
```python
if isinstance(message, ResultMessage):
    # Agent has completed 2 subagents
    logger.info(f"✅ Pipeline completed after {message_count} messages")
    break
```

---

### Phase 4: Delete Research Subagent Prompt (5 min)

**File**: `src/prompts/research_subagent_prompt.md`

**Action**: Delete file (no longer needed)

**Command**:
```bash
rm /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent/src/prompts/research_subagent_prompt.md
```

---

### Phase 5: Update Documentation (30 min)

#### File 1: `README.md`

**Changes**:

1. **Update overview section**:

**Before**:
```markdown
**Pipeline Execution (3 Subagents)**:
1. **Research Subagent** → Web research → `research_pack_json`
2. **SOW Author** → Authoring → `authored_sow_json`
3. **Unified Critic** → Validation (with retry) → `sow_critic_result_json`
```

**After**:
```markdown
**Pipeline Execution (2 Subagents)**:
1. **SOW Author (with WebSearch/WebFetch)** → Authoring → `authored_sow_json`
2. **Unified Critic** → Validation (with retry) → `sow_critic_result_json`

The SOW Author uses WebSearch/WebFetch on-demand during authoring for:
- Scottish context examples (prices, shops, services)
- SQA exemplar questions and pedagogical approaches
- Common misconceptions for specific topics
- Accessibility and dyslexia-friendly teaching strategies
```

2. **Update features section**:

**Add new feature**:
```markdown
- ✅ **On-Demand Research**: WebSearch/WebFetch during authoring for targeted, lesson-specific research
```

**Update existing feature**:
```markdown
- ✅ **Cost Optimization**: Python extraction + on-demand research saves tokens vs. upfront bulk research
```

#### File 2: `IMPLEMENTATION_STATUS.md`

**Changes**:

1. **Update Phase 2 section**:

**Before**:
```markdown
### 3 Subagent Prompts (Aligned with LangGraph Architecture)

1. **Research Subagent** (`src/prompts/research_subagent_prompt.md`)
   - Web research specialist for Scottish curriculum
   - Creates research pack v3 with SQA exemplars, pedagogical patterns, Scottish contexts
   - Grounded in Course_data.txt for official terminology
   - **Aligned with LangGraph layers**: role/context, process, schemas, constraints

2. **SOW Author** (`src/prompts/sow_author_prompt.md`)
   ...
```

**After**:
```markdown
### 2 Subagent Prompts (Aligned with LangGraph Architecture)

1. **SOW Author** (`src/prompts/sow_author_prompt.md`)
   - Senior Curriculum Architect with on-demand research capabilities
   - Uses WebSearch/WebFetch during authoring for lesson-specific research
   - 10-step authoring process (expanded from 8)
   - Chunking strategy (2-3 standards per lesson)
   - Enriched format enforcement (entry-level AND card-level)
   - Teach→revision pairing mandatory
   - 6-12 card lesson plans with specific CFU strategies
   - **Aligned with LangGraph layers**: Complete 5-layer structure from production prompts
   - **Research Strategy**: Targeted searches for Scottish contexts, exemplars, misconceptions per lesson

2. **Unified Critic** (`src/prompts/unified_critic_prompt.md`)
   ...
```

2. **Update architecture diagram**:

**Before**:
```
Input: {subject, level, courseId}
  ↓
[Python: Course Data Extractor] → Course_data.txt (NO LLM, deterministic)
  ↓
[Research Subagent] → research_pack_json (LLM creative task)
  ↓
[SOW Author] → authored_sow_json (LLM creative task)
  ↓
[Unified Critic] → sow_critic_result_json (LLM quality validation)
  ↓ (retry loop if validation fails, max 3)
  ↓
[Python: Upserter] → Appwrite: default.Authored_SOW (NO LLM, deterministic)
  ↓
Output: {document_id, metrics}
```

**After**:
```
Input: {subject, level, courseId}
  ↓
[Python: Course Data Extractor] → Course_data.txt (NO LLM, deterministic)
  ↓
[SOW Author with WebSearch/WebFetch] → authored_sow_json (LLM creative + on-demand research)
  │ ↑
  │ └─ WebSearch/WebFetch: Scottish contexts, exemplars, misconceptions (targeted per lesson)
  ↓
[Unified Critic] → sow_critic_result_json (LLM quality validation)
  ↓ (retry loop if validation fails, max 3)
  ↓
[Python: Upserter] → Appwrite: default.Authored_SOW (NO LLM, deterministic)
  ↓
Output: {document_id, metrics}

**Rationale**: Use Python for deterministic operations, LLM for creative tasks, and on-demand WebSearch for targeted research (not upfront bulk). This saves tokens and enables lesson-specific context gathering.
```

3. **Update file count summary**:

**Before**:
```markdown
- **Prompt files**: 3 (research, sow_author, unified_critic - aligned with LangGraph)
```

**After**:
```markdown
- **Prompt files**: 2 (sow_author with on-demand research, unified_critic - aligned with LangGraph)
```

4. **Add new section for October 2025 update**:

```markdown
### Key Updates (October 2025 - Phase 2)

**Architecture**:
- ✅ Removed Research Subagent in favor of on-demand WebSearch/WebFetch
- ✅ Reduced pipeline from 3 to 2 LLM subagents
- ✅ Enabled targeted, lesson-specific research during authoring
- ✅ Token savings: ~10-15K tokens per execution (no upfront research pack)

**Research Approach**:
- ✅ SOW Author uses WebSearch/WebFetch during authoring (not upfront)
- ✅ 1-2 targeted searches per lesson for Scottish contexts, exemplars, misconceptions
- ✅ More efficient: search only for what's needed, when needed
- ✅ Better quality: lesson-specific contexts vs. generic upfront collection
```

---

## Testing Checklist

After implementation, verify:

### Code Changes
- [ ] `sow_author_prompt.md` has `<websearch_webfetch_guidance>` section
- [ ] `sow_author_prompt.md` no longer references `research_pack_json`
- [ ] `sow_author_prompt.md` process steps updated (removed research pack validation)
- [ ] `unified_critic_prompt.md` only expects 2 files (Course_data.txt + authored_sow_json)
- [ ] `unified_critic_prompt.md` fail-fast validation updated (no research_pack check)
- [ ] Orchestrator `_get_subagent_definitions()` loads 2 subagents (not 3)
- [ ] Orchestrator `_build_initial_prompt()` shows 2-step pipeline
- [ ] Orchestrator class docstring updated to show 2 subagents
- [ ] `research_subagent_prompt.md` deleted
- [ ] WebSearch/WebFetch already in `allowed_tools` (line 201 - already present)

### Documentation Changes
- [ ] `README.md` overview shows 2-subagent pipeline
- [ ] `README.md` features list includes on-demand research
- [ ] `IMPLEMENTATION_STATUS.md` Phase 2 shows 2 prompts
- [ ] `IMPLEMENTATION_STATUS.md` architecture diagram updated
- [ ] `IMPLEMENTATION_STATUS.md` file count reflects 2 prompt files
- [ ] `IMPLEMENTATION_STATUS.md` has October 2025 Phase 2 update section

### Functional Testing
- [ ] Agent initializes without errors
- [ ] Pipeline executes SOW Author → Unified Critic (2 steps)
- [ ] SOW Author can use WebSearch during authoring
- [ ] SOW Author can use WebFetch during authoring
- [ ] Unified Critic validates with only Course_data.txt + authored_sow_json
- [ ] No references to research_pack_json in logs
- [ ] Final SOW has authentic Scottish contexts (verify WebSearch worked)

---

## Success Criteria

1. **Pipeline executes with 2 subagents** (not 3)
2. **No research_pack_json file created** in workspace
3. **SOW Author uses WebSearch/WebFetch** during authoring (verify in logs)
4. **Token savings observed**: ~10-15K fewer tokens vs. 3-subagent pipeline
5. **Quality maintained or improved**: Scottish contexts are lesson-specific, not generic
6. **All tests pass**: Code, documentation, and functional tests

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SOW Author over-uses WebSearch (too many searches) | Slower execution, higher costs | Add guidance: "1-2 searches per lesson" |
| SOW Author under-uses WebSearch (misses Scottish contexts) | Quality degradation | Clear examples in prompt: when to search |
| Unified Critic expects research_pack_json | Validation fails | Update fail-fast checks, remove dependency |
| Documentation inconsistency | User confusion | Update all docs simultaneously in Phase 5 |

---

## Rollback Plan

If issues arise after implementation:

1. **Revert commits** for all 5 phases
2. **Restore `research_subagent_prompt.md`** from git history
3. **Restore orchestrator** to 3-subagent version
4. **Test** with original 3-subagent pipeline

Estimated rollback time: 15 minutes

---

## Appendix: WebSearch/WebFetch Tool Confirmation

**Verification** (line 201 in `sow_author_claude_client.py`):
```python
allowed_tools=['Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task', 'WebSearch', 'WebFetch']
```

✅ WebSearch and WebFetch are already in `allowed_tools`. No changes needed to tool configuration.

---

## Implementation Order

1. **Phase 1**: Update SOW Author prompt (45 min)
2. **Phase 2**: Update Unified Critic prompt (30 min)
3. **Phase 3**: Update orchestrator client (30 min)
4. **Phase 4**: Delete research subagent prompt (5 min)
5. **Phase 5**: Update documentation (30 min)

**Total Estimated Time**: 2 hours 20 minutes

---

**END OF SPECIFICATION**
