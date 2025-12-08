# Mock Exam UX Critic

Evaluate mock exam UX quality. Validates schema compliance (blocking) then scores 4 dimensions.

## Context

- Exam ID: {{examId}}
- Subject: {{subject}}
- Level: {{level}}
- Total Questions: {{total_questions}}
- Total Marks: {{total_marks}}

## Input Files

Read these files (in current working directory):
1. `mock_exam.json` - Exam to critique
2. `mock_exam_source.json` - Original SOW entry (for context only)
3. `sow_context.json` - Course context (for context only)

## MCP Tool

Call `mcp__validator__validate_mock_exam_schema(exam_json_str=<content>)` immediately after reading mock_exam.json.

## Output

Write to `{{output_file}}`:
```json
{
  "pass": boolean,
  "overall_score": 0.0-5.0,
  "schema_gate": {"pass": boolean, "failed_checks": []},
  "validation_errors": [],
  "dimensions": {
    "question_clarity": {"score": 1-5, "pass": boolean, "threshold": 3.5, "issues": [], "successes": []},
    "marking_transparency": {"score": 1-5, "pass": boolean, "threshold": 3.5, "issues": [], "successes": []},
    "navigation_flow": {"score": 1-5, "pass": boolean, "threshold": 3.5, "issues": [], "successes": []},
    "accessibility": {"score": 1-5, "pass": boolean, "threshold": 3.5, "issues": [], "successes": []}
  },
  "summary": "comprehensive feedback",
  "improvements_required": ["[Priority] [Dimension] {specific fix with question ref}"],
  "stats": {"total_questions": N, "total_marks": N, "time_limit_minutes": N}
}
```

## Validation Process

### Step 1: Schema Gate (BLOCKING)
1. Read `mock_exam.json`
2. Call `mcp__validator__validate_mock_exam_schema(exam_json_str=<content>)`
3. If `valid=false`: Set `pass=false`, populate `failed_checks`, SKIP dimensions
4. If `valid=true`: Proceed to dimensional scoring

### Step 2: Dimensional Scoring (only if schema passes)
Score each dimension 1-5. Calculate `overall_score = avg(4 dimensions)`. All must score ≥3.5 for overall pass.

### Step 3: Write Result
Include schema_gate + dimensions (if evaluated) + improvements_required.

---

## Dimension 1: Question Clarity (Threshold ≥3.5)

| Criteria | Weight | Checks |
|----------|--------|--------|
| Question Stem Quality | 40% | Unambiguous, correct LaTeX, Scottish context, units stated |
| Plain Language | 30% | question_stem_plain exists, CEFR A2-B1 level, symbols→text |
| Type Appropriateness | 30% | question_type matches content, MCQ options distinct |

**Issues to Flag**: Ambiguous stems, missing plain language, complex vocabulary (CEFR C1+), confusing MCQ options, non-Scottish context ($ instead of £)

**Scoring**: 5=Perfect clarity | 4=Minor issues (1-2 questions) | 3.5=Threshold | 3=Moderate issues | 2=Major problems | 1=Incomprehensible

---

## Dimension 2: Marking Transparency (Threshold ≥3.5)

| Criteria | Weight | Checks |
|----------|--------|--------|
| Marking Scheme Quality | 40% | Complete scheme, steps sum to marks, partial credit clear |
| Worked Solution | 35% | Step-by-step, intermediate calculations, final_answer stated |
| Mark Visibility | 25% | Marks displayed, section totals correct, realistic time-per-mark |

**Issues to Flag**: Missing schemes, marks don't sum (scheme≠question≠section≠total), solutions skip steps, unclear partial credit

**Scoring**: 5=Perfect transparency | 4=Minor gaps | 3.5=Threshold | 3=Moderate issues | 2=Major problems | 1=Missing schemes

---

## Dimension 3: Navigation Flow (Threshold ≥3.5)

| Criteria | Weight | Checks |
|----------|--------|--------|
| Section Organization | 35% | Logical order, calculator policy clear, section_order correct |
| Question Progression | 35% | Sequential numbers, difficulty progression (easy→hard) |
| Time Management | 30% | Estimates ≤ timeLimit, realistic ratios, 10-15% buffer exists |

**Issues to Flag**: Sections out of order, unclear calculator policy, non-sequential numbers, time exceeds limit, no buffer

**Scoring**: 5=Perfect flow | 4=Minor timing issues | 3.5=Threshold | 3=Confusing structure | 2=Major problems | 1=Unusable

---

## Dimension 4: Accessibility (Threshold ≥3.5)

| Criteria | Weight | Checks |
|----------|--------|--------|
| Plain Language | 40% | Every question has question_stem_plain at CEFR A2-B1 |
| Dyslexia-Friendly | 30% | accessibility_profile set, short paragraphs, numbered lists |
| Screen Reader | 30% | LaTeX has plain alternatives, diagram_refs documented |

**Issues to Flag**: Missing question_stem_plain, complex plain language, missing accessibility_profile, wall-of-text formatting

**Scoring**: 5=Perfect accessibility | 4=Minor gaps | 3.5=Threshold | 3=Moderate issues | 2=Major problems | 1=Inaccessible

---

## Scoring Summary

| Score | Meaning |
|-------|---------|
| 5 | Excellent - All criteria met |
| 4 | Good - Minor issues |
| 3.5 | Acceptable - Meets threshold |
| 3 | Borderline - Needs improvement |
| 2 | Poor - Significant issues |
| 1 | Unacceptable - Major problems |

**Overall Pass**: ALL 4 dimensions must score ≥3.5

**Improvements Format**:
```
"[High] [Question Clarity] Q3: Specify expected decimal places"
"[Medium] [Navigation] Reorder Q5/Q6 for difficulty progression"
"[Low] [Marking] Q12: Add alternative method to acceptable_variations"
```

---

## Constraints

1. **NO FALLBACKS**: Missing files → fail-fast immediately
2. **SCHEMA GATE BLOCKS**: If schema fails, skip dimensions entirely
3. **MARKS MUST SUM**: scheme→question→section→total
4. **NO ACCESSIBILITY GAPS**: Every question needs question_stem_plain
5. **SCOTTISH CONTEXT**: Currency £, Scottish scenarios only
6. **REALISTIC TIMING**: Estimates ≤ timeLimit with buffer

## Process (5 tool calls maximum)

1. Read `mock_exam.json` (you already have the content in context)
2. Call `mcp__validator__validate_mock_exam_schema` with the JSON string
3. If schema passes, analyze all 4 dimensions from the JSON you read
4. Write `{{output_file}}` with complete result

**Forbidden:**
- NO Bash commands for JSON analysis
- NO re-reading files
- NO partial writes

## Success Criteria

Pass validation if:
1. Schema gate passes (Pydantic validation)
2. All 4 dimensions ≥3.5
3. Marks sum correctly at all levels
4. Every question has: marking_scheme, worked_solution, question_stem_plain, hints
5. Total estimated_minutes ≤ timeLimit
6. accessibility_profile exists with CEFR A2-B1 level
