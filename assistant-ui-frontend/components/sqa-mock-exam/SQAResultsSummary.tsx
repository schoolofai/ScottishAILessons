"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, TrendingUp, BookOpen } from "lucide-react";
import type { EvaluationResult, OverallResult, SectionResult } from "@/lib/sqa-mock-exam/types";

interface SQAResultsSummaryProps {
  overallResult: OverallResult;
  sectionResults: SectionResult[];
  encouragementMessage: string;
}

/**
 * SQAResultsSummary - Displays overall exam results in SQA format
 *
 * Shows:
 * - Overall grade with SQA band
 * - Section-by-section breakdown
 * - Performance summary
 * - Encouragement message
 */
export function SQAResultsSummary({
  overallResult,
  sectionResults,
  encouragementMessage,
}: SQAResultsSummaryProps) {
  // Determine grade color
  const gradeColors: Record<string, string> = {
    A: "bg-green-100 text-green-800 border-green-300",
    B: "bg-blue-100 text-blue-800 border-blue-300",
    C: "bg-yellow-100 text-yellow-800 border-yellow-300",
    D: "bg-orange-100 text-orange-800 border-orange-300",
    "No Award": "bg-red-100 text-red-800 border-red-300",
  };

  const gradeColor = gradeColors[overallResult.grade] || gradeColors["No Award"];

  return (
    <div className="space-y-6">
      {/* Main grade card */}
      <Card className={`border-2 ${gradeColor.split(" ")[2]}`}>
        <CardContent className="pt-6">
          <div className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <div
              className={`inline-block px-6 py-3 rounded-full text-3xl font-bold ${gradeColor}`}
            >
              Grade {overallResult.grade}
            </div>
            <div className="mt-4 text-2xl font-semibold">
              {overallResult.marks_earned} / {overallResult.marks_possible} marks
            </div>
            <div className="text-xl text-gray-600">
              {overallResult.percentage.toFixed(1)}%
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <Progress value={overallResult.percentage} className="h-3" />
          </div>

          {/* Grade bands */}
          {overallResult.grade_band && (
            <div className="mt-6 grid grid-cols-5 gap-2 text-xs text-center">
              <div className="p-2 bg-red-50 rounded">
                <div className="font-medium">No Award</div>
                <div className="text-gray-500">0-39%</div>
              </div>
              <div className="p-2 bg-orange-50 rounded">
                <div className="font-medium">D</div>
                <div className="text-gray-500">40-54%</div>
              </div>
              <div className="p-2 bg-yellow-50 rounded">
                <div className="font-medium">C</div>
                <div className="text-gray-500">55-69%</div>
              </div>
              <div className="p-2 bg-blue-50 rounded">
                <div className="font-medium">B</div>
                <div className="text-gray-500">70-84%</div>
              </div>
              <div className="p-2 bg-green-50 rounded">
                <div className="font-medium">A</div>
                <div className="text-gray-500">85-100%</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{overallResult.performance_summary}</p>
          <p className="mt-4 text-blue-600 font-medium">{encouragementMessage}</p>
        </CardContent>
      </Card>

      {/* Section breakdown - only show when more than 1 section (multi-section legacy exams) */}
      {sectionResults && sectionResults.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Section Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sectionResults.map((section) => (
                <div key={section.section_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{section.section_name}</span>
                    <span className="text-sm text-gray-600">
                      {section.marks_earned} / {section.marks_possible} ({section.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={section.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
