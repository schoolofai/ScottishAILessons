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
import { Archive, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface UnenrollConfirmationModalProps {
  isOpen: boolean;
  courseName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Modal that confirms un-enrollment from a course with progress preservation message.
 *
 * Shows a confirmation dialog explaining that:
 * - The course will be archived (not deleted)
 * - All progress (SOWV2, MasteryV2, Sessions) will be preserved
 * - Student can re-enroll anytime to restore progress
 *
 * @param isOpen - Whether the modal is visible
 * @param courseName - Name of the course being unenrolled from
 * @param onConfirm - Async callback when user confirms un-enrollment
 * @param onCancel - Callback when user cancels
 */
export function UnenrollConfirmationModal({
  isOpen,
  courseName,
  onConfirm,
  onCancel
}: UnenrollConfirmationModalProps) {
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  const handleConfirm = async () => {
    setIsUnenrolling(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Unenrollment failed:', error);
      throw error; // Fast fail, no fallback
    } finally {
      setIsUnenrolling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-blue-600" />
            <DialogTitle>Un-enroll from {courseName}?</DialogTitle>
          </div>
          <DialogDescription className="pt-3">
            You are about to un-enroll from this course. Don't worry - your progress is safe!
          </DialogDescription>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-2">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Your Progress is Preserved
          </h4>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>All your lesson progress and mastery scores will be saved</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Your personalized curriculum and learning data are preserved</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>You can re-enroll anytime to continue exactly where you left off</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-gray-600">
          The course will be moved to your archived courses and removed from your active dashboard.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isUnenrolling}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isUnenrolling}
            className="flex-1 sm:flex-none"
          >
            {isUnenrolling ? (
              <>
                <Archive className="h-4 w-4 mr-2 animate-pulse" />
                Un-enrolling...
              </>
            ) : (
              'Un-enroll'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
