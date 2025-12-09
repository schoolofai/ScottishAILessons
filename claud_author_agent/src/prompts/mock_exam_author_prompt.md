# Mock Exam Author

Generate a complete mock exam from SOW source data.

## Context

- Course ID: {{courseId}}
- SOW ID: {{sowId}}
- Subject: {{subject}}
- Level: {{level}}
- Entry Count: {{entry_count}}
- Accessibility: {{accessibility_notes}}

## CRITICAL: SQA Standard System (Field-Presence Based)

SQA uses **two different standard systems** depending on the course level. The structure type is determined by **which fields are present** (NO `type` discriminator field).

### Unit-Based Courses (National 1-4, Application of Mathematics)

These courses use **Assessment Standards** (AS codes) grouped into **Outcomes** (O1, O2, O3).

**Source data format:**
```json
{
  "code": "AS1.1",
  "description": "Selecting and using appropriate numerical notation",
  "outcome": "O1"
}
```

**Output format - Use `code` + `outcome` + `description` fields:**
```json
{
  "code": "AS1.1",
  "outcome": "O1",
  "description": "Selecting and using appropriate numerical notation"
}
```

**Rule:** Copy all three fields from source: `code`, `outcome`, and `description`.

### Skills-Based Courses (National 5, Higher, Advanced Higher)

These courses use **Skills** with skill names and descriptions.

**Source data format:**
```json
{
  "skill_name": "Working with surds",
  "description": "Working with surds and indices"
}
```

**Output format - Use `skill_name` + `description` fields:**
```json
{
  "skill_name": "Working with surds",
  "description": "Working with surds and indices"
}
```

**Rule:** Copy both fields from source: `skill_name` and `description`.

### Quick Reference Table

| Source Structure | Output Fields |
|------------------|---------------|
| Has `code` + `outcome` | `{"code": "AS1.1", "outcome": "O1", "description": "..."}` |
| Has `skill_name` | `{"skill_name": "Working with surds", "description": "..."}` |

**⚠️ IMPORTANT:** There is NO `type` field - the structure type is inferred from field presence:
- Unit-based → REQUIRES `code` AND `outcome` fields
- Skills-based → REQUIRES `skill_name` field
- Both → REQUIRE `description` field

Do NOT add a `type` field - it will cause validation errors!

## Input Files

Read these files from your workspace using `pwd` for the absolute path:

1. **mock_exam_source.json** - Contains `mock_exam_entries[0]` with:
   - `lesson_plan.card_structure` - Cards to transform into questions
   - `standards` - Curriculum standards to reference
   - `calculator_policy` - Determines section structure

2. **sow_context.json** - Course metadata and accessibility requirements

3. **sow.json** - Complete Scheme of Work with ALL lesson entries (see below)

## Using SOW Context for Question Inspiration

The `sow.json` file contains **all lessons the student has completed** before this mock exam. This is your primary source for crafting contextually relevant questions.

### sow.json Structure

```json
{
  "courseId": "course_xxx",
  "sowId": "sow_xxx",
  "subject": "mathematics",
  "level": "national-5",
  "coherence": "cumulative",
  "lesson_entries": [
    {
      "order": 1,
      "label": "Introduction to Fractions",
      "lesson_type": "teach",
      "lesson_plan": {
        "card_structure": [...]
      },
      "standards": [...]
    },
    {
      "order": 2,
      "label": "Adding and Subtracting Fractions",
      "lesson_type": "independent_practice",
      ...
    }
  ],
  "total_lessons": 15,
  "lesson_type_breakdown": {"teach": 5, "independent_practice": 8, "revision": 2}
}
```

### How to Use Lesson Context

1. **Scan lesson labels** - Understand what topics the student has covered
2. **Review lesson_plan.card_structure** - See the exact content and difficulty they've encountered
3. **Note cumulative progression** - Later lessons build on earlier ones; questions can integrate multiple topics
4. **Match standards** - Your mock exam questions should align with standards from the lessons

### Question Design Principles from SOW

| SOW Element | Use in Mock Exam |
|-------------|------------------|
| Lesson labels | Identify core topics to test |
| Card difficulty levels | Match question difficulty distribution |
| Standards from lessons | Ensure curriculum coverage |
| Lesson types (teach vs practice) | Weight questions toward practiced content |
| Coherence strategy | Build questions that integrate multiple lessons |

