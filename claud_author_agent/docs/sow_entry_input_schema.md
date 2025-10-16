# SOW Entry Input Schema

Complete schema for Scheme of Work (SOW) entries extracted from the `default.Authored_SOW` collection.

## Overview

SOW entries are high-level lesson planning records that guide the Lesson Author agent. Each entry represents one lesson within a course's Scheme of Work, providing curriculum requirements, timing, and engagement contexts.

**File**: `sow_entry_input.json` (extracted by Python from `default.Authored_SOW`)
**Companion File**: `sow_context.json` (course-level metadata)
**Extractor**: `src/utils/sow_extractor.py`
**Source Collection**: `default.Authored_SOW`

---

## Extraction Process

### Input Parameters

```python
courseId: str     # e.g., "course_c84474"
order: int        # 1-indexed lesson position (1, 2, 3...)
```

### Query Logic

```python
# Query Authored_SOW collection
SOW_docs = query(database="default", collection="Authored_SOW",
                 equal("courseId", courseId))

# Extract specific entry by order
SOW_entry = SOW_docs[0].entries[order - 1]  # Convert to 0-indexed for array access

# Note: Order values in SOW entries are 1-indexed (order: 1, 2, 3...),
# but Python array indexing is 0-indexed
```

### Output Files

1. **sow_entry_input.json**: Specific lesson entry at `order`
2. **sow_context.json**: Course-level SOW metadata (subject, level, coherence, accessibility_notes, engagement_notes, total_entries)

---

## SOW Entry Structure

```json
{
  "order": number,
  "label": string,
  "big_idea": string,
  "outcomeRefs": string[],
  "estMinutes": number,
  "lesson_type": string,
  "engagement_tags": string[],
  "policy": object
}
```

---

## Field Specifications

### `order` (number, required)

**Description**: Sequential position within Scheme of Work
**Range**: 1-15 (1-indexed, starts from 1 not 0)
**Example**: `1`, `2`, `3`

**Validation**:
- Must be >= 1 (0 is invalid)
- Must be unique within SOW entries for a courseId
- Used for lesson sequencing and progress tracking

**Purpose**:
- Maintains curriculum progression
- Determines lesson dependencies (e.g., order 3 builds on order 1-2)
- Used as upsert key (courseId + sow_order) for lesson templates

**Note**: When querying SOW entries, order is 1-indexed. When accessing Python arrays, convert to 0-indexed (order - 1).

---

### `label` (string, required)

**Description**: Short lesson descriptor for teacher reference
**Length**: 30-80 characters
**Format**: Sentence case, descriptive
**Example**: `"Introduction to Fractions"`

**Guidelines**:
- Teacher-facing (can use pedagogical terminology)
- More concise than lesson template title
- Often includes topic + approach (e.g., "Exploring Quadratics through Real-World Contexts")

**Relationship to Lesson Template**:
- SOW `label` → Lesson `title` (may be refined with Scottish contexts)
- Example:
  - SOW label: `"Fraction Calculations"`
  - Lesson title: `"Calculating Fractions of Amounts in Scottish Shopping Contexts"`

---

### `big_idea` (string, required)

**Description**: Core learning focus and conceptual understanding goal
**Length**: 50-200 words
**Format**: Paragraph or bullet points
**Example**: `"Students will understand that fractions represent parts of a whole and can be applied to real-world scenarios like discounts, portions, and measurements. This foundational skill connects to ratio, percentage, and algebraic thinking."`

**Purpose**:
- Guides lesson author's thematic direction
- Ensures conceptual depth (not just procedural skills)
- Links to prior/future learning in the course

**Usage by Lesson Author**:
- Informs card explainer framing (connect to big picture)
- Guides Scottish context selection (align with big idea themes)
- Shapes progression (ensure cards build toward big idea mastery)

---

### `outcomeRefs` (string[], required)

**Description**: SQA outcome and assessment standard codes this lesson addresses
**Format**: Array of outcome/assessment codes
**Example**: `["O1", "AS1.2"]`

**Code Types**:
1. **Outcome Codes**: `"O1"`, `"O2"`, `"O3"`, etc.
   - Learning objectives from SQA course specification
   - Example: `"O1"` = "Express quantities as fractions, decimals, and percentages"

2. **Assessment Standard Codes**: `"AS1.2"`, `"AS2.1"`, etc.
   - Specific assessment criteria from SQA course
   - Example: `"AS1.2"` = "Calculate fractions of amounts using division and multiplication"

**Validation**:
- Cannot be empty array (must have at least one outcome)
- Codes must exist in `Course_data.txt` enriched outcomes
- Lesson template must include all SOW entry outcomeRefs in its own outcomeRefs field

**Purpose**:
- Curriculum alignment and compliance
- Outcome-based progress tracking
- SQA assessment standard coverage verification

