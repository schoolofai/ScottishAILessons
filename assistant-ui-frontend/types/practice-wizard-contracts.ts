/**
 * Practice Wizard Frontend-Backend Contracts
 *
 * This file defines the EXACT data structures sent by the backend
 * infinite_practice_graph.py. All frontend components MUST use these
 * interfaces directly without transformation.
 *
 * Backend source: langgraph-agent/src/agent/infinite_practice_graph.py
 *
 * RULES:
 * 1. These types match the backend EXACTLY - no aliases or transformations
 * 2. Components consuming these types should NOT transform the data
 * 3. Any backend changes must be reflected here first
 */

// ═══════════════════════════════════════════════════════════════════════════
// PRACTICE QUESTION CONTRACT
// Source: infinite_practice_graph.py lines 659-678 (practice_question tool call)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Question type as defined by GeneratedQuestion Pydantic model.
 * Backend does NOT support "short_text" - only these three types.
 */
export type QuestionType = "mcq" | "numeric" | "structured_response";

/**
 * Difficulty levels supported by the infinite practice system.
 */
export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * Block progress as included in the progress report.
 */
export interface BlockProgress {
  block_id: string;
  mastery_score: number;
  is_complete: boolean;
}

/**
 * Progress report included with tool calls.
 * Source: create_progress_report() function in infinite_practice_graph.py
 */
export interface ProgressReport {
  session_id: string;
  total_blocks: number;
  completed_blocks: number;
  current_block_index: number;
  overall_mastery: number;
  blocks: BlockProgress[];
}

/**
 * Practice Question - EXACT structure from backend tool call args.
 *
 * Source: infinite_practice_graph.py present_question_node() lines 659-678
 *
 * IMPORTANT: The `options` field is a simple string array (e.g., ["A", "B", "C", "D"]),
 * NOT an array of objects. MCQ components should generate IDs from indices.
 */
export interface PracticeQuestion {
  /** Unique question identifier (e.g., "q_block1_1699500000") */
  question_id: string;

  /** ID of the learning block this question belongs to */
  block_id: string;

  /** Human-readable title of the current block */
  block_title: string;

  /** Current difficulty level */
  difficulty: DifficultyLevel;

  /** Type of question - determines which input component to render */
  question_type: QuestionType;

  /** The question text (may contain LaTeX) */
  stem: string;

  /**
   * MCQ options as SIMPLE STRINGS.
   * Example: ["Calculate 2 + 2", "Find the derivative", "Solve for x"]
   * The index (0, 1, 2, 3) serves as the option ID.
   */
  options?: string[];

  /** Progressive hints for the student */
  hints: string[];

  /** Number of questions attempted at current difficulty */
  questions_at_difficulty: number;

  /** Number correct at current difficulty */
  correct_at_difficulty: number;

  /** Current block mastery score (0-100) */
  mastery_score: number;

  /** Whether student can manually change difficulty */
  can_set_difficulty: boolean;

  /** Whether student can request to advance to next block */
  can_request_advance: boolean;

  /** Session progress report */
  progress: ProgressReport;

  // ─────────────────────────────────────────────────────────────────────────
  // Optional diagram fields (when question includes generated diagram)
  // ─────────────────────────────────────────────────────────────────────────

  /** Base64-encoded PNG diagram image (if generated) */
  diagram_base64?: string;

  /** Description of the diagram for accessibility */
  diagram_description?: string;

  /** Title of the diagram */
  diagram_title?: string;

  /** Type of diagram (e.g., "geometry", "graph", "table") */
  diagram_type?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONCEPT PRESENTATION CONTRACT
// Source: infinite_practice_graph.py emit_concept_node() lines 467-480
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Worked example structure as defined in lesson blocks.
 */
export interface WorkedExample {
  problem: string;
  solution_steps: string[];
  final_answer: string;
}

/**
 * Concept Block - EXACT structure from backend concept_presentation tool call.
 * Source: infinite_practice_graph.py emit_concept_node()
 */
export interface ConceptBlock {
  /** Unique block identifier */
  block_id: string;

