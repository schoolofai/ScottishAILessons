# Lesson Critic Result Schema

Complete JSON schema for validation results produced by the `combined_lesson_critic` subagent.

## Overview

The critic result provides 6-dimensional quality assessment of lesson templates with specific feedback for revision. The agent uses this structured output to determine if the lesson passes validation or needs revision.

**File**: `critic_result.json` (written to workspace by `combined_lesson_critic` subagent)
**Purpose**: Quality validation and feedback for lesson template improvement
**Retry Logic**: Up to 10 retry attempts with feedback-guided revision

---

## Top-Level Structure

```json
{
  "overall_status": "pass" | "needs_revision",
  "overall_score": number,
  "dimension_scores": {
    "pedagogical_design": number,
    "assessment_design": number,
    "accessibility": number,
    "scottish_context": number,
    "coherence": number,
    "sow_template_fidelity": number
  },
  "feedback": Feedback[]
}
```

---

## Field Specifications

### `overall_status` (string, required)

**Description**: Final pass/fail decision for the lesson template
**Allowed Values**:
- `"pass"` - Template meets all quality thresholds, ready for database
- `"needs_revision"` - Template has issues, requires revision and re-validation

**Determination Logic**:
```
overall_status = "pass" IF:
  1. ALL dimension_scores >= dimension_threshold (0.85-0.88)
  AND
  2. overall_score (weighted average) >= 0.88
ELSE:
  overall_status = "needs_revision"
```

**Example**: `"pass"`

**Usage**: Orchestrator checks this field to decide retry vs. completion

---

### `overall_score` (number, required)

**Description**: Weighted average across all 6 dimensions
**Range**: 0.00 - 1.00 (decimal between 0 and 1)
**Format**: Two decimal places (e.g., `0.92`)
**Threshold**: >= 0.88 for pass

**Calculation**:
```
overall_score =
  (pedagogical_design × 0.20) +
  (assessment_design × 0.25) +
  (accessibility × 0.20) +
  (scottish_context × 0.20) +
  (coherence × 0.15) +
  (sow_template_fidelity × 0.25)
```

**Example**: `0.92` (92% quality score)

**Interpretation**:
- **0.90-1.00**: Excellent quality, exceptional pedagogical design
- **0.88-0.89**: Acceptable quality, meets SQA standards
- **0.85-0.87**: Borderline, requires minor revisions
- **0.00-0.84**: Significant issues, major revisions needed

---

### `dimension_scores` (object, required)

**Description**: Individual scores for each of 6 quality dimensions
**Format**: Object with 6 required keys, each mapping to a decimal score

**Structure**:
```json
{
  "pedagogical_design": 0.95,
  "assessment_design": 0.90,
  "accessibility": 0.88,
  "scottish_context": 0.93,
  "coherence": 0.90,
  "sow_template_fidelity": 0.92
}
```

Each dimension has:
- **Weight**: Importance multiplier for overall_score
- **Threshold**: Minimum acceptable score (0.85-0.88)
- **Focus**: Specific quality aspect

---

## Dimension Details

### 1. Pedagogical Design (Weight: 0.20, Threshold: 0.88)

**Focus**: Teaching effectiveness and learning progression

**Evaluation Criteria**:
1. **Lesson Type Appropriateness**:
   - teach: 3-4 cards with I-We-You structure
   - independent_practice: 3-4 cards, minimal scaffolding
   - formative_assessment: 2-3 cards (one per assessment standard)
   - revision: 3-4 cards with mixed practice
   - mock_exam: 8-15 cards with progressive difficulty

2. **I-We-You Progression** (teach lessons only):
   - **I (Modelling)**: Teacher demonstrates with explicit steps
   - **We (Guided)**: Shared practice with hints and support
   - **You (Independent)**: Student works autonomously

3. **Scaffolding Strategy Alignment**:
   - teach: HIGH → MEDIUM → LOW (progressive fading)
   - independent_practice: LOW throughout (autonomy focus)
   - formative_assessment: MEDIUM (support but assess independently)

4. **Card Count Logic**:
   - Sufficient depth (not rushed)
   - Realistic for estMinutes (2-3 cards per 30 min)
   - Avoids redundancy (each card has distinct purpose)

