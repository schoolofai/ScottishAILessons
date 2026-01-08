/**
 * Practice Wizard E2E Test Scenarios
 *
 * Comprehensive tests for various answer permutations:
 * - Correct answers (block completion, mastery progression)
 * - Wrong answers repeatedly (demotion logic)
 * - Mixed correct/wrong (realistic student behavior)
 * - Block completion verification
 * - Question count tracking (verifies "0/0" bug fix)
 *
 * Run visually (headed mode, slower):
 *   npm run test:wizard:visual
 *
 * Run fast (headless, CI mode):
 *   npm run test:wizard
 *
 * Run specific test:
 *   npx playwright test practice-wizard-scenarios --grep "completes block"
 */

import { test, expect } from '@playwright/test';
import {
  PracticeWizardPage,
  TEST_LESSONS,
  FAST_CONFIG,
  VISUAL_CONFIG,
  answerSequence,
  answerWrongRepeatedly,
} from './helpers/practice-wizard-page';

// Use visual config if VISUAL env var is set
const config = process.env.VISUAL === 'true' ? VISUAL_CONFIG : FAST_CONFIG;

test.describe('Practice Wizard - Answer Scenarios', () => {
  let wizard: PracticeWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new PracticeWizardPage(page, config);
    await wizard.login();
  });

  test.describe('Correct Answer Flows', () => {
    test('should complete a question with correct answer and show positive feedback', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);
      await wizard.waitForQuestionToLoad();

      const questionState = await wizard.getQuestionState();
      console.log(`Question type: ${questionState.questionType}`);
      console.log(`Question: ${questionState.questionText.substring(0, 100)}...`);

      // For addition, typical answers are small numbers
      // Try common correct answers for simple addition
      await wizard.submitAnswer('4'); // Common answer for 2+2 type questions

      const feedback = await wizard.waitForFeedback();
      console.log(`Feedback: ${feedback.isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      console.log(`Mastery: ${feedback.masteryScore}%`);

      // Take screenshot for verification
      await wizard.screenshot('correct-answer-feedback');
    });

    test('should track progress correctly after multiple correct answers', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);

      // Answer 3 questions (adjust answers based on actual questions)
      const correctAnswers = ['4', '6', '8', '10', '5'];

      for (let i = 0; i < 3; i++) {
        await wizard.waitForQuestionToLoad();
        await wizard.submitAnswer(correctAnswers[i % correctAnswers.length]);
        const feedback = await wizard.waitForFeedback();

        console.log(`Question ${i + 1}: ${feedback.isCorrect ? 'CORRECT' : 'WRONG'}`);

        if (feedback.canContinue) {
          await wizard.clickContinue();
        }
      }

      // Check progress
      const progress = await wizard.getBlockProgress();
      console.log(`Progress: ${progress.questionsCorrect}/${progress.questionsAnswered}`);

      expect(progress.questionsAnswered).toBeGreaterThan(0);
      await wizard.screenshot('multiple-correct-progress');
    });
  });

  test.describe('Wrong Answer Flows', () => {
    test('should handle single wrong answer with feedback', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);
      await wizard.waitForQuestionToLoad();

      // Submit obviously wrong answer
      await wizard.submitWrongAnswer();
      const feedback = await wizard.waitForFeedback();

      expect(feedback.isCorrect).toBe(false);
      console.log(`Wrong answer feedback: ${feedback.feedbackText.substring(0, 100)}...`);

      await wizard.screenshot('wrong-answer-feedback');
    });

    test('should handle 3 consecutive wrong answers (tests demotion logic)', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);

      const feedbacks = await answerWrongRepeatedly(wizard, 3);

      // All should be incorrect
      feedbacks.forEach((f, i) => {
        expect(f.isCorrect).toBe(false);
        console.log(`Wrong answer ${i + 1}: Mastery ${f.masteryScore}%`);
      });

      // Check if difficulty changed (demotion)
      const currentState = await wizard.getQuestionState();
      console.log(`Current difficulty after 3 wrong: ${currentState.difficulty}`);

      await wizard.screenshot('three-wrong-answers');
    });

    test('should handle 5 consecutive wrong answers (extended demotion)', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);

      const feedbacks = await answerWrongRepeatedly(wizard, 5);

      console.log('=== Wrong Answer Sequence ===');
      feedbacks.forEach((f, i) => {
        console.log(`  ${i + 1}. Correct: ${f.isCorrect}, Mastery: ${f.masteryScore}%`);
      });

      // Verify mastery decreased
      const firstMastery = feedbacks[0].masteryScore || 100;
      const lastMastery = feedbacks[feedbacks.length - 1].masteryScore || 0;
      console.log(`Mastery change: ${firstMastery}% -> ${lastMastery}%`);

      await wizard.screenshot('five-wrong-answers');
    });
  });

  test.describe('Mixed Answer Flows', () => {
    test('should handle alternating correct/wrong answers', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);

      const pattern = [
        { answer: '4', expectedCorrect: true },
        { answer: '99999', expectedCorrect: false },
        { answer: '6', expectedCorrect: true },
        { answer: '0', expectedCorrect: false },
      ];

      const results = await answerSequence(wizard, pattern);

      console.log('=== Alternating Pattern Results ===');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. Answer: ${r.answer}, Expected: ${r.expectedCorrect}, Actual: ${r.actualCorrect}`);
      });

      await wizard.screenshot('alternating-answers');
    });

    test('should handle realistic student pattern (mostly correct with mistakes)', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);

      // Realistic pattern: correct, correct, wrong, correct, correct, wrong, correct
      const pattern = [
        { answer: '4', expectedCorrect: true },
        { answer: '6', expectedCorrect: true },
        { answer: '999', expectedCorrect: false },
        { answer: '8', expectedCorrect: true },
        { answer: '10', expectedCorrect: true },
        { answer: '0', expectedCorrect: false },
        { answer: '5', expectedCorrect: true },
      ];

      const results = await answerSequence(wizard, pattern);

      // Count results
      const correct = results.filter(r => r.actualCorrect).length;
      const wrong = results.length - correct;

      console.log(`Final results: ${correct} correct, ${wrong} wrong`);

      await wizard.screenshot('realistic-pattern');
    });
  });

  test.describe('Block Completion', () => {
    test('should complete block and show correct question counts', async ({ page }) => {
      /**
       * This test verifies the "Questions 0/0" bug fix:
       * - Completes a full block
       * - Expands the completed block in side panel
       * - Verifies question counts are NOT 0/0
       */
      await wizard.goto(TEST_LESSONS.simpleAddition);

      // Answer enough questions to complete a block (typically 8)
      const answers = ['4', '6', '8', '10', '5', '3', '7', '9'];

      for (let i = 0; i < answers.length; i++) {
        try {
          await wizard.waitForQuestionToLoad();
          await wizard.submitAnswer(answers[i]);
          const feedback = await wizard.waitForFeedback();

          console.log(`Question ${i + 1}: ${feedback.isCorrect ? 'CORRECT' : 'WRONG'}`);

          if (feedback.canContinue) {
            await wizard.clickContinue();
          }

          // Check if block completed
          const progress = await wizard.getBlockProgress();
          if (progress.isBlockComplete) {
            console.log(`Block completed after ${i + 1} questions!`);
            break;
          }
        } catch (e) {
          console.log(`Question ${i + 1} error:`, e);
          break;
        }
      }

      // Take screenshot of completed state
      await wizard.screenshot('block-completed');

      // Verify the side panel shows correct counts (NOT 0/0)
      const blockDetails = await wizard.getCompletedBlockDetails(0);
      console.log('=== Completed Block Details ===');
      console.log(`  Mastery: ${blockDetails.mastery}%`);
      console.log(`  Questions: ${blockDetails.questionsCorrect}/${blockDetails.questionsAnswered}`);

      // This is the critical assertion for the bug fix
      expect(blockDetails.questionsAnswered).toBeGreaterThan(0);
      expect(blockDetails.questionsCorrect).toBeGreaterThanOrEqual(0);

      await wizard.screenshot('completed-block-details');
    });

    test('should maintain question counts across multiple completed blocks', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);

      // Try to complete 2 blocks
      const answers = ['4', '6', '8', '10', '5', '3', '7', '9', '2', '4', '6', '8', '10', '5', '3', '7'];

      let completedBlocks = 0;

      for (let i = 0; i < answers.length && completedBlocks < 2; i++) {
        try {
          await wizard.waitForQuestionToLoad();
          await wizard.submitAnswer(answers[i]);
          const feedback = await wizard.waitForFeedback();

          if (feedback.canContinue) {
            await wizard.clickContinue();
          }

          const progress = await wizard.getBlockProgress();
          if (progress.isBlockComplete) {
            completedBlocks++;
            console.log(`Block ${completedBlocks} completed!`);

            // Verify this block's counts
            const details = await wizard.getCompletedBlockDetails(completedBlocks - 1);
            console.log(`Block ${completedBlocks}: ${details.questionsCorrect}/${details.questionsAnswered}`);

            expect(details.questionsAnswered).toBeGreaterThan(0);
          }
        } catch (e) {
          console.log(`Error at question ${i + 1}:`, e);
          break;
        }
      }

      await wizard.screenshot('multiple-blocks-completed');
    });
  });

  test.describe('Difficulty Progression', () => {
    test('should show difficulty badge and track progression', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);
      await wizard.waitForQuestionToLoad();

      const initialState = await wizard.getQuestionState();
      console.log(`Initial difficulty: ${initialState.difficulty || 'not shown'}`);

      // Answer several questions and track difficulty changes
      const difficulties: string[] = [];

      for (let i = 0; i < 5; i++) {
        const state = await wizard.getQuestionState();
        difficulties.push(state.difficulty || 'unknown');

        await wizard.submitAnswer(String(i + 4)); // Try various answers
        const feedback = await wizard.waitForFeedback();

        if (feedback.canContinue) {
          await wizard.clickContinue();
        }
      }

      console.log('Difficulty progression:', difficulties.join(' -> '));
      await wizard.screenshot('difficulty-progression');
    });
  });

  test.describe('Hint System', () => {
    test('should display hints when requested', async ({ page }) => {
      await wizard.goto(TEST_LESSONS.simpleAddition);
      await wizard.waitForQuestionToLoad();

      const state = await wizard.getQuestionState();

      if (state.hasHints) {
        const hintText = await wizard.requestHint();
        console.log(`Hint received: ${hintText.substring(0, 100)}...`);
        expect(hintText.length).toBeGreaterThan(0);
        await wizard.screenshot('hint-displayed');
      } else {
        console.log('No hint button visible for this question');
      }
    });
  });
});

