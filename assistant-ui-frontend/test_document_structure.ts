/**
 * Test script to understand Appwrite document structure vs schema expectations
 */
import { Client, Databases, Query } from 'appwrite';
import { validateCollection, transformAppwriteDocument, StudentSchema, CourseSchema, LessonTemplateSchema } from './lib/appwrite/schemas';

async function testDocumentStructure() {
  console.log('🔍 Testing Appwrite document structure vs schema expectations...\n');

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

  const databases = new Databases(client);

  try {
    // Test 1: Get a raw student document and inspect its structure
    console.log('Test 1: Raw student document structure');
    console.log('='*50);

    const studentsResult = await databases.listDocuments('default', 'students', [Query.limit(1)]);
    if (studentsResult.documents.length > 0) {
      const rawStudent = studentsResult.documents[0];
      console.log('Raw student document keys:', Object.keys(rawStudent));
      console.log('Raw student sample:', JSON.stringify({
        $id: rawStudent.$id,
        $createdAt: rawStudent.$createdAt,
        $updatedAt: rawStudent.$updatedAt,
        userId: rawStudent.userId,
        name: rawStudent.name,
        createdAt: rawStudent.createdAt, // Does this exist?
        updatedAt: rawStudent.updatedAt   // Does this exist?
      }, null, 2));

      // Test validateCollection with raw document
      console.log('\nTesting validateCollection with raw document...');
      try {
        const validatedStudent = validateCollection('students', rawStudent);
        console.log('✅ validateCollection succeeded');
        console.log('Validated student keys:', Object.keys(validatedStudent));
      } catch (error) {
        console.log('❌ validateCollection failed:', error.message);
      }

      // Test transformAppwriteDocument with StudentSchema
      console.log('\nTesting transformAppwriteDocument with StudentSchema...');
      try {
        const transformedStudent = transformAppwriteDocument(rawStudent, StudentSchema);
        console.log('✅ transformAppwriteDocument succeeded');
        console.log('Transformed student keys:', Object.keys(transformedStudent));
      } catch (error) {
        console.log('❌ transformAppwriteDocument failed:', error.message);
      }

      console.log('\n' + '='.repeat(50) + '\n');
    }

    // Test 2: Get a raw lesson template document
    console.log('Test 2: Raw lesson template document structure');
    console.log('='*50);

    const templatesResult = await databases.listDocuments('default', 'lesson_templates', [Query.limit(1)]);
    if (templatesResult.documents.length > 0) {
      const rawTemplate = templatesResult.documents[0];
      console.log('Raw template document keys:', Object.keys(rawTemplate));

      // Test validateCollection with raw document
      console.log('\nTesting validateCollection with raw template...');
      try {
        const validatedTemplate = validateCollection('lesson_templates', rawTemplate);
        console.log('✅ validateCollection succeeded');
      } catch (error) {
        console.log('❌ validateCollection failed:', error.message);
      }

      // Test transformAppwriteDocument with LessonTemplateSchema
      console.log('\nTesting transformAppwriteDocument with LessonTemplateSchema...');
      try {
        const transformedTemplate = transformAppwriteDocument(rawTemplate, LessonTemplateSchema);
        console.log('✅ transformAppwriteDocument succeeded');
      } catch (error) {
        console.log('❌ transformAppwriteDocument failed:', error.message);
      }

      console.log('\n' + '='.repeat(50) + '\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// This function will be called when the file is imported
testDocumentStructure().catch(console.error);