"use client";

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  ClockIcon,
  BookOpenIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  ChevronRightIcon
} from 'lucide-react';
import {
  type ReviewRecommendation,
  type ReviewStats,
  type UpcomingReview
} from '@/lib/services/spaced-repetition-service';

// ============================================================================
// Module-level helper function for urgency badges
// ============================================================================

/**
 * Returns a styled urgency badge based on review urgency level.
 * Moved to module level so both SpacedRepetitionPanel and ReviewLessonCard can use it.
 */
function getUrgencyBadge(level: 'critical' | 'high' | 'medium' | 'low') {
  const styles = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  const labels = {
    critical: '🔴 Critical',
    high: '🟠 High Priority',
    medium: '🟡 Medium',
    low: '🔵 Low'
  };

  return (
    <Badge variant="outline" className={styles[level]}>
      {labels[level]}
    </Badge>
  );
}

interface SpacedRepetitionPanelProps {
  data?: {
    recommendations: ReviewRecommendation[];
    stats: ReviewStats;
    upcomingReviews: UpcomingReview[];
  } | null;
  loading?: boolean;
  error?: string | null;
  onStartReview: (lessonTemplateId: string) => void;
  onRetry?: () => void;
}

export const SpacedRepetitionPanel = memo(function SpacedRepetitionPanel({
  data,
  loading = false,
  error = null,
  onStartReview,
  onRetry
}: SpacedRepetitionPanelProps) {
  // Extract data from props
  const recommendations = data?.recommendations || [];
  const stats = data?.stats || null;
  const upcomingReviews = data?.upcomingReviews || [];

  // Loading state
  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCwIcon className="h-4 w-4 animate-spin text-blue-600" />
              What to Review
            </CardTitle>
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex items-center justify-center">
          <div className="text-center text-gray-500 text-sm">
            <RefreshCwIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
            Loading reviews...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-red-600">
              <AlertTriangleIcon className="h-4 w-4" />
              What to Review
            </CardTitle>
            <span className="text-xs text-gray-500">Error</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col items-center justify-center gap-3">
          <Alert variant="destructive" className="w-full">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
            >
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Check if we have any content to show
  const hasNoContent = recommendations.length === 0 && upcomingReviews.length === 0;

  // No reviews at all (overdue or upcoming)
  if (hasNoContent) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClockIcon className="h-4 w-4 text-blue-600" />
              What to Review
            </CardTitle>
            <span className="text-xs text-gray-500">No reviews</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-1 overflow-hidden flex items-center justify-center">
          <div className="text-center text-gray-600">
            <BookOpenIcon className="h-10 w-10 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">
              No reviews scheduled yet.
            </p>
            <p className="text-xs mt-1 text-gray-500">
              Complete lessons to start building your review schedule
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClockIcon className="h-4 w-4 text-blue-600" />
            What to Review
          </CardTitle>
          <span className="text-xs text-gray-500">Next 2 weeks</span>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {/* Compact inline "Reviews Overdue" summary */}
        {stats && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b flex-shrink-0">
            <div className="font-medium text-xs text-gray-700">Reviews Overdue:</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-orange-600 font-semibold">{stats.totalOverdueOutcomes}</span>
                <span className="text-gray-600">Overdue Outcomes</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-red-600 font-semibold">{stats.criticalCount}</span>
                <span className="text-gray-600">Critical</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-blue-600 font-semibold">{stats.recommendedLessons}</span>
                <span className="text-gray-600">Lessons</span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable reviews list - unified compact style */}
        <div className="overflow-y-auto flex-1 divide-y" data-testid="spaced-repetition-content">
          {/* Overdue Lessons - Rendered FIRST for urgency */}
          {recommendations.map((rec) => (
            <OverdueReviewCard
              key={rec.lessonTemplateId}
              recommendation={rec}
              onStartReview={onStartReview}
              data-testid="overdue-lesson-card"
            />
          ))}

          {/* Upcoming Reviews */}
          {upcomingReviews.map((review) => (
            <UpcomingReviewCard
              key={review.lessonTemplateId}
              review={review}
              onStartReview={onStartReview}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Review Lesson Card Component
// ============================================================================

interface ReviewLessonCardProps {
  recommendation: ReviewRecommendation;
  rank: number;
  onStartReview: (lessonTemplateId: string) => void;
}

function ReviewLessonCard({ recommendation, rank, onStartReview }: ReviewLessonCardProps) {
  const {
    lessonTemplateId,
    lessonTitle,
    priority,
    overdueOutcomes,
    averageMastery,
    daysSinceCompleted,
    estimatedMinutes,
    urgencyLevel,
    recommendationReason
  } = recommendation;

  // Mastery percentage for display
  const masteryPercentage = Math.round(averageMastery * 100);

  // Mastery color
  const getMasteryColor = () => {
    if (averageMastery >= 0.8) return 'text-green-600';
    if (averageMastery >= 0.6) return 'text-blue-600';
    if (averageMastery >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid="overdue-lesson-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold">
              {rank}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{lessonTitle}</h3>
              <p className="text-sm text-gray-600">{recommendationReason}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-3 ml-11">
            {/* Urgency Badge */}
            {getUrgencyBadge(urgencyLevel)}

            {/* Mastery Level */}
            <div className="flex items-center gap-2">
              <TrendingUpIcon className={`h-4 w-4 ${getMasteryColor()}`} />
              <span className="text-sm font-medium">
                {masteryPercentage}% Mastery
              </span>
            </div>

            {/* Overdue Outcomes */}
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 text-orange-600" />
              <span className="text-sm">
                {overdueOutcomes.length} topic{overdueOutcomes.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-gray-600" />
              <span className="text-sm">{estimatedMinutes} min</span>
            </div>

            {/* Last Completed */}
            {daysSinceCompleted !== null && (
              <span className="text-xs text-gray-500">
                Last studied {daysSinceCompleted} days ago
              </span>
            )}
          </div>

          {/* Mastery Progress Bar */}
          <div className="ml-11">
            <Progress value={masteryPercentage} className="h-2" />
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => onStartReview(lessonTemplateId)}
          className="flex-shrink-0"
        >
          Review
          <ChevronRightIcon className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Overdue Review Card Component (Compact style matching UpcomingReviewCard)
// ============================================================================

interface OverdueReviewCardProps {
  recommendation: ReviewRecommendation;
  onStartReview: (lessonTemplateId: string) => void;
}

function OverdueReviewCard({ recommendation, onStartReview }: OverdueReviewCardProps) {
  const {
    lessonTemplateId,
    lessonTitle,
    overdueOutcomes,
    averageMastery,
    daysSinceCompleted,
    estimatedMinutes,
    urgencyLevel
  } = recommendation;

  // Mastery percentage for display
  const masteryPercentage = Math.round(averageMastery * 100);

  // Mastery color
  const getMasteryColor = () => {
    if (averageMastery >= 0.8) return 'text-green-600';
    if (averageMastery >= 0.6) return 'text-blue-600';
    if (averageMastery >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Urgency indicator (compact version)
  const getUrgencyIndicator = () => {
    const indicators = {
      critical: { color: 'text-red-600', label: 'Overdue' },
      high: { color: 'text-orange-600', label: 'Overdue' },
      medium: { color: 'text-yellow-600', label: 'Due' },
      low: { color: 'text-blue-600', label: 'Due' }
    };
    return indicators[urgencyLevel] || indicators.medium;
  };

  const urgency = getUrgencyIndicator();

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 transition-colors" data-testid="overdue-lesson-card">
      {/* Lesson Title (flexible, truncates) */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{lessonTitle}</h4>
      </div>

      {/* Overdue Status (compact) */}
      <div className={`flex items-center gap-1 text-xs whitespace-nowrap ${urgency.color}`}>
        <AlertTriangleIcon className="h-3 w-3" />
        <span>{urgency.label}</span>
      </div>

      {/* Mastery */}
      <div className="flex items-center gap-1 text-xs whitespace-nowrap">
        <TrendingUpIcon className={`h-3 w-3 ${getMasteryColor()}`} />
        <span className={getMasteryColor()}>{masteryPercentage}%</span>
      </div>

      {/* Topics Count */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <BookOpenIcon className="h-3 w-3" />
        <span>{overdueOutcomes.length}</span>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <ClockIcon className="h-3 w-3" />
        <span>{estimatedMinutes}m</span>
      </div>

      {/* Action Button (compact) */}
      <Button
        onClick={() => onStartReview(lessonTemplateId)}
        variant="outline"
        size="sm"
        className="flex-shrink-0 h-7 text-xs"
      >
        Review
      </Button>
    </div>
  );
}

// ============================================================================
// Upcoming Review Card Component
// ============================================================================

interface UpcomingReviewCardProps {
  review: UpcomingReview;
  onStartReview: (lessonTemplateId: string) => void;
}

function UpcomingReviewCard({ review, onStartReview }: UpcomingReviewCardProps) {
  const {
    lessonTemplateId,
    lessonTitle,
    dueDate,
    daysUntilDue,
    outcomes,
    averageMastery,
    estimatedMinutes
  } = review;

  // Format due date (compact format)
  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric'
  });

  // Mastery percentage for display
  const masteryPercentage = Math.round(averageMastery * 100);

  // Mastery color
  const getMasteryColor = () => {
    if (averageMastery >= 0.8) return 'text-green-600';
    if (averageMastery >= 0.6) return 'text-blue-600';
    if (averageMastery >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 transition-colors">
      {/* Lesson Title (flexible, truncates) */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{lessonTitle}</h4>
      </div>

      {/* Due Date (compact) */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <span>Due {daysUntilDue}d</span>
        <span className="text-gray-400">({formattedDueDate})</span>
      </div>

      {/* Mastery */}
      <div className="flex items-center gap-1 text-xs whitespace-nowrap">
        <TrendingUpIcon className={`h-3 w-3 ${getMasteryColor()}`} />
        <span className={getMasteryColor()}>{masteryPercentage}%</span>
      </div>

      {/* Topics Count */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <BookOpenIcon className="h-3 w-3" />
        <span>{outcomes.length}</span>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <ClockIcon className="h-3 w-3" />
        <span>{estimatedMinutes}m</span>
      </div>

      {/* Action Button (compact) */}
      <Button
        onClick={() => onStartReview(lessonTemplateId)}
        variant="outline"
        size="sm"
        className="flex-shrink-0 h-7 text-xs"
      >
        Review
      </Button>
    </div>
  );
}
