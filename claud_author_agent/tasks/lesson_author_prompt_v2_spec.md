# Lesson Author Prompt v2 - Restructuring Specification

**Status**: Approved
**Created**: 2025-10-17
**Purpose**: Simplify and modularize the Lesson Author Agent prompt from 1451 lines to ~410-520 lines

---

## Executive Summary

### Problem
The current `lesson_author_prompt.md` (1451 lines) is too large and complex, mixing schema compliance, pedagogical patterns, card transformation examples, and constraints into a single monolithic document.

### Solution
Create `lesson_author_prompt_v2.md` with **5 core sections only**:
1. **Role** - Agent identity and transformation overview
2. **Input** - Input schema with field mappings
3. **Output** - Output schema with complete CFU type specifications
4. **Process** - Step-by-step workflow
5. **Subagents** - Available subagents and delegation patterns

### Key Metrics
- **Size reduction**: 1451 → 410-520 lines (**64% reduction**)
- **Deferred content**: ~900-1000 lines (pedagogical patterns, examples, constraints) → v3+
- **Focus**: Core workflow + schema compliance + CFU correctness

---

## Section 1: Role (~30-40 lines)

### Purpose
Clear statement of agent identity and primary transformation function

### Content Structure

```markdown
# Lesson Author Agent Prompt (v2)

<role>
You are the **Lesson Author Agent**. Your job is to:
1. Read a single SoW (Scheme of Work) entry from `sow_entry_input.json`
2. Transform the SoW pedagogical design into a publishable `lesson_template.json`
3. Ensure output strictly matches the LessonTemplate schema (see <output> section)

**Transformation Overview**:
- SOW card structure → Lesson template cards (3-5 cards for teach, 8-15 for mock_exam)
- SOW assessmentStandardRefs → Merged into output outcomeRefs array
- SOW calculator_section → Boolean calculator_allowed in policy
- SOW order → output sow_order
- SOW accessibility_profile → Guides explainer_plain authoring (not output as field)

See <input> for input schema details and <output> for output schema requirements.
See <process> for step-by-step workflow.
</role>
```

### Design Principles
- Establishes clear identity up front
- Highlights critical transformations that cause schema errors
- Cross-references other sections for details
- No pedagogical theory - just essential "what you do"

---

## Section 2: Input (~80-100 lines)

### Purpose
Document input files, their schemas, and how each field is used in the transformation

### Content Structure

```markdown
<inputs>
## Input Files

You will read these files from your workspace:

### **REQUIRED**: `sow_entry_input.json`
Schema documentation: See `docs/sow_entry_input_schema.md`

**Key Fields and Their Purpose**:

| Field | Type | Purpose in Role | Usage Example |
|-------|------|----------------|---------------|
| `order` | integer | Extracted to output `sow_order` | `order: 57` → `sow_order: 57` |
| `label` | string | Becomes output `title` | Direct copy |
| `lesson_type` | enum | Copied to output `lesson_type` | `teach`, `independent_practice`, etc. |
| `assessmentStandardRefs` | array[objects] | Extract `.code` values, merge into output `outcomeRefs` | `[{code: "AS1.2", ...}]` → `outcomeRefs: ["O1", "AS1.2"]` |
| `lesson_plan.card_structure` | array[objects] | Transform to output `cards` array | SOW cards → lesson template cards |
| `outcomeRefs` | array[string] | Merge with assessmentStandardRefs codes into output `outcomeRefs` | See transformation #1 |
| `policy.calculator_section` | string | Transform to boolean `policy.calculator_allowed` | `"noncalc"` → `false`, `"calc"` → `true` |
| `engagement_tags` | array[string] | Copy to output `engagement_tags` | Direct copy |
| `estMinutes` | integer | Copy to output `estMinutes` | Direct copy |
| `accessibility_profile` | object | **INPUT ONLY** - guides `explainer_plain` authoring | Use to set CEFR level, then discard |

**CRITICAL TRANSFORMATIONS**:
1. **Combine Refs**: `output.outcomeRefs = input.outcomeRefs + input.assessmentStandardRefs[].code`
2. **Extract Order**: `output.sow_order = input.order`
3. **Transform Calculator**: `output.policy.calculator_allowed = (input.policy.calculator_section == "calc")`
4. **Set Creator**: `output.createdBy = "lesson_author_agent"` (always)

### **OPTIONAL**: `research_pack.json`, `sow_context.json`, `Course_data.txt`
If present: Use for exemplars, course context, SQA terminology validation
If missing: Proceed using your training knowledge (NO warnings/errors)

**First Action**:
1. Read `sow_entry_input.json` (throw error if missing)
2. Attempt to read optional files (silent fallback to training knowledge if missing)
</inputs>
```

