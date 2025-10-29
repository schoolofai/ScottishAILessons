"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpenIcon, UserIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import ReactMarkdown from 'react-markdown';

type ReadOnlyLessonCardProps = {
  card_data: {
    id: string;
    title: string;
    explainer: string;
    explainer_plain: string;
    misconceptions?: Array<{
      id: string;
      misconception: string;
      clarification: string;
    }>;
    cfu: {
      type: "mcq" | "numeric" | "structured_response" | "short_text";
      id: string;
      stem: string;
      options?: string[];
      answerIndex?: number;
      expected?: number;
      tolerance?: number;
      money2dp?: boolean;
      hints?: string[];
      rubric: {
        total_points: number;
        criteria: Array<{
          description: string;
          points: number;
        }>;
      };
    };
  };
  card_index: number;
  total_cards: number;
  lesson_context: {
    lesson_title: string;
    student_name: string;
    progress: string;
  };
  student_response?: string;
  was_correct?: boolean;
  feedback?: string;
};

/**
 * Read-only lesson card component for session replay
 * Displays the card content and student's response without any interaction
 */
export function ReadOnlyLessonCard({
  card_data,
  card_index,
  total_cards,
  lesson_context,
  student_response,
  was_correct,
  feedback
}: ReadOnlyLessonCardProps) {
  const progressPercentage = Math.round(((card_index + 1) / total_cards) * 100);

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg border-2 border-gray-200 bg-white">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-sm">
            <BookOpenIcon className="w-4 h-4 mr-1" />
            Card {card_index + 1} of {total_cards}
          </Badge>
          <Badge variant="secondary">
            <UserIcon className="w-4 h-4 mr-1" />
            {lesson_context.student_name}
          </Badge>
        </div>

        <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-blue-600">📚</span>
          {card_data.title}
        </CardTitle>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Progress: {lesson_context.progress}</span>
            <span className="text-sm font-semibold text-blue-600">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-6 space-y-6">
        {/* Explainer Section */}
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
          <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
            💡 Explanation
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{card_data.explainer}</ReactMarkdown>
          </div>
        </div>

        {/* Misconceptions (if any) */}
        {card_data.misconceptions && card_data.misconceptions.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-400">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3">
              ⚠️ Common Misconceptions
            </h3>
            <div className="space-y-3">
              {card_data.misconceptions.map((item, idx) => (
                <div key={idx} className="bg-white rounded p-3 border border-yellow-200">
                  <p className="font-medium text-gray-800 mb-1">
                    ❌ {item.misconception}
                  </p>
                  <p className="text-sm text-gray-600">
                    ✅ {item.clarification}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CFU Question */}
        <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-400">
          <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
            🎯 Check for Understanding
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700 mb-4">
            <ReactMarkdown>{card_data.cfu.stem}</ReactMarkdown>
          </div>

          {/* Display answer format based on CFU type */}
          {card_data.cfu.type === "mcq" && card_data.cfu.options && (
            <div className="space-y-2">
              {card_data.cfu.options.map((option, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded border ${
                    student_response === String.fromCharCode(65 + idx)
                      ? was_correct
                        ? 'bg-green-100 border-green-400'
                        : 'bg-red-100 border-red-400'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <span className="text-gray-800">{option}</span>
                    {student_response === String.fromCharCode(65 + idx) && (
                      <Badge variant={was_correct ? "default" : "destructive"} className="ml-auto">
                        {was_correct ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {card_data.cfu.type === "numeric" && (
            <div className="bg-white rounded border-2 border-gray-300 p-3">
              <p className="text-sm text-gray-600 mb-2">Expected: {card_data.cfu.expected}</p>
              <p className="text-sm text-gray-600">Tolerance: ±{card_data.cfu.tolerance}</p>
            </div>
          )}
        </div>

        {/* Student Response */}
        {student_response && (
          <div className={`rounded-lg p-4 border-l-4 ${
            was_correct
              ? 'bg-green-50 border-green-400'
              : 'bg-red-50 border-red-400'
          }`}>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              {was_correct ? (
                <>
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  <span className="text-green-900">Student Answer (Correct)</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="w-5 h-5 text-red-600" />
                  <span className="text-red-900">Student Answer (Incorrect)</span>
                </>
              )}
            </h3>
            <p className="text-gray-800 font-medium">{student_response}</p>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="bg-indigo-50 rounded-lg p-4 border-l-4 border-indigo-400">
            <h3 className="text-lg font-semibold text-indigo-900 mb-2">
              📝 Feedback
            </h3>
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{feedback}</ReactMarkdown>
            </div>
          </div>
        )}

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
