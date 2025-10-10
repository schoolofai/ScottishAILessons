# Lesson Type Differentiation Specification

## Overview

This specification defines how the Lesson Author Agent should differentiate pedagogical card content based on lesson type. The goal is to ensure that explainers, CFUs, and scaffolding align with the instructional purpose of each lesson type.

## Problem Statement

Currently, the Lesson Author Agent produces similar card structures regardless of lesson type:
- **teach** lessons lack comprehensive ground-up explanations with worked examples
- **revision** lessons provide full re-teaching instead of concise memory triggers
- **independent_practice** lessons include unnecessary scaffolding
- **formative_assessment** lessons may include teaching content instead of pure assessment
- Size constraints (max 8000 chars for cards) artificially limit pedagogical quality

## Solution: Lesson-Type-Specific Design Patterns

### 1. TEACH Lessons

**Purpose**: Build understanding from foundational concepts for NEW material

#### Explainer Structure:
- **START** with prerequisite knowledge check or hook question
- **INTRODUCE** concept definition with clear terminology
- **PROVIDE** step-by-step worked examples with reasoning ("why" not just "how")
- **BREAK DOWN** each step with pedagogical commentary
- **USE** scaffolding: concrete examples → abstract principles
- **LENGTH**: Comprehensive (200-400 words for complex concepts)

#### CFU Purpose:
Formative checks to confirm understanding during instruction
- Questions should mirror worked examples (near transfer)
- Test conceptual understanding, not just procedures
- Include "explain your reasoning" or "show your working" prompts
- Scaffolding present but gradually reduced across cards

#### Card Structure:
1. **Card 1 (Starter - Retrieval/Hook)**
   - Explainer: Brief hook or prior knowledge activation (50-100 words)
   - CFU: Easy recall from previous lessons or engaging scenario
   - Scaffolding: High (MCQ or short answer)

2. **Card 2 (Modelling - I Do)**
   - Explainer: Full worked example with step-by-step reasoning (250-400 words)
   - CFU: Question mirroring the worked example with slight variation
   - Scaffolding: High (worked example visible, hints available)

3. **Card 3 (Guided Practice - We Do)**
   - Explainer: Abbreviated example or method summary (100-200 words)
   - CFU: Similar problem with reduced scaffolding
   - Scaffolding: Medium (hints available but less detailed)

4. **Card 4 (Independent Practice - You Do)**
   - Explainer: Brief reminder of key steps (50-100 words)
   - CFU: Real-world application requiring full independent solution
   - Scaffolding: Low/None (authentic application)

#### Example Card 2 (Modelling):
```
Title: "Calculating Fractions of Amounts - Worked Example"

Explainer (350 words):
"In this card, we'll learn how to calculate fractions of amounts. This skill is essential for solving problems involving discounts, portions, and distributions.

**What does 'fraction of' mean?**
When we say '3/4 of £80', we're asking: 'What is 3 parts out of 4 equal parts of £80?'

**Method:**
To calculate a fraction of an amount, we use two operations:
1. MULTIPLY the amount by the NUMERATOR (top number)
2. DIVIDE the result by the DENOMINATOR (bottom number)

**Why does this work?**
- Dividing by the denominator splits the amount into equal parts
- Multiplying by the numerator gives us the number of parts we want
- But multiplication first is easier for whole numbers!

**Worked Example: Calculate 3/4 of £80**

Step 1: Multiply £80 by the numerator (3)
£80 × 3 = £240

Why? We're taking 3 groups of the full amount first.

Step 2: Divide £240 by the denominator (4)
£240 ÷ 4 = £60

Why? This gives us 3 out of 4 equal parts.

**Check your answer:**
Does £60 make sense?
- 1/4 of £80 = £20 (£80 ÷ 4)
- 3/4 should be three times bigger: £20 × 3 = £60 ✓

**Key Points to Remember:**
• Multiply by TOP number (numerator)
• Divide by BOTTOM number (denominator)
• Always show your working
• Check if your answer makes sense"

CFU:
{
  "type": "numeric",
  "id": "q_teach_fractions_01",
  "stem": "A shop offers 2/5 off a £150 jacket. Calculate the discount amount. Show all your working.",
  "expected": 60,
  "tolerance": 0.01,
  "money2dp": true
}

Rubric:
{
  "total_points": 3,
  "criteria": [
    {"description": "Multiply £150 by numerator (2)", "points": 1},
    {"description": "Divide result by denominator (5)", "points": 1},
    {"description": "Correct answer with units (£60)", "points": 1}
  ]
}

Misconceptions:
[
  {
    "id": "MISC_MATH_FRACTIONS_ORDER",
    "misconception": "Student divides first, then multiplies (£150 ÷ 5 × 2 = £60) - gets correct answer but may fail with decimals",
    "clarification": "While order doesn't matter here, ALWAYS multiply first to avoid decimals: £150 × 2 = £300, then £300 ÷ 5 = £60"
  },
  {
    "id": "MISC_MATH_FRACTIONS_PERCENT",
    "misconception": "Student confuses fractions with percentages (2/5 = 25% instead of 40%)",
    "clarification": "Convert fraction to percentage: 2/5 = 0.4 = 40%, not 25%"
  }
]
```