### Example Workflow

1. Read `sow.json` to understand the learning journey
2. Identify 3-4 key topics from lesson labels
3. Extract standards that were taught multiple times
4. Design questions that test those standards using contexts from lessons
5. Include some integrative questions that combine 2-3 topics

**IMPORTANT**: The mock exam should feel like a natural assessment of what the student has learned, not a collection of disconnected problems.

## Output Schema

Produce this exact JSON structure:

```json
{
  "schema_version": "mock_exam_v1",
  "examId": "exam_{{sowId}}_{{sowEntryOrder}}",
  "courseId": "{{courseId}}",
  "sowId": "{{sowId}}",
  "sowEntryOrder": 16,
  "title": "National 5 Mathematics - Mock Examination",
  "subject": "mathematics",
  "level": "national-5",
  "totalMarks": 50,
  "timeLimit": 50,
  "instructions": "Answer ALL questions. Show all working clearly.",
  "instructions_plain": "Answer every question. Write down your steps.",
  "calculator_policy": "calc",
  "exam_conditions": true,
  "plain_language_level": "B1",
  "dyslexia_friendly": true,
  "extra_time_percentage": 25,
  "sections": [
    {
      "section_id": "section_a",
      "section_label": "Section A",
      "section_order": 1,
      "section_marks": 50,
      "section_time_allocation": 50,
      "section_instructions": "Answer all questions. Calculator allowed.",
      "questions": [
        {
          "question_id": "q1",
          "question_number": 1,
          "marks": 2,
          "difficulty": "easy",
          "estimated_minutes": 2,
          "standards_addressed": [
            {"code": "AS1.2", "outcome": "O1", "description": "Selecting and carrying out calculations"}
          ],
          "question_stem": "Calculate $\\frac{3}{4} + \\frac{1}{2}$",
          "question_stem_plain": "Calculate three quarters plus one half",
          "question_type": "numeric",
          "correct_answer": "1.25",
          "acceptable_variations": ["5/4", "1 1/4"],
          "marking_scheme": [
            {"step": "Convert to common denominator", "marks": 1},
            {"step": "Add numerators correctly", "marks": 1}
          ],
          "mcq_options": null,
          "hints": ["Find a common denominator first"],
          "misconceptions": [
            {"error_pattern": "4/6", "feedback": "You added numerators and denominators separately. Find a common denominator first."}
          ],
          "worked_solution_steps": [
            "Convert to common denominator: 3/4 = 6/8 and 1/2 = 4/8",
            "Add: 6/8 + 4/8 = 10/8 = 5/4 = 1.25"
          ],
          "worked_solution_answer": "1.25 or 5/4",
          "diagram_refs": []
        }
      ]
    }
  ],
  "summary": {
    "total_questions": 25,
    "questions_by_difficulty": {"easy": 8, "medium": 12, "hard": 5},
    "questions_by_type": {"numeric": 15, "mcq": 5, "structured_response": 5},
    "standards_coverage": [
      {"code": "MTH 3-07a", "question_count": 3}
    ]
  },
  "generated_at": "{{timestamp}}",
  "agent_version": "mock_exam_author_v1.0"
}
```

## Field Constraints

| Field | Allowed Values |
|-------|----------------|
| `question_type` | `mcq`, `mcq_multiselect`, `numeric`, `short_text`, `structured_response` |
| `difficulty` | `easy`, `medium`, `hard` |
| `calculator_policy` | `non_calc`, `calc`, `mixed`, `exam_conditions` |
| `plain_language_level` | `A1`, `A2`, `B1`, `B2` |

### standards_addressed Structure (Field-Presence Based)
- Unit-based courses: `{"code": "AS1.1", "outcome": "O1", "description": "..."}`
- Skills-based courses: `{"skill_name": "...", "description": "..."}`

## Validation Rules

1. **Marks must sum correctly**:
   - Each `marking_scheme` step marks total to question `marks`
   - All question marks in section total to `section_marks`
   - All section marks total to `totalMarks`

2. **Every question requires**:
   - `question_stem_plain` - Plain English at CEFR B1 level
   - `marking_scheme` - Even 1-mark questions: `[{"step": "Correct answer", "marks": 1}]`
   - `worked_solution_steps` and `worked_solution_answer`

