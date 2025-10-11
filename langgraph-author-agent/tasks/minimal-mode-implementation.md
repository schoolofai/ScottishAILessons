# Minimal Mode Implementation Spec

## Overview
Add a `--minimal` flag to the lesson authoring system to reduce context costs by ~95% while maintaining lesson quality by leveraging the LLM's training knowledge.

## Cost Analysis

### Current Full Mode Context
- **Course_data.txt**: 74,000-130,000 chars (SQA outcomes, assessment standards, terminology)
- **research_pack.json**: 10,000-25,000 chars (exemplars, pedagogical patterns, URLs)
- **sow_context.json**: 3,000-10,000 chars (course metadata, curriculum context)
- **sow_entry_input.json**: 2,000-5,000 chars (lesson requirements - REQUIRED)
- **Total**: ~87,000-165,000 chars of input context

### Minimal Mode Context
- **sow_entry_input.json**: 2,000-5,000 chars (lesson requirements - REQUIRED)
- **Total**: ~2,000-5,000 chars of input context
- **Savings**: ~95% reduction in input tokens

## Rationale

The LLM has been trained on:
- Pedagogical theory and instructional design principles
- SQA National Qualifications framework and Scottish curriculum
- Mathematics education best practices
- Assessment design and formative feedback strategies

For most lessons, the model's training knowledge is sufficient. The optional files provide **grounding** and **validation** but aren't strictly necessary for authoring pedagogically sound lessons.

## Implementation Plan

### 1. CLI Argument Parsing

**File**: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

**Location**: After existing argument parsing (around line 700-750)

```typescript
// Add to CLI argument parsing section
const isMinimal = process.argv.includes('--minimal');

if (isMinimal) {
  console.log('🔹 MINIMAL MODE: Using only sow_entry_input.json (95% token reduction)');
  console.log('   Optional files (Course_data.txt, research_pack.json, sow_context.json) will be skipped');
  console.log('   Agent will use training knowledge for pedagogy and curriculum standards');
}
```

### 2. Conditional File Fetching

**File**: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

**Location**: In `main()` function, around lines 287-309

**Current Code**:
```typescript
// Fetch all required data
const courseData = await getCourseData(courseId);
const resourcePack = await getResourcePack(sowEntry.$id);
const sowMetadata = await getSowContext(sowEntry.sow_id);
```

**Updated Code**:
```typescript
// Always fetch required data
const sowEntry = findSowEntry(sowEntries, sowEntryName);
if (!sowEntry) throw new Error(`SOW entry not found: ${sowEntryName}`);

// Conditionally fetch optional data
let courseData: string | null = null;
let resourcePack: any | null = null;
let sowMetadata: any | null = null;

if (!isMinimal) {
  console.log('📄 Fetching optional context files...');
  courseData = await getCourseData(courseId);
  resourcePack = await getResourcePack(sowEntry.$id);
  sowMetadata = await getSowContext(sowEntry.sow_id);
  console.log('✅ Optional context files loaded');
} else {
  console.log('⚡ MINIMAL MODE: Skipping optional context files');
}
```

### 3. Update runLessonAuthorAgent Function

**File**: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

**Location**: Function signature and implementation (lines 593-649)

**Current Signature**:
```typescript
async function runLessonAuthorAgent(
  threadId: string,
  attempt: number,
  courseData: string,
  sowEntry: SOWEntry,
  resourcePack: any,
  sowMetadata: any
): Promise<any>
```

**Updated Signature**:
```typescript
async function runLessonAuthorAgent(
  threadId: string,
  attempt: number,
  sowEntry: SOWEntry,
  courseData: string | null,
  resourcePack: any | null,
  sowMetadata: any | null,
  isMinimal: boolean
): Promise<any>
```

**Updated File Injection**:
```typescript
const files: Record<string, string> = {
  'sow_entry_input.json': JSON.stringify(sowEntry, null, 2)
};

// Add optional files only if provided
if (!isMinimal && courseData) {
  files['Course_data.txt'] = courseData;
}
if (!isMinimal && resourcePack) {
  files['research_pack.json'] = JSON.stringify(resourcePack, null, 2);
}
if (!isMinimal && sowMetadata) {
  files['sow_context.json'] = JSON.stringify(sowMetadata, null, 2);
}

const input = attempt === 1
  ? {
      messages: [{
        role: 'user',
        content: isMinimal
          ? 'Author lesson from sow_entry_input.json using your training knowledge'
          : 'Author lesson from provided input files'
      }],
      files
    }
  : { messages: [{ role: 'user', content: 'continue' }] };
```

