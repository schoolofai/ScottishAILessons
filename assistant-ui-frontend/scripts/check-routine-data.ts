import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

/**
 * Check if Routine data exists and inspect its contents
 */
async function checkRoutineData() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');

  const databases = new Databases(client);

  try {
    console.log('📋 Checking Routine collection for student/course...');

    // Find student by email
    const students = await databases.listDocuments('default', 'students', [
      Query.limit(1)
    ]);

    if (students.documents.length === 0) {
      console.error('❌ No student found');
      return;
    }

    const student = students.documents[0];
    console.log(`✅ Student found: ${student.$id}`);

    // Check routine for the active course
    const courseId = 'course_c84473'; // Application of Mathematics - National 3
    console.log(`🔍 Looking for Routine: studentId=${student.$id}, courseId=${courseId}`);

    const routines = await databases.listDocuments('default', 'routine', [
      Query.equal('studentId', student.$id),
      Query.equal('courseId', courseId)
    ]);

    if (routines.documents.length === 0) {
      console.error('❌ No Routine record found for this student/course');
      console.log('   This means Routine data was NOT persisted during lesson completion!');
      return;
    }

    const routine = routines.documents[0];
    console.log(`✅ Routine record found: ${routine.$id}`);
    console.log('');
    console.log('📊 Routine Data:');
    console.log(`   lastTaughtAt: ${routine.lastTaughtAt || 'NOT SET'}`);
    console.log(`   spacingPolicyVersion: ${routine.spacingPolicyVersion}`);
    console.log(`   schema_version: ${routine.schema_version}`);
    console.log('');

    // Parse and display dueAtByOutcome
    let dueAtByOutcome: { [key: string]: string } = {};
    try {
      dueAtByOutcome = JSON.parse(routine.dueAtByOutcome || '{}');
    } catch (e) {
      console.error('❌ Failed to parse dueAtByOutcome JSON');
      console.log(`   Raw value: ${routine.dueAtByOutcome}`);
      return;
    }

    const outcomeCount = Object.keys(dueAtByOutcome).length;
    console.log(`📅 Scheduled Outcomes: ${outcomeCount}`);
    console.log('');

    if (outcomeCount === 0) {
      console.error('❌ dueAtByOutcome is EMPTY!');
      console.log('   This means no outcomes were scheduled during lesson completion.');
      console.log('   Check the complete/route.ts logs for Routine update errors.');
      return;
    }

    // Check for overdue outcomes
    const now = new Date().toISOString();
    const overdueOutcomes: Array<{ outcomeId: string; dueAt: string; daysOverdue: number }> = [];
    const upcomingOutcomes: Array<{ outcomeId: string; dueAt: string; daysUntil: number }> = [];

    Object.entries(dueAtByOutcome).forEach(([outcomeId, dueAt]) => {
      const dueDate = new Date(dueAt);
      const nowDate = new Date(now);
      const diffMs = dueDate.getTime() - nowDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (dueAt <= now) {
        overdueOutcomes.push({
          outcomeId,
          dueAt,
          daysOverdue: Math.abs(diffDays)
        });
      } else {
        upcomingOutcomes.push({
          outcomeId,
          dueAt,
          daysUntil: diffDays
        });
      }
    });

    if (overdueOutcomes.length > 0) {
      console.log(`🔴 OVERDUE Outcomes: ${overdueOutcomes.length}`);
      overdueOutcomes
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, 10)
        .forEach(({ outcomeId, dueAt, daysOverdue }) => {
          console.log(`   ${outcomeId}: Due ${daysOverdue}d ago (${dueAt})`);
        });
      console.log('');
    } else {
      console.log('⚪ No overdue outcomes (all reviews are in the future)');
      console.log('');
    }

    if (upcomingOutcomes.length > 0) {
      console.log(`🟢 UPCOMING Outcomes: ${upcomingOutcomes.length}`);
      upcomingOutcomes
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 10)
        .forEach(({ outcomeId, dueAt, daysUntil }) => {
          console.log(`   ${outcomeId}: Due in ${daysUntil}d (${dueAt})`);
        });
    }

  } catch (error: any) {
    console.error('❌ Error checking routine data:', error.message);
    console.error('   Full error:', JSON.stringify(error, null, 2));
  }
}

checkRoutineData().catch(console.error);
