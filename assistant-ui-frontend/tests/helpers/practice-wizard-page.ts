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

    // Main container
    this.container = page.locator('[data-testid="practice-wizard-container"], .wizard-page, [class*="WizardPractice"]');

    // Question elements - using multiple selectors for flexibility
    this.questionStem = page.locator('[data-testid="question-stem"], .question-stem, [class*="questionStem"]');
    this.questionDifficulty = page.locator('[data-testid="difficulty-badge"], [class*="difficulty"]');

    // Answer inputs
    this.numericInput = page.locator('input[type="number"], input[inputmode="numeric"], [data-testid="numeric-input"]');
    this.textInput = page.locator('input[type="text"]:not([type="number"]), textarea, [data-testid="text-input"]');
    this.mcqOptions = page.locator('[data-testid="mcq-option"], [role="radio"], input[type="radio"], [class*="option-button"]');

    // Action buttons
    this.submitButton = page.locator('button:has-text("Submit"), button:has-text("Check"), [data-testid="submit-button"]');
    this.continueButton = page.locator('button:has-text("Continue"), button:has-text("Next"), [data-testid="continue-button"]');
    this.hintButton = page.locator('button:has-text("Hint"), [data-testid="hint-button"]');

    // Feedback elements
    this.feedbackContainer = page.locator('[data-testid="feedback"], [class*="feedback"], [class*="Feedback"]');
    this.correctIndicator = page.locator('[class*="correct"], text=Correct, text=Well done, [data-correct="true"]');
    this.incorrectIndicator = page.locator('[class*="incorrect"], text=Incorrect, text=Not quite, [data-correct="false"]');

    // Progress elements
    this.masteryBreakdown = page.locator('[data-testid="mastery-breakdown"], [class*="MasteryBreakdown"]');
    this.blockProgress = page.locator('[data-testid="block-progress"], [class*="BlockProgress"]');
    this.sessionProgress = page.locator('[data-testid="session-progress"], [class*="SessionProgress"]');

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
   */
  async waitForQuestionToLoad(): Promise<void> {
    // Wait for either numeric input, text input, or MCQ options
    await Promise.race([
      this.numericInput.waitFor({ state: 'visible', timeout: this.config.defaultTimeout }),
      this.textInput.waitFor({ state: 'visible', timeout: this.config.defaultTimeout }),
      this.mcqOptions.first().waitFor({ state: 'visible', timeout: this.config.defaultTimeout }),
    ]).catch(() => {
      // If none visible, wait for question stem at minimum
    });

    await expect(this.questionStem).toBeVisible({ timeout: this.config.defaultTimeout });
    await this.delay();
  }

  /**
   * Get current question state
   */
  async getQuestionState(): Promise<QuestionState> {
    const questionText = await this.questionStem.textContent() || '';

    // Determine question type
    let questionType: 'numeric' | 'mcq' | 'text' | 'unknown' = 'unknown';
    if (await this.numericInput.isVisible().catch(() => false)) {
      questionType = 'numeric';
    } else if (await this.mcqOptions.count() > 0) {
      questionType = 'mcq';
    } else if (await this.textInput.isVisible().catch(() => false)) {
      questionType = 'text';
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
   */
  async submitAnswer(answer: string): Promise<void> {
    const state = await this.getQuestionState();

    if (state.questionType === 'numeric') {
      await this.numericInput.fill(answer);
    } else if (state.questionType === 'mcq') {
      // For MCQ, find option by text or index
      const optionIndex = parseInt(answer);
      if (!isNaN(optionIndex)) {
        await this.mcqOptions.nth(optionIndex).click();
      } else {
        // Try to find by text
        await this.page.locator(`text=${answer}`).click();
      }
    } else {
      // Fallback to text input
      await this.textInput.fill(answer);
    }

    await this.delay();

    // Click submit
    await this.submitButton.click();
    await this.delay();
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
   */
  async submitWrongAnswer(): Promise<void> {
    const state = await this.getQuestionState();

    if (state.questionType === 'numeric') {
      // Submit obviously wrong numeric answer
      await this.numericInput.fill('99999');
    } else if (state.questionType === 'mcq') {
      // Select last option (often wrong in pedagogical design)
      const count = await this.mcqOptions.count();
      if (count > 0) {
        await this.mcqOptions.nth(count - 1).click();
      }
    } else {
      await this.textInput.fill('wrong answer');
    }

    await this.delay();
    await this.submitButton.click();
    await this.delay();
  }

  /**
   * Wait for feedback to appear after submission
   */
  async waitForFeedback(): Promise<FeedbackState> {
    // Wait for either correct or incorrect indicator
    await Promise.race([
      this.correctIndicator.waitFor({ state: 'visible', timeout: this.config.defaultTimeout }),
      this.incorrectIndicator.waitFor({ state: 'visible', timeout: this.config.defaultTimeout }),
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
   */
  async getBlockProgress(): Promise<BlockProgressState> {
    // Look for progress indicators in mastery breakdown
    let questionsAnswered = 0;
    let questionsCorrect = 0;
    let mastery = 0;

    try {
      // Parse "Questions X/Y" pattern
      const questionsText = await this.page.locator('text=/Questions \\d+\\/\\d+/').textContent();
      if (questionsText) {
        const match = questionsText.match(/Questions (\d+)\/(\d+)/);
        if (match) {
          questionsCorrect = parseInt(match[1]);
          questionsAnswered = parseInt(match[2]);
        }
      }
    } catch {
      // Progress not visible
    }

    try {
      // Parse mastery percentage
      const masteryText = await this.masteryBreakdown.locator('text=/\\d+%/').first().textContent();
      if (masteryText) {
        const match = masteryText.match(/(\d+)%/);
        if (match) mastery = parseInt(match[1]);
      }
    } catch {
      // Mastery not visible
    }

    // Count completed blocks
    const completedBlockCount = await this.completedBlocks.filter({ has: this.page.locator('[class*="complete"], .text-emerald') }).count();

    // Determine if current block is complete (look for completion modal or indicator)
    const isBlockComplete = await this.page.locator('text=Block Complete, text=Mastery Achieved').isVisible().catch(() => false);

    return {
      currentBlock: completedBlockCount + 1,
      totalBlocks: await this.completedBlocks.count(),
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
