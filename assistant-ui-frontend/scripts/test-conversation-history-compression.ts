import { Client, Databases } from 'node-appwrite';
import * as pako from 'pako';

/**
 * Test script to verify conversation history compression and Appwrite storage
 *
 * Tests:
 * 1. Compression function matches frontend implementation
 * 2. Appwrite can store and retrieve compressed history
 * 3. Round-trip compression/decompression works
 */

// Compression function (matches frontend)
function compressConversationHistory(history: any): string {
  try {
    const jsonString = JSON.stringify(history);
    const compressed = pako.gzip(jsonString);
    const base64 = btoa(String.fromCharCode(...compressed));

    const originalSize = new Blob([jsonString]).size;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`🗜️ Compression stats: ${originalSize}B → ${compressedSize}B (${ratio}% reduction)`);

    return base64;
  } catch (error) {
    console.error('❌ Failed to compress conversation history:', error);
    throw error;
  }
}

// Decompression function (matches SessionDriver)
function decompressConversationHistory(compressedBase64: string): any {
  try {
    // Decode base64 to binary
    const binaryString = atob(compressedBase64);
    const compressed = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressed[i] = binaryString.charCodeAt(i);
    }

    // Decompress with pako
    const decompressed = pako.ungzip(compressed, { to: 'string' });

    // Parse JSON
    const history = JSON.parse(decompressed);

    console.log(`🗜️ Decompression successful: ${history.messages?.length || 0} messages recovered`);

    return history;
  } catch (error) {
    console.error('❌ Failed to decompress conversation history:', error);
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Testing Conversation History Compression & Storage');
  console.log('═'.repeat(80));

  // Test data - simulate a realistic conversation history
  const testHistory = {
    version: '1.0',
    threadId: 'test_thread_123',
    sessionId: 'test_session_123',
    capturedAt: new Date().toISOString(),
    messages: Array.from({ length: 15 }, (_, i) => ({
      id: `msg_${i}`,
      type: i % 2 === 0 ? 'user' : 'assistant',
      content: `This is test message ${i}. `.repeat(20), // ~400 chars per message
      tool_calls: i === 10 ? [{
        id: 'tool_call_1',
        name: 'present_lesson_card',
        args: { cardId: 'card_123' }
      }] : undefined
    }))
  };

  console.log(`📋 Test Data:`);
  console.log(`  Messages: ${testHistory.messages.length}`);
  console.log(`  Raw JSON size: ${JSON.stringify(testHistory).length} chars`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Test 1: Compression/Decompression Round Trip
  // ═══════════════════════════════════════════════════════════════
  console.log('Test 1: Compression/Decompression Round Trip');
  console.log('─'.repeat(80));

  let compressedHistory: string;
  try {
    compressedHistory = compressConversationHistory(testHistory);
    console.log(`✅ Compression successful`);
    console.log(`  Compressed size: ${compressedHistory.length} chars (${(compressedHistory.length / 1024).toFixed(2)} KB)`);

    if (compressedHistory.length > 50000) {
      console.error(`❌ Compressed history exceeds 50KB limit: ${(compressedHistory.length / 1024).toFixed(2)} KB`);
      return;
    }
  } catch (error) {
    console.error(`❌ Compression failed:`, error);
    return;
  }

  try {
    const decompressed = decompressConversationHistory(compressedHistory);
    console.log(`✅ Decompression successful`);

    // Verify data integrity
    if (JSON.stringify(decompressed) === JSON.stringify(testHistory)) {
      console.log(`✅ Data integrity verified - round trip successful`);
    } else {
      console.error(`❌ Data mismatch after decompression`);
      return;
    }
  } catch (error) {
    console.error(`❌ Decompression failed:`, error);
    return;
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Test 2: Appwrite Storage Test
  // ═══════════════════════════════════════════════════════════════
  console.log('Test 2: Appwrite Storage Test');
  console.log('─'.repeat(80));

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');

  const databases = new Databases(client);

  try {
    // Find a test session to update
    const sessions = await databases.listDocuments('default', 'sessions', []);

    if (sessions.documents.length === 0) {
      console.log(`⚠️ No sessions found for testing - skipping Appwrite test`);
      console.log(`   Create a session first and retry`);
      return;
    }

    const testSessionId = sessions.documents[0].$id;
    console.log(`📋 Using test session: ${testSessionId}`);

    // Update session with compressed history
    console.log(`📤 Updating session with compressed history...`);
    await databases.updateDocument('default', 'sessions', testSessionId, {
      conversationHistory: compressedHistory
    });
    console.log(`✅ Session updated successfully`);

    // Retrieve and verify
    console.log(`📥 Retrieving session...`);
    const session = await databases.getDocument('default', 'sessions', testSessionId);

    if (!session.conversationHistory) {
      console.error(`❌ conversationHistory field is empty after update`);
      return;
    }

    console.log(`✅ conversationHistory field retrieved (${session.conversationHistory.length} chars)`);

    // Decompress and verify
    const retrievedHistory = decompressConversationHistory(session.conversationHistory);

    if (JSON.stringify(retrievedHistory) === JSON.stringify(testHistory)) {
      console.log(`✅ Full round trip successful (compress → store → retrieve → decompress)`);
    } else {
      console.error(`❌ Data mismatch after Appwrite round trip`);
    }

    // Clean up - set conversationHistory back to null
    console.log(`🧹 Cleaning up test data...`);
    await databases.updateDocument('default', 'sessions', testSessionId, {
      conversationHistory: null
    });
    console.log(`✅ Test cleanup complete`);

  } catch (error: any) {
    console.error(`❌ Appwrite storage test failed:`, error.message);
    console.error(`   Error type: ${error.type}`);
    console.error(`   Error code: ${error.code}`);

    if (error.response) {
      console.error(`   Response:`, JSON.stringify(error.response, null, 2));
    }

    // Check for specific error patterns
    if (error.message?.includes('Server Error')) {
      console.error(`\n🔍 "Server Error" detected - this is the same error from the logs!`);
      console.error(`   Possible causes:`);
      console.error(`   1. String field size limit exceeded (max 50,000 chars)`);
      console.error(`   2. Invalid UTF-8 characters in base64 string`);
      console.error(`   3. Appwrite API issue or temporary outage`);
      console.error(`   4. Authentication/permission issue`);
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ All tests completed');
}

runTests().catch(console.error);
