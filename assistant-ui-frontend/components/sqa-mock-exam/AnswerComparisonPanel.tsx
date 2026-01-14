"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import type {
  Nat5PlusMockExam,
  StudentAnswer,
  EvaluationResult,
  QuestionResult,
  Nat5PlusQuestion,
  BulletMark,
} from "@/lib/sqa-mock-exam/types";

interface AnswerComparisonPanelProps {
  exam: Nat5PlusMockExam;
  studentAnswers: StudentAnswer[];
  evaluationResult: EvaluationResult;
}

/**
 * Determines question status based on marks earned
 */
function getQuestionStatus(
  feedback: QuestionResult | undefined
): "full" | "partial" | "none" {
  if (!feedback) return "none";
  if (feedback.marks_earned === feedback.marks_possible) return "full";
  if (feedback.marks_earned > 0) return "partial";
  return "none";
}

/**
 * QuestionHeader - Displays question number and marks with status icon
 */
function QuestionHeader({
  number,
  marks,
  earned,
  status,
}: {
  number: number;
  marks: number;
  earned: number;
  status: "full" | "partial" | "none";
}) {
  const icons = {
    full: <CheckCircle className="h-5 w-5 text-green-600" />,
    partial: <MinusCircle className="h-5 w-5 text-amber-600" />,
    none: <XCircle className="h-5 w-5 text-red-600" />,
  };

  const badgeStyles = {
    full: "bg-green-100 text-green-800",
    partial: "bg-amber-100 text-amber-800",
    none: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex items-center gap-3 w-full">
      {icons[status]}
      <span className="font-medium">Question {number}</span>
      <Badge className={`ml-auto ${badgeStyles[status]}`}>
        {earned}/{marks} marks
      </Badge>
    </div>
  );
}

/**
 * BulletMarksDisplay - Shows marking breakdown for each bullet point
 */
