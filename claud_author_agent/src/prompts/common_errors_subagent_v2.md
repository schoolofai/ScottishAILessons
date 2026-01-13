# Common Errors Subagent V2 - Dual-Perspective Analysis

Identify realistic common errors students make on this question, explaining both the learning gap AND the marking impact.

## Context

- Subject: {{subject}}
- Level: {{level}}
- Year: {{year}}
- Question Number: {{question_number}}
- Total Marks: {{total_marks}}

## Your Goal

Generate 2-4 common errors that:
1. **Learning Gap**: Explain WHY students make this mistake (conceptual misunderstanding)
2. **Marking Impact**: Explain HOW this affects their grade (which marks lost, cascade effects)

This dual perspective helps students both understand their errors AND appreciate the consequences.

## Input Files

Read these files from your workspace:

1. **walkthrough_source.json** - Contains:
   - `question`: Question text, topic tags
   - `solution`: Marking scheme with:
     - `generic_scheme`: What earns each mark
     - `illustrative_scheme`: Expected working
     - `notes`: Examiner warnings (PRIORITY SOURCE for errors)

2. **walkthrough_template.json** - Contains:
   - The completed walkthrough with steps
   - Topic tags
   - Examiner summary

## Error Source Priority

Generate errors in this order of priority:

### Priority 1: Examiner Notes (MUST include at least one)

Look for patterns in `solution.notes[]`:

| Examiner Note Pattern | Error Type | Example |
|----------------------|------------|---------|
| "Correct answer without working: 0" | omission | "Not showing working" |
| "Do not accept..." | notation | "Using wrong notation" |
| "Must show..." | procedural | "Skipping required step" |
| "Watch for sign..." | sign_error | "Incorrect sign handling" |
| "Requires..." | concept | "Missing key method" |

### Priority 2: Marking Scheme Analysis

Infer errors from the marking scheme structure:

| Marking Scheme Feature | Likely Error |
|------------------------|--------------|
| Multi-step calculation | Arithmetic error in middle step |
| Unit conversion | Forgetting to convert units |
| Formula application | Substituting values incorrectly |
| Simplification required | Not fully simplifying |
| Specific format required | Wrong format/notation |

### Priority 3: Topic-Based Common Errors

Based on topic_tags, add known common errors:

| Topic | Common Error |
|-------|--------------|
| fractions | Adding/subtracting denominators incorrectly |
| percentages | Calculating percentage OF instead of increase/decrease |
| quadratics | Sign errors when factorising |
| gradient | Rise/run confusion (dividing wrong way) |
| trigonometry | Using wrong ratio (sin vs cos vs tan) |
| indices | Multiplying instead of adding powers |
| surds | Not rationalising denominator |

## Output Schema (V2 Enhanced)

Update the `common_errors` array in `walkthrough_template.json`:

```json
{
  "common_errors": [
    {
      "error_type": "omission",
      "description": "Not showing working for the calculation",

      "learning_gap": "Students often think the final answer is what matters most, not realising that examiners are primarily assessing the METHOD. This stems from a misunderstanding of how marks are allocated - in this question, the working IS the answer as far as marks go.",

      "marking_impact": "This is devastating here: a correct answer with no working scores 0/2. Both marks (•1 and •2) are awarded for showing specific working steps. The examiner literally cannot give you credit without seeing your method.",

      "why_marks_lost": "•1 and •2 lost - correct answer alone scores 0/2",
      "prevention_tip": "Show every step, even if it seems obvious. The working is the answer.",
      "related_topics": ["showing-working", "method-marks"]
    },
    {
      "error_type": "concept",
      "description": "Flipping the wrong fraction when dividing",

      "learning_gap": "Students have memorised 'flip and multiply' without understanding WHY we flip the divisor. They don't connect division with reciprocals conceptually, so they might flip the first fraction instead of the second. The rule is mechanical, not meaningful, in their minds.",

      "marking_impact": "This loses •1 (strategy mark) immediately because the setup is fundamentally wrong. Even if they calculate correctly from this point, they'll get a wrong answer, typically losing •2 as well. Maximum likely score: 0/2.",

      "why_marks_lost": "•1 lost for wrong strategy, likely •2 lost due to wrong answer",
      "prevention_tip": "Remember: KEEP the first, FLIP the second. The fraction you're dividing BY gets flipped.",
      "related_topics": ["fraction-division", "reciprocals", "multiplicative-inverse"]
    }
  ]
}
```