### 2. INDEPENDENT_PRACTICE Lessons

**Purpose**: Apply previously taught skills to build fluency and automaticity

#### Explainer Structure:
- **BRIEF** reminder of key method/formula (1-2 sentences)
- **NO** worked examples (students should recall from teach lesson)
- **OPTIONAL**: Quick reference to common mistakes
- **LENGTH**: Minimal (50-100 words)

#### CFU Purpose:
Fluency building through repetition and varied contexts
- Progressive difficulty across cards (basic → standard → challenge → extension)
- Variety of contexts to promote generalization
- Focus on accuracy and efficiency
- NO scaffolding or hints (students practice recall)

#### Card Structure:
1. **Card 1 (Basic Practice)** - Straightforward application, simple numbers
2. **Card 2 (Standard Practice)** - Typical difficulty with varied contexts
3. **Card 3 (Challenge Practice)** - Higher difficulty, multi-step, or unusual contexts
4. **Card 4 (Extension - Optional)** - Real-world application or connection to other topics

#### Example Card 2 (Standard Practice):
```
Title: "Fractions of Amounts - Standard Practice"

Explainer (75 words):
"Calculate fractions of amounts using the method from Lesson 3. Remember the two-step process: multiply by the numerator, then divide by the denominator. Show all working and include units in your answer."

CFU:
{
  "type": "numeric",
  "id": "q_practice_fractions_02",
  "stem": "A council's £2.4 million budget allocates 5/8 to education. Calculate the education budget in millions.",
  "expected": 1.5,
  "tolerance": 0.01
}

Rubric:
{
  "total_points": 2,
  "criteria": [
    {"description": "Correct method applied (multiply then divide)", "points": 1},
    {"description": "Accurate answer with units (£1.5 million)", "points": 1}
  ]
}

Misconceptions:
[
  {
    "id": "MISC_MATH_FRACTIONS_UNITS",
    "misconception": "Student forgets to include units (writes 1.5 instead of £1.5 million)",
    "clarification": "Always include units in your final answer - the question specifies 'in millions'"
  }
]
```

### 3. FORMATIVE_ASSESSMENT Lessons

**Purpose**: Diagnose mastery of assessment standards for reporting

#### Explainer Structure:
- **NO** teaching content (this is assessment, not instruction)
- **BRIEF** task instructions only
- **REFERENCE** the assessment standard being tested
- **LENGTH**: Minimal (30-50 words)

#### CFU Purpose:
Provide evidence of assessment standard mastery
- Align precisely with assessment standard criteria from Course_data.txt
- No hints or scaffolds (authentic assessment conditions)
- Match SQA question style and difficulty level
- Rubrics must match SQA marking schemes

#### Card Structure:
1-3 cards, each targeting a specific assessment standard
- One CFU per assessment standard
- Authentic assessment conditions
- SQA-style wording and contexts

