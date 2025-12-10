"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ExamInstructions } from "./ExamInstructions";
import { ExamHeader } from "./ExamHeader";
import { ExamNavigation } from "./ExamNavigation";
import { QuestionRenderer } from "./QuestionRenderer";
import { ExamResults } from "./ExamResults";
import { ExamSubmitDialog } from "./ExamSubmitDialog";
import { useExamState } from "@/hooks/exam/useExamState";
import { useExamTimer } from "@/hooks/exam/useExamTimer";
import type {
  MockExam,
  SubmittedAnswer,
  EvaluationResult,
  ExamPhase,
} from "@/lib/exam/types";

// Polling interval for checking grading status (5 seconds)
const POLL_INTERVAL_MS = 5000;

interface ExamContainerProps {
  exam: MockExam;
  attemptId: string;
  studentId: string;
  onComplete: () => void;
  onExit: () => void;
}

/**
 * ExamContainer - Main orchestrator for the mock exam experience
 *
 * Manages the exam lifecycle through phases:
 * - instructions: Show exam info and start button
 * - in_progress: Active exam taking with timer
 * - submitting: Processing submission
 * - results: Display grading feedback
 */
export function ExamContainer({
  exam,
  attemptId,
  studentId,
  onComplete,
  onExit,
}: ExamContainerProps) {
  const [phase, setPhase] = useState<ExamPhase>('instructions');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // Ref for polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track if initial recovery check has been done
  const recoveryCheckedRef = useRef<boolean>(false);
  const [isRecovering, setIsRecovering] = useState<boolean>(true);

  // Flatten questions for easier navigation
  const allQuestions = exam.sections.flatMap((section) =>
    section.questions.map((q) => ({
      ...q,
      sectionId: section.section_id,
      sectionLabel: section.section_label,
    }))
  );

  // State management hook
  const {
    answers,
    flaggedQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    updateAnswer,
    toggleFlag,
    getProgress,
    getAnswersArray,
  } = useExamState(allQuestions.length);

  // Timer hook
  const {
    timeRemaining,
    isRunning,
    startTimer,
    stopTimer,
    formatTime,
    timeStatus,
  } = useExamTimer(exam.metadata.timeLimit * 60);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeRemaining === 0 && phase === 'in_progress') {
      handleSubmit(true);
    }
  }, [timeRemaining, phase]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  /**
   * Check attempt status and fetch results if graded
   * NOTE: This must be defined BEFORE the recovery useEffect that depends on startPolling
   */
  const checkGradingStatus = useCallback(async () => {
    try {
      const statusResponse = await fetch(`/api/exam/attempt/${attemptId}/status`, {
        credentials: 'include',
      });

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to check status');
      }

      const statusData = await statusResponse.json();
      console.log('[ExamContainer] Status check:', statusData);

      if (statusData.status === 'graded' && statusData.hasResults) {
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Fetch full results
        const resultsResponse = await fetch(`/api/exam/attempt/${attemptId}/results`, {
          credentials: 'include',
        });

        if (!resultsResponse.ok) {
          const errorData = await resultsResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch results');
        }

        const resultsData = await resultsResponse.json();
        console.log('[ExamContainer] Grading complete, showing results');

        setEvaluationResult(resultsData.evaluation);
        setPhase('results');

      } else if (statusData.status === 'grading_error') {
        // Stop polling on error
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setGradingError(statusData.gradingError || 'Grading failed. Please try again.');
      }
      // If still 'submitted', continue polling (no action needed)

    } catch (err) {
      console.error('[ExamContainer] Status check error:', err);
      // Don't stop polling on transient errors, but log them
    }
  }, [attemptId]);

  /**
   * Start polling for grading results
   */
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    console.log('[ExamContainer] Starting polling for grading results');

    // Start polling
    pollingIntervalRef.current = setInterval(checkGradingStatus, POLL_INTERVAL_MS);

    // Also do an immediate check
    checkGradingStatus();
  }, [checkGradingStatus]);

  /**
   * Recovery on mount: Check if attempt was already submitted/graded
   * This handles the case where user navigated away during grading
   */
  useEffect(() => {
    // Only run once on mount
    if (recoveryCheckedRef.current) {
      return;
    }
    recoveryCheckedRef.current = true;

    const checkAttemptRecovery = async () => {
      try {
        console.log('[ExamContainer] Checking attempt recovery for:', attemptId);

        const statusResponse = await fetch(`/api/exam/attempt/${attemptId}/status`, {
          credentials: 'include',
        });

        if (!statusResponse.ok) {
          // If status check fails, assume new attempt and show instructions
          console.log('[ExamContainer] Status check failed, starting fresh');
          setIsRecovering(false);
          return;
        }

        const statusData = await statusResponse.json();
        console.log('[ExamContainer] Recovery check status:', statusData);

        if (statusData.status === 'graded' && statusData.hasResults) {
          // Already graded - fetch and show results
          console.log('[ExamContainer] Attempt already graded, fetching results');

          const resultsResponse = await fetch(`/api/exam/attempt/${attemptId}/results`, {
            credentials: 'include',
          });

          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json();
            setEvaluationResult(resultsData.evaluation);
            setPhase('results');
          } else {
            // Results fetch failed but attempt is graded - show error
            setGradingError('Results are available but could not be loaded. Please try again.');
            setPhase('submitting');
          }
        } else if (statusData.status === 'submitted') {
          // Still being graded - resume polling
          console.log('[ExamContainer] Attempt submitted, resuming polling');
          setPhase('submitting');
          startPolling();
        } else if (statusData.status === 'grading_error') {
          // Grading failed - show error
          console.log('[ExamContainer] Attempt has grading error');
          setGradingError(statusData.gradingError || 'Grading failed. Please try again.');
          setPhase('submitting');
        } else if (statusData.status === 'in_progress') {
          // Exam in progress but page was refreshed
          // For now, show instructions again (timer state is lost)
          console.log('[ExamContainer] Attempt in progress, showing instructions');
          setPhase('instructions');
        }
        // Default case (new attempt): show instructions
      } catch (err) {
        console.error('[ExamContainer] Recovery check error:', err);
        // On error, default to instructions
      } finally {
        setIsRecovering(false);
      }
    };

    checkAttemptRecovery();
  }, [attemptId, startPolling]);

  const handleStartExam = useCallback(() => {
    setPhase('in_progress');
    startTimer();
  }, [startTimer]);

  const handleSubmit = useCallback(async (isAutoSubmit: boolean = false) => {
    try {
      setPhase('submitting');
      stopTimer();
      setSubmitError(null);
      setGradingError(null);

      const progress = getProgress();
      const answersArray = getAnswersArray();

      // Build submission payload
      const submissionPayload = {
        attemptId,
        examId: exam.examId,
        studentId,
        courseId: exam.courseId,
        answers: answersArray.map((ans) => {
          const question = allQuestions.find((q) => q.question_id === ans.questionId);
          return {
            question_id: ans.questionId,
            question_number: question?.question_number || 0,
            section_id: question?.sectionId || '',
            question_type: question?.question_type || 'short_text',
            response: ans.response,
            time_spent_seconds: ans.timeSpent || 0,
            was_flagged: flaggedQuestions.has(ans.questionId),
          };
        }),
        submission_metadata: {
          started_at: new Date(Date.now() - (exam.metadata.timeLimit * 60 - timeRemaining) * 1000).toISOString(),
          submitted_at: new Date().toISOString(),
          time_limit_minutes: exam.metadata.timeLimit,
          time_spent_minutes: Math.round((exam.metadata.timeLimit * 60 - timeRemaining) / 60),
          was_auto_submitted: isAutoSubmit,
        },
        exam_context: {
          total_questions: allQuestions.length,
          questions_answered: progress.answered,
          questions_skipped: allQuestions.length - progress.answered,
          questions_flagged: flaggedQuestions.size,
        },
        mock_exam: exam,
      };

      // Submit to grading API (now returns immediately)
      const response = await fetch('/api/exam/submit', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit exam');
      }

      const result = await response.json();
      console.log('[ExamContainer] Submission accepted:', result);

      // Submission was accepted, now start polling for grading results
      // The API now returns immediately with status='submitted'
      // Background grading will update status to 'graded' when complete
      startPolling();

    } catch (err) {
      console.error('[ExamContainer] Submission error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
      setPhase('in_progress');
      startTimer(); // Resume timer if submission failed
    }
  }, [
    attemptId,
    exam,
    studentId,
    allQuestions,
    getProgress,
    getAnswersArray,
    flaggedQuestions,
    timeRemaining,
    stopTimer,
    startTimer,
    startPolling,
  ]);

  const handleQuestionChange = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
  }, [setCurrentQuestionIndex]);

  const handleAnswerChange = useCallback((
    questionId: string,
    response: SubmittedAnswer['response']
  ) => {
    updateAnswer(questionId, response);
  }, [updateAnswer]);

  const handleToggleFlag = useCallback((questionId: string) => {
    toggleFlag(questionId);
  }, [toggleFlag]);

  const handleRequestSubmit = useCallback(() => {
    setShowSubmitDialog(true);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    setShowSubmitDialog(false);
    handleSubmit(false);
  }, [handleSubmit]);

  const handleCancelSubmit = useCallback(() => {
    setShowSubmitDialog(false);
  }, []);

  // Show loading state while checking recovery
  if (isRecovering) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading exam...</p>
        </div>
      </div>
    );
  }

  // Render based on current phase
  if (phase === 'instructions') {
    return (
      <ExamInstructions
        exam={exam}
        onStart={handleStartExam}
        onExit={onExit}
      />
    );
  }

  if (phase === 'submitting') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto px-4">
          {gradingError ? (
            // Show grading error
            <>
              <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-700">Grading Error</h2>
              <p className="text-red-600 mt-2">{gradingError}</p>
              <p className="text-gray-500 mt-4 text-sm">
                Your answers have been saved. Please contact support if this issue persists.
              </p>
              <button
                onClick={onComplete}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Return to Dashboard
              </button>
            </>
          ) : (
            // Show grading in progress
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">Grading your exam...</h2>
              <p className="text-gray-500 mt-2">
                Our AI is carefully reviewing each of your answers.
              </p>

              {/* Safe to leave message */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Your answers have been saved</span>
                </div>
                <p className="text-green-600 text-sm mt-1">
                  You can safely leave this page. Your results will be ready when you return.
                </p>
              </div>

              {/* Estimated time message */}
              <p className="text-gray-400 text-sm mt-4">
                This usually takes 1-2 minutes
              </p>

              {/* Optional: Return to dashboard button */}
              <button
                onClick={onComplete}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Return to dashboard (we&apos;ll email you when ready)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'results' && evaluationResult) {
    return (
      <ExamResults
        evaluation={evaluationResult}
        exam={exam}
        onComplete={onComplete}
      />
    );
  }

  // In progress phase
  const currentQuestion = allQuestions[currentQuestionIndex];
  const progress = getProgress();

  return (
    <div className="min-h-full flex flex-col">
      {/* Fixed header with timer */}
      <ExamHeader
        title={exam.metadata.title}
        timeRemaining={formatTime()}
        timeStatus={timeStatus}
        progress={progress}
        totalQuestions={allQuestions.length}
        onSubmit={handleRequestSubmit}
        onExit={onExit}
      />

      <div className="flex-1 flex min-h-0">
        {/* Navigation sidebar */}
        <ExamNavigation
          questions={allQuestions}
          currentIndex={currentQuestionIndex}
          answers={answers}
          flaggedQuestions={flaggedQuestions}
          onQuestionSelect={handleQuestionChange}
        />

        {/* Question content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <QuestionRenderer
            question={currentQuestion}
            sectionLabel={currentQuestion.sectionLabel}
            questionIndex={currentQuestionIndex}
            totalQuestions={allQuestions.length}
            answer={answers.get(currentQuestion.question_id)}
            isFlagged={flaggedQuestions.has(currentQuestion.question_id)}
            onAnswerChange={(response) =>
              handleAnswerChange(currentQuestion.question_id, response)
            }
            onToggleFlag={() => handleToggleFlag(currentQuestion.question_id)}
            onPrevious={() => handleQuestionChange(Math.max(0, currentQuestionIndex - 1))}
            onNext={() => handleQuestionChange(Math.min(allQuestions.length - 1, currentQuestionIndex + 1))}
            canGoPrevious={currentQuestionIndex > 0}
            canGoNext={currentQuestionIndex < allQuestions.length - 1}
          />
        </div>
      </div>

      {/* Submit confirmation dialog */}
      <ExamSubmitDialog
        isOpen={showSubmitDialog}
        progress={progress}
        totalQuestions={allQuestions.length}
        flaggedCount={flaggedQuestions.size}
        onConfirm={handleConfirmSubmit}
        onCancel={handleCancelSubmit}
        error={submitError}
      />
    </div>
  );
}
