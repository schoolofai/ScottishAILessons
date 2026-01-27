"use client";

import { useRef, useEffect, useState } from "react";
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
  onThreadExpired?: (threadId: string) => void; // Callback when thread has expired (7-day limit)
  isReplayMode?: boolean; // Enable replay mode (disables interactions)
  replayRuntime?: any; // Custom replay runtime for playing back stored messages
  isThreadIdDetermined?: boolean; // True when we KNOW whether there's a threadId (prevents race condition)
}

export function MyAssistant({
  sessionId,
  threadId: initialThreadId,
  sessionContext,
  onThreadCreated,
  onThreadExpired,
  isReplayMode = false,
  replayRuntime,
  isThreadIdDetermined = true // Default to true for backwards compatibility
}: MyAssistantProps = {}) {
  const threadIdRef = useRef<string | undefined>(initialThreadId);

  // Track loading state for resuming threads - shows loading indicator instead of empty "Hello there!" message
  // Start as true if we have an initialThreadId (resuming), false otherwise (new session)
  const [isLoadingThreadState, setIsLoadingThreadState] = useState<boolean>(!!initialThreadId);

  // CRITICAL FIX: Track whether thread has been loaded to prevent re-loading
  // When streaming completes, langGraphRuntime reference might change, triggering
  // the useEffect below. Without this guard, switchToThread would be called again,
  // causing messages to disappear as the thread reloads.
  const hasLoadedThreadRef = useRef<boolean>(false);

  // CRITICAL FIX: Sync threadIdRef when initialThreadId prop changes
  // useRef initial value is only set on first mount. When SessionChatAssistant
  // fetches the threadId from API and updates the prop, we need to sync the ref.
  // Without this, the ref stays undefined and switchToThread never gets called.
  // Also reset hasLoadedThreadRef so the loading useEffect will trigger.
  useEffect(() => {
    if (initialThreadId && initialThreadId !== threadIdRef.current) {
      console.log('📌 threadIdRef SYNC - updating ref to match prop', {
        previous: threadIdRef.current,
        new: initialThreadId,
        willResetLoadFlag: true
      });
      threadIdRef.current = initialThreadId;
      // Reset the loaded flag so the thread loading useEffect will execute
      hasLoadedThreadRef.current = false;
      // Show loading indicator while we fetch the thread state
      setIsLoadingThreadState(true);
    }
  }, [initialThreadId]);

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

      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL FIX: Skip fetching thread state if we're actively streaming
      // or if streaming just ended (within 5 seconds). This prevents a race
      // condition where stale backend state overwrites freshly streamed content.
      // ═══════════════════════════════════════════════════════════════════════
      const STREAM_PROTECTION_WINDOW_MS = 5000;
      const streamingRecently = lastStreamEndTimeRef.current > 0 && timeSinceStreamEnd < STREAM_PROTECTION_WINDOW_MS;

      if (isStreamingRef.current || streamingRecently) {
        console.log('🛡️ onSwitchToThread SKIPPED - Streaming protection active', {
          isCurrentlyStreaming: isStreamingRef.current,
          timeSinceStreamEndMs: timeSinceStreamEnd,
          protectionWindowMs: STREAM_PROTECTION_WINDOW_MS
        });
        // Return empty messages array to tell the runtime not to update thread state
        // This preserves the currently displayed streamed content
        // The runtime will see no new messages and keep the current state
        threadIdRef.current = threadId;
        return { messages: [], interrupts: [] };
      }

      try {
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

        // Thread state loaded - clear loading indicator
        setIsLoadingThreadState(false);

        return {
          messages: state.values.messages,
          interrupts: interrupts
        };
      } catch (error: any) {
        // ═══════════════════════════════════════════════════════════════════════
        // THREAD EXPIRY HANDLING: LangGraph threads expire after 7 days
        // Detect expiry and notify parent component to show recovery UI
        // ═══════════════════════════════════════════════════════════════════════
        const errorMessage = error?.message?.toLowerCase() || '';
        const isExpiredError =
          errorMessage.includes('not found') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('thread') ||
          error?.status === 404;

        if (isExpiredError && onThreadExpired) {
          console.log('⏰ Thread expired or not found, triggering onThreadExpired callback', {
            threadId,
            errorMessage: error?.message,
            errorStatus: error?.status
          });
          setIsLoadingThreadState(false); // Clear loading state on expiry
          onThreadExpired(threadId);
          // Return empty state - parent component will handle recovery UI
          return { messages: [], interrupts: [] };
        }

        // Re-throw non-expiry errors
        console.error('❌ onSwitchToThread failed with unexpected error:', error);
        setIsLoadingThreadState(false); // Clear loading state on error
        throw error;
      }
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

          // Check if thread expired (7-day limit)
          const errorMessage = error?.message?.toLowerCase() || '';
          const isExpiredError =
            errorMessage.includes('not found') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('thread') ||
            error?.status === 404;

          if (isExpiredError && onThreadExpired) {
            console.log('⏰ Initial thread load failed - thread expired', { threadId: initialThreadId });
            onThreadExpired(initialThreadId);
          }

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
              isThreadIdDetermined={isThreadIdDetermined}
            />
          )}

          {/* Show loading indicator while fetching thread state for resume */}
          {isLoadingThreadState ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="relative mb-4">
                <div className="w-12 h-12 border-4 border-primary/20 rounded-full animate-spin border-t-primary" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Loading your lesson...
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Resuming from where you left off
              </p>
            </div>
          ) : (
            <Thread />
          )}

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