---

### `estMinutes` (number, required)

**Description**: Estimated lesson duration in minutes
**Range**: 30-90 minutes (typically 40-60)
**Example**: `50`

**Common Values**:
- **40-50 min**: Standard single period (National 3-5, Higher)
- **60 min**: Extended period or double lesson
- **80-90 min**: Mock exam or project-based lesson

**Validation**:
- Must be positive integer
- Realistic for secondary school scheduling
- Should align with card count (2-3 cards per 30 min)

**Purpose**:
- Lesson Author uses to determine appropriate card count
- Teacher uses for timetable planning
- Critic validates timing sum matches estMinutes

---

### `lesson_type` (string, required)

**Description**: Pedagogical category determining lesson structure
**Allowed Values**:
- `"teach"` - Introduction and modeling (I-We-You progression)
- `"independent_practice"` - Skill consolidation (minimal scaffolding)
- `"formative_assessment"` - Progress check (one card per assessment standard)
- `"revision"` - Memory retrieval (mixed practice, spaced repetition)
- `"mock_exam"` - Exam preparation (8-15 cards, progressive difficulty)

**Example**: `"teach"`

**Impact on Lesson Authoring**:

| lesson_type | Card Count | Scaffolding | CFU Types | Hints |
|-------------|-----------|-------------|-----------|-------|
| teach | 3-4 | HIGH → LOW | Varied (MCQ, numeric, structured) | Extensive |
| independent_practice | 3-4 | LOW throughout | Numeric, structured | Minimal |
| formative_assessment | 2-3 | MEDIUM | Structured response | Some |
| revision | 3-4 | MEDIUM | Mixed types | Strategic |
| mock_exam | 8-15 | LOW | Progressive difficulty | None |

**Pedagogical Patterns**:
- **teach**: I-We-You progression (Starter → Modelling → Guided → Independent)
- **independent_practice**: Repeated application (Practice 1 → Practice 2 → Challenge)
- **formative_assessment**: One card per assessment standard with detailed rubrics
- **revision**: Mixed practice across prior topics (Topic 1 Recall → Topic 2 Recall → Mixed Application)
- **mock_exam**: SQA exam simulation (Easy → Medium → Hard questions, exam timing)

---

### `engagement_tags` (string[], required)

**Description**: Scottish contexts and real-world connection themes
**Format**: Array of lowercase hyphenated tags
**Example**: `["finance", "shopping"]`

**Common Tag Categories**:

1. **Finance & Economics**:
   - `"finance"`, `"budgeting"`, `"savings"`, `"loans"`, `"mortgages"`
   - Example contexts: Budgeting for Edinburgh Festival, calculating loan interest, savings accounts

2. **Shopping & Retail**:
   - `"shopping"`, `"discounts"`, `"supermarkets"`, `"sales"`
   - Example contexts: Tesco meal deals, sale percentages, price comparisons

3. **Transport**:
   - `"transport"`, `"scotrail"`, `"buses"`, `"cycling"`, `"travel"`
   - Example contexts: Train ticket discounts, bus route planning, carbon footprint

4. **Healthcare**:
   - `"healthcare"`, `"nhs"`, `"prescriptions"`, `"fitness"`
   - Example contexts: NHS Scotland prescription costs, BMI calculations, medication dosages

5. **Events & Culture**:
   - `"edinburgh-festival"`, `"hogmanay"`, `"highland-games"`, `"sports-events"`
   - Example contexts: Festival ticket pricing, Hogmanay event planning, rugby match statistics

6. **Education & Career**:
   - `"education"`, `"careers"`, `"apprenticeships"`, `"university"`
   - Example contexts: Student loan calculations, apprenticeship wages, university costs

7. **Environment & Sustainability**:
   - `"environment"`, `"recycling"`, `"energy"`, `"climate"`
   - Example contexts: Carbon footprint analysis, renewable energy statistics, recycling rates

**Validation**:
- Can be empty array (if no specific context applies)
- Tags should be lowercase with hyphens for multi-word tags
- Tags guide but don't constrain lesson author (suggestive not prescriptive)

**Purpose**:
- Guides Scottish context selection in card explainers
- Ensures real-world relevance and student engagement
- Aligns with SQA emphasis on "learning in context"

---

### `policy` (object, required)

**Description**: Lesson-specific constraints and rules
**Structure**:
```json
{
  "calculator_allowed": boolean,
  "assessment_notes": string
}
```

**Subfield: calculator_allowed** (boolean, required)

**Description**: Whether calculators are permitted in this lesson
**Values**:
- `true`: Calculators allowed (algebraic problems, complex calculations, data analysis)
- `false`: No calculators (mental math, fraction fundamentals, non-calculator exam practice)

**Example**: `false`

