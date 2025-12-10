"use client";

/**
 * PracticeChatAssistant - Entry point for infinite practice mode
 *
 * This component loads a lesson template and starts the infinite practice graph
 * which provides adaptive difficulty practice with concept-by-concept progression.
 *
 * FRONTEND-DRIVEN PERSISTENCE:
 * - Checks for existing active session before starting graph
 * - Creates new session when graph signals session_needs_save on first tool call
 * - Updates progress when session_needs_save flag is set in thread state
 *
 * Usage: Navigate to /practice/[lessonTemplateId]
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AssistantRuntimeProvider, useThreadRuntime, useThread } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { useAppwrite, LessonDriver } from "@/lib/appwrite";
import { decompressCards } from "@/lib/appwrite/utils/compression";
import { type PracticeSession } from "@/lib/appwrite/driver/PracticeSessionDriver";
import { SessionProvider } from "@/lib/SessionContext";
import { ReplayModeProvider } from "@/contexts/ReplayModeContext";
import { checkBackendStatus, BackendUnavailableError } from "@/lib/backend-status";
import { BackendErrorUI } from "./BackendErrorUI";
import { BackendCheckingUI } from "./BackendCheckingUI";
import { useSubscription } from "@/hooks/useSubscription";

// Import infinite practice Tool UI components
import { ConceptPresentationTool } from "@/components/tools/ConceptPresentationTool";
import { PracticeQuestionTool } from "@/components/tools/PracticeQuestionTool";
import { PracticeFeedbackTool } from "@/components/tools/PracticeFeedbackTool";
import { PracticeProgressHeader, type PracticeProgressData } from "@/components/practice/PracticeProgressHeader";

// The infinite practice graph assistant ID (registered in langgraph.json)
const INFINITE_PRACTICE_ASSISTANT_ID = "infinite_practice";

/**
 * Context passed to the infinite practice graph
 * FRONTEND-DRIVEN PERSISTENCE: stored_session is passed when resuming
 */
export interface PracticeContext {
  student_id: string;
  source_type: "lesson_template";
  source_data: Record<string, unknown>; // The lesson snapshot/template data
  stored_session?: PracticeSession; // Existing session to resume (if any)
  adaptive_thresholds?: { advance: number; demote: number }; // Optional custom thresholds
}

/**
 * Auto-start trigger for infinite practice graph.
 * Sends an initial empty message to kick off the graph once context is ready.
 * Must be rendered inside AssistantRuntimeProvider.
 */
function PracticeAutoStartTrigger({ practiceContext }: { practiceContext: PracticeContext | undefined }) {
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const threadRuntime = useThreadRuntime();
  const thread = useThread();

  useEffect(() => {
    // Wait for all dependencies to be available
    if (!practiceContext || !threadRuntime || !thread || hasAutoStarted) {
      return;
    }

    const hasExistingMessages = thread.messages && thread.messages.length > 0;

    // If thread already has messages, skip auto-start (resuming existing session)
    if (hasExistingMessages) {
      console.log('✅ [PracticeAutoStartTrigger] Thread has existing messages, skipping auto-start');
      setHasAutoStarted(true);
      return;
    }

    // Mark as started to prevent duplicate triggers
    setHasAutoStarted(true);

    console.log('🚀 [PracticeAutoStartTrigger] Sending initial message to start infinite practice graph');

    // Small delay to ensure runtime is fully initialized
    setTimeout(() => {
      threadRuntime.append({
        role: "user",
        content: [{ type: "text", text: "Start practice" }]
      });
    }, 100);
  }, [practiceContext, hasAutoStarted, threadRuntime, thread, thread?.messages?.length]);

  // This component doesn't render anything - it's just for side effects
  return null;
}

interface PracticeChatAssistantProps {
  lessonTemplateId: string;
  studentId: string;
  onThreadCreated?: (threadId: string) => void;
}

