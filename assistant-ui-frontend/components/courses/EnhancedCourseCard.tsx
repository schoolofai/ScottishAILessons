'use client';

import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MiniProgressRing } from '../progress/MiniProgressRing';
import { ChevronRight, AlertCircle } from 'lucide-react';

/**
 * Course data structure for the enhanced course card
 */
export interface EnhancedCourseData {
  id: string;
  subject: string;
  level: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  nextLessonTitle?: string;
  overdueLessons?: number;
  status: 'active' | 'completed' | 'paused';
}

interface EnhancedCourseCardProps {
  course: EnhancedCourseData;
  onClick: () => void;
}

/**
 * Map SQA levels to design system color tokens
 */
const LEVEL_COLORS: Record<string, string> = {
  'national-3': 'var(--level-n3, #22C55E)',
  'national-4': 'var(--level-n4, #3B82F6)',
  'national-5': 'var(--level-n5, #8B5CF6)',
  'higher': 'var(--level-higher, #F97316)',
  'advanced-higher': 'var(--level-adv-higher, #EF4444)',
};

/**
 * Map SQA levels to Tailwind badge classes
 */
const LEVEL_BADGE_CLASSES: Record<string, string> = {
  'national-3': 'bg-green-100 text-green-800 border-green-200',
  'national-4': 'bg-blue-100 text-blue-800 border-blue-200',
  'national-5': 'bg-purple-100 text-purple-800 border-purple-200',
  'higher': 'bg-orange-100 text-orange-800 border-orange-200',
  'advanced-higher': 'bg-red-100 text-red-800 border-red-200',
};

/**
 * Format subject name for display (e.g., "mathematics" -> "Mathematics")
 */
function formatSubjectName(subject: string): string {
  return subject
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format level name for display (e.g., "national-5" -> "National 5")
 */
function formatLevelName(level: string): string {
  return level
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * EnhancedCourseCard - A gamified course card for the dashboard grid view
 *
 * Features:
 * - Circular progress ring showing completion percentage
 * - SQA level color coding
 * - Lesson progress summary
 * - Next lesson indicator
 * - Overdue lessons warning badge
 * - Hover lift animation for gamified feel
 */
export function EnhancedCourseCard({ course, onClick }: EnhancedCourseCardProps) {
  const progressPercent = course.totalLessons > 0
    ? (course.completedLessons / course.totalLessons) * 100
    : 0;

  const levelKey = course.level.toLowerCase();
  const levelColor = LEVEL_COLORS[levelKey] || 'var(--wizard-blue, #1CB0F6)';
  const levelBadgeClass = LEVEL_BADGE_CLASSES[levelKey] || 'bg-gray-100 text-gray-800 border-gray-200';

  const isCompleted = course.status === 'completed' || progressPercent >= 100;

  return (
    <Card
      className="hover-lift cursor-pointer transition-all duration-300 h-full flex flex-col border-2 border-transparent hover:border-blue-200"
      data-testid="enhanced-course-card"
      data-course-id={course.id}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Progress Ring */}
          <MiniProgressRing
            percentage={progressPercent}
            color={isCompleted ? 'var(--wizard-green, #58CC02)' : levelColor}
            size={64}
          />

          {/* Course Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 truncate mb-1">
              {formatSubjectName(course.subject)}
            </h3>
            <Badge
              variant="outline"
              className={`${levelBadgeClass} text-xs font-medium border`}
            >
              {formatLevelName(course.level)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-2">
        {/* Lesson Count */}
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{course.completedLessons}</span>
          <span className="text-gray-400">/{course.totalLessons}</span>
          <span className="text-gray-500"> lessons completed</span>
        </p>

        {/* Next Lesson */}
        {course.nextLessonTitle && !isCompleted && (
          <p className="text-sm text-gray-500 truncate">
            <span className="text-gray-400">Next:</span>{' '}
            <span className="text-gray-700">{course.nextLessonTitle}</span>
          </p>
        )}

        {/* Completed Status */}
        {isCompleted && (
          <p className="text-sm text-green-600 font-medium">
            🎉 Course completed!
          </p>
        )}

        {/* Overdue Lessons Warning */}
        {(course.overdueLessons ?? 0) > 0 && !isCompleted && (
          <div className="mt-2">
            <Badge
              variant="destructive"
              className="bg-amber-100 text-amber-800 border border-amber-200 gap-1"
            >
              <AlertCircle className="h-3 w-3" />
              {course.overdueLessons} lesson{course.overdueLessons > 1 ? 's' : ''} overdue
            </Badge>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 press-effect"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {isCompleted ? 'Review Course' : 'Continue Learning'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export default EnhancedCourseCard;
