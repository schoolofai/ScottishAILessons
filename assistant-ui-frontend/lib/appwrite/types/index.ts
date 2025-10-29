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
 */
export interface MCQCFU {
  type: 'mcq';
  id: string;
  stem: string;
  options: string[];
  answerIndex: number;
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
  status: 'draft' | 'review' | 'published';
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
  status: 'created' | 'active' | 'completed' | 'abandoned' | 'failed'; // Session lifecycle status
  completedAt?: string; // Timestamp when session was completed
  durationMinutes?: number; // Duration from start to completion
  score?: number; // Overall lesson performance score (0.0-1.0), optional
  lessonSnapshot: string; // JSON string
  threadId?: string; // LangGraph thread ID for conversation continuity
  lastMessageAt?: string; // Timestamp of last chat interaction
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
export interface AuthoredSOWEntry {
  order: number;
  lessonTemplateRef: string;
  label: string;
  lesson_type: 'teach' | 'independent_practice' | 'formative_assessment' |
                'mock_assessment' | 'revision' | 'project' | 'spiral_revisit' | 'summative_assessment';
  coherence: {
    unit: string;
    block_name: string;
    block_index: string;
    prerequisites: string[];
  };
  policy: {
    calculator_section: 'non_calc' | 'calc' | 'mixed';
    assessment_notes: string;
    accessibility?: {
      dyslexia_friendly: boolean;
      plain_language_level: string;
      extra_time: boolean;
    };
  };
  engagement_tags: string[];
  outcomeRefs: string[];
  assessmentStandardRefs: string[];
  pedagogical_blocks?: any[];
  accessibility_profile?: any;
  estMinutes: number;
  notes: string;
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