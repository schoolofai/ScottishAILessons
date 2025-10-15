# Dimension 3: Policy - Detailed Validation

**Threshold**: ≥0.80
**Purpose**: Ensure policy guardrails (calculator usage, assessment cadence, timing) align with official SQA assessment rules

---

## Validation Criteria (Comprehensive)

### Calculator Policy Alignment
- Does calculator usage align with `assessment_model.calculator_policy` from Course_data.txt?
- Is calculator usage staged appropriately across the course? (non_calc → mixed → calc progression)
- Are calculator rules consistent within consolidated lesson blocks?

### Chunked Lesson Block Policy Validation
- **For each consolidated lesson block**:
  * Are calculator rules consistent with official policy at each stage?
  * Do assessment notes appear in related entries?
  * Is policy applied consistently across all standards within the block?

### Assessment Cadence
- Does assessment cadence match `assessment_model.coursework_notes` from Course_data.txt?
- Are formative, revision, and summative assessments realistically distributed?
- Spacing between assessments appropriate?

### Timing Validation
- Do `estMinutes` values align with Scottish classroom periods? (25–50 minutes typical)
- Are timings realistic for lesson complexity?

### Metadata Policy Alignment
- Are `metadata.policy_notes` honored?
- Does marking guidance from Course_data.txt inform assessment-aligned entries?

### Enriched Format and Guidance
- **Enriched format**: assessmentStandardRefs are objects (code/description/outcome) - NOT bare codes
- **Lesson plan presence**: Every entry has lesson_plan with detailed card structure (6-12 cards)
- **Field naming**: entries use `lesson_instruction` (NOT "notes")

---

## Validation Process (Step-by-Step)

1. **Read official assessment model, calculator policy, and marking guidance**
   - Extract Course_data.txt `assessment_model.calculator_policy`
   - Extract `assessment_model.coursework_notes`
   - Extract marking guidance if present

2. **Validate calculator usage (global and block-level)**
   - For each entry:
     * Extract `policy.calculator_section` (non_calc | mixed | calc)
     * Compare to official policy for that stage of course
     * Flag if calculator usage violates SQA rules
   - Verify progressive staging: early lessons should use non_calc, later lessons calc
   - **Block-level check**: For consolidated blocks, verify calculator policy is consistent across all standards

3. **Validate assessment cadence (spacing, thresholds)**
   - Identify assessment-focused entries (formative_assessment, summative_assessment, mock_assessment)
   - Check spacing between assessments (not too frequent, not too sparse)
   - Verify alignment with coursework_notes from Course_data.txt
   - Confirm formative → summative progression is realistic

4. **Validate timing (estMinutes realistic)**
   - For each entry:
     * Extract `estMinutes`
     * Verify value is within Scottish period range (25-50 min typical)
     * Flag if timing is unrealistic (e.g., 5 min for complex lesson, 120 min single period)

5. **Validate marking guidance alignment**
   - Read Course_data.txt marking guidance
   - For assessment entries, verify rubric or assessment notes align with SQA expectations

6. **Validate enriched format, guidance, and field naming**
   - Check entry-level assessmentStandardRefs use objects (code/description/outcome)
   - Verify lesson_plan exists with 6-12 cards
   - Check card-level standards_addressed use enriched objects
   - **Field naming check**: Verify entries use `lesson_instruction` field (NOT "notes")

---

## Common Issues to Flag

### Calculator Policy Violations
- **Calculator usage doesn't align with official policy**: e.g., calc allowed in early lessons when policy requires non_calc
- **Calculator staging inappropriate**: No progressive non_calc → mixed → calc transition
- **Block-level policy inconsistencies**: Within a consolidated block, some standards use calc and others use non_calc without justification

### Assessment Cadence Issues
- **Assessment cadence violates coursework rules**: e.g., too many summative assessments, formative assessments too sparse
- **Spacing issues**: Assessments clustered (3 assessments in 4 lessons) or too sparse (no assessment for 15 lessons)
- **Progression issues**: Summative assessment before formative assessment

### Timing Issues
- **estMinutes values unrealistic**:
  * Too short: 5 min for lesson with 10 cards
  * Too long: 90 min for single Scottish period
- **Timing doesn't match Scottish classroom realities**: Lessons designed for 60-min periods when Scottish periods are 50 min

### Field Naming Issues
- **Using "notes" instead of "lesson_instruction"**: Field naming doesn't follow schema requirements

### Missing Enriched Format or Guidance
- **Bare codes**: assessmentStandardRefs or standards_addressed use bare strings ("AS1.2") instead of enriched objects
- **Missing lesson_plan**: Entry lacks detailed card structure

---

## Scoring Guidance

**Suggested Weights** (adjust based on priorities):

| Criterion | Weight | Pass Condition |
|-----------|--------|----------------|
| Calculator usage aligns with policy | 0.30 | All entries comply |
| Calculator staging appropriate | 0.15 | non_calc → mixed → calc progression |
| Assessment cadence matches coursework | 0.20 | Spacing and thresholds correct |
| estMinutes realistic | 0.15 | 25-50 min for Scottish periods |
| Policy consistent within blocks | 0.10 | Consolidated blocks have uniform policy |
| Enriched format and field naming | 0.10 | Objects used, lesson_instruction present |

**Scoring Calculation**:
- Start with 1.0 (perfect)
- Deduct weighted penalties for each violation
- Floor at 0.0

**Pass Threshold**: ≥0.80