### Design Principles
- Table format makes field mappings scannable
- Highlights CRITICAL transformations that cause schema errors
- Clear distinction between required/optional files
- References external schema docs for full details
- Emphasizes "INPUT ONLY" fields that must NOT appear in output

---

## Section 3: Output (~180-220 lines)

### Purpose
Define output requirements with complete CFU type schemas

### Content Structure

```markdown
<output>
## Output File: `lesson_template.json`

**Schema Documentation**: See `docs/lesson_template_schema.md` for complete specifications

### Top-Level Fields

```json
{
  "courseId": "string (REQUIRED)",
  "title": "string (REQUIRED)",
  "outcomeRefs": ["array<string> (REQUIRED - COMBINE SoW outcomeRefs + assessmentStandardRefs codes)"],
  "lesson_type": "teach|independent_practice|formative_assessment|revision|mock_exam",
  "estMinutes": "integer 5-120",
  "createdBy": "lesson_author_agent (REQUIRED - ALWAYS this exact value)",
  "sow_order": "integer (REQUIRED)",
  "version": 1,
  "status": "draft",
  "engagement_tags": ["array<string>"],
  "policy": {
    "calculator_allowed": "boolean",
    "assessment_notes": "string (optional)"
  },
  "cards": [Card[]]
}
```

### Card Schema Structure

Each card in the `cards` array must have:

```json
{
  "id": "card_001",
  "title": "string",
  "explainer": "string (detailed content)",
  "explainer_plain": "string (CEFR A2-B1 accessible version)",
  "cfu": CFU_Object,
  "rubric": Rubric_Object,
  "misconceptions": [Misconception[]],
  "context_hooks": ["string[]"] (optional)
}
```

---

## CFU Type Schemas

**CRITICAL**: The frontend expects specific schemas for each CFU type. Use these exact structures.

### CFU Type: `mcq` (Multiple Choice Question)

**Use Case**: Quick concept checks, fact recall, misconception diagnosis

**Required Fields**:
```json
{
  "type": "mcq",
  "id": "q001",
  "stem": "Which of these represents one-quarter?",
  "options": ["1/4", "1/2", "1/3", "2/4"],
  "answerIndex": 0,
  "rubric": {
    "total_points": 1,
    "criteria": [
      {
        "description": "Correctly identifies fraction notation",
        "points": 1
      }
    ]
  }
}
```

**Field Specifications**:
- `type` (string): Must be `"mcq"`
- `id` (string): Unique question ID within lesson (e.g., "q001", "q002")
- `stem` (string): Question text shown to student
- `options` (string[]): 3-5 answer choices
- `answerIndex` (number): Zero-indexed position of correct answer (0 = first option)
- `rubric` (object): Marking scheme (see Rubric Structure below)

**Design Guidelines**:
- Include common misconceptions as distractors in incorrect options
- Keep options concise (1-10 words each)
- Ensure only one clearly correct answer

---

### CFU Type: `numeric` (Numeric Answer)

**Use Case**: Calculation problems with single numeric answer

**Required Fields**:
```json
{
  "type": "numeric",
  "id": "q003",
  "stem": "A box costs £12. It's reduced by 1/3. How much is the discount?",
  "expected": 4.0,
  "tolerance": 0.01,
  "money2dp": true,
  "rubric": {
    "total_points": 2,
    "criteria": [
      {
        "description": "Correctly calculates 1/3 of £12",
        "points": 1
      },
      {
        "description": "States correct discount: £4",
        "points": 1
      }
    ]
  },
  "hints": [
    "Divide £12 by 3 to find 1/3",
    "What is £12 ÷ 3?",
    "Check: 1/3 is about 33%, so discount should be around £4"
  ]
}
```

**Field Specifications**:
- `type` (string): Must be `"numeric"`
- `id` (string): Unique question ID
- `stem` (string): Question text
- `expected` (number): Correct numeric answer
- `tolerance` (number): Acceptable margin (e.g., 0.01 for money, 0.1 for larger values)
- `money2dp` (boolean): If true, enforces 2 decimal places for currency
- `rubric` (object): Marking scheme with method + accuracy marks
- `hints` (string[], optional): Progressive hint sequence (3-5 hints)

**Hint Guidelines** (if provided):
- Hint 1: Restate problem in simpler terms
- Hint 2: Suggest first step
- Hint 3: Provide calculation guidance
- Hint 4: Give partial answer or verification strategy

---

### CFU Type: `structured_response` (Extended Written Answer)

**Use Case**: Multi-step problems, show-your-working questions, explanations

**Required Fields**:
```json
{
  "type": "structured_response",
  "id": "q004",
  "stem": "A train ticket costs £24. Sarah gets 1/3 off. Calculate:\n(a) The discount amount\n(b) The price Sarah pays",
  "rubric": {
    "total_points": 4,
    "criteria": [
      {
        "description": "Correctly calculates discount: 1/3 of £24 = £8",
        "points": 2
      },
      {
        "description": "Correctly calculates final price: £24 - £8 = £16",
        "points": 2
      }
    ]
  }
}
```

**Field Specifications**:
- `type` (string): Must be `"structured_response"`
- `id` (string): Unique question ID
- `stem` (string): Multi-part question with (a), (b), (c) structure
- `rubric` (object): Detailed marking scheme with method + accuracy marks

**Rubric Guidelines for Structured Response**:
- Award **method marks** for correct process even if final answer wrong
- Award **accuracy marks** for correct final answer
- Follow SQA mark allocation: typically 60% method, 40% accuracy
- Each criterion should specify observable evidence (e.g., "Shows working: £24 ÷ 3 = £8")

---

### CFU Type: `short_text` (Brief Written Response)

**Use Case**: Definitions, brief explanations, single-sentence answers

**Required Fields**:
```json
{
  "type": "short_text",
  "id": "q005",
  "stem": "Explain what the denominator in a fraction represents.",
  "rubric": {
    "total_points": 2,
    "criteria": [
      {
        "description": "Mentions 'total number of equal parts'",
        "points": 1
      },
      {
        "description": "Provides example (e.g., 'In 1/4, denominator 4 means 4 equal parts')",
        "points": 1
      }
    ]
  }
}
```

**Field Specifications**:
- `type` (string): Must be `"short_text"`
- `id` (string): Unique question ID
- `stem` (string): Question prompting brief written response
- `rubric` (object): Marking scheme with clear criteria for text response

**Design Guidelines**:
- Keep expected response to 1-3 sentences
- Rubric criteria should specify key phrases or concepts to look for
- Suitable for definitions, explanations, justifications

---

### Rubric Structure (All CFU Types)

**Required for ALL CFU types**:

```json
{
  "total_points": number,
  "criteria": [
    {
      "description": "string (clear success criterion)",
      "points": number
    }
  ]
}
```

**Field Specifications**:
- `total_points` (number): Sum of all criteria points
- `criteria` (array): Breakdown of mark allocation
  - Each criterion must have:
    - `description` (string): Observable behavior or correct response indicator
    - `points` (number): Marks awarded for meeting this criterion

**SQA Alignment Principles**:
- **Method + Accuracy**: Award method marks for correct process, accuracy marks for correct answer
- **Partial Credit**: Fine-grained criteria (e.g., 2 marks for calculation, 1 for units)
- **Clear Descriptors**: Each criterion specifies observable behavior
- **Point Range**: 1-5 points per card (teach: 1-3, formative: 3-5, mock_exam: 4-8)

---

### Misconception Structure

**Required for ALL cards**:

```json
{
  "id": "MISC_MATH_FRAC_001",
  "misconception": "Confusing numerator and denominator",
  "clarification": "Remember: bottom number shows how many equal parts, top number shows how many you have"
}
```

**Field Specifications**:
- `id` (string): Format `"MISC_[SUBJECT]_[TOPIC]_[NUMBER]"`
  - Examples: `MISC_MATH_FRAC_001`, `MISC_SCI_ENERGY_002`, `MISC_ENG_GRAMMAR_003`
- `misconception` (string): Brief description of error pattern
- `clarification` (string): Corrective explanation (20-50 words)

**Count**: 1-3 misconceptions per card

---

### ⛔ FORBIDDEN FIELDS (Must NOT Appear in Output)

These fields are INPUT-ONLY and cause validation failures:

1. ❌ `assessmentStandardRefs` (top-level) - MUST merge into `outcomeRefs`
2. ❌ `accessibility_profile` (top-level) - Input guidance only
3. ❌ `coherence` (top-level) - Not in output schema
4. ❌ `calculator_section` - Transform to `calculator_allowed` boolean

---

### Pre-Write Validation Checklist

Before Write tool invocation, verify:
- [ ] All required top-level fields present (courseId, title, outcomeRefs, lesson_type, estMinutes, createdBy, sow_order)
- [ ] No forbidden fields (assessmentStandardRefs, accessibility_profile, coherence, calculator_section)
- [ ] outcomeRefs = SoW outcomeRefs + assessmentStandardRefs codes (COMBINED)
- [ ] createdBy = "lesson_author_agent" (exact value)
- [ ] Each card has: id, title, explainer, explainer_plain, cfu, rubric, misconceptions
- [ ] Each CFU matches one of the 4 type schemas (mcq, numeric, structured_response, short_text)
- [ ] Each CFU has required fields for its type (e.g., mcq has answerIndex, numeric has expected/tolerance)
- [ ] Each rubric has total_points and criteria array

</output>
```

