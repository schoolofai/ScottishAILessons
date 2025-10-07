# ELIMINATE_COURSE_OUTCOME_SUBAGENT.md

## Task: Move Course Outcome Extraction to Seeding Script

**Status:** Not Started
**Priority:** High (Cost Optimization)
**Estimated Impact:** -$0.18-0.30 per lesson, ~25% faster execution
**Created:** 2025-10-07

---

## Problem Statement

The `course_outcome_subagent` currently uses the expensive Gemini Pro model to perform a **deterministic database query** - fetching SQA course data from Appwrite. This is wasteful because:

1. **No LLM reasoning needed** - it's a simple subject/level equality query
2. **Expensive Pro model** - ~6 API calls per lesson at ~$0.03-0.05 per call
3. **Failure point** - LLM tool calling can fail unpredictably
4. **Slower** - LLM invocation adds unnecessary latency

The seeding script already has all the information needed to perform this query directly.

---

## Current Architecture (Expensive)

```
Input: courseId="course_c84474"
├─ Seeding script fetches Authored_SOW (has courseId reference)
├─ Seeding script creates triple input: <sow_entry>, <resource_pack>, <sow_metadata>
├─ Agent invoked
└─ course_outcome_subagent (Gemini Pro):
    ├─ Extracts subject/level from resource_pack
    ├─ Queries sqa_education.sqa_current via Appwrite MCP
    ├─ Writes to Course_data.txt
    └─ Other subagents read Course_data.txt
```

**Cost:** ~6 Pro API calls (~$0.18-0.30 per lesson)
**Time:** ~3.3 minutes total

---

## Proposed Architecture (Cost-Effective)

```
Input: courseId="course_c84474"
├─ Seeding script fetches course from default.courses (NEW)
├─ Seeding script extracts subject="application-of-mathematics", level="national-4" (NEW)
├─ Seeding script queries sqa_education.sqa_current (NEW)
├─ Seeding script creates quadruple input: <sow_entry>, <resource_pack>, <sow_metadata>, <course_data> (NEW)
└─ Agent invoked
    ├─ course_outcome_subagent REMOVED
    └─ Other subagents read course_data from state
```

**Cost:** $0 (no LLM calls for this query)
**Time:** ~2.5 minutes estimated (25% faster)

---

## Data Flow Details

### Database Schema Reference

**default.courses collection:**
- `courseId` (string, 50 chars) - e.g., "course_c84474"
- `subject` (string, 128 chars) - e.g., "application-of-mathematics"
- `level` (string, 50 chars) - e.g., "national-4"
- `sqaCode` (string, 20 chars, optional)

**sqa_education.sqa_current collection:**
- `subject` (string, 255 chars, indexed)
- `level` (string, 100 chars, indexed)
- `data` (string, 1MB) - JSON containing official SQA course structure
- `course_code` (string, 20 chars)
- Compound index: `subject_level_idx` on `['subject', 'level']` (ASC, ASC)

### Query Flow

1. **Input:** `courseId` from CLI argument (e.g., "course_c84474")
2. **Query default.courses:** `Query.equal('courseId', courseId)` → Get subject & level
3. **Query sqa_current:** `Query.equal('subject', subject)` AND `Query.equal('level', level)` → Get SQA data
4. **Parse data field:** `JSON.parse(courseDoc.data)` → Official SQA course structure
5. **Pass to agent:** Include as 4th JSON object in input

---

## Implementation Steps

### Step 1: Add Course and SQA Data Fetching Functions

**File:** `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`
**Location:** After `loadResourcePack` function (around line 202)

```typescript
/**
 * Fetch course document from default.courses to get subject and level
 */
async function getCourseMetadata(
  databases: Databases,
  courseId: string
): Promise<{ subject: string; level: string; courseDoc: any }> {
  // Query courses collection by courseId attribute
  const response = await databases.listDocuments(
    'default',
    'courses',
    [Query.equal('courseId', courseId)]
  );

  if (response.documents.length === 0) {
    throw new Error(
      `No course found with courseId="${courseId}" in default.courses collection. ` +
      `Run createMissingCourses.ts first.`
    );
  }

  const courseDoc = response.documents[0] as any;

  return {
    subject: courseDoc.subject,
    level: courseDoc.level,
    courseDoc
  };
}

/**
 * Fetch SQA course data from sqa_education.sqa_current using subject and level
 * This replaces the course_outcome_subagent's Appwrite query
 */
async function fetchSQACourseData(
  databases: Databases,
  subject: string,
  level: string
): Promise<any> {
  console.log(`   Querying sqa_current: subject="${subject}", level="${level}"`);

  // Direct equality query (matches sqa_current indexed attributes)
  const response = await databases.listDocuments(
    'sqa_education',
    'sqa_current',
    [
      Query.equal('subject', subject),
      Query.equal('level', level),
      Query.limit(1)
    ]
  );

  if (response.documents.length === 0) {
    throw new Error(
      `No SQA course found for subject="${subject}" level="${level}". ` +
      `Verify these values exist in sqa_education.sqa_current collection.`
    );
  }

  const courseDoc = response.documents[0] as any;

  // Parse the data field (contains official SQA course structure)
  const courseData = JSON.parse(courseDoc.data);

  return courseData;
}
```

