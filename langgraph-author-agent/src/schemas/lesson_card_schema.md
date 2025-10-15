# Lesson Card Schema Documentation

**Version**: 2.0
**Last Updated**: 2025-10-15
**Purpose**: Complete schema structure for lesson cards within SOW lesson plans

---

## Overview

The **Lesson Card** is the fundamental unit of pedagogical design within a lesson plan. Each lesson should contain **6-12 cards** that progressively scaffold learning through a structured pedagogical arc. This schema emphasizes detailed, card-by-card instructional design suitable for AI-delivered one-to-one tutoring in Scottish classrooms.

---

## Complete Card Structure

```json
{
  "card_number": "int, REQUIRED - sequential position (1, 2, 3...)",
  "card_type": "string, REQUIRED - starter | explainer | modelling | guided_practice | independent_practice | exit_ticket",
  "title": "string, REQUIRED - clear, teacher-facing card title",
  "purpose": "string, REQUIRED - pedagogical goal for this card",

  "standards_addressed": [
    {
      "code": "string, REQUIRED - assessment standard code (e.g., 'AS1.2')",
      "description": "string, REQUIRED - full SQA description from Course_data.txt",
      "outcome": "string, REQUIRED - parent outcome reference (e.g., 'O1')"
    }
  ],

  "pedagogical_approach": "string, REQUIRED - detailed description of what happens in this card",

  "cfu_strategy": "string, REQUIRED - specific CFU type and prompt (e.g., 'MCQ: Which fraction equals 25%?')",

  "estimated_minutes": "int, REQUIRED - realistic timing for this card (1-15 minutes typical)",

  "key_concepts": ["array, optional - for explainer cards, list 3-5 key concepts"],

  "worked_example": "string, optional - for modelling cards, detailed worked example with Scottish context",

  "practice_problems": ["array, optional - for guided_practice cards, 2-4 problems with increasing complexity"],

  "misconceptions_addressed": [
    {
      "misconception": "string, optional - common student error",
      "remediation": "string - correction strategy"
    }
  ],

  "rubric_guidance": {
    "total_points": "int, optional - total marks for this card's CFU",
    "criteria": [
      {"description": "string - criterion", "points": "int - marks"}
    ]
  },

  "assessment_focus": "string, optional - for cards addressing multiple standards, which is primary vs secondary"
}
```

---

## Card Types and Usage

### 1. **Starter** (`starter`)
**Purpose**: Activate prior knowledge, set lesson context, establish engagement

**Typical Duration**: 3-5 minutes

**Required Fields**:
- Basic card fields (card_number, card_type, title, purpose, standards_addressed, pedagogical_approach, cfu_strategy, estimated_minutes)

**Optional Fields**:
- key_concepts (brief preview of lesson content)
- misconceptions_addressed (surface prior misconceptions)

**CFU Strategy Examples**:
- "Quick poll: Show thumbs up if you've used fractions for money before"
- "MCQ: Which represents half? A) 0.5  B) 0.25  C) 0.75  D) 0.1"
- "Think-pair-share prompt: Where do we see percentages in real life?"

---

### 2. **Explainer** (`explainer`)
**Purpose**: Introduce new concepts, define key terms, establish conceptual foundation

**Typical Duration**: 5-10 minutes

**Required Fields**:
- All basic card fields
- **key_concepts** (array of 3-5 core concepts for this card)

**Optional Fields**:
- misconceptions_addressed (preemptively address common confusions)
- worked_example (simple illustrative example for concept clarification)

**CFU Strategy Examples**:
- "MCQ: What does the numerator in a fraction represent?"
- "Structured question: Define 'percentage' in your own words"
- "Matching exercise: Match each fraction to its decimal equivalent"

**Key Concepts Format**:
```json
"key_concepts": [
  "Fractions represent parts of a whole",
  "Numerator shows how many parts we have",
  "Denominator shows total number of equal parts",
  "Equivalent fractions represent the same value",
  "Simplifying fractions means finding smallest equivalent form"
]
```