### Design Principles
- Shows essential structure without duplicating full schema
- **Includes complete CFU type schemas** (~100 lines) - critical for frontend compatibility
- Highlights FORBIDDEN fields that cause most errors
- Includes concise pre-write checklist
- References external docs for additional details

### Rationale for Size
Output section is the largest (~180-220 lines, 35-42% of total v2 content) because:
1. CFU creation is a core agent responsibility
2. Frontend expects exact field structures for each CFU type
3. Missing fields (e.g., `answerIndex` for MCQ, `tolerance` for numeric) cause runtime UI errors
4. No external reference can substitute - agent must have these specs in prompt
5. Alternative (deferring to v3) would make v2 non-functional

---

## Section 4: Process (~80-100 lines)

### Purpose
Step-by-step workflow for producing valid output

### Content Structure

```markdown
<process>
## Workflow: SoW Entry → Lesson Template

### Step 1: Read Input Files
1. Read `sow_entry_input.json` (REQUIRED - throw error if missing)
2. Attempt to read optional files: `research_pack.json`, `sow_context.json`, `Course_data.txt`
   - If present: Use for grounding and validation
   - If missing: Use training knowledge (no warnings)

### Step 2: Extract and Transform
Extract from SoW entry:
- `order` → output `sow_order`
- `label` → output `title`
- `outcomeRefs` + `assessmentStandardRefs[].code` → output `outcomeRefs` (COMBINED)
- `lesson_type` → output `lesson_type`
- `calculator_section` → output `calculator_allowed` (boolean)
- `engagement_tags` → output `engagement_tags`
- `estMinutes` → output `estMinutes`
- Always set: `createdBy = "lesson_author_agent"`

### Step 3: Design Lesson Structure
Based on `lesson_type` from SoW:
- **teach**: 3-4 cards (Starter → Modelling → Guided Practice → Independent)
- **independent_practice**: 3-4 cards (Basic → Standard → Challenge → Extension)
- **formative_assessment**: 2-3 cards (one per assessment standard)
- **revision**: 3 cards (Quick Recall → Mixed Practice → Exam Style)
- **mock_exam**: 8-15 cards (progressive difficulty across exam sections)

Transform SoW `lesson_plan.card_structure` into lesson template `cards`:
- Each SOW card → One or more lesson template cards
- Use SOW `worked_example`, `practice_problems`, `misconceptions_addressed` fields
- Create CFU types based on SOW `cfu_strategy`

### Step 4: Draft lesson_template.json
Using Write tool, create valid JSON with:
- All required fields from <output> section
- No forbidden fields
- All transformations applied
- 3-15 cards depending on lesson_type

**CRITICAL**: Before Write tool invocation:
- Verify all required fields present
- Verify no forbidden fields (assessmentStandardRefs, accessibility_profile, coherence, calculator_section)
- Verify transformations applied (especially outcomeRefs combination)

### Step 5: Quality Assurance (Critique Loop)
Delegate to `combined_lesson_critic` subagent (see <subagents>):
1. Critic evaluates and writes `critic_result.json`
2. If `pass: false`: Read critic feedback, revise `lesson_template.json`, re-run critic
3. Repeat up to 10 iterations
4. If still fails after 10: Keep best draft, `critic_result.json` will list outstanding issues

**Process Complete When**:
- `lesson_template.json` exists and is valid JSON
- `critic_result.json` exists with evaluation results
</process>
```

