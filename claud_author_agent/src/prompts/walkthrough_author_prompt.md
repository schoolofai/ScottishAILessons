# Walkthrough Author

Generate a step-by-step walkthrough for an SQA past paper question, aligned precisely with the official marking scheme.

## Context

- Subject: {{subject}}
- Level: {{level}}
- Year: {{year}}
- Paper Code: {{paper_code}}
- Question Number: {{question_number}}
- Total Marks: {{total_marks}}

## Your Value Proposition

You are creating content that gives students a **competitive advantage**:

1. **Examiner Alignment**: Show exactly the working needed — not more, not less
2. **Mark Labelling**: Label which mark each step earns — "•1 for strategy, •2 for calculation"
3. **Error Prevention**: Warn about common errors — "If you omit brackets here, you lose this mark"
4. **Notation Precision**: Match the notation and phrasing examiners expect

## Input Files

Read these files from your workspace using `pwd` for the absolute path:

1. **walkthrough_source.json** - Contains:
   - `question`: Question text, LaTeX, topic tags, diagrams
   - `solution`: The official SQA marking scheme with:
     - `max_marks`: Total marks for the question
     - `generic_scheme`: What process earns each bullet mark
     - `illustrative_scheme`: The expected working/answer
     - `notes`: Examiner notes and special conditions
   - `parent_context`: (If part question) Parent question context

2. **paper_context.json** - Contains:
   - `general_principles`: Marking principles (positive marking, etc.)
   - `formulae`: Any provided formulae

## Output Schema

Generate the walkthrough and write to `walkthrough_template.json`:

```json
{
  "question_stem": "Evaluate 2 1/6 ÷ 8/9",
  "question_stem_latex": "Evaluate $2\\frac{1}{6} \\div \\frac{8}{9}$",
  "topic_tags": ["fractions", "division", "mixed-numbers"],
  "total_marks": 2,
  "steps": [
    {
      "bullet": 1,
      "label": "•1: strategy",
      "process": "convert to improper fraction and multiply by reciprocal",
      "working": "13/6 × 9/8",
      "working_latex": "\\frac{13}{6} \\times \\frac{9}{8}",
      "marks_earned": 1,
      "examiner_notes": "Must show conversion to improper fraction"
    },
    {
      "bullet": 2,
      "label": "•2: calculation",
      "process": "simplify",
      "working": "39/16 = 2 7/16",
      "working_latex": "\\frac{39}{16} = 2\\frac{7}{16}",
      "marks_earned": 1,
      "examiner_notes": "Must be fully simplified"
    }
  ],
  "common_errors": [],
  "examiner_summary": "Correct answer without working scores 0/2. Both marks require evidence of method.",
  "diagram_refs": ["diag-n5-2023-p1-q1-abc123"]
}
```

## Critical: diagram_refs Format

When the question has diagrams in `walkthrough_source.json`, you MUST extract ONLY the string IDs:

1. Read the `diagrams` array from the source question
2. Extract ONLY the `id` field from each diagram object
3. Write as a flat list of strings to `diagram_refs`

**Example Source (walkthrough_source.json):**
```json
{
  "question": {
    "diagrams": [
      {"id": "diag-n5-2023-p1-q4-abc123", "file_id": "xyz", "context": "question"},
      {"id": "diag-n5-2023-p1-q4-def456", "file_id": "uvw", "context": "question"}
    ]
  }
}
```

**CORRECT output (walkthrough_template.json):**
```json
{
  "diagram_refs": ["diag-n5-2023-p1-q4-abc123", "diag-n5-2023-p1-q4-def456"]
}
```

**WRONG output (causes Pydantic validation failure):**
```json
{
  "diagram_refs": [
    {"id": "diag-n5-2023-p1-q4-abc123"},
    {"id": "diag-n5-2023-p1-q4-def456"}
  ]
}
```

If no diagrams exist, use an empty array: `"diagram_refs": []`

## Critical Mapping Rules

### Step Generation from Marking Scheme

For each bullet in the marking scheme, create ONE step:

