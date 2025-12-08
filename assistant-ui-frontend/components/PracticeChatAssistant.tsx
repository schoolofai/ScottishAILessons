"use client";

/**
 * PracticeChatAssistant - Entry point for infinite practice mode
 *
 * This component loads a lesson template and starts the infinite practice graph
 * which provides adaptive difficulty practice with concept-by-concept progression.
 *
 * Usage: Navigate to /practice/[lessonTemplateId]
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { useAppwrite, LessonDriver } from "@/lib/appwrite";
import { SessionProvider } from "@/lib/SessionContext";
import { ReplayModeProvider } from "@/contexts/ReplayModeContext";
import { checkAllBackendsStatus, BackendUnavailableError } from "@/lib/backend-status";
import { BackendErrorUI } from "./BackendErrorUI";
import { BackendCheckingUI } from "./BackendCheckingUI";
import { useSubscription } from "@/hooks/useSubscription";

// Import infinite practice Tool UI components
import { ConceptPresentationTool } from "@/components/tools/ConceptPresentationTool";
import { PracticeQuestionTool } from "@/components/tools/PracticeQuestionTool";
import { PracticeFeedbackTool } from "@/components/tools/PracticeFeedbackTool";

// The infinite practice graph assistant ID (registered in langgraph.json)
const INFINITE_PRACTICE_ASSISTANT_ID = "infinite_practice";

/**
 * Context passed to the infinite practice graph
 * Different from SessionContext - designed for practice mode
 */
export interface PracticeContext {
  student_id: string;
  source_type: "lesson_template";
  source_data: Record<string, any>; // The lesson snapshot/template data
}

interface PracticeChatAssistantProps {
  lessonTemplateId: string;
  studentId: string;
  onThreadCreated?: (threadId: string) => void;
}

export function PracticeChatAssistant({
  lessonTemplateId,
  studentId,
  onThreadCreated,
}: PracticeChatAssistantProps) {
  const router = useRouter();
  const [practiceContext, setPracticeContext] = useState<PracticeContext | undefined>(undefined);
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);

  // Subscription access check
  const { hasAccess } = useSubscription();

  // Backend availability state
  const [backendStatus, setBackendStatus] = useState<{
    available: boolean;
    checked: boolean;
    error?: BackendUnavailableError;
  }>({ available: false, checked: false });

  const { createDriver } = useAppwrite();

  // Check backend availability
  useEffect(() => {
    console.log('🔍 [PracticeChatAssistant] Checking backend availability...');

    checkAllBackendsStatus()
      .then((result) => {
        if (!result.available) {
          console.error('❌ [PracticeChatAssistant] Backend unavailable:', result.error);
          setBackendStatus({
            available: false,
            checked: true,
            error: result.error as BackendUnavailableError,
          });
          return;
        }

        if (!hasAccess) {
          console.error('❌ [PracticeChatAssistant] User does not have active subscription');
          setError('Subscription required. Please subscribe to continue.');
          setBackendStatus({ available: false, checked: true });
          return;
        }

        console.log('✅ [PracticeChatAssistant] Backend available');
        setBackendStatus({ available: true, checked: true });
      })
      .catch((err) => {
        console.error('❌ [PracticeChatAssistant] Error checking backend:', err);
        setBackendStatus({
          available: false,
          checked: true,
          error: err instanceof BackendUnavailableError ? err : new BackendUnavailableError('Unexpected error'),
        });
      });
  }, [hasAccess]);

  // Load lesson template data
  useEffect(() => {
    if (!backendStatus.available) return;

    const loadLessonTemplate = async () => {
      try {
        console.log('📥 [PracticeChatAssistant] Loading lesson template:', lessonTemplateId);

        const lessonDriver = createDriver(LessonDriver);
        const lessonTemplate = await lessonDriver.getLessonTemplate(lessonTemplateId);

        if (!lessonTemplate) {
          throw new Error("Lesson template not found");
        }

        console.log('✅ [PracticeChatAssistant] Lesson template loaded:', {
          id: lessonTemplate.$id,
          title: lessonTemplate.title,
          cardCount: lessonTemplate.cards?.length || 0,
        });

        setLessonTitle(lessonTemplate.title || "Practice Session");

        // Build practice context for the infinite practice graph
        const context: PracticeContext = {
          student_id: studentId,
          source_type: "lesson_template",
          source_data: {
            ...lessonTemplate,
            lessonTemplateId: lessonTemplate.$id,
          },
        };

        setPracticeContext(context);
      } catch (err) {
        console.error("❌ [PracticeChatAssistant] Failed to load lesson template:", err);
        setError(err instanceof Error ? err.message : "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    };

    loadLessonTemplate();
  }, [lessonTemplateId, studentId, backendStatus.available, createDriver]);

  // LangGraph runtime for infinite practice
  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      // Create thread if needed
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;

        if (onThreadCreated) {
          onThreadCreated(thread_id);
        }
      }

      // Send message to infinite practice graph
      return sendMessage({
        threadId: threadIdRef.current,
        messages,
        command,
        sessionContext: practiceContext as any, // Practice context goes in session_context
        assistantId: INFINITE_PRACTICE_ASSISTANT_ID, // Use infinite practice graph
      });
    },
    onSwitchToNewThread: async () => {
      const { thread_id } = await createThread();
      threadIdRef.current = thread_id;

      if (onThreadCreated) {
        onThreadCreated(thread_id);
      }
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;

      return {
        messages: state.values.messages,
        interrupts: state.tasks?.[0]?.interrupts,
      };
    },
  });

  // Backend checking UI
  if (!backendStatus.checked) {
    return <BackendCheckingUI message="Connecting to practice server..." />;
  }

  // Backend error UI
  if (!backendStatus.available && backendStatus.error) {
    return <BackendErrorUI error={backendStatus.error} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">Loading practice session...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <ReplayModeProvider isReplayMode={false}>
      <SessionProvider isSessionMode={true}>
        <div className="flex flex-col h-full">
          {/* Practice Header */}
          <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Infinite Practice</h1>
                <p className="text-purple-100 text-sm">{lessonTitle}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  Adaptive Difficulty
                </span>
                <button
                  onClick={() => router.back()}
                  className="text-white/80 hover:text-white text-sm"
                >
                  Exit Practice
                </button>
              </div>
            </div>
          </header>

          {/* Practice Chat Area */}
          <div className="flex-1 min-h-0">
            <AssistantRuntimeProvider runtime={runtime}>
              <Thread />

              {/* Infinite Practice Tool UI components */}
              <ConceptPresentationTool />
              <PracticeQuestionTool />
              <PracticeFeedbackTool />
            </AssistantRuntimeProvider>
          </div>
        </div>
      </SessionProvider>
    </ReplayModeProvider>
  );
}