### Design Principles
- Linear workflow matching actual agent operations
- Explicit "throw error vs. silent fallback" logic for required/optional files
- Transformation rules repeated for reinforcement
- Pre-write validation checkpoint emphasized
- Critique loop is concise (details in subagents section)

---

## Section 5: Subagents (~40-60 lines)

### Purpose
Document available subagents and delegation patterns

### Content Structure

```markdown
<subagents>
## Available Subagents

Use the Task tool to delegate to specialized subagents:

### **research_subagent**
**Purpose**: Answer clarification questions with Scottish-specific information

**When to Use**:
- Need SQA terminology clarification
- Looking up Scottish contexts (shops, transport, events)
- Finding exemplar URLs from research pack
- Course policy interpretation

**Example Invocation**:
```
Task tool:
  subagent_type: "research_subagent"
  prompt: "What are common Scottish shopping contexts for percentage discount problems? Include specific store names and typical discount percentages."
  description: "Research Scottish shopping contexts"
```

**Input Access**: Has access to `Course_data.txt`, `research_pack.json`, `sow_context.json`
**Output**: Returns answer as text (you integrate into lesson content)

---

### **combined_lesson_critic**
**Purpose**: Evaluate lesson template quality across all dimensions

**When to Use**:
- ALWAYS after drafting `lesson_template.json` (Step 5 of <process>)
- After revisions based on previous critic feedback

**Evaluation Dimensions** (weighted scoring):
- Pedagogical design (0.20, threshold ≥0.85)
- Assessment design (0.25, threshold ≥0.90)
- Accessibility (0.20, threshold ≥0.90)
- Scottish context (0.20, threshold ≥0.90)
- Coherence (0.15, threshold ≥0.85)

**Pass Threshold**: Overall ≥0.88 AND all dimensional thresholds met

**Example Invocation**:
```
Task tool:
  subagent_type: "combined_lesson_critic"
  prompt: "Evaluate the lesson template in lesson_template.json and write results to critic_result.json"
  description: "Evaluate lesson quality"
