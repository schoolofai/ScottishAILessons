'use client';

import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ProgressRing } from './ProgressRing';
import { Button } from '../ui/button';
import { TrendingUp, Clock } from 'lucide-react';
import { CourseProgress } from '@/lib/services/progress-service';
import { getMasteryLabel, getMasteryColor } from '@/lib/services/progress-service';
import { CourseCheatSheetButton } from '../revision-notes/CourseCheatSheetButton';

interface CourseProgressCardProps {
  progress: CourseProgress;
  onViewDetails: () => void;
  cheatSheetAvailable?: boolean | null;
  courseId?: string;
}

export const CourseProgressCard = memo(function CourseProgressCard({ progress, onViewDetails, cheatSheetAvailable, courseId }: CourseProgressCardProps) {
  const masteryLabel = getMasteryLabel(progress.averageMastery);
  const masteryColor = getMasteryColor(progress.averageMastery);
  const hoursRemaining = Math.round(progress.estimatedTimeRemaining / 60);

  const isComplete = progress.progressPercentage === 100;

  return (
    <div
      className="bg-white rounded-lg shadow-md p-4 sm:p-6"
      role="region"
      aria-labelledby={`progress-heading-${progress.courseId}`}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4 gap-3">
        <div className="flex-1 min-w-0">
          <h3
            id={`progress-heading-${progress.courseId}`}
            className="text-base sm:text-lg font-semibold truncate"
          >
            {progress.courseName}
          </h3>
          {isComplete && (
            <span className="inline-flex items-center px-2 py-1 text-xs sm:text-sm bg-green-100 text-green-800 rounded-full mt-1">
              ✓ Completed
            </span>
          )}
        </div>

        <ProgressRing percentage={progress.progressPercentage} size={56} />
      </div>

      {/* Progress stats */}
      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-gray-600">Lessons</span>
          <span
            className="text-sm sm:text-base font-medium"
            aria-label={`${progress.completedLessons} of ${progress.totalLessons} lessons completed`}
          >
            {progress.completedLessons} / {progress.totalLessons}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-gray-600 flex items-center">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" aria-hidden="true" />
            Average Mastery
          </span>
          <span
            className="text-sm sm:text-base font-medium"
            style={{ color: masteryColor }}
            aria-label={`Average mastery: ${progress.averageMastery}`}
          >
            {progress.averageMastery.toFixed(2)} ({masteryLabel})
          </span>
        </div>

        {!isComplete && (
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600 flex items-center">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" aria-hidden="true" />
              Time Remaining
            </span>
            <span className="text-sm sm:text-base font-medium">~{hoursRemaining} hours</span>
          </div>
        )}

        {progress.lastActivity && (
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600">Last Activity</span>
            <span className="text-xs sm:text-sm">
              {formatDistanceToNow(new Date(progress.lastActivity), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <Button
          variant="outline"
          className="w-full text-sm"
          onClick={onViewDetails}
        >
          View Detailed Progress
        </Button>

        {courseId && (
          <CourseCheatSheetButton
            courseId={courseId}
            isAvailable={cheatSheetAvailable ?? null}
            onClick={() => {}}
            className="w-full justify-center"
            label="Cheat Sheet"
          />
        )}
      </div>
    </div>
  );
});
