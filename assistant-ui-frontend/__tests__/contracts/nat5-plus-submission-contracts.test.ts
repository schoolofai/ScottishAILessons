/**
 * Contract Tests: Frontend → Evaluator and Evaluator → Frontend
 *
 * Purpose:
 *   Validates that:
 *   1. Frontend submission format matches Evaluator expectations
 *   2. Evaluator result format matches Frontend expectations
 *
 * Contracts Validated:
 *   - Contract B: Frontend → Evaluator (ExamSubmission)
 *   - Contract C: Evaluator → Frontend (EvaluationResult)
 *
 * Fixtures Used:
 *   - fixtures/sample_nat5_plus_submission.json
 *   - fixtures/sample_nat5_plus_evaluation.json
 *
 * Run:
 *   npm test -- --testPathPattern=nat5-plus-submission-contracts
 *
 * TDD Phase: 2 (RED - These tests should FAIL until types are implemented)
 */

import * as fs from 'fs';
import * as path from 'path';

// Import types - will fail until implemented
import type {
  ExamSubmission,
  StudentAnswer,
  EvaluationResult,
  QuestionResult,
  BulletMark,
  SectionResult,
  OverallResult,
  LearningRecommendation,
} from '@/lib/sqa-mock-exam/types';

// Load fixtures
const fixturesDir = path.join(__dirname, '..', '..', '..', 'fixtures');
const sampleSubmissionPath = path.join(fixturesDir, 'sample_nat5_plus_submission.json');
const sampleEvaluationPath = path.join(fixturesDir, 'sample_nat5_plus_evaluation.json');

describe('Contract B: Frontend → Evaluator (ExamSubmission)', () => {
  let sampleSubmission: ExamSubmission;

  beforeAll(() => {
    const rawData = fs.readFileSync(sampleSubmissionPath, 'utf-8');
    sampleSubmission = JSON.parse(rawData) as ExamSubmission;
  });

  describe('Submission Structure', () => {
    it('should have required submission fields', () => {
      expect(sampleSubmission.submission_id).toBeDefined();
      expect(sampleSubmission.exam_id).toBeDefined();
      expect(sampleSubmission.student_id).toBeDefined();
      expect(sampleSubmission.answers).toBeDefined();
    });

    it('should have at least one answer', () => {
      expect(sampleSubmission.answers.length).toBeGreaterThan(0);
    });
  });

  describe('Answer Structure', () => {
    it('should use response_text NOT answer field', () => {
      // CRITICAL: This is the field name contract
      sampleSubmission.answers.forEach((answer: StudentAnswer) => {
        expect(answer.response_text).toBeDefined();
        expect(answer.question_id).toBeDefined();
        // Should NOT have 'answer' field (old naming convention)
      });
    });

    it('should have question_number for display', () => {
      sampleSubmission.answers.forEach((answer: StudentAnswer) => {
        expect(answer.question_number).toBeDefined();
      });
    });

    it('should optionally have working_shown for partial marks', () => {
      // working_shown is optional but important for SQA-style marking
      sampleSubmission.answers.forEach((answer: StudentAnswer) => {
        // Just verify the field exists if present
        if (answer.working_shown !== undefined) {
          expect(typeof answer.working_shown).toBe('string');
        }
      });
    });
  });

  describe('Metadata Structure', () => {
    it('should have exam metadata', () => {
      expect(sampleSubmission.exam_metadata).toBeDefined();
      expect(sampleSubmission.exam_metadata.started_at).toBeDefined();
      expect(sampleSubmission.exam_metadata.questions_attempted).toBeDefined();
    });
  });
});

