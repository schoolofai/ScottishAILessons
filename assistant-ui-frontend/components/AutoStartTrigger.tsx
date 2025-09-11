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
      return;
    }

    const sessionKey = sessionContext.session_id;
    const hasExistingMessages = thread.messages && thread.messages.length > 0;
    const isResumingExistingThread = !!existingThreadId;

    // If we're resuming an existing thread, skip auto-start completely
    if (isResumingExistingThread) {
      setHasAutoStarted(true);
      globalAutoStartState.set(sessionKey, true);
      return;
    }

    // If thread already has messages, skip auto-start
    if (hasExistingMessages) {
      setHasAutoStarted(true);
      globalAutoStartState.set(sessionKey, true);
      return;
    }

    // Check if auto-start already initiated for this session
    if (globalAutoStartState.get(sessionKey)) {
      setHasAutoStarted(true);
      return;
    }

    // First component instance for this session - initiate auto-start
    globalAutoStartState.set(sessionKey, true);
    setHasAutoStarted(true);
    
    // Small delay to ensure thread is fully initialized
    setTimeout(() => {
      // Send empty message to trigger the teaching graph
      threadRuntime.append({
        role: "user",
        content: [{ type: "text", text: "" }] // Empty message just to trigger the graph
      });
    }, 100);
  }, [sessionContext, hasAutoStarted, threadRuntime, thread, thread?.messages?.length]);

  // This component doesn't render anything - it's just for side effects
  return null;
}