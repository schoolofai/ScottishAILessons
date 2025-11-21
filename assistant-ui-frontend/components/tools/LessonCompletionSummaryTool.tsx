"use client";

import React, { useState, useEffect } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useSafeLangGraphInterruptState } from "@/lib/replay/useSafeLangGraphHooks";
import { useRouter } from "next/navigation";
import { useAppwrite, EvidenceDriver, SessionDriver, MasteryDriver, RoutineDriver } from "@/lib/appwrite";
import { useServerAuth } from "@/hooks/useServerAuth";
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
import * as pako from 'pako';
import { useReplayMode } from "@/contexts/ReplayModeContext";
import { useSafeCurrentCard } from "@/contexts/CurrentCardContext";

/**
 * Compress and encode conversation history for storage.
 * Uses gzip compression followed by base64 encoding.
 */
function compressConversationHistory(history: ConversationHistory): string {
  try {
    const jsonString = JSON.stringify(history);
    const compressed = pako.gzip(jsonString);
    const base64 = btoa(String.fromCharCode(...compressed));

    const originalSize = new Blob([jsonString]).size;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`🗜️ Compression stats: ${originalSize}B → ${compressedSize}B (${ratio}% reduction)`);

    return base64;
  } catch (error) {
    console.error('❌ Failed to compress conversation history:', error);
    throw new Error('Compression failed');
  }
}

type ConversationHistory = {
  version: string;
  threadId: string;
  sessionId: string;
  capturedAt: string;
  messages: Array<{
    id: string;
    type: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      name: string;
      args: any;
    }>;
  }>;
};

type LessonCompletionSummaryArgs = {
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
  mastery_updates: Array<{
    outcome_id: string;
    score: number;
    timestamp: string;
  }>;
  lesson_title: string;
  total_cards: number;
  cards_completed: number;
  retry_recommended: boolean;
  timestamp: string;
  // Session context for persistence
  session_id: string;
  student_id: string;
  course_id: string;
  // Conversation history for replay (will be compressed before saving)
  conversation_history?: ConversationHistory;
  // Enriched outcomes for RoutineV2 key translation
  enriched_outcomes?: Array<{
    $id: string;
    outcomeId: string;
    assessmentStandards?: string | any[];
  }>;
};

export const LessonCompletionSummaryTool = makeAssistantToolUI<
  LessonCompletionSummaryArgs,
  unknown
