/**
 * API Route: GET /api/devops/runs/[runId]
 *
 * Fetches detailed information about a specific pipeline run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CHECKPOINTS_DIR = path.join(process.cwd(), '..', 'devops', 'checkpoints');

/**
 * GET /api/devops/runs/[runId]
 *
 * Returns full checkpoint data for a specific run
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
): Promise<NextResponse> {
  const { runId } = await params;

  try {
    const checkpointPath = path.join(CHECKPOINTS_DIR, runId, 'checkpoint.json');

    // Check if checkpoint exists
    try {
      await fs.access(checkpointPath);
    } catch {
      return NextResponse.json(
        { error: `Run not found: ${runId}` },
        { status: 404 }
      );
    }

    // Read checkpoint file
    const content = await fs.readFile(checkpointPath, 'utf-8');
    const data = JSON.parse(content);

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching run ${runId}:`, error);
    return NextResponse.json(
      { error: 'Failed to load run details' },
      { status: 500 }
    );
  }
}
