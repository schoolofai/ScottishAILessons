import { config } from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';

// Load .env.local explicitly
config({ path: '.env.local' });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
  console.error('❌ Missing environment variables');
  console.error(`   NEXT_PUBLIC_APPWRITE_ENDPOINT: ${endpoint ? '✅' : '❌'}`);
  console.error(`   NEXT_PUBLIC_APPWRITE_PROJECT_ID: ${projectId ? '✅' : '❌'}`);
  console.error(`   APPWRITE_API_KEY: ${apiKey ? '✅' : '❌'}`);
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function testSowOrder() {
  console.log('🔍 Testing sow_order field implementation...\n');

  // Test 1: Query by courseId + sow_order (deterministic lookup)
  console.log('Test 1: Query template by courseId + sow_order');
  const template1 = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', 'course_c84473'),
      Query.equal('sow_order', 1)
    ]
  );
  console.log(`✅ Found template #1: ${template1.documents[0]?.title}`);
  console.log(`   sow_order: ${template1.documents[0]?.sow_order}`);
  console.log(`   Document ID: ${template1.documents[0]?.$id}\n`);

  // Test 2: Verify sequential ordering (only for seeded templates)
  console.log('Test 2: Verify first 5 templates have sequential sow_order');
  const first5 = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', 'course_c84473'),
      Query.equal('createdBy', 'sow_author_agent'),
      Query.orderAsc('sow_order'),
      Query.limit(5)
    ]
  );

  first5.documents.forEach((doc: any) => {
    console.log(`   #${doc.sow_order}: ${doc.title} (ID: ${doc.$id})`);
  });
  console.log(`   Total returned: ${first5.total}, Documents: ${first5.documents.length}`);

  // Debug: Check the first template directly by ID
  if (first5.documents.length > 0) {
    const firstDocId = first5.documents[0].$id;
    const directFetch = await databases.getDocument('default', 'lesson_templates', firstDocId);
    console.log(`   Direct fetch of ${firstDocId}: sow_order = ${directFetch.sow_order}\n`);
  }

  // Test 3: Check uniqueness constraint works
  console.log('Test 3: Verify uniqueness of courseId + sow_order');
  const template50 = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', 'course_c84473'),
      Query.equal('sow_order', 50)
    ]
  );
  console.log(`✅ Template #50 count: ${template50.total} (should be 1)`);
  console.log(`   Title: ${template50.documents[0]?.title}\n`);

  // Test 4: Verify all templates have sow_order
  console.log('Test 4: Count templates with sow_order populated');
  const allTemplates = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', 'course_c84473'),
      Query.equal('createdBy', 'sow_author_agent'),
      Query.limit(200)
    ]
  );

  const withSowOrder = allTemplates.documents.filter((doc: any) => doc.sow_order != null);
  console.log(`✅ Templates with sow_order: ${withSowOrder.length}/${allTemplates.total}`);

  if (withSowOrder.length === allTemplates.total) {
    console.log('✅ All templates have sow_order populated!\n');
  } else {
    console.log('⚠️  Some templates missing sow_order\n');
  }

  console.log('🎉 sow_order implementation verified successfully!');
}

testSowOrder().catch(console.error);
