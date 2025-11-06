/**
 * Test Fixture Data for SessionChatAssistant Testing
 *
 * This file contains realistic test data matching the actual data structures
 * used in the application. All data is pre-decompressed for testing convenience.
 *
 * Usage:
 *   import { mockSession, mockLessonSnapshot } from '@/__mocks__/session-data';
 */

import {
  Session,
  LessonSnapshot,
  LessonCard,
  MCQCFU,
  NumericCFU,
  Misconception,
  LessonPolicy,
} from '@/lib/appwrite/types';
import { CourseOutcome } from '@/lib/types/course-outcomes';
import {
  SessionWithContextChat,
  SessionStateData,
  CourseCurriculumMetadata,
} from './appwrite-drivers';

// ============================================
// Lesson Cards - Realistic Math Content
// ============================================

export const mockMisconception: Misconception = {
  id: 'MISC_MATH_FRACTIONS_001',
  misconception: 'Students may think 2/10 and 1/5 are different values',
  clarification:
    'Both fractions represent the same value (0.2), just written differently. Simplifying fractions helps us see equivalent values.',
};

export const mockMCQCFU: MCQCFU = {
  type: 'mcq',
  id: 'cfu_fractions_001',
  stem: 'Which fraction is equivalent to 2/10?',
  options: ['1/5', '2/5', '1/10', '2/20'],
  answerIndex: 0,
  rubric: {
    total_points: 1,
    criteria: [
      { description: 'Correctly identifies equivalent fraction', points: 1 },
    ],
  },
};

export const mockNumericCFU: NumericCFU = {
  type: 'numeric',
  id: 'cfu_fractions_002',
  stem: 'Convert 2/10 to a decimal',
  expected: 0.2,
  tolerance: 0.01,
  rubric: {
    total_points: 1,
    criteria: [{ description: 'Correctly converts fraction to decimal', points: 1 }],
  },
  hints: [
    'Divide the numerator by the denominator',
    'Think about how many tenths make 0.2',
  ],
};

export const mockLessonCard1: LessonCard = {
  id: 'card_001',
  title: 'Introduction to Equivalent Fractions',
  explainer:
    'Equivalent fractions represent the same value but are written differently. For example, 2/10 and 1/5 are equivalent because they both equal 0.2.',
  explainer_plain:
    'Equivalent fractions are fractions that mean the same amount. 2/10 is the same as 1/5.',
  cfu: mockMCQCFU,
  misconceptions: [mockMisconception],
  context_hooks: ['money', 'pizza slices', 'measuring cups'],
};

export const mockLessonCard2: LessonCard = {
  id: 'card_002',
  title: 'Converting Fractions to Decimals',
  explainer:
    'To convert a fraction to a decimal, divide the numerator (top number) by the denominator (bottom number). For 2/10, we calculate 2 ÷ 10 = 0.2',
  explainer_plain:
    'To change a fraction to a decimal, divide the top number by the bottom number. 2 divided by 10 equals 0.2',
  cfu: mockNumericCFU,
  misconceptions: [],
  context_hooks: ['calculator', 'money amounts'],
};

// ============================================
// Lesson Policy
// ============================================

export const mockLessonPolicy: LessonPolicy = {
  calculator_allowed: false,
  assessment_notes: 'Non-calculator section - students should use mental math',
};

// ============================================
// Lesson Snapshot - Complete Structure
// ============================================

export const mockLessonSnapshot: LessonSnapshot = {
  title: 'Understanding Equivalent Fractions',
  outcomeRefs: [
    { unit: 'HV7Y 73', outcome: 'O1', label: 'Understand and use fractions' },
    { unit: 'HV7Y 73', outcome: 'O2', label: 'Convert between fractions and decimals' },
  ],
  assessmentStandardRefs: ['AS1.1', 'AS1.2'],
  cards: [mockLessonCard1, mockLessonCard2],
  templateVersion: 1,
  courseId: 'C844 73',
  lessonTemplateId: 'lesson_template_fractions_001',
  lesson_type: 'teach',
  estMinutes: 50,
  engagement_tags: ['visual', 'interactive', 'real-world'],
  policy: mockLessonPolicy,
};

// ============================================
// Session - Active Teaching Session
// ============================================

export const mockSession: Session = {
  $id: 'test-session-123',
  $createdAt: '2025-01-01T10:00:00.000Z',
  $updatedAt: '2025-01-01T10:30:00.000Z',
  studentId: 'student-456',
  courseId: 'C844 73',
  lessonTemplateId: 'lesson_template_fractions_001',
  startedAt: '2025-01-01T10:00:00.000Z',
  stage: 'active',
  status: 'active',
  lessonSnapshot: JSON.stringify(mockLessonSnapshot), // Pre-stringified (uncompressed for testing)
  threadId: 'existing-thread-id-main',
  lastMessageAt: '2025-01-01T10:25:00.000Z',
};

export const mockSessionWithoutThreadId: Session = {
  ...mockSession,
  $id: 'test-session-no-thread',
  threadId: undefined,
  lastMessageAt: undefined,
};

export const mockCompletedSession: Session = {
  ...mockSession,
  $id: 'test-session-completed',
  status: 'completed',
  completedAt: '2025-01-01T10:50:00.000Z',
  durationMinutes: 50,
  score: 0.85,
};

// ============================================
// SessionWithContextChat - Driver Response
// ============================================

