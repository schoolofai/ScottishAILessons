/**
 * Debug script to understand Appwrite document structure
 */

// This script will help us understand the actual structure of Appwrite documents
// vs what our schemas expect

const { Client, Databases, Query } = require('appwrite');

async function debugAppwriteDocuments() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost:8080/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'your-project-id');

  const databases = new Databases(client);

  try {
    console.log('🔍 Debugging Appwrite document structures...\n');

    // Try to get a lesson template document
    console.log('📋 Fetching lesson templates...');
    const templatesResult = await databases.listDocuments(
      'default',
      'lesson_templates',
      [Query.limit(1)]
    );

    if (templatesResult.documents.length > 0) {
      const template = templatesResult.documents[0];
      console.log('Raw lesson template document:');
      console.log(JSON.stringify(template, null, 2));
      console.log('\nDocument keys:', Object.keys(template));
      console.log('\n' + '='.repeat(50) + '\n');
    }

    // Try to get a student document
    console.log('👨‍🎓 Fetching students...');
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.limit(1)]
    );

    if (studentsResult.documents.length > 0) {
      const student = studentsResult.documents[0];
      console.log('Raw student document:');
      console.log(JSON.stringify(student, null, 2));
      console.log('\nDocument keys:', Object.keys(student));
      console.log('\n' + '='.repeat(50) + '\n');
    }

    // Try to get a course document
    console.log('📚 Fetching courses...');
    const coursesResult = await databases.listDocuments(
      'default',
      'courses',
      [Query.limit(1)]
    );

    if (coursesResult.documents.length > 0) {
      const course = coursesResult.documents[0];
      console.log('Raw course document:');
      console.log(JSON.stringify(course, null, 2));
      console.log('\nDocument keys:', Object.keys(course));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Set up environment variables (you can set these in your shell or .env)
if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
  console.log('⚠️  No NEXT_PUBLIC_APPWRITE_ENDPOINT found, using default');
}

if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
  console.log('⚠️  No NEXT_PUBLIC_APPWRITE_PROJECT_ID found, this will likely fail');
}

debugAppwriteDocuments();