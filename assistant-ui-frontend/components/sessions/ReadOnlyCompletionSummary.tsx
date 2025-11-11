"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrophyIcon,
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

type ReadOnlyCompletionSummaryProps = {
  summary: string;
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
  lesson_title: string;
  total_cards: number;
  cards_completed: number;
  retry_recommended: boolean;
  timestamp: string;
};

/**
 * Read-only completion summary component for session replay
 * Displays performance metrics and feedback without interactive elements
 */
export function ReadOnlyCompletionSummary({
  summary,
  performance_analysis,
  evidence,
  lesson_title,
  total_cards,
  retry_recommended,
  timestamp
}: ReadOnlyCompletionSummaryProps) {
  const [selectedTab, setSelectedTab] = useState("performance");

  const accuracyPercentage = Math.round(performance_analysis.overall_accuracy * 100);
  const firstAttemptPercentage = Math.round(performance_analysis.first_attempt_success * 100);
  const correct_answers = evidence.filter(item => item.correct).length;

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
    <Card className="w-full max-w-5xl mx-auto shadow-lg border-2 border-gray-200">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b-2 border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrophyIcon className="w-6 h-6 text-yellow-500" />
            {lesson_title} - Completed!
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {correct_answers}/{total_cards} Correct
            </Badge>
            {retry_recommended && (
              <Badge variant="secondary" className="text-orange-600">
                <AlertTriangleIcon className="w-3 h-3 mr-1" />
                Retry Was Suggested
              </Badge>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-600 mt-2">
          Completed: {new Date(timestamp).toLocaleString()}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Main performance overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-white border-2 border-gray-200">
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

          <Card className="p-4 bg-white border-2 border-gray-200">
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

          <Card className="p-4 bg-white border-2 border-gray-200">
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

        {/* Tabbed detailed view */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance">
              <BarChartIcon className="w-4 h-4 mr-1" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="summary">
              <BookOpenIcon className="w-4 h-4 mr-1" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="strengths">
              <CheckCircleIcon className="w-4 h-4 mr-1" />
              Strengths
            </TabsTrigger>
            <TabsTrigger value="challenges">
              <XCircleIcon className="w-4 h-4 mr-1" />
              Challenges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4 mt-4">
            <div className="space-y-3">
              {evidence.map((item, idx) => (
                <Card key={idx} className={`p-4 ${item.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {item.correct ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-red-600" />
                        )}
                        <span className="font-semibold">Card {idx + 1}</span>
                        <Badge variant="outline" className="ml-auto">
                          {item.attempts} {item.attempts === 1 ? 'Attempt' : 'Attempts'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Response:</strong> {item.response}
                      </div>
                      {item.feedback && (
                        <div className="text-sm text-gray-600 bg-white rounded p-2 border">
                          <strong>Feedback:</strong> {item.feedback}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="strengths" className="mt-4">
            <Card className="p-6 bg-green-50 border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5" />
                Strong Areas
              </h3>
              {performance_analysis.strong_areas.length > 0 ? (
                <ul className="space-y-2">
                  {performance_analysis.strong_areas.map((area, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span className="text-gray-800">{area}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 italic">No specific strengths identified</p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="challenges" className="mt-4">
            <Card className="p-6 bg-orange-50 border-orange-200">
              <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                <XCircleIcon className="w-5 h-5" />
                Challenge Areas
              </h3>
              {performance_analysis.challenge_areas.length > 0 ? (
                <ul className="space-y-2">
                  {performance_analysis.challenge_areas.map((area, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-600 font-bold">!</span>
                      <span className="text-gray-800">{area}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 italic">No specific challenges identified</p>
              )}
              {retry_recommended && (
                <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded">
                  <p className="text-sm text-orange-900 font-medium">
                    <AlertTriangleIcon className="w-4 h-4 inline mr-1" />
                    Retry was recommended to strengthen understanding in these areas.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Replay Notice */}
        <div className="bg-gray-100 rounded-lg p-3 border border-gray-300">
          <p className="text-sm text-gray-600 text-center italic">
            <ClockIcon className="w-4 h-4 inline mr-1" />
            Replay Mode - This is a recording of a completed lesson session
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
