# SoW Prompt Refactor: Reducing Overwhelming Lesson Counts

## Status
**Draft** | Created: 2025-10-12

## Problem Statement

The current SoW author agent generates **too many lessons** for a single course, creating overwhelming sequences for students and teachers. For example, `mathematics_national-4.json` contains an excessive number of lesson entries that are impractical for classroom delivery.

### Current Behavior
- **National 4 Mathematics**: ~80-100 lesson entries
- **Multiplicative Effect**: 4-5 lessons per assessment standard × 20+ assessment standards = overwhelming sequences
- **Student Impact**: Excessive granularity reduces engagement and creates cognitive overload
- **Teacher Impact**: Unmanageable curriculum planning and scheduling complexity

## Root Cause Analysis

### 1. Per-Assessment-Standard Sequencing Mandate

The prompts enforce a **rigid 4-5 lesson sequence** for EVERY assessment standard:
```
teach → formative_assessment → independent_practice → revision → (optional) summative
```

**Location in Code**: `langgraph-author-agent/src/sow_author_prompts.py`

#### Affected Prompt Sections:

**A. Main Orchestrator Prompt** (`SOW_AGENT_PROMPT`, lines 131-133):
```
* **Added Requirement**: For **each assessment standard** in every outcome,
  create a **multi-lesson sequence** that spans lesson types in order:
  `teach → formative_assessment → independent_practice → revision →
   (optional) summative/mock_assessment`.
```

**B. Author Subagent Prompt** (`SOW_AUTHOR_SUBAGENT_PROMPT`, lines 623-627):
```
7. **NEW REQUIREMENT**: For **each assessment standard**, create a
   **multi-lesson sequence** of entries that, at minimum, covers:
   `teach → formative_assessment → independent_practice → revision`
   and (optionally) `summative/mock_assessment`.
```

**C. Coverage Critic** (`SOW_COVERAGE_CRITIC_PROMPT`, lines 411-417):
```
5) Check coverage of ALL assessment standards. For each standard, confirm:
   - At least one `teach` entry exists,
   - At least one `formative_assessment` entry exists,
   - At least one `independent_practice` entry exists,
   - At least one `revision` entry exists,
   - Optional: mock/summative, project, or spiral revisit entries.
```

**D. Sequencing Critic** (`SOW_SEQUENCING_CRITIC_PROMPT`, lines 467-473):
```
- For each assessment standard:
  - At least one `teach` entry appears before related assessments/practice.
  - At least one `formative_assessment` entry follows the teaching phase.
  - At least one `independent_practice` entry follows formative checks.
  - At least one `revision` entry comes after practice.
```

### 2. Multiplicative Effect

**Example Calculation** (National 4 Mathematics):
- **Unit 1 (Numeracy)**: 8 assessment standards × 4 lessons = 32 lessons
- **Unit 2 (Geometry)**: 6 assessment standards × 4 lessons = 24 lessons
- **Unit 3 (Statistics)**: 6 assessment standards × 4 lessons = 24 lessons
- **Total**: ~80-100 lessons minimum

### 3. Critic Enforcement

The requirement is validated by **three independent critics**, making it impossible to reduce lesson counts without failing validation:
- Coverage Critic: Enforces all 4 lesson types per standard
- Sequencing Critic: Validates lesson type ordering per standard
- Policy Consistency Critic: Checks calculator policy across all lesson types per standard

## Proposed Solutions

### Option 1: Allow Consolidation Across Outcomes and Related Standards (Recommended - Aggressive Consolidation)

**Rationale**: Many outcomes share conceptual foundations, complementary skills, or natural pedagogical progressions. Ultra-compact SoWs (10-20 lessons) enable rapid delivery, intensive revision cycles, and better alignment with condensed term schedules. This approach prioritizes thematic coherence over granular standard-by-standard sequencing.

**Target**: 80-100 lessons → **10-20 lessons** (~80-87.5% reduction)

**Implementation**:
1. Modify prompts to permit **cross-outcome consolidation** for thematically related skills
2. Add guidance for identifying aggressive consolidation opportunities:
   ```
   Create integrated learning blocks that span multiple outcomes when they share:
   - Complementary skill sets (e.g., notation + calculation + problem-solving)
   - Common real-world application contexts (e.g., financial literacy)
   - Natural pedagogical progressions (e.g., fractions → decimals → percentages)

   Example: "Teach: Financial Numeracy Foundation" covering:
   - O1/AS1.1 (Notation and units for money contexts)
   - O1/AS1.2 (Calculations with percentages and money)
   - O2/AS2.1 (Problem-solving in financial scenarios)

   Each consolidated lesson should cover 3-5 assessment standards from 2-3 outcomes.
   ```

3. Add multi-outcome lesson design guidance:
   ```
   When consolidating across outcomes:
   - Identify unifying real-world contexts (shopping, budgeting, measurement)
   - Design integrated tasks that require multiple skills simultaneously
   - Ensure each assessment standard gets explicit coverage (not just mentioned)
   - Use formative assessments that test all consolidated standards together
   - Provide revision materials that synthesize cross-outcome connections
   ```

4. Update critic thresholds for aggressive consolidation:
   - **Coverage**: Accept lessons addressing 3-5 assessment standards from multiple outcomes
   - **Sequencing**: Allow thematic grouping to override strict outcome-by-outcome progression
   - **Policy**: Validate calculator policy at consolidated block level (not per standard)
   - **Coherence**: Require explicit notes justifying cross-outcome consolidation decisions

**Expected Reduction**: 80-100 lessons → 10-20 lessons (~80-87.5% reduction)

**Consolidation Targets by Course Type**:
- **National 3/4 Mathematics** (~20 assessment standards): 10-15 lessons (3-5 lessons per unit)
- **National 5 Mathematics** (~25 assessment standards): 15-20 lessons (5-7 lessons per unit)
- **Application of Mathematics** (~18 assessment standards): 8-12 lessons (4 lessons per unit)

### Option 2: Make Formative/Revision Optional

**Rationale**: Not every assessment standard requires separate formative assessment and revision lessons. Some standards can be assessed through practice alone.

**Implementation**:
1. Change requirement from:
   ```
   teach → formative_assessment → independent_practice → revision
   ```
   To:
   ```
   teach → (formative_assessment OR independent_practice) → [optional revision]
   ```

2. Reduce minimum sequence from **4 lessons per standard** to **2-3 lessons per standard**

3. Update critics to accept:
   - **Mandatory**: Teach + at least one assessment/practice type
   - **Optional**: Revision, summative, spiral revisit

**Expected Reduction**: 80-100 lessons → 40-60 lessons (~40% reduction)

### Option 3: Introduce Chunking Guidance (Moderate Approach)

**Rationale**: Balance comprehensive coverage with practical delivery by grouping standards into thematic chunks.

**Implementation**:
1. Add prompt section:
   ```
   <chunking_strategy>
   Group 2-3 related assessment standards into thematic "learning blocks".
   Each block should have:
   - 1 consolidated teach lesson
   - 1 formative assessment covering all standards in the block
   - 1 independent practice session
   - 1 revision session (optional if standards are foundational)

   Example Block: "Percentages Foundation" (covering AS2.1, AS2.2, AS2.3)
   - Lesson 1: Teach: Converting Fractions, Decimals, and Percentages
   - Lesson 2: Formative: Percentage Conversions Check
   - Lesson 3: Practice: Real-World Percentage Problems
   </chunking_strategy>
   ```

2. Update critics to validate:
   - All standards are covered (but not necessarily individually)
   - Chunking is pedagogically sound (related concepts grouped)
   - Chunk size is realistic (2-3 standards per block)

**Expected Reduction**: 80-100 lessons → 35-50 lessons (~50% reduction)

