"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Home,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { EvaluationResult, MockExam, QuestionFeedback } from "@/lib/exam/types";

interface ExamResultsProps {
  evaluation: EvaluationResult;
  exam: MockExam;
  onComplete: () => void;
}

const gradeStyles: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  B: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  C: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  D: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  'No Award': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
};

/**
 * ExamResults - Comprehensive results display after exam submission
 *
 * Shows:
 * - Overall grade and percentage
 * - Section breakdown
 * - Per-question feedback with expand/collapse
 * - Learning recommendations
 * - Encouragement message
 */
export function ExamResults({
  evaluation,
  exam,
  onComplete,
}: ExamResultsProps) {
  const { overall_result, section_results, question_feedback, learning_recommendations } = evaluation;

  // Controlled accordion state for expand/collapse all functionality
  const allQuestionIds = question_feedback.map((f) => f.question_id);
  const [openItems, setOpenItems] = useState<string[]>([]);

  const gradeStyle = gradeStyles[overall_result.grade] || gradeStyles['No Award'];

  // Group feedback by section
  const feedbackBySection = question_feedback.reduce((acc, fb) => {
    if (!acc[fb.section_id]) {
      acc[fb.section_id] = [];
    }
    acc[fb.section_id].push(fb);
    return acc;
  }, {} as Record<string, QuestionFeedback[]>);

  const getQuestionFromExam = (questionId: string) => {
    for (const section of exam.sections) {
      const question = section.questions.find((q) => q.question_id === questionId);
      if (question) return question;
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 pb-16 space-y-6 overflow-y-auto h-full">
      {/* Hero: Overall Result */}
      <Card className={`${gradeStyle.bg} ${gradeStyle.border} border-2`}>
        <CardContent className="pt-6">
          <div className="text-center">
            <Trophy className={`h-16 w-16 mx-auto mb-4 ${gradeStyle.text}`} />
            <h1 className="text-4xl font-bold mb-2">
              Grade: <span className={gradeStyle.text}>{overall_result.grade}</span>
            </h1>
            <p className="text-2xl text-gray-700 mb-4">
              {overall_result.total_marks_earned} / {overall_result.total_marks_possible} marks
              ({overall_result.percentage.toFixed(1)}%)
            </p>
            <Badge
              variant={overall_result.pass_status ? "default" : "destructive"}
              className="text-lg px-4 py-1"
            >
              {overall_result.pass_status ? "PASSED" : "More Work Needed"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Encouragement Message */}
      {evaluation.encouragement_message && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800 text-lg">{evaluation.encouragement_message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Section Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {section_results.map((section) => (
              <div key={section.section_id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{section.section_label}</span>
                  <span className="text-gray-600">
                    {section.marks_earned}/{section.marks_possible} ({section.percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={section.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Learning Recommendations */}
      {learning_recommendations && learning_recommendations.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              Learning Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {learning_recommendations
                .sort((a, b) => a.priority - b.priority)
                .map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white rounded-lg border border-amber-200"
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="bg-amber-100 text-amber-700">
                        Priority {rec.priority}
                      </Badge>
                      <div>
                        <h4 className="font-semibold text-gray-900">{rec.topic}</h4>
                        <p className="text-gray-600 mt-1">{rec.reason}</p>
                        <p className="text-blue-600 font-medium mt-2 flex items-center gap-1">
                          <ArrowRight className="h-4 w-4" />
                          {rec.action}
                        </p>
                        {rec.related_questions && rec.related_questions.length > 0 && (
                          <p className="text-sm text-gray-500 mt-1">
                            Related to questions: {rec.related_questions.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question-by-Question Feedback */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Question Feedback</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (openItems.length === allQuestionIds.length) {
                  setOpenItems([]);
                } else {
                  setOpenItems(allQuestionIds);
                }
              }}
            >
              {openItems.length === allQuestionIds.length ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
          >
            {Object.entries(feedbackBySection).map(([sectionId, feedbacks]) => {
              const sectionResult = section_results.find((s) => s.section_id === sectionId);

              return (
                <div key={sectionId} className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {sectionResult?.section_label || sectionId}
                  </h3>

                  {feedbacks.map((feedback) => {
                    const question = getQuestionFromExam(feedback.question_id);

                    return (
                      <div key={feedback.question_id} className="border rounded-lg mb-3">
                      <AccordionItem
                        value={feedback.question_id}
                        className="border-0"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            {feedback.is_correct ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                            ) : feedback.is_partially_correct ? (
                              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                            )}
                            <span className="font-medium">Q{feedback.question_number}</span>
                            <span className="text-gray-500">
                              {feedback.marks_earned}/{feedback.marks_possible} marks
                            </span>
                            {feedback.is_partially_correct && (
                              <Badge variant="outline" className="text-amber-600">
                                Partial
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-6">
                          <div className="space-y-4 pt-2 pb-2">
                            {/* Question stem (collapsed) */}
                            {question && (
                              <details className="bg-gray-50 rounded p-3">
                                <summary className="text-sm text-gray-500 cursor-pointer">
                                  View question
                                </summary>
                                <div className="mt-2 prose prose-sm">
                                  <MarkdownRenderer content={question.question_stem} />
                                </div>
                              </details>
                            )}

                            {/* Feedback summary */}
                            <p className="text-gray-700">{feedback.feedback_summary}</p>

                            {/* What you did well */}
                            {feedback.what_you_did_well && (
                              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <h5 className="font-medium text-green-700 mb-1">
                                  What you did well
                                </h5>
                                <p className="text-green-800">{feedback.what_you_did_well}</p>
                              </div>
                            )}

                            {/* Where you went wrong */}
                            {feedback.where_you_went_wrong && (
                              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                <h5 className="font-medium text-red-700 mb-1">
                                  Where you went wrong
                                </h5>
                                <p className="text-red-800">{feedback.where_you_went_wrong}</p>
                              </div>
                            )}

                            {/* Correct approach */}
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <h5 className="font-medium text-blue-700 mb-1">
                                Correct approach
                              </h5>
                              <p className="text-blue-800">{feedback.correct_approach}</p>
                            </div>

                            {/* Related concept */}
                            {feedback.related_concept && (
                              <p className="text-sm text-gray-500">
                                <strong>Related concept:</strong> {feedback.related_concept}
                              </p>
                            )}

                            {/* Misconception detected */}
                            {feedback.misconception_detected && (
                              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <h5 className="font-medium text-amber-700 mb-1">
                                  Misconception detected
                                </h5>
                                <p className="text-amber-800">{feedback.misconception_detected}</p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center pt-6 pb-24">
        <Button onClick={onComplete} size="lg" className="gap-2">
          <Home className="h-5 w-5" />
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
