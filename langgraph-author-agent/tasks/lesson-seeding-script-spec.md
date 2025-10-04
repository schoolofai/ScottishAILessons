# Lesson Seeding Script Specification

## Overview

Create a Node.js/TypeScript seeding script that integrates the lesson authoring agent into the seeding pipeline. The script will read from the Authored_SOW collection, invoke the lesson_author agent via LangGraph SDK with error recovery and retry logic, and upsert the generated lesson template to the lesson_templates collection.

## Requirements

### Inputs
1. **courseId**: Identifier for the authored SOW collection row
2. **order**: Entry order number for the lesson to generate
3. **resourcePackPath**: File path to the resource pack JSON (REQUIRED - fail fast if not provided)

### Process Flow
1. Read the authored_sow entry with the specified courseId and order number
2. Load the resource pack from the provided file path
3. Create dual JSON input (SoW entry + resource pack)
4. Invoke the lesson_author agent via LangGraph SDK with retry logic
5. Handle errors with automatic retry (max 10 attempts)
6. Extract lesson template from agent output
7. Upsert to lesson_templates collection using courseId + sow_order lookup
8. Log all attempts and errors to file

## Implementation Details

### File Location
`assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

### Dependencies
- `@langchain/langgraph-sdk`: Already installed (confirmed in package.json)
- `node-appwrite`: Already installed
- `fs/promises`: Built-in Node.js module
- `fs`: Built-in Node.js module (for sync file operations)
- `path`: Built-in Node.js module

### Script Structure

```typescript
#!/usr/bin/env tsx

/**
 * Seed Authored Lesson - Generate lesson template using LangGraph lesson_author agent
 *
 * Features:
 * - Error recovery with automatic retry (max 10 attempts)
 * - Thread persistence for human-in-the-loop intervention
 * - Comprehensive logging to files
 * - Exponential backoff between retries
 *
 * Usage:
 *   npm run seed:authored-lesson <courseId> <order> <resourcePackPath>
 *
 * Example:
 *   npm run seed:authored-lesson "course_123" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
 */

import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import { Client as LangGraphClient } from '@langchain/langgraph-sdk';
import { readFile } from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const LANGGRAPH_URL = process.env.LANGGRAPH_LESSON_AUTHOR_URL || 'http://localhost:2024';

const DATABASE_ID = 'default';
const AUTHORED_SOW_COLLECTION = 'Authored_SOW';
const LESSON_TEMPLATES_COLLECTION = 'lesson_templates';

interface AuthoredSOWEntry {
  order: number;
  label: string;
  lesson_type: string;
  estMinutes: number;
  outcomeRefs: string[];
  engagement_tags?: string[];
  policy?: { calculator_allowed?: boolean };
  lessonTemplateRef: string;
  cards?: any[];
}

interface AuthoredSOW {
  courseId: string;
  entries: AuthoredSOWEntry[];
  [key: string]: any;
}

