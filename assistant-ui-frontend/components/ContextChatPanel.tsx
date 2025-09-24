"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import { Client } from "@langchain/langgraph-sdk";
import { Thread } from "./assistant-ui/thread";
import { SessionContext } from "./MyAssistant";

interface ContextChatPanelProps {
  sessionId: string;
  getMainGraphState: () => Promise<any>;
  sessionContext?: SessionContext;
  existingContextThreadId?: string; // Existing context chat thread ID from session
  onThreadCreated?: (threadId: string) => void; // Callback when new context thread is created
  onCollapseChange?: (isCollapsed: boolean) => void; // Callback when collapse state changes
}

export function ContextChatPanel({
  sessionId,
  getMainGraphState,
  sessionContext,
  existingContextThreadId,
  onThreadCreated,
  onCollapseChange
}: ContextChatPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(existingContextThreadId);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | undefined>(existingContextThreadId);

  // Context chat client - Port 2700 from backend integration tests
  const contextChatClient = useRef<Client>();

  // Initialize context chat client
  useEffect(() => {
    contextChatClient.current = new Client({
      apiUrl: "http://localhost:2700" // From backend integration tests
    });
  }, []);

  // Update threadId state when existingContextThreadId changes
  useEffect(() => {
    if (existingContextThreadId && existingContextThreadId !== threadId) {
      setThreadId(existingContextThreadId);
      threadIdRef.current = existingContextThreadId;
      console.log('ContextChatPanel - Loaded existing context chat thread:', existingContextThreadId);
    }
  }, [existingContextThreadId, threadId]);

  // Create context chat thread
  const createContextChatThread = useCallback(async () => {
    if (!contextChatClient.current) return null;

    try {
      const thread = await contextChatClient.current.threads.create();
      const newThreadId = thread.thread_id;
      setThreadId(newThreadId);
      threadIdRef.current = newThreadId;

      // Notify parent component to persist thread ID to session
      if (onThreadCreated) {
        onThreadCreated(newThreadId);
      }

      console.log('ContextChatPanel - Created new context chat thread:', newThreadId);

      return newThreadId;
    } catch (err) {
      console.error('ContextChatPanel - Failed to create thread:', err);
      setError("Failed to create context chat. Please try again later, we're looking into it.");
      return null;
    }
  }, []);

  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages) => {
      try {
        // Clear any previous errors
        setError(null);

        if (!threadIdRef.current) {
          const newThreadId = await createContextChatThread();
          if (!newThreadId) {
            throw new Error("Failed to create context chat thread");
          }
        }

        // Extract current main graph state
        const mainState = await getMainGraphState();
        console.log('ContextChatPanel - Extracted main graph state:', mainState);

        // Prepare input matching backend integration test format
        // CRITICAL: Send DIRECT state structure, not nested under main_graph_state
        const input = {
          messages,
          session_context: {
            // Direct main graph state fields (from integration tests)
            session_id: sessionContext?.session_id || sessionId,
            student_id: sessionContext?.student_id || "",
            course_id: mainState?.course_id || sessionContext?.lesson_snapshot?.courseId || "",
            mode: "teaching",
            lesson_snapshot: sessionContext?.lesson_snapshot || {},
            messages: mainState?.messages?.slice(-10) || [], // Last 10 messages for context
            current_stage: mainState?.current_stage || "unknown",
            student_progress: mainState?.student_progress || {},
            card_presentation_complete: false,
            interrupt_count: 0,
            // Include other direct fields from main graph state
            ...mainState
          }
        };

        console.log('ContextChatPanel - Sending to context-chat-agent:', {
          threadId: threadIdRef.current,
          input: JSON.stringify(input, null, 2)
        });

        // Use "context-chat-agent", NOT "agent" - from backend integration tests
        return contextChatClient.current!.runs.stream(
          threadIdRef.current!,
          "context-chat-agent", // From langgraph.json
          {
            input,
            streamMode: ["messages", "updates"], // Match main chat exact configuration
            streamSubgraphs: true // Match main chat for subgraph streaming
          }
        );
      } catch (err) {
        console.error('ContextChatPanel - Stream error:', err);
        setError("Context chat is temporarily unavailable. Please try again later, we're looking into it.");
        throw err;
      }
    },
    onSwitchToNewThread: async () => {
      const newThreadId = await createContextChatThread();
      return newThreadId || undefined;
    },
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Notify parent component about collapse state changes after render cycle
  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  // Show error state
  if (error) {
    return (
      <div
        className={`context-chat-panel h-full flex flex-col ${
          isCollapsed
            ? 'bg-red-100 border-l border-red-300'
            : 'bg-red-50 border-l border-red-200'
        }`}
        style={{
          width: isCollapsed ? '60px' : 'auto',
          transition: 'width 0.3s ease-in-out'
        }}
        data-testid="context-chat-panel"
      >
        <div
          className={`${
            isCollapsed
              ? 'p-2 bg-red-100 flex items-center justify-center'
              : 'p-4 bg-red-100 border-b border-red-200 flex items-center justify-between'
          }`}
        >
          {!isCollapsed && (
            <div>
              <h3 className="font-semibold text-red-800">Learning Assistant</h3>
              <p className="text-sm text-red-600">Service unavailable</p>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="text-red-600 hover:text-red-800 font-bold text-lg"
            aria-label={isCollapsed ? 'Expand context chat' : 'Collapse context chat'}
            aria-expanded={!isCollapsed}
            data-testid="context-chat-toggle"
          >
            {isCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-red-600 mb-2" data-testid="error-message">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  // Try to reinitialize
                  createContextChatThread();
                }}
                className="text-sm text-red-700 underline hover:text-red-900"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`context-chat-panel h-full flex flex-col ${
        isCollapsed
          ? 'bg-gray-100 border-l border-gray-300'
          : 'bg-gray-50 border-l border-gray-200'
      }`}
      style={{
        width: isCollapsed ? '60px' : 'auto',
        transition: 'width 0.3s ease-in-out'
      }}
      data-testid="context-chat-panel"
      role="complementary"
      aria-label="Context-aware learning assistant"
    >
      {/* Header with collapse/expand functionality */}
      <div
        className={`${
          isCollapsed
            ? 'p-2 bg-gray-100 flex items-center justify-center'
            : 'p-4 bg-white border-b border-gray-200 flex items-center justify-between'
        }`}
        data-testid="context-chat-header"
      >
        {!isCollapsed && (
          <div>
            <h3 className="font-semibold text-gray-800">Learning Assistant</h3>
            <p className="text-sm text-gray-600">Ask questions about your lesson</p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className={`text-gray-600 hover:text-gray-800 font-bold text-lg ${
            isCollapsed ? 'rotate-0' : ''
          }`}
          style={{
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease-in-out'
          }}
          aria-label={isCollapsed ? 'Expand context chat' : 'Collapse context chat'}
          aria-expanded={!isCollapsed}
          data-testid="context-chat-toggle"
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Chat content */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0" data-testid="context-chat-content">
          <AssistantRuntimeProvider runtime={runtime}>
            <Thread />
          </AssistantRuntimeProvider>
        </div>
      )}
    </div>
  );
}