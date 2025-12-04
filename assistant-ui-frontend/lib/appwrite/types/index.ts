// TypeScript interfaces for all Appwrite data models

export interface Student {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  name: string;
  role: 'student' | 'teacher';
}

export interface Course {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  courseId: string;
  title: string;
  level: string;
  subject: string;
  status: 'active' | 'inactive';
}

export interface Enrollment {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
  status: 'active' | 'completed' | 'withdrawn';
}

// ============================================
// PHASE 1-3: CARD & CFU TYPE INTERFACES
// Complete TypeScript types for cards and CFUs
// ============================================

/**
 * Rubric criterion - one scoring guideline
 */
export interface RubricCriterion {
  description: string;
  points: number;
}

/**
 * Rubric - scoring scheme for assessment
 */
export interface Rubric {
  total_points: number;
  criteria: RubricCriterion[];
}

/**
 * Misconception - anticipated student error with correction
 */
export interface Misconception {
  id: string; // Format: MISC_SUBJECT_TOPIC_###
  misconception: string;
  clarification: string;
}

/**
 * Multiple Choice Question CFU
 * Supports both single-select (radio buttons) and multi-select (checkboxes)
 */
export interface MCQCFU {
  type: 'mcq';
  id: string;
  stem: string;
  options: string[];
  answerIndex?: number;  // For single-select (backwards compatible)
  multiSelect?: boolean;  // True = checkboxes, False = radio buttons
  answerIndices?: number[];  // For multi-select
  rubric: Rubric;
}

/**
 * Numeric Answer CFU with hints and currency support
 */
export interface NumericCFU {
  type: 'numeric';
  id: string;
  stem: string;
  expected: number;
  tolerance: number;
  money2dp?: boolean;
  rubric: Rubric;
  hints?: string[];
}

/**
 * Structured (multi-part) Response CFU
 */
export interface StructuredResponseCFU {
  type: 'structured_response';
  id: string;
  stem: string;
  rubric: Rubric;
}

/**
 * Short Text Response CFU
 */
export interface ShortTextCFU {
  type: 'short_text';
  id: string;
  stem: string;
  rubric: Rubric;
}

/**
 * Union of all CFU types
 */
export type CFU = MCQCFU | NumericCFU | StructuredResponseCFU | ShortTextCFU;

/**
 * Complete lesson card structure
 * Includes pedagogy fields: misconceptions, context hooks, accessible version
 */
export interface LessonCard {
  id: string;
  title: string;
  explainer: string;
  explainer_plain: string; // CEFR A2-B1 accessible version
  cfu: CFU;
  misconceptions: Misconception[];
  context_hooks?: string[];
}

/**
 * Lesson policy - constraints and rules
 */
export interface LessonPolicy {
  calculator_allowed: boolean;
  assessment_notes?: string;
}

/**
 * Complete lesson template
 */
export interface LessonTemplate {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  courseId: string;
  outcomeRefs: string; // JSON string
  cards: string; // JSON string (or compressed base64)
  version: number;
  sow_order: number;
  status: 'draft' | 'published';
  createdBy: string;
  estMinutes: number;

  // Phase 3 MVP2.5 fields
  lesson_type: 'teach' | 'independent_practice' | 'formative_assessment' | 'revision' | 'mock_exam';
  engagement_tags: string; // JSON array of context tags
  policy: string; // JSON object with calculator_allowed, assessment_notes

  // Model versioning fields
  authored_sow_id?: string;
  authored_sow_version?: string;
  model_version?: string;
}

/**
 * Lesson snapshot - runtime lesson state with all data
 * Used during teaching session
 */
export interface LessonSnapshot {
  title: string;
  outcomeRefs: Array<{ unit: string; outcome: string; label: string }>;
  assessmentStandardRefs?: string[];
  cards: LessonCard[]; // Now uses complete LessonCard type with all CFU types
  templateVersion?: number;
  courseId?: string;
  lessonTemplateId?: string;

