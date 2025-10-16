# Lesson Author Agent - Example JSON Files

This directory contains reference JSON examples for all key data structures in the Lesson Author pipeline.

## Overview

These examples demonstrate the complete data flow:

```
SOW Entry Input → Lesson Template → Critic Result
```

Each file includes:
- ✅ Fully compliant structure
- ✅ Realistic Scottish contexts
- ✅ SQA-aligned content
- ✅ Inline comments explaining key fields

---

## File Index

### Input Files

#### 1. `sow_entry_input_example.json`

**Purpose**: Demonstrates SOW entry format extracted from `default.Authored_SOW` collection

**Use Case**: Understanding lesson requirements and curriculum alignment

**Key Features**:
- Order: 1 (1-indexed, not 0-indexed)
- Lesson type: `teach` (I-We-You progression)
- Engagement tags: finance, shopping, transport
- Calculator policy: Not allowed (non-calculator lesson)

**Schema Documentation**: [sow_entry_input_schema.md](../sow_entry_input_schema.md)

---

#### 2. `sow_context_example.json`

**Purpose**: Demonstrates course-level SOW metadata

**Use Case**: Understanding big picture context for individual lesson

**Key Features**:
- Subject: Mathematics
- Level: National 5
- Total entries: 12 lessons
- Course-wide coherence, accessibility, and engagement notes

