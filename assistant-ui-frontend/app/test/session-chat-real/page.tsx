"use client";

/**
 * Real Component Test Page
 *
 * Tests the ACTUAL SessionChatAssistant component with mocked data providers.
 * This uses module mocking to intercept dependencies while testing the real component logic.
 *
 * Navigate to: http://localhost:3000/test/session-chat-real
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { RetryPrepopulationProvider } from '@/contexts/RetryPrepopulationContext';

// Import mock data
import {
  mockSession,
  mockSessionWithContextChat,
  mockSessionStateData,
  mockCourseCurriculumMetadata,
  mockEnrichedOutcomes,
} from '@/__mocks__/session-data';

// Setup global mocks BEFORE importing the component
if (typeof window !== 'undefined') {
  // Mock the Appwrite hook
  const originalUseAppwrite = require('@/lib/appwrite').useAppwrite;

  // Create mock drivers
  const mockSessionDriver = {
    getSessionWithContextChat: async () => {
      console.log('🎭 [MOCK] getSessionWithContextChat called');
      return mockSessionWithContextChat;
    },
    getSessionState: async () => {
      console.log('🎭 [MOCK] getSessionState called');
      return mockSessionStateData;
    },
    updateSessionThreadId: async (sessionId: string, threadId: string) => {
      console.log('🎭 [MOCK] updateSessionThreadId:', { sessionId, threadId });
    },
    updateContextChatThreadId: async (sessionId: string, contextThreadId: string) => {
      console.log('🎭 [MOCK] updateContextChatThreadId:', { sessionId, contextThreadId });
    },
  };

  const mockCourseDriver = {
    getCourseCurriculumMetadata: async () => {
      console.log('🎭 [MOCK] getCourseCurriculumMetadata called');
      return mockCourseCurriculumMetadata;
    },
  };

  const mockOutcomeDriver = {
    getOutcomesByIds: async () => {
      console.log('🎭 [MOCK] getOutcomesByIds called');
      return mockEnrichedOutcomes;
    },
  };

  // Override the useAppwrite hook
  require('@/lib/appwrite').useAppwrite = () => ({
    createDriver: (DriverClass: any) => {
      const className = DriverClass.name || '';
      console.log('🏭 [MOCK] Creating driver:', className);

      if (className.includes('Session')) return mockSessionDriver;
      if (className.includes('Course') && !className.includes('Outcomes')) return mockCourseDriver;
      if (className.includes('Outcome')) return mockOutcomeDriver;

      return {};
    },
  });

  // Mock enrichOutcomeRefs
  const enrichModule = require('@/lib/sessions/outcome-enrichment');
  enrichModule.enrichOutcomeRefs = async (outcomeRefs: any, courseId: string, driver: any) => {
    console.log('🎨 [MOCK] enrichOutcomeRefs called');
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
    return mockEnrichedOutcomes;
  };

  // Mock useRouter
  const routerModule = require('next/navigation');
  const originalUseRouter = routerModule.useRouter;
  routerModule.useRouter = () => ({
    push: (path: string) => console.log('🔗 [MOCK] Router.push:', path),
    back: () => console.log('🔗 [MOCK] Router.back'),
    forward: () => console.log('🔗 [MOCK] Router.forward'),
    replace: (path: string) => console.log('🔗 [MOCK] Router.replace:', path),
    refresh: () => console.log('🔗 [MOCK] Router.refresh'),
    prefetch: () => Promise.resolve(),
  });

  console.log('✅ [MOCK SETUP] All mocks initialized');
}

// Now import the real component (mocks are already in place)
const SessionChatAssistant = dynamic(
  () => import('@/components/SessionChatAssistant').then(mod => mod.SessionChatAssistant),
  {
    loading: () => <div className="flex items-center justify-center h-screen">
      <div className="text-xl">Loading real component...</div>
    </div>,
    ssr: false, // Disable SSR to ensure mocks work
  }
);

export default function RealComponentTestPage() {
  const [sessionId] = useState('test-session-123');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Ensure mocks are set up before rendering
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Setting up mocks...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Test Banner */}
      <div className="bg-green-50 border-b-2 border-green-300 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-green-800 font-semibold text-lg">
            ✅ REAL COMPONENT TEST - Using Actual SessionChatAssistant with Mocked Data
          </span>
          <div className="text-sm text-gray-600">
            Session ID: <code className="bg-gray-200 px-2 py-1 rounded">{sessionId}</code>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          All Appwrite calls, navigation, and enrichment are mocked. Component logic is 100% real.
        </div>
      </div>

      {/* Real Component */}
      <div className="flex-1 min-h-0">
        <RetryPrepopulationProvider>
          <SessionChatAssistant sessionId={sessionId} />
        </RetryPrepopulationProvider>
      </div>
    </div>
  );
}