### Option 4: Adjust Critic Thresholds (Minimal Change)

**Rationale**: Keep existing structure but allow critics to pass with flexible interpretation.

**Implementation**:
1. Modify critic scoring logic to accept:
   - **80% coverage** instead of 100% for all lesson types
   - Shared formative assessments across multiple standards
   - Combined revision lessons for related topics

2. Add critic flexibility guidance:
   ```
   When evaluating coverage, prioritize pedagogical coherence over
   mechanical 1:1 standard-to-lesson mapping. Accept sequences where:
   - Multiple standards share assessment/practice lessons
   - Revision is provided at unit level rather than standard level
   - Independent practice integrates multiple related standards
   ```

**Expected Reduction**: 80-100 lessons → 50-70 lessons (~30% reduction)

## Recommended Implementation Plan

### Phase 1: Pilot with Option 1 (Consolidation) + Option 3 (Chunking) + Schema Enhancements
**Timeline**: Sprint 1 (2 weeks)

1. **Week 1: Prompt Refactoring**

   **Consolidation & Chunking**:
   - [ ] Update `SOW_AGENT_PROMPT` to add chunking strategy guidance
   - [ ] Modify `SOW_AUTHOR_SUBAGENT_PROMPT` to allow consolidated sequences
   - [ ] Add examples of good consolidation vs. bad over-fragmentation
   - [ ] Update `SOW_COVERAGE_CRITIC_PROMPT` to accept shared lessons
   - [ ] Adjust `SOW_SEQUENCING_CRITIC_PROMPT` to validate chunked sequences
   - [ ] Modify `SOW_POLICY_CRITIC_PROMPT` to check policy at chunk level

   **Schema Enhancements**:
   - [ ] **Assessment Standard Enrichment**: Update `SOW_AUTHOR_SUBAGENT_PROMPT` to generate enriched `assessmentStandardRefs` (code, description, outcome) from `course_data.txt`
   - [ ] **Lesson Author Guidance**: Add `lesson_author_guidance` field generation logic to `SOW_AUTHOR_SUBAGENT_PROMPT` (card_count_target, pedagogical_approach, multi_standard_integration, assessment_focus, misconceptions_to_address)
   - [ ] **Make All Fields Required**: Remove all "(optional)" annotations from schema in `SOW_AGENT_PROMPT` and `SOW_AUTHOR_SUBAGENT_PROMPT`
   - [ ] **Rename Field**: Change `notes` → `lesson_instruction` in all 6 prompts (SOW_AGENT_PROMPT, SOW_AUTHOR_SUBAGENT_PROMPT, all 4 critics)
   - [ ] **Critic Updates**: Add validation for enriched format in `SOW_COVERAGE_CRITIC_PROMPT` and `SOW_AUTHENTICITY_CRITIC_PROMPT`
   - [ ] **Critic Updates**: Add validation for `lesson_author_guidance` presence in `SOW_COVERAGE_CRITIC_PROMPT` and `SOW_ACCESSIBILITY_CRITIC_PROMPT`

2. **Week 2: Testing & Validation**
   - [ ] Re-run SoW generation for Mathematics National 4
   - [ ] Verify lesson count reduction to 30-40 lessons
   - [ ] Validate pedagogical coherence with sample lessons
   - [ ] **Verify enriched schema**: Check `assessmentStandardRefs` has description and outcome fields
   - [ ] **Verify guidance**: Check `lesson_author_guidance` is populated with concrete strategies
   - [ ] **Verify field rename**: Confirm `lesson_instruction` field is present and detailed
   - [ ] Check critic pass rates
   - [ ] Compare with existing `mathematics_national-4.json` for coverage completeness

### Phase 2: Iterative Refinement
**Timeline**: Sprint 2 (2 weeks)

1. **Week 3: Extend to Other Subjects**
   - [ ] Test on Application of Mathematics National 3
   - [ ] Test on Mathematics National 5
   - [ ] Identify subject-specific consolidation patterns

2. **Week 4: Critic Tuning**
   - [ ] Analyze failure modes from Phase 1 testing
   - [ ] Adjust critic thresholds based on real outputs
   - [ ] Add safeguards against over-consolidation (maintain depth)
   - [ ] Document optimal chunking patterns per subject

### Phase 3: Production Rollout
**Timeline**: Sprint 3 (1 week)

- [ ] Update all SoW generation pipelines
- [ ] Regenerate existing SoWs with new prompts
- [ ] Archive old versions with version tags
- [ ] Update documentation with new chunking guidance

## Success Metrics

### Quantitative
- **Lesson Count Reduction**: 80-87.5% reduction (from ~90 to 10-20 lessons average)
- **Critic Pass Rate**: >85% on first attempt (aggressive consolidation may require more iterative refinement)
- **Coverage Completeness**: 100% of assessment standards explicitly addressed in consolidated lessons
- **Cross-Outcome Integration**: 60-80% of lessons span multiple outcomes with clear pedagogical justification
- **Regeneration Time**: <30% increase (cross-outcome consolidation requires deeper LLM reasoning about thematic connections)

### Qualitative
- **Pedagogical Coherence**: Consolidated lessons flow naturally
- **Teacher Usability**: SoW fits realistic term/semester schedules
- **Student Experience**: Reduced fragmentation, better narrative flow
- **Flexibility**: SoW supports both detailed and condensed delivery modes

## Risk Analysis

### Risk 1: Over-Consolidation Across Outcomes
**Impact**: High | **Likelihood**: Medium

**Description**: Aggressive cross-outcome consolidation (3-5 standards per lesson) may sacrifice pedagogical depth, reduce assessment granularity, and create lessons that are too cognitively demanding for students. Teachers may struggle to deliver lessons that effectively address disparate outcomes.

**Mitigation**:
- **Maximum Consolidation Constraint**: Limit to 3-5 standards per lesson, max 2-3 outcomes
- **Thematic Justification Requirement**: Each consolidated lesson must document:
  - Unifying real-world context connecting all outcomes
  - Pedagogical rationale for cross-outcome integration
  - Explicit mapping showing how each standard gets addressed
- **Coverage Critic Enhancement**: Validate each standard has:
  - Dedicated instructional time (not just mentioned in passing)
  - Assessment items that explicitly test the standard
  - Practice opportunities specific to the standard's skills
- **Pilot Testing**: Test with 1-2 courses before full rollout, gather teacher/student feedback
- **Fallback Option**: If critics consistently fail (>50% rejection), revert to moderate consolidation (30-40 lessons)

### Risk 2: Critic Rejection Rate Spike
**Impact**: High | **Likelihood**: Medium

**Description**: Modified prompts may initially produce SoWs that fail critics due to unexpected interpretation.

**Mitigation**:
- Implement phased rollout (test with 1-2 courses first)
- Add detailed examples of acceptable consolidation in prompts
- Tune critic thresholds iteratively based on real outputs
- Maintain fallback to current prompts if failure rate >50%

### Risk 3: Loss of Assessment Standard Granularity
**Impact**: Medium | **Likelihood**: Low

**Description**: Consolidated lessons may not explicitly track which standards were fully assessed vs. partially covered.

**Mitigation**:
- Require `assessmentStandardRefs` on every lesson entry (no change)
- Add `coverage_notes` field to consolidated lessons explaining how each standard is addressed
- Coverage critic validates explicit mapping exists for all standards

### Risk 4: Downstream Lesson Template Impact
**Impact**: High | **Likelihood**: High

**Description**: Lesson Template DeepAgent may struggle to author coherent lessons that address 3-5 standards across 2-3 outcomes. Cards may become overcomplicated, assessment may lack focus, and lesson flow may feel disjointed when trying to cover disparate outcomes.

