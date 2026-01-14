"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Send,
  Flag,
  Home,
} from "lucide-react";
import { SQAQuestionDisplay } from "./SQAQuestionDisplay";
import { SQAResultsSummary } from "./SQAResultsSummary";
import { SQAFeedbackPanel } from "./SQAFeedbackPanel";
import { logger, createLogger } from "@/lib/logger";
import type {
  Nat5PlusMockExam,
  Nat5PlusQuestion,
  EvaluationResult,
} from "@/lib/sqa-mock-exam/types";

const log = createLogger("SQAExamContainer");

// Polling interval for grading status (5 seconds)
const POLL_INTERVAL_MS = 5000;

type ExamPhase = "instructions" | "in_progress" | "submitting" | "results";

interface SQAExamContainerProps {
  exam: Nat5PlusMockExam;
  attemptId: string;
  studentId: string;
  onComplete: () => void;
  onExit: () => void;
}

interface StudentAnswer {
  question_id: string;
  response_text: string;
  working_shown?: string;
}

/**
 * SQAExamContainer - Main orchestrator for SQA mock exam experience
 *
 * Manages the exam lifecycle through phases:
 * - instructions: Show exam info and start button
 * - in_progress: Active exam taking with timer
 * - submitting: Processing submission with LangGraph evaluator
 * - results: Display SQA-style grading feedback
 */
