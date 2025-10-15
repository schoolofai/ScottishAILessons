# Dimension 1: Coverage - Detailed Validation

**Threshold**: ≥0.90
**Purpose**: Evaluate breadth and depth of coverage for all official SQA units, outcomes, and assessment standards

---

## Validation Criteria (Comprehensive)

### Unit and Outcome Coverage
- Does the SoW cover ALL official units from Course_data.txt (`course_structure.units[]`)?
- Does the SoW address ALL official outcomes from Course_data.txt (`outcomes[]`)?
- Are ALL assessment standards from Course_data.txt represented (either individually or within consolidated lesson blocks)?

### Chunking and Consolidation
- **CHUNKING ACCEPTANCE**: Accept that 2-3 (or up to 5) standards can be consolidated into unified lessons with thematic coherence
- For each consolidated lesson block, is there a **multi-lesson sequence** that includes:
  * Mandatory teach→revision pairing (every teach lesson followed by revision lesson)
  * formative_assessment → independent_practice after teach→revision pairs

### Course-Level Lesson Type Validation
- **independent_practice**: Does the SoW include at least one independent_practice lesson? (for mock exam prep)
- **mock_assessment**: Does the SoW include exactly one mock_assessment lesson? (for real exam simulation)
- **teach→revision pairing**: Every teach lesson must have corresponding revision lesson (1:1 ratio)

### Enriched Format Validation
- **assessmentStandardRefs**: Are they objects (NOT bare strings) with code, description (from Course_data.txt), and outcome fields?
- **Entry-level enrichment**: Check `entries[].assessmentStandardRefs`
- **Card-level enrichment**: Check `entries[].lesson_plan.card_structure[].standards_addressed`

### Lesson Plan Depth Validation
- **Card count**: Does every entry have lesson_plan with 6-12 cards?
- **Card completeness**: Are all card fields present?
  * card_number, card_type, title, purpose
  * standards_addressed (enriched objects with code/description/outcome)
  * pedagogical_approach (detailed, not generic)
  * cfu_strategy (specific, not "ask questions")
  * estimated_minutes

### Card-Level Standards Mapping
- **Progressive scaffolding**: For chunked lessons, do cards progressively scaffold ALL consolidated standards?
- **Standard coverage**: Do ALL assessmentStandardRefs appear in at least 2-3 cards?
- **Timing validation**: Do card timings sum to estMinutes? (allow ±5 min tolerance)

### Breadth and Balance
- Does the SoW touch all major themes identified in the research pack?
- Are there enough entries for the intended time window? (should be ~10-20 lessons, NOT 80-100)
- Is there a realistic balance of lesson_type values?
- Are prerequisites and progression realistic?

---

## Validation Process (Step-by-Step)

1. **Check coverage of ALL units**
   - Read Course_data.txt `course_structure.units[]`
   - For each unit, verify at least one entry references it
   - Flag any missing units

2. **Check coverage of ALL outcomes**
   - Read Course_data.txt `outcomes[]`
   - For each outcome, verify entries reference it in `outcomeRefs`
   - Flag any missing outcomes

3. **Check coverage of ALL assessment standards** (accepting chunking/consolidation)
   - Read Course_data.txt assessment standards list
   - For each standard, verify it appears in at least one entry's assessmentStandardRefs array
   - Accept that standards can be consolidated (2-3 per lesson, max 5 if justified)
   - For each consolidated lesson block, confirm lesson sequence exists:
     * teach → revision (mandatory pairing)
     * formative_assessment → independent_practice (after pairs)

4. **Validate enriched format** (assessmentStandardRefs are objects with code, description, outcome)
   - Check entry-level: `entries[].assessmentStandardRefs[].{code, description, outcome}`
   - Verify descriptions match Course_data.txt exactly (no bare codes like "AS1.2")
   - Flag any bare string codes

5. **Validate lesson_plan presence and depth** for EACH entry:
   - Extract `lesson_plan.card_structure` array
   - Count cards (must be 6-12 for realistic lesson)
   - For each card:
     * Verify all required fields present (card_number, card_type, title, purpose, standards_addressed, pedagogical_approach, cfu_strategy, estimated_minutes)
     * Verify `standards_addressed` uses enriched objects (code/description/outcome) - NOT bare codes
     * Verify pedagogical_approach is detailed, not generic
     * Verify cfu_strategy is specific (not "ask questions")
     * Check `misconceptions_addressed` if relevant card type
   - Aggregate standards_addressed across all cards in lesson_plan
   - Compare to entry's assessmentStandardRefs: **all standards must appear in at least 2-3 cards**
   - Verify card timings sum to estMinutes (allow ±5 min tolerance)

6. **Check breadth**: major themes from research pack represented
   - Read research_pack_json for distilled themes
   - Verify SoW touches on all major pedagogical themes

7. **Check quantity**: ~10-20 lessons (not 80-100)
   - Count total entries
   - Flag if < 10 or > 20 (unrealistic for Scottish course delivery)

8. **Check balance**: lesson_type cadence is varied
   - Count entries by lesson_type
   - Verify distribution is realistic (not all teach, not all practice)

9. **Validate lesson type requirements**:
   - **Teach→revision pairing**: Count teach lessons vs revision lessons (must be 1:1 ratio)
   - **Pairing verification**: For each teach lesson, verify a revision lesson exists and appears soon after (consecutive or minimal gap)
   - **Independent practice count**: Count independent_practice lessons (must be ≥1 at course level)
   - **Mock assessment count**: Count mock_assessment lessons (must be exactly 1 at course level)

---

## Common Issues to Flag

### Coverage Issues
- Missing units, outcomes, or assessment standards
- Incomplete lesson sequences for consolidated blocks
- Bare string codes instead of enriched objects (entry-level OR card-level)

### Lesson Plan Issues
- **Shallow lesson plans**: < 6 cards per entry
- **Missing or incomplete card fields**: card_number, title, standards_addressed, etc.
- **Cards using bare codes**: standards_addressed should be enriched objects (code/description/outcome)
- **Poor standard mapping**: cards don't address all consolidated standards
- **Unrealistic timing**: cards sum to 15min for a 50min lesson
- **Generic CFU strategies**: "ask questions" instead of specific prompts (e.g., "MCQ: Which fraction equals 25%?")

### Lesson Type Issues
- **Teach→revision pairing violated**: teach lesson without corresponding revision lesson
- **Missing course-level independent_practice**: required for mock exam prep (must have ≥1)
- **Missing or multiple mock_assessment**: must be exactly 1 for real exam simulation

### Quantitative Issues
- Insufficient lesson count (< 10) or excessive count (> 20)
- Imbalanced lesson types (e.g., 15 teach, 1 practice)

---

## Scoring Guidance

**Suggested Weights** (adjust based on priorities):

| Criterion | Weight | Pass Condition |
|-----------|--------|----------------|
| All units covered | 0.15 | 100% match |
| All outcomes covered | 0.15 | 100% match |
| All standards covered | 0.20 | 100% match (chunking accepted) |
| Enriched format used | 0.15 | Entry AND card level |
| Lesson plans detailed | 0.20 | 6-12 cards, complete fields |
| Lesson type requirements | 0.10 | Teach→revision 1:1, ≥1 independent, =1 mock |
| Course requirements met | 0.05 | Realistic count, balanced types |

**Scoring Calculation**:
- Start with 1.0 (perfect)
- Deduct weighted penalties for each violation
- Floor at 0.0

**Pass Threshold**: ≥0.90
