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

export interface LessonTemplate {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  templateId: string;
  title: string;
  courseId: string;
  outcomeRefs: string; // JSON string - Phase 3: now contains {outcomes, assessmentStandards}
  cards: string; // JSON string
  version: number;
  status: 'draft' | 'published' | 'archived';

  // NEW FIELDS - Phase 3 MVP2.5
  lesson_type?: string; // 'teach' | 'independent_practice' | etc
  estMinutes?: number;
  engagement_tags?: string; // JSON array of authentic context tags
  policy?: string; // JSON object - contains calculator_section, assessment_notes, accessibility
}

export interface LessonCard {
  id: string;
  title: string;
  explainer: string;
  example?: string[];
  cfu: {
    type: "numeric" | "mcq";
    id: string;
    stem: string;
    expected?: number | string;
    tolerance?: number;
    options?: string[];
    answerIndex?: number;
  };
}

export interface LessonSnapshot {
  title: string;
  outcomeRefs: Array<{ unit: string; outcome: string; label: string }>;
  assessmentStandardRefs?: string[]; // NEW - Phase 3
  cards: LessonCard[];
  templateVersion?: number;
  courseId?: string; // Added for teaching context
  lessonTemplateId?: string; // Added for teaching context

  // NEW FIELDS - Phase 3 MVP2.5
  lesson_type?: string;
  estMinutes?: number;
  engagement_tags?: string[];
  policy?: {
    calculator_section?: 'calc' | 'non_calc' | 'mixed';
    assessment_notes?: string;
    accessibility?: {
      dyslexia_friendly?: boolean;
      plain_language_level?: string;
      extra_time?: boolean;
    };
  };
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
  lessonSnapshot: string; // JSON string
  threadId?: string; // LangGraph thread ID for conversation continuity
  lastMessageAt?: string; // Timestamp of last chat interaction
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