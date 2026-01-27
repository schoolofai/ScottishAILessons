'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";

interface SessionExpiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartFresh: () => void;
  onBackToDashboard: () => void;
}

/**
 * Modal shown when a user tries to resume a lesson but the LangGraph thread has expired
 *
 * LangGraph threads expire after 7 days of inactivity. When a student tries to
 * continue a lesson after this period, we show this modal offering options to:
 * - Start the lesson fresh (creates new session)
 * - Return to the dashboard
 *
 * @param open - Whether the modal is visible
 * @param onOpenChange - Callback when modal visibility changes
 * @param onStartFresh - Callback when user chooses to start the lesson from scratch
 * @param onBackToDashboard - Callback when user chooses to return to dashboard
 */
export function SessionExpiredModal({
  open,
  onOpenChange,
  onStartFresh,
  onBackToDashboard
}: SessionExpiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <DialogTitle>Session Expired</DialogTitle>
          </div>
          <DialogDescription className="pt-3">
            Your lesson session has expired after 7 days of inactivity.
            Would you like to start this lesson from the beginning?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 my-2">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Previous progress from this session cannot be recovered,
            but your overall mastery level has been preserved.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onBackToDashboard}
            className="flex-1 sm:flex-none"
          >
            Back to Dashboard
          </Button>
          <Button
            onClick={onStartFresh}
            className="flex-1 sm:flex-none gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Start Fresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
