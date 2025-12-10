"use client";

import { cn } from "@/lib/utils";
import { Flag, CheckCircle2 } from "lucide-react";
import type { Question, AnswerResponse } from "@/lib/exam/types";

interface QuestionWithSection extends Question {
  sectionId: string;
  sectionLabel: string;
}

interface AnswerEntry {
  questionId: string;
  response: AnswerResponse;
}

interface ExamNavigationProps {
  questions: QuestionWithSection[];
  currentIndex: number;
  answers: Map<string, AnswerEntry>;
  flaggedQuestions: Set<string>;
  onQuestionSelect: (index: number) => void;
}

/**
 * ExamNavigation - Sidebar showing all questions with status indicators
 *
 * Groups questions by section and shows:
 * - Answered status (checkmark)
 * - Flagged status (flag icon)
 * - Current question highlight
 */
export function ExamNavigation({
  questions,
  currentIndex,
  answers,
  flaggedQuestions,
  onQuestionSelect,
}: ExamNavigationProps) {
  // Group questions by section
  const sections = questions.reduce((acc, q, index) => {
    if (!acc[q.sectionId]) {
      acc[q.sectionId] = {
        label: q.sectionLabel,
        questions: [],
      };
    }
    acc[q.sectionId].questions.push({ ...q, globalIndex: index });
    return acc;
  }, {} as Record<string, { label: string; questions: (QuestionWithSection & { globalIndex: number })[] }>);

  const isAnswered = (questionId: string): boolean => {
    const answer = answers.get(questionId);
    if (!answer) return false;
    const { response } = answer;
    if (response.selected_option) return true;
    if (response.selected_options && response.selected_options.length > 0) return true;
    if (response.numeric_value !== undefined && response.numeric_value !== null) return true;
    if (response.response_text && response.response_text.trim().length > 0) return true;
    return false;
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Questions
        </h2>

        {Object.entries(sections).map(([sectionId, section]) => (
          <div key={sectionId} className="mb-6">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              {section.label}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {section.questions.map((q) => {
                const isCurrent = q.globalIndex === currentIndex;
                const answered = isAnswered(q.question_id);
                const flagged = flaggedQuestions.has(q.question_id);

                return (
                  <button
                    key={q.question_id}
                    onClick={() => onQuestionSelect(q.globalIndex)}
                    className={cn(
                      "relative w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all",
                      isCurrent && "ring-2 ring-blue-500 ring-offset-2",
                      answered && !isCurrent && "bg-green-100 text-green-700 border border-green-200",
                      !answered && !isCurrent && "bg-gray-100 text-gray-600 hover:bg-gray-200",
                      isCurrent && "bg-blue-600 text-white"
                    )}
                    title={`Question ${q.question_number}${flagged ? ' (flagged)' : ''}${answered ? ' (answered)' : ''}`}
                  >
                    {q.question_number}

                    {/* Status indicators */}
                    {answered && !isCurrent && (
                      <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-green-600 bg-white rounded-full" />
                    )}
                    {flagged && (
                      <Flag className={cn(
                        "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full",
                        isCurrent ? "text-amber-300" : "text-amber-500 bg-white"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Legend
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200" />
              <span className="text-gray-600">Not answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-green-100 border border-green-200 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              </div>
              <span className="text-gray-600">Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Flag className="h-3 w-3 text-amber-500" />
              </div>
              <span className="text-gray-600">Flagged for review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-600" />
              <span className="text-gray-600">Current question</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
