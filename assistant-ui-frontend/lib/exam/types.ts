/**
 * Mock Exam Frontend Types
 *
 * TypeScript interfaces for the mock exam presentation system.
 * These types mirror the backend graph_mock_exam_models.py schemas
 * to ensure type safety across the frontend-backend boundary.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS - Question types and difficulty levels
// ═══════════════════════════════════════════════════════════════════════════════

export type QuestionType = 'mcq' | 'mcq_multiselect' | 'numeric' | 'short_text' | 'structured_response';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type CalculatorPolicy = 'non_calc' | 'calc' | 'mixed' | 'exam_conditions';

/**
 * SQA exam levels - used to determine UI styling and component selection
 * NAT3/NAT4 use simplified rich text components with age-appropriate features
 */
export type ExamLevel = 'national-3' | 'national-4' | 'national-5' | 'higher' | 'advanced-higher';

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION STRUCTURE - Matches backend MockExam schema
// ═══════════════════════════════════════════════════════════════════════════════

export interface MCQOption {
  label: string;
  text: string;
  is_correct: boolean;
  feedback?: string;
}

export interface MarkingStep {
  step: string;
  marks: number;
}

export interface AnswerKey {
  correct_answer: string;
  acceptable_variations?: string[];
  marking_scheme?: MarkingStep[];
}

export interface Misconception {
  error_pattern: string;
  feedback: string;
}

export interface CFUConfig {
  type: QuestionType;
  expected_format?: string | null;
  options?: MCQOption[] | null;
  answer_key: AnswerKey;
}

export interface Question {
  question_id: string;
  question_number: number;
  marks: number;
  difficulty: Difficulty;
  question_stem: string;
  question_stem_plain?: string;
  question_type: QuestionType;
  cfu_config: CFUConfig;
  hints?: string[];
  misconceptions?: Misconception[];
  diagram_url?: string;
}

export interface Section {
  section_id: string;
  section_label: string;
  section_order: number;
  section_marks: number;
  section_instructions?: string;
  questions: Question[];
}

export interface ExamMetadata {
  title: string;
  subject: string;
  /** SQA level - determines UI component selection for NAT3/NAT4 enhanced features */
  level: ExamLevel;
  totalMarks: number;
  timeLimit: number;
  instructions?: string;
  calculator_policy: CalculatorPolicy;
}

