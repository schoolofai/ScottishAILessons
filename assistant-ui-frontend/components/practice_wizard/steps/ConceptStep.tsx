"use client";

/**
 * ConceptStep - Concept presentation step for the practice wizard
 *
 * Displays the concept explanation, worked example, and key skills
 * before the student starts practicing. Supports math rendering via KaTeX.
 */

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  BookOpen,
  Lightbulb,
  ChevronRight,
  Settings,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConceptBlock } from "@/hooks/practice/useLangGraphWizard";

interface ConceptStepProps {
  data: ConceptBlock;
  onContinue: (difficultyOverride?: "easy" | "medium" | "hard") => Promise<void>;
  isStreaming: boolean;
}

export function ConceptStep({ data, onContinue, isStreaming }: ConceptStepProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState(data.current_difficulty);
  const [showSettings, setShowSettings] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const {
    title,
    explanation,
    worked_example,
    key_skills,
    current_difficulty,
    difficulty_mode,
    can_set_difficulty,
    block_index,
    total_blocks,
  } = data;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const override = selectedDifficulty !== current_difficulty ? selectedDifficulty : undefined;
      await onContinue(override);
    } finally {
      setIsStarting(false);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "easy":
        return "bg-emerald-100 text-emerald-700 border-emerald-300";
      case "medium":
        return "bg-amber-100 text-amber-700 border-amber-300";
      case "hard":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      {/* Header Card */}
      <div className="wizard-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
              <p className="text-sm text-gray-500">
                Block {block_index + 1} of {total_blocks}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full border ${getDifficultyColor(
                current_difficulty
              )}`}
            >
              {current_difficulty.charAt(0).toUpperCase() + current_difficulty.slice(1)}
            </span>
            {difficulty_mode === "adaptive" && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-cyan-100 text-cyan-700 border border-cyan-300">
                Adaptive
              </span>
            )}
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-5 border border-cyan-100">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800">Understanding the Concept</h3>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {explanation}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Worked Example Card */}
      <div className="wizard-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-bold text-gray-800">Worked Example</h3>
        </div>

        <div className="space-y-4">
          {/* Problem */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-sm font-semibold text-gray-500 mb-2">Problem</p>
            <div className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {worked_example.problem}
              </ReactMarkdown>
            </div>
          </div>

          {/* Solution Steps */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-500">Solution Steps</p>
            {worked_example.solution_steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 animate-slide-left stagger-${Math.min(idx + 1, 6)}`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 pt-1 prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {step}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>

          {/* Final Answer */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 mb-1">Answer</p>
              <div className="prose prose-sm max-w-none text-gray-800 font-medium">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {worked_example.final_answer}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Skills */}
      {key_skills.length > 0 && (
        <div className="wizard-card p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            Skills You&apos;ll Practice
          </h3>
          <div className="flex flex-wrap gap-2">
            {key_skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700 rounded-full text-sm font-medium border border-purple-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Difficulty Settings */}
      {can_set_difficulty && (
        <div className="wizard-card p-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            {showSettings ? "Hide settings" : "Adjust difficulty"}
          </button>

          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start at difficulty:
              </label>
              <Select
                value={selectedDifficulty}
                onValueChange={(value: "easy" | "medium" | "hard") =>
                  setSelectedDifficulty(value)
                }
              >
                <SelectTrigger className="w-full max-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-2">
                {difficulty_mode === "adaptive"
                  ? "Difficulty will adjust based on your performance."
                  : "Difficulty is fixed at your selected level."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Start Button */}
      <div className="pt-4">
        <Button
          onClick={handleStart}
          disabled={isStarting || isStreaming}
          className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50"
        >
          {isStarting || isStreaming ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Getting Ready...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Start Practicing
              <ChevronRight className="w-5 h-5" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ConceptStep;