**SQA Context**:
- SQA National 5 Mathematics has both calculator and non-calculator papers
- Lessons must explicitly train students for both contexts
- Calculator policy aligns with assessment standard requirements

**Impact on Lesson Authoring**:
- `calculator_allowed: false` → Questions must be solvable by hand (e.g., 1/4 of £20, not 17.3% of £47.82)
- `calculator_allowed: true` → Can include complex calculations (e.g., compound interest, statistical analysis)
- Critic validates CFU difficulty matches calculator policy

**Subfield: assessment_notes** (string, optional)

**Description**: Additional guidance for teacher or agent
**Length**: 50-200 characters
**Format**: Brief plain text
**Example**: `"Non-calculator lesson building foundational numeracy"`

**Purpose**:
- Clarifies rationale for policy choices
- Provides implementation guidance
- Highlights special considerations (e.g., "Timed mock exam - 45 min strict")

---

## SOW Context File (`sow_context.json`)

**Companion file** providing course-level metadata extracted from SOW document.

### Structure

```json
{
  "courseId": string,
  "subject": string,
  "level": string,
  "coherence": string,
  "accessibility_notes": string,
  "engagement_notes": string,
  "total_entries": number
}
```

### Field Specifications

**courseId** (string):
- Course identifier from `default.courses`
- Example: `"course_c84474"`

**subject** (string):
- SQA subject in lowercase with hyphens
- Example: `"mathematics"`, `"application-of-mathematics"`, `"biology"`

**level** (string):
- SQA level in lowercase with hyphens
- Example: `"national-5"`, `"higher"`, `"advanced-higher"`

**coherence** (string):
- Course-wide learning progression narrative
- Length: 100-300 words
- Example: `"This course progresses from numerical foundations (fractions, decimals, percentages) through algebraic reasoning to applied problem-solving in real-world contexts. Early lessons build procedural fluency before transitioning to conceptual understanding and transfer."`

**accessibility_notes** (string):
- Course-wide accessibility considerations
- Length: 50-200 words
- Example: `"All lessons include CEFR A2-B1 plain language explainers for dyslexic students and English learners. Visual aids are described textually. Scaffold reduced progressively across course."`

**engagement_notes** (string):
- Course-wide engagement strategy
- Length: 50-200 words
- Example: `"Scottish contexts emphasized throughout (ScotRail, NHS Scotland, Edinburgh Festival). Real-world applications connect to student interests (shopping, travel, finance). Authentic data sources used."`

**total_entries** (number):
- Total number of lessons in SOW
- Range: 8-15 (typical course structure)
- Example: `12`

### Purpose

The `sow_context.json` file provides:
1. **Course identity** (subject, level) for agent awareness
2. **Big picture narrative** (coherence) to situate individual lesson
3. **Cross-lesson standards** (accessibility, engagement) for consistency
4. **Scope awareness** (total_entries) to understand lesson position in sequence

---

## Complete Example

### sow_entry_input.json

```json
{
  "order": 1,
  "label": "Introduction to Fractions of Amounts",
  "big_idea": "Students will understand that fractions represent parts of a whole and can be applied to calculate portions of quantities in real-world Scottish contexts like shopping discounts and transport costs. This foundational skill connects to percentage calculations and proportional reasoning.",
  "outcomeRefs": ["O1", "AS1.2"],
  "estMinutes": 50,
  "lesson_type": "teach",
  "engagement_tags": ["finance", "shopping", "transport"],
  "policy": {
    "calculator_allowed": false,
    "assessment_notes": "Non-calculator lesson building foundational numeracy"
  }
}
```

### sow_context.json

```json
{
  "courseId": "course_c84474",
  "subject": "mathematics",
  "level": "national-5",
  "coherence": "This National 5 Mathematics course progresses from numerical foundations through algebraic reasoning to applied problem-solving. Early lessons (1-4) build fraction, decimal, and percentage fluency. Mid-course lessons (5-8) introduce algebraic expressions and equations. Later lessons (9-12) focus on geometric reasoning and data analysis. Scottish contexts and real-world applications are emphasized throughout.",
  "accessibility_notes": "All lessons include CEFR A2-B1 plain language explainers for dyslexic students and English learners. Visual aids are described textually for screen reader compatibility. Scaffolding reduced progressively across course to build independence.",
  "engagement_notes": "Scottish contexts emphasized throughout (ScotRail, NHS Scotland, Tesco, Edinburgh Festival). Real-world applications connect to student interests (shopping, budgeting, travel planning). Authentic Scottish data sources used where possible (e.g., actual train fares, realistic supermarket pricing).",
  "total_entries": 12
}
```

---

## Validation and Error Handling

### Pre-Extraction Validation

The `src/utils/sow_extractor.py` performs fail-fast validation:

