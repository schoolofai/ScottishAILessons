/**
 * Contract Tests: Author → Frontend
 *
 * Purpose:
 *   Validates that the Frontend can correctly parse Author Agent output.
 *   These tests ensure TypeScript types match Python Pydantic models.
 *
 * Contract Validated:
 *   - Contract A: Author → Frontend (Exam Data)
 *
 * Fixtures Used:
 *   - fixtures/sample_nat5_plus_exam.json
 *
 * Run:
 *   npm test -- --testPathPattern=nat5-plus-exam-contracts
 *
 * TDD Phase: 2 (RED - These tests should FAIL until types are implemented)
 */

import * as fs from 'fs';
import * as path from 'path';

// Import types - will fail until implemented
import type {
  Nat5PlusMockExam,
  ExamSection,
  Nat5PlusQuestion,
  MarkingScheme,
  MarkingBullet,
  IllustrativeAnswer,
  ExamMetadata,
} from '@/lib/sqa-mock-exam/types';

// Load fixture
const fixturesDir = path.join(__dirname, '..', '..', '..', 'fixtures');
const sampleExamPath = path.join(fixturesDir, 'sample_nat5_plus_exam.json');

describe('Contract A: Author → Frontend (Exam Data)', () => {
  let sampleExam: Nat5PlusMockExam;

  beforeAll(() => {
    const rawData = fs.readFileSync(sampleExamPath, 'utf-8');
    sampleExam = JSON.parse(rawData) as Nat5PlusMockExam;
  });

  describe('Exam Structure', () => {
    it('should have required exam fields', () => {
      expect(sampleExam.exam_id).toBeDefined();
      expect(sampleExam.course_id).toBeDefined();
      expect(sampleExam.subject).toBeDefined();
      expect(sampleExam.level).toBeDefined();
      expect(sampleExam.status).toBeDefined();
    });

    it('should have valid status enum value', () => {
      const validStatuses = ['draft', 'published', 'archived'];
      expect(validStatuses).toContain(sampleExam.status);
    });

    it('should have metadata with required fields', () => {
      expect(sampleExam.metadata).toBeDefined();
      expect(sampleExam.metadata.total_marks).toBeGreaterThan(0);
      expect(sampleExam.metadata.duration_minutes).toBeGreaterThan(0);
      expect(typeof sampleExam.metadata.calculator_allowed).toBe('boolean');
    });
  });

  describe('Section Structure', () => {
    it('should have at least one section', () => {
      expect(sampleExam.sections).toBeDefined();
      expect(sampleExam.sections.length).toBeGreaterThan(0);
    });

    it('should have required section fields', () => {
      sampleExam.sections.forEach((section: ExamSection) => {
        expect(section.section_id).toBeDefined();
        expect(section.section_name).toBeDefined();
        expect(section.total_marks).toBeGreaterThan(0);
        expect(section.questions).toBeDefined();
        expect(section.questions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Question Structure', () => {
    it('should have required question fields', () => {
      sampleExam.sections.forEach((section: ExamSection) => {
        section.questions.forEach((question: Nat5PlusQuestion) => {
          // CRITICAL: These field names must match Python output
          expect(question.question_id).toBeDefined();
          expect(question.question_number).toBeDefined();
          expect(question.stem).toBeDefined();
          expect(question.stem_latex).toBeDefined();
          expect(question.marks).toBeGreaterThan(0);
          expect(question.difficulty).toBeDefined();
          expect(question.marking_scheme).toBeDefined();
        });
      });
    });

    it('should have valid difficulty enum values', () => {
      const validDifficulties = ['easy', 'medium', 'hard'];

      sampleExam.sections.forEach((section: ExamSection) => {
        section.questions.forEach((question: Nat5PlusQuestion) => {
          expect(validDifficulties).toContain(question.difficulty);
        });
      });
    });
  });

  describe('Marking Scheme Structure', () => {
    it('should have required marking scheme fields', () => {
      sampleExam.sections.forEach((section: ExamSection) => {
        section.questions.forEach((question: Nat5PlusQuestion) => {
          const scheme = question.marking_scheme;

          // CRITICAL: SQA-style marking requires both schemes
          expect(scheme.max_marks).toBeGreaterThan(0);
          expect(scheme.generic_scheme).toBeDefined();
          expect(scheme.generic_scheme.length).toBeGreaterThan(0);
          expect(scheme.illustrative_scheme).toBeDefined();
          expect(scheme.illustrative_scheme.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have valid generic scheme bullets', () => {
      sampleExam.sections.forEach((section: ExamSection) => {
        section.questions.forEach((question: Nat5PlusQuestion) => {
          question.marking_scheme.generic_scheme.forEach((bullet: MarkingBullet) => {
            expect(bullet.bullet).toBeDefined();
            expect(typeof bullet.bullet).toBe('number');
            expect(bullet.process).toBeDefined();
            expect(bullet.marks).toBeDefined();
            expect(bullet.marks).toBeGreaterThan(0);
          });
        });
      });
    });

    it('should have valid illustrative scheme answers', () => {
      sampleExam.sections.forEach((section: ExamSection) => {
        section.questions.forEach((question: Nat5PlusQuestion) => {
          question.marking_scheme.illustrative_scheme.forEach((bullet: IllustrativeAnswer) => {
            expect(bullet.bullet).toBeDefined();
            expect(typeof bullet.bullet).toBe('number');
            expect(bullet.answer).toBeDefined();
            // answer_latex is optional but should exist if present
            // tolerance_range is optional
            // acceptable_variations is optional
          });
        });
      });
    });

    it('should have bullet marks summing to max_marks', () => {
      sampleExam.sections.forEach((section: ExamSection) => {
        section.questions.forEach((question: Nat5PlusQuestion) => {
          const scheme = question.marking_scheme;
          const totalBulletMarks = scheme.generic_scheme.reduce(
            (sum: number, bullet: MarkingBullet) => sum + bullet.marks,
            0
          );
          expect(totalBulletMarks).toBe(scheme.max_marks);
        });
      });
    });
  });

  describe('Topic and Template Tracking', () => {
    it('should have topic coverage array', () => {
      expect(sampleExam.topic_coverage).toBeDefined();
      expect(Array.isArray(sampleExam.topic_coverage)).toBe(true);
    });

    it('should have template sources for uniqueness tracking', () => {
      expect(sampleExam.template_sources).toBeDefined();
      expect(Array.isArray(sampleExam.template_sources)).toBe(true);
    });

    it('should have difficulty distribution', () => {
      expect(sampleExam.difficulty_distribution).toBeDefined();
      // Should have easy, medium, hard keys
      expect(sampleExam.difficulty_distribution.easy).toBeDefined();
      expect(sampleExam.difficulty_distribution.medium).toBeDefined();
      expect(sampleExam.difficulty_distribution.hard).toBeDefined();
    });
  });
});