function BulletMarksDisplay({ bullets }: { bullets: BulletMark[] }) {
  if (!bullets || bullets.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <Label className="text-sm font-medium">Marking Breakdown</Label>
      <div className="space-y-1">
        {bullets.map((bullet) => {
          const isFullMarks = bullet.marks_earned === bullet.marks_possible;
          const isPartialMarks =
            bullet.marks_earned > 0 &&
            bullet.marks_earned < bullet.marks_possible;
          const isNoMarks = bullet.marks_earned === 0;

          let bgClass = "bg-gray-50";
          let icon = <MinusCircle className="h-4 w-4 text-gray-400" />;

          if (isFullMarks) {
            bgClass = "bg-green-50 border-green-200";
            icon = <CheckCircle className="h-4 w-4 text-green-600" />;
          } else if (isPartialMarks) {
            bgClass = "bg-amber-50 border-amber-200";
            icon = <MinusCircle className="h-4 w-4 text-amber-600" />;
          } else if (isNoMarks) {
            bgClass = "bg-red-50 border-red-200";
            icon = <XCircle className="h-4 w-4 text-red-600" />;
          }

          return (
            <div
              key={bullet.bullet}
              className={`flex items-start gap-2 p-2 rounded border ${bgClass}`}
            >
              {icon}
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Bullet {bullet.bullet}
                  </span>
                  <span className="text-xs font-semibold">
                    {bullet.marks_earned}/{bullet.marks_possible}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{bullet.feedback}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * AnswerComparisonPanel - Side-by-side comparison of student vs expected answers
 *
 * For each question shows:
 * - Question stem
 * - Student's answer (left column)
 * - Expected answer with marking scheme (right column)
 * - Bullet-by-bullet marking breakdown
 * - Misconception alerts if detected
 */
export function AnswerComparisonPanel({
  exam,
  studentAnswers,
  evaluationResult,
}: AnswerComparisonPanelProps) {
  // Flatten all questions from exam sections
  const allQuestions = exam.sections.flatMap((s) => s.questions);

  // Create lookup map for student answers
  const answerMap = new Map(
    studentAnswers.map((a) => [a.question_id, a])
  );

  // Create lookup map for evaluation feedback
  const feedbackMap = new Map(
    evaluationResult.question_feedback.map((qr) => [qr.question_id, qr])
  );

  if (allQuestions.length === 0) {
    return (
      <Alert>
        <AlertDescription>No questions available for review.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-3">
      {allQuestions.map((question, idx) => {
        const studentAnswer = answerMap.get(question.question_id);
        const feedback = feedbackMap.get(question.question_id);
        const status = getQuestionStatus(feedback);

        return (
          <AccordionItem
            key={question.question_id}
            value={question.question_id}
            className="border rounded-lg"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <QuestionHeader
                number={idx + 1}
                marks={question.marks}
                earned={feedback?.marks_earned || 0}
                status={status}
              />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {/* Question stem */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">
                  Question
                </Label>
                <p className="mt-1 whitespace-pre-wrap">
                  {question.stem_latex || question.stem}
                </p>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Student's answer (left) */}
                <Card className="bg-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Your Answer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {studentAnswer?.working_shown && (
                        <div>
                          <Label className="text-xs text-gray-500">
                            Working
                          </Label>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {studentAnswer.working_shown}
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-gray-500">
                          Final Answer
                        </Label>
                        <p className="mt-1 font-medium">
                          {studentAnswer?.response_text || (
                            <span className="text-gray-400 italic">
                              No answer provided
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expected answer (right) */}
                <Card className="bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Expected Answer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Generic scheme */}
                      <div>
                        <Label className="text-xs text-gray-500">
                          Marking Criteria
                        </Label>
                        <ul className="mt-1 space-y-1">
                          {question.marking_scheme.generic_scheme.map(
                            (bullet) => (
                              <li
                                key={bullet.bullet}
                                className="text-sm flex gap-2"
                              >
                                <span className="text-green-600 font-medium">
                                  [{bullet.marks}]
                                </span>
                                <span>{bullet.process}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      {/* Illustrative answers */}
                      {question.marking_scheme.illustrative_scheme.length >
                        0 && (
                        <div>
                          <Label className="text-xs text-gray-500">
                            Example Answers
                          </Label>
                          <ul className="mt-1 space-y-1">
                            {question.marking_scheme.illustrative_scheme.map(
                              (ill) => (
                                <li key={ill.bullet} className="text-sm">
                                  <span className="font-medium">
                                    {ill.answer_latex || ill.answer}
                                  </span>
                                  {ill.acceptable_variations &&
                                    ill.acceptable_variations.length > 0 && (
                                      <span className="text-gray-500 text-xs ml-2">
                                        (also accept:{" "}
                                        {ill.acceptable_variations.join(", ")})
                                      </span>
                                    )}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bullet marks breakdown */}
              {feedback?.bullet_marks && (
                <BulletMarksDisplay bullets={feedback.bullet_marks} />
              )}

              {/* Overall feedback */}
              {feedback?.overall_feedback && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Label className="text-xs text-blue-600 uppercase tracking-wide">
                    Feedback
                  </Label>
                  <p className="mt-1 text-sm">{feedback.overall_feedback}</p>
                </div>
              )}

              {/* Misconception alert */}
              {feedback?.misconception_detected && (
                <Alert variant="destructive" className="mt-4 bg-amber-50 border-amber-200 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">
                    Misconception Detected
                  </AlertTitle>
                  <AlertDescription className="text-amber-700">
                    {feedback.misconception_detected}
                  </AlertDescription>
                </Alert>
              )}

              {/* Strengths and areas for improvement */}
              {(feedback?.strengths?.length || feedback?.areas_for_improvement?.length) && (
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  {feedback?.strengths && feedback.strengths.length > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <Label className="text-xs text-green-600 uppercase tracking-wide">
                        Strengths
                      </Label>
                      <ul className="mt-1 space-y-1">
                        {feedback.strengths.map((s, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {feedback?.areas_for_improvement &&
                    feedback.areas_for_improvement.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-xs text-blue-600 uppercase tracking-wide">
                          Areas to Improve
                        </Label>
                        <ul className="mt-1 space-y-1">
                          {feedback.areas_for_improvement.map((a, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