async function main() {
  // Parse command line arguments
  const [courseId, orderStr, resourcePackPath] = process.argv.slice(2);

  if (!courseId || !orderStr || !resourcePackPath) {
    console.error('Usage: npm run seed:authored-lesson <courseId> <order> <resourcePackPath>');
    console.error('Example: npm run seed:authored-lesson "course_123" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"');
    process.exit(1);
  }

  const order = parseInt(orderStr, 10);
  if (isNaN(order)) {
    console.error('Error: order must be a valid number');
    process.exit(1);
  }

  console.log('🚀 Starting Lesson Authoring Pipeline');
  console.log('=====================================');
  console.log(`Course ID: ${courseId}`);
  console.log(`Order: ${order}`);
  console.log(`Resource Pack: ${resourcePackPath}`);
  console.log('');

  // Initialize Appwrite client
  const appwrite = new AppwriteClient()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(appwrite);

  try {
    // Step 1: Load resource pack
    console.log('📂 Loading resource pack...');
    const resourcePack = await loadResourcePack(resourcePackPath);
    console.log(`✅ Loaded resource pack (version ${resourcePack.research_pack_version})`);
    console.log('');

    // Step 2: Get Authored SOW entry
    console.log('📚 Fetching Authored SOW entry...');
    const sowEntry = await getAuthoredSOWEntry(databases, courseId, order);
    console.log(`✅ Found entry: "${sowEntry.label}"`);
    console.log(`   Type: ${sowEntry.lesson_type}`);
    console.log(`   Duration: ${sowEntry.estMinutes} minutes`);
    console.log('');

    // Step 3: Create dual JSON input
    console.log('🔧 Creating dual JSON input...');
    const dualInput = createDualInput(sowEntry, resourcePack);
    console.log(`✅ Created input (${dualInput.length} characters)`);
    console.log('');

    // Step 4: Run lesson author agent with retry logic
    console.log('🤖 Invoking lesson_author agent with error recovery...');
    console.log(`   URL: ${LANGGRAPH_URL}`);

    // Create log file path
    const logDir = path.join(__dirname, '../logs/lesson-authoring');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(
      logDir,
      `lesson_${courseId}_order${order}_${Date.now()}.log`
    );

    console.log(`   Log file: ${logFile}`);
    console.log('');

    const lessonTemplate = await runLessonAuthorAgent(dualInput, LANGGRAPH_URL, logFile);
    console.log('✅ Lesson template generated');
    console.log(`   Title: ${lessonTemplate.title || 'N/A'}`);
    console.log(`   Type: ${lessonTemplate.lesson_type || 'N/A'}`);
    console.log(`   Duration: ${lessonTemplate.estMinutes || 'N/A'} minutes`);
    console.log(`   Cards: ${lessonTemplate.cards?.length || 0}`);
    console.log('');

    // Step 5: Upsert to lesson_templates
    console.log('💾 Upserting to lesson_templates...');
    const result = await upsertLessonTemplate(databases, lessonTemplate, courseId, order);
    console.log(`✅ ${result.action} lesson template`);
    console.log(`   Document ID: ${result.documentId}`);
    console.log('');

    console.log('=====================================');
    console.log('🎉 SUCCESS! Lesson template created');
    console.log('=====================================');

  } catch (error) {
    console.error('');
    console.error('=====================================');
    console.error('❌ ERROR: Lesson authoring failed');
    console.error('=====================================');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Load resource pack from file path
 */
async function loadResourcePack(path: string): Promise<any> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get Authored SOW entry by courseId and order
 */
async function getAuthoredSOWEntry(
  databases: Databases,
  courseId: string,
  order: number
): Promise<AuthoredSOWEntry> {
  // Query for Authored_SOW document with matching courseId
  const response = await databases.listDocuments(
    DATABASE_ID,
    AUTHORED_SOW_COLLECTION,
    [Query.equal('courseId', courseId)]
  );

  if (response.documents.length === 0) {
    throw new Error(`No Authored_SOW found for courseId: ${courseId}`);
  }

  const sowDoc = response.documents[0] as unknown as AuthoredSOW;

  // Parse entries if stored as JSON string
  let entries = sowDoc.entries;
  if (typeof entries === 'string') {
    entries = JSON.parse(entries);
  }

  if (!Array.isArray(entries)) {
    throw new Error('entries field is not an array');
  }

  if (order < 0 || order >= entries.length) {
    throw new Error(`Order ${order} out of range (0-${entries.length - 1})`);
  }

  return entries[order];
}

/**
 * Create dual JSON input for lesson_author agent
 * Format: <sow_entry_json>,\n<resource_pack_json>
 */
function createDualInput(sowEntry: AuthoredSOWEntry, resourcePack: any): string {
  return JSON.stringify(sowEntry) + ',\n' + JSON.stringify(resourcePack);
}

/**
 * Run lesson author agent with error recovery and retry logic
 *
 * The lesson author agent may encounter errors during execution (LLM timeouts,
 * validation failures, etc.). This function implements automatic retry with
 * human-in-the-loop intervention.
 *
 * Strategy:
 * - Maintain the same threadId across retries for state continuity
 * - Send "continue" or "proceed" message to resume from last checkpoint
 * - Log all attempts and errors for debugging
 * - Maximum 10 retry attempts before failing
 * - Exponential backoff between retries
 */
async function runLessonAuthorAgent(
  dualInput: string,
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
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    logToFile(logFilePath, `\n=== Attempt ${attempt}/${MAX_RETRIES} ===`);
    console.log(`\n🔄 Attempt ${attempt}/${MAX_RETRIES}...`);

    try {
      // First attempt: send dual input
      // Subsequent attempts: send "continue" to resume
      const input = attempt === 1
        ? { messages: [{ role: 'user', content: dualInput }] }
        : { messages: [{ role: 'user', content: 'continue' }] };

      // Stream agent execution
      const stream = client.runs.stream(
        threadId,
        'lesson_author',
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
      if (files['lesson_template.json']) {
        logToFile(logFilePath, `✅ Success on attempt ${attempt}`);
        console.log(`✅ Lesson generated successfully on attempt ${attempt}`);
        return JSON.parse(files['lesson_template.json']);
      }

      // Check for outstanding TODOs
      if (files['lesson_todos.json']) {
        const todos = JSON.parse(files['lesson_todos.json']);
        const errorMsg = `⚠️  Agent has ${todos.length} outstanding TODOs`;
        logToFile(logFilePath, errorMsg);
        logToFile(logFilePath, JSON.stringify(todos, null, 2));

        console.log(`   ${errorMsg}`);
        todos.slice(0, 3).forEach((todo: any) => {
          console.log(`      - ${todo.critic}: ${todo.issue}`);
        });

        // Continue to retry with "continue" message
        lastError = new Error(`Outstanding TODOs: ${todos.length}`);
        continue;
      }

      // No template and no TODOs - unknown state
      throw new Error('Agent completed but produced no lesson_template.json or lesson_todos.json');

    } catch (error) {
      lastError = error;
      const errorMsg = `❌ Attempt ${attempt} failed: ${error.message}`;
      logToFile(logFilePath, errorMsg);
      logToFile(logFilePath, error.stack);
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

/**
 * Upsert lesson template to lesson_templates collection
 * Lookup by courseId + sow_order for deterministic updates
 */
async function upsertLessonTemplate(
  databases: Databases,
  lessonTemplate: any,
  courseId: string,
  sowOrder: number
): Promise<{ action: 'Created' | 'Updated'; documentId: string }> {
  // Query for existing lesson template
  const existingDocs = await databases.listDocuments(
    DATABASE_ID,
    LESSON_TEMPLATES_COLLECTION,
    [
      Query.equal('courseId', courseId),
      Query.equal('sow_order', sowOrder)
    ]
  );

  // Prepare document data with correct schema
  const docData = {
    courseId,
    sow_order: sowOrder,
    title: lessonTemplate.title,
    createdBy: 'lesson_author_agent',
    version: 1,
    status: 'draft',
    lesson_type: lessonTemplate.lesson_type || 'teach',
    estMinutes: lessonTemplate.estMinutes || 50,
    outcomeRefs: JSON.stringify(lessonTemplate.outcomeRefs || []),
    engagement_tags: JSON.stringify(lessonTemplate.engagement_tags || []),
    policy: JSON.stringify(lessonTemplate.policy || {}),
    cards: JSON.stringify(lessonTemplate.cards || [])
  };

  if (existingDocs.documents.length > 0) {
    // Update existing document
    const docId = existingDocs.documents[0].$id;
    await databases.updateDocument(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      docId,
      docData
    );
    return { action: 'Updated', documentId: docId };
  } else {
    // Create new document
    const doc = await databases.createDocument(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      'unique()',
      docData
    );
    return { action: 'Created', documentId: doc.$id };
  }
}

// Run the script
main();
```

### Package.json Script Addition

Add to `assistant-ui-frontend/package.json`:

```json
{
  "scripts": {
    "seed:authored-lesson": "tsx scripts/seedAuthoredLesson.ts"
  }
}
```

## Logging and Debugging

### Log File Location
```
logs/lesson-authoring/lesson_<courseId>_order<order>_<timestamp>.log
```

### Log File Contents
- Thread ID for debugging in LangGraph Studio
- Each retry attempt with timestamp
- Error messages and stack traces
- Agent state transitions
- Outstanding TODOs from critics
- Final success or failure status

### Example Log Output
```
[2025-01-04T19:30:15.234Z] Thread created: thread_abc123
[2025-01-04T19:30:15.235Z]
=== Attempt 1/10 ===
[2025-01-04T19:30:45.678Z] ⚠️  Agent has 2 outstanding TODOs
[2025-01-04T19:30:45.679Z] [
  {
    "critic": "pedagogical_critic",
    "issue": "CFU stem needs clarification"
  },
  {
    "critic": "accessibility_critic",
    "issue": "Missing plain language explainer"
  }
]
[2025-01-04T19:30:46.123Z]
=== Attempt 2/10 ===
[2025-01-04T19:31:15.456Z] ✅ Success on attempt 2
```

### Debugging Failed Runs
1. Check log file for thread ID
2. Open LangGraph Studio: `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024`
3. Navigate to thread using thread ID from log
4. Inspect state, messages, and critic outputs
5. Identify which critic is blocking completion
6. Review agent's file outputs (lesson_template.json, lesson_todos.json)

## Testing Strategy

### Test Case 1: First Lesson Generation
```bash
npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
```

**Expected Output**:
- Loads research pack successfully
- Finds Authored_SOW entry at index 0
- Creates dual JSON input
- Creates thread and log file
- Invokes lesson_author agent
- Agent generates lesson template (potentially with retries)
- Creates new document in lesson_templates collection
- Log file contains full execution history

### Test Case 2: Update Existing Lesson
```bash
# Run same command twice
npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
```

**Expected Output**:
- Second run should UPDATE existing document instead of creating duplicate
- Document ID should remain the same
- New log file created for second run

### Test Case 3: Multiple Lessons in Sequence
```bash
npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
npm run seed:authored-lesson "course_c84774" 1 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
npm run seed:authored-lesson "course_c84774" 2 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
```

**Expected Output**:
- Three separate lesson templates created
- Each with correct sow_order (0, 1, 2)
- All linked to same courseId
- Three separate log files created

### Test Case 4: Error Handling
```bash
# Invalid order number
npm run seed:authored-lesson "course_c84774" 999 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
```

**Expected Output**:
- Clear error message: "Order 999 out of range (0-X)"
- Exit code 1
- No log file created (fails before agent invocation)

### Test Case 5: Error Recovery
```bash
# Run with network interruptions or LLM timeouts
npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
```

**Expected Output**:
- Multiple retry attempts logged
- "continue" messages sent to agent for retries
- Log file shows each attempt with errors
- Either eventual success or failure after 10 attempts
- Thread ID preserved across all retries

## Integration with Existing Infrastructure

### Follows Patterns From
- `seedAuthoredSOW.ts`: Appwrite client setup, upsert pattern, error handling
- `example_lesson_author.py`: Dual JSON input format, agent invocation
- `seedAuthoredSOW.ts` (lines 425-439): Lesson template schema

### Environment Variables Required
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
LANGGRAPH_LESSON_AUTHOR_URL=http://localhost:2024  # Optional, defaults to this
```

### Prerequisites
1. **LangGraph server must be running**: `cd langgraph-author-agent && langgraph dev --allow-blocking`
   - The `--allow-blocking` flag is **CRITICAL** - the lesson_author agent uses blocking operations during multi-critic evaluation
2. Authored_SOW document must exist for the specified courseId
3. Resource pack file must exist at specified path (fail fast if missing - no auto-detection)

## Benefits

1. **Automation**: Reduces manual lesson creation effort
2. **Consistency**: Same agent logic as standalone Python script
3. **Integration**: Works within existing seeding infrastructure
4. **Deterministic**: Upsert pattern prevents duplicates
5. **Debuggable**: Thread-based debugging with LangGraph Studio
6. **Resilient**: Automatic retry with human-in-the-loop intervention
7. **Traceable**: Comprehensive logging for audit trail
8. **Reusable**: Can be run multiple times safely

## Error Recovery Design

### Retry Strategy
- **Thread Persistence**: Same threadId maintained across all retries
- **Human-in-Loop**: "continue" message sent to resume agent execution
- **Exponential Backoff**: Wait time increases: 1s, 2s, 4s, 8s, 10s (max)
- **Max Attempts**: 10 retries before final failure
- **State Continuity**: Agent picks up from last checkpoint on retry

### Error Scenarios Handled
1. **LLM Timeout**: Automatic retry after backoff
2. **Critic Validation Failures**: Send "continue" to trigger re-refinement
3. **Network Interruptions**: Retry with same thread state
4. **Transient API Errors**: Exponential backoff prevents rate limiting

### When to Stop Retrying
- ✅ `lesson_template.json` file exists in state
- ❌ 10 attempts exhausted without success
- ⚠️  `lesson_todos.json` persists with same issues across multiple retries

## Future Enhancements

1. **Batch Processing**: Extend to generate all lessons for a course in one command
2. **Validation**: Add schema validation before upserting
3. **Dry Run**: Add --dry-run flag to preview without upserting
4. **Progress Reporting**: Enhanced progress indicators during agent execution
5. **Smart Retry**: Analyze TODO patterns to determine if retry will help
6. **Parallel Execution**: Generate multiple lessons concurrently

## Related Files

- **LangGraph Agent**: `langgraph-author-agent/src/lesson_author_agent.py`
- **Agent State**: `langgraph-author-agent/src/lesson_author_state.py`
- **Example Script**: `langgraph-author-agent/example_lesson_author.py`
- **Reference Seeding Script**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`
- **Lesson Template Schema**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts` (lines 425-439)
