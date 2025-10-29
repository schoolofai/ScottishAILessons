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

    // If we're resuming an existing thread, check if we need to switch mode to teaching
    if (isResumingExistingThread) {
      // Check if auto-start already completed for this session
      if (globalAutoStartState.get(sessionKey)) {
        setHasAutoStarted(true);
        return;
      }

      // Mark as processed to prevent multiple triggers
      globalAutoStartState.set(sessionKey, true);
      setHasAutoStarted(true);

      // CRITICAL: Only send message if thread has NO messages (brand new session)
      // If thread already has messages, it means it was started before and may have interrupts
      if (!hasExistingMessages) {
        console.log('🚀 AutoStartTrigger - New session with existing thread, sending initial message');
        // Small delay to ensure thread is fully loaded
        setTimeout(() => {
          // Send empty message with session context to trigger mode switch to teaching
          threadRuntime.append({
            role: "user",
            content: [{ type: "text", text: "" }] // Empty message to trigger teaching mode
          });
        }, 100);
      } else {
        console.log('✅ AutoStartTrigger - Thread has existing messages, NOT sending message to preserve interrupts');
        // The thread will automatically load its previous state via MyAssistant's onSwitchToThread
        // No need to trigger a new graph run
      }
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