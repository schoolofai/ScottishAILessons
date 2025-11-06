"use client";

/**
 * Fake Providers for Manual Browser Testing
 *
 * This file provides React context providers that return fake data
 * instead of calling real APIs. Use these to test components in
 * isolation without a backend.
 *
 * Usage:
 *   <FakeAppwriteProvider>
 *     <SessionChatAssistant sessionId="test-123" />
 *   </FakeAppwriteProvider>
 */

import React, { createContext, useContext, ReactNode } from 'react';
import {
  mockSession,
  mockSessionWithContextChat,
  mockSessionStateData,
  mockCourseCurriculumMetadata,
  mockEnrichedOutcomes,
} from '@/__mocks__/session-data';
import {
  createMockSessionDriver,
  createMockCourseDriver,
  createMockCourseOutcomesDriver,
} from '@/__mocks__/appwrite-drivers';

// ============================================
// Fake Appwrite Context
// ============================================

interface FakeAppwriteContextType {
  createDriver: (DriverClass: any) => any;
}

const FakeAppwriteContext = createContext<FakeAppwriteContextType | null>(null);

export function FakeAppwriteProvider({ children }: { children: ReactNode }) {
  // Create mock drivers with pre-configured responses
  const sessionDriver = createMockSessionDriver({
    getSessionWithContextChat: jest.fn().mockResolvedValue(mockSessionWithContextChat),
    getSessionState: jest.fn().mockResolvedValue(mockSessionStateData),
    updateSessionThreadId: jest.fn().mockImplementation(async (sessionId, threadId) => {
      console.log('📝 [FAKE] Updated session thread ID:', { sessionId, threadId });
    }),
    updateContextChatThreadId: jest.fn().mockImplementation(async (sessionId, contextThreadId) => {
      console.log('📝 [FAKE] Updated context chat thread ID:', { sessionId, contextThreadId });
    }),
  });

  const courseDriver = createMockCourseDriver({
    getCourseCurriculumMetadata: jest.fn().mockResolvedValue(mockCourseCurriculumMetadata),
  });

  const outcomeDriver = createMockCourseOutcomesDriver({
    getOutcomesByIds: jest.fn().mockResolvedValue(mockEnrichedOutcomes),
  });

  const createDriver = (DriverClass: any) => {
    const className = DriverClass.name || '';

    console.log('🏭 [FAKE] Creating driver:', className);

    if (className.includes('Session')) {
      return sessionDriver;
    }
    if (className.includes('Course') && !className.includes('Outcomes')) {
      return courseDriver;
    }
    if (className.includes('Outcome')) {
      return outcomeDriver;
    }

    console.warn('⚠️ Unknown driver requested:', className);
    return {};
  };

  return (
    <FakeAppwriteContext.Provider value={{ createDriver }}>
      {children}
    </FakeAppwriteContext.Provider>
  );
}

export function useFakeAppwrite() {
  const context = useContext(FakeAppwriteContext);
  if (!context) {
    throw new Error('useFakeAppwrite must be used within FakeAppwriteProvider');
  }
  return context;
}

// ============================================
// Fake Outcome Enrichment
// ============================================

/**
 * Fake implementation of enrichOutcomeRefs that returns mock data
 */
export async function fakeEnrichOutcomeRefs(
  outcomeRefs: Array<{ unit: string; outcome: string; label: string }>,
  courseId: string,
  driver: any
): Promise<typeof mockEnrichedOutcomes> {
  console.log('🎨 [FAKE] Enriching outcomes:', { outcomeRefs, courseId });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  return mockEnrichedOutcomes;
}

// ============================================
// Fake Navigation Prevention
// ============================================

/**
 * Fake implementation of usePreventNavigation hook
 */
export function useFakePreventNavigation(
  shouldPrevent: boolean,
  onNavigationAttempt: () => void,
  allowNavigation: boolean
) {
  console.log('🚧 [FAKE] Navigation prevention:', { shouldPrevent, allowNavigation });

  // In fake mode, we don't actually prevent navigation
  // This is just for testing UI behavior
}
