/**
 * PracticeWizardPage - Page Object Model for Practice Wizard E2E Tests
 *
 * Encapsulates all practice wizard interactions for:
 * - Fast, visual E2E testing
 * - Various answer permutations (correct, wrong, partial)
 * - Block progression and completion scenarios
 *
 * Usage:
 *   const wizard = new PracticeWizardPage(page);
 *   await wizard.goto('lesson_test_simple_addition');
 *   await wizard.waitForQuestionToLoad();
 *   await wizard.submitAnswer('42');
 *   await wizard.waitForFeedback();
 */

import { Page, Locator, expect } from '@playwright/test';

// Test credentials (from CLAUDE.md)
export const TEST_USER = {
  email: 'test@scottishailessons.com',
  password: 'red12345',
};

// Known test lessons
export const TEST_LESSONS = {
  simpleAddition: 'lesson_test_simple_addition',
  withV2Questions: '68f51d0d0009edd1b817',
};

/**
 * Configuration for test speed/visibility tradeoffs
 */
export interface WizardTestConfig {
  /** Wait time between actions (ms) - lower = faster, higher = more visible */
  actionDelay: number;
  /** Whether to add extra pauses for visual debugging */
  visualMode: boolean;
  /** Timeout for waiting for elements */
  defaultTimeout: number;
}

export const FAST_CONFIG: WizardTestConfig = {
  actionDelay: 100,
  visualMode: false,
  defaultTimeout: 5000,
};

export const VISUAL_CONFIG: WizardTestConfig = {
  actionDelay: 500,
  visualMode: true,
  defaultTimeout: 10000,
};

/**
 * Represents a question's state in the UI
 */
export interface QuestionState {
  questionText: string;
  questionType: 'numeric' | 'mcq' | 'text' | 'unknown';
  difficulty?: 'easy' | 'medium' | 'hard';
  hasHints: boolean;
}

/**
 * Represents feedback state after answer submission
 */
export interface FeedbackState {
  isCorrect: boolean;
  feedbackText: string;
  masteryScore?: number;
  canContinue: boolean;
}

/**
 * Represents block progress state
 */
export interface BlockProgressState {
  currentBlock: number;
  totalBlocks: number;
  questionsAnswered: number;
  questionsCorrect: number;
  mastery: number;
  isBlockComplete: boolean;
}

/**
 * Page Object Model for Practice Wizard
 */
export class PracticeWizardPage {
  readonly page: Page;
  readonly config: WizardTestConfig;

  // Main container
  readonly container: Locator;

  // Question elements
  readonly questionStem: Locator;
  readonly questionDifficulty: Locator;

  // Answer input elements
  readonly numericInput: Locator;
  readonly textInput: Locator;
  readonly mcqOptions: Locator;

  // Action buttons
  readonly submitButton: Locator;
  readonly continueButton: Locator;
  readonly hintButton: Locator;

  // Feedback elements
  readonly feedbackContainer: Locator;
  readonly correctIndicator: Locator;
  readonly incorrectIndicator: Locator;

  // Progress elements
  readonly masteryBreakdown: Locator;
  readonly blockProgress: Locator;
  readonly sessionProgress: Locator;

  // Side panel elements
  readonly sidePanel: Locator;
  readonly completedBlocks: Locator;

  // Resume/Start Fresh modal elements
  readonly resumeModal: Locator;
  readonly resumeButton: Locator;
  readonly startFreshButton: Locator;

  // Reset confirmation modal elements
  readonly resetModal: Locator;
  readonly confirmResetButton: Locator;
  readonly cancelResetButton: Locator;

