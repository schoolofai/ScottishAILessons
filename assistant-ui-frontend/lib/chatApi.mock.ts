/**
 * Mock Chat API for Testing
 *
 * This is a test version of chatApi.ts that uses a mock LangGraph client
 * instead of the real one. It has the same interface as the real chatApi.
 *
 * Usage: Import this in test pages instead of the real chatApi
 */

import { ThreadState } from "@langchain/langgraph-sdk";
import {
  LangChainMessage,
  LangGraphCommand,
} from "@assistant-ui/react-langgraph";
import { SessionContext } from "@/components/MyAssistant";
import { createMockLangGraphClient } from "@/__mocks__/mock-langgraph-client-interactive";

// Create a single mock client instance to share across all calls
const mockClient = createMockLangGraphClient();

export const createThread = async () => {
  console.log('🧵 [MOCK API] createThread called');
  return mockClient.threads.create();
};

export const getThreadState = async (
  threadId: string
): Promise<ThreadState<{ messages: LangChainMessage[] }>> => {
  console.log('📊 [MOCK API] getThreadState called for:', threadId);
  const state = await mockClient.threads.getState(threadId);
  return state;
};

export const sendMessage = async (params: {
  threadId: string;
  messages?: LangChainMessage[];
  command?: LangGraphCommand | undefined;
  sessionContext?: SessionContext;
}) => {
  console.log('💬 [MOCK API] sendMessage called:', {
    threadId: params.threadId,
    hasMessages: !!params.messages?.length,
    hasCommand: !!params.command,
    hasSessionContext: !!params.sessionContext
  });

  // Use the mock client's stream method
  const rawStream = mockClient.runs.stream(
    params.threadId,
    "mock-assistant-id",
    {
      input: {
        messages: params.messages,
        session_context: params.sessionContext
      },
      command: params.command,
      streamMode: ["messages", "updates"],
      streamSubgraphs: true,
    }
  );

  // Apply the same filtering logic as the real chatApi
  async function* filtered() {
    const jsonRunIds = new Set<string>();

    for await (const event of rawStream) {
      let shouldFilter = false;

      // Detect metadata events with json tag
      if (event.event === "messages/metadata" && event.data) {
        for (const [runId, runData] of Object.entries(event.data)) {
          const metadata = (runData as any)?.metadata;
          if (metadata?.tags?.includes("json")) {
            jsonRunIds.add(runId);
          }
        }
      }

      // Filter partial message events by runId
      if (event.event === "messages/partial" && event.data && Array.isArray(event.data)) {
        const message = event.data[0];
        const messageRunId = message?.id;

        if (messageRunId && jsonRunIds.has(messageRunId)) {
          shouldFilter = true;
        }
      }

      if (!shouldFilter) {
        yield event;
      }
    }
  }

  return filtered();
};
