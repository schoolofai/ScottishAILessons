# Mock Exam Frontend Presentation Specification

> **CRITICAL NAMING CLARIFICATION**:
> - This feature is called **"Mock Exam"** - NOT "infinite practice"
> - There is a SEPARATE feature called "infinite-practice" - DO NOT CONFUSE
> - Backend Graph name: `graph_mock_exam`
> - Backend File: `graph_mock_exam.py`

## Overview

This specification defines the frontend implementation for presenting mock exams to students. Unlike interactive LangGraph-based lessons, mock exams are rendered as static pages where students can navigate freely between questions and submit when ready.

## Background

### What Exists (Backend)
| Component | Location | Status |
|-----------|----------|--------|
| Mock Exam Schema Models | `claud_author_agent/src/tools/mock_exam_schema_models.py` | ✅ Complete |
| Mock Exam Author Agent | `claud_author_agent/src/agents/mock_exam_author_agent.py` | ✅ Complete |
| Mock Exam Reviser Agent | `claud_author_agent/src/agents/mock_exam_reviser_agent.py` | ✅ Complete |
| Type Definitions | `assistant-ui-frontend/lib/appwrite/types/index.ts` | ✅ Has `lesson_type: 'mock_exam'` |

### What's Missing (Frontend)
| Component | Status |
|-----------|--------|
| Mock Exam Route/Page | ❌ Not created |
| Question Components (MCQ, Numeric, etc.) | ❌ Not created |
| Exam State Management | ❌ Not created |
| Submission & Grading API | ❌ See [separate spec](./mock-exam-submission-grading-api-spec.md) |

---

## Related Specifications

| Spec | Scope | Can Run In Parallel |
|------|-------|---------------------|
| This spec | Frontend UI (Phases 1-3) | - |
| [mock-exam-submission-grading-api-spec.md](./mock-exam-submission-grading-api-spec.md) | Backend API (Phase 4) | ✅ Yes |

---

## Architecture Decision: Static vs Interactive

### Key Differences

| Aspect | Interactive Lessons | Mock Exams |
|--------|---------------------|------------|
| Question Flow | One at a time, LangGraph-controlled | All visible, student-controlled |
| Navigation | Linear progression | Free navigation between questions |
| Timing | Per-question adaptive | Timed exam with countdown |
| Feedback | Immediate after each answer | After submission only |
| Backend | LangGraph with interrupts + tool calls | Static page + simple grading API |
| Components | `LessonCardPresentationTool`, `PracticeQuestionTool` | New `MockExamPage` components |

### Recommended Approach
**Static React Page** (not LangGraph-based):
1. Fetch mock exam JSON from Appwrite on page load
2. Render all sections/questions in a scrollable form
3. Track answers locally (React state + localStorage persistence)
4. Submit for grading when student clicks "Submit Exam"

---

## Mock Exam Data Structure

### Top-Level `MockExam` Schema
```typescript
interface MockExam {
  schema_version: string;     // "mock_exam_v1"
  examId: string;
  courseId: string;
  sowId: string;
  sowEntryOrder: number;

  metadata: ExamMetadata;
  sections: Section[];
  summary: ExamSummary;

  generated_at: string;
  agent_version: string;
}
```

### `ExamMetadata`
```typescript
interface ExamMetadata {
  title: string;
  subject: string;
  level: string;
  totalMarks: number;
  timeLimit: number;           // minutes
  instructions: string;
  instructions_plain: string;  // CEFR A2-B1 accessible
  calculator_policy: 'non_calc' | 'calc' | 'mixed' | 'exam_conditions';
  exam_conditions: boolean;
  accessibility_profile: AccessibilityProfile;
}
```

### `Section`
```typescript
interface Section {
  section_id: string;
  section_label: string;       // e.g., "Section A: Non-Calculator"
  section_order: number;
  section_marks: number;
  section_time_allocation?: number;
  section_instructions: string;
  questions: Question[];
}
```

### `Question`
```typescript
interface Question {
  question_id: string;
  question_number: number;
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  estimated_minutes: number;
  standards_addressed: StandardRef[];

  question_stem: string;        // Can include LaTeX
  question_stem_plain: string;  // Plain language version

  question_type: 'mcq' | 'mcq_multiselect' | 'numeric' | 'short_text' | 'structured_response';
  cfu_config: CFUConfig;

  hints: string[];              // Max 3
  misconceptions: Misconception[];
  worked_solution: WorkedSolution;
  diagram_refs: string[];
}
```

### `CFUConfig` (Check For Understanding)
```typescript
interface CFUConfig {
  type: QuestionType;
  expected_format?: string;     // e.g., 'algebraic_expression', 'decimal'
  allow_drawing: boolean;
  options?: MCQOption[];        // For MCQ types
  answer_key: AnswerKey;
}

interface MCQOption {
  label: string;    // "A", "B", "C", "D"
  text: string;
  is_correct: boolean;
  feedback?: string;
}
```

---

## Phase 1: Mock Exam Route & Container

### Files to Create
```
assistant-ui-frontend/
├── app/(protected)/exam/
│   ├── [examId]/
│   │   └── page.tsx              # Main exam page
│   └── layout.tsx                # Exam-specific layout (no nav distractions)
├── components/exam/
│   ├── MockExamContainer.tsx     # Main container component
│   ├── ExamHeader.tsx            # Title, timer, progress
│   ├── ExamNav.tsx               # Question navigation sidebar
│   └── ExamSubmitDialog.tsx      # Submission confirmation
```

### Route Implementation
```tsx
// app/(protected)/exam/[examId]/page.tsx
import { MockExamContainer } from "@/components/exam/MockExamContainer";
import { getExamById } from "@/lib/appwrite/exam-service";

export default async function ExamPage({ params }: { params: { examId: string } }) {
  const exam = await getExamById(params.examId);

  if (!exam) {
    return <div>Exam not found</div>;
  }

  return <MockExamContainer exam={exam} />;
}
```

### MockExamContainer Responsibilities
1. Display exam metadata (title, time limit, instructions)
2. Render all sections with question components
3. Track exam state (current section, answered questions)
4. Handle timer countdown
5. Manage submission flow

---

## Phase 2: Question Rendering Components

### Files to Create
```
assistant-ui-frontend/components/exam/questions/
├── QuestionRenderer.tsx       # Dispatches to correct component by type
├── MCQQuestion.tsx            # Single-select MCQ
├── MCQMultiselectQuestion.tsx # Multi-select MCQ
├── NumericQuestion.tsx        # Numeric input
├── ShortTextQuestion.tsx      # Short text input
├── StructuredResponseQuestion.tsx  # Long-form structured response
├── QuestionStem.tsx           # Renders question text with LaTeX
└── QuestionDiagram.tsx        # Displays diagrams (reuse ImageWithZoom)
```

