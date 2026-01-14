"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/ui/header";
import { ExamBrowser } from "@/components/sqa-mock-exam/ExamBrowser";
import { AttemptsList } from "@/components/sqa-mock-exam/AttemptsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileQuestion, History } from "lucide-react";
import Link from "next/link";

/**
 * SQA Mock Exam Hub Page
 *
 * Two-tab interface for:
 * 1. Browsing available NAT5+ mock exams
 * 2. Viewing past exam attempts
 *
 * Supports courseId filter from URL query param for course-specific views.
 */
export default function SQAMockExamPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");
  const [activeTab, setActiveTab] = useState<string>("exams");
  const [courseName, setCourseName] = useState<string | null>(null);

  // Fetch course name if courseId is provided
  useEffect(() => {
    if (!courseId) {
      setCourseName(null);
      return;
    }

    const fetchCourseName = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCourseName(data.title || data.subject || null);
        }
      } catch {
        // Silently fail - course name is optional
      }
    };

    fetchCourseName();
  }, [courseId]);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-6 px-4 max-w-6xl">
          {/* Back to Dashboard Link */}
          <Button variant="ghost" asChild className="mb-4 -ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">SQA Mock Exams</h1>
              {courseId && courseName && (
                <Badge variant="secondary" className="text-sm">
                  {courseName}
                </Badge>
              )}
            </div>
            <p className="text-gray-600">
              Practice with AI-generated mock exams that follow SQA examination
              standards. Each exam includes detailed marking and feedback.
            </p>
          </div>

          {/* Tabs for Exams and Attempts */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="exams" className="gap-2">
                <FileQuestion className="h-4 w-4" />
                Available Exams
              </TabsTrigger>
              <TabsTrigger value="attempts" className="gap-2">
                <History className="h-4 w-4" />
                My Attempts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="exams">
              <ExamBrowser courseId={courseId || undefined} />
            </TabsContent>

            <TabsContent value="attempts">
              <AttemptsList
                courseId={courseId || undefined}
                onSwitchToExams={() => setActiveTab("exams")}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
