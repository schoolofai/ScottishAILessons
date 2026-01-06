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
import { AlertTriangle, Loader2 } from "lucide-react";

interface ResetConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isResetting: boolean;
}

/**
 * Confirmation modal for resetting a practice session.
 *
 * Warns the user that:
 * - Block progress will return to Block 1
 * - Difficulty will reset to Easy
 * - Session mastery will start at 0%
 *
 * @param open - Whether the modal is visible
 * @param onOpenChange - Callback when modal visibility changes
 * @param onConfirm - Callback when user confirms reset
 * @param isResetting - Loading state during reset operation
 */
export function ResetConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  isResetting,
}: ResetConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Reset Practice Session?</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This will clear all your progress for this lesson and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 my-2">
          <p className="text-sm text-orange-800">
            <strong>What will be reset:</strong>
          </p>
          <ul className="list-disc ml-5 mt-2 space-y-1 text-sm text-orange-800">
            <li>Block progress will return to Block 1</li>
            <li>Difficulty will reset to Easy</li>
            <li>Session mastery will start at 0%</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResetting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isResetting}
            className="flex-1 sm:flex-none gap-2"
          >
            {isResetting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isResetting ? 'Resetting...' : 'Reset Progress'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
