"use client";

import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useSafeLangGraphInterruptState } from "@/lib/replay/useSafeLangGraphHooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrophyIcon, 
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrendingUpIcon,
  TargetIcon,
  ClockIcon,
  BookOpenIcon,
  BarChartIcon,
  AlertTriangleIcon
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

type LessonSummaryPresentationArgs = {
  lesson_summary: string;
  performance_analysis: {
    overall_accuracy: number;
    first_attempt_success: number;
    average_attempts: number;
    strong_areas: string[];
    challenge_areas: string[];
    retry_recommended: boolean;
  };
  evidence: Array<{
    timestamp: string;
    item_id: string;
    response: string;
    correct: boolean;
    attempts: number;
    confidence: number;
    reasoning: string;
    feedback: string;
  }>;
  retry_recommended: boolean;
  completion_stats: {
    total_cards: number;
    correct_answers: number;
    average_attempts: number;
  };
  interaction_id: string;
  timestamp: string;
};

export const LessonSummaryPresentationTool = makeAssistantToolUI<
  LessonSummaryPresentationArgs,
  unknown
>({
  toolName: "lesson_summary_presentation",
  render: function LessonSummaryPresentationUI({ args, callTool, status }) {
    const interrupt = useSafeLangGraphInterruptState();

    const {
      lesson_summary,
      performance_analysis,
      evidence,
      retry_recommended,
      completion_stats
    } = args;

    const [selectedTab, setSelectedTab] = useState("summary");
    const isLoading = status.type === "executing";


    if (!interrupt) return null;

    const handleComplete = () => {
      callTool({
        action: "complete",
        interaction_type: "lesson_completion",
        performance_satisfaction: "satisfied",
        wants_retry: false,
        interaction_id: args.interaction_id,
        timestamp: new Date().toISOString()
      });
    };

    const handleRetry = () => {
      if (confirm("Are you sure you want to retry this lesson? Your current progress will be reset.")) {
        callTool({
          action: "retry_lesson",
          interaction_type: "lesson_retry",
          retry_reason: "student_choice",
          interaction_id: args.interaction_id,
          timestamp: new Date().toISOString()
        });
      }
    };

    const handleContinue = () => {
      callTool({
        action: "continue_learning",
        interaction_type: "continue_to_next",
        current_lesson_complete: true,
        interaction_id: args.interaction_id,
        timestamp: new Date().toISOString()
      });
    };

    const accuracyPercentage = Math.round(performance_analysis.overall_accuracy * 100);
    const firstAttemptPercentage = Math.round(performance_analysis.first_attempt_success * 100);

    const getPerformanceColor = (percentage: number) => {
      if (percentage >= 80) return "text-green-600";
      if (percentage >= 60) return "text-yellow-600";
      return "text-red-600";
    };

    const getPerformanceBadge = (percentage: number) => {
      if (percentage >= 80) return { variant: "default" as const, label: "Excellent" };
      if (percentage >= 60) return { variant: "secondary" as const, label: "Good" };
      return { variant: "destructive" as const, label: "Needs Practice" };
    };

    return (
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrophyIcon className="w-6 h-6 text-yellow-500" />
              Lesson Complete!
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {completion_stats.correct_answers}/{completion_stats.total_cards} Correct
              </Badge>
              {retry_recommended && (
                <Badge variant="secondary" className="text-orange-600">
                  <RefreshCwIcon className="w-3 h-3 mr-1" />
                  Retry Suggested
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Main performance overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TargetIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Overall Accuracy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${getPerformanceColor(accuracyPercentage)}`}>
                  {accuracyPercentage}%
                </div>
                <Badge variant={getPerformanceBadge(accuracyPercentage).variant}>
                  {getPerformanceBadge(accuracyPercentage).label}
                </Badge>
              </div>
              <Progress value={accuracyPercentage} className="mt-2" />
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">First Attempt Success</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${getPerformanceColor(firstAttemptPercentage)}`}>
                  {firstAttemptPercentage}%
                </div>
              </div>
              <Progress value={firstAttemptPercentage} className="mt-2" />
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Avg. Attempts per Card</span>
              </div>
              <div className="text-2xl font-bold">
                {performance_analysis.average_attempts.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {performance_analysis.average_attempts <= 1.5 ? "Excellent!" : 
                 performance_analysis.average_attempts <= 2.5 ? "Good effort!" : 
                 "Room for improvement"}
              </div>
            </Card>
          </div>

          {/* Retry recommendation */}
          {retry_recommended && (
            <Alert>
              <AlertTriangleIcon className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Consider retrying this lesson to strengthen your understanding:</p>
                  <ul className="text-sm list-disc ml-4 space-y-1">
                    <li>Your accuracy is below 70%, indicating some concepts need reinforcement</li>
                    <li>Multiple attempts were needed on several questions</li>
                    <li>Retrying will help solidify your knowledge before moving forward</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Detailed tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                  <ReactMarkdown>{lesson_summary}</ReactMarkdown>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              {/* Strong areas */}
              {performance_analysis.strong_areas.length > 0 && (
                <Card className="p-4 border-green-200 bg-green-50">
                  <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4" />
                    Your Strengths
                  </h3>
                  <ul className="space-y-1">
                    {performance_analysis.strong_areas.map((area, index) => (
                      <li key={index} className="text-green-700 text-sm">
                        • {area}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Challenge areas */}
              {performance_analysis.challenge_areas.length > 0 && (
                <Card className="p-4 border-orange-200 bg-orange-50">
                  <h3 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                    <TargetIcon className="w-4 h-4" />
                    Areas for Improvement
                  </h3>
                  <ul className="space-y-1">
                    {performance_analysis.challenge_areas.map((area, index) => (
                      <li key={index} className="text-orange-700 text-sm">
                        • {area}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="space-y-3">
                {evidence.map((item, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {item.correct ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircleIcon className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-medium text-sm">Question {index + 1}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.attempts} attempt{item.attempts !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <p><strong>Your answer:</strong> {item.response}</p>
                          <p><strong>Feedback:</strong> {item.feedback}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {Math.round(item.confidence * 100)}% confidence
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="progress" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChartIcon className="w-4 h-4" />
                    Performance Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Correct on First Try</span>
                        <span>{firstAttemptPercentage}%</span>
                      </div>
                      <Progress value={firstAttemptPercentage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Overall Accuracy</span>
                        <span>{accuracyPercentage}%</span>
                      </div>
                      <Progress value={accuracyPercentage} className="h-2" />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BookOpenIcon className="w-4 h-4" />
                    Learning Insights
                  </h3>
                  <div className="text-sm space-y-2">
                    <p>
                      <strong>Total Questions:</strong> {completion_stats.total_cards}
                    </p>
                    <p>
                      <strong>Correct Answers:</strong> {completion_stats.correct_answers}
                    </p>
                    <p>
                      <strong>Success Rate:</strong> {Math.round((completion_stats.correct_answers / completion_stats.total_cards) * 100)}%
                    </p>
                    <p>
                      <strong>Learning Status:</strong>{" "}
                      <span className={accuracyPercentage >= 70 ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                        {accuracyPercentage >= 70 ? "Mastery Achieved" : "Needs Review"}
                      </span>
                    </p>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex gap-3 pt-6 border-t">
            {retry_recommended && (
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCwIcon className="w-4 h-4" />
                Retry Lesson
              </Button>
            )}
            
            <Button
              variant="secondary"
              onClick={handleComplete}
              disabled={isLoading}
              className="flex-1"
            >
              Mark as Complete
            </Button>
            
            <Button
              onClick={handleContinue}
              disabled={isLoading}
              className="flex-1 flex items-center gap-2"
            >
              <span>Continue Learning</span>
              <TrophyIcon className="w-4 h-4" />
            </Button>
          </div>

          {/* Final encouraging message */}
          <div className="text-center text-sm text-gray-600 pt-4">
            {accuracyPercentage >= 80 ? (
              "🎉 Outstanding work! You've mastered this lesson beautifully!"
            ) : accuracyPercentage >= 60 ? (
              "👏 Good job! You've shown solid understanding of the concepts!"
            ) : (
              "💪 Great effort! Learning takes practice, and you're making progress!"
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
});