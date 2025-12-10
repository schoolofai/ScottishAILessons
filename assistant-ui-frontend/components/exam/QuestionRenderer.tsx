"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { MCQQuestion } from "./questions/MCQQuestion";
import { NumericQuestion } from "./questions/NumericQuestion";
import { ShortTextQuestion } from "./questions/ShortTextQuestion";
import { StructuredQuestion } from "./questions/StructuredQuestion";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { Question, AnswerResponse } from "@/lib/exam/types";

interface QuestionWithSection extends Question {
  sectionId: string;
  sectionLabel: string;
}

interface AnswerEntry {
  questionId: string;
  response: AnswerResponse;
}

interface QuestionRendererProps {
  question: QuestionWithSection;
  sectionLabel: string;
  questionIndex: number;
  totalQuestions: number;
  answer?: AnswerEntry;
  isFlagged: boolean;
  onAnswerChange: (response: AnswerResponse) => void;
  onToggleFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

/**
 * QuestionRenderer - Renders individual exam questions with appropriate input type
 *
 * Handles all question types:
 * - MCQ (single and multi-select)
 * - Numeric
 * - Short text
 * - Structured response
 */
export function QuestionRenderer({
  question,
  sectionLabel,
  questionIndex,
  totalQuestions,
  answer,
  isFlagged,
  onAnswerChange,
  onToggleFlag,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: QuestionRendererProps) {
  const difficultyStyles = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    hard: 'bg-red-100 text-red-700',
  };

  const renderQuestionInput = () => {
    const currentResponse = answer?.response || {};

    switch (question.question_type) {
      case 'mcq':
        return (
          <MCQQuestion
            options={question.cfu_config.options || []}
            selectedOption={currentResponse.selected_option}
            onSelect={(option) => onAnswerChange({ selected_option: option })}
          />
        );

      case 'mcq_multiselect':
        return (
          <MCQQuestion
            options={question.cfu_config.options || []}
            selectedOptions={currentResponse.selected_options}
            multiSelect
            onSelect={(_, options) => onAnswerChange({ selected_options: options })}
          />
        );

      case 'numeric':
        return (
          <NumericQuestion
            value={currentResponse.numeric_value}
            expectedFormat={question.cfu_config.expected_format}
            onChange={(value) => onAnswerChange({ numeric_value: value })}
          />
        );

      case 'short_text':
        return (
          <ShortTextQuestion
            value={currentResponse.response_text || ''}
            onChange={(text) => onAnswerChange({ response_text: text })}
          />
        );

      case 'structured_response':
        return (
          <StructuredQuestion
            value={currentResponse.response_text || ''}
            workingOut={currentResponse.working_out}
            onChange={(text, working) => onAnswerChange({
              response_text: text,
              working_out: working,
            })}
          />
        );

      default:
        return (
          <ShortTextQuestion
            value={currentResponse.response_text || ''}
            onChange={(text) => onAnswerChange({ response_text: text })}
          />
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="mb-6">
        <CardHeader className="pb-3">
          {/* Section and Question Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {sectionLabel}
              </Badge>
              <Badge className={difficultyStyles[question.difficulty]}>
                {question.difficulty}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
              </Badge>
              <Button
                variant={isFlagged ? "default" : "outline"}
                size="sm"
                onClick={onToggleFlag}
                className={isFlagged ? "bg-amber-500 hover:bg-amber-600" : ""}
              >
                <Flag className="h-4 w-4 mr-1" />
                {isFlagged ? "Flagged" : "Flag"}
              </Button>
            </div>
          </div>

          {/* Question Number and Stem */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Question {question.question_number}
            </h2>
            <div className="text-gray-700 prose prose-sm max-w-none">
              <MarkdownRenderer content={question.question_stem} />
            </div>
            {question.question_stem_plain && question.question_stem !== question.question_stem_plain && (
              <details className="mt-2">
                <summary className="text-sm text-blue-600 cursor-pointer hover:underline">
                  Show plain text version
                </summary>
                <p className="mt-2 text-gray-600 text-sm bg-gray-50 p-3 rounded">
                  {question.question_stem_plain}
                </p>
              </details>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Question-specific input */}
          {renderQuestionInput()}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <span className="text-sm text-gray-500">
          Question {questionIndex + 1} of {totalQuestions}
        </span>

        <Button
          variant="outline"
          onClick={onNext}
          disabled={!canGoNext}
          className="gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