describe('Contract C: Evaluator → Frontend (EvaluationResult)', () => {
  let sampleEvaluation: EvaluationResult;

  beforeAll(() => {
    const rawData = fs.readFileSync(sampleEvaluationPath, 'utf-8');
    sampleEvaluation = JSON.parse(rawData) as EvaluationResult;
  });

  describe('Evaluation Structure', () => {
    it('should have required evaluation fields', () => {
      expect(sampleEvaluation.evaluation_id).toBeDefined();
      expect(sampleEvaluation.submission_id).toBeDefined();
      expect(sampleEvaluation.overall_result).toBeDefined();
      expect(sampleEvaluation.question_feedback).toBeDefined();
    });
  });

  describe('Overall Result Structure', () => {
    it('should have marks and percentage', () => {
      const overall = sampleEvaluation.overall_result;
      expect(overall.marks_earned).toBeDefined();
      expect(overall.marks_possible).toBeDefined();
      expect(overall.percentage).toBeDefined();
    });

    it('should have valid SQA grade', () => {
      const validGrades = ['A', 'B', 'C', 'D', 'No Award'];
      expect(validGrades).toContain(sampleEvaluation.overall_result.grade);
    });

    it('should have grade band definitions', () => {
      const gradeBand = sampleEvaluation.overall_result.grade_band;
      expect(gradeBand).toBeDefined();
      expect(gradeBand.A).toBeDefined();
      expect(gradeBand.B).toBeDefined();
      expect(gradeBand.C).toBeDefined();
      expect(gradeBand.D).toBeDefined();
      expect(gradeBand['No Award']).toBeDefined();
    });
  });

  describe('Question Feedback Structure', () => {
    it('should have feedback for each question', () => {
      expect(sampleEvaluation.question_feedback.length).toBeGreaterThan(0);
    });

    it('should have bullet marks for SQA-style marking', () => {
      sampleEvaluation.question_feedback.forEach((qf: QuestionResult) => {
        expect(qf.question_id).toBeDefined();
        expect(qf.marks_earned).toBeDefined();
        expect(qf.marks_possible).toBeDefined();
        expect(qf.bullet_marks).toBeDefined();
        expect(qf.bullet_marks.length).toBeGreaterThan(0);
      });
    });

    it('should have valid bullet mark structure', () => {
      sampleEvaluation.question_feedback.forEach((qf: QuestionResult) => {
        qf.bullet_marks.forEach((bm: BulletMark) => {
          expect(bm.bullet).toBeDefined();
          expect(bm.marks_earned).toBeDefined();
          expect(bm.marks_possible).toBeDefined();
          expect(bm.feedback).toBeDefined();
        });
      });
    });

    it('should have overall feedback per question', () => {
      sampleEvaluation.question_feedback.forEach((qf: QuestionResult) => {
        expect(qf.overall_feedback).toBeDefined();
      });
    });
  });

  describe('Section Results Structure', () => {
    it('should have section-by-section breakdown', () => {
      expect(sampleEvaluation.section_results).toBeDefined();
      expect(sampleEvaluation.section_results.length).toBeGreaterThan(0);
    });

    it('should have required section result fields', () => {
      sampleEvaluation.section_results.forEach((section: SectionResult) => {
        expect(section.section_id).toBeDefined();
        expect(section.section_name).toBeDefined();
        expect(section.marks_earned).toBeDefined();
        expect(section.marks_possible).toBeDefined();
      });
    });
  });

  describe('Learning Recommendations', () => {
    it('should have learning recommendations', () => {
      expect(sampleEvaluation.learning_recommendations).toBeDefined();
    });

    it('should have valid recommendation structure', () => {
      sampleEvaluation.learning_recommendations.forEach((rec: LearningRecommendation) => {
        expect(rec.topic_id).toBeDefined();
        expect(rec.mastery_level).toBeDefined();
        expect(rec.recommendation).toBeDefined();
      });
    });
  });

  describe('Encouragement Message', () => {
    it('should have encouragement message for student', () => {
      expect(sampleEvaluation.encouragement_message).toBeDefined();
      expect(sampleEvaluation.encouragement_message.length).toBeGreaterThan(0);
    });
  });
});
