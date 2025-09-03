"use client";

import { useEffect, useState } from "react";
import { MyAssistant, SessionContext } from "./MyAssistant";
import { useAppwrite, SessionDriver } from "@/lib/appwrite";

interface SessionChatAssistantProps {
  sessionId: string;
  threadId?: string;
}

export function SessionChatAssistant({ sessionId, threadId }: SessionChatAssistantProps) {
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { createDriver } = useAppwrite();

  useEffect(() => {
    const loadSessionContext = async () => {
      try {
        const sessionDriver = createDriver(SessionDriver);
        const sessionStateData = await sessionDriver.getSessionState(sessionId);
        
        if (!sessionStateData) {
          throw new Error("Session not found");
        }

        const { session, parsedSnapshot, progress } = sessionStateData;

        // Get current card based on progress
        const currentCard = parsedSnapshot.cards?.[progress.currentCard] || null;

        const context: SessionContext = {
          session_id: session.$id,
          student_id: session.studentId,
          lesson_snapshot: parsedSnapshot,
          current_card_index: progress.currentCard,
          current_card: currentCard
        };

        setSessionContext(context);
      } catch (err) {
        console.error("Failed to load session context:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    loadSessionContext();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">Loading lesson...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-red-600" data-testid="error-message">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full" data-testid="chat-interface">
      <MyAssistant
        sessionId={sessionId}
        threadId={threadId}
        sessionContext={sessionContext!}
      />
    </div>
  );
}