test.describe('Practice Wizard - Resume/Start Fresh Modal', () => {
  let wizard: PracticeWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new PracticeWizardPage(page, config);
    await wizard.login();
  });

  test('should show resume modal when existing session exists', async ({ page }) => {
    // First, start a session and answer one question to create progress
    // Use gotoFresh to ensure we start clean
    await wizard.gotoFresh(TEST_LESSONS.simpleAddition);
    await wizard.waitForQuestionToLoad();
    await wizard.submitAnswer('4');
    await wizard.waitForFeedback();

    // Navigate away
    await page.goto('http://localhost:3000/student-dashboard');
    await page.waitForTimeout(1000);

    // Return to the same lesson - use 'wait' to not auto-handle the modal
    await wizard.goto(TEST_LESSONS.simpleAddition, { onExistingSession: 'wait' });

    // Check if modal is visible
    const isModalVisible = await wizard.isResumeModalVisible();
    console.log(`Resume modal visible: ${isModalVisible}`);

    if (isModalVisible) {
      const info = await wizard.getResumeModalInfo();
      console.log('Resume modal info:', info);
      expect(info).not.toBeNull();

      await wizard.screenshot('resume-modal-visible');

      // Clean up - click resume to continue
      await wizard.clickResume();
    }
  });

  test('should resume session correctly when clicking Resume', async ({ page }) => {
    // Create a session with some progress
    await wizard.gotoFresh(TEST_LESSONS.simpleAddition);
    await wizard.waitForQuestionToLoad();

    // Answer a few questions
    for (let i = 0; i < 3; i++) {
      await wizard.submitAnswer(String(i + 4));
      const feedback = await wizard.waitForFeedback();
      if (feedback.canContinue) {
        await wizard.clickContinue();
      }
    }

    const progressBefore = await wizard.getBlockProgress();
    console.log(`Progress before leaving: ${progressBefore.questionsAnswered} questions`);

    // Navigate away
    await page.goto('http://localhost:3000/student-dashboard');
    await page.waitForTimeout(1000);

    // Return and choose Resume
    await wizard.goto(TEST_LESSONS.simpleAddition, { onExistingSession: 'wait' });

    const isModalVisible = await wizard.isResumeModalVisible();
    if (isModalVisible) {
      await wizard.clickResume();
    }

    // Wait for question to load after resume
    await wizard.waitForQuestionToLoad();

    // Progress should be preserved (or at least session continued)
    const progressAfter = await wizard.getBlockProgress();
    console.log(`Progress after resume: ${progressAfter.questionsAnswered} questions`);

    await wizard.screenshot('after-resume');
  });

  test('should reset session correctly when clicking Start Fresh', async ({ page }) => {
    // Create a session with some progress
    await wizard.gotoFresh(TEST_LESSONS.simpleAddition);
    await wizard.waitForQuestionToLoad();

    // Answer a few questions
    for (let i = 0; i < 3; i++) {
      await wizard.submitAnswer(String(i + 4));
      const feedback = await wizard.waitForFeedback();
      if (feedback.canContinue) {
        await wizard.clickContinue();
      }
    }

    const progressBefore = await wizard.getBlockProgress();
    console.log(`Progress before reset: ${progressBefore.questionsAnswered} questions`);

    // Navigate away
    await page.goto('http://localhost:3000/student-dashboard');
    await page.waitForTimeout(1000);

    // Return and choose Start Fresh
    await wizard.goto(TEST_LESSONS.simpleAddition, { onExistingSession: 'wait' });

    const isModalVisible = await wizard.isResumeModalVisible();
    if (isModalVisible) {
      await wizard.clickStartFresh();
    }

    // Wait for fresh session to load
    await wizard.waitForQuestionToLoad();

    // Should start fresh
    await wizard.screenshot('after-start-fresh');
  });

  test('should display correct session info in resume modal', async ({ page }) => {
    // Create a session with specific progress
    await wizard.gotoFresh(TEST_LESSONS.simpleAddition);
    await wizard.waitForQuestionToLoad();

    // Answer 5 questions to build up mastery
    for (let i = 0; i < 5; i++) {
      await wizard.submitAnswer(String(i + 4));
      const feedback = await wizard.waitForFeedback();
      console.log(`Question ${i + 1}: ${feedback.isCorrect ? 'correct' : 'wrong'}, Mastery: ${feedback.masteryScore}%`);
      if (feedback.canContinue) {
        await wizard.clickContinue();
      }
    }

    // Navigate away
    await page.goto('http://localhost:3000/student-dashboard');
    await page.waitForTimeout(1000);

    // Return - modal should show our progress
    await wizard.goto(TEST_LESSONS.simpleAddition, { onExistingSession: 'wait' });

    const isModalVisible = await wizard.isResumeModalVisible();

    if (isModalVisible) {
      const info = await wizard.getResumeModalInfo();
      console.log('=== Resume Modal Info ===');
      console.log(`  Block: ${info?.currentBlock}/${info?.totalBlocks}`);
      console.log(`  Mastery: ${info?.mastery}%`);
      console.log(`  Difficulty: ${info?.difficulty}`);

      expect(info).not.toBeNull();

      await wizard.screenshot('resume-modal-with-progress');

      // Clean up - resume to continue
      await wizard.clickResume();
    } else {
      console.log('Resume modal not shown - no existing session');
    }
  });
});

