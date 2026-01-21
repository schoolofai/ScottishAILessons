'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { RecommendationSection, type RecommendationsData } from '../recommendations/RecommendationSection';
import { CourseProgressCard } from '../progress/CourseProgressCard';
import { CourseCurriculum } from '../curriculum/CourseCurriculum';
import { SpacedRepetitionPanel } from './SpacedRepetitionPanel';
import { MiniProgressRing } from '../progress/MiniProgressRing';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionPaywallModal, type PriceInfo } from './SubscriptionPaywallModal';
import { cache, createCacheKey } from '@/lib/cache';
import {
  ArrowLeft,
  Loader2,
  FileText,
  ClipboardList,
  FileQuestion,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

/**
 * Level color mapping for design system
 */
const LEVEL_COLORS: Record<string, string> = {
  'national-3': 'var(--level-n3, #22C55E)',
  'national-4': 'var(--level-n4, #3B82F6)',
  'national-5': 'var(--level-n5, #8B5CF6)',
  'higher': 'var(--level-higher, #F97316)',
  'advanced-higher': 'var(--level-adv-higher, #EF4444)',
};

const LEVEL_BADGE_CLASSES: Record<string, string> = {
  'national-3': 'bg-green-100 text-green-800 border-green-200',
  'national-4': 'bg-blue-100 text-blue-800 border-blue-200',
  'national-5': 'bg-purple-100 text-purple-800 border-purple-200',
  'higher': 'bg-orange-100 text-orange-800 border-orange-200',
  'advanced-higher': 'bg-red-100 text-red-800 border-red-200',
};

interface CourseDetailViewProps {
  courseId: string;
  onBack: () => void;
}

/**
 * Parse mastery keys for display
 */
function parseMasteryKey(key: string): {
  isComposite: boolean;
  documentId: string;
  asCode?: string;
} {
  if (key.includes('#')) {
    const [documentId, asCode] = key.split('#');
    return { isComposite: true, documentId: documentId.trim(), asCode: asCode.trim() };
  }
  return { isComposite: false, documentId: key };
}

/**
 * Format subject name for display
 */
function formatSubjectName(subject: string): string {
  return subject
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format level name for display
 */
function formatLevelName(level: string): string {
  return level
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * CourseDetailView - Full course content view for a specific course
 *
 * Contains:
 * - Course header with progress ring
 * - Exam buttons (Mock Exam, Past Papers, NAT5+)
 * - Spaced Repetition panel
 * - AI Recommendations section
 * - Full course curriculum
 */
export function CourseDetailView({ courseId, onBack }: CourseDetailViewProps) {
  const router = useRouter();

  // Student data
  const [student, setStudent] = useState<any>(null);
  const [courseInfo, setCourseInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Course-specific states
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [spacedRepetitionData, setSpacedRepetitionData] = useState<any>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [cheatSheetAvailable, setCheatSheetAvailable] = useState<boolean | null>(null);

  // Loading states
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [spacedRepetitionLoading, setSpacedRepetitionLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [spacedRepetitionError, setSpacedRepetitionError] = useState<string | null>(null);

  // Exam availability states
  const [mockExamAvailable, setMockExamAvailable] = useState(false);
  const [mockExamId, setMockExamId] = useState<string | null>(null);
  const [mockExamLoading, setMockExamLoading] = useState(false);
  const [pastPapersAvailable, setPastPapersAvailable] = useState(false);
  const [pastPapersSubject, setPastPapersSubject] = useState<string | null>(null);
  const [pastPapersLevel, setPastPapersLevel] = useState<string | null>(null);
  const [pastPapersLoading, setPastPapersLoading] = useState(false);
  const [nat5ExamsAvailable, setNat5ExamsAvailable] = useState(false);
  const [nat5ExamsCount, setNat5ExamsCount] = useState(0);
  const [nat5ExamsLoading, setNat5ExamsLoading] = useState(false);

  // Lesson start state
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null);

  // Recommendations section collapse state
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Subscription state
  const { hasAccess } = useSubscription();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<PriceInfo | null>(null);

  // Check if course is NAT5+ eligible
  const isNat5PlusLevel = useCallback((level: string): boolean => {
    const nat5PlusLevels = ['national-5', 'higher', 'advanced-higher'];
    return nat5PlusLevels.includes(level.toLowerCase());
  }, []);

  const isActiveCourseNat5Plus = useMemo(() => {
    if (!courseInfo) return false;
    return isNat5PlusLevel(courseInfo.level || '');
  }, [courseInfo, isNat5PlusLevel]);

  // ============================================================================
  // DATA LOADING FUNCTIONS
  // ============================================================================

  const checkCheatSheetAvailability = useCallback(async (cId: string) => {
    try {
      const { RevisionNotesDriver } = await import('@/lib/appwrite/driver/RevisionNotesDriver');
      const driver = new RevisionNotesDriver();
      const isAvailable = await driver.courseCheatSheetExists(cId);
      setCheatSheetAvailable(isAvailable);
    } catch {
      setCheatSheetAvailable(false);
    }
  }, []);

  const checkMockExamAvailability = useCallback(async (cId: string) => {
    try {
      setMockExamLoading(true);
      const response = await fetch(`/api/exam/availability/${cId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMockExamAvailable(data.available);
        setMockExamId(data.examId);
      } else {
        setMockExamAvailable(false);
        setMockExamId(null);
      }
    } catch {
      setMockExamAvailable(false);
      setMockExamId(null);
    } finally {
      setMockExamLoading(false);
    }
  }, []);

  const checkPastPapersAvailability = useCallback(async (cId: string) => {
    try {
      setPastPapersLoading(true);
      const response = await fetch(`/api/past-papers/availability/${cId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPastPapersAvailable(data.available);
        setPastPapersSubject(data.subjectSlug || null);
        setPastPapersLevel(data.levelSlug || null);
      } else {
        setPastPapersAvailable(false);
        setPastPapersSubject(null);
        setPastPapersLevel(null);
      }
    } catch {
      setPastPapersAvailable(false);
      setPastPapersSubject(null);
      setPastPapersLevel(null);
    } finally {
      setPastPapersLoading(false);
    }
  }, []);

  const checkNat5ExamAvailability = useCallback(async (cId: string) => {
    try {
      setNat5ExamsLoading(true);
      const response = await fetch(`/api/sqa-mock-exam?courseId=${cId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setNat5ExamsAvailable(data.total > 0);
        setNat5ExamsCount(data.total || 0);
      } else {
        setNat5ExamsAvailable(false);
        setNat5ExamsCount(0);
      }
    } catch {
      setNat5ExamsAvailable(false);
      setNat5ExamsCount(0);
    } finally {
      setNat5ExamsLoading(false);
    }
  }, []);

  const loadSpacedRepetition = useCallback(async (cId: string, studentData: any) => {
    if (!studentData) return;
    try {
      setSpacedRepetitionLoading(true);
      setSpacedRepetitionError(null);
      const response = await fetch(`/api/student/spaced-repetition/${cId}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load spaced repetition data' }));
        throw new Error(errorData.error || 'Failed to fetch spaced repetition data');
      }
      const { data: spacedRepData } = await response.json();
      setSpacedRepetitionData(spacedRepData);
    } catch (err) {
      setSpacedRepetitionError(err instanceof Error ? err.message : 'Failed to load spaced repetition data');
    } finally {
      setSpacedRepetitionLoading(false);
    }
  }, []);

  const loadRecommendations = useCallback(async (cId: string, studentData: any) => {
    try {
      setRecommendationsLoading(true);
      setRecommendationsError(null);

      // Backend availability check
      try {
        const { checkBackendAvailability } = await import('@/lib/backend-status');
        await checkBackendAvailability();
      } catch (backendError) {
        throw new Error('Your AI recommendation system is currently not available. Please ensure the backend service is running.');
      }

      if (!studentData) {
        throw new Error('Student data not available');
      }

      // Check cache first
      const cacheKey = createCacheKey('recommendations', studentData.$id, cId);
      const cachedRecommendations = cache.get<RecommendationsData>(cacheKey);
      if (cachedRecommendations) {
        setRecommendations(cachedRecommendations);
        setRecommendationsLoading(false);
        return;
      }

      // Fetch recommendations data
      const recommendationsDataResponse = await fetch(`/api/student/recommendations-data/${cId}`, {
        method: 'GET',
        credentials: 'include',
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

      // Convert MasteryV2 to legacy format
      let masteryData: any[] = [];
      if (masteryV2Record) {
        const emaByOutcome = masteryV2Record.emaByOutcome || {};
        masteryData = Object.entries(emaByOutcome).map(([key, ema]) => {
          const displayRef = parseMasteryKey(key);
          return {
            outcomeRef: displayRef.isComposite ? displayRef.asCode : key,
            masteryLevel: ema,
            rawKey: key,
            keyType: displayRef.isComposite ? 'assessment_standard' : 'outcome'
          };
        });
      }

      // Validate SOW data
      if (!sowDocuments || sowDocuments.length === 0) {
        throw new Error(`No SOWV2 data found for student: ${studentData.$id}, course: ${course.courseId}.`);
      }

      // Build scheduling context
      let sowEntries: any[] = [];
      if (sowDocuments.length > 0) {
        const rawEntries = sowDocuments[0].entries || '[]';
        try {
          const parsedEntries = JSON.parse(rawEntries);
          sowEntries = parsedEntries.map((entry: any) => ({
            templateId: entry.lessonTemplateId,
            order: entry.order,
            plannedAt: entry.plannedAt
          }));
        } catch {
          // Silent fail for parsing
        }
      }

      const context = {
        mode: "course_manager",
        student: {
          id: studentData.$id,
          name: studentData.name,
          email: studentData.email || `${studentData.name}@example.com`
        },
        course: {
          $id: course.$id,
          courseId: course.courseId,
          subject: course.subject,
          sqaCode: course.sqaCode || ''
        },
        templates: templatesResult.documents.map((template: any) => ({
          $id: template.$id,
          title: template.title,
          outcomeRefs: template.outcomeRefs || [],
          estMinutes: template.estMinutes || 30
        })),
        mastery: masteryData.map(record => ({
          outcomeRef: record.outcomeRef,
          masteryLevel: record.masteryLevel
        })),
        sow: sowEntries
      };

      // Call LangGraph Course Manager
      const { Client: LangGraphClient } = await import('@langchain/langgraph-sdk');
      const langGraphClient = new LangGraphClient({
        apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || 'http://localhost:2024',
        apiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY,
      });

      const thread = await langGraphClient.threads.create();
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

      await langGraphClient.runs.join(thread.thread_id, run.run_id);
      const state = await langGraphClient.threads.getState(thread.thread_id);

      const courseRecommendation = state.values?.course_recommendation;
      if (!courseRecommendation) {
        throw new Error(`No course_recommendation found in LangGraph state.`);
      }

      const transformedRecommendations: RecommendationsData = {
        available: true,
        recommendations_ready: true,
        thread_id: thread.thread_id,
        candidates: courseRecommendation.recommendations?.map((rec: any) => ({
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

      cache.set(cacheKey, transformedRecommendations, 5 * 60 * 1000);
      setRecommendations(transformedRecommendations);
    } catch (err) {
      if (err instanceof Error && err.message.includes('SOWV2')) {
        setRecommendationsError(`SOW Data Missing: ${err.message}`);
      } else {
        setRecommendationsError(err instanceof Error ? err.message : "Failed to load recommendations from Course Manager");
      }
    } finally {
      setRecommendationsLoading(false);
    }
  }, []);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const initializeCourseView = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch student data
        const studentResponse = await fetch('/api/student/me');
        if (!studentResponse.ok) {
          if (studentResponse.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch student data');
        }
        const studentData = await studentResponse.json();
        if (!studentData.success) {
          throw new Error(studentData.error || 'Failed to load student data');
        }
        setStudent(studentData.student);

        // Fetch course info from enrollments
        const enrollmentsResponse = await fetch('/api/student/enrollments');
        if (!enrollmentsResponse.ok) {
          throw new Error('Failed to fetch enrollments');
        }
        const enrollmentsResult = await enrollmentsResponse.json();
        if (!enrollmentsResult.success) {
          throw new Error(enrollmentsResult.error || 'Failed to load enrollments');
        }

        const allCourses = [
          ...enrollmentsResult.data.courses.active,
          ...enrollmentsResult.data.courses.archived
        ];
        const currentCourse = allCourses.find((c: any) => c.courseId === courseId);

        if (!currentCourse) {
          throw new Error(`Course ${courseId} not found in enrollments`);
        }
        setCourseInfo(currentCourse);

        // Load all course-dependent data in parallel
        await Promise.all([
          checkCheatSheetAvailability(courseId),
          checkMockExamAvailability(courseId),
          checkPastPapersAvailability(courseId),
          checkNat5ExamAvailability(courseId),
          loadSpacedRepetition(courseId, studentData.student),
        ]);

        // Defer recommendations (non-blocking)
        loadRecommendations(courseId, studentData.student);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    initializeCourseView();
  }, [courseId, router, checkCheatSheetAvailability, checkMockExamAvailability, checkPastPapersAvailability, checkNat5ExamAvailability, loadSpacedRepetition, loadRecommendations]);

  // Prefetch subscription price
  useEffect(() => {
    const fetchSubscriptionPrice = async () => {
      try {
        const response = await fetch('/api/stripe/product-info');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionPrice(data);
        }
      } catch {
        // Silently fail
      }
    };
    fetchSubscriptionPrice();
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleStartLesson = async (lessonTemplateId: string) => {
    try {
      if (!hasAccess) {
        setShowPaywallModal(true);
        return;
      }

      setStartingLessonId(lessonTemplateId);

      const response = await fetch('/api/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTemplateId,
          courseId,
          threadId: recommendations?.thread_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(errorData.error || 'Failed to create session');
      }

      const { sessionId } = await response.json();

      // Invalidate caches
      if (student) {
        const cacheKey = createCacheKey('recommendations', student.$id, courseId);
        cache.invalidate(cacheKey);
      }

      router.push(`/session/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start lesson');
      setStartingLessonId(null);
    }
  };

  const handleStartMockExam = useCallback(() => {
    if (!mockExamId) return;
    if (!hasAccess) {
      setShowPaywallModal(true);
      return;
    }
    router.push(`/exam/${mockExamId}`);
  }, [mockExamId, hasAccess, router]);

  const handleOpenNat5ExamHub = useCallback(() => {
    if (!hasAccess) {
      setShowPaywallModal(true);
      return;
    }
    router.push(`/sqa-mock-exam?courseId=${courseId}`);
  }, [hasAccess, courseId, router]);

  const handleRecommendationsRetry = useCallback(() => {
    if (student) {
      const cacheKey = createCacheKey('recommendations', student.$id, courseId);
      cache.invalidate(cacheKey);
      loadRecommendations(courseId, student);
    }
  }, [courseId, student, loadRecommendations]);

  const handleSpacedRepetitionRetry = useCallback(() => {
    if (student) {
      loadSpacedRepetition(courseId, student);
    }
  }, [courseId, student, loadSpacedRepetition]);

  const handleViewProgress = useCallback(() => {
    router.push(`/dashboard/progress/${courseId}`);
  }, [courseId, router]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading course...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const levelKey = (courseInfo?.level || '').toLowerCase();
  const levelColor = LEVEL_COLORS[levelKey] || 'var(--wizard-blue)';
  const levelBadgeClass = LEVEL_BADGE_CLASSES[levelKey] || 'bg-gray-100 text-gray-800';

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="course-detail-view">
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-gray-100">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      {/* Course Header + Exam Tools */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Course Header Card */}
        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-start gap-4">
              <MiniProgressRing
                percentage={courseInfo?.progress || 0}
                color={levelColor}
                size={80}
              />
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">
                  {formatSubjectName(courseInfo?.subject || '')}
                </CardTitle>
                <Badge variant="outline" className={`${levelBadgeClass} border`}>
                  {formatLevelName(courseInfo?.level || '')}
                </Badge>
                <p className="text-gray-500 mt-2">
                  {courseInfo?.completedLessons || 0}/{courseInfo?.totalLessons || 0} lessons completed
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Course Tools Card */}
        <Card className="lg:w-[280px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Course Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Mock Exam Button */}
            {mockExamAvailable && mockExamId && (
              <Button
                onClick={handleStartMockExam}
                disabled={mockExamLoading}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                data-testid="take-mock-exam-button"
              >
                {mockExamLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Take Mock Exam
              </Button>
            )}

            {/* Past Papers Button */}
            {pastPapersAvailable && pastPapersSubject && pastPapersLevel && (
              <Button
                onClick={() => router.push(`/past-papers/${encodeURIComponent(pastPapersSubject)}/${encodeURIComponent(pastPapersLevel)}`)}
                disabled={pastPapersLoading}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                data-testid="browse-past-papers-button"
              >
                {pastPapersLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
                Past Papers
              </Button>
            )}

            {/* NAT5+ Mock Exams Button */}
            {isActiveCourseNat5Plus && (
              <Button
                onClick={handleOpenNat5ExamHub}
                disabled={nat5ExamsLoading}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                data-testid="nat5-mock-exams-button"
              >
                {nat5ExamsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileQuestion className="h-4 w-4" />
                )}
                Mock Exams{nat5ExamsCount > 0 ? ` (${nat5ExamsCount})` : ''}
              </Button>
            )}

            {/* No tools available message */}
            {!mockExamAvailable && !pastPapersAvailable && !isActiveCourseNat5Plus && (
              <p className="text-sm text-gray-500 text-center py-2">
                No exam tools available for this course yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course Progress Card */}
      {courseProgress && !progressLoading && (
        <CourseProgressCard
          progress={courseProgress}
          onViewDetails={handleViewProgress}
          cheatSheetAvailable={cheatSheetAvailable}
          courseId={courseId}
        />
      )}

      {/* Reviews & Recommendations */}
      {student && (
        <div className="mb-6">
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

          {showRecommendations && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[250px] flex flex-col">
                <SpacedRepetitionPanel
                  data={spacedRepetitionData}
                  loading={spacedRepetitionLoading}
                  error={spacedRepetitionError}
                  onStartReview={handleStartLesson}
                  onRetry={handleSpacedRepetitionRetry}
                />
              </div>
              <div className="h-[250px] flex flex-col">
                <RecommendationSection
                  courseId={courseId}
                  recommendations={recommendations}
                  loading={recommendationsLoading}
                  error={recommendationsError}
                  onStartLesson={handleStartLesson}
                  onRetry={handleRecommendationsRetry}
                  courseName={courseInfo?.subject}
                  startingLessonId={startingLessonId}
                  variant="sidebar"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Course Curriculum */}
      <CourseCurriculum
        courseId={courseId}
        studentId={student?.$id}
        onStartLesson={handleStartLesson}
        startingLessonId={startingLessonId}
      />

      {/* Subscription Paywall Modal */}
      <SubscriptionPaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        priceInfo={subscriptionPrice}
      />
    </div>
  );
}

export default CourseDetailView;
