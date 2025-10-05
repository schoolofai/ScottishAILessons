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
 *   npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
 */

import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import { Client as LangGraphClient } from '@langchain/langgraph-sdk';
import { readFile } from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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
    console.error('Example: npm run seed:authored-lesson "course_c84774" 0 "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"');
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
    console.log(`✅ Loaded resource pack (version ${resourcePack.research_pack_version || 'N/A'})`);
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
async function loadResourcePack(filePath: string): Promise<any> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load resource pack from ${filePath}: ${error.message}`);
  }
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
  let lastError: Error | null = null;

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
