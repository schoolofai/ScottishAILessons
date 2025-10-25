'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  CheckCircle2,
  Circle,
  Lock,
  Play,
  Loader2,
  BookOpen,
  Clock,
  RotateCcw
} from 'lucide-react';
import { Client, Databases, Query } from 'appwrite';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import { abandonAndRestart } from '@/lib/sessions/session-security';
import { cache, createCacheKey } from '@/lib/cache';

interface Lesson {
  order: number;
  label: string;
  lessonTemplateId: string;
  lesson_type: string;
  status: 'completed' | 'in_progress' | 'not_started' | 'locked';
  estimatedMinutes?: number;
  isPublished: boolean;
  activeSessionId?: string;
  completedCount: number;
  lastActivity?: string;
  lesson_type_display?: string;
  engagement_tags?: string[];
}

interface SessionsByLessonMap {
  [lessonTemplateId: string]: {
    activeSession: any | null;
    completedCount: number;
    lastActivity?: string;
  };
}

interface CourseCurriculumProps {
  courseId: string;
  studentId: string;
  onStartLesson: (lessonTemplateId: string) => void;
  startingLessonId?: string | null;
}

export function CourseCurriculum({
  courseId,
  studentId,
  onStartLesson,
  startingLessonId
}: CourseCurriculumProps) {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    loadCurriculum();
  }, [courseId, studentId]);

  const loadCurriculum = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[CourseCurriculum] Loading curriculum for:', { courseId, studentId });

      if (!courseId || !studentId) {
        console.error('[CourseCurriculum] Missing required parameters:', { courseId, studentId });
        setError('Missing course or student information');
        setLoading(false);
        return;
      }

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      // Set session from localStorage for authentication
      const cookieFallback = localStorage.getItem('cookieFallback');
      if (cookieFallback) {
        try {
          const cookieData = JSON.parse(cookieFallback);
          const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
          const storedSession = cookieData[sessionKey];
          if (storedSession) {
            client.setSession(storedSession);
          }
        } catch (e) {
          console.error('[CourseCurriculum] Failed to set session:', e);
        }
      }

      const databases = new Databases(client);

      // Get ALL lesson templates for the course with pagination
      let allTemplates: any[] = [];
      let offset = 0;
      const limit = 100; // Appwrite max limit per request
      let hasMore = true;

      while (hasMore) {
        const templatesResult = await databases.listDocuments(
          'default',
          'lesson_templates',
          [
            Query.equal('courseId', courseId),
            Query.orderAsc('sow_order'),
            Query.limit(limit),
            Query.offset(offset)
          ]
        );

        allTemplates = allTemplates.concat(templatesResult.documents);
        offset += limit;
        hasMore = templatesResult.documents.length === limit;

        console.log('[CourseCurriculum] Fetched batch:', {
          batchSize: templatesResult.documents.length,
          totalSoFar: allTemplates.length,
          hasMore
        });
      }

      console.log('[CourseCurriculum] Lesson templates result:', {
        found: allTemplates.length,
        total: allTemplates.length
      });

      if (allTemplates.length === 0) {
        setError('No lessons found for this course');
        setLessons([]);
        return;
      }

      const lessonTemplates = allTemplates;
      console.log('[CourseCurriculum] Found lesson templates:', lessonTemplates.length);

      // Get ALL student's lesson sessions to determine status with pagination
      let allSessions: any[] = [];
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const sessionsResult = await databases.listDocuments(
          'default',
          'sessions',
          [
            Query.equal('studentId', studentId),
            Query.limit(limit),
            Query.offset(offset)
          ]
        );

        allSessions = allSessions.concat(sessionsResult.documents);
        offset += limit;
        hasMore = sessionsResult.documents.length === limit;
      }

      console.log('[CourseCurriculum] Lesson sessions found:', allSessions.length);

      // Build session map with strict security filtering
      const sessionsByLesson: SessionsByLessonMap = {};

      // SECURITY: Filter sessions by current student
      const studentSessions = allSessions.filter((session: any) => {
        if (session.studentId !== studentId) {
          logger.warn('session_with_wrong_studentId_in_dataset', {
            sessionId: session.$id,
            expectedStudentId: studentId,
            foundStudentId: session.studentId
          });
          return false;
        }
        return true;
      });

      studentSessions.forEach((session: any) => {
        const lessonId = session.lessonTemplateId;

        if (!sessionsByLesson[lessonId]) {
          sessionsByLesson[lessonId] = {
            activeSession: null,
            completedCount: 0,
            lastActivity: undefined
          };
        }

        const lessonSessions = sessionsByLesson[lessonId];

        if (session.status === 'active' || session.status === 'created') {
          // Validate session data (fail fast)
          if (!session.startedAt) {
            logger.error('session_missing_startedAt', {
              sessionId: session.$id,
              status: session.status,
              lessonTemplateId: lessonId
            });
            throw new Error(`Corrupted session data: ${session.$id}`);
          }

          // Keep most recent active session only
          if (!lessonSessions.activeSession ||
              new Date(session.startedAt) > new Date(lessonSessions.activeSession.startedAt)) {
            lessonSessions.activeSession = session;
            lessonSessions.lastActivity = session.updatedAt || session.startedAt;
          }
        } else if (session.status === 'completed') {
          lessonSessions.completedCount++;

          // Track most recent activity
          const activityDate = session.completedAt || session.updatedAt;
          if (!lessonSessions.lastActivity || activityDate > lessonSessions.lastActivity) {
            lessonSessions.lastActivity = activityDate;
          }
        }
      });

      // Map lessons with status
      const lessonsWithStatus: Lesson[] = lessonTemplates.map((template: any, index: number) => {
        const lessonSessions = sessionsByLesson[template.$id];
        const isPublished = template.status === 'published';

        let status: Lesson['status'] = 'not_started';

        if (!isPublished) {
          status = 'locked';
        } else if (lessonSessions?.activeSession) {
          status = 'in_progress';
        } else if (lessonSessions?.completedCount > 0) {
          status = 'completed';
        }

        // Extract curriculum metadata for richer display
        let engagement_tags: string[] = [];
        try {
          const tags_str = template.engagement_tags || '[]';
          engagement_tags = typeof tags_str === 'string' ? JSON.parse(tags_str) : tags_str;
        } catch (e) {
          logger.warn('failed_to_parse_engagement_tags', { templateId: template.$id });
        }

        const lesson_type_display = template.lesson_type
          ? template.lesson_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          : 'Lesson';

        return {
          order: template.sow_order || index + 1,
          label: template.title || `Lesson ${index + 1}`,
          lessonTemplateId: template.$id,
          lesson_type: template.lesson_type || 'teach',
          status,
          estimatedMinutes: template.estMinutes || 30,
          isPublished,
          activeSessionId: lessonSessions?.activeSession?.$id,
          completedCount: lessonSessions?.completedCount || 0,
          lastActivity: lessonSessions?.lastActivity,
          lesson_type_display,
          engagement_tags
        };
      });

      logger.info('lessons_mapped', {
        totalLessons: lessonsWithStatus.length,
        inProgress: lessonsWithStatus.filter(l => l.status === 'in_progress').length,
        completed: lessonsWithStatus.filter(l => l.status === 'completed').length,
        locked: lessonsWithStatus.filter(l => l.status === 'locked').length,
        notStarted: lessonsWithStatus.filter(l => l.status === 'not_started').length
      });

      setLessons(lessonsWithStatus);
      setCompletedCount(lessonsWithStatus.filter(l => l.status === 'completed').length);

      console.log('[CourseCurriculum] Successfully loaded curriculum:', {
        totalLessons: lessonsWithStatus.length,
        completedCount: lessonsWithStatus.filter(l => l.status === 'completed').length
      });
    } catch (err: any) {
      console.error('[CourseCurriculum] Failed to load curriculum:', err);
      console.error('[CourseCurriculum] Error details:', {
        message: err.message,
        code: err.code,
        type: err.type
      });
      setError(`Failed to load course curriculum: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getLessonTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; className: string }> = {
      'teach': { label: 'Teach', className: 'bg-blue-100 text-blue-700' },
      'check-in': { label: 'Check-in', className: 'bg-yellow-100 text-yellow-700' },
      'practice': { label: 'Practice', className: 'bg-green-100 text-green-700' },
      'revision': { label: 'Revision', className: 'bg-purple-100 text-purple-700' },
      'assessment': { label: 'Assessment', className: 'bg-red-100 text-red-700' },
    };
    return typeMap[type?.toLowerCase()] || { label: type || 'Lesson', className: 'bg-gray-100 text-gray-700' };
  };

  const getStatusIcon = (status: Lesson['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Circle className="h-5 w-5 text-blue-600 fill-blue-200" />;
      case 'locked':
        return <Lock className="h-5 w-5 text-gray-400" />;
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getActionButton = (lesson: Lesson) => {
    const isStarting = startingLessonId === lesson.lessonTemplateId;

    if (lesson.status === 'locked') {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="gap-2"
            aria-label={`${lesson.label} is locked`}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Locked
          </Button>
        </div>
      );
    }

    // Determine button configuration
    let buttonText = 'Start Lesson';
    let buttonVariant: 'default' | 'outline' = 'default';
    let buttonIcon = <Play className="h-4 w-4" aria-hidden="true" />;
    let ariaLabel = `Start ${lesson.label}`;

    if (lesson.status === 'in_progress') {
      buttonText = 'Continue';
      buttonVariant = 'default';
      buttonIcon = <Play className="h-4 w-4" aria-hidden="true" />;
      ariaLabel = `Continue ${lesson.label}`;
    } else if (lesson.status === 'completed') {
      buttonText = 'Retake Lesson';
      buttonVariant = 'outline';
      buttonIcon = <RotateCcw className="h-4 w-4" aria-hidden="true" />;
      ariaLabel = `Retake ${lesson.label}`;
    }

    // Calculate activity age for warning (7 days = stale)
    const isStale = lesson.lastActivity &&
      Date.now() - new Date(lesson.lastActivity).getTime() > 7 * 24 * 60 * 60 * 1000;

    return (
      <div className="flex flex-col items-end gap-2">
        {/* Main action button */}
        <Button
          variant={buttonVariant}
          size="sm"
          onClick={() => onStartLesson(lesson.lessonTemplateId)}
          disabled={isStarting}
          className={`gap-2 ${buttonVariant === 'default' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          aria-label={ariaLabel}
          aria-busy={isStarting}
        >
          {isStarting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Starting...
            </>
          ) : (
            <>
              {buttonIcon}
              {buttonText}
            </>
          )}
        </Button>

        {/* Activity timestamp for in-progress lessons */}
        {lesson.status === 'in_progress' && lesson.lastActivity && (
          <p className={`text-xs ${isStale ? 'text-amber-600' : 'text-gray-500'}`}>
            Last activity: {formatDistanceToNow(new Date(lesson.lastActivity), { addSuffix: true })}
          </p>
        )}

        {/* History link for completed lessons */}
        {lesson.completedCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/lesson-sessions/${lesson.lessonTemplateId}`);
            }}
            className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            aria-label={`View ${lesson.completedCount} completed attempts for ${lesson.label}`}
          >
            View History ({lesson.completedCount} completed)
          </button>
        )}

        {/* "Start Over" link for stale in-progress sessions */}
        {lesson.status === 'in_progress' && isStale && lesson.activeSessionId && (
          <button
            onClick={async (e) => {
              e.stopPropagation();

              if (!confirm('Abandon current progress and start fresh?\n\nYour current session will be marked as abandoned.')) {
                return;
              }

              try {
                const client = new Client()
                  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
                  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

                // Set session from localStorage
                const cookieFallback = localStorage.getItem('cookieFallback');
                if (cookieFallback) {
                  const cookieData = JSON.parse(cookieFallback);
                  const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
                  client.setSession(cookieData[sessionKey]);
                }

                const databases = new Databases(client);

                const newSessionId = await abandonAndRestart(
                  databases,
                  lesson.activeSessionId!,
                  studentId,
                  lesson.lessonTemplateId,
                  courseId,
                  undefined // threadId not available here
                );

                // Invalidate cache
                const cacheKey = createCacheKey('recommendations', studentId, courseId);
                cache.invalidate(cacheKey);

                logger.info('session_restarted_from_curriculum', {
                  oldSessionId: lesson.activeSessionId,
                  newSessionId,
                  lessonTemplateId: lesson.lessonTemplateId
                });

                // Navigate to new session
                router.push(`/session/${newSessionId}`);
              } catch (err) {
                logger.error('failed_to_abandon_and_restart', {
                  lessonTemplateId: lesson.lessonTemplateId,
                  error: err instanceof Error ? err.message : String(err)
                });
                alert('Failed to start over. Please try again.');
              }
            }}
            className="text-xs text-amber-600 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded"
            aria-label={`Start ${lesson.label} over from the beginning`}
          >
            Start Over
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = lessons.length > 0
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Curriculum
          </CardTitle>
          <div className="text-sm text-gray-600">
            {completedCount} of {lessons.length} completed
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto">
        <div className="space-y-2">
          {lessons.map((lesson, index) => {
            const typeBadge = getLessonTypeBadge(lesson.lesson_type);
            const isNextLesson = lesson.status === 'not_started' &&
              (index === 0 || lessons[index - 1]?.status === 'completed');

            return (
              <div
                key={lesson.lessonTemplateId}
                className={`
                  flex items-center gap-3 p-4 rounded-lg border transition-all
                  ${lesson.status === 'in_progress'
                    ? 'bg-blue-50 border-blue-200'
                    : isNextLesson
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200'
                  }
                  ${lesson.status !== 'locked' ? 'hover:shadow-md' : 'opacity-60'}
                `}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(lesson.status)}
                </div>

                {/* Lesson Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">
                      Lesson {lesson.order}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeBadge.className}`}>
                      {typeBadge.label}
                    </span>
                    {isNextLesson && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        Up Next
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-gray-900 truncate">
                    {lesson.label}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{lesson.estimatedMinutes} min</span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0">
                  {getActionButton(lesson)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