### Component Patterns

#### MCQQuestion
```tsx
interface MCQQuestionProps {
  question: Question;
  selectedOption: string | null;
  onSelect: (label: string) => void;
  showPlainLanguage: boolean;
}

export function MCQQuestion({ question, selectedOption, onSelect, showPlainLanguage }: MCQQuestionProps) {
  const { cfu_config } = question;

  return (
    <Card>
      <QuestionStem
        stem={showPlainLanguage ? question.question_stem_plain : question.question_stem}
      />
      <RadioGroup value={selectedOption} onValueChange={onSelect}>
        {cfu_config.options?.map((option) => (
          <div key={option.label} className="flex items-center space-x-2">
            <RadioGroupItem value={option.label} id={`option-${option.label}`} />
            <Label htmlFor={`option-${option.label}`}>
              <span className="font-medium">{option.label}.</span> {option.text}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </Card>
  );
}
```

#### NumericQuestion
```tsx
interface NumericQuestionProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

export function NumericQuestion({ question, value, onChange }: NumericQuestionProps) {
  return (
    <Card>
      <QuestionStem stem={question.question_stem} />
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your answer"
      />
      {question.cfu_config.expected_format && (
        <p className="text-sm text-muted-foreground">
          Expected format: {question.cfu_config.expected_format}
        </p>
      )}
    </Card>
  );
}
```

#### StructuredResponseQuestion
```tsx
interface StructuredResponseQuestionProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

export function StructuredResponseQuestion({ question, value, onChange }: StructuredResponseQuestionProps) {
  return (
    <Card>
      <QuestionStem stem={question.question_stem} />
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your response here..."
        rows={8}
      />
      <p className="text-sm text-muted-foreground">
        This question is worth {question.marks} marks
      </p>
    </Card>
  );
}
```

---

## Phase 3: State Management

### Files to Create
```
assistant-ui-frontend/lib/exam/
├── useExamState.ts           # Main exam state hook
├── useExamTimer.ts           # Timer management
├── useExamPersistence.ts     # localStorage persistence
└── types.ts                  # Exam state types
```

### State Structure
```typescript
interface ExamState {
  // Exam data (from Appwrite)
  exam: MockExam;

  // Student answers
  answers: Record<string, AnswerResponse>;  // question_id -> response

  // Navigation
  currentSectionIndex: number;
  currentQuestionIndex: number;

  // Flags
  flaggedQuestions: Set<string>;

  // Timer
  startedAt: Date;
  timeRemaining: number;  // seconds

  // Submission
  isSubmitting: boolean;
  isSubmitted: boolean;
}

interface AnswerResponse {
  selected_option?: string;           // MCQ single
  selected_options?: string[];        // MCQ multi
  response_text?: string;             // Short text / Structured
  numeric_value?: number;             // Numeric
  time_spent_seconds: number;
  was_changed: boolean;
  change_count: number;
}
```

### useExamState Hook
```typescript
export function useExamState(exam: MockExam) {
  const [answers, setAnswers] = useState<Record<string, AnswerResponse>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`exam-${exam.examId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setAnswers(parsed.answers);
      setFlagged(new Set(parsed.flagged));
    }
  }, [exam.examId]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(`exam-${exam.examId}`, JSON.stringify({
      answers,
      flagged: Array.from(flagged),
    }));
  }, [answers, flagged, exam.examId]);

  const updateAnswer = (questionId: string, response: Partial<AnswerResponse>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...response,
        was_changed: Boolean(prev[questionId]),
        change_count: (prev[questionId]?.change_count || 0) + 1,
      },
    }));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  return { answers, flagged, updateAnswer, toggleFlag };
}
```

### useExamTimer Hook
```typescript
export function useExamTimer(timeLimitMinutes: number, onTimeUp: () => void) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimitMinutes * 60);
  const [startedAt] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return { timeRemaining, startedAt, formatTime };
}
```

---

## Phase 4: Submission & Grading (Backend Integration)

> **📄 Full Backend Specification**: [mock-exam-submission-grading-api-spec.md](./mock-exam-submission-grading-api-spec.md)

### Architecture Decision: LangGraph Agent

The backend uses a **LangGraph `create_agent`** approach instead of traditional API routes:

| Component | Implementation |
|-----------|----------------|
| Graph Name | `graph_mock_exam` |
| Location | `langgraph-agent/src/agent/graph_mock_exam.py` |
| Pattern | `create_agent` with `ToolStrategy(EvaluationResult)` |
| Model | `gpt-5.1-mini` |
| Architecture | **Appwrite-agnostic** (backend has NO database access) |

### Why LangGraph?
- **LLM-powered grading** for structured response questions
- **Automatic structured output** validation via Pydantic
- **Personalized learning recommendations** generated by Claude
- **Consistent** with existing teaching graph architecture

### Frontend Integration

#### Files to Create

```
assistant-ui-frontend/lib/exam/
├── submit-exam.ts          # LangGraph SDK client
├── types.ts                # TypeScript types matching Pydantic models
└── exam-service.ts         # Appwrite service for fetching exams
```

#### Submitting to LangGraph

> **Appwrite-Agnostic Pattern**: The frontend handles ALL Appwrite CRUD. Backend is a pure processing engine.

```typescript
// lib/exam/submit-exam.ts
import { Client } from "@langchain/langgraph-sdk";
import { ExamSubmissionWithExam, EvaluationResult } from "./types";

/**
 * Send exam submission to LangGraph for grading.
 *
 * NOTE: The backend does NOT access Appwrite. All exam data is included
 * in the input, and the result is returned to the frontend for storage.
 */
