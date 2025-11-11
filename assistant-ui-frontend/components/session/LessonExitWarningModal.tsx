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
import { AlertTriangle } from "lucide-react";

interface LessonExitWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLeave: () => void;
}

/**
 * Modal that warns students when they try to leave an active lesson session
 *
 * Shows a confirmation dialog explaining that:
 * - All progress will be lost
 * - The session will not be saved
 * - They can choose to stay and continue
 *
 * @param open - Whether the modal is visible
 * @param onOpenChange - Callback when modal visibility changes
 * @param onConfirmLeave - Callback when user confirms they want to leave
 */
export function LessonExitWarningModal({
  open,
  onOpenChange,
  onConfirmLeave
}: LessonExitWarningModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <DialogTitle>Leave Lesson?</DialogTitle>
          </div>
          <DialogDescription className="pt-3">
            Are you sure you want to leave this lesson? You will lose all progress from this session.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 my-2">
          <p className="text-sm text-orange-800">
            <strong>Warning:</strong> Your answers and conversation will not be saved.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            Stay and Continue
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmLeave}
            className="flex-1 sm:flex-none"
          >
            Leave Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
