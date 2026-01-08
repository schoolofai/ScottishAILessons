"use client";

/**
 * Practice Wizard Page - Gamified wizard interface for infinite practice
 *
 * Route: /practice_wizard/[lessonId]
 *
 * This page provides a step-by-step wizard UI as an alternative to the
 * chat-based practice interface. Uses the same infinite_practice graph
 * but presents content in a more structured, gamified format.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardPracticeContainer } from "@/components/practice_wizard/WizardPracticeContainer";
import { ResumePromptModal } from "@/components/practice_wizard/ResumePromptModal";
import { useAppwrite } from "@/lib/appwrite/hooks/useAppwrite";
import { LessonDriver } from "@/lib/appwrite/driver/LessonDriver";
import { PracticeQuestionDriver, type QuestionAvailability } from "@/lib/appwrite/driver/PracticeQuestionDriver";
import { decompressCards } from "@/lib/appwrite/utils/compression";
import { useSubscription } from "@/hooks/useSubscription";
import { checkBackendAvailable, BackendUnavailableError } from "@/lib/backend-check";
import type { PracticeSessionContext } from "@/hooks/practice/useLangGraphWizard";

// Custom fonts for gamified aesthetic
import "@/styles/wizard-fonts.css";

export default function PracticeWizardPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const { createDriver } = useAppwrite();
  const { hasAccess, isLoading: isLoadingSubscription } = useSubscription();

  // State
  const [studentId, setStudentId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>("Practice");
  const [practiceContext, setPracticeContext] = useState<PracticeSessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);
  // V2 offline questions state
  const [questionAvailability, setQuestionAvailability] = useState<QuestionAvailability | null>(null);
  const [useV2Mode, setUseV2Mode] = useState(false);
  // Completed session state - show summary view instead of restarting
  const [completedSession, setCompletedSession] = useState<{
    overall_mastery: number;
    completed_blocks: number;
    total_blocks: number;
    completed_at?: string;
    session_id?: string; // Track for deletion on "Practice Again"
  } | null>(null);
  // Force fresh start flag - skip completed session check
  const [forceFreshStart, setForceFreshStart] = useState(false);
  // Reset counter - increments to force useEffect re-trigger even when forceFreshStart is already true
  const [resetCounter, setResetCounter] = useState(0);
  // Resume prompt state - show modal for active/paused sessions
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [isStartingFresh, setIsStartingFresh] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    session_id: string;
    current_block_index: number;
    total_blocks: number;
    overall_mastery: number;
    current_difficulty: string;
    blocks_progress: Array<{
      block_id: string;
      current_difficulty: string;
      mastery_score: number;
      is_complete: boolean;
    }>;
    raw_session: Record<string, unknown>; // Full session for resume
  } | null>(null);

  // Check backend availability
  useEffect(() => {
    if (isLoadingSubscription) return;

    checkBackendAvailable()
      .then((result) => {
        if (!result.available) {
          setError("Practice service is temporarily unavailable");
          setBackendAvailable(false);
          setLoading(false); // Stop loading on error
          return;
        }

        if (!hasAccess) {
          setError("Subscription required for practice mode");
          setBackendAvailable(false);
          setLoading(false); // Stop loading on error
          return;
        }

        setBackendAvailable(true);
      })
      .catch(() => {
        setError("Could not connect to practice service");
        setBackendAvailable(false);
        setLoading(false); // Stop loading on error
      });
  }, [hasAccess, isLoadingSubscription]);

  // Load student ID and lesson data
  useEffect(() => {
    if (!backendAvailable) return;

    const loadData = async () => {
      try {
        // Validate lessonId
        if (!lessonId || lessonId === "undefined") {
          throw new Error("Invalid lesson ID");
        }

        // 1. Get student ID via server API
        const studentResponse = await fetch("/api/student/me");
        if (!studentResponse.ok) {
          if (studentResponse.status === 401) {
            throw new Error("Session expired. Please log in again.");
          }
          throw new Error("Failed to fetch student data");
        }

        const studentData = await studentResponse.json();
        if (!studentData.success || !studentData.student) {
          throw new Error("Student record not found");
        }

        const currentStudentId = studentData.student.$id;
        setStudentId(currentStudentId);

        // 2. Load lesson template
        const lessonDriver = createDriver(LessonDriver);
        const lessonTemplate = await lessonDriver.getLessonTemplate(lessonId);

        if (!lessonTemplate) {
          throw new Error("Lesson not found");
        }

        setLessonTitle(lessonTemplate.title || "Practice Session");

        // 2.5. Check for V2 offline questions availability
        try {
          const questionDriver = createDriver(PracticeQuestionDriver);
          const availability = await questionDriver.checkQuestionsAvailable(lessonId);
          setQuestionAvailability(availability);

          if (availability.hasQuestions) {
            setUseV2Mode(true);
          } else {
            setUseV2Mode(false);
          }
        } catch (v2Error) {
          // V2 check failed, fall back to V1 mode
          console.warn("[PracticeWizardPage] V2 availability check failed, using V1:", v2Error);
          setUseV2Mode(false);
        }

        // 3. Check for existing sessions (active, paused, OR completed)
        // BUG FIX: Previously only queried active,paused - completed sessions were ignored,
        // causing users to restart instead of seeing completion summary
        let existingSession = null;
        let isCompletedSession = false;
        try {
          // Query for ALL sessions including completed
          const sessionResponse = await fetch(
            `/api/practice-sessions?status=active,paused,completed&source_id=${lessonId}&source_type=lesson_template&limit=1`
          );

          if (sessionResponse.ok) {
            const data = await sessionResponse.json();
            if (data.sessions?.length > 0) {
              const sessionDoc = data.sessions[0];

              // Check if session is completed - show summary view instead of restarting
              // UNLESS forceFreshStart is true (user clicked "Practice Again")
              if (sessionDoc.status === 'completed' && !forceFreshStart) {
                isCompletedSession = true;

                // Parse blocks_progress to get completion stats
                const blocksProgress = typeof sessionDoc.blocks_progress === "string"
                  ? JSON.parse(sessionDoc.blocks_progress)
                  : sessionDoc.blocks_progress || [];

                setCompletedSession({
                  overall_mastery: sessionDoc.overall_mastery || 0,
                  completed_blocks: blocksProgress.filter((b: { is_complete?: boolean }) => b.is_complete).length,
                  total_blocks: sessionDoc.total_blocks || blocksProgress.length,
                  completed_at: sessionDoc.updated_at,
                  session_id: sessionDoc.session_id, // Track for potential deletion
                });
              } else if (!forceFreshStart) {
                // Active/paused session found - show resume prompt
                const blocksProgress = typeof sessionDoc.blocks_progress === "string"
                  ? JSON.parse(sessionDoc.blocks_progress)
                  : sessionDoc.blocks_progress || [];

                // Get current block's difficulty
                const currentBlockProgress = blocksProgress[sessionDoc.current_block_index];
                const currentDifficulty = currentBlockProgress?.current_difficulty || 'easy';

                // Build pending session data for resume prompt
                // FIX: Use current block's mastery_score, not top-level overall_mastery
                // The per-block mastery_score is updated in real-time during practice,
                // while sessionDoc.overall_mastery may not be updated correctly
                setPendingSession({
                  session_id: sessionDoc.session_id,
                  current_block_index: sessionDoc.current_block_index || 0,
                  total_blocks: sessionDoc.total_blocks || blocksProgress.length,
                  overall_mastery: currentBlockProgress?.mastery_score || 0,
                  current_difficulty: currentDifficulty,
                  blocks_progress: blocksProgress,
                  raw_session: {
                    ...sessionDoc,
                    source_metadata:
                      typeof sessionDoc.source_metadata === "string"
                        ? JSON.parse(sessionDoc.source_metadata)
                        : sessionDoc.source_metadata,
                    blocks:
                      typeof sessionDoc.blocks === "string"
                        ? JSON.parse(sessionDoc.blocks)
                        : sessionDoc.blocks,
                    blocks_progress: blocksProgress,
                    current_question: sessionDoc.current_question
                      ? typeof sessionDoc.current_question === "string"
                        ? JSON.parse(sessionDoc.current_question)
                        : sessionDoc.current_question
                      : null,
                  },
                });

                // Show the resume prompt modal
                setShowResumePrompt(true);
                setLoading(false);
                return;
              } else {
                // forceFreshStart is true - skip this session and start fresh
              }
            }
          }
        } catch (sessionError) {
          console.warn("[PracticeWizardPage] Error fetching session:", sessionError);
          // Continue without existing session
        }

        // If session is completed, don't build practice context - show summary instead
        if (isCompletedSession) {
          setLoading(false);
          return;
        }

        // 4. Build practice context (fresh start - no stored session)
        const decompressedCards = decompressCards(lessonTemplate.cards);

        const context: PracticeSessionContext = {
          student_id: currentStudentId,
          lesson_template_id: lessonId,
          source_type: "lesson_template",
          lesson_snapshot: {
            ...lessonTemplate,
            lessonTemplateId: lessonTemplate.$id,
            cards: decompressedCards,
          },
        };

        setPracticeContext(context);
      } catch (err) {
        console.error("[PracticeWizardPage] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to load practice");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [lessonId, backendAvailable, createDriver, forceFreshStart, resetCounter]);

  // Handle exit
  const handleExit = useCallback(() => {
    router.back();
  }, [router]);

  // Handle resume from pending session
  const handleResumeSession = useCallback(async () => {
    if (!pendingSession || !studentId) return;

    setShowResumePrompt(false);
    setLoading(true);

    try {
      // Get lesson template again to build context
      const lessonDriver = createDriver(LessonDriver);
      const lessonTemplate = await lessonDriver.getLessonTemplate(lessonId);

      if (!lessonTemplate) {
        throw new Error("Lesson not found");
      }

      const decompressedCards = decompressCards(lessonTemplate.cards);

      // Build context with stored session for resume
      const context: PracticeSessionContext = {
        student_id: studentId,
        lesson_template_id: lessonId,
        source_type: "lesson_template",
        lesson_snapshot: {
          ...lessonTemplate,
          lessonTemplateId: lessonTemplate.$id,
          cards: decompressedCards,
        },
        stored_session: pendingSession.raw_session,
      };

      setPendingSession(null);
      setPracticeContext(context);
    } catch (err) {
      console.error("[PracticeWizardPage] Resume error:", err);
      setError(err instanceof Error ? err.message : "Failed to resume practice");
    } finally {
      setLoading(false);
    }
  }, [pendingSession, studentId, lessonId, createDriver]);

  // Handle start fresh from pending session (delete session + clear mastery)
  const handleStartFresh = useCallback(async () => {
    if (!pendingSession) return;

    setIsStartingFresh(true);

    try {
      // 1. Delete the existing session
      const deleteResponse = await fetch(
        `/api/practice-sessions/${pendingSession.session_id}`,
        { method: 'DELETE' }
      );

      if (!deleteResponse.ok) {
        throw new Error("Failed to delete existing session");
      }

      // 2. Clear mastery for this lesson's outcomes
      const masteryResponse = await fetch('/api/mastery/reset-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_template_id: lessonId }),
      });

      if (!masteryResponse.ok) {
        console.warn("[PracticeWizardPage] Mastery reset failed - continuing anyway");
      }

      // 3. Reset state and trigger fresh load
      setShowResumePrompt(false);
      setPendingSession(null);
      setForceFreshStart(true);
      setLoading(true);
    } catch (err) {
      console.error("[PracticeWizardPage] Start fresh error:", err);
      setError(err instanceof Error ? err.message : "Failed to start fresh");
    } finally {
      setIsStartingFresh(false);
    }
  }, [pendingSession, lessonId]);

  // Handle full reset from WizardPracticeContainer
  const handleResetSession = useCallback(async () => {
    if (!practiceContext) return;

    try {
      // 1. Query for any active session for this lesson and delete it
      // NOTE: Can't rely on practiceContext.stored_session?.session_id because
      // fresh sessions (not resumed) don't have stored_session populated
      const sessionResponse = await fetch(
        `/api/practice-sessions?status=active,paused&source_id=${lessonId}&source_type=lesson_template&limit=1`
      );

      if (sessionResponse.ok) {
        const data = await sessionResponse.json();
        if (data.sessions?.length > 0) {
          const sessionToDelete = data.sessions[0];

          const deleteResponse = await fetch(
            `/api/practice-sessions/${sessionToDelete.session_id}`,
            { method: 'DELETE' }
          );

          if (!deleteResponse.ok) {
            throw new Error("Failed to delete session");
          }
        }
      }

      // 2. Clear mastery for this lesson
      await fetch('/api/mastery/reset-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_template_id: lessonId }),
      });

      // 3. Reset state and trigger fresh load
      // BUG FIX: Use resetCounter to force useEffect re-trigger
      // Setting forceFreshStart to true when it's already true doesn't trigger useEffect
      setPracticeContext(null);
      setForceFreshStart(true);
      setResetCounter(c => c + 1); // Always triggers useEffect
      setLoading(true);
    } catch (err) {
      console.error("[PracticeWizardPage] Reset session error:", err);
      throw err; // Re-throw to let WizardPracticeContainer handle it
    }
  }, [practiceContext, lessonId]);

  // Loading state - playful design
  if (loading || isLoadingSubscription) {
    return (
      <div className="wizard-page min-h-dvh flex items-center justify-center bg-gradient-to-br from-emerald-50 via-cyan-50 to-violet-50">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 animate-pulse" />
            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-bounce" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Preparing Your Practice
            </h2>
            <p className="text-gray-600">Loading awesome challenges...</p>
          </div>
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  // Completed session summary - show instead of restarting
  if (completedSession) {
    const masteryPercent = Math.round(completedSession.overall_mastery * 100);
    const completedDate = completedSession.completed_at
      ? new Date(completedSession.completed_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

    return (
      <div className="wizard-page min-h-dvh flex items-center justify-center bg-gradient-to-br from-emerald-50 via-cyan-50 to-violet-50">
        <div className="max-w-lg p-8 text-center animate-fade-in">
          {/* Success icon with celebration */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-200">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400" />
          </div>

          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Practice Complete! 🎉
          </h2>
          <p className="text-gray-600 mb-6">
            {lessonTitle}
          </p>

          {/* Stats */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-sm">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-600">{masteryPercent}%</div>
                <div className="text-sm text-gray-500">Overall Mastery</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-cyan-600">
                  {completedSession.completed_blocks}/{completedSession.total_blocks}
                </div>
                <div className="text-sm text-gray-500">Blocks Completed</div>
              </div>
            </div>
            {completedDate && (
              <p className="text-xs text-gray-400 mt-4">Completed on {completedDate}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lesson
            </Button>
            <Button
              onClick={async () => {
                // Delete the completed session to allow a fresh start
                // This prevents the old session from being found again
                if (completedSession.session_id) {
                  try {
                    await fetch(`/api/practice-sessions/${completedSession.session_id}`, {
                      method: 'DELETE',
                    });
                  } catch (deleteError) {
                    console.warn("[PracticeWizardPage] Failed to delete completed session:", deleteError);
                  }
                }

                // Reset state and trigger re-fetch
                setCompletedSession(null);
                setForceFreshStart(true);
                setLoading(true);
              }}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0"
            >
              <Sparkles className="w-4 h-4" />
              Practice Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Resume prompt state - show modal for active/paused sessions
  if (showResumePrompt && pendingSession) {
    return (
      <div className="wizard-page min-h-dvh flex items-center justify-center bg-gradient-to-br from-emerald-50 via-cyan-50 to-violet-50">
        <ResumePromptModal
          open={showResumePrompt}
          onOpenChange={setShowResumePrompt}
          sessionData={{
            current_block_index: pendingSession.current_block_index,
            total_blocks: pendingSession.total_blocks,
            overall_mastery: pendingSession.overall_mastery,
            current_difficulty: pendingSession.current_difficulty,
          }}
          onResume={handleResumeSession}
          onStartFresh={handleStartFresh}
          isStartingFresh={isStartingFresh}
        />
      </div>
    );
  }

  // Error state
  if (error || !studentId || !practiceContext) {
    return (
      <div className="wizard-page min-h-dvh flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
        <div className="max-w-md p-8 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Oops! Something Went Wrong
          </h2>
          <p className="text-gray-600 mb-6">
            {error || "Could not load your practice session."}
          </p>
          <Button
            onClick={() => router.back()}
            className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Main wizard view
  return (
    <WizardPracticeContainer
      practiceContext={practiceContext}
      lessonTitle={lessonTitle}
      onExit={handleExit}
      useV2Mode={useV2Mode}
      questionAvailability={questionAvailability}
      onResetSession={handleResetSession}
    />
  );
}