export async function submitExamForGrading(
  submissionWithExam: ExamSubmissionWithExam
): Promise<EvaluationResult> {
  const client = new Client({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024"
  });

  // Create a run on the graph_mock_exam graph
  // Backend receives all data it needs - no Appwrite access required
  const run = await client.runs.create(
    null, // thread_id - stateless for exam grading
    "graph_mock_exam", // assistant_id (graph name)
    {
      input: {
        messages: [],
        exam_submission: submissionWithExam  // Includes mock_exam data!
      }
    }
  );

  // Wait for completion and get structured response
  const result = await client.runs.wait(run.run_id);
  return result.structured_response as EvaluationResult;
}
```

#### Building the Submission Payload

```typescript
// In MockExamContainer.tsx
const handleSubmit = async () => {
  const submission: ExamSubmission = {
    submission_id: `sub_${Date.now()}`,
    exam_id: exam.examId,
    attempt_id: attemptId,
    student_id: studentId,
    course_id: exam.courseId,
    submission_metadata: {
      started_at: startedAt.toISOString(),
      submitted_at: new Date().toISOString(),
      time_limit_minutes: exam.metadata.timeLimit,
      time_spent_minutes: calculateTimeSpent(),
      time_overage_minutes: Math.max(0, calculateTimeSpent() - exam.metadata.timeLimit),
      was_auto_submitted: false
    },
    answers: Object.entries(answers).map(([questionId, response]) => ({
      question_id: questionId,
      question_number: getQuestionNumber(questionId),
      section_id: getSectionId(questionId),
      question_type: getQuestionType(questionId),
      response: response,
      time_spent_seconds: response.time_spent_seconds || 0,
      was_flagged: flagged.has(questionId),
      was_changed: response.was_changed || false,
      change_count: response.change_count || 0
    })),
    exam_context: {
      total_questions: getTotalQuestions(),
      questions_answered: Object.keys(answers).length,
      questions_skipped: getTotalQuestions() - Object.keys(answers).length,
      questions_flagged: flagged.size,
      sections_completed: getCompletedSections()
    }
  };

  try {
    const result = await submitExamForGrading(submission);
    setEvaluationResult(result);
    setShowResults(true);
  } catch (error) {
    console.error("Submission failed:", error);
    throw error; // Fast fail per CLAUDE.md
  }
};
```

### Displaying Results

After submission, the frontend receives an `EvaluationResult`:

```typescript
interface EvaluationResult {
  evaluation_id: string;
  submission_id: string;
  evaluated_at: string;
  overall_result: {
    total_marks_earned: number;
    total_marks_possible: number;
    percentage: number;
    grade: string;        // "A", "B", "C", "D", "No Award"
    pass_status: boolean;
    pass_threshold: number;
  };
  section_results: SectionResult[];
  question_feedback: QuestionFeedback[];  // Constructive feedback per question
  learning_recommendations: LearningRecommendation[];  // AI-generated actionable recommendations
  encouragement_message: string;  // Personalized encouragement
}
```

#### TypeScript Types (Matching Backend Pydantic Models)

> **IMPORTANT**: These types MUST match the Pydantic models in `mock_exam_schema_models.py`

```typescript
// lib/exam/types.ts

/** Constructive feedback for a single question - generated by LLM */
interface QuestionFeedback {
  question_id: string;
  question_number: number;
  section_id: string;

  // Grading result
  marks_earned: number;
  marks_possible: number;
  is_correct: boolean;
  is_partially_correct?: boolean;

  // Constructive feedback components
  feedback_summary: string;  // 1-2 sentence summary
  what_you_did_well?: string;  // Positive reinforcement
  where_you_went_wrong?: string;  // Only if incorrect
  correct_approach: string;  // Step-by-step explanation

  // For structured responses
  marking_breakdown?: MarkingCriterionResult[];

  // Misconception detection
  misconception_detected?: MisconceptionFeedback;

  // Learning pointers
  related_concept: string;
  suggested_review?: string;
}

interface MarkingCriterionResult {
  criterion_name: string;
  criterion_description: string;
  marks_earned: number;
  marks_possible: number;
  feedback: string;
  evidence_seen?: string;
}

interface MisconceptionFeedback {
  misconception_type: string;
  common_error: string;
  why_its_wrong: string;
  correct_thinking: string;
  practice_suggestion: string;
}

interface LearningRecommendation {
  priority: number;  // 1 = most important
  topic: string;
  reason: string;
  action: string;
  related_questions: number[];
}

interface SectionResult {
  section_id: string;
  section_label: string;
  total_marks_earned: number;
  total_marks_possible: number;
  percentage: number;
}
```

#### Results Display Component

```tsx
// components/exam/ExamResultsView.tsx
function ExamResultsView({ result }: { result: EvaluationResult }) {
  return (
    <div className="space-y-6">
      {/* Encouragement Message */}
      <Card className="bg-exam-surface border-exam-scottish-teal">
        <CardContent className="pt-6 text-center">
          <p className="text-lg italic text-text-secondary">
            "{result.encouragement_message}"
          </p>
        </CardContent>
      </Card>

      {/* Overall Result Banner */}
      <Card className={result.overall_result.pass_status ? "border-exam-success" : "border-exam-danger"}>
        <CardHeader>
          <CardTitle>Grade: {result.overall_result.grade}</CardTitle>
          <CardDescription>
            {result.overall_result.total_marks_earned} / {result.overall_result.total_marks_possible} marks
            ({result.overall_result.percentage.toFixed(1)}%)
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Learning Recommendations - Using new LearningRecommendation model */}
      <LearningRecommendations recommendations={result.learning_recommendations} />

      {/* Per-Question Constructive Feedback */}
      {result.question_feedback.map((feedback) => (
        <QuestionFeedbackCard key={feedback.question_id} feedback={feedback} />
      ))}
    </div>
  );
}
```

### Backend Collections (Verified)

| Collection | Database | Status |
|------------|----------|--------|
| `mock_exams` | `default` | ✅ Exists (stores exam JSON) |
| `exam_attempts` | `default` | ✅ Exists (stores submissions & results) |

### Estimated Backend Effort: 8-10 hours
(See [backend spec](./mock-exam-submission-grading-api-spec.md) for detailed breakdown)

---

## Critical Files Reference

### Backend Schema (Source of Truth)
- `claud_author_agent/src/tools/mock_exam_schema_models.py` - Complete Pydantic models

### Existing Frontend Patterns
- `components/tools/PracticeQuestionTool.tsx` - Question rendering with MCQ, numeric types
- `components/tools/LessonCardPresentationTool.tsx` - Card-based content display
- `components/markdown-message.tsx` - LaTeX/MathJax rendering

### Type Definitions
- `lib/appwrite/types/index.ts` - Has `lesson_type: 'mock_exam'`

---

## UI/UX Design System

### Design Direction: "Scholarly Confidence Builder"

A **refined, scholarly aesthetic** that builds student confidence through warm, encouraging design. Inspired by premium educational platforms (Khan Academy's calm approach, Duolingo's micro-interactions) combined with Scottish heritage touches.

**Tone**: Refined academic luxury meets encouraging warmth
**NOT**: Generic exam software, cold clinical interfaces, or anxiety-inducing countdown timers

### Memorable Differentiator
The **"Progress Pulse"** - a gentle, breathing animation around completed questions that creates a sense of accomplishment. Students feel they're building something, not just answering questions.

---

### Color System (OKLCH)

```css
/* Primary Palette - Scottish Academic */
--exam-bg-primary: oklch(0.98 0.005 240);      /* Warm off-white parchment */
--exam-bg-secondary: oklch(0.95 0.01 45);      /* Cream paper */
--exam-surface: oklch(1 0 0);                   /* Pure white cards */
--exam-surface-hover: oklch(0.99 0.01 230);    /* Subtle blue tint on hover */

