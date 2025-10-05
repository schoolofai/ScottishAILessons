# Plan: Integrate SoW Metadata as Third Input Parameter

## Overview
Add Authored_SOW metadata (policy notes, sequencing notes, accessibility notes, engagement notes) as a third JSON input to the lesson author agent to provide course-level context for improved lesson authoring.

## Part 1: Update Lesson Author Agent Prompts

### 1.1 Update LESSON_AGENT_PROMPT (Main Orchestrator)

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:3-123`

**Changes**:

```python
# BEFORE: TWO comma-separated JSON objects
<inputs>
- **Input Format**: You will receive TWO comma-separated JSON objects as a human message:
  1. **SoW Entry** with schema: {...}
  2. **Research Pack** containing exemplars, contexts, pedagogical patterns, and reference URLs
- **First Action**: Write these to `sow_entry_input.json` and `research_pack.json` before proceeding with lesson authoring.
</inputs>

# AFTER: THREE comma-separated JSON objects
<inputs>
- **Input Format**: You will receive THREE comma-separated JSON objects as a human message:
  1. **SoW Entry** with schema: {...}
  2. **Research Pack** containing exemplars, contexts, pedagogical patterns, and reference URLs
  3. **SoW Context Metadata** with schema:
     ```json
     {
       "coherence": {
         "policy_notes": ["<course-level policy guidance>"],
         "sequencing_notes": ["<curriculum sequencing rationale>"]
       },
       "accessibility_notes": ["<course-wide accessibility requirements>"],
       "engagement_notes": ["<course-wide engagement strategies>"],
       "weeks": <integer>,
       "periods_per_week": <integer>
     }
     ```
- **First Action**: Write these to `sow_entry_input.json`, `research_pack.json`, and `sow_context.txt` before proceeding with lesson authoring.
</inputs>
```

**Update <process> section**:

```python
<process>
1) **Write Input to Files**: Parse the THREE JSON objects from user input and write to:
   - `sow_entry_input.json` (lesson-specific data)
   - `research_pack.json` (pedagogical patterns and exemplars)
   - `sow_context.txt` (course-level metadata for context)
2) **Read** all three files to understand the SoW entry, research pack, and course-level context.
3) **Call** `course_outcome_subagent` to fetch official SQA data from Appwrite database...
...
</process>
```

**Update <subagents_available> section**:

```python
<subagents_available>
- `research_subagent`:
  * Purpose: Answer clarification questions with Scottish-specific information (policy notes, pedagogical patterns, URL lookups).
  * Has access to `Course_data.txt`, `research_pack.json`, and `sow_context.txt`.

- `lesson_author_subagent`:
  * Purpose: Draft/edit the LessonTemplate according to the schema and write to `lesson_template.json`.
  * Has access to internet tools for URL lookups and missing information.
  * Uses research pack, SoW entry, Course_data.txt, and sow_context.txt as inputs.

[Critics - all have access to sow_context.txt for validation]
...
</subagents_available>
```

### 1.2 Update LESSON_AUTHOR_SUBAGENT_PROMPT

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:125-428`

**Changes**:

```python
<inputs>
- `sow_entry_input.json`: Single SoW entry with lesson_type, outcomes, assessment standards, engagement_tags, pedagogical_blocks, accessibility_profile, policy, and timing.
- `research_pack.json`: Exemplars, contexts, pedagogical patterns, assessment stems, misconceptions, and reference URLs.
- `Course_data.txt`: Official SQA course data (outcomes, assessment standards, official terminology).
- `sow_context.txt`: Course-level metadata including policy notes, sequencing notes, accessibility notes, engagement notes.
- Critic results (if available): JSON feedback files from critic subagents.
</inputs>

<workflow>
1. **Read inputs**: `sow_entry_input.json`, `research_pack.json`, `Course_data.txt`, `sow_context.txt`
2. **Extract course context** from sow_context.txt:
   - policy_notes: Course-wide calculator policy, assessment approach, formula sheet usage
   - sequencing_notes: Where this lesson fits in the curriculum spiral
   - accessibility_notes: Course-wide accessibility requirements to apply
   - engagement_notes: Course-wide engagement strategies to incorporate
3. **Determine card structure** based on lesson_type...
4. **Populate each card**:
   - Apply course-level policy_notes when setting calculator_allowed
   - Use sequencing_notes to inform prerequisite handling and lesson positioning
   - Apply accessibility_notes for explainer_plain complexity
   - Incorporate engagement_notes for Scottish context selection
   ...
</workflow>
```

**Add new section**:

