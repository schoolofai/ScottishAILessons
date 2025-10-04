import { BaseDriver } from '../appwrite/driver/BaseDriver';
import { LessonDriver } from '../appwrite/driver/LessonDriver';
import { MasteryV2Driver, MasteryV2Data } from '../appwrite/driver/MasteryV2Driver';
import { StudentDriver } from '../appwrite/driver/StudentDriver';
import { Query } from 'appwrite';
import { NextResponse } from 'next/server';
import { createApiHeaders } from '../middleware/auth';
import { CourseOutcome } from '../types/course-outcomes';

/**
 * CourseServiceV3 - Uses course_outcome document IDs as references
 *
 * This service properly handles the new data model where:
 * - course_outcomes collection is the source of truth for outcomes
 * - All references use document IDs instead of string-based codes
 * - MasteryV3 uses outcome document IDs as keys
 * - Lesson templates reference outcome document IDs
 */
export class CourseServiceV3 extends BaseDriver {
  private lessonDriver: LessonDriver;
  private masteryV2Driver: MasteryV2Driver;
  private studentDriver: StudentDriver;

  constructor(sessionToken: string) {
    super(sessionToken);
    this.lessonDriver = new LessonDriver(sessionToken);
    this.masteryV2Driver = new MasteryV2Driver(sessionToken);
    this.studentDriver = new StudentDriver(sessionToken);
  }