## Dual-Perspective Requirements

### Learning Gap (REQUIRED)

For each error, explain:
- **What** concept or understanding is missing?
- **Why** do students make this particular mistake?
- **What** should they revise to fix this gap?

**Guidelines:**
- Minimum 50 characters
- Be specific about the conceptual misunderstanding
- Show empathy - explain WHY this is a natural mistake

**Good Example:**
```
"learning_gap": "Students have memorised 'flip and multiply' without understanding
WHY we flip the divisor. The rule is mechanical, not meaningful - they don't
connect division with reciprocals conceptually."
```

**Bad Example:**
```
"learning_gap": "They don't understand fractions."
```

### Marking Impact (REQUIRED)

For each error, explain:
- **Which** specific marks (bullets) are lost?
- **Is** there any partial credit possible?
- **What's** the cascade effect on later marks?

**Guidelines:**
- Minimum 30 characters
- Reference specific bullets (•1, •2, etc.)
- Explain maximum likely score after this error

**Good Example:**
```
"marking_impact": "This loses •1 (strategy mark) immediately because the setup
is fundamentally wrong. Even with correct arithmetic after, the answer is wrong,
typically losing •2. Maximum likely score: 0/2."
```

**Bad Example:**
```
"marking_impact": "Loses marks."
```

## Related Topics (REQUIRED)

For each error, provide 1-3 topic tags that the student should revise:

- Use kebab-case (e.g., `fraction-division`, not `fraction division`)
- Be specific (e.g., `reciprocals`, not just `fractions`)
- Link to prerequisite concepts

## Error Types

Use these categories:

| Type | Description |
|------|-------------|
| `notation` | Wrong mathematical notation or format |
| `calculation` | Arithmetic or computational error |
| `concept` | Fundamental misunderstanding of the method |
| `omission` | Missing required information or working |
| `misinterpretation` | Misreading the question |
| `sign_error` | Sign handling mistakes (±) |
| `procedural` | Skipping required steps |
| `rounding` | Inappropriate rounding or decimal places |

## Field Constraints

| Field | Constraint |
|-------|------------|
| `error_type` | One of the 8 types above |
| `description` | ≥10 chars, what students do wrong |
| `learning_gap` | **Required**, ≥50 chars, conceptual explanation |
| `marking_impact` | **Required**, ≥30 chars, grade consequences |
| `why_marks_lost` | Reference specific bullets |
| `prevention_tip` | Actionable, specific advice |
| `related_topics` | 1-3 topic tags for revision |

## Validation Rules

1. **Error count**: 2-4 errors per question (not too few, not overwhelming)

2. **Priority balance**:
   - At least 1 error from examiner notes (Priority 1)
   - At least 1 error that's topic-based (Priority 2 or 3)

3. **Variety**:
   - Mix different error types where possible
   - Don't repeat the same conceptual issue

4. **Dual perspective**:
   - Every error MUST have both `learning_gap` AND `marking_impact`
   - Both fields must meet minimum character requirements

## Process

1. Read `walkthrough_source.json` for marking scheme and examiner notes
2. Read `walkthrough_template.json` for completed walkthrough
3. Identify errors from Priority 1 (examiner notes) first
4. Add errors from Priority 2 (marking scheme analysis)
5. Fill with Priority 3 (topic-based) if needed
6. For EACH error:
   - Write the learning_gap (conceptual explanation)
   - Write the marking_impact (grade consequences)
   - Add related_topics for revision
7. Update `walkthrough_template.json` with the errors
8. Write to `walkthrough_template.json`

## Important Notes

- Generate 2-4 errors only (quality over quantity)
- Always include at least one error from examiner notes if available
- Both perspectives (learning gap AND marking impact) are REQUIRED
- Related topics should be specific enough to guide revision
- Use student-friendly language throughout
- Match SQA conventions (British spelling, £ for currency)
