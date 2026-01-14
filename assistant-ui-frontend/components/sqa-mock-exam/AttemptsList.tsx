"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DashboardSkeleton } from "@/components/ui/LoadingSkeleton";
import { GradeBadge } from "./GradeBadge";
import { StatusBadge } from "./StatusBadge";
import { Eye, RefreshCw, FileQuestion } from "lucide-react";
import { logger, createLogger } from "@/lib/logger";
import type { Grade } from "@/lib/sqa-mock-exam/types";

const log = createLogger("AttemptsList");

/**
 * Enriched attempt with exam title for display
 */
interface EnrichedAttempt {
  attemptId: string;
  examId: string;
  examTitle: string;
  attemptNumber: number;
  status: "in_progress" | "submitted" | "graded" | "grading_error";
  marksEarned?: number;
  marksPossible?: number;
  percentage?: number;
  grade?: Grade;
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
}

interface AttemptsListProps {
  courseId?: string;
  onSwitchToExams?: () => void;
}

/**
 * AttemptsList - Displays student's past exam attempts
 *
 * Shows a table of attempts with:
 * - Exam title
 * - Attempt number
 * - Score (if graded)
 * - Grade badge
 * - Status badge
 * - Review/Resume actions
 */
export function AttemptsList({ courseId, onSwitchToExams }: AttemptsListProps) {
  const router = useRouter();
  const [attempts, setAttempts] = useState<EnrichedAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAttempts();
  }, [courseId]);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = courseId
        ? `/api/sqa-mock-exam/attempt?courseId=${encodeURIComponent(courseId)}`
        : "/api/sqa-mock-exam/attempt";

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load attempts");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load attempts");
      }

      setAttempts(data.attempts);
      log.info(`Loaded ${data.attempts.length} exam attempts`);
    } catch (err) {
      log.error("Failed to fetch attempts", { error: err });
      setError(err instanceof Error ? err.message : "Failed to load attempts");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchAttempts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (attempts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileQuestion className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Exam Attempts Yet
          </h3>
          <p className="text-gray-600 mb-4">
            You haven&apos;t taken any mock exams yet. Start practicing to see
            your attempts here.
          </p>
          <Button
            variant="default"
            onClick={onSwitchToExams}
            disabled={!onSwitchToExams}
          >
            Browse Available Exams
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Exam Attempts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead className="text-center">Attempt</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-center">Grade</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((attempt) => (
              <TableRow key={attempt.attemptId}>
                <TableCell className="whitespace-nowrap">
                  <div className="font-medium">
                    {formatDate(attempt.submittedAt || attempt.startedAt)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTime(attempt.submittedAt || attempt.startedAt)}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {attempt.examTitle}
                </TableCell>
                <TableCell className="text-center">
                  #{attempt.attemptNumber}
                </TableCell>
                <TableCell className="text-right">
                  {attempt.status === "graded" &&
                  attempt.marksEarned !== undefined ? (
                    <div>
                      <span className="font-semibold">
                        {attempt.marksEarned}/{attempt.marksPossible}
                      </span>
                      <span className="text-gray-500 text-sm ml-1">
                        ({attempt.percentage?.toFixed(0)}%)
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {attempt.grade ? (
                    <GradeBadge grade={attempt.grade} size="sm" />
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={attempt.status} />
                </TableCell>
                <TableCell className="text-right">
                  {attempt.status === "graded" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/sqa-mock-exam/attempt/${attempt.attemptId}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Link>
                    </Button>
                  ) : attempt.status === "in_progress" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/sqa-mock-exam/${attempt.examId}`}>
                        Resume
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-gray-400 text-sm">Processing...</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