5. **CFU Type Alignment**:
   - Starter cards: MCQ for quick recall
   - Modelling cards: Structured response for worked examples
   - Practice cards: Numeric or structured for skill application

**Scoring**:
- **1.00**: Exemplary pedagogical design, flawless progression
- **0.95**: Strong design, minor improvements possible
- **0.88**: Acceptable design, meets SQA standards
- **< 0.88**: Pedagogical issues (e.g., wrong card count, broken I-We-You)

---

### 2. Assessment Design (Weight: 0.25, Threshold: 0.88)

**Focus**: Formative assessment quality and SQA rubric alignment

**Evaluation Criteria**:
1. **CFU Type Appropriateness**:
   - teach: Varied types (MCQ, numeric, structured)
   - independent_practice: Primarily numeric/structured
   - formative_assessment: Structured response with detailed rubrics
   - mock_exam: Progressive difficulty across question types

2. **Rubric SQA Alignment**:
   - **Method marks**: Award for correct process (e.g., "Divides by denominator: 1 point")
   - **Accuracy marks**: Award for correct answer (e.g., "States £4: 1 point")
   - **Point allocation**: Typically 60% method, 40% accuracy
   - **Clear criteria**: Each criterion is observable and measurable

3. **Hint Quality** (teach/revision lessons):
   - Present where needed (absent in independent_practice)
   - Progressive scaffolding (Hint 1: restate, Hint 2: first step, Hint 3: calculation)
   - 3-5 hints per card (not too many, not too few)
   - Hints don't give away answer directly

4. **Difficulty Progression**:
   - Starter cards: Lower difficulty, recall/recognition
   - Modelling cards: Medium difficulty, application with support
   - Practice cards: Higher difficulty, transfer to new contexts

5. **Mark Allocation Balance**:
   - Total points per card: 1-3 (teach), 3-5 (formative), 4-8 (mock_exam)
   - Proportional to card complexity and time allocation

**Scoring**:
- **1.00**: Exemplary assessment design, SQA-perfect rubrics
- **0.90**: Strong rubrics, appropriate CFU types
- **0.88**: Acceptable assessment, minor rubric improvements
- **< 0.88**: Assessment issues (e.g., wrong CFU type, unclear rubrics)

---

### 3. Accessibility (Weight: 0.20, Threshold: 0.88)

**Focus**: CEFR A2-B1 compliance and dyslexia-friendly design

**Evaluation Criteria**:
1. **explainer_plain Sentence Length**:
   - Target: 8-12 words per sentence
   - Maximum: 15 words (firm threshold)
   - Violation: Any sentence > 15 words triggers deduction

2. **CEFR A2-B1 Language Features**:
   - **Active voice**: "Divide £20 by 4" (not "£20 is divided")
   - **Simple connectives**: First, Then, Next (avoid However, Moreover)
   - **Concrete nouns**: "pizza" not "circular food item"
   - **Present tense**: "We divide" (avoid perfect/continuous)

3. **Dyslexia-Friendly Design**:
   - Short paragraphs (2-4 sentences)
   - Bullet points for lists
   - One instruction per line (for CFU stems)
   - Avoid italic/underline overuse

4. **Visual Aid Descriptions**:
   - Diagrams/charts described textually when referenced
   - Alt text mindset (assume visual not available)

5. **Chunked Information**:
   - Numbered steps for procedures
   - Bullet points for multiple items
   - Headings for section breaks

**Scoring**:
- **1.00**: Perfect CEFR compliance, all sentences ≤ 12 words
- **0.90**: Good accessibility, occasional 13-15 word sentences
- **0.88**: Acceptable, most sentences compliant
- **< 0.88**: Accessibility issues (sentences > 15 words, passive voice overuse)

---

### 4. Scottish Context (Weight: 0.20, Threshold: 0.88)

**Focus**: Authentic Scottish contexts and cultural alignment

**Evaluation Criteria**:
1. **Currency Enforcement**:
   - All monetary amounts use £ symbol
   - ZERO tolerance for $ or € (automatic fail if present)
   - Correct placement: £20 (not 20£)

2. **Scottish Locations and Brands**:
   - **Transport**: ScotRail, Lothian Buses, Edinburgh Airport
   - **Retail**: Tesco Scotland, Morrisons, Co-op
   - **Healthcare**: NHS Scotland, Scottish pharmacies
   - **Government**: Scottish Parliament, local councils
   - **Education**: SQA, CfE terminology

