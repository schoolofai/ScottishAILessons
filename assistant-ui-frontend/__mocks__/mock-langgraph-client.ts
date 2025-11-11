/**
 * Mock LangGraph Client
 *
 * This provides a fake Client implementation that returns streaming events
 * instead of calling a real backend.
 *
 * Usage:
 *   import { createMockLangGraphClient } from '@/__mocks__/mock-langgraph-client';
 *   const client = createMockLangGraphClient();
 */

import { generateSimpleLessonFlow } from './langgraph-streaming-events';

export interface MockLangGraphClient {
  threads: {
    create: () => Promise<{ thread_id: string }>;
    getState: (threadId: string) => Promise<any>;
    get: (threadId: string) => Promise<any>;
  };
  runs: {
    stream: (
      threadId: string,
      assistantId: string,
      options: any
    ) => AsyncGenerator<any>;
  };
}

/**
 * Create a mock LangGraph client that returns fake streaming events
 */
export function createMockLangGraphClient(): MockLangGraphClient {
  const threadStore = new Map<string, any>();
  let currentInterrupt: any = null;

  return {
    threads: {
      create: async () => {
        const threadId = `mock-thread-${Date.now()}`;
        console.log('🧵 [MOCK CLIENT] Created thread:', threadId);

        threadStore.set(threadId, {
          thread_id: threadId,
          created_at: new Date().toISOString(),
          metadata: {},
          values: {
            messages: []
          }
        });

        return { thread_id: threadId };
      },

      getState: async (threadId: string) => {
        console.log('📊 [MOCK CLIENT] getState called for:', threadId);

        const thread = threadStore.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        // Return state with interrupt if one is active
        const state: any = {
          values: thread.values || { messages: [] },
          next: [],
          config: {
            configurable: {
              thread_id: threadId
            }
          },
          created_at: thread.created_at,
          parent_config: null
        };

        // Include interrupt information if one is active
        if (currentInterrupt) {
          state.tasks = [{
            id: currentInterrupt.id,
            name: currentInterrupt.name,
            interrupts: [currentInterrupt]
          }];
        }

        return state;
      },

      get: async (threadId: string) => {
        console.log('📋 [MOCK CLIENT] get thread:', threadId);
        const thread = threadStore.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }
        return thread;
      }
    },

    runs: {
      stream: async function* (
        threadId: string,
        assistantId: string,
        options: any
      ) {
        console.log('🌊 [MOCK CLIENT] Starting stream:', {
          threadId,
          assistantId,
          options
        });

        const thread = threadStore.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        // Check if this is a resume command (student answered)
        const command = options.command;
        if (command?.resume) {
          console.log('▶️ [MOCK CLIENT] Resuming from interrupt with:', command.resume);

          // Clear the interrupt
          currentInterrupt = null;

          // Parse the resume payload
          const payload = JSON.parse(command.resume);
          const action = payload.action;

          console.log('✅ [MOCK CLIENT] Resume action:', action);

          // For now, just acknowledge the resume
          // In a full implementation, we'd continue the flow based on the action
          yield {
            event: "messages/partial",
            data: [{
              type: "ai",
              content: `Received your ${action}...`,
              id: `msg-resume-${Date.now()}`
            }]
          };

          return;
        }

        // Otherwise, start the lesson flow
        const eventGenerator = generateSimpleLessonFlow();

        for await (const event of eventGenerator) {
          // Before yielding a tool_call event, set up an interrupt
          if (event.event === "messages/partial" && event.data?.[0]?.tool_calls) {
            const toolCall = event.data[0].tool_calls[0];

            // Create interrupt for this tool call
            if (toolCall.name === "lesson_card_presentation") {
              currentInterrupt = {
                id: `interrupt-${toolCall.id}`,
                name: "get_answer_node",
                value: {}, // Empty payload as per backend pattern
                when: "during"
              };

              console.log('⏸️ [MOCK CLIENT] Setting up interrupt for:', toolCall.name);
            }
          }

          // Yield the event
          yield event;

          // Store messages in thread state
          if (event.event === "messages/partial") {
            if (!thread.values.messages) {
              thread.values.messages = [];
            }
            thread.values.messages.push(...event.data);
          }
        }

        console.log('🏁 [MOCK CLIENT] Stream complete');
      }
    }
  };
}
