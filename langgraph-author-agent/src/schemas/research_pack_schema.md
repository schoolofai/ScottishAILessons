# Research Pack Schema Documentation

**Version**: 3.0
**Last Updated**: 2025-10-15
**Purpose**: Complete schema structure for research pack input to SOW Author Agent

---

## Overview

The **Research Pack** is the foundational input for the SOW Author Agent, produced by the Research DeepAgent. It contains distilled pedagogical patterns, Scottish contexts, assessment templates, and policy guidance extracted from official SQA sources and authentic Scottish classroom materials. The research pack enables the SOW Author to ground all authoring decisions in validated, context-specific educational research.

---

## Complete Schema Structure

```json
{
  "research_pack_version": "int, REQUIRED - Schema version (always 3 for current schema)",

  "subject": "string, REQUIRED - Course subject (e.g., 'Application of Math', 'Mathematics')",

  "level": "string, REQUIRED - SQA qualification level (National 3/4/5, Higher, Advanced Higher)",

  "exemplars_from_sources": [
    {
      "source_id": "string, REQUIRED - Unique identifier for source document",
      "source_type": "string, REQUIRED - Type of source (e.g., 'SQA_Course_Specification', 'Scottish_Textbook', 'Teaching_Guide')",
      "title": "string, REQUIRED - Official title of source document",
      "author": "string, optional - Author or organization",
      "publication_year": "int, optional - Year of publication",
      "url": "string, optional - Online location if available",
      "full_content": "string, REQUIRED - Complete extracted content from source",
      "summary": "string, REQUIRED - 2-3 paragraph summary of key insights",
      "usage_guidance": "string, REQUIRED - How SOW Author should use this exemplar",
      "relevance_tags": ["array, optional - Tags indicating content focus (e.g., 'calculator_policy', 'misconceptions', 'worked_examples')"]
    }
  ],

  "distilled_data": {
    "canonical_terms": {
      "sqa_terminology": [
        {
          "term": "string, REQUIRED - Official SQA term",
          "definition": "string, REQUIRED - Precise definition from SQA sources",
          "usage_context": "string, optional - When/how to use this term",
          "examples": ["array, optional - Example sentences using the term correctly"]
        }
      ],
      "cfe_principles": [
        {
          "principle": "string, REQUIRED - CfE principle name",
          "description": "string, REQUIRED - What this principle means",
          "application": "string, REQUIRED - How to apply in lesson design"
        }
      ]
    },

    "assessment_stems": [
      {
        "stem_id": "string, REQUIRED - Unique identifier for stem",
        "question_type": "string, REQUIRED - Type of question (e.g., 'MCQ', 'structured', 'extended_response')",
        "stem_template": "string, REQUIRED - Reusable question template with placeholders",
        "example_usage": "string, REQUIRED - Concrete example with placeholders filled",
        "difficulty_level": "string, REQUIRED - National 3/4/5, Higher, or Advanced Higher",
        "standards_addressed": ["array, REQUIRED - Assessment standards this stem can test (bare codes acceptable here)"],
        "marking_notes": "string, optional - Guidance for marking this question type"
      }
    ],

    "pedagogical_patterns": {
      "lesson_starters": [
        {
          "pattern_name": "string, REQUIRED - Name of starter pattern",
          "description": "string, REQUIRED - What this starter achieves",
          "example": "string, REQUIRED - Concrete example with Scottish context",
          "timing": "string, REQUIRED - Typical duration (e.g., '3-5 minutes')",
          "best_for": "string, REQUIRED - When to use this pattern"
        }
      ],

      "cfu_variety_examples": [
        {
          "cfu_type": "string, REQUIRED - Type of CFU (e.g., 'MCQ', 'thumbs_up_down', 'self_rating', 'error_identification')",
          "description": "string, REQUIRED - How this CFU works",
          "example": "string, REQUIRED - Specific example with Scottish context",
          "best_for": "string, REQUIRED - Lesson phase or card type this suits"
        }
      ],

      "misconceptions": [
        {
          "misconception_id": "string, REQUIRED - Unique identifier",
          "standard_ref": "string, REQUIRED - Assessment standard code this relates to",
          "misconception": "string, REQUIRED - Description of common student error",
          "why_it_happens": "string, REQUIRED - Cognitive reason for this error",
          "remediation": "string, REQUIRED - Teaching strategy to correct it",
          "example_student_work": "string, optional - Example showing this error",
          "corrected_example": "string, optional - Example showing correct approach"
        }
      ],

      "scaffolding_strategies": [
        {
          "strategy_name": "string, REQUIRED - Name of scaffolding approach",
          "description": "string, REQUIRED - How this scaffolding works",
          "application": "string, REQUIRED - When and how to apply in lessons",
          "example": "string, REQUIRED - Concrete example with Scottish context"
        }
      ]
    },

    "calculator_policy": {
      "non_calc_standards": ["array, REQUIRED - Assessment standards requiring non-calculator methods"],
      "calc_allowed_standards": ["array, REQUIRED - Assessment standards where calculators are permitted"],
      "staging_guidance": "string, REQUIRED - How to sequence non-calc → mixed → calc across course",
      "assessment_model_notes": "string, REQUIRED - Official SQA assessment model requirements"
    }
  },

  "guidance_for_author": {
    "sequencing_principles": [
      {
        "principle": "string, REQUIRED - Sequencing rule",
        "rationale": "string, REQUIRED - Why this sequencing matters",
        "application": "string, REQUIRED - How to apply in SOW authoring",
        "examples": ["array, optional - Example sequences following this principle"]
      }
    ],

    "context_hooks": [
      {
        "context_id": "string, REQUIRED - Unique identifier",
        "context_name": "string, REQUIRED - Name of Scottish context (e.g., 'Supermarket Shopping', 'Bus Fares')",
        "description": "string, REQUIRED - What this context involves",
        "engagement_tags": ["array, REQUIRED - Tags for this context (e.g., 'shopping', 'transport', 'finance')"],
        "standards_suited_for": ["array, REQUIRED - Assessment standards this context suits"],
        "example_scenarios": [
          {
            "scenario": "string, REQUIRED - Specific scenario description",
            "problem_statement": "string, REQUIRED - Example problem using this context",
            "scottish_authenticity_notes": "string, REQUIRED - Why this is authentically Scottish"
          }
        ],
        "usage_frequency": "string, optional - How often to use this context (e.g., 'high', 'medium', 'low')"
      }
    ],

    "accessibility_patterns": [
      {
        "pattern_name": "string, REQUIRED - Name of accessibility strategy",
        "target_need": "string, REQUIRED - Which accessibility need this addresses (e.g., 'dyslexia', 'dyscalculia', 'processing_speed')",
        "description": "string, REQUIRED - What this strategy involves",
        "application": "string, REQUIRED - How to implement in lesson cards",
        "example": "string, REQUIRED - Concrete example of application"
      }
    ],

    "lesson_type_guidance": {
      "teach_lessons": "string, REQUIRED - Guidance for designing teach lessons",
      "revision_lessons": "string, REQUIRED - Guidance for designing revision lessons",
      "formative_assessment_lessons": "string, REQUIRED - Guidance for formative assessment",
      "independent_practice_lessons": "string, REQUIRED - Guidance for independent practice",
      "mock_assessment_lessons": "string, REQUIRED - Guidance for mock assessments"
    },

    "chunking_examples": [
      {
        "example_name": "string, REQUIRED - Name of chunking example",
        "standards_chunked": ["array, REQUIRED - Assessment standard codes grouped together"],
        "thematic_coherence": "string, REQUIRED - Why these standards fit together",
        "lesson_sequence": "string, REQUIRED - Recommended lesson types for this chunk",
        "timing_notes": "string, optional - Duration guidance for this chunk"
      }
    ]
  },

  "citations": [
    {
      "citation_id": "string, REQUIRED - Unique identifier",
      "full_citation": "string, REQUIRED - Complete bibliographic reference",
      "source_type": "string, REQUIRED - Type of source (e.g., 'Official_SQA', 'Academic_Research', 'Teaching_Resource')",
      "credibility_rating": "string, optional - Assessment of source credibility (e.g., 'Official', 'High', 'Medium')",
      "key_contributions": "string, REQUIRED - What this source contributed to the research pack"
    }
  ],

  "metadata": {
    "research_pack_generated_date": "string, REQUIRED - ISO 8601 date of generation",
    "research_agent_version": "string, optional - Version of Research DeepAgent used",
    "course_data_file": "string, REQUIRED - Filename of Course_data.txt used",
    "course_data_checksum": "string, optional - Hash of Course_data.txt for verification",
    "quality_notes": "string, optional - Any quality concerns or limitations",
    "coverage_notes": "string, REQUIRED - Summary of what this research pack covers"
  }
}
```

