"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MyAssistant, SessionContext } from "./MyAssistant";
import { useAppwrite, SessionDriver } from "@/lib/appwrite";
import { CourseDriver } from "@/lib/appwrite/driver/CourseDriver";
import { SessionHeader } from "./SessionHeader";
import { ContextChatPanel } from "./ContextChatPanel";
import { Client } from "@langchain/langgraph-sdk";
import { CurrentCardProvider } from "@/contexts/CurrentCardContext";

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
  const [contextChatWidth, setContextChatWidth] = useState(33); // Width as percentage (1/3 = 33%)
  const [isResizing, setIsResizing] = useState(false);
  const { createDriver } = useAppwrite();
  const threadIdRef = useRef<string | undefined>(existingThreadId);
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSessionContext = async () => {
      try {
        const sessionDriver = createDriver(SessionDriver);
        const courseDriver = createDriver(CourseDriver);

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

        // Extract courseId from lesson_snapshot and fetch course metadata
        const courseId = parsedSnapshot.courseId;
        let courseCurriculumMetadata = {};

        if (courseId) {
          try {
            console.log('SessionChatAssistant - Fetching course metadata for courseId:', courseId);
            courseCurriculumMetadata = await courseDriver.getCourseCurriculumMetadata(courseId);
            console.log('SessionChatAssistant - Course metadata fetched:', courseCurriculumMetadata);
          } catch (courseError) {
            console.error('SessionChatAssistant - Failed to fetch course metadata:', courseError);
            // Continue without course metadata - backend will use fallback values
          }
        } else {
          console.warn('SessionChatAssistant - No courseId found in lesson_snapshot');
        }

        const context: SessionContext = {
          session_id: session.$id,
          student_id: session.studentId,
          lesson_snapshot: parsedSnapshot,
          use_plain_text: false, // TODO: Get from user preferences when implemented
          ...courseCurriculumMetadata, // Add course_subject, course_level, sqa_course_code, course_title
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

  // NOTE: getMainGraphState method removed - replaced with CurrentCardContext for deterministic context

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

  // Handle mouse drag for resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const mouseX = e.clientX;
      const newWidth = ((windowWidth - mouseX) / windowWidth) * 100;

      // Constrain to 20% minimum and 50% maximum
      const constrainedWidth = Math.max(20, Math.min(50, newWidth));
      setContextChatWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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
    <CurrentCardProvider>
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
        <div
          className="relative flex-shrink-0"
          style={{ width: `${contextChatWidth}%` }}
        >
          {/* Drag Handle */}
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className={`absolute left-0 top-0 w-1 h-full bg-gray-300 hover:bg-blue-500 cursor-col-resize z-10 transition-colors duration-200 ${
              isResizing ? 'bg-blue-500' : ''
            }`}
            style={{ marginLeft: '-2px' }}
            data-testid="resize-handle"
            title="Drag to resize panel"
          />
          <ContextChatPanel
            sessionId={sessionId}
            sessionContext={sessionContext}
            existingContextThreadId={contextChatThreadId}
            onThreadCreated={handleContextThreadCreated}
            onCollapseChange={setIsContextChatCollapsed}
          />
        </div>
      )}

      {/* Chat Bubble with Text - Fixed position when collapsed */}
      {sessionContext && isContextChatCollapsed && (
        <button
          onClick={() => setIsContextChatCollapsed(false)}
          className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow-lg hover:shadow-xl z-50 transition-all duration-300 flex items-center gap-2 px-4 py-3 group"
          aria-label="Open AI tutor assistant"
          data-testid="context-chat-bubble"
        >
          {/* Speech bubble icon */}
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>

          {/* Call-to-action text */}
          <span className="text-sm font-medium whitespace-nowrap">
            Stuck? Ask Your AI Tutor
          </span>
        </button>
      )}
      </div>
    </CurrentCardProvider>
  );
}