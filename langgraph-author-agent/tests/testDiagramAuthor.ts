#!/usr/bin/env tsx

/**
 * Test Diagram Author Agent
 *
 * Fetches a lesson template from Appwrite and generates diagrams using the diagram_author agent.
 *
 * Usage:
 *   tsx tests/testDiagramAuthor.ts <lessonTemplateId>
 *
 * Example:
 *   tsx tests/testDiagramAuthor.ts 68e1665b000f250aa9a1
 */

import { Client as AppwriteClient, Databases } from 'node-appwrite';
import { Client as LangGraphClient } from '@langchain/langgraph-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const LANGGRAPH_URL = 'http://localhost:2027';

const DATABASE_ID = 'default';
const LESSON_TEMPLATES_COLLECTION = 'lesson_templates';

async function fetchLessonTemplate(databases: Databases, lessonTemplateId: string): Promise<any> {
  console.log(`📚 Fetching lesson template: ${lessonTemplateId}`);

  try {
    const document = await databases.getDocument(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      lessonTemplateId
    );

    console.log(`✅ Found lesson template: ${document.title || 'Untitled'}`);
    console.log(`   Lesson Type: ${document.lesson_type || 'Unknown'}`);
    console.log(`   Cards: ${document.cards?.length || 0}`);

    return document;
  } catch (error: any) {
    console.error(`❌ Failed to fetch lesson template: ${error.message}`);
    throw error;
  }
}

async function generateDiagrams(lessonTemplate: any): Promise<any> {
  console.log('\n🎨 Calling diagram_author agent...');

  const client = new LangGraphClient({ apiUrl: LANGGRAPH_URL });

  // Create a thread
  const thread = await client.threads.create();
  console.log(`✅ Created thread: ${thread.thread_id}`);

  // Prepare input - just the lesson template JSON
  const input = {
    lesson_template_id: lessonTemplate.$id,
    lesson_template: {
      lessonTemplateId: lessonTemplate.$id,
      title: lessonTemplate.title,
      lesson_type: lessonTemplate.lesson_type,
      cards: lessonTemplate.cards || []
    }
  };

  console.log('\n📤 Sending lesson template to diagram_author...');

  // Stream the agent execution
  let finalState: any = null;

  const streamResponse = client.runs.stream(
    thread.thread_id,
    'diagram_author',
    {
      input,
      streamMode: 'values'
    }
  );

  console.log('\n🔄 Processing...\n');

  for await (const chunk of streamResponse) {
    // Log agent progress
    if (chunk.event === 'metadata') {
      console.log(`   📊 Metadata: ${JSON.stringify(chunk.data)}`);
    } else if (chunk.event === 'values') {
      finalState = chunk.data;

      // Log progress updates
      if (finalState.cards_processed !== undefined) {
        console.log(`   ✓ Cards processed: ${finalState.cards_processed}/${finalState.total_cards}`);
      }
      if (finalState.cards_with_diagrams !== undefined) {
        console.log(`   ✓ Cards with diagrams: ${finalState.cards_with_diagrams}`);
      }
    }
  }

  console.log('\n✅ Agent execution complete!');

  return finalState;
}

async function saveDiagramsOutput(diagrams: any, lessonTemplateId: string): Promise<void> {
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `diagrams_${lessonTemplateId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(diagrams, null, 2));

  console.log(`\n💾 Diagrams saved to: ${outputPath}`);
}

async function main() {
  const [lessonTemplateId] = process.argv.slice(2);

  if (!lessonTemplateId) {
    console.error('Usage: tsx tests/testDiagramAuthor.ts <lessonTemplateId>');
    console.error('Example: tsx tests/testDiagramAuthor.ts 68e1665b000f250aa9a1');
    process.exit(1);
  }

  console.log('🧪 Diagram Author Agent Test');
  console.log('============================');
  console.log(`Lesson Template ID: ${lessonTemplateId}`);
  console.log(`LangGraph URL: ${LANGGRAPH_URL}`);
  console.log('');

  try {
    // Initialize Appwrite client
    const appwrite = new AppwriteClient()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);

    const databases = new Databases(appwrite);

    // Step 1: Fetch lesson template
    const lessonTemplate = await fetchLessonTemplate(databases, lessonTemplateId);

    // Step 2: Generate diagrams
    const result = await generateDiagrams(lessonTemplate);

    // Step 3: Display results
    console.log('\n📊 Results:');
    console.log('============');
    console.log(`Total cards: ${result.total_cards || 0}`);
    console.log(`Cards processed: ${result.cards_processed || 0}`);
    console.log(`Cards with diagrams: ${result.cards_with_diagrams || 0}`);

    if (result.output_diagrams && result.output_diagrams.length > 0) {
      console.log(`\n✅ Generated ${result.output_diagrams.length} diagrams:`);
      result.output_diagrams.forEach((diagram: any, index: number) => {
        console.log(`   ${index + 1}. Card: ${diagram.cardId}`);
        console.log(`      Type: ${diagram.diagram_type || 'unknown'}`);
        console.log(`      Score: ${diagram.visual_critique_score || 'N/A'}`);
        console.log(`      Iterations: ${diagram.critique_iterations || 0}`);
      });

      // Save diagrams to output file
      await saveDiagramsOutput(result.output_diagrams, lessonTemplateId);
    } else {
      console.log('\n⚠️  No diagrams were generated');
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${result.errors.length}`);
      result.errors.forEach((error: any, index: number) => {
        console.log(`   ${index + 1}. ${error.message || JSON.stringify(error)}`);
      });
    }

    console.log('\n✅ Test complete!');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