#### Example Card 1 (Assessment):
```
Title: "Assessment: AS1.2 - Calculate Fractions of Quantities"

Explainer (45 words):
"This question assesses Assessment Standard 1.2: Calculate fractions of quantities in real-world contexts. Read the question carefully, show all working, and include units in your answer."

CFU:
{
  "type": "structured",
  "id": "q_assess_fractions_01",
  "stem": "A school receives a £180,000 grant. They spend 2/9 on IT equipment, 5/12 on building repairs, and the rest on staff training. Calculate: (a) The amount spent on IT equipment (b) The amount spent on building repairs (c) The fraction spent on staff training",
  "parts": [
    {
      "id": "q_assess_fractions_01a",
      "label": "(a)",
      "expected": "40000",
      "type": "numeric"
    },
    {
      "id": "q_assess_fractions_01b",
      "label": "(b)",
      "expected": "75000",
      "type": "numeric"
    },
    {
      "id": "q_assess_fractions_01c",
      "label": "(c)",
      "expected": "13/36",
      "type": "short"
    }
  ]
}

Rubric:
{
  "total_points": 5,
  "criteria": [
    {"description": "(a) Correct method for 2/9 of £180,000", "points": 1},
    {"description": "(a) Accurate answer: £40,000", "points": 1},
    {"description": "(b) Correct method for 5/12 of £180,000", "points": 1},
    {"description": "(b) Accurate answer: £75,000", "points": 1},
    {"description": "(c) Correct calculation of remaining fraction: 13/36", "points": 1}
  ]
}

Misconceptions:
[
  {
    "id": "MISC_MATH_FRACTIONS_MULTIPLE_OPS",
    "misconception": "Student calculates (a) and (b) correctly but adds fractions incorrectly for (c): 2/9 + 5/12 without common denominator",
    "clarification": "Find common denominator (36): 2/9 = 8/36, 5/12 = 15/36, total spent = 23/36, remaining = 13/36"
  }
]
```

### 4. REVISION Lessons

**Purpose**: Refresh memory and consolidate learning for previously taught material

#### Explainer Structure:
- **START** with memory trigger: "Remember when we learned..."
- **PROVIDE** quick summary of key points (bullet form acceptable)
- **HIGHLIGHT** common mistakes from previous lessons
- **INCLUDE** memory aids/mnemonics if applicable
- **LENGTH**: Concise (100-150 words)

#### CFU Purpose:
Retrieval practice and consolidation
- Mix of question types for varied retrieval (MCQ for quick recall, numeric for application)
- Include questions that address common misconceptions
- Spiral review: connect to related topics
- Mix of difficulties to build confidence and challenge

#### Card Structure:
1. **Card 1 (Quick Recall)** - Fast-paced MCQs or short answers (starter quiz)
2. **Card 2 (Mixed Practice)** - Varied problems at medium difficulty
3. **Card 3 (Challenge/Exam Style)** - Exam-style questions to prepare for assessments

#### Example Card 2 (Mixed Revision):
```
Title: "Fractions Revision - Mixed Practice"

Explainer (140 words):
"**Quick Revision: Calculating Fractions of Amounts**

Remember from Unit 2: To find a fraction of an amount, we multiply then divide.

**Method (in 2 steps):**
1. Multiply the amount by the TOP number (numerator)
2. Divide your answer by the BOTTOM number (denominator)

**Memory Aid:** "Top Times, Bottom Divides"

**Example Reminder:**
3/4 of £80 = (80 × 3) ÷ 4 = 240 ÷ 4 = £60

**Common Mistakes We Saw:**
❌ Dividing first: £80 ÷ 4 × 3 (works here but fails with decimals!)
❌ Forgetting units: Writing '60' instead of '£60'
❌ Confusing with percentages: 3/4 ≠ 34%

**Today's Practice:** Mixed questions to build confidence before next week's assessment."

CFU:
{
  "type": "structured",
  "id": "q_revision_fractions_02",
  "stem": "Calculate the following. Show your working for each. (a) 3/5 of £350  (b) 7/10 of £1,400  (c) A £240 bike is reduced by 2/3. What is the discount?",
  "parts": [
    {"id": "q_revision_fractions_02a", "label": "(a)", "expected": "210", "type": "numeric"},
    {"id": "q_revision_fractions_02b", "label": "(b)", "expected": "980", "type": "numeric"},
    {"id": "q_revision_fractions_02c", "label": "(c)", "expected": "160", "type": "numeric"}
  ]
}

Rubric:
{
  "total_points": 6,
  "criteria": [
    {"description": "(a) Correct method and answer (£210)", "points": 2},
    {"description": "(b) Correct method and answer (£980)", "points": 2},
    {"description": "(c) Correct method and answer (£160)", "points": 2}
  ]
}

Misconceptions:
[
  {
    "id": "MISC_MATH_FRACTIONS_CONTEXT",
    "misconception": "Student calculates 2/3 of £240 correctly but gives £160 as the new price instead of the discount",
    "clarification": "Question asks for DISCOUNT amount (2/3), not the price AFTER discount (1/3). Answer: £160 is the discount."
  }
]
```

