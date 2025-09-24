"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MyAssistant, SessionContext } from "./MyAssistant";
import { useAppwrite, SessionDriver } from "@/lib/appwrite";
import { SessionHeader } from "./SessionHeader";
import { ContextChatPanel } from "./ContextChatPanel";
import { Client } from "@langchain/langgraph-sdk";

interface SessionChatAssistantProps {
  sessionId: string;
  threadId?: string;
}

export function SessionChatAssistant({ sessionId, threadId }: SessionChatAssistantProps) {
  const [sessionContext, setSessionContext] = useState<SessionContext | undefined>(undefined);
  const [existingThreadId, setExistingThreadId] = useState<string | undefined>(threadId);
  const [contextChatThreadId, setContextChatThreadId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContextChatCollapsed, setIsContextChatCollapsed] = useState(false);
  const { createDriver } = useAppwrite();
  const threadIdRef = useRef<string | undefined>(existingThreadId);

  useEffect(() => {
    const loadSessionContext = async () => {
      try {
        const sessionDriver = createDriver(SessionDriver);
        
        // Load session with thread information including context chat thread
        const sessionWithThread = await sessionDriver.getSessionWithContextChat(sessionId);
        const sessionStateData = await sessionDriver.getSessionState(sessionId);

        if (!sessionStateData) {
          throw new Error("Session not found");
        }

        const { session, parsedSnapshot } = sessionStateData;

        // Use threadId from session if available (priority: session.threadId > sessionWithThread.threadId)
        // This supports thread continuity from EnhancedDashboard
        if (session.threadId) {
          console.log('SessionChatAssistant - Using threadId from session for continuity:', session.threadId);
          setExistingThreadId(session.threadId);
        } else if (sessionWithThread.threadId) {
          console.log('SessionChatAssistant - Found existing thread ID:', sessionWithThread.threadId);
          setExistingThreadId(sessionWithThread.threadId);
        } else {
          console.log('SessionChatAssistant - No existing thread ID found, new thread will be created');
        }

        // Load context chat thread ID if available
        if (sessionWithThread.contextChatThreadId) {
          console.log('SessionChatAssistant - Found existing context chat thread ID:', sessionWithThread.contextChatThreadId);
          setContextChatThreadId(sessionWithThread.contextChatThreadId);
        } else {
          console.log('SessionChatAssistant - No existing context chat thread ID found, will create new one if needed');
        }

        const context: SessionContext = {
          session_id: session.$id,
          student_id: session.studentId,
          lesson_snapshot: parsedSnapshot,
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
      threadIdRef.current = newThreadId;
      console.log('SessionChatAssistant - Thread ID persisted to session:', newThreadId);
    } catch (error) {
      console.error('SessionChatAssistant - Failed to persist thread ID:', error);
    }
  };

  // State extraction method for context chat
  const getMainGraphState = useCallback(async () => {
    if (!threadIdRef.current) {
      console.warn('SessionChatAssistant - No thread ID available for state extraction');
      return null;
    }

    try {
      const client = new Client({
        apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024"
      });

      const state = await client.threads.getState(threadIdRef.current);

      console.log('SessionChatAssistant - Extracted main graph state keys:', Object.keys(state.values || {}));

      return {
        messages: state.values.messages?.slice(-10) || [], // Last 10 messages for context
        lesson_snapshot: state.values.lesson_snapshot,
        current_stage: state.values.current_stage,
        student_progress: state.values.student_progress,
        course_id: state.values.course_id,
        session_id: state.values.session_id,
        student_id: state.values.student_id,
        card_presentation_complete: state.values.card_presentation_complete,
        interrupt_count: state.values.interrupt_count || 0,
        mode: state.values.mode
      };
    } catch (error) {
      console.error('SessionChatAssistant - Failed to extract main graph state:', error);
      return null;
    }
  }, [threadIdRef.current]);

  // Handle new context chat thread creation - persist to session
  const handleContextThreadCreated = async (newContextThreadId: string) => {
    try {
      const sessionDriver = createDriver(SessionDriver);
      await sessionDriver.updateContextChatThreadId(sessionId, newContextThreadId);
      setContextChatThreadId(newContextThreadId);
      console.log('SessionChatAssistant - Context chat thread ID persisted to session:', newContextThreadId);
    } catch (error) {
      console.error('SessionChatAssistant - Failed to persist context chat thread ID:', error);
    }
  };

  // Update thread ref when existingThreadId changes
  useEffect(() => {
    threadIdRef.current = existingThreadId;
  }, [existingThreadId]);

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
    <div className="flex h-screen">
      {/* Main Teaching Panel - Always takes available space */}
      <div className="flex flex-col flex-1">
        <SessionHeader sessionContext={sessionContext} />
        <div className="flex-1 min-h-0" data-testid="main-teaching-panel">
          <MyAssistant
            sessionId={sessionId}
            threadId={existingThreadId}
            sessionContext={sessionContext}
            onThreadCreated={handleThreadCreated}
          />
        </div>
      </div>

      {/* Context Chat Panel - Only show in layout when expanded */}
      {sessionContext && !isContextChatCollapsed && (
        <div className="w-1/3 flex-shrink-0">
          <ContextChatPanel
            sessionId={sessionId}
            getMainGraphState={getMainGraphState}
            sessionContext={sessionContext}
            existingContextThreadId={contextChatThreadId}
            onThreadCreated={handleContextThreadCreated}
            onCollapseChange={setIsContextChatCollapsed}
          />
        </div>
      )}

      {/* Collapsed Chat Tab - Fixed position when collapsed */}
      {sessionContext && isContextChatCollapsed && (
        <button
          onClick={() => setIsContextChatCollapsed(false)}
          className="fixed top-1/2 right-0 transform -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 px-2 py-4 rounded-l-lg shadow-lg z-50 transition-all duration-300"
          aria-label="Expand context chat"
          data-testid="context-chat-tab"
        >
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold">▶</span>
            <span className="text-xs mt-1 writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
              Chat
            </span>
          </div>
        </button>
      )}
    </div>
  );
}