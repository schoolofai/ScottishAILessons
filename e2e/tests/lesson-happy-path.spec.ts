/**
 * Happy Path lesson completion tests
 * Based on Test 1 documented in playwright-e2e-test-log.md
 * Tests complete lesson execution where user answers all questions correctly
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';
import { 
  startLesson,
  submitAnswer, 
  verifySuccessfulAnswer,
  verifyLessonCompletion,
  verifyLessonStructure,
  getLessonProgress,
  completeLessonWithCorrectAnswers
} from './helpers/lesson';
import { TEST_ANSWERS, LESSON_STRUCTURE, TIMEOUTS } from './helpers/constants';

test.describe('Lesson Happy Path', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await authenticateUser(page);
  });

  test('should complete full lesson with correct answers', async ({ page }) => {
    // Start a new lesson
    const sessionId = await startLesson(page);
    console.log(`Started lesson with session ID: ${sessionId}`);
    
    // Verify lesson structure
    await verifyLessonStructure(page);
    
    // Answer all questions correctly
    const responses = await completeLessonWithCorrectAnswers(page, TEST_ANSWERS.correct);
    
    // Verify we got positive feedback for each answer
    expect(responses.length).toBe(TEST_ANSWERS.correct.length);
    responses.forEach((response, index) => {
      console.log(`Question ${index + 1} response:`, response);
      expect(response).toMatch(/Great|correctly|excellent|well done|fantastic/i);
    });
    
    // Verify lesson completion
    const completionResponse = await verifyLessonCompletion(page);
    console.log('Completion response:', completionResponse);
    
    // Should contain congratulatory message
    expect(completionResponse).toMatch(/congratulations.*completing.*cards/i);
  });

  test('should handle individual question types correctly', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Question 1: Fraction conversion (0.2 → 1/5)
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    const response1 = await verifySuccessfulAnswer(page);
    expect(response1).toMatch(/great|correct|1\/5|fraction/i);
    console.log('Fraction question response:', response1);
    
    // Wait for next card
    await page.waitForTimeout(TIMEOUTS.mediumWait);
    
    // Question 2: Discount calculation (£18.00 with 10% off → £16.20)
    await submitAnswer(page, TEST_ANSWERS.correct[1]);
    const response2 = await verifySuccessfulAnswer(page);
    expect(response2).toMatch(/great|correct|discount|£16\.20/i);
    console.log('Discount question response:', response2);
    
    // Wait for next card
    await page.waitForTimeout(TIMEOUTS.mediumWait);
    
    // Question 3: Unit price comparison (1kg £2.80 is cheaper)
    await submitAnswer(page, TEST_ANSWERS.correct[2]);
    const response3 = await verifySuccessfulAnswer(page);
    expect(response3).toMatch(/great|correct|cheaper|better deal/i);
    console.log('Comparison question response:', response3);
  });

  test('should track lesson progress correctly', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Check initial progress (might not be visible initially)
    const initialProgress = await getLessonProgress(page);
    if (initialProgress) {
      console.log('Initial progress:', initialProgress);
      expect(initialProgress.total).toBe(LESSON_STRUCTURE.totalCards);
    }
    
    // Answer questions one by one and check progress
    for (let i = 0; i < TEST_ANSWERS.correct.length; i++) {
      await submitAnswer(page, TEST_ANSWERS.correct[i]);
      await verifySuccessfulAnswer(page);
      
      // Check progress after each answer
      const currentProgress = await getLessonProgress(page);
      if (currentProgress) {
        console.log(`Progress after question ${i + 1}:`, currentProgress);
        expect(currentProgress.current).toBeGreaterThanOrEqual(i + 1);
        expect(currentProgress.total).toBe(LESSON_STRUCTURE.totalCards);
      }
      
      // Wait before next question
      await page.waitForTimeout(TIMEOUTS.mediumWait);
    }
  });

  test('should maintain session state throughout lesson', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Verify we're in the correct session
    expect(page.url()).toContain(`/session/${sessionId}`);
    
    // Answer first question
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    await verifySuccessfulAnswer(page);
    
    // Reload page to test session persistence
    await page.reload();
    
    // Should still be in the same session
    expect(page.url()).toContain(`/session/${sessionId}`);
    
    // Should be able to continue lesson
    await expect(page.locator('[placeholder="Send a message..."]')).toBeVisible();
    
    // Continue with remaining questions
    for (let i = 1; i < TEST_ANSWERS.correct.length; i++) {
      await submitAnswer(page, TEST_ANSWERS.correct[i]);
      await verifySuccessfulAnswer(page);
      await page.waitForTimeout(TIMEOUTS.mediumWait);
    }
    
    // Verify completion
    await verifyLessonCompletion(page);
  });

  test('should display lesson content and structure correctly', async ({ page }) => {
    const sessionId = await startLesson(page);
    
    // Verify breadcrumbs show correct lesson path
    await verifyLessonStructure(page);
    
    // Verify chat interface is working
    await expect(page.locator('[placeholder="Send a message..."]')).toBeVisible();
    await expect(page.locator('[placeholder="Send a message..."]')).toBeEnabled();
    
    // Verify initial AI greeting/question appears
    const chatContent = page.locator('main div').filter({ hasText: /Hello|fraction|decimal|percentage/i });
    await expect(chatContent.first()).toBeVisible({ timeout: TIMEOUTS.aiResponse });
    
    // Submit first answer to verify interaction
    await submitAnswer(page, TEST_ANSWERS.correct[0]);
    
    // Verify AI responds appropriately
    await verifySuccessfulAnswer(page);
    
    // Verify lesson continues (more content appears)
    const moreContent = page.locator('div').filter({ hasText: /discount|next|card/i });
    await expect(moreContent.first()).toBeVisible({ timeout: TIMEOUTS.aiResponse });
  });

});