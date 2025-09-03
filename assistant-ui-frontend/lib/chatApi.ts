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
  return client.threads.getState(threadId);
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
  
  return client.runs.stream(
    params.threadId,
    process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!,
    {
      input: Object.keys(input).length > 0 ? input : null,
      command: params.command,
      streamMode: ["messages", "updates"],
    }
  );
};
