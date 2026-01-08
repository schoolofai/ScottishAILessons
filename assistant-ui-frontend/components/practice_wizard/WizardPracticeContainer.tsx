"use client";

/**
 * WizardPracticeContainer - Main orchestrator for the practice wizard
 *
 * Manages the wizard flow, renders the appropriate step based on stage,
 * and provides the gamified header with progress and stats.
 */

import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useLangGraphWizard,
  type PracticeSessionContext,
  type QuestionAvailability,
} from "@/hooks/practice/useLangGraphWizard";
import { extractResumePosition } from "@/lib/utils/extractResumePosition";
import { useBlockContent } from "@/hooks/practice/useBlockContent";
import { ProgressHeader, JourneyTimeline, type CompletedBlockDetails } from "./progress";
import { BlockReferencePanel } from "./BlockReferencePanel";
import { ConceptStep } from "./steps/ConceptStep";
import { QuestionStep } from "./steps/QuestionStep";
import { FeedbackStep } from "./steps/FeedbackStep";
import { WizardCelebration } from "./celebration/WizardCelebration";
import { ResetConfirmationModal } from "./ResetConfirmationModal";
import "@/styles/wizard-fonts.css";

interface WizardPracticeContainerProps {
  practiceContext: PracticeSessionContext;
  lessonTitle: string;
  onExit: () => void;
  /** Use V2 mode with pre-generated offline questions */
  useV2Mode?: boolean;
  /** Question availability info for gray-out logic */
  questionAvailability?: QuestionAvailability | null;
  /** Handler for resetting the entire session */
  onResetSession?: () => Promise<void>;
}

// Reference panel resize constraints (Phase 7)
const MIN_PANEL_WIDTH = 280;
const DEFAULT_PANEL_WIDTH = 380;

