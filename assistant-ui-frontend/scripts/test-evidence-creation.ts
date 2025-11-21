/**
 * Test evidence creation to debug Server Error 500
 *
 * This script simulates exactly what the completion API does when creating evidence records.
 */

import { Client, Databases, ID } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

// Test data matching what the frontend sends
const TEST_EVIDENCE_DATA = {
  sessionId: 'test_session_123',
  itemId: 'card_001',
  response: 'Test answer: 2+2=4',
  correct: true,
  attempts: 1,
  confidence: 0.8,
  reasoning: 'Simple arithmetic',
  feedback: 'Correct answer!',
  timestamp: new Date().toISOString()
};

async function testEvidenceCreation() {
  console.log('🧪 Testing Evidence Creation');
  console.log('═'.repeat(80));

  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing environment variables');
    console.error('  NEXT_PUBLIC_APPWRITE_PROJECT_ID:', !!APPWRITE_PROJECT_ID);
    console.error('  APPWRITE_API_KEY:', !!APPWRITE_API_KEY);
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  // Test 1: Verify evidence schema
  console.log('\n📋 Test 1: Verifying Evidence Collection Schema');
  console.log('─'.repeat(80));

  try {
    const collection = await databases.getCollection('default', 'evidence');
    console.log('✅ Evidence collection found');
    console.log(`   Name: ${collection.name}`);
    console.log(`   Document Security: ${collection.documentSecurity}`);

    const requiredFields = collection.attributes
      .filter((a: any) => a.required)
      .map((a: any) => a.key);
    console.log(`   Required fields: [${requiredFields.join(', ')}]`);
  } catch (error: any) {
    console.error('❌ Failed to get collection schema:', error.message);
    process.exit(1);
  }

  // Test 2: Create evidence record with exact API data structure
  console.log('\n📝 Test 2: Creating Evidence Record (API Simulation)');
  console.log('─'.repeat(80));
  console.log('Data being sent:');
  console.log(JSON.stringify(TEST_EVIDENCE_DATA, null, 2));

  try {
    const evidenceDoc = await databases.createDocument(
      'default',
      'evidence',
      ID.unique(),
      TEST_EVIDENCE_DATA
    );

    console.log('\n✅ SUCCESS! Evidence record created');
    console.log(`   Document ID: ${evidenceDoc.$id}`);
    console.log(`   Created At: ${evidenceDoc.$createdAt}`);
    console.log('\n   Stored values:');
    console.log(`   - sessionId: ${evidenceDoc.sessionId}`);
    console.log(`   - itemId: ${evidenceDoc.itemId}`);
    console.log(`   - response: ${evidenceDoc.response.substring(0, 50)}...`);
    console.log(`   - correct: ${evidenceDoc.correct}`);
    console.log(`   - attempts: ${evidenceDoc.attempts}`);
    console.log(`   - confidence: ${evidenceDoc.confidence}`);

    // Clean up test record
    console.log('\n🧹 Cleaning up test record...');
    await databases.deleteDocument('default', 'evidence', evidenceDoc.$id);
    console.log('✅ Test record deleted');

  } catch (error: any) {
    console.error('\n❌ FAILED to create evidence record!');
    console.error('─'.repeat(80));
    console.error(`Error Type: ${error.type || error.name}`);
    console.error(`Error Code: ${error.code}`);
    console.error(`Error Message: ${error.message}`);

    if (error.response) {
      try {
        const responseData = JSON.parse(error.response);
        console.error('\nResponse Data:', JSON.stringify(responseData, null, 2));
      } catch (e) {
        console.error('\nRaw Response:', error.response);
      }
    }

    console.error('\n💡 Debugging Tips:');
    console.error('1. Check if field names match schema exactly (case-sensitive)');
    console.error('2. Verify data types match schema requirements');
    console.error('3. Check if string fields exceed size limits');
    console.error('4. Ensure all required fields are provided');

    process.exit(1);
  }

  // Test 3: Test with minimal required fields only
  console.log('\n📝 Test 3: Creating Evidence with Required Fields Only');
  console.log('─'.repeat(80));

  const minimalData = {
    sessionId: 'test_session_minimal',
    itemId: 'card_minimal',
    response: 'Minimal test response',
    correct: true
  };

  console.log('Minimal data:');
  console.log(JSON.stringify(minimalData, null, 2));

  try {
    const minimalDoc = await databases.createDocument(
      'default',
      'evidence',
      ID.unique(),
      minimalData
    );

    console.log('\n✅ SUCCESS! Minimal evidence record created');
    console.log(`   Document ID: ${minimalDoc.$id}`);

    // Check default values
    console.log('\n   Default values applied:');
    console.log(`   - attempts: ${minimalDoc.attempts} (expected: 1)`);
    console.log(`   - confidence: ${minimalDoc.confidence} (expected: 0)`);
    console.log(`   - score: ${minimalDoc.score} (expected: 0)`);

    // Clean up
    await databases.deleteDocument('default', 'evidence', minimalDoc.$id);
    console.log('\n🧹 Test record deleted');

  } catch (error: any) {
    console.error('\n❌ FAILED with minimal data!');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // Test 4: Test with real lesson data format (from frontend)
  console.log('\n📝 Test 4: Testing with Real Frontend Data Format');
  console.log('─'.repeat(80));

  const frontendData = {
    sessionId: '6920998800324a265724',
    itemId: 'card_001',
    response: 'The student selected option A: £5.50',
    correct: true,
    attempts: 1,
    confidence: 0.9,
    reasoning: 'Correctly identified the total cost',
    feedback: 'Well done! You calculated the correct total.',
    timestamp: new Date().toISOString()
  };

  console.log('Frontend format data:');
  console.log(JSON.stringify(frontendData, null, 2));

  try {
    const frontendDoc = await databases.createDocument(
      'default',
      'evidence',
      ID.unique(),
      frontendData
    );

    console.log('\n✅ SUCCESS! Frontend format record created');
    console.log(`   Document ID: ${frontendDoc.$id}`);

    // Clean up
    await databases.deleteDocument('default', 'evidence', frontendDoc.$id);
    console.log('🧹 Test record deleted');

  } catch (error: any) {
    console.error('\n❌ FAILED with frontend format!');
    console.error(`Error: ${error.message}`);

    if (error.response) {
      console.error('\nFull error details:');
      console.error(JSON.stringify(error, null, 2));
    }

    process.exit(1);
  }

  // Success summary
  console.log('\n═'.repeat(80));
  console.log('✅ ALL TESTS PASSED!');
  console.log('═'.repeat(80));
  console.log('\n📊 Summary:');
  console.log('  ✓ Evidence collection schema verified');
  console.log('  ✓ Full evidence record creation successful');
  console.log('  ✓ Minimal required fields creation successful');
  console.log('  ✓ Frontend data format creation successful');
  console.log('\n💡 Evidence creation is working correctly!');
  console.log('   The Server Error 500 must be caused by:');
  console.log('   - Different data being sent than expected');
  console.log('   - Missing/invalid field in actual completion request');
  console.log('   - Data type mismatch in actual request');
  console.log('\n🎯 Next step: Check the actual completion API logs for exact data being sent');
}

testEvidenceCreation().catch(console.error);