3. **Pricing Realism for Scotland**:
   - Meal deal: £3-4 (not $5 US pricing)
   - Train tickets: Edinburgh-Glasgow £10-30 (not £5 or £50)
   - Coffee: £2.50-3.50 (not £1 or £5)
   - Cinema ticket: £8-12 (not £5 or £15)

4. **CfE Terminology Accuracy**:
   - "Outcomes" not "standards" (CfE-specific term)
   - "Experiences and Outcomes" not "learning objectives"
   - SQA course levels: National 3/4/5, Higher, Advanced Higher

5. **Scottish Cultural References**:
   - Events: Hogmanay, Edinburgh Festival, Highland Games
   - Landmarks: Edinburgh Castle, Loch Ness, Stirling Bridge
   - Sports: Rugby internationals (Murrayfield), football (Scottish Premiership)

**Scoring**:
- **1.00**: Exemplary Scottish authenticity, perfect contexts
- **0.95**: Strong Scottish contexts, realistic pricing
- **0.88**: Acceptable Scottish alignment, no major errors
- **< 0.88**: Scottish context failures (wrong currency, US pricing, non-Scottish brands)

---

### 5. Coherence (Weight: 0.15, Threshold: 0.85)

**Focus**: Internal consistency and logical flow

**Evaluation Criteria**:
1. **Title-Lesson Alignment**:
   - Title accurately reflects lesson content
   - Not generic (e.g., "Lesson 1")
   - Describes learning focus clearly

2. **Timing Accuracy**:
   - Sum of card timings equals estMinutes
   - Individual card timings realistic (5-15 min per card)

3. **Card Flow Logic**:
   - No gaps in progression (e.g., jump from basic to advanced without intermediate)
   - Each card builds on previous (teach lessons)
   - No redundant cards (each has unique contribution)

4. **No Contradictions**:
   - Terminology consistent across cards
   - Examples don't conflict (e.g., same discount rate used throughout)
   - Misconceptions don't contradict explainers

5. **Consistent Style**:
   - Tone appropriate for level (e.g., not patronizing for Higher)
   - Formatting consistent (e.g., all MCQs use same structure)

**Scoring**:
- **1.00**: Perfect coherence, seamless flow
- **0.90**: Strong coherence, minor inconsistencies
- **0.85**: Acceptable coherence, no major breaks
- **< 0.85**: Coherence issues (contradictions, timing mismatch, broken flow)

---

### 6. SOW Template Fidelity (Weight: 0.25, Threshold: 0.88)

**Focus**: Alignment with Scheme of Work requirements

**Evaluation Criteria**:
1. **Outcome Coverage**:
   - Lesson addresses all outcomeRefs from SOW entry
   - Outcome codes match Course_data.txt enriched outcomes
   - No missing outcomes, no irrelevant outcomes

2. **Engagement Tags Respect**:
   - Scottish contexts align with engagement_tags (e.g., "finance" → budgeting scenarios)
   - Real-world connections reflect SOW guidance
   - Themes integrated authentically (not forced)

3. **Policy Constraint Adherence**:
   - Calculator policy respected throughout
   - If policy.calculator_allowed = false, no calculator-required questions
   - Assessment notes guide lesson design

4. **Big Idea Alignment**:
   - Lesson reflects SOW "big idea" or learning focus
   - Depth appropriate for SOW positioning (e.g., introduction vs. consolidation)

5. **Assessment Standard Coverage**:
   - Lesson addresses required assessment standards (AS codes)
   - Formative assessment lessons: One card per AS code minimum

**Scoring**:
- **1.00**: Perfect SOW alignment, all requirements met
- **0.95**: Strong SOW fidelity, minor omissions
- **0.88**: Acceptable alignment, meets key requirements
- **< 0.88**: SOW fidelity failures (missing outcomes, wrong policy, poor engagement_tag fit)

---

### `feedback` (Feedback[], required)

**Description**: Array of specific issues with prioritized actions for revision
**Count**: 0-10 feedback items (typically 2-5 for needs_revision status)

**Structure**:
```json
{
  "dimension": string,
  "severity": string,
  "issue": string,
  "action": string
}
```

