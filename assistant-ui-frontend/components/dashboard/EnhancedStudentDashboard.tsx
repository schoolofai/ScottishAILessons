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
          console.log('Found session in cookieFallback:', !!storedSession);
        } catch (e) {
          console.log('Failed to parse cookieFallback:', e);
        }
      }

      if (storedSession) {
        console.log('Setting session from localStorage');
        client.setSession(storedSession);
      } else {
        console.log('No session found in localStorage');
        throw new Error('No active session found. Please log in.');
      }

      const account = new Account(client);
      const databases = new Databases(client);

      // Get current user (this should work since we have an active client-side session)
      const user = await account.get();
      console.log('Current user from client-side:', user);

      // Check if student record exists
      let student;
      try {
        console.log('Attempting to list students for userId:', user.$id);
        const studentsResult = await databases.listDocuments(
          'default',
          'students',
          [Query.equal('userId', user.$id)]
        );
        console.log('Students query result:', studentsResult);

        if (studentsResult.documents.length > 0) {
          student = studentsResult.documents[0];
          console.log('Found existing student:', student);
        } else {
          console.log('No student found, creating new student record');
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
          console.log('Created new student:', student);
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

  // Load courses using client-side Appwrite SDK
  const loadCoursesClientSide = async (databases: any, student: any) => {
    try {
      setCoursesLoading(true);
      setCoursesError(null);

      console.log('Getting courses...');
      const coursesResult = await databases.listDocuments('default', 'courses');
      console.log('Courses result:', coursesResult);

      // Check enrollment and auto-enroll if needed
      console.log('Checking enrollments...');
      const { Query } = await import('appwrite');
      const enrollmentsResult = await databases.listDocuments(
        'default',
        'enrollments',
        [
          Query.equal('studentId', student.$id),
          Query.equal('courseId', 'C844 73')
        ]
      );
      console.log('Enrollments result:', enrollmentsResult);

      if (enrollmentsResult.documents.length === 0) {
        console.log('Auto-enrolling student in National 3 course...');
        const { ID } = await import('appwrite');
        // Auto-enroll in National 3 course
        await databases.createDocument(
          'default',
          'enrollments',
          ID.unique(),
          {
            studentId: student.$id,
            courseId: 'C844 73',
            role: 'student'
          },
          [`read("user:${student.userId}")`, `write("user:${student.userId}")`]
        );
        console.log('Auto-enrollment completed');
      }

      const coursesData = coursesResult.documents;
      setCourses(coursesData);

      // Transform courses for navigation tabs using utility function
      const transformedCourses = transformCoursesForNavigation(coursesData);
      setCourseData(transformedCourses);

      debugLog('Courses loaded and transformed', { count: transformedCourses.length });

      // Set initial active course
      if (transformedCourses.length > 0 && !activeCourse) {
        const firstCourse = transformedCourses[0];
        setActiveCourse(firstCourse.id);
        // Load recommendations for the first course
        await loadRecommendations(firstCourse.id, student);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
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

      console.log('[Recommendations Debug] Loading recommendations from LangGraph Course Manager for course:', courseId);

      // Get client-side Appwrite SDK components for data extraction
      const { Client, Account, Databases, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      // Use existing session
      const cookieFallback = localStorage.getItem('cookieFallback');
      if (cookieFallback) {
        const cookieData = JSON.parse(cookieFallback);
        const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
        const storedSession = cookieData[sessionKey];
        if (storedSession) {
          client.setSession(storedSession);
        }
      }

      const databases = new Databases(client);

      // Extract complete scheduling context from Appwrite (following Task 7 isolation test)
      console.log('[Recommendations Debug] Extracting scheduling context from Appwrite...');

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
      console.log('[Recommendations Debug] Course found:', course.subject);

      // 3. Get lesson templates for the course (use original courseId, not document $id)
      const templatesResult = await databases.listDocuments(
        'default',
        'lesson_templates',
        [Query.equal('courseId', course.courseId)]
      );
      console.log('[Recommendations Debug] Found', templatesResult.total, 'lesson templates');

      // 4. Get mastery records for student
      const masteryResult = await databases.listDocuments(
        'default',
        'mastery',
        [Query.equal('studentId', currentStudent.$id)]
      );
      console.log('[Recommendations Debug] Found', masteryResult.total, 'mastery records');

      // 5. Get routine data for student
      const routineResult = await databases.listDocuments(
        'default',
        'routine',
        [Query.equal('studentId', currentStudent.$id)]
      );
      console.log('[Recommendations Debug] Found', routineResult.total, 'routine records');

      // 6. Get SOW (Scheme of Work) data for course (use original courseId, not document $id)
      const sowResult = await databases.listDocuments(
        'default',
        'sow',
        [Query.equal('courseId', course.courseId)]
      );
      console.log('[Recommendations Debug] Found', sowResult.total, 'SOW records');

      // 7. Build complete scheduling context (matching Task 7 isolation test format)
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
          estMinutes: template.estMinutes || 30,
          sowUnit: template.sowUnit || '',
          sowWeek: template.sowWeek || 1
        })),
        mastery: masteryResult.documents.map(record => ({
          templateId: record.templateId,
          masteryLevel: record.masteryLevel
        })),
        routine: routineResult.documents.map(record => ({
          templateId: record.templateId,
          lastSessionDate: record.lastSessionDate,
          daysSinceLastSession: record.daysSinceLastSession
        })),
        sow: sowResult.documents.map(record => ({
          templateId: record.templateId,
          week: record.week,
          currentWeek: record.currentWeek
        }))
      };

      console.log('[Recommendations Debug] Built scheduling context:', {
        student: context.student.name,
        course: context.course.title,
        templates: context.templates.length,
        mastery: context.mastery.length,
        routine: context.routine.length,
        sow: context.sow.length
      });

      // 8. Call LangGraph Course Manager using SDK (matching isolation test pattern)
      console.log('[Recommendations Debug] Calling LangGraph Course Manager...');

      const { Client: LangGraphClient } = await import('@langchain/langgraph-sdk');
      const langGraphClient = new LangGraphClient({
        apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || 'http://localhost:2024'
      });

      // Create thread for Course Manager
      const thread = await langGraphClient.threads.create();
      console.log('[Recommendations Debug] Created LangGraph thread:', thread.thread_id);

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
      console.log('[Recommendations Debug] Started LangGraph run:', run.run_id);

      // Wait for completion
      console.log('[Recommendations Debug] Waiting for Course Manager to complete...');
      const result = await langGraphClient.runs.join(thread.thread_id, run.run_id);

      // Get final state
      const state = await langGraphClient.threads.getState(thread.thread_id);
      console.log('[Recommendations Debug] Course Manager completed with status:', result.status);

      // Extract recommendation from state
      let courseRecommendation;
      if (state.values?.course_recommendation) {
        courseRecommendation = state.values.course_recommendation;
      } else {
        // Fallback: look in messages
        const messages = state.values?.messages || [];
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.content) {
            try {
              const parsed = JSON.parse(lastMessage.content);
              if (parsed.course_recommendation) {
                courseRecommendation = parsed.course_recommendation;
              }
            } catch (e) {
              console.warn('[Recommendations Debug] Failed to parse message content as JSON');
            }
          }
        }
      }

      if (!courseRecommendation) {
        throw new Error('No course recommendation found in LangGraph response');
      }

      console.log('[Recommendations Debug] Extracted course recommendation:', courseRecommendation);

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

      setRecommendations(transformedRecommendations);
      console.log('[Recommendations Debug] LangGraph recommendations loaded successfully:', transformedRecommendations.candidates.length, 'candidates');
    } catch (err) {
      console.error("Failed to load recommendations from LangGraph:", err);
      setRecommendationsError(err instanceof Error ? err.message : "Failed to load recommendations from Course Manager");
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