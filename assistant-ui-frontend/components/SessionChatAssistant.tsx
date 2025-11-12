"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MyAssistant, SessionContext } from "./MyAssistant";
import { useAppwrite, SessionDriver } from "@/lib/appwrite";
import { CourseDriver } from "@/lib/appwrite/driver/CourseDriver";
import { CourseOutcomesDriver } from "@/lib/appwrite/driver/CourseOutcomesDriver";
import { DiagramDriver } from "@/lib/appwrite/driver/DiagramDriver";
import { RevisionNotesDriver } from "@/lib/appwrite/driver/RevisionNotesDriver";
import { enrichOutcomeRefs } from "@/lib/sessions/outcome-enrichment";
import { SessionHeader } from "./SessionHeader";
import { ContextChatPanel } from "./ContextChatPanel";
import { LessonNotesSidePanel } from "./revision-notes/LessonNotesSidePanel";
import { LessonNotesToggleButton } from "./revision-notes/LessonNotesToggleButton";
import { AITutorToggleButton } from "./revision-notes/AITutorToggleButton";
import { SidePanelResizeHandle } from "./revision-notes/SidePanelResizeHandle";
import { Client } from "@langchain/langgraph-sdk";
import { CurrentCardProvider } from "@/contexts/CurrentCardContext";
import { LessonExitWarningModal } from "./session/LessonExitWarningModal";
import { usePreventNavigation } from "@/hooks/usePreventNavigation";
import { NavigationPreventionProvider } from "@/contexts/NavigationPreventionContext";
import { useSidePanelResize } from "@/hooks/useSidePanelResize";
import { ActiveSidePanel } from "@/hooks/useRevisionNotes";
import { checkAllBackendsStatus, BackendUnavailableError, ContextChatBackendUnavailableError } from "@/lib/backend-status";
import { BackendErrorUI } from "./BackendErrorUI";
import { BackendCheckingUI } from "./BackendCheckingUI";

interface SessionChatAssistantProps {
  sessionId: string;
  threadId?: string;
}

