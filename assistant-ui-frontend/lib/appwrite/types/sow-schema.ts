/**
 * TypeScript types matching the Pydantic SOW schema.
 *
 * Source: claud_author_agent/src/tools/sow_schema_models.py
 *
 * These types provide comprehensive validation for SOW editing in the admin panel.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════

export type CardType =
  | 'starter'
  | 'explainer'
  | 'modelling'
  | 'guided_practice'
  | 'independent_practice'
  | 'exit_ticket';

export type LessonType =
  | 'teach'
  | 'independent_practice'
  | 'formative_assessment'
  | 'revision'
  | 'mock_exam';

export type CalculatorSection =
  | 'non_calc'
  | 'mixed'
  | 'calc'
  | 'exam_conditions';

export type CEFRLevel =
  | 'CEFR_A1'
  | 'CEFR_A2'
  | 'CEFR_B1'
  | 'CEFR_B2';

export type SOWStatus = 'draft' | 'published' | 'archived';

// ═══════════════════════════════════════════════════════════════════════════
// Reference Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified reference supporting both unit-based and skills-based course structures.
 *
 * - Unit-based (National 1-4): Uses code, description, outcome
 * - Skills-based (National 5+): Uses skill_name, description
 */
export interface StandardOrSkillRef {
  // Unit-based fields (Optional for skills-based)
  code?: string;
  outcome?: string;

  // Skills-based fields (Optional for unit-based)
  skill_name?: string;

  // Common field (REQUIRED for both)
  description: string;
}

/**
 * Common student misconception and its remediation strategy.
 */
