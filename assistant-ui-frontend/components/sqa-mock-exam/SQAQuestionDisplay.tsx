"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import type { Nat5PlusQuestion } from "@/lib/sqa-mock-exam/types";

interface SQAQuestionDisplayProps {
  question: Nat5PlusQuestion & {
    sectionId: string;
    sectionName: string;
  };
  questionIndex: number;
  totalQuestions: number;
  answer?: {
    response_text: string;
    working_shown?: string;
  };
  isFlagged: boolean;
  onAnswerChange: (response: { response_text: string; working_shown?: string }) => void;
  onToggleFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

/**
 * SQAQuestionDisplay - Renders a single SQA-style question
 *
 * Features:
 * - LaTeX rendering for mathematical content
 * - Working/solution input area
 * - Final answer input area
 * - Question flagging
 * - Navigation controls
 */
export function SQAQuestionDisplay({
  question,
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
}: SQAQuestionDisplayProps) {
  const [responseText, setResponseText] = useState(answer?.response_text || "");
  const [workingShown, setWorkingShown] = useState(answer?.working_shown || "");

  const handleResponseChange = (text: string) => {
    setResponseText(text);
    onAnswerChange({
      response_text: text,
      working_shown: workingShown,
    });
  };

  const handleWorkingChange = (text: string) => {
    setWorkingShown(text);
    onAnswerChange({
      response_text: responseText,
      working_shown: text,
    });
  };

  // Determine difficulty badge color
  const difficultyColor = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    hard: "bg-red-100 text-red-800",
  }[question.difficulty] || "bg-gray-100 text-gray-800";

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            Q{question.question_number}
          </Badge>
          <Badge className={difficultyColor}>{question.difficulty}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{question.marks} mark{question.marks !== 1 ? "s" : ""}</Badge>
          <Button
            variant={isFlagged ? "destructive" : "outline"}
            size="sm"
            onClick={onToggleFlag}
          >
            <Flag className="h-4 w-4" />
            {isFlagged ? "Flagged" : "Flag"}
          </Button>
        </div>
      </div>

      {/* Question stem */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">Question</h3>
        </CardHeader>
        <CardContent>
          {/* Render question stem - use stem_latex if available for math */}
          <div className="prose prose-sm max-w-none">
            {question.stem_latex ? (
              <div
                className="math-content"
                dangerouslySetInnerHTML={{ __html: question.stem_latex }}
              />
            ) : (
              <p className="whitespace-pre-wrap">{question.stem}</p>
            )}
          </div>

          {/* Diagrams if any */}
          {question.diagrams && question.diagrams.length > 0 && (
            <div className="mt-4 flex gap-4 flex-wrap">
              {question.diagrams.map((diagram, idx) => (
                <div key={idx} className="border rounded-lg p-2 bg-white">
                  {diagram.diagram_url ? (
                    <img
                      src={diagram.diagram_url}
                      alt={diagram.description || `Diagram ${idx + 1}`}
                      className="max-w-md h-auto"
                    />
                  ) : (
                    <div className="text-sm text-gray-500">[Diagram: {diagram.description}]</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Working area */}
      <Card>
        <CardHeader className="pb-2">
          <Label htmlFor="working">Working (show your steps)</Label>
        </CardHeader>
        <CardContent>
          <Textarea
            id="working"
            placeholder="Show your working here... This helps earn partial marks even if your final answer is incorrect."
            value={workingShown}
            onChange={(e) => handleWorkingChange(e.target.value)}
            className="min-h-[150px] font-mono"
          />
        </CardContent>
      </Card>

      {/* Answer area */}
      <Card>
        <CardHeader className="pb-2">
          <Label htmlFor="answer">Final Answer</Label>
        </CardHeader>
        <CardContent>
          <Textarea
            id="answer"
            placeholder="Enter your final answer here..."
            value={responseText}
            onChange={(e) => handleResponseChange(e.target.value)}
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>

      {/* Hints (if available) */}
      {question.hints && question.hints.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <details>
              <summary className="cursor-pointer text-blue-700 font-medium">
                Need a hint? (Click to reveal)
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-blue-600">
                {question.hints.map((hint, idx) => (
                  <li key={idx}>• {hint}</li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <span className="text-sm text-gray-500">
          Question {questionIndex + 1} of {totalQuestions}
        </span>

        <Button
          variant="outline"
          onClick={onNext}
          disabled={!canGoNext}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
