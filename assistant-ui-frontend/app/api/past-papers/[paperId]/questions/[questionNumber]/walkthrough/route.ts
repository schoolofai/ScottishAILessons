/**
 * Walkthrough API Route
 *
 * GET /api/past-papers/[paperId]/questions/[questionNumber]/walkthrough
 * Returns the walkthrough content for a specific question
 *
 * Uses sqa_education database with us_walkthroughs collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { decompressJSON } from '@/lib/appwrite/utils/compression';

const DATABASE_ID = 'sqa_education';
const COLLECTION_PAPERS = 'us_papers';
const COLLECTION_WALKTHROUGHS = 'us_walkthroughs';

interface Diagram {
  id: string;
  type: string;
  description: string;
  file_id?: string;
  file_url?: string;
}

/**
 * Fix diagram URLs by appending project ID if missing.
 * Appwrite public bucket URLs require ?project=PROJECT_ID to work.
 */
function fixDiagramUrls(diagrams: Diagram[]): Diagram[] {
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  if (!projectId) {
    console.warn('[API] NEXT_PUBLIC_APPWRITE_PROJECT_ID not set, diagram URLs may not work');
    return diagrams;
  }

  return diagrams.map(diagram => {
    if (diagram.file_url && !diagram.file_url.includes('project=')) {
      // Append project ID to URL
      const separator = diagram.file_url.includes('?') ? '&' : '?';
      return {
        ...diagram,
        file_url: `${diagram.file_url}${separator}project=${projectId}`
      };
    }
    return diagram;
  });
}

interface WalkthroughStep {
  bullet: number;
  label: string;
  process: string;
  working: string;
  working_latex: string;
  marks_earned: number;
  examiner_notes?: string;
}

interface CommonError {
  error_type: 'notation' | 'calculation' | 'concept' | 'omission';
  description: string;
  why_marks_lost: string;
  prevention_tip: string;
}

interface WalkthroughContent {
  question_stem: string;
  question_stem_latex: string;
  topic_tags: string[];
  total_marks: number;
  steps: WalkthroughStep[];
  common_errors: CommonError[];
  examiner_summary: string;
  diagram_refs: string[];
}

/**
 * Find diagrams for a question from paper data.
 * Handles part questions by looking up parent question's diagrams.
 */
function findQuestionDiagrams(
  questions: Array<{
    number: string;
    diagrams?: Diagram[];
    has_parts?: boolean;
    parts?: Array<{ part?: string; subpart?: string }>;
  }>,
  questionNumber: string,
  diagramRefs: string[]
): Diagram[] {
  if (!diagramRefs || diagramRefs.length === 0) {
    return [];
  }

  // Build a map of all diagrams across all questions
  const diagramMap = new Map<string, Diagram>();

  for (const q of questions) {
    if (q.diagrams) {
      for (const d of q.diagrams) {
        diagramMap.set(d.id, d);
      }
    }
  }

  // Look up diagrams by their refs
  const diagrams: Diagram[] = [];
  for (const ref of diagramRefs) {
    const diagram = diagramMap.get(ref);
    if (diagram) {
      diagrams.push(diagram);
    }
  }

  return diagrams;
}

/**
 * GET /api/past-papers/[paperId]/questions/[questionNumber]/walkthrough
 * Returns walkthrough content for a question
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string; questionNumber: string }> }
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

    const { paperId, questionNumber } = await params;

    // Validate parameters
    if (!paperId || paperId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Paper ID is required', statusCode: 400 },
        { status: 400 }
      );
    }

    if (!questionNumber || questionNumber.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question number is required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Decode question number (URL-encoded, e.g., "4a" or "5b%28i%29")
    const decodedQuestionNumber = decodeURIComponent(questionNumber);

    // Get admin client for database access
    const { databases } = await createAdminClient();

    console.log(`[API] Fetching walkthrough: ${paperId} Q${decodedQuestionNumber}`);

    // Query for the walkthrough - try both with and without Q prefix
    // Some walkthroughs store question_number as "14b", others as "Q14b"
    let result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_WALKTHROUGHS,
      [
        Query.equal('paper_id', paperId),
        Query.equal('question_number', decodedQuestionNumber),
        Query.equal('status', 'published')
      ]
    );

    // If not found, try with Q prefix
    if (result.documents.length === 0) {
      const withQPrefix = `Q${decodedQuestionNumber}`;
      console.log(`[API] Trying with Q prefix: ${withQPrefix}`);
      result = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_WALKTHROUGHS,
        [
          Query.equal('paper_id', paperId),
          Query.equal('question_number', withQPrefix),
          Query.equal('status', 'published')
        ]
      );
    }

    // Check if walkthrough exists
    if (result.documents.length === 0) {
      console.log(`[API] No walkthrough found for ${paperId} Q${decodedQuestionNumber}`);

      // Return "not_generated" status instead of 404
      // This allows frontend to show appropriate UI
      return NextResponse.json({
        success: true,
        status: 'not_generated',
        paperId,
        questionNumber: decodedQuestionNumber,
        message: 'Walkthrough has not been generated for this question yet'
      });
    }

    const document = result.documents[0];

    // Decompress walkthrough content
    let content: WalkthroughContent;
    try {
      const decompressed = decompressJSON<WalkthroughContent>(
        document.walkthrough_content as string
      );

      if (!decompressed) {
        throw new Error('Decompression returned null');
      }

      content = decompressed;
    } catch (decompressError) {
      console.error(`[API] Failed to decompress walkthrough:`, decompressError);

      return NextResponse.json(
        { error: 'Failed to decompress walkthrough content', statusCode: 500 },
        { status: 500 }
      );
    }

    console.log(`[API] Retrieved walkthrough with ${content.steps.length} steps`);

    // Fetch diagrams from source paper if diagram_refs exist
    let diagrams: Diagram[] = [];
    if (content.diagram_refs && content.diagram_refs.length > 0) {
      try {
        const paperDoc = await databases.getDocument(
          DATABASE_ID,
          COLLECTION_PAPERS,
          paperId
        );

        const paperData = JSON.parse(paperDoc.data as string);
        diagrams = findQuestionDiagrams(
          paperData.questions || [],
          decodedQuestionNumber,
          content.diagram_refs
        );

        console.log(`[API] Found ${diagrams.length} diagrams for Q${decodedQuestionNumber}`);

        // Fix diagram URLs by appending project ID
        diagrams = fixDiagramUrls(diagrams);
      } catch (paperError) {
        // Log but don't fail - diagrams are optional enhancement
        console.warn(`[API] Could not fetch paper for diagrams:`, paperError);
      }
    }

    // Return the walkthrough with full diagram objects
    return NextResponse.json({
      success: true,
      status: 'published',
      walkthrough: {
        documentId: document.$id,
        paperId: document.paper_id,
        questionNumber: document.question_number,
        paperCode: document.paper_code,
        year: document.year,
        subject: document.subject,
        level: document.level,
        marks: document.marks,
        content,
        diagrams,  // Full diagram objects with fixed file_url
        modelVersion: document.model_version,
        catalogVersion: document.catalog_version
      }
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API] /api/past-papers/.../walkthrough GET error:', err);

    return NextResponse.json(
      { error: err.message || 'Failed to get walkthrough', statusCode: 500 },
      { status: 500 }
    );
  }
}
