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

// Import PracticeQuestionDriver for v2 offline questions
import {
  PracticeQuestionDriver,
  type ParsedPracticeQuestion,
  type QuestionAvailability,
  type RandomQuestionResult,
} from "@/lib/appwrite/driver/PracticeQuestionDriver";

// Import persistence hook for mastery and session updates (Gap P0, P2)
import { usePracticePersistence } from "./usePracticePersistence";

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

// ═══════════════════════════════════════════════════════════════════════════
// Debug Logging Utility for Manual Testing
// Filter in browser console with: [PRACTICE-V2]
// ═══════════════════════════════════════════════════════════════════════════
const DEBUG_PREFIX = "[PRACTICE-V2]";
const debugLog = {
  mastery: (message: string, data?: unknown) => {
    console.log(`${DEBUG_PREFIX} 📊 MASTERY: ${message}`, data ?? "");
  },
  difficulty: (message: string, data?: unknown) => {
    console.log(`${DEBUG_PREFIX} 🎯 DIFFICULTY: ${message}`, data ?? "");
  },
  block: (message: string, data?: unknown) => {
    console.log(`${DEBUG_PREFIX} 📦 BLOCK: ${message}`, data ?? "");
  },
  progression: (message: string, data?: unknown) => {
    console.log(`${DEBUG_PREFIX} ➡️ PROGRESSION: ${message}`, data ?? "");
  },
  question: (message: string, data?: unknown) => {
    console.log(`${DEBUG_PREFIX} ❓ QUESTION: ${message}`, data ?? "");
  },
  state: (message: string, data?: unknown) => {
    console.log(`${DEBUG_PREFIX} 🔄 STATE: ${message}`, data ?? "");
  },
};

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

// Re-export v2 types for offline questions
export type { ParsedPracticeQuestion, QuestionAvailability };

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
  // V2 offline questions support
  isV2Mode: boolean;
  shownQuestionIds: string[];
  questionAvailability: QuestionAvailability | null;
  // Deduplication: Track last processed tool call ID (React can call setState multiple times)
  lastProcessedToolCallId: string | null;
  // V2 Mastery Tracking - EXPOSED for UI (fixes bug: mastery not updating)
  // cumulativeMasteryRef tracks internally, this exposes to components
  cumulativeMastery: number;
  // V2 Block Progress - hard questions attempted count for UI display
  hardQuestionsAttempted: number;
  // V2 Block Completion Flag - triggers useEffect to reset refs
  // IMPORTANT: Refs must NOT be reset inside setState callback (React StrictMode purity)
  blockJustCompleted: boolean;
  // V2 Multi-block progression - pending next block to fetch
  // When set, useEffect will trigger nextQuestionV2 for the new block
  pendingNextBlock: { blockIndex: number; blockId: string } | null;
}

/**
 * V2 Session Context - includes pre-generated question from Appwrite
 * Used with the marking-only infinite_practice_graph_v2
 */
export interface PracticeSessionContextV2 {
  /** Student's document ID */
  student_id: string;
  /** Lesson template ID */
  lesson_template_id: string;
  /** Current block ID */
  block_id: string;
  /** Pre-generated question from practice_questions collection */
  current_question: ParsedPracticeQuestion;
  /** Session ID (optional for new sessions) */
  session_id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// LangGraph SDK Client Configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timeout configuration for LangGraph operations.
 * Question generation can take 60-90 seconds due to LLM calls + diagram generation.
 */
const STREAM_TIMEOUT_MS = 90_000; // 90 seconds for stream operations
const MAX_RETRY_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 2_000; // Poll thread state every 2 seconds
const POLL_MAX_WAIT_MS = 60_000; // Maximum time to wait for thread during polling

const createClient = () => {
  const apiUrl =
    process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"] ||
    new URL("/api", window.location.href).href;
  const apiKey = process.env["NEXT_PUBLIC_LANGSMITH_API_KEY"];

  return new Client({
    apiUrl,
    apiKey: apiKey,
    timeoutMs: STREAM_TIMEOUT_MS,
  });
};

const INFINITE_PRACTICE_ASSISTANT_ID = "infinite_practice";

// ═══════════════════════════════════════════════════════════════════════════
// Thread State Polling Utilities
// ═══════════════════════════════════════════════════════════════════════════

interface ThreadState {
  status: "idle" | "busy" | "error" | "interrupted";
  error?: string;
}

/**
 * Check if an error is a timeout-related error.
 */
const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("network error") ||
      message.includes("aborted") ||
      message.includes("econnreset")
    );
  }
  return false;
};

/**
 * Poll the thread state to check if backend is still processing.
 * Returns the thread state with status and any errors.
 */
const pollThreadState = async (
  client: Client,
  threadId: string
): Promise<ThreadState> => {
  try {
    const state = await client.threads.getState(threadId);

    // LangGraph thread states:
    // - "idle": Thread is not running
    // - "busy": Thread is processing
    // - "error": Thread encountered an error
    // - "interrupted": Thread is paused at an interrupt point

    const tasks = state.tasks || [];
    const hasError = tasks.some((task: { error?: string }) => task.error);
    const isBusy = tasks.some((task: { id?: string }) => task.id);

    if (hasError) {
      const errorTask = tasks.find((task: { error?: string }) => task.error);
      return {
        status: "error",
        error: errorTask?.error || "Unknown error in thread",
      };
    }

    // Check if there's a pending interrupt (waiting for user input)
    if (state.next && state.next.length > 0) {
      return { status: "interrupted" };
    }

    if (isBusy) {
      return { status: "busy" };
    }

    return { status: "idle" };
  } catch (error) {
    console.error("[pollThreadState] Failed to get thread state:", error);
    throw error;
  }
};

/**
 * Wait for thread to complete or reach an interrupt point.
 * Polls the thread state until it's no longer busy.
 */
