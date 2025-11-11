/**
 * Mock Setup for Browser Testing
 *
 * This file sets up global mocks that can be used in test pages.
 * Import this BEFORE importing components you want to test.
 *
 * Usage:
 *   import '@/lib/test-utils/setup-mocks';
 *   import { SessionChatAssistant } from '@/components/SessionChatAssistant';
 */

import {
  mockSessionWithContextChat,
  mockSessionStateData,
  mockCourseCurriculumMetadata,
  mockEnrichedOutcomes,
} from '@/__mocks__/session-data';

/**
 * Setup function that initializes all mocks
 * Call this in your test page before rendering components
 */
export function setupTestMocks() {
  if (typeof window === 'undefined') return; // Only run in browser

  console.log('🎭 [SETUP] Initializing test mocks...');

  // Store original modules
  const originalModules = new Map();

  // Mock storage
  (window as any).__TEST_MOCKS__ = {
    appwrite: {
      sessionDriver: {
        getSessionWithContextChat: jest.fn().mockResolvedValue(mockSessionWithContextChat),
        getSessionState: jest.fn().mockResolvedValue(mockSessionStateData),
        updateSessionThreadId: jest.fn().mockImplementation(async (sessionId, threadId) => {
          console.log('📝 [MOCK] Updated thread ID:', { sessionId, threadId });
        }),
        updateContextChatThreadId: jest.fn().mockImplementation(async (sessionId, contextThreadId) => {
          console.log('📝 [MOCK] Updated context thread ID:', { sessionId, contextThreadId });
        }),
      },
      courseDriver: {
        getCourseCurriculumMetadata: jest.fn().mockResolvedValue(mockCourseCurriculumMetadata),
      },
      outcomeDriver: {
        getOutcomesByIds: jest.fn().mockResolvedValue(mockEnrichedOutcomes),
      },
    },
    router: {
      push: jest.fn((path) => console.log('🔗 [MOCK] Push:', path)),
      back: jest.fn(() => console.log('🔗 [MOCK] Back')),
      forward: jest.fn(() => console.log('🔗 [MOCK] Forward')),
      replace: jest.fn((path) => console.log('🔗 [MOCK] Replace:', path)),
      refresh: jest.fn(() => console.log('🔗 [MOCK] Refresh')),
      prefetch: jest.fn(() => Promise.resolve()),
    },
    enrichOutcomeRefs: jest.fn().mockImplementation(async (refs, courseId, driver) => {
      console.log('🎨 [MOCK] Enriching outcomes:', { refs, courseId });
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockEnrichedOutcomes;
    }),
  };

  console.log('✅ [SETUP] Test mocks initialized');
}

/**
 * Get mock instance for testing
 */
export function getMockInstance(path: string): any {
  return (window as any).__TEST_MOCKS__?.[path];
}

/**
 * Reset all mocks
 */
export function resetAllMocks() {
  if (typeof window === 'undefined') return;

  const mocks = (window as any).__TEST_MOCKS__;
  if (!mocks) return;

  // Reset jest mock functions
  Object.values(mocks.appwrite).forEach((driver: any) => {
    Object.values(driver).forEach((fn: any) => {
      if (fn.mockClear) fn.mockClear();
    });
  });

  console.log('🔄 [SETUP] All mocks reset');
}
