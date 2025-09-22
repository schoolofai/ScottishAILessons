'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { ReasonBadgeList } from './ReasonBadge';
import { Loader2, Play, Clock, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
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
}

export function RecommendationSection({
  courseId,
  recommendations,
  loading = false,
  error = null,
  onStartLesson,
  onRetry,
  className,
  courseName
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
    <div className={cn("bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-8", className)} data-testid="recommendations-section">
      {/* Header with Sparkle Icon */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Recommended for {courseName || 'Your Course'}
          </h2>
          <p className="text-sm text-gray-600">
            AI-powered suggestions based on your progress and spaced repetition
          </p>
        </div>
      </div>

      {/* Top Pick */}
      <div
        className="bg-white rounded-lg border-2 border-blue-300 p-4 mb-4"
        data-testid="top-pick-card"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Top Pick Badge and Score */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium"
                data-testid="top-pick-badge"
              >
                TOP PICK
              </span>
              <span
                className="text-sm font-medium text-gray-900"
                data-testid="priority-score"
              >
                Score: {(topPick.priorityScore || 0).toFixed(2)}
              </span>
            </div>

            {/* Top Pick Title */}
            <h3
              className="font-semibold text-gray-900 mb-1"
              data-testid="top-pick-title"
            >
              {topPick.title}
            </h3>

            {/* Reason Badges */}
            {topPick.reasons && topPick.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                <ReasonBadgeList
                  reasons={topPick.reasons}
                  maxDisplay={3}
                />
              </div>
            )}

            <p className="text-sm text-gray-600">
              Estimated time: 30 minutes
            </p>
          </div>

          {/* Start Lesson Button */}
          <Button
            onClick={() => onStartLesson?.(topPick.lessonTemplateId)}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="top-pick-start-button"
          >
            Start Now →
          </Button>
        </div>
      </div>

      {/* Priority List */}
      {otherCandidates.length > 0 && (
        <div className="space-y-3 mb-4">
          {otherCandidates.slice(0, 4).map((candidate, index) => (
            <div
              key={candidate.lessonTemplateId}
              className="bg-white rounded-lg border p-3 hover:border-blue-200 transition-colors"
              data-testid={`candidate-card-${index + 1}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-600">#{index + 2}</span>
                    <span className="text-sm text-gray-500">
                      Score: {(candidate.priorityScore || 0).toFixed(2)}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">{candidate.title}</h4>
                  {candidate.reasons && candidate.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <ReasonBadgeList
                        reasons={candidate.reasons}
                        maxDisplay={2}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => onStartLesson?.(candidate.lessonTemplateId)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Start
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation Explanation */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>How we recommend:</strong> {recommendations.metadata?.rubric || 'Overdue > Low Mastery > Early Order | -Recent -Too Long'}
        </p>
      </div>

    </div>
  );
}

export default RecommendationSection;