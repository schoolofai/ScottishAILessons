# Mock Exam Reviser

Revise an existing mock exam based on critic feedback.

## Context

- Exam ID: {{examId}}
- Subject: {{subject}}
- Level: {{level}}
- Iteration: {{iteration}} of {{max_iterations}}
- Previous Score: {{overall_score}}/5.0

## Input Files

Read these files (in current working directory):
1. `mock_exam.json` - Current exam version to revise
2. `mock_exam_critic_result.json` - Critic feedback with specific issues
3. `mock_exam_source.json` - Original SOW entry (for reference)
4. `sow_context.json` - Course context (for reference)

## Critic Feedback Summary

### Dimension Scores
{{dimension_scores}}

### Required Improvements (MUST FIX)
{{improvements_required}}

### Specific Issues by Dimension
{{dimension_issues}}

## Revision Rules

1. **Focus on FAILING dimensions** (score < 3.5):
   - Only fix issues explicitly listed in `improvements_required`
   - Do not change questions/content that wasn't flagged

2. **Preserve passing content**:
   - If a dimension scored ≥ 4.0, make NO changes to related content
   - Only fix the specific issues identified

3. **Priority order**:
   - [High] issues MUST be fixed
   - [Medium] issues SHOULD be fixed
   - [Low] issues MAY be fixed if time permits

4. **Marks must still sum correctly**:
   - If fixing marking_scheme, ensure marks sum to question marks
   - If fixing questions, ensure section marks still sum to total

5. **Schema compliance**:
   - Output must match the same schema as mock_exam.json
   - All required fields must be present

## Common Fixes

| Issue Type | How to Fix |
|------------|-----------|
| Arithmetic error in worked_solution | Recalculate and correct the step |
| Missing question_stem_plain | Add plain English at CEFR B1 level |
| Marks don't sum | Adjust marking_scheme steps to sum correctly |
| Non-sequential question numbers | Renumber sequentially |
| Time estimate too low | Increase estimated_minutes |
| Missing hint | Add 1-2 helpful hints |
| Missing misconception | Add common error pattern with feedback |

## Output

Produce the revised mock_exam JSON. Your output will be automatically structured to match the MockExam schema.

Focus on surgical fixes - do NOT regenerate the entire exam. Only modify the specific questions/fields flagged by the critic.

## Process

1. Read `mock_exam_critic_result.json` to understand what needs fixing
2. Read `mock_exam.json` to see current state
3. Apply fixes for each improvement in `improvements_required`
4. Verify marks still sum correctly after fixes
5. Output the revised exam JSON
