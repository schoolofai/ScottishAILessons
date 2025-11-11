/**
 * Test Fixtures for Session Replay Tests
 *
 * Provides reusable test data for:
 * - Conversation histories (small, medium, large)
 * - Compressed data
 * - Session metadata
 * - Lesson card interactions
 */

import pako from 'pako';

/**
 * Conversation history structure
 */
export interface ConversationHistory {
  thread_id: string;
  created_at: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    tool_calls?: Array<{
      id: string;
      name: string;
      args: Record<string, any>;
    }>;
  }>;
}

/**
 * Session metadata structure
 */
export interface TestSession {
  studentId: string;
  lessonTemplateId: string;
  status: 'active' | 'completed' | 'failed';
  startedAt: string;
  endedAt?: string;
  score?: number;
  conversationHistory?: string; // Compressed base64
}

/**
 * Small conversation history (5 messages)
 * Use for: Basic rendering tests
 */
export const smallConversationHistory: ConversationHistory = {
  thread_id: 'thread-test-small-001',
  created_at: '2025-10-29T10:00:00Z',
  messages: [
    {
      id: 'msg-001',
      role: 'user',
      content: 'Hello, I would like to start this lesson.',
      timestamp: '2025-10-29T10:00:00Z'
    },
    {
      id: 'msg-002',
      role: 'assistant',
      content: 'Welcome! Let\'s begin with understanding fractions. Can you tell me what 1/2 means?',
      timestamp: '2025-10-29T10:00:05Z'
    },
    {
      id: 'msg-003',
      role: 'user',
      content: 'It means one part out of two equal parts.',
      timestamp: '2025-10-29T10:00:15Z'
    },
    {
      id: 'msg-004',
      role: 'assistant',
      content: 'Excellent! That\'s exactly right. Now let\'s try a practice problem.',
      timestamp: '2025-10-29T10:00:20Z'
    },
    {
      id: 'msg-005',
      role: 'user',
      content: 'I\'m ready!',
      timestamp: '2025-10-29T10:00:25Z'
    }
  ]
};

/**
 * Medium conversation history (20 messages with lesson card)
 * Use for: Testing lesson card rendering
 */
export const mediumConversationHistoryWithCard: ConversationHistory = {
  thread_id: 'thread-test-medium-001',
  created_at: '2025-10-29T11:00:00Z',
  messages: [
    {
      id: 'msg-101',
      role: 'user',
      content: 'Let\'s start the fraction lesson.',
      timestamp: '2025-10-29T11:00:00Z'
    },
    {
      id: 'msg-102',
      role: 'assistant',
      content: 'Great! Let me present the first concept card.',
      timestamp: '2025-10-29T11:00:05Z',
      tool_calls: [
        {
          id: 'tool-card-001',
          name: 'lesson_card_presentation',
          args: {
            card_id: 'card-fractions-001',
            explainer: 'A fraction represents a part of a whole. The top number (numerator) tells us how many parts we have, and the bottom number (denominator) tells us how many equal parts the whole is divided into.',
            question: 'What fraction is represented by 3 parts out of 4 equal parts?',
            card_type: 'mc',
            student_must_respond: true,
            interaction_id: 'int-001',
            timestamp: '2025-10-29T11:00:05Z'
          }
        }
      ]
    },
    {
      id: 'msg-103',
      role: 'user',
      content: '3/4',
      timestamp: '2025-10-29T11:01:00Z'
    },
    {
      id: 'msg-104',
      role: 'assistant',
      content: 'Perfect! You got it right. Let\'s continue to the next card.',
      timestamp: '2025-10-29T11:01:05Z',
      tool_calls: [
        {
          id: 'tool-feedback-001',
          name: 'feedback_presentation',
          args: {
            is_correct: true,
            feedback: 'Excellent work! 3/4 is correct.',
            confidence: 0.95,
            reasoning: 'The student correctly identified the fraction as 3/4.',
            attempts: 1,
            max_attempts: 3,
            show_explanation: false,
            card_context: {
              card_id: 'card-fractions-001',
              question: 'What fraction is represented by 3 parts out of 4 equal parts?'
            },
            interaction_id: 'int-002',
            timestamp: '2025-10-29T11:01:05Z'
          }
        }
      ]
    },
    // ... Add more messages to reach 20 total
    ...generateFillerMessages(15, 105)
  ]
};

