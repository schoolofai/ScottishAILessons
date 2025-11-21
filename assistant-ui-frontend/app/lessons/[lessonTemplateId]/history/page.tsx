'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ArrowLeft,
  Eye,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { logger } from '@/lib/logger';

interface SessionHistoryItem {
  $id: string;
  startedAt: string;
  endedAt?: string; // Actual field name in Appwrite sessions schema
  status: 'completed' | 'abandoned';
  cards_completed?: number;
  total_cards?: number;
  score?: number;
  duration_minutes?: number;
  lesson_snapshot?: any;
}

export default function LessonHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const lessonTemplateId = params.lessonTemplateId as string;

  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>('');

  useEffect(() => {
    loadSessionHistory();
  }, [lessonTemplateId]);

  const loadSessionHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('loading_session_history', { lessonTemplateId });

      // Use server-side API endpoint for authentication via httpOnly cookies
      // This matches the pattern used by CourseCurriculum component
      const sessionsResponse = await fetch('/api/student/sessions', {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!sessionsResponse.ok) {
        const errorData = await sessionsResponse.json().catch(() => ({ error: 'Failed to load sessions' }));
        throw new Error(errorData.error || 'Failed to load sessions');
      }

      const sessionsData = await sessionsResponse.json();
      const allSessions = sessionsData.sessions || [];

      logger.info('debug_api_returned_sessions', {
        total: allSessions.length,
        sample: allSessions.slice(0, 3).map((s: any) => ({
          id: s.$id,
          lessonTemplateId: s.lessonTemplateId,
          studentId: s.studentId,
          status: s.status
        }))
      });

      // Filter sessions for this specific lesson
      const lessonSessions = allSessions.filter((s: any) =>
        s.lessonTemplateId === lessonTemplateId
      );

      logger.info('debug_filtered_sessions', {
        lessonTemplateId,
        total: lessonSessions.length,
        sessions: lessonSessions.map((s: any) => ({
          id: s.$id,
          status: s.status,
          createdAt: s.$createdAt,
          endedAt: s.endedAt
        }))
      });

      // Filter to completed sessions only
      const completedSessions = lessonSessions.filter((s: any) =>
        s.status === 'completed'
      );

      // Sort by creation time (most recent first)
      completedSessions.sort((a: any, b: any) =>
        new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
      );

      logger.info('session_history_loaded', {
        lessonTemplateId,
        totalSessions: lessonSessions.length,
        completedCount: completedSessions.length
      });

      // Get lesson template title from first session's lesson_snapshot
      if (completedSessions.length > 0 && completedSessions[0].lesson_snapshot) {
        const snapshot = typeof completedSessions[0].lesson_snapshot === 'string'
          ? JSON.parse(completedSessions[0].lesson_snapshot)
          : completedSessions[0].lesson_snapshot;
        setLessonTitle(snapshot.title || 'Lesson');
      } else {
        setLessonTitle('Lesson');
      }

      // Extract studentId from first session if available
      if (allSessions.length > 0) {
        setStudentId(allSessions[0].studentId);
      }

      setSessions(completedSessions as SessionHistoryItem[]);
    } catch (err) {
      logger.error('failed_to_load_session_history', {
        lessonTemplateId,
        error: err instanceof Error ? err.message : String(err)
      });
      setError(err instanceof Error ? err.message : 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}/view`);
  };

  const handleGoBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading session history...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleGoBack} className="mt-4" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button onClick={handleGoBack} variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                Session History: {lessonTitle}
              </CardTitle>
              <p className="text-sm text-gray-500">
                View your completed lesson sessions
              </p>
            </CardHeader>
          </Card>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No completed sessions yet</p>
                <p className="text-sm mt-2">Complete this lesson to see your session history here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((session, index) => {
              const completedDate = session.endedAt
                ? new Date(session.endedAt)
                : null;

              const score = session.score !== undefined
                ? Math.round(session.score * 100)
                : null;

              return (
                <Card key={session.$id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      {/* Session Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-gray-900">
                            Attempt #{sessions.length - index}
                          </span>
                          {score !== null && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                              {score}% Score
                            </span>
                          )}
                        </div>

                        {/* Date & Time Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {completedDate
                                ? format(completedDate, 'MMM d, yyyy')
                                : 'Unknown date'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {completedDate
                                ? formatDistanceToNow(completedDate, { addSuffix: true })
                                : 'Unknown time'}
                            </span>
                          </div>
                          {session.duration_minutes && (
                            <span className="text-gray-500">
                              Duration: {session.duration_minutes} min
                            </span>
                          )}
                        </div>

                        {/* Progress Info */}
                        {session.cards_completed !== undefined && session.total_cards !== undefined && (
                          <div className="mt-2 text-sm text-gray-500">
                            Cards completed: {session.cards_completed} / {session.total_cards}
                          </div>
                        )}
                      </div>

                      {/* View Button */}
                      <Button
                        onClick={() => handleViewSession(session.$id)}
                        variant="outline"
                        size="sm"
                        className="ml-4"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Summary Stats */}
        {sessions.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Summary Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-blue-600">{sessions.length}</div>
                  <div className="text-sm text-gray-500">Total Attempts</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {sessions.filter(s => (s.score || 0) >= 0.7).length}
                  </div>
                  <div className="text-sm text-gray-500">Passed (≥70%)</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-600">
                    {sessions[0]?.score !== undefined
                      ? Math.round(sessions[0].score * 100)
                      : 'N/A'}%
                  </div>
                  <div className="text-sm text-gray-500">Latest Score</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