**Mitigation**:
- **Update Lesson Template Prompts**: Add explicit guidance for cross-outcome lesson design
  - Examples of successful multi-outcome card sequences
  - Patterns for integrating disparate skills (e.g., calculation + problem-solving in unified contexts)
  - Scaffolding strategies for complex lessons
- **Multi-Standard Card Design Patterns**: Provide templates for:
  - Integrated tasks requiring multiple skills simultaneously
  - Layered assessment items testing multiple standards
  - Contextual scenarios that naturally span outcomes (e.g., financial literacy, measurement projects)
- **Complexity Constraints**: Limit consolidated lessons to:
  - Max 12-15 cards per lesson (prevent cognitive overload)
  - Max 3 distinct skills taught in a single card
  - Clear "focus standard" for each assessment card
- **End-to-End Testing**: Test consolidated SoW → Lesson Template pipeline with real examples before full rollout
- **Quality Metrics**: Monitor lesson template generation success rate, ensure >80% pass on first attempt

### Risk 5: Loss of Pedagogical Progression Clarity
**Impact**: Medium | **Likelihood**: High

**Description**: Cross-outcome consolidation may disrupt natural skill progressions (e.g., fractions → decimals → percentages) if outcomes are grouped solely by context rather than prerequisite relationships. Teachers may struggle to understand the intended progression.

**Mitigation**:
- **Sequencing Critic Enhancement**: Validate that consolidated lessons respect:
  - Prerequisite relationships (foundational skills before advanced applications)
  - Natural conceptual progressions within mathematics
  - SQA-recommended sequencing where specified
- **Explicit Progression Notes**: Each consolidated lesson must include:
  - Prerequisites from previous lessons (even if from different outcomes)
  - Skills this lesson builds upon
  - Future lessons that depend on this lesson's content
- **Coherence Block Naming**: Use descriptive block names that signal progression:
  - "Financial Numeracy Foundation" (early skills)
  - "Advanced Financial Problem-Solving" (later applications)
- **Teacher Guidance**: Add `notes` field explaining the pedagogical logic behind cross-outcome grouping

## Open Questions

1. **Optimal Consolidation Range**: Should we target 10-15 or 15-20 lessons for typical National 4/5 courses?
   - *Recommendation*: Start with 15-20 for safety, iterate down to 10-15 based on quality metrics
   - *Rationale*: 15-20 allows more pedagogical flexibility while still achieving 75-80% reduction

2. **Cross-Outcome Boundaries**: Which outcome combinations are pedagogically sound for consolidation?
   - *Recommendation*: Prioritize outcome pairs with natural connections:
     - O1 (Numeracy) + O2 (Problem-Solving): Financial contexts, measurement contexts
     - O2 (Problem-Solving) + O3 (Reasoning): Justification and strategy selection
   - *Warning*: Avoid forced consolidation of conceptually distant outcomes

3. **Lesson Type Flexibility in Consolidated Blocks**: Should teach → formative → practice → revision order be maintained for each outcome individually, or applied to the consolidated block as a whole?
   - *Recommendation*: Apply at block level (4 lessons covering all outcomes in block)
   - *Rationale*: Prevents reintroduction of lesson proliferation

4. **Critic Thresholds for Aggressive Consolidation**: What pass/fail thresholds should critics use?
   - *Recommendation*:
     - Coverage Critic: 0.85 (allow some flexibility for integrated assessment)
     - Sequencing Critic: 0.70 (thematic grouping may override strict progression)
     - Policy Critic: 0.80 (maintain calculator policy consistency)
     - Coherence Critic: 0.90 (critical for cross-outcome validation)

5. **Maximum Cognitive Load per Lesson**: What's the upper limit for standards per consolidated lesson?
   - *Recommendation*: Hard cap at 5 standards per lesson, soft target of 3-4
   - *Rationale*: 5+ standards risk cognitive overload and diluted assessment

6. **Teacher Guidance Sufficiency**: How much documentation is needed for teachers to understand cross-outcome consolidation?
   - *Recommendation*: Each consolidated lesson requires:
     - Explicit `coverage_notes` mapping each standard to instructional time
     - `notes` field explaining pedagogical rationale for consolidation
     - `prerequisites` list showing skill dependencies

## Example: Before vs. After

### Before (Current Prompts) - Outcome 1 (Numeracy) + Outcome 2 (Problem-Solving)

**Outcome 1 - Assessment Standard 1.1**: Selecting Notation and Units
- Lesson 1: Teach - Understanding Notation (order: 1)
- Lesson 2: Formative - Notation Check (order: 2)
- Lesson 3: Practice - Applying Notation (order: 3)
- Lesson 4: Revision - Notation Review (order: 4)

**Outcome 1 - Assessment Standard 1.2**: Carrying Out Calculations
- Lesson 5: Teach - Calculation Methods (order: 5)
- Lesson 6: Formative - Calculation Check (order: 6)
- Lesson 7: Practice - Calculation Drills (order: 7)
- Lesson 8: Revision - Calculation Review (order: 8)

**Outcome 2 - Assessment Standard 2.1**: Interpreting Real-World Problems
- Lesson 9: Teach - Problem Analysis (order: 9)
- Lesson 10: Formative - Problem Interpretation Check (order: 10)
- Lesson 11: Practice - Word Problems (order: 11)
- Lesson 12: Revision - Problem Review (order: 12)

**Outcome 2 - Assessment Standard 2.2**: Selecting Solution Strategies
- Lesson 13: Teach - Strategy Selection (order: 13)
- Lesson 14: Formative - Strategy Check (order: 14)
- Lesson 15: Practice - Strategy Application (order: 15)
- Lesson 16: Revision - Strategy Review (order: 16)

**Total**: 16 lessons for 4 standards across 2 outcomes

### After (Aggressive Cross-Outcome Consolidation)

**Consolidated Learning Block**: Financial Numeracy and Problem-Solving (covers O1/AS1.1, O1/AS1.2, O2/AS2.1, O2/AS2.2)
- Lesson 1: Teach - Money, Calculations, and Real-World Problem-Solving (order: 1)
  - `outcomeRefs: ["O1", "O2"]`
  - `assessmentStandardRefs`: (enriched format)
    ```json
    [
      {
        "code": "AS1.1",
        "description": "Select and use an appropriate notation and unit to represent and determine a quantity in a numerical context",
        "outcome": "O1"
      },
      {
        "code": "AS1.2",
        "description": "Carry out calculations involving fractions, percentages, and decimal fractions",
        "outcome": "O1"
      },
      {
        "code": "AS2.1",
        "description": "Interpret real-world problems and identify relevant information",
        "outcome": "O2"
      },
      {
        "code": "AS2.2",
        "description": "Select and apply appropriate problem-solving strategies",
        "outcome": "O2"
      }
    ]
    ```
  - `lesson_author_guidance`:
    ```json
    {
      "card_count_target": "8-10 cards: starter, explainer, modelling (3 worked examples), guided practice, independent practice, exit ticket",
      "pedagogical_approach": "Introduce financial numeracy through Scottish shopping contexts. Start with notation and units (£, p), build to percentage calculations (discounts, VAT), then apply to problem-solving scenarios",
      "multi_standard_integration": "Use unified shopping context: supermarket pricing (AS1.1 notation) → percentage discounts (AS1.2 calculations) → compare offers (AS2.1 interpretation) → select best value (AS2.2 strategy)",
      "assessment_focus": "Primary: AS1.2 (calculations must be accurate). Secondary: AS1.1 (notation), AS2.1 (interpretation), AS2.2 (strategy selection)",
      "misconceptions_to_address": [
        "Confusing percentage symbol (%) with division by 100",
        "Forgetting to include units (£) in final answers",
        "Applying discount to wrong base amount"
      ]
    }
    ```
  - `lesson_instruction`: "1) Starter (5 min): Retrieval practice on fractions and decimals using mini-whiteboards. 2) Learning Intention (2 min): 'I can use percentages to solve shopping problems'. 3) Explainer (10 min): Display Tesco/Asda flyers, discuss notation (£45.99 vs £45 and 99p). 4) Modelling (15 min): Work through 3 examples - 10% off £80, 15% off £45.99, VAT (20%) on £35. 5) Guided Practice (15 min): Pair work on 4 shopping scenarios, circulate to address misconceptions. 6) Exit Ticket (5 min): Individual problem - 'Compare two offers: 25% off £60 vs £15 discount on £60'."
  - Integrated teaching using authentic Scottish financial contexts (supermarket pricing, budgeting)