export function SessionChatAssistant({ sessionId, threadId }: SessionChatAssistantProps) {
  const router = useRouter();
  const [sessionContext, setSessionContext] = useState<SessionContext | undefined>(undefined);
  const [existingThreadId, setExistingThreadId] = useState<string | undefined>(threadId);
  const [contextChatThreadId, setContextChatThreadId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backend availability state - FAIL FAST (NO FALLBACK)
  // Checks BOTH main backend AND context chat backend
  const [backendStatus, setBackendStatus] = useState<{
    available: boolean;
    checked: boolean;
    error?: BackendUnavailableError | ContextChatBackendUnavailableError;
  }>({ available: false, checked: false });

  // Side panel state (mutual exclusivity between ContextChat and LessonNotes)
  const [activeSidePanel, setActiveSidePanel] = useState<ActiveSidePanel>(ActiveSidePanel.None);

  // Lesson notes state (session-scoped cache)
  const [lessonNotesContent, setLessonNotesContent] = useState<string | null>(null);
  const [lessonNotesStatus, setLessonNotesStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lessonNotesError, setLessonNotesError] = useState<any>(null);
  const [lessonNotesAvailable, setLessonNotesAvailable] = useState<boolean | null>(null);
  const lessonNotesCacheRef = useRef<string | null>(null);

  // Navigation prevention state
  const [sessionStatus, setSessionStatus] = useState<'created' | 'active' | 'completed' | 'failed'>('active');
  const [showExitModal, setShowExitModal] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);

  const { createDriver } = useAppwrite();
  const threadIdRef = useRef<string | undefined>(existingThreadId);

  // Shared resize hook for both panels
  const { panelWidth, isResizing, handleMouseDown: handleResizeStart } = useSidePanelResize({
    initialWidth: 33,
    minWidth: 20,
    maxWidth: 50
  });

  // Check ALL backends availability FIRST - FAIL FAST (NO FALLBACK)
  // This checks BOTH main backend (teaching) AND context chat backend (AI Tutor)
  useEffect(() => {
    console.log('🔍 [Backend Boundary] Checking ALL backends availability (main + context chat)...');

    checkAllBackendsStatus()
      .then((result) => {
        if (result.available) {
          console.log('✅ [Backend Boundary] ALL backends are available and responding');
          setBackendStatus({ available: true, checked: true });
        } else {
          console.error('❌ [Backend Boundary] One or more backends unavailable:', result.error);
          setBackendStatus({
            available: false,
            checked: true,
            error: result.error,
          });
        }
      })
      .catch((err) => {
        console.error('❌ [Backend Boundary] Unexpected error checking backends:', err);
        setBackendStatus({
          available: false,
          checked: true,
          error: err instanceof BackendUnavailableError || err instanceof ContextChatBackendUnavailableError
            ? err
            : new BackendUnavailableError('Unexpected error checking backends'),
        });
      });
  }, []); // Run once on mount

  useEffect(() => {
    console.log('🔄 SessionChatAssistant - useEffect triggered:', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    const loadSessionContext = async () => {
      try {
        console.log('📥 SessionChatAssistant - Starting to load session context for:', sessionId);

        const sessionDriver = createDriver(SessionDriver);
        const courseDriver = createDriver(CourseDriver);

        // Load session with thread information including context chat thread
        const sessionWithThread = await sessionDriver.getSessionWithContextChat(sessionId);
        const sessionStateData = await sessionDriver.getSessionState(sessionId);

        if (!sessionStateData) {
          throw new Error("Session not found");
        }

        const { session, parsedSnapshot } = sessionStateData;

        console.log('📦 SessionChatAssistant - Session data loaded:', {
          sessionId: session.$id,
          hasThreadId: !!session.threadId,
          threadId: session.threadId,
          hasContextChatThreadId: !!sessionWithThread.contextChatThreadId
        });

        // Use threadId from session if available (priority: session.threadId > sessionWithThread.threadId)
        // This supports thread continuity from EnhancedDashboard
        if (session.threadId) {
          console.log('✅ SessionChatAssistant - Using threadId from session for continuity:', session.threadId);
          setExistingThreadId(session.threadId);
        } else if (sessionWithThread.threadId) {
          console.log('✅ SessionChatAssistant - Found existing thread ID:', sessionWithThread.threadId);
          setExistingThreadId(sessionWithThread.threadId);
        } else {
          console.log('ℹ️ SessionChatAssistant - No existing thread ID found, new thread will be created');
        }

        // Load context chat thread ID if available
        if (sessionWithThread.contextChatThreadId) {
          console.log('SessionChatAssistant - Found existing context chat thread ID:', sessionWithThread.contextChatThreadId);
          setContextChatThreadId(sessionWithThread.contextChatThreadId);
        } else {
          console.log('SessionChatAssistant - No existing context chat thread ID found, will create new one if needed');
        }

        // Extract courseId from lesson_snapshot and fetch course metadata
        const courseId = parsedSnapshot.courseId;
        let courseCurriculumMetadata = {};

        if (courseId) {
          try {
            console.log('SessionChatAssistant - Fetching course metadata for courseId:', courseId);
            courseCurriculumMetadata = await courseDriver.getCourseCurriculumMetadata(courseId);
            console.log('SessionChatAssistant - Course metadata fetched:', courseCurriculumMetadata);
          } catch (courseError) {
            console.error('SessionChatAssistant - Failed to fetch course metadata:', courseError);
            // Continue without course metadata - backend will use fallback values
          }
        } else {
          console.warn('SessionChatAssistant - No courseId found in lesson_snapshot');
        }

        // Enrich outcomes if outcomeRefs available
        let enrichedOutcomes = [];

        // 🔍 DEBUG: Log outcomeRefs before enrichment attempt
        console.log('🔍 [SessionChatAssistant DEBUG] Before enrichment:', {
          hasCourseId: !!courseId,
          courseId: courseId,
          outcomeRefsExists: !!parsedSnapshot.outcomeRefs,
          outcomeRefsLength: parsedSnapshot.outcomeRefs?.length,
          outcomeRefsType: typeof parsedSnapshot.outcomeRefs,
          outcomeRefsValue: JSON.stringify(parsedSnapshot.outcomeRefs),
          outcomeRefsArray: Array.isArray(parsedSnapshot.outcomeRefs) ? parsedSnapshot.outcomeRefs : 'NOT_ARRAY'
        });

        if (courseId && parsedSnapshot.outcomeRefs?.length > 0) {
          try {
            console.log('SessionChatAssistant - Enriching outcomes for:', parsedSnapshot.outcomeRefs);

            // 🔍 DEBUG: Log input to enrichOutcomeRefs
            console.log('🔍 [SessionChatAssistant DEBUG] Calling enrichOutcomeRefs with:', {
              outcomeRefsInput: parsedSnapshot.outcomeRefs,
              courseIdInput: courseId
            });

            const outcomeDriver = createDriver(CourseOutcomesDriver);
            enrichedOutcomes = await enrichOutcomeRefs(
              parsedSnapshot.outcomeRefs,
              courseId,
              outcomeDriver
            );

            // 🔍 DEBUG: Log enrichment output
            console.log('🔍 [SessionChatAssistant DEBUG] enrichOutcomeRefs returned:', {
              enrichedCount: enrichedOutcomes.length,
              enrichedOutcomeSample: enrichedOutcomes.slice(0, 2)
            });

            console.log('SessionChatAssistant - Enriched outcomes count:', enrichedOutcomes.length);

            // ✅ VALIDATION: Fail-fast if enrichment unexpectedly returns empty
            // Check if there were actual outcomeIds to enrich (not just assessment standards)
            const outcomeIds = outcomeDriver.extractOutcomeIds(parsedSnapshot.outcomeRefs);

            if (outcomeIds.length > 0 && enrichedOutcomes.length === 0) {
              // We SHOULD have found outcomes, but didn't - this is a critical error
              const errorMsg = `Outcome enrichment failed: Expected ${outcomeIds.length} outcomes from refs ${JSON.stringify(outcomeIds)}, but found 0`;

              console.error('❌ ENRICHMENT FAILURE:', {
                courseId,
                outcomeRefsInSnapshot: parsedSnapshot.outcomeRefs,
                outcomeIdsToFind: outcomeIds,
                enrichedOutcomesFound: enrichedOutcomes.length,
                errorMessage: errorMsg
              });

              // ✅ FAIL-FAST: Throw error to prevent session start
              throw new Error(errorMsg);
            } else if (outcomeIds.length === 0) {
              console.log('SessionChatAssistant - No outcome IDs to enrich (only assessment standards) - this is expected');
            } else {
              console.log(`SessionChatAssistant - Successfully enriched ${enrichedOutcomes.length} outcomes from ${outcomeIds.length} outcome IDs`);
            }
          } catch (outcomeError) {
            console.error('SessionChatAssistant - Failed to enrich outcomes:', outcomeError);
            // ✅ FAIL-FAST: Re-throw to prevent session start with corrupted data
            throw new Error(
              outcomeError instanceof Error
                ? outcomeError.message
                : 'Lesson data incomplete - mastery tracking unavailable. Please contact support.'
            );
          }
        } else {
          console.log('SessionChatAssistant - Skipping outcome enrichment (no courseId or outcomeRefs)');
        }

        // Check for lesson diagrams (diagram_context="lesson" for first card)
        // Note: Lesson diagrams are stored with actual cardIds (e.g., "card_001", "card_002")
        // We fetch the first card's lesson diagram to show before the greeting
        let lessonDiagram = null;
        const lessonTemplateId = parsedSnapshot.lessonTemplateId;
        const firstCardId = parsedSnapshot.cards?.[0]?.id;  // Cards use 'id' property, not 'cardId'

        console.log('📐 DIAGRAM FETCH DEBUG - Starting lesson diagram check');
        console.log('📐 DIAGRAM FETCH DEBUG - lessonTemplateId:', lessonTemplateId);
        console.log('📐 DIAGRAM FETCH DEBUG - firstCardId:', firstCardId);

        if (lessonTemplateId && firstCardId) {
          try {
            console.log('📐 DIAGRAM FETCH DEBUG - Creating DiagramDriver');
            const diagramDriver = createDriver(DiagramDriver);

            console.log('📐 DIAGRAM FETCH DEBUG - Calling getDiagramForCardByContext with:');
            console.log('  - lessonTemplateId:', lessonTemplateId);
            console.log('  - cardId:', firstCardId);
            console.log('  - context: "lesson"');

            const diagramResult = await diagramDriver.getDiagramForCardByContext(
              lessonTemplateId,
              firstCardId,  // Use actual first card ID (e.g., "card_001")
              'lesson'      // Fetch lesson diagram (not CFU diagram)
            );

            console.log('📐 DIAGRAM FETCH DEBUG - getDiagramForCardByContext returned:', diagramResult);

            if (diagramResult) {
              lessonDiagram = {
                image_file_id: diagramResult.image_file_id,
                diagram_type: diagramResult.diagram_type,
                title: diagramResult.title || 'Lesson Diagram',
                cardId: firstCardId  // Include cardId for backend tool call
              };
              console.log('📐 DIAGRAM FETCH SUCCESS - Lesson diagram found:', lessonDiagram);
            } else {
              console.log('📐 DIAGRAM FETCH RESULT - No lesson diagram found for first card');
            }
          } catch (diagramError) {
            console.error('📐 DIAGRAM FETCH ERROR - Failed to fetch lesson diagram:', diagramError);
            // Continue without diagram - it's optional
          }
        } else {
          console.log('📐 DIAGRAM FETCH SKIP - Missing lessonTemplateId or firstCardId');
        }

        const context: SessionContext = {
          session_id: session.$id,
          student_id: session.studentId,
          lesson_snapshot: parsedSnapshot,
          use_plain_text: false, // TODO: Get from user preferences when implemented
          ...courseCurriculumMetadata, // Add course_subject, course_level, sqa_course_code, course_title
          enriched_outcomes: enrichedOutcomes, // Add enriched CourseOutcome objects
          lesson_diagram: lessonDiagram, // Add lesson diagram if available
        };

        console.log('✅ SessionChatAssistant - Session context built successfully:', {
          session_id: context.session_id,
          student_id: context.student_id,
          hasLessonSnapshot: !!context.lesson_snapshot,
          lessonTitle: context.lesson_snapshot?.title,
          courseSubject: context.course_subject,
          courseLevel: context.course_level,
          enrichedOutcomesCount: enrichedOutcomes.length
        });

        console.log('📊 SessionChatAssistant - Thread info:', {
          existingThreadId: session.threadId,
          hasExistingConversation: sessionWithThread.hasExistingConversation,
          lastMessageAt: sessionWithThread.lastMessageAt
        });

        console.log('🎯 SessionChatAssistant - Setting session context state');
        setSessionContext(context);
        setSessionStatus(session.status); // Set status for navigation prevention
        console.log('✅ SessionChatAssistant - Session context state updated, status:', session.status);
      } catch (err) {
        console.error("Failed to load session context:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    loadSessionContext();
  }, [sessionId]); // CRITICAL FIX: Remove existingThreadId to prevent re-initialization loop

  // Check lesson notes availability when session context loads
  useEffect(() => {
    if (!sessionContext?.lesson_snapshot) return;

    const courseId = sessionContext.lesson_snapshot.courseId;
    const lessonOrder = sessionContext.lesson_snapshot.sow_order || 1;

    const checkAvailability = async () => {
      try {
        const revisionDriver = createDriver(RevisionNotesDriver);
        const exists = await revisionDriver.lessonNotesExist(courseId, lessonOrder);
        setLessonNotesAvailable(exists);
      } catch (err) {
        console.error('Failed to check lesson notes availability:', err);
        setLessonNotesAvailable(false);
      }
    };

    checkAvailability();
  }, [sessionContext, createDriver]);

  // Fetch lesson notes when panel opens for the first time
  useEffect(() => {
    if (activeSidePanel !== ActiveSidePanel.LessonNotes) return;
    if (lessonNotesCacheRef.current) {
      // Use cached content
      setLessonNotesContent(lessonNotesCacheRef.current);
      setLessonNotesStatus('success');
      return;
    }

    if (!sessionContext?.lesson_snapshot) return;

    const fetchLessonNotes = async () => {
      setLessonNotesStatus('loading');
      setLessonNotesError(null);

      try {
        const courseId = sessionContext.lesson_snapshot.courseId;
        const lessonOrder = sessionContext.lesson_snapshot.sow_order || 1;
        const revisionDriver = createDriver(RevisionNotesDriver);
        const notes = await revisionDriver.getLessonQuickNotes(courseId, lessonOrder);

        lessonNotesCacheRef.current = notes.markdownContent;
        setLessonNotesContent(notes.markdownContent);
        setLessonNotesStatus('success');
      } catch (err) {
        console.error('Failed to fetch lesson notes:', err);
        setLessonNotesError(err);
        setLessonNotesStatus('error');
      }
    };

    fetchLessonNotes();
  }, [activeSidePanel, sessionContext, createDriver]);

  // Clear lesson notes cache when session ends
  useEffect(() => {
    return () => {
      lessonNotesCacheRef.current = null;
    };
  }, [sessionId]);

  // Handle session status change from child components (e.g., LessonCompletionSummaryTool)
  // IMPORTANT: Must be BEFORE early returns to maintain consistent hook order
  const handleSessionStatusChange = useCallback((status: 'created' | 'active' | 'completed' | 'failed') => {
    console.log('🔄 Session status changed to:', status);
    setSessionStatus(status);
  }, []);

  // Navigation prevention: Warn user before leaving active session
  usePreventNavigation(
    sessionStatus === 'active' && !allowNavigation,
    () => setShowExitModal(true),
    allowNavigation
  );

  // Handle confirmed navigation
  const handleConfirmLeave = useCallback(() => {
    setAllowNavigation(true);
    setShowExitModal(false);

    // Navigate after a short delay to allow state to update
    setTimeout(() => {
      // Check if there's a pending navigation from Link click
      const pendingNav = sessionStorage.getItem('pendingNavigation');
      if (pendingNav) {
        sessionStorage.removeItem('pendingNavigation');
        router.push(pendingNav);
      } else {
        // Default to going back
        router.back();
      }
    }, 50);
  }, [router]);

  // Handle new thread creation - persist to session
  const handleThreadCreated = async (newThreadId: string) => {
    try {
      const sessionDriver = createDriver(SessionDriver);
      await sessionDriver.updateSessionThreadId(sessionId, newThreadId);
      threadIdRef.current = newThreadId;
      console.log('SessionChatAssistant - Thread ID persisted to session:', newThreadId);
    } catch (error) {
      console.error('SessionChatAssistant - Failed to persist thread ID:', error);
    }
  };

  // NOTE: getMainGraphState method removed - replaced with CurrentCardContext for deterministic context

  // Handle new context chat thread creation - persist to session
  const handleContextThreadCreated = async (newContextThreadId: string) => {
    try {
      const sessionDriver = createDriver(SessionDriver);
      await sessionDriver.updateContextChatThreadId(sessionId, newContextThreadId);
      setContextChatThreadId(newContextThreadId);
      console.log('SessionChatAssistant - Context chat thread ID persisted to session:', newContextThreadId);
    } catch (error) {
      console.error('SessionChatAssistant - Failed to persist context chat thread ID:', error);
    }
  };

  // Update thread ref when existingThreadId changes
  useEffect(() => {
    threadIdRef.current = existingThreadId;
  }, [existingThreadId]);

  // Panel toggle handlers (mutual exclusivity)
  const toggleLessonNotes = useCallback(() => {
    if (activeSidePanel === ActiveSidePanel.LessonNotes) {
      setActiveSidePanel(ActiveSidePanel.None);
    } else {
      setActiveSidePanel(ActiveSidePanel.LessonNotes);
    }
  }, [activeSidePanel]);

  const toggleContextChat = useCallback(() => {
    if (activeSidePanel === ActiveSidePanel.ContextChat) {
      setActiveSidePanel(ActiveSidePanel.None);
    } else {
      setActiveSidePanel(ActiveSidePanel.ContextChat);
    }
  }, [activeSidePanel]);

  const handleLessonNotesRetry = useCallback(async () => {
    if (!sessionContext?.lesson_snapshot) return;

    setLessonNotesStatus('loading');
    setLessonNotesError(null);

    try {
      const courseId = sessionContext.lesson_snapshot.courseId;
      const lessonOrder = sessionContext.lesson_snapshot.sow_order || 1;
      const revisionDriver = createDriver(RevisionNotesDriver);
      const notes = await revisionDriver.getLessonQuickNotes(courseId, lessonOrder);

      lessonNotesCacheRef.current = notes.markdownContent;
      setLessonNotesContent(notes.markdownContent);
      setLessonNotesStatus('success');
    } catch (err) {
      console.error('Failed to retry fetch lesson notes:', err);
      setLessonNotesError(err);
      setLessonNotesStatus('error');
    }
  }, [sessionContext, createDriver]);

  // BACKEND BOUNDARY: Show checking UI while verifying ALL backends
  if (!backendStatus.checked) {
    return <BackendCheckingUI message="Verifying backend connections (main + AI tutor)..." />;
  }

  // BACKEND BOUNDARY: Show error UI if backend unavailable (FAIL FAST - NO FALLBACK)
  if (!backendStatus.available && backendStatus.error) {
    return <BackendErrorUI error={backendStatus.error} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">Loading lesson...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-red-600" data-testid="error-message">
          {error}
        </div>
      </div>
    );
  }

  return (
    <NavigationPreventionProvider
      value={{
        shouldPreventNavigation: sessionStatus === 'active' && !allowNavigation,
        onNavigationAttempt: () => setShowExitModal(true),
        allowNavigation
      }}
    >
      <CurrentCardProvider onSessionStatusChange={handleSessionStatusChange}>
        <div className="flex h-screen">
        {/* Main Teaching Panel - Always takes available space */}
        <div className="flex flex-col flex-1">
          {/* Session Header with Side Panel Controls */}
          <header className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <SessionHeader sessionContext={sessionContext} />

              {/* Side Panel Button Group - Always Visible */}
              {sessionContext && (
                <div className="flex items-center gap-2">
                  <LessonNotesToggleButton
                    isOpen={activeSidePanel === ActiveSidePanel.LessonNotes}
                    onToggle={toggleLessonNotes}
                    disabled={!lessonNotesAvailable}
                    isLoading={lessonNotesAvailable === null}
                  />
                  <AITutorToggleButton
                    isOpen={activeSidePanel === ActiveSidePanel.ContextChat}
                    onToggle={toggleContextChat}
                  />
                </div>
              )}
            </div>
          </header>

        <div className="flex-1 min-h-0" data-testid="main-teaching-panel">
          <MyAssistant
            sessionId={sessionId}
            threadId={existingThreadId}
            sessionContext={sessionContext}
            onThreadCreated={handleThreadCreated}
          />
        </div>
      </div>

      {/* Context Chat Panel - Show when ContextChat is active */}
      {sessionContext && activeSidePanel === ActiveSidePanel.ContextChat && (
        <div
          className="relative flex-shrink-0"
          style={{ width: `${panelWidth}%` }}
        >
          <SidePanelResizeHandle
            onMouseDown={handleResizeStart}
            isResizing={isResizing}
          />
          <ContextChatPanel
            sessionId={sessionId}
            sessionContext={sessionContext}
            existingContextThreadId={contextChatThreadId}
            onThreadCreated={handleContextThreadCreated}
            onCollapseChange={(collapsed) => {
              if (collapsed) {
                setActiveSidePanel(ActiveSidePanel.None);
              }
            }}
          />
        </div>
      )}

      {/* Lesson Notes Panel - Show when LessonNotes is active */}
      {sessionContext && activeSidePanel === ActiveSidePanel.LessonNotes && (
        <LessonNotesSidePanel
          content={lessonNotesContent}
          status={lessonNotesStatus}
          error={lessonNotesError}
          retryState={{
            retryCount: 0,
            lastRetryTime: null,
            showBackoffHint: false,
            isRetrying: false
          }}
          onRetry={handleLessonNotesRetry}
          onClose={() => setActiveSidePanel(ActiveSidePanel.None)}
          panelWidth={panelWidth}
          isResizing={isResizing}
          onResizeStart={handleResizeStart}
        />
      )}
      </div>

      {/* Navigation Warning Modal */}
      <LessonExitWarningModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onConfirmLeave={handleConfirmLeave}
      />
      </CurrentCardProvider>
    </NavigationPreventionProvider>
  );
}