/**
 * Safe wrappers for LangGraph hooks that don't throw errors in replay mode
 *
 * These hooks use try-catch with React error boundaries to gracefully handle
 * cases where the LangGraph runtime is not available (like in replay mode).
 */

import { useState, useEffect, useRef } from 'react';
import { useThread } from "@assistant-ui/react";
import { logger } from '@/lib/logger';

/**
 * Safe version of useLangGraphInterruptState that returns null in non-LangGraph runtimes
 *
 * CRITICAL FIX: This hook now persists the last valid interrupt to prevent the
 * "disappearing content" bug. When threadExtras changes and loses the interrupt
 * property (e.g., after streaming completes or on scroll), we no longer clear
 * the interrupt state - instead we return the cached last valid interrupt.
 */
export function useSafeLangGraphInterruptState() {
  const [interrupt, setInterrupt] = useState<any>(null);

  // CRITICAL: Track last valid interrupt to prevent disappearing bug
  // When threadExtras changes but loses the interrupt property, we preserve
  // the last known good interrupt rather than clearing to null
  const lastValidInterruptRef = useRef<any>(null);

  // Access thread extras directly without using the LangGraph-specific selector
  const threadExtras = useThread((t) => t.extras);

  useEffect(() => {
    // Check if we have interrupt property in extras (indicates LangGraph or our replay runtime)
    if (threadExtras && typeof threadExtras === 'object' && 'interrupt' in threadExtras) {
      const newInterrupt = (threadExtras as any).interrupt;

      // DEBUG: Log interrupt state changes
      logger.debug('🔄 InterruptHook - threadExtras has interrupt', {
        hasInterrupt: newInterrupt !== null,
        interruptType: newInterrupt?.constructor?.name
      });

      setInterrupt(newInterrupt);

      // Cache non-null interrupts for later recovery
      if (newInterrupt !== null && newInterrupt !== undefined) {
        lastValidInterruptRef.current = newInterrupt;
        logger.debug('💾 InterruptHook - Cached valid interrupt');
      }
    } else {
      // DEBUG: Log when threadExtras doesn't have interrupt (but we preserve cached)
      logger.debug('⚠️ InterruptHook - threadExtras missing interrupt property', {
        hasLastValid: lastValidInterruptRef.current !== null,
        willUseCached: lastValidInterruptRef.current !== null
      });
      // CRITICAL FIX: Do NOT set interrupt to null here!
      // This was causing the disappearing content bug.
      // Instead, we let the return statement below use the cached value.
    }
  }, [threadExtras]);

  // Return current interrupt OR last valid interrupt (prevents disappearing bug)
  const result = interrupt ?? lastValidInterruptRef.current;

  // DEBUG: Log when we're using cached interrupt
  if (lastValidInterruptRef.current && !interrupt) {
    logger.debug('🛡️ InterruptHook - Using cached interrupt (prevented disappearing bug)');
  }

  return result;
}

/**
 * Safe version of useLangGraphSendCommand that returns a no-op in non-LangGraph runtimes
 */
export function useSafeLangGraphSendCommand() {
  // Access thread extras directly
  const threadExtras = useThread((t) => t.extras);

  // If we have a send function in extras, return a wrapper for it
  if (threadExtras && typeof threadExtras === 'object' && 'send' in threadExtras) {
    const send = (threadExtras as any).send;
    return (command: any) => {
      if (typeof send === 'function') {
        return send([], { command });
      }
    };
  }

  // Return no-op function
  return () => {
    console.log('⚠️ Attempted to send command in non-LangGraph runtime (ignored)');
  };
}
