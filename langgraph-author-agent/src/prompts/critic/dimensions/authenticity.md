# Dimension 5: Authenticity - Detailed Validation

**Threshold**: ≥0.90
**Purpose**: Ensure Scottish classroom authenticity and proper SQA terminology usage

---

## Validation Criteria (Comprehensive)

### SQA Terminology Alignment
- Does the SoW use exact unit titles from Course_data.txt?
- Are unit codes correctly referenced? (e.g., "HV7Y 73")
- Does the SoW use official outcome titles from Course_data.txt?
- Is assessment terminology aligned with Course_data.txt standards?

### Enriched Format Validation
- **Entry-level**: Are assessmentStandardRefs objects with descriptions matching Course_data.txt exactly?
- **Card-level**: Do cards in lesson_plan use enriched standards_addressed (code/description/outcome)?
- No bare string codes ("AS1.2") - must be objects

### Lesson Plan Scottish Context Validation
- **Do ALL cards in lesson_plan use Scottish contexts?**
  * For cards with `worked_example`: Check for £ currency, Scottish shops/services (Tesco, NHS, bus fares)
  * For cards with `practice_problems`: Verify Scottish scenarios
  * Check `lesson_plan.multi_standard_integration_strategy` mentions authentic Scottish scenarios
  * Verify card titles and purposes use CfE/SQA terminology
  * Ensure card-level standards_addressed use enriched objects (code/description/outcome)

### CfE/SQA Language Usage
- Is CfE/SQA-specific language used correctly? (e.g., "assessment standard", not "learning objective")
- Are terms consistent with Scottish educational practice?

### Currency and Measurement
- Currency shown in £ (not $ or €)
- Measurements use appropriate units for Scottish context

### Scottish Contexts
- Contexts reflect Scotland:
  * NHS (prescription costs, health services)
  * Local councils (council tax, public services)
  * Scottish shops (Tesco, Asda, Sainsbury's, Morrisons, Greggs, local chippies)
  * Bus fares (SPT, Lothian Buses, Ridacard)
  * Scottish attractions (Edinburgh Zoo, Glasgow Science Centre)

### Field Naming
- Entries use `lesson_instruction` (NOT "notes")

### Entry-Level Lesson Instruction Alignment
- Entry `lesson_instruction` aligns with Scottish pedagogical approaches
- Language and phrasing reflect CfE/SQA practice

---

## Validation Process (Step-by-Step)

1. **Read official SQA terminology, unit titles, codes, outcomes, standards**
   - Extract Course_data.txt:
     * Unit titles
     * Unit codes
     * Outcome titles
     * Assessment standard codes and descriptions

2. **Validate unit titles match exactly**
   - For each unit referenced in SoW entries:
     * Compare to Course_data.txt unit titles
     * Flag any mismatches (even minor spelling differences)

3. **Validate unit codes**
   - Check unit codes in entries match Course_data.txt format
   - Verify correct structure (e.g., "HV7Y 73")

4. **Validate outcome titles**
   - For each outcome referenced in SoW:
     * Compare to Course_data.txt outcome titles
     * Flag any non-standard outcome names

5. **Validate assessment terminology**
   - Check that entries use correct SQA terminology
   - Flag non-standard terms (e.g., "learning objective" instead of "assessment standard")

6. **Validate enriched format (descriptions match Course_data.txt exactly - entry AND card level)**
   - **Entry-level**:
     * Extract assessmentStandardRefs
     * For each, verify `description` field matches Course_data.txt exactly (word-for-word)
     * Flag any bare codes or mismatched descriptions
   - **Card-level**:
     * Extract lesson_plan.card_structure[].standards_addressed
     * For each, verify `description` field matches Course_data.txt exactly
     * Flag any bare codes or mismatched descriptions

7. **Validate lesson_plan.card_structure Scottish authenticity**:

   **a) Check cards with worked_example/practice_problems use £, Scottish shops/services**
   - For cards with `worked_example`:
     * Check for £ currency (not $ or €)
     * Check for Scottish shops (Tesco, Asda, NHS, etc.)
     * Flag non-Scottish contexts
   - For cards with `practice_problems`:
     * Same checks as worked_example
     * Verify problems use authentic Scottish scenarios

   **b) Verify lesson_plan.multi_standard_integration_strategy mentions Scottish scenarios**
   - Extract `lesson_plan.multi_standard_integration_strategy` field
   - Check if strategy mentions Scottish contexts (e.g., "Using Tesco meal deals to integrate fractions and percentages")
   - Flag if generic or non-Scottish

   **c) Check card titles/purposes use CfE/SQA terminology**
   - For each card:
     * Extract `title` and `purpose`
     * Verify CfE/SQA language used (not American or generic terms)
     * Flag non-standard phrasing

   **d) Verify card-level standards_addressed use enriched objects**
   - Check `standards_addressed` field for each card
   - Verify objects with code/description/outcome (NOT bare codes)
   - Flag any bare string codes