export function WizardPracticeContainer({
  practiceContext,
  lessonTitle,
  onExit,
  useV2Mode = false,
  questionAvailability,
  onResetSession,
}: WizardPracticeContainerProps) {
  const wizard = useLangGraphWizard();

  // CRITICAL: Use useRef instead of useState to prevent React StrictMode double-start bug
  // StrictMode remounts components, resetting useState to initial value, but useRef persists
  const hasStartedRef = useRef(false);
  // Retry counter to force effect re-run when user clicks "Try Again"
  const [retryCount, setRetryCount] = useState(0);
  const [isReferencePanelOpen, setIsReferencePanelOpen] = useState(true);
  // Reset session modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Panel width state for drag-to-resize (Phase 7)
  const [referencePanelWidth, setReferencePanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  // Dynamic max width: 40% of viewport width
  const [maxPanelWidth, setMaxPanelWidth] = useState(600);

  // Calculate max panel width as 40% of viewport
  useEffect(() => {
    const calculateMaxWidth = () => {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const calculatedMax = Math.floor(viewportWidth * 0.4);
      // Ensure minimum sensible max (at least 400px)
      setMaxPanelWidth(Math.max(400, calculatedMax));
    };

    calculateMaxWidth();
    window.addEventListener('resize', calculateMaxWidth);
    return () => window.removeEventListener('resize', calculateMaxWidth);
  }, []);

  // Block content hook for reference panel (V2 mode only)
  // Destructure to get stable callback references for useEffect dependencies
  const {
    currentContent: blockCurrentContent,
    upcomingContent: blockUpcomingContent,
    isLoading: blockIsLoading,
    error: blockError,
    setCurrentBlock,
    prefetchUpcoming,
    // Navigation state (Phase 6)
    allBlocks: navAllBlocks,
    viewingIndex: navViewingIndex,
    setViewingIndex: navSetViewingIndex,
    loadAllBlocks: navLoadAllBlocks,
    navigateToBlock: navNavigateToBlock,
    canGoBack: navCanGoBack,
    canGoForward: navCanGoForward,
  } = useBlockContent();

  // Create a map of block_id -> title for the JourneyTimeline
  const blockTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const block of navAllBlocks) {
      titles[block.blockId] = block.title;
    }
    return titles;
  }, [navAllBlocks]);

  // Type for detailed block progress from stored session
  interface StoredBlockProgress {
    block_id: string;
    mastery_score?: number;
    is_complete?: boolean;
    current_difficulty?: "easy" | "medium" | "hard";
    questions_attempted?: { easy: number; medium: number; hard: number };
    questions_correct?: { easy: number; medium: number; hard: number };
  }

  // Track previously completed block IDs to detect new completions
  // (used to avoid duplicate processing)
  const previouslyCompletedRef = useRef<Set<string>>(new Set());

  // Track blocks that complete during THIS session with their stats
  // This captures stats in real-time so collapsible shows full data even for fresh sessions
  const [sessionCompletedBlocks, setSessionCompletedBlocks] = useState<
    Record<string, CompletedBlockDetails>
  >({});

  // Initialize previouslyCompletedRef with blocks already complete from stored session
  // This prevents re-capturing them as "newly completed" during the session
  useEffect(() => {
    const storedBlocks = (practiceContext.stored_session as {
      blocks_progress?: StoredBlockProgress[];
    })?.blocks_progress;

    if (storedBlocks) {
      for (const block of storedBlocks) {
        if (block.is_complete) {
          previouslyCompletedRef.current.add(block.block_id);
        }
      }
    }
  }, [practiceContext.stored_session]);

  // Capture the completion stats BEFORE the wizard resets them for the next block
  // We need to track the stats at the moment of completion
  const lastBlockStatsRef = useRef<{
    blockId: string;
    mastery: number;
    questionsAnswered: number;
    questionsCorrect: number;
    hardQuestionsAttempted: number;
    difficulty: "easy" | "medium" | "hard";
  } | null>(null);

  // Continuously track current block stats so we have them when completion triggers
  useEffect(() => {
    const currentBlockId = wizard.currentQuestion?.block_id;
    if (currentBlockId) {
      lastBlockStatsRef.current = {
        blockId: currentBlockId,
        mastery: wizard.cumulativeMastery,
        questionsAnswered: wizard.currentBlockQuestionsAnswered,
        questionsCorrect: wizard.currentBlockQuestionsCorrect,
        hardQuestionsAttempted: wizard.hardQuestionsAttempted,
        difficulty: wizard.currentDifficulty,
      };
    }
  }, [
    wizard.currentQuestion?.block_id,
    wizard.cumulativeMastery,
    wizard.currentBlockQuestionsAnswered,
    wizard.currentBlockQuestionsCorrect,
    wizard.hardQuestionsAttempted,
    wizard.currentDifficulty,
  ]);

  // Track blocks that complete during the session and capture their stats
  useEffect(() => {
    if (!wizard.progress?.blocks) return;

    const currentBlockId = wizard.currentQuestion?.block_id;

    for (const block of wizard.progress.blocks) {
      if (
        block.is_complete &&
        !previouslyCompletedRef.current.has(block.block_id) &&
        currentBlockId !== block.block_id // Don't capture current block (still in progress)
      ) {
        // This block just completed - mark it so we don't process it again
        previouslyCompletedRef.current.add(block.block_id);

        // Capture completion stats from lastBlockStatsRef if it matches
        // Note: After block completes, wizard moves to next block, so we use cached stats
        if (lastBlockStatsRef.current?.blockId === block.block_id) {
          const stats = lastBlockStatsRef.current;
          setSessionCompletedBlocks((prev) => ({
            ...prev,
            [block.block_id]: {
              mastery: stats.mastery,
              totalQuestionsAnswered: stats.questionsAnswered,
              totalQuestionsCorrect: stats.questionsCorrect,
              hardQuestionsAttempted: stats.hardQuestionsAttempted,
              finalDifficulty: stats.difficulty,
            },
          }));
        } else {
          // Fallback: Use block's mastery from progress if we missed the stats capture
          // This can happen if the block completes but we didn't track stats (edge case)
          setSessionCompletedBlocks((prev) => ({
            ...prev,
            [block.block_id]: {
              mastery: block.mastery_score ?? 0,
              // We don't have question counts, MasteryBreakdown will show 0s
              // This is better than showing nothing (fallback)
              totalQuestionsAnswered: 0,
              totalQuestionsCorrect: 0,
              hardQuestionsAttempted: 2, // Block complete means ≥2 hard attempted
              finalDifficulty: undefined,
            },
          }));
        }
      }
    }
  }, [wizard.progress?.blocks, wizard.currentQuestion?.block_id]);

  // Merge completed block details from THREE sources (priority order):
  // 1. wizard.completedBlockCounts: Per-difficulty counts captured BEFORE ref reset (most accurate)
  // 2. sessionCompletedBlocks: Totals captured during session (legacy fallback)
  // 3. stored_session: Per-difficulty breakdown from persistence (for resumed sessions)
  const completedBlocksDetails = useMemo(() => {
    const details: Record<string, CompletedBlockDetails> = {};

    // First, populate from stored_session (for resumed sessions)
    const storedBlocks = (practiceContext.stored_session as {
      blocks_progress?: StoredBlockProgress[];
    })?.blocks_progress;

    if (storedBlocks) {
      for (const block of storedBlocks) {
        // Only include completed blocks with actual question data
        if (block.is_complete && block.questions_attempted && block.questions_correct) {
          details[block.block_id] = {
            mastery: block.mastery_score ?? 0,
            questionsAttempted: block.questions_attempted,
            questionsCorrect: block.questions_correct,
            finalDifficulty: block.current_difficulty,
          };
        }
      }
    }

    // Then, merge/override with session-captured data (legacy mechanism)
    for (const [blockId, sessionData] of Object.entries(sessionCompletedBlocks)) {
      details[blockId] = sessionData;
    }

    // Finally, merge/override with wizard's completedBlockCounts (most accurate source)
    // This data is captured BEFORE refs are reset, ensuring accurate counts
    if (wizard.completedBlockCounts) {
      for (const [blockId, counts] of Object.entries(wizard.completedBlockCounts)) {
        // Find the block's mastery from progress
        const blockMastery = wizard.progress?.blocks?.find(b => b.block_id === blockId)?.mastery_score ?? 0;
        details[blockId] = {
          mastery: blockMastery,
          questionsAttempted: counts.attempted,
          questionsCorrect: counts.correct,
          // Calculate totals from per-difficulty
          totalQuestionsAnswered: counts.attempted.easy + counts.attempted.medium + counts.attempted.hard,
          totalQuestionsCorrect: counts.correct.easy + counts.correct.medium + counts.correct.hard,
          hardQuestionsAttempted: counts.attempted.hard,
          finalDifficulty: "hard", // Block completed means reached hard
        };
      }
    }

    return details;
  }, [practiceContext.stored_session, sessionCompletedBlocks, wizard.completedBlockCounts, wizard.progress?.blocks]);

  // Start session on mount - V2 mode uses pre-generated questions, V1 uses real-time generation
  // CRITICAL: Using useRef for hasStarted to prevent React StrictMode double-start bug
  // StrictMode remounts components in dev mode, but refs persist across mount/unmount cycles
  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    if (useV2Mode && questionAvailability?.hasQuestions) {
      // V2 mode: Use pre-generated offline questions (faster)
      // ═══════════════════════════════════════════════════════════════
      // RESUME LOGIC: Extract starting position from stored session
      // Uses extractResumePosition utility (TDD-validated)
      // ═══════════════════════════════════════════════════════════════
      const resumePosition = extractResumePosition(
        practiceContext.stored_session as Parameters<typeof extractResumePosition>[0],
        questionAvailability
      );

      // Extract blocks_progress from stored session for progress restoration
      // Type assertion needed because PracticeSessionContext doesn't fully type stored_session
      const storedBlocksProgress = (practiceContext.stored_session as { blocks_progress?: Array<{ block_id: string; mastery_score?: number; is_complete?: boolean }> })?.blocks_progress;

      wizard.startSessionV2(
        practiceContext.lesson_template_id,
        resumePosition.blockId,      // Use resume position instead of always first block
        resumePosition.difficulty,   // Use resume difficulty instead of always "easy"
        practiceContext.student_id,
        undefined, // sessionToken - not available in practiceContext
        undefined, // courseId - could extract from lesson_snapshot if needed
        practiceContext.session_id, // sessionId for resume support
        questionAvailability, // CRITICAL: Pass all blocks for multi-block progression!
        storedBlocksProgress  // Pass stored blocks progress for resume (TDD-validated)
      ).catch((error) => {
        console.error("[WizardPracticeContainer] Failed to start V2 session:", error);
      });
    } else {
      // V1 mode: Real-time question generation (legacy)
      wizard.startSession(practiceContext).catch((error) => {
        console.error("[WizardPracticeContainer] Failed to start V1 session:", error);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceContext, wizard, useV2Mode, questionAvailability, retryCount]);

  // Load current block content when question changes (V2 mode only)
  // NOTE: Only include setCurrentBlock (stable callback) in deps, NOT the entire hook return
  useEffect(() => {
    if (useV2Mode && wizard.currentQuestion?.block_id) {
      setCurrentBlock(
        practiceContext.lesson_template_id,
        wizard.currentQuestion.block_id
      );
    }
  }, [useV2Mode, wizard.currentQuestion?.block_id, practiceContext.lesson_template_id, setCurrentBlock]);

  // Prefetch upcoming blocks (V2 mode only)
  // NOTE: Only include prefetchUpcoming (stable callback) in deps, NOT the entire hook return
  useEffect(() => {
    if (useV2Mode && wizard.progress && wizard.currentQuestion) {
      // Get IDs of upcoming incomplete blocks (not current block)
      const upcomingIds = wizard.progress.blocks
        .filter(b => b.block_id !== wizard.currentQuestion?.block_id)
        .filter(b => !b.is_complete)
        .slice(0, 2) // Only prefetch next 2
        .map(b => b.block_id);

      if (upcomingIds.length > 0) {
        prefetchUpcoming(practiceContext.lesson_template_id, upcomingIds);
      }
    }
  }, [useV2Mode, wizard.progress, wizard.currentQuestion, practiceContext.lesson_template_id, prefetchUpcoming]);

  // Load all blocks for navigation (V2 mode only) - Phase 6
  // NOTE: Only include navLoadAllBlocks (stable callback) in deps
  useEffect(() => {
    if (useV2Mode && practiceContext.lesson_template_id) {
      navLoadAllBlocks(practiceContext.lesson_template_id).catch((error) => {
        console.error("[WizardPracticeContainer] Failed to load blocks list:", error);
      });
    }
  }, [useV2Mode, practiceContext.lesson_template_id, navLoadAllBlocks]);

  // Sync viewing index with current question's block ONLY when question changes (V2 mode only) - Phase 6
  // NOTE: Intentionally NOT including navViewingIndex in deps - we only want to sync
  // when the question changes, not override user navigation between blocks
  useEffect(() => {
    if (useV2Mode && wizard.currentQuestion?.block_id && navAllBlocks.length > 0) {
      const idx = navAllBlocks.findIndex(
        b => b.blockId === wizard.currentQuestion?.block_id
      );
      if (idx >= 0) {
        navSetViewingIndex(idx);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useV2Mode, wizard.currentQuestion?.block_id, navAllBlocks, navSetViewingIndex]);

  // Handle continue from concept
  const handleContinueFromConcept = useCallback(
    async (difficultyOverride?: "easy" | "medium" | "hard") => {
      await wizard.continueFromConcept(difficultyOverride);
    },
    [wizard]
  );

  // Handle answer submission (including drawing data for structured response)
  const handleSubmitAnswer = useCallback(
    async (
      answer: string | string[],
      hintsUsed: number,
      drawingDataUrl?: string,
      drawingSceneData?: unknown
    ) => {
      await wizard.submitAnswer(answer, hintsUsed, drawingDataUrl, drawingSceneData);
    },
    [wizard]
  );

  // Handle continue from feedback - V2 mode fetches next offline question with adaptive difficulty
  // BUG FIX: Guard against fetching more questions when session is complete
  // Race condition: User clicks "Continue" before React re-renders with stage="complete"
  const handleContinueFromFeedback = useCallback(async () => {
    // Guard: Don't fetch more questions if session is already complete
    if (wizard.stage === "complete") {
      console.log("[handleContinueFromFeedback] Session already complete, skipping question fetch");
      return;
    }

    // Guard: Block just completed AND no more blocks → session is complete
    // This catches the race condition where blockJustCompleted is true but stage hasn't updated yet
    if (wizard.blockJustCompleted && !wizard.pendingNextBlock) {
      console.log("[handleContinueFromFeedback] Block just completed with no more blocks, skipping question fetch");
      return;
    }

    if (useV2Mode && wizard.isV2Mode) {
      // V2: Calculate adaptive difficulty and fetch next pre-generated question
      const nextDifficulty = wizard.getNextAdaptiveDifficulty();
      await wizard.nextQuestionV2(nextDifficulty);
    } else {
      // V1: Let backend generate next question
      await wizard.continueFromFeedback();
    }
  }, [wizard, useV2Mode]);

  // Handle reset confirmation
  const handleConfirmReset = useCallback(async () => {
    if (!onResetSession) return;

    setIsResetting(true);
    try {
      await onResetSession();
      // Parent will handle the state reset and reload
    } catch (error) {
      console.error("[WizardPracticeContainer] Reset failed:", error);
      // Keep modal open on error so user can try again or cancel
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  }, [onResetSession]);

  // Render current step
  const renderStep = () => {
    switch (wizard.stage) {
      case "loading":
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 animate-pulse" />
                <Loader2 className="absolute inset-0 w-16 h-16 text-white animate-spin p-4" />
              </div>
              <p className="text-gray-600 font-medium">Getting things ready...</p>
            </div>
          </div>
        );

      case "concept":
        if (!wizard.currentBlock) return null;
        return (
          <ConceptStep
            data={wizard.currentBlock}
            onContinue={handleContinueFromConcept}
            isStreaming={wizard.isStreaming}
          />
        );

      case "question":
        if (!wizard.currentQuestion) return null;
        // Pass backend data directly - NO transformation needed!
        // QuestionStep uses PracticeQuestion interface from contract
        return (
          <QuestionStep
            question={wizard.currentQuestion}
            onSubmit={(response) =>
              handleSubmitAnswer(
                response.answer,
                response.hints_used,
                response.drawing_data_url,
                response.drawing_scene_data
              )
            }
            isSubmitting={wizard.isStreaming}
          />
        );

      case "feedback":
        if (!wizard.currentFeedback) return null;
        // Pass backend data directly - NO transformation needed!
        // FeedbackStep uses PracticeFeedback interface from contract
        // BUG FIX: Use wizard.previousMastery (pre-update value) NOT wizard.cumulativeMastery
        // FeedbackStep computes: previousMastery + delta = newMastery
        // Using cumulativeMastery would double-count the delta!
        return (
          <FeedbackStep
            feedbackData={wizard.currentFeedback}
            previousMastery={wizard.previousMastery ?? 0}
            currentStreak={wizard.currentStreak}
            onContinue={handleContinueFromFeedback}
            isLoading={wizard.isStreaming}
            // V2 Multi-Block Progression Props
            blockJustCompleted={wizard.blockJustCompleted}
            currentBlockIndex={wizard.progress?.current_block_index ?? 0}
            totalBlocks={wizard.progress?.total_blocks ?? 1}
          />
        );

      case "complete":
        // Build stats object for celebration screen
        const sessionStats = {
          total_questions: wizard.questionsAnswered,
          correct_answers: wizard.questionsCorrect,
          total_xp_earned: wizard.totalXP,
          blocks_completed: wizard.progress?.completed_blocks || 0,
          total_blocks: wizard.progress?.total_blocks || 1,
          final_mastery: wizard.progress?.overall_mastery || 0,
          longest_streak: wizard.currentStreak,
        };
        return (
          <WizardCelebration
            stats={sessionStats}
            lessonTitle={lessonTitle}
          />
        );

      case "error":
        return (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                Something Went Wrong
              </h2>
              <p className="text-gray-600 mb-6">
                {wizard.error?.message || "An unexpected error occurred."}
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => {
                    wizard.reset();
                    hasStartedRef.current = false;
                    // Increment retryCount to trigger useEffect re-run
                    setRetryCount((c) => c + 1);
                  }}
                  className="wizard-btn wizard-btn-primary"
                >
                  Try Again
                </Button>
                <Button onClick={onExit} variant="outline">
                  Exit
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="wizard-page min-h-dvh flex flex-col bg-gradient-to-br from-slate-50 via-cyan-50/30 to-emerald-50/30">
      {/* Block Reference Panel (Right) - V2 mode only */}
      {useV2Mode && (
        <BlockReferencePanel
          isOpen={isReferencePanelOpen}
          onToggle={() => setIsReferencePanelOpen(!isReferencePanelOpen)}
          currentContent={blockCurrentContent}
          upcomingContent={blockUpcomingContent}
          isLoading={blockIsLoading}
          error={blockError}
          blockProgress={wizard.progress?.blocks}
          currentBlockId={wizard.currentQuestion?.block_id}
          onBlockSelect={(blockId) => {
            setCurrentBlock(practiceContext.lesson_template_id, blockId);
          }}
          // Navigation props (Phase 6)
          allBlocks={navAllBlocks}
          viewingIndex={navViewingIndex}
          canGoBack={navCanGoBack}
          canGoForward={navCanGoForward}
          onNavigateBack={() => {
            if (navCanGoBack && navViewingIndex > 0) {
              navNavigateToBlock(practiceContext.lesson_template_id, navViewingIndex - 1).catch((error) => {
                console.error("[WizardPracticeContainer] Failed to navigate back:", error);
              });
            }
          }}
          onNavigateForward={() => {
            if (navCanGoForward && navViewingIndex < navAllBlocks.length - 1) {
              navNavigateToBlock(practiceContext.lesson_template_id, navViewingIndex + 1).catch((error) => {
                console.error("[WizardPracticeContainer] Failed to navigate forward:", error);
              });
            }
          }}
          // Resize props (Phase 7)
          width={referencePanelWidth}
          onWidthChange={setReferencePanelWidth}
          minWidth={MIN_PANEL_WIDTH}
          maxWidth={maxPanelWidth}
        />
      )}

      {/* NEW: Enhanced Progress Header */}
      <ProgressHeader
        progress={wizard.progress}
        currentBlock={wizard.currentBlock}
        currentQuestion={wizard.currentQuestion}
        totalXP={wizard.totalXP}
        currentStreak={wizard.currentStreak}
        lessonTitle={lessonTitle}
        onExit={onExit}
        onToggleReference={() => setIsReferencePanelOpen(!isReferencePanelOpen)}
        isReferencePanelOpen={isReferencePanelOpen}
        onReset={onResetSession ? () => setShowResetModal(true) : undefined}
        useV2Mode={useV2Mode && wizard.stage !== "complete"}
      />

      {/* NEW: Flex layout with Journey Timeline */}
      <div className="flex-1 flex">
        {/* Journey Timeline - always visible on desktop (except on complete) */}
        {wizard.progress && wizard.stage !== "complete" && (
          <JourneyTimeline
            progress={wizard.progress}
            currentBlock={wizard.currentBlock}
            cumulativeMastery={wizard.cumulativeMastery}
            hardQuestionsAttempted={wizard.hardQuestionsAttempted}
            questionsAnswered={wizard.currentBlockQuestionsAnswered}
            questionsCorrect={wizard.currentBlockQuestionsCorrect}
            currentDifficulty={wizard.currentDifficulty}
            blockTitles={blockTitles}
            completedBlocksDetails={completedBlocksDetails}
          />
        )}

        {/* Main Content - Adjusts for reference panel */}
        <main
          className="flex-1 flex flex-col transition-all duration-300"
          style={{
            // Add padding-right when reference panel is open to avoid overlap
            paddingRight: useV2Mode && isReferencePanelOpen ? referencePanelWidth : 0,
          }}
        >
          <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
            {renderStep()}
          </div>
        </main>
      </div>

      {/* Accessibility: Announce stage changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {wizard.stage === "concept" && "Concept presentation loaded"}
        {wizard.stage === "question" && "Question loaded"}
        {wizard.stage === "feedback" && "Feedback received"}
        {wizard.stage === "complete" && "Practice session complete"}
      </div>

      {/* Reset confirmation modal */}
      <ResetConfirmationModal
        open={showResetModal}
        onOpenChange={setShowResetModal}
        onConfirm={handleConfirmReset}
        isResetting={isResetting}
      />
    </div>
  );
}

export default WizardPracticeContainer;
