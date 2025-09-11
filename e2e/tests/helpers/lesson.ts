/**
 * Lesson interaction utilities for Scottish AI Lessons E2E tests
 * Based on lesson flow documented in playwright-e2e-test-log.md
 */

import { Page, expect, Locator } from '@playwright/test';
import { SELECTORS, TIMEOUTS, AI_PATTERNS } from './constants';

/**
 * Start a new lesson from the dashboard
 */
export async function startLesson(page: Page): Promise<string> {
  // Click start lesson button
  await page.getByRole('button', { name: 'Start Lesson' }).click();
  
  // Wait for lesson interface to load
  await expect(page.locator(SELECTORS.messageInput)).toBeVisible({ timeout: TIMEOUTS.pageLoad });
  
  // Extract session ID from URL
  const url = page.url();
  const sessionMatch = url.match(/\/session\/([a-f0-9]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : '';
  
  // Verify we're in a lesson session
  expect(sessionId).toBeTruthy();
  
  return sessionId;
}

/**
 * Navigate to an existing lesson session
 */
export async function navigateToSession(page: Page, sessionId: string): Promise<void> {
  await page.goto(`/session/${sessionId}`);
  
  // Wait for lesson interface to load
  await expect(page.locator(SELECTORS.messageInput)).toBeVisible({ timeout: TIMEOUTS.pageLoad });
}

/**
 * Submit an answer in the lesson chat
 */
export async function submitAnswer(page: Page, answer: string): Promise<void> {
  // Fill the message input
  await page.locator(SELECTORS.messageInput).fill(answer);
  
  // Submit by pressing Enter (more reliable than clicking button)
  await page.locator(SELECTORS.messageInput).press('Enter');
  
  // Wait a moment for the submission to process
  await page.waitForTimeout(TIMEOUTS.shortWait);
}

/**
 * Wait for AI response and return the response content
 */
export async function waitForAIResponse(page: Page, timeout = TIMEOUTS.aiResponse): Promise<string> {
  // Wait for new message to appear
  await page.waitForTimeout(TIMEOUTS.streamingDelay);
  
  // Get the last AI message
  const messages = page.locator('div').filter({ hasText: /Hello|Great|Thank|Congratulations/i });
  const lastMessage = messages.last();
  
  // Wait for message to be visible
  await expect(lastMessage).toBeVisible({ timeout });
  
  // Get the text content
  const content = await lastMessage.textContent() || '';
  return content.trim();
}

/**
 * Verify AI response matches expected patterns
 */
export async function verifyAIResponsePattern(
  page: Page, 
  patterns: RegExp[], 
  timeout = TIMEOUTS.aiResponse
): Promise<string> {
  const response = await waitForAIResponse(page, timeout);
  
  // Check if any pattern matches
  const matchFound = patterns.some(pattern => pattern.test(response));
  
  if (!matchFound) {
    throw new Error(`AI response does not match expected patterns.\nResponse: "${response}"\nPatterns: ${patterns.map(p => p.toString()).join(', ')}`);
  }
  
  return response;
}

/**
 * Verify successful answer feedback
 */
export async function verifySuccessfulAnswer(page: Page): Promise<string> {
  return await verifyAIResponsePattern(page, AI_PATTERNS.success);
}

/**
 * Verify error handling feedback
 */
export async function verifyErrorHandling(page: Page): Promise<string> {
  return await verifyAIResponsePattern(page, AI_PATTERNS.error);
}

/**
 * Verify lesson completion
 */
export async function verifyLessonCompletion(page: Page): Promise<string> {
  return await verifyAIResponsePattern(page, AI_PATTERNS.completion, TIMEOUTS.aiResponse + 5000);
}

/**
 * Verify performance summary (post-completion)
 */
export async function verifyPerformanceSummary(page: Page): Promise<string> {
  return await verifyAIResponsePattern(page, AI_PATTERNS.summary, TIMEOUTS.aiResponse + 5000);
}

/**
 * Get lesson breadcrumb information
 */
export async function getLessonBreadcrumbs(page: Page): Promise<string[]> {
  const breadcrumbLocator = page.locator(SELECTORS.breadcrumbs);
  await expect(breadcrumbLocator).toBeVisible();
  
  const breadcrumbText = await breadcrumbLocator.textContent() || '';
  return breadcrumbText.split('•').map(item => item.trim()).filter(Boolean);
}

/**
 * Verify lesson breadcrumbs match expected structure
 */
export async function verifyLessonStructure(page: Page): Promise<void> {
  const breadcrumbs = await getLessonBreadcrumbs(page);
  
  // Should contain subject, topic, and lesson name
  expect(breadcrumbs.length).toBeGreaterThanOrEqual(3);
  expect(breadcrumbs[0]).toMatch(/National \d+/);
  expect(breadcrumbs[1]).toContain('Applications of Mathematics');
  expect(breadcrumbs[2]).toContain('Fractions');
}

/**
 * Check if lesson is completed (no new cards available)
 */
export async function isLessonCompleted(page: Page): Promise<boolean> {
  try {
    // Look for completion indicators
    const completionMessage = page.locator('div').filter({ hasText: AI_PATTERNS.completion[0] });
    return await completionMessage.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

/**
 * Wait for lesson card to load (next question)
 */
export async function waitForNextCard(page: Page): Promise<void> {
  // Wait for potential card transition
  await page.waitForTimeout(TIMEOUTS.mediumWait);
  
  // Verify message input is still available (lesson continues)
  await expect(page.locator(SELECTORS.messageInput)).toBeEnabled();
}

/**
 * Get current lesson progress (if visible)
 */
export async function getLessonProgress(page: Page): Promise<{ current: number; total: number } | null> {
  try {
    // Look for progress indicators like "2 / 3"
    const progressLocator = page.locator('text=/\\d+ \\/ \\d+/');
    const progressText = await progressLocator.textContent({ timeout: 2000 });
    
    if (progressText) {
      const match = progressText.match(/(\d+) \/ (\d+)/);
      if (match) {
        return {
          current: parseInt(match[1]),
          total: parseInt(match[2])
        };
      }
    }
  } catch {
    // Progress indicator might not be visible
  }
  
  return null;
}

/**
 * Complete a full lesson with correct answers
 */
export async function completeLessonWithCorrectAnswers(
  page: Page, 
  answers: string[]
): Promise<string[]> {
  const responses: string[] = [];
  
  for (const answer of answers) {
    // Submit answer
    await submitAnswer(page, answer);
    
    // Wait for and verify successful response
    const response = await verifySuccessfulAnswer(page);
    responses.push(response);
    
    // Wait for potential card transition
    await waitForNextCard(page);
  }
  
  return responses;
}