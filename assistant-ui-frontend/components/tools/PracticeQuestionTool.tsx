"use client";

import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useSafeLangGraphInterruptState, useSafeLangGraphSendCommand } from "@/lib/replay/useSafeLangGraphHooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
  HelpCircleIcon,
  LightbulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SendIcon,
  SkipForwardIcon,
  SettingsIcon,
  PauseIcon,
} from "lucide-react";

type PracticeQuestionArgs = {
  question_id: string;
  block_id: string;
  block_title: string;
  difficulty: "easy" | "medium" | "hard";
  question_type: "mcq" | "numeric" | "structured_response";
  stem: string;
  options?: string[];
  hints: string[];
  questions_at_difficulty: number;
  correct_at_difficulty: number;
  mastery_score: number;
  can_set_difficulty: boolean;
  can_request_advance: boolean;
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

export const PracticeQuestionTool = makeAssistantToolUI<
  PracticeQuestionArgs,
  unknown
>({
  toolName: "practice_question",
  render: function PracticeQuestionUI({ args }) {
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();

    const [answer, setAnswer] = useState("");
    const [selectedOption, setSelectedOption] = useState<string>("");
    const [showHints, setShowHints] = useState(false);
    const [currentHintIndex, setCurrentHintIndex] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    if (!interrupt) return null;

    const {
      question_id,
      block_id,
      block_title,
      difficulty,
      question_type,
      stem,
      options,
      hints,
      questions_at_difficulty,
      correct_at_difficulty,
      mastery_score,
      can_set_difficulty,
      can_request_advance,
      progress,
    } = args;

    const handleSubmit = () => {
      const studentResponse = question_type === "mcq" ? selectedOption : answer;
      sendCommand({
        resume: JSON.stringify({
          action: "submit",
          student_response: studentResponse,
          question_id,
        }),
      });
    };

    const handleSetDifficulty = (diff: "easy" | "medium" | "hard") => {
      sendCommand({
        resume: JSON.stringify({
          action: "set_difficulty",
          difficulty: diff,
        }),
      });
    };

    const handleAdvanceBlock = () => {
      sendCommand({
        resume: JSON.stringify({
          action: "advance_block",
        }),
      });
    };

    const handlePauseSession = () => {
      sendCommand({
        resume: JSON.stringify({
          action: "pause_session",
        }),
      });
    };

    const showNextHint = () => {
      if (currentHintIndex < hints.length - 1) {
        setCurrentHintIndex(currentHintIndex + 1);
      }
    };

    const getDifficultyColor = (diff: string) => {
      switch (diff) {
        case "easy":
          return "bg-green-100 text-green-800";
        case "medium":
          return "bg-yellow-100 text-yellow-800";
        case "hard":
          return "bg-red-100 text-red-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    const accuracyAtDifficulty = questions_at_difficulty > 0
      ? Math.round((correct_at_difficulty / questions_at_difficulty) * 100)
      : 0;

    const isAnswerValid = question_type === "mcq"
      ? selectedOption !== ""
      : answer.trim().length > 0;

    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">{block_title}</span>
              <span className="text-sm text-gray-500">
                {Math.round(mastery_score * 100)}% mastery
              </span>
            </div>
            <Progress value={mastery_score * 100} className="h-2" />
          </div>

          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HelpCircleIcon className="w-6 h-6 text-purple-500" />
              Practice Question
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={getDifficultyColor(difficulty)}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </Badge>
              {questions_at_difficulty > 0 && (
                <Badge variant="outline">
                  {correct_at_difficulty}/{questions_at_difficulty} correct
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Question Stem */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-lg text-gray-900 whitespace-pre-wrap">{stem}</p>
          </div>

          {/* Answer Input based on question type */}
          <div className="space-y-4">
            {question_type === "mcq" && options && (
              <RadioGroup
                value={selectedOption}
                onValueChange={setSelectedOption}
                className="space-y-3"
              >
                {options.map((option, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <RadioGroupItem value={String(idx)} id={`option-${idx}`} />
                    <Label
                      htmlFor={`option-${idx}`}
                      className="flex-1 cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question_type === "numeric" && (
              <div>
                <Label htmlFor="numeric-answer">Your answer:</Label>
                <Input
                  id="numeric-answer"
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter your numeric answer..."
                  className="mt-2"
                />
              </div>
            )}

            {question_type === "structured_response" && (
              <div>
                <Label htmlFor="text-answer">Your answer:</Label>
                <Textarea
                  id="text-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={4}
                  className="mt-2"
                />
              </div>
            )}
          </div>

          {/* Hints Section */}
          {hints.length > 0 && (
            <Collapsible open={showHints} onOpenChange={setShowHints}>
              <CollapsibleTrigger className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                <LightbulbIcon className="w-4 h-4" />
                <span>Need a hint?</span>
                {showHints ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {hints.slice(0, currentHintIndex + 1).map((hint, idx) => (
                  <div
                    key={idx}
                    className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded"
                  >
                    <p className="text-sm text-gray-700">
                      <strong>Hint {idx + 1}:</strong> {hint}
                    </p>
                  </div>
                ))}
                {currentHintIndex < hints.length - 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={showNextHint}
                    className="text-yellow-700"
                  >
                    Show another hint ({hints.length - currentHintIndex - 1} remaining)
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Settings & Controls */}
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
                      Change difficulty:
                    </label>
                    <Select
                      value={difficulty}
                      onValueChange={(value: "easy" | "medium" | "hard") =>
                        handleSetDifficulty(value)
                      }
                    >
                      <SelectTrigger className="w-full max-w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {can_request_advance && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAdvanceBlock}
                      className="flex items-center gap-1"
                    >
                      <SkipForwardIcon className="w-4 h-4" />
                      Skip to next concept
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePauseSession}
                    className="flex items-center gap-1"
                  >
                    <PauseIcon className="w-4 h-4" />
                    Pause session
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!isAnswerValid}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <SendIcon className="w-5 h-5" />
              Submit Answer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  },
});
