"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Send, X } from "lucide-react";

interface ExamSubmitDialogProps {
  isOpen: boolean;
  progress: { answered: number; total: number; percentComplete: number };
  totalQuestions: number;
  flaggedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  error: string | null;
}

/**
 * ExamSubmitDialog - Confirmation dialog before exam submission
 *
 * Shows summary of answered/flagged questions and confirms intent to submit.
 */
export function ExamSubmitDialog({
  isOpen,
  progress,
  totalQuestions,
  flaggedCount,
  onConfirm,
  onCancel,
  error,
}: ExamSubmitDialogProps) {
  const unanswered = totalQuestions - progress.answered;
  const hasWarnings = unanswered > 0 || flaggedCount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasWarnings && (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            Submit Exam?
          </DialogTitle>
          <DialogDescription>
            Please review your submission before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {progress.answered}
              </p>
              <p className="text-sm text-gray-500">Answered</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p
                className={`text-2xl font-bold ${
                  unanswered > 0 ? 'text-amber-600' : 'text-gray-400'
                }`}
              >
                {unanswered}
              </p>
              <p className="text-sm text-gray-500">Unanswered</p>
            </div>
          </div>

          {/* Warnings */}
          {unanswered > 0 && (
            <Alert variant="destructive" className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                You have {unanswered} unanswered {unanswered === 1 ? 'question' : 'questions'}.
                Unanswered questions will receive 0 marks.
              </AlertDescription>
            </Alert>
          )}

          {flaggedCount > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-700">
                You have {flaggedCount} flagged {flaggedCount === 1 ? 'question' : 'questions'} for review.
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Final confirmation */}
          <p className="text-sm text-gray-600 text-center">
            Once submitted, you cannot change your answers.
            Your exam will be graded immediately.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <X className="h-4 w-4" />
            Continue Exam
          </Button>
          <Button
            onClick={onConfirm}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Send className="h-4 w-4" />
            Submit Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
