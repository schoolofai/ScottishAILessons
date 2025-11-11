"use client";

/**
 * Real Component Test Page with Mock Data
 *
 * This page tests the REAL SessionChatAssistant component architecture:
 * - ✅ Real Thread component from Assistant-UI
 * - ✅ Real Tool UI components (LessonCardPresentationTool, etc.)
 * - ✅ Mock LangGraph streaming events (no backend needed)
 * - ✅ Mock Appwrite drivers (no database needed)
 *
 * Navigate to: http://localhost:3000/test/real-component
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MockMyAssistant } from "@/components/test/MyAssistant.mock";
import { SessionHeader } from "@/components/SessionHeader";
import { ContextChatPanel } from "@/components/ContextChatPanel";
import { CurrentCardProvider } from "@/contexts/CurrentCardContext";
import { LessonExitWarningModal } from "@/components/session/LessonExitWarningModal";
import { usePreventNavigation } from "@/hooks/usePreventNavigation";
import { NavigationPreventionProvider } from "@/contexts/NavigationPreventionContext";
import { RetryPrepopulationProvider } from "@/contexts/RetryPrepopulationContext";

// Import mock data
import {
  mockSession,
  mockSessionContext,
} from "@/__mocks__/session-data";

/**
 * This component mirrors the real SessionChatAssistant.tsx structure
 * but uses MockMyAssistant with fake streaming events
 */
export default function RealComponentTestPage() {
  const router = useRouter();
  const [sessionId] = useState(mockSession.$id);
  const [sessionContext, setSessionContext] = useState(mockSessionContext);
  const [existingThreadId, setExistingThreadId] = useState<string | undefined>(undefined);
  const [contextChatThreadId, setContextChatThreadId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContextChatCollapsed, setIsContextChatCollapsed] = useState(false);
  const [contextChatWidth, setContextChatWidth] = useState(33);
  const [isResizing, setIsResizing] = useState(false);

  // Navigation prevention state
  const [sessionStatus, setSessionStatus] = useState<'created' | 'active' | 'completed' | 'failed'>('active');
  const [showExitModal, setShowExitModal] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);

  const threadIdRef = useRef<string | undefined>(existingThreadId);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Simulate session loading
  useEffect(() => {
    console.log('🔄 [TEST PAGE] Simulating session load...');

    // Simulate network delay
    setTimeout(() => {
      console.log('✅ [TEST PAGE] Session context loaded (from mock data)');
      setLoading(false);
    }, 500);
  }, [sessionId]);

  const handleSessionStatusChange = useCallback((status: 'created' | 'active' | 'completed' | 'failed') => {
    console.log('🔄 Session status changed to:', status);
    setSessionStatus(status);
  }, []);

  usePreventNavigation(
    sessionStatus === 'active' && !allowNavigation,
    () => setShowExitModal(true),
    allowNavigation
  );

  const handleConfirmLeave = useCallback(() => {
    setAllowNavigation(true);
    setShowExitModal(false);

    setTimeout(() => {
      const pendingNav = sessionStorage.getItem('pendingNavigation');
      if (pendingNav) {
        sessionStorage.removeItem('pendingNavigation');
        router.push(pendingNav);
      } else {
        router.back();
      }
    }, 50);
  }, [router]);

  const handleThreadCreated = async (newThreadId: string) => {
    console.log('🧵 [TEST PAGE] Thread created:', newThreadId);
    setExistingThreadId(newThreadId);
    threadIdRef.current = newThreadId;
  };

  const handleContextThreadCreated = async (newContextThreadId: string) => {
    console.log('🧵 [TEST PAGE] Context thread created:', newContextThreadId);
    setContextChatThreadId(newContextThreadId);
  };

  useEffect(() => {
    threadIdRef.current = existingThreadId;
  }, [existingThreadId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const mouseX = e.clientX;
      const newWidth = ((windowWidth - mouseX) / windowWidth) * 100;

      const constrainedWidth = Math.max(20, Math.min(50, newWidth));
      setContextChatWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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
    <RetryPrepopulationProvider>
      <NavigationPreventionProvider
        value={{
          shouldPreventNavigation: sessionStatus === 'active' && !allowNavigation,
          onNavigationAttempt: () => setShowExitModal(true),
          allowNavigation
        }}
      >
        <CurrentCardProvider onSessionStatusChange={handleSessionStatusChange}>
          {/* Test Mode Banner */}
          <div className="bg-gradient-to-r from-green-400 to-blue-500 px-6 py-4 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold flex items-center gap-2">
                  <span>✅</span>
                  <span>REAL COMPONENT TEST</span>
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                    Mock LangGraph Events + Real Tool UIs
                  </span>
                </div>
                <div className="text-sm text-white/90 mt-1">
                  Testing actual SessionChatAssistant architecture with fake streaming data
                </div>
              </div>
              <div className="text-sm">
                <div>Thread: <code className="bg-white/20 px-2 py-1 rounded">{existingThreadId || 'creating...'}</code></div>
                <div className="mt-1">Status: <span className="bg-white/30 px-2 py-1 rounded font-semibold">{sessionStatus}</span></div>
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-80px)]">
            {/* Main Teaching Panel */}
            <div className="flex flex-col flex-1">
              <SessionHeader sessionContext={sessionContext} />
              <div className="flex-1 min-h-0" data-testid="main-teaching-panel">
                <MockMyAssistant
                  sessionId={sessionId}
                  threadId={existingThreadId}
                  sessionContext={sessionContext}
                  onThreadCreated={handleThreadCreated}
                />
              </div>
            </div>

            {/* Context Chat Panel */}
            {sessionContext && !isContextChatCollapsed && (
              <div
                className="relative flex-shrink-0"
                style={{ width: `${contextChatWidth}%` }}
              >
                <div
                  ref={resizeRef}
                  onMouseDown={handleMouseDown}
                  className={`absolute left-0 top-0 w-1 h-full bg-gray-300 hover:bg-blue-500 cursor-col-resize z-10 transition-colors duration-200 ${
                    isResizing ? 'bg-blue-500' : ''
                  }`}
                  style={{ marginLeft: '-2px' }}
                  data-testid="resize-handle"
                  title="Drag to resize panel"
                />
                <ContextChatPanel
                  sessionId={sessionId}
                  sessionContext={sessionContext}
                  existingContextThreadId={contextChatThreadId}
                  onThreadCreated={handleContextThreadCreated}
                  onCollapseChange={setIsContextChatCollapsed}
                />
              </div>
            )}

            {/* Chat Bubble when collapsed */}
            {sessionContext && isContextChatCollapsed && (
              <button
                onClick={() => setIsContextChatCollapsed(false)}
                className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow-lg hover:shadow-xl z-50 transition-all duration-300 flex items-center gap-2 px-4 py-3 group"
                aria-label="Open AI tutor assistant"
                data-testid="context-chat-bubble"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="text-sm font-medium whitespace-nowrap">
                  Stuck? Ask Your AI Tutor
                </span>
              </button>
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
    </RetryPrepopulationProvider>
  );
}
