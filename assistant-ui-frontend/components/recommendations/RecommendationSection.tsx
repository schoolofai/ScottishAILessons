'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { ReasonBadgeList } from './ReasonBadge';
import { Loader2, Play, Clock, RefreshCw, AlertCircle } from 'lucide-react';
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
}

export function RecommendationSection({
  courseId,
  recommendations,
  loading = false,
  error = null,
  onStartLesson,
  onRetry,
  className
}: RecommendationSectionProps) {
  // Loading state
  if (loading) {
    return (
      <div
        className={cn("flex items-center justify-center py-8", className)}
        data-testid="recommendations-loading"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading recommendations...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn("space-y-4", className)}
        data-testid="recommendations-error"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="w-full"
            data-testid="recommendations-retry"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // No recommendations available
  if (!recommendations?.available || !recommendations.candidates.length) {
    return (
      <div
        className={cn("text-center py-8 space-y-4", className)}
        data-testid="recommendations-empty-state"
      >
        <Clock className="h-12 w-12 mx-auto text-gray-300" />
        <div>
          <p className="text-gray-500 mb-2">No recommendations available</p>
          <p className="text-sm text-gray-400">
            Check back later for personalized lesson suggestions
          </p>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  const topPick = recommendations.candidates[0];
  const otherCandidates = recommendations.candidates.slice(1);

  return (
    <div className={cn("space-y-6", className)} data-testid="recommendations-section">
      {/* Top Pick */}
      <div
        className="border border-blue-200 bg-blue-50 rounded-lg p-6"
        data-testid="top-pick-card"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Top Pick Badge and Score */}
            <div className="flex items-center space-x-3 mb-3">
              <span
                className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium"
                data-testid="top-pick-badge"
              >
                Top Pick
              </span>
              <span
                className="text-sm text-gray-600"
                data-testid="priority-score"
              >
                {Math.round(topPick.priorityScore * 100)}% Priority
              </span>
            </div>

            {/* Top Pick Title */}
            <h3
              className="text-lg font-semibold text-gray-900 mb-3"
              data-testid="top-pick-title"
            >
              {topPick.title}
            </h3>

            {/* Reason Badges */}
            {topPick.reasons && topPick.reasons.length > 0 && (
              <ReasonBadgeList
                reasons={topPick.reasons}
                className="mb-4"
                maxDisplay={3}
              />
            )}
          </div>

          {/* Start Lesson Button */}
          <Button
            onClick={() => onStartLesson?.(topPick.lessonTemplateId)}
            className="flex items-center px-6 py-2"
            data-testid="top-pick-start-button"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Lesson
          </Button>
        </div>
      </div>

      {/* Other Candidates */}
      {otherCandidates.length > 0 && (
        <div className="space-y-3">
          {otherCandidates.map((candidate, index) => (
            <div
              key={candidate.lessonTemplateId}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              data-testid={`candidate-card-${index + 1}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {/* Candidate Title */}
                  <h4 className="font-medium text-gray-900 mb-1">
                    {candidate.title}
                  </h4>

                  {/* Priority Score */}
                  <p className="text-sm text-gray-600 mb-2">
                    {Math.round(candidate.priorityScore * 100)}% Priority
                  </p>

                  {/* Reason Badges */}
                  {candidate.reasons && candidate.reasons.length > 0 && (
                    <ReasonBadgeList
                      reasons={candidate.reasons}
                      maxDisplay={2}
                      showTooltips={false}
                    />
                  )}
                </div>

                {/* Start Button */}
                <Button
                  variant="outline"
                  onClick={() => onStartLesson?.(candidate.lessonTemplateId)}
                  className="flex items-center"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metadata */}
      {recommendations.metadata && (
        <div
          className="text-xs text-gray-500 border-t pt-4"
          data-testid="recommendations-metadata"
        >
          <div className="flex items-center justify-between">
            <span>
              {recommendations.metadata.total_candidates} recommendations available
            </span>
            {recommendations.metadata.generated_at && (
              <span>
                Generated {new Date(recommendations.metadata.generated_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {recommendations.metadata.rubric && (
            <div className="mt-2">
              <details className="group">
                <summary
                  className="cursor-pointer text-blue-600 hover:text-blue-800"
                  data-testid="recommendation-rubric"
                >
                  View recommendation criteria
                </summary>
                <div className="mt-1 text-xs text-gray-600 font-mono">
                  {recommendations.metadata.rubric}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RecommendationSection;