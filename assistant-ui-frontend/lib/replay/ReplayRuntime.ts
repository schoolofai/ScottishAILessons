/**
 * ReplayRuntime - Custom AssistantRuntime for replaying stored conversation history
 *
 * This runtime feeds stored messages to Assistant UI without connecting to LangGraph,
 * allowing perfect replay of completed lesson sessions using existing UI components.
 *
 * Uses the proper useExternalStoreRuntime hook with a custom adapter to ensure
 * the runtime has the correct structure expected by AssistantRuntimeProvider.
 */

import { useEffect, useState } from 'react';
import { useExternalStoreRuntime } from '@assistant-ui/react';
import type { ExternalStoreAdapter } from '@assistant-ui/react';
import type { ConversationHistory } from '@/lib/appwrite/driver/SessionDriver';

/**
 * Convert stored message format to Assistant UI ThreadMessage format
 */
function convertStoredMessageToRuntimeMessage(storedMessage: any) {
  const message: any = {
    id: storedMessage.id,
    role: storedMessage.type === 'HumanMessage' ? 'user' : 'assistant',
    content: [{ type: 'text', text: storedMessage.content }],
    createdAt: new Date(),
  };

  // Add tool calls if present (these will trigger tool UI components)
  if (storedMessage.tool_calls && storedMessage.tool_calls.length > 0) {
    message.content.push(
      ...storedMessage.tool_calls.map((tc: any) => ({
        type: 'tool-call',
        toolCallId: tc.id,
        toolName: tc.name,
        args: tc.args,
      }))
    );
  }

  return message;
}

/**
 * Custom hook to create a replay runtime from stored conversation history
 *
 * Uses the official useExternalStoreRuntime hook with a custom adapter.
 * This ensures the runtime has the proper structure (threads, mainItem, etc.)
 * required by AssistantRuntimeProvider.
 */
export function useReplayRuntime(conversationHistory: ConversationHistory | null) {
  const [messages, setMessages] = useState<any[]>([]);

  // Convert stored messages to runtime format when history loads
  useEffect(() => {
    if (!conversationHistory) {
      setMessages([]);
      return;
    }

    console.log('🎬 ReplayRuntime - Converting stored messages to runtime format');
    console.log(`📊 ReplayRuntime - Total messages: ${conversationHistory.messages.length}`);

    const runtimeMessages = conversationHistory.messages.map(convertStoredMessageToRuntimeMessage);
    setMessages(runtimeMessages);

    console.log('✅ ReplayRuntime - Messages converted and ready for replay');
  }, [conversationHistory]);

  // Create adapter that useExternalStoreRuntime expects
  const adapter: ExternalStoreAdapter<any> = {
    isRunning: false, // Replay mode is never "running"
    messages: messages,
    convertMessage: (msg) => msg, // Messages already converted
    onNew: async () => {
      // No-op: replay mode doesn't accept new messages
      console.log('⚠️ ReplayRuntime - Attempted to add message in replay mode (ignored)');
    },
    adapters: {
      threadList: {
        threadId: conversationHistory?.threadId,
      }
    },
    // Add extras that look like LangGraph extras for our safe hooks
    // We can't use the actual LangGraph symbol (it's module-scoped), so we use
    // a structure that our safe hooks can detect
    extras: {
      interrupt: null, // No interrupts in replay mode
      send: async () => {
        console.log('⚠️ ReplayRuntime - Attempted to send message in replay mode (ignored)');
      }
    }
  };

  // Use the official hook - this returns proper AssistantRuntimeImpl
  // with all required properties (threads, mainItem, etc.)
  const runtime = useExternalStoreRuntime(adapter);

  console.log('🎬 ReplayRuntime - Runtime created with proper structure:', {
    hasThreads: !!runtime.threads,
    hasThread: !!runtime.thread,
    messageCount: messages.length
  });

  return runtime;
}

/**
 * Hook to create a replay runtime with all messages visible immediately
 * (Alternative to gradual streaming for faster review)
 *
 * This is identical to useReplayRuntime since the official runtime
 * shows all messages immediately by default.
 */
export function useInstantReplayRuntime(conversationHistory: ConversationHistory | null) {
  return useReplayRuntime(conversationHistory);
}
