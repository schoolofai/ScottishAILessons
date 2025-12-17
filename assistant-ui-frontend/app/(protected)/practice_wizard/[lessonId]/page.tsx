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
            console.log("[PracticeWizardPage] V2 offline questions available:", availability.totalCount);
            setUseV2Mode(true);
          } else {
            console.log("[PracticeWizardPage] No offline questions, falling back to V1 real-time generation");
            setUseV2Mode(false);
          }
        } catch (v2Error) {
          // V2 check failed, fall back to V1 mode
          console.warn("[PracticeWizardPage] V2 availability check failed, using V1:", v2Error);
          setUseV2Mode(false);
        }

        // 3. Check for existing active session
        let existingSession = null;
        try {
          const sessionResponse = await fetch(
            `/api/practice-sessions?status=active&source_id=${lessonId}&source_type=lesson_template&limit=1`
          );

          if (sessionResponse.ok) {
            const data = await sessionResponse.json();
            if (data.sessions?.length > 0) {
              const sessionDoc = data.sessions[0];
              existingSession = {
                ...sessionDoc,
                source_metadata:
                  typeof sessionDoc.source_metadata === "string"
                    ? JSON.parse(sessionDoc.source_metadata)
                    : sessionDoc.source_metadata,
                blocks:
                  typeof sessionDoc.blocks === "string"
                    ? JSON.parse(sessionDoc.blocks)
                    : sessionDoc.blocks,
                blocks_progress:
                  typeof sessionDoc.blocks_progress === "string"
                    ? JSON.parse(sessionDoc.blocks_progress)
                    : sessionDoc.blocks_progress,
                current_question: sessionDoc.current_question
                  ? typeof sessionDoc.current_question === "string"
                    ? JSON.parse(sessionDoc.current_question)
                    : sessionDoc.current_question
                  : null,
              };
            }
          }
        } catch {
          // Continue without existing session
        }

        // 4. Build practice context
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
          ...(existingSession && { stored_session: existingSession }),
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
  }, [lessonId, backendAvailable, createDriver]);

  // Handle exit
  const handleExit = useCallback(() => {
    router.back();
  }, [router]);

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
    />
  );
}
