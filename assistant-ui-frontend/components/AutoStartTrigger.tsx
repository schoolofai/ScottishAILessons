"use client";

import { useEffect, useState } from "react";
import { useThreadRuntime, useThread } from "@assistant-ui/react";
import { SessionContext } from "./MyAssistant";

interface AutoStartTriggerProps {
  sessionContext?: SessionContext;
  existingThreadId?: string;
  isThreadIdDetermined?: boolean; // NEW: Flag indicating threadId lookup is complete
}

// Global coordination for auto-start across component instances
const globalAutoStartState = new Map<string, boolean>();

export function AutoStartTrigger({
  sessionContext,
  existingThreadId,
  isThreadIdDetermined = true // Default to true for backwards compatibility
}: AutoStartTriggerProps) {
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const threadRuntime = useThreadRuntime();
  const thread = useThread();

  useEffect(() => {
    // Wait for all dependencies to be available
    if (!sessionContext || !threadRuntime || !thread) {
      return;
    }

    // CRITICAL: Wait until we KNOW whether there's an existing thread
    // This prevents starting a new thread before the session API has returned
    if (!isThreadIdDetermined) {
      console.log('⏳ AutoStartTrigger - Waiting for threadId determination...');
      return;
    }

    const sessionKey = sessionContext.session_id;
    const hasExistingMessages = thread.messages && thread.messages.length > 0;
    const isResumingExistingThread = !!existingThreadId;

    console.log('🔍 AutoStartTrigger - State check:', {
      sessionKey,
      isThreadIdDetermined,
      existingThreadId,
      isResumingExistingThread,
      hasExistingMessages,
      messagesCount: thread.messages?.length || 0
    });

    // If we're resuming an existing thread, DO NOT send any message
    // The thread already has messages on the backend - onSwitchToThread will load them
    if (isResumingExistingThread) {
      // Check if auto-start already completed for this session
      if (globalAutoStartState.get(sessionKey)) {
        setHasAutoStarted(true);
        return;
      }

      // Mark as processed to prevent multiple triggers
      globalAutoStartState.set(sessionKey, true);
      setHasAutoStarted(true);

      // CRITICAL FIX: When resuming an existing thread, NEVER send a new message
      // The thread already has state on the backend (messages, interrupts, lesson progress)
      // MyAssistant's onSwitchToThread will fetch and load this state automatically
      //
      // Previous bug: We checked hasExistingMessages, but thread.messages is empty at this
      // point because onSwitchToThread hasn't fetched them yet. This caused us to
      // incorrectly send a new message, restarting the lesson from the beginning.
      console.log('✅ AutoStartTrigger - Resuming existing thread, NOT sending message (will load via onSwitchToThread)');
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
  }, [sessionContext, hasAutoStarted, threadRuntime, thread, thread?.messages?.length, existingThreadId, isThreadIdDetermined]);

  // This component doesn't render anything - it's just for side effects
  return null;
}