8. **Validate field naming**
   - Check entries use `lesson_instruction` field (NOT "notes")
   - Flag any "notes" field usage

9. **Check CfE/SQA-specific language**
   - Review entry labels, lesson_instruction, and card content
   - Verify CfE/SQA terminology used consistently
   - Flag American spellings or non-Scottish phrasing

10. **Check Scottish authenticity (currency, contexts, phrasing) across all cards**
    - Review all card worked_examples, practice_problems, pedagogical_approach
    - Verify £ currency used (not $ or €)
    - Check for authentic Scottish contexts throughout
    - Flag non-Scottish references

11. **Verify lesson_instruction aligns with Scottish approaches**
    - Extract entry `lesson_instruction`
    - Check for CfE/SQA pedagogical language
    - Verify alignment with Scottish classroom practice

---

## Common Issues to Flag

### SQA Terminology Issues
- **Incorrect unit titles or codes**: Titles don't match Course_data.txt exactly
- **Non-standard terminology**: Using terms like "learning objective" instead of "assessment standard"
- **Outcome title mismatches**: Outcome names don't match Course_data.txt

### Enriched Format Issues
- **Bare string codes or mismatched descriptions (entry-level OR card-level)**:
  * Entry assessmentStandardRefs: ["AS1.2", "AS2.1"] instead of objects
  * Card standards_addressed: ["AS1.2"] instead of objects
  * Description doesn't match Course_data.txt exactly

### Card-Level Scottish Context Issues
- **Cards use non-Scottish contexts ($ instead of £, non-Scottish shops)**:
  * Worked examples: "Calculate 20% discount on $50 item at Walmart"
  * Practice problems: "Bus fare is $2.50"
- **Cards lack Scottish scenarios in worked examples/practice problems**:
  * Generic contexts: "A shop sells items for X"
  * Missing Scottish hooks: No Tesco, NHS, bus fares, etc.
- **lesson_plan.multi_standard_integration_strategy doesn't mention Scottish contexts**:
  * Generic strategy: "Integrate fractions and percentages through problem-solving"
  * Missing Scottish references

### Field Naming Issues
- **Using "notes" instead of "lesson_instruction"**: Schema violation

### Currency and Context Issues
- **Non-Scottish currency or contexts**:
  * Using $ or € instead of £
  * American contexts (Walmart, ZIP codes)
  * Non-UK measurement units

### CfE/SQA Language Issues
- **Non-CfE/SQA phrasing**:
  * American spellings ("math" instead of "maths")
  * Generic educational terms instead of Scottish-specific

---

## Scoring Guidance

**Suggested Weights** (adjust based on priorities):

| Criterion | Weight | Pass Condition |
|-----------|--------|----------------|
| Unit titles/codes match Course_data.txt | 0.15 | Exact match |
| Outcome titles match | 0.10 | Exact match |
| Assessment terminology aligned | 0.10 | CfE/SQA terms used |
| Enriched format (entry AND card level) | 0.20 | Descriptions match exactly |
| Cards use Scottish contexts | 0.25 | £ currency, Scottish shops/services |
| multi_standard_integration_strategy Scottish | 0.10 | Mentions Scottish scenarios |
| Field naming correct | 0.05 | lesson_instruction (NOT notes) |
| CfE/SQA language throughout | 0.05 | Consistent terminology |

**Scoring Calculation**:
- Start with 1.0 (perfect)
- Deduct weighted penalties for each violation
- Floor at 0.0

**Pass Threshold**: ≥0.90
