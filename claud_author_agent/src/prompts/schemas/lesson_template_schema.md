# Lesson Template Schema v2.0

## Top-Level Fields

```typescript
{
  courseId: string,                    // Must start with "course_"
  title: string,                       // From SOW.label
  outcomeRefs: string[],               // COMBINED: SOW.outcomeRefs + SOW.assessmentStandardRefs[].code
  lesson_type: "teach" | "independent_practice" | "formative_assessment" | "revision" | "mock_exam",
  estMinutes: number,                  // Range: 5-120 (regular), 5-180 (mock_exam/mock_assessment)
  createdBy: "lesson_author_agent",    // EXACT VALUE - always this string
  sow_order: number,                   // From SOW.order
  version: 1,                          // Always 1 for new templates
  status: "draft" | "review" | "published",
  engagement_tags: string[],           // From SOW.engagement_tags
  policy: {
    calculator_allowed: boolean,       // Transform: SOW.calculator_section == "calc"
    assessment_notes?: string          // Optional
  },
  cards: Card[]                        // 3-15 cards depending on lesson_type
}
```

---

## Card Schema

```typescript
Card {
  id: string,                          // Format: "card_001", "card_002" (zero-padded, sequential)
  title: string,                       // Descriptive card purpose
  explainer: string,                   // Pedagogical content (markdown, LaTeX: $...$ inline, $$...$$ display)
  explainer_plain: string,             // CEFR A2-B1 accessible version (no LaTeX)
  cfu: CFU,                            // One of 4 types (see below)
  rubric: Rubric,                      // Marking scheme
  misconceptions: Misconception[],     // 1-3 misconceptions (can be empty array)
  context_hooks?: string[]             // Optional engagement contexts
}
```

---

## CFU Types (4 Schemas)

### Type: `mcq` (Multiple Choice Question)

**Use Case**: Quick concept checks, fact recall, misconception diagnosis

```typescript
{
  type: "mcq",
  id: string,                          // Unique within lesson (e.g., "q001", "q002")
  stem: string,                        // Question text (NOT "question_text")
  options: string[],                   // 3-5 answer choices
  answerIndex: number,                 // Zero-indexed correct answer (0 = first option, must be 0..options.length-1)
  rubric: Rubric
}
```

**Requirements**:
- `stem` field name (NOT `question_text`)
- `answerIndex` must be valid index into `options` array
- `options` array must have 3-5 items

---

### Type: `numeric` (Numeric Answer)

**Use Case**: Calculation problems with single numeric answer

```typescript
{
  type: "numeric",
  id: string,
  stem: string,
  expected: number,                    // Correct answer
  tolerance: number,                   // Acceptable margin (0.01 for money, 0.1 for larger values)
  money2dp: boolean,                   // Enforce 2 decimal places for currency
  rubric: Rubric,
  hints?: string[]                     // Optional: 3-5 progressive hints
}
```

**Requirements**:
- All fields `expected`, `tolerance`, `money2dp` are REQUIRED
- `hints` are optional but if provided should be 3-5 hints

**Hint Progression** (if provided):
1. Restate problem in simpler terms
2. Suggest first step
3. Provide calculation guidance
4. Give partial answer or verification strategy

---

### Type: `structured_response` (Extended Written Answer)

**Use Case**: Multi-step problems, show-your-working questions

```typescript
{
  type: "structured_response",
  id: string,
  stem: string,                        // Multi-part question with (a), (b), (c) structure
  rubric: Rubric                       // Detailed marking with method + accuracy marks
}
```

**Rubric Design**:
- Award **method marks** for correct process even if final answer wrong
- Award **accuracy marks** for correct final answer
- Follow SQA allocation: typically 60% method, 40% accuracy

---

### Type: `short_text` (Brief Written Response)

**Use Case**: Definitions, brief explanations, single-sentence answers

```typescript
{
  type: "short_text",
  id: string,
  stem: string,
  rubric: Rubric                       // Clear criteria for text response
}
```

**Design**:
- Expected response: 1-3 sentences
- Rubric criteria should specify key phrases or concepts to look for

---

## Rubric Structure

```typescript
Rubric {
  total_points: number,
  criteria: [
    {
      description: string,             // Clear success criterion (observable behavior)
      points: number
    }
  ]
}
```

**CRITICAL VALIDATION**:
- `sum(criteria[].points) MUST equal total_points`
- Validator will reject if mismatch

