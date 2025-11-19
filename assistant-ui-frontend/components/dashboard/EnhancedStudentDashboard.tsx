"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CourseNavigationTabs, type CourseData } from "../courses/CourseNavigationTabs";
import { RecommendationSection, type RecommendationsData } from "../recommendations/RecommendationSection";
import { CourseProgressCard } from "../progress/CourseProgressCard";
import { CourseCurriculum } from "../curriculum/CourseCurriculum";
import { CourseCheatSheetButton } from "../revision-notes/CourseCheatSheetButton";
import { SpacedRepetitionPanel } from "./SpacedRepetitionPanel";
import { getCourseProgress } from "@/lib/services/progress-service";
import { getReviewRecommendations, getReviewStats, getUpcomingReviews } from "@/lib/services/spaced-repetition-service";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, BookOpen, GraduationCap, Archive, ChevronDown, ChevronUp } from "lucide-react";
import { DashboardSkeleton } from "../ui/LoadingSkeleton";
import { CourseCard } from "../courses/CourseCard";
import { enrollStudentInCourse } from "@/lib/services/enrollment-service";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionPaywallModal, type PriceInfo } from "./SubscriptionPaywallModal";
import { SubscriptionStatusBanner } from "../subscription/SubscriptionStatusBanner";
import {
  type Course,
  type Session,
  transformCoursesForNavigation,
  formatErrorMessage,
  validateLessonStartContext,
  createLessonStartPayload,
  getSessionUrl,
  getStudentDisplayName,
  debugLog
} from "../../lib/dashboard/utils";
import { cache, createCacheKey } from "../../lib/cache";

// Type imports are handled by the utils file

/**
 * Parse a mastery key (outcome or composite) for user-friendly display
 *
 * @param key - Mastery key from emaByOutcome (document ID or composite key)
 * @returns Parsed key information
 *
 * @example
 * parseMasteryKey("outcome_test_simple_o1") → { isComposite: false, documentId: "outcome_test_simple_o1" }
 * parseMasteryKey("outcome_test_simple_o1#AS1.1") → { isComposite: true, documentId: "outcome_test_simple_o1", asCode: "AS1.1" }
 */
function parseMasteryKey(key: string): {
  isComposite: boolean;
  documentId: string;
  asCode?: string;
} {
  // Check if key contains "#" separator (composite key)
  if (key.includes('#')) {
    const [documentId, asCode] = key.split('#');
    return {
      isComposite: true,
      documentId: documentId.trim(),
      asCode: asCode.trim()
    };
  }

  // Regular document ID (outcome-level)
  return {
    isComposite: false,
    documentId: key
  };
}

