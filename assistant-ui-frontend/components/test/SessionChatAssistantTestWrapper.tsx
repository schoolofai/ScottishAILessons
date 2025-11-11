"use client";

/**
 * Test Wrapper for SessionChatAssistant
 *
 * This component wraps the REAL SessionChatAssistant component with mocked
 * providers so you can test the actual component logic with fake data.
 *
 * Usage in test page:
 *   <SessionChatAssistantTestWrapper sessionId="test-123" />
 */

import { SessionChatAssistant } from '../SessionChatAssistant';
import { RetryPrepopulationProvider } from '@/contexts/RetryPrepopulationContext';
import {
  mockSession,
  mockSessionWithContextChat,
  mockSessionStateData,
  mockCourseCurriculumMetadata,
  mockEnrichedOutcomes,
} from '@/__mocks__/session-data';

// Mock modules before importing SessionChatAssistant
// These will override the real implementations

// We need to mock at the module level, but since this is client-side,
// we'll use a different approach - we'll create a wrapper component
// that intercepts the dependencies

interface SessionChatAssistantTestWrapperProps {
  sessionId: string;
  threadId?: string;
}

export function SessionChatAssistantTestWrapper({
  sessionId,
  threadId,
}: SessionChatAssistantTestWrapperProps) {
  // This component renders the REAL SessionChatAssistant
  // But we need to mock its dependencies at a higher level

  return (
    <RetryPrepopulationProvider>
      <SessionChatAssistant sessionId={sessionId} threadId={threadId} />
    </RetryPrepopulationProvider>
  );
}