  /** Zero-based index of current block */
  block_index: number;

  /** Total number of blocks in the session */
  total_blocks: number;

  /** Block title */
  title: string;

  /** Main explanation text (may contain LaTeX) */
  explanation: string;

  /** Worked example with problem, steps, and answer */
  worked_example: WorkedExample;

  /** Key skills covered in this block */
  key_skills: string[];

  /** Current difficulty level */
  current_difficulty: DifficultyLevel;

  /** Whether difficulty is adaptive or fixed */
  difficulty_mode: "adaptive" | "fixed";

  /** Whether student can change difficulty */
  can_set_difficulty: boolean;

  /** Session progress report */
  progress: ProgressReport;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK CONTRACT
// Source: infinite_practice_graph.py emit_feedback_node() lines 919-937
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Feedback after answer submission.
 * Source: practice_feedback tool call in infinite_practice_graph.py
 *
 * EXACT fields from backend:
 * - is_correct: boolean
 * - feedback: string (NOT feedback_text)
 * - partial_credit: number
 * - correct_answer: string
 * - explanation: string
 * - misconception_detected: string | null
 * - new_mastery_score: number (NOT new_mastery)
 * - difficulty_changing: boolean
 * - next_difficulty: DifficultyLevel | null
 * - block_complete: boolean
 * - can_request_advance: boolean
 * - can_set_difficulty: boolean
 * - block_title: string
 * - progress: ProgressReport
 */
export interface PracticeFeedback {
  /** Whether the answer was correct */
  is_correct: boolean;

  /** Detailed feedback text (may contain LaTeX) */
  feedback: string;

  /** Partial credit score (0-1) for partially correct answers */
  partial_credit: number;

  /** The correct answer (shown if incorrect) */
  correct_answer: string;

  /** Step-by-step explanation */
  explanation: string;

  /** Detected misconception if any */
  misconception_detected?: string | null;

  /** New mastery score after this question (0-100) */
  new_mastery_score: number;

  /** Whether difficulty is changing after this question */
  difficulty_changing: boolean;

  /** The next difficulty level if changing */
  next_difficulty?: DifficultyLevel | null;

  /** Whether this block is now complete */
  block_complete: boolean;

  /** Whether student can request to advance to next block */
  can_request_advance: boolean;

  /** Whether student can manually change difficulty */
  can_set_difficulty: boolean;

  /** Human-readable title of the current block */
  block_title: string;

  /** Session progress report */
  progress: ProgressReport;
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION CONTEXT CONTRACT
// Source: Session initialization in infinite_practice_graph.py
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Context provided when starting a practice session.
 * Sent to the backend in session_context field.
 */
export interface PracticeSessionContext {
  /** Optional existing session ID for resume */
  session_id?: string;

  /** Student's document ID */
  student_id: string;

  /** Lesson template ID to practice */
  lesson_template_id: string;

  /** Full lesson snapshot with cards */
  lesson_snapshot: Record<string, unknown>;

  /** Source type identifier */
  source_type: "lesson_template";

