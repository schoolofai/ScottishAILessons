/**
 * Interactive Mock LangGraph Client with Proper Interrupt Handling
 *
 * This version properly pauses at interrupts and waits for resume commands,
 * matching the real LangGraph interrupt behavior.
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

// Global state to track interrupts across calls
const threadInterruptState = new Map<string, {
  currentInterrupt: any | null;
  resumeResolve: ((value: any) => void) | null;
  messages: any[];
}>();

/**
 * Create an interactive mock LangGraph client with proper interrupt handling
 */
export function createMockLangGraphClient(): MockLangGraphClient {
  const threadStore = new Map<string, any>();

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

        // Initialize interrupt state for this thread
        threadInterruptState.set(threadId, {
          currentInterrupt: null,
          resumeResolve: null,
          messages: []
        });

        return { thread_id: threadId };
      },

      getState: async (threadId: string) => {
        console.log('📊 [MOCK CLIENT] getState called for:', threadId);

        const thread = threadStore.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const interruptState = threadInterruptState.get(threadId);

        // Build state with interrupt if one is active
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
        if (interruptState?.currentInterrupt) {
          console.log('⏸️  [MOCK CLIENT] getState returning active interrupt:', interruptState.currentInterrupt.id);
          state.tasks = [{
            id: interruptState.currentInterrupt.id,
            name: interruptState.currentInterrupt.name,
            interrupts: [interruptState.currentInterrupt]
          }];
        } else {
          console.log('▶️ [MOCK CLIENT] getState - no active interrupt');
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
          hasCommand: !!options.command
        });

        const thread = threadStore.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const interruptState = threadInterruptState.get(threadId)!;

        // Check if this is a resume command (student answered)
        const command = options.command;
        if (command?.resume) {
          console.log('▶️ [MOCK CLIENT] Resuming from interrupt with:', command.resume);

          // Parse the resume payload
          const payload = JSON.parse(command.resume);
          const action = payload.action;

          console.log('✅ [MOCK CLIENT] Resume action:', action, payload);

          // Clear the interrupt
          interruptState.currentInterrupt = null;

          // Resolve the waiting promise if it exists
          if (interruptState.resumeResolve) {
            interruptState.resumeResolve(payload);
            interruptState.resumeResolve = null;
          }

          // Send feedback based on the student's response
          if (action === "submit_answer") {
            const studentResponse = payload.student_response;
            const isCorrect = studentResponse === "1/5" || studentResponse === "0.2"; // Simple check

            yield {
              event: "messages/partial",
              data: [{
                type: "ai",
                content: isCorrect
                  ? "🎉 Excellent work! You've got it right!"
                  : "Not quite. Let me help you understand this better.",
                id: `msg-feedback-${Date.now()}`
              }]
            };

            // Tool call for detailed feedback
            yield {
              event: "messages/partial",
              data: [{
                type: "ai",
                content: "",
                tool_calls: [{
                  id: `feedback_${Date.now()}`,
                  name: "feedback_presentation",
                  args: {
                    is_correct: isCorrect,
                    feedback_message: isCorrect
                      ? "Your answer is correct!"
                      : "Let's review this concept.",
                    explanation: isCorrect
                      ? "Great understanding of equivalent fractions!"
                      : "Remember to simplify by dividing both numbers by their GCD.",
                    student_response: studentResponse,
                    card_index: 0,
                    hints_used: 0,
                    attempt_number: 1,
                    interaction_id: `interaction-feedback-${Date.now()}`
                  }
                }],
                id: `msg-feedback-toolcall-${Date.now()}`
              }]
            };
          }

          return; // Stream ends after handling resume
        }

        // Otherwise, start the lesson flow
        console.log('📚 [MOCK CLIENT] Starting lesson flow...');
        const eventGenerator = generateSimpleLessonFlow();

        for await (const event of eventGenerator) {
          // Before yielding a tool_call event, set up an interrupt and PAUSE
          if (event.event === "messages/partial" && event.data?.[0]?.tool_calls) {
            const toolCall = event.data[0].tool_calls[0];

            // Only interrupt for lesson cards (questions requiring student response)
            if (toolCall.name === "lesson_card_presentation") {
              // Create interrupt for this tool call
              const interrupt = {
                id: `interrupt-${toolCall.id}`,
                name: "get_answer_node",
                value: {}, // Empty payload as per backend pattern
                when: "during"
              };

              interruptState.currentInterrupt = interrupt;

              console.log('⏸️  [MOCK CLIENT] Setting up interrupt and PAUSING:', toolCall.name);
              console.log('   Interrupt ID:', interrupt.id);
              console.log('   Waiting for resume command...');

              // Yield the tool call event
              yield event;

              // Store message in thread
              if (!thread.values.messages) {
                thread.values.messages = [];
              }
              thread.values.messages.push(...event.data);

              // Yield an "updates" event to signal the interrupt state change
              // This tells the frontend to poll getState() for interrupt information
              yield {
                event: "updates",
                data: {
                  [interrupt.id]: {
                    tasks: [{
                      id: interrupt.id,
                      name: interrupt.name,
                      interrupts: [interrupt]
                    }]
                  }
                }
              };

              console.log('📡 [MOCK CLIENT] Yielded updates event with interrupt state');

              // CRITICAL: Stop yielding events here - wait for resume
              // In the real implementation, we'd wait for a resume command
              // For now, we just end the stream and wait for the next call with resume
              console.log('🛑 [MOCK CLIENT] Stream paused at interrupt - awaiting resume command');
              return; // Exit the stream - wait for resume
            }
          }

          // Yield non-interrupt events normally
          yield event;

          // Store messages in thread state
          if (event.event === "messages/partial") {
            if (!thread.values.messages) {
              thread.values.messages = [];
            }
            thread.values.messages.push(...event.data);
          }
        }

        console.log('🏁 [MOCK CLIENT] Stream complete (no interrupts remaining)');
      }
    }
  };
}