- Lesson 2: Formative - Financial Numeracy Skills Check (order: 2)
  - `outcomeRefs: ["O1", "O2"]`
  - `assessmentStandardRefs`: (same enriched format as Lesson 1)
  - `lesson_author_guidance`:
    ```json
    {
      "card_count_target": "5-6 cards: retrieval warm-up, mixed assessment (3 cards covering all standards), self-assessment, feedback",
      "pedagogical_approach": "Unified shopping scenario testing all four standards simultaneously. Vary difficulty within each standard.",
      "multi_standard_integration": "Shopping context: 'Calculate total cost with discounts' requires notation, calculations, interpretation, and strategy together",
      "assessment_focus": "Primary: AS1.2 (calculations). Secondary: AS1.1, AS2.1, AS2.2 - mark generously if calculation method is correct",
      "misconceptions_to_address": [
        "Forgetting to include units (£) in final answer",
        "Applying discount to wrong base amount",
        "Misinterpreting compound percentage changes"
      ]
    }
    ```
  - `lesson_instruction`: "1) Retrieval (3 min): Quick percentage conversions (10%, 5%, 1%). 2) Assessment Task 1 (8 min): Calculate 15% discount on £45.99 item (tests AS1.1, AS1.2). 3) Assessment Task 2 (8 min): Compare offers - which is better value? (tests AS2.1, AS2.2). 4) Assessment Task 3 (8 min): Multi-step problem - 20% off then add VAT (tests all standards). 5) Self-Assessment (5 min): Students mark own work using provided answers. 6) Feedback (3 min): Address common errors observed."
  - Mixed assessment covering all four standards in realistic scenarios

- Lesson 3: Practice - Real-World Financial Problem-Solving (order: 3)
  - `outcomeRefs: ["O1", "O2"]`
  - `assessmentStandardRefs`: (same enriched format as Lesson 1)
  - `lesson_author_guidance`:
    ```json
    {
      "card_count_target": "6-8 cards: warm-up, scaffolded practice sets (3-4 cards), challenge problem, reflection",
      "pedagogical_approach": "Provide graduated practice from simple to complex, all within shopping/budgeting contexts",
      "multi_standard_integration": "Budget planning task requires all skills: notation for listing prices, calculations for totals/discounts, interpretation of constraints, strategy for optimization",
      "assessment_focus": "Equal emphasis on all standards - students need fluency across notation, calculation, interpretation, and strategy",
      "misconceptions_to_address": [
        "Incorrectly ordering operations in multi-step problems",
        "Forgetting to check if answer is reasonable",
        "Not showing working clearly"
      ]
    }
    ```
  - `lesson_instruction`: "1) Warm-up (3 min): Mental math - quick percentage calculations. 2) Practice Set 1 (8 min): Simple percentage problems (5 questions). 3) Practice Set 2 (8 min): Multi-step problems (3 questions). 4) Practice Set 3 (10 min): Real-world scenarios - budgeting for school trip (2 problems). 5) Challenge (8 min): Complex problem - compare 3 mobile phone deals considering upfront cost, monthly cost, and contract length. 6) Reflection (3 min): What strategies helped? Which type of problem was hardest?"
  - Integrated tasks requiring all skills simultaneously (budget planning, comparison shopping)

- Lesson 4: Revision - Consolidating Financial Numeracy (order: 4)
  - `outcomeRefs: ["O1", "O2"]`
  - `assessmentStandardRefs`: (same enriched format as Lesson 1)
  - `lesson_author_guidance`:
    ```json
    {
      "card_count_target": "7-9 cards: retrieval practice, error analysis, mixed practice, exam-style questions, summary",
      "pedagogical_approach": "Spiral retrieval of all standards, address common errors identified in formative, provide exam-style practice",
      "multi_standard_integration": "Exam-style scenarios integrate all standards - students must demonstrate notation, calculation, interpretation, and strategy skills together",
      "assessment_focus": "Exam readiness - equal weighting on all standards, emphasis on showing working clearly",
      "misconceptions_to_address": [
        "All misconceptions from previous lessons",
        "Exam technique: not reading questions carefully",
        "Time management in multi-step problems"
      ]
    }
    ```
  - `lesson_instruction`: "1) Spiral Retrieval (5 min): Mixed questions from all previous lessons. 2) Error Analysis (8 min): Review common mistakes from formative assessment, discuss corrections. 3) Mixed Practice (12 min): 6 questions covering all standards, varied contexts. 4) Exam-Style Questions (12 min): 2 past paper questions (National 4 level). 5) Summary (3 min): Review success criteria for all four standards, preview mock assessment next lesson."
  - Synthesis of all standards through complex financial scenarios

**Total**: 4 lessons for 4 standards across 2 outcomes (75% reduction)

**Key Differences**:
- **Cross-Outcome Integration**: Lessons span O1 (Numeracy) and O2 (Problem-Solving) simultaneously
- **Thematic Coherence**: Unified by financial literacy context
- **Efficiency**: 16 → 4 lessons while maintaining explicit coverage of all standards
- **Pedagogical Depth**: Integrated teaching promotes transfer of skills across domains

## Related: SoW Enrichment Pipeline

**Note**: The post-processing enrichment pipeline (metadata generation and assessment standard enrichment) has been separated into its own specification document.

**See**: [`sow-enrichment-pipeline-spec.md`](./sow-enrichment-pipeline-spec.md) for:
- Metadata field generation ($id, version, status, timestamps, lessonTemplateRef)
- Assessment standard enrichment (codes → descriptions)
- Integration with `seedAuthoredSOW.ts` seeding script
- Implementation checklist and testing strategy

This separation ensures the SoW Author Agent focuses on **pedagogical content only**, while code-based enrichment handles mechanical metadata and downstream optimization.

---

## Schema Enhancement: Assessment Standard Enrichment

### Problem

The current `assessmentStandardRefs` field stores only codes (e.g., `["AS1.1", "AS1.2"]`), which are **insufficient for the Lesson Author Agent** to understand what each standard requires. The Lesson Author Agent would need to re-fetch and parse `course_data.txt` to understand:
- What skills the standard tests
- What knowledge students need
- What contexts are appropriate
- How to structure assessment questions

This creates **tight coupling** between agents and duplicates data fetching logic.

### Solution

**Enrich** `assessmentStandardRefs` with full text descriptions from `course_data.txt` during SoW authoring, transforming it from an array of codes into an **array of enriched objects**.

**Before (Current Format)**:
```json
"assessmentStandardRefs": ["AS1.1", "AS1.2"]
```

**After (Enriched Format)**:
```json
"assessmentStandardRefs": [
  {
    "code": "AS1.1",
    "description": "Select and use an appropriate notation and unit to represent and determine a quantity in a numerical context",
    "outcome": "O1"
  },
  {
    "code": "AS1.2",
    "description": "Carry out calculations involving fractions, percentages, and decimal fractions",
    "outcome": "O1"
  }
]
```