**Fields**:

1. **dimension** (string, required)
   - Which quality dimension this feedback relates to
   - Allowed values: `"pedagogical_design"`, `"assessment_design"`, `"accessibility"`, `"scottish_context"`, `"coherence"`, `"sow_template_fidelity"`
   - Example: `"accessibility"`

2. **severity** (string, required)
   - Issue importance for prioritizing revisions
   - Allowed values:
     - `"critical"` - Must fix (e.g., wrong currency, missing outcomes)
     - `"high"` - Should fix (e.g., poor I-We-You, unclear rubrics)
     - `"medium"` - Nice to fix (e.g., minor accessibility improvements)
     - `"low"` - Optional improvement (e.g., stylistic enhancements)
   - Example: `"medium"`

3. **issue** (string, required)
   - Clear description of the problem
   - Specific location reference (e.g., "Card 3 explainer_plain")
   - Measurable observation (e.g., "18-word sentence")
   - Example: `"Card 3 explainer_plain has 18-word sentence"`

4. **action** (string, required)
   - Concrete revision instruction
   - Specific enough to guide lesson_author revision
   - Actionable (not vague "improve quality")
   - Example: `"Split into 2 sentences of 8-10 words each"`

---

## Feedback Examples

### Example 1: Accessibility Issue (Medium Severity)

```json
{
  "dimension": "accessibility",
  "severity": "medium",
  "issue": "Card 3 explainer_plain contains a 17-word sentence: 'When we divide £20 into 4 equal parts we can see that each part is £5'",
  "action": "Split into 2 sentences: 'Divide £20 into 4 equal parts. Each part is £5.'"
}
```

### Example 2: Scottish Context Issue (Critical Severity)

```json
{
  "dimension": "scottish_context",
  "severity": "critical",
  "issue": "Card 2 explainer uses $ symbol for currency instead of £",
  "action": "Replace all $ symbols with £ throughout Card 2 explainer and CFU stem"
}
```

### Example 3: Assessment Design Issue (High Severity)

```json
{
  "dimension": "assessment_design",
  "severity": "high",
  "issue": "Card 4 rubric lacks method marks - only awards accuracy mark for final answer",
  "action": "Add method mark criterion: 'Correctly calculates discount using division method (1 point)' and keep accuracy mark for final answer (1 point)"
}
```

### Example 4: SOW Fidelity Issue (Critical Severity)

```json
{
  "dimension": "sow_template_fidelity",
  "severity": "critical",
  "issue": "Lesson outcomeRefs ['O1', 'O2'] missing required outcome 'AS1.3' from SOW entry",
  "action": "Add outcome 'AS1.3' to outcomeRefs array and ensure Card 3 or 4 addresses this assessment standard"
}
```

### Example 5: Pedagogical Design Issue (High Severity)

```json
{
  "dimension": "pedagogical_design",
  "severity": "high",
  "issue": "Teach lesson has 5 cards instead of expected 3-4, causing lesson to exceed estMinutes of 50",
  "action": "Merge Card 3 and Card 4 into single 'Guided Practice' card to reduce total to 4 cards and fit 50-minute timing"
}
```

---

## Complete Example: Pass Status

```json
{
  "overall_status": "pass",
  "overall_score": 0.92,
  "dimension_scores": {
    "pedagogical_design": 0.95,
    "assessment_design": 0.90,
    "accessibility": 0.88,
    "scottish_context": 0.93,
    "coherence": 0.90,
    "sow_template_fidelity": 0.92
  },
  "feedback": []
}
```

**Interpretation**:
- All dimensions meet/exceed thresholds (0.85-0.88)
- Overall score 0.92 exceeds 0.88 threshold
- No feedback items (lesson is production-ready)
- Agent proceeds to card compression and database upsert

---

## Complete Example: Needs Revision Status

