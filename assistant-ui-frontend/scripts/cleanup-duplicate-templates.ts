import { config } from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';

// Load environment
config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

async function cleanupDuplicateTemplates() {
  console.log('🧹 Starting cleanup of duplicate lesson templates...\n');

  const courseId = 'course_c84473';

  // Get all templates for the course
  console.log('📊 Fetching all templates...');
  const allTemplates = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', courseId),
      Query.limit(500)
    ]
  );

  console.log(`   Total templates: ${allTemplates.total}\n`);

  // Separate templates with and without sow_order
  const withSowOrder = allTemplates.documents.filter((doc: any) => doc.sow_order != null);
  const withoutSowOrder = allTemplates.documents.filter((doc: any) => doc.sow_order == null);

  console.log(`📊 Template breakdown:`);
  console.log(`   With sow_order: ${withSowOrder.length}`);
  console.log(`   Without sow_order: ${withoutSowOrder.length}\n`);

  if (withoutSowOrder.length === 0) {
    console.log('✅ No templates to clean up!');
    return;
  }

  // Delete templates without sow_order
  console.log(`🗑️  Deleting ${withoutSowOrder.length} templates without sow_order...`);

  let deletedCount = 0;
  for (const template of withoutSowOrder) {
    try {
      await databases.deleteDocument('default', 'lesson_templates', template.$id);
      deletedCount++;
      console.log(`   ✅ Deleted: ${template.title} (${template.$id})`);
    } catch (error: any) {
      console.error(`   ❌ Failed to delete ${template.$id}: ${error.message}`);
    }
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`   Templates deleted: ${deletedCount}`);
  console.log(`   Templates remaining: ${withSowOrder.length}`);
  console.log(`\n🎉 Cleanup complete!`);
}

cleanupDuplicateTemplates().catch(console.error);
