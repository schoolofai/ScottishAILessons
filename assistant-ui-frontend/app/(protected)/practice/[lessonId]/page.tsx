"use client";

/**
 * Practice Page - Entry point for infinite practice mode
 *
 * Route: /practice/[lessonId]
 *
 * This page loads the student ID via server API and renders the PracticeChatAssistant
 * which connects to the infinite_practice graph.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { PracticeChatAssistant } from "@/components/PracticeChatAssistant";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;

  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);

  // Load student ID via server API (uses httpOnly cookie auth)
  useEffect(() => {
    const loadStudentId = async () => {
      try {
        // Validate lessonId
        if (!lessonId || lessonId === "undefined") {
          throw new Error("Invalid lesson ID");
        }

        // Use server API to get student data (proper server-side auth)
        const response = await fetch('/api/student/me');

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Session expired. Please log in again.");
          }
          throw new Error("Failed to fetch student data");
        }

        const data = await response.json();

        if (!data.success || !data.student) {
          throw new Error("Student record not found. Please contact support.");
        }

        setStudentId(data.student.$id);
        console.log("✅ [PracticePage] Student ID loaded via API:", data.student.$id);
      } catch (err) {
        console.error("❌ [PracticePage] Failed to load student ID:", err);
        setError(err instanceof Error ? err.message : "Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    loadStudentId();
  }, [lessonId]);

  // Handle thread creation for potential future session persistence
  const handleThreadCreated = (newThreadId: string) => {
    console.log("🧵 [PracticePage] Practice thread created:", newThreadId);
    setThreadId(newThreadId);
    // TODO: Could persist practice thread to a practice_sessions collection
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-gray-600">Loading practice session...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !studentId) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Start Practice
            </h2>
            <p className="text-gray-600 mb-6">
              {error || "Could not load your student information."}
            </p>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Main practice view
  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <PracticeChatAssistant
          lessonTemplateId={lessonId}
          studentId={studentId}
          onThreadCreated={handleThreadCreated}
        />
      </main>
    </div>
  );
}
