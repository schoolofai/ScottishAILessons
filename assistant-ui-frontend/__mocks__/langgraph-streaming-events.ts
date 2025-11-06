/**
 * Mock LangGraph Streaming Events
 *
 * This file provides realistic LangGraph streaming events that simulate
 * the backend's tool call + interrupt pattern for lesson delivery.
 *
 * Event Flow:
 * 1. Backend sends AIMessage with tool_call
 * 2. Backend triggers interrupt()
 * 3. Frontend renders tool UI (e.g., LessonCardPresentationTool)
 * 4. Student interacts, frontend sends resume command
 * 5. Backend evaluates, sends feedback tool_call
 * 6. Repeat for each lesson card
 */

import { mockLessonCard1, mockLessonCard2 } from './session-data';

// ============================================
// Event Types (from LangGraph SDK)
// ============================================

interface StreamEvent {
  event: string;
  data: any;
}

// ============================================
// Lesson Card Presentation Event
// ============================================

export function createLessonCardEvent(cardIndex: number): StreamEvent[] {
  const card = cardIndex === 0 ? mockLessonCard1 : mockLessonCard2;

  return [
    // 1. Text message introducing the card
    {
      event: "messages/partial",
      data: [{
        type: "ai",  // LangGraph SDK expects 'type' not 'role'
        content: `**Card ${cardIndex + 1}: ${card.title}**\n\n${card.explainer}`,
        id: `msg-card-${cardIndex}-intro`,
      }]
    },

    // 2. Tool call to render the interactive card UI
    {
      event: "messages/partial",
      data: [{
        type: "ai",  // LangGraph SDK expects 'type' not 'role'
        content: "",
        tool_calls: [{
          id: `lesson_card_${cardIndex}`,
          name: "lesson_card_presentation",
          args: {
            card_content: card.explainer,
            card_data: card,
            card_index: cardIndex,
            total_cards: 2,
            cfu_type: card.cfu.type,
            lesson_context: {
              title: "Understanding Equivalent Fractions",
              current_stage: "design",
              session_id: "test-session-123"
            },
            interaction_id: `interaction-${cardIndex}-${Date.now()}`,
            stage: "design"
          }
        }],
        id: `msg-card-${cardIndex}-toolcall`,
      }]
    }
  ];
}

// ============================================
// Feedback Presentation Event
// ============================================

export function createFeedbackEvent(
  cardIndex: number,
  isCorrect: boolean,
  studentResponse: string
): StreamEvent[] {
  const feedback = isCorrect
    ? "🎉 Excellent work! You've got it right!"
    : "Not quite. Let me help you understand this better.";

  const explanation = isCorrect
    ? "Your answer shows you understand equivalent fractions. Both 2/10 and 1/5 equal 0.2!"
    : "Remember: to find equivalent fractions, divide both numerator and denominator by the same number.";

  return [
    // 1. Text feedback message
    {
      event: "messages/partial",
      data: [{
        type: "ai",
        content: feedback,
        id: `msg-feedback-${cardIndex}-text`,
      }]
    },

    // 2. Tool call to render detailed feedback UI
    {
      event: "messages/partial",
      data: [{
        type: "ai",
        content: "",
        tool_calls: [{
          id: `feedback_${cardIndex}`,
          name: "feedback_presentation",
          args: {
            is_correct: isCorrect,
            feedback_message: feedback,
            explanation: explanation,
            student_response: studentResponse,
            card_index: cardIndex,
            hints_used: 0,
            attempt_number: 1,
            interaction_id: `interaction-${cardIndex}-${Date.now()}`
          }
        }],
        id: `msg-feedback-${cardIndex}-toolcall`,
      }]
    }
  ];
}

// ============================================
// Progress Acknowledgment Event
// ============================================

export function createProgressEvent(cardIndex: number): StreamEvent[] {
  return [
    {
      event: "messages/partial",
      data: [{
        type: "ai",
        content: "",
        tool_calls: [{
          id: `progress_${cardIndex}`,
          name: "progress_acknowledgment",
          args: {
            card_index: cardIndex,
            total_cards: 2,
            cards_completed: cardIndex + 1,
            next_card_title: cardIndex === 0 ? "Converting Fractions to Decimals" : null,
            completion_percentage: ((cardIndex + 1) / 2) * 100,
            interaction_id: `progress-${cardIndex}-${Date.now()}`
          }
        }],
        id: `msg-progress-${cardIndex}`,
      }]
    }
  ];
}

// ============================================
// Lesson Completion Event
// ============================================