**Updated Function Call in main()**:
```typescript
// Pass isMinimal flag to agent
const response = await runLessonAuthorAgent(
  threadId,
  attempt,
  sowEntry,
  courseData,
  resourcePack,
  sowMetadata,
  isMinimal
);
```

### 4. Update Agent Prompts

**File**: `langgraph-author-agent/src/lesson_author_prompts.py`

#### 4.1 Update LESSON_AGENT_PROMPT Inputs Section

**Location**: Lines 7-59

**Current**:
```python
<inputs>
- **Available Input Files**: Use file system tools to read the following files:
  - `sow_entry_input.json`: Lesson requirements with schema:
    [schema details...]
  - `research_pack.json`: Exemplars, contexts, pedagogical patterns, and reference URLs
  - `sow_context.json`: Course-level metadata with schema:
    [schema details...]
  - `Course_data.txt`: Official SQA course data (outcomes, assessment standards, terminology)

- **First Action**: Read all four files to begin lesson authoring
</inputs>
```

**Updated**:
```python
<inputs>
- **Available Input Files**: Use file system tools to read the following files:

  **REQUIRED**:
  - `sow_entry_input.json`: Lesson requirements with schema:
    [schema details...]

  **OPTIONAL** (use if present, otherwise use your training knowledge):
  - `research_pack.json`: Exemplars, contexts, pedagogical patterns, and reference URLs
    - If missing: Use your training knowledge of pedagogical patterns and exemplar design
  - `sow_context.json`: Course-level metadata with schema:
    [schema details...]
    - If missing: Use your training knowledge of Scottish curriculum structure
  - `Course_data.txt`: Official SQA course data (outcomes, assessment standards, terminology)
    - If missing: Use your training knowledge of SQA National Qualifications and assessment standards

- **First Action**:
  1. Read `sow_entry_input.json` (REQUIRED - error if missing)
  2. Attempt to read optional files (`research_pack.json`, `sow_context.json`, `Course_data.txt`)
  3. If optional files are missing, proceed using your training knowledge
  4. Do NOT fail or show errors for missing optional files
</inputs>
```

#### 4.2 Update LESSON_AGENT_PROMPT Process Section

**Location**: Lines 514-582

**Current**:
```python
<process>
1) **Read all input files**:
   - `sow_entry_input.json` (lesson requirements)
   - `research_pack.json` (pedagogical patterns and exemplars)
   - `sow_context.json` (course-level context)
   - `Course_data.txt` (official SQA data)
   - If any file is missing, report error immediately
2) If needed, **ask** `research_subagent` for clarifications...
[rest of process...]
</process>
```

**Updated**:
```python
<process>
1) **Read input files**:
   - `sow_entry_input.json` (REQUIRED - fail immediately if missing)
   - `research_pack.json` (OPTIONAL - use if present, otherwise use training knowledge)
   - `sow_context.json` (OPTIONAL - use if present, otherwise use training knowledge)
   - `Course_data.txt` (OPTIONAL - use if present, otherwise use training knowledge)

   **File Handling Strategy**:
   - REQUIRED files: Report error immediately if missing
   - OPTIONAL files: Silently proceed using training knowledge if missing
   - Do NOT show warnings or errors for missing optional files

2) **Knowledge Sources** (in priority order):
   - Primary: `sow_entry_input.json` (lesson requirements)
   - Secondary: Optional files if present (grounding and validation)
   - Tertiary: Your training knowledge of:
     - SQA National Qualifications framework
     - Scottish curriculum structure
     - Pedagogical theory and instructional design
     - Mathematics education best practices
     - Assessment design and formative feedback

3) If needed, **ask** `research_subagent` for clarifications...
[rest of process...]
</process>
```

#### 4.3 Update COMBINED_LESSON_CRITIC_PROMPT Inputs

**Location**: Lines 1194-1199

**Current**:
```python
<inputs>
- **Available files**:
  - `sow_entry_input.json` (lesson requirements)
  - `research_pack.json` (exemplars and patterns)
  - `sow_context.json` (course-level context)
  - `Course_data.txt` (official SQA data)
</inputs>
```

**Updated**:
```python
<inputs>
- **Available files**:
  - `sow_entry_input.json` (REQUIRED - lesson requirements)
  - `research_pack.json` (OPTIONAL - exemplars and patterns)
  - `sow_context.json` (OPTIONAL - course-level context)
  - `Course_data.txt` (OPTIONAL - official SQA data)

- **Validation Strategy**:
  - If optional files are present: Use for validation and grounding
  - If optional files are missing: Validate against training knowledge of SQA standards and pedagogy
  - Do NOT penalize lessons for missing optional file references
</inputs>
```

#### 4.4 Update COMBINED_LESSON_CRITIC_PROMPT Process

**Location**: Lines 1330-1331