---

### Step 2: Update Main Function to Fetch Data

**File:** `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`
**Location:** After Step 1 (load resource pack, line 111)

Add new steps 1.5 and 1.6:

```typescript
// Step 1.5: Get course metadata from default.courses
console.log('📋 Fetching course metadata...');
const { subject, level, courseDoc } = await getCourseMetadata(databases, courseId);
console.log(`✅ Found course: ${courseId}`);
console.log(`   Subject: ${subject}`);
console.log(`   Level: ${level}`);
console.log('');

// Step 1.6: Fetch official SQA course data using subject and level
console.log('🎓 Fetching official SQA course data from Appwrite...');
const courseData = await fetchSQACourseData(databases, subject, level);
const courseTitle = courseData.course_title || courseData.title || 'N/A';
const units = courseData.course_structure?.units || courseData.units || [];
console.log(`✅ Matched SQA course: ${courseTitle}`);
console.log(`   Units: ${units.length}`);
console.log('');
```

---

### Step 3: Update Triple Input to Quadruple Input

**File:** `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`
**Location:** Line 309-319 (createTripleInput function)

**Rename function:**
```typescript
/**
 * Create quadruple JSON input for lesson_author agent
 * Format: <sow_entry>,\n<resource_pack>,\n<sow_metadata>,\n<course_data>
 */
function createQuadrupleInput(
  sowEntry: AuthoredSOWEntry,
  resourcePack: any,
  sowMetadata: SOWContextMetadata,
  courseData: any
): string {
  return (
    JSON.stringify(sowEntry) + ',\n' +
    JSON.stringify(resourcePack) + ',\n' +
    JSON.stringify(sowMetadata) + ',\n' +
    JSON.stringify(courseData)
  );
}
```

**Update call sites:**
- Line 142: `const quadrupleInput = createQuadrupleInput(sowEntry, resourcePack, sowMetadata, courseData);`
- Line 143: `console.log(\`✅ Created input (\${quadrupleInput.length} characters)\`);`
- Line 161: `const lessonTemplate = await runLessonAuthorAgent(quadrupleInput, LANGGRAPH_URL, logFile);`

**Update function signature** for `runLessonAuthorAgent` if needed to reflect new parameter name.

---

### Step 4: Remove Course Outcome Subagent from Python Agent

**File:** `langgraph-author-agent/src/lesson_author_agent.py`

**Remove subagent configuration (lines 88-96):**
```python
# REMOVED: course_outcome_subagent - course data now pre-fetched by seeding script
# The following configuration block should be deleted:
# course_outcome_subagent = {
#     "name": "course_outcome_subagent",
#     "description": "Fetch official SQA course data from Appwrite...",
#     "prompt": COURSE_OUTCOME_SUBAGENT_PROMPT,
#     "tools": appwrite_only_tools,
#     "model": gemini_pro
# }
```

**Remove from subagents list (line 159):**
```python
agent = async_create_deep_agent(
    model=gemini,
    tools=all_tools,
    instructions=LESSON_AGENT_PROMPT,
    subagents=[
        research_subagent,
        # course_outcome_subagent,  # REMOVED - data pre-fetched by seeding script
        lesson_author_subagent,
        pedagogical_design_critic,
        assessment_design_critic,
        accessibility_critic,
        scottish_context_critic,
        coherence_critic
    ],
    context_schema=LessonAuthorState,
).with_config({"recursion_limit": 1000})
```

**Remove Pro model initialization (lines 68-73):**
```python
# REMOVED: gemini_pro - no longer needed after removing course_outcome_subagent
# Delete this entire block:
# gemini_pro = ChatGoogleGenerativeAI(
#     model="gemini-2.5-pro",
#     api_key=os.environ["GOOGLE_API_KEY"],
#     temperature=0.7,
# )
```

**Update flash-lite model comment (lines 60-66):**
```python
# Flash-lite for main agent and all subagents (fast, cost-effective)
gemini = ChatGoogleGenerativeAI(
    model="models/gemini-flash-lite-latest",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)
```

