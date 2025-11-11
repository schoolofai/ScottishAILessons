'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { useAppwrite, SessionDriver, type ConversationHistory } from '@/lib/appwrite';
import { useInstantReplayRuntime } from '@/lib/replay/ReplayRuntime';
import { MyAssistant } from '@/components/MyAssistant';
import { CurrentCardProvider } from '@/contexts/CurrentCardContext';

interface SessionData {
  $id: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  score?: number;
  lessonTemplateId?: string;
  studentId: string;
}

export default function SessionReplayPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { createDriver } = useAppwrite();

  const [session, setSession] = useState<SessionData | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create replay runtime from conversation history
  const replayRuntime = useInstantReplayRuntime(conversationHistory);

  useEffect(() => {
    loadSessionReplay();
  }, [sessionId]);

  const loadSessionReplay = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('loading_session_replay', { sessionId });

      const sessionDriver = createDriver(SessionDriver);

      // Load session and conversation history together
      const { session: sessionDoc, history } = await sessionDriver.getSessionWithHistory(sessionId);

      setSession(sessionDoc as unknown as SessionData);

      // Set conversation history
      setConversationHistory(history);

      logger.info('session_replay_loaded', {
        sessionId,
        messageCount: history?.messages.length || 0,
        hasHistory: !!history
      });
    } catch (err) {
      logger.error('failed_to_load_session_replay', {
        sessionId,
        error: err instanceof Error ? err.message : String(err)
      });
      setError(err instanceof Error ? err.message : 'Failed to load session replay');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading session replay...</span>
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
        <div className="max-w-6xl mx-auto">
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

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert>
            <BookOpen className="h-4 w-4" />
            <AlertDescription>Session not found</AlertDescription>
          </Alert>
          <Button onClick={handleGoBack} className="mt-4" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Show simple message if no conversation history available
  if (!conversationHistory) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert>
            <BookOpen className="h-4 w-4" />
            <AlertDescription>No conversation history available for this session.</AlertDescription>
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button onClick={handleGoBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(session.startedAt), 'PPP')}
            </Badge>
            {session.endedAt && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Completed: {format(new Date(session.endedAt), 'p')}
              </Badge>
            )}
            {session.score !== undefined && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Score: {Math.round(session.score * 100)}%
              </Badge>
            )}
          </div>
        </div>

        {/* Session Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Lesson Session Replay (Read-Only)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-2">
              <div><strong>Session ID:</strong> {session.$id}</div>
              <div className="flex items-center gap-2">
                <strong>Status:</strong>
                <Badge variant="outline">{session.status}</Badge>
              </div>
              <div><strong>Messages:</strong> {conversationHistory.messages.length} messages recorded</div>
              <div className="italic text-orange-600">⚠️ This is a replay of a completed lesson. All interactions are disabled.</div>
            </div>
          </CardContent>
        </Card>

        {/* Replay Assistant - Uses same UI as live sessions */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <CurrentCardProvider>
            <MyAssistant
              isReplayMode={true}
              replayRuntime={replayRuntime}
            />
          </CurrentCardProvider>
        </div>
      </div>
    </div>
  );
}