```python
<using_sow_context>
## How to Use sow_context.txt

**coherence.policy_notes**:
- Informs template-level `policy.calculator_allowed` setting
- Guides assessment card design (formula sheets, working requirements)
- Example: "Calculator use is permitted throughout, however foundational Numeracy skills in the first unit will be built in a non-calculator environment"
  → Set calculator_allowed: false for early numeracy lessons, true for later units

**coherence.sequencing_notes**:
- Validates lesson position in curriculum
- Informs prerequisite handling in card design
- Example: "Skills from the Numeracy unit should be revisited and reinforced throughout delivery of other units"
  → Include retrieval practice cards for previously taught numeracy skills

**accessibility_notes**:
- Sets baseline for explainer_plain complexity
- Guides dyslexia-friendly design features
- Example: "Lessons should use plain language (CEFR_B1) and provide glossaries for key terms"
  → Apply CEFR_B1 across all explainer_plain fields

**engagement_notes**:
- Provides authentic Scottish context suggestions
- Guides CFU stem design
- Example: "Frame problems using authentic Scottish contexts such as local council budgets, ScotRail/Lothian Buses timetables"
  → Use these specific contexts in CFU stems and context_hooks
</using_sow_context>
```

### 1.3 Update PEDAGOGICAL_DESIGN_CRITIC_PROMPT

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:430-503`

**Changes**:

```python
<inputs>
- `lesson_template.json`: The lesson template to critique.
- `sow_entry_input.json`: The SoW entry for context on lesson_type and pedagogical_blocks.
- `research_pack.json`: Pedagogical patterns and best practices.
- `sow_context.txt`: Course-level sequencing notes for curriculum progression validation.
</inputs>

<process>
1) Read `lesson_template.json`, `sow_entry_input.json`, `research_pack.json`, `sow_context.txt`
2) Extract sequencing_notes from sow_context to understand curriculum spiral approach
3) Extract lesson_type and estMinutes from lesson template
4) Evaluate card structure:
   - Check ordering (retrieval → teaching → practice → assessment pattern)
   - Verify scaffolding progression (high support → low support)
   - Confirm lesson_type alignment
   - **NEW**: Validate alignment with sequencing_notes (e.g., spiral curriculum, skill revisiting)
...
</process>
```

### 1.4 Update ASSESSMENT_DESIGN_CRITIC_PROMPT

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:505-593`

**Changes**:

```python
<inputs>
- `lesson_template.json`: The lesson template to critique.
- `sow_entry_input.json`: Assessment standards to cover.
- `Course_data.txt`: Official assessment standard descriptions.
- `research_pack.json`: Assessment stems and rubric patterns.
- `sow_context.txt`: Course-level policy notes for assessment design validation.
</inputs>

<process>
1) Read all input files
2) Extract policy_notes from sow_context to understand course-level assessment approach
3) Extract assessmentStandardRefs from lesson template
4) Compare against Course_data.txt to understand standard requirements
5) **NEW**: Validate assessment design against policy_notes:
   - Calculator policy alignment
   - Formula sheet usage
   - Assessment format requirements (internal, pass/fail, etc.)
...
</process>
```

### 1.5 Update ACCESSIBILITY_CRITIC_PROMPT

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:595-678`

**Changes**:

```python
<inputs>
- `lesson_template.json`: The lesson template to critique.
- `sow_entry_input.json`: Accessibility profile from SoW entry.
- `research_pack.json`: Accessibility patterns and guidance.
- `sow_context.txt`: Course-level accessibility requirements.
</inputs>

<process>
1) Read `lesson_template.json`, `sow_entry_input.json`, `research_pack.json`, `sow_context.txt`
2) Extract accessibility_notes from sow_context for course-wide requirements
3) Extract accessibility_profile from SoW entry (lesson-specific)
4) **NEW**: Validate lesson meets BOTH course-level AND lesson-specific accessibility requirements
5) For each card:
   - Verify explainer_plain is present
   - Count words per sentence (should be ≤15 for A2/B1)
   - **NEW**: Check against course-level accessibility_notes (glossaries, visual aids, screen-reader compatibility)
...
</process>
```

### 1.6 Update SCOTTISH_CONTEXT_CRITIC_PROMPT

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:680-767`

**Changes**:

```python
<inputs>
- `lesson_template.json`: The lesson template to critique.
- `Course_data.txt`: Official SQA terminology and course structure.
- `research_pack.json`: Scottish contexts and exemplars.
- `sow_entry_input.json`: Engagement tags from SoW entry.
- `sow_context.txt`: Course-level engagement strategies.
</inputs>

<process>
1) Read all input files
2) Extract engagement_notes from sow_context for course-wide engagement strategies
3) Extract engagement_tags from SoW entry (lesson-specific)
4) **NEW**: Validate lesson incorporates BOTH course-level engagement strategies AND lesson-specific tags
5) Check template-level fields:
   - Verify outcomeRefs and assessmentStandardRefs match Course_data.txt codes
   - Check engagement_tags are present and authentic
6) For each card CFU:
   - Check currency (all £)
   - **NEW**: Verify contexts align with course-level engagement_notes (e.g., local council budgets, ScotRail)
...
</process>
```

