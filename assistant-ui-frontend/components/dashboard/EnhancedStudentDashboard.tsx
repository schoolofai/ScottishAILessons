"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CourseNavigationTabs, type CourseData } from "../courses/CourseNavigationTabs";
import { RecommendationSection, type RecommendationsData } from "../recommendations/RecommendationSection";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, BookOpen } from "lucide-react";
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
import { MasteryV2Driver } from "../../lib/appwrite/driver/MasteryV2Driver";
import { Client, Databases, Account, Query, ID } from "appwrite";

// Type imports are handled by the utils file

export function EnhancedStudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [activeCourse, setActiveCourse] = useState<string>("");
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [error, setError] = useState("");
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  useEffect(() => {
    initializeStudent();
  }, []);

  // Initialize student using client-side Appwrite SDK
  const initializeStudent = async () => {
    try {
      setLoading(true);
      setError("");

      // Try client-side initialization using Appwrite directly
      const { Client, Account, Databases, ID, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      // Check if we have a session stored in localStorage and set it explicitly
      // Appwrite stores sessions in cookieFallback as JSON
      let storedSession = null;
      const cookieFallback = localStorage.getItem('cookieFallback');
      if (cookieFallback) {
        try {
          const cookieData = JSON.parse(cookieFallback);
          const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
          storedSession = cookieData[sessionKey];
        } catch (e) {
        }
      }

      if (storedSession) {
        client.setSession(storedSession);
      } else {
        throw new Error('No active session found. Please log in.');
      }

      const account = new Account(client);
      const databases = new Databases(client);

      // Get current user (this should work since we have an active client-side session)
      const user = await account.get();

      // Check if student record exists
      let student;
      try {
        const studentsResult = await databases.listDocuments(
          'default',
          'students',
          [Query.equal('userId', user.$id)]
        );

        if (studentsResult.documents.length > 0) {
          student = studentsResult.documents[0];
        } else {
          // Create student record
          student = await databases.createDocument(
            'default',
            'students',
            ID.unique(),
            {
              userId: user.$id,
              name: user.name || user.email.split('@')[0],
              role: 'student'
            },
            [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
          );
        }
      } catch (error) {
        console.error('Error with student record (detailed):', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error response:', error.response);
        throw new Error(`Failed to initialize student: ${error.message}`);
      }

      setStudent(student);

      // Load courses using client-side approach
      await loadCoursesClientSide(databases, student);
    } catch (err) {
      console.error("Client-side initialization error:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize student");
    } finally {
      setLoading(false);
    }
  };

  // Load courses using client-side Appwrite SDK - MVP2 Phase 1: Enrollment Filtering
  const loadCoursesClientSide = async (databases: any, student: any) => {
    try {
      setCoursesLoading(true);
      setCoursesError(null);

      const { Query } = await import('appwrite');

      // 1. Get student's enrollments
      const enrollmentsResult = await databases.listDocuments(
        'default',
        'enrollments',
        [Query.equal('studentId', student.$id)]
      );

      // 2. Check if student has any enrollments
      if (enrollmentsResult.documents.length === 0) {
        // NO ENROLLMENTS - Redirect to course catalog
        console.log('[Dashboard] No enrollments found, redirecting to catalog');
        // TODO: router.push('/courses/catalog') when catalog page exists
        setCoursesError('No enrollments found. Please enroll in a course to get started.');
        return;
      }

      // 3. Get enrolled course IDs
      const enrolledCourseIds = enrollmentsResult.documents.map((e: any) => e.courseId);

      // 4. Fetch only enrolled courses
      const coursesResult = await databases.listDocuments(
        'default',
        'courses',
        [Query.equal('courseId', enrolledCourseIds)]
      );

      const coursesData = coursesResult.documents;
      setCourses(coursesData);

      // 5. Transform courses for navigation tabs using utility function
      const transformedCourses = transformCoursesForNavigation(coursesData);
      setCourseData(transformedCourses);

      console.log('[Dashboard] Loaded enrolled courses:', {
        enrollmentCount: enrollmentsResult.documents.length,
        courseCount: transformedCourses.length
      });

      // 6. Set initial active course
      if (transformedCourses.length > 0 && !activeCourse) {
        const firstCourse = transformedCourses[0];
        setActiveCourse(firstCourse.id);
        // Load recommendations for the first course
        await loadRecommendations(firstCourse.id, student);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load courses:', err);
      setCoursesError(formatErrorMessage(err));
    } finally {
      setCoursesLoading(false);
    }
  };

  // Load recommendations for a specific course using LangGraph Course Manager
  const loadRecommendations = async (courseId: string, studentData?: any) => {
    try {
      setRecommendationsLoading(true);
      setRecommendationsError(null);

      // Initialize Appwrite client
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '');

      const databases = new Databases(client);

      // 1. Get student data (use parameter or state)
      const currentStudent = studentData || student;
      if (!currentStudent) {
        throw new Error('Student data not available');
      }

      // 2. Get course data - query by courseId field instead of using it as document ID
      const courseQueryResult = await databases.listDocuments(
        'default',
        'courses',
        [Query.equal('courseId', courseId)]
      );

      if (courseQueryResult.documents.length === 0) {
        throw new Error(`Course with courseId ${courseId} not found`);
      }

      const course = courseQueryResult.documents[0];

      // 3. Get lesson templates for the course (use original courseId, not document $id)
      const templatesResult = await databases.listDocuments(
        'default',
        'lesson_templates',
        [Query.equal('courseId', course.courseId)]
      );

      // 4. Get mastery records using MasteryV2Driver
      // Get session token for authenticated driver calls
      // First, set the session from localStorage to the client
      let sessionToken = '';
      try {
        const storedSession = localStorage.getItem(`a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`);
        if (storedSession) {
          client.setSession(storedSession);
          sessionToken = storedSession;
        }
      } catch (e) {
        // Fallback: use empty token (driver will handle auth through client)
        sessionToken = '';
      }

      const masteryV2Driver = new MasteryV2Driver(sessionToken);
      const masteryV2Record = await masteryV2Driver.getMasteryV2(currentStudent.$id, course.courseId);

      // Convert MasteryV2 to legacy format for compatibility
      let masteryData = [];
      if (masteryV2Record) {
        const emaByOutcome = masteryV2Record.emaByOutcomeId || {};

        // Convert EMA data to legacy mastery format for templates
        masteryData = Object.entries(emaByOutcome).map(([outcomeId, ema]) => ({
          outcomeRef: outcomeId,
          masteryLevel: ema // Use EMA score as mastery level
        }));
      }

      // 5. Routine data removed - keeping spaced repetition separate from recommendations

      // 6. Get SOW data - SOWV2 ONLY (no fallbacks)
      console.log('[SOW Query] Attempting SOWV2 query with:', {
        studentId: currentStudent.$id,
        courseId: course.courseId
      });

      const sowResult = await databases.listDocuments(
        'default',
        'SOWV2',
        [
          Query.equal('studentId', currentStudent.$id),
          Query.equal('courseId', course.courseId)
        ]
      );

      // Fast fail if no SOW data
      if (sowResult.documents.length === 0) {
        const error = new Error(
          `No SOWV2 data found for student: ${currentStudent.$id}, course: ${course.courseId}. ` +
          `SOWV2 collection must be populated for this enrollment.`
        );
        console.error('[SOW Query] FAILED:', error.message);
        throw error;
      }

      console.log('[SOW Query] SUCCESS - Found SOWV2 documents:', sowResult.documents.length);

      // Phase 1: Data Collection Complete
      console.log('[Recommendation Phase 1 - Data Collection]', {
        student: currentStudent,
        course: course,
        templates: templatesResult.documents,
        mastery: masteryV2Record,
        sow: sowResult.documents
      });

      // 7. Build complete scheduling context (matching Task 7 isolation test format)

      // Debug SOW data transformation
      console.log('[SOW Debug] Raw SOWV2 document:', sowResult.documents[0]);

      let sowEntries = [];
      if (sowResult.documents.length > 0) {
        const rawEntries = sowResult.documents[0].entries || '[]';
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
          outcomeRefs: JSON.parse(template.outcomeRefs || '[]'),
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

      // 8. Call LangGraph Course Manager using SDK
      const { Client: LangGraphClient } = await import('@langchain/langgraph-sdk');
      const langGraphClient = new LangGraphClient({
        apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || 'http://localhost:2024'
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

  // Handle course change
  const handleCourseChange = useCallback(async (courseId: string) => {
    setActiveCourse(courseId);
    await loadRecommendations(courseId, student);
  }, [student]);

  // Handle lesson start
  const handleStartLesson = async (lessonTemplateId: string) => {
    try {
      // Validate lesson start context
      const validation = validateLessonStartContext(
        lessonTemplateId,
        activeCourse,
        recommendations?.thread_id
      );

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      debugLog('Starting lesson', {
        lessonTemplateId,
        courseId: activeCourse,
        threadId: recommendations?.thread_id
      });

      // Use the refactored session manager utility
      const { createLessonSession } = await import('@/lib/sessions/session-manager');

      const newSession = await createLessonSession({
        lessonTemplateId,
        studentId: student.$id,
        courseId: activeCourse,
        threadId: recommendations?.thread_id  // Pass existing thread for continuity
      });

      debugLog('Session created, navigating', { sessionId: newSession.$id });

      // Navigate to session page - let AutoStartTrigger handle the rest!
      router.push(`/session/${newSession.$id}`);
    } catch (err) {
      console.error("Failed to start lesson:", err);
      setError(formatErrorMessage(err));
    }
  };

  // Handle recommendations retry
  const handleRecommendationsRetry = useCallback(() => {
    if (activeCourse && student) {
      loadRecommendations(activeCourse, student);
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
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="dashboard-loading">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
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

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="student-dashboard">
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
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full"
              >
                {course.subject}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Course Navigation */}
      <div data-testid="course-navigation-section" className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <BookOpen className="h-5 w-5 mr-2" />
          Your Courses
        </h2>
        <CourseNavigationTabs
          courses={courseData}
          activeCourse={activeCourse}
          onCourseChange={handleCourseChange}
          loading={coursesLoading}
          error={coursesError}
        />
      </div>

      {/* Recommendations Section */}
      {hasActiveCourse && (
        <div>
          <RecommendationSection
            courseId={activeCourse}
            recommendations={recommendations}
            loading={recommendationsLoading}
            error={recommendationsError}
            onStartLesson={handleStartLesson}
            onRetry={handleRecommendationsRetry}
            courseName={courseData.find(c => c.id === activeCourse)?.subject}
          />
        </div>
      )}
    </div>
  );
}

export default EnhancedStudentDashboard;