/* Scottish Heritage Accents */
--exam-scottish-blue: oklch(0.35 0.12 250);    /* Deep Scottish blue */
--exam-scottish-teal: oklch(0.50 0.12 195);    /* Loch teal */
--exam-heather: oklch(0.55 0.15 310);          /* Scottish heather purple */
--exam-moss: oklch(0.55 0.14 145);             /* Highland moss green */

/* Semantic Colors - Encouraging, Not Harsh */
--exam-success: oklch(0.62 0.16 155);          /* Soft moss green */
--exam-success-bg: oklch(0.95 0.04 155);       /* Success background */
--exam-warning: oklch(0.72 0.15 70);           /* Warm amber */
--exam-warning-bg: oklch(0.96 0.04 70);        /* Warning background */
--exam-danger: oklch(0.55 0.18 25);            /* Muted coral (not alarming red) */
--exam-danger-bg: oklch(0.96 0.04 25);         /* Danger background */

/* Timer States - Gradual Transition */
--timer-safe: oklch(0.50 0.12 195);            /* Calm teal */
--timer-caution: oklch(0.68 0.14 70);          /* Warm amber */
--timer-urgent: oklch(0.55 0.18 25);           /* Muted coral */

/* Text Hierarchy */
--text-primary: oklch(0.20 0.02 250);          /* Near-black with blue hint */
--text-secondary: oklch(0.45 0.02 250);        /* Medium gray-blue */
--text-muted: oklch(0.60 0.01 250);            /* Light gray */
--text-inverse: oklch(0.98 0.005 240);         /* For dark backgrounds */

/* Interactive Elements */
--exam-focus-ring: oklch(0.50 0.12 195 / 0.4); /* Teal focus ring */
--exam-border: oklch(0.88 0.01 250);           /* Subtle borders */
--exam-border-active: oklch(0.50 0.12 195);    /* Active state border */
```

---

### Typography System

```css
/* Display Font - Distinctive & Academic */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');

/* Body Font - Readable & Modern */
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap');

/* Mono Font - For numeric answers */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Source Serif 4', Georgia, serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Type Scale - Generous for Readability */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px - Body text */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px - Exam title */

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.6;
  --leading-relaxed: 1.75;
}
```

---

### Component Architecture

```
assistant-ui-frontend/
├── app/(protected)/exam/
│   ├── [examId]/
│   │   ├── page.tsx              # Server component - data fetching
│   │   └── loading.tsx           # Skeleton loading state
│   └── layout.tsx                # Exam-specific layout (no nav)
├── components/exam/
│   ├── ExamShell.tsx             # Main container with sidebar
│   ├── ExamHeader.tsx            # Title, timer, progress
│   ├── ExamTimer.tsx             # Animated countdown
│   ├── ExamSidebar.tsx           # Question navigation
│   ├── ExamProgress.tsx          # Visual progress indicator
│   ├── QuestionCard.tsx          # Individual question wrapper
│   ├── QuestionStem.tsx          # Question text with LaTeX
│   ├── SubmitDialog.tsx          # Confirmation before submit
│   ├── ResultsView.tsx           # Post-submission results
│   ├── questions/
│   │   ├── MCQQuestion.tsx       # Single-select MCQ
│   │   ├── MCQMultiQuestion.tsx  # Multi-select MCQ
│   │   ├── NumericQuestion.tsx   # Numeric input
│   │   ├── ShortTextQuestion.tsx # Short answer
│   │   └── StructuredQuestion.tsx # Long-form response
│   └── results/
│       ├── OverallScore.tsx      # Grade display
│       ├── SectionBreakdown.tsx  # Per-section results
│       ├── QuestionFeedback.tsx  # Per-question feedback
│       └── Recommendations.tsx   # AI learning recommendations
├── lib/exam/
│   ├── useExamState.ts           # Main state hook
│   ├── useExamTimer.ts           # Timer logic
│   ├── useExamPersistence.ts     # localStorage
│   ├── fetch-exam.ts             # Appwrite fetch
│   ├── submit-exam.ts            # LangGraph submission
│   ├── store-result.ts           # Appwrite store
│   └── types.ts                  # TypeScript types
└── styles/
    └── exam-theme.css            # OKLCH color tokens
```

---

### Animation Strategy

#### 1. Page Load - Scholarly Reveal
```css
/* Staggered entrance for academic gravitas */
@keyframes scholarly-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.exam-header { animation: scholarly-reveal 0.6s ease-out; }
.exam-sidebar { animation: scholarly-reveal 0.6s ease-out 0.1s backwards; }
.question-card { animation: scholarly-reveal 0.6s ease-out 0.2s backwards; }
```

#### 2. Progress Pulse - Accomplishment Feedback
```css
/* Gentle pulse on completed questions */
@keyframes progress-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 oklch(0.62 0.16 155 / 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px oklch(0.62 0.16 155 / 0);
  }
}

.question-complete {
  animation: progress-pulse 2s ease-in-out infinite;
}
```

#### 3. Timer Transitions - Gentle Urgency
```css
/* Smooth color transitions as time decreases */
.exam-timer {
  transition: color 3s ease, background-color 3s ease;
}

.exam-timer[data-state="safe"] {
  color: var(--timer-safe);
}
.exam-timer[data-state="caution"] {
  color: var(--timer-caution);
}
.exam-timer[data-state="urgent"] {
  color: var(--timer-urgent);
  animation: gentle-pulse 1.5s ease-in-out infinite;
}
```

#### 4. Question Navigation - Smooth Scroll
```tsx
// Using Framer Motion for question transitions
import { motion, AnimatePresence } from 'framer-motion';

const questionVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};
```

---

### Component Wireframes

#### ExamHeader
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  📖 National 5 Mathematics                                          │
│  Mock Exam: Unit Assessment 2                          ⏱ 45:00     │
│                                                                     │
│  ────────────────────────────────────────────────────────────────── │
│  Progress: ████████░░░░░░░░░░░░  8 of 20 answered                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### ExamSidebar - Question Navigator
```
┌──────────────────┐
│  Questions       │
│                  │
│  Section A       │
│  ┌────┬────┐    │
│  │ 1 ✓│ 2 ✓│    │  ✓ = Answered (green)
│  ├────┼────┤    │
│  │ 3 ⚑│ 4 ○│    │  ⚑ = Flagged (amber)
│  ├────┼────┤    │
│  │ 5 ●│ 6 ○│    │  ● = Current (blue ring)
│  └────┴────┘    │  ○ = Unanswered (gray)
│                  │
│  Section B       │
│  ┌────┬────┐    │
│  │ 7 ○│ 8 ○│    │
│  └────┴────┘    │
│                  │
│  ──────────────  │
│  [Submit Exam]   │
│                  │
└──────────────────┘
```

#### QuestionCard - MCQ Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│  Question 5                                              [⚑ Flag]   │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  A bag contains 3 red balls and 5 blue balls.                       │
│  What is the probability of selecting a red ball?                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ○  A.  3/8                                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ●  B.  5/8                                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ○  C.  3/5                                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ○  D.  5/3                                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  [< Previous]                      (2 marks)           [Next >]     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Results Page Design

#### Grade Display with Celebration
```tsx
// Animated grade reveal
<motion.div
  initial={{ scale: 0, rotate: -180 }}
  animate={{ scale: 1, rotate: 0 }}
  transition={{ type: "spring", duration: 0.8 }}
  className="grade-badge"
