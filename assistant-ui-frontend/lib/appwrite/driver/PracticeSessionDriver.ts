import { Query, ID } from 'appwrite';
import { BaseDriver } from './BaseDriver';

/**
 * TypeScript interfaces matching Python PracticeSession data model
 * from langgraph-agent/src/agent/practice_session.py
 */

export interface ConceptBlock {
  block_id: string;
  block_index: number;
  title: string;
  explanation: string;
  worked_example: Record<string, unknown>;
  key_skills: string[];
  prerequisite_blocks: string[];
  source_refs: string[];
}

export interface BlockProgress {
  block_id: string;
  current_difficulty: 'easy' | 'medium' | 'hard';
  questions_attempted: { easy: number; medium: number; hard: number };
  questions_correct: { easy: number; medium: number; hard: number };
  mastery_score: number;
  is_complete: boolean;
  started_at: string | null;
  completed_at: string | null;
}

export interface AdaptiveThresholds {
  advance: number;
  demote: number;
}

export interface PracticeSession {
  // Identity
  session_id: string;
  student_id: string;

  // Source metadata (input-agnostic)
  source_type: string;
  source_id: string;
  source_title: string;
  source_metadata: Record<string, unknown>;

  // Extracted content
  blocks: ConceptBlock[];
  total_blocks: number;

  // Session state
  status: 'active' | 'paused' | 'completed';
  current_block_index: number;
  blocks_progress: BlockProgress[];

  // Difficulty settings
  difficulty_mode: 'adaptive' | 'fixed';
  fixed_difficulty: 'easy' | 'medium' | 'hard' | null;
  adaptive_threshold: number;

  // Current question state (for resume)
  current_question: Record<string, unknown> | null;
  awaiting_response: boolean;

  // Timing
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  total_time_seconds: number;

  // Aggregates
  total_questions_attempted: number;
  total_questions_correct: number;
  overall_mastery: number;
}

/**
 * Appwrite document shape for practice_sessions collection
 * Fields are stored as JSON strings for complex nested structures
 */
interface PracticeSessionDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  session_id: string;
  student_id: string;
  source_type: string;
  source_id: string;
  source_title: string;
  source_metadata: string; // JSON stringified
  blocks: string; // JSON stringified
  total_blocks: number;
  status: 'active' | 'paused' | 'completed';
  current_block_index: number;
  blocks_progress: string; // JSON stringified
  difficulty_mode: 'adaptive' | 'fixed';
  fixed_difficulty: string | null;
  adaptive_threshold: number;
  current_question: string | null; // JSON stringified
  awaiting_response: boolean;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  total_time_seconds: number;
  total_questions_attempted: number;
  total_questions_correct: number;
  overall_mastery: number;
}

/**
 * Progress update data from backend (subset of full session)
 */
export interface PracticeSessionProgressUpdate {
  current_block_index?: number;
  blocks_progress?: BlockProgress[];
  current_question?: Record<string, unknown> | null;
  awaiting_response?: boolean;
  total_questions_attempted?: number;
  total_questions_correct?: number;
  overall_mastery?: number;
  status?: 'active' | 'paused' | 'completed';
  last_activity_at?: string;
  total_time_seconds?: number;
}

const COLLECTION_ID = 'practice_sessions';

/**
 * PracticeSessionDriver - Frontend CRUD operations for infinite practice sessions
 *
 * This driver implements the frontend-driven persistence pattern where:
 * - Frontend checks for existing active sessions before starting graph
 * - Frontend creates new sessions when needed
 * - Frontend updates session progress when backend signals changes
 * - Backend remains stateless (no Appwrite access)
 */
