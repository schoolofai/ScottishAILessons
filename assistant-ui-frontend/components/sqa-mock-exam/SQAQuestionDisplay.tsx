"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { MathRenderer } from "@/components/practice_wizard/shared/MathRenderer";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { Nat5PlusQuestion, QuestionDiagram } from "@/lib/sqa-mock-exam/types";

/**
 * Construct the diagram URL using the authenticated proxy API.
 *
 * The proxy route (/api/sqa-mock-exam/diagram/[fileId]) handles authentication
 * server-side, solving the 401 issue when browser <img> tags access Appwrite directly.
 */
function getDiagramUrl(diagram: QuestionDiagram): string | null {
  // Extract file ID from existing diagram_url or use diagram_id
  let fileId: string | null = null;

  // Priority 1: Extract file ID from existing Appwrite URL
  if (diagram.diagram_url && diagram.diagram_url.includes('/files/')) {
    // URL format: .../storage/buckets/{bucketId}/files/{fileId}/view?project=...
    const match = diagram.diagram_url.match(/\/files\/([^\/]+)\/view/);
    if (match) {
      fileId = match[1];
    }
  }

  // Priority 2: Use diagram_id directly as file ID
  if (!fileId && diagram.diagram_id) {
    // diagram_id might be the actual file ID if URL wasn't set
    // Check if it looks like an Appwrite file ID (alphanumeric, ~20 chars)
    if (/^[a-zA-Z0-9]{15,30}$/.test(diagram.diagram_id)) {
      fileId = diagram.diagram_id;
    }
  }

  // Construct proxy URL if we have a file ID
  if (fileId) {
    return `/api/sqa-mock-exam/diagram/${fileId}`;
  }

  return null;
}

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

  // Sync state when navigating between questions
  useEffect(() => {
    setResponseText(answer?.response_text || "");
    setWorkingShown(answer?.working_shown || "");
  }, [answer, question.question_id]);


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

  // Determine difficulty badge color using design system tokens
  const difficultyColor = {
    easy: "bg-[var(--color-success-bg)] text-[var(--wizard-green-dark)]",
    medium: "bg-[var(--color-warning-bg)] text-[var(--wizard-gold-dark)]",
    hard: "bg-[var(--color-error-bg)] text-[var(--wizard-red-dark)]",
  }[question.difficulty] || "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-sm bg-[var(--level-n5-bg)] text-[var(--level-n5-dark)] border-[var(--level-n5)]"
          >
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
          {/* Render question stem with proper LaTeX support */}
          <MathRenderer
            content={question.stem}
            className="text-base"
            processNewlines={true}
          />

          {/* Diagrams if any */}
          {question.diagrams && question.diagrams.length > 0 && (
            <div className="mt-4 flex gap-4 flex-wrap">
              {question.diagrams.map((diagram, idx) => {
                const diagramUrl = getDiagramUrl(diagram);
                return (
                  <div key={idx} className="border rounded-lg p-2 bg-white">
                    {diagramUrl ? (
                      <img
                        src={diagramUrl}
                        alt={diagram.description || `Diagram ${idx + 1}`}
                        className="max-w-md h-auto"
                        onError={(e) => {
                          // Log error and show placeholder on image load failure
                          console.error(`Failed to load diagram: ${diagramUrl}`);
                          (e.target as HTMLImageElement).style.display = 'none';
                          const placeholder = document.createElement('div');
                          placeholder.className = 'text-sm text-red-500 p-4 bg-red-50 rounded';
                          placeholder.textContent = `[Diagram failed to load: ${diagram.description || diagram.diagram_id}]`;
                          (e.target as HTMLImageElement).parentNode?.appendChild(placeholder);
                        }}
                      />
                    ) : (
                      <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded">
                        [Diagram: {diagram.description || diagram.diagram_id || 'No description'}]
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer guidance banner */}
      <div className="bg-[var(--wizard-blue-bg)] border border-[var(--wizard-blue-light)] rounded-lg p-4">
        <h4 className="font-semibold text-[var(--wizard-blue-dark)] mb-2">
          How to Answer
        </h4>
        <div className="flex gap-6 text-sm text-[var(--wizard-blue)]">
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--wizard-blue)] text-white text-xs flex items-center justify-center font-bold">1</span>
            <span><strong>Working:</strong> Show your method and calculations to earn partial marks</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--wizard-blue)] text-white text-xs flex items-center justify-center font-bold">2</span>
            <span><strong>Final Answer:</strong> State your simplified answer clearly</span>
          </div>
        </div>
      </div>

      {/* Step 1: Working area - with rich text, math, and drawing support */}
      <Card className="border-[var(--wizard-border-light)]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--wizard-blue)] text-white text-xs flex items-center justify-center font-bold">1</span>
            <Label htmlFor="working" className="font-semibold">
              Working
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-8">
            Show each step of your calculation — you can earn marks even if your final answer is wrong
          </p>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={workingShown}
            onChange={handleWorkingChange}
            placeholder="Show your working here... Use the formula button (Σ) for equations and the draw button for diagrams."
            className="min-h-[150px]"
            stem={question.stem}
          />
        </CardContent>
      </Card>

      {/* Step 2: Final answer area - with rich text, math, and drawing support */}
      <Card className="border-[var(--level-n5-light)] bg-[var(--wizard-bg-secondary)]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--level-n5)] text-white text-xs flex items-center justify-center font-bold">2</span>
            <Label htmlFor="answer" className="font-semibold">
              Final Answer
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-8">
            Write your final, simplified answer here
          </p>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={responseText}
            onChange={handleResponseChange}
            placeholder="Enter your final answer here..."
            className="min-h-[80px]"
            stem={question.stem}
          />
        </CardContent>
      </Card>

      {/* Hints (if available) - using design system colors */}
      {question.hints && question.hints.length > 0 && (
        <Card className="bg-[var(--wizard-blue-bg)] border-[var(--wizard-blue-light)]">
          <CardContent className="pt-4">
            <details>
              <summary className="cursor-pointer text-[var(--wizard-blue-dark)] font-medium">
                Need a hint? (Click to reveal)
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-[var(--wizard-blue)]">
                {question.hints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--wizard-border)]">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
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