---

### 3. **Modelling** (`modelling`)
**Purpose**: Demonstrate problem-solving process, show worked examples with thinking visible

**Typical Duration**: 6-12 minutes

**Required Fields**:
- All basic card fields
- **worked_example** (detailed example with Scottish context)

**Optional Fields**:
- misconceptions_addressed (address errors during worked example)
- rubric_guidance (if demonstrating assessment technique)

**CFU Strategy Examples**:
- "Structured question: What was the first step in solving this problem?"
- "MCQ: Why did we multiply by 100 to convert to percentage?"
- "Self-explanation prompt: Explain each step in the worked example"

**Worked Example Format**:
```json
"worked_example": "A supermarket in Edinburgh offers 25% off on a £48 jacket. Let's calculate the discount amount and final price step-by-step:\n\nStep 1: Convert percentage to decimal: 25% = 25/100 = 0.25\n\nStep 2: Calculate discount: £48 × 0.25 = £12\n\nStep 3: Calculate final price: £48 - £12 = £36\n\nTherefore, the discount is £12 and the final price is £36."
```

---

### 4. **Guided Practice** (`guided_practice`)
**Purpose**: Supervised problem-solving with scaffolding and immediate feedback

**Typical Duration**: 8-15 minutes

**Required Fields**:
- All basic card fields
- **practice_problems** (array of 2-4 problems with increasing complexity)

**Optional Fields**:
- misconceptions_addressed (address errors that emerge during practice)
- rubric_guidance (for assessment-focused practice)

**CFU Strategy Examples**:
- "Structured question series: Complete problems 1-4, showing all working"
- "Self-check prompt: Compare your answer to the worked solution"
- "Error identification: Find and correct the mistake in this student work"

**Practice Problems Format**:
```json
"practice_problems": [
  "Calculate 15% of £60 (bus pass discount)",
  "A £120 item is reduced by 30%. Find the sale price.",
  "Compare discounts: 20% off £75 vs. 25% off £60. Which saves more?",
  "Challenge: An item costs £45 after a 25% discount. What was the original price?"
]
```

---

### 5. **Independent Practice** (`independent_practice`)
**Purpose**: Unsupported application, assessment of mastery, exam-style practice

**Typical Duration**: 10-15 minutes

**Required Fields**:
- All basic card fields
- **practice_problems** (array of 3-5 problems at target difficulty)
- **rubric_guidance** (total_points and criteria)

**Optional Fields**:
- assessment_focus (indicate primary vs secondary standard focus)

**CFU Strategy Examples**:
- "Assessment task: Complete all problems independently in 12 minutes"
- "Exam simulation: Answer questions without calculator (non-calc section)"
- "Portfolio task: Solve and explain your reasoning for each problem"

**Rubric Guidance Format**:
```json
"rubric_guidance": {
  "total_points": 12,
  "criteria": [
    {"description": "Correct method shown", "points": 4},
    {"description": "Accurate calculations", "points": 4},
    {"description": "Clear working and reasoning", "points": 2},
    {"description": "Appropriate units and rounding", "points": 2}
  ]
}
```

---

### 6. **Exit Ticket** (`exit_ticket`)
**Purpose**: Quick formative assessment, gauge understanding, identify follow-up needs

**Typical Duration**: 3-5 minutes

**Required Fields**:
- All basic card fields

**Optional Fields**:
- rubric_guidance (simple point allocation)
- misconceptions_addressed (identify common exit ticket errors)

**CFU Strategy Examples**:
- "Quick assessment: Convert 3/4 to percentage (show working)"
- "Self-rating: Rate your understanding of today's lesson (1-5 scale)"
- "Application question: Where would you use this skill outside school?"

---

## Field Details

