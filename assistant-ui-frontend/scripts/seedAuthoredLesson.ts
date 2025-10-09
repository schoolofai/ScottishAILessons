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
import { compressCards, getCompressionStats } from '../lib/appwrite/utils/compression';

dotenv.config({ path: '.env.local' });

// Configuration
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const LANGGRAPH_URL = process.env.LANGGRAPH_LESSON_AUTHOR_URL || 'http://localhost:2027';

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

/**
 * SOW Context Metadata - course-level metadata from Authored_SOW
 */
interface SOWContextMetadata {
  coherence: {
    policy_notes: string[];
    sequencing_notes: string[];
  };
  accessibility_notes: string[];
  engagement_notes: string[];
  weeks: number;
  periods_per_week: number;
}

interface AuthoredSOW {
  courseId: string;
  entries: AuthoredSOWEntry[];
  coherence?: string | { policy_notes?: string[]; sequencing_notes?: string[] };
  accessibility_notes?: string | string[];
  engagement_notes?: string | string[];
  weeks?: number;
  periods_per_week?: number;
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

    // Step 2: Get Authored SOW document (full document with metadata)
    console.log('📚 Fetching Authored SOW document...');
    const authoredSOW = await getAuthoredSOW(databases, courseId);
    console.log(`✅ Found Authored SOW for course: ${courseId}`);
    console.log(`   Total entries: ${authoredSOW.entries.length}`);
    console.log('');

    // Step 2.5: Fetch course metadata
    console.log('🎓 Fetching course metadata...');
    const courseMetadata = await getCourseMetadata(databases, courseId);
    console.log(`✅ Course: ${courseMetadata.subject} ${courseMetadata.level}`);
    console.log('');

    // Step 2.6: Fetch SQA course data
    console.log('📚 Fetching SQA course data from sqa_education database...');
    const courseData = await fetchSQACourseData(
      databases,
      courseMetadata.subject,
      courseMetadata.level
    );
    console.log(`✅ Fetched SQA data (${courseData.length} characters)`);
    console.log('');

    // Step 3: Extract SOW entry for the specified order
    console.log(`🔍 Extracting entry at order ${order}...`);
    const sowEntry = await getSOWEntryByOrder(authoredSOW, order);
    console.log(`✅ Found entry: "${sowEntry.label}"`);
    console.log(`   Type: ${sowEntry.lesson_type}`);
    console.log(`   Duration: ${sowEntry.estMinutes} minutes`);
    console.log('');

    // Step 4: Parse SOW metadata
    console.log('📋 Parsing SOW context metadata...');
    const sowMetadata = parseSOWMetadata(authoredSOW);
    console.log(`✅ Extracted metadata:`);
    console.log(`   Policy notes: ${sowMetadata.coherence.policy_notes.length}`);
    console.log(`   Sequencing notes: ${sowMetadata.coherence.sequencing_notes.length}`);
    console.log(`   Accessibility notes: ${sowMetadata.accessibility_notes.length}`);
    console.log(`   Engagement notes: ${sowMetadata.engagement_notes.length}`);
    console.log(`   Duration: ${sowMetadata.weeks} weeks × ${sowMetadata.periods_per_week} periods/week`);
    console.log('');

    // Step 5: Create triple JSON input
    console.log('🔧 Creating triple JSON input...');
    const tripleInput = createTripleInput(sowEntry, resourcePack, sowMetadata);
    console.log(`✅ Created input (${tripleInput.length} characters)`);
    console.log('');

    // Step 6: Run lesson author agent with retry logic
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

    const lessonTemplate = await runLessonAuthorAgent(tripleInput, courseData, LANGGRAPH_URL, logFile);
    console.log('✅ Lesson template generated');
    // Handle both flat and nested structures
    const template = lessonTemplate.content || lessonTemplate;
    console.log(`   Title: ${template.title || 'N/A'}`);
    console.log(`   Type: ${template.lesson_type || 'N/A'}`);
    console.log(`   Duration: ${template.estMinutes || 'N/A'} minutes`);
    console.log(`   Cards: ${template.cards?.length || 0}`);
    console.log('');

