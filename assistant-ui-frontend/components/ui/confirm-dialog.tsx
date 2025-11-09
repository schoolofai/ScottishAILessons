"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmDialogProps {
  /**
   * Controls dialog visibility
   */
  open: boolean;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Dialog description/message
   */
  message: string;

  /**
   * Confirm button text
   * @default "Confirm"
   */
  confirmText?: string;

  /**
   * Cancel button text
   * @default "Cancel"
   */
  cancelText?: string;

  /**
   * Confirm button variant (destructive for delete actions)
   * @default "default"
   */
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

  /**
   * Loading state (disable buttons during async operations)
   * @default false
   */
  loading?: boolean;

  /**
   * Callback when user confirms
   */
  onConfirm: () => void | Promise<void>;

  /**
   * Callback when user cancels
   */
  onCancel: () => void;
}

/**
 * Confirmation Dialog Component
 *
 * Reusable dialog for confirmation actions like delete, replace, etc.
 * Prevents accidental destructive actions by requiring user confirmation.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={showConfirm}
 *   title="Delete Diagram"
 *   message="Are you sure you want to delete this diagram? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmVariant="destructive"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowConfirm(false)}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing && !loading) {
      onCancel();
    }
  };

  const isDisabled = isProcessing || loading;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent showCloseButton={!isDisabled}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isDisabled}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isDisabled}
          >
            {isProcessing || loading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
