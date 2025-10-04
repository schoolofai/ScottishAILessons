import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { EvidenceDriver } from './EvidenceDriver';
import type {
  LessonTemplate,
  Session,
  LessonSnapshot,
  CreateSessionData
} from '../types';

/**
 * Lesson driver handling lesson templates, sessions, and lesson management
 */
export class LessonDriver extends BaseDriver {
  private evidenceDriver: EvidenceDriver;

  constructor(databases: any) {
    super(databases);
    this.evidenceDriver = new EvidenceDriver(databases);
  }
  /**
   * Get lesson template by ID
   */
  async getLessonTemplate(templateId: string): Promise<LessonTemplate> {
    try {
      return await this.get<LessonTemplate>('lesson_templates', templateId);
    } catch (error) {
      throw this.handleError(error, 'get lesson template');
    }
  }

  /**
   * Get all published lesson templates
   */
  async getPublishedTemplates(): Promise<LessonTemplate[]> {
    try {
      return await this.list<LessonTemplate>('lesson_templates', [
        Query.equal('status', 'published')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get published templates');
    }
  }

  /**
   * Get lesson templates for a specific course
   */
  async getTemplatesForCourse(courseId: string): Promise<LessonTemplate[]> {
    try {
      return await this.list<LessonTemplate>('lesson_templates', [
        Query.equal('courseId', courseId),
        Query.equal('status', 'published')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get templates for course');
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session> {
    try {
      return await this.get<Session>('sessions', sessionId);
    } catch (error) {
      throw this.handleError(error, 'get session');
    }
  }

  /**
   * Get parsed lesson snapshot from session
   */
  async getSessionWithSnapshot(sessionId: string): Promise<Session & { parsedSnapshot: LessonSnapshot }> {
    try {
      const session = await this.getSession(sessionId);
      const parsedSnapshot = JSON.parse(session.lessonSnapshot) as LessonSnapshot;
      
      return {
        ...session,
        parsedSnapshot
      };
    } catch (error) {
      throw this.handleError(error, 'get session with snapshot');
    }
  }

  /**
   * Create new lesson session - Phase 3.3 MVP2.5 enhanced with pedagogy fields
   */
  async createSession(
    studentId: string,
    courseId: string,
    lessonTemplateId: string
  ): Promise<Session> {
    try {
      const user = await this.getCurrentUser();

      // Get lesson template to create snapshot
      const lessonTemplate = await this.getLessonTemplate(lessonTemplateId);

      // Parse outcomeRefs - may contain assessmentStandards in Phase 3 format
      const parsedOutcomeRefs = this._parseJSON(lessonTemplate.outcomeRefs);
      const outcomeRefs = Array.isArray(parsedOutcomeRefs)
        ? parsedOutcomeRefs
        : parsedOutcomeRefs?.outcomes || parsedOutcomeRefs;
      const assessmentStandardRefs = parsedOutcomeRefs?.assessmentStandards;

      // Parse policy - contains calculator_section, assessment_notes, accessibility
      const policy = this._parseJSON(lessonTemplate.policy);

      // Create enhanced lesson snapshot with Phase 3 pedagogy fields
      const lessonSnapshot: LessonSnapshot = {
        title: lessonTemplate.title,
        outcomeRefs: outcomeRefs,
        assessmentStandardRefs: assessmentStandardRefs,
        cards: this._parseJSON(lessonTemplate.cards),
        templateVersion: lessonTemplate.version,
        courseId: courseId, // Add for teaching context
        lessonTemplateId: lessonTemplateId, // Add for teaching context

        // NEW FIELDS - Phase 3 MVP2.5
        lesson_type: lessonTemplate.lesson_type,
        estMinutes: lessonTemplate.estMinutes,
        engagement_tags: this._parseJSON(lessonTemplate.engagement_tags),
        policy: policy
      };

      const sessionData: CreateSessionData = {
        studentId,
        courseId,
        lessonTemplateId,
        stage: 'design',
        lessonSnapshot: JSON.stringify(lessonSnapshot)
      };

      const permissions = this.createUserPermissions(user.$id);
      return await this.create<Session>('sessions', sessionData, permissions);

    } catch (error) {
      throw this.handleError(error, 'create session');
    }
  }

  /**
   * Helper to safely parse JSON strings - Phase 3.3 MVP2.5
   */
  private _parseJSON(data: string | undefined | null): any {
    if (!data) return undefined;
    if (typeof data !== 'string') return data; // Already parsed
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn('[LessonDriver] Failed to parse JSON:', data);
      return undefined;
    }
  }

  /**
   * Update session stage
   */
  async updateSessionStage(sessionId: string, stage: string): Promise<Session> {
    try {
      return await this.update<Session>('sessions', sessionId, { stage });
    } catch (error) {
      throw this.handleError(error, 'update session stage');
    }
  }

  /**
   * Complete session (mark as ended)
   */
  async completeSession(sessionId: string): Promise<Session> {
    try {
      const updateData = {
        stage: 'completed',
        endedAt: new Date().toISOString()
      };
      
      return await this.update<Session>('sessions', sessionId, updateData);
    } catch (error) {
      throw this.handleError(error, 'complete session');
    }
  }

  /**
   * Get active sessions for a student
   */
  async getActiveSessions(studentId: string): Promise<Session[]> {
    try {
      return await this.list<Session>('sessions', [
        Query.equal('studentId', studentId),
        Query.isNull('endedAt')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get active sessions');
    }
  }

  /**
   * Get completed sessions for a student
   */
  async getCompletedSessions(studentId: string): Promise<Session[]> {
    try {
      return await this.list<Session>('sessions', [
        Query.equal('studentId', studentId),
        Query.isNotNull('endedAt')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get completed sessions');
    }
  }

  /**
   * Get session progress (current card index based on evidence count)
   */
  async getSessionProgress(sessionId: string): Promise<{ currentCard: number; totalCards: number }> {
    try {
      const session = await this.getSessionWithSnapshot(sessionId);
      const totalCards = session.parsedSnapshot.cards.length;
      
      // Get evidence count to determine current card using EvidenceDriver
      // This is a simplified version - in production you'd want more sophisticated progress tracking
      const evidenceCount = await this.evidenceDriver.getEvidenceCount(sessionId);

      const currentCard = Math.min(evidenceCount, totalCards - 1);
      
      return {
        currentCard,
        totalCards
      };
    } catch (error) {
      throw this.handleError(error, 'get session progress');
    }
  }

  /**
   * Update lesson snapshot (for dynamic lesson modifications)
   */
  async updateLessonSnapshot(sessionId: string, snapshot: LessonSnapshot): Promise<Session> {
    try {
      return await this.update<Session>('sessions', sessionId, {
        lessonSnapshot: JSON.stringify(snapshot)
      });
    } catch (error) {
      throw this.handleError(error, 'update lesson snapshot');
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.delete('sessions', sessionId);
    } catch (error) {
      throw this.handleError(error, 'delete session');
    }
  }
}