## Size Constraint Removal Strategy

### Current Problem:
Database schema enforces arbitrary limits:
- `title`: max 255 chars
- `outcomeRefs`: max 4000 chars
- `cards`: max 8000 chars (most restrictive!)
- `engagement_tags`: max 1000 chars
- `policy`: max 2000 chars

These limits force artificial truncation that harms pedagogical quality, especially for "teach" lessons requiring comprehensive explainers.

### Solution: Quality-First Approach

**New Policy**: Remove hard size constraints from prompts and prioritize pedagogical quality.

#### Schema Documentation Updates:

```
**Required Fields** (NO MAX LENGTH - use pedagogical judgment):
- `courseId` (string) - Course identifier from SoW
- `title` (string) - Lesson title matching SoW entry label
  └─ GUIDANCE: Keep concise (typically 30-100 chars) but no hard limit
- `outcomeRefs` (JSON string) - Array of outcome IDs like ["O1", "O2"]
  └─ GUIDANCE: Typically 2-6 outcomes per lesson, but no hard limit
- `cards` (JSON string) - Array of pedagogical card objects
  └─ GUIDANCE:
      • teach: 3-5 cards with comprehensive explainers (200-400 words each)
      • independent_practice: 3-4 cards with minimal explainers (50-100 words)
      • formative_assessment: 2-3 cards with task-only explainers (30-50 words)
      • revision: 3-4 cards with concise explainers (100-150 words)
      • Total JSON size: Prioritize quality over arbitrary limits
      • If content is too long, refactor into additional cards rather than compress
- `createdBy` (string) - Author identifier (use "lesson_author_agent")
- `lesson_type` (string) - One of: teach, independent_practice, formative_assessment, revision
- `estMinutes` (integer, 5-120) - Estimated lesson duration
```

#### Database Workaround Strategies (if limits are hit):

1. **Increase Appwrite field limits** (preferred):
   - Update collection schema to increase max length
   - `cards`: 8000 → 20000 chars (supports 4-5 rich teach cards)
   - `outcomeRefs`: 4000 → 8000 chars (supports detailed outcome lists)

2. **Separate content collection**:
   - Create `lesson_content` collection
   - Store large explainers/cards separately
   - Link via `lesson_template_id` foreign key

3. **Use Appwrite Storage**:
   - Store cards JSON as blob file
   - Reference file ID in lesson_template record

4. **Migrate to PostgreSQL**:
   - Use JSONB columns (unlimited size)
   - Better for production scalability

## Implementation: Prompt Updates

### Location: `langgraph-author-agent/src/lesson_author_prompts.py`

### Change 1: Add New Section After Line 284

Insert new `<explainer_design_by_lesson_type>` section with the detailed guidance from this spec.

### Change 2: Replace Lines 286-309

Replace `<cfu_variety_guide>` with new `<cfu_design_by_lesson_type>` section that aligns CFU purpose with lesson pedagogy and defines scaffolding levels.

### Change 3: Update Lines 153-253

Update `<lesson_template_schema>` to remove hard size constraints and add pedagogical guidance for content length per lesson type.

### Change 4: Update Lines 372-397

Update `<constraints>` section to add lesson-type-specific requirements and new size policy.