### Implementation Requirements

#### 1. SOW_AUTHOR_SUBAGENT_PROMPT Changes
**Action**: Read assessment standard descriptions from `course_data.txt` during SoW authoring

**Process**:
```
For each lesson entry:
1. Read course_data.txt → assessment_standards[] array
2. For each assessmentStandardRefs code (e.g., "AS1.2"):
   a. Find matching standard in course_data.txt by code
   b. Extract: code, desc (description), outcome reference
   c. Create enriched object: {code, description, outcome}
3. Replace simple string array with enriched object array
```

**Schema Update** (add to `SOW_AUTHOR_SUBAGENT_PROMPT` schema section):
```json
"assessmentStandardRefs": [
  {
    "code": "string, REQUIRED - Assessment standard code (e.g., 'AS1.2')",
    "description": "string, REQUIRED - Full official SQA description from course_data.txt",
    "outcome": "string, REQUIRED - Parent outcome code (e.g., 'O1')"
  }
]
```

#### 2. Critic Updates

**Coverage Critic** (`SOW_COVERAGE_CRITIC_PROMPT`):
- Validate enriched format is present (not simple string array)
- Check all codes have matching descriptions
- Verify descriptions are non-empty strings

**Authenticity Critic** (`SOW_AUTHENTICITY_CRITIC_PROMPT`):
- Validate descriptions match official SQA text from `course_data.txt` (exact match or paraphrased with equivalent meaning)
- Flag any invented or inaccurate descriptions
- Ensure outcome references are correct

#### 3. Backward Compatibility

**Breaking Change**: Existing SoWs with simple string arrays will need migration.

**Migration Script** (for existing `authored_sow_json` files):
```typescript
// Pseudo-code for migration
for (const entry of sow.entries) {
  if (Array.isArray(entry.assessmentStandardRefs) &&
      typeof entry.assessmentStandardRefs[0] === 'string') {
    // Old format detected - enrich it
    entry.assessmentStandardRefs = entry.assessmentStandardRefs.map(code => ({
      code: code,
      description: lookupDescriptionFromCourseData(code),
      outcome: extractOutcomeFromCode(code)
    }));
  }
}
```

### Benefits

**For Lesson Author Agent**:
- ✅ No need to fetch `course_data.txt` separately
- ✅ Can generate accurate card content directly from SoW entry
- ✅ Understands standard requirements without external lookups
- ✅ Can create contextually appropriate assessment questions

**For Teachers**:
- ✅ Self-documenting SoW entries (standards explained inline)
- ✅ No need to reference external SQA documents
- ✅ Faster curriculum planning

**For System Architecture**:
- ✅ Reduced coupling between agents (no shared data fetch logic)
- ✅ SoW becomes authoritative source for lesson generation
- ✅ Easier testing (mock SoW without mocking course data)

---

## Schema Enhancement: Lesson Author Guidance Integration

### Problem

The Lesson Author Agent receives a SoW entry but lacks **actionable guidance** for lesson generation:
- How should cards be structured for multi-standard lessons?
- Which pedagogical patterns work best for this lesson type?
- How to balance cognitive load across consolidated standards?
- What misconceptions should be addressed?
- How to integrate disparate standards coherently?

Currently, the Lesson Author must **infer** these decisions, leading to:
- Inconsistent lesson quality
- Multiple revision rounds with critics
- Over-complex or under-scaffolded lessons
- Missed pedagogical opportunities

### Solution

Add `lesson_author_guidance` field to each SoW entry, populated by the SoW Author using research pack patterns and pedagogical expertise.

### Schema Addition

```json
"lesson_author_guidance": {
  "card_count_target": "string, REQUIRED - Recommended card count range (e.g., '6-8 cards for teach', '4-6 cards for formative')",
  "pedagogical_approach": "string, REQUIRED - High-level teaching strategy (e.g., 'Start with concrete examples using Scottish currency, build to abstract calculations')",
  "multi_standard_integration": "string, REQUIRED - How to unify multiple standards (e.g., 'Use unified shopping scenario across all 4 standards') - set to 'N/A - single standard focus' if only 1 standard",
  "assessment_focus": "string, REQUIRED - Which standards are primary vs secondary (e.g., 'Primary: AS1.2 (calculations), Secondary: AS1.1 (notation)')",
  "misconceptions_to_address": ["array of strings, REQUIRED - Common student errors from research pack (e.g., ['Confusing percentage with decimal notation', 'Forgetting to convert units']) - empty array if none identified"]
}
```

### Implementation Requirements

#### 1. SOW_AUTHOR_SUBAGENT_PROMPT Changes

**Action**: Generate `lesson_author_guidance` for each SoW entry by analyzing:
1. **Lesson Type** → Recommend card structure patterns
   - `teach`: 6-10 cards (starter, modelling, guided practice, independent practice, exit ticket)
   - `formative_assessment`: 4-6 cards (retrieval, focused assessments, feedback)
   - `independent_practice`: 4-8 cards (scaffolded practice sets)
   - `revision`: 5-8 cards (spiral retrieval, mixed practice, error analysis)

2. **Research Pack Pedagogical Patterns** → Suggest teaching approaches
   - Read `research_pack_json.distilled_data.pedagogical_patterns`
   - Extract relevant lesson_starters, cfu_variety_examples, misconceptions
   - Match patterns to lesson type and engagement tags

3. **Assessment Standard Relationships** → Note integration strategy
   - If 1 standard: "N/A - single standard focus"
   - If 2-3 standards: "Use [unifying context] to integrate [standard 1] and [standard 2]"
   - If 4-5 standards: "Sequence cards to address [foundation standards] before [application standards]"

4. **Engagement Tags + Scottish Contexts** → Ground pedagogical approach
   - engagement_tags: ["shopping", "finance"] → "Use Scottish supermarket pricing and budgeting contexts"
   - engagement_tags: ["NHS", "healthcare"] → "Frame problems using NHS appointment scheduling and prescriptions"

#### 2. Example Generation

**Example 1: Single-Standard Teach Lesson**:
```json
"lesson_author_guidance": {
  "card_count_target": "6-8 cards: starter (retrieval), explainer, modelling (worked examples), guided practice, independent practice, exit ticket",
  "pedagogical_approach": "Start with retrieval practice on fractions (prerequisite). Introduce percentages using concrete visual models (10x10 grids). Model conversions with Scottish currency examples (£ prices). Scaffold to abstract calculations.",
  "multi_standard_integration": "N/A - single standard focus (AS1.2 only)",
  "assessment_focus": "Primary: AS1.2 (percentage calculations) - ensure fluency with 10%, 5%, 1% conversions before complex problems",
  "misconceptions_to_address": [
    "Confusing percentage symbol (%) with division by 100",
    "Believing 'of' means addition instead of multiplication",
    "Incorrectly ordering operations (e.g., adding before multiplying percentage)"
  ]
}
```

**Example 2: Multi-Standard Formative Assessment**:
```json
"lesson_author_guidance": {
  "card_count_target": "4-6 cards: retrieval warm-up, mixed assessment (2-3 cards covering all standards), self-assessment, feedback card",
  "pedagogical_approach": "Use unified shopping scenario across all assessment items (AS1.1 notation, AS1.2 calculations, AS2.1 problem interpretation). Vary question difficulty within each standard to assess depth.",
  "multi_standard_integration": "Shopping context: 'Calculate total cost with discounts' requires notation (AS1.1), percentage calculations (AS1.2), and problem-solving strategy (AS2.1) simultaneously",
  "assessment_focus": "Primary: AS1.2 (calculations must be accurate). Secondary: AS1.1 (notation), AS2.1 (problem setup) - mark generously if calculation method is correct",
  "misconceptions_to_address": [
    "Forgetting to include units (£) in final answer (AS1.1)",
    "Applying discount to wrong base amount (AS1.2)",
    "Misinterpreting compound percentage changes (AS2.1)"
  ]
}
```

