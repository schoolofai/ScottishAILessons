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
  return new Client({
    apiUrl,
  });
};

export const createThread = async () => {
  const client = createClient();
  return client.threads.create();
};

export const getThreadState = async (
  threadId: string
): Promise<ThreadState<{ messages: LangChainMessage[] }>> => {
  const client = createClient();
  const state = await client.threads.getState(threadId);
  
  return state;
};

export const sendMessage = async (params: {
  threadId: string;
  messages?: LangChainMessage[];
  command?: LangGraphCommand | undefined;
  sessionContext?: SessionContext;
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
  
  const rawStream = client.runs.stream(
    params.threadId,
    process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!,
    {
      input: Object.keys(input).length > 0 ? input : null,
      command: params.command,
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