```json
{
  "overall_status": "needs_revision",
  "overall_score": 0.86,
  "dimension_scores": {
    "pedagogical_design": 0.90,
    "assessment_design": 0.85,
    "accessibility": 0.82,
    "scottish_context": 0.88,
    "coherence": 0.88,
    "sow_template_fidelity": 0.85
  },
  "feedback": [
    {
      "dimension": "accessibility",
      "severity": "high",
      "issue": "Card 2 explainer_plain contains 3 sentences exceeding 15 words (17, 18, and 16 words)",
      "action": "Rewrite Card 2 explainer_plain with sentences of 8-12 words maximum. Break long sentences into 2-3 shorter ones."
    },
    {
      "dimension": "accessibility",
      "severity": "medium",
      "issue": "Card 4 explainer_plain uses passive voice: 'The discount is calculated by...'",
      "action": "Rewrite in active voice: 'Calculate the discount by...'"
    },
    {
      "dimension": "assessment_design",
      "severity": "high",
      "issue": "Card 3 rubric missing method mark - only awards point for correct final answer",
      "action": "Add method mark criterion: 'Uses correct formula for fraction calculation (1 point)' before accuracy mark"
    }
  ]
}
```

**Interpretation**:
- accessibility dimension (0.82) fails threshold (0.88)
- Overall score (0.86) below 0.88 threshold
- 3 specific feedback items to address (2 high, 1 medium severity)
- Agent triggers revision loop (lesson_author receives feedback for revision)
- Up to 10 retries with feedback-guided improvements

---

## Retry Loop Integration

### Orchestration Logic

```python
for attempt in range(1, max_retries + 1):
    # Lesson author creates lesson_template.json
    lesson_template = await lesson_author_subagent.execute()

    # Critic validates lesson
    critic_result = await lesson_critic_subagent.execute()

    if critic_result["overall_status"] == "pass":
        break  # Success - proceed to compression and upsert
    else:
        if attempt == max_retries:
            raise Exception("Max retries exceeded, lesson still needs revision")
        # Pass feedback to lesson_author for next attempt
        # Feedback informs revision priorities
```

### Feedback-Guided Revision

The `lesson_author` subagent receives `critic_result.json` on retry attempts and uses it to:
1. **Prioritize critical/high severity issues** first
2. **Focus on failing dimensions** (score < threshold)
3. **Apply specific actions** from feedback array
4. **Preserve working elements** (don't over-revise passing cards)

---

## Validation Insights

### Common Failure Patterns

1. **Accessibility Failures (30% of retries)**:
   - Sentence length violations (> 15 words in explainer_plain)
   - Passive voice overuse
   - Complex vocabulary (CEFR B2+ instead of A2-B1)

2. **Scottish Context Failures (25% of retries)**:
   - Wrong currency ($ or €)
   - Non-Scottish brands (Walmart, US locations)
   - Unrealistic UK pricing (US dollar amounts converted)

3. **SOW Fidelity Failures (20% of retries)**:
   - Missing outcomeRefs from SOW entry
   - Ignoring engagement_tags (generic contexts instead of SOW-specified themes)
   - Calculator policy violations

4. **Assessment Design Failures (15% of retries)**:
   - Missing method marks in rubrics
   - Wrong CFU types for lesson stage (e.g., MCQ for mock_exam)
   - Insufficient hints for teach lessons

5. **Pedagogical Design Failures (10% of retries)**:
   - Wrong card count for lesson_type
   - Broken I-We-You progression
   - Scaffolding inconsistency (e.g., LOW then HIGH)

---

## Performance Metrics

**Typical Outcomes** (based on Phase 4 testing):
- **First-attempt pass rate**: 40-60% (well-designed SOW entries)
- **Pass by attempt 2**: 80-90% (accessibility/scottish_context fixes)
- **Pass by attempt 3**: 95-98% (complex rubric/SOW fidelity issues)
- **Max retries exceeded**: <2% (fundamental SOW entry issues)

**Token Usage**:
- Critic evaluation: 5-10K tokens per attempt
- Total retry cost: +5-20K tokens depending on attempts needed

---

## Related Documentation

- [Lesson Template Schema](./lesson_template_schema.md) - Template structure being validated
- [SOW Entry Input Schema](./sow_entry_input_schema.md) - SOW requirements critic enforces
- [Combined Lesson Critic Prompt](../src/prompts/lesson_critic_prompt.md) - Full validation logic
- [Lesson Author README](../LESSON_AUTHOR_README.md) - Retry configuration and troubleshooting

---

**Version**: 1.0
**Last Updated**: October 2025
**Maintained By**: Lesson Author Agent Documentation