    // Step 7: Upsert to lesson_templates
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
 * Get full Authored SOW document by courseId
 */
async function getAuthoredSOW(
  databases: Databases,
  courseId: string
): Promise<AuthoredSOW> {
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
  if (typeof sowDoc.entries === 'string') {
    sowDoc.entries = JSON.parse(sowDoc.entries);
  }

  if (!Array.isArray(sowDoc.entries)) {
    throw new Error('entries field is not an array');
  }

  return sowDoc;
}

/**
 * Extract SOW entry by order from AuthoredSOW document
 */
async function getSOWEntryByOrder(
  authoredSOW: AuthoredSOW,
  order: number
): Promise<AuthoredSOWEntry> {
  // Find entry by its order field, not array index
  const entry = authoredSOW.entries.find(e => e.order === order);

  if (!entry) {
    const availableOrders = authoredSOW.entries.map(e => e.order).sort((a, b) => a - b);
    throw new Error(
      `No entry found with order ${order}. ` +
      `Available orders: ${availableOrders.join(', ')}`
    );
  }

  return entry;
}

/**
 * Fetch course metadata from courses collection
 */
async function getCourseMetadata(
  databases: Databases,
  courseId: string
): Promise<{ subject: string; level: string }> {
  // Query by courseId field, not document ID
  const response = await databases.listDocuments(
    DATABASE_ID,
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
    subject: course.subject,
    level: course.level
  };
}

/**
 * Normalize subject and level from courses collection format to sqa_current collection format
 * - Converts hyphens to underscores
 * - Handles special case: "application-of-mathematics" → "applications_of_mathematics"
 */
function normalizeSQAQueryValues(subject: string, level: string): { subject: string; level: string } {
  // Convert hyphens to underscores
  let normalizedSubject = subject.replace(/-/g, '_');
  let normalizedLevel = level.replace(/-/g, '_');

  // Special case: "application_of_mathematics" → "applications_of_mathematics" (plural)
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
  // Normalize subject and level for sqa_current collection query
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
    throw new Error(`No SQA data found for subject="${normalized.subject}" level="${normalized.level}" (original: subject="${subject}" level="${level}")`);
  }

  const sqaDoc = response.documents[0];
  const data = sqaDoc.data;

  // Return as string (data field contains JSON string or object)
  return typeof data === 'string' ? data : JSON.stringify(data);
}

/**
 * Parse SOW metadata from AuthoredSOW document
 * Extracts course-level context for lesson authoring
 */
function parseSOWMetadata(authoredSOW: AuthoredSOW): SOWContextMetadata {
  // Parse coherence field if it's a JSON string
  let coherence: { policy_notes?: string[]; sequencing_notes?: string[] } = {};
  if (typeof authoredSOW.coherence === 'string') {
    try {
      coherence = JSON.parse(authoredSOW.coherence);
    } catch (error) {
      console.warn('⚠️  Failed to parse coherence field, using empty object');
    }
  } else if (authoredSOW.coherence) {
    coherence = authoredSOW.coherence;
  }

  // Parse accessibility_notes if it's a JSON string
  let accessibility_notes: string[] = [];
  if (typeof authoredSOW.accessibility_notes === 'string') {
    try {
      accessibility_notes = JSON.parse(authoredSOW.accessibility_notes);
    } catch (error) {
      // If parsing fails, treat as a single note
      accessibility_notes = [authoredSOW.accessibility_notes];
    }
  } else if (Array.isArray(authoredSOW.accessibility_notes)) {
    accessibility_notes = authoredSOW.accessibility_notes;
  }

  // Parse engagement_notes if it's a JSON string
  let engagement_notes: string[] = [];
  if (typeof authoredSOW.engagement_notes === 'string') {
    try {
      engagement_notes = JSON.parse(authoredSOW.engagement_notes);
    } catch (error) {
      // If parsing fails, treat as a single note
      engagement_notes = [authoredSOW.engagement_notes];
    }
  } else if (Array.isArray(authoredSOW.engagement_notes)) {
    engagement_notes = authoredSOW.engagement_notes;
  }

  return {
    coherence: {
      policy_notes: coherence.policy_notes || [],
      sequencing_notes: coherence.sequencing_notes || []
    },
    accessibility_notes: accessibility_notes,
    engagement_notes: engagement_notes,
    weeks: authoredSOW.weeks || 0,
    periods_per_week: authoredSOW.periods_per_week || 0
  };
}