### Change 5: Update Lines 330-359

Update `<process>` step 5 to add explicit lesson_type branching logic:

```
5) **Draft** the LessonTemplate directly:
   - Read `sow_entry_input.json`, `research_pack.json`, `Course_data.txt`
   - **NEW: Identify lesson_type and apply type-specific explainer guidance**
   - APPLY lesson_type-specific patterns:
     * IF lesson_type == "teach":
         └─ Explainers: Comprehensive ground-up teaching (200-400 words)
         └─ CFUs: Confirm understanding with reasoning prompts
         └─ Scaffolding: High → Medium → Low across cards
     * IF lesson_type == "independent_practice":
         └─ Explainers: Brief method reminders only (50-100 words)
         └─ CFUs: Progressive difficulty, varied contexts, NO scaffolding
     * IF lesson_type == "formative_assessment":
         └─ Explainers: Task instructions only (30-50 words)
         └─ CFUs: Standards-aligned assessment questions, NO scaffolding
     * IF lesson_type == "revision":
         └─ Explainers: Quick summaries with memory triggers (100-150 words)
         └─ CFUs: Mixed retrieval practice, address common errors
   - Create 3-5 cards following lesson_type guidance
   - Include rubrics with clear criteria and point allocations
   - Identify 1-3 common misconceptions per card
   - VALIDATE before writing: all critical fields present, no size-based truncation
```

## Testing Strategy

### Test Cases:

1. **teach lesson** - Applications of Mathematics N3, "Calculating Fractions of Amounts"
   - Expected: 4 cards with comprehensive explainers (200-400 words each)
   - Expected: Card 2 has full worked example with reasoning
   - Expected: Progressive scaffolding reduction across cards

2. **independent_practice lesson** - Applications of Mathematics N3, "Fractions Practice"
   - Expected: 3 cards with brief explainers (50-100 words each)
   - Expected: No worked examples or scaffolding
   - Expected: Progressive difficulty

3. **formative_assessment lesson** - Applications of Mathematics N3, "Unit 1 Assessment"
   - Expected: 2-3 cards with minimal explainers (30-50 words each)
   - Expected: Assessment standard references in explainers
   - Expected: No teaching content

4. **revision lesson** - Applications of Mathematics N3, "Unit 1 Revision"
   - Expected: 3 cards with concise explainers (100-150 words each)
   - Expected: Memory triggers and common mistake highlights
   - Expected: Mixed question types

### Validation Checklist:

- [ ] teach explainers explain concepts from ground up
- [ ] independent_practice explainers are brief reminders only
- [ ] formative_assessment explainers are task instructions only
- [ ] revision explainers include memory triggers
- [ ] No artificial truncation of pedagogical content
- [ ] CFU scaffolding aligns with lesson type
- [ ] Rubrics align with assessment standards
- [ ] Misconceptions are relevant and actionable

## Success Criteria

✅ **Pedagogical Differentiation**: Each lesson type produces appropriately structured cards
✅ **teach**: Comprehensive teaching with scaffolding
✅ **independent_practice**: Minimal scaffolding, maximum practice
✅ **formative_assessment**: Pure assessment conditions
✅ **revision**: Concise memory triggers and retrieval practice
✅ **Quality Over Size**: No artificial content truncation
✅ **Agent Compliance**: Agent follows lesson-type-specific guidance consistently

## References

- Scottish CfE/SQA Assessment Standards
- Rosenshine's Principles of Instruction (I-We-You scaffolding)
- Cognitive Load Theory (scaffolding to manage complexity)
- Spaced Retrieval Practice (revision lesson design)
- CEFR Language Levels (explainer_plain accessibility)

## Glossary

- **Scaffolding**: Temporary support structures that help students accomplish tasks they couldn't do independently
- **I-We-You**: Gradual release model (I do, We do, You do)
- **CFU**: Check for Understanding - formative assessment questions
- **Retrieval Practice**: Recalling information from memory to strengthen learning
- **Near Transfer**: Applying knowledge to very similar problems
- **Far Transfer**: Applying knowledge to novel contexts
- **Rubric**: Scoring guide with criteria and point allocations
