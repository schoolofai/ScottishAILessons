"use client";

import React, { useState, useEffect } from 'react';
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
import { useAppwrite } from '@/lib/appwrite';
import { getReviewRecommendations, getReviewStats, type ReviewRecommendation, type ReviewStats } from '@/lib/services/spaced-repetition-service';

interface SpacedRepetitionPanelProps {
  studentId: string;
  courseId: string;
  onStartReview: (lessonTemplateId: string) => void;
  maxRecommendations?: number;
}

export function SpacedRepetitionPanel({
  studentId,
  courseId,
  onStartReview,
  maxRecommendations = 5
}: SpacedRepetitionPanelProps) {
  const [recommendations, setRecommendations] = useState<ReviewRecommendation[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { databases } = useAppwrite();

  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations();
  }, [studentId, courseId]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[SpacedRepetitionPanel] Loading recommendations for:', { studentId, courseId });

      const [recs, reviewStats] = await Promise.all([
        getReviewRecommendations(studentId, courseId, databases, maxRecommendations),
        getReviewStats(studentId, courseId, databases)
      ]);

      setRecommendations(recs);
      setStats(reviewStats);

      console.log('[SpacedRepetitionPanel] Loaded:', {
        recommendations: recs.length,
        overdueOutcomes: reviewStats.totalOverdueOutcomes
      });

    } catch (err) {
      console.error('[SpacedRepetitionPanel] Failed to load recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load review recommendations');
    } finally {
      setLoading(false);
    }
  };

  // Urgency badge styling
  const getUrgencyBadge = (level: 'critical' | 'high' | 'medium' | 'low') => {
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
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCwIcon className="h-5 w-5 animate-spin" />
            Loading Review Recommendations...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangleIcon className="h-5 w-5" />
            Error Loading Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={loadRecommendations}
            variant="outline"
            className="mt-4"
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No reviews needed
  if (recommendations.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircleIcon className="h-5 w-5" />
            All Caught Up!
          </CardTitle>
          <CardDescription>
            No reviews needed right now. Great work staying on top of your learning!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-green-700">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="h-4 w-4" />
              <span>Keep up the momentum</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenIcon className="h-5 w-5" />
              Review Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.totalOverdueOutcomes}
                </div>
                <div className="text-sm text-gray-600">Overdue Topics</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.criticalCount}
                </div>
                <div className="text-sm text-gray-600">Need Practice</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.recommendedLessons}
                </div>
                <div className="text-sm text-gray-600">Lessons to Review</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.estimatedReviewTime}m
                </div>
                <div className="text-sm text-gray-600">Est. Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5" />
            Recommended Reviews ({recommendations.length})
          </CardTitle>
          <CardDescription>
            Lessons recommended based on spaced repetition for optimal retention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <ReviewLessonCard
                key={rec.lessonTemplateId}
                recommendation={rec}
                rank={index + 1}
                onStartReview={onStartReview}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
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
