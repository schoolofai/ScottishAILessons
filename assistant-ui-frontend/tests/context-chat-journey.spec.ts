/**
 * End-to-End Test: Context Chat User Journey
 *
 * This test verifies the complete context-aware chat functionality:
 * 1. Student starts a lesson session
 * 2. Context chat panel is visible and collapsible
 * 3. Student asks context-aware questions
 * 4. Assistant responds with lesson-specific context
 * 5. Chat history persists across session reload
 *
 * RED STATE: This test will initially FAIL as context chat doesn't exist yet.
 * GREEN STATE: Test passes when feature is fully implemented.
 */

import { test, expect } from '@playwright/test';

test.describe('Context Chat User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test session with known lesson context
    await page.goto('/session/test-session-context-chat');

    // Wait for the main teaching interface to load
    await page.waitForSelector('[data-testid="main-teaching-panel"]', {
      timeout: 10000
    });
  });

  test('Context chat provides lesson-aware assistance', async ({ page }) => {
    // RED: This test will initially fail - context chat doesn't exist yet

    // 1. Verify main teaching panel is present (2/3 width)
    const mainPanel = page.locator('[data-testid="main-teaching-panel"]');
    await expect(mainPanel).toBeVisible();

    // 2. Verify context chat panel is visible and properly positioned (1/3 width)
    const contextChatPanel = page.locator('[data-testid="context-chat-panel"]');
    await expect(contextChatPanel).toBeVisible();

    // Verify the panel has the correct layout class
    await expect(contextChatPanel).toHaveClass(/w-1\/3/);

    // 3. Verify context chat header is present
    const chatHeader = contextChatPanel.locator('[data-testid="context-chat-header"]');
    await expect(chatHeader).toContainText('Learning Assistant');
    await expect(chatHeader).toContainText('Ask questions about your lesson');

    // 4. Test collapsible behavior
    const collapseButton = contextChatPanel.locator('[data-testid="context-chat-toggle"]');
    await expect(collapseButton).toBeVisible();

    // Collapse the panel
    await collapseButton.click();
    const chatContent = contextChatPanel.locator('[data-testid="context-chat-content"]');
    await expect(chatContent).toBeHidden();

    // Expand the panel back
    await collapseButton.click();
    await expect(chatContent).toBeVisible();

    // 5. Send a context-aware question about the current lesson
    const chatInput = contextChatPanel.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    // Type a question that requires lesson context to answer correctly
    await chatInput.fill('What fraction are we currently discussing in this lesson?');

    // Send the message
    const sendButton = contextChatPanel.locator('[data-testid="chat-send"]');
    await sendButton.click();

    // 6. Wait for streaming response to start
    const responseMessage = contextChatPanel.locator('[data-testid="ai-message"]').last();
    await expect(responseMessage).toBeVisible({ timeout: 5000 });

    // 7. Verify response demonstrates context awareness
    // The response should reference specific lesson content (e.g., "2/10" from teaching context)
    await expect(responseMessage).toContainText('2/10', { timeout: 10000 });

    // Verify topic awareness
    await expect(responseMessage).toContainText(/fraction/i);

    // Verify the response shows understanding of current lesson state
    await expect(responseMessage).toContainText(/lesson/i);

    // 8. Test search integration with context
    const chatInputAgain = contextChatPanel.locator('[data-testid="chat-input"]');
    await chatInputAgain.fill('Can you search for more examples of fractions like the one we\'re studying?');
    const sendButtonAgain = contextChatPanel.locator('[data-testid="chat-send"]');
    await sendButtonAgain.click();

    // Wait for search-enhanced response
    const searchResponse = contextChatPanel.locator('[data-testid="ai-message"]').last();
    await expect(searchResponse).toBeVisible({ timeout: 10000 });

    // Should contain search results related to fractions
    await expect(searchResponse).toContainText(/example/i);
    await expect(searchResponse).toContainText(/fraction/i);

    // 9. Verify chat history count
    const allMessages = contextChatPanel.locator('[data-testid="ai-message"]');
    await expect(allMessages).toHaveCount(2); // Two AI responses
  });

  test('Context chat persistence across session reload', async ({ page }) => {
    // RED: This will also initially fail

    // 1. Send a message to create chat history
    const contextChatPanel = page.locator('[data-testid="context-chat-panel"]');
    const chatInput = contextChatPanel.locator('[data-testid="chat-input"]');

    await chatInput.fill('What topic are we learning about?');
    const sendButton = contextChatPanel.locator('[data-testid="chat-send"]');
    await sendButton.click();

    // Wait for response
    const responseMessage = contextChatPanel.locator('[data-testid="ai-message"]').first();
    await expect(responseMessage).toBeVisible({ timeout: 5000 });

    // 2. Reload the page to test persistence
    await page.reload();
    await page.waitForSelector('[data-testid="context-chat-panel"]');

    // 3. Verify chat history is restored
    const restoredMessages = page.locator('[data-testid="context-chat-panel"] [data-testid="ai-message"]');
    await expect(restoredMessages).toHaveCount(1);

    // 4. Verify the restored message content
    await expect(restoredMessages.first()).toContainText(/fraction/i);
  });

  test('Context chat error handling when backend unavailable', async ({ page }) => {
    // RED: This will also initially fail

    // Mock backend unavailability by intercepting network requests
    await page.route('**/runs/stream**', route => {
      route.abort('failed');
    });

    const contextChatPanel = page.locator('[data-testid="context-chat-panel"]');
    const chatInput = contextChatPanel.locator('[data-testid="chat-input"]');

    await chatInput.fill('Test message when backend is down');
    const sendButton = contextChatPanel.locator('[data-testid="chat-send"]');
    await sendButton.click();

    // Should show user-friendly error message
    const errorMessage = contextChatPanel.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText('Please try later, we\'re looking into it');

    // Should NOT show generic fallback responses (as per requirements)
    await expect(errorMessage).not.toContainText('I can help you with');
    await expect(errorMessage).not.toContainText('How can I assist');
  });

  test('Context chat maintains separation from main teaching flow', async ({ page }) => {
    // RED: This will also initially fail

    const mainPanel = page.locator('[data-testid="main-teaching-panel"]');
    const contextChatPanel = page.locator('[data-testid="context-chat-panel"]');

    // 1. Send message in context chat
    const chatInput = contextChatPanel.locator('[data-testid="chat-input"]');
    await chatInput.fill('Context chat test message');
    const sendButton = contextChatPanel.locator('[data-testid="chat-send"]');
    await sendButton.click();

    // 2. Verify main teaching flow is not affected
    // Main panel should still show its original content
    await expect(mainPanel).toBeVisible();

    // Main teaching thread should not show context chat messages
    const mainMessages = mainPanel.locator('[data-testid="teaching-message"]');
    if (await mainMessages.count() > 0) {
      await expect(mainMessages.last()).not.toContainText('Context chat test message');
    }

    // 3. Context chat should operate on separate thread
    const contextMessages = contextChatPanel.locator('[data-testid="ai-message"]');
    await expect(contextMessages).toHaveCount(1);
  });
});