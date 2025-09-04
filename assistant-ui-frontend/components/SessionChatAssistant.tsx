"use client";

import { useEffect, useState } from "react";
import { MyAssistant, SessionContext } from "./MyAssistant";
import { useAppwrite, SessionDriver } from "@/lib/appwrite";
import { SessionHeader } from "./SessionHeader";

interface SessionChatAssistantProps {
  sessionId: string;
  threadId?: string;
}

export function SessionChatAssistant({ sessionId, threadId }: SessionChatAssistantProps) {
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [existingThreadId, setExistingThreadId] = useState<string | undefined>(threadId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { createDriver } = useAppwrite();

  useEffect(() => {
    const loadSessionContext = async () => {
      try {
        const sessionDriver = createDriver(SessionDriver);
        
        // Load session with thread information
        const sessionWithThread = await sessionDriver.getSessionWithThread(sessionId);
        const sessionStateData = await sessionDriver.getSessionState(sessionId);
        
        if (!sessionStateData) {
          throw new Error("Session not found");
        }

        const { session, parsedSnapshot, progress } = sessionStateData;

        // Use existing thread ID from session if available
        if (sessionWithThread.threadId) {
          console.log('SessionChatAssistant - Found existing thread ID:', sessionWithThread.threadId);
          setExistingThreadId(sessionWithThread.threadId);
        }

        // Get current card based on progress
        const currentCard = parsedSnapshot.cards?.[progress.currentCard] || null;

        const context: SessionContext = {
          session_id: session.$id,
          student_id: session.studentId,
          lesson_snapshot: parsedSnapshot,
          current_card_index: progress.currentCard,
          current_card: currentCard,
          stage: session.stage || 'design' // Include stage information
        };

        console.log('SessionChatAssistant - Loading context:', context);
        console.log('SessionChatAssistant - Thread info:', {
          existingThreadId: sessionWithThread.threadId,
          hasExistingConversation: sessionWithThread.hasExistingConversation,
          lastMessageAt: sessionWithThread.lastMessageAt
        });
        
        setSessionContext(context);
      } catch (err) {
        console.error("Failed to load session context:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    loadSessionContext();
  }, [sessionId, existingThreadId]);

  // Handle new thread creation - persist to session
  const handleThreadCreated = async (newThreadId: string) => {
    try {
      const sessionDriver = createDriver(SessionDriver);
      await sessionDriver.updateSessionThreadId(sessionId, newThreadId);
      console.log('SessionChatAssistant - Thread ID persisted to session:', newThreadId);
    } catch (error) {
      console.error('SessionChatAssistant - Failed to persist thread ID:', error);
    }
  };

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
    <div className="flex flex-col h-screen">
      <SessionHeader sessionContext={sessionContext} />
      <div className="flex-1 min-h-0" data-testid="chat-interface">
        <MyAssistant
          sessionId={sessionId}
          threadId={existingThreadId}
          sessionContext={sessionContext!}
          onThreadCreated={handleThreadCreated}
        />
      </div>
    </div>
  );
}