/**
 * Large conversation history (100 messages)
 * Use for: Performance testing
 */
export function createLargeConversationHistory(messageCount: number = 100): ConversationHistory {
  const messages = [];
  const startTime = new Date('2025-10-29T12:00:00Z').getTime();

  for (let i = 0; i < messageCount; i++) {
    const timestamp = new Date(startTime + i * 30000).toISOString(); // 30 seconds apart

    messages.push({
      id: `msg-${String(i).padStart(4, '0')}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}: ${i % 2 === 0 ? 'Student question or answer' : 'Teacher response or instruction'}`,
      timestamp
    });
  }

  return {
    thread_id: 'thread-test-large-001',
    created_at: new Date(startTime).toISOString(),
    messages
  };
}

/**
 * Conversation history with multiple lesson cards
 * Use for: Testing card sequence rendering
 */
export function createHistoryWithLessonCards(cardCount: number = 3): ConversationHistory {
  const messages = [];
  const startTime = new Date('2025-10-29T13:00:00Z').getTime();

  for (let i = 0; i < cardCount; i++) {
    const cardTime = startTime + i * 120000; // 2 minutes apart

    // Card presentation
    messages.push({
      id: `msg-card-${i}-present`,
      role: 'assistant' as const,
      content: `Presenting lesson card ${i + 1}`,
      timestamp: new Date(cardTime).toISOString(),
      tool_calls: [
        {
          id: `tool-card-${i}`,
          name: 'lesson_card_presentation',
          args: {
            card_id: `card-${i}`,
            explainer: `This is the explainer for card ${i + 1}`,
            question: `Question ${i + 1}?`,
            card_type: 'mc',
            student_must_respond: true,
            interaction_id: `int-card-${i}`,
            timestamp: new Date(cardTime).toISOString()
          }
        }
      ]
    });

    // Student response
    messages.push({
      id: `msg-card-${i}-response`,
      role: 'user' as const,
      content: `Answer to card ${i + 1}`,
      timestamp: new Date(cardTime + 30000).toISOString()
    });

    // Feedback
    messages.push({
      id: `msg-card-${i}-feedback`,
      role: 'assistant' as const,
      content: `Feedback for card ${i + 1}`,
      timestamp: new Date(cardTime + 35000).toISOString(),
      tool_calls: [
        {
          id: `tool-feedback-${i}`,
          name: 'feedback_presentation',
          args: {
            is_correct: true,
            feedback: `Great job on card ${i + 1}!`,
            confidence: 0.9,
            reasoning: 'Correct answer provided',
            attempts: 1,
            max_attempts: 3,
            show_explanation: false,
            card_context: {
              card_id: `card-${i}`,
              question: `Question ${i + 1}?`
            },
            interaction_id: `int-feedback-${i}`,
            timestamp: new Date(cardTime + 35000).toISOString()
          }
        }
      ]
    });
  }

  return {
    thread_id: 'thread-test-cards-001',
    created_at: new Date(startTime).toISOString(),
    messages
  };
}

/**
 * Helper: Generate filler messages
 */
function generateFillerMessages(count: number, startIndex: number): Array<{
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}> {
  const messages = [];
  const startTime = new Date('2025-10-29T11:02:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime + i * 20000).toISOString();

    messages.push({
      id: `msg-${startIndex + i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Filler message ${i + 1}`,
      timestamp
    });
  }

  return messages;
}

/**
 * Compress conversation history to base64 string
 */
export async function compressConversationHistory(history: ConversationHistory): Promise<string> {
  const jsonString = JSON.stringify(history);
  const compressed = pako.gzip(jsonString);
  const base64 = Buffer.from(compressed).toString('base64');
  return base64;
}

/**
 * Decompress base64 conversation history
 */
export async function decompressConversationHistory(compressed: string): Promise<ConversationHistory> {
  const buffer = Buffer.from(compressed, 'base64');
  const decompressed = pako.ungzip(buffer, { to: 'string' });
  return JSON.parse(decompressed);
}

