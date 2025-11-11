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
import { LessonSummaryPresentationTool } from "@/components/tools/LessonSummaryPresentationTool";
import { LessonCompletionSummaryTool } from "@/components/tools/LessonCompletionSummaryTool";

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
  useEffect(() => {
    console.log('🔄 MyAssistant - useEffect triggered:', {
      hasInitialThreadId: !!initialThreadId,
      currentThreadId: threadIdRef.current,
      willLoadThread: !!(initialThreadId && threadIdRef.current === initialThreadId)
    });

    if (initialThreadId && threadIdRef.current === initialThreadId) {
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
        });
    } else {
      console.log('⏭️ MyAssistant - Skipping thread load (no initial thread or already loaded)');
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
          <LessonSummaryPresentationTool />
          <LessonCompletionSummaryTool />
        </AssistantRuntimeProvider>
      </SessionProvider>
    </ReplayModeProvider>
  );
}
