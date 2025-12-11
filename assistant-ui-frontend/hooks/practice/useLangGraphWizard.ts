"use client";

/**
 * useLangGraphWizard - Core hook for wizard-based infinite practice
 *
 * Adapts chatApi.ts patterns for direct LangGraph SDK integration,
 * detecting tool calls to transition between wizard stages.
 *
 * Stages map to graph interrupts:
 * - concept_presentation → 'concept'
 * - practice_question → 'question'
 * - practice_feedback → 'feedback'
 * - session_complete → 'complete'
 *
 * IMPORTANT: This hook uses types from @/types/practice-wizard-contracts.ts
 * which define the EXACT data structures sent by the backend.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Client } from "@langchain/langgraph-sdk";

// Import contract types - these match the backend EXACTLY
import type {
  PracticeQuestion,
  ConceptBlock,
  PracticeFeedback,
  ProgressReport,
  PracticeSessionContext,
  // Resume payload contracts (frontend → backend)
  ResumePayload,
  ResumeSubmitPayload,
  ResumeContinuePayload,
  ResumeSetDifficultyPayload,
  DifficultyLevel,
} from "@/types/practice-wizard-contracts";

// Re-export contract types for consumers of this hook
export type {
  PracticeQuestion,
  ConceptBlock,
  PracticeFeedback,
  ProgressReport,
  PracticeSessionContext,
  // Resume payload types (frontend → backend)
  ResumePayload,
  ResumeSubmitPayload,
  ResumeContinuePayload,
  ResumeSetDifficultyPayload,
  DifficultyLevel,
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type WizardStage =
  | "loading"
  | "concept"
  | "question"
  | "feedback"
  | "complete"
  | "error";

export interface WizardState {
  stage: WizardStage;
  threadId: string | null;
  progress: ProgressReport | null;
  currentBlock: ConceptBlock | null;
  currentQuestion: PracticeQuestion | null;
  currentFeedback: PracticeFeedback | null;
  isStreaming: boolean;
  error: Error | null;
  // Gamification stats
  totalXP: number;
  currentStreak: number;
  questionsAnswered: number;
  questionsCorrect: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// LangGraph SDK Client
// ═══════════════════════════════════════════════════════════════════════════

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

const INFINITE_PRACTICE_ASSISTANT_ID = "infinite_practice";

// ═══════════════════════════════════════════════════════════════════════════
// Tool Call Parsing Utilities
// ═══════════════════════════════════════════════════════════════════════════

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

const extractToolCallFromEvent = (event: unknown): ToolCall | null => {
  const evt = event as { event?: string; data?: unknown };

  // Handle both messages/partial and messages/complete events
  if (evt.event !== "messages/partial" && evt.event !== "messages/complete") {
    return null;
  }

  if (!Array.isArray(evt.data) || evt.data.length === 0) {
    return null;
  }

  const message = evt.data[0] as {
    tool_calls?: { id: string; name: string; args: Record<string, unknown> }[];
    additional_kwargs?: {
      tool_calls?: { id: string; name: string; args: Record<string, unknown> }[];
    };
  };

  // Check for tool_calls directly on message or in additional_kwargs
  const toolCalls = message?.tool_calls || message?.additional_kwargs?.tool_calls;

  if (!toolCalls?.length) {
    return null;
  }

  const toolCall = toolCalls[0];

  return {
    id: toolCall.id,
    name: toolCall.name,
    args: toolCall.args || {},
  };
};

// Map tool names to wizard stages
const TOOL_TO_STAGE: Record<string, WizardStage> = {
  concept_presentation: "concept",
  practice_question: "question",
  practice_feedback: "feedback",
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Hook
// ═══════════════════════════════════════════════════════════════════════════

export function useLangGraphWizard() {
  const [state, setState] = useState<WizardState>({
    stage: "loading",
    threadId: null,
    progress: null,
    currentBlock: null,
    currentQuestion: null,
    currentFeedback: null,
    isStreaming: false,
    error: null,
    totalXP: 0,
    currentStreak: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
  });

  const clientRef = useRef<Client | null>(null);
  const threadIdRef = useRef<string | null>(null);

  // Initialize client on mount
  useEffect(() => {
    clientRef.current = createClient();
  }, []);

  /**
   * Process streaming events from LangGraph and detect tool calls
   * that signal wizard stage transitions.
   */
  const processStream = useCallback(
    async (stream: AsyncIterable<unknown>) => {
      const jsonRunIds = new Set<string>();

      for await (const event of stream) {
        const evt = event as { event?: string; data?: unknown };

        // Track JSON-tagged runs to filter out structured output
        if (evt.event === "messages/metadata" && evt.data) {
          for (const [runId, runData] of Object.entries(
            evt.data as Record<string, { metadata?: { tags?: string[] } }>
          )) {
            if (runData?.metadata?.tags?.includes("json")) {
              jsonRunIds.add(runId);
            }
          }
        }

        // Skip JSON-tagged partial events
        if (evt.event === "messages/partial") {
          const msg = (evt.data as unknown[])?.[0] as { id?: string };
          if (msg?.id && jsonRunIds.has(msg.id)) {
            continue;
          }
        }

        // Extract tool calls for stage transitions - process IMMEDIATELY
        // CRITICAL: With interrupt-based graphs, we must process tool calls
        // as soon as they're detected because the stream pauses (not closes)
        // when interrupt() is called, so code after the loop never runs.
        const toolCall = extractToolCallFromEvent(event);
        if (toolCall && TOOL_TO_STAGE[toolCall.name]) {
          processToolCall(toolCall);
          // Stream will pause at interrupt - don't wait for it to end
          return;
        }

        // Check for session complete in updates
        if (evt.event === "updates") {
          const updates = evt.data as Record<string, { session_complete?: boolean }>;
          for (const nodeData of Object.values(updates)) {
            if (nodeData?.session_complete) {
              setState((prev) => ({ ...prev, stage: "complete", isStreaming: false }));
              return;
            }
          }
        }
      }

      // Stream ended without a tool call (shouldn't happen normally)
      setState((prev) => ({ ...prev, isStreaming: false }));
    },
    []
  );

  /**
   * Process a tool call immediately to update wizard state.
   * Extracted to avoid waiting for stream to end (which never happens with interrupts).
   */
  const processToolCall = useCallback((toolCall: ToolCall) => {
    const newStage = TOOL_TO_STAGE[toolCall.name];
    const args = toolCall.args;

    setState((prev) => {
      const updates: Partial<WizardState> = {
        stage: newStage,
        isStreaming: false,
      };

      // Extract progress from any tool call
      if (args.progress) {
        updates.progress = args.progress as ProgressReport;
      }

      switch (toolCall.name) {
        case "concept_presentation":
          updates.currentBlock = args as unknown as ConceptBlock;
          break;
        case "practice_question":
          updates.currentQuestion = args as unknown as PracticeQuestion;
          break;
        case "practice_feedback":
          const feedback = args as unknown as PracticeFeedback;
          updates.currentFeedback = feedback;
          // Update gamification stats
          updates.questionsAnswered = prev.questionsAnswered + 1;
          if (feedback.is_correct) {
            updates.questionsCorrect = prev.questionsCorrect + 1;
            updates.currentStreak = prev.currentStreak + 1;
            // Award XP for correct answers (backend doesn't track XP)
            // Base: 10 XP, bonus for streaks
            const streakBonus = Math.min(prev.currentStreak, 5) * 2;
            updates.totalXP = prev.totalXP + 10 + streakBonus;
          } else {
            updates.currentStreak = 0;
          }

          // Check if session is complete via progress report
          // Session ends when all blocks are complete
          if (feedback.progress) {
            const progress = feedback.progress as ProgressReport;
            if (progress.completed_blocks >= progress.total_blocks) {
              updates.stage = "complete";
            }
          }
          break;
      }

      return { ...prev, ...updates };
    });
  }, []);

  /**
   * Start a new practice session with the given context.
   */
  const startSession = useCallback(
    async (context: PracticeSessionContext) => {
      if (!clientRef.current) {
        throw new Error("LangGraph client not initialized");
      }

      setState((prev) => ({
        ...prev,
        stage: "loading",
        isStreaming: true,
        error: null,
      }));

      try {
        // Create new thread
        const thread = await clientRef.current.threads.create();
        threadIdRef.current = thread.thread_id;

        setState((prev) => ({ ...prev, threadId: thread.thread_id }));

        // Start the graph with session context
        const stream = clientRef.current.runs.stream(
          thread.thread_id,
          INFINITE_PRACTICE_ASSISTANT_ID,
          {
            input: { session_context: context },
            streamMode: ["messages", "updates"],
            streamSubgraphs: true,
          }
        );

        await processStream(stream as AsyncIterable<unknown>);
      } catch (error) {
        console.error("[useLangGraphWizard] startSession error:", error);
        setState((prev) => ({
          ...prev,
          stage: "error",
          isStreaming: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
        throw error;
      }
    },
    [processStream]
  );

  /**
   * Resume the graph with a user action (e.g., continue, submit answer).
   * Uses typed ResumePayload contract for type safety.
   */
  const resume = useCallback(
    async (payload: ResumePayload) => {
      if (!clientRef.current || !threadIdRef.current) {
        throw new Error("No active session to resume");
      }

      setState((prev) => ({ ...prev, isStreaming: true }));

      try {
        const stream = clientRef.current.runs.stream(
          threadIdRef.current,
          INFINITE_PRACTICE_ASSISTANT_ID,
          {
            input: null,
            command: { resume: JSON.stringify(payload) },
            streamMode: ["messages", "updates"],
            streamSubgraphs: true,
          }
        );

        await processStream(stream as AsyncIterable<unknown>);
      } catch (error) {
        console.error("[useLangGraphWizard] resume error:", error);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
        throw error;
      }
    },
    [processStream]
  );

  /**
   * Continue from concept presentation to start practicing.
   * Uses typed ResumeContinuePayload or ResumeSetDifficultyPayload contract.
   */
  const continueFromConcept = useCallback(
    async (difficultyOverride?: DifficultyLevel) => {
      if (difficultyOverride) {
        // Use typed set_difficulty payload
        const payload: ResumeSetDifficultyPayload = {
          action: "set_difficulty",
          difficulty: difficultyOverride,
        };
        await resume(payload);
      } else {
        // Use typed continue payload
        const payload: ResumeContinuePayload = { action: "continue" };
        await resume(payload);
      }
    },
    [resume]
  );

  /**
   * Submit an answer for the current question.
   * Uses typed ResumeSubmitPayload contract.
   * CRITICAL: Field is "answer" NOT "student_response"
   */
  const submitAnswer = useCallback(
    async (answer: string | string[], hintsUsed: number = 0) => {
      // Normalize array answers to string (for multi-select MCQ)
      const normalizedAnswer = Array.isArray(answer) ? answer.join(",") : answer;

      // Use typed submit payload - matches backend contract exactly
      const payload: ResumeSubmitPayload = {
        action: "submit",
        answer: normalizedAnswer,
        hints_used: hintsUsed,
      };
      await resume(payload);
    },
    [resume]
  );

  /**
   * Continue from feedback to the next question/block.
   * Uses typed ResumeContinuePayload contract.
   */
  const continueFromFeedback = useCallback(async () => {
    const payload: ResumeContinuePayload = { action: "continue" };
    await resume(payload);
  }, [resume]);

  /**
   * Reset the wizard state for a new session.
   */
  const reset = useCallback(() => {
    threadIdRef.current = null;
    setState({
      stage: "loading",
      threadId: null,
      progress: null,
      currentBlock: null,
      currentQuestion: null,
      currentFeedback: null,
      isStreaming: false,
      error: null,
      totalXP: 0,
      currentStreak: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
    });
  }, []);

  return {
    ...state,
    startSession,
    continueFromConcept,
    submitAnswer,
    continueFromFeedback,
    reset,
  };
}

export default useLangGraphWizard;
