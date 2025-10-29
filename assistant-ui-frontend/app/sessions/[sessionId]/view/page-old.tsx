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
  MessageSquare,
  User,
  Bot
} from 'lucide-react';
import { Client, Databases, Account, Query } from 'appwrite';
import { format, formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import ReactMarkdown from 'react-markdown';

interface SessionData {
  $id: string;
  startedAt: string;
  endedAt?: string; // Actual field name in Appwrite sessions schema
  status: string;
  score?: number;
  cards_completed?: number;
  total_cards?: number;
  duration_minutes?: number;
  lesson_snapshot?: any;
  studentId: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  card_index?: number;
  card_title?: string;
}

export default function SessionReplayPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
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

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      // Set session from localStorage
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
          logger.error('failed_to_set_session', { error: e });
          throw new Error('Authentication failed. Please log in again.');
        }
      }

      const account = new Account(client);
      const databases = new Databases(client);

      // Get current user
      const user = await account.get();

      // Get session document
      const sessionDoc = await databases.getDocument(
        'default',
        'sessions',
        sessionId
      );

      // SECURITY: Verify session belongs to current user
      const studentResult = await databases.listDocuments(
        'default',
        'students',
        [Query.equal('userId', user.$id)]
      );

      const currentStudent = studentResult.documents[0];

      if (!currentStudent || sessionDoc.studentId !== currentStudent.$id) {
        throw new Error('Unauthorized: This session does not belong to you');
      }

      setSession(sessionDoc as SessionData);

      // Fetch thread messages from LangGraph if threadId available
      // For now, we'll construct a simplified view from session data
      // TODO: Integrate with LangGraph thread history API when available

      // Parse lesson snapshot for context
      let lessonSnapshot = null;
      if (sessionDoc.lesson_snapshot) {
        try {
          lessonSnapshot = typeof sessionDoc.lesson_snapshot === 'string'
            ? JSON.parse(sessionDoc.lesson_snapshot)
            : sessionDoc.lesson_snapshot;
        } catch (e) {
          logger.warn('failed_to_parse_lesson_snapshot', { error: e });
        }
      }

      // For now, display a placeholder message indicating read-only view
      // In production, this would fetch actual conversation history from LangGraph
      const placeholderMessages: ConversationMessage[] = [
        {
          id: '1',
          role: 'assistant',
          content: `Welcome! This is a read-only view of your completed lesson session.\n\n**Lesson:** ${lessonSnapshot?.title || 'Unknown'}\n**Status:** ${sessionDoc.status}\n**Score:** ${sessionDoc.score !== undefined ? Math.round(sessionDoc.score * 100) + '%' : 'N/A'}`,
          timestamp: sessionDoc.startedAt
        }
      ];

      setMessages(placeholderMessages);

      logger.info('session_replay_loaded', {
        sessionId,
        messageCount: placeholderMessages.length
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
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading session...</span>
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

  if (!session) {
    return null;
  }

  const completedDate = session.endedAt ? new Date(session.endedAt) : null;
  const score = session.score !== undefined ? Math.round(session.score * 100) : null;

  let lessonSnapshot = null;
  if (session.lesson_snapshot) {
    try {
      lessonSnapshot = typeof session.lesson_snapshot === 'string'
        ? JSON.parse(session.lesson_snapshot)
        : session.lesson_snapshot;
    } catch (e) {
      // Ignore parsing error
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button onClick={handleGoBack} variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                    {lessonSnapshot?.title || 'Lesson Session'}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-2">
                    Read-only replay of completed session
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {score !== null && (
                    <Badge className="bg-green-100 text-green-700 text-lg px-4 py-1">
                      {score}% Score
                    </Badge>
                  )}
                  {session.status === 'completed' && (
                    <Badge className="bg-blue-100 text-blue-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500">Date</div>
                    <div className="font-medium">
                      {completedDate ? format(completedDate, 'MMM d, yyyy') : 'Unknown'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500">Duration</div>
                    <div className="font-medium">
                      {session.duration_minutes || 'N/A'} min
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500">Progress</div>
                    <div className="font-medium">
                      {session.cards_completed || 0} / {session.total_cards || 0}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500">Messages</div>
                    <div className="font-medium">{messages.length}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversation Replay */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Transcript</CardTitle>
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-800 text-sm">
                This is a read-only view. Full conversation history integration with LangGraph is coming soon.
              </AlertDescription>
            </Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No messages to display</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`flex-1 rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-blue-50 text-blue-900'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {message.role === 'user' ? 'You' : 'AI Teacher'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(message.timestamp), {
                          addSuffix: true
                        })}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
