/**
 * Spaced Repetition Service
 *
 * Maps overdue outcomes to lesson recommendations for student review.
 * Implements intelligent prioritization based on mastery levels and due dates.
 */

import { Databases, Query } from 'appwrite';
import { RoutineDriver } from '../appwrite/driver/RoutineDriver';
import { MasteryV2Driver } from '../appwrite/driver/MasteryV2Driver';
import { decompressJSON } from '../appwrite/utils/compression';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ReviewRecommendation {
  lessonTemplateId: string;
  lessonTitle: string;
  priority: number; // 1-10 (10 = most urgent)
  overdueOutcomes: OutcomeInfo[];
  averageMastery: number; // 0-1 scale
  daysSinceCompleted: number | null; // null if never completed
  estimatedMinutes: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendationReason: string;
}

export interface OutcomeInfo {
  outcomeId: string;
  dueAt: string;
  daysOverdue: number;
  currentEMA: number;
  masteryLevel: 'struggling' | 'progress' | 'good' | 'mastered';
}

export interface ReviewStats {
  totalOverdueOutcomes: number;
  criticalCount: number; // EMA < 0.4
  recommendedLessons: number;
  estimatedReviewTime: number; // minutes
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Get recommended lessons for review based on overdue outcomes
 *
 * @param studentId - Student document ID
 * @param courseId - Course ID (e.g., "C844 73")
 * @param databases - Appwrite Databases instance
 * @param limit - Maximum number of recommendations (default: 5)
 * @returns Array of review recommendations sorted by priority
 */
export async function getReviewRecommendations(
  studentId: string,
  courseId: string,
  databases: Databases,
  limit: number = 5
): Promise<ReviewRecommendation[]> {
  console.log('[SpacedRepetition] Getting review recommendations:', { studentId, courseId, limit });

  try {
    const routineDriver = new RoutineDriver(databases);
    const masteryDriver = new MasteryV2Driver(databases);

    // 1. Get all overdue outcomes
    const overdueOutcomes = await routineDriver.getOverdueOutcomes(studentId, courseId);

    if (overdueOutcomes.length === 0) {
      console.log('[SpacedRepetition] No overdue outcomes found');
      return [];
    }

    console.log(`[SpacedRepetition] Found ${overdueOutcomes.length} overdue outcomes`);

    // 2. Get mastery data for context
    const masteryData = await masteryDriver.getMasteryV2(studentId, courseId);
    const emaByOutcome = masteryData?.emaByOutcomeId || {};

    // 3. Enrich overdue outcomes with mastery and timing info
    const enrichedOutcomes = overdueOutcomes.map(outcome => {
      const currentEMA = emaByOutcome[outcome.outcomeId] || 0.3; // Default if not tracked
      const daysOverdue = calculateDaysOverdue(outcome.dueAt);

      return {
        outcomeId: outcome.outcomeId,
        dueAt: outcome.dueAt,
        daysOverdue,
        currentEMA,
        masteryLevel: getMasteryLevel(currentEMA)
      };
    });

    console.log('[SpacedRepetition] Enriched outcomes:', enrichedOutcomes.length);

    // 4. Find lessons that teach these outcomes
    const lessonRecommendations = await findLessonsForOutcomes(
      enrichedOutcomes,
      courseId,
      studentId,
      databases
    );

    console.log(`[SpacedRepetition] Found ${lessonRecommendations.length} candidate lessons`);

    // 5. Calculate priorities and sort
    const rankedRecommendations = lessonRecommendations
      .map(rec => calculatePriority(rec))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    console.log('[SpacedRepetition] Returning top recommendations:', rankedRecommendations.length);

    return rankedRecommendations;

  } catch (error) {
    console.error('[SpacedRepetition] Failed to get recommendations:', error);
    throw new Error(`Failed to get review recommendations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get summary statistics for student's review status
 */
export async function getReviewStats(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<ReviewStats> {
  try {
    const routineDriver = new RoutineDriver(databases);
    const masteryDriver = new MasteryV2Driver(databases);

    const overdueOutcomes = await routineDriver.getOverdueOutcomes(studentId, courseId);
    const masteryData = await masteryDriver.getMasteryV2(studentId, courseId);
    const emaByOutcome = masteryData?.emaByOutcomeId || {};

    // Count critical outcomes (EMA < 0.4)
    const criticalCount = overdueOutcomes.filter(outcome => {
      const ema = emaByOutcome[outcome.outcomeId] || 0.3;
      return ema < 0.4;
    }).length;

    // Get recommendations to estimate review time
    const recommendations = await getReviewRecommendations(studentId, courseId, databases, 10);
    const estimatedReviewTime = recommendations.reduce((sum, rec) => sum + rec.estimatedMinutes, 0);

    return {
      totalOverdueOutcomes: overdueOutcomes.length,
      criticalCount,
      recommendedLessons: recommendations.length,
      estimatedReviewTime
    };

  } catch (error) {
    console.error('[SpacedRepetition] Failed to get review stats:', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find lessons that teach the given outcomes
 */
async function findLessonsForOutcomes(
  outcomes: OutcomeInfo[],
  courseId: string,
  studentId: string,
  databases: Databases
): Promise<ReviewRecommendation[]> {

  // Get all lesson templates for this course
  const templatesResult = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', courseId),
      Query.equal('status', 'published')
    ]
  );

  console.log(`[SpacedRepetition] Found ${templatesResult.documents.length} published lessons`);

  // Get completed sessions to track what student has done
  const sessionsResult = await databases.listDocuments(
    'default',
    'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('stage', 'done')
    ]
  );

  const completedLessonMap = new Map<string, string>(); // lessonTemplateId -> completedAt
  sessionsResult.documents.forEach(session => {
    const lessonTemplateId = session.lessonTemplateId;
    const completedAt = session.endedAt || session.$createdAt;

    // Keep only the most recent completion
    if (!completedLessonMap.has(lessonTemplateId) ||
        completedAt > completedLessonMap.get(lessonTemplateId)!) {
      completedLessonMap.set(lessonTemplateId, completedAt);
    }
  });

  console.log(`[SpacedRepetition] Student has completed ${completedLessonMap.size} lessons`);

  // Map outcomes to lessons
  const recommendations: ReviewRecommendation[] = [];
  const outcomeIds = outcomes.map(o => o.outcomeId);

  for (const template of templatesResult.documents) {
    // Parse outcomeRefs from template
    let outcomeRefs: string[] = [];
    try {
      const parsed = JSON.parse(template.outcomeRefs || '[]');
      // Handle both array format and object format with outcomes array
      outcomeRefs = Array.isArray(parsed) ? parsed : (parsed.outcomes || []);
    } catch (error) {
      console.warn(`[SpacedRepetition] Failed to parse outcomeRefs for lesson ${template.$id}`);
      continue;
    }

    // Find which overdue outcomes this lesson teaches
    const matchingOutcomes = outcomes.filter(outcome =>
      outcomeRefs.includes(outcome.outcomeId)
    );

    if (matchingOutcomes.length === 0) {
      continue; // This lesson doesn't teach any overdue outcomes
    }

    // Calculate days since completion
    const lastCompleted = completedLessonMap.get(template.$id);
    const daysSinceCompleted = lastCompleted
      ? calculateDaysSince(lastCompleted)
      : null;

    // Calculate average mastery for this lesson's outcomes
    const averageMastery = matchingOutcomes.reduce((sum, o) => sum + o.currentEMA, 0) / matchingOutcomes.length;

    // Generate recommendation reason
    const reason = generateRecommendationReason(matchingOutcomes, daysSinceCompleted);

    recommendations.push({
      lessonTemplateId: template.$id,
      lessonTitle: template.title,
      priority: 0, // Will be calculated later
      overdueOutcomes: matchingOutcomes,
      averageMastery,
      daysSinceCompleted,
      estimatedMinutes: template.estMinutes || 30,
      urgencyLevel: 'medium', // Will be calculated later
      recommendationReason: reason
    });
  }

  return recommendations;
}

/**
 * Calculate priority score for a recommendation
 * Priority = (overdue_outcomes * 3) + (days_overdue_avg / 7 * 2) + ((1 - avg_mastery) * 5)
 * Scale: 1-10
 */
function calculatePriority(recommendation: ReviewRecommendation): ReviewRecommendation {
  const { overdueOutcomes, averageMastery } = recommendation;

  // Component 1: Number of overdue outcomes (0-3 points)
  const outcomeScore = Math.min(overdueOutcomes.length * 0.5, 3);

  // Component 2: How overdue (0-2 points)
  const avgDaysOverdue = overdueOutcomes.reduce((sum, o) => sum + o.daysOverdue, 0) / overdueOutcomes.length;
  const overdueScore = Math.min((avgDaysOverdue / 7) * 2, 2);

  // Component 3: Low mastery = higher priority (0-5 points)
  const masteryScore = (1 - averageMastery) * 5;

  // Total priority (0-10)
  const rawPriority = outcomeScore + overdueScore + masteryScore;
  const priority = Math.max(1, Math.min(10, Math.round(rawPriority)));

  // Determine urgency level
  let urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  if (priority >= 8) urgencyLevel = 'critical';
  else if (priority >= 6) urgencyLevel = 'high';
  else if (priority >= 4) urgencyLevel = 'medium';
  else urgencyLevel = 'low';

  return {
    ...recommendation,
    priority,
    urgencyLevel
  };
}

/**
 * Calculate how many days overdue an outcome is
 */
function calculateDaysOverdue(dueAt: string): number {
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate days since a given date
 */
function calculateDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get mastery level label from EMA score
 */
function getMasteryLevel(ema: number): 'struggling' | 'progress' | 'good' | 'mastered' {
  if (ema >= 0.8) return 'mastered';
  if (ema >= 0.6) return 'good';
  if (ema >= 0.4) return 'progress';
  return 'struggling';
}

/**
 * Generate human-readable recommendation reason
 */
function generateRecommendationReason(
  outcomes: OutcomeInfo[],
  daysSinceCompleted: number | null
): string {
  const avgDaysOverdue = outcomes.reduce((sum, o) => sum + o.daysOverdue, 0) / outcomes.length;
  const avgMastery = outcomes.reduce((sum, o) => sum + o.currentEMA, 0) / outcomes.length;
  const masteryLevel = getMasteryLevel(avgMastery);

  const parts: string[] = [];

  // Overdue status
  if (avgDaysOverdue > 14) {
    parts.push('Long overdue for review');
  } else if (avgDaysOverdue > 7) {
    parts.push('Overdue for review');
  } else {
    parts.push('Due for review');
  }

  // Mastery status
  if (masteryLevel === 'struggling') {
    parts.push('needs reinforcement');
  } else if (masteryLevel === 'progress') {
    parts.push('building understanding');
  } else if (masteryLevel === 'good') {
    parts.push('maintaining knowledge');
  } else {
    parts.push('retaining mastery');
  }

  // Last completed
  if (daysSinceCompleted !== null) {
    if (daysSinceCompleted > 30) {
      parts.push(`(last studied ${Math.floor(daysSinceCompleted / 30)} months ago)`);
    } else if (daysSinceCompleted > 7) {
      parts.push(`(last studied ${Math.floor(daysSinceCompleted / 7)} weeks ago)`);
    } else {
      parts.push(`(last studied ${daysSinceCompleted} days ago)`);
    }
  } else {
    parts.push('(not yet completed)');
  }

  return parts.join(' • ');
}
