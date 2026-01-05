"use client";

import { useRef, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { AutoStartTrigger } from "./AutoStartTrigger";
import { LessonSnapshot } from "@/lib/appwrite/types";
import { CourseOutcome } from "@/lib/types/course-outcomes";
import { SessionProvider } from "@/lib/SessionContext";
import { ReplayModeProvider } from "@/contexts/ReplayModeContext";

// Import interrupt-enabled Tool UI components
import { LessonCardPresentationTool } from "@/components/tools/LessonCardPresentationTool";
import { LessonDiagramPresentationTool } from "@/components/tools/LessonDiagramPresentationTool";
import { FeedbackPresentationTool } from "@/components/tools/FeedbackPresentationTool";
import { ProgressAcknowledgmentTool } from "@/components/tools/ProgressAcknowledgmentTool";
import { LessonCompletionSummaryTool } from "@/components/tools/LessonCompletionSummaryTool";

// Import infinite practice Tool UI components
import { ConceptPresentationTool } from "@/components/tools/ConceptPresentationTool";
import { PracticeQuestionTool } from "@/components/tools/PracticeQuestionTool";
import { PracticeFeedbackTool } from "@/components/tools/PracticeFeedbackTool";

export interface SessionContext {
  session_id: string;
  student_id: string;
  lesson_snapshot: LessonSnapshot;
  // Course metadata fields for curriculum-aware prompts (Phase 8 - Frontend Integration)
  course_subject?: string;      // e.g., "mathematics", "physics", "application-of-mathematics"
  course_level?: string;         // e.g., "national-3", "national-4", "national-5"
  sqa_course_code?: string;      // SQA course code if available
  course_title?: string;         // Full course title
  // Enriched SQA outcome data
  enriched_outcomes?: CourseOutcome[];  // Full CourseOutcome objects from course_outcomes collection
  // Accessibility preferences
  use_plain_text?: boolean;     // Use explainer_plain for dyslexia-friendly content
  // Lesson diagram (diagram_context="lesson") for first card
  lesson_diagram?: {
    image_file_id: string;
    diagram_type?: string;
    title?: string;
    cardId?: string;  // Actual cardId (e.g., "card_001") for backend tool call
  } | null;
}

export interface MyAssistantProps {
  sessionId?: string;
  threadId?: string;
  sessionContext?: SessionContext;
  onThreadCreated?: (threadId: string) => void; // Callback when new thread is created
  isReplayMode?: boolean; // Enable replay mode (disables interactions)
  replayRuntime?: any; // Custom replay runtime for playing back stored messages
}

export function MyAssistant({
  sessionId,
  threadId: initialThreadId,
  sessionContext,
  onThreadCreated,
  isReplayMode = false,
  replayRuntime
}: MyAssistantProps = {}) {
  const threadIdRef = useRef<string | undefined>(initialThreadId);

  // CRITICAL FIX: Track whether thread has been loaded to prevent re-loading
  // When streaming completes, langGraphRuntime reference might change, triggering
  // the useEffect below. Without this guard, switchToThread would be called again,
  // causing messages to disappear as the thread reloads.
  const hasLoadedThreadRef = useRef<boolean>(false);

  // Use replay runtime if in replay mode, otherwise use LangGraph runtime
  const langGraphRuntime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      // Let runtime handle thread creation if needed
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;
        
        // Notify parent component about thread creation for persistence
        if (onThreadCreated) {
          onThreadCreated(thread_id);
        }
      }
      const threadId = threadIdRef.current;
      
      
      return sendMessage({
        threadId,
        messages,
        command,
        sessionContext, // Pass session context to chat API
      });
    },
    onSwitchToNewThread: async () => {
      const { thread_id } = await createThread();
      threadIdRef.current = thread_id;
      
      // Notify parent component about thread creation for persistence
      if (onThreadCreated) {
        onThreadCreated(thread_id);
      }
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      
      // 🚨 INTERRUPT DEBUG: Log interrupt data clearly
      const interrupts = state.tasks?.[0]?.interrupts;
      console.log('🚨 INTERRUPT DEBUG - onSwitchToThread:', {
        threadId,
        hasInterrupts: !!interrupts,
        interruptCount: interrupts ? interrupts.length : 0,
        interruptData: interrupts
      });
      
      return { 
        messages: state.values.messages,
        interrupts: interrupts
      };
    },
  });

  // Manually load thread state if we're initializing with an existing thread
  // CRITICAL: Only load once per thread ID to prevent messages disappearing
  // Note: React StrictMode runs effects twice synchronously, so we must set the guard
  // BEFORE the async call to prevent both runs from starting parallel loads.
  useEffect(() => {
    console.log('🔄 MyAssistant - useEffect triggered:', {
      hasInitialThreadId: !!initialThreadId,
      currentThreadId: threadIdRef.current,
      hasAlreadyLoaded: hasLoadedThreadRef.current,
      willLoadThread: !!(initialThreadId && threadIdRef.current === initialThreadId && !hasLoadedThreadRef.current)
    });

    // Skip if we've already started loading this thread
    // CRITICAL: This check must happen SYNCHRONOUSLY before any async operations
    // to prevent React StrictMode's double-execution from causing parallel loads
    if (hasLoadedThreadRef.current) {
      console.log('⏭️ MyAssistant - Skipping thread reload (already loaded/loading, preventing message loss)');
      return;
    }

    if (initialThreadId && threadIdRef.current === initialThreadId) {
      // CRITICAL: Set guard IMMEDIATELY (synchronously) before async call
      // This prevents React StrictMode's second effect run from starting another load
      hasLoadedThreadRef.current = true;

      console.log('📥 MyAssistant - Loading existing thread state:', initialThreadId);

      getThreadState(initialThreadId)
        .then(state => {
          console.log('✅ MyAssistant - Thread state loaded:', {
            threadId: initialThreadId,
            messageCount: state.values?.messages?.length || 0,
            hasInterrupts: !!(state.tasks?.[0]?.interrupts),
            interruptCount: state.tasks?.[0]?.interrupts?.length || 0
          });

          // Use runtime's switchToThread to properly load the messages
          runtime.switchToThread(initialThreadId);
        })
        .catch(error => {
          console.error('❌ MyAssistant - Failed to load thread state:', error);
          // Reset the guard on error so retry is possible
          hasLoadedThreadRef.current = false;
        });
    } else {
      console.log('⏭️ MyAssistant - Skipping thread load (no initial thread or thread mismatch)');
    }
  }, [initialThreadId, langGraphRuntime]);

  // Use replay runtime if provided, otherwise use LangGraph runtime
  const runtime = isReplayMode && replayRuntime ? replayRuntime : langGraphRuntime;

  const isSessionMode = !!sessionContext;

  // Removed noisy render log - use React DevTools for component debugging
  // Only log mode changes, not every render
  // console.log('🎬 MyAssistant - Mode:', {...})

  return (
    <ReplayModeProvider isReplayMode={isReplayMode}>
      <SessionProvider isSessionMode={isSessionMode}>
        <AssistantRuntimeProvider runtime={runtime}>
          {/* Only show AutoStartTrigger in non-replay mode */}
          {!isReplayMode && (
            <AutoStartTrigger
              sessionContext={sessionContext}
              existingThreadId={initialThreadId}
            />
          )}

          <Thread />

          {/* Tool UI components render automatically based on tool calls in messages */}
          {/* They work in both live and replay modes */}
          <LessonCardPresentationTool />
          <LessonDiagramPresentationTool />
          <FeedbackPresentationTool />
          <ProgressAcknowledgmentTool />
          <LessonCompletionSummaryTool />

          {/* Infinite Practice Tool UI components */}
          <ConceptPresentationTool />
          <PracticeQuestionTool />
          <PracticeFeedbackTool />
        </AssistantRuntimeProvider>
      </SessionProvider>
    </ReplayModeProvider>
  );
}