### 1.7 Update COHERENCE_CRITIC_PROMPT

**File**: `langgraph-author-agent/src/lesson_author_prompts.py:769-852`

**Changes**:

```python
<inputs>
- `lesson_template.json`: The lesson template to critique.
- `sow_entry_input.json`: The SoW entry for coherence validation.
- `Course_data.txt`: Official outcomes and assessment standards.
- `sow_context.txt`: Course-level coherence metadata (policy notes, sequencing notes).
</inputs>

<criteria>
- **Outcome/Assessment Standard Mapping**: ...
- **Lesson Type Consistency**: ...
- **Timing Estimates**: ...
- **Engagement Tags**: ...
- **Policy Alignment**:
  * Does policy.calculator_allowed align with sow_entry.policy.calculator_section?
  * **NEW**: Does policy align with course-level policy_notes from sow_context?
- **Sequencing Alignment** (NEW):
  * Does lesson position align with sequencing_notes?
  * Are prerequisites handled as per spiral curriculum approach?
- **Course Duration Feasibility** (NEW):
  * Calculate total lesson time across SoW
  * Validate against sow_context.weeks × sow_context.periods_per_week × average_period_minutes
...
</criteria>
```

## Part 2: Update Seeding Script

### 2.1 Refactor seedAuthoredLesson.ts

**File**: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

**Current Flow**:
```typescript
// Step 1: Load resource pack
resourcePack = loadResourcePack(path)

// Step 2: Get SOW entry
sowEntry = getAuthoredSOWEntry(databases, courseId, order)

// Step 3: Create dual input
dualInput = JSON.stringify(sowEntry) + ',\n' + JSON.stringify(resourcePack)

// Step 4: Run agent
lessonTemplate = runLessonAuthorAgent(dualInput, url, log)
```

**NEW Flow** (pseudo-code):
```typescript
// Step 1: Load resource pack
resourcePack = loadResourcePack(path)

// Step 2: Get FULL Authored SOW document
authoredSOW = getAuthoredSOW(databases, courseId)

// Step 3: Extract SOW entry by order
sowEntry = authoredSOW.entries[order]

// Step 4: Extract metadata from Authored SOW
sowMetadata = parseSOWMetadata(authoredSOW.metadata)

// Step 5: Create TRIPLE input
tripleInput = JSON.stringify(sowEntry) + ',\n'
             + JSON.stringify(resourcePack) + ',\n'
             + JSON.stringify(sowMetadata)

// Step 6: Run agent with triple input
lessonTemplate = runLessonAuthorAgent(tripleInput, url, log)
```

**Implementation Details**:

```typescript
// NEW: Get full Authored_SOW document (not just entry)
async function getAuthoredSOW(
  databases: Databases,
  courseId: string
): Promise<AuthoredSOW> {
  const response = await databases.listDocuments(
    DATABASE_ID,
    AUTHORED_SOW_COLLECTION,
    [Query.equal('courseId', courseId)]
  );

  if (response.documents.length === 0) {
    throw new Error(`No Authored_SOW found for courseId: ${courseId}`);
  }

  const sowDoc = response.documents[0];

  // Parse JSON fields
  return {
    courseId: sowDoc.courseId,
    version: sowDoc.version,
    status: sowDoc.status,
    entries: typeof sowDoc.entries === 'string'
      ? JSON.parse(sowDoc.entries)
      : sowDoc.entries,
    metadata: typeof sowDoc.metadata === 'string'
      ? JSON.parse(sowDoc.metadata)
      : sowDoc.metadata
  };
}

// NEW: Parse and structure metadata for agent
function parseSOWMetadata(metadata: any): SOWContextMetadata {
  if (!metadata) {
    throw new Error('Authored_SOW document missing metadata field');
  }

  // Validate required fields
  if (!metadata.coherence) {
    throw new Error('metadata.coherence is required');
  }

  return {
    coherence: {
      policy_notes: metadata.coherence.policy_notes || [],
      sequencing_notes: metadata.coherence.sequencing_notes || []
    },
    accessibility_notes: metadata.accessibility_notes || [],
    engagement_notes: metadata.engagement_notes || [],
    weeks: metadata.weeks || 36,
    periods_per_week: metadata.periods_per_week || 3
  };
}

// UPDATED: Create triple JSON input
function createTripleInput(
  sowEntry: AuthoredSOWEntry,
  resourcePack: any,
  sowMetadata: SOWContextMetadata
): string {
  return JSON.stringify(sowEntry) + ',\n'
       + JSON.stringify(resourcePack) + ',\n'
       + JSON.stringify(sowMetadata);
}
```

