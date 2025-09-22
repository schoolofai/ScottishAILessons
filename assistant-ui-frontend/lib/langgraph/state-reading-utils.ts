/**
 * TypeScript utilities for LangGraph state reading operations
 *
 * These functions provide a direct port of the Python utilities from
 * langgraph-agent/src/agent/course_manager_utils.py for use in Next.js API routes.
 */

export interface CourseRecommendation {
  courseId: string;
  graphRunId: string;
  candidates: LessonCandidate[];
  rubric: string;
  timestamp: string;
}

export interface LessonCandidate {
  lessonTemplateId: string;
  title: string;
  priorityScore: number;
  reasons: string[];
}

export interface RecommendationsResponse {
  available: boolean;
  candidates: LessonCandidate[];
  metadata: {
    course_id?: string;
    graph_run_id?: string;
    rubric?: string;
    generated_at?: string;
    total_candidates: number;
    summary?: any;
  };
  thread_id?: string;
  orchestration_phase?: string;
  recommendations_ready: boolean;
}

export interface ThreadReadinessStatus {
  recommendations_ready: boolean;
  can_select_lesson: boolean;
  teaching_active: boolean;
  orchestration_phase?: string;
  routing_decision?: string;
  thread_id?: string;
}

export interface ThreadValidationResult {
  valid: boolean;
  error?: string;
  recommendation?: string;
  thread_id?: string;
  ready_for_reading?: boolean;
}

export interface LessonSelectionContext {
  lesson_selection: {
    lessonTemplateId: string;
    sessionId: string;
    metadata?: {
      title?: string;
      priority_score?: number;
      reasons?: string[];
    };
  };
  mode: string;
  selection_source: string;
  course_id?: string;
}

/**
 * Extract course recommendations from LangGraph state for frontend consumption.
 *
 * Port of extract_recommendations_from_state() from course_manager_utils.py:525-571
 */
export function extractRecommendationsFromState(state: Record<string, any>): RecommendationsResponse {
  const recommendations: RecommendationsResponse = {
    available: false,
    candidates: [],
    metadata: {
      total_candidates: 0
    },
    thread_id: state.thread_id,
    orchestration_phase: state.orchestration_phase,
    recommendations_ready: state.recommendations_ready || false
  };

  // Extract course recommendation data
  const courseRecommendation = state.course_recommendation;
  if (courseRecommendation && typeof courseRecommendation === 'object') {
    const candidates = courseRecommendation.candidates || [];

    recommendations.available = candidates.length > 0;
    recommendations.candidates = candidates;
    recommendations.metadata = {
      course_id: courseRecommendation.courseId,
      graph_run_id: courseRecommendation.graphRunId,
      rubric: courseRecommendation.rubric,
      generated_at: courseRecommendation.timestamp,
      total_candidates: candidates.length
    };

    // Add summary statistics
    if (candidates.length > 0) {
      recommendations.metadata.summary = generateRecommendationSummary(candidates);
    }
  }

  return recommendations;
}

/**
 * Check if thread state is ready for specific operations.
 *
 * Port of get_thread_readiness_status() from course_manager_utils.py:574-594
 */
export function getThreadReadinessStatus(state: Record<string, any>): ThreadReadinessStatus {
  const recommendationsReady = state.recommendations_ready || false;
  const candidates = state.course_recommendation?.candidates || [];

  return {
    recommendations_ready: recommendationsReady,
    can_select_lesson: recommendationsReady && candidates.length > 0,
    teaching_active: state.mode === "teaching",
    orchestration_phase: state.orchestration_phase,
    routing_decision: state.routing_decision,
    thread_id: state.thread_id
  };
}

/**
 * Validate that a thread ID is suitable for state reading operations.
 *
 * Port of validate_thread_for_state_reading() from course_manager_utils.py:597-625
 */
export function validateThreadForStateReading(threadId: string): ThreadValidationResult {
  if (!threadId) {
    return {
      valid: false,
      error: "Thread ID is required for state reading",
      recommendation: "Create a new thread with initial course context"
    };
  }

  if (typeof threadId !== 'string' || threadId.trim().length === 0) {
    return {
      valid: false,
      error: "Thread ID must be a non-empty string",
      recommendation: "Use a valid thread identifier"
    };
  }

  return {
    valid: true,
    thread_id: threadId.trim(),
    ready_for_reading: true
  };
}

/**
 * Create session context for lesson selection to continue the flow.
 *
 * Port of create_lesson_selection_context() from course_manager_utils.py:628-670
 */
export function createLessonSelectionContext(
  selectedLessonId: string,
  recommendationsState: Record<string, any>
): LessonSelectionContext {
  const sessionContext: LessonSelectionContext = {
    lesson_selection: {
      lessonTemplateId: selectedLessonId,
      sessionId: `sess_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')}`
    },
    mode: "teaching",
    selection_source: "course_recommendations"
  };

  // Preserve course context for continuity
  const courseRecommendation = recommendationsState.course_recommendation;
  if (courseRecommendation?.courseId) {
    sessionContext.course_id = courseRecommendation.courseId;
  }

  // Find the selected lesson in candidates for metadata
  const candidates = courseRecommendation?.candidates || [];
  const selectedLesson = candidates.find(
    (c: any) => c.lessonTemplateId === selectedLessonId
  );

  if (selectedLesson) {
    sessionContext.lesson_selection.metadata = {
      title: selectedLesson.title,
      priority_score: selectedLesson.priorityScore,
      reasons: selectedLesson.reasons || []
    };
  }

  return sessionContext;
}

/**
 * Generate summary statistics for recommendation candidates.
 * Helper function for extractRecommendationsFromState.
 */
function generateRecommendationSummary(candidates: LessonCandidate[]): any {
  if (candidates.length === 0) {
    return { total: 0, avg_score: 0, top_reasons: [] };
  }

  const totalScore = candidates.reduce((sum, c) => sum + c.priorityScore, 0);
  const avgScore = totalScore / candidates.length;

  // Count all reasons
  const reasonCounts: Record<string, number> = {};
  candidates.forEach(c => {
    c.reasons.forEach(reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
  });

  // Get top 3 most common reasons
  const topReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([reason, count]) => ({ reason, count }));

  return {
    total: candidates.length,
    avg_score: Math.round(avgScore * 100) / 100,
    top_reasons: topReasons,
    score_range: {
      min: Math.min(...candidates.map(c => c.priorityScore)),
      max: Math.max(...candidates.map(c => c.priorityScore))
    }
  };
}