>
  <span className="grade-letter">B</span>
  <span className="grade-percentage">65%</span>
</motion.div>
```

#### Visual Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        🎉 Well Done!                                │
│                                                                     │
│                    ┌───────────────┐                               │
│                    │               │                               │
│                    │      B        │   Grade                       │
│                    │     65%       │                               │
│                    │               │                               │
│                    └───────────────┘                               │
│                                                                     │
│           26 / 40 marks  •  Pass Threshold: 40%                    │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Section Breakdown                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Section A: Non-Calculator    ████████████░░░░  75%  (15/20)  │  │
│  │ Section B: Calculator        █████████░░░░░░░  55%  (11/20)  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  📚 What to Focus On Next                                          │
│  • Practice factorising quadratic expressions                      │
│  • Review probability calculations with fractions                  │
│  • Work on showing working for multi-step problems                 │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  [Review Answers]              [Return to Course]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Accessibility Features

#### 1. Plain Language Toggle
```tsx
// In ExamHeader
<Toggle
  pressed={usePlainLanguage}
  onPressedChange={setUsePlainLanguage}
  aria-label="Toggle plain language mode"
>
  <span className="sr-only">Plain Language</span>
  Aa
</Toggle>
```

#### 2. High Contrast Mode
```css
/* Automatic via prefers-contrast */
@media (prefers-contrast: high) {
  :root {
    --exam-bg-primary: oklch(1 0 0);
    --exam-border: oklch(0 0 0);
    --text-primary: oklch(0 0 0);
  }
}
```

#### 3. Dyslexia-Friendly Font Toggle
```css
.dyslexia-friendly {
  --font-body: 'OpenDyslexic', sans-serif;
  letter-spacing: 0.05em;
  line-height: 1.8;
}
```

#### 4. Keyboard Navigation
- `Tab` / `Shift+Tab`: Navigate between options
- `Enter` / `Space`: Select option
- `F`: Flag current question
- `N` / `P`: Next / Previous question
- `1-9`: Jump to question number

---

### Mobile Responsiveness

#### Breakpoints
```css
/* Mobile-first approach */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

#### Mobile Layout (< 768px)
- Sidebar becomes bottom sheet (slide up)
- Timer moves to sticky header
- Question navigation becomes horizontal scroll
- Submit button fixed at bottom

```tsx
// Mobile sidebar as bottom sheet
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline" className="fixed bottom-4 right-4 md:hidden">
      <Grid3X3 className="h-4 w-4" />
      Questions
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[60vh]">
    <ExamSidebar />
  </SheetContent>
</Sheet>
```

---

## UX Flow & User Journey Storyboard

> **Design Philosophy**: Guide the student through a calm, confidence-building exam experience.
> Every interaction should reduce anxiety while maintaining academic rigor.

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   USER JOURNEY: MOCK EXAM EXPERIENCE                                        │
│                                                                             │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐         │
│   │  1. ENTRY │───>│ 2. EXAM   │───>│ 3. SUBMIT │───>│ 4. RESULTS│         │
│   │   POINT   │    │  TAKING   │    │ CONFIRM   │    │  & REVIEW │         │
│   └───────────┘    └───────────┘    └───────────┘    └───────────┘         │
│        │                │                │                │                │
│        ▼                ▼                ▼                ▼                │
│   • Course page    • Timer visible  • Summary view   • Grade reveal       │
│   • Exam card      • Free nav       • Unanswered?    • Constructive       │
│   • Start button   • Flag/skip      • Final check      feedback           │
│   • Instructions   • Save progress  • Confirm         • Learning recs     │
│                                                       • Review answers    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Stage 1: Entry Point (Pre-Exam)

**User arrives from**: Course page → Exam card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  📝 National 5 Mathematics                                          │   │
│  │     Mock Exam: Unit Assessment 2                                    │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  ⏱  Time Limit:    45 minutes                                      │   │
│  │  📊 Total Marks:   40 marks                                        │   │
│  │  📋 Sections:      2 (Non-Calculator + Calculator)                 │   │
│  │  ✏️  Questions:     20 questions                                    │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  📖 Instructions                                                    │   │
│  │  • Answer all questions in both sections                           │   │
│  │  • Section A: No calculator allowed                                │   │
│  │  • Section B: Calculator may be used                               │   │
│  │  • Show your working for full marks                                │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  ⚙️  Accessibility Options                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ ☐ Plain language mode (simpler wording)                     │   │   │
│  │  │ ☐ Dyslexia-friendly font                                    │   │   │
│  │  │ ☐ High contrast mode                                        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │         ┌─────────────────────────────────────┐                    │   │
│  │         │       🚀 Start Exam                  │                    │   │
│  │         └─────────────────────────────────────┘                    │   │
│  │                                                                     │   │
│  │  💡 Tip: Your progress is saved automatically. If you close the    │   │
│  │     browser, you can continue where you left off.                  │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key UX Elements**:
- Clear exam metadata before starting
- Accessibility options visible upfront
- Reassurance about progress saving
- Single prominent CTA button

---

### Stage 2: Exam Taking (Main Experience)