**Schema Documentation**: [sow_entry_input_schema.md](../sow_entry_input_schema.md#sow-context-file-sow_contextjson)

---

### Output Files

#### 3. Lesson Template Example

**Purpose**: Demonstrates complete lesson template with 4 cards

**Location**: `../../tests/mock_lesson_template.json`

**Use Case**: Understanding lesson structure, card design, and quality standards

**Key Features**:
- 4 cards (teach lesson: Starter → Modelling → Guided Practice → Independent Practice)
- Scottish contexts: ScotRail, Tesco, Edinburgh
- CEFR A2-B1 accessibility (explainer_plain for all cards)
- SQA-aligned rubrics (method + accuracy marks)
- Misconception anticipation (4 misconceptions across cards)
- I-We-You progression with scaffolding (HIGH → MEDIUM → LOW)

**Schema Documentation**: [lesson_template_schema.md](../lesson_template_schema.md)

**Note**: The mock lesson template in `tests/` is used for actual testing (compression, upsert, validation) and serves as the canonical reference example.

---

### Validation Files

#### 4. `critic_result_pass_example.json`

**Purpose**: Demonstrates successful validation result

**Use Case**: Understanding pass criteria and dimension scoring

**Key Features**:
- Overall status: `pass`
- Overall score: 0.92 (above 0.88 threshold)
- All dimension scores meet/exceed thresholds (0.85-0.88)
- Empty feedback array (no issues to address)

**Schema Documentation**: [lesson_critic_result_schema.md](../lesson_critic_result_schema.md#complete-example-pass-status)

**Agent Behavior**: Proceeds to card compression and database upsert

---

#### 5. `critic_result_needs_revision_example.json`

**Purpose**: Demonstrates failed validation with specific feedback

**Use Case**: Understanding revision requirements and feedback prioritization

**Key Features**:
- Overall status: `needs_revision`
- Overall score: 0.86 (below 0.88 threshold)
- Accessibility dimension (0.82) fails threshold (0.88)
- 3 feedback items with severity levels (2 high, 1 medium)
- Specific actions for each issue

**Schema Documentation**: [lesson_critic_result_schema.md](../lesson_critic_result_schema.md#complete-example-needs-revision-status)

**Agent Behavior**: Triggers retry loop (up to 10 attempts) with feedback-guided revision

---

## Usage Examples

### Example 1: Understanding Pipeline Input

To understand what the Lesson Author agent receives as input:

```bash
# Read SOW entry requirements
cat sow_entry_input_example.json

# Read course-level context
cat sow_context_example.json

# Note: Agent also receives Course_data.txt (not shown here)
# which contains enriched SQA outcome descriptions
```

### Example 2: Understanding Quality Standards

To understand what constitutes a high-quality lesson template:

```bash
# Read reference lesson template
cat ../../tests/mock_lesson_template.json

# Compare to schema documentation
open ../lesson_template_schema.md
```

**Key Quality Indicators**:
- ✅ All fields present and correctly formatted
- ✅ Scottish contexts authentic (£ currency, Scottish brands, realistic pricing)
- ✅ CEFR A2-B1 plain language (8-12 word sentences, active voice)
- ✅ SQA rubrics (method + accuracy marks)
- ✅ Misconceptions anticipated (error patterns + clarifications)
- ✅ I-We-You progression (teach lessons only)

### Example 3: Understanding Validation Logic

To understand how the critic evaluates lessons:

```bash
# Read pass example (all thresholds met)
cat critic_result_pass_example.json

# Read needs_revision example (accessibility fails)
cat critic_result_needs_revision_example.json
```

**Pass Criteria**:
1. All dimension scores >= dimension threshold (0.85-0.88)
2. Overall weighted score >= 0.88

**Revision Priority**:
- **Critical severity**: Must fix (e.g., wrong currency, missing outcomes)
- **High severity**: Should fix (e.g., accessibility violations, unclear rubrics)
- **Medium/Low severity**: Nice to fix (e.g., stylistic improvements)

---

## Dimension Score Interpretation

Understanding the 0.00-1.00 scoring scale:

| Score Range | Interpretation | Agent Action |
|-------------|----------------|--------------|
| **0.90-1.00** | Excellent quality | Pass (proceed to upsert) |
| **0.88-0.89** | Acceptable quality | Pass (meets SQA standards) |
| **0.85-0.87** | Borderline | Needs revision (minor fixes) |
| **0.00-0.84** | Significant issues | Needs revision (major fixes) |

**Dimension Weights** (for overall_score calculation):
- Assessment Design: 0.25 (highest - SQA alignment critical)
- SOW Fidelity: 0.25 (highest - curriculum alignment critical)
- Pedagogical Design: 0.20
- Accessibility: 0.20
- Scottish Context: 0.20
- Coherence: 0.15 (lowest - internal consistency)

---

## Testing with Examples

### Test 1: Validate Example Lesson Template

```bash
# Run critic on mock lesson template
cd ../..
python tests/test_lesson_upserter.py

# Expected: All 4 tests pass (compression, upsert, data integrity)
```

### Test 2: Simulate Revision Loop

```python
# Pseudocode demonstrating feedback-guided revision
lesson_template = read("tests/mock_lesson_template.json")
critic_result = validate(lesson_template)

if critic_result["overall_status"] == "needs_revision":
    feedback = critic_result["feedback"]

    # Focus on critical/high severity issues first
    critical_issues = [f for f in feedback if f["severity"] == "critical"]
    high_issues = [f for f in feedback if f["severity"] == "high"]

    # Apply revisions based on feedback actions
    for issue in critical_issues + high_issues:
        apply_revision(lesson_template, issue["action"])

    # Re-validate
    critic_result = validate(lesson_template)
```

---

## Schema Cross-References

Each example file corresponds to a detailed schema document:

1. **SOW Entry Input** → [sow_entry_input_schema.md](../sow_entry_input_schema.md)
   - 7 required fields (order, label, big_idea, outcomeRefs, estMinutes, lesson_type, engagement_tags, policy)
   - Order indexing (1-indexed, not 0-indexed)
   - Lesson type specifications (teach, independent_practice, formative_assessment, revision, mock_exam)

2. **Lesson Template** → [lesson_template_schema.md](../lesson_template_schema.md)
   - 11 top-level fields + cards array
   - 4 CFU types (mcq, numeric, structured_response, short_text)
   - CEFR A2-B1 accessibility requirements
   - Scottish context authenticity rules

3. **Critic Result** → [lesson_critic_result_schema.md](../lesson_critic_result_schema.md)
   - 6 quality dimensions with weights and thresholds
   - Feedback structure (dimension, severity, issue, action)
   - Pass criteria and retry logic

---

## Related Documentation

- [Lesson Author README](../../LESSON_AUTHOR_README.md) - User guide and CLI usage
- [Lesson Author Implementation Status](../../LESSON_AUTHOR_IMPLEMENTATION_STATUS.md) - Development tracking
- [SOW Author README](../../README.md#sow-author) - Creating SOW entries
- [Schema Documentation Index](../README.md) - All schema documents (if created)

---

## Version History

**Version 1.0** (October 2025):
- Initial release with 5 example files
- Covers complete pipeline: SOW entry → lesson template → critic result
- Includes both pass and needs_revision validation examples

---

**Maintained By**: Lesson Author Agent Documentation
**Last Updated**: October 2025
