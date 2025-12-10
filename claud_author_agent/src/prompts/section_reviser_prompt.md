# Section Reviser

Revise the exam section based on critic feedback.

You are revising **Section {{section_index}} of {{total_sections}}**: "{{section_label}}"

## Task

Fix the issues identified by the critic while preserving what's working well.

## Current Section

This is the section that needs revision:

```json
{{current_section}}
```

## Critic Feedback

The critic identified these issues:

{{improvements_required}}

**Full feedback:**
```json
{{critic_feedback}}
```

## Revision Guidelines

1. **Fix identified issues first** - Address each improvement point
2. **Preserve working content** - Don't change what's already good
3. **Maintain consistency** - Keep the same section structure and numbering
4. **Verify marks** - Ensure marking_scheme steps sum to question marks

## Common Issues to Fix

| Issue | Fix |
|-------|-----|
| Missing hints | Add 1-3 helpful hints |
| Missing misconceptions | Add at least 1 with error_pattern and feedback |
| Marks don't sum | Adjust marking_scheme to match question marks |
| MCQ without is_correct | Add is_correct: true/false to all options |
| Missing plain text | Add question_stem_plain for accessibility |

## Output Schema

Return the same section structure with fixes applied:

```json
{
  "section_id": "section_{{section_index}}",
  "section_label": "{{section_label}}",
  "section_order": ...,
  "section_marks": ...,
  "section_time_allocation": ...,
  "section_instructions": "...",
  "questions": [...],
  "section_question_count": ...,
  "section_total_marks": ...
}
```

## Process

1. Read the current section and critic feedback
2. Identify specific questions or fields that need fixes
3. Apply targeted fixes
4. Verify all counts and sums are correct
5. Output the revised section - SDK captures your structured output
