"use client";

/**
 * WizardPracticeContainer - Main orchestrator for the practice wizard
 *
 * Manages the wizard flow, renders the appropriate step based on stage,
 * and provides the gamified header with progress and stats.
 */

import React, { useEffect, useCallback, useState, useRef } from "react";
import { X, Zap, Flame, Loader2, AlertCircle, Menu, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useLangGraphWizard,
  type PracticeSessionContext,
  type QuestionAvailability,
} from "@/hooks/practice/useLangGraphWizard";
import { extractResumePosition } from "@/lib/utils/extractResumePosition";
import { useBlockContent } from "@/hooks/practice/useBlockContent";
import { WizardProgressBar } from "./WizardProgressBar";
import { WizardSidePanel } from "./WizardSidePanel";
import { BlockReferencePanel } from "./BlockReferencePanel";
import { ConceptStep } from "./steps/ConceptStep";
import { QuestionStep } from "./steps/QuestionStep";
import { FeedbackStep } from "./steps/FeedbackStep";
import { WizardCelebration } from "./celebration/WizardCelebration";
import "@/styles/wizard-fonts.css";

interface WizardPracticeContainerProps {
  practiceContext: PracticeSessionContext;
  lessonTitle: string;
  onExit: () => void;
  /** Use V2 mode with pre-generated offline questions */
  useV2Mode?: boolean;
  /** Question availability info for gray-out logic */
  questionAvailability?: QuestionAvailability | null;
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
}: WizardPracticeContainerProps) {
  const wizard = useLangGraphWizard();

  // CRITICAL: Use useRef instead of useState to prevent React StrictMode double-start bug
  // StrictMode remounts components, resetting useState to initial value, but useRef persists
  const hasStartedRef = useRef(false);
  // Retry counter to force effect re-run when user clicks "Try Again"
  const [retryCount, setRetryCount] = useState(0);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isReferencePanelOpen, setIsReferencePanelOpen] = useState(true);

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
        // BUG FIX: Use wizard.cumulativeMastery (newly exposed) NOT wizard.currentQuestion?.mastery_score
        // (PracticeQuestion doesn't have mastery_score field - it was always reading undefined!)
        return (
          <FeedbackStep
            feedbackData={wizard.currentFeedback}
            previousMastery={wizard.cumulativeMastery ?? 0}
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
      {/* Side Panel (Left) */}
      <WizardSidePanel
        isOpen={isSidePanelOpen}
        onToggle={() => setIsSidePanelOpen(!isSidePanelOpen)}
        progress={wizard.progress}
        currentBlock={wizard.currentBlock}
      />

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

      {/* Compact Header - Single Line (adjusts with panel - Phase 7) */}
      <header
        className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200/50 transition-all duration-300"
        style={{
          // Adjust padding-right when reference panel is open to align with main content
          paddingRight: useV2Mode && isReferencePanelOpen ? referencePanelWidth : 0,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: Menu, Exit & Title */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Menu toggle for side panel */}
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5 text-gray-500" />
            </button>

            {/* Exit button */}
            <button
              onClick={onExit}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Exit practice"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            {/* Title - truncated */}
            <h1 className="text-sm font-semibold text-gray-800 truncate max-w-[180px] sm:max-w-xs">
              {lessonTitle}
            </h1>
          </div>

          {/* Center: Progress (inline) */}
          {wizard.progress && wizard.stage !== "complete" && (
            <div className="hidden sm:flex items-center">
              <WizardProgressBar
                progress={wizard.progress}
                currentStage={wizard.stage}
              />
            </div>
          )}

          {/* Right: Stats + Reference toggle */}
          <div className="flex items-center gap-2">
            {/* Streak */}
            {wizard.currentStreak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-semibold">
                <Flame className="w-3.5 h-3.5" />
                <span>{wizard.currentStreak}</span>
              </div>
            )}

            {/* XP */}
            <div className="flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>{wizard.totalXP}</span>
            </div>

            {/* Reference panel toggle - V2 mode only */}
            {useV2Mode && wizard.stage !== "complete" && (
              <button
                onClick={() => setIsReferencePanelOpen(!isReferencePanelOpen)}
                className={`p-2 rounded-lg transition-colors ${
                  isReferencePanelOpen
                    ? "bg-cyan-100 text-cyan-600"
                    : "hover:bg-cyan-50 text-gray-400 hover:text-cyan-600"
                }`}
                aria-label="Toggle reference panel"
                title="View block explanation and examples"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile progress - below header on small screens */}
        {wizard.progress && wizard.stage !== "complete" && (
          <div className="sm:hidden px-4 pb-2">
            <WizardProgressBar
              progress={wizard.progress}
              currentStage={wizard.stage}
            />
          </div>
        )}
      </header>

      {/* Main Content - Adjusts when reference panel is open (Phase 7) */}
      <main
        className="flex-1 flex flex-col transition-all duration-300"
        style={{
          // Add padding-right when reference panel is open to avoid overlap
          paddingRight: useV2Mode && isReferencePanelOpen ? referencePanelWidth : 0,
        }}
      >
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
          {renderStep()}
        </div>
      </main>

      {/* Accessibility: Announce stage changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {wizard.stage === "concept" && "Concept presentation loaded"}
        {wizard.stage === "question" && "Question loaded"}
        {wizard.stage === "feedback" && "Feedback received"}
        {wizard.stage === "complete" && "Practice session complete"}
      </div>
    </div>
  );
}

export default WizardPracticeContainer;