**Updated main() function**:

```typescript
async function main() {
  // ... parse args ...

  try {
    // Step 1: Load resource pack
    console.log('📂 Loading resource pack...');
    const resourcePack = await loadResourcePack(resourcePackPath);
    console.log(`✅ Loaded resource pack (version ${resourcePack.research_pack_version || 'N/A'})`);
    console.log('');

    // Step 2: Get full Authored SOW document
    console.log('📚 Fetching Authored SOW document...');
    const authoredSOW = await getAuthoredSOW(databases, courseId);
    console.log(`✅ Found Authored_SOW (version ${authoredSOW.version}, ${authoredSOW.entries.length} entries)`);
    console.log('');

    // Step 3: Extract SOW entry by order
    if (order < 0 || order >= authoredSOW.entries.length) {
      throw new Error(`Order ${order} out of range (0-${authoredSOW.entries.length - 1})`);
    }
    const sowEntry = authoredSOW.entries[order];
    console.log(`   Entry ${order}: "${sowEntry.label}"`);
    console.log(`   Type: ${sowEntry.lesson_type}`);
    console.log('');

    // Step 4: Extract and validate metadata
    console.log('🔍 Extracting SoW metadata...');
    const sowMetadata = parseSOWMetadata(authoredSOW.metadata);
    console.log(`✅ Metadata extracted:`);
    console.log(`   Policy notes: ${sowMetadata.coherence.policy_notes.length}`);
    console.log(`   Sequencing notes: ${sowMetadata.coherence.sequencing_notes.length}`);
    console.log(`   Accessibility notes: ${sowMetadata.accessibility_notes.length}`);
    console.log(`   Engagement notes: ${sowMetadata.engagement_notes.length}`);
    console.log('');

    // Step 5: Create triple JSON input
    console.log('🔧 Creating triple JSON input...');
    const tripleInput = createTripleInput(sowEntry, resourcePack, sowMetadata);
    console.log(`✅ Created input (${tripleInput.length} characters)`);
    console.log('');

    // Step 6: Run lesson author agent
    const lessonTemplate = await runLessonAuthorAgent(tripleInput, LANGGRAPH_URL, logFile);

    // ... rest of flow ...
  }
}
```

## Files to Modify

1. **langgraph-author-agent/src/lesson_author_prompts.py** (~350 lines affected across 7 prompts)
   - LESSON_AGENT_PROMPT: Lines 3-123
   - LESSON_AUTHOR_SUBAGENT_PROMPT: Lines 125-428
   - PEDAGOGICAL_DESIGN_CRITIC_PROMPT: Lines 430-503
   - ASSESSMENT_DESIGN_CRITIC_PROMPT: Lines 505-593
   - ACCESSIBILITY_CRITIC_PROMPT: Lines 595-678
   - SCOTTISH_CONTEXT_CRITIC_PROMPT: Lines 680-767
   - COHERENCE_CRITIC_PROMPT: Lines 769-852

2. **assistant-ui-frontend/scripts/seedAuthoredLesson.ts** (~100 lines affected)
   - getAuthoredSOWEntry → getAuthoredSOW (new function)
   - Add parseSOWMetadata function
   - Update createDualInput → createTripleInput
   - Update main() function flow

## Validation Criteria

- [ ] Main agent accepts THREE comma-separated JSON inputs
- [ ] Main agent writes to sow_context.txt file
- [ ] All 8 subagents reference sow_context.txt in their <inputs> sections
- [ ] Subagents use metadata appropriately for their concerns
- [ ] seedAuthoredLesson.ts extracts metadata from Authored_SOW
- [ ] seedAuthoredLesson.ts passes metadata as third parameter
- [ ] Error handling for missing metadata field
- [ ] No changes to lesson_author_agent.py (only prompts.py)
- [ ] Backward compatibility: agent gracefully handles missing sow_context.txt (legacy runs)

## Testing Strategy

1. **Unit Test**: Run seedAuthoredLesson.ts with a known Authored_SOW document
2. **Integration Test**: Verify lesson template quality improves with metadata context
3. **Validation Test**: Confirm sow_context.txt is written and read by subagents
4. **Error Test**: Verify graceful failure if metadata field is missing

## Benefits

- **Improved Coherence**: Lessons align with course-level policy and sequencing
- **Better Accessibility**: Course-wide accessibility requirements consistently applied
- **Authentic Engagement**: Scottish contexts drawn from course-level strategies
- **Policy Compliance**: Calculator policy and assessment approach align across all lessons
- **Curriculum Awareness**: Lessons understand their position in the spiral curriculum
