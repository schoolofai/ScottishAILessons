"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { ExamContainer } from "@/components/exam/ExamContainer";
import { DashboardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { MockExam } from "@/lib/exam/types";

interface ExamPageProps {
  params: Promise<{
    examId: string;
  }>;
}

/**
 * Mock Exam Page
 *
 * Main entry point for the mock exam experience. Handles:
 * - Loading exam data from API
 * - Creating exam attempt
 * - Rendering the exam container with all question types
 * - Submission and results display
 */
export default function ExamPage({ params }: ExamPageProps) {
  const { examId } = use(params);
  const router = useRouter();

  const [exam, setExam] = useState<MockExam | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeExam();
  }, [examId]);

  const initializeExam = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch student data
      const studentResponse = await fetch('/api/student/me', {
        credentials: 'include',
      });

      if (!studentResponse.ok) {
        if (studentResponse.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch student data');
      }

      const studentData = await studentResponse.json();
      if (!studentData.success) {
        throw new Error(studentData.error || 'Failed to load student');
      }

      setStudentId(studentData.student.$id);

      // 2. Fetch exam data
      const examResponse = await fetch(`/api/exam/${examId}`, {
        credentials: 'include',
      });

      if (!examResponse.ok) {
        const errorData = await examResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load exam');
      }

      const examData = await examResponse.json();
      if (!examData.success) {
        throw new Error(examData.error || 'Failed to load exam data');
      }

      setExam(examData.exam);

      // 3. Create exam attempt
      const attemptResponse = await fetch('/api/exam/attempt', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examId,
          courseId: examData.exam.courseId,
        }),
      });

      if (!attemptResponse.ok) {
        const errorData = await attemptResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create exam attempt');
      }

      const attemptData = await attemptResponse.json();
      setAttemptId(attemptData.attemptId);

      console.log('[ExamPage] Initialized:', {
        examId,
        attemptId: attemptData.attemptId,
        studentId: studentData.student.$id,
        title: examData.exam.metadata.title,
      });

    } catch (err) {
      console.error('[ExamPage] Initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize exam');
    } finally {
      setLoading(false);
    }
  };

  const handleExamComplete = async () => {
    // Navigate back to dashboard after exam completion
    router.push('/dashboard');
  };

  const handleExitExam = () => {
    // Confirm before exiting
    if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
      router.push('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!exam || !attemptId || !studentId) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Alert variant="destructive">
            <AlertDescription>Missing required exam data</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <ExamContainer
          exam={exam}
          attemptId={attemptId}
          studentId={studentId}
          onComplete={handleExamComplete}
          onExit={handleExitExam}
        />
      </main>
    </div>
  );
}
