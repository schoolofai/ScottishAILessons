"use client";

/**
 * WizardPracticeContainer - Main orchestrator for the practice wizard
 *
 * Manages the wizard flow, renders the appropriate step based on stage,
 * and provides the gamified header with progress and stats.
 */

import React, { useEffect, useCallback, useState } from "react";
import { X, Zap, Flame, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useLangGraphWizard,
  type PracticeSessionContext,
} from "@/hooks/practice/useLangGraphWizard";
import { WizardProgressBar } from "./WizardProgressBar";
import { ConceptStep } from "./steps/ConceptStep";
import { QuestionStep } from "./steps/QuestionStep";
import { FeedbackStep } from "./steps/FeedbackStep";
import { WizardCelebration } from "./celebration/WizardCelebration";
import "@/styles/wizard-fonts.css";

interface WizardPracticeContainerProps {
  practiceContext: PracticeSessionContext;
  lessonTitle: string;
  onExit: () => void;
}

export function WizardPracticeContainer({
  practiceContext,
  lessonTitle,
  onExit,
}: WizardPracticeContainerProps) {
  const wizard = useLangGraphWizard();
  const [hasStarted, setHasStarted] = useState(false);

  // Start session on mount
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      wizard.startSession(practiceContext).catch((error) => {
        console.error("[WizardPracticeContainer] Failed to start session:", error);
      });
    }
  }, [hasStarted, practiceContext, wizard]);

  // Handle continue from concept
  const handleContinueFromConcept = useCallback(
    async (difficultyOverride?: "easy" | "medium" | "hard") => {
      await wizard.continueFromConcept(difficultyOverride);
    },
    [wizard]
  );

  // Handle answer submission
  const handleSubmitAnswer = useCallback(
    async (answer: string | string[], hintsUsed: number) => {
      await wizard.submitAnswer(answer, hintsUsed);
    },
    [wizard]
  );

  // Handle continue from feedback
  const handleContinueFromFeedback = useCallback(async () => {
    await wizard.continueFromFeedback();
  }, [wizard]);

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
            onSubmit={(response) => handleSubmitAnswer(response.answer, response.hints_used)}
            isSubmitting={wizard.isStreaming}
          />
        );

      case "feedback":
        if (!wizard.currentFeedback) return null;
        // Pass backend data directly - NO transformation needed!
        // FeedbackStep uses PracticeFeedback interface from contract
        return (
          <FeedbackStep
            feedbackData={wizard.currentFeedback}
            previousMastery={wizard.currentQuestion?.mastery_score ?? 0}
            currentStreak={wizard.currentStreak}
            onContinue={handleContinueFromFeedback}
            isLoading={wizard.isStreaming}
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
                    setHasStarted(false);
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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Exit & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={onExit}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Exit practice"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-800 line-clamp-1">
                  {lessonTitle}
                </h1>
                <p className="text-sm text-gray-500">Practice Mode</p>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-3">
              {/* Streak */}
              {wizard.currentStreak > 0 && (
                <div className="wizard-streak-badge animate-pop">
                  <Flame className="w-4 h-4" />
                  <span>{wizard.currentStreak}</span>
                </div>
              )}

              {/* XP - tracked by hook from correct answer count */}
              <div className="wizard-xp-badge flex items-center gap-1">
                <Zap className="w-4 h-4" />
                <span>{wizard.totalXP} XP</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {wizard.progress && wizard.stage !== "complete" && (
            <div className="mt-3">
              <WizardProgressBar
                progress={wizard.progress}
                currentStage={wizard.stage}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
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
