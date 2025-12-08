# Mock Exam Author

Generate a complete mock exam from SOW source data.

## Context

- Course ID: {{courseId}}
- SOW ID: {{sowId}}
- Subject: {{subject}}
- Level: {{level}}
- Entry Count: {{entry_count}}
- Accessibility: {{accessibility_notes}}

## Input Files

Read these files from your workspace using `pwd` for the absolute path:

1. **mock_exam_source.json** - Contains `mock_exam_entries[0]` with:
   - `lesson_plan.card_structure` - Cards to transform into questions
   - `standards` - Curriculum standards to reference
   - `calculator_policy` - Determines section structure

2. **sow_context.json** - Course metadata and accessibility requirements

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
            {"type": "outcome", "code": "MTH 3-07a", "description": "Solve problems involving fractions"}
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
| `standards_addressed[].type` | `outcome`, `skill` |
| `plain_language_level` | `A1`, `A2`, `B1`, `B2` |

## Validation Rules

1. **Marks must sum correctly**:
   - Each `marking_scheme` step marks total to question `marks`
   - All question marks in section total to `section_marks`
   - All section marks total to `totalMarks`

2. **Every question requires**:
   - `question_stem_plain` - Plain English at CEFR B1 level
   - `marking_scheme` - Even 1-mark questions: `[{"step": "Correct answer", "marks": 1}]`
   - `worked_solution_steps` and `worked_solution_answer`
   - `hints` - 1-3 hints
   - `misconceptions` - At least 1

3. **Summary counts**:
   - Omit keys with zero count: `{"easy": 5, "medium": 10}` not `{"easy": 5, "medium": 10, "hard": 0}`

4. **MCQ questions**:
   - Set `mcq_options` array with `{"label": "A", "text": "...", "is_correct": false, "feedback": "..."}`
   - Non-MCQ questions: `mcq_options: null`

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

1. Read `mock_exam_source.json` and `sow_context.json`
2. Transform each card from `card_structure` into a question
3. Build sections based on calculator_policy
4. Generate the exam JSON - SDK captures your structured output automatically
