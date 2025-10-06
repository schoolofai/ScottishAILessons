'use client';

import { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { Client, Databases, Query } from 'appwrite';

interface Lesson {
  order: number;
  label: string;
  lessonTemplateId: string;
  lesson_type: string;
  status?: 'completed' | 'in_progress' | 'not_started' | 'locked';
  estimatedMinutes?: number;
  isPublished?: boolean;
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

      const sessionMap = new Map(
        allSessions.map((s: any) => [
          s.lessonTemplateId,
          s.completionStatus
        ])
      );

      // Map lesson templates with status
      const lessonsWithStatus: Lesson[] = lessonTemplates.map((template: any, index: number) => {
        const sessionStatus = sessionMap.get(template.$id);
        const isPublished = template.status === 'published';
        let status: Lesson['status'] = 'not_started';

        // If lesson is not published, mark it as locked
        if (!isPublished) {
          status = 'locked';
        } else if (sessionStatus === 'completed') {
          status = 'completed';
        } else if (sessionStatus === 'in_progress') {
          status = 'in_progress';
        }

        return {
          order: template.sow_order || index + 1,  // Use sow_order field
          label: template.title || `Lesson ${index + 1}`,
          lessonTemplateId: template.$id,
          lesson_type: template.lesson_type || 'teach',
          status,
          estimatedMinutes: template.estMinutes || 30,  // Use estMinutes field
          isPublished
        };
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
        <Button variant="ghost" size="sm" disabled className="gap-2">
          <Lock className="h-4 w-4" />
          Locked
        </Button>
      );
    }

    if (lesson.status === 'completed') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onStartLesson(lesson.lessonTemplateId)}
          disabled={isStarting}
          className="gap-2"
        >
          {isStarting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Review
            </>
          )}
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        onClick={() => onStartLesson(lesson.lessonTemplateId)}
        disabled={isStarting}
        className="gap-2 bg-blue-600 hover:bg-blue-700"
      >
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            {lesson.status === 'in_progress' ? 'Continue' : 'Start'}
          </>
        )}
      </Button>
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
