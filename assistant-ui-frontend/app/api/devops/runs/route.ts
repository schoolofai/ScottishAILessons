/**
 * API Route: GET /api/devops/runs
 *
 * Fetches pipeline run data from checkpoint files.
 * This is a server-side route that reads from the filesystem.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Path to checkpoints directory relative to project root
const CHECKPOINTS_DIR = path.join(process.cwd(), '..', 'devops', 'checkpoints');

interface PipelineRun {
  run_id: string;
  pipeline: string;
  subject: string;
  level: string;
  course_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  updated_at?: string;
  last_completed_step?: string;
  next_step?: string;
  total_cost_usd: number;
  total_tokens: number;
  error?: string;
  steps_completed: number;
}

/**
 * GET /api/devops/runs
 *
 * Returns list of all pipeline runs sorted by start time (newest first)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const runs: PipelineRun[] = [];

    // Check if checkpoints directory exists
    try {
      await fs.access(CHECKPOINTS_DIR);
    } catch {
      // Directory doesn't exist yet - return empty array
      return NextResponse.json([]);
    }

    // Read all checkpoint directories
    const dirs = await fs.readdir(CHECKPOINTS_DIR);

    for (const dir of dirs) {
      const checkpointPath = path.join(CHECKPOINTS_DIR, dir, 'checkpoint.json');

      try {
        const content = await fs.readFile(checkpointPath, 'utf-8');
        const data = JSON.parse(content);

        runs.push({
          run_id: data.run_id,
          pipeline: data.pipeline || 'lessons',
          subject: data.subject,
          level: data.level,
          course_id: data.course_id,
          status: data.status,
          started_at: data.started_at,
          updated_at: data.updated_at,
          last_completed_step: data.last_completed_step,
          next_step: data.next_step,
          total_cost_usd: data.total_cost_usd || 0,
          total_tokens: data.total_tokens || 0,
          error: data.error,
          steps_completed: data.completed_steps?.length || 0
        });
      } catch (e) {
        // Skip invalid checkpoint files
        console.warn(`Skipping invalid checkpoint: ${checkpointPath}`, e);
      }
    }

    // Sort by started_at descending (newest first)
    runs.sort((a, b) => {
      const dateA = new Date(a.started_at || 0).getTime();
      const dateB = new Date(b.started_at || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error fetching pipeline runs:', error);
    return NextResponse.json(
      { error: 'Failed to load pipeline runs' },
      { status: 500 }
    );
  }
}
