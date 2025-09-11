/**
 * Error handling and retry mechanism tests
 * Based on Test 2 documented in playwright-e2e-test-log.md
 * Tests system behavior when user provides incorrect answers
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';
import { 
  startLesson,
  navigateToSession,
  submitAnswer, 
  verifyErrorHandling,
  verifySuccessfulAnswer,
  verifyLessonCompletion,
  waitForAIResponse
} from './helpers/lesson';
import { TEST_ANSWERS, TEST_SESSIONS, TIMEOUTS, AI_PATTERNS } from './helpers/constants';

test.describe('Lesson Error Handling', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await authenticateUser(page);
  });

  test('should handle wrong format answers with helpful feedback', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Submit wrong format answer for fraction question (monetary value instead of fraction)
    await submitAnswer(page, '£16.20'); // Wrong format for "write 0.2 as fraction"
    
    // Verify error handling response
    const errorResponse = await verifyErrorHandling(page);
    console.log('Wrong format error response:', errorResponse);
    
    // Should provide helpful guidance
    expect(errorResponse).toMatch(/mix-up|different|hint|fraction|two-tenths/i);
    expect(errorResponse).toMatch(/Thank you for your attempt/i);
    
    // Should allow retry - message input should still be enabled
    await expect(page.locator('[placeholder="Send a message..."]')).toBeEnabled();
    
    // Provide correct answer to continue
    await submitAnswer(page, TEST_ANSWERS.correct[0]); // '1/5'
    await verifySuccessfulAnswer(page);
  });

  test('should handle off-topic responses appropriately', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Answer first question correctly to progress
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    await verifySuccessfulAnswer(page);
    await page.waitForTimeout(TIMEOUTS.mediumWait);
    
    // Submit off-topic response for comparison question
    await submitAnswer(page, 'Hello! Can you tell me about fractions?');
    
    // Verify error handling for off-topic response
    const errorResponse = await verifyErrorHandling(page);
    console.log('Off-topic error response:', errorResponse);
    
    // Should redirect back to the question
    expect(errorResponse).toMatch(/off track|compare.*prices|100.*grams|hint/i);
    expect(errorResponse).toMatch(/Thank you for your response/i);
    
    // Should still allow retry
    await expect(page.locator('[placeholder="Send a message..."]')).toBeEnabled();
  });

  test('should provide step-by-step help when requested', async ({ page }) => {
    // Use existing session with known error handling examples
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Submit help request
    await submitAnswer(page, 'I need help with the current question');
    
    // Wait for detailed help response
    const helpResponse = await waitForAIResponse(page, TIMEOUTS.aiResponse + 5000);
    console.log('Help request response:', helpResponse);
    
    // Should provide detailed mathematical guidance
    expect(helpResponse).toMatch(/step|calculate|help|guide|example/i);
    
    // Response should be educational and detailed
    expect(helpResponse.length).toBeGreaterThan(100); // Detailed responses are longer
  });

  test('should handle multiple wrong attempts with persistence', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Submit multiple wrong answers for the same question
    const wrongAnswers = ['wrong1', '£100', 'I dont know'];
    
    for (let i = 0; i < wrongAnswers.length; i++) {
      await submitAnswer(page, wrongAnswers[i]);
      
      // Verify error handling for each attempt
      const errorResponse = await verifyErrorHandling(page);
      console.log(`Wrong attempt ${i + 1} response:`, errorResponse);
      
      // Should maintain helpful, encouraging tone
      expect(errorResponse).toMatch(/Thank you|attempt|hint|try/i);
      
      // Should still allow another attempt
      await expect(page.locator('[placeholder="Send a message..."]')).toBeEnabled();
      
      // Wait before next attempt
      await page.waitForTimeout(TIMEOUTS.shortWait);
    }
    
    // Finally provide correct answer
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    await verifySuccessfulAnswer(page);
  });

  test('should eventually complete lesson despite errors', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Answer each question incorrectly first, then correctly
    for (let i = 0; i < TEST_ANSWERS.correct.length; i++) {
      // Submit wrong answer first
      await submitAnswer(page, TEST_ANSWERS.wrong[i] || 'wrong answer');
      await verifyErrorHandling(page);
      
      // Wait a moment
      await page.waitForTimeout(TIMEOUTS.shortWait);
      
      // Then submit correct answer
      await submitAnswer(page, TEST_ANSWERS.correct[i]);
      await verifySuccessfulAnswer(page);
      
      // Wait for next card
      if (i < TEST_ANSWERS.correct.length - 1) {
        await page.waitForTimeout(TIMEOUTS.mediumWait);
      }
    }
    
    // Should still complete successfully
    await verifyLessonCompletion(page);
  });

  test('should provide contextual hints based on question type', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Test fraction question error handling
    await submitAnswer(page, 'not a fraction');
    const fractionError = await verifyErrorHandling(page);
    expect(fractionError).toMatch(/fraction|two-tenths|simplest form/i);
    
    // Correct the answer to proceed
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    await verifySuccessfulAnswer(page);
    await page.waitForTimeout(TIMEOUTS.mediumWait);
    
    // Test discount calculation error handling
    await submitAnswer(page, 'wrong calculation');
    const discountError = await verifyErrorHandling(page);
    expect(discountError).toMatch(/discount|calculate|10%|price/i);
    
    // Correct the answer to proceed
    await submitAnswer(page, TEST_ANSWERS.correct[1]);
    await verifySuccessfulAnswer(page);
    await page.waitForTimeout(TIMEOUTS.mediumWait);
    
    // Test comparison question error handling  
    await submitAnswer(page, 'random answer');
    const comparisonError = await verifyErrorHandling(page);
    expect(comparisonError).toMatch(/compare|100g|cheaper|calculate/i);
  });

  test('should maintain positive tone throughout error corrections', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Submit several wrong answers and collect responses
    const errorResponses: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      await submitAnswer(page, `wrong answer ${i + 1}`);
      const response = await verifyErrorHandling(page);
      errorResponses.push(response);
      await page.waitForTimeout(TIMEOUTS.shortWait);
    }
    
    // Verify all responses maintain positive, encouraging tone
    errorResponses.forEach((response, index) => {
      console.log(`Error response ${index + 1}:`, response);
      
      // Should contain positive language
      expect(response).toMatch(/Thank you|great|attempt|try|help|hint/i);
      
      // Should not contain negative language
      expect(response).not.toMatch(/wrong|incorrect|bad|failed/i);
    });
    
    // Should still allow progression with correct answer
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    await verifySuccessfulAnswer(page);
  });

});