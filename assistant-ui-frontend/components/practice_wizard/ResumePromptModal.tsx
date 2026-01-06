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
import { PlayCircle, RotateCcw, Play, BookOpen, Target, Gauge } from "lucide-react";

interface ResumePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionData: {
    current_block_index: number;
    total_blocks: number;
    overall_mastery: number;
    current_difficulty: string;
  };
  onResume: () => void;
  onStartFresh: () => void;
  isStartingFresh?: boolean;
}

/**
 * Modal that prompts students when returning to a practice session with existing progress.
 *
 * Shows:
 * - Progress summary (current block, mastery percentage, difficulty)
 * - Option to resume from where they left off
 * - Option to start fresh (triggers full reset)
 *
 * @param open - Whether the modal is visible
 * @param onOpenChange - Callback when modal visibility changes
 * @param sessionData - Current session progress data
 * @param onResume - Callback when user chooses to resume
 * @param onStartFresh - Callback when user chooses to start fresh
 * @param isStartingFresh - Loading state when starting fresh
 */
export function ResumePromptModal({
  open,
  onOpenChange,
  sessionData,
  onResume,
  onStartFresh,
  isStartingFresh = false,
}: ResumePromptModalProps) {
  const masteryPercent = Math.round(sessionData.overall_mastery * 100);

  // Format difficulty for display
  const formatDifficulty = (difficulty: string): string => {
    return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-emerald-500" />
            <DialogTitle>Continue Your Practice?</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            You have an unfinished practice session. Would you like to pick up where you left off?
          </DialogDescription>
        </DialogHeader>

        {/* Progress Summary Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-lg p-4 my-2 border border-emerald-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Current Block */}
            <div className="flex flex-col items-center gap-1">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <div className="text-2xl font-bold text-emerald-600">
                {sessionData.current_block_index + 1}/{sessionData.total_blocks}
              </div>
              <div className="text-xs text-gray-500">Block</div>
            </div>

            {/* Mastery */}
            <div className="flex flex-col items-center gap-1">
              <Target className="w-4 h-4 text-cyan-500" />
              <div className="text-2xl font-bold text-cyan-600">
                {masteryPercent}%
              </div>
              <div className="text-xs text-gray-500">Mastery</div>
            </div>

            {/* Difficulty */}
            <div className="flex flex-col items-center gap-1">
              <Gauge className="w-4 h-4 text-violet-500" />
              <div className="text-2xl font-bold text-violet-600 capitalize">
                {formatDifficulty(sessionData.current_difficulty)}
              </div>
              <div className="text-xs text-gray-500">Difficulty</div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={onStartFresh}
            disabled={isStartingFresh}
            className="flex-1 sm:flex-none gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${isStartingFresh ? 'animate-spin' : ''}`} />
            {isStartingFresh ? 'Resetting...' : 'Start Fresh'}
          </Button>
          <Button
            onClick={onResume}
            disabled={isStartingFresh}
            className="flex-1 sm:flex-none gap-2 bg-emerald-500 hover:bg-emerald-600"
          >
            <Play className="w-4 h-4" />
            Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
