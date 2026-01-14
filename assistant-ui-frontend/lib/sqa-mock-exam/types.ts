/**
 * Nat5+ SQA Mock Exam TypeScript Types
 *
 * These types define the contract between:
 * - Author Agent (Python) → Frontend (TypeScript)
 * - Frontend (TypeScript) → Evaluator (Python)
 * - Evaluator (Python) → Frontend (TypeScript)
 *
 * IMPORTANT: Field names must EXACTLY match Python Pydantic models.
 */

// =============================================================================
// Marking Scheme Types (SQA-style)
// =============================================================================

/**
 * Single marking point in the generic scheme.
 * SQA marking schemes award marks per "bullet point".
 */
export interface MarkingBullet {
  bullet: number;
  process: string;
  marks: number;
}

/**
 * Illustrative (example) answer for a marking bullet.
 */
export interface IllustrativeAnswer {
  bullet: number;
  answer: string;
  answer_latex?: string | null;
  tolerance_range?: string | null;
  acceptable_variations?: string[];
}

/**
 * Complete SQA-style marking scheme.
 */
export interface MarkingScheme {
  max_marks: number;
  generic_scheme: MarkingBullet[];
  illustrative_scheme: IllustrativeAnswer[];
  notes?: string[];
}

// =============================================================================
// Question Types
// =============================================================================

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionStyle = 'procedural' | 'application' | 'problem_solving';

/**
 * Diagram reference for a question.
 */
export interface QuestionDiagram {
  diagram_id: string;
  diagram_type: string;
  diagram_url?: string | null;
  diagram_spec?: Record<string, unknown> | null;
  description?: string;
}

/**
 * Complete question structure for Nat5+ mock exam.
 */
export interface Nat5PlusQuestion {
  question_id: string;
  question_number: string;
  marks: number;
  difficulty: Difficulty;
  question_style?: string;
  stem: string;
  stem_latex: string;
  topic_ids?: string[];
  template_paper_id?: string;
  marking_scheme: MarkingScheme;
  diagrams?: QuestionDiagram[];
  hints?: string[];
  common_errors?: string[];
}

// =============================================================================
// Section and Exam Types
// =============================================================================

/**
 * Exam section (e.g., Section A - Non-Calculator).
 */
export interface ExamSection {
  section_id: string;
  section_name: string;
  total_marks: number;
  instructions?: string;
  questions: Nat5PlusQuestion[];
}

/**
 * Exam metadata.
 */
export interface ExamMetadata {
  title: string;
  total_marks: number;
  duration_minutes: number;
  calculator_allowed: boolean;
  generated_at?: string;
  sqa_aligned?: boolean;
}

/**
 * Difficulty distribution.
 */
export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

/**
 * Generation metadata.
 */
export interface GenerationMetadata {
  model: string;
  tokens_used?: number;
  generation_timestamp: string;
  pipeline_version?: string;
}

export type ExamStatus = 'draft' | 'published' | 'archived';

/**
 * Complete Nat5+ Mock Exam structure.
 * Contract A: Author → Frontend
 */
export interface Nat5PlusMockExam {
  exam_id: string;
  course_id: string;
  subject: string;
  level: string;
  exam_version?: number;
  status: ExamStatus;
  metadata: ExamMetadata;
  sections: ExamSection[];
  topic_coverage?: string[];
  difficulty_distribution?: DifficultyDistribution;
  template_sources?: string[];
  generation_metadata?: GenerationMetadata;
}

// =============================================================================
// Submission Types (Contract B: Frontend → Evaluator)
// =============================================================================

/**
 * Single student answer.
 * CRITICAL: Uses 'response_text' NOT 'answer' - this is the contract!
 */
export interface StudentAnswer {
  question_id: string;
  question_number: string;
  response_text: string;
  response_latex?: string | null;
  working_shown?: string | null;
  time_spent_seconds?: number | null;
  confidence_level?: string | null;
}

/**
 * Exam attempt metadata.
 */
export interface ExamAttemptMetadata {
  started_at: string;
  total_time_spent_seconds?: number;
  questions_attempted?: number;
  questions_skipped?: number;
}

/**
 * Complete exam submission.
 * Contract B: Frontend → Evaluator
 */
export interface ExamSubmission {
  submission_id: string;
  exam_id: string;
  student_id: string;
  attempt_id?: string;
  submitted_at?: string;
  answers: StudentAnswer[];
  exam_metadata?: ExamAttemptMetadata;
}

// =============================================================================
// Evaluation Result Types (Contract C: Evaluator → Frontend)
// =============================================================================

/**
 * Mark awarded for a single bullet point.
 */
export interface BulletMark {
  bullet: number;
  marks_earned: number;
  marks_possible: number;
  feedback: string;
  student_working?: string | null;
  expected_working?: string | null;
}

/**
 * Grading result for a single question.
 */
export interface QuestionResult {
  question_id: string;
  question_number: string;
  marks_earned: number;
  marks_possible: number;
  bullet_marks: BulletMark[];
  overall_feedback: string;
  misconception_detected?: string | null;
  strengths?: string[];
  areas_for_improvement?: string[];
}

/**
 * Result for a section.
 */
export interface SectionResult {
  section_id: string;
  section_name: string;
  marks_earned: number;
  marks_possible: number;
  percentage?: number;
}

/**
 * Grade band range.
 */
export interface GradeBandRange {
  min: number;
  max: number;
}

/**
 * SQA grade bands.
 */
export interface GradeBand {
  A: GradeBandRange;
  B: GradeBandRange;
  C: GradeBandRange;
  D: GradeBandRange;
  'No Award': GradeBandRange;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'No Award';

/**
 * Overall exam result.
 */
export interface OverallResult {
  marks_earned: number;
  marks_possible: number;
  percentage: number;
  grade: Grade;
  grade_band: GradeBand;
  performance_summary?: string;
}

export type MasteryLevel = 'not_started' | 'developing' | 'achieved' | 'exceeded';

/**
 * Learning recommendation.
 */
export interface LearningRecommendation {
  topic_id: string;
  topic_name?: string;
  mastery_level: MasteryLevel;
  recommendation: string;
  suggested_resources?: string[];
}

/**
 * Complete evaluation result.
 * Contract C: Evaluator → Frontend
 */
export interface EvaluationResult {
  evaluation_id: string;
  submission_id: string;
  exam_id?: string;
  student_id?: string;
  evaluated_at: string;
  overall_result: OverallResult;
  section_results: SectionResult[];
  question_feedback: QuestionResult[];
  learning_recommendations?: LearningRecommendation[];
  encouragement_message: string;
}

// =============================================================================
// UI Helper Types
// =============================================================================

/**
 * Exam browse item for listing.
 */
export interface ExamBrowseItem {
  examId: string;
  subject: string;
  level: string;
  courseId: string;
  examVersion: number;
  status: ExamStatus;
  totalMarks: number;
  questionCount: number;
  calculatorAllowed: boolean;
}

/**
 * Exam attempt record.
 */
export interface ExamAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  attemptNumber: number;
  status: 'in_progress' | 'submitted' | 'graded';
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
  marksEarned?: number;
  marksPossible?: number;
  percentage?: number;
  grade?: Grade;
}