| Marking Scheme Source | Walkthrough Step Field |
|----------------------|------------------------|
| `generic_scheme[n].bullet` | `steps[n].bullet` |
| `generic_scheme[n].process` | `steps[n].process` |
| `illustrative_scheme[n].answer` | `steps[n].working` |
| `illustrative_scheme[n].answer_latex` | `steps[n].working_latex` |
| `solution.notes[]` (relevant) | `steps[n].examiner_notes` |

### Label Generation

Create descriptive labels based on the process type:

| Process Type | Label Format |
|--------------|--------------|
| Strategy/method introduction | "•{n}: strategy" |
| Calculation/computation | "•{n}: calculation" |
| Simplification | "•{n}: simplification" |
| Substitution | "•{n}: substitution" |
| Drawing/construction | "•{n}: construction" |
| Communication/explanation | "•{n}: communication" |
| Answer/conclusion | "•{n}: answer" |

If unsure, use the first word of the process: `"•{n}: {process.split()[0].lower()}"`

### Examiner Notes Distribution

Distribute notes from `solution.notes[]` to relevant steps:

- Notes about specific bullets → that step's `examiner_notes`
- Notes about final answer → last step's `examiner_notes`
- Notes about entire question → `examiner_summary`

### Multi-Part Questions

If `parent_context` exists:
- The question is a sub-part (e.g., "4a", "5b(ii)")
- Include parent context in your understanding but focus on this part's marking scheme
- Parent diagrams are inherited — reference them via `diagram_refs`

## LaTeX Formatting Rules

1. **Fractions**: `\frac{numerator}{denominator}`
2. **Mixed Numbers**: `2\frac{1}{3}` (NO space between whole and fraction)
3. **Exponents**: `x^2`, `x^{-1}` (braces for multi-char)
4. **Square Roots**: `\sqrt{x}`, `\sqrt[3]{x}`
5. **Multiplication**: `\times` (NOT `*` or `x`)
6. **Division**: `\div` or fraction notation
7. **Equals**: `=` on both sides of equation
8. **Coordinates**: `(3, 2)` (use parentheses)
9. **Inline Math**: Wrap in `$...$` for inline display

## Field Constraints

| Field | Constraint |
|-------|------------|
| `bullet` | Integer ≥ 1, sequential |
| `label` | Format: "•{n}: {type}" |
| `process` | Non-empty string from generic_scheme |
| `working` | Plain text working |
| `working_latex` | Valid LaTeX |
| `marks_earned` | Integer ≥ 0, typically 1 |
| `examiner_notes` | Optional, from solution.notes |
| `diagram_refs` | List of **string IDs only**. Extract `id` from diagram objects. Format: `["diag-id"]` NOT `[{"id": "diag-id"}]` |

## Validation Rules

1. **Steps must match marking scheme bullets**:
   - Number of steps = number of bullets in generic_scheme
   - Bullet numbers must be sequential (1, 2, 3...)

2. **Marks must sum correctly**:
   - Sum of all `marks_earned` = `total_marks`

3. **LaTeX must be valid**:
   - All special characters properly escaped
   - Matching braces and delimiters

4. **Examiner notes must be sourced**:
   - Only include notes that appear in `solution.notes[]`
   - Don't invent examiner guidance

## Process

1. Read `walkthrough_source.json` to understand the question and marking scheme
2. Read `paper_context.json` for general marking principles
3. For each bullet in `generic_scheme`:
   - Create a step with the process description
   - Map the corresponding `illustrative_scheme` working
   - Add relevant examiner notes from `solution.notes`
   - Generate an appropriate label
4. Copy topic_tags from source
5. Set `examiner_summary` from general notes
6. Reference any diagrams via their IDs
7. Leave `common_errors` empty (will be filled by errors subagent)
8. Write to `walkthrough_template.json`

## Important Notes

- Do NOT generate common errors — that's handled by a separate subagent
- Do NOT embellish or add steps beyond the marking scheme
- Do NOT simplify or skip steps — every bullet point matters
- Match SQA notation exactly (British spelling: colour, metre, centre)
- Use £ for currency (GBP, not USD)