**SQA Alignment**:
- Method + Accuracy: Award method marks for process, accuracy marks for answer
- Partial Credit: Fine-grained criteria (e.g., 2 marks for calculation, 1 for units)
- Clear Descriptors: Each criterion specifies observable behavior
- Point Range: 1-5 points per card (teach: 1-3, formative: 3-5, mock_exam: 4-8)

---

## Misconception Structure

```typescript
Misconception {
  id: string,                          // Format: "MISC_[SUBJECT]_[TOPIC]_NNN"
  misconception: string,               // Brief error pattern description
  clarification: string                // Corrective explanation (20-50 words)
}
```

**ID Format Examples**:
- `MISC_MATH_FRAC_001` (Mathematics - Fractions)
- `MISC_SCI_ENERGY_002` (Science - Energy)
- `MISC_ENG_GRAMMAR_003` (English - Grammar)

**Pattern**: `MISC_[UPPERCASE_SUBJECT]_[UPPERCASE_TOPIC]_[3_DIGIT_NUMBER]`

**Count**: 1-3 misconceptions per card (array can be empty but must exist)

---

## Forbidden Fields (Input-Only, NOT in Output)

These fields exist in SOW entry but **MUST NOT appear in lesson_template.json**:

1. ❌ **`assessmentStandardRefs`** (top-level) - Codes must be merged into `outcomeRefs` array
2. ❌ **`accessibility_profile`** (top-level) - Input guidance only (use for CEFR level, then discard)
3. ❌ **`coherence`** (top-level) - Not part of output schema
4. ❌ **`calculator_section`** (in policy) - Must be transformed to `calculator_allowed` boolean

**Validation**: If ANY of these fields exist in template → FAIL

---

## Required Transformations

### Transformation 1: Combine Refs
```
output.outcomeRefs = input.outcomeRefs + input.assessmentStandardRefs[].code
```
**Example**:
- SOW: `outcomeRefs: ["O1"]`, `assessmentStandardRefs: [{code: "AS1.2"}, {code: "AS2.1"}]`
- Output: `outcomeRefs: ["O1", "AS1.2", "AS2.1"]`

### Transformation 2: Extract Order
```
output.sow_order = input.order
```
**Example**: SOW has `order: 57` → Output: `sow_order: 57`

### Transformation 3: Transform Calculator
```
output.policy.calculator_allowed = (input.policy.calculator_section == "calc")
```
**Example**:
- SOW: `calculator_section: "noncalc"` → Output: `calculator_allowed: false`
- SOW: `calculator_section: "calc"` → Output: `calculator_allowed: true`

### Transformation 4: Set Creator
```
output.createdBy = "lesson_author_agent"
```
**Always**: `createdBy` must be exactly this string (not "claude", "AI", or anything else)

### Transformation 5: Copy Title
```
output.title = input.label
```
**Example**: SOW has `label: "Practice: Fractions"` → Output: `title: "Practice: Fractions"`

---

## Validation Tool

**Tool**: `mcp__validator__validate_lesson_template`

**Args**: `{"file_path": "lesson_template.json"}`

**Response**:
```json
{
  "is_valid": true | false,
  "errors": [
    {
      "field": "path.to.field",
      "error": "description",
      "type": "error_type"
    }
  ],
  "errors_shown": number,              // Max 10 per validation
  "total_errors": number,
  "truncation_notice": string          // If total_errors > 10
}
```

**Error Limit**: Returns maximum 10 detailed errors per validation call. Fix errors iteratively in batches of 10.

---

## Common Validation Errors

**Schema Errors**:
- Using `cfu_type` instead of `type` field
- Using `question_text` instead of `stem` field
- Missing required CFU type-specific fields (e.g., MCQ missing `answerIndex`)
- Rubric criteria points don't sum to `total_points`
- Misconception ID doesn't match pattern `MISC_[SUBJECT]_[TOPIC]_NNN`
- Card IDs not sequential (must be card_001, card_002, card_003 with no gaps)

**Transformation Errors**:
- Forbidden fields present (`assessmentStandardRefs`, `accessibility_profile`, etc.)
- `createdBy` not exactly "lesson_author_agent"
- `outcomeRefs` not combined with assessment standard codes
- `calculator_allowed` is string instead of boolean

**Field Errors**:
- Invalid `lesson_type` (must be: teach, independent_practice, formative_assessment, revision, mock_exam)
- Wrong card count for `lesson_type` (e.g., teach needs 3-4 cards, mock_exam needs 8-15)
- Missing required fields at top level or card level
- Invalid `courseId` format (must start with "course_")
- Empty `outcomeRefs` array
