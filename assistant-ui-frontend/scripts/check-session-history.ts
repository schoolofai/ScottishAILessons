import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkSessionHistory() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');

  const databases = new Databases(client);

  try {
    const sessions = await databases.listDocuments('default', 'sessions', [
      Query.equal('studentId', '68d28c190016b1458092'),
      Query.equal('courseId', 'course_c84473'),
      Query.equal('status', 'completed'),
      Query.orderDesc('$createdAt'),
      Query.limit(10)
    ]);

    console.log(`📋 Last ${sessions.documents.length} completed sessions:`);
    console.log('');
    sessions.documents.forEach((session, i) => {
      const completedDate = new Date(session.$createdAt);
      const now = new Date();
      const daysAgo = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`  ${i+1}. Lesson: ${session.lessonTemplateId}`);
      console.log(`     Completed: ${session.$createdAt} (${daysAgo} days ago)`);
      console.log(`     startedAt: ${session.startedAt || 'NOT SET'}`);
      console.log('');
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkSessionHistory();
