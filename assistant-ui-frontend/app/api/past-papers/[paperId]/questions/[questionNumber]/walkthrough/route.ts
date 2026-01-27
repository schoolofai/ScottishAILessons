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
import { parsePaperId } from '../../../../utils';

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
  /** @deprecated Diagrams now fetched directly from us_papers. Kept for backward compatibility. */
  diagram_refs?: string[];
}

interface PaperQuestion {
  number: string;
  text: string;
  text_latex: string;
  marks: number | null;
  has_parts: boolean;
  parts: QuestionPart[];
  topic_tags: string[];
  diagrams?: Diagram[];
}

interface QuestionPart {
  part: string;
  subpart: string | null;
  text: string;
  text_latex: string;
  marks: number;
  topic_tags: string[];
}

/**
 * Parse question number into components.
 * "1" -> { baseNumber: "1", part: null, subpart: null }
 * "4a" -> { baseNumber: "4", part: "a", subpart: null }
 * "5b(i)" -> { baseNumber: "5", part: "b", subpart: "i" }
 * "4a(1)" -> { baseNumber: "4", part: "a", subpart: "1" }  // Arabic numeral subparts
 * "4b(4)" -> { baseNumber: "4", part: "b", subpart: "4" }  // Arabic numeral subparts
 */
function parseQuestionNumber(questionNumber: string): {
  baseNumber: string;
  part: string | null;
  subpart: string | null;
} {
  // Pattern supports both Roman numerals (i, ii, iii, iv, v, vi, vii, viii, ix, x)
  // AND Arabic numerals (1, 2, 3, 4, etc.) for subparts
  const pattern = /^(\d+)([a-z])?(?:\(([ivx]+|\d+)\))?$/i;
  const match = questionNumber.match(pattern);

  if (!match) {
    return { baseNumber: questionNumber, part: null, subpart: null };
  }

  return {
    baseNumber: match[1],
    part: match[2]?.toLowerCase() || null,
    subpart: match[3]?.toLowerCase() || null
  };
}

/**
 * Find diagrams for a question directly from paper data.
 * Parts inherit parent question's diagrams (per paper_extractor.py:162).
 *
 * This replaces the old diagram_refs-based approach with direct lookup,
 * ensuring diagrams are always fresh from the source paper.
 */
function findQuestionDiagramsDirect(
  questions: Array<{ number: string; diagrams?: Diagram[] }>,
  questionNumber: string
): Diagram[] {
  const parsed = parseQuestionNumber(questionNumber);

  // Find parent question by base number
  const parentQuestion = questions.find(q => q.number === parsed.baseNumber);
  if (!parentQuestion) {
    return [];
  }

  return parentQuestion.diagrams || [];
}

/**
 * Find parent question context for multi-part questions.
 *
 * Multi-part questions (e.g., "4a", "5b(i)") have a parent question with main
 * context text that provides crucial setup information. The walkthrough generator
 * only stores the part-specific text, losing this parent context.
 *
 * This function finds the parent question and returns its text to be prepended
 * to the walkthrough's question_stem for complete context.
 *
 * @param questions - Array of questions from paper data
 * @param questionNumber - The question number (e.g., "4a", "5b(i)")
 * @returns Object with parent text and text_latex, or null if not a multi-part question
 */
function findParentQuestionContext(
  questions: PaperQuestion[],
  questionNumber: string
): { text: string; text_latex: string } | null {
  const parsed = parseQuestionNumber(questionNumber);

  // Not a multi-part question if no part letter
  if (!parsed.part) {
    return null;
  }

  // Find parent question by base number
  const parentQuestion = questions.find(q => q.number === parsed.baseNumber);
  if (!parentQuestion) {
    console.log(`[API] Parent question ${parsed.baseNumber} not found for ${questionNumber}`);
    return null;
  }

  // Only return context if parent has parts and has meaningful text
  if (!parentQuestion.has_parts) {
    return null;
  }

  // Check if parent text is substantive (not just whitespace or very short)
  const trimmedText = (parentQuestion.text || '').trim();
  if (trimmedText.length < 10) {
    // Parent text is too short to be meaningful context
    return null;
  }

  console.log(`[API] Found parent context for ${questionNumber}: ${trimmedText.substring(0, 50)}...`);

  return {
    text: parentQuestion.text,
    text_latex: parentQuestion.text_latex || parentQuestion.text
  };
}

/**
 * Prepend parent question context to walkthrough content.
 *
 * Modifies the walkthrough's question_stem and question_stem_latex to include
 * the parent question's context text, providing complete question information
 * for multi-part questions.
 */
