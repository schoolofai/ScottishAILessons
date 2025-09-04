"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useLangGraphSend } from "@assistant-ui/react-langgraph";
import { useThread } from "@assistant-ui/react";
import { SessionContext } from "./MyAssistant";

interface AutoStartTriggerProps {
  sessionContext?: SessionContext;
  threadId?: string;
}

// Global coordination for auto-start across component instances
const globalAutoStartState = new Map<string, boolean>();

export function AutoStartTrigger({ sessionContext, threadId }: AutoStartTriggerProps) {
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const send = useLangGraphSend();
  const thread = useThread();

  useEffect(() => {
    // Wait for all dependencies including threadId to be available
    if (!sessionContext || !send || !threadId) {
      console.log('AutoStartTrigger - Waiting for dependencies:', {
        hasSessionContext: !!sessionContext,
        hasSend: !!send,
        hasThread: !!thread,
        hasThreadId: !!threadId
      });
      return;
    }

    const sessionKey = sessionContext.session_id;
    const hasExistingMessages = thread?.messages && thread.messages.length > 0;
    
    console.log('AutoStartTrigger - Checking auto-start conditions:', {
      sessionId: sessionKey,
      hasAutoStarted,
      threadId: threadId,
      messageCount: thread?.messages?.length || 0,
      globalStarted: globalAutoStartState.get(sessionKey)
    });

    // If thread already has messages, skip auto-start
    if (hasExistingMessages) {
      console.log('AutoStartTrigger - Thread already has messages, skipping auto-start');
      setHasAutoStarted(true);
      globalAutoStartState.set(sessionKey, true);
      return;
    }

    // Check if auto-start already initiated for this session
    if (globalAutoStartState.get(sessionKey)) {
      console.log('AutoStartTrigger - Auto-start already initiated for this session, skipping');
      setHasAutoStarted(true);
      return;
    }

    // First component instance for this session - initiate auto-start
    console.log('AutoStartTrigger - Initiating auto-start for session:', sessionContext);
    console.log('AutoStartTrigger - Using thread:', threadId);
    globalAutoStartState.set(sessionKey, true);
    setHasAutoStarted(true);
    
    // Small delay to ensure thread is fully initialized
    setTimeout(() => {
      // Send empty message to trigger the teaching graph
      send([{
        type: "human",
        content: "" // Empty message just to trigger the graph
      }], {}).then(() => {
        console.log('AutoStartTrigger - Auto-start message sent successfully to thread:', threadId);
      }).catch(err => {
        console.error('AutoStartTrigger - Auto-start failed:', err);
        // Reset global state so user can manually start
        globalAutoStartState.delete(sessionKey);
        setHasAutoStarted(false);
      });
    }, 100);
  }, [sessionContext, hasAutoStarted, send, threadId, thread?.messages?.length]);

  // This component doesn't render anything - it's just for side effects
  return null;
}