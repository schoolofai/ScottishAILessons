"use client";

import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useSafeLangGraphInterruptState, useSafeLangGraphSendCommand } from "@/lib/replay/useSafeLangGraphHooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircleIcon,
  XCircleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LightbulbIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  SkipForwardIcon,
  SettingsIcon,
  StarIcon,
} from "lucide-react";

type PracticeFeedbackArgs = {
  is_correct: boolean;
  feedback: string;
  partial_credit?: number;
  correct_answer: string;
  explanation: string;
  misconception_detected?: string | null;
  new_mastery_score: number;
  difficulty_changing: boolean;
  next_difficulty?: "easy" | "medium" | "hard" | null;
  block_complete: boolean;
  can_request_advance: boolean;
  can_set_difficulty: boolean;
  block_title: string;
  progress: {
    session_id: string;
    total_blocks: number;
    completed_blocks: number;
    current_block_index: number;
    overall_mastery: number;
    blocks: {
      block_id: string;
      mastery_score: number;
      is_complete: boolean;
    }[];
  };
};

export const PracticeFeedbackTool = makeAssistantToolUI<
  PracticeFeedbackArgs,
  unknown
>({
  toolName: "practice_feedback",
  render: function PracticeFeedbackUI({ args }) {
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();

    const [showExplanation, setShowExplanation] = useState(!args.is_correct);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedDifficulty, setSelectedDifficulty] = useState<
      "easy" | "medium" | "hard" | null
    >(null);

    if (!interrupt) return null;

    const {
      is_correct,
      feedback,
      partial_credit,
      correct_answer,
      explanation,
      misconception_detected,
      new_mastery_score,
      difficulty_changing,
      next_difficulty,
      block_complete,
      can_request_advance,
      can_set_difficulty,
      block_title,
      progress,
    } = args;

    const handleContinue = () => {
      const payload: Record<string, unknown> = { action: "continue" };
      if (selectedDifficulty) {
        payload.difficulty_override = selectedDifficulty;
      }
      sendCommand({ resume: JSON.stringify(payload) });
    };

    const handleAdvanceBlock = () => {
      sendCommand({
        resume: JSON.stringify({ action: "advance_block" }),
      });
    };

    const getDifficultyColor = (diff: string) => {
      switch (diff) {
        case "easy":
          return "text-green-600";
        case "medium":
          return "text-yellow-600";
        case "hard":
          return "text-red-600";
        default:
          return "text-gray-600";
      }
    };

    const hasPartialCredit = partial_credit !== undefined && partial_credit > 0 && partial_credit < 1;

    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">{block_title}</span>
              <span className="text-sm text-gray-500">
                {Math.round(new_mastery_score * 100)}% mastery
              </span>
            </div>
            <Progress value={new_mastery_score * 100} className="h-2" />
          </div>

          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {is_correct ? (
                <>
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                  <span className="text-green-700">Correct!</span>
                </>
              ) : hasPartialCredit ? (
                <>
                  <StarIcon className="w-6 h-6 text-yellow-500" />
                  <span className="text-yellow-700">Partially Correct</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="w-6 h-6 text-red-500" />
                  <span className="text-red-700">Not Quite</span>
                </>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasPartialCredit && (
                <Badge variant="outline" className="text-yellow-600">
                  {Math.round(partial_credit * 100)}% credit
                </Badge>
              )}
              {block_complete && (
                <Badge className="bg-green-100 text-green-800">
                  Block Complete!
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Feedback Message */}
          <Alert
            className={
              is_correct
                ? "border-green-200 bg-green-50"
                : hasPartialCredit
                ? "border-yellow-200 bg-yellow-50"
                : "border-red-200 bg-red-50"
            }
          >
            <AlertDescription className="text-base">
              {feedback}
            </AlertDescription>
          </Alert>

          {/* Correct Answer (if wrong) */}
          {!is_correct && correct_answer && (
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <p className="font-medium text-blue-800 mb-1">Correct Answer:</p>
              <p className="text-gray-900">{correct_answer}</p>
            </div>
          )}

          {/* Misconception Alert */}
          {misconception_detected && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangleIcon className="w-5 h-5 text-orange-600" />
              <AlertDescription className="ml-2">
                <p className="font-medium text-orange-800">Common Misconception:</p>
                <p className="text-gray-700">{misconception_detected}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Explanation (collapsible) */}
          <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-left hover:bg-gray-50 rounded transition-colors">
              <LightbulbIcon className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">
                {is_correct ? "See the solution" : "Understanding the solution"}
              </span>
              {showExplanation ? (
                <ChevronUpIcon className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 ml-auto" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-2">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">{explanation}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Difficulty Change Notification */}
          {difficulty_changing && next_difficulty && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              {next_difficulty === "hard" || next_difficulty === "medium" ? (
                <TrendingUpIcon className="w-5 h-5 text-blue-600" />
              ) : (
                <TrendingDownIcon className="w-5 h-5 text-blue-600" />
              )}
              <span className="text-blue-800">
                {next_difficulty === "hard" || next_difficulty === "medium"
                  ? "Great progress! "
                  : "Let's practice more. "}
                Next question will be{" "}
                <span className={`font-semibold ${getDifficultyColor(next_difficulty)}`}>
                  {next_difficulty}
                </span>{" "}
                difficulty.
              </span>
            </div>
          )}

          {/* Block Completion Celebration */}
          {block_complete && (
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg text-center">
              <div className="text-2xl mb-2">🎉</div>
              <p className="font-semibold text-green-800">
                You&apos;ve mastered this concept!
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Moving on to the next block...
              </p>
            </div>
          )}

          {/* Settings & Controls */}
          {(can_set_difficulty || can_request_advance) && (
            <div className="border-t pt-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                <SettingsIcon className="w-4 h-4" />
                {showSettings ? "Hide options" : "More options"}
              </button>

              {showSettings && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-4">
                  {can_set_difficulty && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Override difficulty for next question:
                      </label>
                      <Select
                        value={selectedDifficulty || ""}
                        onValueChange={(value: "easy" | "medium" | "hard") =>
                          setSelectedDifficulty(value)
                        }
                      >
                        <SelectTrigger className="w-full max-w-[200px]">
                          <SelectValue placeholder="Keep adaptive" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {can_request_advance && (
                    <Button
                      variant="outline"
                      onClick={handleAdvanceBlock}
                      className="flex items-center gap-1"
                    >
                      <SkipForwardIcon className="w-4 h-4" />
                      Skip to next concept
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Continue Button */}
          <div className="pt-2">
            <Button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              {block_complete ? "Continue to Next Concept" : "Next Question"}
              <ChevronRightIcon className="w-5 h-5" />
            </Button>
          </div>

          {/* Encouragement Message */}
          <div className="text-center text-sm text-gray-600">
            {is_correct
              ? "🌟 Excellent work! Keep it up!"
              : hasPartialCredit
              ? "💪 You're on the right track!"
              : "📚 Every mistake is a learning opportunity!"}
          </div>
        </CardContent>
      </Card>
    );
  },
});
