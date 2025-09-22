"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Course {
  $id: string;
  courseId: string;
  subject: string;
  phase: string;
  level: string;
}

interface LessonTemplate {
  $id: string;
  courseId: string;
  title: string;
  outcomeRefs: string;
  cards: string;
  version: number;
  status: string;
}

interface Session {
  $id: string;
  studentId: string;
  courseId: string;
  lessonTemplateId?: string;
  startedAt: string;
  endedAt?: string;
  stage: string;
}

export function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessonTemplates, setLessonTemplates] = useState<LessonTemplate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSessionsExpanded, setIsSessionsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const sessionsPerPage = 5;

  useEffect(() => {
    initializeStudent();
  }, []);

  const initializeStudent = async () => {
    try {
      setLoading(true);
      
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
        console.log('Setting session from localStorage:', storedSession.substring(0, 50) + '...');
        client.setSession(storedSession);
      } else {
        console.log('No session found in localStorage');
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

      // Get courses
      console.log('Getting courses...');
      const coursesResult = await databases.listDocuments('default', 'courses');
      console.log('Courses result:', coursesResult);
      
      // Get lesson templates
      console.log('Getting lesson templates...');
      const templatesResult = await databases.listDocuments(
        'default', 
        'lesson_templates',
        [Query.equal('status', 'published')]
      );
      console.log('Templates result:', templatesResult);
      
      // Check enrollment and auto-enroll if needed
      console.log('Checking enrollments...');
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
          [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
        );
        console.log('Auto-enrollment completed');
      }
      
      // Get student's sessions with proper ordering and pagination
      console.log('Getting student sessions...');
      const sessionsResult = await databases.listDocuments(
        'default',
        'sessions',
        [
          Query.equal('studentId', student.$id),
          Query.orderDesc('startedAt'),  // Most recent first
          Query.limit(100)  // Load up to 100 most recent sessions
        ]
      );
      console.log('Sessions result:', sessionsResult);

      console.log('All data loaded successfully, setting state...');
      
      // Clear any previous error state first
      setError('');
      
      setStudent(student);
      setCourses(coursesResult.documents);
      setLessonTemplates(templatesResult.documents);
      setSessions(sessionsResult.documents);
      
      console.log('State set successfully! Dashboard should load now.');
      
    } catch (err) {
      console.error('Client-side initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize student');
    } finally {
      setLoading(false);
    }
  };

  const startLesson = async (lessonTemplateId: string) => {
    try {
      // Use the refactored session manager utility
      const { createLessonSession } = await import('@/lib/sessions/session-manager');

      const newSession = await createLessonSession({
        lessonTemplateId,
        studentId: student.$id,
        courseId: 'C844 73'
        // No threadId - will be created by MyAssistant when teaching starts
      });

      console.log('Session created:', newSession);
      router.push(`/session/${newSession.$id}`);
    } catch (err) {
      console.error('Session creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start lesson');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
          <button 
            onClick={initializeStudent}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Sort sessions by most recent first (already ordered by Query.orderDesc in fetch)
  const allSessionsForHistory = sessions;

  // Calculate pagination for session history
  const totalPages = Math.ceil(allSessionsForHistory.length / sessionsPerPage);
  const startIndex = (currentPage - 1) * sessionsPerPage;
  const paginatedSessions = allSessionsForHistory.slice(startIndex, startIndex + sessionsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleSessionsExpanded = () => {
    setIsSessionsExpanded(!isSessionsExpanded);
    if (!isSessionsExpanded) {
      setCurrentPage(1); // Reset to first page when opening
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {student?.name || 'Student'}!
        </h1>
        <p className="text-gray-600">
          Continue your mathematics learning journey with Scottish AI Lessons.
        </p>
      </div>

      {/* Available Lessons Section - Now at the top */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Available Lessons
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lessonTemplates.map(template => (
            <div key={template.$id} className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">
                {template.title}
              </h3>
              <div className="text-sm text-gray-600 mb-3">
                <p>Course: {courses.find(c => c.courseId === template.courseId)?.subject}</p>
                <p>Level: National 3</p>
              </div>
              <button
                onClick={() => startLesson(template.$id)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Start Lesson
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Previous Sessions Section */}
      {allSessionsForHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <button
            onClick={toggleSessionsExpanded}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Previous Lessons
              </h2>
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                {allSessionsForHistory.length}
              </span>
            </div>
            <div className="flex items-center">
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  isSessionsExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {isSessionsExpanded && (
            <div className="px-6 pb-6">
              <div className="space-y-3 mb-4">
                {paginatedSessions.map(session => {
                  const template = lessonTemplates.find(t => t.$id === session.lessonTemplateId);
                  const isCompleted = session.stage === 'done';

                  return (
                    <div key={session.$id} className="bg-gray-50 rounded border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium flex items-center gap-2">
                            {template?.title || 'Lesson'}
                            {isCompleted && (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                Completed
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Started {new Date(session.startedAt).toLocaleDateString()}
                            {session.endedAt && ` • Completed ${new Date(session.endedAt).toLocaleDateString()}`}
                            {!isCompleted && ` • Stage: ${session.stage}`}
                          </p>
                        </div>
                        <button
                          onClick={() => router.push(`/session/${session.$id}`)}
                          className={`px-4 py-2 rounded text-sm ${
                            isCompleted
                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isCompleted ? 'Review' : 'Continue'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1}-{Math.min(startIndex + sessionsPerPage, allSessionsForHistory.length)} of {allSessionsForHistory.length} lessons
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 text-sm border rounded ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}