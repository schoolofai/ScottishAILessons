"use client";

import { useRef, useEffect, useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";

export interface SessionContext {
  session_id: string;
  student_id: string;
  lesson_snapshot: any;
  current_card_index: number;
  current_card: any;
  stage?: string;
}

export interface MyAssistantProps {
  sessionId?: string;
  threadId?: string;
  sessionContext?: SessionContext;
}

export function MyAssistant({ 
  sessionId, 
  threadId: initialThreadId, 
  sessionContext 
}: MyAssistantProps = {}) {
  const threadIdRef = useRef<string | undefined>(initialThreadId);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  
  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;
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
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      return { messages: state.values.messages };
    },
  });

  // Auto-start lesson for new teaching sessions
  useEffect(() => {
    if (sessionContext && !hasAutoStarted && !initialThreadId) {
      // This is a new teaching session - auto-start the lesson
      setHasAutoStarted(true);
      
      // Delay to ensure runtime is ready
      setTimeout(() => {
        if (runtime.addMessage) {
          runtime.addMessage({
            role: "user",
            content: "start lesson" // This will trigger the teaching graph
          });
        }
      }, 500);
    }
  }, [sessionContext, hasAutoStarted, initialThreadId, runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
