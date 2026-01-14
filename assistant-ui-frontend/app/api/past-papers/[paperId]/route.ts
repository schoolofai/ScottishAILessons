/**
 * Single Paper API Route
 *
 * GET /api/past-papers/[paperId] - Returns paper metadata and questions list
 *
 * Uses sqa_education database (not default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

const DATABASE_ID = 'sqa_education';
const COLLECTION_PAPERS = 'us_papers';
const COLLECTION_WALKTHROUGHS = 'us_walkthroughs';

interface QuestionListItem {
  number: string;
  marks: number;
  topicTags: string[];
  hasSolution: boolean;
  hasWalkthrough: boolean;
}

interface PaperResponse {
  paperId: string;
  subject: string;
  level: string;
  year: number;
  paperCode: string;
  totalMarks: number;
  durationMinutes: number;
  calculatorAllowed: boolean;
  questions: QuestionListItem[];
}

/**
 * GET /api/past-papers/[paperId]
 * Returns paper metadata and questions list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    // Validate user is authenticated
    try {
      const sessionClient = await createSessionClient();
      const account = sessionClient.account;
      await account.get();
    } catch {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.', statusCode: 401 },
        { status: 401 }
      );
    }

    const { paperId } = await params;

    // Validate paperId
    if (!paperId || paperId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Paper ID is required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Get admin client for database access
    const { databases } = await createAdminClient();

    console.log(`[API] Fetching paper: ${paperId}`);

    // Fetch paper document
    let document;
    try {
      document = await databases.getDocument(
        DATABASE_ID,
        COLLECTION_PAPERS,
        paperId
      );
    } catch (fetchError: unknown) {
      const err = fetchError as Error & { code?: number };
      if (err.code === 404 || err.message?.includes('not found')) {
        return NextResponse.json(
          { error: `Paper not found: ${paperId}`, statusCode: 404 },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Parse the data field
    let paperData;
    try {
      paperData = JSON.parse(document.data as string);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse paper data', statusCode: 500 },
        { status: 500 }
      );
    }

    // Query walkthroughs for this paper to determine which questions have them
    const walkthroughDocs = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_WALKTHROUGHS,
      [
        Query.equal('paper_id', paperId),
        Query.equal('status', 'published'),
        Query.select(['question_number'])  // Only need question numbers for efficiency
      ]
    );

    // Build a Set of question numbers that have published walkthroughs
    // Normalize by stripping 'Q' prefix (some walkthroughs have 'Q14b', others have '14b')
    const walkthroughQuestions = new Set(
      walkthroughDocs.documents.map(d => {
        const qNum = d.question_number as string;
        return qNum.replace(/^Q/i, ''); // Strip leading Q/q prefix
      })
    );

    console.log(`[API] Found ${walkthroughQuestions.size} walkthroughs for paper ${paperId}`);

    // Extract questions list
    const questions: QuestionListItem[] = [];

    for (const q of paperData.questions || []) {
      if (q.has_parts && q.parts) {
        // Add each part as a separate entry
        for (const part of q.parts) {
          const partNumber = part.subpart
            ? `${q.number}${part.part}(${part.subpart})`
            : `${q.number}${part.part}`;

          questions.push({
            number: partNumber,
            marks: part.marks || 0,
            topicTags: part.topic_tags || q.topic_tags || [],
            hasSolution: !!part.solution,
            hasWalkthrough: walkthroughQuestions.has(partNumber)
          });
        }
      } else {
        questions.push({
          number: q.number,
          marks: q.marks || 0,
          topicTags: q.topic_tags || [],
          hasSolution: !!q.solution,
          hasWalkthrough: walkthroughQuestions.has(String(q.number))
        });
      }
    }

    // Build response
    const response: PaperResponse = {
      paperId: document.$id,
      subject: document.subject as string,
      level: document.level as string,
      year: document.year as number,
      paperCode: document.paper_code as string,
      totalMarks: document.total_marks as number,
      durationMinutes: document.duration_minutes as number,
      calculatorAllowed: document.calculator_allowed as boolean,
      questions
    };

    console.log(`[API] Retrieved paper ${paperId} with ${questions.length} questions`);

    return NextResponse.json({
      success: true,
      paper: response
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API] /api/past-papers/[paperId] GET error:', err);

    return NextResponse.json(
      { error: err.message || 'Failed to get paper', statusCode: 500 },
      { status: 500 }
    );
  }
}