export interface MisconceptionAddressed {
  misconception: string;
  remediation: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Rubric Types
// ═══════════════════════════════════════════════════════════════════════════

export interface RubricCriterion {
  description: string;
  points: number;
}

export interface RubricGuidance {
  total_points: number;
  criteria: RubricCriterion[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Card Type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Card structure with complete validation.
 * Cards are the atomic units of lesson content.
 */
export interface SOWCard {
  card_number: number;
  card_type: CardType;
  title: string;
  purpose: string;
  standards_addressed: StandardOrSkillRef[];
  pedagogical_approach: string;
  key_concepts?: string[];
  worked_example?: string;
  practice_problems?: string[];
  cfu_strategy: string;
  misconceptions_addressed?: MisconceptionAddressed[];
  rubric_guidance?: RubricGuidance;
  estimated_minutes?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Lesson Plan Type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete lesson plan with 1-12 cards and pedagogical metadata.
 */
export interface LessonPlan {
  summary: string;
  card_structure: SOWCard[];
  lesson_flow_summary: string;
  multi_standard_integration_strategy: string;
  misconceptions_embedded_in_cards: string[];
  assessment_progression: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Supporting Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AccessibilityProfile {
  dyslexia_friendly: boolean;
  plain_language_level?: CEFRLevel;
  extra_time?: boolean;
  extra_time_percentage?: number;
  key_terms_simplified?: string[];
  visual_support_strategy?: string;
}

export interface Coherence {
  block_name: string;
  block_index: string;
  prerequisites?: string[];
}

export interface Policy {
  calculator_section: CalculatorSection;
  assessment_notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOW Entry Type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Single lesson entry in SOW with complete pedagogical design.
 * Each entry represents one ~50-minute lesson in the course sequence.
 */
export interface SOWEntry {
  order: number;
  label: string;
  lesson_type: LessonType;
  coherence: Coherence;
  policy: Policy;
  engagement_tags: string[];

  // NEW unified field for both unit-based and skills-based courses
  standards_or_skills_addressed: StandardOrSkillRef[];

  // DEPRECATED fields for backward compatibility
  outcomeRefs?: string[];
  assessmentStandardRefs?: {
    code: string;
    description: string;
    outcome: string;
  }[];

  lesson_plan: LessonPlan;
  accessibility_profile: AccessibilityProfile;
  estMinutes?: number;
  lesson_instruction: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Metadata Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MetadataCoherence {
  policy_notes: string[];
  sequencing_notes: string[];
}

export interface SOWMetadata {
  coherence: MetadataCoherence;
  accessibility_notes: string[];
  engagement_notes: string[];
  weeks?: number;
  periods_per_week?: number;

  // Computed/display fields
  course_name?: string;
  level?: string;
  total_lessons?: number;
  total_estimated_minutes?: number;
  generated_at?: string;
  author_agent_version?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Complete SOW Type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete authored SOW with full validation.
 * This is the main type for editing SOWs in the admin panel.
 */
export interface AuthoredSOWSchema {
  // Database-managed fields
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;

  // Core identifiers
  courseId?: string;
  version?: string;
  status?: SOWStatus;

  // Core content
  metadata: SOWMetadata;
  entries: SOWEntry[];

  // Top-level accessibility summary
  accessibility_notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  location: string;
  message: string;
  value?: unknown;
  type: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  summary: string;
  stats?: {
    total_entries: number;
    total_cards: number;
    lesson_types: Record<string, number>;
    card_types: Record<string, number>;
    course_id?: string;
    version?: string;
    status?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Form Constants
// ═══════════════════════════════════════════════════════════════════════════

export const CARD_TYPE_OPTIONS: { value: CardType; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'modelling', label: 'Modelling' },
  { value: 'guided_practice', label: 'Guided Practice' },
  { value: 'independent_practice', label: 'Independent Practice' },
  { value: 'exit_ticket', label: 'Exit Ticket' },
];

export const LESSON_TYPE_OPTIONS: { value: LessonType; label: string }[] = [
  { value: 'teach', label: 'Teach' },
  { value: 'independent_practice', label: 'Independent Practice' },
  { value: 'formative_assessment', label: 'Formative Assessment' },
  { value: 'revision', label: 'Revision' },
  { value: 'mock_exam', label: 'Mock Exam' },
];

export const CALCULATOR_SECTION_OPTIONS: { value: CalculatorSection; label: string }[] = [
  { value: 'non_calc', label: 'Non-Calculator' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'calc', label: 'Calculator' },
  { value: 'exam_conditions', label: 'Exam Conditions' },
];

export const CEFR_LEVEL_OPTIONS: { value: CEFRLevel; label: string }[] = [
  { value: 'CEFR_A1', label: 'CEFR A1 (Beginner)' },
  { value: 'CEFR_A2', label: 'CEFR A2 (Elementary)' },
  { value: 'CEFR_B1', label: 'CEFR B1 (Intermediate)' },
  { value: 'CEFR_B2', label: 'CEFR B2 (Upper Intermediate)' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Default Factories
// ═══════════════════════════════════════════════════════════════════════════

export function createEmptyCard(cardNumber: number = 1): SOWCard {
  return {
    card_number: cardNumber,
    card_type: 'explainer',
    title: '',
    purpose: '',
    standards_addressed: [],
    pedagogical_approach: '',
    cfu_strategy: '',
  };
}

export function createEmptyEntry(order: number = 1): SOWEntry {
  return {
    order,
    label: '',
    lesson_type: 'teach',
    coherence: {
      block_name: '',
      block_index: '',
      prerequisites: [],
    },
    policy: {
      calculator_section: 'non_calc',
    },
    engagement_tags: [],
    standards_or_skills_addressed: [],
    lesson_plan: {
      summary: '',
      card_structure: [createEmptyCard(1)],
      lesson_flow_summary: '',
      multi_standard_integration_strategy: '',
      misconceptions_embedded_in_cards: [],
      assessment_progression: '',
    },
    accessibility_profile: {
      dyslexia_friendly: false,
    },
    lesson_instruction: '',
  };
}

export function createEmptySOW(): AuthoredSOWSchema {
  return {
    status: 'draft',
    metadata: {
      coherence: {
        policy_notes: [],
        sequencing_notes: [],
      },
      accessibility_notes: [],
      engagement_notes: [],
    },
    entries: [createEmptyEntry(1)],
  };
}
