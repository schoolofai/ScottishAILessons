"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useLangGraphSend } from "@assistant-ui/react-langgraph";
import { useThread } from "@assistant-ui/react";
import { SessionContext } from "./MyAssistant";

interface AutoStartTriggerProps {
  sessionContext?: SessionContext;
  initialThreadId?: string;
  threadReady?: boolean; // New prop to indicate when thread is ready
}

// Global coordination for auto-start across component instances
const globalAutoStartState = new Map<string, boolean>();

export function AutoStartTrigger({ sessionContext, initialThreadId, threadReady }: AutoStartTriggerProps) {
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const send = useLangGraphSend();
  const thread = useThread();

  useEffect(() => {
    if (!sessionContext || initialThreadId || !send || !thread || !threadReady) {
      return;
    }

    const sessionKey = sessionContext.session_id;
    const hasExistingMessages = thread?.messages && thread.messages.length > 0;
    
    console.log('AutoStartTrigger - sessionContext:', !!sessionContext, 'hasAutoStarted:', hasAutoStarted, 'initialThreadId:', initialThreadId, 'send available:', !!send, 'thread available:', !!thread, 'threadReady:', threadReady, 'thread messages:', thread?.messages?.length || 0, 'global started for session:', globalAutoStartState.get(sessionKey));

    // If thread already has messages, skip auto-start
    if (hasExistingMessages) {
      console.log('Thread already has messages, skipping auto-start');
      setHasAutoStarted(true);
      globalAutoStartState.set(sessionKey, true);
      return;
    }

    // Check if auto-start already initiated for this session
    if (globalAutoStartState.get(sessionKey)) {
      console.log('Auto-start already initiated for this session, skipping');
      setHasAutoStarted(true);
      return;
    }

    // First component instance for this session - initiate auto-start
    console.log('Auto-starting lesson with session context:', sessionContext);
    globalAutoStartState.set(sessionKey, true);
    setHasAutoStarted(true);
    
    // Thread is confirmed ready, send message immediately
    console.log('Sending auto-start message using useLangGraphSend');
    
    // Send empty message to trigger the teaching graph
    send([{
      type: "human",
      content: "" // Empty message just to trigger the graph
    }], {}).catch(err => {
      console.error('Auto-start failed:', err);
      // Reset global state so user can manually start
      globalAutoStartState.delete(sessionKey);
      setHasAutoStarted(false);
    });
  }, [sessionContext, hasAutoStarted, initialThreadId, send, thread, threadReady]);

  // This component doesn't render anything - it's just for side effects
  return null;
}