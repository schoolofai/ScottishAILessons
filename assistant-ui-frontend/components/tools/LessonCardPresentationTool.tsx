"use client";

import React, { useState, useEffect } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  useSafeLangGraphInterruptState,
  useSafeLangGraphSendCommand
} from "@/lib/replay/useSafeLangGraphHooks";
import { useCurrentCard } from "@/contexts/CurrentCardContext";
import { useReplayMode } from "@/contexts/ReplayModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpenIcon, UserIcon, ClockIcon } from "lucide-react";
import ReactMarkdown from 'react-markdown';

type LessonCardPresentationArgs = {
  card_content: string;
  card_data: {
    id: string;
    title: string;
    explainer: string;
    explainer_plain: string;
    misconceptions: Array<{
      id: string;
      misconception: string;
      clarification: string;
    }>;
    context_hooks?: string[];
    cfu: {
      type: "mcq" | "numeric" | "structured_response" | "short_text";
      id: string;
      stem: string;
      // MCQ fields
      options?: string[];
      answerIndex?: number;
      // Numeric fields
      expected?: number;
      tolerance?: number;
      money2dp?: boolean;
      hints?: string[];
      // All CFU types have rubric
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
  cfu_type: string;
  lesson_context: {
    lesson_title: string;
    student_name: string;
    progress: string;
  };
  interaction_id: string;
  timestamp: string;
};

export const LessonCardPresentationTool = makeAssistantToolUI<
  LessonCardPresentationArgs,
  unknown
>({
  toolName: "lesson_card_presentation",
  render: function LessonCardPresentationUI({ args }) {
    // Check if we're in replay mode
    const { isReplayMode } = useReplayMode();

    // Get interrupt state and sendCommand hook
    // Safe versions that won't throw in replay mode
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();

    // Get current card context for updating with real-time card data
    const { setCurrentCard } = useCurrentCard();

    // Component state - must be before early return to avoid hook order issues
    const [studentAnswer, setStudentAnswer] = useState<string>("");
    const [selectedMCQOption, setSelectedMCQOption] = useState<string>("");
    const [showHint, setShowHint] = useState(false);
    const [hintIndex, setHintIndex] = useState(0);

    // 🚨 DEBUG: Log component mount and interrupt state
    useEffect(() => {
      console.log('🃏 LessonCardTool - Component mounted/updated:', {
        hasInterrupt: !!interrupt,
        interruptValue: interrupt?.value,
        hasArgs: !!args,
        cardDataId: args?.card_data?.id,
        cardTitle: args?.card_data?.title,
        timestamp: new Date().toISOString()
      });

      if (!interrupt) {
        console.warn('⚠️ LessonCardTool - NO INTERRUPT - Component will not render');
      }

      if (interrupt && !args?.card_data) {
        console.error('❌ LessonCardTool - Has interrupt but missing card_data in args');
      }
    }, [interrupt, args]);

    // Update CurrentCardContext with card data for context-aware chat
    useEffect(() => {
      // Only update if we have valid card_data
      if (!args.card_data || !args.card_data.cfu) {
        console.error('❌ LessonCardTool useEffect - Missing card_data or cfu');
        return;
      }

      console.log('🎯 LessonCardTool - Updating CurrentCardContext with:', {
        card_index: args.card_index,
        card_id: args.card_data.id,
        lesson_title: args.lesson_context?.lesson_title
      });

      setCurrentCard({
        card_data: args.card_data,
        card_index: args.card_index,
        total_cards: args.total_cards,
        interaction_state: "presenting",
        lesson_context: args.lesson_context
      });

      // Cleanup: Mark as completed when component unmounts
      return () => {
        console.log('🎯 LessonCardTool - Component unmounting, marking card as completed');
        setCurrentCard(prev => prev ? {
          ...prev,
          interaction_state: "completed"
        } : null);
      };
    }, [args.card_data?.id, args.card_index, args.total_cards, args.lesson_context, setCurrentCard]);

    // CHECK: Only render if there's an interrupt
    // In replay mode, render even without interrupt (tool calls trigger rendering)
    // In live mode, only render when we have an interrupt
    if (!isReplayMode && !interrupt) return null;

    // DATA: Get from tool call args (NOT from interrupt.value)
    const { card_content, card_data, card_index, total_cards, cfu_type, lesson_context } = args;

    // VALIDATION: Ensure card_data and cfu exist before rendering
    if (!card_data || !card_data.cfu) {
      console.error('❌ LessonCardTool - Missing required card_data or cfu:', {
        hasCardData: !!card_data,
        hasCfu: card_data ? !!card_data.cfu : false,
        args
      });
      return (
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Error: Invalid lesson card data. Please try again.</p>
          </CardContent>
        </Card>
      );
    }

    // Calculate progress
    const progress = ((card_index + 1) / total_cards) * 100;

    const handleSubmitAnswer = () => {
      if (!studentAnswer.trim() && !selectedMCQOption) {
        alert("Please provide an answer before submitting.");
        return;
      }

      const finalAnswer = cfu_type === "mcq" ? selectedMCQOption : studentAnswer;

      console.log('🚨 TOOL UI DEBUG - Submitting answer via sendCommand:', {
        action: "submit_answer",
        student_response: finalAnswer,
        card_id: card_data.id
      });

      // Update interaction state to "evaluating" for context-aware chat
      setCurrentCard(prev => prev ? {
        ...prev,
        interaction_state: "evaluating"
      } : null);

      // Send command with resume value as JSON string
      sendCommand({
        resume: JSON.stringify({
          action: "submit_answer",
          student_response: finalAnswer,
          interaction_type: "answer_submission",
          card_id: card_data.id,
          interaction_id: args.interaction_id,
          timestamp: new Date().toISOString()
        })
      });
    };

    const handleSkipCard = () => {
      if (confirm("Are you sure you want to skip this card? This will mark it as incomplete.")) {
        sendCommand({
          resume: JSON.stringify({
            action: "skip_card",
            interaction_type: "card_skip",
            card_id: card_data.id,
            reason: "Student chose to skip",
            interaction_id: args.interaction_id,
            timestamp: new Date().toISOString()
          })
        });
      }
    };

    const handleRequestHint = () => {
      setShowHint(true);
      // Could trigger hint command if needed
    };

    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">{lesson_context.lesson_title}</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserIcon className="w-4 h-4" />
              <span>{lesson_context.student_name}</span>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Progress: Card {card_index + 1} of {total_cards}</span>
              <Badge variant="outline">{Math.round(progress)}% Complete</Badge>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Interactive question section */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-orange-500" />
              Your Turn to Answer
            </h3>

            {/* MCQ - Multiple Choice Question */}
            {card_data.cfu.type === "mcq" && card_data.cfu.options && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  {card_data.cfu.stem}
                </Label>
                <RadioGroup
                  value={selectedMCQOption}
                  onValueChange={setSelectedMCQOption}
                  className="space-y-3"
                >
                  {card_data.cfu.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                      />
                      <Label
                        htmlFor={`option-${index}`}
                        className="text-base cursor-pointer flex-1 p-2 rounded hover:bg-gray-50"
                      >
                        {String.fromCharCode(65 + index)}. {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Numeric Question */}
            {card_data.cfu.type === "numeric" && (
              <div className="space-y-4">
                <Label htmlFor="numeric-answer" className="text-base font-medium">
                  {card_data.cfu.stem}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="numeric-answer"
                    type="number"
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    placeholder={card_data.cfu.money2dp ? "0.00" : "Enter number"}
                    className="text-base flex-1"
                    step={card_data.cfu.money2dp ? "0.01" : "any"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSubmitAnswer();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Structured Response - Multi-part Written Answer */}
            {card_data.cfu.type === "structured_response" && (
              <div className="space-y-4">
                <Label htmlFor="structured-answer" className="text-base font-medium whitespace-pre-line">
                  {card_data.cfu.stem}
                </Label>
                <textarea
                  id="structured-answer"
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Show your working for each part. Write your complete answer."
                  className="w-full p-3 border rounded-lg text-base font-mono min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500">
                  Max points: {card_data.cfu.rubric.total_points}
                </p>
              </div>
            )}

            {/* Short Text Question */}
            {card_data.cfu.type === "short_text" && (
              <div className="space-y-4">
                <Label htmlFor="short-text-answer" className="text-base font-medium">
                  {card_data.cfu.stem}
                </Label>
                <Input
                  id="short-text-answer"
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Brief answer (1-2 sentences)"
                  maxLength={200}
                  className="text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitAnswer();
                    }
                  }}
                />
              </div>
            )}

            {/* Progressive Hints - for numeric CFU */}
            {card_data.cfu.type === "numeric" && card_data.cfu.hints && card_data.cfu.hints.length > 0 && (
              <div className="mt-4 space-y-2">
                {!showHint ? (
                  <Button
                    variant="secondary"
                    onClick={() => setShowHint(true)}
                    className="w-full"
                  >
                    💡 Show Hint ({hintIndex + 1}/{card_data.cfu.hints.length})
                  </Button>
                ) : (
                  <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <h4 className="font-medium text-yellow-800 mb-1">Hint {hintIndex + 1}:</h4>
                    <p className="text-sm text-yellow-700 mb-2">
                      {card_data.cfu.hints[hintIndex]}
                    </p>
                    {hintIndex < card_data.cfu.hints.length - 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHintIndex(hintIndex + 1)}
                        className="text-xs"
                      >
                        Next Hint →
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Misconceptions - Common Student Errors */}
            {card_data.misconceptions && card_data.misconceptions.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                <h4 className="font-medium text-amber-800 mb-2">⚠️ Common Mistakes to Avoid:</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  {card_data.misconceptions.slice(0, 2).map((misc, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span>•</span>
                      <span>{misc.misconception}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action buttons - Hidden in replay mode */}
          {!isReplayMode && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleSkipCard}
                className="flex-1"
              >
                Skip Card
              </Button>

              <Button
                onClick={handleSubmitAnswer}
                disabled={!studentAnswer.trim() && !selectedMCQOption}
                className="flex-1"
              >
                Submit Answer
              </Button>
            </div>
          )}

          {/* Replay mode notice */}
          {isReplayMode && (
            <div className="pt-4 border-t">
              <div className="bg-gray-100 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600 italic">
                  🎬 Replay Mode - This lesson card is from a completed session
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});