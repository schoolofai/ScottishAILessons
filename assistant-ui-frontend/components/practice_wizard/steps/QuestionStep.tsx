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

import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Lightbulb, Image as ImageIcon, AlertTriangle } from "lucide-react";
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
  const [diagramError, setDiagramError] = useState<string | null>(null);

  // CRITICAL: Reset answer state when question changes to prevent stale data
  // Without this, switching from MCQ to structured_response could send old MCQ index
  useEffect(() => {
    const initialAnswer = question.question_type === "mcq" && selectCount > 1 ? [] : "";
    setAnswer(initialAnswer);
    setHintsRevealed(0);
    setDrawingDataUrl(undefined);
    setDrawingSceneData(undefined);
  }, [question.question_id, question.question_type, selectCount]);

  const hints = question.hints || [];
  const hasHints = hints.length > 0;
  const isMultiSelect = question.question_type === "mcq" && selectCount > 1;

  // Reset diagram error state when question changes
  useEffect(() => {
    setDiagramError(null);
  }, [question]);

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
          {/* Only show progress stats if data is available (V1 only) */}
          {typeof question.correct_at_difficulty === "number" && typeof question.questions_at_difficulty === "number" && (
            <span className="text-sm text-gray-500">
              {question.correct_at_difficulty}/{question.questions_at_difficulty + 1} correct
            </span>
          )}
        </div>
      </div>

      {/* Question Stem Card */}
      <div className="wizard-card p-6">
        <MathRenderer
          content={question.stem}
          className="text-lg text-gray-800 leading-relaxed"
        />
      </div>

      {/* Question Diagram (if generated by backend) */}
      {question.diagram_base64 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="wizard-card overflow-hidden"
        >
          {/* Diagram Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
            <ImageIcon className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700">
              {question.diagram_title || "Diagram"}
            </span>
            {question.diagram_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 capitalize">
                {question.diagram_type}
              </span>
            )}
          </div>
          {/* Diagram Image */}
          <div className="p-4 flex justify-center bg-white">
            {diagramError ? (
              /* Error fallback UI */
              <div className="p-6 bg-red-50 rounded-lg border border-red-200 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-600 font-medium mb-1">Diagram failed to load</p>
                <p className="text-red-500 text-sm">{diagramError}</p>
                <p className="text-gray-500 text-xs mt-2">
                  Base64 length: {question.diagram_base64?.length || 0} chars
                </p>
              </div>
            ) : (
              <img
                src={`data:image/png;base64,${question.diagram_base64}`}
                alt={question.diagram_description || "Question diagram"}
                className="max-w-full h-auto max-h-[400px] rounded-lg shadow-sm"
                onError={() => {
                  // Identify the issue for user-facing error display
                  let errorMsg = "Unknown error";
                  if (!question.diagram_base64) {
                    errorMsg = "No base64 data available";
                  } else if (question.diagram_base64.includes(" ") || question.diagram_base64.includes("\n")) {
                    errorMsg = "Base64 contains whitespace characters";
                  } else if (!question.diagram_base64.startsWith("iVBORw0KGgo")) {
                    errorMsg = "Invalid PNG data (wrong header)";
                  } else {
                    errorMsg = "Image data may be corrupted";
                  }
                  setDiagramError(errorMsg);
                }}
              />
            )}
          </div>
          {/* Diagram Description (for accessibility) */}
          {question.diagram_description && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600 italic">
                {question.diagram_description}
              </p>
            </div>
          )}
        </motion.div>
      )}

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