  constructor(page: Page, config: WizardTestConfig = FAST_CONFIG) {
    this.page = page;
    this.config = config;

    // Main container - the wizard page wrapper
    this.container = page.locator('main').first();

    // Question elements - wizard-card contains the question stem with MathRenderer
    // The question stem is in a div.wizard-card p-6 with text content
    this.questionStem = page.locator('.wizard-card').first();
    this.questionDifficulty = page.locator('span.capitalize:has-text("easy"), span.capitalize:has-text("medium"), span.capitalize:has-text("hard")');

    // Answer inputs - based on actual component structure
    // Numeric/text inputs in the main question area
    this.numericInput = page.locator('main input[type="number"], main input[inputmode="numeric"], main input[type="text"]');
    // Text input: regular inputs, textareas, or rich text editors (contenteditable)
    // Rich text editors often use ProseMirror or have contenteditable=true
    // Also look for elements with role="textbox"
    this.textInput = page.locator(
      'main textarea, ' +
      'main input:not([type="hidden"]), ' +
      'main [contenteditable="true"], ' +
      'main [role="textbox"], ' +
      'main .ProseMirror, ' +
      'main .tiptap'
    );
    // MCQ options - buttons that look like answer options
    // MCQ answer buttons have both rounded-2xl AND border-2 classes
    // They also DON'T have the :has-text("Submit") since that's the submit button
    this.mcqOptions = page.locator('main button.rounded-2xl.border-2');

    // Action buttons - exact text from components
    this.submitButton = page.locator('button:has-text("Submit Answer")');
    // Continue button text varies: "Continue", "Continue to Next Block", "Complete Lesson"
    this.continueButton = page.locator('button:has-text("Continue")');
    this.hintButton = page.locator('button:has-text("Need a hint")');

    // Feedback elements - FeedbackStep component
    // Correct shows "Excellent!" in a green gradient banner
    // Incorrect shows "Keep Going!" in an amber/orange gradient banner
    this.feedbackContainer = page.locator('h2:has-text("Excellent!"), h2:has-text("Keep Going!")');
    this.correctIndicator = page.locator('h2:has-text("Excellent!")');
    this.incorrectIndicator = page.locator('h2:has-text("Keep Going!")');

    // Progress elements - from MasteryBreakdown and side panel
    this.masteryBreakdown = page.locator('aside, [class*="side"]').first();
    this.blockProgress = page.locator('text=/Questions \\d+\\/\\d+/');
    this.sessionProgress = page.locator('text=/Overall Progress/');

    // Side panel
    this.sidePanel = page.locator('[data-testid="side-panel"], [class*="side-panel"], aside');
    this.completedBlocks = page.locator('[data-testid="completed-block"], [class*="BlockStopMarker"]');

    // Resume/Start Fresh modal
    // The modal contains "Continue Your Practice?" title
    this.resumeModal = page.locator('[role="dialog"]:has-text("Continue Your Practice")');
    this.resumeButton = page.locator('button:has-text("Resume")');
    this.startFreshButton = page.locator('button:has-text("Start Fresh")');

    // Reset confirmation modal (appears after clicking "Start Fresh")
    // Title is "Reset Practice Session?"
    this.resetModal = page.locator('[role="dialog"]:has-text("Reset Practice Session")');
    this.confirmResetButton = page.locator('button:has-text("Reset Progress")');
    this.cancelResetButton = page.locator('[role="dialog"] button:has-text("Cancel")');
  }