### Required Fields (ALL Card Types)

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `card_number` | int | Sequential position (1, 2, 3...) | Must be sequential within lesson |
| `card_type` | enum | Card category | Must be: starter, explainer, modelling, guided_practice, independent_practice, exit_ticket |
| `title` | string | Teacher-facing card name | Clear, concise (max 80 chars) |
| `purpose` | string | Pedagogical goal | Specific learning objective for this card |
| `standards_addressed` | array[object] | **Enriched objects** with code/description/outcome | NOT bare codes - see Enriched Format section |
| `pedagogical_approach` | string | Detailed instructional description | Must be specific, not generic (e.g., not "explain concepts") |
| `cfu_strategy` | string | Specific CFU type and prompt | NOT generic "ask questions" - see CFU section |
| `estimated_minutes` | int | Realistic timing | 1-15 minutes typical per card |

### Conditional Required Fields (By Card Type)

| Field | Required For | Type | Description |
|-------|--------------|------|-------------|
| `key_concepts` | explainer | array[string] | 3-5 core concepts introduced in this card |
| `worked_example` | modelling | string | Detailed example with Scottish context |
| `practice_problems` | guided_practice, independent_practice | array[string] | 2-4 problems (guided) or 3-5 problems (independent) |
| `rubric_guidance` | independent_practice | object | Total points and criteria breakdown |

### Optional Fields (ALL Card Types)

| Field | Type | Description |
|-------|------|-------------|
| `misconceptions_addressed` | array[object] | Misconception + remediation pairs |
| `assessment_focus` | string | Primary vs secondary standard (for multi-standard cards) |

---

## Critical Requirements

### 1. Enriched Format for `standards_addressed` (MANDATORY)

**❌ WRONG** (bare codes):
```json
"standards_addressed": ["AS1.2", "AS2.1"]
```

**✅ CORRECT** (enriched objects):
```json
"standards_addressed": [
  {
    "code": "AS1.2",
    "description": "Perform calculations involving fractions, decimal fractions and percentages (from Course_data.txt)",
    "outcome": "O1"
  },
  {
    "code": "AS2.1",
    "description": "Apply numerical skills to solve real-life problems involving fractions and percentages (from Course_data.txt)",
    "outcome": "O2"
  }
]
```

**Rationale**: Lesson Author Agent needs full SQA descriptions to:
- Generate assessment-aligned CFU questions
- Create rubrics matching official standards
- Maintain Scottish terminology consistency
- Ensure cards address standards appropriately

---

### 2. CFU Strategies (Specific, Not Generic)

**❌ BAD Examples**:
- "Ask questions to check understanding"
- "Check if students understand"
- "Formative assessment"
- "Discussion"

**✅ GOOD Examples**:
- "MCQ: Which fraction equals 25%? A) 1/2  B) 1/4  C) 1/3  D) 1/5"
- "Structured question: Calculate 3/4 of £20 showing all working"
- "Self-explanation prompt: Explain why we multiply by 100 when converting to percentage"
- "Error identification: Find the mistake in this calculation: 0.25 × £80 = £2.50"
- "Think-aloud: Describe each step as you solve 15% of £60"

**CFU Strategy Format Template**:
```
[CFU Type]: [Specific prompt or question]
```

**Common CFU Types for Scottish Maths**:
- MCQ (Multiple Choice Question)
- Structured question (step-by-step problem)
- Self-explanation prompt
- Error identification
- Think-aloud protocol
- Quick poll (thumbs up/down, traffic lights)
- Self-rating scale (1-5 understanding)
- Matching exercise
- Compare and contrast
- Application question

---

### 3. Card Timing Validation

**Requirement**: Card timings must sum to lesson's `estMinutes` (allow ±5 min tolerance)

**Example Validation**:
```
Lesson estMinutes: 50
Card timings: 5 + 8 + 10 + 12 + 10 + 5 = 50 ✅
```

**Realistic Timing Guidelines**:
- Starter: 3-5 minutes
- Explainer: 5-10 minutes
- Modelling: 6-12 minutes
- Guided Practice: 8-15 minutes
- Independent Practice: 10-15 minutes
- Exit Ticket: 3-5 minutes