#### 3. Critic Validation

**Accessibility Critic** (`SOW_ACCESSIBILITY_CRITIC_PROMPT`):
- Check `pedagogical_approach` and `misconceptions_to_address` align with dyslexia-friendly practices
- Validate guidance doesn't suggest cognitively overloading students
- Ensure `card_count_target` is realistic (not too many cards)

**Coverage Critic** (`SOW_COVERAGE_CRITIC_PROMPT`):
- Validate `assessment_focus` mentions all standards in `assessmentStandardRefs`
- Check `multi_standard_integration` provides concrete integration strategy if multiple standards present
- Ensure `misconceptions_to_address` is non-empty (research pack should have identified some)

### Benefits

**For Lesson Author Agent**:
- ✅ Produces well-structured lessons on first attempt (fewer revisions)
- ✅ Knows which standards to emphasize vs support
- ✅ Can generate appropriate assessment items (informed by misconceptions)
- ✅ Creates coherent multi-standard lessons (guided by integration strategy)

**For Quality**:
- ✅ Embeds research pack pedagogical expertise directly into SoW
- ✅ Consistent lesson structure across entire course
- ✅ Proactively addresses known misconceptions

**For System Efficiency**:
- ✅ Reduces back-and-forth between SoW and Lesson authoring phases
- ✅ Fewer critic rejections (guidance prevents common errors)

---

## Schema Enhancement: Make All Fields Required

### Problem

The current schema has a **mix of "REQUIRED" and "optional" fields**, creating ambiguity and inconsistency:

**Authoring Confusion**:
- SoW authors unsure which "optional" fields to populate
- Some agents skip optional fields → incomplete SoWs
- No clear standard for "complete" SoW

**Validation Inconsistency**:
- Critics unclear whether to validate optional fields
- Some critics penalize missing optional fields, others don't
- Pass/fail thresholds become arbitrary

**Downstream Fragility**:
- Lesson Author Agent needs defensive null checks everywhere
- Code littered with: `entry.notes || ""`, `entry.pedagogical_blocks || []`
- Silent failures when optional field assumed present

**Example of Current Ambiguity**:
```python
# Current schema says:
"weeks": "int, optional - planned teaching weeks"
"notes": "string, optional - teacher guidance"

# This creates questions:
# - Is a SoW without "weeks" incomplete or just flexible?
# - If "notes" is missing, should critics fail or pass?
# - Can Lesson Author proceed without "notes"?
```

### Solution

**Eliminate all optional fields** - declare every field in the schema as **REQUIRED**.

### Rationale

1. **Consistency**: No guessing which fields matter - all fields must be populated
2. **Quality Enforcement**: Forces complete authoring upfront (no "fill in later" mentality)
3. **Code Simplicity**: Downstream consumers assume all fields present (no null checks)
4. **Fail-Fast**: Missing field = immediate validation error, not silent degradation later

### Schema Changes

#### Metadata (All REQUIRED)

**Before**:
```json
"metadata": {
  "coherence": {...},  // REQUIRED
  "accessibility_notes": [...],  // REQUIRED
  "engagement_notes": [...],  // REQUIRED
  "weeks": "int, optional",  // ❌ Optional
  "periods_per_week": "int, optional"  // ❌ Optional
}
```

**After**:
```json
"metadata": {
  "coherence": {
    "policy_notes": ["..."],  // REQUIRED
    "sequencing_notes": ["..."]  // REQUIRED
  },
  "accessibility_notes": ["..."],  // REQUIRED (min 1 note)
  "engagement_notes": ["..."],  // REQUIRED (min 1 note)
  "weeks": 12,  // REQUIRED (realistic course duration)
  "periods_per_week": 4  // REQUIRED (typical Scottish schedule: 4-5 periods/week)
}
```

#### Entry Fields (All REQUIRED)

**Before**:
```json
{
  "order": "int, REQUIRED",
  "label": "string, REQUIRED",
  "lesson_type": "string, REQUIRED",
  "coherence": {...},  // REQUIRED
  "policy": {...},  // REQUIRED
  "engagement_tags": [...],  // REQUIRED
  "outcomeRefs": [...],  // REQUIRED
  "assessmentStandardRefs": [...],  // REQUIRED
  "pedagogical_blocks": "optional",  // ❌ Optional
  "accessibility_profile": "optional",  // ❌ Optional
  "estMinutes": "int, REQUIRED",
  "notes": "string, optional"  // ❌ Optional
}
```

**After**:
```json
{
  "order": 1,  // REQUIRED
  "label": "...",  // REQUIRED
  "lesson_type": "teach",  // REQUIRED (enum: teach | independent_practice | formative_assessment | revision | mock_assessment | summative_assessment | project | spiral_revisit)

  "coherence": {
    "block_name": "...",  // REQUIRED
    "block_index": "1.1",  // REQUIRED
    "prerequisites": []  // REQUIRED (empty array if no prerequisites)
  },

  "policy": {
    "calculator_section": "non_calc",  // REQUIRED (enum: non_calc | mixed | calc)
    "assessment_notes": "..."  // REQUIRED (empty string if none: "")
  },

  "engagement_tags": ["shopping"],  // REQUIRED (minimum 1 tag)
  "outcomeRefs": ["O1"],  // REQUIRED (minimum 1 outcome reference)
  "assessmentStandardRefs": [{...}],  // REQUIRED (enriched format, minimum 1 standard)

  "pedagogical_blocks": ["starter", "modelling"],  // REQUIRED (empty array if none: [])

  "accessibility_profile": {
    "dyslexia_friendly": true,  // REQUIRED (boolean)
    "plain_language_level": "CEFR_B1",  // REQUIRED (enum: CEFR_A2 | CEFR_B1 | CEFR_B2)
    "extra_time": false  // REQUIRED (boolean)
  },

  "lesson_author_guidance": {...},  // REQUIRED (see Lesson Author Guidance section)

  "estMinutes": 45,  // REQUIRED (realistic: 25-50 minutes for Scottish periods)
  "lesson_instruction": "..."  // REQUIRED (renamed from 'notes', see Field Rename section)
}
```

### Implementation Requirements

#### 1. SOW_AGENT_PROMPT Changes
**Action**: Remove all "(optional)" annotations from schema documentation

**Example Update**:
```
Before: "weeks": "int, optional - planned teaching weeks"
After: "weeks": "int, REQUIRED - planned teaching weeks (typical: 10-16 weeks)"
```

#### 2. SOW_AUTHOR_SUBAGENT_PROMPT Changes
**Action**: Enforce all fields must be populated

**Validation Logic**:
```
For each SoW entry:
1. Check all required fields present (fail if any missing)
2. Check all array fields have minimum entries (e.g., engagement_tags must have ≥1 item)
3. Check all string fields are non-empty (except assessment_notes which can be "")
4. Use sensible defaults where appropriate:
   - pedagogical_blocks: [] if lesson doesn't need explicit structuring
   - prerequisites: [] if lesson is foundational
   - assessment_notes: "" if no special marking guidance needed
```

#### 3. Critic Prompts Changes
**Action**: Validate every required field is present

**Coverage Critic** - Add validation step:
```
0) Validate Schema Completeness:
   - Check all required metadata fields present
   - For each entry, validate all required fields present
   - FAIL immediately if any field missing (score: 0.0)
```

**All Other Critics** - Same validation step at start

