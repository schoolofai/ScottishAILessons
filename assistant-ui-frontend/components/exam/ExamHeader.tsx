"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Send, X, AlertTriangle } from "lucide-react";

interface ExamHeaderProps {
  title: string;
  timeRemaining: string;
  timeStatus: 'normal' | 'warning' | 'critical';
  progress: { answered: number; total: number; percentComplete: number };
  totalQuestions: number;
  onSubmit: () => void;
  onExit: () => void;
}

/**
 * ExamHeader - Fixed header during exam showing timer and progress
 *
 * Displays:
 * - Exam title
 * - Countdown timer with color-coded status
 * - Progress bar
 * - Submit and exit buttons
 */
export function ExamHeader({
  title,
  timeRemaining,
  timeStatus,
  progress,
  totalQuestions,
  onSubmit,
  onExit,
}: ExamHeaderProps) {
  const timerStyles = {
    normal: 'text-gray-700 bg-gray-100',
    warning: 'text-amber-700 bg-amber-100',
    critical: 'text-red-700 bg-red-100 animate-pulse',
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Left: Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px] md:max-w-none">
          {title}
        </h1>
      </div>

      {/* Center: Progress */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="text-gray-700 font-medium">
              {progress.answered}/{totalQuestions} answered
            </span>
          </div>
          <Progress value={progress.percentComplete} className="h-2" />
        </div>
      </div>

      {/* Right: Timer and Actions */}
      <div className="flex items-center gap-3">
        {/* Timer */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${timerStyles[timeStatus]}`}>
          {timeStatus === 'critical' && (
            <AlertTriangle className="h-4 w-4" />
          )}
          <Clock className="h-4 w-4" />
          <span className="font-mono font-bold text-lg">{timeRemaining}</span>
        </div>

        {/* Submit Button */}
        <Button
          onClick={onSubmit}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Submit</span>
        </Button>

        {/* Exit Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onExit}
          className="text-gray-500 hover:text-red-600"
          title="Exit Exam"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
