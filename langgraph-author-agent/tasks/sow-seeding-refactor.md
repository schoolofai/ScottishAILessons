# SOW Seeding Script Refactor Specification

**Document Purpose:** Complete refactoring specification for `seedAuthoredSOW.ts` to follow the `seedAuthoredLesson.ts` pattern, replacing filesystem-based input with Appwrite data fetching and LangGraph agent invocation.

**Status:** ✅ Approved for Implementation
**Created:** 2025-10-12
**Estimated Effort:** 6-8 hours
**Risk Level:** Low (follows proven pattern)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Detailed Requirements](#detailed-requirements)
5. [Implementation Plan](#implementation-plan)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Code Examples](#code-examples)
8. [Testing Strategy](#testing-strategy)
9. [Migration & Rollout](#migration--rollout)
10. [Success Criteria](#success-criteria)

---

## Executive Summary

### Problem Statement

The current `seedAuthoredSOW.ts` script (893 lines) reads Scheme of Work (SOW) data from filesystem JSON files, manually validates prerequisites, creates lesson templates, and manages complex batch processing logic. This approach is:

1. **Inconsistent** with the `seedAuthoredLesson.ts` pattern (agent-driven)
2. **Coupled** to filesystem structure
3. **Complex** with validation logic that duplicates agent responsibilities
4. **Difficult** to maintain due to template management mixed with SOW seeding

### Proposed Solution

Refactor `seedAuthoredSOW.ts` to:

1. **Accept 2 CLI parameters:** `courseId` (Appwrite document ID) and `resourcePackPath` (research pack file)
2. **Fetch course data** from Appwrite `courses` collection
3. **Extract SQA data** from `sqa_education.sqa_current` collection (pattern from `seedAuthoredLesson.ts`)
4. **Call LangGraph `sow_author` agent** with `Course_data.txt` and `research_pack_json` files
5. **Extract agent output** from `authored_sow_json` file in agent state
6. **Enrich metadata** with database-specific fields
7. **Upsert to Authored_SOW collection** using `ServerAuthoredSOWDriver`

### Benefits

- ✅ **Consistency:** Follows exact pattern as `seedAuthoredLesson.ts`
- ✅ **Simplicity:** Reduced from 893 → ~400 lines (55% reduction)
- ✅ **Separation of Concerns:** Lesson template creation handled separately
- ✅ **Single Responsibility:** Script only orchestrates agent → database flow
- ✅ **Agent-Driven Validation:** Critics handle quality control
- ✅ **No Filesystem Coupling:** All data from Appwrite or agent

---

## Current State Analysis

### Existing Script Overview

**File:** `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`
**Size:** 893 lines
**Primary Functions:**

1. **CLI Modes:**
   - `--sow path/to/sow.json` (single file)
   - `--name coursename` (named lookup in input/sows)
   - `--batch` (process all files in input/sows)

2. **Validation Pipeline:**
   - `validatePrerequisites()` - Check course and outcomes exist
   - `validateOutcomeReferences()` - Validate outcome IDs
   - `validateTemplateReferences()` - Check templates exist

3. **Template Management:**
   - `createOrUpdateLessonTemplates()` - Create/update lesson templates
   - `updateEntriesWithTemplateRefs()` - Replace AUTO_TBD_ placeholders
   - `mapOutcomeIdsToDocumentIds()` - Map outcome IDs to document IDs

4. **Database Operations:**
   - Upsert to `Authored_SOW` collection
   - Create/update entries in `lesson_templates` collection

### Problems with Current Approach

#### 1. Mixed Responsibilities

```typescript
// Current: Script does BOTH SOW seeding AND template creation
await validatePrerequisites(databases, courseId);           // ← Duplicate of agent work
await validateOutcomeReferences(databases, entries, courseId); // ← Agent has critics for this
const referenceMap = await createOrUpdateLessonTemplates(...); // ← Separate concern!
const updatedEntries = await updateEntriesWithTemplateRefs(...); // ← Agent outputs AUTO_TBD_
```

**Problem:** Lesson template creation should be handled by `seedAuthoredLesson.ts` after SOW exists.

#### 2. Filesystem Coupling

```typescript
// Current: Reads from filesystem
const fileContent = fs.readFileSync(sowFilePath, 'utf-8');
const sowData: SOWJSONFile = JSON.parse(fileContent);
```

**Problem:** Cannot leverage agent for SOW authoring. SOW must be pre-generated and stored in filesystem.

#### 3. Duplicate Validation

```typescript
// Current: Manual validation duplicates agent critic logic
async function validateOutcomeReferences(
  databases: Databases,
  entries: AuthoredSOWEntry[],
  courseId: string
): Promise<void> {
  // 50+ lines of validation that agent's Coverage Critic already does
}
```

**Problem:** Agent has 5 critic subagents that handle this validation. Script shouldn't duplicate.

#### 4. Complex Batch Logic

```typescript
// Current: Complex batch processing with reports
async function processBatch(inputDir: string, validateOnly: boolean, courseId?: string): Promise<BatchResult[]> {
  const sowFiles = discoverSOWFiles(inputDir);
  // 40+ lines of batch processing logic
}
```

**Problem:** Adds complexity. Users can run script multiple times for batch operations.

---

## Target Architecture

### New CLI Interface

```bash
# Single command: courseId + research pack path
tsx scripts/seedAuthoredSOW.ts <courseId> <resourcePackPath>

# Example: Application of Mathematics National 3
tsx scripts/seedAuthoredSOW.ts \
  "course_c84774" \
  "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INPUT PARAMETERS                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. courseId (CLI arg)                                           │
│    Example: "course_c84774"                                     │
│                                                                  │
│ 2. resourcePackPath (CLI arg)                                   │
│    Example: "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt" │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 1: FETCH COURSE DATA                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Query Appwrite courses collection by courseId               │
│    → Extract: subject, level                                    │
│                                                                  │
│ 2. Normalize subject/level (normalizeSQAQueryValues)           │
│    → "application-of-mathematics" → "applications_of_mathematics"│
│                                                                  │
│ 3. Query sqa_education.sqa_current collection                   │
│    → Extract: Course structure, outcomes, assessment standards  │
│                                                                  │
│ 4. Format as Course_data.txt string                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 2: LOAD RESEARCH PACK                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Read file from resourcePackPath                             │
│ 2. Parse JSON                                                   │
│ 3. Validate schema version (research_pack_version: 3)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 3: INVOKE LANGGRAPH AGENT                    │
├─────────────────────────────────────────────────────────────────┤
│ Agent: sow_author                                               │
│ URL: http://localhost:2027 (from env var)                      │
│                                                                  │
│ ⚠️  CRITICAL REQUIREMENT: Both files MUST be injected on first attempt │
│                                                                  │
│ Input Files (inject together on first run):                     │
│   - Course_data.txt: SQA course structure (string)             │
│   - research_pack_json: Research pack (JSON string)            │
│                                                                  │
│ Agent Workflow (internal - FAIL-FAST validation):              │
│   1. Validate Course_data.txt exists (pre-populated required)   │
│   2. Write research_pack_json to state.files                    │
│   3. Call sow_author_subagent → drafts SOW                     │
│   4. Call 5 critic subagents → validate quality                │
│      (Coverage, Sequencing, Policy, Accessibility, Authenticity)│
│   5. Write authored_sow_json to state.files                     │
│                                                                  │
│ Retry Logic:                                                    │
│   - Max 10 attempts with exponential backoff                    │
│   - Reuse same thread for "continue" messages                   │
│   - Check critic results for failures                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               PHASE 4: EXTRACT AGENT OUTPUT                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Get final thread state                                      │
│ 2. Extract state.values.files['authored_sow_json']             │
│ 3. Parse JSON                                                   │
│                                                                  │
│ Agent Output Schema:                                            │
│ {                                                               │
│   "$id": "csow_mathematics_national_4",                         │
│   "courseId": "course_c84473",                                  │
│   "version": 1,                                                 │
│   "status": "draft",                                            │
│   "metadata": {                                                 │
│     "coherence": {...},                                         │
│     "accessibility_notes": [...],                               │
│     "engagement_notes": [...],                                  │
│     "weeks": 32,                                                │
│     "periods_per_week": 6                                       │
│   },                                                            │
│   "entries": [ /* 40+ lesson entries */ ],                     │
│   "createdAt": "ISO-datetime",                                  │
│   "updatedAt": "ISO-datetime"                                   │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               PHASE 5: ENRICH METADATA                          │
├─────────────────────────────────────────────────────────────────┤
│ Calculate derived fields:                                       │
│   - course_name: From courses collection                       │
│   - level: From courses collection                             │
│   - total_lessons: entries.length                              │
│   - total_estimated_minutes: sum(entries[].estMinutes)         │
│   - generated_at: new Date().toISOString()                     │
│   - author_agent_version: "2.0" (refactored version)           │
│                                                                  │
│ Merge:                                                          │
│   - Agent metadata.coherence                                    │
│   - Agent metadata.engagement_notes                             │
│   - Agent metadata.weeks, periods_per_week                      │
│   - Database-specific fields                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            PHASE 6: PREPARE DATABASE DOCUMENT                   │
├─────────────────────────────────────────────────────────────────┤
│ AuthoredSOWData:                                                │
│ {                                                               │
│   courseId: string (from agent output)                         │
│   version: string (convert agent's number to string)           │
│   status: 'draft' | 'published' | 'archived'                   │
│   entries: JSON.stringify(agentOutput.entries)                 │
│   metadata: JSON.stringify(enrichedMetadata)                   │
│   accessibility_notes: array → newline-separated string        │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 7: UPSERT TO DATABASE                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Initialize ServerAuthoredSOWDriver                           │
│ 2. Call upsertAuthoredSOW(sowData)                             │
│    → Checks if document exists (courseId + version)            │
│    → Updates if exists, creates if new                         │
│ 3. Return document with $id, $createdAt, $updatedAt            │
│                                                                  │
│ Success Output:                                                 │
│   ✅ SOW successfully authored and saved                        │
│   Document ID: 67890abc12345                                   │
│   Course ID: course_c84774                                      │
│   Version: 1                                                    │
│   Entries: 45 lessons                                           │
│   Total Minutes: 2250                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Requirements

### Functional Requirements

#### FR1: Command-Line Interface

**Requirement:** Script accepts exactly 2 positional arguments.

```bash
tsx scripts/seedAuthoredSOW.ts <courseId> <resourcePackPath>
```

**Arguments:**

| Argument | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `courseId` | string | ✅ Yes | Document ID from `courses` collection | `"course_c84774"` |
| `resourcePackPath` | string | ✅ Yes | Path to research pack JSON file | `"../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"` |

**Validation:**
- Both arguments must be provided
- `courseId` must match pattern `^course_[a-z0-9_]+$`
- `resourcePackPath` must be valid file path
- Resource pack file must exist and be readable

**Error Messages:**
```typescript
if (!courseId || !resourcePackPath) {
  console.error('Usage: tsx seedAuthoredSOW.ts <courseId> <resourcePackPath>');
  console.error('');
  console.error('Arguments:');
  console.error('  courseId         - Course identifier (e.g., "course_c84774")');
  console.error('  resourcePackPath - Path to research pack JSON file');
  console.error('');
  console.error('Example:');
  console.error('  tsx scripts/seedAuthoredSOW.ts "course_c84774" "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"');
  process.exit(1);
}
```

---

#### FR2: Course Data Extraction

**Requirement:** Fetch course metadata and SQA course data from Appwrite collections.

**Implementation Pattern (from seedAuthoredLesson.ts:466-545):**

```typescript
/**
 * Fetch course metadata from courses collection
 */
async function getCourseMetadata(
  databases: Databases,
  courseId: string
): Promise<{ subject: string; level: string; title: string; courseId: string }> {
  const response = await databases.listDocuments(
    'default',
    'courses',
    [Query.equal('courseId', courseId)]
  );

  if (response.documents.length === 0) {
    throw new Error(`No course found with courseId: ${courseId}`);
  }

  const course = response.documents[0];

  if (!course.subject || !course.level) {
    throw new Error(`Course ${courseId} missing subject or level fields`);
  }

  return {
    courseId: course.courseId,
    subject: course.subject,
    level: course.level,
    title: course.title || `${course.subject} ${course.level}`
  };
}

/**
 * Normalize subject and level from courses collection format to sqa_current collection format
 * - Converts hyphens to underscores
 * - Handles special case: "application-of-mathematics" → "applications_of_mathematics"
 */
function normalizeSQAQueryValues(subject: string, level: string): { subject: string; level: string } {
  let normalizedSubject = subject.replace(/-/g, '_');
  let normalizedLevel = level.replace(/-/g, '_');

  // Special case: plural form for applications of mathematics
  if (normalizedSubject === 'application_of_mathematics') {
    normalizedSubject = 'applications_of_mathematics';
  }

  return {
    subject: normalizedSubject,
    level: normalizedLevel
  };
}

/**
 * Fetch SQA course data from sqa_current collection in sqa_education database
 */
async function fetchSQACourseData(
  databases: Databases,
  subject: string,
  level: string
): Promise<string> {
  const normalized = normalizeSQAQueryValues(subject, level);

  console.log(`   Normalized: "${subject}" → "${normalized.subject}", "${level}" → "${normalized.level}"`);

  const response = await databases.listDocuments(
    'sqa_education',
    'sqa_current',
    [
      Query.equal('subject', normalized.subject),
      Query.equal('level', normalized.level)
    ]
  );

  if (response.documents.length === 0) {
    throw new Error(
      `No SQA data found for subject="${normalized.subject}" level="${normalized.level}" ` +
      `(original: subject="${subject}" level="${level}")`
    );
  }

  const sqaDoc = response.documents[0];
  const data = sqaDoc.data;

  // Return as string (data field contains JSON string or object)
  return typeof data === 'string' ? data : JSON.stringify(data);
}
```

**Acceptance Criteria:**
- ✅ Fetches course document by `courseId` field (not `$id`)
- ✅ Extracts `subject` and `level` fields
- ✅ Normalizes using `normalizeSQAQueryValues` (handles hyphen → underscore, plural form)
- ✅ Queries `sqa_education.sqa_current` with normalized values
- ✅ Returns SQA data as string (Course_data.txt format)
- ✅ Throws descriptive error if course or SQA data not found

---

#### FR3: Resource Pack Loading

**Requirement:** Load and validate research pack JSON file.

**Implementation:**

```typescript
/**
 * Load resource pack from file path
 */
async function loadResourcePack(filePath: string): Promise<any> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const pack = JSON.parse(content);

    // Validate schema version
    if (!pack.research_pack_version || pack.research_pack_version !== 3) {
      throw new Error(
        `Invalid research pack version. Expected 3, got ${pack.research_pack_version}`
      );
    }

    // Validate required fields
    const requiredFields = ['subject', 'level', 'exemplars_from_sources', 'distilled_data'];
    for (const field of requiredFields) {
      if (!pack[field]) {
        throw new Error(`Research pack missing required field: ${field}`);
      }
    }

    return pack;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Research pack file not found: ${filePath}`);
    }
    throw new Error(`Failed to load resource pack from ${filePath}: ${error.message}`);
  }
}
```

**Acceptance Criteria:**
- ✅ Reads file from provided path
- ✅ Parses JSON content
- ✅ Validates `research_pack_version === 3`
- ✅ Validates required fields exist
- ✅ Returns parsed object
- ✅ Throws descriptive error for missing file or invalid JSON

---

#### FR4: LangGraph Agent Invocation

**Requirement:** Call `sow_author` agent with file inputs and handle retries.

**Implementation Pattern (from seedAuthoredLesson.ts:622-787):**

```typescript
/**
 * Run SOW author agent with error recovery and retry logic
 *
 * Strategy:
 * - Maintain same threadId across retries for state continuity
 * - Pre-inject all input files into thread state before first run
 * - Send simple trigger message on first run, "continue" on retries
 * - Log all attempts and errors for debugging
 * - Maximum 10 retry attempts before failing
 * - Exponential backoff between retries
 */
async function runSOWAuthorAgent(
  courseDataTxt: string,
  resourcePack: any,
  langgraphUrl: string,
  logFilePath: string
): Promise<any> {
  const client = new LangGraphClient({ apiUrl: langgraphUrl });
  const MAX_RETRIES = 10;

  // Create thread once - reuse across retries
  const thread = await client.threads.create();
  const threadId = thread.thread_id;

  logToFile(logFilePath, `Thread created: ${threadId}`);
  console.log(`   Thread ID: ${threadId}`);

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    logToFile(logFilePath, `\n=== Attempt ${attempt}/${MAX_RETRIES} ===`);
    console.log(`\n🔄 Attempt ${attempt}/${MAX_RETRIES}...`);

    try {
      // First attempt: inject files + trigger message
      // Subsequent attempts: send "continue" to resume
      let input: any;

      if (attempt === 1) {
        // Build files object for first attempt
        const files: Record<string, string> = {
          'Course_data.txt': courseDataTxt,
          'research_pack_json': JSON.stringify(resourcePack, null, 2)
        };

        input = {
          messages: [{
            role: 'user',
            content: 'Author SOW from provided input files'
          }],
          files
        };

        // Log file injection
        logToFile(logFilePath, `Injecting input files:`);
        logToFile(logFilePath, `  - Course_data.txt: ${courseDataTxt.length} chars`);
        logToFile(logFilePath, `  - research_pack_json: ${JSON.stringify(resourcePack).length} chars`);

        console.log(`   ✅ Injecting ${Object.keys(files).length} input files:`);
        console.log(`      - Course_data.txt (${courseDataTxt.length} chars)`);
        console.log(`      - research_pack_json (${JSON.stringify(resourcePack).length} chars)`);
      } else {
        input = { messages: [{ role: 'user', content: 'continue' }] };
      }

      // Stream agent execution
      const stream = client.runs.stream(
        threadId,
        'sow_author',
        { input, stream_mode: 'values' }
      );

      let messageCount = 0;
      for await (const chunk of stream) {
        if (chunk.event === 'messages/partial') {
          messageCount++;
          if (messageCount % 10 === 0) {
            process.stdout.write('.');
          }
        }
      }
      console.log('');

      // Get final state
      const state = await client.threads.getState(threadId);
      const files = state.values.files || {};

      // Check for successful completion
      if (files['authored_sow_json']) {
        logToFile(logFilePath, `✅ Success on attempt ${attempt}`);
        console.log(`✅ SOW generated successfully on attempt ${attempt}`);
        return JSON.parse(files['authored_sow_json']);
      }

      // Check for critic failures
      const criticFiles = [
        'sow_coverage_critic_result_json',
        'sow_sequencing_critic_result_json',
        'sow_policy_critic_result_json',
        'sow_accessibility_critic_result_json',
        'sow_authenticity_critic_result_json'
      ];

      for (const criticFile of criticFiles) {
        if (files[criticFile]) {
          const criticResult = JSON.parse(files[criticFile]);
          if (criticResult.pass === false) {
            const errorMsg = `⚠️  Critic ${criticFile} failed (score: ${criticResult.score})`;
            logToFile(logFilePath, errorMsg);
            logToFile(logFilePath, JSON.stringify(criticResult, null, 2));

            console.log(`   ${errorMsg}`);
            if (criticResult.issues) {
              criticResult.issues.slice(0, 3).forEach((issue: string) => {
                console.log(`      - ${issue}`);
              });
            }

            // Continue to retry with "continue" message
            lastError = new Error(`Critic failed: ${criticFile}`);
            continue;
          }
        }
      }

      // No template and no critic failures - unknown state
      throw new Error('Agent completed but produced no authored_sow_json');

    } catch (error: any) {
      lastError = error;
      const errorMsg = `❌ Attempt ${attempt} failed: ${error.message}`;
      logToFile(logFilePath, errorMsg);
      logToFile(logFilePath, error.stack || '');
      console.log(`   ${errorMsg}`);

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`   Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries exhausted
  const finalError = `Failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`;
  logToFile(logFilePath, `\n❌ FINAL FAILURE: ${finalError}`);
  throw new Error(finalError);
}

/**
 * Append log entry to file with timestamp
 */
function logToFile(filePath: string, message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(filePath, logEntry, 'utf-8');
}
```

**Acceptance Criteria:**
- ✅ Creates LangGraph thread (reused across retries)
- ✅ First attempt: injects files (`Course_data.txt`, `research_pack_json`)
- ✅ Subsequent attempts: sends "continue" message
- ✅ Streams agent execution with progress indicators
- ✅ Extracts `authored_sow_json` from final state
- ✅ Checks critic results for failures
- ✅ Retries up to 10 times with exponential backoff
- ✅ Logs all attempts to file with timestamps
- ✅ Throws descriptive error after exhausting retries

---

#### FR5: Metadata Enrichment

**Requirement:** Merge agent output with database-specific metadata fields.

**Implementation:**

```typescript
/**
 * Enrich SOW metadata from agent output with database fields
 */
function enrichSOWMetadata(
  agentOutput: any,
  courseInfo: { title: string; subject: string; level: string; courseId: string }
): any {
  // Calculate derived fields
  const totalLessons = agentOutput.entries.length;
  const totalEstimatedMinutes = agentOutput.entries.reduce(
    (sum: number, entry: any) => sum + (entry.estMinutes || 0),
    0
  );

  // Merge agent metadata with database metadata
  return {
    // Agent-generated metadata (preserve structure)
    coherence: agentOutput.metadata.coherence || {
      policy_notes: [],
      sequencing_notes: []
    },
    engagement_notes: agentOutput.metadata.engagement_notes || [],
    weeks: agentOutput.metadata.weeks || 0,
    periods_per_week: agentOutput.metadata.periods_per_week || 0,

    // Database-specific metadata (new fields)
    course_name: courseInfo.title,
    level: courseInfo.level,
    total_lessons: totalLessons,
    total_estimated_minutes: totalEstimatedMinutes,
    generated_at: new Date().toISOString(),
    author_agent_version: '2.0'  // Refactored version marker
  };
}

/**
 * Format accessibility notes from array to newline-separated string
 */
function formatAccessibilityNotes(notes: string[] | string | undefined): string {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) return notes.join('\n');
  return '';
}
```

**Acceptance Criteria:**
- ✅ Preserves agent metadata structure (coherence, engagement_notes, weeks, periods_per_week)
- ✅ Adds database-specific fields (course_name, level, total_lessons, total_estimated_minutes, generated_at, author_agent_version)
- ✅ Calculates total_lessons from entries.length
- ✅ Calculates total_estimated_minutes by summing entry.estMinutes
- ✅ Formats accessibility_notes (array → newline-separated string)
- ✅ Sets author_agent_version to "2.0" (distinguishes refactored runs)

---

#### FR6: Database Upsert

**Requirement:** Upsert SOW to Authored_SOW collection using ServerAuthoredSOWDriver.

**Implementation:**

```typescript
/**
 * Upsert SOW to Authored_SOW collection
 */
async function upsertSOWToDatabase(
  databases: Databases,
  agentOutput: any,
  enrichedMetadata: any,
  appwriteClient: Client
): Promise<any> {
  // Prepare database document
  const sowData: AuthoredSOWData = {
    courseId: agentOutput.courseId,
    version: String(agentOutput.version),  // Convert number to string
    status: agentOutput.status || 'draft',
    entries: agentOutput.entries,  // Driver will stringify
    metadata: enrichedMetadata,    // Driver will stringify
    accessibility_notes: formatAccessibilityNotes(agentOutput.metadata.accessibility_notes)
  };

  console.log('\n💾 Upserting to Authored_SOW collection...');

  // Initialize driver
  const sowDriver = new ServerAuthoredSOWDriver({
    client: appwriteClient,
    account: null as any,
    databases
  });

  // Upsert (creates if new, updates if exists)
  const result = await sowDriver.upsertAuthoredSOW(sowData);

  console.log('\n✅ Successfully seeded Authored_SOW!');
  console.log(`   Document ID: ${result.$id}`);
  console.log(`   Course ID: ${result.courseId}`);
  console.log(`   Version: ${result.version}`);
  console.log(`   Status: ${result.status}`);
  console.log(`   Created At: ${result.$createdAt}`);
  console.log(`   Updated At: ${result.$updatedAt}`);

  // Parse and display entry count
  const entries = JSON.parse(result.entries);
  console.log(`   Entries stored: ${entries.length} lessons`);
  console.log(`   Total estimated minutes: ${enrichedMetadata.total_estimated_minutes}`);

  return result;
}
```

**Acceptance Criteria:**
- ✅ Converts agent's `version` (number) to string
- ✅ Uses ServerAuthoredSOWDriver.upsertAuthoredSOW()
- ✅ Creates new document if (courseId, version) doesn't exist
- ✅ Updates existing document if (courseId, version) exists
- ✅ Returns document with $id, $createdAt, $updatedAt
- ✅ Logs success with document details

---

### Non-Functional Requirements

#### NFR1: Code Simplicity

**Requirement:** Reduced script size and complexity.

**Metrics:**
- Old script: 893 lines
- Target: ~400 lines (55% reduction)
- Cyclomatic complexity: <10 per function

**Implementation:**
- Remove batch processing logic
- Remove template creation logic
- Remove manual validation logic
- Follow seedAuthoredLesson.ts pattern exactly

---

#### NFR2: Error Handling

**Requirement:** Comprehensive error handling with descriptive messages.

**Implementation:**

```typescript
// Environment validation
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!APPWRITE_ENDPOINT) console.error('  - NEXT_PUBLIC_APPWRITE_ENDPOINT');
  if (!APPWRITE_PROJECT_ID) console.error('  - NEXT_PUBLIC_APPWRITE_PROJECT_ID');
  if (!APPWRITE_API_KEY) console.error('  - APPWRITE_API_KEY');
  process.exit(1);
}

// Course not found
if (response.documents.length === 0) {
  throw new Error(`No course found with courseId: ${courseId}. Please check the courseId is correct.`);
}

// Agent failure with retry exhausted
if (attempt === MAX_RETRIES) {
  throw new Error(
    `Failed to generate SOW after ${MAX_RETRIES} attempts.\n` +
    `Last error: ${lastError?.message}\n` +
    `Check log file for details: ${logFilePath}`
  );
}
```

**Acceptance Criteria:**
- ✅ All errors include context (which operation failed)
- ✅ Environment errors list missing variables
- ✅ Course/SQA data errors suggest resolution
- ✅ Agent errors include retry count and log file path

---

#### NFR3: Logging

**Requirement:** Comprehensive logging for debugging.

**Implementation:**

```typescript
// Create log directory and file
const logDir = path.join(__dirname, '../logs/sow-authoring');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(
  logDir,
  `sow_${courseId}_${Date.now()}.log`
);

console.log(`   Log file: ${logFile}`);

// Log throughout execution
logToFile(logFile, '🌱 Starting SOW seeding script');
logToFile(logFile, `Course ID: ${courseId}`);
logToFile(logFile, `Resource Pack: ${resourcePackPath}`);
logToFile(logFile, `LangGraph URL: ${LANGGRAPH_URL}`);
```

**Acceptance Criteria:**
- ✅ Creates log file per run: `sow_<courseId>_<timestamp>.log`
- ✅ Logs all input parameters
- ✅ Logs each retry attempt
- ✅ Logs agent output files checked
- ✅ Logs final success/failure

---

#### NFR4: Consistency with seedAuthoredLesson.ts

**Requirement:** Follow exact pattern from seedAuthoredLesson.ts for consistency.

**Shared Patterns:**
1. ✅ CLI argument parsing (positional args, no flags)
2. ✅ Course metadata fetching (`getCourseMetadata()`)
3. ✅ SQA data normalization (`normalizeSQAQueryValues()`)
4. ✅ LangGraph streaming with retry (`runXXXAuthorAgent()`)
5. ✅ File-based input injection
6. ✅ Exponential backoff error handling
7. ✅ Comprehensive logging (`logToFile()`)

**Differences (required by domain):**
- Agent name: `lesson_author` → `sow_author`
- Output file: `lesson_template.json` → `authored_sow_json`
- Database collection: `lesson_templates` → `Authored_SOW`
- No compression (SOW entries not compressed)

---

## Implementation Plan

### Phase 1: Script Skeleton (2 hours)

**Tasks:**
1. Create new `seedAuthoredSOW.ts` (backup old version as `seedAuthoredSOW.old.ts`)
2. Copy imports from `seedAuthoredLesson.ts`:
   ```typescript
   import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
   import { Client as LangGraphClient } from '@langchain/langgraph-sdk';
   import { readFile } from 'fs/promises';
   import * as fs from 'fs';
   import * as path from 'path';
   import * as dotenv from 'dotenv';
   import { ServerAuthoredSOWDriver, AuthoredSOWData } from '../__tests__/support/ServerAuthoredSOWDriver';
   ```
3. Set up configuration constants:
   ```typescript
   dotenv.config({ path: '.env.local' });
   const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
   const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
   const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
   const LANGGRAPH_URL = process.env.LANGGRAPH_SOW_AUTHOR_URL || 'http://localhost:2027';
   ```
4. Implement CLI argument parsing
5. Implement environment validation

**Deliverables:**
- Script compiles without errors
- CLI help message displays correctly
- Environment validation works

---

### Phase 2: Data Fetching (2 hours)

**Tasks:**
1. Implement `getCourseMetadata()` (copy from seedAuthoredLesson.ts)
2. Implement `normalizeSQAQueryValues()` (copy from seedAuthoredLesson.ts)
3. Implement `fetchSQACourseData()` (copy from seedAuthoredLesson.ts)
4. Implement `loadResourcePack()` with validation
5. Add unit tests for normalization edge cases

**Deliverables:**
- Course metadata fetching works
- SQA data extraction works
- Research pack loading works
- Edge cases handled (missing course, invalid JSON)

---

### Phase 3: Agent Invocation (2-3 hours)

**Tasks:**
1. Implement `runSOWAuthorAgent()`:
   - Create thread
   - Build file inputs
   - Stream execution
   - Extract output
   - Handle retries
2. Implement `logToFile()` utility
3. Test with actual research pack
4. Verify agent output format

**Deliverables:**
- Agent invocation works end-to-end
- Retry logic handles failures
- Log files created correctly
- Agent output extracted successfully

---

### Phase 4: Metadata & Database (1-2 hours)

**Tasks:**
1. Implement `enrichSOWMetadata()`:
   - Merge agent metadata
   - Calculate derived fields
   - Add database fields
2. Implement `formatAccessibilityNotes()`
3. Implement database upsert logic
4. Test with actual Appwrite database

**Deliverables:**
- Metadata enrichment works correctly
- Database upsert creates documents
- Version conflict handling works (update existing)
- Success message displays all details

---

### Phase 5: Testing & Validation (1 hour)

**Tasks:**
1. End-to-end test with real course:
   ```bash
   tsx scripts/seedAuthoredSOW.ts "course_c84774" "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
   ```
2. Verify in Appwrite console
3. Test error cases:
   - Missing course
   - Invalid research pack
   - Agent failure
4. Code review against seedAuthoredLesson.ts pattern

**Deliverables:**
- Script works end-to-end
- Error handling tested
- Code review passed
- Documentation updated

---

## Code Examples

### Main Function

```typescript
async function main() {
  // Parse command line arguments (filter out flags)
  const positionalArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const [courseId, resourcePackPath] = positionalArgs;

  if (!courseId || !resourcePackPath) {
    console.error('Usage: tsx seedAuthoredSOW.ts <courseId> <resourcePackPath>');
    console.error('');
    console.error('Arguments:');
    console.error('  courseId         - Course identifier (e.g., "course_c84774")');
    console.error('  resourcePackPath - Path to research pack JSON file');
    console.error('');
    console.error('Example:');
    console.error('  tsx scripts/seedAuthoredSOW.ts "course_c84774" "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"');
    process.exit(1);
  }

  console.log('🚀 Starting SOW Authoring Pipeline');
  console.log('=====================================');
  console.log(`Course ID: ${courseId}`);
  console.log(`Resource Pack: ${resourcePackPath}`);
  console.log('');

  // Validate environment variables
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing required environment variables:');
    if (!APPWRITE_ENDPOINT) console.error('  - NEXT_PUBLIC_APPWRITE_ENDPOINT');
    if (!APPWRITE_PROJECT_ID) console.error('  - NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    if (!APPWRITE_API_KEY) console.error('  - APPWRITE_API_KEY');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  console.log(`   Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`   Project: ${APPWRITE_PROJECT_ID}`);
  console.log('');

  // Initialize Appwrite client
  const appwriteClient = new AppwriteClient()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(appwriteClient);

  try {
    // Step 1: Get course metadata
    console.log('📚 Fetching course metadata...');
    const course = await getCourseMetadata(databases, courseId);
    console.log(`✅ Found course: ${course.title}`);
    console.log(`   Subject: ${course.subject}`);
    console.log(`   Level: ${course.level}`);
    console.log('');

    // Step 2: Fetch SQA course data
    console.log('📚 Fetching SQA course data from sqa_education database...');
    const courseDataTxt = await fetchSQACourseData(
      databases,
      course.subject,
      course.level
    );
    console.log(`✅ Fetched SQA data (${courseDataTxt.length} characters)`);
    console.log('');

    // Step 3: Load resource pack
    console.log('📂 Loading resource pack...');
    const resourcePack = await loadResourcePack(resourcePackPath);
    console.log(`✅ Loaded resource pack (version ${resourcePack.research_pack_version})`);
    console.log('');

    // Step 4: Create log file
    const logDir = path.join(__dirname, '../logs/sow-authoring');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(
      logDir,
      `sow_${courseId}_${Date.now()}.log`
    );
    console.log(`   Log file: ${logFile}`);
    console.log('');

    // Step 5: Run SOW author agent with retry logic
    console.log('🤖 Invoking sow_author agent with error recovery...');
    console.log(`   URL: ${LANGGRAPH_URL}`);
    console.log('');

    const sowOutput = await runSOWAuthorAgent(
      courseDataTxt,
      resourcePack,
      LANGGRAPH_URL,
      logFile
    );

    console.log('✅ SOW generated successfully');
    console.log(`   Entries: ${sowOutput.entries.length} lessons`);
    console.log('');

    // Step 6: Enrich metadata
    console.log('📊 Enriching metadata...');
    const enrichedMetadata = enrichSOWMetadata(sowOutput, course);
    console.log('✅ Metadata enriched');
    console.log(`   Total lessons: ${enrichedMetadata.total_lessons}`);
    console.log(`   Total estimated minutes: ${enrichedMetadata.total_estimated_minutes}`);
    console.log('');

    // Step 7: Upsert to database
    const result = await upsertSOWToDatabase(
      databases,
      sowOutput,
      enrichedMetadata,
      appwriteClient
    );

    console.log('=====================================');
    console.log('🎉 SUCCESS! SOW authored and saved');
    console.log('=====================================');

  } catch (error) {
    console.error('');
    console.error('=====================================');
    console.error('❌ ERROR: SOW authoring failed');
    console.error('=====================================');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
```

---

## Testing Strategy

### Unit Tests

**File:** `assistant-ui-frontend/__tests__/scripts/seedAuthoredSOW.test.ts`

```typescript
describe('seedAuthoredSOW', () => {
  describe('normalizeSQAQueryValues', () => {
    it('converts hyphens to underscores', () => {
      const result = normalizeSQAQueryValues('application-of-mathematics', 'national-4');
      expect(result.subject).toBe('applications_of_mathematics');
      expect(result.level).toBe('national_4');
    });

    it('handles special case for applications of mathematics', () => {
      const result = normalizeSQAQueryValues('application-of-mathematics', 'national-3');
      expect(result.subject).toBe('applications_of_mathematics');
    });
  });

  describe('enrichSOWMetadata', () => {
    it('merges agent metadata with database metadata', () => {
      const agentOutput = {
        entries: [
          { estMinutes: 45 },
          { estMinutes: 30 }
        ],
        metadata: {
          coherence: { policy_notes: ['test'] },
          engagement_notes: ['test'],
          weeks: 32,
          periods_per_week: 6
        }
      };

      const courseInfo = {
        title: 'Mathematics (National 4)',
        subject: 'mathematics',
        level: 'national-4',
        courseId: 'course_c84473'
      };

      const result = enrichSOWMetadata(agentOutput, courseInfo);

      expect(result.total_lessons).toBe(2);
      expect(result.total_estimated_minutes).toBe(75);
      expect(result.course_name).toBe('Mathematics (National 4)');
      expect(result.author_agent_version).toBe('2.0');
    });
  });

  describe('formatAccessibilityNotes', () => {
    it('converts array to newline-separated string', () => {
      const notes = ['Note 1', 'Note 2', 'Note 3'];
      const result = formatAccessibilityNotes(notes);
      expect(result).toBe('Note 1\nNote 2\nNote 3');
    });

    it('returns string unchanged', () => {
      const result = formatAccessibilityNotes('Single note');
      expect(result).toBe('Single note');
    });

    it('returns empty string for undefined', () => {
      const result = formatAccessibilityNotes(undefined);
      expect(result).toBe('');
    });
  });
});
```

### Integration Tests

**Test Plan:**

1. **Happy Path:**
   ```bash
   # Run with valid course and research pack
   tsx scripts/seedAuthoredSOW.ts "course_c84774" "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"

   # Verify:
   # - Script completes successfully
   # - Authored_SOW document created
   # - Entries count matches agent output
   # - Metadata enriched correctly
   ```

2. **Course Not Found:**
   ```bash
   tsx scripts/seedAuthoredSOW.ts "course_invalid" "path/to/pack.txt"

   # Expected: Error message with suggestion to check courseId
   ```

3. **Invalid Research Pack:**
   ```bash
   tsx scripts/seedAuthoredSOW.ts "course_c84774" "invalid.txt"

   # Expected: Error message about invalid JSON or missing required fields
   ```

4. **Agent Failure:**
   - Stop LangGraph server
   - Run script
   - Expected: Retry logic kicks in, eventually fails with descriptive error

5. **Version Conflict:**
   ```bash
   # Run twice with same courseId
   tsx scripts/seedAuthoredSOW.ts "course_c84774" "path/to/pack.txt"
   tsx scripts/seedAuthoredSOW.ts "course_c84774" "path/to/pack.txt"

   # Expected: Second run updates existing document (upsert)
   ```

---

## Migration & Rollout

### Backwards Compatibility

**Breaking Changes:**
- ❌ CLI interface completely changed (no `--sow`, `--name`, `--batch` flags)
- ❌ No filesystem-based input (requires Appwrite course data)
- ❌ No automatic lesson template creation

**Preserved:**
- ✅ Database schema unchanged (`Authored_SOW` collection)
- ✅ Existing documents work with new script
- ✅ ServerAuthoredSOWDriver API unchanged

### Migration Path

**For Existing Users:**

1. **Prepare Research Packs:**
   - Research packs must be generated using research agent
   - Store in known location (e.g., `langgraph-author-agent/data/`)

2. **Ensure Courses Exist:**
   - Run `bulkSeedAllCourses.ts` to populate courses + outcomes
   - Verify courses exist in Appwrite console

3. **Update Scripts:**
   ```bash
   # Old approach (batch mode)
   tsx scripts/seedAuthoredSOW.ts --batch

   # New approach (per-course)
   for course in course_c84774 course_c84473; do
     tsx scripts/seedAuthoredSOW.ts "$course" "path/to/${course}_research_pack.txt"
   done
   ```

4. **Update Documentation:**
   - Update README with new CLI usage
   - Add examples for common use cases
   - Document prerequisite steps (course seeding)

### Rollout Plan

**Phase 1: Development (Week 1)**
- Implement refactored script
- Unit tests + integration tests
- Code review

**Phase 2: Staging (Week 2)**
- Deploy to staging environment
- Test with real courses
- Validate agent integration

**Phase 3: Production (Week 3)**
- Deploy to production
- Update documentation
- Monitor for issues

**Rollback Plan:**
- Keep old script as `seedAuthoredSOW.old.ts`
- If issues arise, revert to old script
- Document issues for next refactor attempt

---

## Success Criteria

### Functional Success

✅ **FS1:** Script accepts `courseId` and `resourcePackPath` as CLI arguments
✅ **FS2:** Fetches course metadata from Appwrite `courses` collection
✅ **FS3:** Extracts SQA course data using `normalizeSQAQueryValues` pattern
✅ **FS4:** Loads and validates research pack JSON file
✅ **FS5:** Calls LangGraph `sow_author` agent with file inputs
✅ **FS6:** Extracts `authored_sow_json` from agent output
✅ **FS7:** Enriches metadata with database-specific fields
✅ **FS8:** Upserts to `Authored_SOW` collection using `ServerAuthoredSOWDriver`
✅ **FS9:** Logs execution details to file
✅ **FS10:** Displays success message with document details

### Non-Functional Success

✅ **NFS1:** Script reduced from 893 → ~400 lines (55% reduction)
✅ **NFS2:** Follows `seedAuthoredLesson.ts` pattern consistently
✅ **NFS3:** Comprehensive error handling with descriptive messages
✅ **NFS4:** Exponential backoff retry logic handles transient failures
✅ **NFS5:** All functions have single responsibility
✅ **NFS6:** No duplicate validation (agent critics handle validation)

### Quality Success

✅ **QS1:** Unit tests cover edge cases (normalization, metadata enrichment)
✅ **QS2:** Integration tests validate end-to-end flow
✅ **QS3:** Code review passed (consistency with seedAuthoredLesson.ts)
✅ **QS4:** Documentation updated (README, usage examples)
✅ **QS5:** No regressions (existing Authored_SOW documents unchanged)

---

## Appendix

### A. File Mapping

| Old File | New File | Change |
|----------|----------|--------|
| `scripts/seedAuthoredSOW.ts` (893 lines) | `scripts/seedAuthoredSOW.ts` (400 lines) | Completely rewritten |
| `scripts/seedAuthoredSOW.ts` | `scripts/seedAuthoredSOW.old.ts` | Backup of old version |

### B. Dependency Analysis

**Required:**
- `node-appwrite` (Client, Databases, Query)
- `@langchain/langgraph-sdk` (LangGraphClient)
- `ServerAuthoredSOWDriver` (existing)
- LangGraph `sow_author` agent (already deployed)

**No New Dependencies:** All libraries already used by `seedAuthoredLesson.ts`

### C. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | ✅ Yes | Appwrite API endpoint |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | ✅ Yes | Appwrite project ID |
| `APPWRITE_API_KEY` | ✅ Yes | Admin API key |
| `LANGGRAPH_SOW_AUTHOR_URL` | ⚠️ Optional | LangGraph URL (default: http://localhost:2027) |

### D. Agent Output Schema Reference

**File Written by Agent:** `state.values.files['authored_sow_json']`

**Schema:** (see `langgraph-author-agent/docs/sow-schema-data-flow.md` for full details)

```json
{
  "$id": "csow_mathematics_national_4",
  "courseId": "course_c84473",
  "version": 1,
  "status": "draft",
  "metadata": {
    "coherence": {
      "policy_notes": ["Non-calculator first; calculator later"],
      "sequencing_notes": ["Expressions → Relationships"]
    },
    "accessibility_notes": ["Use plain language", "Dyslexia-friendly font"],
    "engagement_notes": ["Use £ pricing", "Scottish landmarks"],
    "weeks": 32,
    "periods_per_week": 6
  },
  "entries": [
    {
      "order": 1,
      "lessonTemplateRef": "AUTO_TBD_1",
      "label": "Selecting Notation and Units",
      "lesson_type": "teach",
      "coherence": { "unit": "Numeracy (National 4)", "block_name": "Everyday Mathematics", "block_index": "1.1" },
      "policy": { "calculator_section": "non_calc" },
      "engagement_tags": ["measurement", "cooking"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.1"],
      "pedagogical_blocks": ["starter", "modelling", "guided_practice", "exit_ticket"],
      "accessibility_profile": { "dyslexia_friendly": true, "plain_language_level": "CEFR_B1", "extra_time": false },
      "estMinutes": 45,
      "notes": "Focus on everyday units: cm/m/km, g/kg, ml/l. Use real recipes."
    }
  ],
  "createdAt": "2025-10-12T14:30:00Z",
  "updatedAt": "2025-10-12T14:30:00Z"
}
```

---

**Document Status:** ✅ Ready for Implementation
**Approval:** Awaiting Engineering Sign-off
**Implementation Timeline:** 1 week (6-8 hours of work)

---

**References:**
- `assistant-ui-frontend/scripts/seedAuthoredLesson.ts` (pattern source)
- `langgraph-author-agent/src/sow_author_prompts.py` (agent prompts)
- `langgraph-author-agent/docs/sow-schema-data-flow.md` (SOW schema)
- `assistant-ui-frontend/__tests__/support/ServerAuthoredSOWDriver.ts` (database driver)
