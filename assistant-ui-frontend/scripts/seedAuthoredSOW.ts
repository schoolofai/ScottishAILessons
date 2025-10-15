#!/usr/bin/env tsx

/**
 * Seed Authored SOW - Generate Scheme of Work using LangGraph sow_author agent
 *
 * Features:
 * - Error recovery with automatic retry (max 10 attempts)
 * - Thread persistence for agent continuation
 * - Comprehensive logging to files
 * - Exponential backoff between retries
 * - Agent-driven SOW authoring (no lesson template creation)
 *
 * Usage:
 *   tsx scripts/seedAuthoredSOW.ts <courseId> <resourcePackPath>
 *
 * Example:
 *   tsx scripts/seedAuthoredSOW.ts "course_c84774" "../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt"
 */

import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import { Client as LangGraphClient } from '@langchain/langgraph-sdk';
import { readFile } from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ServerAuthoredSOWDriver, AuthoredSOWData } from '../__tests__/support/ServerAuthoredSOWDriver';

// Load frontend .env.local (for Appwrite config)
dotenv.config({ path: '.env.local' });

// Configuration
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const LANGGRAPH_URL = process.env.LANGGRAPH_SOW_AUTHOR_URL || 'http://localhost:2027';

const DATABASE_ID = 'default';
const AUTHORED_SOW_COLLECTION = 'Authored_SOW';

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

    const { threadId, sowData, criticResult } = await runSOWAuthorAgent(
      courseDataTxt,
      resourcePack,
      LANGGRAPH_URL,
      logFile
    );

    // ═════════════════════════════════════════════════════════════════
    // STEP 5A: Write output files BEFORE database operations
    // Files are preserved for debugging even if database operations fail
    // ═════════════════════════════════════════════════════════════════
    console.log('📝 Writing output files (saved before database operations)...');
    const outputFilePath = writeSOWToFile(threadId, sowData, courseId);
    console.log(`✅ SOW written to: ${outputFilePath}`);

    // Write critic result to output file if available
    let criticFilePath: string | null = null;
    if (criticResult) {
      criticFilePath = writeCriticResultToFile(threadId, criticResult, courseId);
      if (criticFilePath) {
        console.log(`✅ Critic result written to: ${criticFilePath}`);
      }
    } else {
      console.log(`ℹ️  No critic result found in thread state`);
    }

    console.log('');
    console.log('✅ Files saved successfully - preserved for debugging');
    console.log('✅ SOW generated successfully');
    console.log(`   Entries: ${sowData.entries.length} lessons`);
    console.log('   Thread ID: ' + threadId);
    console.log('');

    // ═════════════════════════════════════════════════════════════════
    // STEP 6-7: Database operations (files already saved above)
    // ═════════════════════════════════════════════════════════════════
    try {
      // Step 6: Enrich metadata
      console.log('📊 Enriching metadata for database...');
      const enrichedMetadata = enrichSOWMetadata(sowData, course);
      console.log('✅ Metadata enriched');
      console.log(`   Total lessons: ${enrichedMetadata.total_lessons}`);
      console.log(`   Total estimated minutes: ${enrichedMetadata.total_estimated_minutes}`);
      console.log('');

      // Step 7: Upsert to database (with courseId for version determination)
      const result = await upsertSOWToDatabase(
        databases,
        sowData,
        enrichedMetadata,
        appwriteClient,
        courseId  // Pass courseId from command line args
      );

      console.log('=====================================');
      console.log('🎉 SUCCESS! SOW authored and saved');
      console.log('=====================================');
    } catch (dbError: any) {
      console.error('');
      console.error('=====================================');
      console.error('⚠️  DATABASE OPERATION FAILED');
      console.error('=====================================');
      console.error(`Error: ${dbError.message}`);
      console.error('');
      console.error('📁 Output files were saved successfully and are available for debugging:');
      console.error(`   SOW file: ${outputFilePath}`);
      if (criticFilePath) {
        console.error(`   Critic file: ${criticFilePath}`);
      }
      console.error(`   Log file: ${logFile}`);
      console.error(`   Thread ID: ${threadId}`);
      console.error('');
      throw dbError; // Re-throw to maintain fail-fast behavior
    }

  } catch (error) {
    console.error('');
    console.error('=====================================');
    console.error('❌ ERROR: SOW authoring failed');
    console.error('=====================================');
    console.error(error);
    process.exit(1);
  }
}

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

      let runId: string | null = null;
      let messageCount = 0;

      for await (const chunk of stream) {
        // Capture run ID from metadata event (first event in stream)
        if (chunk.event === 'metadata' && chunk.data?.run_id) {
          runId = chunk.data.run_id;
          logToFile(logFilePath, `Run ID: ${runId}`);
        }

        if (chunk.event === 'messages/partial') {
          messageCount++;
          if (messageCount % 10 === 0) {
            process.stdout.write('.');
          }
        }
      }
      console.log('');

      if (!runId) {
        throw new Error('Failed to capture run ID from stream');
      }

      // Verify run completed successfully BEFORE checking files
      console.log(`   Checking run status...`);
      const run = await client.runs.get(threadId, runId);

      logToFile(logFilePath, `Run status: ${run.status}`);
      logToFile(logFilePath, `Run metadata: ${JSON.stringify(run, null, 2)}`);

      if (run.status === 'error') {
        // Extract error details from run object
        const errorDetails = run.error || 'Unknown error';
        const errorMsg = `Run failed with status: ${run.status}. Error: ${errorDetails}`;
        logToFile(logFilePath, errorMsg);
        throw new Error(errorMsg);
      }

      if (run.status === 'interrupted') {
        const errorMsg = `Run was interrupted. Manual intervention may be required.`;
        logToFile(logFilePath, errorMsg);
        throw new Error(errorMsg);
      }

      if (run.status !== 'success') {
        const errorMsg = `Run completed with unexpected status: ${run.status}`;
        logToFile(logFilePath, errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`   ✅ Run completed with status: ${run.status}`);

      // Get final state - only after verifying run status
      const state = await client.threads.getState(threadId);
      const files = state.values.files || {};

      // Check for successful completion
      if (files['authored_sow_json']) {
        logToFile(logFilePath, `✅ Success on attempt ${attempt}`);
        console.log(`✅ SOW generated successfully on attempt ${attempt}`);

        // Extract critic result if available
        let criticResult = null;
        if (files['sow_critic_result_json']) {
          try {
            criticResult = JSON.parse(files['sow_critic_result_json']);
            logToFile(logFilePath, `Captured sow_critic_result_json`);
          } catch (error: any) {
            logToFile(logFilePath, `Warning: Failed to parse sow_critic_result_json: ${error.message}`);
          }
        }

        return {
          threadId: threadId,
          sowData: JSON.parse(files['authored_sow_json']),
          criticResult: criticResult
        };
      }

      // If status was 'success' but no file, check for critic failures
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

      // Run succeeded but no output file - unexpected state
      throw new Error('Run succeeded but produced no authored_sow_json file');

    } catch (error: any) {
      lastError = error;

      // Enhanced error logging with type detection
      const errorType = error.constructor.name;
      const errorMsg = `❌ Attempt ${attempt} failed (${errorType}): ${error.message}`;

      logToFile(logFilePath, errorMsg);
      logToFile(logFilePath, `Error stack: ${error.stack || 'No stack trace'}`);

      // Check if this is an InvalidUpdateError specifically
      if (error.message.includes('InvalidUpdateError') ||
          error.message.includes('INVALID_CONCURRENT_GRAPH_UPDATE')) {
        logToFile(logFilePath, '⚠️  Detected concurrent graph update error - likely agent bug');
        console.log(`   ⚠️  Concurrent update detected - this may require agent code fix`);
      }

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
 * Write SOW output to JSON file in output directory
 */
function writeSOWToFile(threadId: string, sowData: any, courseId: string): string {
  // Create output directory in current working directory
  const outputDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  // Create filename with thread ID
  const fileName = `sow_${courseId}_${threadId}.json`;
  const filePath = path.join(outputDir, fileName);

  // Write formatted JSON to file
  fs.writeFileSync(
    filePath,
    JSON.stringify(sowData, null, 2),
    'utf-8'
  );

  return filePath;
}

/**
 * Write SOW critic result to JSON file in output directory
 */
function writeCriticResultToFile(
  threadId: string,
  criticResult: any,
  courseId: string
): string | null {
  if (!criticResult) {
    return null;
  }

  // Create output directory in current working directory
  const outputDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  // Create filename with thread ID
  const fileName = `critic_result_${courseId}_${threadId}.json`;
  const filePath = path.join(outputDir, fileName);

  // Write formatted JSON to file
  fs.writeFileSync(
    filePath,
    JSON.stringify(criticResult, null, 2),
    'utf-8'
  );

  return filePath;
}

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

/**
 * Determine the next version for a SOW document
 *
 * Strategy:
 * - If no existing SOW for the course: return "1.0" (initial version)
 * - If existing versions exist: increment the minor version (1.0 → 1.1 → 1.2)
 * - Versions follow semantic versioning: major.minor
 */
async function determineSOWVersion(
  databases: Databases,
  courseId: string
): Promise<string> {
  try {
    console.log(`🔍 Checking for existing SOW versions for course: ${courseId}`);

    // Query existing SOW documents for this course, ordered by version descending
    const response = await databases.listDocuments(
      DATABASE_ID,
      AUTHORED_SOW_COLLECTION,
      [
        Query.equal('courseId', courseId),
        Query.orderDesc('version'),
        Query.limit(1)
      ]
    );

    // No existing versions - this is the first SOW for this course
    if (response.documents.length === 0) {
      console.log(`   ℹ️  No existing versions found. Creating initial version 1.0`);
      return '1.0';
    }

    // Parse the latest version and increment minor version
    const latestDoc = response.documents[0];
    const latestVersion = latestDoc.version;

    console.log(`   📌 Latest version found: ${latestVersion}`);

    // Parse version string (support multiple formats)
    const versionParts = latestVersion.split('.');

    // Handle single-number versions (e.g., "2" → "3")
    if (versionParts.length === 1) {
      const singleVersion = parseInt(versionParts[0], 10);
      if (!isNaN(singleVersion)) {
        const newVersion = String(singleVersion + 1);
        console.log(`   ✅ Incrementing single-number version: ${latestVersion} → ${newVersion}`);
        return newVersion;
      }
    }

    // Handle major.minor versions (e.g., "1.0" → "1.1")
    if (versionParts.length === 2) {
      const major = parseInt(versionParts[0], 10);
      const minor = parseInt(versionParts[1], 10);

      if (!isNaN(major) && !isNaN(minor)) {
        const newVersion = `${major}.${minor + 1}`;
        console.log(`   ✅ Incrementing minor version: ${latestVersion} → ${newVersion}`);
        return newVersion;
      }
    }

    // Fallback for unexpected formats
    console.warn(`   ⚠️  Unexpected version format: ${latestVersion}. Defaulting to "1.0"`);
    return '1.0';
  } catch (error: any) {
    console.error(`   ❌ Error determining version: ${error.message}`);
    console.error(`   ℹ️  Falling back to timestamp-based version`);

    // Fallback: timestamp-based version for uniqueness
    const timestamp = Date.now();
    return `1.${timestamp}`;
  }
}

/**
 * Upsert SOW to Authored_SOW collection
 *
 * Enriches the agent's pedagogical output with database administrative fields:
 * - courseId: from script parameter (not agent output)
 * - version: determined by querying existing versions
 * - status: defaults to 'draft' for newly authored SOWs
 */
async function upsertSOWToDatabase(
  databases: Databases,
  agentOutput: any,
  enrichedMetadata: any,
  appwriteClient: AppwriteClient,
  courseId: string  // Script-provided courseId
): Promise<any> {
  console.log('\n💾 Preparing SOW data for database...');

  // Determine version for this SOW (auto-increment or initial)
  const version = await determineSOWVersion(databases, courseId);

  // Prepare database document with script-provided administrative fields
  const sowData: AuthoredSOWData = {
    courseId: courseId,  // From script parameter, not agent output
    version: version,    // Determined by version strategy
    status: 'draft',     // Default status for newly authored SOWs
    entries: agentOutput.entries,  // Driver will stringify
    metadata: enrichedMetadata,    // Driver will stringify
    accessibility_notes: formatAccessibilityNotes(agentOutput.metadata.accessibility_notes)
  };

  console.log(`   Course ID: ${courseId}`);
  console.log(`   Version: ${version}`);
  console.log(`   Status: draft`);
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

// Run the script
main();