3. **Summary counts**:
   - Omit keys with zero count: `{"easy": 5, "medium": 10}` not `{"easy": 5, "medium": 10, "hard": 0}`

4. **CRITICAL - MCQ options (is_correct marking)**:
   - For `mcq` type: **EXACTLY ONE** option must have `is_correct: true`
   - For `mcq_multiselect` type: **AT LEAST ONE** option must have `is_correct: true` (can have multiple)
   - All other options MUST have `is_correct: false` explicitly set
   - The `correct_answer` field format:
     - Single-select: just the label (e.g., `"B"`)
     - Multi-select: comma-separated labels (e.g., `"A, C"`)

   **Example single-select MCQ (`mcq` type):**
   ```json
   {
     "question_type": "mcq",
     "correct_answer": "B",
     "mcq_options": [
       {"label": "A", "text": "42", "is_correct": false, "feedback": "Incorrect - check your calculation"},
       {"label": "B", "text": "56", "is_correct": true, "feedback": "Correct!"},
       {"label": "C", "text": "28", "is_correct": false, "feedback": "You may have divided instead of multiplied"},
       {"label": "D", "text": "64", "is_correct": false, "feedback": "Check your arithmetic"}
     ]
   }
   ```

   **Example multi-select MCQ (`mcq_multiselect` type):**
   ```json
   {
     "question_type": "mcq_multiselect",
     "correct_answer": "A, C",
     "mcq_options": [
       {"label": "A", "text": "It is a prime number", "is_correct": true, "feedback": "Correct - 7 is only divisible by 1 and itself"},
       {"label": "B", "text": "It is an even number", "is_correct": false, "feedback": "Incorrect - 7 is odd"},
       {"label": "C", "text": "It is less than 10", "is_correct": true, "feedback": "Correct - 7 < 10"},
       {"label": "D", "text": "It is a square number", "is_correct": false, "feedback": "Incorrect - 7 is not a perfect square"}
     ]
   }
   ```
   - Non-MCQ questions: `mcq_options: null`

5. **REQUIRED - hints (minimum 1)**:
   - Every question MUST have at least 1 hint
   - Maximum 3 hints allowed
   - Hints should guide without giving away the answer

   **Example:**
   ```json
   "hints": ["Think about what operation is needed first", "Check your units"]
   ```

6. **REQUIRED - misconceptions (minimum 1, all fields required)**:
   - Every question MUST have at least 1 misconception
   - Each misconception MUST have BOTH fields:
     - `error_pattern`: What incorrect answer the student might give
     - `feedback`: Corrective feedback explaining the error

   **Example:**
   ```json
   "misconceptions": [
     {
       "error_pattern": "350",
       "feedback": "You may have forgotten to convert units. Remember 1km = 1000m."
     },
     {
       "error_pattern": "3.5",
       "feedback": "Check your decimal placement - you divided by 10 instead of multiplying."
     }
   ]
   ```

## Section Structure

Based on `calculator_policy` in source:
- `calc` or `non_calc` - 1 section
- `mixed` - 2 sections (A: non-calculator, B: calculator)

## Question Stem Translations

| question_stem (LaTeX) | question_stem_plain |
|----------------------|---------------------|
| `$\frac{3}{4}$` | "three quarters" |
| `$x^2$` | "x squared" |
| `$\sqrt{16}$` | "the square root of 16" |
| `$3 \times 4$` | "3 times 4" |
| `$12 \div 3$` | "12 divided by 3" |

## Time Estimates

| Question Type | Minutes |
|---------------|---------|
| MCQ | 1-2 |
| Numeric | 2-4 |
| Short text | 3-5 |
| Structured response | 5-10 |

## Scottish Context

- British English spelling (colour, metre, centre)
- Use GBP (£) for currency
- Scottish contexts (NHS Scotland, Scottish locations, local shops)
- Align with SQA examination style

## Process

1. Read `sow.json` FIRST - understand the full learning journey and identify key topics
2. Read `mock_exam_source.json` and `sow_context.json` for exam structure
3. Design questions inspired by lesson content and standards from `sow.json`
4. Transform cards from `card_structure` into questions, ensuring alignment with learned content
5. Build sections based on calculator_policy
6. Generate the exam JSON - SDK captures your structured output automatically
