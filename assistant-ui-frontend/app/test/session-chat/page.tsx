"use client";

/**
 * Test Page for SessionChatAssistant
 *
 * This page allows manual testing of the SessionChatAssistant component
 * with fake data, without requiring a backend connection.
 *
 * Navigate to: http://localhost:3000/test/session-chat
 */

import { useState, useCallback } from 'react';
import { FakeMyAssistant } from '@/components/test/FakeMyAssistant';
import { FakeContextChatPanel } from '@/components/test/FakeContextChatPanel';
import { FakeSessionHeader } from '@/components/test/FakeSessionHeader';
import { CurrentCardProvider } from '@/contexts/CurrentCardContext';
import { NavigationPreventionProvider } from '@/contexts/NavigationPreventionContext';
import { mockSessionContext } from '@/__mocks__/session-data';

export default function TestSessionChatPage() {
  const [sessionId] = useState('test-session-123-fake');
  const [existingThreadId, setExistingThreadId] = useState<string | undefined>(undefined);
  const [contextChatThreadId, setContextChatThreadId] = useState<string | undefined>(undefined);
  const [sessionStatus, setSessionStatus] = useState<'created' | 'active' | 'completed' | 'failed'>('active');
  const [isContextChatCollapsed, setIsContextChatCollapsed] = useState(false);
  const [contextChatWidth, setContextChatWidth] = useState(33);
  const [showExitModal, setShowExitModal] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);

  const handleThreadCreated = useCallback((newThreadId: string) => {
    console.log('🧵 Main thread created:', newThreadId);
    setExistingThreadId(newThreadId);
  }, []);

  const handleContextThreadCreated = useCallback((newContextThreadId: string) => {
    console.log('🧵 Context thread created:', newContextThreadId);
    setContextChatThreadId(newContextThreadId);
  }, []);

  const handleSessionStatusChange = useCallback((status: 'created' | 'active' | 'completed' | 'failed') => {
    console.log('📊 Session status changed to:', status);
    setSessionStatus(status);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setAllowNavigation(true);
    setShowExitModal(false);
    console.log('🚪 User confirmed leave');
  }, []);

  return (
    <NavigationPreventionProvider
      value={{
        shouldPreventNavigation: sessionStatus === 'active' && !allowNavigation,
        onNavigationAttempt: () => setShowExitModal(true),
        allowNavigation,
      }}
    >
      <CurrentCardProvider onSessionStatusChange={handleSessionStatusChange}>
        <div className="flex h-screen flex-col">
          {/* Test Controls Banner */}
          <div className="bg-yellow-50 border-b-2 border-yellow-300 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-yellow-800 font-semibold">🧪 TEST MODE</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSessionStatus('active')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    sessionStatus === 'active'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setSessionStatus('completed')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    sessionStatus === 'completed'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setSessionStatus('failed')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    sessionStatus === 'failed'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Failed
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Main Thread:</span>{' '}
                <code className="bg-gray-200 px-2 py-1 rounded">
                  {existingThreadId || 'none'}
                </code>
              </div>
              <div>
                <span className="font-medium">Context Thread:</span>{' '}
                <code className="bg-gray-200 px-2 py-1 rounded">
                  {contextChatThreadId || 'none'}
                </code>
              </div>
              <div>
                <span className="font-medium">Status:</span>{' '}
                <span
                  className={`px-2 py-1 rounded font-medium ${
                    sessionStatus === 'active'
                      ? 'bg-green-100 text-green-800'
                      : sessionStatus === 'completed'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {sessionStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Main Layout */}
          <div className="flex flex-1 min-h-0">
            {/* Main Teaching Panel */}
            <div className="flex flex-col flex-1">
              <FakeSessionHeader sessionContext={mockSessionContext} />
              <div className="flex-1 min-h-0" data-testid="main-teaching-panel">
                <FakeMyAssistant
                  sessionId={sessionId}
                  threadId={existingThreadId}
                  sessionContext={mockSessionContext}
                  onThreadCreated={handleThreadCreated}
                />
              </div>
            </div>

            {/* Context Chat Panel */}
            {!isContextChatCollapsed && (
              <div
                className="relative flex-shrink-0"
                style={{ width: `${contextChatWidth}%` }}
              >
                <FakeContextChatPanel
                  sessionId={sessionId}
                  sessionContext={mockSessionContext}
                  existingContextThreadId={contextChatThreadId}
                  onThreadCreated={handleContextThreadCreated}
                  onCollapseChange={setIsContextChatCollapsed}
                />
              </div>
            )}

            {/* Chat Bubble when Collapsed */}
            {isContextChatCollapsed && (
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

          {/* Exit Warning Modal */}
          {showExitModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowExitModal(false)}
            >
              <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  ⚠️ Leave Active Session?
                </h2>
                <p className="text-gray-600 mb-6">
                  Your lesson is still active. If you leave now, your progress will be saved but
                  you'll need to resume later.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowExitModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Stay in Lesson
                  </button>
                  <button
                    onClick={handleConfirmLeave}
                    className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Leave Anyway
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CurrentCardProvider>
    </NavigationPreventionProvider>
  );
}
