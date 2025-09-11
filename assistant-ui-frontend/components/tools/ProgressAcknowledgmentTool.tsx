"use client";

import React, { useState, useEffect, useCallback } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowRightIcon, 
  CheckCircleIcon, 
  TrendingUpIcon,
  StarIcon,
  ZapIcon
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

type ProgressAcknowledgmentArgs = {
  transition_message: string;
  progress_stats: {
    cards_completed: number;
    total_cards: number;
    accuracy: number;
    current_streak?: number;
  };
  next_card_preview?: {
    title: string;
    explainer: string;
  };
  interaction_id: string;
  timestamp: string;
};

export const ProgressAcknowledgmentTool = makeAssistantToolUI<
  ProgressAcknowledgmentArgs,
  unknown
>({
  toolName: "progress_acknowledgment",
  render: function ProgressAcknowledgmentUI({ args, callTool, status }) {
    const { transition_message, progress_stats, next_card_preview } = args;
    const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(10);
    const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

    const isLoading = status.type === "executing";
    const overallProgress = (progress_stats.cards_completed / progress_stats.total_cards) * 100;
    const accuracyPercentage = Math.round(progress_stats.accuracy * 100);

    // Auto-advance countdown
    useEffect(() => {
      let interval: NodeJS.Timeout;
      
      if (isAutoAdvancing && autoAdvanceCountdown > 0) {
        interval = setInterval(() => {
          setAutoAdvanceCountdown((prev) => {
            if (prev <= 1) {
              handleContinue();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }

      return () => {
        if (interval) clearInterval(interval);
      };
    }, [isAutoAdvancing, autoAdvanceCountdown, handleContinue]);

    const handleContinue = useCallback(() => {
      setIsAutoAdvancing(false);
      callTool({
        action: "continue",
        interaction_type: "progress_acknowledgment",
        acknowledged: true,
        auto_advanced: autoAdvanceCountdown === 0,
        interaction_id: args.interaction_id,
        timestamp: new Date().toISOString()
      });
    }, [callTool, autoAdvanceCountdown, args.interaction_id]);

    const handlePause = () => {
      setIsAutoAdvancing(false);
      // Don't continue automatically
    };

    const handleStartAutoAdvance = () => {
      setIsAutoAdvancing(true);
      setAutoAdvanceCountdown(10);
    };

    const getAccuracyColor = (accuracy: number) => {
      if (accuracy >= 80) return "text-green-600";
      if (accuracy >= 60) return "text-yellow-600";
      return "text-red-600";
    };

    const getAccuracyBadgeVariant = (accuracy: number) => {
      if (accuracy >= 80) return "default";
      if (accuracy >= 60) return "secondary";
      return "destructive";
    };

    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
              Card Complete!
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {progress_stats.cards_completed}/{progress_stats.total_cards} Cards
              </Badge>
              {progress_stats.current_streak && progress_stats.current_streak > 1 && (
                <Badge variant="default" className="bg-orange-500">
                  <ZapIcon className="w-3 h-3 mr-1" />
                  {progress_stats.current_streak} Streak!
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Transition message */}
          <div className="prose prose-sm max-w-none">
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
              <ReactMarkdown>{transition_message}</ReactMarkdown>
            </div>
          </div>

          {/* Progress statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overall progress */}
            <Card className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Lesson Progress</span>
                  <span className="text-sm text-gray-600">
                    {Math.round(overallProgress)}%
                  </span>
                </div>
                <Progress value={overallProgress} className="w-full" />
                <div className="text-xs text-gray-500 text-center">
                  {progress_stats.cards_completed} of {progress_stats.total_cards} cards completed
                </div>
              </div>
            </Card>

            {/* Accuracy stats */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Current Accuracy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${getAccuracyColor(accuracyPercentage)}`}>
                  {accuracyPercentage}%
                </div>
                <Badge variant={getAccuracyBadgeVariant(accuracyPercentage)}>
                  {accuracyPercentage >= 80 ? "Excellent" : 
                   accuracyPercentage >= 60 ? "Good" : "Keep Trying"}
                </Badge>
              </div>
            </Card>
          </div>

          {/* Achievement badges */}
          {(progress_stats.current_streak && progress_stats.current_streak >= 3) && (
            <div className="flex justify-center">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full flex items-center gap-2">
                <StarIcon className="w-4 h-4" />
                <span className="font-medium">
                  {progress_stats.current_streak >= 5 ? "Amazing Streak!" : "Great Streak!"}
                </span>
                <StarIcon className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Next card preview */}
          {next_card_preview && (
            <Card className="border-dashed border-2 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRightIcon className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-blue-700">Coming Up Next:</span>
                </div>
                <h4 className="font-semibold text-lg mb-2">{next_card_preview.title}</h4>
                <p className="text-sm text-gray-600">{next_card_preview.explainer}</p>
              </CardContent>
            </Card>
          )}

          {/* Auto-advance section */}
          {isAutoAdvancing && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ZapIcon className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-orange-700">
                      Auto-continuing in {autoAdvanceCountdown} seconds...
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handlePause}>
                    Pause
                  </Button>
                </div>
                <Progress 
                  value={((10 - autoAdvanceCountdown) / 10) * 100} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {!isAutoAdvancing && (
              <Button
                variant="outline"
                onClick={handleStartAutoAdvance}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <ZapIcon className="w-4 h-4" />
                Auto-Continue (10s)
              </Button>
            )}
            
            <Button
              onClick={handleContinue}
              disabled={isLoading}
              className="flex-1 flex items-center gap-2"
            >
              <span>Continue to Next Card</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Button>
          </div>

          {/* Motivational message */}
          <div className="text-center text-sm text-gray-600 pt-2">
            {accuracyPercentage >= 80 ? (
              "🌟 You're doing fantastic! Keep up the excellent work!"
            ) : accuracyPercentage >= 60 ? (
              "👍 Good progress! You're getting the hang of this!"
            ) : (
              "💪 Every step forward is progress! You're learning!"
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
});