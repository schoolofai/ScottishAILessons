"use client";

import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useSafeLangGraphInterruptState } from "@/lib/replay/useSafeLangGraphHooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  InfoIcon, 
  ChevronDownIcon,
  ChevronUpIcon,
  LightbulbIcon,
  TargetIcon,
  TrendingUpIcon
} from "lucide-react";

type FeedbackPresentationArgs = {
  is_correct: boolean;
  feedback: string;
  confidence: number;
  reasoning: string;
  partial_credit?: number;
  attempts: number;
  max_attempts: number;
  show_explanation: boolean;
  card_context: {
    card_id: string;
    question: string;
    expected_answer?: string;
  };
  interaction_id: string;
  timestamp: string;
};

export const FeedbackPresentationTool = makeAssistantToolUI<
  FeedbackPresentationArgs,
  unknown
>({
  toolName: "feedback_presentation",
  render: function FeedbackPresentationUI({ args, callTool, status }) {
    const interrupt = useSafeLangGraphInterruptState();

    const {
      is_correct,
      feedback,
      confidence,
      reasoning,
      partial_credit,
      attempts,
      max_attempts,
      show_explanation,
      card_context
    } = args;

    const [showDetailedReasoning, setShowDetailedReasoning] = useState(false);
    const [requestingHint, setRequestingHint] = useState(false);

    if (!interrupt) return null;

    const isLoading = status.type === "executing";
    const canTryAgain = attempts < max_attempts && !is_correct;
    const maxAttemptsReached = attempts >= max_attempts;

    const handleAcknowledge = () => {
      callTool({
        action: "acknowledge",
        interaction_type: "feedback_acknowledgment",
        card_id: card_context.card_id,
        understood: true,
        interaction_id: args.interaction_id,
        timestamp: new Date().toISOString()
      });
    };

    const handleRequestHint = () => {
      setRequestingHint(true);
      callTool({
        action: "request_hint",
        interaction_type: "hint_request",
        card_id: card_context.card_id,
        current_attempts: attempts,
        interaction_id: args.interaction_id,
        timestamp: new Date().toISOString()
      });
    };

    const handleTryAgain = () => {
      callTool({
        action: "try_again",
        interaction_type: "retry_attempt",
        card_id: card_context.card_id,
        attempts_remaining: max_attempts - attempts,
        interaction_id: args.interaction_id,
        timestamp: new Date().toISOString()
      });
    };

    // Calculate confidence color
    const getConfidenceColor = (conf: number) => {
      if (conf >= 0.8) return "text-green-600";
      if (conf >= 0.6) return "text-yellow-600";
      return "text-red-600";
    };

    const getConfidenceLabel = (conf: number) => {
      if (conf >= 0.8) return "High";
      if (conf >= 0.6) return "Medium";
      return "Low";
    };

    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {is_correct ? (
                <>
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                  Great Work!
                </>
              ) : (
                <>
                  <XCircleIcon className="w-6 h-6 text-red-500" />
                  {maxAttemptsReached ? "Let's Review" : "Not Quite Right"}
                </>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge variant={is_correct ? "default" : "secondary"}>
                Attempt {attempts}/{max_attempts}
              </Badge>
              {partial_credit !== undefined && partial_credit > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  Partial Credit: {Math.round(partial_credit * 100)}%
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Main feedback */}
          <Alert className={is_correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <div className="flex">
              {is_correct ? (
                <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <InfoIcon className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <AlertDescription className="ml-2 text-base">
                {feedback}
              </AlertDescription>
            </div>
          </Alert>

          {/* Confidence and reasoning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">AI Confidence</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-lg font-semibold ${getConfidenceColor(confidence)}`}>
                  {Math.round(confidence * 100)}%
                </div>
                <Badge variant="outline" className={getConfidenceColor(confidence)}>
                  {getConfidenceLabel(confidence)}
                </Badge>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TargetIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Progress</span>
              </div>
              <div className="text-lg font-semibold">
                {is_correct ? "✓ Complete" : `${attempts}/${max_attempts} attempts`}
              </div>
            </Card>
          </div>

          {/* Detailed reasoning (collapsible) */}
          <Collapsible>
            <CollapsibleTrigger
              className="flex items-center gap-2 w-full p-2 text-left hover:bg-gray-50 rounded transition-colors"
              onClick={() => setShowDetailedReasoning(!showDetailedReasoning)}
            >
              <LightbulbIcon className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">Why this assessment?</span>
              {showDetailedReasoning ? (
                <ChevronUpIcon className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 ml-auto" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-2">
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {reasoning}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Explanation for max attempts reached */}
          {show_explanation && maxAttemptsReached && !is_correct && (
            <Alert>
              <InfoIcon className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Let&apos;s look at the correct approach:</p>
                  {card_context.expected_answer && (
                    <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                      <p className="text-sm">
                        <strong>Expected answer:</strong> {card_context.expected_answer}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">
                    Don&apos;t worry - this is all part of learning! Let&apos;s continue to the next card.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {canTryAgain && !requestingHint && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRequestHint}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <LightbulbIcon className="w-4 h-4" />
                  Get a Hint
                </Button>
                <Button
                  onClick={handleTryAgain}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Try Again ({max_attempts - attempts} attempts left)
                </Button>
              </>
            )}

            {(is_correct || maxAttemptsReached || requestingHint) && (
              <Button
                onClick={handleAcknowledge}
                disabled={isLoading}
                className="flex-1"
              >
                {is_correct ? "Continue to Next Card" : "I Understand, Continue"}
              </Button>
            )}
          </div>

          {/* Encouraging message */}
          <div className="text-center text-sm text-gray-600 pt-2">
            {is_correct ? (
              "🎉 Excellent! You're making great progress!"
            ) : maxAttemptsReached ? (
              "📚 Learning from mistakes is how we grow stronger!"
            ) : (
              "💪 You've got this! Take another shot!"
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
});