  // Phase 3 MVP2.5 required fields
  lesson_type: 'teach' | 'independent_practice' | 'formative_assessment' | 'revision' | 'mock_exam';
  estMinutes: number;
  engagement_tags: string[];
  policy: LessonPolicy;
}

/**
 * Lesson diagram - AI-generated JSXGraph visualization for a specific card
 * Stored in lesson_diagrams collection with image in Appwrite Storage
 */
export interface LessonDiagram {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  lessonTemplateId: string; // Foreign key to lesson_templates
  cardId: string; // Card identifier (e.g., "card_001")
  jsxgraph_json: string; // Serialized JSXGraph JSON specification
  image_file_id: string; // Appwrite Storage file ID reference (bucket: 6907775a001b754c19a6)
  diagram_type: 'geometry' | 'algebra' | 'statistics' | 'mixed';
  diagram_context?: 'lesson' | 'cfu'; // Optional: "lesson" for teaching content, "cfu" for assessment questions
  visual_critique_score: number; // Quality score from visual critic (0.0-1.0)
  critique_iterations: number; // Number of refinement iterations (1-3)
  critique_feedback: string; // JSON stringified critique history
  execution_id: string; // Unique generation execution ID
  failure_reason?: string; // Error details for failed diagrams (optional)
}

export interface Session {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  studentId: string;
  courseId: string;
  lessonTemplateId?: string;
  startedAt: string;
  endedAt?: string;
  stage: string;
  status: 'created' | 'active' | 'completed' | 'failed'; // Session lifecycle status
  completedAt?: string; // Timestamp when session was completed
  durationMinutes?: number; // Duration from start to completion
  score?: number; // Overall lesson performance score (0.0-1.0), optional
  lessonSnapshot: string; // JSON string
  threadId?: string; // LangGraph thread ID for conversation continuity
  lastMessageAt?: string; // Timestamp of last chat interaction
  sessionType?: 'initial' | 'review'; // Type of session for spaced repetition tracking
  reviewCount?: number; // Number of times this lesson has been reviewed
  originalCompletionDate?: string; // When first completed (for review sessions)
  conversationHistory?: string; // Compressed (gzip + base64) conversation history for replay
}

export interface Evidence {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  sessionId: string;
  itemId: string;
  response: string;
  correct: boolean;
  attempts?: number;
  confidence?: number;
  reasoning?: string;
  feedback?: string;
  timestamp?: string;

  // Student drawing fields (storage-based approach - NEW)
  student_drawing_file_ids?: string[]; // Array of Appwrite Storage file IDs
  student_drawing_text?: string; // Optional text explanation of drawing

  // DEPRECATED: Legacy base64 drawing field (for backward compatibility)
  // Old format: base64 string or JSON.stringify([base64_1, base64_2, ...])
  student_drawing?: string;
}

export interface EvidenceData {
  sessionId: string;
  itemId: string;
  response: string;
  correct: boolean;
  attempts?: number;
  confidence?: number;
  reasoning?: string;
  feedback?: string;
  timestamp?: string;

  // Student drawing fields (storage-based approach - NEW)
  student_drawing_file_ids?: string[]; // Array of Appwrite Storage file IDs
  student_drawing_text?: string; // Optional text explanation of drawing

  // DEPRECATED: Legacy base64 drawing field (for backward compatibility)
  student_drawing?: string;
}

export interface Mastery {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  studentId: string;
  outcomeRef: string;
  level: number;
  confidence: number;
  lastUpdated: string;
}

export interface User {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  email: string;
  emailVerification: boolean;
}

// Common types for operations
export interface CreateStudentData {
  userId: string;
  name: string;
  role?: 'student' | 'teacher';
}

export interface CreateSessionData {
  studentId: string;
  courseId: string;
  lessonTemplateId: string;
  stage?: string;
  lessonSnapshot: string;
  sessionType?: 'initial' | 'review';
  reviewCount?: number;
  originalCompletionDate?: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderType?: 'asc' | 'desc';
}

