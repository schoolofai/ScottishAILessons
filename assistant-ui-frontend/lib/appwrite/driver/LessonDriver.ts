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
   * Create new lesson session
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
      
      // Create lesson snapshot - handle both seeded JSON strings and already parsed objects
      const lessonSnapshot: LessonSnapshot = {
        title: lessonTemplate.title,
        outcomeRefs: typeof lessonTemplate.outcomeRefs === 'string'
          ? JSON.parse(lessonTemplate.outcomeRefs)
          : lessonTemplate.outcomeRefs,
        cards: typeof lessonTemplate.cards === 'string'
          ? JSON.parse(lessonTemplate.cards)
          : lessonTemplate.cards,
        templateVersion: lessonTemplate.version
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