  /** Previously stored session for resume */
  stored_session?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUME PAYLOAD CONTRACTS (Frontend → Backend)
// These define what the frontend sends when resuming from an interrupt.
// Source: useLangGraphWizard.ts resume() calls
// Backend handler: infinite_practice_graph.py handle_interrupt_response_node()
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Action types for resume payloads.
 */
export type ResumeAction =
  | "continue"        // Continue from concept/feedback to next step
  | "submit"          // Submit an answer
  | "set_difficulty"  // Change difficulty level
  | "request_advance" // Request to advance to next block
  | "pause";          // Pause the session

/**
 * Resume payload for submitting an answer.
 * CRITICAL: Use "answer" field, NOT "student_response"
 *
 * Drawing support fields (for structured response questions):
 * - drawing_data_url: Base64 PNG of student drawing (for multimodal marking)
 * - drawing_scene_data: Excalidraw scene data (for re-editing in frontend)
 */
export interface ResumeSubmitPayload {
  action: "submit";
  /** The student's answer - string for numeric/text, string for MCQ index ("0", "1", etc.) */
  answer: string;
  /** Number of hints the student used before answering */
  hints_used: number;
  /** Optional question ID for validation */
  question_id?: string;
  /** Base64 PNG of student drawing (for multimodal marking) */
  drawing_data_url?: string;
  /** Excalidraw scene data (for re-editing in frontend) */
  drawing_scene_data?: unknown;
}

/**
 * Resume payload for continuing to next step.
 */
export interface ResumeContinuePayload {
  action: "continue";
}

/**
 * Resume payload for changing difficulty.
 */
export interface ResumeSetDifficultyPayload {
  action: "set_difficulty";
  difficulty: DifficultyLevel;
}

/**
 * Resume payload for requesting block advance.
 */
export interface ResumeAdvancePayload {
  action: "request_advance";
}

/**
 * Resume payload for pausing the session.
 */
export interface ResumePausePayload {
  action: "pause";
}

/**
 * Union of all resume payload types.
 * Use this as the type for resume() function parameter.
 */
export type ResumePayload =
  | ResumeSubmitPayload
  | ResumeContinuePayload
  | ResumeSetDifficultyPayload
  | ResumeAdvancePayload
  | ResumePausePayload;

// ═══════════════════════════════════════════════════════════════════════════
// TOOL CALL NAMES (Constants)
// These are the exact tool names used in LangGraph tool calls.
// ═══════════════════════════════════════════════════════════════════════════

export const TOOL_NAMES = {
  CONCEPT_PRESENTATION: "concept_presentation",
  PRACTICE_QUESTION: "practice_question",
  PRACTICE_FEEDBACK: "practice_feedback",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS (for runtime validation)
// ═══════════════════════════════════════════════════════════════════════════

export function isResumeSubmitPayload(payload: ResumePayload): payload is ResumeSubmitPayload {
  return payload.action === "submit" && "answer" in payload;
}

export function isResumeContinuePayload(payload: ResumePayload): payload is ResumeContinuePayload {
  return payload.action === "continue";
}

export function isResumeSetDifficultyPayload(payload: ResumePayload): payload is ResumeSetDifficultyPayload {
  return payload.action === "set_difficulty" && "difficulty" in payload;
}

export function isPracticeQuestion(data: unknown): data is PracticeQuestion {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.question_id === "string" &&
    typeof d.block_id === "string" &&
    typeof d.stem === "string" &&
    typeof d.question_type === "string" &&
    ["mcq", "numeric", "structured_response"].includes(d.question_type as string)
  );
}

export function isPracticeFeedback(data: unknown): data is PracticeFeedback {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.is_correct === "boolean" &&
    typeof d.feedback === "string" &&
    typeof d.new_mastery_score === "number"
  );
}

export function isConceptBlock(data: unknown): data is ConceptBlock {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.block_id === "string" &&
    typeof d.title === "string" &&
    typeof d.explanation === "string"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK CONTENT CONTRACT (Frontend-fetched for Reference Panel)
// Source: practice_blocks collection + storage files
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parsed block content loaded from storage files.
 * Used by BlockReferencePanel to display explanatory content during practice.
 *
 * Source: PracticeQuestionDriver.getBlockContent()
 */
export interface ParsedBlockContent {
  /** Unique block identifier */
  blockId: string;

  /** Zero-based index of block in lesson */
  blockIndex: number;

  /** Block title */
  title: string;

  /** Full explanation text (markdown/LaTeX) from storage file */
  explanation: string;

  /** Worked example with problem, steps, and answer */
  worked_example: WorkedExample | null;

  /** Key formulas for this block (LaTeX strings) */
  key_formulas: string[];

  /** Common misconceptions students may have */
  common_misconceptions: string[];
}

export function isParsedBlockContent(data: unknown): data is ParsedBlockContent {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.blockId === "string" &&
    typeof d.blockIndex === "number" &&
    typeof d.title === "string" &&
    typeof d.explanation === "string"
  );
}