export function createCompletionEvent(): StreamEvent[] {
  return [
    // 1. Congratulations message
    {
      event: "messages/partial",
      data: [{
        type: "ai",
        content: "🎉 **Congratulations!** You've completed the lesson on Understanding Equivalent Fractions!",
        id: "msg-completion-text",
      }]
    },

    // 2. Tool call for completion summary UI
    {
      event: "messages/partial",
      data: [{
        type: "ai",
        content: "",
        tool_calls: [{
          id: "completion_summary",
          name: "lesson_completion_summary",
          args: {
            lesson_title: "Understanding Equivalent Fractions",
            total_cards: 2,
            cards_completed: 2,
            overall_score: 0.9,
            time_spent_minutes: 25,
            mastery_updates: [
              {
                outcome_ref: "O1",
                previous_level: 2,
                new_level: 3,
                confidence: 0.85
              }
            ],
            next_steps: [
              "Practice more fraction simplification",
              "Try converting fractions to percentages"
            ],
            session_id: "test-session-123",
            interaction_id: `completion-${Date.now()}`
          }
        }],
        id: "msg-completion-toolcall",
      }]
    }
  ];
}

// ============================================
// Complete Lesson Flow Generator
// ============================================

/**
 * Generates a complete sequence of events for a teaching session
 * This simulates the full lesson flow with interrupts
 */
export async function* generateLessonFlow(options?: {
  onInterrupt?: (cardIndex: number) => void;
  onStudentResponse?: (response: string) => Promise<boolean>; // Returns isCorrect
}): AsyncGenerator<StreamEvent> {
  console.log('🎬 [MOCK FLOW] Starting lesson flow...');

  // Introduction
  yield {
    event: "messages/partial",
    data: [{
      type: "ai",
      content: "👋 Welcome! Today we're learning about **Understanding Equivalent Fractions**. Ready to get started?",
      id: "msg-intro",
    }]
  };

  await delay(500);

  // Card 1
  console.log('📝 [MOCK FLOW] Presenting Card 1...');
  for (const event of createLessonCardEvent(0)) {
    yield event;
    await delay(300);
  }

  // Simulate interrupt - notify callback
  options?.onInterrupt?.(0);
  console.log('⏸️ [MOCK FLOW] Interrupt triggered for Card 1 - awaiting student response');

  // In a real implementation, we'd wait for sendCommand here
  // For this mock, we'll use a timeout
  await delay(2000); // Simulate student thinking time

  // Simulate student answer
  const studentAnswer1 = "1/5"; // Correct answer
  const isCorrect1 = await options?.onStudentResponse?.(studentAnswer1) ?? true;

  // Feedback for Card 1
  console.log('💬 [MOCK FLOW] Sending feedback for Card 1...');
  for (const event of createFeedbackEvent(0, isCorrect1, studentAnswer1)) {
    yield event;
    await delay(300);
  }

  // Progress acknowledgment
  console.log('📊 [MOCK FLOW] Showing progress...');
  for (const event of createProgressEvent(0)) {
    yield event;
    await delay(200);
  }

  await delay(1000);

  // Card 2
  console.log('📝 [MOCK FLOW] Presenting Card 2...');
  for (const event of createLessonCardEvent(1)) {
    yield event;
    await delay(300);
  }

  options?.onInterrupt?.(1);
  console.log('⏸️ [MOCK FLOW] Interrupt triggered for Card 2 - awaiting student response');

  await delay(2000);

  const studentAnswer2 = "0.2"; // Correct answer
  const isCorrect2 = await options?.onStudentResponse?.(studentAnswer2) ?? true;

  // Feedback for Card 2
  console.log('💬 [MOCK FLOW] Sending feedback for Card 2...');
  for (const event of createFeedbackEvent(1, isCorrect2, studentAnswer2)) {
    yield event;
    await delay(300);
  }

  // Progress acknowledgment
  console.log('📊 [MOCK FLOW] Showing final progress...');
  for (const event of createProgressEvent(1)) {
    yield event;
    await delay(200);
  }

  await delay(500);

  // Lesson completion
  console.log('🏁 [MOCK FLOW] Lesson complete!');
  for (const event of createCompletionEvent()) {
    yield event;
    await delay(300);
  }

  console.log('✅ [MOCK FLOW] Flow complete');
}

// ============================================
// Utilities
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simple interactive flow for manual testing
 */
export async function* generateSimpleLessonFlow(): AsyncGenerator<StreamEvent> {
  // Card 1 only
  yield* createLessonCardEvent(0);

  // Simulate interrupt wait
  await delay(5000);

  // Feedback (assume correct)
  yield* createFeedbackEvent(0, true, "1/5");

  // Progress
  yield* createProgressEvent(0);

  await delay(2000);

  // Card 2
  yield* createLessonCardEvent(1);

  await delay(5000);

  // Feedback
  yield* createFeedbackEvent(1, true, "0.2");

  // Completion
  yield* createCompletionEvent();
}