**Layout**: Two-column with sidebar navigation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📖 National 5 Mathematics                              ⏱ 38:42 remaining  │
│  ────────────────────────────────────────────────────────────────────────── │
│  Progress: ████████████░░░░░░░░░░░░░  12 of 20 answered                    │
├──────────────────┬──────────────────────────────────────────────────────────┤
│                  │                                                          │
│  📋 Questions    │  Section A: Non-Calculator                               │
│                  │                                                          │
│  Section A       │  ┌────────────────────────────────────────────────────┐  │
│  ┌─────┬─────┐  │  │  Question 5 of 20                      [⚑ Flag]    │  │
│  │  1 ✓│  2 ✓│  │  │                                                    │  │
│  ├─────┼─────┤  │  │  A bag contains 3 red balls and 5 blue balls.      │  │
│  │  3 ✓│  4 ✓│  │  │  A ball is selected at random.                      │  │
│  ├─────┼─────┤  │  │                                                    │  │
│  │  5 ●│  6 ○│  │  │  What is the probability of selecting a red ball?  │  │
│  ├─────┼─────┤  │  │                                                    │  │
│  │  7 ○│  8 ○│  │  │  ┌──────────────────────────────────────────────┐  │  │
│  ├─────┼─────┤  │  │  │  ○  A.  ³⁄₅                                  │  │  │
│  │  9 ○│ 10 ○│  │  │  └──────────────────────────────────────────────┘  │  │
│  └─────┴─────┘  │  │  ┌──────────────────────────────────────────────┐  │  │
│                  │  │  │  ○  B.  ⁵⁄₈                                  │  │  │
│  Section B       │  │  └──────────────────────────────────────────────┘  │  │
│  ┌─────┬─────┐  │  │  ┌──────────────────────────────────────────────┐  │  │
│  │ 11 ○│ 12 ○│  │  │  │  ●  C.  ³⁄₈  ← Selected                     │  │  │
│  ├─────┼─────┤  │  │  └──────────────────────────────────────────────┘  │  │
│  │ 13 ○│ 14 ○│  │  │  ┌──────────────────────────────────────────────┐  │  │
│  ├─────┼─────┤  │  │  │  ○  D.  ⁸⁄₃                                  │  │  │
│  │ 15 ○│ 16 ○│  │  │  └──────────────────────────────────────────────┘  │  │
│  ├─────┼─────┤  │  │                                                    │  │
│  │ 17 ○│ 18 ○│  │  │  ────────────────────────────────────────────────  │  │
│  ├─────┼─────┤  │  │                                                    │  │
│  │ 19 ○│ 20 ○│  │  │  [← Previous]         (2 marks)         [Next →]  │  │
│  └─────┴─────┘  │  │                                                    │  │
│                  │  └────────────────────────────────────────────────────┘  │
│  ──────────────  │                                                          │
│                  │                                                          │
│  📊 Summary      │                                                          │
│  ✓ 12 answered   │                                                          │
│  ○ 8 remaining   │                                                          │
│  ⚑ 2 flagged     │                                                          │
│                  │                                                          │
│  ──────────────  │                                                          │
│                  │                                                          │
│  ┌────────────┐  │                                                          │
│  │Submit Exam │  │                                                          │
│  └────────────┘  │                                                          │
│                  │                                                          │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

**Key UX Elements**:
- Timer visible but not dominant (stress reduction)
- Question grid shows status at a glance
- Flag button for questions to revisit
- Progress bar provides sense of accomplishment
- Previous/Next for linear navigation
- Grid for random access navigation

---

### Stage 3: Submit Confirmation

**Triggered by**: Click "Submit Exam" button

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │               📋 Ready to Submit?                                   │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Your Exam Summary                                                  │   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                               │ │   │
│  │  │   ✓  18 questions answered                                    │ │   │
│  │  │   ○  2 questions unanswered (Q7, Q15)                         │ │   │
│  │  │   ⚑  1 question flagged (Q12)                                 │ │   │
│  │  │                                                               │ │   │
│  │  │   ⏱  Time used: 38 minutes 42 seconds                         │ │   │
│  │  │                                                               │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ⚠️  You have 2 unanswered questions.                              │   │
│  │     Would you like to review them before submitting?               │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  ┌─────────────────────┐     ┌─────────────────────────────────┐   │   │
│  │  │  ← Review Answers   │     │      ✓ Submit Exam              │   │   │
│  │  └─────────────────────┘     └─────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  💡 Once submitted, you cannot change your answers.                │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key UX Elements**:
- Clear summary of completion status
- Warning for unanswered questions
- Option to go back and review
- Final confirmation before irrevocable action

---

### Stage 4: Results & Feedback Presentation

> **CRITICAL**: This is where the LLM-generated constructive feedback shines.
> The feedback presentation must be encouraging, educational, and actionable.

#### 4a. Grade Reveal (Initial View)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           ┌─────────────────┐                              │
│                           │                 │                              │
│                           │    🎉 Well      │                              │
│                           │     Done!       │                              │
│                           │                 │                              │
│                           │   ┌───────┐     │                              │
│                           │   │   B   │     │  Grade                       │
│                           │   │  65%  │     │                              │
│                           │   └───────┘     │                              │
│                           │                 │                              │
│                           │  26 / 40 marks  │                              │
│                           │                 │                              │
│                           └─────────────────┘                              │
│                                                                             │
│     "Great effort! You've shown solid understanding of the core concepts.  │
│      Let's look at where you can improve to reach that A grade."           │
│                                           - Your AI Learning Assistant      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ Section Breakdown                                                     │ │
│   │                                                                       │ │
│   │ Section A: Non-Calculator    ████████████████░░░░  80%  (16/20)      │ │
│   │ Section B: Calculator        ██████████░░░░░░░░░░  50%  (10/20)      │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │      📚 View Detailed Feedback      │      🏠 Return to Course     │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Animation**: Grade badge animates in with a spring effect (scale 0→1, rotate -180→0)

---

