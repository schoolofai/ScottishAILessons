/**
 * Past Papers Browse API Route
 *
 * GET /api/past-papers/browse - Returns hierarchical navigation structure
 * Structure: { subjects: [{ name, levels: [{ name, years: number[] }] }] }
 *
 * Uses sqa_education database (not default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

const DATABASE_ID = 'sqa_education';
const COLLECTION_PAPERS = 'us_papers';

interface SubjectLevel {
  name: string;
  years: number[];
}

interface SubjectNavigation {
  name: string;
  levels: SubjectLevel[];
}

/**
 * GET /api/past-papers/browse
 * Returns hierarchical navigation structure for browsing past papers
 */
export async function GET(request: NextRequest) {
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

    // Get admin client for database access
    const { databases } = await createAdminClient();

    console.log('[API] Fetching browse navigation structure');

    // Fetch all papers to build navigation structure
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_PAPERS,
      [
        Query.orderAsc('subject'),
        Query.orderAsc('level'),
        Query.limit(1000)  // Get all papers
      ]
    );

    // Build hierarchical structure
    const subjectMap = new Map<string, Map<string, Set<number>>>();

    for (const doc of result.documents) {
      const subject = doc.subject as string;
      const level = doc.level as string;
      const year = doc.year as number;

      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, new Map());
      }

      const levelMap = subjectMap.get(subject)!;
      if (!levelMap.has(level)) {
        levelMap.set(level, new Set());
      }

      levelMap.get(level)!.add(year);
    }

    // Convert to array structure
    const subjects: SubjectNavigation[] = [];

    for (const [subjectName, levelMap] of subjectMap) {
      const levels: SubjectLevel[] = [];

      for (const [levelName, yearsSet] of levelMap) {
        const years = Array.from(yearsSet).sort((a, b) => b - a); // Descending
        levels.push({ name: levelName, years });
      }

      // Sort levels by name
      levels.sort((a, b) => a.name.localeCompare(b.name));

      subjects.push({ name: subjectName, levels });
    }

    // Sort subjects by name
    subjects.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[API] Built navigation with ${subjects.length} subjects`);

    return NextResponse.json({
      success: true,
      subjects,
      total: result.total
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API] /api/past-papers/browse GET error:', err);

    return NextResponse.json(
      { error: err.message || 'Failed to get browse structure', statusCode: 500 },
      { status: 500 }
    );
  }
}