export const mockSessionWithContextChat: SessionWithContextChat = {
  session: mockSession,
  threadId: 'existing-thread-id-main',
  contextChatThreadId: 'existing-context-thread-id',
  hasExistingConversation: true,
  hasExistingContextChat: true,
  lastMessageAt: '2025-01-01T10:25:00.000Z',
};

export const mockSessionWithContextChatNoThread: SessionWithContextChat = {
  session: mockSessionWithoutThreadId,
  threadId: undefined,
  contextChatThreadId: undefined,
  hasExistingConversation: false,
  hasExistingContextChat: false,
};

// ============================================
// SessionStateData - Driver Response
// ============================================

export const mockSessionStateData: SessionStateData = {
  session: mockSession,
  parsedSnapshot: mockLessonSnapshot,
  progress: {
    currentCard: 0,
    totalCards: 2,
    completed: false,
  },
};

export const mockSessionStateDataCompleted: SessionStateData = {
  session: mockCompletedSession,
  parsedSnapshot: mockLessonSnapshot,
  progress: {
    currentCard: 2,
    totalCards: 2,
    completed: true,
  },
};

// ============================================
// Course Curriculum Metadata
// ============================================

export const mockCourseCurriculumMetadata: CourseCurriculumMetadata = {
  course_subject: 'mathematics',
  course_level: 'national-3',
  sqa_course_code: 'C844 73',
  course_title: 'Mathematics: National 3',
};

// ============================================
// Course Outcomes - Enriched Data
// ============================================

export const mockCourseOutcome1: CourseOutcome = {
  $id: 'outcome-doc-001',
  $createdAt: '2024-12-01T00:00:00.000Z',
  $updatedAt: '2024-12-01T00:00:00.000Z',
  courseId: 'C844 73',
  courseSqaCode: 'C844 73',
  outcomeId: 'O1',
  outcomeTitle: 'Understand and use fractions in mathematical and real-world contexts',
  unitCode: 'HV7Y 73',
  unitTitle: 'Numeracy',
  scqfCredits: 6,
  assessmentStandards: JSON.stringify([
    {
      code: 'AS1.1',
      desc: 'Identify and create equivalent fractions',
      skills_list: ['simplification', 'equivalence', 'visual representation'],
    },
    {
      code: 'AS1.2',
      desc: 'Convert between fractions and decimals',
      skills_list: ['division', 'decimal notation'],
    },
  ]),
  teacherGuidance:
    'Focus on visual models (fraction bars, circles) to build conceptual understanding before procedural fluency.',
  keywords: JSON.stringify(['fractions', 'equivalence', 'decimals', 'numeracy']),
};

export const mockCourseOutcome2: CourseOutcome = {
  $id: 'outcome-doc-002',
  $createdAt: '2024-12-01T00:00:00.000Z',
  $updatedAt: '2024-12-01T00:00:00.000Z',
  courseId: 'C844 73',
  courseSqaCode: 'C844 73',
  outcomeId: 'O2',
  outcomeTitle: 'Apply numerical reasoning to solve problems',
  unitCode: 'HV7Y 73',
  unitTitle: 'Numeracy',
  scqfCredits: 6,
  assessmentStandards: JSON.stringify([
    {
      code: 'AS2.1',
      desc: 'Use fractions in problem-solving contexts',
      skills_list: ['application', 'problem-solving', 'real-world contexts'],
    },
  ]),
  teacherGuidance:
    'Connect to real-world contexts like cooking, shopping, and sharing to make fractions meaningful.',
  keywords: JSON.stringify(['problem-solving', 'application', 'real-world']),
};

export const mockEnrichedOutcomes: CourseOutcome[] = [mockCourseOutcome1, mockCourseOutcome2];

// ============================================
// Session Context - Full Structure for MyAssistant
// ============================================

export const mockSessionContext = {
  session_id: mockSession.$id,
  student_id: mockSession.studentId,
  lesson_snapshot: mockLessonSnapshot,
  use_plain_text: false,
  course_subject: mockCourseCurriculumMetadata.course_subject,
  course_level: mockCourseCurriculumMetadata.course_level,
  sqa_course_code: mockCourseCurriculumMetadata.sqa_course_code,
  course_title: mockCourseCurriculumMetadata.course_title,
  enriched_outcomes: mockEnrichedOutcomes,
};

// ============================================
// Edge Cases & Error Scenarios
// ============================================

/**
 * Session with missing optional fields
 */
export const mockMinimalSession: Session = {
  $id: 'minimal-session',
  $createdAt: '2025-01-01T10:00:00.000Z',
  $updatedAt: '2025-01-01T10:00:00.000Z',
  studentId: 'student-456',
  courseId: 'C844 73',
  startedAt: '2025-01-01T10:00:00.000Z',
  stage: 'created',
  status: 'created',
  lessonSnapshot: JSON.stringify(mockLessonSnapshot),
  // No threadId, lessonTemplateId, lastMessageAt
};

/**
 * Lesson snapshot with no outcome refs (edge case)
 */
export const mockLessonSnapshotNoOutcomes: LessonSnapshot = {
  ...mockLessonSnapshot,
  outcomeRefs: [],
  assessmentStandardRefs: [],
};

/**
 * Session with no courseId (should skip metadata fetch)
 */
export const mockSessionNoCourseId: Session = {
  ...mockSession,
  $id: 'session-no-course',
  courseId: '',
  lessonSnapshot: JSON.stringify(mockLessonSnapshotNoOutcomes),
};