/**
 * Create triple JSON input for lesson_author agent
 * Format: <sow_entry_json>,\n<resource_pack_json>,\n<sow_metadata_json>
 */
function createTripleInput(
  sowEntry: AuthoredSOWEntry,
  resourcePack: any,
  sowMetadata: SOWContextMetadata
): string {
  return (
    JSON.stringify(sowEntry) + ',\n' +
    JSON.stringify(resourcePack) + ',\n' +
    JSON.stringify(sowMetadata)
  );
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
 * - Pre-inject Course_data.txt into thread state before first run
 * - Send "continue" or "proceed" message to resume from last checkpoint
 * - Log all attempts and errors for debugging
 * - Maximum 10 retry attempts before failing
 * - Exponential backoff between retries
 */
async function runLessonAuthorAgent(
  tripleInput: string,
  courseData: string,
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
  console.log(`   Course_data.txt ready for injection (${courseData.length} chars)`);

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    logToFile(logFilePath, `\n=== Attempt ${attempt}/${MAX_RETRIES} ===`);
    console.log(`\n🔄 Attempt ${attempt}/${MAX_RETRIES}...`);

    try {
      // First attempt: send triple input + inject Course_data.txt in files
      // Subsequent attempts: send "continue" to resume
      const input = attempt === 1
        ? {
            messages: [{ role: 'user', content: tripleInput }],
            files: { 'Course_data.txt': courseData }  // Inject Course_data.txt in first run
          }
        : { messages: [{ role: 'user', content: 'continue' }] };

      if (attempt === 1) {
        logToFile(logFilePath, `Injecting Course_data.txt in first run (${courseData.length} chars)`);
        console.log(`   ✅ Injecting Course_data.txt in first run`);
      }

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

      // Check for critic failures
      if (files['critic_result.json']) {
        const criticResult = JSON.parse(files['critic_result.json']);
        if (criticResult.pass === false) {
          const errorMsg = `⚠️  Critic failed with ${criticResult.issues?.length || 0} issues (score: ${criticResult.overall_score})`;
          logToFile(logFilePath, errorMsg);
          logToFile(logFilePath, JSON.stringify(criticResult, null, 2));

          console.log(`   ${errorMsg}`);
          criticResult.issues?.slice(0, 3).forEach((issue: string) => {
            console.log(`      - ${issue}`);
          });

          // Continue to retry with "continue" message
          lastError = new Error(`Critic failed: ${criticResult.issues?.length || 0} issues`);
          continue;
        }
      }

      // No template - unknown state
      throw new Error('Agent completed but produced no lesson_template.json');

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

  // Prepare document data with correct schema and compression
  // Handle both flat structure (lessonTemplate.cards) and nested structure (lessonTemplate.content.cards)
  const cards = lessonTemplate.content?.cards || lessonTemplate.cards || [];

  // Compress cards using gzip + base64
  const compressedCards = compressCards(cards);
  const stats = getCompressionStats(cards);

  console.log('📦 Compression stats:', {
    original: stats.original + ' chars',
    compressed: stats.compressed + ' chars',
    ratio: stats.ratio,
    savings: stats.savings
  });

  // Extract template content (handle both flat and nested structures)
  const template = lessonTemplate.content || lessonTemplate;

  const docData = {
    courseId,
    sow_order: sowOrder,
    title: template.title,
    createdBy: 'lesson_author_agent',
    version: 1,
    status: 'draft',
    lesson_type: template.lesson_type || 'teach',
    estMinutes: template.estMinutes || 50,
    outcomeRefs: JSON.stringify(template.outcomeRefs || []),
    engagement_tags: JSON.stringify(template.engagement_tags || []),
    policy: JSON.stringify(template.policy || {}),
    cards: compressedCards  // Compressed instead of JSON.stringify
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
