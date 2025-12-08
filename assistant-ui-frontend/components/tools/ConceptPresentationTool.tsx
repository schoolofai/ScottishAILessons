"use client";

import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useSafeLangGraphInterruptState, useSafeLangGraphSendCommand } from "@/lib/replay/useSafeLangGraphHooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpenIcon,
  LightbulbIcon,
  ChevronRightIcon,
  SettingsIcon,
  CheckCircleIcon,
} from "lucide-react";

type ConceptPresentationArgs = {
  block_id: string;
  block_index: number;
  total_blocks: number;
  title: string;
  explanation: string;
  worked_example: {
    problem: string;
    solution_steps: string[];
    final_answer: string;
  };
  key_skills: string[];
  current_difficulty: "easy" | "medium" | "hard";
  difficulty_mode: "adaptive" | "fixed";
  can_set_difficulty: boolean;
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

export const ConceptPresentationTool = makeAssistantToolUI<
  ConceptPresentationArgs,
  unknown
>({
  toolName: "concept_presentation",
  render: function ConceptPresentationUI({ args }) {
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();
    const [selectedDifficulty, setSelectedDifficulty] = useState(args.current_difficulty);
    const [showSettings, setShowSettings] = useState(false);

    if (!interrupt) return null;

    const {
      block_id,
      block_index,
      total_blocks,
      title,
      explanation,
      worked_example,
      key_skills,
      current_difficulty,
      difficulty_mode,
      can_set_difficulty,
      progress,
    } = args;

    const handleContinue = () => {
      const payload: Record<string, unknown> = { action: "continue" };
      if (selectedDifficulty !== current_difficulty) {
        payload.difficulty_override = selectedDifficulty;
      }
      sendCommand({ resume: JSON.stringify(payload) });
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

    const overallProgress = (progress.completed_blocks / progress.total_blocks) * 100;

    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">
                Block {block_index + 1} of {total_blocks}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(progress.overall_mastery * 100)}% mastery
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            {/* Block indicators */}
            <div className="flex gap-1 mt-2">
              {progress.blocks.map((block, idx) => (
                <div
                  key={block.block_id}
                  className={`h-2 flex-1 rounded ${
                    block.is_complete
                      ? "bg-green-500"
                      : idx === block_index
                      ? "bg-blue-500"
                      : "bg-gray-200"
                  }`}
                  title={`Block ${idx + 1}: ${Math.round(block.mastery_score * 100)}%`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpenIcon className="w-6 h-6 text-blue-500" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={getDifficultyColor(current_difficulty)}>
                {current_difficulty.charAt(0).toUpperCase() + current_difficulty.slice(1)}
              </Badge>
              {difficulty_mode === "adaptive" && (
                <Badge variant="outline" className="text-blue-600">
                  Adaptive
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Concept Explanation */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <LightbulbIcon className="w-5 h-5" />
              Understanding the Concept
            </h3>
            <p className="text-gray-700 leading-relaxed">{explanation}</p>
          </div>

          {/* Worked Example */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Worked Example</h3>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-medium text-gray-700">Problem:</p>
                <p className="text-gray-900">{worked_example.problem}</p>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-gray-700">Solution:</p>
                {worked_example.solution_steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 pl-4"
                  >
                    <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-700">{step}</p>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 p-3 rounded flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <span className="font-medium">Answer: {worked_example.final_answer}</span>
              </div>
            </div>
          </div>

          {/* Key Skills */}
          {key_skills.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-sm text-gray-600">
                Skills you&apos;ll practice:
              </h3>
              <div className="flex flex-wrap gap-2">
                {key_skills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty Settings */}
          {can_set_difficulty && (
            <div className="border-t pt-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                <SettingsIcon className="w-4 h-4" />
                {showSettings ? "Hide settings" : "Adjust difficulty"}
              </button>

              {showSettings && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start at difficulty:
                  </label>
                  <Select
                    value={selectedDifficulty}
                    onValueChange={(value: "easy" | "medium" | "hard") =>
                      setSelectedDifficulty(value)
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
                  <p className="text-xs text-gray-500 mt-2">
                    {difficulty_mode === "adaptive"
                      ? "Difficulty will adjust based on your performance after this."
                      : "Difficulty is fixed at your selected level."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Continue Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              Start Practicing
              <ChevronRightIcon className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  },
});
