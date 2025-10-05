'use client';

import { useState, useEffect } from 'react';
import { getSessionHistory } from '@/lib/services/progress-service';
import { format } from 'date-fns';
import { Clock, Calendar, Loader2 } from 'lucide-react';

interface SessionHistoryProps {
  studentId: string;
  courseId: string;
}

export function SessionHistory({ studentId, courseId }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [studentId, courseId]);

  const loadSessions = async () => {
    try {
      const { Client, Databases } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);

      const sessionData = await getSessionHistory(studentId, courseId, databases);
      setSessions(sessionData);
    } catch (error) {
      console.error('Failed to load session history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-blue-600" />
        Recent Sessions
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
          No sessions completed yet. Start a lesson to see your history!
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <h4 className="font-medium">{session.lessonTitle}</h4>
                <p className="text-sm text-gray-600">
                  {format(new Date(session.completedAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{session.duration} min</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
