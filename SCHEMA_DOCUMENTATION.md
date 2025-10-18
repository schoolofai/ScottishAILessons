# Schema Documentation - Lesson Templates and Cards

This document provides comprehensive documentation for the Zod schemas used in the Scottish AI Lessons platform for lesson templates, cards, and Check For Understanding (CFU) assessments.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Schemas](#core-schemas)
3. [CFU Type Schemas](#cfu-type-schemas)
4. [Card Schema](#card-schema)
5. [Template Schema](#template-schema)
6. [Usage Examples](#usage-examples)
7. [Validation Rules](#validation-rules)
8. [Best Practices](#best-practices)

---

## Overview

The schema system provides type-safe validation for lesson content using Zod. All lesson templates consist of:

- **Cards**: Individual learning content blocks with lessons and assessments
- **CFU Types**: Four different assessment question types
- **Templates**: Collections of cards organized into lessons
- **Policies**: Assessment rules and constraints

```
LessonTemplate
├── Cards[]
│   ├── Explainer content (rich + accessible plain text)
│   ├── Misconceptions (common student errors)
│   ├── Context hooks (prerequisites)
│   └── CFU (assessment question)
└── Policy (calculator rules, assessment notes)
```

---

## Core Schemas

### Rubric Schema

Defines scoring criteria for assessments.

**Schema Definition:**
```typescript
RubricCriterion {
  description: string;      // Clear description of criterion
  points: number;           // Points for this criterion (≥ 0)
}

Rubric {
  total_points: number;     // Total points (> 0)
  criteria: Criterion[];    // 1+ criteria, sum ≤ total_points
}
```

**Validation Rules:**
- `total_points` must be > 0
- `criteria` array must have at least 1 item
- Sum of all `points` must be ≤ `total_points`
- Each `points` value must be ≥ 0

**Example:**
```json
{
  "total_points": 3,
  "criteria": [
    { "description": "Correct answer", "points": 2 },
    { "description": "Shows working", "points": 1 }
  ]
}
```

**Usage:**
```typescript
// Create a rubric
const rubric: Rubric = {
  total_points: 5,
  criteria: [
    { description: "Identifies correct method", points: 2 },
    { description: "Applies method correctly", points: 2 },
    { description: "Clear communication", points: 1 }
  ]
};

// Validate it
const result = RubricSchema.safeParse(rubric);
if (result.success) {
  console.log("Valid rubric:", result.data);
}
```

---

### Misconception Schema

Captures common student errors and provides clarifications.

**Schema Definition:**
```typescript
Misconception {
  id: string;              // Format: MISC_SUBJECT_TOPIC_###
  misconception: string;   // Description of the error
  clarification: string;   // Correct understanding
}
```

**ID Format Requirements:**
- Must have exactly 4 underscore-separated parts
- Format: `MISC_SUBJECT_TOPIC_###`
- Last part must be numeric (3+ digits)
- Example: `MISC_MATHEMATICS_FRACTIONS_001`

**Validation Rules:**
- ID must match regex: `/^MISC_[A-Z]+_[A-Z]+_\d{3,}$/`
- `misconception` and `clarification` must be non-empty strings

**Example:**
```json
{
  "id": "MISC_MATHEMATICS_FRACTIONS_001",
  "misconception": "When adding fractions, add the numerators and denominators separately",
  "clarification": "Fractions must have a common denominator before adding. We only add numerators when denominators are equal."
}
```

**Usage:**
```typescript
const misconception: Misconception = {
  id: "MISC_MATHEMATICS_ALGEBRA_001",
  misconception: "Multiplying by a negative flips the inequality sign always",
  clarification: "The inequality sign flips only when multiplying/dividing by a negative number"
};

const result = MisconceptionSchema.safeParse(misconception);
```

---

### Hint Array Schema

Provides progressive guidance for numeric questions.

**Schema Definition:**
```typescript
HintArray: string[]; // Array of 3-5 hints
```

**Validation Rules:**
- Must have minimum 3 hints
- Must have maximum 5 hints
- Each hint must be a non-empty string

**Example:**
```json
[
  "Read the question carefully and identify what information is given",
  "What formula or method applies to this type of problem?",
  "Set up your calculation step by step",
  "Double-check your arithmetic",
  "Verify your answer makes sense in context"
]
```

**Usage:**
```typescript
const hints = [
  "Start with the definition of percentage",
  "Remember: percentage means 'per hundred'",
  "Calculate the fraction first, then multiply",
  "Check if your answer is reasonable",
  "Verify with a different method if possible"
];

const result = HintArraySchema.safeParse(hints);
```

---

## CFU Type Schemas

### MCQ (Multiple Choice Question)

For single-answer selection questions.

**Schema Definition:**
```typescript
MCQCFU {
  type: "mcq";
  id: string;              // Unique CFU identifier
  stem: string;            // Question text
  options: string[3..5];   // 3-5 answer options
  answerIndex: number;     // Index of correct answer (0-based)
  rubric: Rubric;         // Scoring criteria
}
```

**Validation Rules:**
- Must have 3-5 options
- `answerIndex` must be valid (0 to length-1)
- All fields are required

**Example:**
```json
{
  "type": "mcq",
  "id": "CFU_MCQ_FRAC_001",
  "stem": "What is 1/4 + 1/4?",
  "options": [
    "1/8",
    "1/2",
    "2/8",
    "1/4 + 1/4"
  ],
  "answerIndex": 1,
  "rubric": {
    "total_points": 1,
    "criteria": [
      { "description": "Correct answer", "points": 1 }
    ]
  }
}
```

**Frontend Rendering:**
- Radio buttons with A, B, C, D labels
- Displays all options vertically
- Visual feedback on selection

---

### Numeric CFU

For numerical calculations with tolerance.

**Schema Definition:**
```typescript
NumericCFU {
  type: "numeric";
  id: string;              // Unique CFU identifier
  stem: string;            // Question text
  expected: number;        // Expected/correct answer
  tolerance: number;       // Acceptable margin (≥ 0)
  money2dp?: boolean;      // Currency format (2 decimal places)
  hints?: string[3..5];   // Progressive guidance
  rubric: Rubric;         // Scoring criteria
}
```

**Validation Rules:**
- `tolerance` must be ≥ 0
- If `money2dp` is true, `expected` must be ≥ 0
- `hints` (if provided) must follow HintArray rules

**Example - Simple Calculation:**
```json
{
  "type": "numeric",
  "id": "CFU_NUM_PERC_001",
  "stem": "What is 15% of 80?",
  "expected": 12,
  "tolerance": 0.5,
  "rubric": {
    "total_points": 2,
    "criteria": [
      { "description": "Correct calculation", "points": 2 }
    ]
  }
}
```

**Example - Currency with Hints:**
```json
{
  "type": "numeric",
  "id": "CFU_NUM_MONEY_001",
  "stem": "If a book costs £12.50 and you get 20% off, what do you pay?",
  "expected": 10.00,
  "tolerance": 0.01,
  "money2dp": true,
  "hints": [
    "Calculate 20% of £12.50",
    "Think: 20% = 1/5, so divide by 5",
    "£12.50 ÷ 5 = ?",
    "Subtract the discount from the original price",
    "£12.50 - discount = ?"
  ],
  "rubric": {
    "total_points": 3,
    "criteria": [
      { "description": "Correct discount calculation", "points": 1 },
      { "description": "Correct final price", "points": 2 }
    ]
  }
}
```

**Frontend Rendering:**
- Number input with appropriate step size
- Currency formatting if `money2dp` is true
- Progressive hints system (show hint, next hint buttons)
- Visual hint display in yellow alert box

---

### Structured Response CFU

For multi-part written answers with marking criteria.

**Schema Definition:**
```typescript
StructuredResponseCFU {
  type: "structured_response";
  id: string;              // Unique CFU identifier
  stem: string;            // Question with parts (max 800 chars)
  rubric: Rubric;         // Multi-criterion scoring
}
```

**Validation Rules:**
- `stem` must be ≤ 800 characters
- Typically contains newlines separating parts
- Rubric should have multiple criteria for different parts

**Example:**
```json
{
  "type": "structured_response",
  "id": "CFU_STRUCT_GEOM_001",
  "stem": "A rectangle has length 8cm and width 5cm.\nPart a) Calculate the area\nPart b) Calculate the perimeter\nPart c) Explain the difference between these two measurements",
  "rubric": {
    "total_points": 6,
    "criteria": [
      { "description": "Correct area calculation with units", "points": 2 },
      { "description": "Correct perimeter calculation with units", "points": 2 },
      { "description": "Clear explanation of difference", "points": 2 }
    ]
  }
}
```

**Frontend Rendering:**
- Textarea with monospace font
- Large height (150px+) for multi-line responses
- Character counter or max length indicator
- Display of total points available

---

### Short Text CFU

For brief written responses (1-2 sentences).

**Schema Definition:**
```typescript
ShortTextCFU {
  type: "short_text";
  id: string;              // Unique CFU identifier
  stem: string;            // Question text
  rubric: Rubric;         // Scoring criteria
}
```

**Validation Rules:**
- All fields required
- Typically single criterion rubric

**Example:**
```json
{
  "type": "short_text",
  "id": "CFU_SHORT_DEF_001",
  "stem": "Define what a prime number is in your own words",
  "rubric": {
    "total_points": 2,
    "criteria": [
      { "description": "Accurate definition mentioning only divisors 1 and itself", "points": 2 }
    ]
  }
}
```

**Frontend Rendering:**
- Text input (not textarea)
- 200 character limit
- Single line input
- Character remaining counter

---

## Card Schema

Complete lesson card with all pedagogical content.

**Schema Definition:**
```typescript
LessonCard {
  id: string;                    // Unique card identifier
  title: string;                 // Card title
  explainer: string;             // Rich markdown content
  explainer_plain: string;       // CEFR A2-B1 accessible version
  cfu: CFU;                      // One of 4 CFU types
  misconceptions: Misconception[]; // Common errors
  context_hooks?: string[];      // Prerequisites or context
}
```

**Validation Rules:**
- `explainer_plain` is required (accessibility mandate)
- `cfu` must be one of the 4 valid types
- `misconceptions` can be empty array
- `context_hooks` is optional

**Example:**
```json
{
  "id": "CARD_FRAC_INTRO_001",
  "title": "Introduction to Fractions",
  "explainer": "A **fraction** represents a part of a whole. In the fraction $\\frac{3}{5}$:\n- The **numerator** (top) shows how many parts we have\n- The **denominator** (bottom) shows how many equal parts the whole is divided into\n\nFor example, if you eat 3 slices of a pizza cut into 5 equal slices, you've eaten $\\frac{3}{5}$ of the pizza.",
  "explainer_plain": "A fraction has two parts. The top number is the numerator. The bottom number is the denominator. A fraction shows how many parts you have out of the total number of parts.",
  "cfu": {
    "type": "mcq",
    "id": "CFU_FRAC_001",
    "stem": "In the fraction 3/5, what does the 5 represent?",
    "options": [
      "The number of parts you have",
      "The total number of equal parts",
      "How many pieces to cut",
      "The size of each part"
    ],
    "answerIndex": 1,
    "rubric": {
      "total_points": 1,
      "criteria": [
        { "description": "Correct understanding of denominator", "points": 1 }
      ]
    }
  },
  "misconceptions": [
    {
      "id": "MISC_MATHEMATICS_FRACTIONS_001",
      "misconception": "The numerator tells you how big the fraction is",
      "clarification": "The numerator tells you how many parts you have, but the size of the fraction depends on both parts: 3/5 is bigger than 3/10"
    }
  ],
  "context_hooks": [
    "Understanding of whole numbers and division",
    "Recognition of equal parts"
  ]
}
```

**Frontend Integration:**
- Displays explainer content with markdown rendering
- Shows CFU component based on type
- Displays misconceptions in warning alert
- Shows context hooks as badges/tags
- Full context preserved for chat interactions

---

## Template Schema

Complete lesson template with metadata and cards.

**Schema Definition:**
```typescript
LessonTemplate {
  // Appwrite metadata
  $id: string;
  $createdAt: string;
  $updatedAt: string;

  // Core fields
  templateId: string;
  title: string;
  courseId: string;

  // Content
  outcomeRefs: string;          // JSON stringified array
  cards: string;                // JSON stringified LessonCard[]

  // Metadata
  version: number;
  sow_order: number;            // Order in Scheme of Work
  status: "draft" | "review" | "published";
  createdBy: string;
  estMinutes: number;

  // Phase 3 fields
  lesson_type: LessonType;
  engagement_tags: string;      // JSON stringified array
  policy: string;               // JSON stringified LessonPolicy

  // Model versioning (optional)
  authored_sow_id?: string;
  authored_sow_version?: string;
  model_version?: string;
}

type LessonType =
  | "teach"
  | "independent_practice"
  | "formative_assessment"
  | "revision"
  | "mock_exam";
```

**Validation Rules:**
- `status` must be one of: draft, review, published
- `lesson_type` must be one of the 5 valid types
- `estMinutes` must be ≥ 0
- `outcomeRefs` and `cards` must be valid JSON strings
- `engagement_tags` and `policy` must be valid JSON strings

**Example:**
```json
{
  "$id": "template_frac_001",
  "$createdAt": "2024-01-01T00:00:00.000Z",
  "$updatedAt": "2024-01-10T10:30:00.000Z",
  "templateId": "TEMPLATE_FRACTIONS_INTRO",
  "title": "Introduction to Fractions - National 4 Mathematics",
  "courseId": "MATH_NAT4_001",
  "outcomeRefs": "[\"NUM.REC.1\", \"NUM.REC.2\"]",
  "cards": "[{\"id\":\"CARD_001\", ...}, {\"id\":\"CARD_002\", ...}]",
  "version": 1,
  "sow_order": 5,
  "status": "published",
  "createdBy": "teacher_001",
  "estMinutes": 45,
  "lesson_type": "teach",
  "engagement_tags": "[\"visual-learning\", \"prior-knowledge-required\"]",
  "policy": "{\"calculator_allowed\": false, \"assessment_notes\": \"Mental arithmetic practice\"}",
  "authored_sow_id": "SOW_NAT4_001",
  "authored_sow_version": "1.0.0",
  "model_version": "claude-3-sonnet-20240229"
}
```

---

## Usage Examples

### Creating a Complete Card with MCQ

```typescript
import { LessonCardSchema } from '@/lib/appwrite/schemas';

const newCard = {
  id: "CARD_PERCENT_001",
  title: "Calculating Percentages",
  explainer: `
# Percentages

A **percentage** means "out of 100". To find a percentage of a number:
1. Convert the percentage to a fraction (e.g., 20% = 20/100)
2. Multiply by the number

**Example:** 20% of 50
- 20% = 20/100 = 0.2
- 0.2 × 50 = 10
  `,
  explainer_plain: "A percentage means out of 100. To find 20% of 50, multiply 50 by 0.2 to get 10.",
  cfu: {
    type: "mcq",
    id: "CFU_PERCENT_001",
    stem: "What is 25% of 80?",
    options: ["16", "20", "25", "80"],
    answerIndex: 1,
    rubric: {
      total_points: 1,
      criteria: [{ description: "Correct calculation", points: 1 }]
    }
  },
  misconceptions: [
    {
      id: "MISC_MATHEMATICS_PERCENTAGE_001",
      misconception: "20% of 50 means 50 + 20 = 70",
      clarification: "20% means 20 out of every 100, so we multiply: 50 × 0.2 = 10"
    }
  ],
  context_hooks: ["Understanding of fractions", "Decimal multiplication"]
};

const result = LessonCardSchema.safeParse(newCard);
if (result.success) {
  console.log("Card is valid!");
  saveToDatabase(result.data);
} else {
  console.error("Validation errors:", result.error);
}
```

### Creating a Numeric CFU with Hints

```typescript
const numericQuestion = {
  type: "numeric",
  id: "CFU_AREA_001",
  stem: "A rectangular garden is 12m long and 8m wide. What is its area in square metres?",
  expected: 96,
  tolerance: 0,
  hints: [
    "Area of a rectangle = length × width",
    "You have length = 12m and width = 8m",
    "Multiply 12 × 8",
    "Check: is your answer in square metres?",
    "Your answer should be between 90 and 100"
  ],
  rubric: {
    total_points: 2,
    criteria: [
      { description: "Correct calculation", "points": 1 },
      { description: "Correct units (m²)", "points": 1 }
    ]
  }
};

const validation = NumericCFUSchema.safeParse(numericQuestion);
```

### Validating a Complete Template from SOW Agent

```typescript
import { LessonTemplateSchema } from '@/lib/appwrite/schemas';

// Template as returned by Lesson Author Agent
const agentTemplate = {
  $id: "auto_generated_id",
  $createdAt: "2024-01-15T08:00:00.000Z",
  $updatedAt: "2024-01-15T08:00:00.000Z",
  templateId: "TEMPLATE_AUTO_001",
  title: "AI-Generated Lesson",
  courseId: "MATH_NAT4",
  outcomeRefs: JSON.stringify(["OUTCOME_1", "OUTCOME_2"]),
  cards: JSON.stringify([{ /* card data */ }]),
  version: 1,
  sow_order: 10,
  status: "draft",
  createdBy: "sow_author_agent",
  estMinutes: 50,
  lesson_type: "teach",
  engagement_tags: JSON.stringify(["visual", "interactive"]),
  policy: JSON.stringify({ calculator_allowed: false }),
  authored_sow_id: "SOW_NAT4_001",
  authored_sow_version: "2.0.0",
  model_version: "claude-3-sonnet-20240229"
};

const result = LessonTemplateSchema.safeParse(agentTemplate);
if (result.success) {
  console.log("Template validated successfully!");
  // Proceed with storing template
} else {
  console.error("Template validation failed:", result.error.errors);
  // Handle validation error - may reject agent output
}
```

---

## Validation Rules

### Cross-Field Validation

**Rubric:**
- Sum of criteria points ≤ total_points
- At least 1 criterion required

**Numeric CFU:**
- If `money2dp` is true, `expected` ≥ 0
- `tolerance` ≥ 0
- `tolerance` should be reasonable relative to `expected`

**Template:**
- If status is "published", should have valid cards
- `estMinutes` should align with content complexity
- Model version fields should match versioning scheme

### Format Validation

**JSON String Fields:**
- Must be valid JSON
- `outcomeRefs`: array of strings
- `cards`: array of LessonCard objects
- `engagement_tags`: array of strings
- `policy`: object with calculator_allowed and optional assessment_notes

**ID Formats:**
- Misconception IDs: `MISC_SUBJECT_TOPIC_###`
- Card IDs: Custom but unique
- CFU IDs: Custom but unique within card
- Template IDs: Typically `TEMPLATE_*_###`

---

## Best Practices

### 1. Accessibility (CEFR A2-B1)

Always provide `explainer_plain`:
```typescript
// ✓ Good - accessible and clear
explainer_plain: "A fraction has two parts. The top number shows how many parts. The bottom number shows the total parts."

// ✗ Bad - too complex
explainer_plain: "Fractions utilize numerators and denominators in a mathematical ratio."
```

### 2. Misconceptions

Provide realistic student errors:
```typescript
// ✓ Good - addresses common misconception
misconception: "2/3 + 1/5 = 3/8 (add numerators and denominators)",
clarification: "Must find common denominator first: 10/15 + 3/15 = 13/15"

// ✗ Bad - not a real misconception
misconception: "Fractions are hard",
clarification: "With practice, fractions become easier"
```

### 3. Hints

Progressive, scaffolded guidance:
```typescript
// ✓ Good - scaffolded progression
hints: [
  "Read the question carefully",
  "What formula do you need?",
  "Identify the known values",
  "Substitute into the formula",
  "Calculate step by step"
]

// ✗ Bad - not progressive
hints: [
  "The answer is 42",
  "Just multiply",
  "You should know this"
]
```

### 4. Rubrics

Specific, criterion-referenced rubrics:
```typescript
// ✓ Good - clear criteria
criteria: [
  { description: "Identifies correct method/formula", points: 1 },
  { description: "Applies method correctly", points: 2 },
  { description: "Arrives at correct answer", points: 1 },
  { description: "Shows all working", points: 1 }
]

// ✗ Bad - vague criteria
criteria: [
  { description: "Good answer", points: 2 },
  { description: "Okay answer", points: 1 }
]
```

### 5. Testing Before Publishing

```typescript
// Validate before publishing
const checkTemplate = async (template: any) => {
  const result = LessonTemplateSchema.safeParse(template);

  if (!result.success) {
    console.error("Validation errors:");
    result.error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    return false;
  }

  // Additional business logic validation
  const cardCount = JSON.parse(result.data.cards).length;
  if (cardCount === 0) {
    console.error("Template must have at least one card");
    return false;
  }

  if (result.data.estMinutes <= 0) {
    console.error("Estimated minutes must be positive");
    return false;
  }

  return true;
};
```

---

## Related Files

- **Schemas**: `/lib/appwrite/schemas.ts` - Zod schema definitions
- **TypeScript Types**: `/lib/appwrite/types/index.ts` - TypeScript interfaces
- **Tests**: `/lib/appwrite/schemas.test.ts` - Comprehensive test suite
- **UI Component**: `/components/tools/LessonCardPresentationTool.tsx` - Frontend rendering
- **Database Schemas**: See Appwrite collection configuration in project

---

## Support & Questions

For questions about schema usage or examples, refer to:
1. The `schemas.test.ts` file for working examples
2. The TypeScript interfaces for type definitions
3. The LessonCardPresentationTool for frontend implementation patterns
