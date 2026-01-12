/**
 * Past Papers API Routes
 *
 * GET /api/past-papers - List papers with optional filters
 * Query params: subject, level, year
 *
 * Uses sqa_education database (not default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

const DATABASE_ID = 'sqa_education';
const COLLECTION_PAPERS = 'us_papers';
const COLLECTION_WALKTHROUGHS = 'us_walkthroughs';

/**
 * Normalize subject from URL format to database format
 * e.g., "mathematics" → "Mathematics"
 */
function normalizeSubject(subject: string): string {
  if (!subject) return '';
  return subject
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize level from URL format to database format
 * e.g., "national-5" → "National 5"
 */
function normalizeLevel(level: string): string {
  if (!level) return '';
  return level
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * GET /api/past-papers
 * List past papers with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    // Validate user is authenticated
    let account;
    try {
      const sessionClient = await createSessionClient();
      account = sessionClient.account;
      await account.get();
    } catch {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.', statusCode: 401 },
        { status: 401 }
      );
    }

    // Get admin client for database access
    const { databases } = await createAdminClient();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const subjectParam = searchParams.get('subject');
    const levelParam = searchParams.get('level');
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : null;

    // Normalize subject and level from URL format to database format
    const subject = subjectParam ? normalizeSubject(subjectParam) : null;
    const level = levelParam ? normalizeLevel(levelParam) : null;

    // Build query
    const queries: string[] = [];

    if (subject) {
      queries.push(Query.equal('subject', subject));
    }
    if (level) {
      queries.push(Query.equal('level', level));
    }
    if (year && !isNaN(year)) {
      queries.push(Query.equal('year', year));
    }

    queries.push(Query.orderDesc('year'));
    queries.push(Query.limit(100));

    console.log('[API] Listing past papers:', { subject, level, year, rawSubject: subjectParam, rawLevel: levelParam });

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_PAPERS,
      queries
    );

    // Get paper IDs to query walkthroughs
    const paperIds = result.documents.map(doc => doc.$id);

    // Query all published walkthroughs for these papers (batch query for efficiency)
    const walkthroughQueries = [
      Query.equal('status', 'published'),
      Query.select(['paper_id']),  // Only need paper_id to check existence
      Query.limit(500)  // Reasonable limit for batch query
    ];

    // Only filter by paper_id if we have papers (avoid empty query)
    if (paperIds.length > 0) {
      walkthroughQueries.push(Query.equal('paper_id', paperIds));
    }

    const walkthroughResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_WALKTHROUGHS,
      walkthroughQueries
    );

    // Build a Set of paper IDs that have at least one published walkthrough
    const papersWithWalkthroughs = new Set(
      walkthroughResult.documents.map(d => d.paper_id as string)
    );

    console.log(`[API] Found walkthroughs for ${papersWithWalkthroughs.size} papers`);

    // Transform documents to frontend-friendly format
    const papers = result.documents.map((doc) => {
      // Parse data field to get question count
      let questionCount = 0;
      try {
        const paperData = JSON.parse(doc.data as string);
        questionCount = countQuestionsWithSolutions(paperData.questions || []);
      } catch {
        console.warn(`Failed to parse paper data for ${doc.$id}`);
      }

      return {
        paperId: doc.$id,
        subject: doc.subject,
        level: doc.level,
        year: doc.year,
        paperCode: doc.paper_code,
        totalMarks: doc.total_marks,
        questionCount,
        calculatorAllowed: doc.calculator_allowed,
        hasWalkthroughs: papersWithWalkthroughs.has(doc.$id)
      };
    });

    return NextResponse.json({
      success: true,
      papers,
      total: result.total
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API] /api/past-papers GET error:', err);

    return NextResponse.json(
      { error: err.message || 'Failed to list past papers', statusCode: 500 },
      { status: 500 }
    );
  }
}

/**
 * Count questions that have solutions (walkthroughs can be generated)
 */
function countQuestionsWithSolutions(questions: Array<{
  has_parts?: boolean;
  parts?: Array<{ solution?: unknown }>;
  solution?: unknown;
}>): number {
  let count = 0;

  for (const q of questions) {
    if (q.has_parts && q.parts) {
      for (const part of q.parts) {
        if (part.solution) {
          count++;
        }
      }
    } else if (q.solution) {
      count++;
    }
  }

  return count;
}
