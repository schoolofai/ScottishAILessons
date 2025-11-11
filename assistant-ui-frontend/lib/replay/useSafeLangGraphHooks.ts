/**
 * Safe wrappers for LangGraph hooks that don't throw errors in replay mode
 *
 * These hooks use try-catch with React error boundaries to gracefully handle
 * cases where the LangGraph runtime is not available (like in replay mode).
 */

import { useState, useEffect } from 'react';
import { useThread } from "@assistant-ui/react";

/**
 * Safe version of useLangGraphInterruptState that returns null in non-LangGraph runtimes
 */
export function useSafeLangGraphInterruptState() {
  const [interrupt, setInterrupt] = useState<any>(null);

  // Access thread extras directly without using the LangGraph-specific selector
  const threadExtras = useThread((t) => t.extras);

  useEffect(() => {
    // DEBUG: Log thread extras to understand what we're getting
    console.log('🔍 [INTERRUPT HOOK] Thread extras:', threadExtras);

    // Check if we have interrupt property in extras (indicates LangGraph or our replay runtime)
    if (threadExtras && typeof threadExtras === 'object' && 'interrupt' in threadExtras) {
      console.log('✅ [INTERRUPT HOOK] Found interrupt in extras:', (threadExtras as any).interrupt);
      setInterrupt((threadExtras as any).interrupt);
    } else {
      console.log('❌ [INTERRUPT HOOK] No interrupt found in extras');
      setInterrupt(null);
    }
  }, [threadExtras]);

  return interrupt;
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