### Edge Cases and Defaults

**Q: What if a lesson truly has no pedagogical blocks?**
A: Use empty array: `"pedagogical_blocks": []`

**Q: What if there are no prerequisites (foundational lesson)?**
A: Use empty array: `"prerequisites": []`

**Q: What if there's no special assessment guidance?**
A: Use empty string: `"assessment_notes": ""`

**Q: What if lesson duration varies significantly?**
A: Use median estimate: `"estMinutes": 45` (allow range 25-50)

### Benefits

**Code Quality**:
```typescript
// Before (defensive coding):
const notes = entry.notes || "";
const blocks = entry.pedagogical_blocks || [];
if (entry.accessibility_profile) {
  // ... check each field
}

// After (clean assumptions):
const notes = entry.lesson_instruction; // Always present
const blocks = entry.pedagogical_blocks; // Always present (may be empty [])
const isDyslexiaFriendly = entry.accessibility_profile.dyslexia_friendly; // Always present
```

**Validation Clarity**:
- Critics have clear pass/fail criteria (field missing = instant fail)
- No ambiguity about "how optional is optional"

**Quality Enforcement**:
- Forces SoW Author to think through all aspects of each lesson
- No "quick draft with missing fields" → ensures completeness

---

## Schema Enhancement: Rename `notes` → `lesson_instruction`

### Problem

The field name **`notes`** is too generic and creates confusion:

**Ambiguity**:
- Is it for teachers, students, or internal agent use?
- Should it contain pedagogical guidance or administrative notes?
- Is it freeform text or structured instructions?

**Naming Conflicts**:
- Multiple "notes" fields across system (SoW notes, lesson notes, assessment notes, policy notes)
- Unclear which "notes" field refers to what

**Purpose Unclear**:
- Field doesn't signal its **primary purpose**: describing lesson structure and delivery guidance

**Current Usage** (from existing prompts):
```json
"notes": "string, optional - teacher guidance not shown to students"
```

This definition is vague. What kind of "teacher guidance"?

### Solution

Rename to **`lesson_instruction`** to clearly indicate it contains:
1. **Structural flow** of the lesson (how to sequence pedagogical blocks)
2. **Teaching strategies** specific to this lesson
3. **Context-specific guidance** for delivering multi-standard content
4. **Classroom management** notes (timing, grouping, differentiation)

### Semantic Shift

**Before (Generic)**:
```json
"notes": "Start with retrieval practice. Use shopping examples. Check for understanding."
```

**After (Structured Instruction)**:
```json
"lesson_instruction": "1) Starter (5 min): Retrieval practice on fractions using mini-whiteboard checks. 2) Modelling (15 min): Introduce percentage conversions with 10x10 grids, then model 3 worked examples using Scottish supermarket pricing (Tesco, Asda flyers). 3) Guided Practice (15 min): Pair work on provided worksheets, circulate to address misconceptions about 'of' meaning multiply. 4) Exit Ticket (10 min): Individual practice - 3 questions, collect for formative assessment."
```

### Schema Update

**Before**:
```json
"notes": "string, optional - teacher guidance not shown to students"
```

**After**:
```json
"lesson_instruction": "string, REQUIRED - Structured delivery guidance for teachers, including: timing breakdown, pedagogical block sequencing, teaching strategies, and classroom management notes. Not shown to students."
```

### Implementation Requirements

#### 1. Prompt Updates

**SOW_AGENT_PROMPT** (line ~269):
```
Change:
"notes": "string, optional - teacher guidance not shown to students"

To:
"lesson_instruction": "string, REQUIRED - Structured delivery guidance: timing, block sequencing, teaching strategies, classroom management"
```

**SOW_AUTHOR_SUBAGENT_PROMPT** (line ~723):
```
Change:
"notes": "string, optional - teacher guidance not shown to students"

To:
"lesson_instruction": "string, REQUIRED - Structured lesson delivery guidance. Include:
  - Timing breakdown by pedagogical block (e.g., 'Starter: 5 min, Modelling: 15 min...')
  - Teaching strategies (e.g., 'Use think-pair-share for guided practice')
  - Scottish context integration (e.g., 'Reference local supermarket prices')
  - Differentiation notes (e.g., 'Provide multiplication grids for students needing support')
  - Common misconceptions to address during delivery"
```

#### 2. Critic Updates

**SOW_ACCESSIBILITY_CRITIC_PROMPT** (line ~597):
```
Change:
"Check labels and notes use clear, plain language"

To:
"Check labels and lesson_instruction use clear, plain language. Validate lesson_instruction provides accessible timing guidance and doesn't assume advanced pedagogical knowledge."
```

**SOW_AUTHENTICITY_CRITIC_PROMPT** (line ~797):
```
Add validation:
"Check lesson_instruction uses Scottish contexts and authentic CfE/SQA teaching terminology (e.g., 'circle time', 'plenary', 'learning intention', 'success criteria')"
```

#### 3. Example Updates

**Before**:
```json
"notes": "Teach percentages using shopping context"
```

**After**:
```json
"lesson_instruction": "1) Starter (5 min): Quick retrieval - convert fractions to decimals on mini-whiteboards. 2) Learning Intention (2 min): Share 'I can calculate percentages of money amounts'. 3) Modelling (12 min): Use 10x10 grid visual, model finding 10%, 5%, 1% of £80 using Scottish supermarket prices. Display Tesco flyer on projector. 4) Guided Practice (15 min): Worksheets with scaffolded problems (10% → 15% → 23%), pair work, circulate to address 'percentage means divide by 100' misconception. 5) Independent Practice (10 min): Individual practice on 4 problems, collect for marking. 6) Plenary (3 min): Recap success criteria, preview next lesson (percentage increase/decrease)."
```

### Benefits

**Clarity**:
- Field name immediately signals purpose: "This tells you HOW to deliver the lesson"
- No confusion with other "notes" fields

**Quality**:
- Encourages structured, actionable guidance (not vague notes)
- Teachers get explicit timing and sequencing instructions

**Lesson Author Agent**:
- Can generate better card sequences by parsing `lesson_instruction` timing
- Understands lesson flow expectations

**Separation of Concerns**:
- `lesson_instruction`: Delivery guidance for teachers
- `lesson_author_guidance`: Generation guidance for Lesson Author Agent
- `policy.assessment_notes`: Marking/grading guidance
- Clear distinction between fields

---

## Architectural Change: Pre-Populated Course Data

### Rationale

The SoW Author Agent previously included a `course_outcome_subagent` that fetched SQA course data from Appwrite during execution. This has been **removed** in favor of **pre-populated course data** to:

1. **Separate Concerns**: Data fetching is infrastructure/setup, not agent logic
2. **Fail-Fast**: Validate course data exists before expensive LLM operations
3. **Performance**: Eliminate redundant Appwrite queries for multiple SoW generations
4. **Consistency**: Ensure all agents use the same validated course data

### New Workflow

```
┌────────────────────────────────────────────────────────────┐
│ 0. PRE-EXECUTION: Fetch Course Data (External)            │
│    - Query Appwrite "Current SQA Courses" collection      │
│    - Match subject/level to course document               │
│    - Write to state["files"]["course_data.txt"]           │
│    - FAIL if course not found                             │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 1. SoW Author Agent Entry                                  │
│    - Validate course_data.txt exists (FAIL-FAST)           │
│    - Read official SQA specifications                      │
│    - Author SoW using pre-validated course structure       │
└────────────────────────────────────────────────────────────┘
```

### Implementation Requirements

**Removed Components**:
- `course_outcome_subagent` configuration from `sow_author_agent.py`
- `COURSE_OUTCOME_SUBAGENT_PROMPT` from workflow instructions
- Appwrite query logic from agent prompts

