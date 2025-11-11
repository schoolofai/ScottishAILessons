import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { EvidenceDriver } from './EvidenceDriver';
import { decompressCards, compressJSON } from '../utils/compression';
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
   * Supports spaced repetition with sessionType tracking
   */
  async createSession(
    studentId: string,
    courseId: string,
    lessonTemplateId: string,
    sessionType?: 'initial' | 'review'
  ): Promise<Session> {
    try {
      const user = await this.getCurrentUser();

      // Auto-detect session type if not provided by checking for completed sessions
      let effectiveSessionType = sessionType;
      let reviewCount = 0;
      let originalCompletionDate: string | undefined;

      if (!effectiveSessionType) {
        // Query for completed sessions of this lesson
        const completedSessions = await this.list<Session>('sessions', [
          Query.equal('studentId', studentId),
          Query.equal('lessonTemplateId', lessonTemplateId),
          Query.equal('stage', 'done'),
          Query.orderDesc('$createdAt')
        ]);

        if (completedSessions.length > 0) {
          effectiveSessionType = 'review';
          reviewCount = completedSessions.length;
          originalCompletionDate = completedSessions[completedSessions.length - 1].endedAt ||
                                   completedSessions[completedSessions.length - 1].$createdAt;
        } else {
          effectiveSessionType = 'initial';
        }
      }

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
        cards: decompressCards(lessonTemplate.cards),  // Decompress cards with fallback
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
        lessonSnapshot: compressJSON(lessonSnapshot),
        sessionType: effectiveSessionType,
        reviewCount: effectiveSessionType === 'review' ? reviewCount : undefined,
        originalCompletionDate: effectiveSessionType === 'review' ? originalCompletionDate : undefined
      };

      console.log('[LessonDriver] Creating session:', {
        lessonTemplateId,
        sessionType: effectiveSessionType,
        reviewCount,
        isReview: effectiveSessionType === 'review'
      });

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
        lessonSnapshot: compressJSON(snapshot)
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

  /**
   * [ADMIN] Get lesson templates by courseId for admin review (all statuses)
   */
  async getTemplatesByCourseIdForAdmin(courseId: string): Promise<LessonTemplate[]> {
    if (!courseId || courseId.length === 0) {
      throw new Error('Course ID is required');
    }

    try {
      return await this.list<LessonTemplate>('lesson_templates', [
        Query.equal('courseId', courseId),
        Query.orderAsc('sow_order')
      ]);
    } catch (error) {
      throw this.handleError(error, `get templates by courseId for admin: ${courseId}`);
    }
  }

  /**
   * [ADMIN] Get lesson templates by authored_sow_id for admin review (SOW-specific templates)
   * Returns only lesson templates that were generated from this specific SOW
   * Replaces courseId-based filtering to ensure SOW lineage and model versioning
   */
  async getTemplatesByAuthoredSOWId(sowId: string): Promise<LessonTemplate[]> {
    if (!sowId || sowId.length === 0) {
      throw new Error('SOW ID is required');
    }

    try {
      return await this.list<LessonTemplate>('lesson_templates', [
        Query.equal('authored_sow_id', sowId),
        Query.orderAsc('sow_order')
      ]);
    } catch (error) {
      throw this.handleError(error, `get templates by authored_sow_id for admin: ${sowId}`);
    }
  }

  /**
   * [ADMIN] Publish a lesson template
   * Updates template status to published
   */
  async publishTemplate(templateId: string): Promise<void> {
    if (!templateId || templateId.length === 0) {
      throw new Error('Template ID is required for publishing');
    }

    try {
      await this.update<LessonTemplate>('lesson_templates', templateId, { status: 'published' });
    } catch (error) {
      throw this.handleError(error, `publish template ${templateId}`);
    }
  }

  /**
   * [ADMIN] Unpublish a lesson template
   * Reverts template status to draft
   * FAST FAIL: Throws error immediately if operation fails
   */
  async unpublishTemplate(templateId: string): Promise<void> {
    if (!templateId || templateId.length === 0) {
      throw new Error('Template ID is required for unpublishing');
    }

    try {
      await this.update<LessonTemplate>('lesson_templates', templateId, { status: 'draft' });
      console.info(`✅ Template ${templateId} unpublished successfully`);
    } catch (error) {
      console.error(`❌ Failed to unpublish template ${templateId}:`, error);
      throw this.handleError(error, `unpublish template ${templateId}`);
    }
  }

  /**
   * [ADMIN] Publish all lesson templates for a given SOW
   * Batch operation that publishes all templates associated with a SOW
   * FAST FAIL: Throws error if any operation fails
   *
   * @param sowId - The authored_sow_id to filter templates
   * @throws Error if no templates found or if any publish operation fails
   */
  async publishAllTemplatesForSOW(sowId: string): Promise<void> {
    if (!sowId || sowId.length === 0) {
      throw new Error('SOW ID is required for bulk publishing');
    }

    try {
      // Get all templates for this SOW
      const templates = await this.getTemplatesByAuthoredSOWId(sowId);

      if (templates.length === 0) {
        throw new Error(`No templates found for SOW ${sowId}`);
      }

      // Filter only non-published templates
      const unpublishedTemplates = templates.filter(t => t.status !== 'published');

      if (unpublishedTemplates.length === 0) {
        console.info(`ℹ️ All templates for SOW ${sowId} are already published`);
        return;
      }

      // Batch publish all unpublished templates
      const publishPromises = unpublishedTemplates.map(t => this.publishTemplate(t.$id));

      await Promise.all(publishPromises);

      console.info(`✅ Successfully published ${unpublishedTemplates.length} templates for SOW ${sowId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Bulk publish failed for SOW ${sowId}:`, errorMsg);
      throw new Error(`Bulk publish failed for SOW ${sowId}: ${errorMsg}`);
    }
  }

  /**
   * [ADMIN] Unpublish all lesson templates for a given SOW
   * Batch operation that reverts all templates to draft status
   * FAST FAIL: Throws error if any operation fails
   *
   * @param sowId - The authored_sow_id to filter templates
   * @throws Error if no templates found or if any unpublish operation fails
   */
  async unpublishAllTemplatesForSOW(sowId: string): Promise<void> {
    if (!sowId || sowId.length === 0) {
      throw new Error('SOW ID is required for bulk unpublishing');
    }

    try {
      // Get all templates for this SOW
      const templates = await this.getTemplatesByAuthoredSOWId(sowId);

      if (templates.length === 0) {
        throw new Error(`No templates found for SOW ${sowId}`);
      }

      // Filter only published templates
      const publishedTemplates = templates.filter(t => t.status === 'published');

      if (publishedTemplates.length === 0) {
        console.info(`ℹ️ No published templates found for SOW ${sowId}`);
        return;
      }

      // Batch unpublish all published templates
      const unpublishPromises = publishedTemplates.map(t => this.unpublishTemplate(t.$id));

      await Promise.all(unpublishPromises);

      console.info(`✅ Successfully unpublished ${publishedTemplates.length} templates for SOW ${sowId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Bulk unpublish failed for SOW ${sowId}:`, errorMsg);
      throw new Error(`Bulk unpublish failed for SOW ${sowId}: ${errorMsg}`);
    }
  }

  /**
   * [ADMIN] Update lesson template with new data
   * Validates card data if cards are being updated
   * Follows FAST FAIL pattern - throws exceptions immediately on errors
   *
   * @param templateId - The ID of the template to update
   * @param updates - Partial template data to update (e.g., { cards: compressedString })
   * @returns Updated lesson template
   * @throws Error if validation fails or update fails
   */
  async updateLessonTemplate(
    templateId: string,
    updates: Partial<LessonTemplate>
  ): Promise<LessonTemplate> {
    // Validate templateId
    if (!templateId || typeof templateId !== 'string' || templateId.trim().length === 0) {
      throw new Error('Valid templateId is required');
    }

    // Validate updates object
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    // If cards are being updated, validate compression format
    if (updates.cards !== undefined) {
      if (typeof updates.cards !== 'string') {
        throw new Error('Cards must be in compressed string format');
      }

      // Verify it's valid compressed data by attempting decompression
      try {
        const decompressed = decompressCards(updates.cards);
        if (!Array.isArray(decompressed)) {
          throw new Error('Decompressed cards must be an array');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid compressed cards data: ${errorMsg}`);
      }
    }

    try {
      // Perform update via BaseDriver
      const updatedTemplate = await this.update<LessonTemplate>(
        'lesson_templates',
        templateId,
        updates
      );

      console.log(`[LessonDriver] Template ${templateId} updated successfully`);
      return updatedTemplate;

    } catch (error) {
      // Fast fail with detailed error
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw this.handleError(
        error,
        `update lesson template ${templateId}: ${errorMsg}`
      );
    }
  }
}