**Scottish Period Context**: Typical Scottish secondary school periods are 25-50 minutes, so card sequences must fit within these constraints.

---

### 4. Progressive Scaffolding Across Cards

**Requirement**: For chunked lessons (2-3+ standards), ALL assessmentStandardRefs must appear in at least 2-3 cards

**Example**:
```
Lesson assessmentStandardRefs: [AS1.2, AS2.1, AS2.3]

Card 1 (starter): standards_addressed = []  (activation only)
Card 2 (explainer): standards_addressed = [AS1.2]  (introduce fractions)
Card 3 (modelling): standards_addressed = [AS1.2, AS2.1]  (demonstrate calculation)
Card 4 (guided_practice): standards_addressed = [AS1.2, AS2.1]  (practice with feedback)
Card 5 (explainer): standards_addressed = [AS2.3]  (introduce context application)
Card 6 (modelling): standards_addressed = [AS2.1, AS2.3]  (demonstrate real-life problem)
Card 7 (independent_practice): standards_addressed = [AS1.2, AS2.1, AS2.3]  (integrate all)
Card 8 (exit_ticket): standards_addressed = [AS2.1]  (quick check)

Validation:
AS1.2 appears in: Cards 2, 3, 4, 7 = 4 times ✅
AS2.1 appears in: Cards 3, 4, 6, 7, 8 = 5 times ✅
AS2.3 appears in: Cards 5, 6, 7 = 3 times ✅
```

---

### 5. Scottish Context Authenticity

**Currency**: Always use £ (not $ or €)

**Context Examples**:
- Supermarket shopping and discounts
- Bus fares and Ridacard discounts
- NHS prescription costs
- Council tax calculations
- Scottish utility bills (electricity, water)
- Local sports club memberships
- Edinburgh Zoo ticket prices
- Scottish cinema ticket deals

**Example Worked Problem**:
```json
"worked_example": "A Glasgow sports club charges £45 per month. They offer 20% off for the first 3 months. Calculate the total cost for the first year:\n\nMonths 1-3 (discounted): £45 × 0.80 × 3 = £108\nMonths 4-12 (full price): £45 × 9 = £405\nTotal: £108 + £405 = £513\n\nThe annual cost with the introductory discount is £513."
```

---

### 6. One-to-One AI Tutoring Design

**CRITICAL**: All cards must be designed for **individual student interaction with AI tutor**, NOT classroom group activities.

**❌ AVOID** (Peer collaboration patterns):
- "Pair work: Students work in partners to solve..."
- "Group discussion: In teams of 4, explore..."
- "Peer marking: Swap papers with your partner..."
- "Think-pair-share with a classmate"
- "Jigsaw activity: Each group researches..."

**✅ USE** (One-to-one patterns):
- "Direct instruction: AI tutor explains step-by-step..."
- "Guided practice: Complete problem with AI feedback..."
- "Self-explanation: Describe your reasoning to the AI tutor..."
- "Immediate feedback: AI tutor checks your answer and provides hints..."
- "Scaffolded questioning: AI tutor asks guiding questions..."

---

## Card Sequence Design Patterns

### Pattern 1: Standard Lesson Arc (Teach Lesson)
```
1. Starter (5 min) - Activate prior knowledge
2. Explainer (8 min) - Introduce new concept
3. Modelling (10 min) - Demonstrate worked example
4. Guided Practice (12 min) - Practice with scaffolding
5. Independent Practice (10 min) - Apply independently
6. Exit Ticket (5 min) - Quick formative check

Total: 50 minutes
Standards progression: Introduction → Demonstration → Scaffolded → Independent
```

---

### Pattern 2: Revision Lesson Arc
```
1. Starter (5 min) - Recall previous lesson
2. Guided Practice (15 min) - Review with worked examples
3. Independent Practice (12 min) - Apply with varied problems
4. Exit Ticket (3 min) - Self-assessment

Total: 35 minutes
Standards progression: Review → Practice → Apply
```