/**
 * Valid compressed test data (small history compressed)
 */
export const validCompressedData = compressConversationHistory(smallConversationHistory);

/**
 * Corrupted compressed data (invalid base64)
 */
export const corruptedCompressedData = "INVALID_BASE64_DATA!!!";

/**
 * Near-maximum compressed data (45KB, approaching 50KB limit)
 */
export async function createNearMaxSizeCompressedData(): Promise<string> {
  // Create a large history that compresses to ~45KB
  const largeHistory = createLargeConversationHistory(200);

  // Add padding to reach target size
  while (true) {
    const compressed = await compressConversationHistory(largeHistory);
    const sizeKB = compressed.length / 1024;

    if (sizeKB >= 45) {
      return compressed;
    }

    // Add more messages with longer content
    largeHistory.messages.push({
      id: `padding-${largeHistory.messages.length}`,
      role: 'assistant',
      content: 'Padding content to increase size. '.repeat(100),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Test session metadata fixtures
 */
export const testSessions = {
  /**
   * Completed session with high score
   */
  completed: {
    studentId: 'student-test-001',
    lessonTemplateId: 'lesson-fractions-001',
    status: 'completed' as const,
    startedAt: '2025-10-29T10:00:00Z',
    endedAt: '2025-10-29T10:30:00Z',
    score: 0.85
  },

  /**
   * Completed session with low score
   */
  completedLowScore: {
    studentId: 'student-test-001',
    lessonTemplateId: 'lesson-fractions-002',
    status: 'completed' as const,
    startedAt: '2025-10-29T11:00:00Z',
    endedAt: '2025-10-29T11:45:00Z',
    score: 0.45
  },

  /**
   * Active session (shouldn't appear in replay)
   */
  active: {
    studentId: 'student-test-001',
    lessonTemplateId: 'lesson-fractions-003',
    status: 'active' as const,
    startedAt: '2025-10-29T14:00:00Z'
  },

};

/**
 * Helper: Create test session with conversation history
 */
export async function createTestSessionWithHistory(
  sessionData: Partial<TestSession> = {},
  history: ConversationHistory = smallConversationHistory
): Promise<TestSession> {
  const compressed = await compressConversationHistory(history);

  return {
    studentId: sessionData.studentId || 'student-test-001',
    lessonTemplateId: sessionData.lessonTemplateId || 'lesson-test-001',
    status: sessionData.status || 'completed',
    startedAt: sessionData.startedAt || new Date().toISOString(),
    endedAt: sessionData.endedAt || new Date(Date.now() + 1800000).toISOString(),
    score: sessionData.score || 0.75,
    conversationHistory: compressed
  };
}

/**
 * Helper: Create multiple test sessions for bulk testing
 */
export async function createMultipleTestSessions(count: number): Promise<TestSession[]> {
  const sessions: TestSession[] = [];

  for (let i = 0; i < count; i++) {
    const history = createLargeConversationHistory(10 + i * 5); // Varying sizes
    const session = await createTestSessionWithHistory(
      {
        studentId: 'student-test-001',
        lessonTemplateId: `lesson-bulk-${String(i).padStart(3, '0')}`,
        status: 'completed',
        score: 0.5 + (i * 0.05) % 0.5 // Varying scores 0.5-1.0
      },
      history
    );

    sessions.push(session);
  }

  return sessions;
}

/**
 * Export all fixtures as a single object for easy importing
 */
export const sessionReplayFixtures = {
  histories: {
    small: smallConversationHistory,
    mediumWithCard: mediumConversationHistoryWithCard,
    createLarge: createLargeConversationHistory,
    createWithCards: createHistoryWithLessonCards
  },
  compressed: {
    valid: validCompressedData,
    corrupted: corruptedCompressedData,
    createNearMax: createNearMaxSizeCompressedData
  },
  sessions: testSessions,
  helpers: {
    compress: compressConversationHistory,
    decompress: decompressConversationHistory,
    createWithHistory: createTestSessionWithHistory,
    createMultiple: createMultipleTestSessions
  }
};