#### 4b. Detailed Feedback View (Per-Question)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Detailed Feedback                                   Grade: B (65%)     │
│  ────────────────────────────────────────────────────────────────────────── │
├──────────────────┬──────────────────────────────────────────────────────────┤
│                  │                                                          │
│  🎯 Quick Nav    │  ┌────────────────────────────────────────────────────┐  │
│                  │  │                                                    │  │
│  Filter:         │  │  Question 5                                ✓ 2/2  │  │
│  ┌────────────┐  │  │  ─────────────────────────────────────────────    │  │
│  │ ○ All      │  │  │                                                    │  │
│  │ ○ Correct  │  │  │  A bag contains 3 red balls and 5 blue balls.      │  │
│  │ ● Incorrect│  │  │  What is the probability of selecting a red ball?  │  │
│  │ ○ Partial  │  │  │                                                    │  │
│  └────────────┘  │  │  Your answer: C. ³⁄₈  ✓ Correct                    │  │
│                  │  │                                                    │  │
│  Jump to:        │  │  ┌────────────────────────────────────────────┐    │  │
│  ┌─────┬─────┐  │  │  │ 🌟 What you did well                       │    │  │
│  │ 1 ✓│ 2 ✓│  │  │  │                                            │    │  │
│  │ 3 ✗│ 4 ✓│  │  │  │ You correctly identified that probability  │    │  │
│  │ 5 ✓│ 6 ✓│  │  │  │ is calculated as favorable outcomes over   │    │  │
│  │ 7 ✗│ 8 ✓│  │  │  │ total outcomes. Well done!                 │    │  │
│  │ ...│   │  │  │  │                                            │    │  │
│  └─────┴─────┘  │  │  └────────────────────────────────────────────┘    │  │
│                  │  │                                                    │  │
│                  │  └────────────────────────────────────────────────────┘  │
│                  │                                                          │
│                  │  ┌────────────────────────────────────────────────────┐  │
│                  │  │                                                    │  │
│                  │  │  Question 7                                ✗ 0/3  │  │
│                  │  │  ─────────────────────────────────────────────    │  │
│                  │  │                                                    │  │
│                  │  │  Factorise completely: 2x² + 5x - 3               │  │
│                  │  │                                                    │  │
│                  │  │  Your answer: (2x - 1)(x + 3)                      │  │
│                  │  │  Correct answer: (2x - 1)(x + 3)... wait, that's   │  │
│                  │  │  actually correct! Let me check...                 │  │
│                  │  │                                                    │  │
│                  │  │  ┌────────────────────────────────────────────┐    │  │
│                  │  │  │ ⚠️  Where it went wrong                    │    │  │
│                  │  │  │                                            │    │  │
│                  │  │  │ Your factorisation (2x-1)(x+3) expands to  │    │  │
│                  │  │  │ 2x² + 6x - x - 3 = 2x² + 5x - 3 ✓         │    │  │
│                  │  │  │                                            │    │  │
│                  │  │  │ Actually, this IS correct! The marks were  │    │  │
│                  │  │  │ lost because you didn't show your working. │    │  │
│                  │  │  │                                            │    │  │
│                  │  │  └────────────────────────────────────────────┘    │  │
│                  │  │                                                    │  │
│                  │  │  ┌────────────────────────────────────────────┐    │  │
│                  │  │  │ 💡 Correct approach                        │    │  │
│                  │  │  │                                            │    │  │
│                  │  │  │ For full marks, show these steps:          │    │  │
│                  │  │  │ 1. Identify factors: a×c = 2×(-3) = -6    │    │  │
│                  │  │  │ 2. Find pair: -1 × 6 = -6, -1+6 = 5 ✓     │    │  │
│                  │  │  │ 3. Split: 2x² - x + 6x - 3                 │    │  │
│                  │  │  │ 4. Group: x(2x-1) + 3(2x-1)               │    │  │
│                  │  │  │ 5. Factor: (2x-1)(x+3) ✓                  │    │  │
│                  │  │  │                                            │    │  │
│                  │  │  └────────────────────────────────────────────┘    │  │
│                  │  │                                                    │  │
│                  │  │  📚 Related concept: Factorising Quadratics       │  │
│                  │  │                                                    │  │
│                  │  └────────────────────────────────────────────────────┘  │
│                  │                                                          │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

**Key UX Elements**:
- Filter to focus on incorrect answers
- Jump navigation for quick access
- Collapsible feedback sections
- Clear visual distinction between correct/incorrect

---

#### 4c. Learning Recommendations (Actionable Next Steps)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  📚 Your Learning Recommendations                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Based on your exam performance, here's what to focus on next:             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔴 Priority 1: Showing Working in Algebra                          │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Why: You lost marks on Questions 7, 12, 15 because you didn't     │   │
│  │       show your working, even though your answers were correct.     │   │
│  │                                                                     │   │
│  │  Action: Practice writing out each step of your working.            │   │
│  │          In exams, partial marks are awarded for correct method     │   │
│  │          even if the final answer is wrong.                         │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ 📖 Review: Chapter 4.3 - Algebraic Working                  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🟡 Priority 2: Calculator Efficiency                               │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Why: Section B (Calculator) scored lower than Section A.           │   │
│  │       This suggests calculator skills may need practice.            │   │
│  │                                                                     │   │
│  │  Action: Practice using your calculator for trigonometry and        │   │
│  │          statistical calculations. Know which buttons to use!       │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ 📖 Review: Calculator Skills Guide                          │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🟢 Priority 3: Probability with Fractions                          │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Why: Q14 showed confusion between P(A) and P(not A).              │   │
│  │       This is a common misconception that's easy to fix!            │   │
│  │                                                                     │   │
│  │  Action: When calculating probability, always label what you're     │   │
│  │          finding FIRST. "I want P(red)" means red goes on top.      │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ 📖 Review: Probability Fundamentals                         │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feedback Presentation Components

### Component: `QuestionFeedbackCard`

Renders LLM-generated feedback for a single question.

```tsx
// components/exam/results/QuestionFeedbackCard.tsx

interface QuestionFeedbackCardProps {
  feedback: QuestionFeedback;
  question: Question;
  studentAnswer: SubmittedAnswer;
  isExpanded: boolean;
  onToggle: () => void;
}

export function QuestionFeedbackCard({
  feedback,
  question,
  studentAnswer,
  isExpanded,
  onToggle
}: QuestionFeedbackCardProps) {
  const isCorrect = feedback.is_correct;
  const isPartial = feedback.is_partially_correct;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isCorrect && "border-l-4 border-l-exam-success",
        isPartial && "border-l-4 border-l-exam-warning",
        !isCorrect && !isPartial && "border-l-4 border-l-exam-danger"
      )}
    >
      {/* Header - Always visible */}
      <CardHeader
        className="cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg">
              Question {feedback.question_number}
            </span>
            <Badge variant={isCorrect ? "success" : isPartial ? "warning" : "destructive"}>
              {feedback.marks_earned}/{feedback.marks_possible}
            </Badge>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {feedback.feedback_summary}
        </p>
      </CardHeader>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="pt-0 space-y-4">
              {/* What You Did Well */}
              {feedback.what_you_did_well && (
                <FeedbackSection
                  icon={<Star className="h-4 w-4 text-exam-success" />}
                  title="What you did well"
                  variant="success"
                >
                  {feedback.what_you_did_well}
                </FeedbackSection>
              )}

              {/* Where You Went Wrong */}
              {feedback.where_you_went_wrong && (
                <FeedbackSection
                  icon={<AlertCircle className="h-4 w-4 text-exam-warning" />}
                  title="Where it went wrong"
                  variant="warning"
                >
                  {feedback.where_you_went_wrong}
                </FeedbackSection>
              )}

              {/* Correct Approach */}
              <FeedbackSection
                icon={<Lightbulb className="h-4 w-4 text-exam-scottish-teal" />}
                title="Correct approach"
                variant="info"
              >
                <MarkdownContent content={feedback.correct_approach} />
              </FeedbackSection>

              {/* Misconception (if detected) */}
              {feedback.misconception_detected && (
                <MisconceptionAlert misconception={feedback.misconception_detected} />
              )}

              {/* Marking Breakdown (for structured questions) */}
              {feedback.marking_breakdown && (
                <MarkingBreakdown breakdown={feedback.marking_breakdown} />
              )}

              {/* Related Concept */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <span>Related concept: {feedback.related_concept}</span>
                {feedback.suggested_review && (
                  <Badge variant="outline">{feedback.suggested_review}</Badge>
                )}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
```

