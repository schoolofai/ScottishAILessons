"use client";

import { Badge } from "@/components/ui/badge";
import type { Grade } from "@/lib/sqa-mock-exam/types";

interface GradeBadgeProps {
  grade: Grade;
  size?: "sm" | "default" | "lg";
}

/**
 * GradeBadge - Displays SQA grade with appropriate color coding
 *
 * Colors follow SQA grade semantics:
 * - A: Purple (Excellence)
 * - B: Blue (Good)
 * - C: Green (Pass)
 * - D: Amber (Marginal Pass)
 * - No Award: Red (Fail)
 */
export function GradeBadge({ grade, size = "default" }: GradeBadgeProps) {
  const gradeStyles: Record<Grade, string> = {
    A: "bg-purple-100 text-purple-800 border-purple-200",
    B: "bg-blue-100 text-blue-800 border-blue-200",
    C: "bg-green-100 text-green-800 border-green-200",
    D: "bg-amber-100 text-amber-800 border-amber-200",
    "No Award": "bg-red-100 text-red-800 border-red-200",
  };

  const sizeStyles = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge
      variant="outline"
      className={`font-semibold ${gradeStyles[grade]} ${sizeStyles[size]}`}
    >
      {grade}
    </Badge>
  );
}
