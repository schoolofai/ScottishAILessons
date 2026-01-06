import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";

const DATABASE_ID = "default";

/**
 * POST /api/mastery/reset-lesson
 * Clears mastery data for all outcomes in a specific lesson template.
 *
 * This is used when a student chooses to "Start Fresh" on a practice session,
 * allowing them to reset their learning history for that lesson's outcomes.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication
    const { account } = await createSessionClient();
    const user = await account.get();

    // 2. Get student record
    const { databases: adminDb } = await createAdminClient();
    const studentsResult = await adminDb.listDocuments(
      DATABASE_ID,
      "students",
      [Query.equal("userId", user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student record not found" },
        { status: 404 }
      );
    }

    const studentDoc = studentsResult.documents[0];

    // 3. Parse lesson_template_id from request body
    const body = await request.json();
    const { lesson_template_id } = body;

    if (!lesson_template_id) {
      return NextResponse.json(
        { error: "lesson_template_id is required" },
        { status: 400 }
      );
    }

    console.log("[API] Resetting mastery for lesson:", {
      lesson_template_id,
      student_id: studentDoc.$id,
    });

    // 4. Get lesson template to find outcome IDs and courseId
    const lessonTemplate = await adminDb.getDocument(
      DATABASE_ID,
      "lesson_templates",
      lesson_template_id
    );

    if (!lessonTemplate) {
      return NextResponse.json(
        { error: "Lesson template not found" },
        { status: 404 }
      );
    }

    const courseId = lessonTemplate.courseId;
    if (!courseId) {
      return NextResponse.json(
        { error: "Lesson template has no courseId" },
        { status: 400 }
      );
    }

    // 5. Extract outcome IDs from lesson cards
    const outcomeIds = extractOutcomeIdsFromLesson(lessonTemplate);

    if (outcomeIds.length === 0) {
      console.log("[API] No outcome IDs found in lesson template");
      return NextResponse.json({
        success: true,
        message: "No outcomes to reset",
        resetCount: 0,
      });
    }

    console.log("[API] Found outcome IDs to reset:", {
      count: outcomeIds.length,
      outcomeIds,
    });

    // 6. Get MasteryV2 record for student/course
    const masteryRecords = await adminDb.listDocuments(
      DATABASE_ID,
      "MasteryV2",
      [
        Query.equal("studentId", studentDoc.$id),
        Query.equal("courseId", courseId),
        Query.limit(1),
      ]
    );

    if (masteryRecords.documents.length === 0) {
      console.log("[API] No mastery record found - nothing to reset");
      return NextResponse.json({
        success: true,
        message: "No mastery record exists",
        resetCount: 0,
      });
    }

    const masteryDoc = masteryRecords.documents[0];
    const emaByOutcome = JSON.parse(masteryDoc.emaByOutcome || "{}");

    // 7. Remove specific outcome IDs from emaByOutcome
    let resetCount = 0;
    for (const outcomeId of outcomeIds) {
      if (outcomeId in emaByOutcome) {
        delete emaByOutcome[outcomeId];
        resetCount++;
      }
    }

    if (resetCount === 0) {
      console.log("[API] No matching outcomes found in mastery record");
      return NextResponse.json({
        success: true,
        message: "No matching outcomes to reset",
        resetCount: 0,
      });
    }

    // 8. Update the mastery record
    await adminDb.updateDocument(DATABASE_ID, "MasteryV2", masteryDoc.$id, {
      emaByOutcome: JSON.stringify(emaByOutcome),
      updatedAt: new Date().toISOString(),
    });

    console.log("[API] Mastery reset complete:", {
      resetCount,
      remainingOutcomes: Object.keys(emaByOutcome).length,
    });

    return NextResponse.json({
      success: true,
      message: `Reset mastery for ${resetCount} outcomes`,
      resetCount,
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    console.error("[API] /api/mastery/reset-lesson POST error:", err);

    if (err.message?.includes("No session found")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    if (err.code === 404 || err.message?.includes("not found")) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to reset mastery" },
      { status: 500 }
    );
  }
}

/**
 * Extract all unique outcome IDs from a lesson template's cards.
 * Cards are stored as a JSON string with an array of card objects,
 * each potentially having an outcomeRefs array.
 */
function extractOutcomeIdsFromLesson(lessonTemplate: {
  cards?: string;
  outcomeRefs?: string;
}): string[] {
  const outcomeIds = new Set<string>();

  // Method 1: Extract from lesson-level outcomeRefs (if present)
  if (lessonTemplate.outcomeRefs) {
    try {
      const lessonOutcomeRefs = JSON.parse(lessonTemplate.outcomeRefs);
      if (Array.isArray(lessonOutcomeRefs)) {
        for (const outcomeId of lessonOutcomeRefs) {
          if (typeof outcomeId === "string" && outcomeId.length > 0) {
            outcomeIds.add(outcomeId);
          }
        }
      }
    } catch {
      console.warn("[API] Failed to parse lesson outcomeRefs");
    }
  }

  // Method 2: Extract from individual cards' outcomeRefs
  if (lessonTemplate.cards) {
    try {
      const cards = JSON.parse(lessonTemplate.cards);
      if (Array.isArray(cards)) {
        for (const card of cards) {
          if (card.outcomeRefs && Array.isArray(card.outcomeRefs)) {
            for (const outcomeId of card.outcomeRefs) {
              if (typeof outcomeId === "string" && outcomeId.length > 0) {
                outcomeIds.add(outcomeId);
              }
            }
          }
        }
      }
    } catch {
      console.warn("[API] Failed to parse lesson cards");
    }
  }

  return Array.from(outcomeIds);
}
