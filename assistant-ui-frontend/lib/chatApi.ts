import { Client, ThreadState } from "@langchain/langgraph-sdk";
import {
  LangChainMessage,
  LangGraphCommand,
} from "@assistant-ui/react-langgraph";
import { SessionContext } from "@/components/MyAssistant";

const createClient = () => {
  const apiUrl =
    process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"] ||
    new URL("/api", window.location.href).href;
  const apiKey = process.env["NEXT_PUBLIC_LANGSMITH_API_KEY"];

  return new Client({
    apiUrl,
    apiKey: apiKey,
  });
};

export const createThread = async () => {
  const client = createClient();
  return client.threads.create();
};

/**
 * Get thread state with subgraph support for lesson resume functionality
 *
 * CRITICAL: The `subgraphs: true` option is essential for fetching nested teaching
 * subgraph state where messages, tool calls, and interrupts actually reside.
 * Without this, resuming a lesson mid-CFU would return empty state.
 *
 * @throws Error with "not found" message when thread has expired (7-day limit)
 */
export const getThreadState = async (
  threadId: string
): Promise<ThreadState<{ messages: LangChainMessage[] }>> => {
  const client = createClient();

  // CRITICAL FIX: Include subgraph state for lesson resume
  // Teaching sessions run in a subgraph, so we need subgraphs=true to get
  // the messages, tool calls, and interrupts from the teaching subgraph
  const state = await client.threads.getState(threadId, undefined, { subgraphs: true });

  // Extract teaching subgraph state for frontend compatibility
  // The teaching subgraph contains the actual lesson messages and interrupt state
  const teachingTask = (state.tasks as any[])?.find((t: any) => t.name === 'teaching');
  const subgraphState = teachingTask?.state;

  if (subgraphState && subgraphState.values?.messages?.length > 0) {
    // Merge subgraph messages and interrupts into main state structure
    // This allows the frontend to receive the messages as if they were at root level
    return {
      ...state,
      values: {
        ...state.values,
        messages: subgraphState.values.messages,
      },
      // Use subgraph interrupts (where the interrupt actually resides when paused mid-CFU)
      tasks: state.tasks?.map((t: any) => ({
        ...t,
        interrupts: t.state?.interrupts || t.interrupts || []
      }))
    } as ThreadState<{ messages: LangChainMessage[] }>;
  }

  return state;
};

export const sendMessage = async (params: {
  threadId: string;
  messages?: LangChainMessage[];
  command?: LangGraphCommand | undefined;
  sessionContext?: SessionContext;
  assistantId?: string; // Optional: defaults to env var, use "infinite_practice" for practice mode
}) => {
  const client = createClient();

  // Prepare input with session context if provided
  const input: any = {};
  if (params.messages?.length) {
    input.messages = params.messages;
  }
  if (params.sessionContext) {
    input.session_context = params.sessionContext;
  }

  // Update session last message timestamp if we have session context
  if (params.sessionContext?.session_id) {
    try {
      // Note: This would ideally be done on the server side or after successful message send
      // For now, we'll update optimistically
      updateSessionLastMessage(params.sessionContext.session_id);
    } catch (error) {
      console.warn('chatApi.sendMessage - Failed to update session timestamp:', error);
    }
  }

  // Use provided assistantId or fall back to environment variable
  const assistantId = params.assistantId || process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!;

  const rawStream = client.runs.stream(
    params.threadId,
    assistantId,
    {
      input: Object.keys(input).length > 0 ? input : null,
      command: params.command,
      // streamMode: ["updates"],
      // streamMode: ["messages"],
      streamMode: ["messages", "updates"],
      streamSubgraphs: true ,
    }
  );

  // Filter out structured JSON output from display while keeping regular content
  async function* filtered() {
    // Track runIds that are marked with "json" tag for filtering
    const jsonRunIds = new Set<string>();
    
    for await (const event of rawStream as any) {
      let shouldFilter = false;
      
      // 1. Detect metadata events with json tag and track runIds
      if (event.event === "messages/metadata" && event.data) {
        for (const [runId, runData] of Object.entries(event.data)) {
          const metadata = (runData as any)?.metadata;
          if (metadata?.tags?.includes("json")) {
            jsonRunIds.add(runId);
            // Don't filter metadata events - they don't appear in UI
          }
        }
      }
      
      // 2. Filter partial message events by runId
      if (event.event === "messages/partial" && event.data && Array.isArray(event.data)) {
        const message = event.data[0];
        const messageRunId = message?.id;
        
        if (messageRunId && jsonRunIds.has(messageRunId)) {
          shouldFilter = true;
        }
      }

      // Skip filtered events, pass through everything else
      if (!shouldFilter) {
        yield event;
      }
    }
  }

  return filtered();
};

// Helper function to update session last message timestamp
const updateSessionLastMessage = async (sessionId: string) => {
  try {
    // This is a client-side update - in a real app you might want to do this server-side
    const response = await fetch('/api/sessions/update-message-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    
    if (!response.ok) {
      console.warn('Failed to update session message timestamp on server');
    }
  } catch (error) {
    // For now, we'll just log the error since this is an enhancement
    console.warn('Could not update session timestamp via API:', error);
  }
};
