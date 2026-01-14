"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";

type AttemptStatus = "in_progress" | "submitted" | "graded" | "grading_error";

interface StatusBadgeProps {
  status: AttemptStatus;
}

/**
 * StatusBadge - Displays exam attempt status with icon
 *
 * States:
 * - in_progress: Blue (ongoing)
 * - submitted: Amber (awaiting grading)
 * - graded: Green (complete)
 * - grading_error: Red (failed)
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<
    AttemptStatus,
    { label: string; icon: React.ReactNode; className: string }
  > = {
    in_progress: {
      label: "In Progress",
      icon: <Clock className="h-3 w-3" />,
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    submitted: {
      label: "Grading...",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    graded: {
      label: "Graded",
      icon: <CheckCircle className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200",
    },
    grading_error: {
      label: "Error",
      icon: <AlertCircle className="h-3 w-3" />,
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };

  const { label, icon, className } = config[status] || config.graded;

  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {icon}
      {label}
    </Badge>
  );
}