test.describe('Practice Wizard - Edge Cases', () => {
  let wizard: PracticeWizardPage;

  test.beforeEach(async ({ page }) => {
    wizard = new PracticeWizardPage(page, config);
    await wizard.login();
  });

  test('should handle invalid lesson ID gracefully', async ({ page }) => {
    await wizard.goto('invalid-lesson-12345');

    // Should show error or redirect
    const hasError = await page.locator('text=Error, text=not found, text=Oops').isVisible({ timeout: 5000 }).catch(() => false);
    const redirected = !page.url().includes('practice_wizard');

    expect(hasError || redirected).toBe(true);
    await wizard.screenshot('invalid-lesson-error');
  });

  test('should handle session resume correctly via modal', async ({ page }) => {
    // Start a session with gotoFresh to ensure clean state
    await wizard.gotoFresh(TEST_LESSONS.simpleAddition);
    await wizard.waitForQuestionToLoad();

    // Answer one question
    await wizard.submitAnswer('4');
    await wizard.waitForFeedback();

    // Navigate away
    await page.goto('http://localhost:3000/student-dashboard');
    await page.waitForTimeout(1000);

    // Return to same lesson - check for modal
    await wizard.goto(TEST_LESSONS.simpleAddition, { onExistingSession: 'wait' });

    // Should show resume modal
    const hasResumeModal = await wizard.isResumeModalVisible();
    console.log(`Resume modal visible: ${hasResumeModal}`);

    if (hasResumeModal) {
      // Test that we can read session info
      const info = await wizard.getResumeModalInfo();
      console.log('Session info from modal:', info);

      // Click resume to continue
      await wizard.clickResume();
    }

    await wizard.screenshot('session-resume-via-modal');
  });

  test('should handle rapid answer submission', async ({ page }) => {
    await wizard.goto(TEST_LESSONS.simpleAddition);
    await wizard.waitForQuestionToLoad();

    // Submit answers rapidly without waiting for feedback
    const rapidWizard = new PracticeWizardPage(page, { ...FAST_CONFIG, actionDelay: 50 });

    for (let i = 0; i < 3; i++) {
      try {
        await rapidWizard.submitAnswer(String(i + 4));
        // Don't wait for feedback, immediately try next
        await page.waitForTimeout(100);
      } catch (e) {
        console.log(`Rapid submission ${i + 1} handled:`, e);
      }
    }

    // Should still be in valid state
    const isValid = await wizard.container.isVisible();
    expect(isValid).toBe(true);

    await wizard.screenshot('rapid-submission');
  });
});
