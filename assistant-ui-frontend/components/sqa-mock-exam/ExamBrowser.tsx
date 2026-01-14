"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Calculator, BookOpen, ChevronRight } from "lucide-react";
import { logger, createLogger } from "@/lib/logger";

const log = createLogger("SQAExamBrowser");

interface ExamBrowseItem {
  examId: string;
  subject: string;
  level: string;
  courseId: string;
  examVersion: number;
  status: string;
  title: string;
  totalMarks: number;
  durationMinutes: number;
  calculatorAllowed: boolean;
  topicCoverage: string[];
  createdAt: string;
}

interface ExamBrowserProps {
  courseId?: string;
}

/**
 * ExamBrowser - Lists available SQA mock exams
 *
 * Displays exam cards with metadata and allows navigation to exam taking.
 */
export function ExamBrowser({ courseId }: ExamBrowserProps) {
  const router = useRouter();
  const [exams, setExams] = useState<ExamBrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExams();
  }, [courseId]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = courseId
        ? `/api/sqa-mock-exam?courseId=${encodeURIComponent(courseId)}`
        : "/api/sqa-mock-exam";

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load exams");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load exams");
      }

      setExams(data.exams);
      log.info(`Loaded ${data.exams.length} SQA mock exams`);
    } catch (err) {
      log.error("Failed to fetch exams", { error: err });
      setError(err instanceof Error ? err.message : "Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (examId: string) => {
    router.push(`/sqa-mock-exam/${examId}`);
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Exams Available</h3>
          <p className="text-gray-500 mt-2">
            There are no SQA mock exams available at this time.
            Check back later for new exams.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Available Mock Exams</h2>
        <Badge variant="outline">{exams.length} exam{exams.length !== 1 ? "s" : ""}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <Card
            key={exam.examId}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleStartExam(exam.examId)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{exam.title}</CardTitle>
                <Badge variant="secondary">{exam.level}</Badge>
              </div>
              <p className="text-sm text-gray-500">{exam.subject}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Exam details */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{exam.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{exam.totalMarks} marks</span>
                  </div>
                  {/* Calculator status - backward compatible: default to true for legacy exams */}
                  {(exam.calculatorAllowed ?? true) ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <Calculator className="h-4 w-4" />
                      <span>Calculator</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="4" y1="2" x2="20" y2="22" strokeWidth="2.5" />
                      </svg>
                      <span>No Calculator</span>
                    </div>
                  )}
                </div>

                {/* Topics covered */}
                {exam.topicCoverage && exam.topicCoverage.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {exam.topicCoverage.slice(0, 3).map((topic) => (
                      <Badge key={topic} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                    {exam.topicCoverage.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{exam.topicCoverage.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Start button */}
                <Button className="w-full mt-2" variant="default">
                  Start Exam
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
