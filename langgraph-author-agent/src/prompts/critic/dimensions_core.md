# Layer 2: Critic Dimensions Core

**Priority**: REQUIRED
**Token Estimate**: ~250 tokens
**Purpose**: Lightweight dimension summaries with quick validation checklists

---

## Dimension 1: Coverage (Threshold ≥0.90)

**Validates**: Breadth and depth of SQA curriculum coverage

**Quick Checklist**:
- [ ] All units from Course_data.txt covered
- [ ] All outcomes addressed
- [ ] All assessment standards represented (chunking accepted: 2-3 standards per lesson, max 5 if justified)
- [ ] Every consolidated lesson block has multi-lesson sequence (teach→revision→formative→independent)
- [ ] Every teach lesson paired with revision lesson (1:1 ratio)
- [ ] Course includes ≥1 independent_practice lesson
- [ ] Course includes exactly 1 mock_assessment lesson
- [ ] Enriched format: assessmentStandardRefs are objects (code/description/outcome) - NOT bare codes
- [ ] Lesson plans detailed: 6-12 cards per entry
- [ ] Cards use enriched standards_addressed (code/description/outcome objects)
- [ ] Cards progressively scaffold ALL consolidated standards
- [ ] CFU strategies specific (not generic "ask questions")
- [ ] Card timings sum to estMinutes
- [ ] ~10-20 lessons total (realistic for classroom delivery)

**For detailed validation process**: See `prompts/critic/dimensions/coverage.md` (on request)

---

## Dimension 2: Sequencing (Threshold ≥0.80)

**Validates**: Logical ordering, prerequisites, and realistic lesson cadence

**Quick Checklist**:
- [ ] SoW follows recommended_sequence from Course_data.txt
- [ ] Prerequisites (coherence.prerequisites) correctly ordered
- [ ] Block_index progresses logically (ascending, transparent)
- [ ] Lesson_type cadence realistic and varied
- [ ] Chunked standards have thematic coherence
- [ ] Every teach lesson followed by revision lesson (teach→revision pairing)
- [ ] Lesson types within blocks ordered: teach→revision→formative→independent
- [ ] Standards within blocks sequenced logically (prerequisites first)
- [ ] Enriched format and lesson_plan presence verified

**For detailed validation process**: See `prompts/critic/dimensions/sequencing.md` (on request)

---

## Dimension 3: Policy (Threshold ≥0.80)

**Validates**: Alignment with SQA assessment rules and calculator policy

**Quick Checklist**:
- [ ] Calculator usage aligns with assessment_model.calculator_policy
- [ ] Calculator staging appropriate: non_calc → mixed → calc
- [ ] Calculator rules consistent within consolidated blocks
- [ ] Assessment cadence matches coursework_notes
- [ ] estMinutes realistic (25-50 min for Scottish periods)
- [ ] Policy consistent across standards within blocks
- [ ] Enriched format and lesson_plan presence verified
- [ ] Field naming correct: lesson_instruction (NOT "notes")

**For detailed validation process**: See `prompts/critic/dimensions/policy.md` (on request)

---

## Dimension 4: Accessibility (Threshold ≥0.90)

**Validates**: Inclusive design, engagement, and accessibility provisions

**Quick Checklist**:
- [ ] Global accessibility_notes present and meaningful
- [ ] ALL entries have accessibility_profile with ALL sub-fields (dyslexia_friendly, plain_language_level, extra_time)
- [ ] Labels and lesson_instruction use plain language
- [ ] Engagement_tags authentic, specific, Scottish contexts
- [ ] Accessibility consistent across lesson types in blocks
- [ ] Dyslexia-friendly cues at critical points in card sequences
- [ ] Engagement tags evolve realistically across cards
- [ ] Cards embed misconceptions with remediations
- [ ] Enriched format at entry AND card level
- [ ] Field naming correct: lesson_instruction (NOT "notes")

**For detailed validation process**: See `prompts/critic/dimensions/accessibility.md` (on request)

---

## Dimension 5: Authenticity (Threshold ≥0.90)

**Validates**: Scottish classroom authenticity and SQA terminology

**Quick Checklist**:
- [ ] Unit titles match Course_data.txt exactly
- [ ] Unit codes correctly referenced
- [ ] Outcome titles match Course_data.txt
- [ ] Assessment terminology aligned with standards
- [ ] Enriched format: descriptions match Course_data.txt exactly (entry AND card level)
- [ ] ALL cards use Scottish contexts (£, local shops, NHS, bus fares)
- [ ] Worked examples and practice problems use Scottish scenarios
- [ ] lesson_plan.multi_standard_integration_strategy mentions Scottish contexts
- [ ] Card titles/purposes use CfE/SQA terminology
- [ ] Card-level standards_addressed use enriched objects
- [ ] Field naming correct: lesson_instruction (NOT "notes")

**For detailed validation process**: See `prompts/critic/dimensions/authenticity.md` (on request)

---

## Scoring and Aggregation

**Dimensional Scores**: Each dimension receives 0.0-1.0 based on criteria compliance

**Dimensional Pass/Fail**: Dimension passes if score ≥ threshold
- Coverage: ≥0.90
- Sequencing: ≥0.80
- Policy: ≥0.80
- Accessibility: ≥0.90
- Authenticity: ≥0.90

**Overall Score**: Weighted average (equal weights)
```
overall_score = (coverage + sequencing + policy + accessibility + authenticity) / 5
```

**Overall Pass**: ALL dimensions must pass their individual thresholds

**Feedback**: Comprehensive narrative covering all dimensions, highlighting strengths and gaps

**Todos**: Prioritized list (high/medium/low) of actionable improvements, tagged by dimension

---

## Quality Tips

- Be thorough but efficient: validate all criteria without redundant checks
- Flag issues with specific examples and file locations
- Prioritize todos by impact:
  * **high**: Blocks SoW usability
  * **medium**: Affects quality
  * **low**: Nice-to-have
- Provide actionable feedback: not just "missing X" but "add X by doing Y"
- Accept chunking strategy: don't penalize consolidated lessons if thematically coherent
- Validate enriched format rigorously: critical for downstream Lesson Author Agent
- Cross-reference Course_data.txt extensively: SQA specifications are authoritative
