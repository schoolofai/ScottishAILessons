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
  const [runtimeThreadId, setRuntimeThreadId] = useState<string | undefined>(initialThreadId);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  
  console.log('MyAssistant - Received props:', { sessionId, threadId: initialThreadId, sessionContext });
  console.log('MyAssistant - Current thread state:', { 
    threadIdRef: threadIdRef.current, 
    runtimeThreadId,
    sessionId: sessionContext?.session_id 
  });
  
  // Create thread immediately for teaching sessions if we don't have one
  useEffect(() => {
    if (sessionContext && !threadIdRef.current && !isCreatingThread) {
      const cacheKey = sessionContext.session_id;
      
      // Check if we already have a thread for this session
      if (threadCache.has(cacheKey)) {
        const cachedThreadId = threadCache.get(cacheKey)!;
        console.log('MyAssistant - Using cached thread for teaching session:', cachedThreadId);
        threadIdRef.current = cachedThreadId;
        setRuntimeThreadId(cachedThreadId);
        console.log('MyAssistant - Thread IDs synchronized with cache:', { 
          threadIdRef: threadIdRef.current, 
          runtimeThreadId: cachedThreadId 
        });
        return;
      }
      
      console.log('MyAssistant - Creating new thread for teaching session');
      setIsCreatingThread(true);
      createThread().then(({ thread_id }) => {
        console.log('MyAssistant - Created thread for teaching session:', thread_id);
        // Cache the thread ID for this session
        threadCache.set(cacheKey, thread_id);
        threadIdRef.current = thread_id;
        setRuntimeThreadId(thread_id);
        setIsCreatingThread(false);
        console.log('MyAssistant - Thread IDs synchronized with new thread:', { 
          threadIdRef: threadIdRef.current, 
          runtimeThreadId: thread_id,
          cached: threadCache.get(cacheKey)
        });
      }).catch(err => {
        console.error('MyAssistant - Failed to create thread for teaching session:', err);
        setIsCreatingThread(false);
      });
    }
  }, [sessionContext, isCreatingThread]);
  
  const runtime = useLangGraphRuntime({
    threadId: runtimeThreadId,
    stream: async (messages, { command }) => {
      const threadId = threadIdRef.current || runtimeThreadId;
      console.log('MyAssistant.runtime.stream - Thread ID resolution:', {
        threadIdRef: threadIdRef.current,
        runtimeThreadId,
        selectedThreadId: threadId,
        messagesLength: messages?.length || 0,
        hasCommand: !!command
      });
      
      if (!threadId) {
        console.error('MyAssistant.runtime.stream - No thread ID available for sending message');
        throw new Error('No thread ID available');
      }
      
      console.log('MyAssistant.runtime.stream - Calling sendMessage with threadId:', threadId);
      return sendMessage({
        threadId,
        messages,
        command,
        sessionContext, // Pass session context to chat API
      });
    },
    onSwitchToNewThread: async () => {
      console.log('MyAssistant.onSwitchToNewThread - Creating new thread');
      const { thread_id } = await createThread();
      console.log('MyAssistant.onSwitchToNewThread - Created thread:', thread_id);
      
      // Update all references immediately
      threadIdRef.current = thread_id;
      setRuntimeThreadId(thread_id);
      
      // Update cache if we have session context
      if (sessionContext) {
        threadCache.set(sessionContext.session_id, thread_id);
        console.log('MyAssistant.onSwitchToNewThread - Updated thread cache for session:', sessionContext.session_id);
      }
      
      return { threadId: thread_id };
    },
    onSwitchToThread: async (threadId) => {
      console.log('MyAssistant.onSwitchToThread - Switching to thread:', threadId);
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      setRuntimeThreadId(threadId);
      console.log('MyAssistant.onSwitchToThread - Thread switch complete:', {
        newThreadId: threadId,
        messagesCount: state.values.messages?.length || 0
      });
      return { messages: state.values.messages };
    },
  });

  // Auto-start will be handled by AutoStartTrigger component inside the runtime context

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AutoStartTrigger 
        sessionContext={sessionContext}
        threadId={runtimeThreadId}
      />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