---

### Pattern 3: Assessment Lesson Arc
```
1. Starter (3 min) - Assessment instructions and context
2. Independent Practice (20 min) - Timed assessment task
3. Self-Review (5 min) - Check work
4. Exit Ticket (2 min) - Reflection on difficulty

Total: 30 minutes
Standards progression: Assessment → Review
```

---

### Pattern 4: Multi-Standard Integration (Chunked Lesson)
```
1. Starter (5 min) - Connect standards thematically
2. Explainer (6 min) - Standard 1 concept introduction
3. Explainer (6 min) - Standard 2 concept introduction
4. Modelling (10 min) - Integrated example using both standards
5. Guided Practice (12 min) - Practice problems addressing both
6. Independent Practice (8 min) - Apply integrated understanding
7. Exit Ticket (3 min) - Check integration

Total: 50 minutes
Standards progression: Parallel → Integrated → Applied
```

---

## Validation Checklist

### Card-Level Validation
- [ ] All required fields present (card_number, card_type, title, purpose, standards_addressed, pedagogical_approach, cfu_strategy, estimated_minutes)
- [ ] standards_addressed uses enriched objects (code/description/outcome) - NOT bare codes
- [ ] pedagogical_approach is detailed and specific (not generic)
- [ ] cfu_strategy is specific with CFU type and actual prompt (not "ask questions")
- [ ] estimated_minutes is realistic for card type (1-15 min)
- [ ] Card type matches conditional field requirements:
  - explainer cards have key_concepts
  - modelling cards have worked_example
  - guided_practice cards have practice_problems
  - independent_practice cards have practice_problems AND rubric_guidance
- [ ] Scottish contexts used in all examples and problems (£, local contexts)
- [ ] Designed for one-to-one AI tutoring (no peer collaboration)

### Lesson-Level Card Sequence Validation
- [ ] Total card count is 6-12 cards
- [ ] Card numbers are sequential (1, 2, 3...)
- [ ] Card timings sum to lesson estMinutes (±5 min tolerance)
- [ ] Card type progression is logical (starter → explainer → modelling → guided_practice → independent_practice → exit_ticket)
- [ ] ALL lesson assessmentStandardRefs appear in at least 2-3 cards
- [ ] Standards_addressed progression shows scaffolding (introduction → practice → integration)
- [ ] Scottish contexts maintained throughout card sequence
- [ ] Misconceptions addressed in appropriate cards
- [ ] CFU strategies vary across cards (not repetitive)

---

## Related Documentation

- **SOW Schema**: `sow_schema.md` (parent lesson structure)
- **Research Pack Schema**: `research_pack_schema.md` (pedagogical patterns, misconceptions)
- **SOW Author Prompts**: `../sow_author_prompts.py` (agent implementation)

---

## Rationale for Card-Level Enrichment

**Why enriched objects at card-level?**

The Lesson Author Agent consumes lesson cards to generate:
1. **Assessment-aligned CFU questions** - Requires full SQA standard descriptions to create questions matching assessment language
2. **Rubric criteria** - Needs official standard text to align marking criteria with SQA expectations
3. **Scaffolded progressions** - Must understand standard relationships to sequence cards effectively
4. **Scottish terminology** - Full descriptions ensure CfE/SQA-compliant language throughout

**Example Impact**:
```json
❌ Bare code: "AS1.2"
→ Agent cannot generate: "Calculate 3/4 of £20 showing working (AS1.2: calculations with fractions)"

✅ Enriched: {"code": "AS1.2", "description": "Perform calculations involving fractions...", "outcome": "O1"}
→ Agent generates: "Calculate 3/4 of £20 showing all working. This tests your ability to perform calculations involving fractions in real-life contexts (AS1.2)."
```

The enriched format ensures high-quality, assessment-aligned lesson card generation.
