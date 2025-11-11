"use client";

/**
 * Mock MyAssistant Component
 *
 * This is identical to the real MyAssistant but uses the mock chatApi
 * so we can test with fake LangGraph events.
 *
 * This file is a COPY of MyAssistant.tsx with one change:
 * - Imports from lib/chatApi.mock.ts instead of lib/chatApi.ts
 */

import { useRef, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

// ⭐ THE ONLY DIFFERENCE: Import from mock chatApi
import { createThread, getThreadState, sendMessage } from "@/lib/chatApi.mock";

import { Thread } from "@/components/assistant-ui/thread";
import { AutoStartTrigger } from "../AutoStartTrigger";
import { LessonSnapshot } from "@/lib/appwrite/types";
import { CourseOutcome } from "@/lib/types/course-outcomes";
import { SessionProvider } from "@/lib/SessionContext";
import { ReplayModeProvider } from "@/contexts/ReplayModeContext";

// Import REAL Tool UI components (these should work with mock data)
import { LessonCardPresentationTool } from "@/components/tools/LessonCardPresentationTool";
import { FeedbackPresentationTool } from "@/components/tools/FeedbackPresentationTool";
import { ProgressAcknowledgmentTool } from "@/components/tools/ProgressAcknowledgmentTool";
import { LessonSummaryPresentationTool } from "@/components/tools/LessonSummaryPresentationTool";
import { LessonCompletionSummaryTool } from "@/components/tools/LessonCompletionSummaryTool";

export interface SessionContext {
  session_id: string;
  student_id: string;
  lesson_snapshot: LessonSnapshot;
  course_subject?: string;
  course_level?: string;
  sqa_course_code?: string;
  course_title?: string;
  enriched_outcomes?: CourseOutcome[];
  use_plain_text?: boolean;
}

export interface MockMyAssistantProps {
  sessionId?: string;
  threadId?: string;
  sessionContext?: SessionContext;
  onThreadCreated?: (threadId: string) => void;
  isReplayMode?: boolean;
  replayRuntime?: any;
}

export function MockMyAssistant({
  sessionId,
  threadId: initialThreadId,
  sessionContext,
  onThreadCreated,
  isReplayMode = false,
  replayRuntime
}: MockMyAssistantProps = {}) {
  const threadIdRef = useRef<string | undefined>(initialThreadId);

  // Use replay runtime if in replay mode, otherwise use LangGraph runtime
  const langGraphRuntime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      // Let runtime handle thread creation if needed
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;

        if (onThreadCreated) {
          onThreadCreated(thread_id);
        }
      }
      const threadId = threadIdRef.current;

      return sendMessage({
        threadId,
        messages,
        command,
        sessionContext,
      });
    },
    onSwitchToNewThread: async () => {
      const { thread_id } = await createThread();
      threadIdRef.current = thread_id;

      if (onThreadCreated) {
        onThreadCreated(thread_id);
      }
    },
    onSwitchToThread: async (threadId) => {
      console.log('🔄 [MOCK RUNTIME] onSwitchToThread called for:', threadId);
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;

      const interrupts = state.tasks?.[0]?.interrupts;
      console.log('🚨 [MOCK RUNTIME] onSwitchToThread interrupt state:', {
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

  const runtime = isReplayMode && replayRuntime ? replayRuntime : langGraphRuntime;

  // Auto-start for non-replay sessions
  useEffect(() => {
    if (!isReplayMode && sessionContext) {
      console.log('🚀 MockMyAssistant - Auto-starting session...');
    }
  }, [sessionContext, isReplayMode]);

  return (
    <div className="h-full flex flex-col">
      {/* Test Mode Banner */}
      <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm">
        <span className="text-green-800 font-semibold">✅ MOCK MODE</span>
        <span className="text-green-600 ml-2">Using mock LangGraph client - Real Tool UIs</span>
      </div>

      <div className="flex-1 min-h-0">
        <SessionProvider sessionId={sessionId}>
          <ReplayModeProvider value={{ isReplayMode }}>
            <AssistantRuntimeProvider runtime={runtime}>
              {/* Auto-start trigger */}
              {!isReplayMode && sessionContext && (
                <AutoStartTrigger sessionContext={sessionContext} />
              )}

              {/* REAL Thread component with REAL tool UIs */}
              <Thread
                assistantMessage={{ components: { Text: undefined } }}
                tools={{
                  lesson_card_presentation: LessonCardPresentationTool,
                  feedback_presentation: FeedbackPresentationTool,
                  progress_acknowledgment: ProgressAcknowledgmentTool,
                  lesson_summary_presentation: LessonSummaryPresentationTool,
                  lesson_completion_summary: LessonCompletionSummaryTool,
                }}
              />
            </AssistantRuntimeProvider>
          </ReplayModeProvider>
        </SessionProvider>
      </div>
    </div>
  );
}
