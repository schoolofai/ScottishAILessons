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
      
      // Get student's sessions
      console.log('Getting student sessions...');
      const sessionsResult = await databases.listDocuments(
        'default',
        'sessions',
        [Query.equal('studentId', student.$id)]
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
      // Use client-side session creation (same approach as dashboard)
      const { Client, Account, Databases, ID } = await import('appwrite');
      
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      
      // Get session from localStorage
      const cookieFallback = localStorage.getItem('cookieFallback');
      if (cookieFallback) {
        const cookieData = JSON.parse(cookieFallback);
        const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
        const storedSession = cookieData[sessionKey];
        if (storedSession) {
          client.setSession(storedSession);
        }
      }
      
      const account = new Account(client);
      const databases = new Databases(client);
      const user = await account.get();
      
      // Get lesson template
      const lessonTemplate = await databases.getDocument(
        'default',
        'lesson_templates',
        lessonTemplateId
      );
      
      // Create lesson snapshot
      const lessonSnapshot = {
        title: lessonTemplate.title,
        outcomeRefs: JSON.parse(lessonTemplate.outcomeRefs),
        cards: JSON.parse(lessonTemplate.cards),
        templateVersion: lessonTemplate.version
      };
      
      // Create session
      const newSession = await databases.createDocument(
        'default',
        'sessions',
        ID.unique(),
        {
          studentId: student.$id,
          courseId: 'C844 73',
          lessonTemplateId: lessonTemplateId,
          startedAt: new Date().toISOString(),
          stage: 'design',
          lessonSnapshot: JSON.stringify(lessonSnapshot)
        },
        [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
      );
      
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

  const incompleteSessions = sessions.filter(s => s.stage !== 'done');

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

      {incompleteSessions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            Continue Learning
          </h2>
          <div className="space-y-3">
            {incompleteSessions.map(session => {
              const template = lessonTemplates.find(t => t.$id === session.lessonTemplateId);
              return (
                <div key={session.$id} className="bg-white rounded border p-4">
                  <h3 className="font-medium">{template?.title || 'Lesson'}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Started {new Date(session.startedAt).toLocaleDateString()} • Stage: {session.stage}
                  </p>
                  <button
                    onClick={() => router.push(`/session/${session.$id}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Resume Lesson
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    </div>
  );
}