---

### Step 5: Update Main Agent Prompt

**File:** `langgraph-author-agent/src/lesson_author_prompts.py`
**Location:** LESSON_AGENT_PROMPT variable

Update input structure documentation:
```python
LESSON_AGENT_PROMPT = """You are the Lesson Author DeepAgent orchestrator for Scottish secondary education.

## Input Structure
You receive FOUR JSON objects separated by commas:

1. **sow_entry_json** - Single lesson entry from Scheme of Work
2. **resource_pack_json** - Research pack with pedagogical context
3. **sow_metadata_json** - Course-level coherence and accessibility notes
4. **course_data_json** - Official SQA course structure (pre-fetched from sqa_education.sqa_current)

The course data has already been fetched from Appwrite by the seeding script using the
course's subject and level attributes, so you do NOT need to query for it.

## Workflow
1. Parse all four JSON inputs
2. Call lesson_author_subagent to draft the lesson template (course data available in state)
3. Call critic subagents for validation (pedagogical, assessment, accessibility, scottish_context, coherence)
4. Iterate based on feedback until all critics approve (≥0.85 for pedagogical/coherence, ≥0.90 for others)
5. Return final lesson_template.json

## Output
You MUST produce exactly TWO files:
1. lesson_template.json - Complete LessonTemplate adhering to schema
2. lesson_todos.json - Task tracking with status updates

[Rest of prompt remains unchanged...]
"""
```

---

### Step 6: Remove Unused Imports

**File:** `langgraph-author-agent/src/lesson_author_agent.py`
**Location:** Lines 15-38 (import section)

Remove from imports:
```python
# Remove this line (around line 22):
# COURSE_OUTCOME_SUBAGENT_PROMPT,
```

Updated imports should look like:
```python
try:
    from src.lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        LESSON_AUTHOR_SUBAGENT_PROMPT,
        PEDAGOGICAL_DESIGN_CRITIC_PROMPT,
        ASSESSMENT_DESIGN_CRITIC_PROMPT,
        ACCESSIBILITY_CRITIC_PROMPT,
        SCOTTISH_CONTEXT_CRITIC_PROMPT,
        COHERENCE_CRITIC_PROMPT
    )
    # COURSE_OUTCOME_SUBAGENT_PROMPT removed - no longer used
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
    from src.shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT  # Remove this line
except ImportError:
    [... similar pattern for ImportError block ...]
```

**Actually, remove the entire import line for COURSE_OUTCOME_SUBAGENT_PROMPT from both try and except blocks.**

---

## Testing Plan

### Test 1: Verify Course Document Exists
**Prerequisite Check:**
```bash
# Verify course_c84474 exists in default.courses
# Expected: subject="application-of-mathematics", level="national-4"
```

If missing, run:
```bash
npm run create:missing-courses
```

---

### Test 2: Test Modified Seeding Script
```bash
cd assistant-ui-frontend
npm run seed:authored-lesson course_c84474 4 ../langgraph-author-agent/data/Seeding_Data/input/research_packs/application-of-mathematics_national-4.json
```

**Expected Console Output:**
```
🚀 Starting Lesson Authoring Pipeline
=====================================
Course ID: course_c84474
Order: 4
Resource Pack: ../langgraph-author-agent/data/Seeding_Data/input/research_packs/application-of-mathematics_national-4.json

📂 Loading resource pack...
✅ Loaded resource pack (version 3)

📋 Fetching course metadata...
✅ Found course: course_c84474
   Subject: application-of-mathematics
   Level: national-4

🎓 Fetching official SQA course data from Appwrite...
   Querying sqa_current: subject="application-of-mathematics", level="national-4"
✅ Matched SQA course: Applications of Mathematics (National 4)
   Units: 4

📚 Fetching Authored SOW document...
✅ Found Authored SOW for course: course_c84474
   Total entries: X

[... rest of output ...]
```

---

### Test 3: Verify Agent Behavior
**Check LangSmith Trace:**
1. Navigate to LangSmith dashboard
2. Find the trace for the test run
3. **Verify:** NO `course_outcome_subagent` node execution
4. **Verify:** lesson_author_subagent receives course data in state
5. **Verify:** lesson_template.json is generated successfully

---

### Test 4: Performance and Cost Comparison

**Before (with Pro model):**
- Time: ~3.3 minutes
- Pro API calls: ~6 calls
- Estimated cost: $0.18-0.30 per lesson

**After (seeding script only):**
- Time: ~2.5 minutes (estimated)
- Pro API calls: 0 calls
- Estimated cost: $0.00 for this operation