export interface MockExam {
  examId: string;
  courseId: string;
  metadata: ExamMetadata;
  sections: Section[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT RESPONSE TYPES - What the student submits
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnswerResponse {
  selected_option?: string;
  selected_options?: string[];
  numeric_value?: number;
  response_text?: string;
  working_out?: string;
  /** Rich text HTML content for enhanced NAT3/NAT4 responses */
  response_html?: string;
  /** Rich text HTML for working out (enhanced NAT3/NAT4) */
  working_out_html?: string;
  /** Base64 encoded images from drawings (enhanced NAT3/NAT4) */
  attached_images?: string[];
}

export interface SubmittedAnswer {
  question_id: string;
  question_number: number;
  section_id: string;
  question_type: QuestionType;
  response: AnswerResponse;
  time_spent_seconds?: number;
  was_flagged?: boolean;
}

export interface SubmissionMetadata {
  started_at: string;
  submitted_at: string;
  time_limit_minutes: number;
  time_spent_minutes: number;
  was_auto_submitted: boolean;
}

export interface ExamContext {
  total_questions: number;
  questions_answered: number;
  questions_skipped: number;
  questions_flagged: number;
}

export interface ExamSubmission {
  submission_id: string;
  exam_id: string;
  attempt_id: string;
  student_id: string;
  course_id: string;
  submission_metadata: SubmissionMetadata;
  answers: SubmittedAnswer[];
  exam_context: ExamContext;
}

export interface ExamSubmissionWithExam extends ExamSubmission {
  mock_exam: MockExam;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADING RESULTS - What the backend returns
// ═══════════════════════════════════════════════════════════════════════════════

export interface OverallResult {
  total_marks_earned: number;
  total_marks_possible: number;
  percentage: number;
  grade: string;
  pass_status: boolean;
  pass_threshold: number;
}

export interface SectionResult {
  section_id: string;
  section_label: string;
  marks_earned: number;
  marks_possible: number;
  percentage: number;
}

export interface QuestionFeedback {
  question_id: string;
  question_number: number;
  section_id: string;
  marks_earned: number;
  marks_possible: number;
  is_correct: boolean;
  is_partially_correct?: boolean;
  feedback_summary: string;
  what_you_did_well?: string;
  where_you_went_wrong?: string;
  correct_approach: string;
  misconception_detected?: string;
  related_concept?: string;
  suggested_review?: string;
  /** Specific feedback about the student's diagram if one was submitted */
  diagram_feedback?: string;
  /** Assessment of diagram accuracy: 'accurate', 'mostly_accurate', 'needs_improvement', 'incorrect' */
  diagram_accuracy?: 'accurate' | 'mostly_accurate' | 'needs_improvement' | 'incorrect';
}

export interface LearningRecommendation {
  priority: number;
  topic: string;
  reason: string;
  action: string;
  related_questions?: number[];
}

export interface EvaluationResult {
  evaluation_id: string;
  submission_id: string;
  evaluated_at: string;
  overall_result: OverallResult;
  section_results: SectionResult[];
  question_feedback: QuestionFeedback[];
  learning_recommendations: LearningRecommendation[];
  encouragement_message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI STATE TYPES - Frontend-specific state management
// ═══════════════════════════════════════════════════════════════════════════════

export type ExamPhase = 'loading' | 'instructions' | 'in_progress' | 'submitting' | 'reviewing' | 'results' | 'error';

export interface ExamState {
  phase: ExamPhase;
  exam: MockExam | null;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: Map<string, SubmittedAnswer>;
  flaggedQuestions: Set<string>;
  startTime: Date | null;
  timeRemaining: number;
  isAutoSubmitting: boolean;
  error: string | null;
}

export interface ExamTimerState {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  isWarning: boolean;
  isCritical: boolean;
}

export interface NavigationState {
  canGoBack: boolean;
  canGoForward: boolean;
  currentPosition: number;
  totalPositions: number;
  sectionProgress: {
    sectionId: string;
    completed: number;
    total: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPWRITE COLLECTION TYPES - Mock exam storage
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MockExamDocument - Appwrite document structure for mock_exams collection
 * The exam content is stored as a compressed JSON string
 */
export interface MockExamDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  courseId: string;
  examId: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  exam_content: string; // Compressed JSON of MockExam
  total_marks: number;
  time_limit_minutes: number;
  calculator_policy: CalculatorPolicy;
}

/**
 * ExamAttemptDocument - Appwrite document for tracking exam attempts
 */
export interface ExamAttemptDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  examId: string;
  studentId: string;
  courseId: string;
  attempt_number: number;
  status: 'in_progress' | 'submitted' | 'graded';
  started_at: string;
  submitted_at?: string;
  graded_at?: string;
  answers_snapshot?: string; // Compressed JSON for persistence
  result_snapshot?: string; // Compressed JSON of EvaluationResult
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExamProgress {
  questionsAnswered: number;
  totalQuestions: number;
  percentComplete: number;
  timeSpentMinutes: number;
  estimatedTimeRemaining: number;
}

export interface QuestionNavigationItem {
  questionId: string;
  questionNumber: number;
  sectionId: string;
  isAnswered: boolean;
  isFlagged: boolean;
  isCurrent: boolean;
}

export type GradeBand = 'A' | 'B' | 'C' | 'D' | 'No Award';

/**
 * Calculate SQA grade from percentage
 */
export function calculateGrade(percentage: number): { grade: GradeBand; passed: boolean } {
  if (percentage >= 70) return { grade: 'A', passed: true };
  if (percentage >= 60) return { grade: 'B', passed: true };
  if (percentage >= 50) return { grade: 'C', passed: true };
  if (percentage >= 40) return { grade: 'D', passed: true };
  return { grade: 'No Award', passed: false };
}

/**
 * Format time remaining in MM:SS format
 */
export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get time status for styling
 */
export function getTimeStatus(remainingSeconds: number, totalSeconds: number): 'normal' | 'warning' | 'critical' {
  const percentRemaining = (remainingSeconds / totalSeconds) * 100;
  if (percentRemaining <= 10) return 'critical';
  if (percentRemaining <= 25) return 'warning';
  return 'normal';
}