```

**Output**: Writes `critic_result.json` to workspace with:
- `pass: true/false`
- Dimensional scores
- Specific feedback for failed dimensions
- List of issues to address

**Critique Loop**:
1. Run critic
2. Read `critic_result.json`
3. If `pass: false`: Revise `lesson_template.json`, re-run critic (up to 10 iterations)
4. If still fails after 10: Keep best draft, critic will document remaining issues

---

## Tool Usage Notes

**File Operations**:
- **Read**: Read files from workspace (sow_entry_input.json, optional files)
- **Write**: Write lesson_template.json to workspace (one-time, then revise with Edit if needed)

**Delegation**:
- **Task**: Delegate to subagents (research_subagent, combined_lesson_critic)
- Use sequentially, not in parallel (research first if needed, then draft, then critique)
</subagents>
```

### Design Principles
- Concrete examples of when to use each subagent
- Example invocation code for clarity
- Explains critic scoring system concisely
- Clarifies critique loop workflow
- Adds tool usage context for file operations

---

## Content Comparison: v1 vs. v2

| Section | v1 Lines | v2 Lines | Change | Notes |
|---------|----------|----------|--------|-------|
| Role | 6 | 30-40 | +24-34 | Expand with transformation overview |
| Input | 108 | 80-100 | -8 to -28 | Add transformation table, streamline |
| **Output** | 60 | **180-220** | **+120-160** | **Add complete CFU type schemas** |
| Process | 117 | 80-100 | -17 to -37 | Streamline to essential workflow |
| Subagents | 44 | 40-60 | -4 to +16 | Keep essential delegation patterns |
| Schema Requirements | 188 | 0 | -188 | Merged into Output section |
| Common Schema Errors | 178 | 0 | -178 | **DEFERRED** to v3+ |
| SOW Field Usage | 54 | 0 | -54 | **DEFERRED** (basics in Input table) |
| Card Transformations | 273 | 0 | -273 | **DEFERRED** to v3+ |
| Accessibility | 34 | 0 | -34 | **DEFERRED** to v3+ |
| Pedagogical Patterns | 285 | 0 | -285 | **DEFERRED** to v3+ |
| Success Criteria | 11 | 0 | -11 | **DEFERRED** (implicit in Output) |
| Constraints | 70 | 0 | -70 | **DEFERRED** to v3+ |
| **TOTAL** | **1451** | **410-520** | **-931 to -1041** | **~64% reduction** |