export function PracticeChatAssistant({
  lessonTemplateId,
  studentId,
  onThreadCreated,
}: PracticeChatAssistantProps) {
  const router = useRouter();
  const [practiceContext, setPracticeContext] = useState<PracticeContext | undefined>(undefined);
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);

  // Session persistence state (frontend-driven)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const lastSavedStateRef = useRef<string | null>(null);

  // Progress tracking for persistent header
  const [progressData, setProgressData] = useState<PracticeProgressData | null>(null);
  const [currentBlockTitle, setCurrentBlockTitle] = useState<string | undefined>(undefined);

  // Subscription access check
  const { hasAccess, isLoading: isLoadingSubscription } = useSubscription();

  // Backend availability state
  const [backendStatus, setBackendStatus] = useState<{
    available: boolean;
    checked: boolean;
    error?: BackendUnavailableError;
  }>({ available: false, checked: false });

  const { createDriver } = useAppwrite();

  // Check backend availability (only main backend needed for infinite practice)
  useEffect(() => {
    // Wait for subscription to finish loading before checking access
    if (isLoadingSubscription) {
      console.log('⏳ [PracticeChatAssistant] Waiting for subscription status to load...');
      return;
    }

    console.log('🔍 [PracticeChatAssistant] Checking main backend availability...');

    checkBackendStatus()
      .then((result: { available: boolean; error?: BackendUnavailableError }) => {
        if (!result.available) {
          console.error('❌ [PracticeChatAssistant] Backend unavailable:', result.error);
          setBackendStatus({
            available: false,
            checked: true,
            error: result.error as BackendUnavailableError,
          });
          return;
        }

        if (!hasAccess) {
          console.error('❌ [PracticeChatAssistant] User does not have active subscription');
          setError('Subscription required. Please subscribe to continue.');
          setBackendStatus({ available: false, checked: true });
          return;
        }

        console.log('✅ [PracticeChatAssistant] Backend available');
        setBackendStatus({ available: true, checked: true });
      })
      .catch((err: unknown) => {
        console.error('❌ [PracticeChatAssistant] Error checking backend:', err);
        setBackendStatus({
          available: false,
          checked: true,
          error: err instanceof BackendUnavailableError ? err : new BackendUnavailableError('Unexpected error'),
        });
      });
  }, [hasAccess, isLoadingSubscription]);

  // Load lesson template data AND check for existing active session
  useEffect(() => {
    if (!backendStatus.available) return;

    const loadLessonTemplateAndCheckSession = async () => {
      try {
        console.log('📥 [PracticeChatAssistant] Loading lesson template:', lessonTemplateId);

        const lessonDriver = createDriver(LessonDriver);
        const lessonTemplate = await lessonDriver.getLessonTemplate(lessonTemplateId);

        if (!lessonTemplate) {
          throw new Error("Lesson template not found");
        }

        console.log('✅ [PracticeChatAssistant] Lesson template loaded:', {
          id: lessonTemplate.$id,
          title: lessonTemplate.title,
          cardCount: lessonTemplate.cards?.length || 0,
        });

        setLessonTitle(lessonTemplate.title || "Practice Session");

        // Check for existing active session via API route (FRONTEND-DRIVEN PERSISTENCE)
        let existingSession: PracticeSession | null = null;

        try {
          const checkResponse = await fetch(
            `/api/practice-sessions?status=active&source_id=${lessonTemplateId}&source_type=lesson_template&limit=1`
          );

          if (checkResponse.ok) {
            const data = await checkResponse.json();
            if (data.sessions && data.sessions.length > 0) {
              // Parse JSON-stringified fields back to objects
              const sessionDoc = data.sessions[0];
              existingSession = {
                ...sessionDoc,
                source_metadata: typeof sessionDoc.source_metadata === 'string'
                  ? JSON.parse(sessionDoc.source_metadata) : sessionDoc.source_metadata,
                blocks: typeof sessionDoc.blocks === 'string'
                  ? JSON.parse(sessionDoc.blocks) : sessionDoc.blocks,
                blocks_progress: typeof sessionDoc.blocks_progress === 'string'
                  ? JSON.parse(sessionDoc.blocks_progress) : sessionDoc.blocks_progress,
                current_question: sessionDoc.current_question
                  ? (typeof sessionDoc.current_question === 'string'
                    ? JSON.parse(sessionDoc.current_question) : sessionDoc.current_question)
                  : null,
              };
            }
          }

          if (existingSession) {
            console.log('🔄 [PracticeChatAssistant] Found active session to resume:', {
              sessionId: existingSession.session_id,
              currentBlock: existingSession.current_block_index,
              totalBlocks: existingSession.total_blocks,
              overallMastery: existingSession.overall_mastery,
            });
            setActiveSessionId(existingSession.session_id);
            setIsResuming(true);
          } else {
            console.log('🆕 [PracticeChatAssistant] No active session found, will create new');
          }
        } catch (sessionErr) {
          // Log but don't fail - we can start a new session
          console.warn('⚠️ [PracticeChatAssistant] Error checking for active session:', sessionErr);
        }

        // Decompress cards before sending to backend (stored compressed in Appwrite)
        const decompressedCards = decompressCards(lessonTemplate.cards);
        console.log('📦 [PracticeChatAssistant] Decompressed cards:', decompressedCards.length, 'cards');

        // Build practice context for the infinite practice graph
        const context: PracticeContext = {
          student_id: studentId,
          source_type: "lesson_template",
          source_data: {
            ...lessonTemplate,
            lessonTemplateId: lessonTemplate.$id,
            cards: decompressedCards, // Override with decompressed cards
          },
          // Pass stored_session if resuming (FRONTEND-DRIVEN PERSISTENCE)
          ...(existingSession && { stored_session: existingSession }),
        };

        setPracticeContext(context);
      } catch (err) {
        console.error("❌ [PracticeChatAssistant] Failed to load lesson template:", err);
        setError(err instanceof Error ? err.message : "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    };

    loadLessonTemplateAndCheckSession();
  }, [lessonTemplateId, studentId, backendStatus.available, createDriver]);

  /**
   * Handle session persistence when backend signals changes via session_needs_save flag.
   * This is the core of the frontend-driven persistence pattern.
   * Uses server-side API routes to bypass Appwrite collection permissions.
   *
   * Also extracts progress data for the persistent header display.
   */
  const handleSessionPersistence = useCallback(async (threadState: Record<string, unknown>) => {
    const sessionNeedsSave = threadState.session_needs_save as boolean;
    const practiceSession = threadState.practice_session as PracticeSession | undefined;

    // Extract progress data for persistent header (even if no save needed)
    if (practiceSession) {
      const blocksProgress = practiceSession.blocks_progress || [];
      const newProgressData: PracticeProgressData = {
        session_id: practiceSession.session_id,
        total_blocks: practiceSession.total_blocks,
        completed_blocks: blocksProgress.filter((b: { is_complete?: boolean }) => b.is_complete).length,
        current_block_index: practiceSession.current_block_index,
        overall_mastery: practiceSession.overall_mastery,
        blocks: blocksProgress.map((b: { block_id: string; mastery_score?: number; is_complete?: boolean }) => ({
          block_id: b.block_id,
          mastery_score: b.mastery_score || 0,
          is_complete: b.is_complete || false,
        })),
      };
      setProgressData(newProgressData);

      // Extract current block title from blocks array
      const blocks = practiceSession.blocks || [];
      const currentBlock = blocks[practiceSession.current_block_index];
      if (currentBlock && typeof currentBlock === 'object' && 'title' in currentBlock) {
        setCurrentBlockTitle((currentBlock as { title: string }).title);
      }
    }

    if (!sessionNeedsSave || !practiceSession) {
      return; // No save needed or no session data
    }

    // Create a state hash to avoid duplicate saves
    const stateHash = JSON.stringify({
      session_id: practiceSession.session_id,
      status: practiceSession.status,
      current_block_index: practiceSession.current_block_index,
      total_questions_attempted: practiceSession.total_questions_attempted,
      overall_mastery: practiceSession.overall_mastery,
    });

    if (lastSavedStateRef.current === stateHash) {
      console.log('⏭️ [PracticeChatAssistant] Skipping duplicate save');
      return;
    }

    try {
      if (!activeSessionId) {
        // NEW SESSION: Create via API route (server-side auth)
        console.log('💾 [PracticeChatAssistant] Creating new session via API:', practiceSession.session_id);

        // Prepare session data for API (stringify complex fields)
        const sessionPayload = {
          session_id: practiceSession.session_id,
          student_id: practiceSession.student_id,
          source_type: practiceSession.source_type,
          source_id: practiceSession.source_id,
          source_title: practiceSession.source_title,
          source_metadata: JSON.stringify(practiceSession.source_metadata || {}),
          blocks: JSON.stringify(practiceSession.blocks || []),
          total_blocks: practiceSession.total_blocks,
          status: practiceSession.status,
          current_block_index: practiceSession.current_block_index,
          blocks_progress: JSON.stringify(practiceSession.blocks_progress || []),
          difficulty_mode: practiceSession.difficulty_mode,
          fixed_difficulty: practiceSession.fixed_difficulty,
          adaptive_threshold: practiceSession.adaptive_threshold,
          current_question: practiceSession.current_question ? JSON.stringify(practiceSession.current_question) : null,
          awaiting_response: practiceSession.awaiting_response,
          created_at: practiceSession.created_at,
          updated_at: practiceSession.updated_at,
          last_activity_at: practiceSession.last_activity_at,
          total_time_seconds: practiceSession.total_time_seconds,
          total_questions_attempted: practiceSession.total_questions_attempted,
          total_questions_correct: practiceSession.total_questions_correct,
          overall_mastery: practiceSession.overall_mastery,
        };

        const response = await fetch('/api/practice-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        setActiveSessionId(practiceSession.session_id);
        console.log('✅ [PracticeChatAssistant] New session created successfully via API');
      } else {
        // EXISTING SESSION: Update progress via API route
        console.log('💾 [PracticeChatAssistant] Updating session progress via API:', practiceSession.session_id);

        const progressUpdate = {
          current_block_index: practiceSession.current_block_index,
          blocks_progress: JSON.stringify(practiceSession.blocks_progress || []),
          current_question: practiceSession.current_question ? JSON.stringify(practiceSession.current_question) : null,
          awaiting_response: practiceSession.awaiting_response,
          total_questions_attempted: practiceSession.total_questions_attempted,
          total_questions_correct: practiceSession.total_questions_correct,
          overall_mastery: practiceSession.overall_mastery,
          status: practiceSession.status,
          last_activity_at: practiceSession.last_activity_at,
          total_time_seconds: practiceSession.total_time_seconds,
        };

        const response = await fetch(`/api/practice-sessions/${practiceSession.session_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progressUpdate),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        console.log('✅ [PracticeChatAssistant] Session progress updated successfully via API');
      }

      lastSavedStateRef.current = stateHash;
    } catch (saveErr) {
      console.error('❌ [PracticeChatAssistant] Failed to save session:', saveErr);
      // Don't throw - allow the session to continue even if save fails
    }
  }, [activeSessionId]);

  // LangGraph runtime for infinite practice
  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      // Create thread if needed
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;

        if (onThreadCreated) {
          onThreadCreated(thread_id);
        }
      }

      // Send message to infinite practice graph
      const response = sendMessage({
        threadId: threadIdRef.current,
        messages,
        command,
        sessionContext: practiceContext as Record<string, unknown>, // Practice context goes in session_context
        assistantId: INFINITE_PRACTICE_ASSISTANT_ID, // Use infinite practice graph
      });

      // IMPORTANT: sendMessage returns an async generator, not a Promise that resolves when streaming completes.
      // The backend graph (infinite_practice_graph) takes ~12-15 seconds due to LLM block extraction.
      // We use polling with retries to detect when the session is ready for persistence.

      const pollForSessionPersistence = async () => {
        const POLL_INTERVAL_MS = 3000; // Check every 3 seconds
        const MAX_RETRIES = 12; // 12 * 3 = 36 seconds max (covers ~15s execution + buffer)
        let retryCount = 0;

        const poll = async (): Promise<void> => {
          if (!threadIdRef.current) {
            console.warn('⚠️ [PracticeChatAssistant] No thread ID for polling');
            return;
          }

          retryCount++;
          console.log(`🔍 [PracticeChatAssistant] Polling thread state (attempt ${retryCount}/${MAX_RETRIES})...`);

          try {
            const state = await getThreadState(threadIdRef.current);
            const stateValues = state?.values as Record<string, unknown> | undefined;

            console.log('📊 [PracticeChatAssistant] Thread state received:', {
              hasValues: !!stateValues,
              sessionNeedsSave: stateValues?.session_needs_save,
              hasPracticeSession: !!stateValues?.practice_session,
              attempt: retryCount,
              stateKeys: stateValues ? Object.keys(stateValues) : [],
              fullState: stateValues,  // Temporary debug - remove after fixing
            });

            // Check if session is ready (either flag is set or session exists)
            const sessionReady = stateValues?.session_needs_save === true || !!stateValues?.practice_session;

            if (sessionReady && state?.values) {
              console.log('✅ [PracticeChatAssistant] Session ready for persistence!');
              await handleSessionPersistence(state.values as Record<string, unknown>);
              return; // Success - stop polling
            }

            // Continue polling if not ready and retries remaining
            if (retryCount < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
              return poll(); // Recursive retry
            } else {
              console.warn('⚠️ [PracticeChatAssistant] Max polling retries reached without session ready');
            }
          } catch (stateErr) {
            console.warn(`⚠️ [PracticeChatAssistant] Poll attempt ${retryCount} failed:`, stateErr);

            // Retry on error if retries remaining
            if (retryCount < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
              return poll();
            }
          }
        };

        // Start polling after initial delay (give stream time to start)
        await new Promise(resolve => setTimeout(resolve, 2000));
        await poll();
      };

      // Trigger polling for session persistence
      pollForSessionPersistence();

      return response;
    },
    onSwitchToNewThread: async () => {
      const { thread_id } = await createThread();
      threadIdRef.current = thread_id;

      if (onThreadCreated) {
        onThreadCreated(thread_id);
      }
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;

      // Check for session persistence on thread switch
      if (state?.values) {
        await handleSessionPersistence(state.values as Record<string, unknown>);
      }

      return {
        messages: state.values.messages,
        interrupts: state.tasks?.[0]?.interrupts,
      };
    },
  });

  // Backend checking UI
  if (!backendStatus.checked) {
    return <BackendCheckingUI message="Connecting to practice server..." />;
  }

  // Backend error UI
  if (!backendStatus.available && backendStatus.error) {
    return <BackendErrorUI error={backendStatus.error} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">Loading practice session...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <ReplayModeProvider isReplayMode={false}>
      <SessionProvider isSessionMode={true}>
        <div className="flex flex-col h-full">
          {/* Practice Header */}
          <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">
                  Infinite Practice
                  {isResuming && (
                    <span className="ml-2 text-sm font-normal text-purple-200">
                      (Resuming)
                    </span>
                  )}
                </h1>
                <p className="text-purple-100 text-sm">{lessonTitle}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  Adaptive Difficulty
                </span>
                {activeSessionId && (
                  <span className="bg-green-500/30 px-3 py-1 rounded-full text-sm text-green-100">
                    Session Saved
                  </span>
                )}
                <button
                  onClick={() => router.back()}
                  className="text-white/80 hover:text-white text-sm"
                >
                  Exit Practice
                </button>
              </div>
            </div>
          </header>

          {/* Persistent Progress Header - shows block progress at top of chat */}
          <PracticeProgressHeader
            progress={progressData}
            currentBlockTitle={currentBlockTitle}
          />

          {/* Practice Chat Area */}
          <div className="flex-1 min-h-0">
            <AssistantRuntimeProvider runtime={runtime}>
              {/* Auto-start trigger - sends initial message to kick off the graph */}
              <PracticeAutoStartTrigger practiceContext={practiceContext} />

              <Thread />

              {/* Infinite Practice Tool UI components */}
              <ConceptPresentationTool />
              <PracticeQuestionTool />
              <PracticeFeedbackTool />
            </AssistantRuntimeProvider>
          </div>
        </div>
      </SessionProvider>
    </ReplayModeProvider>
  );
}