export class PracticeSessionDriver extends BaseDriver {
  /**
   * Check for an active practice session for a student and source
   * Returns the session if found, null otherwise
   *
   * @param studentId - Student document ID
   * @param sourceId - Source document ID (e.g., lesson template ID)
   * @param sourceType - Type of source (default: 'lesson_template')
   */
  async checkActiveSession(
    studentId: string,
    sourceId: string,
    sourceType: string = 'lesson_template'
  ): Promise<PracticeSession | null> {
    try {
      console.log('[PracticeSessionDriver] Checking for active session:', {
        studentId,
        sourceId,
        sourceType
      });

      const records = await this.list<PracticeSessionDocument>(COLLECTION_ID, [
        Query.equal('student_id', studentId),
        Query.equal('source_id', sourceId),
        Query.equal('source_type', sourceType),
        Query.equal('status', 'active'),
        Query.orderDesc('last_activity_at'),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        console.log('[PracticeSessionDriver] No active session found');
        return null;
      }

      const session = this.documentToSession(records[0]);
      console.log('[PracticeSessionDriver] Found active session:', session.session_id);
      return session;
    } catch (error) {
      throw this.handleError(error, 'check active session');
    }
  }

  /**
   * Create a new practice session
   *
   * @param sessionData - Full PracticeSession data
   */
  async createSession(sessionData: PracticeSession): Promise<PracticeSession> {
    try {
      console.log('[PracticeSessionDriver] Creating new session:', {
        session_id: sessionData.session_id,
        student_id: sessionData.student_id,
        source_id: sessionData.source_id
      });

      const docData = this.sessionToDocument(sessionData);
      const created = await this.create<PracticeSessionDocument>(
        COLLECTION_ID,
        docData
      );

      console.log('[PracticeSessionDriver] Session created with doc ID:', created.$id);
      return this.documentToSession(created);
    } catch (error) {
      throw this.handleError(error, 'create session');
    }
  }

  /**
   * Get a practice session by session_id
   *
   * @param sessionId - The unique session identifier
   */
  async getSession(sessionId: string): Promise<PracticeSession | null> {
    try {
      console.log('[PracticeSessionDriver] Getting session:', sessionId);

      const records = await this.list<PracticeSessionDocument>(COLLECTION_ID, [
        Query.equal('session_id', sessionId),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        console.log('[PracticeSessionDriver] Session not found:', sessionId);
        return null;
      }

      return this.documentToSession(records[0]);
    } catch (error) {
      throw this.handleError(error, 'get session');
    }
  }

  /**
   * Update session progress after backend signals changes
   *
   * @param sessionId - The unique session identifier
   * @param progressData - Partial progress update data
   */
  async updateSessionProgress(
    sessionId: string,
    progressData: PracticeSessionProgressUpdate
  ): Promise<PracticeSession> {
    try {
      console.log('[PracticeSessionDriver] Updating session progress:', {
        sessionId,
        hasBlocksProgress: !!progressData.blocks_progress,
        newStatus: progressData.status
      });

      // Find the document by session_id
      const records = await this.list<PracticeSessionDocument>(COLLECTION_ID, [
        Query.equal('session_id', sessionId),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const docId = records[0].$id;

      // Build update payload, serializing complex fields
      const updatePayload: Partial<PracticeSessionDocument> = {
        updated_at: new Date().toISOString()
      };

      if (progressData.current_block_index !== undefined) {
        updatePayload.current_block_index = progressData.current_block_index;
      }
      if (progressData.blocks_progress !== undefined) {
        updatePayload.blocks_progress = JSON.stringify(progressData.blocks_progress);
      }
      if (progressData.current_question !== undefined) {
        updatePayload.current_question = progressData.current_question
          ? JSON.stringify(progressData.current_question)
          : null;
      }
      if (progressData.awaiting_response !== undefined) {
        updatePayload.awaiting_response = progressData.awaiting_response;
      }
      if (progressData.total_questions_attempted !== undefined) {
        updatePayload.total_questions_attempted = progressData.total_questions_attempted;
      }
      if (progressData.total_questions_correct !== undefined) {
        updatePayload.total_questions_correct = progressData.total_questions_correct;
      }
      if (progressData.overall_mastery !== undefined) {
        updatePayload.overall_mastery = progressData.overall_mastery;
      }
      if (progressData.status !== undefined) {
        updatePayload.status = progressData.status;
      }
      if (progressData.last_activity_at !== undefined) {
        updatePayload.last_activity_at = progressData.last_activity_at;
      }
      if (progressData.total_time_seconds !== undefined) {
        updatePayload.total_time_seconds = progressData.total_time_seconds;
      }

      const updated = await this.update<PracticeSessionDocument>(
        COLLECTION_ID,
        docId,
        updatePayload
      );

      console.log('[PracticeSessionDriver] Session updated successfully');
      return this.documentToSession(updated);
    } catch (error) {
      throw this.handleError(error, 'update session progress');
    }
  }

  /**
   * Pause an active session
   *
   * @param sessionId - The unique session identifier
   */
  async pauseSession(sessionId: string): Promise<PracticeSession> {
    return this.updateSessionProgress(sessionId, {
      status: 'paused',
      last_activity_at: new Date().toISOString()
    });
  }

  /**
   * Resume a paused session
   *
   * @param sessionId - The unique session identifier
   */
  async resumeSession(sessionId: string): Promise<PracticeSession> {
    return this.updateSessionProgress(sessionId, {
      status: 'active',
      last_activity_at: new Date().toISOString()
    });
  }

  /**
   * Complete a session
   *
   * @param sessionId - The unique session identifier
   * @param finalData - Optional final progress data
   */
  async completeSession(
    sessionId: string,
    finalData?: Partial<PracticeSessionProgressUpdate>
  ): Promise<PracticeSession> {
    return this.updateSessionProgress(sessionId, {
      ...finalData,
      status: 'completed',
      last_activity_at: new Date().toISOString()
    });
  }

  /**
   * Get all sessions for a student (for history/dashboard)
   *
   * @param studentId - Student document ID
   * @param status - Optional filter by status
   * @param limit - Maximum number of sessions to return
   */
  async getStudentSessions(
    studentId: string,
    status?: 'active' | 'paused' | 'completed',
    limit: number = 20
  ): Promise<PracticeSession[]> {
    try {
      console.log('[PracticeSessionDriver] Getting student sessions:', {
        studentId,
        status,
        limit
      });

      const queries = [
        Query.equal('student_id', studentId),
        Query.orderDesc('last_activity_at'),
        Query.limit(limit)
      ];

      if (status) {
        queries.push(Query.equal('status', status));
      }

      const records = await this.list<PracticeSessionDocument>(COLLECTION_ID, queries);
      return records.map(doc => this.documentToSession(doc));
    } catch (error) {
      throw this.handleError(error, 'get student sessions');
    }
  }

  /**
   * Delete a session (for cleanup or testing)
   *
   * @param sessionId - The unique session identifier
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      console.log('[PracticeSessionDriver] Deleting session:', sessionId);

      const records = await this.list<PracticeSessionDocument>(COLLECTION_ID, [
        Query.equal('session_id', sessionId),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        console.log('[PracticeSessionDriver] Session not found for deletion:', sessionId);
        return;
      }

      await this.delete(COLLECTION_ID, records[0].$id);
      console.log('[PracticeSessionDriver] Session deleted successfully');
    } catch (error) {
      throw this.handleError(error, 'delete session');
    }
  }

  // === Private Helper Methods ===

  /**
   * Convert Appwrite document to PracticeSession object
   */
  private documentToSession(doc: PracticeSessionDocument): PracticeSession {
    return {
      session_id: doc.session_id,
      student_id: doc.student_id,
      source_type: doc.source_type,
      source_id: doc.source_id,
      source_title: doc.source_title,
      source_metadata: JSON.parse(doc.source_metadata || '{}'),
      blocks: JSON.parse(doc.blocks || '[]'),
      total_blocks: doc.total_blocks,
      status: doc.status,
      current_block_index: doc.current_block_index,
      blocks_progress: JSON.parse(doc.blocks_progress || '[]'),
      difficulty_mode: doc.difficulty_mode,
      fixed_difficulty: doc.fixed_difficulty as 'easy' | 'medium' | 'hard' | null,
      adaptive_threshold: doc.adaptive_threshold,
      current_question: doc.current_question ? JSON.parse(doc.current_question) : null,
      awaiting_response: doc.awaiting_response,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      last_activity_at: doc.last_activity_at,
      total_time_seconds: doc.total_time_seconds,
      total_questions_attempted: doc.total_questions_attempted,
      total_questions_correct: doc.total_questions_correct,
      overall_mastery: doc.overall_mastery
    };
  }

  /**
   * Convert PracticeSession object to Appwrite document format
   */
  private sessionToDocument(session: PracticeSession): Omit<PracticeSessionDocument, '$id' | '$createdAt' | '$updatedAt'> {
    return {
      session_id: session.session_id,
      student_id: session.student_id,
      source_type: session.source_type,
      source_id: session.source_id,
      source_title: session.source_title,
      source_metadata: JSON.stringify(session.source_metadata),
      blocks: JSON.stringify(session.blocks),
      total_blocks: session.total_blocks,
      status: session.status,
      current_block_index: session.current_block_index,
      blocks_progress: JSON.stringify(session.blocks_progress),
      difficulty_mode: session.difficulty_mode,
      fixed_difficulty: session.fixed_difficulty,
      adaptive_threshold: session.adaptive_threshold,
      current_question: session.current_question ? JSON.stringify(session.current_question) : null,
      awaiting_response: session.awaiting_response,
      created_at: session.created_at,
      updated_at: session.updated_at,
      last_activity_at: session.last_activity_at,
      total_time_seconds: session.total_time_seconds,
      total_questions_attempted: session.total_questions_attempted,
      total_questions_correct: session.total_questions_correct,
      overall_mastery: session.overall_mastery
    };
  }
}