  /**
   * Get comprehensive course recommendations using V3 data model
   */
  async getCourseRecommendationsV3(courseId: string) {
    try {
      console.log('[CourseServiceV3] Getting recommendations for course:', courseId);

      // Step 1: Get current user and student
      const user = await this.getCurrentUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401, headers: createApiHeaders() }
        );
      }

      const student = await this.studentDriver.getStudentByUserId(user.$id);
      if (!student) {
        return NextResponse.json(
          { error: 'Student profile not found' },
          { status: 404, headers: createApiHeaders() }
        );
      }

      console.log('[CourseServiceV3] User and student found:', {
        userId: user.$id,
        studentId: student.$id,
        studentName: student.name
      });

      // Step 2: Validate course enrollment
      const isEnrolled = await this.validateCourseEnrollment(student.$id, courseId);
      if (!isEnrolled) {
        return NextResponse.json(
          { error: 'Student not enrolled in this course' },
          { status: 403, headers: createApiHeaders() }
        );
      }

      // Step 3: Build comprehensive context
      const context = await this.buildContextV3(student.$id, courseId);

      console.log('[CourseServiceV3] Context built successfully:', {
        hasContext: !!context,
        contextKeys: context ? Object.keys(context) : 'NONE'
      });

      return {
        success: true,
        context,
        student,
        user
      };

    } catch (error) {
      console.error('[CourseServiceV3] Failed to get recommendations:', error);
      return NextResponse.json(
        { error: 'Failed to get course recommendations', details: error.message },
        { status: 500, headers: createApiHeaders() }
      );
    }
  }

  /**
   * Validate that student is enrolled in the course
   */
  private async validateCourseEnrollment(studentId: string, courseId: string): Promise<boolean> {
    try {
      const student = await this.get('students', studentId);
      const enrolledCourses = Array.isArray(student.enrolledCourses)
        ? student.enrolledCourses
        : JSON.parse(student.enrolledCourses || '[]');

      return enrolledCourses.includes(courseId);
    } catch (error) {
      console.error('[CourseServiceV3] Error validating enrollment:', error);
      return false;
    }
  }

  /**
   * Build comprehensive context using V3 data model with document IDs
   */
  private async buildContextV3(studentId: string, courseId: string) {
    try {
      console.log('[CourseServiceV3] Building context V3 for:', { studentId, courseId });

      // Get course details
      const course = await this.getCourseDetails(courseId);

      // Get course outcomes (source of truth)
      const outcomes = await this.getCourseOutcomes(courseId);

      // Get lesson templates with outcome document ID references
      const templates = await this.getLessonTemplates(courseId);

      // Get mastery data using V3 driver (outcome document IDs as keys)
      const mastery = await this.masteryV2Driver.getMasteryV2(studentId, courseId);

      // Get routine data (outcome document IDs as keys)
      const routine = await this.getRoutineData(studentId, courseId);

      // Get scheme of work data
      const sow = await this.getSOWData(studentId, courseId);

      const context = {
        course,
        outcomes,
        templates,
        mastery,
        routine,
        sow,
        constraints: {
          maxBlockMinutes: 60,
          avoidRepeatWithinDays: 3,
          preferOverdue: true,
          preferLowEMA: true
        }
      };

      console.log('[CourseServiceV3] Context V3 built:', {
        hasCourse: !!context.course,
        outcomeCount: context.outcomes?.length || 0,
        templateCount: context.templates?.length || 0,
        hasMastery: !!context.mastery,
        masteryOutcomeCount: context.mastery ? Object.keys(context.mastery.emaByOutcomeId || {}).length : 0,
        hasRoutine: !!context.routine,
        routineOutcomeCount: context.routine ? Object.keys(context.routine.dueAtByOutcome || {}).length : 0,
        hasSOW: !!context.sow
      });

      return context;

    } catch (error) {
      console.error('[CourseServiceV3] Error building context:', error);
      throw error;
    }
  }

  /**
   * Get course details by courseId
   */
  private async getCourseDetails(courseId: string) {
    try {
      const courses = await this.list('courses', [
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (courses.length === 0) {
        throw new Error(`Course not found: ${courseId}`);
      }

      return courses[0];
    } catch (error) {
      console.error('[CourseServiceV3] Error getting course details:', error);
      throw error;
    }
  }

  /**
   * Get all course outcomes for a course (source of truth)
   * Returns outcomes in SQA-aligned structure with outcomeId and outcomeTitle
   */
  private async getCourseOutcomes(courseId: string): Promise<CourseOutcome[]> {
    try {
      console.log('[CourseServiceV3] Getting course outcomes for:', courseId);

      const outcomes = await this.list('course_outcomes', [
        Query.equal('courseId', courseId),
        Query.orderAsc('outcomeId')  // ✅ Sort by outcomeId (O1, O2, O3...)
      ]);

      console.log('[CourseServiceV3] Found course outcomes:', {
        count: outcomes.length,
        sampleOutcomes: outcomes.slice(0, 3).map(o => ({
          id: o.$id,
          outcomeId: o.outcomeId,        // ✅ NEW: e.g., "O1"
          outcomeTitle: o.outcomeTitle,  // ✅ NEW: Full title
          unitCode: o.unitCode            // ✅ NEW: e.g., "HV7Y 73"
        }))
      });

      return outcomes as CourseOutcome[];

    } catch (error) {
      console.error('[CourseServiceV3] Error getting course outcomes:', error);
      throw error;
    }
  }

  /**
   * Get lesson templates with proper outcome document ID references
   */
  private async getLessonTemplates(courseId: string) {
    try {
      console.log('[CourseServiceV3] Getting lesson templates for:', courseId);

      const templates = await this.list('lesson_templates', [
        Query.equal('courseId', courseId),
        Query.equal('status', 'published')
      ]);

      console.log('[CourseServiceV3] Found lesson templates:', {
        count: templates.length,
        sampleTemplate: templates[0] ? {
          id: templates[0].$id,
          title: templates[0].title,
          outcomeRefs: templates[0].outcomeRefs
        } : 'NONE'
      });

      return templates;

    } catch (error) {
      console.error('[CourseServiceV3] Error getting lesson templates:', error);
      throw error;
    }
  }

  /**
   * Get routine data with outcome document IDs as keys
   */
  private async getRoutineData(studentId: string, courseId: string) {
    try {
      console.log('[CourseServiceV3] Getting routine data for:', { studentId, courseId });

      const routines = await this.list('routine', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (routines.length === 0) {
        console.log('[CourseServiceV3] No routine data found');
        return null;
      }

      const routine = routines[0];

      // Parse JSON fields
      const dueAtByOutcome = JSON.parse(routine.dueAtByOutcome || '{}');
      const recentTemplateIds = JSON.parse(routine.recentTemplateIds || '[]');

      const routineData = {
        dueAtByOutcome,
        recentTemplateIds,
        lastTaughtAt: routine.lastTaughtAt,
        lastUpdated: routine.lastUpdated
      };

      console.log('[CourseServiceV3] Routine data found:', {
        dueOutcomeCount: Object.keys(dueAtByOutcome).length,
        recentTemplateCount: recentTemplateIds.length,
        lastTaughtAt: routine.lastTaughtAt
      });

      return routineData;

    } catch (error) {
      console.error('[CourseServiceV3] Error getting routine data:', error);
      return null;
    }
  }

  /**
   * Get scheme of work data
   */
  private async getSOWData(studentId: string, courseId: string) {
    try {
      console.log('[CourseServiceV3] Getting SOW data for:', { studentId, courseId });

      // Try SOWV2 first (student-specific)
      const sowEntries = await this.list('SOWV2', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.orderAsc('order')
      ]);

      if (sowEntries.length > 0) {
        console.log('[CourseServiceV3] Found SOWV2 entries:', sowEntries.length);
        return {
          entries: sowEntries
        };
      }

      // Fallback to generic SOW
      const genericSOW = await this.list('scheme_of_work', [
        Query.equal('courseId', courseId),
        Query.orderAsc('order')
      ]);

      console.log('[CourseServiceV3] Found generic SOW entries:', genericSOW.length);

      return {
        entries: genericSOW
      };

    } catch (error) {
      console.error('[CourseServiceV3] Error getting SOW data:', error);
      return null;
    }
  }

  /**
   * Save graph run ID for continuity
   */
  async saveGraphRunId(studentId: string, courseId: string, graphRunId: string) {
    try {
      console.log('[CourseServiceV3] Saving graph run ID:', { studentId, courseId, graphRunId });

      // Check if planner thread exists
      const existing = await this.list('planner_threads', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (existing.length > 0) {
        // Update existing record
        await this.update('planner_threads', existing[0].$id, {
          graphRunId,
          lastRecommendationAt: new Date().toISOString(),
          recommendationCount: (existing[0].recommendationCount || 0) + 1,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new record
        await this.create('planner_threads', {
          studentId,
          courseId,
          graphRunId,
          lastRecommendationAt: new Date().toISOString(),
          recommendationCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      console.log('[CourseServiceV3] Graph run ID saved successfully');

    } catch (error) {
      console.error('[CourseServiceV3] Error saving graph run ID:', error);
      // Don't throw - this is not critical
    }
  }
}