1. **SOW Existence Check**:
   ```python
   if not sow_docs or len(sow_docs) == 0:
       raise ValueError(f"SOW not found for courseId '{courseId}'")
   ```

2. **Order Range Check**:
   ```python
   available_orders = [e.get('order') for e in entries]
   if order not in available_orders:
       raise ValueError(f"Order {order} not found. Available: {available_orders}")
   ```

3. **Order >= 1 Validation**:
   - CLI validation: `src/lesson_author_cli.py` rejects `order < 1`
   - Error message: `"Order must be >= 1 (SOW entries start at 1)"`

### Common Errors

**Error 1: SOW Not Found**
```
ValueError: SOW not found: No SOW with courseId='course_xyz' in default.Authored_SOW collection.
Please author the SOW first before creating lesson templates.
```

**Cause**: Attempting to author lesson before SOW exists
**Solution**: Run `src.sow_author_cli` to create SOW first

**Error 2: Invalid Order**
```
ValueError: Order 0 not found in SOW entries for courseId 'course_c84474'.
Available orders: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
```

**Cause**: Using 0-indexed order value (order must be >= 1)
**Solution**: Use 1-indexed order values (1, 2, 3...)

**Error 3: Order Out of Range**
```
ValueError: Order 15 not found in SOW entries for courseId 'course_c84474'.
Available orders: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
```

**Cause**: Requesting order beyond SOW scope (total_entries = 12)
**Solution**: Check `sow_context.json` total_entries field for valid range

---

## Usage in Lesson Author Agent

### Pipeline Integration

```
1. User Input:
   courseId = "course_c84474"
   order = 1

2. Python Extraction (0 tokens):
   sow_extractor.extract_sow_entry_to_workspace()
   → Creates sow_entry_input.json
   → Creates sow_context.json

3. Agent Workspace:
   workspace/lesson_author_20251016_150000/
   ├── sow_entry_input.json        ← Specific lesson requirements
   ├── sow_context.json             ← Course-level context
   └── Course_data.txt              ← SQA outcome details

4. Lesson Author Subagent:
   - Reads sow_entry_input.json for lesson requirements
   - Reads sow_context.json for course context
   - Reads Course_data.txt for outcome descriptions
   - Authors lesson_template.json aligning with all inputs

5. Critic Subagent:
   - Validates lesson_template.json against sow_entry_input.json
   - Checks SOW fidelity dimension (outcomeRefs, engagement_tags, policy)
```

### Token Savings

**Python extraction vs. LLM extraction**:
- LLM extraction: ~8-12K tokens (query Appwrite, parse JSON, filter entries)
- Python extraction: 0 tokens (deterministic database operation)
- **Savings**: ~8-12K tokens per lesson execution (15-20% of total pipeline)

---

## Relationship to SOW Author Agent

### SOW Author Output → Lesson Author Input

The `SOW Author` agent (separate pipeline) creates the `default.Authored_SOW` documents that contain these entries.

**SOW Author Pipeline**:
```
Input: {subject, level, courseId}
  ↓
SOW Author Agent
  ↓
Output: Authored_SOW document with 8-15 entries
```

**Typical Workflow**:
```bash
# Step 1: Author SOW (creates 12 entries)
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId course_c84474

# Step 2: Author lessons for each entry (1-12)
for order in {1..12}; do
  python -m src.lesson_author_cli \
    --courseId course_c84474 \
    --order $order
done
```

---

## Schema Evolution

### Current Version (1.0)

- **Order**: 1-indexed (1, 2, 3...)
- **Fields**: 7 required fields (order, label, big_idea, outcomeRefs, estMinutes, lesson_type, engagement_tags, policy)
- **Format**: JSON extracted from Appwrite document

### Future Enhancements

1. **Prerequisites Field** (v1.1):
   ```json
   "prerequisites": ["order_1", "order_2"]  // Lessons that must be completed first
   ```

2. **Difficulty Rating** (v1.1):
   ```json
   "difficulty": "introductory" | "intermediate" | "advanced"
   ```

3. **Scottish Context Constraints** (v1.2):
   ```json
   "scottish_context_requirements": {
     "mandatory_contexts": ["scotrail"],
     "forbidden_contexts": ["london-underground"]
   }
   ```

---

## Related Documentation

- [Lesson Template Schema](./lesson_template_schema.md) - Output format for lesson authoring
- [Lesson Critic Result Schema](./lesson_critic_result_schema.md) - Validation output using SOW requirements
- [SOW Extractor Source Code](../src/utils/sow_extractor.py) - Python extraction implementation
- [SOW Author README](../README.md#sow-author) - How to create SOW entries
- [Lesson Author README](../LESSON_AUTHOR_README.md) - End-to-end usage guide

---

**Version**: 1.0
**Last Updated**: October 2025
**Maintained By**: Lesson Author Agent Documentation