---

## Field Details

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `research_pack_version` | int | Yes | Schema version (always 3 for current schema) |
| `subject` | string | Yes | Course subject matching SQA taxonomy |
| `level` | string | Yes | SQA qualification level |
| `exemplars_from_sources` | array[object] | Yes | Primary source documents with full content |
| `distilled_data` | object | Yes | Processed patterns extracted from exemplars |
| `guidance_for_author` | object | Yes | Explicit instructions for SOW authoring |
| `citations` | array[object] | Yes | Full source attributions for verification |
| `metadata` | object | Yes | Research provenance and quality notes |

---

### Exemplars From Sources

**Purpose**: Preserve full source documents for reference and verification

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_id` | string | Yes | Unique identifier (e.g., "SQA_SPEC_APPMATH_N5") |
| `source_type` | string | Yes | Type of source for categorization |
| `title` | string | Yes | Official title of source document |
| `full_content` | string | Yes | Complete extracted text or structured data |
| `summary` | string | Yes | 2-3 paragraph distillation of key insights |
| `usage_guidance` | string | Yes | How SOW Author should use this content |

**Source Types**:
- `SQA_Course_Specification` - Official course specifications
- `SQA_Assessment_Support_Pack` - SQA assessment materials
- `Scottish_Textbook` - Approved Scottish textbooks
- `Teaching_Guide` - CfE/SQA teaching guidance
- `Research_Paper` - Academic educational research
- `Classroom_Materials` - Authentic Scottish classroom resources

---

### Distilled Data: Canonical Terms

**Purpose**: Ensure consistent use of official SQA and CfE terminology

```json
"canonical_terms": {
  "sqa_terminology": [
    {
      "term": "assessment standard",
      "definition": "Specific measurable learning outcomes within an SQA course outcome",
      "usage_context": "Use when describing what students must demonstrate for assessment",
      "examples": [
        "Students must meet all assessment standards within Outcome 1",
        "This lesson addresses assessment standard AS1.2"
      ]
    }
  ],
  "cfe_principles": [
    {
      "principle": "Curriculum for Excellence",
      "description": "Scotland's curriculum framework emphasizing four capacities",
      "application": "Design lessons that develop confident individuals, successful learners, responsible citizens, and effective contributors"
    }
  ]
}
```

---

### Distilled Data: Assessment Stems

**Purpose**: Provide reusable question templates matching SQA style

```json
"assessment_stems": [
  {
    "stem_id": "MCQ_FRAC_EQUIV",
    "question_type": "MCQ",
    "stem_template": "Which fraction is equivalent to {decimal}?\nA) {option_a}\nB) {option_b}\nC) {option_c}\nD) {option_d}",
    "example_usage": "Which fraction is equivalent to 0.25?\nA) 1/2\nB) 1/4\nC) 1/3\nD) 1/5",
    "difficulty_level": "National 4",
    "standards_addressed": ["AS1.1", "AS1.2"],
    "marking_notes": "1 mark for correct identification of equivalent fraction"
  }
]
```

**Question Types**:
- `MCQ` - Multiple choice question
- `structured` - Multi-part question with scaffolding
- `extended_response` - Open-ended problem-solving
- `calculation` - Pure computation task
- `interpretation` - Graph/table reading and analysis
- `application` - Real-life problem scenario

---

### Distilled Data: Pedagogical Patterns

**Purpose**: Catalog proven teaching strategies observed in Scottish classrooms

#### Lesson Starters
```json
"lesson_starters": [
  {
    "pattern_name": "Real-Life Hook",
    "description": "Begin with authentic Scottish scenario students recognize",
    "example": "Show a Tesco receipt with percentages off various items. Ask: 'Which discount saves you the most money?'",
    "timing": "3-5 minutes",
    "best_for": "Introducing percentage calculations in context"
  }
]
```

#### CFU Variety Examples
```json
"cfu_variety_examples": [
  {
    "cfu_type": "MCQ",
    "description": "Multiple choice question with common misconceptions as distractors",
    "example": "Which fraction equals 25%? A) 1/2  B) 1/4  C) 1/3  D) 1/5",
    "best_for": "Quick formative check during explainer or modelling cards"
  }
]
```

**CFU Types Catalog**:
- `MCQ` - Multiple choice with distractors
- `thumbs_up_down` - Quick confidence check
- `self_rating` - 1-5 scale understanding
- `error_identification` - Find and fix mistakes
- `think_aloud` - Verbalize reasoning
- `structured_question` - Step-by-step problem
- `self_explanation` - Describe own thinking
- `compare_contrast` - Analyze differences
- `application_question` - Transfer to new context

#### Misconceptions
```json
"misconceptions": [
  {
    "misconception_id": "FRAC_LARGER_DENOM_LARGER_VALUE",
    "standard_ref": "AS1.1",
    "misconception": "Students believe 1/8 > 1/4 because 8 > 4",
    "why_it_happens": "Overgeneralization from whole number comparison",
    "remediation": "Use visual fraction bars showing 1/8 is smaller piece than 1/4. Compare using common contexts (pizza slices, chocolate bars)",
    "example_student_work": "Student writes: 1/8 is bigger than 1/4 because 8 is more than 4",
    "corrected_example": "1/4 = 0.25 and 1/8 = 0.125, so 1/4 > 1/8. When we divide something into more pieces, each piece is smaller."
  }
]
```

---

### Distilled Data: Calculator Policy

**Purpose**: Ensure proper calculator usage sequencing per SQA assessment model

```json
"calculator_policy": {
  "non_calc_standards": ["AS1.1", "AS1.2", "AS1.3"],
  "calc_allowed_standards": ["AS2.1", "AS2.3", "AS3.2"],
  "staging_guidance": "Introduce non-calculator methods first (Units 1-2), transition to mixed approach (Unit 3), allow calculators for complex applications (Unit 4)",
  "assessment_model_notes": "SQA assessment has Paper 1 (non-calculator, 1 hour) and Paper 2 (calculator, 1.5 hours). SOW must prepare students for both sections."
}
```

---

### Guidance for Author: Sequencing Principles

**Purpose**: Define ordering rules for SOW authoring

```json
"sequencing_principles": [
  {
    "principle": "Prerequisites First",
    "rationale": "Students cannot master advanced standards without foundational skills",
    "application": "Always sequence fractions before decimals before percentages",
    "examples": [
      "Lesson 1: Fraction notation and equivalence → Lesson 2: Fraction-decimal conversion → Lesson 3: Decimal-percentage conversion"
    ]
  }
]
```

---

### Guidance for Author: Context Hooks

**Purpose**: Catalog authentic Scottish scenarios for engagement

```json
"context_hooks": [
  {
    "context_id": "SUPERMARKET_SHOPPING",
    "context_name": "Supermarket Shopping",
    "description": "Discounts, unit pricing, loyalty cards, meal deals at Scottish supermarkets (Tesco, Asda, Sainsbury's)",
    "engagement_tags": ["shopping", "discounts", "finance"],
    "standards_suited_for": ["AS1.2", "AS2.1", "AS2.3"],
    "example_scenarios": [
      {
        "scenario": "Tesco meal deal comparison",
        "problem_statement": "A Tesco meal deal costs £3.50 (sandwich + drink + snack). Buying items separately costs £5.20. Calculate the percentage discount for the meal deal.",
        "scottish_authenticity_notes": "Tesco meal deals are ubiquitous in Scottish schools. Students encounter this daily."
      }
    ],
    "usage_frequency": "high"
  }
]
```

**Common Scottish Context Hooks**:
- Supermarket shopping (Tesco, Asda, Sainsbury's, Morrisons)
- Bus fares and Ridacard discounts (Scottish transport)
- NHS prescription costs
- Council tax calculations
- Scottish utility bills (electricity, water)
- Local sports club memberships
- Edinburgh Zoo, Glasgow Science Centre ticket prices
- Scottish cinema ticket deals (Vue, Cineworld, Odeon)
- High street shops (Primark, Sports Direct, local shops)
- Scottish food contexts (chippy prices, bakery deals)

---

### Guidance for Author: Accessibility Patterns

**Purpose**: Catalog proven accessibility strategies for Scottish learners

```json
"accessibility_patterns": [
  {
    "pattern_name": "Dyslexia-Friendly Layout",
    "target_need": "dyslexia",
    "description": "Use sans-serif fonts, increased line spacing, chunked text, bullet points",
    "application": "All lesson cards should use short paragraphs (3-4 lines max), bullet points for lists, clear headings",
    "example": "Instead of: 'To solve this problem we need to first convert the fraction to a decimal by dividing the numerator by the denominator and then...' → Use: '**Steps:**\n1. Convert fraction to decimal\n2. Multiply by 100\n3. Add % symbol'"
  }
]
```

---

### Guidance for Author: Chunking Examples

**Purpose**: Demonstrate successful standard consolidation

```json
"chunking_examples": [
  {
    "example_name": "Percentages in Context",
    "standards_chunked": ["AS1.2", "AS2.1", "AS2.3"],
    "thematic_coherence": "All three standards involve percentage calculations. AS1.2 covers computation, AS2.1 adds real-life context, AS2.3 focuses on problem-solving. Grouping creates rich, authentic percentage unit.",
    "lesson_sequence": "Teach lesson (introduce percentage notation + calculation) → Revision lesson (practice conversions) → Teach lesson (percentage applications) → Revision lesson (varied contexts) → Formative assessment (mixed problems) → Independent practice (exam-style)",
    "timing_notes": "6 lessons total, 4-5 weeks @ 2-3 periods/week"
  }
]
```

---

## Critical Requirements

### 1. Version Validation

**Requirement**: Research pack version must be 3

```json
{
  "research_pack_version": 3
}
```

This ensures compatibility with SOW Author Agent v2.0.

---

### 2. Complete Exemplar Content

**Requirement**: `exemplars_from_sources` must include `full_content` for verification

**Rationale**: SOW Author Agent may need to reference original sources for clarification or validation. Summaries alone lose critical details.

**Example**:
```json
{
  "source_id": "SQA_SPEC_APPMATH_N5_2021",
  "full_content": "[Complete SQA specification text, 5000+ words]",
  "summary": "National 5 Application of Mathematics focuses on..."
}
```

---

### 3. Distilled Patterns Must Be Actionable

**Requirement**: All pedagogical patterns must include concrete examples with Scottish contexts

**❌ BAD**:
```json
{
  "pattern_name": "Use real-life contexts",
  "description": "Apply mathematics to authentic scenarios"
}
```

**✅ GOOD**:
```json
{
  "pattern_name": "Scottish Supermarket Contexts",
  "description": "Use local supermarket scenarios for percentage calculations",
  "example": "Calculate 15% discount on £40 jacket at Primark Glasgow: £40 × 0.15 = £6 discount, final price = £34"
}
```

---

### 4. Calculator Policy Must Be Explicit

**Requirement**: Clearly categorize standards as non-calc vs calc-allowed

```json
"calculator_policy": {
  "non_calc_standards": ["AS1.1", "AS1.2", "AS1.3"],
  "calc_allowed_standards": ["AS2.1", "AS2.3"],
  "staging_guidance": "Introduce non-calc first (Units 1-2), then calc for complex problems (Units 3-4)"
}
```

This enables SOW Author to sequence lessons correctly per SQA assessment model.

---

### 5. Citations Must Be Verifiable

**Requirement**: All citations must include enough information for external verification

```json
{
  "citation_id": "SQA_2021_SPEC",
  "full_citation": "Scottish Qualifications Authority. (2021). National 5 Application of Mathematics Course Specification. SQA. Retrieved from https://www.sqa.org.uk/files_ccc/CourseSpecN5ApplicationsOfMathematics.pdf",
  "source_type": "Official_SQA",
  "credibility_rating": "Official",
  "key_contributions": "Official course structure, assessment standards, assessment model"
}
```

---

## Usage Guidelines

### For SOW Author Agent

1. **Read research pack** before authoring SOW:
   ```python
   research_pack = state["files"]["research_pack_json"]
   ```

2. **Extract relevant patterns** for current standard:
   ```python
   # Example: Finding misconceptions for AS1.2
   misconceptions = [
       m for m in research_pack["distilled_data"]["pedagogical_patterns"]["misconceptions"]
       if "AS1.2" in m["standard_ref"]
   ]
   ```

3. **Use context hooks** for engagement tags:
   ```python
   # Example: Finding Scottish contexts for percentage standards
   contexts = [
       c for c in research_pack["guidance_for_author"]["context_hooks"]
       if "AS2.1" in c["standards_suited_for"]
   ]
   ```

4. **Apply chunking examples** for lesson consolidation:
   ```python
   # Example: Finding chunking precedents for current standards
   similar_chunks = [
       ex for ex in research_pack["guidance_for_author"]["chunking_examples"]
       if set(current_standards).intersection(set(ex["standards_chunked"]))
   ]
   ```

---

### For Research DeepAgent (Generator)

1. **Extract from Course_data.txt**:
   - Official unit structure
   - Assessment standards with full descriptions
   - Recommended sequence
   - Assessment model and calculator policy

2. **Process exemplar sources**:
   - Extract full content for preservation
   - Summarize key insights (2-3 paragraphs)
   - Provide usage guidance for SOW Author

3. **Distill pedagogical patterns**:
   - Identify lesson starter patterns from exemplars
   - Catalog CFU variety from teaching guides
   - Extract misconceptions from research papers
   - Document scaffolding strategies

4. **Generate Scottish contexts**:
   - Catalog authentic scenarios (£, local services)
   - Map contexts to standards
   - Provide concrete example scenarios

5. **Write explicit guidance**:
   - Sequencing principles with rationale
   - Accessibility patterns with examples
   - Chunking examples with thematic coherence
   - Lesson type guidance

---

## Validation Checklist

- [ ] research_pack_version is 3
- [ ] subject and level match Course_data.txt
- [ ] exemplars_from_sources contains at least 3 primary sources
- [ ] All exemplars have full_content, summary, and usage_guidance
- [ ] canonical_terms includes SQA terminology and CfE principles
- [ ] assessment_stems includes varied question types
- [ ] pedagogical_patterns includes lesson_starters, cfu_variety_examples, misconceptions, scaffolding_strategies
- [ ] calculator_policy clearly categorizes non-calc vs calc-allowed standards
- [ ] guidance_for_author includes sequencing_principles, context_hooks, accessibility_patterns, chunking_examples
- [ ] All context_hooks use Scottish contexts (£, local services)
- [ ] All patterns include concrete examples (not abstract descriptions)
- [ ] citations include full bibliographic references
- [ ] metadata includes research_pack_generated_date and coverage_notes

---

## Related Documentation

- **SOW Schema**: `sow_schema.md` (output structure)
- **Lesson Card Schema**: `lesson_card_schema.md` (detailed card design)
- **SOW Author Prompts**: `../sow_author_prompts.py` (agent implementation)

---

## Rationale for Research Pack Structure

**Why separate exemplars from distilled data?**

- **Exemplars preserve original sources** for verification and deep dives when SOW Author needs clarification
- **Distilled data provides actionable patterns** ready for direct use in SOW authoring
- **Separation enables iterative refinement** - Research Agent can re-distill patterns without losing source material

**Why include guidance_for_author?**

- **Explicit instructions reduce ambiguity** - SOW Author knows exactly how to apply patterns
- **Chunking examples provide precedents** - Demonstrates successful standard consolidation
- **Accessibility patterns ensure inclusive design** - Embeds best practices from the start

**Why emphasize Scottish authenticity?**

- **Engagement requires cultural relevance** - Students connect with contexts they recognize (£, local shops, NHS)
- **Assessment authenticity matters** - SQA exams use Scottish contexts, so lessons must prepare students appropriately
- **CfE emphasizes local connection** - Curriculum for Excellence values learning grounded in Scottish life

This structure ensures research packs are comprehensive, verifiable, and immediately actionable for SOW authoring.
