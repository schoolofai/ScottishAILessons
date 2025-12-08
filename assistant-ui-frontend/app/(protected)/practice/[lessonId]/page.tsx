"use client";

/**
 * Practice Page - Entry point for infinite practice mode
 *
 * Route: /practice/[lessonId]
 *
 * This page loads the student ID and renders the PracticeChatAssistant
 * which connects to the infinite_practice graph.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { PracticeChatAssistant } from "@/components/PracticeChatAssistant";
import { Client, Account, Databases, Query } from "appwrite";
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

  // Load student ID from current user
  useEffect(() => {
    const loadStudentId = async () => {
      try {
        // Validate lessonId
        if (!lessonId || lessonId === "undefined") {
          throw new Error("Invalid lesson ID");
        }

        const client = new Client()
          .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
          .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

        // Get session from localStorage (same pattern as other protected pages)
        const cookieFallback = localStorage.getItem("cookieFallback");
        if (!cookieFallback) {
          throw new Error("Session expired. Please log in again.");
        }

        const cookieData = JSON.parse(cookieFallback);
        const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
        const storedSession = cookieData[sessionKey];

        if (!storedSession) {
          throw new Error("Session expired. Please log in again.");
        }

        client.setSession(storedSession);

        const account = new Account(client);
        const databases = new Databases(client);

        // Get current user
        const user = await account.get();

        // Get student record
        const studentsResult = await databases.listDocuments(
          "default",
          "students",
          [Query.equal("userId", user.$id), Query.limit(1)]
        );

        if (studentsResult.documents.length === 0) {
          throw new Error("Student record not found. Please contact support.");
        }

        const student = studentsResult.documents[0];
        setStudentId(student.$id);

        console.log("✅ [PracticePage] Student ID loaded:", student.$id);
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
