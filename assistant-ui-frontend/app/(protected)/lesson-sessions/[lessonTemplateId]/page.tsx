'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Client, Databases, Query, Account } from 'appwrite';
import { ArrowLeft, Calendar, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Session {
  $id: string;
  endedAt: string; // Actual field name in Appwrite sessions schema
  durationMinutes?: number;
  startedAt: string;
  studentId: string; // SECURITY: Validate ownership
}

interface LessonTemplate {
  $id: string;
  title: string;
  courseId: string;
  lesson_type?: string;
  engagement_tags?: string;
}

interface Course {
  subject: string;
  level: string;
}

export default function LessonSessionsPage() {
  const router = useRouter();
  const params = useParams();
  const lessonTemplateId = params.lessonTemplateId as string;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [lessonTemplateId]);

  const loadSessions = async () => {
    try {
      // Validate lessonTemplateId
      if (!lessonTemplateId || lessonTemplateId === 'undefined') {
        throw new Error('Invalid lesson ID');
      }

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      // Authenticate
      const cookieFallback = localStorage.getItem('cookieFallback');
      if (!cookieFallback) {
        throw new Error('Session expired. Please log in again.');
      }

      const cookieData = JSON.parse(cookieFallback);
      const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
      const storedSession = cookieData[sessionKey];

      if (!storedSession) {
        throw new Error('Session expired. Please log in again.');
      }

      client.setSession(storedSession);

      const account = new Account(client);
      const databases = new Databases(client);

      // Get current user
      const user = await account.get();

      // Get student record
      const studentsResult = await databases.listDocuments(
        'default',
        'students',
        [Query.equal('userId', user.$id), Query.limit(1)]
      );

      if (studentsResult.documents.length === 0) {
        throw new Error('Student record not found');
      }

      const student = studentsResult.documents[0];
      setStudentId(student.$id);

      logger.info('lesson_history_load_start', {
        lessonTemplateId,
        studentId: student.$id
      });

      // Get lesson template
      const template = await databases.getDocument(
        'default',
        'lesson_templates',
        lessonTemplateId
      ) as LessonTemplate;

      setLessonTitle(template.title || 'Untitled Lesson');

      // Parse lesson type for display
      const lessonTypeDisplay = template.lesson_type
        ? template.lesson_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'Lesson';
      setLessonType(lessonTypeDisplay);

      // Get course for context
      if (!template.courseId) {
        logger.warn('lesson_template_missing_courseId', { lessonTemplateId });
        setCourseTitle('Unknown Course');
      } else {
        const courseResult = await databases.listDocuments(
          'default',
          'courses',
          [Query.equal('courseId', template.courseId), Query.limit(1)]
        );

        if (courseResult.documents.length > 0) {
          const course = courseResult.documents[0] as Course;
          const subjectDisplay = course.subject?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const levelDisplay = course.level?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          setCourseTitle(`${subjectDisplay} - ${levelDisplay}`);
        } else {
          logger.warn('course_not_found_for_lesson', {
            lessonTemplateId,
            courseId: template.courseId
          });
          setCourseTitle('Unknown Course');
        }
      }

      // Get completed sessions - SECURITY: Filter by studentId
      const result = await databases.listDocuments(
        'default',
        'sessions',
        [
          Query.equal('studentId', student.$id), // CRITICAL: Prevent data leaks
          Query.equal('lessonTemplateId', lessonTemplateId),
          Query.equal('status', 'completed'),
          Query.orderDesc('endedAt'), // Order by completion time
          Query.limit(100) // Reasonable limit for history
        ]
      );

      // Additional security validation (defense in depth)
      const validatedSessions = result.documents.filter((session: any) => {
        if (session.studentId !== student.$id) {
          logger.error('session_with_wrong_studentId_returned', {
            sessionId: session.$id,
            expectedStudentId: student.$id,
            foundStudentId: session.studentId
          });
          return false;
        }
        return true;
      }) as Session[];

      setSessions(validatedSessions);

      logger.info('lesson_history_loaded', {
        lessonTemplateId,
        studentId: student.$id,
        sessionCount: validatedSessions.length
      });
    } catch (err) {
      logger.error('lesson_history_load_failed', {
        lessonTemplateId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });

      setError(err instanceof Error ? err.message : 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back to course"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Back to Course
        </Button>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back to course"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Back to Course
        </Button>

        <div className="mb-3">
          <p className="text-sm text-gray-600">{courseTitle}</p>
          {lessonType && (
            <Badge variant="secondary" className="mt-1">
              {lessonType}
            </Badge>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-3">{lessonTitle}</h1>

        <p className="text-gray-600">
          You've completed this lesson{' '}
          <strong className="text-gray-900">{sessions.length}</strong>{' '}
          time{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-500 text-lg">No completed sessions yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Complete this lesson to see your history here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" role="list" aria-label="Completed session history">
          {sessions.map((session, index) => (
            <Card key={session.$id} role="listitem">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CheckCircle2
                      className="h-8 w-8 text-green-600 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium">
                        Completed{' '}
                        <time dateTime={session.endedAt}>
                          {formatDistanceToNow(new Date(session.endedAt), {
                            addSuffix: true
                          })}
                        </time>
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {new Date(session.endedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {session.durationMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {session.durationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {index === 0 && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Most Recent
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action: Retake Lesson */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold mb-2">Want to practice again?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Retake this lesson to reinforce your learning and track your improvement
        </p>
        <Button
          onClick={() => router.back()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Back to Course
        </Button>
      </div>
    </div>
  );
}