>({
  toolName: "lesson_completion_summary",
  render: function LessonCompletionSummaryUI({ args, callTool, status }) {
    const { isReplayMode } = useReplayMode();
    const interrupt = useSafeLangGraphInterruptState();
    const router = useRouter();
    const { createDriver } = useAppwrite();
    // Use useServerAuth for auth state (httpOnly cookie pattern)
    // This fixes the race condition where useAppwrite.isAuthenticated stays false
    const { isAuthenticated, isLoading } = useServerAuth();
    const cardContext = useSafeCurrentCard();
    const onSessionStatusChange = cardContext?.onSessionStatusChange;

    const {
      summary,
      performance_analysis,
      evidence,
      mastery_updates,
      lesson_title,
      total_cards,
      retry_recommended,
      session_id,
      student_id,
      course_id,
      conversation_history,
      enriched_outcomes
    } = args;

    // Debug logging to check what data we're receiving
    console.log('🔍 LessonCompletionSummaryTool received args:', {
      evidence: evidence?.length || 0,
      mastery_updates: mastery_updates?.length || 0,
      conversation_history_messages: conversation_history?.messages?.length || 0,
      session_id,
      student_id,
      course_id,
      evidence_sample: evidence?.[0],
      mastery_sample: mastery_updates?.[0]
    });

    const [selectedTab, setSelectedTab] = useState("performance");
    const [persistenceCompleted, setPersistenceCompleted] = useState(false);
    const [persistenceAttempted, setPersistenceAttempted] = useState(false); // Prevent duplicate attempts
    const isToolExecuting = status.type === "executing";

    // Automatically persist data when component receives completion summary
    useEffect(() => {
      const persistData = async () => {
        // CRITICAL: Prevent duplicate persistence attempts (React Strict Mode runs effects twice)
        if (persistenceAttempted) {
          console.log('🔄 Persistence already attempted, skipping duplicate call...');
          return;
        }

        // Wait for authentication before persisting
        if (isLoading) {
          console.log('⏳ Waiting for authentication to complete...');
          return;
        }

        if (!isAuthenticated) {
          console.error('❌ Cannot persist data: User not authenticated');
          return;
        }

        if (persistenceCompleted) {
          console.log('🔄 Data already persisted, skipping...');
          return;
        }

        // Mark as attempted immediately to prevent duplicate calls
        setPersistenceAttempted(true);
        console.log('🔒 Persistence attempt locked - preventing duplicates');

        try {
          console.log('🚀 Auto-persisting lesson completion data via server-side API...');
          console.log(`Evidence records: ${evidence.length}, Mastery updates: ${mastery_updates.length}`);
          console.log('📋 Session context:', { session_id, student_id, course_id });

          // ═══════════════════════════════════════════════════════════════
          // 1. Validate and map evidence data
          // ═══════════════════════════════════════════════════════════════
          console.log('🔍 Validating and mapping evidence data...');
          const evidenceData = evidence.map((entry, index) => {
            const entryNum = index + 1;
            console.log(`[Evidence Validation] Processing entry ${entryNum}/${evidence.length}`);

            let mapped = {
              sessionId: session_id,
              itemId: entry.item_id,
              response: entry.response,
              correct: entry.correct,
              attempts: entry.attempts,
              confidence: entry.confidence,
              reasoning: entry.reasoning,
              feedback: entry.feedback,
              timestamp: entry.timestamp
            };

            console.log(`[Evidence Debug] Entry ${entryNum} original data:`, {
              item_id: entry.item_id,
              response_length: entry.response?.length || 0,
              correct: entry.correct,
              attempts: entry.attempts,
              confidence: entry.confidence,
              timestamp: entry.timestamp
            });

            // ═══════════════════════════════════════════════════════════════
            // Validation 1: Response size (max 100,000 chars in Appwrite)
            // ═══════════════════════════════════════════════════════════════
            if (mapped.response && typeof mapped.response === 'string') {
              const originalLength = mapped.response.length;

              if (originalLength > 100000) {
                console.error(`❌ [Evidence ${entryNum}] Response exceeds database limit!`);
                console.error(`   Original length: ${originalLength} characters`);
                console.error(`   Database limit: 100,000 characters`);
                console.error(`   Item ID: ${mapped.itemId}`);
                console.error(`   First 200 chars: ${mapped.response.substring(0, 200)}`);

                // Truncate with clear marker
                mapped.response = mapped.response.substring(0, 99950) + '\n\n[Response truncated due to database size limit]';

                console.warn(`⚠️ [Evidence ${entryNum}] Response truncated to 100,000 chars`);
              } else {
                console.log(`✅ [Evidence ${entryNum}] Response size OK: ${originalLength} chars`);
              }
            } else if (!mapped.response) {
              console.error(`❌ [Evidence ${entryNum}] Response is missing or null!`);
              mapped.response = '[No response provided]';
            }

            // ═══════════════════════════════════════════════════════════════
            // Validation 2: Confidence value (must be 0-1, no NaN/Infinity)
            // ═══════════════════════════════════════════════════════════════
            if (mapped.confidence !== undefined && mapped.confidence !== null) {
              const originalConfidence = mapped.confidence;

              if (typeof mapped.confidence !== 'number') {
                console.error(`❌ [Evidence ${entryNum}] Confidence is not a number!`);
                console.error(`   Type: ${typeof mapped.confidence}`);
                console.error(`   Value: ${mapped.confidence}`);
                mapped.confidence = 0;
              } else if (isNaN(mapped.confidence)) {
                console.error(`❌ [Evidence ${entryNum}] Confidence is NaN!`);
                console.error(`   Item ID: ${mapped.itemId}`);
                mapped.confidence = 0;
              } else if (!isFinite(mapped.confidence)) {
                console.error(`❌ [Evidence ${entryNum}] Confidence is Infinity!`);
                console.error(`   Value: ${mapped.confidence}`);
                console.error(`   Item ID: ${mapped.itemId}`);
                mapped.confidence = 0;
              } else if (mapped.confidence < 0 || mapped.confidence > 1) {
                console.error(`❌ [Evidence ${entryNum}] Confidence out of range [0, 1]!`);
                console.error(`   Original value: ${originalConfidence}`);
                console.error(`   Item ID: ${mapped.itemId}`);

                // Clamp to valid range
                mapped.confidence = Math.max(0, Math.min(1, mapped.confidence));

                console.warn(`⚠️ [Evidence ${entryNum}] Confidence clamped to: ${mapped.confidence}`);
              } else {
                console.log(`✅ [Evidence ${entryNum}] Confidence OK: ${mapped.confidence}`);
              }
            } else {
              console.warn(`⚠️ [Evidence ${entryNum}] Confidence is null/undefined, defaulting to 0`);
              mapped.confidence = 0;
            }

            // ═══════════════════════════════════════════════════════════════
            // Validation 3: Attempts value (must be positive integer)
            // ═══════════════════════════════════════════════════════════════
            if (mapped.attempts !== undefined && mapped.attempts !== null) {
              if (typeof mapped.attempts !== 'number' || mapped.attempts < 1) {
                console.error(`❌ [Evidence ${entryNum}] Invalid attempts value!`);
                console.error(`   Value: ${mapped.attempts}`);
                console.error(`   Type: ${typeof mapped.attempts}`);
                mapped.attempts = 1;
              } else {
                console.log(`✅ [Evidence ${entryNum}] Attempts OK: ${mapped.attempts}`);
              }
            } else {
              console.warn(`⚠️ [Evidence ${entryNum}] Attempts missing, defaulting to 1`);
              mapped.attempts = 1;
            }

            // ═══════════════════════════════════════════════════════════════
            // Validation 4: Required fields
            // ═══════════════════════════════════════════════════════════════
            console.log(`[Evidence Debug] Entry ${entryNum} final mapped data:`, {
              sessionId: mapped.sessionId,
              itemId: mapped.itemId,
              response_length: mapped.response?.length || 0,
              correct: mapped.correct,
              attempts: mapped.attempts,
              confidence: mapped.confidence,
              timestamp: mapped.timestamp
            });

            if (!mapped.sessionId) {
              console.error(`❌ [Evidence ${entryNum}] Missing sessionId!`);
              throw new Error(`Evidence ${entryNum}: Missing sessionId`);
            }
            if (!mapped.itemId) {
              console.error(`❌ [Evidence ${entryNum}] Missing itemId!`);
              throw new Error(`Evidence ${entryNum}: Missing itemId`);
            }
            if (mapped.response === undefined) {
              console.error(`❌ [Evidence ${entryNum}] Missing response!`);
              throw new Error(`Evidence ${entryNum}: Missing response`);
            }
            if (mapped.correct === undefined) {
              console.error(`❌ [Evidence ${entryNum}] Missing correct flag!`);
              throw new Error(`Evidence ${entryNum}: Missing correct flag`);
            }

            console.log(`✅ [Evidence ${entryNum}] Validation complete - all fields valid`);
            return mapped;
          });

          console.log(`✅ All ${evidenceData.length} evidence records validated successfully`);

          // ═══════════════════════════════════════════════════════════════
          // 2. Prepare mastery updates with document ID → string ref translation
          // ═══════════════════════════════════════════════════════════════
          console.log('🎯 Preparing mastery updates...');

          // Build reverse mapping: documentId → outcomeId (string ref)
          const documentIdToOutcomeId = new Map<string, string>();

          if (enriched_outcomes && enriched_outcomes.length > 0) {
            enriched_outcomes.forEach((outcome: any) => {
              const docId = outcome.$id;          // "outcome_test_simple_o1"
              const stringRef = outcome.outcomeId; // "O1"

              if (docId && stringRef) {
                documentIdToOutcomeId.set(docId, stringRef);

                // Also map composite keys -> AS codes
                const asListJson = outcome.assessmentStandards || "[]";
                try {
                  const asList = typeof asListJson === 'string' ? JSON.parse(asListJson) : asListJson;

                  if (Array.isArray(asList)) {
                    asList.forEach((as: any) => {
                      const asCode = as.code; // "AS1.1"
                      if (asCode) {
                        const compositeKey = `${docId}#${asCode}`;
                        documentIdToOutcomeId.set(compositeKey, asCode);
                      }
                    });
                  }
                } catch (e) {
                  console.warn(`Failed to parse assessmentStandards for ${docId}:`, e);
                }
              }
            });
          }

          console.log("🔑 Document ID → Outcome ID mapping:", Object.fromEntries(documentIdToOutcomeId));

          // Prepare mastery updates with translated outcome IDs
          const preparedMasteryUpdates = mastery_updates.map(update => {
            const translatedOutcomeId = documentIdToOutcomeId.get(update.outcome_id) || update.outcome_id;
            return {
              outcomeId: translatedOutcomeId,
              newEMA: update.score
            };
          });

          // Deduplicate for routine updates (last value wins)
          const routineUpdates: { [outcomeId: string]: number } = {};
          mastery_updates.forEach(update => {
            const translatedOutcomeId = documentIdToOutcomeId.get(update.outcome_id);
            if (translatedOutcomeId) {
              routineUpdates[translatedOutcomeId] = update.score;
            } else {
              console.warn(`⚠️ No string ref found for mastery key: ${update.outcome_id}`);
            }
          });

          console.log(`📊 Prepared ${preparedMasteryUpdates.length} mastery updates, ${Object.keys(routineUpdates).length} routine updates`);

          // ═══════════════════════════════════════════════════════════════
          // 3. Compress conversation history for server-side persistence
          // ═══════════════════════════════════════════════════════════════
          let compressedHistory: string | undefined = undefined;

          if (conversation_history && conversation_history.messages.length > 0) {
            console.log('💬 Compressing conversation history for server-side persistence...');
            console.log(`[History Debug] Messages to compress: ${conversation_history.messages.length}`);

            try {
              compressedHistory = compressConversationHistory(conversation_history);
              const sizeKB = (compressedHistory.length / 1024).toFixed(2);
              console.log(`[History Debug] Compressed size: ${sizeKB} KB`);

              // Verify size constraint (50KB max in Appwrite)
              if (compressedHistory.length > 50000) {
                console.warn(`⚠️ Compressed history exceeds 50KB limit: ${sizeKB} KB - skipping`);
                compressedHistory = undefined; // Don't send oversized history
              } else {
                console.log('✅ Conversation history compressed - ready for server-side persistence');
              }
            } catch (historyError) {
              console.error('⚠️ Failed to compress conversation history:', historyError);
              compressedHistory = undefined;
            }
          } else {
            console.log('⚠️ No conversation history to persist');
          }

          // ═══════════════════════════════════════════════════════════════
          // 4. Call server-side API to persist all data (including conversation history)
          // ═══════════════════════════════════════════════════════════════
          console.log('📡 Calling server-side completion API...');

          const response = await fetch(`/api/student/sessions/${session_id}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              evidence: evidenceData,
              masteryUpdates: preparedMasteryUpdates,
              routineUpdates: routineUpdates,
              conversationHistory: compressedHistory // Send compressed history to server
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`API error: ${errorData.error || response.statusText}`);
          }

          const result = await response.json();
          console.log('✅ Server-side persistence completed:', result.summary);

          if (result.summary.conversationHistoryPersisted) {
            console.log('✅ Conversation history persisted server-side');
          }

          // ═══════════════════════════════════════════════════════════════
          // 5. Notify parent component that session is completed
          // ═══════════════════════════════════════════════════════════════
          if (onSessionStatusChange) {
            console.log('📢 Notifying parent: session status changed to "completed"');
            onSessionStatusChange('completed');
          }

          console.log('🎉 All lesson completion data auto-persisted successfully!');
          setPersistenceCompleted(true);

        } catch (error) {
          console.error('❌ CRITICAL FAILURE: Failed to auto-persist lesson completion data:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

          // Log detailed context for debugging
          console.error('Debug context:', {
            session_id,
            student_id,
            course_id,
            evidenceCount: evidence?.length,
            masteryCount: mastery_updates?.length,
            evidenceSample: evidence?.[0],
            masterySample: mastery_updates?.[0]
          });

          // Show detailed error to user
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          const errorDetails = error instanceof Error && error.stack
            ? error.stack.split('\n').slice(0, 3).join('\n')
            : 'No additional details available';

          alert(`CRITICAL ERROR: Failed to auto-save lesson data!\n\nError: ${errorMessage}\n\nDetails: ${errorDetails}\n\nPlease screenshot this message and contact support. Your progress may not be saved.`);
        }
      };

      // Only persist if we have valid data and user is authenticated
      if (session_id && student_id && course_id && evidence && mastery_updates && !isLoading && isAuthenticated) {
        persistData();
      } else if (isLoading) {
        console.log('⏳ Waiting for authentication before persisting...');
      } else if (!isAuthenticated) {
        console.warn('⚠️ User not authenticated, skipping persistence');
      } else {
        console.warn('⚠️ Missing required data for auto-persistence:', {
          session_id: !!session_id,
          student_id: !!student_id,
          course_id: !!course_id,
          evidence: !!evidence,
          mastery_updates: !!mastery_updates
        });
      }
    }, [session_id, student_id, course_id, evidence, mastery_updates, createDriver, isLoading, isAuthenticated, enriched_outcomes, conversation_history, performance_analysis, onSessionStatusChange]);
    // NOTE: persistenceAttempted intentionally NOT in dependencies to prevent re-triggering after lock

    const handleComplete = async () => {
      // Data already persisted automatically, just handle UI actions
      if (!persistenceCompleted) {
        console.warn('⚠️ Manual completion triggered but auto-persistence not complete yet');
        return;
      }

      try {
        console.log('🔄 Manual completion - data already persisted, handling UI actions...');

        // 5. Only call tool if it's available (during interrupts)
        if (typeof callTool === "function") {
          console.log('📞 Calling completion tool...');
          callTool({
            action: "complete",
            interaction_type: "lesson_completion",
            performance_satisfaction: "satisfied",
            wants_retry: false,
            timestamp: new Date().toISOString()
          });
        }

        // Navigate to dashboard after marking as complete
        console.log('🏠 Navigating to dashboard...');
        router.push("/dashboard");
      } catch (error) {
        console.error('❌ CRITICAL FAILURE: Failed to persist lesson completion data:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

        // Log detailed context for debugging
        console.error('Debug context:', {
          session_id,
          student_id,
          course_id,
          evidenceCount: evidence?.length,
          masteryCount: mastery_updates?.length,
          evidenceSample: evidence?.[0],
          masterySample: mastery_updates?.[0]
        });

        // Show detailed error to user
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorDetails = error instanceof Error && error.stack
          ? error.stack.split('\n').slice(0, 3).join('\n')
          : 'No additional details available';

        alert(`CRITICAL ERROR: Failed to save lesson data!\n\nError: ${errorMessage}\n\nDetails: ${errorDetails}\n\nPlease screenshot this message and contact support. Your progress may not be saved.`);

        // Still navigate to avoid user being stuck
        router.push("/dashboard");
      }
    };

    const handleRetry = () => {
      if (confirm("Are you sure you want to retry this lesson? Your current progress will be reset.")) {
        // Only call tool if it's available (during interrupts)
        if (typeof callTool === "function") {
          callTool({
            action: "retry_lesson",
            interaction_type: "lesson_retry",
            retry_reason: "student_choice",
            timestamp: new Date().toISOString()
          });
        }
      }
    };


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
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrophyIcon className="w-6 h-6 text-yellow-500" />
              {lesson_title} - Complete!
            </CardTitle>

            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {correct_answers}/{total_cards} Correct
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>

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
                      <strong>Total Questions:</strong> {total_cards}
                    </p>
                    <p>
                      <strong>Correct Answers:</strong> {correct_answers}
                    </p>
                    <p>
                      <strong>Success Rate:</strong> {Math.round((correct_answers / total_cards) * 100)}%
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

          {/* Action buttons - Hidden in replay mode */}
          {!isReplayMode && (
            <div className="flex gap-3 pt-6 border-t">
              {retry_recommended && (
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={isToolExecuting}
                  className="flex items-center gap-2"
                >
                  <RefreshCwIcon className="w-4 h-4" />
                  Retry Lesson
                </Button>
              )}

              <Button
                onClick={handleComplete}
                disabled={isToolExecuting || !persistenceCompleted}
                className="flex-1"
              >
                {persistenceCompleted ? "Continue to Dashboard" : "Saving Progress..."}
              </Button>
            </div>
          )}

          {/* Replay mode notice */}
          {isReplayMode && (
            <div className="pt-6 border-t">
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 italic">
                  🎬 Replay Mode - This is a summary of a completed lesson
                </p>
              </div>
            </div>
          )}

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