# Dimension 4: Accessibility - Detailed Validation

**Threshold**: ≥0.90
**Purpose**: Review accessibility provisions, engagement tags, and inclusive design practices

---

## Validation Criteria (Comprehensive)

### Global Accessibility
- Are global `accessibility_notes` present and meaningful?
- Do notes address dyslexia-friendly design, plain language, pacing, and chunking?

### Entry-Level Accessibility Profile
- Do ALL entries include `accessibility_profile` with ALL required sub-fields?
  * `dyslexia_friendly`: boolean (required)
  * `plain_language_level`: string (required, e.g., "CEFR_B1")
  * `extra_time`: boolean (required)

### Plain Language and Clarity
- Do entries have clear, plain-language `label` and `lesson_instruction` fields?
- Is vocabulary appropriate for target reading level?
- Are instructions explicit and unambiguous?

### Engagement Tags
- Are `engagement_tags` authentic, specific, and linked to Scottish contexts?
- Do tags reflect real-world scenarios? (£ prices, NHS, supermarket, bus fares, local shops)
- Are tags varied across the course?

### Chunked Lesson Block Accessibility Validation
- **For each consolidated lesson block**:
  * Is accessibility applied consistently across all lesson types?
  * Are dyslexia-friendly cues evident at all critical points in card sequences?
  * Do engagement tags evolve realistically across cards?
  * Do cards embed misconceptions with remediations?

### Card-Level Accessibility
- Do cards use plain language in titles, purposes, and pedagogical approaches?
- Are CFU strategies clear and specific (not vague or generic)?
- Do cards with misconceptions include remediation strategies?

### Enriched Format Validation
- **Entry-level**: assessmentStandardRefs are enriched objects (code/description/outcome)
- **Card-level**: standards_addressed are enriched objects (code/description/outcome)

### Field Naming
- Entries use `lesson_instruction` (NOT "notes")

---

## Validation Process (Step-by-Step)

1. **Check global accessibility fields**
   - Extract `metadata.accessibility_notes`
   - Verify notes are present and meaningful (not generic like "use dyslexia-friendly fonts")
   - Check for specific strategies: plain language, pacing, chunking, visual aids

2. **For each entry**:

   **a) Verify accessibility_profile completeness**
   - Extract `accessibility_profile`
   - Check all required sub-fields present:
     * dyslexia_friendly (boolean)
     * plain_language_level (string, e.g., "CEFR_B1")
     * extra_time (boolean)
   - Flag any missing sub-fields

   **b) Validate field naming (lesson_instruction, not "notes")**
   - Check for `lesson_instruction` field
   - Flag if "notes" field is used instead

   **c) Check labels and instructions use plain language**
   - Extract `label` and `lesson_instruction`
   - Assess vocabulary complexity
   - Flag if language is overly technical or vague

   **d) Ensure engagement_tags are authentic and contextualized**
   - Extract `engagement_tags` array
   - Verify tags are specific (not generic like "math")
   - Check for Scottish context hooks (shopping, NHS, bus_fares, finance, sports, etc.)
   - Flag if tags are non-Scottish ($ currency, non-UK contexts)

3. **Validate enriched format (entry-level assessmentStandardRefs AND card-level standards_addressed)**
   - **Entry-level**: Check `assessmentStandardRefs` are objects with code/description/outcome
   - **Card-level**: Check `lesson_plan.card_structure[].standards_addressed` are objects
   - Flag any bare codes ("AS1.2" instead of {code: "AS1.2", description: "...", outcome: "O1"})

4. **For each consolidated block**:

   **a) Verify accessibility consistency across lesson types**
   - Identify consolidated blocks (entries with 2+ assessmentStandardRefs)
   - For each block, verify all entries have consistent accessibility_profile settings
   - Flag if some entries lack accessibility provisions

   **b) Check Scottish context hooks remain realistic across cards**
   - Extract lesson_plan.card_structure for each entry in block
   - Verify cards use authentic Scottish scenarios in worked_example, practice_problems
   - Check engagement_tags are consistent and evolve realistically across cards

   **c) Verify cards embed misconceptions with remediations**
   - For cards addressing common errors, check `misconceptions_addressed` array
   - Verify each misconception has a corresponding remediation strategy
   - Flag if misconceptions listed without remediation

---

## Common Issues to Flag

### Global Accessibility Issues
- **Missing or generic accessibility_notes**: No global accessibility strategy or generic statements
- **Insufficient guidance**: Accessibility notes don't address key strategies (plain language, pacing, chunking)

### Entry-Level Accessibility Issues
- **Missing or incomplete accessibility_profile fields**:
  * dyslexia_friendly missing or not boolean
  * plain_language_level missing or not specified
  * extra_time missing or not boolean
- **Using "notes" instead of "lesson_instruction"**: Field naming violation
- **Non-plain language**: Labels or instructions use overly technical vocabulary

### Engagement Tag Issues
- **Generic or non-Scottish engagement_tags**:
  * Generic: "math", "numbers", "problem-solving"
  * Non-Scottish: "dollars", "Walmart", "ZIP codes"
- **Inconsistent tags**: Tags don't reflect authentic Scottish classroom scenarios

### Consolidated Block Issues
- **Inconsistent accessibility within consolidated blocks**: Some entries have full accessibility_profile, others missing fields
- **Scottish context hooks not realistic across cards**: Cards use non-Scottish contexts ($ instead of £, non-Scottish shops)
- **Misconceptions without remediation**: Cards list misconceptions but don't provide remediation strategies

### Enriched Format Issues
- **Missing enriched format (entry-level OR card-level)**:
  * Bare codes in assessmentStandardRefs: ["AS1.2", "AS2.1"]
  * Bare codes in card-level standards_addressed: ["AS1.2"]

---

## Scoring Guidance

**Suggested Weights** (adjust based on priorities):

| Criterion | Weight | Pass Condition |
|-----------|--------|----------------|
| Global accessibility_notes present | 0.10 | Meaningful strategies listed |
| ALL entries have complete accessibility_profile | 0.25 | All sub-fields present |
| Plain language used | 0.15 | Labels/instructions clear |
| Engagement_tags authentic and Scottish | 0.20 | Specific, Scottish contexts |
| Accessibility consistent within blocks | 0.10 | All lesson types have provisions |
| Cards embed misconceptions with remediations | 0.10 | Remediation strategies present |
| Enriched format at entry AND card level | 0.10 | Objects used, not bare codes |

**Scoring Calculation**:
- Start with 1.0 (perfect)
- Deduct weighted penalties for each violation
- Floor at 0.0

**Pass Threshold**: ≥0.90
