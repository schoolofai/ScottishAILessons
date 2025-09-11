"use client";

import { useRef, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { AutoStartTrigger } from "./AutoStartTrigger";
import { LessonSnapshot } from "@/lib/appwrite/types";

// Import interrupt-enabled Tool UI components
import { LessonCardPresentationTool } from "@/components/tools/LessonCardPresentationTool";
import { FeedbackPresentationTool } from "@/components/tools/FeedbackPresentationTool";
import { ProgressAcknowledgmentTool } from "@/components/tools/ProgressAcknowledgmentTool";
import { LessonSummaryPresentationTool } from "@/components/tools/LessonSummaryPresentationTool";

export interface SessionContext {
  session_id: string;
  student_id: string;
  lesson_snapshot: LessonSnapshot;
}

export interface MyAssistantProps {
  sessionId?: string;
  threadId?: string;
  sessionContext?: SessionContext;
  onThreadCreated?: (threadId: string) => void; // Callback when new thread is created
}

export function MyAssistant({ 
  sessionId, 
  threadId: initialThreadId, 
  sessionContext,
  onThreadCreated
}: MyAssistantProps = {}) {
  const threadIdRef = useRef<string | undefined>(initialThreadId);
  
  const runtime = useLangGraphRuntime({
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
    if (initialThreadId && threadIdRef.current === initialThreadId) {
      getThreadState(initialThreadId)
        .then(state => {
          // Use runtime's switchToThread to properly load the messages
          runtime.switchToThread(initialThreadId);
        })
        .catch(error => {
          console.error('MyAssistant - Failed to load thread state:', error);
        });
    }
  }, [initialThreadId, runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AutoStartTrigger 
        sessionContext={sessionContext}
        existingThreadId={initialThreadId}
      />
      <Thread />
      
      {/* Interrupt-enabled Tool UI components for interactive lesson cards */}
      <LessonCardPresentationTool />
      <FeedbackPresentationTool />
      <ProgressAcknowledgmentTool />
      <LessonSummaryPresentationTool />
    </AssistantRuntimeProvider>
  );
}
