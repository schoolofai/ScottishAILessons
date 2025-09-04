"use client";

import { useRef, useEffect, useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { AutoStartTrigger } from "./AutoStartTrigger";

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

// Global thread cache to prevent duplicate thread creation across component instances
const threadCache = new Map<string, string>();

export function MyAssistant({ 
  sessionId, 
  threadId: initialThreadId, 
  sessionContext 
}: MyAssistantProps = {}) {
  const threadIdRef = useRef<string | undefined>(initialThreadId);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [runtimeThreadId, setRuntimeThreadId] = useState<string | undefined>(initialThreadId);
  
  console.log('MyAssistant - Received props:', { sessionId, threadId: initialThreadId, sessionContext });
  
  // Create thread immediately for teaching sessions if we don't have one
  useEffect(() => {
    if (sessionContext && !threadIdRef.current) {
      const cacheKey = sessionContext.session_id;
      
      // Check if we already have a thread for this session
      if (threadCache.has(cacheKey)) {
        const cachedThreadId = threadCache.get(cacheKey)!;
        console.log('Using cached thread for teaching session:', cachedThreadId);
        threadIdRef.current = cachedThreadId;
        setRuntimeThreadId(cachedThreadId);
        return;
      }
      
      console.log('Creating thread for teaching session');
      createThread().then(({ thread_id }) => {
        console.log('Created thread for teaching session:', thread_id);
        // Cache the thread ID for this session
        threadCache.set(cacheKey, thread_id);
        threadIdRef.current = thread_id;
        setRuntimeThreadId(thread_id);
      }).catch(err => {
        console.error('Failed to create thread for teaching session:', err);
      });
    }
  }, [sessionContext]);
  
  const runtime = useLangGraphRuntime({
    threadId: runtimeThreadId,
    stream: async (messages, { command }) => {
      const threadId = threadIdRef.current || runtimeThreadId;
      if (!threadId) {
        console.error('No thread ID available for sending message');
        throw new Error('No thread ID available');
      }
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
      setRuntimeThreadId(thread_id);
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      setRuntimeThreadId(threadId);
      return { messages: state.values.messages };
    },
  });

  // Auto-start will be handled by AutoStartTrigger component inside the runtime context

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AutoStartTrigger 
        sessionContext={sessionContext} 
        initialThreadId={initialThreadId}
        threadReady={!!runtimeThreadId}
      />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