**Current**:
```python
1) Read all input files (`sow_entry_input.json`, `research_pack.json`, `sow_context.json`, `Course_data.txt`)
2) Read the lesson template from state
```

**Updated**:
```python
1) Read required file (`sow_entry_input.json`)
2) Attempt to read optional files (`research_pack.json`, `sow_context.json`, `Course_data.txt`)
   - If present: Use for grounding and validation
   - If missing: Use training knowledge for validation
3) Read the lesson template from state
```

## Usage Examples

### Full Mode (Default)
```bash
npm run seed -- --entry "Lesson Name" --course "course-id"
```
- Injects all 4 files (~87k-165k chars)
- Agent uses files for grounding and validation
- Maximum accuracy for curriculum alignment

### Minimal Mode
```bash
npm run seed -- --entry "Lesson Name" --course "course-id" --minimal
```
- Injects only sow_entry_input.json (~2k-5k chars)
- Agent uses training knowledge for pedagogy and standards
- 95% token cost reduction

## Testing Strategy

### 1. Baseline Comparison
Generate 5 lessons in both modes:
- Full mode with all files
- Minimal mode with only sow_entry_input.json

### 2. Quality Metrics
- **Pedagogical Soundness**: Compare learning objectives, scaffolding, formative assessment
- **Curriculum Alignment**: Verify outcomes and assessment standards match SQA requirements
- **Content Accuracy**: Check mathematical accuracy and terminology
- **Structural Completeness**: Ensure all required lesson components are present

### 3. Expected Results
- **Minimal mode should produce**: 90-95% quality of full mode
- **When minimal mode may struggle**:
  - Domain-specific terminology requiring Course_data.txt
  - Complex curriculum interdependencies requiring sow_context.json
  - Niche pedagogical patterns requiring research_pack.json
- **When minimal mode excels**:
  - Standard lesson types (teach, independent_practice, revision)
  - Common pedagogical patterns (worked examples, practice problems)
  - Well-established curriculum topics

## Error Handling

### Required File Missing (sow_entry_input.json)
```
❌ ERROR: sow_entry_input.json not found
→ Cannot author lesson without requirements
→ This is a critical error - FAIL IMMEDIATELY
```

### Optional File Missing (research_pack.json, sow_context.json, Course_data.txt)
```
✅ Proceeding with training knowledge (minimal mode)
→ Optional file not found: [filename]
→ Using LLM training knowledge for [subject area]
→ This is expected behavior - CONTINUE NORMALLY
```

## Implementation Notes

### File Persistence
- Files persist across retry attempts in the same thread
- Once injected in attempt 1, files remain available in attempts 2-3
- Minimal mode flag should persist across retries

### Prompt Engineering
- Prompts explicitly distinguish REQUIRED vs OPTIONAL files
- Agent is instructed to proceed silently when optional files are missing
- No fallback mechanisms - either file exists (use it) or doesn't exist (use knowledge)

### Cost Optimization
- For bulk lesson generation (100+ lessons), minimal mode reduces costs by ~95%
- For curriculum alignment validation, use full mode
- For rapid prototyping and iteration, use minimal mode

## Future Enhancements

### Hybrid Mode
Add `--hybrid` flag that includes only Course_data.txt:
```bash
npm run seed -- --entry "Lesson Name" --course "course-id" --hybrid
```
- Injects sow_entry_input.json + Course_data.txt (~76k-135k chars)
- Agent uses research_pack and sow_context from training knowledge
- ~70% token cost reduction with strong curriculum alignment

### Smart Mode Selection
Auto-detect when minimal mode is appropriate:
- Lesson type (teach vs assessment vs revision)
- Topic complexity (basic vs advanced)
- Previous lesson quality scores
- Available budget/cost constraints

## Success Criteria

1. **Functionality**:
   - `--minimal` flag correctly skips optional file fetching
   - Agent successfully authors lessons with only sow_entry_input.json
   - No errors or warnings for missing optional files

2. **Quality**:
   - Minimal mode lessons score 90%+ of full mode quality
   - Pedagogical soundness maintained
   - Curriculum alignment verified against SQA standards

3. **Cost**:
   - Input token reduction of 90-95% measured
   - Total lesson authoring cost reduced by 60-80% (accounting for output tokens)

4. **User Experience**:
   - Clear console output showing mode selection
   - Appropriate messaging about token savings
   - No confusing errors or warnings

## Timeline

1. **Phase 1**: Implement CLI flag and conditional fetching (1 hour)
2. **Phase 2**: Update prompts for optional file handling (1 hour)
3. **Phase 3**: Testing and validation (2 hours)
4. **Phase 4**: Documentation and examples (30 minutes)

**Total Estimated Time**: 4.5 hours