function prependParentContext(
  content: WalkthroughContent,
  parentContext: { text: string; text_latex: string },
  questionNumber: string
): WalkthroughContent {
  const parsed = parseQuestionNumber(questionNumber);

  // Build the part label (e.g., "(a)", "(b)(i)")
  let partLabel = '';
  if (parsed.part) {
    partLabel = `(${parsed.part})`;
    if (parsed.subpart) {
      partLabel += `(${parsed.subpart})`;
    }
  }

  // Prepend parent context with clear separation
  // Format: "Parent context text\n\n(a) Part-specific text"
  const updatedStem = `${parentContext.text.trim()}\n\n**${partLabel}** ${content.question_stem}`;
  const updatedStemLatex = `${parentContext.text_latex.trim()}\n\n**${partLabel}** ${content.question_stem_latex}`;

  return {
    ...content,
    question_stem: updatedStem,
    question_stem_latex: updatedStemLatex
  };
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

    // Parse paperId to extract query components for paper lookup
    // paperId format: "subject-levelCode-year-paperCode" (e.g., "applications-of-mathematics-n5-2023-X844-75-01")
    let parsedPaper;
    try {
      parsedPaper = parsePaperId(paperId);
    } catch (parseError) {
      const err = parseError as Error;
      console.error(`[API] Failed to parse paperId: ${err.message}`);
      return NextResponse.json(
        { error: `Invalid paper ID format: ${paperId}`, statusCode: 400 },
        { status: 400 }
      );
    }

    const { subject, level, year, paperCode } = parsedPaper;
    console.log(`[API] Parsed paperId - subject: ${subject}, level: ${level}, year: ${year}, paperCode: ${paperCode}`);

    // First, resolve paperId to actual Appwrite document ID
    // Walkthroughs store the actual document ID in paper_id field, not the URL-formatted paperId
    const paperResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_PAPERS,
      [
        Query.equal('subject', subject),
        Query.equal('level', level),
        Query.equal('year', year),
        Query.equal('paper_code', paperCode),
        Query.limit(1)
      ]
    );

    if (paperResult.documents.length === 0) {
      console.log(`[API] Paper not found: subject=${subject}, level=${level}, year=${year}, paperCode=${paperCode}`);
      return NextResponse.json(
        { error: `Paper not found: ${paperId}`, statusCode: 404 },
        { status: 404 }
      );
    }

    const paperDoc = paperResult.documents[0];
    const actualPaperId = paperDoc.$id;
    console.log(`[API] Resolved paperId to actual document ID: ${actualPaperId}`);

    // Query for the walkthrough using actual document ID
    // Try both with and without Q prefix (some walkthroughs store "14b", others "Q14b")
    let result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_WALKTHROUGHS,
      [
        Query.equal('paper_id', actualPaperId),
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
          Query.equal('paper_id', actualPaperId),
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

    // Parse paper data once for both parent context and diagrams
    let paperData: { questions: PaperQuestion[] } | null = null;
    try {
      paperData = JSON.parse(paperDoc.data as string);
    } catch (parseError) {
      console.warn(`[API] Could not parse paper data:`, parseError);
    }

    // =========================================================================
    // MULTI-PART QUESTION FIX: Prepend parent question context
    // =========================================================================
    // For multi-part questions (e.g., "4a", "5b(i)"), the walkthrough only
    // contains the part-specific question text. The parent question's main
    // context (which often contains crucial setup information) is missing.
    //
    // This fix fetches the parent question text from the paper data and
    // prepends it to the walkthrough's question_stem for complete context.
    // =========================================================================
    if (paperData) {
      const parentContext = findParentQuestionContext(
        paperData.questions || [],
        decodedQuestionNumber
      );

      if (parentContext) {
        console.log(`[API] Prepending parent context for multi-part question ${decodedQuestionNumber}`);
        content = prependParentContext(content, parentContext, decodedQuestionNumber);
      }
    }

    // Fetch diagrams directly from source paper data using question number
    // This replaces the old diagram_refs approach - diagrams are always fetched fresh
    // Note: paperDoc was already fetched earlier when resolving paperId to actual document ID
    let diagrams: Diagram[] = [];
    if (paperData) {
      diagrams = findQuestionDiagramsDirect(paperData.questions || [], decodedQuestionNumber);
      diagrams = fixDiagramUrls(diagrams);
      console.log(`[API] Found ${diagrams.length} diagrams for Q${decodedQuestionNumber} (direct fetch)`);
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