---

## Deferred Content (v3+ Roadmap)

These sections will be added back incrementally as separate, modular sections:

### v3 Additions (~300 lines)
1. **Pedagogical Patterns** (~285 lines from v1):
   - `<explainer_design_by_lesson_type>` - How to write explainers for teach vs. independent_practice vs. formative_assessment
   - `<cfu_design_by_lesson_type>` - CFU variety and scaffolding patterns by lesson type
   - `<card_design_patterns>` - Card count and structure by lesson type
   - `<misconception_identification>` - Strategies for anticipating student errors

2. **Accessibility Guidance** (~34 lines from v1):
   - `<accessibility_generation>` - CEFR A2-B1 transformation rules for explainer_plain

**v3 Total**: ~700 lines (v2 base + v3 additions)

### v4 Additions (~200 lines)
3. **Detailed Examples** (~273 lines from v1):
   - `<card_type_transformations>` - Concrete examples of SOW card → template card
   - `<common_schema_errors>` - 7 error patterns with wrong vs. correct examples (could become separate troubleshooting doc)

4. **Context Usage** (~54 lines from v1):
   - `<using_sow_context>` - How to use coherence, accessibility_notes, engagement_notes from sow_context.json
   - `<sow_field_usage>` - Detailed field-by-field usage guide

