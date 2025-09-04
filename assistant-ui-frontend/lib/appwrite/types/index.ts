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
  outcomeRefs: string; // JSON string
  cards: string; // JSON string
  version: number;
  status: 'draft' | 'published' | 'archived';
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
  cards: LessonCard[];
  templateVersion?: number;
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
}

export interface EvidenceData {
  sessionId: string;
  itemId: string;
  response: string;
  correct: boolean;
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