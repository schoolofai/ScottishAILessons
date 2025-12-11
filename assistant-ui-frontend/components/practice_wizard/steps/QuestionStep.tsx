"use client";

/**
 * QuestionStep - Question presentation and answer collection
 *
 * Renders the question stem, CFU input, hints, and submit button.
 * Supports all CFU types with math rendering and diagram display.
 *
 * IMPORTANT: This component uses PracticeQuestion directly from the
 * backend contract. No transformation needed.
 * See: @/types/practice-wizard-contracts.ts
 */

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathRenderer } from "../shared/MathRenderer";
import { HintPanel } from "../shared/HintPanel";
import { CFURenderer } from "../cfu/CFURenderer";

// Import the exact type from backend contract
import type { PracticeQuestion } from "@/types/practice-wizard-contracts";

interface QuestionStepProps {
  /** Question data directly from backend - no transformation needed */
  question: PracticeQuestion;
  onSubmit: (response: QuestionResponse) => void;
  isSubmitting?: boolean;
}

export interface QuestionResponse {
  answer: string | string[];
  hints_used: number;
  drawing_data_url?: string;
  drawing_scene_data?: unknown;
}

export function QuestionStep({
  question,
  onSubmit,
  isSubmitting = false,
}: QuestionStepProps) {
  // Backend doesn't send selectCount, but multi-select MCQ might be added later
  // For now, assume single select for MCQ
  const selectCount = 1;

  const [answer, setAnswer] = useState<string | string[]>(
    question.question_type === "mcq" && selectCount > 1 ? [] : ""
  );
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | undefined>();
  const [drawingSceneData, setDrawingSceneData] = useState<unknown | undefined>();

  const hints = question.hints || [];
  const hasHints = hints.length > 0;
  const isMultiSelect = question.question_type === "mcq" && selectCount > 1;

  // Check if answer is complete enough to submit
  const canSubmit = useCallback(() => {
    if (isSubmitting) return false;

    if (isMultiSelect) {
      const selectedCount = (answer as string[]).length;
      return selectedCount === selectCount;
    }

    if (question.question_type === "mcq") {
      return typeof answer === "string" && answer.length > 0;
    }

    if (question.question_type === "numeric") {
      return typeof answer === "string" && answer.length > 0;
    }

    if (question.question_type === "structured_response") {
      // For structured response, either text or drawing is acceptable
      return (
        (typeof answer === "string" && answer.trim().length > 0) ||
        !!drawingDataUrl
      );
    }

    return false;
  }, [answer, isMultiSelect, question.question_type, isSubmitting, drawingDataUrl, selectCount]);

  const handleRevealHint = useCallback(() => {
    if (hintsRevealed < hints.length) {
      setHintsRevealed((prev) => prev + 1);
    }
  }, [hintsRevealed, hints.length]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit()) return;

    onSubmit({
      answer,
      hints_used: hintsRevealed,
      drawing_data_url: drawingDataUrl,
      drawing_scene_data: drawingSceneData,
    });
  }, [answer, hintsRevealed, drawingDataUrl, drawingSceneData, onSubmit, canSubmit]);

  // Handle drawing save from StructuredResponseEditor
  const handleDrawingSave = useCallback((dataUrl: string, sceneData?: unknown) => {
    setDrawingDataUrl(dataUrl);
    if (sceneData) {
      setDrawingSceneData(sceneData);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Question Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {question.block_title && (
            <span className="text-sm font-medium text-gray-500">
              {question.block_title}
            </span>
          )}
        </div>
        {/* Show difficulty and progress info from backend */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
            {question.difficulty}
          </span>
          <span className="text-sm text-gray-500">
            {question.correct_at_difficulty}/{question.questions_at_difficulty + 1} correct
          </span>
        </div>
      </div>

      {/* Question Stem Card */}
      <div className="wizard-card p-6">
        <MathRenderer
          content={question.stem}
          className="text-lg text-gray-800 leading-relaxed"
        />
      </div>

      {/* CFU Answer Input - using backend field names directly */}
      <div className="wizard-card p-6">
        <CFURenderer
          questionType={question.question_type}
          options={question.options}
          selectCount={selectCount}
          value={answer}
          onChange={setAnswer}
          disabled={isSubmitting}
          onDrawingSave={handleDrawingSave}
        />
      </div>

      {/* Hint Section */}
      {hasHints && (
        <div className="space-y-3">
          {/* Reveal Hint Button */}
          {hintsRevealed < hints.length && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRevealHint}
              disabled={isSubmitting}
              className={`
                w-full py-3 px-4 rounded-xl border-2 border-dashed border-amber-300
                bg-amber-50/50 hover:bg-amber-100/50 hover:border-amber-400
                transition-all duration-200 flex items-center justify-center gap-2
                ${isSubmitting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-amber-700">
                Need a hint? ({hints.length - hintsRevealed} remaining)
              </span>
            </motion.button>
          )}

          {/* Revealed Hints */}
          {hintsRevealed > 0 && (
            <HintPanel
              hints={hints.slice(0, hintsRevealed)}
              totalHints={hints.length}
            />
          )}
        </div>
      )}

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit()}
          className={`
            w-full py-6 text-lg font-bold rounded-2xl transition-all duration-300
            ${
              canSubmit()
                ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg hover:shadow-xl"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Checking...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              <span>Submit Answer</span>
            </div>
          )}
        </Button>
      </motion.div>

    </motion.div>
  );
}

export default QuestionStep;