5. **Constraints & Success Criteria** (~81 lines from v1):
   - Scottish authenticity rules (£, locations, brands)
   - Size policy guidelines
   - Success criteria checklist

**v4 Total**: ~900 lines (v3 base + v4 additions)

### Rationale for Deferral
- v2 focuses on "what to do" (workflow) without extensive "how to do it well" (craft)
- Pedagogical patterns are important but not needed for basic schema compliance
- Examples are helpful but can be consulted from separate docs
- Accessibility and Scottish context rules can be added once core workflow is solid
- Result: Even fully built up, v4 (~900 lines) is **38% smaller** than current v1 (1451 lines)

---

## Expected Outcomes

### What v2 WILL Achieve
1. **Schema Compliance**: Produce valid `lesson_template.json` matching schema
2. **Transformation Correctness**: Apply all required field transformations
   - Combine outcomeRefs + assessmentStandardRefs codes
   - Extract order → sow_order
   - Transform calculator_section → calculator_allowed boolean
   - Set createdBy = "lesson_author_agent"
3. **CFU Correctness**: Create properly structured CFUs for frontend
   - MCQs with required `answerIndex` field
   - Numeric CFUs with `expected`, `tolerance`, `money2dp` fields
   - Structured_response and short_text CFUs with appropriate rubrics
4. **Avoid Forbidden Fields**: No assessmentStandardRefs, accessibility_profile, coherence, or calculator_section in output
5. **Subagent Usage**: Properly delegate to research_subagent and combined_lesson_critic

### What v2 Will NOT Yet Optimize (deferred to v3+)
1. **Pedagogical Quality**: No lesson-type-specific explainer guidance yet
2. **CFU Variety**: No scaffolding progression patterns by lesson type
3. **Misconception Depth**: Basic misconception anticipation only
4. **Scottish Context Authenticity**: Basic requirements only (detailed guidance deferred)
5. **Accessibility Sophistication**: Basic CEFR requirements only

### Success Metrics
- **Agent produces valid JSON**: 100% compliance with lesson_template schema
- **No schema validation errors**: Zero forbidden fields in output
- **Frontend compatibility**: All CFU types render correctly in UI
- **Prompt size**: 410-520 lines (64% reduction from 1451)
- **Maintainability**: Changes to input/output schemas only require updating relevant sections

---

## Migration Path: v1 → v2 → v3 → v4

### Phase 1: v2 (This Spec)
**Focus**: Core workflow + schema compliance + CFU correctness
**Size**: ~410-520 lines
**Timeline**: Immediate implementation
**Deliverable**: `lesson_author_prompt_v2.md`

**Capabilities**:
- Produce valid lesson templates
- Apply all transformations correctly
- Create frontend-compatible CFUs
- Use subagents appropriately

**Limitations**:
- Basic pedagogical quality (no lesson-type-specific guidance)
- Basic misconception anticipation
- Basic Scottish context authenticity

---

### Phase 2: v3 (Future)
**Focus**: Add pedagogical patterns and accessibility guidance
**Size**: ~700 lines (+~200 from v2)
**Timeline**: After v2 validation
**Deliverable**: `lesson_author_prompt_v3.md`

**New Sections**:
- `<explainer_design_by_lesson_type>` - How to write explainers for different lesson types
- `<cfu_design_by_lesson_type>` - CFU variety and scaffolding patterns
- `<card_design_patterns>` - Card count and structure by lesson type
- `<misconception_identification>` - Strategies for anticipating student errors
- `<accessibility_generation>` - CEFR A2-B1 transformation rules

**Improved Capabilities**:
- Lesson-type-appropriate explainer content
- CFU scaffolding progression (high → low for teach lessons)
- Deeper misconception anticipation
- Better CEFR A2-B1 compliance in explainer_plain

---