**Updated Components**:
- All 6 prompts now validate `course_data.txt` exists at start
- Workflow instructions assume course data is pre-loaded
- Error messages guide users to pre-populate course data

**Integration Point**: The enrichment pipeline (`sow-enrichment-pipeline-spec.md`) or a separate pre-processing script should fetch and validate course data before invoking the agent.

### Benefits

**Error Detection**: Missing course data is caught immediately, not after minutes of LLM processing

**Performance**: Single course data fetch can serve multiple SoW generations (different consolidation strategies, revision attempts)

**Separation of Concerns**:
- **Infrastructure Layer**: Appwrite queries, data validation, file I/O
- **Agent Layer**: Pedagogical decisions, content generation, critique

**Testability**: Easier to mock course data for unit tests without complex Appwrite setup

---

## Architectural Change: Pre-Populated Research Pack Data

### Rationale

The SoW Author Agent previously accepted the research pack as a **human message** and wrote it to `research_pack_json` as the first step. This has been **changed** to expect **pre-populated research pack data** in the files state for consistency with the course data pattern:

1. **Consistency**: Both `Course_data.txt` and `research_pack_json` should follow the same pre-populated pattern
2. **Fail-Fast**: Validate research pack exists before agent execution begins
3. **Separation of Concerns**: Research pack generation is a separate Research DeepAgent responsibility
4. **Simplified Agent Logic**: SoW Author focuses purely on authoring, not data ingestion

### New Workflow

```
┌────────────────────────────────────────────────────────────┐
│ 0. PRE-EXECUTION: Generate Research Pack (External)       │
│    - Run Research DeepAgent for subject/level             │
│    - Write output to state["files"]["research_pack_json"] │
│    - FAIL if research pack generation fails               │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 0. PRE-EXECUTION: Fetch Course Data (External)            │
│    - Query Appwrite "Current SQA Courses" collection      │
│    - Match subject/level to course document               │
│    - Write to state["files"]["Course_data.txt"]           │
│    - FAIL if course not found                             │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 1. SoW Author Agent Entry                                  │
│    - Validate research_pack_json exists (FAIL-FAST)        │
│    - Validate Course_data.txt exists (FAIL-FAST)           │
│    - Read both files to understand context                 │
│    - Author SoW using validated inputs                     │
└────────────────────────────────────────────────────────────┘
```

### Old Pattern (Being Removed)

**Before**:
```python
# SOW_AGENT_PROMPT (lines 7-10, 182-183)
<inputs>
- **Input Format**: You will receive the research pack as a **human message** containing a JSON object.
- **First Action**: Write this JSON to the file `research_pack_json` before proceeding with SoW authoring.
...
</inputs>

<process>
1) **Write Input to File**: Take the research pack JSON from the human message and write it to the file `research_pack_json`.
2) **Read** `research_pack_json` to understand the course subject, level, and grounding material.
...
</process>
```

### New Pattern (To Be Implemented)

**After**:
```python
# SOW_AGENT_PROMPT (updated)
<inputs>
- **Input Format**: The research pack must be pre-populated in `research_pack_json` before agent execution.
- **CRITICAL PREREQUISITE**: Both `research_pack_json` and `Course_data.txt` must exist in files state.
...
</inputs>

<process>
1) **Validate Research Pack** (FAIL-FAST):
   - Check that `research_pack_json` exists in files state
   - If missing, STOP and raise error: "research_pack_json not found. Please generate research pack before running SoW Author Agent."
2) **Validate Course Data** (FAIL-FAST):
   - Check that `Course_data.txt` exists in files state
   - If missing, STOP and raise error: "Course_data.txt not found. Pre-populate course data before running SoW Author Agent."
3) **Read** both files to understand course structure and pedagogical guidance
...
</process>
```

### Implementation Requirements

**Updated Components**:
- `SOW_AGENT_PROMPT`:
  - Remove `<inputs>` instruction to accept research pack as human message
  - Remove `<process>` step 1 (write human message to file)
  - Add fail-fast validation for `research_pack_json` at start of `<process>`
  - Update `<inputs>` to document pre-populated expectation

- `SOW_AUTHOR_SUBAGENT_PROMPT`:
  - Add fail-fast validation for `research_pack_json` in `<workflow>` section
  - Update `<inputs>` to clarify pre-populated requirement

- All Critic Prompts (already have `Course_data.txt` validation):
  - Add fail-fast validation for `research_pack_json` in `<process>` section
  - Consistent error format: `{"pass": false, "score": 0.0, "feedback": "Cannot critique: research_pack_json not found..."}`

**Integration Point**: The orchestration layer (e.g., API endpoint, seeding script) should:
1. Run Research DeepAgent first → write `research_pack_json`
2. Fetch course data from Appwrite → write `Course_data.txt`
3. Pass both pre-populated files to SoW Author Agent in files state

### Benefits

**Consistency**: Both major inputs (research pack and course data) follow the same pre-populated pattern, making the agent interface predictable

**Fail-Fast**: Missing research pack detected immediately at validation step, not discovered mid-execution

**Separation of Concerns**:
- **Research DeepAgent**: Generates pedagogical guidance and exemplars
- **Infrastructure Layer**: Fetches course data from Appwrite
- **SoW Author Agent**: Pure authoring logic with validated inputs

**Agent Orchestration**: Enables parallel pre-processing (research pack generation and course data fetch can happen concurrently)

**Testability**: Easier to mock both inputs for unit tests using simple JSON files

### Error Messages

**Missing Research Pack**:
```
"research_pack_json not found. Please generate research pack using Research DeepAgent before running SoW Author Agent."
```

**Missing Course Data**:
```
"Course_data.txt not found. Pre-populate course data before running SoW Author Agent."
```

**Missing Both**:
```
"Missing required inputs: research_pack_json and Course_data.txt. Please pre-populate both files before running SoW Author Agent."
```

---

## References

- **Current SoW Prompts**: `langgraph-author-agent/src/sow_author_prompts.py`
- **Lesson Author Prompts**: `langgraph-author-agent/src/lesson_author_prompts.py`
- **Example Output**: `langgraph-author-agent/data/Seeding_Data_Full/input/sows/mathematics_national-4.json`
- **Course Data Source**: Appwrite `Course_data.txt` (fetched by `course_outcome_subagent`)
- **Related Specs**: (To be created: lesson_template_consolidation.md)

## Next Steps

1. **Review & Approve**: Stakeholder review of this spec (Product Owner, Lead Developer, Pedagogy Consultant)
2. **Prioritize Option**: Select implementation approach (recommend Option 1 + Option 3 hybrid)
3. **Create Implementation Tasks**: Break down Phase 1 work into granular tasks
4. **Set Up Testing**: Prepare test cases with known course structures
5. **Schedule Sprint Planning**: Allocate Phase 1 to next sprint

---

**Document Owner**: AI Analysis | **Reviewers**: TBD | **Last Updated**: 2025-10-13

## Changelog

### 2025-10-13
- **Added**: Schema Enhancement - Assessment Standard Enrichment (enriched `assessmentStandardRefs` with code, description, outcome)
- **Added**: Schema Enhancement - Lesson Author Guidance Integration (new `lesson_author_guidance` field)
- **Added**: Schema Enhancement - Make All Fields Required (removed all "optional" fields)
- **Added**: Schema Enhancement - Rename `notes` → `lesson_instruction` (clearer field naming)
- **Updated**: Example "Before vs. After" section to show enriched schema with `lesson_author_guidance` and `lesson_instruction`
- **Updated**: Recommended Implementation Plan to include schema enhancement tasks

### 2025-10-12
- Initial draft created with problem analysis and consolidation options