**Measure actual time:**
```bash
time npm run seed:authored-lesson course_c84474 4 ../langgraph-author-agent/data/Seeding_Data/input/research_packs/application-of-mathematics_national-4.json
```

---

### Test 5: Quality Validation
**Verify generated lesson maintains quality:**

1. **Check outcome alignment:**
   - Generated lesson references correct unit codes
   - Outcome IDs match official SQA course structure

2. **Check assessment standards:**
   - Assessment standards are accurate and match SQA data
   - No hallucinated standards

3. **Check structural integrity:**
   - Lesson template has all required fields
   - Cards array is populated (not empty)
   - Compressed cards can be decoded

4. **Compare with Pro model output:**
   - Generate one lesson with old method (if rollback needed)
   - Compare quality metrics side-by-side

---

## Rollback Plan

If issues arise (quality degradation, missing data, errors):

### Rollback Step 1: Revert TypeScript Changes
```bash
cd assistant-ui-frontend
git checkout scripts/seedAuthoredLesson.ts
```

### Rollback Step 2: Restore Python Agent
```bash
cd ../langgraph-author-agent
git checkout src/lesson_author_agent.py
git checkout src/lesson_author_prompts.py
```

### Rollback Step 3: Restart Services
```bash
cd ..
./langgraph-agent/stop.sh
./langgraph-agent/start.sh
```

---

## Success Criteria

- ✅ Seeding script successfully queries default.courses for course metadata
- ✅ Seeding script successfully queries sqa_education.sqa_current for SQA data
- ✅ Agent receives quadruple JSON input with course data
- ✅ course_outcome_subagent removed from agent configuration
- ✅ Pro model removed from lesson_author_agent.py
- ✅ Lesson generation completes without errors
- ✅ Generated lessons maintain quality (SQA alignment, no hallucinations)
- ✅ Performance improves by ~25%
- ✅ Cost reduced by $0.18-0.30 per lesson
- ✅ LangSmith trace shows no course_outcome_subagent execution

---

## Expected Benefits

### Cost Reduction
- **Eliminate Pro model usage:** -$0.18 to -$0.30 per lesson
- **Scalability:** Cost savings multiply with volume (100 lessons = -$18-30, 1000 lessons = -$180-300)

### Performance Improvement
- **Faster execution:** ~25% reduction (3.3 min → 2.5 min estimated)
- **No LLM latency:** Direct Appwrite queries are milliseconds vs. seconds

### Reliability Improvement
- **Remove failure point:** LLM tool calling can fail unpredictably
- **Deterministic queries:** Database queries have predictable error modes
- **Simpler debugging:** Fewer moving parts, clearer error messages

### Architectural Clarity
- **Separation of concerns:** Seeding script owns data orchestration, agent owns reasoning
- **Reduced agent complexity:** 7 subagents instead of 8
- **Explicit data flow:** Course data provenance is clear

---

## Notes

### Key Architectural Insight
The `default.courses` collection acts as the **single source of truth** for course metadata (subject, level, sqaCode), while `sqa_education.sqa_current` contains the **official SQA curriculum data**. By querying both in the seeding script, we maintain clean separation of concerns while eliminating expensive LLM reasoning over deterministic database lookups.

### Compound Index Optimization
The sqa_current collection has a compound index `subject_level_idx` on `['subject', 'level']` (ASC, ASC). This means our equality queries will be **very fast** (O(log n) lookup). The original LLM-based approach was slower AND more expensive.

### Future Considerations
This pattern can be applied to other deterministic data fetching operations:
- Research subagent's policy note lookups
- Coherence critic's SoW validation queries
- Any operation where LLM is used for database queries rather than reasoning

---

## Implementation Checklist

- [ ] Step 1: Add getCourseMetadata and fetchSQACourseData functions
- [ ] Step 2: Update main function with steps 1.5 and 1.6
- [ ] Step 3: Rename createTripleInput to createQuadrupleInput and update call sites
- [ ] Step 4: Remove course_outcome_subagent from lesson_author_agent.py
- [ ] Step 5: Remove gemini_pro model initialization
- [ ] Step 6: Update LESSON_AGENT_PROMPT in lesson_author_prompts.py
- [ ] Step 7: Remove COURSE_OUTCOME_SUBAGENT_PROMPT imports
- [ ] Test 1: Verify course_c84474 exists in default.courses
- [ ] Test 2: Run seeding script and verify console output
- [ ] Test 3: Check LangSmith trace for subagent removal
- [ ] Test 4: Measure performance improvement
- [ ] Test 5: Validate lesson quality
- [ ] Document final metrics (time saved, cost saved)

---

**End of Specification**