const waitForThreadCompletion = async (
  client: Client,
  threadId: string,
  maxWaitMs: number = POLL_MAX_WAIT_MS
): Promise<ThreadState> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const state = await pollThreadState(client, threadId);

    console.log(`[waitForThreadCompletion] Thread ${threadId} status: ${state.status}`);

    if (state.status !== "busy") {
      return state;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout waiting for thread
  return { status: "busy" };
};

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

  // CRITICAL: Only process messages/complete events, NOT messages/partial
  // LangGraph streams tool call arguments token-by-token via partial events.
  // For large data like diagram_base64, partial events contain incomplete data
  // which breaks image rendering. We must wait for complete events.
  if (evt.event !== "messages/complete") {
    return null;
  }

  if (!Array.isArray(evt.data) || evt.data.length === 0) {
    return null;
  }

  const message = evt.data[0] as {
    tool_calls?: { id: string; name: string; args: Record<string, unknown> | string }[];
    additional_kwargs?: {
      tool_calls?: { id: string; name: string; args: Record<string, unknown> | string }[];
    };
  };

  // Check for tool_calls directly on message or in additional_kwargs
  const toolCalls = message?.tool_calls || message?.additional_kwargs?.tool_calls;

  if (!toolCalls?.length) {
    return null;
  }

  const toolCall = toolCalls[0];

  // Handle args that might be a JSON string (common in LangGraph streaming)
  let parsedArgs: Record<string, unknown> = {};
  if (typeof toolCall.args === "string") {
    try {
      parsedArgs = JSON.parse(toolCall.args);
      console.log("[extractToolCallFromEvent] Parsed args from string");
    } catch (e) {
      console.error("[extractToolCallFromEvent] Failed to parse args string:", e);
      parsedArgs = {};
    }
  } else {
    parsedArgs = toolCall.args || {};
  }

  // Debug: Log when diagram_base64 is found
  if (parsedArgs.diagram_base64) {
    console.log("[extractToolCallFromEvent] 📊 Found diagram_base64 in tool call args");
    console.log("  - Type:", typeof parsedArgs.diagram_base64);
    console.log("  - Length:", (parsedArgs.diagram_base64 as string).length);
    console.log("  - First 100 chars:", (parsedArgs.diagram_base64 as string).substring(0, 100));
  }

  return {
    id: toolCall.id,
    name: toolCall.name,
    args: parsedArgs,
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
    // V2 fields
    isV2Mode: false,
    shownQuestionIds: [],
    questionAvailability: null,
    lastProcessedToolCallId: null,
    // V2 Mastery Tracking - exposed for UI
    cumulativeMastery: 0,
    hardQuestionsAttempted: 0,
    blockJustCompleted: false,
    // V2 Multi-block progression
    pendingNextBlock: null,
  });

  const clientRef = useRef<Client | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const questionDriverRef = useRef<PracticeQuestionDriver | null>(null);
  const v2ContextRef = useRef<{
    lessonTemplateId: string;
    blockId: string;
    difficulty: DifficultyLevel;
    studentId: string;
    // Added for persistence (Gap P0, P2)
    courseId: string;
    sessionId?: string;
    sessionToken?: string;
    currentOutcomeIds?: string[];
    // Multi-block progression support
    allBlockIds: string[];
    currentBlockIndex: number;
  } | null>(null);

  // Ref to store session token for persistence operations
  const sessionTokenRef = useRef<string | undefined>(undefined);

  // Ref to track shown question IDs (avoids stale closure issues with state)
  // CRITICAL: Using ref instead of state.shownQuestionIds prevents repeated questions
  const shownQuestionIdsRef = useRef<string[]>([]);

  // Ref to track consecutive correct answers for adaptive difficulty (V2 mode)
  // After ADAPTIVE_THRESHOLD consecutive correct answers, upgrade difficulty
  const consecutiveCorrectRef = useRef<number>(0);
  const consecutiveIncorrectRef = useRef<number>(0);
  const ADAPTIVE_UPGRADE_THRESHOLD = 3; // Upgrade after 3 consecutive correct
  const ADAPTIVE_DOWNGRADE_THRESHOLD = 2; // Downgrade after 2 consecutive incorrect

  // Track hard questions answered correctly per block (for pool exhaustion handling)
  // When hard pool exhausts, we check if 2+ hard questions were answered correctly
  // Key: blockId, Value: count of hard questions answered correctly
  const hardQuestionsCorrectPerBlockRef = useRef<Map<string, number>>(new Map());
  const HARD_QUESTIONS_REQUIRED = 2; // Require 2 hard correct to consider block "mastered"

  // ═══════════════════════════════════════════════════════════════════════════
  // BUG FIX: Deduplication + Frontend Block Completion (V2 stateless backend)
  // ═══════════════════════════════════════════════════════════════════════════

  // Track processed tool call IDs to prevent double-processing
  // (LangGraph can emit same tool call from subgraph and main graph)
  const processedToolCallIdsRef = useRef<Set<string>>(new Set());

  // ═══════════════════════════════════════════════════════════════════════════
  // REACT STRICTMODE FIX: Cache computed states for setState callback purity
  //
  // WHY:
  // - React StrictMode calls setState callbacks twice expecting same output
  // - If callback returns `newState` then `prev`, React may discard the update
  // - Solution: Cache the computed state and return SAME value on all invocations
  //
  // This ref stores: Map<toolCallId, computedState>
  // ═══════════════════════════════════════════════════════════════════════════
  const computedStatesRef = useRef<Map<string, WizardState>>(new Map());

  // Track cumulative mastery for current block (V2 backend only sends deltas)
  const cumulativeMasteryRef = useRef<number>(0);

  // Track hard questions ATTEMPTED (not just correct) for block completion criteria
  // Block completion requires: mastery >= 70% AND hard_attempted >= 2
  const hardQuestionsAttemptedRef = useRef<number>(0);

  // Block completion thresholds
  const MASTERY_THRESHOLD = 0.70; // 70% mastery required
  const HARD_ATTEMPTED_REQUIRED = 2; // 2 hard questions attempted required

  // Track current difficulty for V2 mode (exposed for UI display)
  const [currentDifficulty, setCurrentDifficulty] = useState<DifficultyLevel>("easy");

  // Initialize persistence hook (Gap P0: Mastery, Gap P2: Session)
  const { persistFeedbackResult } = usePracticePersistence(sessionTokenRef.current);

  // Initialize client on mount
  useEffect(() => {
    clientRef.current = createClient();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // REACT STRICTMODE BUG FIX: Reset refs AFTER setState completes
  //
  // WHY: React StrictMode runs setState callbacks twice for purity checking.
  // If refs are mutated inside setState callback:
  //   - First run: computes correct state, mutates refs (e.g., cumulativeMasteryRef = 0)
  //   - Second run: sees mutated refs, computes WRONG state
  //
  // SOLUTION: Use a flag (blockJustCompleted) in state, and reset refs in useEffect.
  // useEffect runs AFTER React commits the state update, so refs are reset safely.
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (state.blockJustCompleted) {
      debugLog.state("🔄 Block completion useEffect triggered - resetting refs", {
        cumulativeMastery: cumulativeMasteryRef.current,
        hardQuestionsAttempted: hardQuestionsAttemptedRef.current,
      });

      // Reset block-specific refs for next block
      cumulativeMasteryRef.current = 0;
      hardQuestionsAttemptedRef.current = 0;
      consecutiveCorrectRef.current = 0;
      consecutiveIncorrectRef.current = 0;

      // Clear deduplication caches for fresh state
      processedToolCallIdsRef.current.clear();
      computedStatesRef.current.clear();

      // Reset the flag (must be done AFTER ref resets)
      setState((prev) => ({ ...prev, blockJustCompleted: false }));

      debugLog.state("✅ Refs reset complete - ready for next block");
    }
  }, [state.blockJustCompleted]);

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
   *
   * For practice_feedback: Also triggers persistence of mastery and session updates (Gap P0, P2).
   */
  const processToolCall = useCallback((toolCall: ToolCall) => {
    debugLog.state("processToolCall called", { toolCallId: toolCall.id, name: toolCall.name });

    const newStage = TOOL_TO_STAGE[toolCall.name];
    const args = toolCall.args;

    setState((prev) => {
      // ═══════════════════════════════════════════════════════════════════════════
      // REACT STRICTMODE FIX: Ensure setState callback purity
      //
      // PROBLEM:
      // - React StrictMode calls setState callbacks twice expecting same output
      // - If first call returns newState and second returns prev, React may discard update
      //
      // SOLUTION:
      // - Cache the computed state for each tool call ID
      // - On duplicate invocations, return the SAME cached state (not prev)
      // - This ensures callback purity: same input → same output
      //
      // FLOW:
      // 1. First callback: ref.has() = false → compute newState → cache it → return newState
      // 2. Second callback: ref.has() = TRUE → return CACHED newState (same value!)
      // ═══════════════════════════════════════════════════════════════════════════

      // Check if we already computed state for this tool call
      const cachedState = computedStatesRef.current.get(toolCall.id);
      if (cachedState) {
        debugLog.state("Returning CACHED state for duplicate callback (React purity fix)", { toolCallId: toolCall.id });
        return cachedState; // Return the SAME computed state - ensures purity!
      }

      // Also check the processed ref (belt and suspenders)
      if (processedToolCallIdsRef.current.has(toolCall.id)) {
        debugLog.state("SKIPPING duplicate tool call (no cache but ref exists)", { toolCallId: toolCall.id });
        return prev; // Fallback: shouldn't happen if cache is working
      }

      // Mark as processed IMMEDIATELY (synchronous ref mutation)
      processedToolCallIdsRef.current.add(toolCall.id);
      debugLog.state("Processing tool call (first execution)", { toolCallId: toolCall.id, name: toolCall.name });

      const updates: Partial<WizardState> = {
        stage: newStage,
        isStreaming: false,
        lastProcessedToolCallId: toolCall.id, // Track for debugging (ref is the real guard)
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
          // Debug: Log all diagram-related fields from backend tool call
          console.log("[useLangGraphWizard] 🖼️ V2 DIAGRAM DEBUG - Tool call from backend:");
          console.log("  - All args keys:", Object.keys(args));
          console.log("  - diagram_base64 present:", !!args.diagram_base64);
          console.log("  - diagram_base64 length:", args.diagram_base64 ? (args.diagram_base64 as string).length : 0);
          console.log("  - diagramFileId:", args.diagramFileId);
          console.log("  - diagramRequired:", args.diagramRequired);
          console.log("  - diagram_title:", args.diagram_title);
          console.log("  - diagram_type:", args.diagram_type);
          console.log("  - diagram_description:", args.diagram_description);
          if (args.diagram_base64) {
            console.log("  - diagram_base64 first 50 chars:", (args.diagram_base64 as string).substring(0, 50));
          }
          updates.currentQuestion = args as unknown as PracticeQuestion;

          // ═══════════════════════════════════════════════════════════════════════════
          // BUG FIX: Initialize progress.blocks on FIRST question (not just on feedback)
          // This ensures the side panel has block data before any answer is submitted.
          // The blocks array is created from v2ContextRef.allBlockIds which is set
          // when the session starts (in startSessionV2).
          // ═══════════════════════════════════════════════════════════════════════════
          if (prev.isV2Mode && !prev.progress && v2ContextRef.current?.allBlockIds) {
            const allBlockIds = v2ContextRef.current.allBlockIds;
            const currentBlockIndex = v2ContextRef.current.currentBlockIndex || 0;

            // Create initial blocks array with 0 mastery
            const initialBlocks = allBlockIds.map((blockId) => ({
              block_id: blockId,
              mastery_score: 0,
              is_complete: false,
            }));

            updates.progress = {
              session_id: v2ContextRef.current.sessionId || "",
              total_blocks: allBlockIds.length,
              completed_blocks: 0,
              current_block_index: currentBlockIndex,
              overall_mastery: 0,
              blocks: initialBlocks,
            };

            console.log("[PRACTICE-V2] 📦 PROGRESS: Initialized progress.blocks on first question", {
              totalBlocks: allBlockIds.length,
              blockIds: allBlockIds,
              currentBlockIndex,
            });
          }
          break;
        case "practice_feedback":
          // Log raw args to debug new_mastery_score issue
          console.log("[useLangGraphWizard] 🎯 practice_feedback args:", {
            keys: Object.keys(args),
            is_correct: args.is_correct,
            new_mastery_score: args.new_mastery_score,
            partial_credit: args.partial_credit,
            fullArgs: JSON.stringify(args).slice(0, 500) + "..."
          });

          const feedback = args as unknown as PracticeFeedback;

          // ═══════════════════════════════════════════════════════════════
          // STRATEGIC DEBUG LOG: Mastery Update
          // ═══════════════════════════════════════════════════════════════
          debugLog.mastery("Received feedback from backend", {
            is_correct: feedback.is_correct,
            mastery_delta: (feedback as { mastery_delta?: number }).mastery_delta,
            new_mastery_score: feedback.new_mastery_score,
            difficulty: v2ContextRef.current?.difficulty,
            blockId: v2ContextRef.current?.blockId,
          });
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
            // Track for V2 adaptive difficulty
            consecutiveCorrectRef.current += 1;
            consecutiveIncorrectRef.current = 0;
            debugLog.difficulty("✅ Correct answer - counters updated", {
              consecutiveCorrect: consecutiveCorrectRef.current,
              consecutiveIncorrect: consecutiveIncorrectRef.current,
              upgradeAt: ADAPTIVE_UPGRADE_THRESHOLD,
            });

            // Track hard questions answered correctly per block (for pool exhaustion handling)
            // This prevents infinite loops when hard question pool is small (e.g., only 3 questions)
            if (prev.isV2Mode && v2ContextRef.current?.difficulty === 'hard') {
              const blockId = v2ContextRef.current.blockId;
              const currentCount = hardQuestionsCorrectPerBlockRef.current.get(blockId) || 0;
              hardQuestionsCorrectPerBlockRef.current.set(blockId, currentCount + 1);
              debugLog.block("Hard question correct for block", {
                blockId,
                hardCorrectCount: currentCount + 1,
                requiredForCompletion: HARD_QUESTIONS_REQUIRED,
              });
            }
          } else {
            updates.currentStreak = 0;
            // Track for V2 adaptive difficulty
            consecutiveIncorrectRef.current += 1;
            consecutiveCorrectRef.current = 0;
            debugLog.difficulty("❌ Incorrect answer - counters updated", {
              consecutiveCorrect: consecutiveCorrectRef.current,
              consecutiveIncorrect: consecutiveIncorrectRef.current,
              downgradeAt: ADAPTIVE_DOWNGRADE_THRESHOLD,
            });
          }

          // ═══════════════════════════════════════════════════════════════
          // BUG FIX: V2 Frontend Block Completion (backend is stateless)
          // V2 backend only sends mastery_delta - we must track cumulative
          // Block completion: mastery >= 70% AND hard_attempted >= 2
          // ═══════════════════════════════════════════════════════════════

          // Track cumulative mastery (V2 backend sends deltas, not absolute values)
          const rawFeedbackArgs = feedback as { mastery_delta?: number };
          const masteryDelta = rawFeedbackArgs.mastery_delta ?? 0;
          console.log("[useLangGraphWizard] 📊 MASTERY DEBUG:", {
            rawMasteryDelta: rawFeedbackArgs.mastery_delta,
            parsedMasteryDelta: masteryDelta,
            feedbackKeys: Object.keys(feedback),
            isV2Mode: prev.isV2Mode,
          });
          if (masteryDelta !== 0) {
            cumulativeMasteryRef.current = Math.max(0, Math.min(1, cumulativeMasteryRef.current + masteryDelta));
            debugLog.mastery("Cumulative mastery updated", {
              delta: masteryDelta,
              previousCumulative: cumulativeMasteryRef.current - masteryDelta,
              newCumulative: cumulativeMasteryRef.current,
              threshold: MASTERY_THRESHOLD,
            });
          }

          // ═══════════════════════════════════════════════════════════════
          // BUG FIX: Expose cumulative mastery to state for UI consumption
          // Previously: cumulativeMasteryRef.current was tracked but never exposed
          // Now: Also update state.cumulativeMastery so UI can read it
          // ═══════════════════════════════════════════════════════════════
          updates.cumulativeMastery = cumulativeMasteryRef.current;

          // Track hard questions ATTEMPTED (not just correct) - ANY hard question counts
          // This is critical: block completion requires 2 hard ATTEMPTED, not 2 hard CORRECT
          if (prev.isV2Mode && v2ContextRef.current?.difficulty === 'hard') {
            hardQuestionsAttemptedRef.current += 1;
            debugLog.block("Hard question ATTEMPTED for block (regardless of correct/incorrect)", {
              blockId: v2ContextRef.current.blockId,
              hardAttemptedCount: hardQuestionsAttemptedRef.current,
              requiredForCompletion: HARD_ATTEMPTED_REQUIRED,
              wasCorrect: feedback.is_correct,
            });
          }

          // ═══════════════════════════════════════════════════════════════
          // BUG FIX: Expose hard questions attempted to state for UI consumption
          // ═══════════════════════════════════════════════════════════════
          updates.hardQuestionsAttempted = hardQuestionsAttemptedRef.current;

          // Frontend Block Completion Check (V2 backend doesn't send progress)
          if (prev.isV2Mode) {
            const masteryMet = cumulativeMasteryRef.current >= MASTERY_THRESHOLD;
            const hardAttemptedMet = hardQuestionsAttemptedRef.current >= HARD_ATTEMPTED_REQUIRED;
            const blockComplete = masteryMet && hardAttemptedMet;

            debugLog.block("Block completion check (frontend)", {
              cumulativeMastery: cumulativeMasteryRef.current,
              masteryThreshold: MASTERY_THRESHOLD,
              masteryMet,
              hardAttempted: hardQuestionsAttemptedRef.current,
              hardRequired: HARD_ATTEMPTED_REQUIRED,
              hardAttemptedMet,
              blockComplete,
            });

            // ═══════════════════════════════════════════════════════════════
            // BUG FIX: Create/update progress object for V2 mode
            // V2 backend doesn't send progress - we must construct it frontend-side
            // This ensures progress.overall_mastery and progress.blocks are updated
            // Note: BlockProgress type from contracts only has block_id, mastery_score, is_complete
            //
            // MULTI-BLOCK FIX: Use allBlockIds from v2ContextRef for proper total_blocks
            // ═══════════════════════════════════════════════════════════════
            const currentBlockId = v2ContextRef.current?.blockId || "block_1";
            const allBlockIds = v2ContextRef.current?.allBlockIds || [currentBlockId];
            const currentBlockIndex = v2ContextRef.current?.currentBlockIndex || 0;

            // Build initial blocks array from allBlockIds if not already present
            const initialBlocks = allBlockIds.map((blockId) => ({
              block_id: blockId,
              mastery_score: 0,
              is_complete: false,
            }));

            const currentProgress: ProgressReport = prev.progress || {
              session_id: v2ContextRef.current?.sessionId || "",
              total_blocks: allBlockIds.length,
              completed_blocks: 0,
              current_block_index: currentBlockIndex,
              overall_mastery: 0,
              blocks: initialBlocks,
            };

            // Update progress with current mastery and completion status
            // BUG FIX: Capture cumulativeMasteryRef value ONCE to ensure consistency
            const currentCumulativeMastery = cumulativeMasteryRef.current;

            // BUG FIX: Use v2ContextRef.currentBlockIndex as source of truth
            // The progress.current_block_index might be stale if state updates are batched
            // v2ContextRef is updated synchronously and is more reliable
            const activeBlockIndex = v2ContextRef.current?.currentBlockIndex ?? currentProgress.current_block_index;

            debugLog.mastery("🔍 MASTERY DEBUG: About to update progress", {
              currentCumulativeMastery,
              activeBlockIndex,
              progressCurrentBlockIndex: currentProgress.current_block_index,
              v2ContextBlockIndex: v2ContextRef.current?.currentBlockIndex,
              prevBlocksMastery: currentProgress.blocks.map((b, i) => ({ index: i, mastery: b.mastery_score })),
              blockComplete,
            });

            // BUG FIX: Ensure the active block index is valid
            if (activeBlockIndex < 0 || activeBlockIndex >= currentProgress.blocks.length) {
              console.error(`[MASTERY BUG] Invalid activeBlockIndex ${activeBlockIndex}, blocks length: ${currentProgress.blocks.length}`);
              debugLog.mastery("⚠️ INVALID BLOCK INDEX - using 0 as fallback", { activeBlockIndex, blocksLength: currentProgress.blocks.length });
            }

            // Use safe block index (default to 0 if invalid)
            const safeBlockIndex = (activeBlockIndex >= 0 && activeBlockIndex < currentProgress.blocks.length)
              ? activeBlockIndex
              : 0;

            updates.progress = {
              ...currentProgress,
              overall_mastery: currentCumulativeMastery,
              // BUG FIX: Also sync current_block_index from v2ContextRef
              current_block_index: safeBlockIndex,
              blocks: currentProgress.blocks.map((block, index) => {
                if (index === safeBlockIndex) {
                  debugLog.mastery(`📊 Updating block ${index} mastery from ${block.mastery_score} to ${currentCumulativeMastery}`);
                  return {
                    ...block,
                    mastery_score: currentCumulativeMastery,
                    is_complete: blockComplete,
                  };
                }
                return block;
              }),
              completed_blocks: blockComplete ? currentProgress.completed_blocks + 1 : currentProgress.completed_blocks,
            };

            // BUG FIX: Verify consistency - overall_mastery should match current block mastery
            const updatedBlockMastery = updates.progress.blocks[safeBlockIndex]?.mastery_score;
            if (Math.abs(updates.progress.overall_mastery - updatedBlockMastery) > 0.001) {
              console.error(`[MASTERY BUG] Inconsistency detected: overall=${updates.progress.overall_mastery}, block[${safeBlockIndex}]=${updatedBlockMastery}`);
              debugLog.mastery("⚠️ MASTERY INCONSISTENCY DETECTED", {
                overall: updates.progress.overall_mastery,
                blockMastery: updatedBlockMastery,
                blockIndex: safeBlockIndex,
              });
            }

            debugLog.block("Progress object updated (frontend-constructed)", {
              overall_mastery: updates.progress.overall_mastery,
              block_mastery: updates.progress.blocks.map((b, i) => ({ index: i, mastery: b.mastery_score })),
              current_block_index: safeBlockIndex,
              completed_blocks: updates.progress.completed_blocks,
            });

            if (blockComplete) {
              debugLog.progression("🎉 BLOCK COMPLETE! (frontend detection)", {
                mastery: cumulativeMasteryRef.current,
                hardAttempted: hardQuestionsAttemptedRef.current,
                blockId: v2ContextRef.current?.blockId,
                safeBlockIndex,
                totalBlocks: allBlockIds.length,
              });

              // ═══════════════════════════════════════════════════════════════
              // MULTI-BLOCK FIX: Check if more blocks remain before celebration
              // ═══════════════════════════════════════════════════════════════
              const newCompletedBlocks = updates.progress.completed_blocks;
              const totalBlocks = allBlockIds.length;
              const isLastBlock = newCompletedBlocks >= totalBlocks;

              debugLog.progression("Multi-block progression check", {
                completedBlocks: newCompletedBlocks,
                totalBlocks,
                isLastBlock,
                nextBlockIndex: safeBlockIndex + 1,
                nextBlockId: allBlockIds[safeBlockIndex + 1],
              });

              if (isLastBlock) {
                // ALL BLOCKS COMPLETE → Show celebration
                debugLog.progression("🎊 SESSION COMPLETE! All blocks done - showing celebration", {
                  completedBlocks: newCompletedBlocks,
                  totalBlocks,
                });
                updates.stage = "complete";
              } else {
                // MORE BLOCKS REMAIN → Progress to next block
                const nextBlockIndex = safeBlockIndex + 1;
                const nextBlockId = allBlockIds[nextBlockIndex];

                debugLog.progression("➡️ PROGRESSING TO NEXT BLOCK", {
                  fromBlock: safeBlockIndex,
                  toBlock: nextBlockIndex,
                  nextBlockId,
                });

                // Set stage to "block_transition" (new stage for multi-block)
                // The useEffect will handle fetching the next question
                updates.stage = "loading";
                updates.pendingNextBlock = {
                  blockIndex: nextBlockIndex,
                  blockId: nextBlockId,
                };

                // Update progress to reflect the new current block
                updates.progress = {
                  ...updates.progress,
                  current_block_index: nextBlockIndex,
                };
              }

              // ═══════════════════════════════════════════════════════════════
              // BUG FIX: DO NOT reset refs or clear cache inside setState callback!
              // React StrictMode runs callbacks twice for purity checking.
              // If we reset refs here, the second run would see cumulativeMasteryRef.current = 0
              // and compute the wrong mastery.
              //
              // The refs will be reset when:
              // 1. User starts a new session (startSession)
              // 2. User calls reset()
              // 3. useEffect triggers on blockJustCompleted flag
              //
              // The cache ensures React purity - returning same state for duplicate calls
              // ═══════════════════════════════════════════════════════════════
              updates.blockJustCompleted = true; // Flag for useEffect to reset refs

              debugLog.state("Block complete - refs will be reset via useEffect", {
                finalMastery: cumulativeMasteryRef.current,
                hardAttempted: hardQuestionsAttemptedRef.current,
              });
            }
          }

          // Check if session is complete via progress report
          // Session ends when all blocks are complete
          if (feedback.progress) {
            const progress = feedback.progress as ProgressReport;

            // ═══════════════════════════════════════════════════════════════
            // STRATEGIC DEBUG LOG: Block Completion & Progression
            // ═══════════════════════════════════════════════════════════════
            debugLog.block("Progress report received", {
              completed_blocks: progress.completed_blocks,
              total_blocks: progress.total_blocks,
              current_block_index: progress.current_block_index,
              overall_mastery: progress.overall_mastery,
            });

            if (progress.completed_blocks >= progress.total_blocks) {
              debugLog.progression("SESSION COMPLETE - All blocks done!", {
                completed_blocks: progress.completed_blocks,
                total_blocks: progress.total_blocks,
              });
              updates.stage = "complete";
            } else if (progress.current_block_index !== undefined) {
              debugLog.progression("Block may have progressed", {
                current_block_index: progress.current_block_index,
                completed_blocks: progress.completed_blocks,
              });
            }
          }

          // ═══════════════════════════════════════════════════════════════
          // Gap P0 + P2: Persist mastery and session updates
          // Runs async but non-blocking (errors are logged, not thrown)
          // ═══════════════════════════════════════════════════════════════
          if (prev.isV2Mode && v2ContextRef.current) {
            const context = v2ContextRef.current;
            console.log("[useLangGraphWizard] 💾 Triggering persistence for V2 feedback...");

            // Fire-and-forget persistence (non-blocking for UX)
            persistFeedbackResult(feedback, {
              studentId: context.studentId,
              courseId: context.courseId,
              sessionId: context.sessionId,
              outcomeIds: context.currentOutcomeIds,
            }).catch((err) => {
              console.error("[useLangGraphWizard] Persistence error (non-fatal):", err);
            });
          }
          break;
      }

      // Compute the new state
      const newState = { ...prev, ...updates };

      // Cache the computed state for React StrictMode purity
      // (subsequent callback invocations will return this same object)
      computedStatesRef.current.set(toolCall.id, newState);
      debugLog.state("Cached computed state for tool call", { toolCallId: toolCall.id, stage: newState.stage });

      return newState;
    });
  }, [persistFeedbackResult]);

  /**
   * Start a new practice session with the given context.
   *
   * Includes elegant timeout handling:
   * 1. On timeout, polls thread state to check if backend is still processing
   * 2. If thread is running with no errors, reconnects to stream
   * 3. Retries up to MAX_RETRY_ATTEMPTS times before failing
   */
  const startSession = useCallback(
    async (context: PracticeSessionContext) => {
      if (!clientRef.current) {
        throw new Error("LangGraph client not initialized");
      }

      const client = clientRef.current;

      setState((prev) => ({
        ...prev,
        stage: "loading",
        isStreaming: true,
        error: null,
      }));

      let lastError: Error | null = null;

      try {
        // Create new thread (this should be fast, no retry needed)
        const thread = await client.threads.create();
        threadIdRef.current = thread.thread_id;
        const threadId = thread.thread_id;

        setState((prev) => ({ ...prev, threadId }));

        // Start the graph with retry logic for timeouts
        for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
          try {
            console.log(`[useLangGraphWizard] startSession attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);

            // Only send input on first attempt
            // Subsequent attempts just reconnect to the running stream
            const streamOptions = attempt === 1
              ? {
                  input: { session_context: context },
                  streamMode: ["messages", "updates"] as const,
                  streamSubgraphs: true,
                }
              : {
                  input: null,
                  streamMode: ["messages", "updates"] as const,
                  streamSubgraphs: true,
                };

            const stream = client.runs.stream(
              threadId,
              INFINITE_PRACTICE_ASSISTANT_ID,
              streamOptions
            );

            await processStream(stream as AsyncIterable<unknown>);

            // Success - exit function
            return;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            console.error(
              `[useLangGraphWizard] startSession error (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}):`,
              lastError.message
            );

            // Only retry on timeout errors
            if (!isTimeoutError(error)) {
              console.error("[useLangGraphWizard] Non-timeout error, not retrying");
              break;
            }

            if (attempt < MAX_RETRY_ATTEMPTS) {
              console.log("[useLangGraphWizard] Timeout detected, polling thread state...");

              try {
                const threadState = await waitForThreadCompletion(
                  client,
                  threadId,
                  POLL_MAX_WAIT_MS
                );

                console.log(`[useLangGraphWizard] Thread state after polling: ${threadState.status}`);

                if (threadState.status === "error") {
                  console.error("[useLangGraphWizard] Thread has error:", threadState.error);
                  lastError = new Error(`Backend error: ${threadState.error}`);
                  break;
                }

                if (threadState.status === "interrupted") {
                  console.log("[useLangGraphWizard] Thread reached interrupt, reconnecting...");
                  continue;
                }

                if (threadState.status === "busy") {
                  console.log("[useLangGraphWizard] Thread still busy, will retry...");
                  continue;
                }

                console.log("[useLangGraphWizard] Thread is idle, attempting reconnect...");
                continue;
              } catch (pollError) {
                console.error("[useLangGraphWizard] Failed to poll thread state:", pollError);
                continue;
              }
            }
          }
        }

        // All retries exhausted
        console.error("[useLangGraphWizard] All retry attempts failed for startSession");
        throw lastError || new Error("Request timed out after multiple retries");
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
   *
   * Includes elegant timeout handling:
   * 1. On timeout, polls thread state to check if backend is still processing
   * 2. If thread is running with no errors, reconnects to stream
   * 3. Retries up to MAX_RETRY_ATTEMPTS times before failing
   */
  const resume = useCallback(
    async (payload: ResumePayload) => {
      if (!clientRef.current || !threadIdRef.current) {
        throw new Error("No active session to resume");
      }

      setState((prev) => ({ ...prev, isStreaming: true }));

      const threadId = threadIdRef.current;
      const client = clientRef.current;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          console.log(`[useLangGraphWizard] resume attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);

          // Only send resume command on first attempt
          // Subsequent attempts just reconnect to the running stream
          const streamOptions = attempt === 1
            ? {
                input: null,
                command: { resume: JSON.stringify(payload) },
                streamMode: ["messages", "updates"] as const,
                streamSubgraphs: true,
              }
            : {
                input: null,
                streamMode: ["messages", "updates"] as const,
                streamSubgraphs: true,
              };

          const stream = client.runs.stream(
            threadId,
            INFINITE_PRACTICE_ASSISTANT_ID,
            streamOptions
          );

          await processStream(stream as AsyncIterable<unknown>);

          // Success - exit retry loop
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          console.error(
            `[useLangGraphWizard] resume error (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}):`,
            lastError.message
          );

          // Only retry on timeout errors
          if (!isTimeoutError(error)) {
            console.error("[useLangGraphWizard] Non-timeout error, not retrying");
            break;
          }

          if (attempt < MAX_RETRY_ATTEMPTS) {
            console.log("[useLangGraphWizard] Timeout detected, polling thread state...");

            try {
              // Poll thread state to check if backend is still processing
              const threadState = await waitForThreadCompletion(
                client,
                threadId,
                POLL_MAX_WAIT_MS
              );

              console.log(`[useLangGraphWizard] Thread state after polling: ${threadState.status}`);

              if (threadState.status === "error") {
                // Thread has errored - don't retry
                console.error("[useLangGraphWizard] Thread has error:", threadState.error);
                lastError = new Error(`Backend error: ${threadState.error}`);
                break;
              }

              if (threadState.status === "interrupted") {
                // Thread reached interrupt - success! Reconnect to get the tool call
                console.log("[useLangGraphWizard] Thread reached interrupt, reconnecting...");
                continue; // Retry to get the interrupt data
              }

              if (threadState.status === "busy") {
                // Thread still busy - wait and retry
                console.log("[useLangGraphWizard] Thread still busy, will retry...");
                continue;
              }

              // Thread is idle - may have completed normally
              console.log("[useLangGraphWizard] Thread is idle, attempting reconnect...");
              continue;
            } catch (pollError) {
              console.error("[useLangGraphWizard] Failed to poll thread state:", pollError);
              // Continue with retry even if polling failed
              continue;
            }
          }
        }
      }

      // All retries exhausted
      console.error("[useLangGraphWizard] All retry attempts failed");
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: lastError || new Error("Request timed out after multiple retries"),
      }));
      throw lastError || new Error("Request timed out after multiple retries");
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
   *
   * Drawing support:
   * - drawingDataUrl: Base64 PNG of student drawing (for multimodal marking)
   * - drawingSceneData: Excalidraw scene data (for re-editing in frontend)
   */
  const submitAnswer = useCallback(
    async (
      answer: string | string[],
      hintsUsed: number = 0,
      drawingDataUrl?: string,
      drawingSceneData?: unknown
    ) => {
      // Normalize array answers to string (for multi-select MCQ)
      const normalizedAnswer = Array.isArray(answer) ? answer.join(",") : answer;

      // Use typed submit payload - matches backend contract exactly
      const payload: ResumeSubmitPayload = {
        action: "submit",
        answer: normalizedAnswer,
        hints_used: hintsUsed,
        // Include drawing data if provided (for structured response questions)
        ...(drawingDataUrl && { drawing_data_url: drawingDataUrl }),
        ...(drawingSceneData && { drawing_scene_data: drawingSceneData }),
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
    v2ContextRef.current = null;
    shownQuestionIdsRef.current = []; // Clear shown questions ref
    consecutiveCorrectRef.current = 0;
    consecutiveIncorrectRef.current = 0;
    hardQuestionsCorrectPerBlockRef.current.clear(); // Clear hard question tracking
    // Reset V2 mastery tracking refs
    cumulativeMasteryRef.current = 0;
    hardQuestionsAttemptedRef.current = 0;
    processedToolCallIdsRef.current.clear();
    computedStatesRef.current.clear();
    setCurrentDifficulty("easy");
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
      // V2 fields
      isV2Mode: false,
      shownQuestionIds: [],
      questionAvailability: null,
      lastProcessedToolCallId: null,
      // V2 Mastery Tracking - exposed for UI
      cumulativeMastery: 0,
      hardQuestionsAttempted: 0,
      blockJustCompleted: false,
      // V2 Multi-block progression
      pendingNextBlock: null,
    });
  }, []);

  /**
   * Calculate the next adaptive difficulty based on consecutive correct/incorrect answers.
   * Returns the new difficulty if a change is needed, or current difficulty if not.
   *
   * Adaptive rules:
   * - Upgrade (easy→medium, medium→hard): After ADAPTIVE_UPGRADE_THRESHOLD (3) consecutive correct
   * - Downgrade (hard→medium, medium→easy): After ADAPTIVE_DOWNGRADE_THRESHOLD (2) consecutive incorrect
   * - Resets counters when difficulty changes
   *
   * @returns The difficulty to use for the next question
   */
  const getNextAdaptiveDifficulty = useCallback((): DifficultyLevel => {
    const current = v2ContextRef.current?.difficulty || currentDifficulty;
    const consecutiveCorrect = consecutiveCorrectRef.current;
    const consecutiveIncorrect = consecutiveIncorrectRef.current;

    // ═══════════════════════════════════════════════════════════════
    // STRATEGIC DEBUG LOG: Adaptive Difficulty Check
    // ═══════════════════════════════════════════════════════════════
    debugLog.difficulty("Checking adaptive difficulty", {
      current,
      consecutiveCorrect,
      consecutiveIncorrect,
      upgradeThreshold: ADAPTIVE_UPGRADE_THRESHOLD,
      downgradeThreshold: ADAPTIVE_DOWNGRADE_THRESHOLD,
      willUpgrade: consecutiveCorrect >= ADAPTIVE_UPGRADE_THRESHOLD,
      willDowngrade: consecutiveIncorrect >= ADAPTIVE_DOWNGRADE_THRESHOLD,
    });

    // Check for upgrade
    if (consecutiveCorrect >= ADAPTIVE_UPGRADE_THRESHOLD) {
      let newDifficulty: DifficultyLevel = current;

      if (current === "easy") {
        newDifficulty = "medium";
        debugLog.difficulty("⬆️ UPGRADING: easy → medium", { consecutiveCorrect });
      } else if (current === "medium") {
        newDifficulty = "hard";
        debugLog.difficulty("⬆️ UPGRADING: medium → hard", { consecutiveCorrect });
      } else {
        // Already at hard, stay there
        debugLog.difficulty("At max difficulty (hard), staying", { consecutiveCorrect });
        return current;
      }

      // Reset counters on difficulty change
      consecutiveCorrectRef.current = 0;
      consecutiveIncorrectRef.current = 0;
      setCurrentDifficulty(newDifficulty);

      return newDifficulty;
    }

    // Check for downgrade
    if (consecutiveIncorrect >= ADAPTIVE_DOWNGRADE_THRESHOLD) {
      let newDifficulty: DifficultyLevel = current;

      if (current === "hard") {
        newDifficulty = "medium";
        debugLog.difficulty("⬇️ DOWNGRADING: hard → medium", { consecutiveIncorrect });
      } else if (current === "medium") {
        newDifficulty = "easy";
        debugLog.difficulty("⬇️ DOWNGRADING: medium → easy", { consecutiveIncorrect });
      } else {
        // Already at easy, stay there
        debugLog.difficulty("At min difficulty (easy), staying", { consecutiveIncorrect });
        return current;
      }

      // Reset counters on difficulty change
      consecutiveCorrectRef.current = 0;
      consecutiveIncorrectRef.current = 0;
      setCurrentDifficulty(newDifficulty);

      return newDifficulty;
    }

    // No change needed
    debugLog.difficulty("No threshold met, staying at current", { current, consecutiveCorrect, consecutiveIncorrect });
    return current;
  }, [currentDifficulty]);

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 Methods (Offline Question Support)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if offline practice questions are available for a lesson.
   * Used by dashboard to gray-out practice button when no questions exist.
   *
   * @param lessonTemplateId - Lesson template document ID
   * @param sessionToken - Appwrite session token for auth
   * @returns QuestionAvailability with counts
   */
  const checkQuestionsAvailable = useCallback(
    async (lessonTemplateId: string, sessionToken?: string): Promise<QuestionAvailability> => {
      if (!questionDriverRef.current) {
        questionDriverRef.current = new PracticeQuestionDriver(sessionToken);
      }

      const availability = await questionDriverRef.current.checkQuestionsAvailable(lessonTemplateId);

      setState((prev) => ({
        ...prev,
        questionAvailability: availability,
      }));

      return availability;
    },
    []
  );

  /**
   * Start a V2 practice session with pre-generated offline questions.
   * Uses the marking-only graph (infinite_practice_graph_v2).
   *
   * Flow:
   * 1. Fetch random question from practice_questions collection
   * 2. Create LangGraph thread
   * 3. Send session_context with current_question to backend
   * 4. Backend validates and presents question via tool call
   *
   * @param lessonTemplateId - Lesson template ID
   * @param blockId - Initial block ID
   * @param difficulty - Initial difficulty level
   * @param studentId - Student document ID
   * @param sessionToken - Appwrite session token
   * @param courseId - Course ID for mastery persistence (Gap P0)
   * @param sessionId - Practice session ID for session persistence (Gap P2)
   * @param questionAvailabilityParam - Pre-fetched question availability (contains all blocks!)
   * @throws Error if no questions available (fast-fail)
   */
  const startSessionV2 = useCallback(
    async (
      lessonTemplateId: string,
      blockId: string,
      difficulty: DifficultyLevel,
      studentId: string,
      sessionToken?: string,
      courseId?: string,
      sessionId?: string,
      questionAvailabilityParam?: QuestionAvailability | null
    ) => {
      if (!clientRef.current) {
        throw new Error("LangGraph client not initialized");
      }

      // Store session token for persistence (Gap P0, P2)
      sessionTokenRef.current = sessionToken;

      // Initialize question driver
      if (!questionDriverRef.current) {
        questionDriverRef.current = new PracticeQuestionDriver(sessionToken);
      }

      const driver = questionDriverRef.current;
      const client = clientRef.current;

      // Reset shown question IDs ref for new session (prevents stale closure issues)
      shownQuestionIdsRef.current = [];

      // Reset adaptive difficulty counters and set initial difficulty
      consecutiveCorrectRef.current = 0;
      consecutiveIncorrectRef.current = 0;
      setCurrentDifficulty(difficulty);

      // ═══════════════════════════════════════════════════════════════
      // Reset V2 block completion tracking for new session
      // These MUST be reset to ensure clean state - NOT a workaround
      // ═══════════════════════════════════════════════════════════════
      processedToolCallIdsRef.current.clear(); // Deduplication Set
      computedStatesRef.current.clear();       // React StrictMode purity cache
      cumulativeMasteryRef.current = 0;        // Mastery accumulator
      hardQuestionsAttemptedRef.current = 0;   // Hard question counter
      debugLog.state("Session started - all tracking refs reset", {
        processedToolCallIds: processedToolCallIdsRef.current.size,
        computedStatesCache: computedStatesRef.current.size,
        cumulativeMastery: cumulativeMasteryRef.current,
        hardQuestionsAttempted: hardQuestionsAttemptedRef.current,
      });

      setState((prev) => ({
        ...prev,
        stage: "loading",
        isStreaming: true,
        error: null,
        isV2Mode: true,
        shownQuestionIds: [],
      }));

      // Get all block IDs from questionAvailability for multi-block progression
      // CRITICAL: Use passed parameter, NOT state (state.questionAvailability is null at start!)
      const allBlockIds = questionAvailabilityParam?.byBlock?.map(b => b.blockId) || [blockId];
      const currentBlockIndex = allBlockIds.indexOf(blockId);

      debugLog.block("Multi-block session initialized", {
        allBlockIds,
        currentBlockIndex,
        totalBlocks: allBlockIds.length,
        startingBlockId: blockId,
      });

      // Store context for nextQuestion calls AND persistence (Gap P0, P2)
      v2ContextRef.current = {
        lessonTemplateId,
        blockId,
        difficulty,
        studentId,
        courseId: courseId || "",
        sessionId: sessionId,
        sessionToken: sessionToken,
        currentOutcomeIds: undefined, // Will be set after question fetch
        // Multi-block progression support
        allBlockIds,
        currentBlockIndex: currentBlockIndex >= 0 ? currentBlockIndex : 0,
      };

      try {
        // 1. Fetch random question from Appwrite (throws if none available)
        console.log("[useLangGraphWizard] V2: Fetching offline question...");
        const result = await driver.getRandomQuestion(
          lessonTemplateId,
          blockId,
          difficulty,
          [] // No excluded IDs for first question
        );

        const question = result.question;
        console.log("[useLangGraphWizard] V2: Fetched question:", question.question_id, {
          poolSize: result.poolSize,
          poolReset: result.poolReset,
        });

        // DEBUG: Log diagram fields from Appwrite fetch
        console.log("[useLangGraphWizard] 🖼️ V2 DIAGRAM DEBUG - After Appwrite fetch:");
        console.log("  - diagramFileId:", question.diagramFileId);
        console.log("  - diagramRequired:", question.diagramRequired);
        console.log("  - diagramTool:", question.diagramTool);
        console.log("  - diagram_base64 present:", !!question.diagram_base64);
        console.log("  - diagram_base64 length:", question.diagram_base64?.length || 0);
        console.log("  - diagram_title:", question.diagram_title);
        console.log("  - diagram_type:", question.diagram_type);
        if (question.diagram_base64) {
          console.log("  - diagram_base64 first 50 chars:", question.diagram_base64.substring(0, 50));
        }

        // Store outcome IDs for mastery persistence (Gap P0)
        if (v2ContextRef.current) {
          v2ContextRef.current.currentOutcomeIds = question.outcome_refs || [];
          console.log("[useLangGraphWizard] V2: Outcome refs:", question.outcome_refs);
        }

        // Track shown question (update BOTH ref and state)
        // Ref is used for driver calls (avoids stale closure)
        // State is for UI display if needed
        shownQuestionIdsRef.current = [...shownQuestionIdsRef.current, question.question_id];
        setState((prev) => ({
          ...prev,
          shownQuestionIds: [...shownQuestionIdsRef.current],
        }));

        // 2. Create new thread
        const thread = await client.threads.create();
        threadIdRef.current = thread.thread_id;
        const threadId = thread.thread_id;

        setState((prev) => ({ ...prev, threadId }));

        // 3. Build V2 session context with pre-generated question
        const sessionContext: PracticeSessionContextV2 = {
          student_id: studentId,
          lesson_template_id: lessonTemplateId,
          block_id: blockId,
          current_question: question,
        };

        console.log("[useLangGraphWizard] V2: Starting graph with offline question");

        // 4. Start the graph with question in session_context
        const stream = client.runs.stream(
          threadId,
          INFINITE_PRACTICE_ASSISTANT_ID,
          {
            input: { session_context: sessionContext },
            streamMode: ["messages", "updates"] as const,
            streamSubgraphs: true,
          }
        );

        await processStream(stream as AsyncIterable<unknown>);
      } catch (error) {
        console.error("[useLangGraphWizard] V2 startSessionV2 error:", error);
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
   * Fetch and send the next question in V2 mode.
   * Called after feedback to continue the session.
   *
   * CRITICAL: V2 graph is one-question-per-thread architecture.
   * Each question must create a NEW thread because the previous thread
   * ends at session_complete and cannot be resumed.
   *
   * @param newDifficulty - Optional new difficulty (if changed by adaptive system)
   * @param newBlockId - Optional new block ID (if advancing to next block)
   */
  const nextQuestionV2 = useCallback(
    async (newDifficulty?: DifficultyLevel, newBlockId?: string) => {
      if (!v2ContextRef.current) {
        throw new Error("No active V2 session");
      }

      if (!questionDriverRef.current) {
        throw new Error("Question driver not initialized");
      }

      if (!clientRef.current) {
        throw new Error("LangGraph client not initialized");
      }

      const context = v2ContextRef.current;
      const driver = questionDriverRef.current;
      const client = clientRef.current;

      setState((prev) => ({ ...prev, isStreaming: true }));

      try {
        // Update context if changed
        const difficulty = newDifficulty || context.difficulty;
        const blockId = newBlockId || context.blockId;

        if (newDifficulty && newDifficulty !== context.difficulty) {
          debugLog.difficulty(`Context update: ${context.difficulty} → ${newDifficulty}`, { newDifficulty });
          v2ContextRef.current.difficulty = newDifficulty;
        }
        if (newBlockId) {
          v2ContextRef.current.blockId = newBlockId;
        }

        // Fetch next question (excluding shown ones)
        // CRITICAL: Use ref instead of state to avoid stale closure issues
        debugLog.question("Fetching next question", {
          difficulty,
          blockId,
          excludeCount: shownQuestionIdsRef.current.length,
          shownIds: shownQuestionIdsRef.current,
        });
        const result = await driver.getRandomQuestion(
          context.lessonTemplateId,
          blockId,
          difficulty,
          shownQuestionIdsRef.current  // Use ref, not state (fixes repeated questions bug)
        );

        const question = result.question;
        debugLog.question(`Fetched question: ${question.question_id}`, {
          poolSize: result.poolSize,
          poolReset: result.poolReset,
          difficulty,
        });

        // DEBUG: Log diagram fields from Appwrite fetch (nextQuestionV2)
        console.log("[useLangGraphWizard] 🖼️ V2 DIAGRAM DEBUG - nextQuestionV2 After Appwrite fetch:");
        console.log("  - diagramFileId:", question.diagramFileId);
        console.log("  - diagramRequired:", question.diagramRequired);
        console.log("  - diagram_base64 present:", !!question.diagram_base64);
        console.log("  - diagram_base64 length:", question.diagram_base64?.length || 0);
        if (question.diagram_base64) {
          console.log("  - diagram_base64 first 50 chars:", question.diagram_base64.substring(0, 50));
        }

        // CRITICAL: Handle pool reset intelligently based on difficulty
        // When pool exhausts at hard difficulty with a small pool (e.g., 3 questions),
        // we need to prevent frustrating infinite loops of the same questions
        if (result.poolReset) {
          const hardCorrectForBlock = hardQuestionsCorrectPerBlockRef.current.get(blockId) || 0;
          debugLog.question("⚠️ Pool exhausted and reset", {
            difficulty,
            hardCorrectForBlock,
            requiredHard: HARD_QUESTIONS_REQUIRED,
            poolSize: result.poolSize,
          });

          if (difficulty === 'hard') {
            // At hard difficulty with pool reset
            if (hardCorrectForBlock >= HARD_QUESTIONS_REQUIRED) {
              // User has met hard question criteria - allow this last question then
              // the next continue should advance the block (handled by completion criteria)
              debugLog.question("Hard pool exhausted but user met criteria, allowing final question", { hardCorrectForBlock });
              shownQuestionIdsRef.current = [question.question_id];
            } else {
              // User hasn't met hard criteria and pool is exhausted
              // AUTO-DOWNGRADE to medium to avoid frustrating infinite hard repeats
              debugLog.difficulty("⬇️ AUTO-DOWNGRADE: Hard pool exhausted → medium", { hardCorrectForBlock, requiredHard: HARD_QUESTIONS_REQUIRED });

              // Update context to medium
              if (v2ContextRef.current) {
                v2ContextRef.current.difficulty = 'medium';
              }
              setCurrentDifficulty('medium');

              // Clear shown tracking for fresh medium pool
              shownQuestionIdsRef.current = [];

              // Recursively fetch from medium pool instead
              // This will give user more practice before returning to hard
              const mediumResult = await driver.getRandomQuestion(
                context.lessonTemplateId,
                blockId,
                'medium',
                [] // Fresh pool for medium
              );

              // Use the medium question instead
              const mediumQuestion = mediumResult.question;
              debugLog.question(`Downgraded to medium question: ${mediumQuestion.question_id}`, { poolSize: mediumResult.poolSize });

              // Track the medium question
              shownQuestionIdsRef.current = [mediumQuestion.question_id];

              // Continue with medium question (update question variable for rest of flow)
              // Note: We reassign to use medium question in the rest of this function
              Object.assign(question, mediumQuestion);
            }
          } else {
            // Non-hard difficulty pool reset - normal behavior
            debugLog.question("Pool reset at non-hard difficulty, clearing tracking", { difficulty });
            shownQuestionIdsRef.current = [question.question_id];
          }
        } else {
          // Normal case: add to tracking
          shownQuestionIdsRef.current = [...shownQuestionIdsRef.current, question.question_id];
        }
        debugLog.question("Shown questions updated", { shownIds: shownQuestionIdsRef.current, count: shownQuestionIdsRef.current.length });

        // Update outcome IDs for mastery persistence (Gap P0)
        if (v2ContextRef.current) {
          v2ContextRef.current.currentOutcomeIds = question.outcome_refs || [];
          console.log("[useLangGraphWizard] V2: Next question outcome refs:", question.outcome_refs);
        }

        // Sync state with ref
        setState((prev) => ({
          ...prev,
          shownQuestionIds: [...shownQuestionIdsRef.current],
        }));

        // CRITICAL: Create NEW thread for this question
        // V2 graph is one-question-per-thread - previous thread is at session_complete
        console.log("[useLangGraphWizard] V2: Creating NEW thread for next question");
        const thread = await client.threads.create();
        threadIdRef.current = thread.thread_id;
        const threadId = thread.thread_id;

        setState((prev) => ({ ...prev, threadId }));

        // Build V2 session context with new question
        const sessionContext: PracticeSessionContextV2 = {
          student_id: context.studentId,
          lesson_template_id: context.lessonTemplateId,
          block_id: blockId,
          current_question: question,
        };

        console.log("[useLangGraphWizard] V2: Starting graph with new thread:", threadId);

        // Start the graph with the new question on new thread
        const stream = client.runs.stream(
          threadId,
          INFINITE_PRACTICE_ASSISTANT_ID,
          {
            input: { session_context: sessionContext },
            streamMode: ["messages", "updates"] as const,
            streamSubgraphs: true,
          }
        );

        await processStream(stream as AsyncIterable<unknown>);

        console.log("[useLangGraphWizard] V2: Next question graph completed");
      } catch (error) {
        console.error("[useLangGraphWizard] V2 nextQuestionV2 error:", error);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
        throw error;
      }
    },
    [processStream]  // Removed state.shownQuestionIds - using ref instead prevents stale closure
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-BLOCK PROGRESSION: Handle transition to next block
  //
  // When pendingNextBlock is set, this useEffect:
  // 1. Waits for blockJustCompleted refs to be reset (false)
  // 2. Updates v2ContextRef with new block info
  // 3. Calls nextQuestionV2 with the new block (starting at easy difficulty)
  // 4. Clears the pendingNextBlock flag
  //
  // WHY useEffect: We can't call async functions inside setState, and nextQuestionV2
  // is an async function. The useEffect pattern allows us to trigger the async call
  // after state has been committed.
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!state.pendingNextBlock) return;

    // Wait for block completion refs to be reset first
    if (state.blockJustCompleted) {
      debugLog.progression("⏳ Waiting for refs reset before next block...");
      return;
    }

    const { blockIndex, blockId } = state.pendingNextBlock;

    debugLog.progression("🚀 MULTI-BLOCK: Starting transition to next block", {
      blockIndex,
      blockId,
      previousBlockId: v2ContextRef.current?.blockId,
    });

    // Update v2ContextRef with new block info
    if (v2ContextRef.current) {
      v2ContextRef.current.blockId = blockId;
      v2ContextRef.current.currentBlockIndex = blockIndex;
      v2ContextRef.current.difficulty = "easy"; // Reset to easy for new block
    }

    // Clear shown question IDs for fresh block (questions are per-block)
    shownQuestionIdsRef.current = [];

    // Clear the pending flag before async call
    setState((prev) => ({
      ...prev,
      pendingNextBlock: null,
      cumulativeMastery: 0, // Reset UI mastery display
      hardQuestionsAttempted: 0, // Reset UI hard counter
    }));

    // Trigger next question fetch for new block (async, fire-and-forget pattern)
    // Start at easy difficulty for new block
    nextQuestionV2("easy", blockId).catch((error) => {
      console.error("[pendingNextBlock useEffect] Failed to start next block:", error);
      setState((prev) => ({
        ...prev,
        stage: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    });

    debugLog.progression("✅ MULTI-BLOCK: Next block initiated", { blockId });
  }, [state.pendingNextBlock, state.blockJustCompleted, nextQuestionV2]);

  return {
    ...state,
    // V1 methods (real-time generation)
    startSession,
    continueFromConcept,
    submitAnswer,
    continueFromFeedback,
    reset,
    // V2 methods (offline questions)
    checkQuestionsAvailable,
    startSessionV2,
    nextQuestionV2,
    // V2 adaptive difficulty
    getNextAdaptiveDifficulty,
    currentDifficulty,
  };
}

export default useLangGraphWizard;