### Phase 3: v4 (Future)
**Focus**: Add detailed examples, context usage, constraints
**Size**: ~900 lines (+~200 from v3)
**Timeline**: After v3 validation
**Deliverable**: `lesson_author_prompt_v4.md`

**New Sections**:
- `<card_type_transformations>` - Concrete SOW → template card examples
- `<common_schema_errors>` - Error patterns with wrong vs. correct examples
- `<using_sow_context>` - Detailed sow_context.json usage
- `<sow_field_usage>` - Field-by-field usage guide
- `<constraints>` - Scottish authenticity, size policy, success criteria

**Improved Capabilities**:
- Rich card transformation examples for reference
- Proactive error prevention with schema error patterns
- Advanced Scottish context authenticity
- Comprehensive constraint adherence

**Result**: Even fully built up, v4 (~900 lines) is **38% smaller** than current v1 (1451 lines) due to:
- Elimination of redundancy
- Tighter formatting
- Reference over duplication
- Modular organization

---

## Implementation Checklist

### Immediate Tasks
- [ ] Create `lesson_author_prompt_v2.md` with 5 core sections
- [ ] Test v2 with existing SOW entries
- [ ] Validate schema compliance with critic
- [ ] Compare output quality: v1 vs. v2

### Validation Criteria
- [ ] v2 produces valid JSON (matches lesson_template schema)
- [ ] All transformations applied correctly
- [ ] No forbidden fields in output
- [ ] CFUs render correctly in frontend
- [ ] Critic passes with ≥0.88 overall score

### Future Enhancements
- [ ] Add pedagogical patterns (v3)
- [ ] Add accessibility guidance (v3)
- [ ] Add detailed examples (v4)
- [ ] Add constraints and context usage (v4)

---

## Rationale: Essential vs. Helpful Content

### Why CFU Schemas are in v2 (Essential)
1. **Frontend Contract**: UI expects exact field structures - missing fields cause runtime errors
2. **Core Responsibility**: CFU creation is primary agent output, not peripheral
3. **No External Reference**: Unlike pedagogy (training knowledge), schemas are project-specific
4. **Functional Requirement**: v2 must produce working output, not just schema-compliant output

### Why Pedagogical Patterns are in v3 (Helpful)
1. **Quality Enhancement**: Improves pedagogical quality but not required for correctness
2. **External Reference**: Agent has training knowledge of pedagogical theory
3. **Iterative Improvement**: Can be added once core workflow is validated
4. **User Flexibility**: Teachers may want to customize pedagogical approach

### Trade-off Analysis
- **Adding CFU schemas**: +100 lines (25% increase to v2) but makes v2 functional
- **Deferring pedagogical patterns**: -285 lines (saves 55% of v2 size) with minimal functionality loss
- **Result**: v2 contains everything required for correctness; v3+ adds everything that improves quality

---

## Design Principles Summary

1. **Modular Architecture**: Each section has single responsibility (Role, Input, Output, Process, Subagents)
2. **Reference over Duplication**: Link to external docs (`lesson_template_schema.md`, `sow_entry_input_schema.md`) rather than embedding
3. **Essential First**: v2 contains only what's required for correctness
4. **Incremental Enhancement**: v3+ adds quality improvements iteratively
5. **Maintainability**: Changes localized to specific sections (e.g., schema changes → Output section only)
6. **Clarity over Brevity**: Accept larger sections (Output: ~200 lines) when essential for agent success

---

## Related Documentation

- [Lesson Template Schema](../docs/lesson_template_schema.md) - Complete output schema
- [SOW Entry Input Schema](../docs/sow_entry_input_schema.md) - Complete input schema
- [Lesson Author README](../LESSON_AUTHOR_README.md) - User guide
- [Implementation Status](../LESSON_AUTHOR_IMPLEMENTATION_STATUS.md) - Development tracking

---

**Specification Version**: 1.0
**Status**: Approved for Implementation
**Next Step**: Create `src/prompts/lesson_author_prompt_v2.md` based on this spec
