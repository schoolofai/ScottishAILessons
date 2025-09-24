import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';

export interface RoutineData {
  studentId: string;
  courseId: string;
  lastTaughtAt?: string;
  dueAtByOutcome: { [outcomeId: string]: string };
  spacingPolicyVersion: number;
  schema_version: number;
}

export interface OutcomeSchedule {
  outcomeId: string;
  dueAt: string;
  isOverdue: boolean;
}

/**
 * Routine driver for spaced repetition scheduling
 */
export class RoutineDriver extends BaseDriver {
  /**
   * Get routine record for student/course
   */
  async getRoutineForCourse(studentId: string, courseId: string): Promise<RoutineData | null> {
    try {
      const records = await this.list('Routine', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]);

      if (records.length === 0) {
        return null;
      }

      const record = records[0];
      return {
        studentId: record.studentId,
        courseId: record.courseId,
        lastTaughtAt: record.lastTaughtAt,
        dueAtByOutcome: JSON.parse(record.dueAtByOutcome || '{}'),
        spacingPolicyVersion: record.spacingPolicyVersion || 1,
        schema_version: record.schema_version || 1
      };
    } catch (error) {
      throw this.handleError(error, 'get routine for course');
    }
  }

  /**
   * Upsert routine record
   */
  async upsertRoutine(routineData: RoutineData): Promise<any> {
    try {
      const user = await this.getCurrentUser();
      const permissions = this.createUserPermissions(user.$id);

      // Check if record exists
      const existing = await this.getRoutineForCourse(routineData.studentId, routineData.courseId);

      const docData = {
        studentId: routineData.studentId,
        courseId: routineData.courseId,
        lastTaughtAt: routineData.lastTaughtAt,
        dueAtByOutcome: JSON.stringify(routineData.dueAtByOutcome),
        spacingPolicyVersion: routineData.spacingPolicyVersion,
        schema_version: routineData.schema_version
      };

      if (existing) {
        // Update existing record - find by querying since we need the document ID
        const existingRecords = await this.list('Routine', [
          Query.equal('studentId', routineData.studentId),
          Query.equal('courseId', routineData.courseId),
          Query.limit(1)
        ]);

        if (existingRecords.length > 0) {
          return await this.update('Routine', existingRecords[0].$id, docData);
        }
      }

      // Create new record
      return await this.create('Routine', docData, permissions);
    } catch (error) {
      throw this.handleError(error, 'upsert routine');
    }
  }

  /**
   * Update last taught timestamp
   */
  async setLastTaughtAt(studentId: string, courseId: string, timestamp: string): Promise<any> {
    try {
      const existing = await this.getRoutineForCourse(studentId, courseId);

      const routineData: RoutineData = existing || {
        studentId,
        courseId,
        dueAtByOutcome: {},
        spacingPolicyVersion: 1,
        schema_version: 1
      };

      routineData.lastTaughtAt = timestamp;

      return await this.upsertRoutine(routineData);
    } catch (error) {
      throw this.handleError(error, 'set last taught at');
    }
  }

  /**
   * Update due dates for outcomes using spaced repetition
   */
  async updateDueAtByOutcome(studentId: string, courseId: string, dueDateUpdates: { [outcomeId: string]: string }): Promise<any> {
    try {
      const existing = await this.getRoutineForCourse(studentId, courseId);

      const dueAtByOutcome = existing ? { ...existing.dueAtByOutcome } : {};

      // Apply all updates
      Object.entries(dueDateUpdates).forEach(([outcomeId, dueAt]) => {
        dueAtByOutcome[outcomeId] = dueAt;
      });

      const routineData: RoutineData = {
        studentId,
        courseId,
        lastTaughtAt: existing?.lastTaughtAt,
        dueAtByOutcome,
        spacingPolicyVersion: existing?.spacingPolicyVersion || 1,
        schema_version: existing?.schema_version || 1
      };

      return await this.upsertRoutine(routineData);
    } catch (error) {
      throw this.handleError(error, 'update due at by outcome');
    }
  }

  /**
   * Get overdue outcomes for a course
   */
  async getOverdueOutcomes(studentId: string, courseId: string): Promise<OutcomeSchedule[]> {
    try {
      const routine = await this.getRoutineForCourse(studentId, courseId);
      if (!routine) {
        return [];
      }

      const now = new Date().toISOString();
      const overdueOutcomes: OutcomeSchedule[] = [];

      Object.entries(routine.dueAtByOutcome).forEach(([outcomeId, dueAt]) => {
        const isOverdue = dueAt <= now;
        overdueOutcomes.push({
          outcomeId,
          dueAt,
          isOverdue
        });
      });

      // Sort by due date (most overdue first)
      return overdueOutcomes
        .filter(outcome => outcome.isOverdue)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    } catch (error) {
      throw this.handleError(error, 'get overdue outcomes');
    }
  }

  /**
   * Get all scheduled outcomes (overdue and upcoming)
   */
  async getScheduledOutcomes(studentId: string, courseId: string): Promise<OutcomeSchedule[]> {
    try {
      const routine = await this.getRoutineForCourse(studentId, courseId);
      if (!routine) {
        return [];
      }

      const now = new Date().toISOString();
      const scheduledOutcomes: OutcomeSchedule[] = [];

      Object.entries(routine.dueAtByOutcome).forEach(([outcomeId, dueAt]) => {
        scheduledOutcomes.push({
          outcomeId,
          dueAt,
          isOverdue: dueAt <= now
        });
      });

      // Sort by due date
      return scheduledOutcomes.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    } catch (error) {
      throw this.handleError(error, 'get scheduled outcomes');
    }
  }

  /**
   * Calculate next due date using spaced repetition algorithm
   */
  calculateNextDueDate(currentEMA: number, daysSinceLastReview: number = 1): string {
    // Simple spaced repetition algorithm
    // High EMA (mastered) = longer intervals
    // Low EMA (struggling) = shorter intervals

    let intervalDays: number;

    if (currentEMA >= 0.8) {
      // Mastered: 7-14 day intervals
      intervalDays = Math.max(7, daysSinceLastReview * 2);
    } else if (currentEMA >= 0.6) {
      // Good progress: 3-7 day intervals
      intervalDays = Math.max(3, daysSinceLastReview * 1.5);
    } else if (currentEMA >= 0.4) {
      // Some progress: 1-3 day intervals
      intervalDays = Math.max(1, daysSinceLastReview * 1.2);
    } else {
      // Struggling: daily review
      intervalDays = 1;
    }

    // Cap at 30 days maximum
    intervalDays = Math.min(intervalDays, 30);

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + intervalDays);

    return nextDue.toISOString();
  }

  /**
   * Update outcome schedule after lesson completion
   */
  async updateOutcomeSchedule(studentId: string, courseId: string, outcomeId: string, newEMA: number): Promise<any> {
    try {
      const routine = await this.getRoutineForCourse(studentId, courseId);
      const currentDueAt = routine?.dueAtByOutcome[outcomeId];

      // Calculate days since last review
      let daysSinceLastReview = 1;
      if (currentDueAt) {
        const lastDue = new Date(currentDueAt);
        const now = new Date();
        daysSinceLastReview = Math.max(1, Math.floor((now.getTime() - lastDue.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const nextDueDate = this.calculateNextDueDate(newEMA, daysSinceLastReview);

      // Update the schedule
      return await this.updateDueAtByOutcome(studentId, courseId, {
        [outcomeId]: nextDueDate
      });
    } catch (error) {
      throw this.handleError(error, 'update outcome schedule');
    }
  }

  /**
   * Initialize routine for a new enrollment
   */
  async initializeRoutineForCourse(studentId: string, courseId: string, outcomeIds: string[]): Promise<any> {
    try {
      const now = new Date();
      const dueAtByOutcome: { [outcomeId: string]: string } = {};

      // Set all outcomes as due now (for initial assessment)
      outcomeIds.forEach(outcomeId => {
        dueAtByOutcome[outcomeId] = now.toISOString();
      });

      const routineData: RoutineData = {
        studentId,
        courseId,
        dueAtByOutcome,
        spacingPolicyVersion: 1,
        schema_version: 1
      };

      return await this.upsertRoutine(routineData);
    } catch (error) {
      throw this.handleError(error, 'initialize routine for course');
    }
  }
}