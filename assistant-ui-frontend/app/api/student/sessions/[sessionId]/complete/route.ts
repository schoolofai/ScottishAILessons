import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query, ID, Permission, Role } from "node-appwrite";

/**
 * POST /api/student/sessions/[sessionId]/complete
 *
 * Persist lesson completion data (Evidence + Mastery + Routine) server-side
 *
 * This replaces client-side drivers that broke after the auth migration.
 * Uses httpOnly cookies for authentication to ensure correct user permissions.
 *
 * Request body:
 * {
 *   evidence: Array<EvidenceData>,
 *   masteryUpdates: Array<MasteryUpdate>,
 *   routineUpdates: { [outcomeId: string]: number }  // EMA scores for spaced repetition
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Next.js 15: params must be awaited
    const { sessionId } = await params;

    // Get authenticated user using secure httpOnly cookie
    const { account, databases } = await createSessionClient();
    const user = await account.get();
    console.log(`[API] Lesson completion for session ${sessionId}, user ${user.$id}`);

    // Get student record
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];
    console.log(`[API] Student ID: ${student.$id}`);

    // ═══════════════════════════════════════════════════════════════
    // VERIFY SESSION OWNERSHIP (Fixed after removing row-level security)
    // ═══════════════════════════════════════════════════════════════
    // Now that sessions collection has documentSecurity: false, we can
    // properly verify session ownership without permission errors.
    //
    // Security model:
    // 1. User authenticated via httpOnly cookies (createSessionClient)
    // 2. Student record verified to belong to authenticated user
    // 3. Session verified to belong to this student
    // 4. All database operations use authenticated context
    // ═══════════════════════════════════════════════════════════════

    let session;
    try {
      session = await databases.getDocument(
        'default',
        'sessions',
        sessionId
      );
      console.log(`[API] Session found: ${session.$id}, studentId: ${session.studentId}`);
    } catch (error: any) {
      console.error(`[API] Failed to fetch session:`, error.message);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Verify session belongs to this student
    if (session.studentId !== student.$id) {
      console.error(`[API] Session ownership mismatch: ${session.studentId} !== ${student.$id}`);
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 403 }
      );
    }

    // Extract course ID from session for Evidence/Mastery/Routine operations
    const courseId = session.courseId;
    console.log(`[API] Session verified - Course: ${courseId}, Student: ${student.$id}`);

    // Parse request body
    const { evidence, masteryUpdates, routineUpdates, conversationHistory } = await request.json();

    console.log(`[API] Processing completion data:`, {
      evidenceCount: evidence?.length || 0,
      masteryUpdatesCount: masteryUpdates?.length || 0,
      routineOutcomes: routineUpdates ? Object.keys(routineUpdates).length : 0,
      conversationHistorySize: conversationHistory ? `${(conversationHistory.length / 1024).toFixed(2)} KB` : 'none'
    });

    // ═══════════════════════════════════════════════════════════════
    // 1. Create Evidence Records (Server-side with proper auth)
    // ═══════════════════════════════════════════════════════════════
    const createdEvidence = [];

    if (evidence && evidence.length > 0) {
      console.log(`[API] Creating ${evidence.length} Evidence records...`);

      for (const evidenceData of evidence) {
        try {
          console.log(`[API] Evidence data being created:`, JSON.stringify(evidenceData));

          const evidenceDoc = await databases.createDocument(
            'default',
            'evidence',
            ID.unique(),
            evidenceData,
            // No permissions needed - evidence has documentSecurity: false
            // But we're server-side so we have proper auth context
          );

          createdEvidence.push(evidenceDoc);
          console.log(`[API] Evidence created: ${evidenceDoc.$id}`);
        } catch (error: any) {
          console.error(`[API] Failed to create evidence record:`, error.message);
          console.error(`[API] Evidence data that failed:`, JSON.stringify(evidenceData));
          console.error(`[API] Full error:`, JSON.stringify(error, null, 2));
          throw error; // Don't silently fail
        }
      }

      console.log(`[API] ✅ Successfully created ${createdEvidence.length} Evidence records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. Update Mastery Records (EMA scores)
    // ═══════════════════════════════════════════════════════════════
    // MasteryV2 Schema: ONE document per student/course with ALL outcomes in emaByOutcome JSON
    // Format: { studentId, courseId, emaByOutcome: '{"O1": 0.75, "AS1.1": 0.82, ...}', updatedAt }
    // Unique index: [studentId, courseId]
    // ═══════════════════════════════════════════════════════════════
    let masteryDoc = null;

    if (masteryUpdates && masteryUpdates.length > 0) {
      console.log(`[API] Processing ${masteryUpdates.length} Mastery updates for MasteryV2...`);

      try {
        // 1. Fetch single MasteryV2 document for this student/course
        const masteryResult = await databases.listDocuments(
          'default',
          'MasteryV2',
          [
            Query.equal('studentId', student.$id),
            Query.equal('courseId', session.courseId),
            Query.limit(1)
          ]
        );

        // 2. Parse existing emaByOutcome JSON or start fresh
        let emaByOutcome: { [key: string]: number } = {};

        if (masteryResult.documents.length > 0) {
          const existingDoc = masteryResult.documents[0];
          try {
            emaByOutcome = JSON.parse(existingDoc.emaByOutcome || '{}');
            console.log(`[API] Found existing MasteryV2 document ${existingDoc.$id} with ${Object.keys(emaByOutcome).length} outcomes`);
          } catch (parseError) {
            console.warn(`[API] Failed to parse emaByOutcome, starting fresh:`, parseError);
            emaByOutcome = {};
          }
        } else {
          console.log(`[API] No existing MasteryV2 document found, will create new one`);
        }

        // 3. Update all outcomes in the JSON
        masteryUpdates.forEach(update => {
          const { outcomeId, newEMA } = update;
          emaByOutcome[outcomeId] = newEMA;
          console.log(`[API]   Updated outcome ${outcomeId}: EMA ${newEMA}`);
        });

        // 4. Save back as single document
        const updatedAt = new Date().toISOString();

        if (masteryResult.documents.length > 0) {
          // Update existing document
          const existingDoc = masteryResult.documents[0];
          masteryDoc = await databases.updateDocument(
            'default',
            'MasteryV2',
            existingDoc.$id,
            {
              emaByOutcome: JSON.stringify(emaByOutcome),
              updatedAt: updatedAt
            }
          );
          console.log(`[API] ✅ Updated MasteryV2 ${masteryDoc.$id} with ${Object.keys(emaByOutcome).length} total outcomes`);
        } else {
          // Create new document with permissions
          const permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id))
          ];

          masteryDoc = await databases.createDocument(
            'default',
            'MasteryV2',
            ID.unique(),
            {
              studentId: student.$id,
              courseId: session.courseId,
              emaByOutcome: JSON.stringify(emaByOutcome),
              updatedAt: updatedAt
            },
            permissions
          );
          console.log(`[API] ✅ Created MasteryV2 ${masteryDoc.$id} with ${Object.keys(emaByOutcome).length} outcomes`);
        }

      } catch (error: any) {
        console.error(`[API] Failed to update MasteryV2:`, error.message);
        console.error(`[API] Error details:`, JSON.stringify(error, null, 2));
        throw error; // Don't silently fail
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. Update Routine Records (Spaced Repetition Scheduling)
    // ═══════════════════════════════════════════════════════════════
    let routineDoc = null;

    if (routineUpdates && Object.keys(routineUpdates).length > 0) {
      console.log(`[API] Updating Routine for ${Object.keys(routineUpdates).length} outcomes...`);

      try {
        // Find existing routine
        const routineResult = await databases.listDocuments(
          'default',
          'routine',
          [
            Query.equal('studentId', student.$id),
            Query.equal('courseId', session.courseId)
          ]
        );

        // Calculate next due dates based on EMA scores
        const dueAtByOutcome: { [key: string]: string } = {};
        const now = new Date();

        for (const [outcomeId, emaScore] of Object.entries(routineUpdates)) {
          // Spaced repetition intervals based on mastery level
          let daysUntilReview: number;

          if (emaScore >= 0.8) {
            // Mastered: 7-14 days
            daysUntilReview = 7 + Math.floor(Math.random() * 7);
          } else if (emaScore >= 0.6) {
            // Good progress: 3-7 days
            daysUntilReview = 3 + Math.floor(Math.random() * 4);
          } else if (emaScore >= 0.4) {
            // Some progress: 1-3 days
            daysUntilReview = 1 + Math.floor(Math.random() * 2);
          } else {
            // Struggling: daily review
            daysUntilReview = 1;
          }

          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + daysUntilReview);
          dueAtByOutcome[outcomeId] = dueDate.toISOString();
        }

        if (routineResult.documents.length > 0) {
          // Update existing routine - merge with existing schedules
          const existing = routineResult.documents[0];
          const existingDueAts = JSON.parse(existing.dueAtByOutcome || '{}');
          const mergedDueAts = { ...existingDueAts, ...dueAtByOutcome };

          routineDoc = await databases.updateDocument(
            'default',
            'routine',
            existing.$id,
            { dueAtByOutcome: JSON.stringify(mergedDueAts) }
          );

          console.log(`[API] Updated Routine ${existing.$id} with ${Object.keys(dueAtByOutcome).length} schedules`);
        } else {
          // Create new routine with user permissions
          const permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id))
          ];

          routineDoc = await databases.createDocument(
            'default',
            'routine',
            ID.unique(),
            {
              studentId: student.$id,
              courseId: session.courseId,
              dueAtByOutcome: JSON.stringify(dueAtByOutcome)
            },
            permissions
          );

          console.log(`[API] Created Routine ${routineDoc.$id} with ${Object.keys(dueAtByOutcome).length} schedules`);
        }

        console.log(`[API] ✅ Successfully updated Routine record`);
      } catch (error: any) {
        console.error(`[API] Failed to update routine:`, error.message);
        throw error; // Don't silently fail
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. Update Session Status & Conversation History
    // ═══════════════════════════════════════════════════════════════
    try {
      // Build update data object
      const sessionUpdateData: any = {
        status: 'completed'
        // NOTE: completedAt field removed - not in sessions schema
        // The collection has startedAt but not completedAt
      };

      // Add conversation history if provided (already compressed by frontend)
      if (conversationHistory && conversationHistory.length > 0) {
        if (conversationHistory.length > 50000) {
          console.warn(`[API] ⚠️ Conversation history exceeds 50KB limit: ${(conversationHistory.length / 1024).toFixed(2)} KB - skipping`);
        } else {
          sessionUpdateData.conversationHistory = conversationHistory;
          console.log(`[API] Including conversation history in update (${(conversationHistory.length / 1024).toFixed(2)} KB)`);
        }
      }

      await databases.updateDocument(
        'default',
        'sessions',
        sessionId,
        sessionUpdateData
      );

      console.log(`[API] ✅ Session ${sessionId} marked as completed`);
      if (sessionUpdateData.conversationHistory) {
        console.log(`[API] ✅ Conversation history persisted server-side`);
      }
    } catch (error: any) {
      console.error(`[API] Failed to update session status:`, error.message);
      console.error(`[API] Error details:`, JSON.stringify(error, null, 2));
      // Don't throw - completion data is more critical than status update
    }

    // Return success response
    return NextResponse.json({
      success: true,
      summary: {
        evidenceCreated: createdEvidence.length,
        masteryUpdated: !!masteryDoc,
        masteryOutcomeCount: masteryUpdates?.length || 0,
        routineUpdated: !!routineDoc,
        conversationHistoryPersisted: !!conversationHistory,
        sessionId: sessionId
      }
    });

  } catch (error: any) {
    console.error('[API] /api/student/sessions/[sessionId]/complete POST error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle not found errors
    if (error.code === 404 || error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Handle permission errors
    if (error.message?.includes('authorized')) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          details: error.message
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to complete lesson",
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
