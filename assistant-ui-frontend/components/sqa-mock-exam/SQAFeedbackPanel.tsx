"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle, XCircle, AlertCircle, ChevronDown } from "lucide-react";
import type { QuestionResult, BulletMark } from "@/lib/sqa-mock-exam/types";

interface SQAFeedbackPanelProps {
  questionFeedback: QuestionResult[];
}

/**
 * SQAFeedbackPanel - Displays detailed per-question feedback
 *
 * Shows SQA-style marking with:
 * - Bullet-by-bullet mark breakdown
 * - Expected vs actual answers
 * - Misconception detection
 * - Learning recommendations
 */
export function SQAFeedbackPanel({ questionFeedback }: SQAFeedbackPanelProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Question Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="space-y-2">
          {questionFeedback.map((feedback) => {
            const percentage =
              feedback.marks_possible > 0
                ? (feedback.marks_earned / feedback.marks_possible) * 100
                : 0;

            // Determine status icon
            let StatusIcon = AlertCircle;
            let statusColor = "text-yellow-500";
            if (percentage >= 80) {
              StatusIcon = CheckCircle;
              statusColor = "text-green-500";
            } else if (percentage === 0) {
              StatusIcon = XCircle;
              statusColor = "text-red-500";
            }

            return (
              <AccordionItem
                key={feedback.question_id}
                value={feedback.question_id}
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                      <span className="font-medium">
                        Question {feedback.question_number}
                      </span>
                    </div>
                    <Badge
                      variant={percentage >= 80 ? "default" : percentage > 0 ? "secondary" : "destructive"}
                    >
                      {feedback.marks_earned} / {feedback.marks_possible}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Overall feedback */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{feedback.overall_feedback}</p>
                    </div>

                    {/* Misconception warning */}
                    {feedback.misconception_detected && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-800">
                              Misconception Detected
                            </p>
                            <p className="text-sm text-amber-700 mt-1">
                              {feedback.misconception_detected}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bullet-by-bullet breakdown */}
                    {feedback.bullet_marks && feedback.bullet_marks.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Marking Points:</h4>
                        {feedback.bullet_marks.map((bullet, idx) => (
                          <BulletMarkDisplay key={idx} bullet={bullet} />
                        ))}
                      </div>
                    )}

                    {/* Strengths */}
                    {feedback.strengths && feedback.strengths.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm text-green-700">Strengths:</h4>
                        <ul className="list-disc list-inside text-sm text-green-600">
                          {feedback.strengths.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Areas for improvement */}
                    {feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm text-blue-700">
                          Areas for Improvement:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-blue-600">
                          {feedback.areas_for_improvement.map((a, idx) => (
                            <li key={idx}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

/**
 * BulletMarkDisplay - Displays a single bullet point mark result
 */
function BulletMarkDisplay({ bullet }: { bullet: BulletMark }) {
  const isCorrect = bullet.marks_earned === bullet.marks_possible;
  const isPartial = bullet.marks_earned > 0 && bullet.marks_earned < bullet.marks_possible;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isCorrect
          ? "bg-green-50 border-green-200"
          : isPartial
          ? "bg-yellow-50 border-yellow-200"
          : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : isPartial ? (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="font-medium text-sm">Bullet {bullet.bullet}</span>
        </div>
        <Badge variant={isCorrect ? "default" : "secondary"} className="text-xs">
          {bullet.marks_earned}/{bullet.marks_possible}
        </Badge>
      </div>

      <p className="text-sm mt-2 text-gray-700">{bullet.feedback}</p>

      {/* Show expected vs actual if available */}
      {(bullet.expected_working || bullet.student_working) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          {bullet.expected_working && (
            <div className="p-2 bg-white rounded border">
              <div className="font-medium text-gray-500 mb-1">Expected:</div>
              <div className="font-mono">{bullet.expected_working}</div>
            </div>
          )}
          {bullet.student_working && (
            <div className="p-2 bg-white rounded border">
              <div className="font-medium text-gray-500 mb-1">Your answer:</div>
              <div className="font-mono">{bullet.student_working}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