### Component: `MisconceptionAlert`

Special treatment for detected misconceptions - these are valuable learning moments.

```tsx
// components/exam/results/MisconceptionAlert.tsx

interface MisconceptionAlertProps {
  misconception: MisconceptionFeedback;
}

export function MisconceptionAlert({ misconception }: MisconceptionAlertProps) {
  return (
    <Alert className="border-exam-heather bg-exam-heather/5">
      <Brain className="h-4 w-4 text-exam-heather" />
      <AlertTitle className="text-exam-heather">
        Common Misconception Detected
      </AlertTitle>
      <AlertDescription className="space-y-2 mt-2">
        <p><strong>The error:</strong> {misconception.common_error}</p>
        <p><strong>Why it's wrong:</strong> {misconception.why_its_wrong}</p>
        <p><strong>Correct thinking:</strong> {misconception.correct_thinking}</p>
        <div className="mt-3 p-2 bg-background rounded border">
          <p className="text-sm">
            <strong>💡 Practice tip:</strong> {misconception.practice_suggestion}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

### Component: `LearningRecommendations`

Renders prioritized, actionable recommendations.

```tsx
// components/exam/results/LearningRecommendations.tsx

interface LearningRecommendationsProps {
  recommendations: LearningRecommendation[];
}

export function LearningRecommendations({ recommendations }: LearningRecommendationsProps) {
  const priorityColors = {
    1: "text-exam-danger border-exam-danger",
    2: "text-exam-warning border-exam-warning",
    3: "text-exam-success border-exam-success"
  };

  const priorityLabels = {
    1: "High Priority",
    2: "Medium Priority",
    3: "Good to Know"
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl flex items-center gap-2">
        <BookMarked className="h-5 w-5" />
        Your Learning Recommendations
      </h3>
      <p className="text-muted-foreground">
        Based on your exam performance, here's what to focus on next:
      </p>

      <div className="space-y-4">
        {recommendations
          .sort((a, b) => a.priority - b.priority)
          .map((rec, index) => (
            <Card
              key={index}
              className={cn("border-l-4", priorityColors[rec.priority as 1|2|3])}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{rec.topic}</CardTitle>
                  <Badge variant="outline" className={priorityColors[rec.priority as 1|2|3]}>
                    {priorityLabels[rec.priority as 1|2|3]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Why:</p>
                  <p>{rec.reason}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action:</p>
                  <p>{rec.action}</p>
                </div>
                {rec.related_questions.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Related to questions: {rec.related_questions.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
```

---

### Legacy Wireframe Reference

```
┌─────────────────────────────────────────────────────────────┐
│ [Exam Title]                    Timer: 45:00  │ [Submit]    │
├──────────────┬──────────────────────────────────────────────┤
│  Navigation  │                                              │
│  ┌─────────┐ │  Section A: Non-Calculator                   │
│  │ Q1  ✓   │ │  ─────────────────────────                   │
│  │ Q2  ✓   │ │                                              │
│  │ Q3  ⚑   │ │  Question 3                                  │
│  │ Q4  ○   │ │  Calculate the value of x when...            │
│  │ Q5  ○   │ │                                              │
│  ├─────────┤ │  ┌─────────────────────────────────────────┐ │
│  │ Q6  ○   │ │  │ Answer: [________________]              │ │
│  │ Q7  ○   │ │  └─────────────────────────────────────────┘ │
│  └─────────┘ │                                              │
│              │  [< Previous]     [Flag]     [Next >]       │
└──────────────┴──────────────────────────────────────────────┘

Legend: ✓ Answered  ○ Unanswered  ⚑ Flagged
```

---

## Estimated Effort

### This Spec (Frontend UI)
| Phase | Complexity | Estimate |
|-------|------------|----------|
| Phase 1: Route & Container | Medium | 3-4 hours |
| Phase 2: Question Components | High | 5-6 hours |
| Phase 3: State Management | Medium | 3-4 hours |
| Phase 4: Backend Integration | Low | 1-2 hours |
| **Phase 5: Results & Feedback Presentation** | **High** | **4-5 hours** |
| **Frontend Total** | | **16-21 hours** |

### Phase 5 Breakdown (New)
| Component | Estimate |
|-----------|----------|
| `QuestionFeedbackCard` with animations | 1.5 hours |
| `MisconceptionAlert` component | 0.5 hours |
| `LearningRecommendations` component | 1 hour |
| Grade reveal animations (Framer Motion) | 1 hour |
| Filter/navigation in results view | 1 hour |

### Parallel Work (LangGraph Backend)
| Spec | Estimate |
|------|----------|
| [mock-exam-submission-grading-api-spec.md](./mock-exam-submission-grading-api-spec.md) | 6-8 hours |

### Combined Total: **22-29 hours** (but parallelizable to ~21 hours wall time)

### Implementation Order
1. **Phase 1-3** (Frontend Exam Taking): Can start immediately
2. **Backend Graph** (LLM Grading): Can be developed in parallel
3. **Phase 4** (Integration): After backend is ready
4. **Phase 5** (Results Presentation): After Phase 4, iteratively with backend

---

## Dependencies & Prerequisites

1. **Appwrite Collections** (verified ✅):
   - `mock_exams` - ✅ Exists (stores exam JSON with gzip-compressed sections)
   - `exam_attempts` - ✅ Exists (stores submissions, answers, and evaluation results)

2. **LaTeX/MathJax** - Already available via `markdown-message.tsx`

3. **UI Components** - All available in `components/ui/` (shadcn)

4. **LangGraph SDK** - `@langchain/langgraph-sdk` for calling `graph_mock_exam` graph

5. **Backend Graph** - `graph_mock_exam` in `langgraph-agent/src/agent/graph_mock_exam.py`

---

## Open Questions

1. ✅ **Diagram Storage**: Diagrams referenced via `diagram_refs` in question schema - integrate with existing `ImageWithZoom` component

2. ✅ **Grading API**: Server-side via LangGraph `graph_mock_exam` graph with LLM-powered grading for structured responses

3. ⏳ **Timer Behavior**: Auto-submit on time up, or just warn? (Recommend: warn at 5min, auto-submit at 0)

4. ⏳ **Review Mode**: After submission, should students see worked solutions immediately? (Recommend: yes, with `worked_solution` from question schema)

---

## Next Steps

1. ✅ Appwrite collection structure confirmed (`mock_exams`, `exam_attempts`)
2. Begin Phase 1 implementation (exam route & container)
3. Test with sample mock exam in Appwrite
4. Implement `graph_mock_exam` LangGraph graph in parallel