export interface AppwriteResponse<T> {
  total: number;
  documents: T[];
}

// Authored SOW types - Phase 1 MVP2.5

/**
 * Card structure within a lesson plan
 */
export interface AuthoredSOWCard {
  card_number: number;
  card_type: 'starter' | 'explainer' | 'modelling' | 'guided_practice' | 'independent_practice' | 'exit_ticket';
  title: string;
  purpose: string;
  standards_addressed: Array<{
    code?: string;
    description: string;
    outcome?: string;
    skill_name?: string;
  }>;
  pedagogical_approach: string;
  key_concepts?: string[];
  worked_example?: string;
  practice_problems?: string[];
  cfu_strategy: string;
  misconceptions_addressed?: Array<{
    misconception: string;
    remediation: string;
  }>;
  rubric_guidance?: {
    total_points: number;
    criteria: Array<{ description: string; points: number }>;
  };
  estimated_minutes?: number;
}

/**
 * Lesson plan structure with card_structure
 */
export interface AuthoredSOWLessonPlan {
  summary: string;
  card_structure: AuthoredSOWCard[];
  lesson_flow_summary: string;
  multi_standard_integration_strategy: string;
  misconceptions_embedded_in_cards: string[];
  assessment_progression: string;
}

/**
 * Standard or skill reference (unified for unit-based and skills-based courses)
 */
export interface StandardOrSkillRef {
  code?: string;
  description: string;
  outcome?: string;
  skill_name?: string;
}

export interface AuthoredSOWEntry {
  order: number;
  lessonTemplateRef?: string; // Optional - may not exist in authored SOWs
  label: string;
  lesson_type: 'teach' | 'independent_practice' | 'formative_assessment' |
                'mock_assessment' | 'revision' | 'project' | 'spiral_revisit' | 'summative_assessment' | 'mock_exam';
  coherence: {
    unit?: string;
    block_name: string;
    block_index: string;
    prerequisites?: string[];
  };
  policy: {
    calculator_section: 'non_calc' | 'calc' | 'mixed' | 'exam_conditions';
    assessment_notes?: string;
    accessibility?: {
      dyslexia_friendly: boolean;
      plain_language_level: string;
      extra_time: boolean;
    };
  };
  engagement_tags: string[];

  // NEW: Unified standards/skills field (preferred)
  standards_or_skills_addressed?: StandardOrSkillRef[];

  // LEGACY: Old fields for backwards compatibility
  outcomeRefs?: string[];
  assessmentStandardRefs?: Array<{ code: string; description: string; outcome: string }>;

  // NEW: Lesson plan with card_structure (actual JSON structure)
  lesson_plan?: AuthoredSOWLessonPlan;

  // LEGACY: Old pedagogical_blocks for backwards compatibility
  pedagogical_blocks?: any[];

  accessibility_profile?: {
    dyslexia_friendly: boolean;
    plain_language_level?: string;
    extra_time?: boolean;
    extra_time_percentage?: number;
    key_terms_simplified?: string[];
    visual_support_strategy?: string;
  };
  estMinutes?: number;

  // NEW: lesson_instruction (preferred)
  lesson_instruction?: string;

  // LEGACY: notes field for backwards compatibility
  notes?: string;
}

export interface AuthoredSOWMetadata {
  course_name: string;
  level: string;
  total_lessons: number;
  total_estimated_minutes: number;
  generated_at: string;
  author_agent_version: string;
  coherence?: {
    policy_notes?: string[];
    sequencing_notes?: string[];
  };
  weeks?: number;
  periods_per_week?: number;
  [key: string]: any;
}

export interface AuthoredSOW {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  courseId: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  entries: string; // JSON stringified AuthoredSOWEntry[]
  metadata: string; // JSON stringified AuthoredSOWMetadata
  accessibility_notes: string;
}

export interface AuthoredSOWData {
  courseId: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  entries: AuthoredSOWEntry[];
  metadata: AuthoredSOWMetadata;
  accessibility_notes?: string;
}