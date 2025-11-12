'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Clock, RefreshCw, AlertCircle, Sparkles, ChevronRightIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RecommendationCandidate {
  lessonTemplateId: string;
  title: string;
  priorityScore: number;
  reasons: string[];
  flags: string[];
}

export interface RecommendationMetadata {
  total_candidates: number;
  generated_at?: string;
  graph_run_id?: string;
  rubric?: string;
}

export interface RecommendationsData {
  available: boolean;
  candidates: RecommendationCandidate[];
  metadata: RecommendationMetadata;
  thread_id?: string;
  recommendations_ready: boolean;
}

export interface RecommendationSectionProps {
  courseId: string;
  recommendations?: RecommendationsData | null;
  loading?: boolean;
  error?: string | null;
  onStartLesson?: (lessonTemplateId: string) => void;
  onRetry?: () => void;
  className?: string;
  courseName?: string;
  startingLessonId?: string | null; // Track which lesson is currently being started
  variant?: 'default' | 'sidebar'; // Layout variant
}

export const RecommendationSection = memo(function RecommendationSection({
  courseId,
  recommendations,
  loading = false,
  error = null,
  onStartLesson,
  onRetry,
  className,
  courseName,
  startingLessonId = null,
  variant = 'default'
}: RecommendationSectionProps) {
  // Loading state
  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              What to Take Next
            </CardTitle>
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex items-center justify-center">
          <div className="text-center text-gray-500 text-sm">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
            Loading recommendations...
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
              <AlertCircle className="h-4 w-4" />
              What to Take Next
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
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // No recommendations available
  if (!recommendations?.available || !recommendations.candidates.length) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-blue-600" />
              What to Take Next
            </CardTitle>
            <span className="text-xs text-gray-500">No suggestions</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-1 overflow-hidden flex items-center justify-center">
          <div className="text-center text-gray-600">
            <Clock className="h-10 w-10 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">
              No recommendations available yet.
            </p>
            <p className="text-xs mt-1 text-gray-500">
              Check back later for personalized suggestions
            </p>
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use Card layout matching SpacedRepetitionPanel
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-600" />
            What to Take Next
          </CardTitle>
          <span className="text-xs text-gray-500">AI prioritized</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto">
        {/* Scrollable recommendations list */}
        <div className="divide-y">
          {recommendations.candidates.map((candidate, index) => (
            <CompactRecommendationCard
              key={candidate.lessonTemplateId}
              candidate={candidate}
              rank={index + 1}
              onStartLesson={onStartLesson}
              startingLessonId={startingLessonId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Compact Recommendation Card Component
// ============================================================================

interface CompactRecommendationCardProps {
  candidate: RecommendationCandidate;
  rank: number;
  onStartLesson?: (lessonTemplateId: string) => void;
  startingLessonId?: string | null;
}

function CompactRecommendationCard({
  candidate,
  rank,
  onStartLesson,
  startingLessonId
}: CompactRecommendationCardProps) {
  const { lessonTemplateId, title, priorityScore } = candidate;

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 transition-colors">
      {/* Rank indicator */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <span className="font-medium">#{rank}</span>
      </div>

      {/* Lesson Title (flexible, truncates) */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{title}</h4>
      </div>

      {/* Priority Score (compact) */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <Sparkles className="h-3 w-3" />
        <span>{(priorityScore || 0).toFixed(2)}</span>
      </div>

      {/* Estimated Duration */}
      <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
        <Clock className="h-3 w-3" />
        <span>30m</span>
      </div>

      {/* Action Button (compact) */}
      <Button
        onClick={() => onStartLesson?.(lessonTemplateId)}
        disabled={startingLessonId === lessonTemplateId}
        variant="outline"
        size="sm"
        className="flex-shrink-0 h-7 text-xs"
      >
        {startingLessonId === lessonTemplateId ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Starting...
          </>
        ) : (
          'Start'
        )}
      </Button>
    </div>
  );
}

export default RecommendationSection;