"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MyAssistant, SessionContext } from "./MyAssistant";
import { useAppwrite, SessionDriver } from "@/lib/appwrite";
import { CourseDriver } from "@/lib/appwrite/driver/CourseDriver";
import { CourseOutcomesDriver } from "@/lib/appwrite/driver/CourseOutcomesDriver";
import { DiagramDriver } from "@/lib/appwrite/driver/DiagramDriver";
import { enrichOutcomeRefs } from "@/lib/sessions/outcome-enrichment";
import { SessionHeader } from "./SessionHeader";
import { ContextChatPanel } from "./ContextChatPanel";
import { Client } from "@langchain/langgraph-sdk";
import { CurrentCardProvider } from "@/contexts/CurrentCardContext";
import { LessonExitWarningModal } from "./session/LessonExitWarningModal";
import { usePreventNavigation } from "@/hooks/usePreventNavigation";
import { NavigationPreventionProvider } from "@/contexts/NavigationPreventionContext";

interface SessionChatAssistantProps {
  sessionId: string;
  threadId?: string;
}

export function SessionChatAssistant({ sessionId, threadId }: SessionChatAssistantProps) {
  const router = useRouter();
  const [sessionContext, setSessionContext] = useState<SessionContext | undefined>(undefined);
  const [existingThreadId, setExistingThreadId] = useState<string | undefined>(threadId);
  const [contextChatThreadId, setContextChatThreadId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContextChatCollapsed, setIsContextChatCollapsed] = useState(false);
  const [contextChatWidth, setContextChatWidth] = useState(33); // Width as percentage (1/3 = 33%)
  const [isResizing, setIsResizing] = useState(false);

  // Navigation prevention state
  const [sessionStatus, setSessionStatus] = useState<'created' | 'active' | 'completed' | 'failed'>('active');
  const [showExitModal, setShowExitModal] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);

  const { createDriver } = useAppwrite();
  const threadIdRef = useRef<string | undefined>(existingThreadId);
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('🔄 SessionChatAssistant - useEffect triggered:', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    const loadSessionContext = async () => {
      try {
        console.log('📥 SessionChatAssistant - Starting to load session context for:', sessionId);

        const sessionDriver = createDriver(SessionDriver);
        const courseDriver = createDriver(CourseDriver);

        // Load session with thread information including context chat thread
        const sessionWithThread = await sessionDriver.getSessionWithContextChat(sessionId);
        const sessionStateData = await sessionDriver.getSessionState(sessionId);

        if (!sessionStateData) {
          throw new Error("Session not found");
        }

        const { session, parsedSnapshot } = sessionStateData;

        console.log('📦 SessionChatAssistant - Session data loaded:', {
          sessionId: session.$id,
          hasThreadId: !!session.threadId,
          threadId: session.threadId,
          hasContextChatThreadId: !!sessionWithThread.contextChatThreadId
        });

        // Use threadId from session if available (priority: session.threadId > sessionWithThread.threadId)
        // This supports thread continuity from EnhancedDashboard
        if (session.threadId) {
          console.log('✅ SessionChatAssistant - Using threadId from session for continuity:', session.threadId);
          setExistingThreadId(session.threadId);
        } else if (sessionWithThread.threadId) {
          console.log('✅ SessionChatAssistant - Found existing thread ID:', sessionWithThread.threadId);
          setExistingThreadId(sessionWithThread.threadId);
        } else {
          console.log('ℹ️ SessionChatAssistant - No existing thread ID found, new thread will be created');
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

        // Enrich outcomes if outcomeRefs available
        let enrichedOutcomes = [];
        if (courseId && parsedSnapshot.outcomeRefs?.length > 0) {
          try {
            console.log('SessionChatAssistant - Enriching outcomes for:', parsedSnapshot.outcomeRefs);
            const outcomeDriver = createDriver(CourseOutcomesDriver);
            enrichedOutcomes = await enrichOutcomeRefs(
              parsedSnapshot.outcomeRefs,
              courseId,
              outcomeDriver
            );
            console.log('SessionChatAssistant - Enriched outcomes count:', enrichedOutcomes.length);
          } catch (outcomeError) {
            console.error('SessionChatAssistant - Failed to enrich outcomes:', outcomeError);
            // Continue without enriched outcomes - it's optional
          }
        } else {
          console.log('SessionChatAssistant - Skipping outcome enrichment (no courseId or outcomeRefs)');
        }

        // Check for lesson diagrams (diagram_context="lesson" for first card)
        // Note: Lesson diagrams are stored with actual cardIds (e.g., "card_001", "card_002")
        // We fetch the first card's lesson diagram to show before the greeting
        let lessonDiagram = null;
        const lessonTemplateId = parsedSnapshot.lessonTemplateId;
        const firstCardId = parsedSnapshot.cards?.[0]?.id;  // Cards use 'id' property, not 'cardId'

        console.log('📐 DIAGRAM FETCH DEBUG - Starting lesson diagram check');
        console.log('📐 DIAGRAM FETCH DEBUG - lessonTemplateId:', lessonTemplateId);
        console.log('📐 DIAGRAM FETCH DEBUG - firstCardId:', firstCardId);

        if (lessonTemplateId && firstCardId) {
          try {
            console.log('📐 DIAGRAM FETCH DEBUG - Creating DiagramDriver');
            const diagramDriver = createDriver(DiagramDriver);

            console.log('📐 DIAGRAM FETCH DEBUG - Calling getDiagramForCardByContext with:');
            console.log('  - lessonTemplateId:', lessonTemplateId);
            console.log('  - cardId:', firstCardId);
            console.log('  - context: "lesson"');

            const diagramResult = await diagramDriver.getDiagramForCardByContext(
              lessonTemplateId,
              firstCardId,  // Use actual first card ID (e.g., "card_001")
              'lesson'      // Fetch lesson diagram (not CFU diagram)
            );

            console.log('📐 DIAGRAM FETCH DEBUG - getDiagramForCardByContext returned:', diagramResult);

            if (diagramResult) {
              lessonDiagram = {
                image_file_id: diagramResult.image_file_id,
                diagram_type: diagramResult.diagram_type,
                title: diagramResult.title || 'Lesson Diagram',
                cardId: firstCardId  // Include cardId for backend tool call
              };
              console.log('📐 DIAGRAM FETCH SUCCESS - Lesson diagram found:', lessonDiagram);
            } else {
              console.log('📐 DIAGRAM FETCH RESULT - No lesson diagram found for first card');
            }
          } catch (diagramError) {
            console.error('📐 DIAGRAM FETCH ERROR - Failed to fetch lesson diagram:', diagramError);
            // Continue without diagram - it's optional
          }
        } else {
          console.log('📐 DIAGRAM FETCH SKIP - Missing lessonTemplateId or firstCardId');
        }

        const context: SessionContext = {
          session_id: session.$id,
          student_id: session.studentId,
          lesson_snapshot: parsedSnapshot,
          use_plain_text: false, // TODO: Get from user preferences when implemented
          ...courseCurriculumMetadata, // Add course_subject, course_level, sqa_course_code, course_title
          enriched_outcomes: enrichedOutcomes, // Add enriched CourseOutcome objects
          lesson_diagram: lessonDiagram, // Add lesson diagram if available
        };

        console.log('✅ SessionChatAssistant - Session context built successfully:', {
          session_id: context.session_id,
          student_id: context.student_id,
          hasLessonSnapshot: !!context.lesson_snapshot,
          lessonTitle: context.lesson_snapshot?.title,
          courseSubject: context.course_subject,
          courseLevel: context.course_level,
          enrichedOutcomesCount: enrichedOutcomes.length
        });

        console.log('📊 SessionChatAssistant - Thread info:', {
          existingThreadId: session.threadId,
          hasExistingConversation: sessionWithThread.hasExistingConversation,
          lastMessageAt: sessionWithThread.lastMessageAt
        });

        console.log('🎯 SessionChatAssistant - Setting session context state');
        setSessionContext(context);
        setSessionStatus(session.status); // Set status for navigation prevention
        console.log('✅ SessionChatAssistant - Session context state updated, status:', session.status);
      } catch (err) {
        console.error("Failed to load session context:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    loadSessionContext();
  }, [sessionId]); // CRITICAL FIX: Remove existingThreadId to prevent re-initialization loop

  // Handle session status change from child components (e.g., LessonCompletionSummaryTool)
  // IMPORTANT: Must be BEFORE early returns to maintain consistent hook order
  const handleSessionStatusChange = useCallback((status: 'created' | 'active' | 'completed' | 'failed') => {
    console.log('🔄 Session status changed to:', status);
    setSessionStatus(status);
  }, []);

  // Navigation prevention: Warn user before leaving active session
  usePreventNavigation(
    sessionStatus === 'active' && !allowNavigation,
    () => setShowExitModal(true),
    allowNavigation
  );

  // Handle confirmed navigation
  const handleConfirmLeave = useCallback(() => {
    setAllowNavigation(true);
    setShowExitModal(false);

    // Navigate after a short delay to allow state to update
    setTimeout(() => {
      // Check if there's a pending navigation from Link click
      const pendingNav = sessionStorage.getItem('pendingNavigation');
      if (pendingNav) {
        sessionStorage.removeItem('pendingNavigation');
        router.push(pendingNav);
      } else {
        // Default to going back
        router.back();
      }
    }, 50);
  }, [router]);

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
    <NavigationPreventionProvider
      value={{
        shouldPreventNavigation: sessionStatus === 'active' && !allowNavigation,
        onNavigationAttempt: () => setShowExitModal(true),
        allowNavigation
      }}
    >
      <CurrentCardProvider onSessionStatusChange={handleSessionStatusChange}>
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

      {/* Navigation Warning Modal */}
      <LessonExitWarningModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onConfirmLeave={handleConfirmLeave}
      />
      </CurrentCardProvider>
    </NavigationPreventionProvider>
  );
}