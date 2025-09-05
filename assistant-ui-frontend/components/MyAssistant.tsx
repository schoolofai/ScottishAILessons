"use client";

import { useRef, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { AutoStartTrigger } from "./AutoStartTrigger";
import { LessonSnapshot } from "@/lib/appwrite/types";

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
  
  console.log('MyAssistant - Received props:', { sessionId, threadId: initialThreadId, sessionContext });
  
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
      
      console.log('MyAssistant - Streaming to thread:', threadId, 'with', messages?.length || 0, 'messages');
      
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
      console.log('MyAssistant - Created new thread:', thread_id);
      
      // Notify parent component about thread creation for persistence
      if (onThreadCreated) {
        onThreadCreated(thread_id);
      }
    },
    onSwitchToThread: async (threadId) => {
      console.log('MyAssistant - onSwitchToThread called with threadId:', threadId);
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      console.log('MyAssistant - Switched to thread:', threadId, 'with', state.values.messages?.length || 0, 'messages');
      return { 
        messages: state.values.messages,
        interrupts: state.tasks?.[0]?.interrupts
      };
    },
  });

  // Manually load thread state if we're initializing with an existing thread
  useEffect(() => {
    if (initialThreadId && threadIdRef.current === initialThreadId) {
      console.log('MyAssistant - Loading existing thread state for:', initialThreadId);
      getThreadState(initialThreadId)
        .then(state => {
          console.log('MyAssistant - Loaded thread state with', state.values.messages?.length || 0, 'messages');
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
    </AssistantRuntimeProvider>
  );
}
