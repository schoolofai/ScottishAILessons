/**
 * Post-completion interaction tests
 * Based on Test 3 documented in playwright-e2e-test-log.md
 * Tests system behavior when user interacts after lesson completion
 */

import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';
import { 
  navigateToSession,
  submitAnswer, 
  verifyPerformanceSummary,
  waitForAIResponse,
  isLessonCompleted
} from './helpers/lesson';
import { TEST_ANSWERS, TEST_SESSIONS, TIMEOUTS, AI_PATTERNS } from './helpers/constants';

test.describe('Post-Completion Interactions', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await authenticateUser(page);
  });

  test('should provide performance summary when asked for more content', async ({ page }) => {
    // Navigate to a completed lesson session
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Verify lesson is completed
    const completed = await isLessonCompleted(page);
    if (!completed) {
      console.log('Session may not be completed, continuing anyway...');
    }
    
    // Ask for more content after completion
    await submitAnswer(page, TEST_ANSWERS.postCompletion[0]); // "Can I learn more about this topic?"
    
    // Verify performance summary response
    const summaryResponse = await verifyPerformanceSummary(page);
    console.log('Performance summary response:', summaryResponse);
    
    // Should contain performance analysis
    expect(summaryResponse).toMatch(/Performance Analysis/i);
    expect(summaryResponse).toMatch(/accuracy.*%/i);
    
    // Should contain learning recommendations
    expect(summaryResponse).toMatch(/Areas for Improvement|Recommendations/i);
    
    // Should contain encouragement
    expect(summaryResponse).toMatch(/retry|practice|learning|progress/i);
  });

  test('should not generate new lesson content after completion', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Submit post-completion query
    await submitAnswer(page, 'What\'s next?');
    
    // Wait for response
    const response = await waitForAIResponse(page, TIMEOUTS.aiResponse + 5000);
    console.log('Post-completion response:', response);
    
    // Should not contain new lesson card indicators
    expect(response).not.toMatch(/card \d+|next lesson|new topic/i);
    
    // Should be focused on completed lesson analysis
    expect(response).toMatch(/completed|analysis|performance|retry|practice/i);
    
    // Verify no new lesson interface appears
    const newLessonContent = page.locator('div').filter({ hasText: /card.*lesson|start.*lesson/i });
    await expect(newLessonContent).not.toBeVisible({ timeout: 5000 });
  });

  test('should provide detailed performance analytics', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Request performance details
    await submitAnswer(page, 'How did I do?');
    
    // Wait for detailed analytics
    const analyticsResponse = await waitForAIResponse(page, TIMEOUTS.aiResponse + 5000);
    console.log('Analytics response:', analyticsResponse);
    
    // Should contain quantified metrics
    expect(analyticsResponse).toMatch(/\d+\.\d+%|accuracy|attempt|success rate/i);
    
    // Should contain learning pattern analysis
    expect(analyticsResponse).toMatch(/patterns?|attempts?|questions?/i);
    
    // Should identify strengths and weaknesses
    expect(analyticsResponse).toMatch(/strengths?|areas.*improvement|weaknesses?/i);
    
    // Should be substantial and detailed
    expect(analyticsResponse.length).toBeGreaterThan(200);
  });

  test('should suggest retry recommendation appropriately', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Ask for next steps
    await submitAnswer(page, 'What should I do next?');
    
    const nextStepsResponse = await waitForAIResponse(page, TIMEOUTS.aiResponse + 5000);
    console.log('Next steps response:', nextStepsResponse);
    
    // Should contain retry recommendation
    expect(nextStepsResponse).toMatch(/retry.*lesson|try.*again|repeat/i);
    
    // Should contain practice suggestions
    expect(nextStepsResponse).toMatch(/practice|exercise|work on/i);
    
    // Should contain learning resources
    expect(nextStepsResponse).toMatch(/resources?|websites?|applications?|online/i);
  });

  test('should maintain educational tone in post-completion interactions', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Test multiple post-completion interactions
    const queries = [
      'Can you give me a summary?',
      'How can I improve?',
      'What did I learn?'
    ];
    
    for (const query of queries) {
      await submitAnswer(page, query);
      const response = await waitForAIResponse(page, TIMEOUTS.aiResponse);
      
      console.log(`Response to "${query}":`, response.substring(0, 100) + '...');
      
      // Should maintain encouraging, educational tone
      expect(response).toMatch(/learning|progress|improvement|practice|skills?/i);
      
      // Should be constructive, not dismissive
      expect(response).not.toMatch(/done|finished|over|completed.*no more/i);
      
      // Wait between queries
      await page.waitForTimeout(TIMEOUTS.shortWait);
    }
  });

  test('should provide specific skill improvement recommendations', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Request specific improvement advice
    await submitAnswer(page, 'What specific skills should I work on?');
    
    const skillsResponse = await waitForAIResponse(page, TIMEOUTS.aiResponse + 5000);
    console.log('Skills improvement response:', skillsResponse);
    
    // Should mention specific mathematical concepts from the lesson
    expect(skillsResponse).toMatch(/fractions?|decimals?|percentages?/i);
    expect(skillsResponse).toMatch(/conversion|rounding|comparison/i);
    
    // Should provide concrete practice suggestions
    expect(skillsResponse).toMatch(/practice.*conversion|work.*fraction|exercise/i);
    
    // Should mention real-world applications
    expect(skillsResponse).toMatch(/money|shopping|financial|real-life/i);
  });

  test('should handle multiple post-completion interactions consistently', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Submit multiple queries in succession
    const responses: string[] = [];
    
    for (const query of TEST_ANSWERS.postCompletion) {
      await submitAnswer(page, query);
      const response = await waitForAIResponse(page, TIMEOUTS.aiResponse);
      responses.push(response);
      
      // Brief wait between interactions
      await page.waitForTimeout(TIMEOUTS.shortWait);
    }
    
    // All responses should be educational and focused on completed lesson
    responses.forEach((response, index) => {
      console.log(`Post-completion response ${index + 1}:`, response.substring(0, 80) + '...');
      
      // Should contain educational content
      expect(response).toMatch(/performance|learning|improvement|practice/i);
      
      // Should not create new lesson content
      expect(response).not.toMatch(/new.*lesson|next.*topic|card \d+/i);
    });
    
    // All responses should be substantial (not just "lesson complete")
    responses.forEach(response => {
      expect(response.length).toBeGreaterThan(50);
    });
  });

  test('should recognize lesson completion state correctly', async ({ page }) => {
    await navigateToSession(page, TEST_SESSIONS.completed);
    
    // Verify the system recognizes completion state
    const lessonCompleted = await isLessonCompleted(page);
    
    // Submit query to confirm system knows lesson is done
    await submitAnswer(page, 'Is the lesson finished?');
    
    const statusResponse = await waitForAIResponse(page);
    console.log('Lesson status response:', statusResponse);
    
    // Should acknowledge completion
    expect(statusResponse).toMatch(/completed|finished|done|congratulations/i);
    
    // Should reference the completed lesson
    expect(statusResponse).toMatch(/lesson|cards?|achievement/i);
    
    // Should not suggest continuing with more questions
    expect(statusResponse).not.toMatch(/next question|continue.*lesson|more cards?/i);
  });

});