export function EnhancedStudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [activeCourse, setActiveCourse] = useState<string>("");
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [spacedRepetitionData, setSpacedRepetitionData] = useState<any | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [spacedRepetitionLoading, setSpacedRepetitionLoading] = useState(false);
  const [error, setError] = useState("");
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [spacedRepetitionError, setSpacedRepetitionError] = useState<string | null>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null);
  const [cheatSheetAvailable, setCheatSheetAvailable] = useState<boolean | null>(null);

  // Archived courses state
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Recommendations section state
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Subscription paywall state (T042)
  const { hasAccess, isLoading: subscriptionLoading } = useSubscription();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<PriceInfo | null>(null);

  useEffect(() => {
    initializeStudent();
  }, []);

  // Load course progress when active course changes
  useEffect(() => {
    if (activeCourse && student) {
      loadCourseProgress();
    }
  }, [activeCourse, student]);

  // Check course cheat sheet availability when active course changes
  useEffect(() => {
    if (!activeCourse) {
      setCheatSheetAvailable(null);
      return;
    }

    const checkCheatSheetAvailability = async () => {
      try {
        const { RevisionNotesDriver } = await import('@/lib/appwrite/driver/RevisionNotesDriver');
        const driver = new RevisionNotesDriver();
        const isAvailable = await driver.courseCheatSheetExists(activeCourse);
        setCheatSheetAvailable(isAvailable);
      } catch (error) {
        // On error, mark as unavailable
        setCheatSheetAvailable(false);
      }
    };

    checkCheatSheetAvailability();
  }, [activeCourse]);

  // Prefetch subscription price for instant paywall modal display
  useEffect(() => {
    const fetchSubscriptionPrice = async () => {
      try {
        const response = await fetch('/api/stripe/product-info');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionPrice(data);
          console.log('[Dashboard] Subscription price prefetched:', data.formatted);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to prefetch subscription price:', error);
        // Silently fail - modal will use fallback price
      }
    };

    fetchSubscriptionPrice();
  }, []); // Only once on mount

  // Initialize student using server-side API (SSR-compatible)
  const initializeStudent = async () => {
    try {
      setLoading(true);
      setError("");

      // Call server-side API that uses httpOnly session cookie
      const response = await fetch('/api/student/me');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not authenticated. Please log in.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch student data');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load student data');
      }

      setStudent(data.student);

      // Load enrollments and courses from server API
      await loadEnrollmentsFromAPI(data.student);
    } catch (err) {
      console.error("Student initialization error:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize student");

      // Redirect to login if authentication failed
      if (err instanceof Error && err.message.includes('Not authenticated')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load enrollments and courses from server-side API
  const loadEnrollmentsFromAPI = async (studentData: any) => {
    try {
      setCoursesLoading(true);
      setCoursesError(null);

      const response = await fetch('/api/student/enrollments');

      if (!response.ok) {
        throw new Error('Failed to fetch enrollments');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load enrollments');
      }

      const { enrollments, courses: coursesData } = result.data;

      // Set active and archived courses
      setCourses(coursesData.active);
      setArchivedCourses(coursesData.archived);

      // Transform for navigation
      const transformedCourses = transformCoursesForNavigation(coursesData.active);
      setCourseData(transformedCourses);

      console.log('[Dashboard] Loaded enrolled courses:', {
        activeEnrollmentCount: enrollments.active.length,
        archivedEnrollmentCount: enrollments.archived.length,
        courseCount: transformedCourses.length
      });

      // Check if no active enrollments
      if (enrollments.active.length === 0) {
        setCoursesError('No active enrollments found. Please enroll in a course to get started.');
        return;
      }

      // Set initial active course and load its data
      if (transformedCourses.length > 0 && !activeCourse && studentData) {
        const firstCourse = transformedCourses[0];
        setActiveCourse(firstCourse.id);
        // Load recommendations and spaced repetition data for the first course in parallel
        await Promise.all([
          loadRecommendations(firstCourse.id, studentData),
          loadSpacedRepetition(firstCourse.id, studentData)
        ]);
      }

    } catch (err) {
      console.error('[Dashboard] Failed to load enrollments:', err);
      setCoursesError(formatErrorMessage(err));
      // Re-throw to propagate error to parent handler (fast-fail, no fallback)
      throw err;
    } finally {
      setCoursesLoading(false);
    }
  };

  // REMOVED: loadCoursesClientSide and loadArchivedCourses - now using loadEnrollmentsFromAPI with server API

  // Handle re-enrollment from archived courses
  const handleReenroll = async (courseId: string, courseName: string) => {
    if (!student) {
      toast.error('Student data not available');
      throw new Error('Student data not available'); // Fast fail
    }

    try {
      // Use server API for re-enrollment
      const response = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include httpOnly cookies
        body: JSON.stringify({ courseId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to re-enroll' }));
        throw new Error(errorData.error || 'Failed to re-enroll in course');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to re-enroll in course');
      }

      // Reload courses to update the UI using server API
      await loadEnrollmentsFromAPI(student);

      toast.success(`Welcome back! Your progress in ${courseName} has been restored.`);
    } catch (error) {
      console.error('Failed to re-enroll:', error);
      toast.error('Failed to re-enroll in course. Please try again.');
      throw error; // Fast fail, no fallback
    }
  };

  // Load recommendations for a specific course using LangGraph Course Manager
  const loadRecommendations = async (courseId: string, studentData?: any) => {
    try {
      setRecommendationsLoading(true);
      setRecommendationsError(null);

      // 1. Quick backend availability check BEFORE attempting to load recommendations
      // This implements fail-fast error handling to avoid slow timeouts
      try {
        const { checkBackendAvailability } = await import('@/lib/backend-status');
        await checkBackendAvailability();
      } catch (backendError) {
        // Backend is not available - fail fast with user-friendly message
        console.error('[Recommendations] Backend availability check failed:', backendError);
        throw new Error('Your AI recommendation system is currently not available. Please ensure the backend service is running.');
      }

      // 2. Get student data first (use parameter or state)
      const currentStudent = studentData || student;
      if (!currentStudent) {
        throw new Error('Student data not available');
      }

      // 3. Check cache first (5 minute TTL for recommendations)
      const cacheKey = createCacheKey('recommendations', currentStudent.$id, courseId);
      const cachedRecommendations = cache.get<RecommendationsData>(cacheKey);

      if (cachedRecommendations) {
        console.log('[Cache] Using cached recommendations for:', { courseId, cacheKey });
        setRecommendations(cachedRecommendations);
        setRecommendationsLoading(false);
        return;
      }

      // 4. Get all recommendations data via server-side API (httpOnly cookie authentication)
      console.log('[API] Fetching recommendations data from server...');
      const recommendationsDataResponse = await fetch(`/api/student/recommendations-data/${courseId}`, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!recommendationsDataResponse.ok) {
        const errorData = await recommendationsDataResponse.json().catch(() => ({
          error: 'Failed to load recommendations data'
        }));
        throw new Error(errorData.error || 'Failed to fetch recommendations data');
      }

      const { data: recommendationsData } = await recommendationsDataResponse.json();
      const course = recommendationsData.course;
      const templatesResult = { documents: recommendationsData.lessonTemplates };
      const masteryV2Record = recommendationsData.mastery;
      const sowDocuments = recommendationsData.sow;

      console.log('[API] Successfully fetched recommendations data:', {
        hasMastery: !!masteryV2Record,
        sowCount: sowDocuments?.length || 0
      });

      // Convert MasteryV2 to legacy format for compatibility
      let masteryData = [];
      if (masteryV2Record) {
        const emaByOutcome = masteryV2Record.emaByOutcome || {};

        // Convert EMA data to legacy mastery format for templates
        // Keys can be:
        // - Document IDs: "outcome_test_simple_o1" → display as is (will be enriched later)
        // - Composite keys: "outcome_test_simple_o1#AS1.1" → parse and display AS code
        masteryData = Object.entries(emaByOutcome).map(([key, ema]) => {
          // Parse composite keys for user-friendly display
          const displayRef = parseMasteryKey(key);

          return {
            outcomeRef: displayRef.isComposite ? displayRef.asCode : key, // Show AS code for composite, full ID for outcomes
            masteryLevel: ema, // Use EMA score as mastery level
            rawKey: key, // Keep raw key for debugging
            keyType: displayRef.isComposite ? 'assessment_standard' : 'outcome'
          };
        });

        console.log('[Dashboard] Parsed mastery data:', {
          totalEntries: masteryData.length,
          outcomeCount: masteryData.filter(m => m.keyType === 'outcome').length,
          asCount: masteryData.filter(m => m.keyType === 'assessment_standard').length,
          sample: masteryData.slice(0, 3)
        });
      }

      // 8. Routine data removed - keeping spaced repetition separate from recommendations

      // 9. Validate SOW data
      if (!sowDocuments || sowDocuments.length === 0) {
        const error = new Error(
          `No SOWV2 data found for student: ${currentStudent.$id}, course: ${course.courseId}. ` +
          `SOWV2 collection must be populated for this enrollment.`
        );
        console.error('[SOW Query] FAILED:', error.message);
        throw error;
      }

      console.log('[SOW Query] SUCCESS - Found SOWV2 documents:', sowDocuments.length);

      // Phase 1: Data Collection Complete
      console.log('[Recommendation Phase 1 - Data Collection]', {
        student: currentStudent,
        course: course,
        templates: templatesResult.documents,
        mastery: masteryV2Record,
        sow: sowDocuments
      });

      // 10. Build complete scheduling context (matching Task 7 isolation test format)

      // Debug SOW data transformation
      console.log('[SOW Debug] Raw SOWV2 document:', sowDocuments[0]);

      let sowEntries = [];
      if (sowDocuments.length > 0) {
        const rawEntries = sowDocuments[0].entries || '[]';
        console.log('[SOW Debug] Raw entries field:', rawEntries);

        try {
          const parsedEntries = JSON.parse(rawEntries);
          console.log('[SOW Debug] Parsed entries:', parsedEntries);

          sowEntries = parsedEntries.map((entry: any) => ({
            templateId: entry.lessonTemplateId,
            order: entry.order,
            plannedAt: entry.plannedAt
          }));
          console.log('[SOW Debug] Transformed SOW entries:', sowEntries);
        } catch (error) {
          console.error('[SOW Debug] Error parsing entries:', error);
        }
      }

      const context = {
        mode: "course_manager",
        student: {
          id: currentStudent.$id,
          name: currentStudent.name,
          email: currentStudent.email || `${currentStudent.name}@example.com`
        },
        course: {
          $id: course.$id,
          courseId: course.courseId,
          subject: course.subject,
          sqaCode: course.sqaCode || ''
        },
        templates: templatesResult.documents.map(template => ({
          $id: template.$id,
          title: template.title,
          // outcomeRefs is already decompressed by the API
          outcomeRefs: template.outcomeRefs || [],
          estMinutes: template.estMinutes || 30
        })),
        mastery: masteryData.map(record => ({
          outcomeRef: record.outcomeRef,
          masteryLevel: record.masteryLevel
        })),
        sow: sowEntries
      };

      // Phase 2: Context Building Complete
      console.log('[Recommendation Phase 2 - Context Building]', context);

      // 11. Call LangGraph Course Manager using SDK
      const { Client: LangGraphClient } = await import('@langchain/langgraph-sdk');
      const langGraphClient = new LangGraphClient({
        apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || 'http://localhost:2024',
        apiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY,
      });

      // Create thread for Course Manager
      const thread = await langGraphClient.threads.create();

      // Run Course Manager with complete context
      const run = await langGraphClient.runs.create(
        thread.thread_id,
        process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID || 'agent',
        {
          input: {
            session_context: context,
            mode: "course_manager"
          }
        }
      );

      // Phase 3: LangGraph SDK Call
      console.log('[Recommendation Phase 3 - LangGraph SDK Call]', {
        threadId: thread.thread_id,
        runId: run.run_id,
        input: { session_context: context, mode: "course_manager" }
      });

      // Wait for completion
      const result = await langGraphClient.runs.join(thread.thread_id, run.run_id);

      // Get final state
      const state = await langGraphClient.threads.getState(thread.thread_id);

      // Extract recommendation from state only - NO FALLBACKS
      const courseRecommendation = state.values?.course_recommendation;

      // Detailed logging for debugging
      console.log('[Recommendation Extraction] State values keys:', Object.keys(state.values || {}));
      console.log('[Recommendation Extraction] Course recommendation present:', !!courseRecommendation);

      if (!courseRecommendation) {
        const errorDetails = {
          stateKeys: Object.keys(state.values || {}),
          stateHasCourseRec: !!state.values?.course_recommendation,
          stateHasError: !!state.values?.error,
          stateError: state.values?.error,
          threadId: thread.thread_id,
          runId: run.run_id,
          timestamp: new Date().toISOString()
        };

        console.error('[Recommendation Extraction] FAILED - No course_recommendation in state:', errorDetails);

        throw new Error(
          `No course_recommendation found in LangGraph state. ` +
          `Available state keys: [${Object.keys(state.values || {}).join(', ')}]. ` +
          `Thread: ${thread.thread_id}, Run: ${run.run_id}. ` +
          `State error: ${state.values?.error || 'none'}`
        );
      }

      // Phase 4: Response Extraction Complete
      console.log('[Recommendation Phase 4 - Response Extraction]', {
        state: state.values,
        courseRecommendation: courseRecommendation
      });

      // Transform LangGraph response to match RecommendationSection expected format
      const transformedRecommendations = {
        available: true,
        recommendations_ready: true,
        thread_id: thread.thread_id,
        candidates: courseRecommendation.recommendations?.map(rec => ({
          lessonTemplateId: rec.lessonId,
          title: rec.title,
          priorityScore: rec.score,
          reasons: rec.reasons || [],
          flags: rec.flags || []
        })) || [],
        metadata: {
          total_candidates: courseRecommendation.recommendations?.length || 0,
          generated_at: courseRecommendation.generatedAt || new Date().toISOString(),
          graph_run_id: run.run_id,
          rubric: 'Overdue > Low Mastery > Early Order | -Recent -Too Long'
        }
      };

      // Phase 5: Data Transformation Complete
      console.log('[Recommendation Phase 5 - Data Transformation]', {
        transformedRecommendations: transformedRecommendations
      });

      // Cache the recommendations (5 minute TTL) - reuse cacheKey from earlier
      cache.set(cacheKey, transformedRecommendations, 5 * 60 * 1000);
      console.log('[Cache] Cached recommendations for:', { courseId, cacheKey });

      setRecommendations(transformedRecommendations);
    } catch (err) {
      console.error("Failed to load recommendations from LangGraph:", err);

      // Specific error message for SOWV2 issues
      if (err instanceof Error && err.message.includes('SOWV2')) {
        setRecommendationsError(`SOW Data Missing: ${err.message}`);
      } else {
        setRecommendationsError(err instanceof Error ? err.message : "Failed to load recommendations from Course Manager");
      }
    } finally {
      setRecommendationsLoading(false);
    }
  };

  // Load spaced repetition data for the active course
  // TODO: Convert to server-side API call (currently disabled after removing dual session)
  const loadSpacedRepetition = async (courseId: string, studentData?: any) => {
    if (!studentData) {
      console.log('[loadSpacedRepetition] No student data available');
      return;
    }

    try {
      setSpacedRepetitionLoading(true);
      setSpacedRepetitionError(null);

      console.log('[Spaced Repetition] Fetching data from server API...');

      // Fetch spaced repetition data via server-side API (httpOnly cookie authentication)
      const spacedRepResponse = await fetch(`/api/student/spaced-repetition/${courseId}`, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!spacedRepResponse.ok) {
        const errorData = await spacedRepResponse.json().catch(() => ({
          error: 'Failed to load spaced repetition data'
        }));
        throw new Error(errorData.error || 'Failed to fetch spaced repetition data');
      }

      const { data: spacedRepData } = await spacedRepResponse.json();

      console.log('[Spaced Repetition] Successfully fetched data:', {
        hasRecommendations: !!spacedRepData.recommendations,
        hasStats: !!spacedRepData.stats,
        hasUpcoming: !!spacedRepData.upcoming
      });

      // Set the spaced repetition data
      setSpacedRepetitionData(spacedRepData);
    } catch (err) {
      console.error('[loadSpacedRepetition] Failed to load:', err);
      setSpacedRepetitionError(
        err instanceof Error ? err.message : 'Failed to load spaced repetition data'
      );
    } finally {
      setSpacedRepetitionLoading(false);
    }
  };

  // Load course progress for the active course
  // TODO: Convert to server-side API call (currently disabled after removing dual session)
  const loadCourseProgress = async () => {
    try {
      setProgressLoading(true);

      // Temporarily disabled - requires server-side API endpoint
      // The dashboard gracefully handles missing progress data
      console.log('[Progress] Progress loading temporarily disabled (requires API migration)');
      setCourseProgress(null);
    } catch (err) {
      console.error('[Progress] Failed to load course progress:', err);
      setCourseProgress(null);
    } finally {
      setProgressLoading(false);
    }
  };

  // Handle course change
  const handleCourseChange = useCallback(async (courseId: string) => {
    setActiveCourse(courseId);
    // Load recommendations and spaced repetition data in parallel
    await Promise.all([
      loadRecommendations(courseId, student),
      loadSpacedRepetition(courseId, student)
    ]);
  }, [student]);

  // Handle lesson start with race-condition safe session creation
  const handleStartLesson = async (lessonTemplateId: string) => {
    const startTime = Date.now();

    try {
      // T043: Check subscription BEFORE starting lesson
      if (!hasAccess) {
        setShowPaywallModal(true);
        return; // STOP - do not proceed
      }

      // Set loading state for this specific lesson
      setStartingLessonId(lessonTemplateId);

      // Validate lesson start context
      const validation = validateLessonStartContext(
        lessonTemplateId,
        activeCourse,
        recommendations?.thread_id
      );

      if (!validation.isValid) {
        const { logger } = await import('@/lib/logger');
        logger.error('lesson_start_validation_failed', {
          lessonTemplateId,
          error: validation.error
        });
        throw new Error(validation.error);
      }

      const { logger } = await import('@/lib/logger');
      logger.info('lesson_start_initiated', {
        lessonTemplateId,
        courseId: activeCourse,
        threadId: recommendations?.thread_id,
        studentId: student.$id
      });

      // Create session via server-side API (uses httpOnly cookie for auth)
      // No client-side authentication needed - middleware handles security
      const response = await fetch('/api/sessions', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonTemplateId,
          courseId: activeCourse,
          threadId: recommendations?.thread_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(errorData.error || 'Failed to create session');
      }

      const { sessionId } = await response.json();

      const duration = Date.now() - startTime;

      logger.info('lesson_start_completed', {
        lessonTemplateId,
        sessionId,
        duration,
        action: 'created_fresh'
      });

      // Invalidate caches with proper tags
      const cacheKey = createCacheKey('recommendations', student.$id, activeCourse);
      cache.invalidate(cacheKey);

      // Also invalidate session-related caches
      cache.invalidate(`sessions:student:${student.$id}`);
      cache.invalidate(`sessions:lesson:${lessonTemplateId}`);

      logger.info('cache_invalidated', {
        keys: [cacheKey, `sessions:student:${student.$id}`, `sessions:lesson:${lessonTemplateId}`]
      });

      // Navigate to session
      router.push(`/session/${sessionId}`);
    } catch (err) {
      const duration = Date.now() - startTime;
      const { logger } = await import('@/lib/logger');

      logger.error('lesson_start_failed', {
        lessonTemplateId,
        duration,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });

      // Show user-friendly error
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        setError('You do not have permission to access this session.');
      } else if (err instanceof Error && err.message.includes('authenticated')) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(formatErrorMessage(err));
      }

      // Clear loading state on error
      setStartingLessonId(null);
    }
  };

  // Handle view detailed progress
  const handleViewProgress = useCallback(() => {
    if (activeCourse) {
      router.push(`/dashboard/progress/${activeCourse}`);
    }
  }, [activeCourse, router]);

  // Handle recommendations retry
  const handleRecommendationsRetry = useCallback(() => {
    if (activeCourse && student) {
      // Invalidate cache before retrying to force fresh data
      const cacheKey = createCacheKey('recommendations', student.$id, activeCourse);
      cache.invalidate(cacheKey);
      console.log('[Cache] Invalidated cache for retry:', { cacheKey });

      loadRecommendations(activeCourse, student);
    }
  }, [activeCourse, student]);

  // Handle spaced repetition retry
  const handleSpacedRepetitionRetry = useCallback(() => {
    if (activeCourse && student) {
      console.log('[Retry] Retrying spaced repetition load for:', { activeCourse, studentId: student.$id });
      loadSpacedRepetition(activeCourse, student);
    }
  }, [activeCourse, student]);

  // Handle dashboard retry (for initialization failures)
  const handleDashboardRetry = useCallback(() => {
    initializeStudent();
  }, []);

  // Memoized computed values for performance
  const studentDisplayName = useMemo(() => getStudentDisplayName(student), [student]);

  const hasActiveCourse = useMemo(() => Boolean(activeCourse), [activeCourse]);

  const dashboardReady = useMemo(() => {
    return !loading && !error && courseData.length > 0;
  }, [loading, error, courseData.length]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6" data-testid="dashboard-error">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={handleDashboardRetry}
          className="mt-4"
          data-testid="dashboard-retry"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Empty state: No enrollments
  if (courseData.length === 0 && !coursesLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="dashboard-empty">
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-blue-600" />
          <h2 className="text-2xl font-bold mb-4">Welcome to Scottish AI Lessons!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You haven't enrolled in any courses yet. Browse our course catalog to get started with your learning journey.
          </p>
          <Button
            onClick={() => router.push('/courses/catalog')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Browse Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="student-dashboard">
      {/* Subscription Status Banner - shows for payment_failed or cancelled */}
      <SubscriptionStatusBanner />

      {/* Enhanced Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {studentDisplayName}!
        </h1>
        <p className="text-gray-600 mb-4">
          Ready to continue your learning across <strong>{courseData.length} courses</strong>?
          {courseData.length > 0 && " Here's what we recommend next:"}
        </p>
        {courseData.length > 0 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {courseData.map(course => (
              <span
                key={course.id}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full capitalize"
              >
                {course.subject.replace(/-/g, ' ')} - {course.level.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Course Navigation */}
      <div data-testid="course-navigation-section" className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Your Courses
          </h2>
          <Button
            variant="outline"
            onClick={() => router.push('/courses/catalog')}
            className="gap-2 w-full sm:w-auto"
          >
            <GraduationCap className="h-4 w-4" />
            Browse More Courses
          </Button>
        </div>
        <CourseNavigationTabs
          courses={courseData}
          activeCourse={activeCourse}
          onCourseChange={handleCourseChange}
          loading={coursesLoading}
          error={coursesError}
        />
      </div>

      {/* Hero Section - Course Progress */}
      {hasActiveCourse && courseProgress && !progressLoading && (
        <div data-testid="course-progress-section" className="mb-6">
          <CourseProgressCard
            progress={courseProgress}
            onViewDetails={handleViewProgress}
            cheatSheetAvailable={cheatSheetAvailable}
            courseId={activeCourse}
          />
        </div>
      )}

      {/* Two Column Layout - Spaced Repetition and AI Recommendations */}
      {hasActiveCourse && student && (
        <div className="mb-6">
          {/* Collapsible Header - More prominent card-like appearance */}
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="mb-4 w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-900 text-base">Reviews & Recommendations</span>
              <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                AI Recommended
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">
                {showRecommendations ? 'Click to hide' : 'Click to expand'}
              </span>
              {showRecommendations ? (
                <ChevronUp className="h-5 w-5 text-blue-600 group-hover:text-blue-700" />
              ) : (
                <ChevronDown className="h-5 w-5 text-blue-600 group-hover:text-blue-700" />
              )}
            </div>
          </button>

          {/* Collapsible Content */}
          {showRecommendations && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Spaced Repetition */}
              <div className="h-[250px] flex flex-col">
                <SpacedRepetitionPanel
                  data={spacedRepetitionData}
                  loading={spacedRepetitionLoading}
                  error={spacedRepetitionError}
                  onStartReview={handleStartLesson}
                  onRetry={handleSpacedRepetitionRetry}
                />
              </div>

              {/* Right Column - AI Recommendations */}
              <div className="h-[250px] flex flex-col">
                <RecommendationSection
                  courseId={activeCourse}
                  recommendations={recommendations}
                  loading={recommendationsLoading}
                  error={recommendationsError}
                  onStartLesson={handleStartLesson}
                  onRetry={handleRecommendationsRetry}
                  courseName={courseData.find(c => c.id === activeCourse)?.subject}
                  startingLessonId={startingLessonId}
                  variant="sidebar"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Course Curriculum - Full Width Below */}
      {hasActiveCourse && (
        <div>
          <CourseCurriculum
            courseId={activeCourse}
            studentId={student?.$id}
            onStartLesson={handleStartLesson}
            startingLessonId={startingLessonId}
          />
        </div>
      )}

      {/* Archived Courses Section */}
      {archivedCourses.length > 0 && (
        <div className="mt-8" data-testid="archived-courses-section">
          <Button
            variant="ghost"
            onClick={() => setShowArchived(!showArchived)}
            className="mb-4 w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 hover:bg-gray-100"
          >
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-gray-700">
                Archived Courses ({archivedCourses.length})
              </span>
            </div>
            {showArchived ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </Button>

          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
              {archivedCourses.map((course: any) => (
                <CourseCard
                  key={course.courseId}
                  course={course}
                  enrollmentStatus="archived"
                  onClick={() => router.push(`/courses/${course.courseId}`)}
                  onEnroll={() => handleReenroll(course.courseId, course.subject)}
                  onUnenroll={() => {}}
                />
              ))}
            </div>
          )}

          {showArchived && archivedCourses.length > 0 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Archived courses preserve all your progress. Click "Re-enroll" to restore a course to your active list.
            </p>
          )}
        </div>
      )}

      {/* T042: Subscription paywall modal */}
      <SubscriptionPaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        priceInfo={subscriptionPrice}
      />
    </div>
  );
}

export default EnhancedStudentDashboard;