export function SQAExamContainer({
  exam,
  attemptId,
  studentId,
  onComplete,
  onExit,
}: SQAExamContainerProps) {
  const [phase, setPhase] = useState<ExamPhase>("instructions");
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(
    (exam.metadata.duration_minutes || 90) * 60
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten questions for navigation
  const allQuestions = exam.sections.flatMap((section) =>
    section.questions.map((q) => ({
      ...q,
      sectionId: section.section_id,
      sectionName: section.section_name,
    }))
  );

  // Timer effect
  useEffect(() => {
    if (isTimerRunning && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmit(true); // Auto-submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeStatus = (): "normal" | "warning" | "critical" => {
    const totalSeconds = (exam.metadata.duration_minutes || 90) * 60;
    const ratio = timeRemaining / totalSeconds;
    if (ratio <= 0.1) return "critical";
    if (ratio <= 0.25) return "warning";
    return "normal";
  };

  const handleStartExam = useCallback(() => {
    setPhase("in_progress");
    setIsTimerRunning(true);
  }, []);

  const handleAnswerChange = useCallback(
    (questionId: string, response: { response_text: string; working_shown?: string }) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, {
          question_id: questionId,
          ...response,
        });
        return next;
      });
    },
    []
  );

  const handleToggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const checkGradingStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/sqa-mock-exam/attempt/${attemptId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to check status");
      }

      const data = await response.json();
      log.info("Grading status check", { status: data.status });

      if (data.status === "graded" && data.evaluationResult) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setEvaluationResult(data.evaluationResult);
        setPhase("results");
        log.info("Grading complete", {
          grade: data.evaluationResult.overall_result.grade,
        });
      } else if (data.status === "grading_error") {
        // Stop polling on error
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setGradingError("Grading failed. Please try again later.");
      }
    } catch (err) {
      log.error("Status check error", { error: err });
    }
  }, [attemptId]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    log.info("Starting polling for grading results");
    pollingRef.current = setInterval(checkGradingStatus, POLL_INTERVAL_MS);
    checkGradingStatus(); // Immediate check
  }, [checkGradingStatus]);

  const handleSubmit = useCallback(
    async (isAutoSubmit: boolean = false) => {
      try {
        setPhase("submitting");
        setIsTimerRunning(false);
        setSubmitError(null);
        setGradingError(null);

        // Build submission payload
        const answersArray = Array.from(answers.values());

        const response = await fetch(`/api/sqa-mock-exam/${exam.exam_id}/submit`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attemptId,
            answers: answersArray,
            mock_exam: exam,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to submit exam");
        }

        log.info("Submission accepted, starting polling");
        startPolling();
      } catch (err) {
        log.error("Submission error", { error: err });
        setSubmitError(err instanceof Error ? err.message : "Submission failed");
        setPhase("in_progress");
        setIsTimerRunning(true);
      }
    },
    [attemptId, answers, exam, startPolling]
  );

  // Calculate progress
  const answeredCount = answers.size;
  const totalQuestions = allQuestions.length;
  const progressPercent = (answeredCount / totalQuestions) * 100;

  // Instructions phase
  if (phase === "instructions") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{exam.metadata.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-5 w-5" />
                  <span>Duration</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {exam.metadata.duration_minutes} minutes
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Total Marks</div>
                <div className="text-2xl font-bold mt-1">
                  {exam.metadata.total_marks}
                </div>
              </div>
            </div>

            {/* Calculator status - backward compatible: default to true for legacy exams */}
            {(exam.metadata.calculator_allowed ?? true) ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700">
                <Calculator className="h-5 w-5" />
                <span>Calculator allowed for this exam</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="4" y1="2" x2="20" y2="22" strokeWidth="2.5" stroke="currentColor" />
                </svg>
                <span>No calculator allowed for this exam</span>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-medium">Instructions:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Answer all questions</li>
                <li>Show your working to earn partial marks</li>
                <li>You can flag questions to review later</li>
                <li>Submit when you&apos;re ready or time runs out</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={onExit}>
                <Home className="h-4 w-4 mr-2" />
                Exit
              </Button>
              <Button onClick={handleStartExam} className="flex-1">
                Start Exam
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitting phase
  if (phase === "submitting") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto px-4">
          {gradingError ? (
            <>
              <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-700">Grading Error</h2>
              <p className="text-red-600 mt-2">{gradingError}</p>
              <Button onClick={onComplete} className="mt-6">
                Return to Dashboard
              </Button>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">
                Grading your exam...
              </h2>
              <p className="text-gray-500 mt-2">
                Our AI is applying SQA marking standards to evaluate each answer.
              </p>
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm">
                  Your answers have been saved. You can safely leave this page.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Results phase
  if (phase === "results" && evaluationResult) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <SQAResultsSummary
          overallResult={evaluationResult.overall_result}
          sectionResults={evaluationResult.section_results}
          encouragementMessage={evaluationResult.encouragement_message}
        />
        <SQAFeedbackPanel questionFeedback={evaluationResult.question_feedback} />
        <div className="text-center">
          <Button onClick={onComplete}>
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // In progress phase
  const currentQuestion = allQuestions[currentQuestionIndex];
  const timeStatus = getTimeStatus();

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold truncate">{exam.metadata.title}</h1>
            <Badge variant="outline">
              {answeredCount}/{totalQuestions} answered
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 font-mono text-lg ${
                timeStatus === "critical"
                  ? "text-red-600"
                  : timeStatus === "warning"
                  ? "text-yellow-600"
                  : "text-gray-700"
              }`}
            >
              <Clock className="h-5 w-5" />
              {formatTime(timeRemaining)}
            </div>
            <Button onClick={() => handleSubmit(false)}>
              <Send className="h-4 w-4 mr-2" />
              Submit
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="mt-2 h-1" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Question navigation sidebar */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <h3 className="font-medium mb-3">Questions</h3>
          <div className="grid grid-cols-5 gap-2">
            {allQuestions.map((q, idx) => {
              const isAnswered = answers.has(q.question_id);
              const isFlagged = flaggedQuestions.has(q.question_id);
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={q.question_id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`
                    w-full aspect-square rounded-md text-sm font-medium
                    flex items-center justify-center relative
                    ${isCurrent ? "ring-2 ring-blue-500" : ""}
                    ${isAnswered ? "bg-green-100 text-green-800" : "bg-white border"}
                  `}
                >
                  {idx + 1}
                  {isFlagged && (
                    <Flag className="h-2 w-2 absolute top-0.5 right-0.5 text-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-y-auto p-6">
          <SQAQuestionDisplay
            question={currentQuestion}
            questionIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
            answer={answers.get(currentQuestion.question_id)}
            isFlagged={flaggedQuestions.has(currentQuestion.question_id)}
            onAnswerChange={(response) =>
              handleAnswerChange(currentQuestion.question_id, response)
            }
            onToggleFlag={() => handleToggleFlag(currentQuestion.question_id)}
            onPrevious={() =>
              setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
            }
            onNext={() =>
              setCurrentQuestionIndex(
                Math.min(totalQuestions - 1, currentQuestionIndex + 1)
              )
            }
            canGoPrevious={currentQuestionIndex > 0}
            canGoNext={currentQuestionIndex < totalQuestions - 1}
          />
        </div>
      </div>

      {submitError && (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
