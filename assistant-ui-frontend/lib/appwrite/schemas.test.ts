/**
 * Comprehensive schema validation tests for lesson templates, cards, and CFU types
 * Phase 5: Validation & Testing - Tests all Zod schemas created in Phase 1-2
 * Tests include edge cases, integration scenarios, and backward compatibility checks
 */

import { describe, it, expect } from 'vitest';
import {
  RubricCriterionSchema,
  RubricSchema,
  MisconceptionSchema,
  HintArraySchema,
  MCQCFUSchema,
  NumericCFUSchema,
  StructuredResponseCFUSchema,
  ShortTextCFUSchema,
  CFUSchema,
  LessonCardSchema,
  LessonPolicySchema,
  LessonTemplateSchema,
} from './schemas';

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 5: COMPREHENSIVE SCHEMA VALIDATION TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('RubricCriterion Schema', () => {
  it('should validate a valid rubric criterion', () => {
    const data = {
      description: 'Correct calculation method used',
      points: 2,
    };
    const result = RubricCriterionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing description', () => {
    const data = { points: 2 };
    const result = RubricCriterionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject negative points', () => {
    const data = {
      description: 'Correct calculation method used',
      points: -1,
    };
    const result = RubricCriterionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should accept zero points', () => {
    const data = {
      description: 'No attempt made',
      points: 0,
    };
    const result = RubricCriterionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept decimal points', () => {
    const data = {
      description: 'Partial credit',
      points: 1.5,
    };
    const result = RubricCriterionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('Rubric Schema', () => {
  it('should validate a complete rubric', () => {
    const data = {
      total_points: 5,
      criteria: [
        { description: 'Correct answer', points: 3 },
        { description: 'Shows working', points: 2 },
      ],
    };
    const result = RubricSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate a simple rubric', () => {
    const data = {
      total_points: 1,
      criteria: [
        { description: 'Correct or incorrect', points: 1 },
      ],
    };
    const result = RubricSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject rubric with zero total_points', () => {
    const data = {
      total_points: 0,
      criteria: [{ description: 'Any criterion', points: 1 }],
    };
    const result = RubricSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject empty criteria array', () => {
    const data = {
      total_points: 5,
      criteria: [],
    };
    const result = RubricSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject criteria points exceeding total_points', () => {
    const data = {
      total_points: 5,
      criteria: [
        { description: 'Criterion 1', points: 3 },
        { description: 'Criterion 2', points: 4 },
      ],
    };
    const result = RubricSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should accept criteria points equal to total_points', () => {
    const data = {
      total_points: 5,
      criteria: [
        { description: 'Criterion 1', points: 3 },
        { description: 'Criterion 2', points: 2 },
      ],
    };
    const result = RubricSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('Misconception Schema', () => {
  it('should validate a valid misconception with proper ID format', () => {
    const data = {
      id: 'MISC_MATHEMATICS_FRACTIONS_001',
      misconception: 'When adding fractions, add numerators and denominators',
      clarification: 'Fractions must have common denominators before adding',
    };
    const result = MisconceptionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate misconception with different subject', () => {
    const data = {
      id: 'MISC_PHYSICS_VELOCITY_042',
      misconception: 'Velocity and speed are the same thing',
      clarification: 'Velocity is a vector (has direction), speed is scalar',
    };
    const result = MisconceptionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject misconception with invalid ID format (no underscores)', () => {
    const data = {
      id: 'MISCMATHEMATICSFRACTIONS001',
      misconception: 'Invalid ID format',
      clarification: 'This should fail',
    };
    const result = MisconceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject misconception with invalid ID format (only 2 underscores)', () => {
    const data = {
      id: 'MISC_MATHEMATICS_001',
      misconception: 'Missing topic part',
      clarification: 'This should fail',
    };
    const result = MisconceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject misconception with non-numeric ID suffix', () => {
    const data = {
      id: 'MISC_MATHEMATICS_FRACTIONS_ABC',
      misconception: 'Non-numeric suffix',
      clarification: 'This should fail',
    };
    const result = MisconceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject misconception missing misconception text', () => {
    const data = {
      id: 'MISC_MATHEMATICS_FRACTIONS_001',
      clarification: 'Missing misconception field',
    };
    const result = MisconceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('HintArray Schema', () => {
  it('should validate with 3 hints', () => {
    const data = ['Start by identifying the units', 'Consider the formula for this type of problem', 'What is the final calculation?'];
    const result = HintArraySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate with 5 hints', () => {
    const data = [
      'Read the question carefully',
      'Underline the key information',
      'What operation should you use?',
      'Set up the calculation',
      'Double-check your answer',
    ];
    const result = HintArraySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject with fewer than 3 hints', () => {
    const data = ['First hint', 'Second hint'];
    const result = HintArraySchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject with more than 5 hints', () => {
    const data = [
      'Hint 1',
      'Hint 2',
      'Hint 3',
      'Hint 4',
      'Hint 5',
      'Hint 6',
    ];
    const result = HintArraySchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject empty hint strings', () => {
    const data = ['Good hint', '', 'Another hint'];
    const result = HintArraySchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('MCQ CFU Schema', () => {
  it('should validate a valid MCQ with 3 options', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_MCQ_001',
      stem: 'What is 2 + 2?',
      options: ['3', '4', '5'],
      answerIndex: 1,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct answer', points: 1 }],
      },
    };
    const result = MCQCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate MCQ with 5 options', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_MCQ_002',
      stem: 'Which is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid', 'Rome'],
      answerIndex: 2,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = MCQCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject MCQ with fewer than 3 options', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_MCQ_003',
      stem: 'Question?',
      options: ['A', 'B'],
      answerIndex: 0,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = MCQCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject MCQ with more than 5 options', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_MCQ_004',
      stem: 'Question?',
      options: ['A', 'B', 'C', 'D', 'E', 'F'],
      answerIndex: 0,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = MCQCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject MCQ with invalid answerIndex', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_MCQ_005',
      stem: 'Question?',
      options: ['A', 'B', 'C'],
      answerIndex: 5,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = MCQCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject MCQ with negative answerIndex', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_MCQ_006',
      stem: 'Question?',
      options: ['A', 'B', 'C'],
      answerIndex: -1,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = MCQCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('Numeric CFU Schema', () => {
  it('should validate a valid numeric CFU', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_001',
      stem: 'What is 15% of 80?',
      expected: 12,
      tolerance: 0.5,
      rubric: {
        total_points: 2,
        criteria: [{ description: 'Correct answer', points: 2 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate numeric CFU with money2dp flag', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_002',
      stem: 'Calculate the total cost in pounds and pence',
      expected: 25.50,
      tolerance: 0.01,
      money2dp: true,
      rubric: {
        total_points: 3,
        criteria: [{ description: 'Correct to 2 decimal places', points: 3 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate numeric CFU with hints', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_003',
      stem: 'Calculate the area',
      expected: 50,
      tolerance: 1,
      hints: [
        'Use the formula A = length × width',
        'Measure both dimensions carefully',
        'Multiply the two measurements',
        'Check your units',
        'Review your calculation',
      ],
      rubric: {
        total_points: 2,
        criteria: [{ description: 'Correct area', points: 2 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject numeric CFU with negative expected value when money2dp is true', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_004',
      stem: 'Calculate cost',
      expected: -10,
      tolerance: 0.01,
      money2dp: true,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should accept negative expected value when money2dp is false', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_005',
      stem: 'What is the change in temperature?',
      expected: -5,
      tolerance: 0.5,
      rubric: {
        total_points: 2,
        criteria: [{ description: 'Correct', points: 2 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject numeric CFU with negative tolerance', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_006',
      stem: 'Question?',
      expected: 10,
      tolerance: -0.5,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should validate numeric CFU without optional hints', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_NUMERIC_007',
      stem: 'Simple calculation',
      expected: 42,
      tolerance: 1,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = NumericCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('StructuredResponse CFU Schema', () => {
  it('should validate a valid structured response CFU', () => {
    const data = {
      type: 'structured_response',
      id: 'CFU_STRUCT_001',
      stem: 'Part a) Calculate the area\nPart b) Explain your method\nPart c) State the units',
      rubric: {
        total_points: 6,
        criteria: [
          { description: 'Correct calculation', points: 2 },
          { description: 'Clear explanation', points: 2 },
          { description: 'Correct units', points: 2 },
        ],
      },
    };
    const result = StructuredResponseCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate structured response with long stem', () => {
    const longStem = 'A'.repeat(800);
    const data = {
      type: 'structured_response',
      id: 'CFU_STRUCT_002',
      stem: longStem,
      rubric: {
        total_points: 5,
        criteria: [{ description: 'Attempt made', points: 5 }],
      },
    };
    const result = StructuredResponseCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject structured response with stem exceeding 800 characters', () => {
    const tooLongStem = 'A'.repeat(801);
    const data = {
      type: 'structured_response',
      id: 'CFU_STRUCT_003',
      stem: tooLongStem,
      rubric: {
        total_points: 5,
        criteria: [{ description: 'Attempt made', points: 5 }],
      },
    };
    const result = StructuredResponseCFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('ShortText CFU Schema', () => {
  it('should validate a valid short text CFU', () => {
    const data = {
      type: 'short_text',
      id: 'CFU_SHORT_001',
      stem: 'What is the capital of Scotland?',
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct answer', points: 1 }],
      },
    };
    const result = ShortTextCFUSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('CFU Discriminated Union Schema', () => {
  it('should correctly parse MCQ from CFU union', () => {
    const data = {
      type: 'mcq',
      id: 'CFU_001',
      stem: 'Question?',
      options: ['A', 'B', 'C'],
      answerIndex: 1,
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = CFUSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('mcq');
    }
  });

  it('should correctly parse Numeric from CFU union', () => {
    const data = {
      type: 'numeric',
      id: 'CFU_002',
      stem: 'Calculate?',
      expected: 42,
      tolerance: 1,
      rubric: {
        total_points: 2,
        criteria: [{ description: 'Correct', points: 2 }],
      },
    };
    const result = CFUSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('numeric');
    }
  });

  it('should correctly parse StructuredResponse from CFU union', () => {
    const data = {
      type: 'structured_response',
      id: 'CFU_003',
      stem: 'Multi-part\nPart a)\nPart b)',
      rubric: {
        total_points: 4,
        criteria: [{ description: 'Correct', points: 4 }],
      },
    };
    const result = CFUSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('structured_response');
    }
  });

  it('should correctly parse ShortText from CFU union', () => {
    const data = {
      type: 'short_text',
      id: 'CFU_004',
      stem: 'Short answer?',
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Attempted', points: 1 }],
      },
    };
    const result = CFUSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('short_text');
    }
  });

  it('should reject invalid CFU type', () => {
    const data = {
      type: 'invalid_type',
      id: 'CFU_005',
      stem: 'Question?',
      rubric: {
        total_points: 1,
        criteria: [{ description: 'Correct', points: 1 }],
      },
    };
    const result = CFUSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('LessonCard Schema', () => {
  it('should validate a complete lesson card with MCQ', () => {
    const data = {
      id: 'CARD_001',
      title: 'Introduction to Fractions',
      explainer: 'Fractions represent **parts of a whole**.',
      explainer_plain: 'A fraction has two numbers.',
      cfu: {
        type: 'mcq',
        id: 'CFU_MCQ_001',
        stem: 'What is 1/2 of 4?',
        options: ['1', '2', '3'],
        answerIndex: 1,
        rubric: {
          total_points: 1,
          criteria: [{ description: 'Correct', points: 1 }],
        },
      },
      misconceptions: [],
    };
    const result = LessonCardSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject lesson card without cfu', () => {
    const data = {
      id: 'CARD_004',
      title: 'Missing CFU',
      explainer: 'Test content',
      explainer_plain: 'Test plain',
      misconceptions: [],
    };
    const result = LessonCardSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('LessonPolicy Schema', () => {
  it('should validate policy with calculator allowed', () => {
    const data = {
      calculator_allowed: true,
      assessment_notes: 'Any scientific calculator permitted',
    };
    const result = LessonPolicySchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('LessonTemplate Schema', () => {
  it('should validate a complete lesson template', () => {
    const data = {
      $id: 'template_001',
      $createdAt: '2024-01-01T00:00:00.000Z',
      $updatedAt: '2024-01-02T00:00:00.000Z',
      templateId: 'TEMPLATE_MATH_FRAC_001',
      title: 'Introduction to Fractions',
      courseId: 'course_001',
      outcomeRefs: JSON.stringify(['OUTCOME_001']),
      cards: JSON.stringify([
        {
          id: 'CARD_001',
          title: 'Fractions',
          explainer: 'Content',
          explainer_plain: 'Plain',
          cfu: {
            type: 'mcq',
            id: 'CFU_001',
            stem: 'Q?',
            options: ['A', 'B', 'C'],
            answerIndex: 1,
            rubric: { total_points: 1, criteria: [{ description: 'C', points: 1 }] },
          },
          misconceptions: [],
        },
      ]),
      version: 1,
      sow_order: 1,
      status: 'published',
      createdBy: 'author_001',
      estMinutes: 30,
      lesson_type: 'teach',
      engagement_tags: JSON.stringify(['prior-knowledge']),
      policy: JSON.stringify({ calculator_allowed: false }),
    };
    const result = LessonTemplateSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate all lesson_type values', () => {
    const lessonTypes = ['teach', 'independent_practice', 'formative_assessment', 'revision', 'mock_exam'];
    for (const lessonType of lessonTypes) {
      const data = {
        $id: 'template_' + lessonType,
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        templateId: 'TEMPLATE_' + lessonType,
        title: 'Lesson',
        courseId: 'course_001',
        outcomeRefs: '[]',
        cards: '[]',
        version: 1,
        sow_order: 1,
        status: 'published',
        createdBy: 'author_001',
        estMinutes: 30,
        lesson_type: lessonType,
        engagement_tags: '[]',
        policy: '{}',
      };
      const result = LessonTemplateSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });

  it('should validate lesson template with model versioning fields', () => {
    const data = {
      $id: 'template_004',
      $createdAt: '2024-01-01T00:00:00.000Z',
      $updatedAt: '2024-01-01T00:00:00.000Z',
      templateId: 'TEMPLATE_MODEL_001',
      title: 'AI Generated Lesson',
      courseId: 'course_001',
      outcomeRefs: '[]',
      cards: '[]',
      version: 1,
      sow_order: 5,
      status: 'published',
      createdBy: 'agent_sow_author',
      estMinutes: 45,
      lesson_type: 'teach',
      engagement_tags: '[]',
      policy: '{}',
      authored_sow_id: 'SOW_001',
      authored_sow_version: '1.0.0',
      model_version: 'claude-3-sonnet-20240229',
    };
    const result = LessonTemplateSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('Integration Tests - Agent Mock Data', () => {
  it('should validate a complete lesson template generated by SOW agent', () => {
    const agentGeneratedTemplate = {
      $id: 'template_agent_001',
      $createdAt: '2024-01-01T00:00:00.000Z',
      $updatedAt: '2024-01-01T00:00:00.000Z',
      templateId: 'TEMPLATE_FRACTIONS_INTRO',
      title: 'Introduction to Fractions - Unit 1',
      courseId: 'MATH_NATIONAL_4',
      outcomeRefs: JSON.stringify(['OUTCOME_NUM_REC_1', 'OUTCOME_NUM_REC_2']),
      cards: JSON.stringify([
        {
          id: 'CARD_FRAC_INTRO_001',
          title: 'What are Fractions?',
          explainer: 'A **fraction** represents a part of a whole.',
          explainer_plain: 'A fraction has two parts.',
          cfu: {
            type: 'mcq',
            id: 'CFU_FRAC_001',
            stem: 'In the fraction 3/5, which number is the numerator?',
            options: ['3', '5', 'Both', 'Neither'],
            answerIndex: 0,
            rubric: { total_points: 1, criteria: [{ description: 'Correct', points: 1 }] },
          },
          misconceptions: [
            {
              id: 'MISC_MATHEMATICS_FRACTIONS_001',
              misconception: 'The denominator tells you how big the fraction is',
              clarification: 'The denominator tells you how many equal parts the whole is divided into',
            },
          ],
          context_hooks: ['Understanding of division'],
        },
      ]),
      version: 1,
      sow_order: 1,
      status: 'published',
      createdBy: 'sow_author_agent',
      estMinutes: 30,
      lesson_type: 'teach',
      engagement_tags: JSON.stringify(['visual-learning', 'prior-knowledge']),
      policy: JSON.stringify({ calculator_allowed: false, assessment_notes: 'Mental arithmetic practice' }),
      authored_sow_id: 'SOW_MATH_NAT4_001',
      authored_sow_version: '1.0.0',
      model_version: 'claude-3-sonnet-20240229',
    };
    const result = LessonTemplateSchema.safeParse(agentGeneratedTemplate);
    expect(result.success).toBe(true);
  });
});

describe('Backward Compatibility Tests', () => {
  it('should validate old lesson template format with minimal fields', () => {
    const oldTemplate = {
      $id: 'template_old_001',
      $createdAt: '2024-01-01T00:00:00.000Z',
      $updatedAt: '2024-01-01T00:00:00.000Z',
      templateId: 'TEMPLATE_OLD_001',
      title: 'Old Format Lesson',
      courseId: 'course_001',
      outcomeRefs: '[]',
      cards: '[]',
      version: 1,
      sow_order: 0,
      status: 'published',
      createdBy: 'author_001',
      estMinutes: 45,
      lesson_type: 'teach',
      engagement_tags: '[]',
      policy: '{}',
    };
    const result = LessonTemplateSchema.safeParse(oldTemplate);
    expect(result.success).toBe(true);
  });

  it('should validate MCQ card with all new fields', () => {
    const modernCard = {
      id: 'CARD_MODERN_001',
      title: 'Modern Card',
      explainer: '**Content**',
      explainer_plain: 'Content',
      cfu: {
        type: 'mcq',
        id: 'CFU_001',
        stem: 'Question?',
        options: ['A', 'B', 'C', 'D'],
        answerIndex: 2,
        rubric: {
          total_points: 2,
          criteria: [
            { description: 'Correct answer', points: 1 },
            { description: 'Valid reasoning', points: 1 },
          ],
        },
      },
      misconceptions: [
        {
          id: 'MISC_MATHEMATICS_CONCEPT_001',
          misconception: 'Common error',
          clarification: 'Correct understanding',
        },
      ],
      context_hooks: ['Prior knowledge', 'Visual learning'],
    };
    const result = LessonCardSchema.safeParse(modernCard);
    expect(result.success).toBe(true);
  });
});
