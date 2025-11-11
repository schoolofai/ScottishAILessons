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
  BookOpen,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { useAppwrite, SessionDriver, type ConversationHistory } from '@/lib/appwrite';
import { ReadOnlyLessonCard } from '@/components/sessions/ReadOnlyLessonCard';
import { ReadOnlyCompletionSummary } from '@/components/sessions/ReadOnlyCompletionSummary';
import ReactMarkdown from 'react-markdown';

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

      if (!history) {
        setError('No conversation history available for this session');
        return;
      }

      setConversationHistory(history);

      logger.info('session_replay_loaded', {
        sessionId,
        messageCount: history.messages.length
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

  if (!session || !conversationHistory) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert>
            <MessageSquare className="h-4 w-4" />
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
              Lesson Session Replay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Session ID:</strong> {session.$id}</p>
              <p><strong>Status:</strong> <Badge variant="outline">{session.status}</Badge></p>
              <p><strong>Messages:</strong> {conversationHistory.messages.length} messages recorded</p>
            </div>
          </CardContent>
        </Card>

        {/* Render conversation messages in order */}
        <div className="space-y-6">
          {conversationHistory.messages.map((message, index) => {
            // Render based on message type
            if (message.type === 'AIMessage' && message.tool_calls && message.tool_calls.length > 0) {
              // Check if this is a lesson card presentation
              const lessonCardTool = message.tool_calls.find(tc => tc.name === 'lesson_card_presentation');
              if (lessonCardTool) {
                return (
                  <ReadOnlyLessonCard
                    key={message.id || index}
                    card_data={lessonCardTool.args.card_data}
                    card_index={lessonCardTool.args.card_index}
                    total_cards={lessonCardTool.args.total_cards}
                    lesson_context={lessonCardTool.args.lesson_context}
                  />
                );
              }

              // Check if this is a completion summary
              const completionTool = message.tool_calls.find(tc => tc.name === 'lesson_completion_summary');
              if (completionTool) {
                return (
                  <ReadOnlyCompletionSummary
                    key={message.id || index}
                    summary={completionTool.args.summary}
                    performance_analysis={completionTool.args.performance_analysis}
                    evidence={completionTool.args.evidence || []}
                    lesson_title={completionTool.args.lesson_title}
                    total_cards={completionTool.args.total_cards}
                    cards_completed={completionTool.args.cards_completed}
                    retry_recommended={completionTool.args.retry_recommended}
                    timestamp={completionTool.args.timestamp}
                  />
                );
              }
            }

            // Render AI messages without tool calls as text
            if (message.type === 'AIMessage' && message.content) {
              return (
                <Card key={message.id || index} className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-600 rounded-full p-2">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Render human messages (student responses)
            if (message.type === 'HumanMessage' && message.content) {
              return (
                <Card key={message.id || index} className="bg-green-50 border-green-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-600 rounded-full p-2">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-900 mb-1">Student Response:</p>
                        <p className="text-gray-800">{message.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
