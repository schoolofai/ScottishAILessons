"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DashboardSkeleton } from "@/components/ui/LoadingSkeleton";
import { SQAResultsSummary } from "@/components/sqa-mock-exam/SQAResultsSummary";
import { AnswerComparisonPanel } from "@/components/sqa-mock-exam/AnswerComparisonPanel";
import { ArrowLeft, RotateCcw, Home } from "lucide-react";
import { logger, createLogger } from "@/lib/logger";
import type {
  EvaluationResult,
  Nat5PlusMockExam,
  StudentAnswer,
} from "@/lib/sqa-mock-exam/types";

const log = createLogger("AttemptReviewPage");

interface AttemptData {
  attemptId: string;
  examId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
  marksEarned?: number;
  marksPossible?: number;
  percentage?: number;
  grade?: string;
  evaluationResult?: EvaluationResult;
  studentAnswers?: StudentAnswer[];
}

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

/**
 * Attempt Review Page
 *
 * Displays the results of a completed exam attempt with:
 * - Overall results summary (grade, score, breakdown)
 * - Side-by-side answer comparison (student vs expected)
 * - Detailed feedback per question
 * - Actions to retake exam or return to hub
 */
export default function AttemptReviewPage({ params }: PageProps) {
  const { attemptId } = use(params);
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [exam, setExam] = useState<Nat5PlusMockExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAttemptData();
  }, [attemptId]);

  const fetchAttemptData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch attempt with evaluation result AND student answers
      const attemptRes = await fetch(
        `/api/sqa-mock-exam/attempt/${attemptId}?includeAnswers=true`,
        { credentials: "include" }
      );

      if (!attemptRes.ok) {
        if (attemptRes.status === 401) {
          router.push("/login");
          return;
        }
        if (attemptRes.status === 404) {
          throw new Error("Attempt not found");
        }
        const errorData = await attemptRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load attempt");
      }

      const attemptData = await attemptRes.json();

      if (attemptData.status !== "graded") {
        throw new Error("This attempt has not been graded yet");
      }

      // Fetch exam for question context
      const examRes = await fetch(`/api/sqa-mock-exam/${attemptData.examId}`, {
        credentials: "include",
      });

      if (!examRes.ok) {
        throw new Error("Failed to load exam details");
      }

      const examData = await examRes.json();

      // Extract exam from API response wrapper
      if (!examData.success || !examData.exam) {
        throw new Error("Failed to load exam details");
      }

      setAttempt(attemptData);
      setExam(examData.exam);
      log.info("Loaded attempt review data", {
        attemptId,
        grade: attemptData.grade,
      });
    } catch (err) {
      log.error("Failed to fetch attempt data", { error: err });
      setError(err instanceof Error ? err.message : "Failed to load attempt");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6 px-4 max-w-4xl">
            <DashboardSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6 px-4 max-w-4xl">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/sqa-mock-exam">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Mock Exams
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!attempt || !exam || !attempt.evaluationResult) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6 px-4 max-w-4xl">
            <Alert>
              <AlertDescription>No results data available.</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/sqa-mock-exam">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Mock Exams
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const { evaluationResult, studentAnswers } = attempt;

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-6 px-4 max-w-4xl">
          {/* Back navigation */}
          <Button variant="ghost" asChild className="mb-4 -ml-2">
            <Link href="/sqa-mock-exam">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Mock Exams
            </Link>
          </Button>

          {/* Header with exam info */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{exam.metadata.title}</h1>
            <p className="text-gray-600 mt-1">
              Attempt #{attempt.attemptNumber} •{" "}
              {formatDate(attempt.submittedAt || attempt.startedAt)}
            </p>
          </div>

          {/* Results Summary */}
          <div className="mb-8">
            <SQAResultsSummary
              overallResult={evaluationResult.overall_result}
              sectionResults={evaluationResult.section_results}
              encouragementMessage={evaluationResult.encouragement_message}
            />
          </div>

          {/* Answer Comparison Panel */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Question-by-Question Review</h2>
            <AnswerComparisonPanel
              exam={exam}
              studentAnswers={studentAnswers || []}
              evaluationResult={evaluationResult}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-4 py-6 border-t">
            <Button asChild className="bg-amber-600 hover:bg-amber-700">
              <Link href={`/sqa-mock-exam/${exam.exam_id}`}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake This Exam
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sqa-mock-exam">
                <Home className="mr-2 h-4 w-4" />
                Back to Exam Hub
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
