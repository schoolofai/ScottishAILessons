"use client";

import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { 
  useLangGraphInterruptState,
  useLangGraphSendCommand 
} from "@assistant-ui/react-langgraph";
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
    examples?: string[];
    cfu: {
      id: string;
      type: string;
      question: string;
      options?: string[];
      answerIndex?: number;
      expected?: string;
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
    // Get interrupt state and sendCommand hook
    const interrupt = useLangGraphInterruptState();
    const sendCommand = useLangGraphSendCommand();
    
    // Component state - must be before early return to avoid hook order issues
    const [studentAnswer, setStudentAnswer] = useState<string>("");
    const [selectedMCQOption, setSelectedMCQOption] = useState<string>("");
    const [showHint, setShowHint] = useState(false);
    
    // CHECK: Only render if there's an interrupt
    if (!interrupt) return null;
    
    // DATA: Get from tool call args (NOT from interrupt.value)
    const { card_content, card_data, card_index, total_cards, cfu_type, lesson_context } = args;

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
          {/* Lesson content */}
          <div className="prose prose-sm max-w-none">
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <ReactMarkdown
                components={{
                  // Custom rendering for math expressions if needed
                  p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                  strong: ({children}) => <strong className="font-semibold text-blue-800">{children}</strong>,
                  em: ({children}) => <em className="italic text-blue-700">{children}</em>
                }}
              >
                {card_content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Interactive question section */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-orange-500" />
              Your Turn to Answer
            </h3>

            {cfu_type === "mcq" && card_data.cfu.options ? (
              // Multiple Choice Question
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  {card_data.cfu.question}
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
            ) : (
              // Text Input Question
              <div className="space-y-4">
                <Label htmlFor="student-answer" className="text-base font-medium">
                  {card_data.cfu.question}
                </Label>
                <Input
                  id="student-answer"
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Type your answer here..."
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

            {/* Hint section */}
            {showHint && (
              <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <h4 className="font-medium text-yellow-800 mb-1">Hint:</h4>
                <p className="text-sm text-yellow-700">
                  Look at the examples provided above. Try to identify the pattern or method used.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleSkipCard}
              className="flex-1"
            >
              Skip Card
            </Button>
            
            {!showHint && (
              <Button
                variant="secondary"
                onClick={handleRequestHint}
              >
                Show Hint
              </Button>
            )}
            
            <Button
              onClick={handleSubmitAnswer}
              disabled={!studentAnswer.trim() && !selectedMCQOption}
              className="flex-1"
            >
              Submit Answer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  },
});