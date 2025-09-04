"use client";

import { useEffect, useState } from "react";
import { useThreadRuntime, useThread } from "@assistant-ui/react";
import { SessionContext } from "./MyAssistant";

interface AutoStartTriggerProps {
  sessionContext?: SessionContext;
  existingThreadId?: string;
}

// Global coordination for auto-start across component instances
const globalAutoStartState = new Map<string, boolean>();

export function AutoStartTrigger({ sessionContext, existingThreadId }: AutoStartTriggerProps) {
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const threadRuntime = useThreadRuntime();
  const thread = useThread();

  useEffect(() => {
    // Wait for all dependencies to be available
    if (!sessionContext || !threadRuntime || !thread) {
      console.log('AutoStartTrigger - Waiting for dependencies:', {
        hasSessionContext: !!sessionContext,
        hasThreadRuntime: !!threadRuntime,
        hasThread: !!thread
      });
      return;
    }

    const sessionKey = sessionContext.session_id;
    const hasExistingMessages = thread.messages && thread.messages.length > 0;
    const isResumingExistingThread = !!existingThreadId;
    
    console.log('AutoStartTrigger - Checking auto-start conditions:', {
      sessionId: sessionKey,
      hasAutoStarted,
      threadId: thread.threadId,
      messageCount: thread.messages?.length || 0,
      globalStarted: globalAutoStartState.get(sessionKey),
      existingThreadId,
      isResumingExistingThread
    });

    // If we're resuming an existing thread, skip auto-start completely
    if (isResumingExistingThread) {
      console.log('AutoStartTrigger - Resuming existing thread, skipping auto-start');
      setHasAutoStarted(true);
      globalAutoStartState.set(sessionKey, true);
      return;
    }

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
    console.log('AutoStartTrigger - Using thread:', thread.threadId);
    globalAutoStartState.set(sessionKey, true);
    setHasAutoStarted(true);
    
    // Small delay to ensure thread is fully initialized
    setTimeout(() => {
      // Send empty message to trigger the teaching graph
      threadRuntime.append({
        role: "user",
        content: [{ type: "text", text: "" }] // Empty message just to trigger the graph
      });
      console.log('AutoStartTrigger - Auto-start message sent successfully to thread:', thread.threadId);
    }, 100);
  }, [sessionContext, hasAutoStarted, threadRuntime, thread, thread?.messages?.length]);

  // This component doesn't render anything - it's just for side effects
  return null;
}