  /**
   * Navigate to practice wizard for a specific lesson
   * Automatically handles resume modal if it appears
   *
   * @param lessonId - The lesson ID to navigate to
   * @param options - Options for handling the resume modal
   */
  async goto(
    lessonId: string,
    options: { onExistingSession?: 'resume' | 'start-fresh' | 'wait' } = { onExistingSession: 'resume' }
  ): Promise<void> {
    await this.page.goto(`http://localhost:3000/practice_wizard/${lessonId}`);
    await this.page.waitForLoadState('networkidle');
    await this.delay();

    // Check if resume modal appears (existing session detected)
    const hasResumeModal = await this.resumeModal.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasResumeModal) {
      console.log('📋 Resume modal detected - existing session found');

      if (options.onExistingSession === 'resume') {
        await this.clickResume();
      } else if (options.onExistingSession === 'start-fresh') {
        await this.clickStartFresh();
      }
      // If 'wait', do nothing - let test handle it manually
    }
  }

  /**
   * Navigate to practice wizard and always start fresh (reset any existing session)
   */
  async gotoFresh(lessonId: string): Promise<void> {
    await this.goto(lessonId, { onExistingSession: 'start-fresh' });
  }

  /**
   * Navigate to practice wizard and resume existing session (or start new if none)
   */
  async gotoResume(lessonId: string): Promise<void> {
    await this.goto(lessonId, { onExistingSession: 'resume' });
  }

  // ═══════════════════════════════════════════════════════════════
  // Resume Modal Methods
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check if the resume modal is currently visible
   */
  async isResumeModalVisible(): Promise<boolean> {
    return await this.resumeModal.isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * Click "Resume" button in the resume modal to continue existing session
   */
  async clickResume(): Promise<void> {
    await expect(this.resumeButton).toBeVisible({ timeout: this.config.defaultTimeout });
    await this.resumeButton.click();
    console.log('✅ Clicked Resume - continuing existing session');
    await this.delay();

    // Wait for modal to close and question to load
    await expect(this.resumeModal).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    await this.delay();
  }

  /**
   * Click "Start Fresh" button in the resume modal
   * This may trigger a confirmation modal
   */
  async clickStartFresh(): Promise<void> {
    await expect(this.startFreshButton).toBeVisible({ timeout: this.config.defaultTimeout });
    await this.startFreshButton.click();
    console.log('🔄 Clicked Start Fresh');
    await this.delay();

    // Check if confirmation modal appears
    const hasConfirmModal = await this.resetModal.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasConfirmModal) {
      console.log('⚠️ Reset confirmation modal appeared');
      await this.confirmReset();
    } else {
      // No confirmation needed, wait for modal to close
      await expect(this.resumeModal).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    }

    await this.delay();
  }

  /**
   * Confirm reset in the confirmation modal
   */
  async confirmReset(): Promise<void> {
    await expect(this.confirmResetButton).toBeVisible({ timeout: this.config.defaultTimeout });
    await this.confirmResetButton.click();
    console.log('✅ Confirmed reset - starting fresh session');
    await this.delay();

    // Wait for modals to close
    await expect(this.resetModal).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(this.resumeModal).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    await this.delay();
  }

  /**
   * Cancel reset in the confirmation modal (go back to resume modal)
   */
  async cancelReset(): Promise<void> {
    await expect(this.cancelResetButton).toBeVisible({ timeout: this.config.defaultTimeout });
    await this.cancelResetButton.click();
    console.log('↩️ Cancelled reset');
    await this.delay();
  }

  /**
   * Get session info from the resume modal (if visible)
   */
  async getResumeModalInfo(): Promise<{
    currentBlock: number;
    totalBlocks: number;
    mastery: number;
    difficulty: string;
  } | null> {
    if (!(await this.isResumeModalVisible())) {
      return null;
    }

    try {
      // Extract info from the modal's progress card
      const modalContent = await this.resumeModal.textContent() || '';

      // Parse block info (e.g., "1/3")
      const blockMatch = modalContent.match(/(\d+)\/(\d+)\s*Block/i);
      const currentBlock = blockMatch ? parseInt(blockMatch[1]) : 1;
      const totalBlocks = blockMatch ? parseInt(blockMatch[2]) : 1;

      // Parse mastery percentage
      const masteryMatch = modalContent.match(/(\d+)%\s*Mastery/i);
      const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 0;

      // Parse difficulty
      const difficultyMatch = modalContent.match(/(Easy|Medium|Hard)\s*Difficulty/i);
      const difficulty = difficultyMatch ? difficultyMatch[1].toLowerCase() : 'easy';

      return { currentBlock, totalBlocks, mastery, difficulty };
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Authentication Methods
  // ═══════════════════════════════════════════════════════════════

  /**
   * Login as test user (call before goto if not already logged in)
   */
  async login(): Promise<void> {
    await this.page.goto('http://localhost:3000/login');
    await this.page.waitForLoadState('networkidle');

    await this.page.fill('input[type="email"]', TEST_USER.email);
    await this.page.fill('input[type="password"]', TEST_USER.password);
    await this.page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await this.page.waitForURL(/\/(dashboard|chat|student-dashboard)/, { timeout: 15000 });
    await this.delay();
  }

  /**
   * Wait for question to fully load
   * Waits for the Submit Answer button as the most reliable indicator
   */
  async waitForQuestionToLoad(): Promise<void> {
    // The most reliable indicator is the Submit Answer button
    // It's always present when a question is loaded
    await this.submitButton.waitFor({ state: 'visible', timeout: this.config.defaultTimeout });

    // Also wait a moment for any animations
    await this.delay();
  }

  /**
   * Get current question state
   */
  async getQuestionState(): Promise<QuestionState> {
    const questionText = await this.questionStem.textContent() || '';

    // Determine question type by checking available inputs
    // Order matters: MCQ is checked by counting buttons in the specific MCQ container
    let questionType: 'numeric' | 'mcq' | 'text' | 'unknown' = 'unknown';

    // Check for MCQ options first (buttons in main .space-y-3 container)
    const mcqCount = await this.mcqOptions.count().catch(() => 0);
    if (mcqCount >= 2) {
      // MCQ questions have at least 2 options
      questionType = 'mcq';
    } else if (await this.textInput.isVisible().catch(() => false)) {
      // Text/numeric input (includes input[type="text"])
      questionType = 'text';
    } else if (await this.numericInput.isVisible().catch(() => false)) {
      questionType = 'numeric';
    }

    // Get difficulty if visible
    let difficulty: 'easy' | 'medium' | 'hard' | undefined;
    try {
      const diffText = await this.questionDifficulty.textContent();
      if (diffText?.toLowerCase().includes('easy')) difficulty = 'easy';
      else if (diffText?.toLowerCase().includes('medium')) difficulty = 'medium';
      else if (diffText?.toLowerCase().includes('hard')) difficulty = 'hard';
    } catch {
      // Difficulty not visible
    }

    const hasHints = await this.hintButton.isVisible().catch(() => false);

    return { questionText, questionType, difficulty, hasHints };
  }

  /**
   * Submit an answer (auto-detects input type)
   *
   * For MCQ questions:
   * - 'A', 'B', 'C', 'D' - selects by label
   * - 'index:0', 'index:1', etc. - selects by explicit index
   * - Any other text - finds option containing that text
   *
   * For text/numeric questions:
   * - Enters the answer in the input field
   */
  async submitAnswer(answer: string): Promise<void> {
    // Check for text/numeric input FIRST - this is more reliable
    // The textInput locator looks for inputs in the main question area
    const hasTextInput = await this.textInput.first().isVisible().catch(() => false);
    if (hasTextInput) {
      await this.textInput.first().fill(answer);
      await this.delay();
      await this.submitButton.click();
      await this.delay();
      return;
    }

    // Check for MCQ options (buttons in main .space-y-3 container)
    // Only use this if there are actual MCQ option buttons (at least 2)
    const mcqCount = await this.mcqOptions.count().catch(() => 0);
    if (mcqCount >= 2) {
      await this.selectMCQOption(answer);
      await this.delay();
      await this.submitButton.click();
      await this.delay();
      return;
    }

    // Last resort: try numeric input
    const hasNumericInput = await this.numericInput.isVisible().catch(() => false);
    if (hasNumericInput) {
      await this.numericInput.fill(answer);
      await this.delay();
      await this.submitButton.click();
      await this.delay();
      return;
    }

    throw new Error(`No supported input type found. MCQ count: ${mcqCount}, TextInput visible: ${hasTextInput}`);
  }

  /**
   * Select MCQ option by various methods:
   * - 'A', 'B', 'C', 'D' - by label
   * - 'index:N' - by explicit index
   * - Other text - by option content
   */
  private async selectMCQOption(answer: string): Promise<void> {
    // Wait for at least one MCQ option to be visible before proceeding
    await this.mcqOptions.first().waitFor({ state: 'visible', timeout: this.config.defaultTimeout });

    // Explicit index selection: 'index:0', 'index:1', etc.
    if (answer.startsWith('index:')) {
      const idx = parseInt(answer.replace('index:', ''));
      await this.mcqOptions.nth(idx).click();
      return;
    }

    // Selection by label: A, B, C, D
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const labelIndex = labels.indexOf(answer.toUpperCase());
    if (labelIndex >= 0) {
      await this.mcqOptions.nth(labelIndex).click();
      return;
    }

    // Selection by text content - find button containing the answer text
    const optionWithText = this.page.locator('.space-y-3 button').filter({ hasText: answer });
    const count = await optionWithText.count();

    if (count > 0) {
      await optionWithText.first().click();
      return;
    }

    // Last resort: try exact text match anywhere
    const textLocator = this.page.locator(`text="${answer}"`);
    if (await textLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textLocator.click();
      return;
    }

    throw new Error(`MCQ option not found for answer: "${answer}". Available options count: ${await this.mcqOptions.count()}`);
  }

  /**
   * Submit a correct answer (for numeric: uses known correct answer)
   * This is a helper for tests that need deterministic correct answers
   */
  async submitCorrectAnswer(): Promise<void> {
    // For testing, we need to know the correct answer
    // This should be determined from the question or test data
    // For now, we'll type a placeholder that tests can override
    await this.submitAnswer('correct');
  }

  /**
   * Submit an intentionally wrong answer
   * For text/numeric: enters obviously wrong values
   * For MCQ: selects the last option (often wrong in pedagogical design)
   */
  async submitWrongAnswer(): Promise<void> {
    // Check for text input first (same pattern as submitAnswer)
    const hasTextInput = await this.textInput.first().isVisible().catch(() => false);
    if (hasTextInput) {
      // Enter obviously wrong answer for text/numeric questions
      await this.textInput.first().fill('99999-WRONG');
      await this.delay();
      await this.submitButton.click();
      await this.delay();
      return;
    }

    // Check for MCQ options
    const mcqCount = await this.mcqOptions.count().catch(() => 0);
    if (mcqCount >= 2) {
      // Select last option (often wrong in pedagogical design)
      await this.mcqOptions.nth(mcqCount - 1).click();
      await this.delay();
      await this.submitButton.click();
      await this.delay();
      return;
    }

    // Last resort: numeric input with obviously wrong value
    const hasNumericInput = await this.numericInput.isVisible().catch(() => false);
    if (hasNumericInput) {
      await this.numericInput.fill('99999');
      await this.delay();
      await this.submitButton.click();
      await this.delay();
      return;
    }

    throw new Error('No supported input type found for wrong answer submission');
  }

  /**
   * Wait for feedback to appear after submission
   * Uses longer timeout since backend AI generates feedback
   */
  async waitForFeedback(): Promise<FeedbackState> {
    // Longer timeout for AI-generated feedback (30 seconds)
    const feedbackTimeout = 30000;

    // Wait for either correct or incorrect indicator
    await Promise.race([
      this.correctIndicator.waitFor({ state: 'visible', timeout: feedbackTimeout }),
      this.incorrectIndicator.waitFor({ state: 'visible', timeout: feedbackTimeout }),
    ]).catch(() => {
      // Fallback: wait for any feedback container
    });

    await this.delay();

    const isCorrect = await this.correctIndicator.isVisible().catch(() => false);
    const feedbackText = await this.feedbackContainer.textContent() || '';

    // Check if continue button is available
    const canContinue = await this.continueButton.isVisible().catch(() => false);

    // Try to get mastery score
    let masteryScore: number | undefined;
    try {
      const masteryText = await this.page.locator('text=/\\d+%/').first().textContent();
      if (masteryText) {
        const match = masteryText.match(/(\d+)%/);
        if (match) masteryScore = parseInt(match[1]);
      }
    } catch {
      // Mastery not visible
    }

    return { isCorrect, feedbackText, masteryScore, canContinue };
  }

  /**
   * Click continue to proceed to next question
   */
  async clickContinue(): Promise<void> {
    await expect(this.continueButton).toBeVisible({ timeout: this.config.defaultTimeout });
    await this.continueButton.click();
    await this.delay();
  }

  /**
   * Request a hint
   */
  async requestHint(): Promise<string> {
    await this.hintButton.click();
    await this.delay();

    // Wait for hint content
    const hintContent = this.page.locator('[data-testid="hint-content"], [class*="hint"]');
    await expect(hintContent).toBeVisible({ timeout: this.config.defaultTimeout });

    return await hintContent.textContent() || '';
  }

  /**
   * Get current block progress from UI
   * Note: All locator operations are wrapped with timeouts to prevent hanging
   */
  async getBlockProgress(): Promise<BlockProgressState> {
    // Look for progress indicators in mastery breakdown
    let questionsAnswered = 0;
    let questionsCorrect = 0;
    let mastery = 0;
    let completedBlockCount = 0;
    let totalBlocks = 0;

    // Use short timeout for optional UI elements
    const shortTimeout = 2000;

    try {
      // The UI shows "Questions" label separately from "X/Y" numbers
      // Look for tabular-nums span containing pattern like "1/3" or "0/0"
      // Pattern: number/number optionally followed by percentage
      const questionsLocator = this.page.locator('.tabular-nums:has-text("/")').first();
      const questionsVisible = await questionsLocator.isVisible({ timeout: shortTimeout }).catch(() => false);
      if (questionsVisible) {
        const questionsText = await questionsLocator.textContent({ timeout: shortTimeout });
        if (questionsText) {
          // Match patterns like "1/3", "1/3 (33%)", etc.
          const match = questionsText.match(/(\d+)\/(\d+)/);
          if (match) {
            questionsCorrect = parseInt(match[1]);
            questionsAnswered = parseInt(match[2]);
          }
        }
      }
    } catch {
      // Progress not visible
    }

    try {
      // Parse mastery percentage with timeout
      const masteryLocator = this.masteryBreakdown.locator('text=/\\d+%/').first();
      const masteryVisible = await masteryLocator.isVisible({ timeout: shortTimeout }).catch(() => false);
      if (masteryVisible) {
        const masteryText = await masteryLocator.textContent({ timeout: shortTimeout });
        if (masteryText) {
          const match = masteryText.match(/(\d+)%/);
          if (match) mastery = parseInt(match[1]);
        }
      }
    } catch {
      // Mastery not visible
    }

    try {
      // Count completed blocks with timeout - use simpler approach
      totalBlocks = await this.completedBlocks.count().catch(() => 0);
      if (totalBlocks > 0) {
        completedBlockCount = await this.completedBlocks
          .filter({ has: this.page.locator('[class*="complete"], .text-emerald') })
          .count()
          .catch(() => 0);
      }
    } catch {
      // Block counting failed
    }

    // Determine if current block is complete (look for completion modal or indicator)
    const isBlockComplete = await this.page
      .locator('text=Block Complete, text=Mastery Achieved')
      .isVisible({ timeout: shortTimeout })
      .catch(() => false);

    return {
      currentBlock: completedBlockCount + 1,
      totalBlocks,
      questionsAnswered,
      questionsCorrect,
      mastery,
      isBlockComplete,
    };
  }

  /**
   * Check if session/lesson is complete
   */
  async isSessionComplete(): Promise<boolean> {
    return await this.page.locator('text=Session Complete, text=Practice Complete, text=All blocks completed').isVisible().catch(() => false);
  }

  /**
   * Expand a completed block in the side panel to view details
   */
  async expandCompletedBlock(blockIndex: number): Promise<void> {
    const blocks = this.completedBlocks;
    await blocks.nth(blockIndex).click();
    await this.delay();
  }

  /**
   * Get completed block details from expanded panel
   */
  async getCompletedBlockDetails(blockIndex: number): Promise<{
    mastery: number;
    questionsAnswered: number;
    questionsCorrect: number;
  }> {
    await this.expandCompletedBlock(blockIndex);

    let mastery = 0;
    let questionsAnswered = 0;
    let questionsCorrect = 0;

    // Wait for expansion animation
    await this.delay();

    try {
      const blockDetails = this.completedBlocks.nth(blockIndex);

      // Parse mastery
      const masteryText = await blockDetails.locator('text=/\\d+%/').first().textContent();
      if (masteryText) {
        const match = masteryText.match(/(\d+)%/);
        if (match) mastery = parseInt(match[1]);
      }

      // Parse questions
      const questionsText = await blockDetails.locator('text=/Questions \\d+\\/\\d+/').textContent();
      if (questionsText) {
        const match = questionsText.match(/Questions (\d+)\/(\d+)/);
        if (match) {
          questionsCorrect = parseInt(match[1]);
          questionsAnswered = parseInt(match[2]);
        }
      }
    } catch {
      // Details not found
    }

    return { mastery, questionsAnswered, questionsCorrect };
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Internal delay helper for visual mode
   */
  private async delay(): Promise<void> {
    if (this.config.actionDelay > 0) {
      await this.page.waitForTimeout(this.config.actionDelay);
    }
  }
}

/**
 * Helper to run a sequence of answers and collect results
 */
export async function answerSequence(
  wizard: PracticeWizardPage,
  answers: Array<{ answer: string; expectedCorrect: boolean }>
): Promise<Array<{ answer: string; expectedCorrect: boolean; actualCorrect: boolean; feedback: FeedbackState }>> {
  const results: Array<{ answer: string; expectedCorrect: boolean; actualCorrect: boolean; feedback: FeedbackState }> = [];

  for (const { answer, expectedCorrect } of answers) {
    await wizard.waitForQuestionToLoad();
    await wizard.submitAnswer(answer);
    const feedback = await wizard.waitForFeedback();

    results.push({
      answer,
      expectedCorrect,
      actualCorrect: feedback.isCorrect,
      feedback,
    });

    if (feedback.canContinue) {
      await wizard.clickContinue();
    }
  }

  return results;
}

/**
 * Helper to complete a block with all correct answers
 */
export async function completeBlockCorrectly(
  wizard: PracticeWizardPage,
  correctAnswers: string[]
): Promise<void> {
  for (const answer of correctAnswers) {
    await wizard.waitForQuestionToLoad();
    await wizard.submitAnswer(answer);
    const feedback = await wizard.waitForFeedback();

    if (feedback.canContinue) {
      await wizard.clickContinue();
    }
  }
}

/**
 * Helper to answer wrong repeatedly (tests demotion logic)
 */
export async function answerWrongRepeatedly(
  wizard: PracticeWizardPage,
  count: number
): Promise<FeedbackState[]> {
  const feedbacks: FeedbackState[] = [];

  for (let i = 0; i < count; i++) {
    await wizard.waitForQuestionToLoad();
    await wizard.submitWrongAnswer();
    const feedback = await wizard.waitForFeedback();
    feedbacks.push(feedback);

    if (feedback.canContinue) {
      await wizard.clickContinue();
    }
  }

  return feedbacks;
}
