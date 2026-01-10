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

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC: Streaming state tracking to debug message disappearing issue
  // These refs track when streaming is active to identify race conditions
  // ═══════════════════════════════════════════════════════════════════════════
  const isStreamingRef = useRef<boolean>(false);
  const lastStreamEndTimeRef = useRef<number>(0);
  const streamStartTimeRef = useRef<number>(0);
  const streamMessageCountRef = useRef<number>(0);

  // Use replay runtime if in replay mode, otherwise use LangGraph runtime
  const langGraphRuntime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      // ═══════════════════════════════════════════════════════════════════════
      // DIAGNOSTIC: Mark streaming start
      // ═══════════════════════════════════════════════════════════════════════
      isStreamingRef.current = true;
      streamStartTimeRef.current = Date.now();
      streamMessageCountRef.current = 0;
      console.log('🚀 STREAM START', {
        timestamp: new Date().toISOString(),
        threadId: threadIdRef.current,
        hasCommand: !!command,
        messageCount: messages?.length || 0
      });

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

      const rawGenerator = sendMessage({
        threadId,
        messages,
        command,
        sessionContext, // Pass session context to chat API
      });

      // ═══════════════════════════════════════════════════════════════════════
      // DIAGNOSTIC: Wrap generator to track streaming completion
      // ═══════════════════════════════════════════════════════════════════════
      async function* trackedGenerator() {
        try {
          for await (const event of await rawGenerator) {
            streamMessageCountRef.current++;
            yield event;
          }
        } finally {
          // Mark streaming end when generator completes (success or error)
          isStreamingRef.current = false;
          lastStreamEndTimeRef.current = Date.now();
          const duration = lastStreamEndTimeRef.current - streamStartTimeRef.current;
          console.log('🏁 STREAM END', {
            timestamp: new Date().toISOString(),
            threadId,
            durationMs: duration,
            eventCount: streamMessageCountRef.current
          });
        }
      }

      return trackedGenerator();
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
      // ═══════════════════════════════════════════════════════════════════════
      // DIAGNOSTIC: Log when onSwitchToThread is called and streaming state
      // ═══════════════════════════════════════════════════════════════════════
      const now = Date.now();
      const timeSinceStreamEnd = now - lastStreamEndTimeRef.current;
      const timeSinceStreamStart = now - streamStartTimeRef.current;

      console.log('🔄 onSwitchToThread CALLED', {
        timestamp: new Date().toISOString(),
        threadId,
        isCurrentlyStreaming: isStreamingRef.current,
        timeSinceStreamEndMs: lastStreamEndTimeRef.current > 0 ? timeSinceStreamEnd : 'never streamed',
        timeSinceStreamStartMs: streamStartTimeRef.current > 0 ? timeSinceStreamStart : 'never started',
        streamEventsReceived: streamMessageCountRef.current
      });

      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;

      const interrupts = state.tasks?.[0]?.interrupts;

      // DIAGNOSTIC: Log what we're returning
      console.log('🔄 onSwitchToThread RETURNING', {
        timestamp: new Date().toISOString(),
        threadId,
        messageCount: state.values.messages?.length || 0,
        firstMessagePreview: state.values.messages?.[0]?.content?.toString()?.substring(0, 80) || 'none',
        lastMessagePreview: state.values.messages?.slice(-1)[0]?.content?.toString()?.substring(0, 80) || 'none',
        hasInterrupts: !!interrupts?.length,
        interruptCount: interrupts?.length || 0,
        isCurrentlyStreaming: isStreamingRef.current,
        timeSinceStreamEndMs: lastStreamEndTimeRef.current > 0 ? (Date.now() - lastStreamEndTimeRef.current) : 'N/A'
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
    // ═══════════════════════════════════════════════════════════════════════
    // DIAGNOSTIC: Log useEffect trigger to identify what's causing re-runs
    // ═══════════════════════════════════════════════════════════════════════
    console.log('📌 useEffect TRIGGERED', {
      timestamp: new Date().toISOString(),
      initialThreadId,
      hasLoadedThread: hasLoadedThreadRef.current,
      isCurrentlyStreaming: isStreamingRef.current,
      timeSinceStreamEnd: lastStreamEndTimeRef.current > 0
        ? `${Date.now() - lastStreamEndTimeRef.current}ms ago`
        : 'never'
    });

    // Skip if we've already started loading this thread
    // CRITICAL: This check must happen SYNCHRONOUSLY before any async operations
    // to prevent React StrictMode's double-execution from causing parallel loads
    if (hasLoadedThreadRef.current) {
      console.log('📌 useEffect SKIPPED (already loaded)');
      return;
    }

    if (initialThreadId && threadIdRef.current === initialThreadId) {
      // CRITICAL: Set guard IMMEDIATELY (synchronously) before async call
      // This prevents React StrictMode's second effect run from starting another load
      hasLoadedThreadRef.current = true;

      console.log('📌 useEffect EXECUTING switchToThread', {
        threadId: initialThreadId,
        isCurrentlyStreaming: isStreamingRef.current
      });

      getThreadState(initialThreadId)
        .then(state => {
          // Use runtime's switchToThread to properly load the messages
          runtime.switchToThread(initialThreadId);
        })
        .catch(error => {
          console.error('❌ MyAssistant - Failed to load thread state:', error);
          // Reset the guard on error so retry is possible
          hasLoadedThreadRef.current = false;
        });
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
