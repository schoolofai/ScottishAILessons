# SoW Schema: Data Flow and Field Mapping

**Document Purpose**: This document explains the Scheme of Work (SoW) output schema by tracing where each field gets its information from the input research pack, showing the complete data flow through the SoW Author Agent.

**Last Updated**: 2025-10-12

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Input: Research Pack Schema](#input-research-pack-schema)
3. [Output: SoW Schema](#output-sow-schema)
4. [Field-by-Field Mapping](#field-by-field-mapping)
5. [Worked Example: Mathematics National 4](#worked-example-mathematics-national-4)

---

## System Overview

### Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      INPUT SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Research Pack JSON (from Research DeepAgent)                │
│    - Exemplars from SQA sources                                 │
│    - Distilled pedagogical patterns                             │
│    - Scottish context hooks                                     │
│                                                                  │
│ 2. Course_data.txt (from course_outcome_subagent)              │
│    - Official SQA course structure                              │
│    - Unit codes, outcomes, assessment standards                 │
│    - Recommended sequence and delivery notes                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   SoW AUTHOR AGENT                              │
├─────────────────────────────────────────────────────────────────┤
│ Guided by prompts in sow_author_prompts.py:                    │
│ - SOW_AGENT_PROMPT (orchestrator)                              │
│ - SOW_AUTHOR_SUBAGENT_PROMPT (authoring logic)                 │
│ - 5 × Critic prompts (validation)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      OUTPUT                                     │
├─────────────────────────────────────────────────────────────────┤
│ authored_sow_json - Complete SoW following schema               │
│                                                                  │
│ Key Components:                                                 │
│ - Document Identity ($id, courseId, version, status)           │
│ - Global Metadata (policy, accessibility, engagement)          │
│ - Ordered Entries (lesson playlist with 15+ fields per entry)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Input: Research Pack Schema

**Source File**: `langgraph-author-agent/data/Seeding_Data/input/research_packs/mathematics_national-4.json`

**Schema Version**: 3

### Research Pack Structure

```json
{
  "research_pack_version": 3,
  "subject": "mathematics",
  "level": "National 4",

  "exemplars_from_sources": [
    {
      "source": "URL to SQA/educational resource",
      "content": "Full extracted text from source",
      "summary": "Brief summary of content",
      "sow_context": "How to use this for SoW sequencing",
      "lesson_context": "How to use this for lesson templates"
    }
  ],

  "distilled_data": {
    "canonical_terms": [
      {
        "term": "Added Value Unit",
        "definition": "Official CfE/SQA definition",
        "application": "How to apply in SoW/lessons"
      }
    ],
    "assessment_stems": [
      {
        "stem": "Calculate...",
        "source": "SQA specimen papers",
        "example_usage": "Concrete example",
        "notes": "Marking/context notes"
      }
    ],
    "pedagogical_patterns": {
      "lesson_starters": ["Array of starter patterns"],
      "cfu_variety_examples": ["CFU approaches"],
      "misconceptions": ["Common student errors"],
      "rubric_shapes": ["Assessment rubric templates"],
      "accessibility_notes": ["Accessibility strategies"]
    },
    "calculator_policy": {
      "no_calculator_topics": ["Topics requiring no calculator"],
      "calculator_topics": ["Topics allowing calculators"],
      "notes": "Policy explanation"
    }
  },

  "guidance_for_author": {
    "sow_construction": {
      "sequencing_principles": ["Ordering rules"],
      "unit_breakdown_example": "Example structure",
      "duration_estimates": "Timing guidance",
      "context_hooks": ["Scottish context examples"]
    },
    "lesson_construction": {
      "card_design_patterns": ["Lesson structure patterns"],
      "recommended_cfu_mix": "CFU type distribution",
      "misconception_handling": "Remediation strategies",
      "engagement_tips": ["Engagement strategies"]
    }
  },

  "citations": [
    {
      "url": "Source URL",
      "title": "Source title",
      "publisher": "Organization",
      "date": "ISO date",
      "verification_note": "Why this source is trustworthy"
    }
  ],

  "metadata": {
    "research_date": "ISO datetime",
    "pack_completeness": "Self-assessment",
    "issues_or_gaps": "Known limitations"
  }
}
```

---

## Output: SoW Schema

**Output File**: `authored_sow_json` (written to agent's file state)

**Full Schema**: See `sow_author_prompts.py:212-286` (`<schema_sow_with_field_descriptions>`)

### SoW Structure Overview

```json
{
  "$id": "csow_<slug>",
  "courseId": "course_<id>",
  "version": 1,
  "status": "draft" | "published",

  "metadata": {
    "coherence": {
      "policy_notes": ["Array of policy statements"],
      "sequencing_notes": ["High-level ordering logic"]
    },
    "accessibility_notes": ["Global accessibility guidance"],
    "engagement_notes": ["Scottish context hooks"],
    "weeks": 10,
    "periods_per_week": 3
  },

  "entries": [
    {
      "order": 1,
      "lessonTemplateRef": "AUTO_TBD_1",
      "label": "Lesson title",
      "lesson_type": "teach | formative_assessment | ...",
      "coherence": {
        "unit": "Official SQA unit title",
        "block_name": "Sub-topic",
        "block_index": "1.1",
        "prerequisites": ["AUTO_TBD_k"]
      },
      "policy": {
        "calculator_section": "non_calc | calc | mixed",
        "assessment_notes": "Optional clarifications"
      },
      "engagement_tags": ["finance", "shopping"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.2"],
      "pedagogical_blocks": ["starter", "modelling", "..."],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": true
      },
      "estMinutes": 45,
      "notes": "Teacher guidance"
    }
  ],

  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

---

## Field-by-Field Mapping

This section traces each output field to its input source(s) and the prompt guidance that directs extraction.

### Document-Level Fields

#### `$id` (string)

**Purpose**: Unique identifier for this SoW document.

**Data Source**:
- **Generated** by SoW author agent (not from input)
- Pattern: `csow_` + slug or UUID

**Prompt Guidance**:
```
sow_author_prompts.py:216
"$id": "csow_<slug_or_uuid>",  // Unique SoW identifier (string).
```

**Extraction Logic**:
- LLM generates a slug from `subject` + `level`
- Example: `mathematics_national-4` → `csow_mathematics_national_4`
- Alternative: Generate UUID for guaranteed uniqueness

**Example**:
```json
// Input (research_pack_json):
"subject": "mathematics",
"level": "National 4"

// Output (authored_sow_json):
"$id": "csow_mathematics_national_4"
```

---

#### `courseId` (string)

**Purpose**: Links SoW to a specific course in Appwrite database.

**Data Source**:
- **From**: `Course_data.txt` (fetched by `course_outcome_subagent`)
- **Field**: Course document `$id`

**Prompt Guidance**:
```
sow_author_prompts.py:217
"courseId": "course_<id_or_slug>",  // Course this SoW belongs to (string).

sow_author_prompts.py:408-410
1. Read `Course_data.txt` to understand the official course structure.
2. Use exact unit titles from `course_structure.units[].title`.
```

**Extraction Logic**:
1. `course_outcome_subagent` fetches course from Appwrite using subject + level
2. Writes course data including `courseId` to `Course_data.txt`
3. SoW author reads `Course_data.txt` and extracts `courseId`

**Example**:
```json
// Course_data.txt:
{
  "courseId": "course_c84473",
  "title": "Mathematics (National 4)",
  ...
}

// Output (authored_sow_json):
"courseId": "course_c84473"
```

---

#### `version` (integer)

**Purpose**: Tracks iterations of the SoW.

**Data Source**:
- **Generated** by SoW author agent
- **Default**: Always `1` for initial draft

**Prompt Guidance**:
```
sow_author_prompts.py:218
"version": 1,  // Integer version, increment on republish.
```

**Extraction Logic**:
- First-time authoring: Set to `1`
- Revision workflow (future): Read existing SoW version, increment by 1

**Example**:
```json
"version": 1
```

---

#### `status` (string)

**Purpose**: Publication state for editorial workflow.

**Data Source**:
- **Generated** by SoW author agent
- **Default**: `"draft"` for newly authored SoWs

**Prompt Guidance**:
```
sow_author_prompts.py:219
"status": "draft" | "published",  // Publication state.

sow_author_prompts.py:447
"status": "string, 'draft' or 'published'",
```

**Extraction Logic**:
- Always set to `"draft"` on initial authoring
- Changed to `"published"` by separate publication workflow (not by author agent)

**Example**:
```json
"status": "draft"
```

---

### Metadata Fields

#### `metadata.coherence.policy_notes` (array of strings)

**Purpose**: High-level policy statements that shape course delivery.

**Data Source**:
- **Primary**: `research_pack_json.distilled_data.calculator_policy.notes`
- **Secondary**: `Course_data.txt.assessment_model.calculator_policy`
- **Inference**: LLM synthesizes from exemplars and guidance

**Prompt Guidance**:
```
sow_author_prompts.py:223-224
"policy_notes": [  // Short policy statements (e.g., "Non-calc first; calc later").
  "Non-calculator first; calculator consolidation later"
]

sow_author_prompts.py:504
- **metadata.coherence.policy_notes**: short global policy reminders (e.g., calculator staging).
```

**Extraction Logic**:
1. Read `research_pack_json.distilled_data.calculator_policy.notes`
2. Read `Course_data.txt.assessment_model.calculator_policy`
3. Synthesize concise policy statements
4. Include calculator staging, assessment frequency, differentiation

**Example**:
```json
// Input (research_pack_json):
{
  "distilled_data": {
    "calculator_policy": {
      "no_calculator_topics": ["Basic arithmetic", "Fractions, decimals, and percentages"],
      "calculator_topics": ["Trigonometry", "Pythagoras' theorem"],
      "notes": "The Added Value Unit has a non-calculator paper (20 minutes) and a calculator-permitted paper (40 minutes)."
    }
  }
}

// Output (authored_sow_json):
{
  "metadata": {
    "coherence": {
      "policy_notes": [
        "Non-calculator skills first; calculator introduced for complex calculations",
        "Formative assessments every 4-5 lessons to monitor progress",
        "Added Value Unit: 20-min non-calc + 40-min calc papers"
      ]
    }
  }
}
```

---

#### `metadata.coherence.sequencing_notes` (array of strings)

**Purpose**: Explains pedagogical ordering logic.

**Data Source**:
- **Primary**: `research_pack_json.guidance_for_author.sow_construction.sequencing_principles`
- **Secondary**: `Course_data.txt.course_structure.sequence_rationale`

**Prompt Guidance**:
```
sow_author_prompts.py:226-227
"sequencing_notes": [  // High-level ordering logic ("Fractions → Decimals → Percents").
  "Fractions → Decimals → Percents"
]

sow_author_prompts.py:505
- **metadata.coherence.sequencing_notes**: global topic flow to guide the playlist.
```

**Extraction Logic**:
1. Read `research_pack_json.guidance_for_author.sow_construction.sequencing_principles`
2. Read `Course_data.txt.course_structure.recommended_sequence`
3. Distill into 3-5 concise ordering statements

**Example**:
```json
// Input (research_pack_json):
{
  "guidance_for_author": {
    "sow_construction": {
      "sequencing_principles": [
        "Start with Expressions and Formulae to build foundational skills.",
        "Integrate Numeracy throughout the course to provide real-world context.",
        "Teach Relationships after Expressions and Formulae, as it builds on those concepts."
      ]
    }
  }
}

// Output (authored_sow_json):
{
  "metadata": {
    "coherence": {
      "sequencing_notes": [
        "Expressions and Formulae → Relationships (conceptual dependency)",
        "Numeracy integrated throughout for real-world application",
        "Foundation skills before complex applications"
      ]
    }
  }
}
```

---

#### `metadata.accessibility_notes` (array of strings)

**Purpose**: Universal Design for Learning (UDL) guidelines for all lessons.

**Data Source**:
- **Primary**: `research_pack_json.distilled_data.pedagogical_patterns.accessibility_notes`
- **Fallback**: General UDL best practices if research pack lacks detail

**Prompt Guidance**:
```
sow_author_prompts.py:230-231
"accessibility_notes": [  // Global accessibility pointers (plain language, pacing, chunking).
  "Use plain language; one instruction per line; provide worked steps."
]

sow_author_prompts.py:121-122 (Accessibility Critic validates):
"pattern": "plain_language_rules",
"guidance": "Use clear and simple language, avoiding jargon where possible."
```

**Extraction Logic**:
1. Read `research_pack_json.distilled_data.pedagogical_patterns.accessibility_notes`
2. Extract key patterns: `plain_language_rules`, `dyslexia_notes`
3. Synthesize into course-wide accessibility principles

**Example**:
```json
// Input (research_pack_json):
{
  "distilled_data": {
    "pedagogical_patterns": {
      "accessibility_notes": [
        {
          "pattern": "plain_language_rules",
          "guidance": "Use clear and simple language, avoiding jargon where possible. Explain mathematical terms in a straightforward way."
        },
        {
          "pattern": "dyslexia_notes",
          "guidance": "Use a dyslexia-friendly font (e.g., Arial, Comic Sans) and a clear layout. Use multi-sensory teaching methods, such as hands-on activities and visual aids."
        }
      ]
    }
  }
}

// Output (authored_sow_json):
{
  "metadata": {
    "accessibility_notes": [
      "Use plain language (CEFR B1 level); explain mathematical terms clearly",
      "One instruction per line; avoid long, complex sentences",
      "Dyslexia-friendly: Arial/Comic Sans font, 1.5 line spacing, clear layout",
      "Multi-sensory teaching: hands-on activities, visual aids, worked steps"
    ]
  }
}
```

---

#### `metadata.engagement_notes` (array of strings)

**Purpose**: Scottish context hooks for authentic, relatable problems.

**Data Source**:
- **Primary**: `research_pack_json.guidance_for_author.sow_construction.context_hooks`
- **Secondary**: `research_pack_json.exemplars_from_sources[].content` (Scottish references extracted)

**Prompt Guidance**:
```
sow_author_prompts.py:233-234
"engagement_notes": [  // Global context hooks the Lesson DeepAgent can reuse.
  "Use £ pricing, supermarket flyers, bus tickets, Scottish local services."
]

sow_author_prompts.py:510
- **engagement_tags**: signals authentic Scottish contexts for the Lesson DeepAgent.
```

**Extraction Logic**:
1. Read `research_pack_json.guidance_for_author.sow_construction.context_hooks`
2. Identify Scottish-specific references (£, Scottish places, local services)
3. Create 5-8 authentic context suggestions

**Example**:
```json
// Input (research_pack_json):
{
  "guidance_for_author": {
    "sow_construction": {
      "context_hooks": [
        "Planning a trip on ScotRail or First Bus.",
        "Calculating the cost of a day out at a Scottish landmark, such as Edinburgh Castle or Loch Lomond.",
        "Using data from the Scottish Government website for statistical tasks."
      ]
    }
  }
}

// Output (authored_sow_json):
{
  "metadata": {
    "engagement_notes": [
      "Use £ for all pricing (not $ or €)",
      "Scottish landmarks: Edinburgh Castle, Loch Lomond, Stirling Castle",
      "Transport: ScotRail, First Bus, Glasgow Subway",
      "Shops: Tesco, Morrisons, Co-op, Lidl (not Walmart)",
      "Services: NHS Scotland, council services, Scottish Water",
      "Data sources: Scottish Government statistics, local council data"
    ]
  }
}
```

---

#### `metadata.weeks` & `metadata.periods_per_week` (integers)

**Purpose**: Scheduling constraints for realistic course planning.

**Data Source**:
- **Primary**: `research_pack_json.guidance_for_author.sow_construction.duration_estimates`
- **Inference**: LLM calculates from total hours and typical Scottish school schedules

**Prompt Guidance**:
```
sow_author_prompts.py:236-237
"weeks": 10,  // Optional: planned teaching weeks for this block/term.
"periods_per_week": 3  // Optional: target periods per week.

sow_author_prompts.py:456-457
"weeks": "int, optional planned teaching weeks",
"periods_per_week": "int, optional periods per week"
```

**Extraction Logic**:
1. Read `research_pack_json.guidance_for_author.sow_construction.duration_estimates`
2. Parse total hours (e.g., "160 hours recommended")
3. Calculate: `weeks = total_hours / (periods_per_week * 50min_per_period)`
4. Adjust for Scottish school year (38-40 weeks minus holidays = ~32 teaching weeks)

**Example**:
```json
// Input (research_pack_json):
{
  "guidance_for_author": {
    "sow_construction": {
      "duration_estimates": "The recommended total time allocation for the course is 160 hours. This should be divided between the three units, with time for revision and the Added Value Unit."
    }
  }
}

// Calculation:
// 160 hours = 160 * 60 = 9,600 minutes
// Scottish school: 50-min periods, 3-4 periods/week typical for core subjects
// 9,600 min ÷ 50 min/period = 192 periods
// 192 periods ÷ 4 periods/week = 48 weeks (UNREALISTIC - exceeds school year!)
// Better: Spread across 32 teaching weeks (full academic year)
// 192 periods ÷ 32 weeks = 6 periods/week (double periods common)

// Output (authored_sow_json):
{
  "metadata": {
    "weeks": 32,
    "periods_per_week": 6  // Includes double periods for practicals/assessments
  }
}
```

---

### Entry-Level Fields

Each entry in the `entries[]` array represents one lesson specification. These fields map from various parts of the research pack and Course_data.txt.

#### `entries[].order` (integer)

**Purpose**: Enforces pedagogical sequence.

**Data Source**:
- **Generated** by SoW author agent based on sequencing logic
- **Informed by**:
  - `research_pack_json.guidance_for_author.sow_construction.sequencing_principles`
  - `Course_data.txt.course_structure.recommended_sequence`

**Prompt Guidance**:
```
sow_author_prompts.py:242
"order": 1,  // Integer sequence position.

sow_author_prompts.py:506
- **entries.order**: enforces the pedagogical sequence used by scheduling.

sow_author_prompts.py:413-414 (Sequencing requirement):
6. Follow the `recommended_sequence` in `course_structure.recommended_sequence` for high-level ordering.
```

**Extraction Logic**:
1. Read `Course_data.txt.course_structure.recommended_sequence` (e.g., ["Numeracy", "Expressions and Formulae", "Relationships"])
2. For each assessment standard, generate lesson sequence: teach → formative → practice → revision
3. Assign `order` starting from 1, incrementing for each entry
4. Validate prerequisites have lower order numbers

**Example**:
```json
// Course_data.txt:
{
  "course_structure": {
    "recommended_sequence": ["Unit 1: Numeracy", "Unit 2: Expressions and Formulae"]
  }
}

// Output (authored_sow_json):
{
  "entries": [
    { "order": 1, "label": "Teach: Selecting Notation (Numeracy)", "coherence": { "unit": "Numeracy" } },
    { "order": 2, "label": "Formative: Notation Check (Numeracy)", "coherence": { "unit": "Numeracy" } },
    { "order": 3, "label": "Practice: Apply Notation (Numeracy)", "coherence": { "unit": "Numeracy" } },
    { "order": 4, "label": "Revision: Numeracy Skills (Numeracy)", "coherence": { "unit": "Numeracy" } },
    { "order": 5, "label": "Teach: Simplifying Expressions", "coherence": { "unit": "Expressions and Formulae" } }
  ]
}
```

---

#### `entries[].lessonTemplateRef` (string)

**Purpose**: Placeholder for lesson template ID.

**Data Source**:
- **Generated** by SoW author agent (pattern: `AUTO_TBD_<n>`)

**Prompt Guidance**:
```
sow_author_prompts.py:243
"lessonTemplateRef": "AUTO_TBD_1",  // Placeholder; later replaced by a real lesson template $id.

sow_author_prompts.py:190
Where a template doesn't exist yet, set `lessonTemplateRef: "AUTO_TBD_<n>"`. The Lesson DeepAgent will replace these later with real template `$id`s.
```

**Extraction Logic**:
- Generate sequential placeholders: `AUTO_TBD_1`, `AUTO_TBD_2`, ...
- Lesson DeepAgent later replaces with real IDs: `lt_abc123`

**Example**:
```json
// SoW (initial authoring):
"lessonTemplateRef": "AUTO_TBD_1"

// After Lesson DeepAgent creates template:
"lessonTemplateRef": "lt_67890def12345"
```

---

#### `entries[].label` (string)

**Purpose**: Teacher-facing lesson title.

**Data Source**:
- **Synthesized** by LLM from:
  - `Course_data.txt.course_structure.units[].outcomes[].assessment_standards[].desc`
  - `entries[].lesson_type` (teach, practice, formative, etc.)
  - `entries[].coherence.block_name` (sub-topic)

**Prompt Guidance**:
```
sow_author_prompts.py:244
"label": "Percents from Fractions",  // Teacher-facing title for the block/lesson.

sow_author_prompts.py:464
"label": "string, short human-friendly title",
```

**Extraction Logic**:
1. Read assessment standard description from `Course_data.txt`
2. Identify lesson type (teach, formative, practice, revision)
3. Generate concise label: `<lesson_type>: <topic>` or just `<topic>`
4. Examples:
   - Teach lesson: "Percents from Fractions"
   - Formative: "Formative: Percentage Check"
   - Practice: "Practice: Real-World Percentages"

**Example**:
```json
// Course_data.txt:
{
  "assessment_standards": [
    {
      "code": "AS1.2",
      "desc": "Carry out calculations involving fractions, decimals and percentages"
    }
  ]
}

// Output entry 1 (teach):
{
  "order": 1,
  "label": "Fractions, Decimals, and Percentages",
  "lesson_type": "teach",
  "assessmentStandardRefs": ["AS1.2"]
}

// Output entry 2 (formative):
{
  "order": 2,
  "label": "Formative: Percentage Calculations Check",
  "lesson_type": "formative_assessment",
  "assessmentStandardRefs": ["AS1.2"]
}
```

---

#### `entries[].lesson_type` (enum)

**Purpose**: Defines pedagogical role in learning cycle.

**Data Source**:
- **Generated** by SoW author agent based on sequencing requirements
- **Informed by**: Prompt mandate to create teach → formative → practice → revision sequence

**Prompt Guidance**:
```
sow_author_prompts.py:246-247
"lesson_type":  // Lesson role to guide downstream authoring/scheduling:
  "teach" | "independent_practice" | "formative_assessment" | "mock_assessment" | "summative_assessment" | "project" | "revision" | "spiral_revisit",

sow_author_prompts.py:131-132 (Mandate):
For **each assessment standard** in every outcome, create a **multi-lesson sequence** that spans lesson types in order:
`teach → formative_assessment → independent_practice → revision → (optional) summative/mock_assessment`.
```

**Extraction Logic**:
1. For each assessment standard, generate 4-5 entries
2. Assign lesson types in order:
   - Entry 1: `"teach"`
   - Entry 2: `"formative_assessment"`
   - Entry 3: `"independent_practice"`
   - Entry 4: `"revision"`
   - Entry 5 (optional): `"mock_assessment"` or `"summative_assessment"`

**Example**:
```json
// Assessment Standard: AS1.1 (Selecting Notation and Units)

// Generated entries:
[
  { "order": 1, "lesson_type": "teach", "label": "Teach: Notation and Units", "assessmentStandardRefs": ["AS1.1"] },
  { "order": 2, "lesson_type": "formative_assessment", "label": "Formative: Notation Check", "assessmentStandardRefs": ["AS1.1"] },
  { "order": 3, "lesson_type": "independent_practice", "label": "Practice: Apply Notation", "assessmentStandardRefs": ["AS1.1"] },
  { "order": 4, "lesson_type": "revision", "label": "Revision: Notation Skills", "assessmentStandardRefs": ["AS1.1"] }
]
```

---

#### `entries[].coherence.unit` (string)

**Purpose**: Links entry to official SQA unit.

**Data Source**:
- **Primary**: `Course_data.txt.course_structure.units[].title`
- **Must be exact match** to official SQA unit name

**Prompt Guidance**:
```
sow_author_prompts.py:250
"unit": "Number & Proportion",  // Category used consistently across the course (human label).

sow_author_prompts.py:409
2. Use exact unit titles from `course_structure.units[].title`.

sow_author_prompts.py:560 (Authenticity Critic validates):
- Does the SoW use exact unit titles from Course_data.txt?
```

**Extraction Logic**:
1. Read `Course_data.txt.course_structure.units[]`
2. For each entry, assign to appropriate unit based on assessment standard's parent outcome
3. Use **exact** unit title (no abbreviations or modifications)

**Example**:
```json
// Course_data.txt:
{
  "course_structure": {
    "units": [
      {
        "code": "HV7Y 73",
        "title": "Applications of Mathematics: Manage Money and Data (National 3)"
      }
    ]
  }
}

// Output (authored_sow_json):
{
  "entries": [
    {
      "coherence": {
        "unit": "Applications of Mathematics: Manage Money and Data (National 3)"
      }
    }
  ]
}
```

---

#### `entries[].coherence.block_name` (string)

**Purpose**: Sub-topic within the unit (teacher-facing organizational label).

**Data Source**:
- **Synthesized** by LLM from:
  - `Course_data.txt.course_structure.units[].outcomes[].title` (outcome themes)
  - `research_pack_json.guidance_for_author.sow_construction.unit_breakdown_example`

**Prompt Guidance**:
```
sow_author_prompts.py:251
"block_name": "Percents",  // Sub-topic or theme.

sow_author_prompts.py:470
"block_name": "string, sub-topic label within the unit (teacher-facing)",
```

**Extraction Logic**:
1. Read outcome titles from `Course_data.txt`
2. Identify common themes (e.g., "Fractions", "Decimals", "Percents")
3. Group related assessment standards under thematic block names
4. Not official SQA terminology (flexible, teacher-friendly labels)

**Example**:
```json
// Course_data.txt:
{
  "outcomes": [
    {
      "id": "O1",
      "title": "Apply numerical skills to solve real-world problems involving fractions, decimals, percentages, ratios, and proportion"
    }
  ]
}

// LLM identifies sub-themes: Fractions, Decimals, Percentages, Ratios, Proportion

// Output entries:
[
  { "coherence": { "block_name": "Fractions" }, "assessmentStandardRefs": ["AS1.1"] },
  { "coherence": { "block_name": "Decimals" }, "assessmentStandardRefs": ["AS1.2"] },
  { "coherence": { "block_name": "Percentages" }, "assessmentStandardRefs": ["AS1.3"] }
]
```

---

#### `entries[].coherence.block_index` (string/number)

**Purpose**: Free-form ordering index within the block.

**Data Source**:
- **Generated** by SoW author agent
- **Pattern**: `"<block_number>.<lesson_within_block>"`

**Prompt Guidance**:
```
sow_author_prompts.py:252
"block_index": "2.1",  // Free-form index to keep order transparent to teachers.

sow_author_prompts.py:352
- Keep `coherence.block_index` ascending and transparent (e.g., "2.1", "2.2", "2.3").
```

**Extraction Logic**:
1. Group entries by `block_name`
2. Assign block number based on order of appearance
3. Within each block, assign sequential sub-index
4. Examples:
   - Block 1 (Fractions): `1.1`, `1.2`, `1.3`, `1.4`
   - Block 2 (Decimals): `2.1`, `2.2`, `2.3`, `2.4`

**Example**:
```json
// Entries for Block 2 (Decimals):
[
  { "order": 5, "coherence": { "block_name": "Decimals", "block_index": "2.1" }, "label": "Teach: Decimal Place Value" },
  { "order": 6, "coherence": { "block_name": "Decimals", "block_index": "2.2" }, "label": "Formative: Decimal Check" },
  { "order": 7, "coherence": { "block_name": "Decimals", "block_index": "2.3" }, "label": "Practice: Decimal Operations" },
  { "order": 8, "coherence": { "block_name": "Decimals", "block_index": "2.4" }, "label": "Revision: Decimal Skills" }
]
```

---

#### `entries[].coherence.prerequisites` (array of strings)

**Purpose**: Lists prior entries that must be completed first.

**Data Source**:
- **Inferred** by LLM from:
  - Mathematical/conceptual dependencies (fractions before percentages)
  - `research_pack_json.guidance_for_author.sow_construction.sequencing_principles`
  - Lesson type dependencies (teach before practice)

**Prompt Guidance**:
```
sow_author_prompts.py:253
"prerequisites": [ "AUTO_TBD_k" ]  // Optional: references to prior entries by placeholder.

sow_author_prompts.py:244 (Sequencing Critic validates):
- Are prerequisites in `coherence.prerequisites` satisfied (referenced entries occur earlier)?
```

**Extraction Logic**:
1. For each entry, identify conceptual dependencies
2. Reference prior entries by their `lessonTemplateRef` placeholder
3. Validate prerequisites have lower `order` numbers
4. Common patterns:
   - Formative depends on teach: `["AUTO_TBD_1"]`
   - Practice depends on formative: `["AUTO_TBD_2"]`
   - Revision depends on practice: `["AUTO_TBD_3"]`
   - Complex topics depend on foundation: Percentages depend on Fractions + Decimals

**Example**:
```json
// Entry 1: Teach Fractions
{
  "order": 1,
  "lessonTemplateRef": "AUTO_TBD_1",
  "label": "Teach: Fractions",
  "coherence": { "prerequisites": [] }  // No prerequisites (foundational)
}

// Entry 5: Teach Percentages (depends on fractions)
{
  "order": 5,
  "lessonTemplateRef": "AUTO_TBD_5",
  "label": "Teach: Percentages from Fractions",
  "coherence": {
    "prerequisites": ["AUTO_TBD_1", "AUTO_TBD_4"]  // Depends on Teach Fractions + Practice Fractions
  }
}
```

---

#### `entries[].policy.calculator_section` (enum)

**Purpose**: Defines calculator usage rules for this lesson.

**Data Source**:
- **Primary**: `research_pack_json.distilled_data.calculator_policy.no_calculator_topics` and `.calculator_topics`
- **Secondary**: `Course_data.txt.assessment_model.calculator_policy`

**Prompt Guidance**:
```
sow_author_prompts.py:257-258
"calculator_section":  // Guides Lesson DeepAgent policy.calculator_allowed:
  "non_calc" | "calc" | "mixed",

sow_author_prompts.py:351
- Use `policy.calculator_section` to stage calculator progression: non_calc → mixed → calc as appropriate.
```

**Extraction Logic**:
1. Read `research_pack_json.distilled_data.calculator_policy`
2. For each entry's topic, check if it appears in:
   - `no_calculator_topics` → Set `"non_calc"`
   - `calculator_topics` → Set `"calc"`
   - Both or neither → Set `"mixed"`
3. Follow staging principle: non_calc lessons come first, calc lessons later

**Example**:
```json
// Input (research_pack_json):
{
  "distilled_data": {
    "calculator_policy": {
      "no_calculator_topics": [
        "Basic arithmetic",
        "Fractions, decimals, and percentages",
        "Simplifying expressions"
      ],
      "calculator_topics": [
        "Trigonometry",
        "Pythagoras' theorem",
        "Area and volume of complex shapes"
      ]
    }
  }
}

// Output entries:
[
  // Early entries (foundation topics):
  { "order": 1, "label": "Teach: Basic Arithmetic", "policy": { "calculator_section": "non_calc" } },
  { "order": 2, "label": "Teach: Fractions", "policy": { "calculator_section": "non_calc" } },

  // Mid-course entries (transition):
  { "order": 15, "label": "Teach: Area of Rectangles", "policy": { "calculator_section": "mixed" } },

  // Late entries (complex calculations):
  { "order": 25, "label": "Teach: Pythagoras' Theorem", "policy": { "calculator_section": "calc" } },
  { "order": 26, "label": "Practice: Complex Volume Problems", "policy": { "calculator_section": "calc" } }
]
```

---

#### `entries[].policy.assessment_notes` (string, optional)

**Purpose**: Marking guidance specific to this lesson's assessments.

**Data Source**:
- **Primary**: `Course_data.txt.marking_guidance.guidance`
- **Secondary**: `research_pack_json.distilled_data.assessment_stems[].notes`

**Prompt Guidance**:
```
sow_author_prompts.py:259
"assessment_notes": "optional clarifications"

sow_author_prompts.py:318 (Policy Critic validates):
- Do assessment notes (rounding, unit handling, re-assessment guidance) appear in related entries?
```

**Extraction Logic**:
1. For formative/summative lesson types, include marking notes
2. Read `Course_data.txt.marking_guidance` (e.g., "Follow-through marking applies")
3. Read relevant assessment stem notes from research pack
4. Synthesize lesson-specific guidance (2-3 sentences max)

**Example**:
```json
// Course_data.txt:
{
  "marking_guidance": {
    "guidance": "Follow-through marking should be applied. If a candidate makes an error in one part of a question, subsequent marks should be awarded if the method is correct."
  }
}

// research_pack_json:
{
  "assessment_stems": [
    {
      "stem": "A shop is having a sale. Calculate the sale price.",
      "notes": "Real-world context question for the 'Numeracy' unit."
    }
  ]
}

// Output (formative assessment entry):
{
  "lesson_type": "formative_assessment",
  "label": "Formative: Percentage Calculations",
  "policy": {
    "calculator_section": "non_calc",
    "assessment_notes": "Follow-through marking applies. Round monetary amounts to 2 decimal places. Units (£) required in final answer."
  }
}
```

---

#### `entries[].engagement_tags` (array of strings)

**Purpose**: Context signals for Lesson DeepAgent to generate authentic problems.

**Data Source**:
- **Primary**: `research_pack_json.guidance_for_author.sow_construction.context_hooks`
- **Secondary**: `metadata.engagement_notes` (refined to lesson-specific tags)

**Prompt Guidance**:
```
sow_author_prompts.py:262
"engagement_tags": [ "finance", "shopping" ],  // Context signals for the Lesson DeepAgent to use.

sow_author_prompts.py:366 (Accessibility Critic validates):
- Are `engagement_tags` authentic, specific, and linked to Scottish contexts (e.g., "bus fares", "NHS services"), not generic terms?
```

**Extraction Logic**:
1. For each entry, identify relevant Scottish contexts
2. Map topic to engagement domains:
   - Percentages → `["shopping", "sales", "discounts"]`
   - Timetables → `["ScotRail", "bus_fares", "timetables"]`
   - Statistics → `["scottish_government_data", "census", "surveys"]`
3. Use specific tags (✅ "ScotRail") not generic (❌ "transport")

**Example**:
```json
// Input (research_pack_json):
{
  "guidance_for_author": {
    "sow_construction": {
      "context_hooks": [
        "Planning a trip on ScotRail or First Bus.",
        "Calculating the cost of a day out at a Scottish landmark, such as Edinburgh Castle or Loch Lomond."
      ]
    }
  }
}

// Output entries with lesson-specific engagement tags:
[
  {
    "label": "Teach: Percentages in Finance",
    "engagement_tags": ["shopping", "sales", "discounts", "Tesco", "Morrisons"]
  },
  {
    "label": "Practice: Timetable Problems",
    "engagement_tags": ["ScotRail", "bus_fares", "timetables", "journey_planning"]
  },
  {
    "label": "Teach: Statistical Graphs",
    "engagement_tags": ["scottish_government_data", "census", "population", "Glasgow", "Edinburgh"]
  }
]
```

---

#### `entries[].outcomeRefs` (array of strings)

**Purpose**: Maps entry to official SQA Learning Outcomes.

**Data Source**:
- **Primary**: `Course_data.txt.course_structure.units[].outcomes[].id`
- **Must match** official outcome IDs exactly

**Prompt Guidance**:
```
sow_author_prompts.py:264
"outcomeRefs": ["O1"],  // NEW: Outcome IDs from Course_data.txt (e.g., "O1").

sow_author_prompts.py:411
4. Map SoW entries to official outcomes from `course_structure.units[].outcomes[].id` (e.g., "O1").
```

**Extraction Logic**:
1. Read `Course_data.txt.course_structure.units[].outcomes[]`
2. For each entry, determine which outcome(s) it addresses
3. Use official outcome IDs (e.g., "O1", "O2", "O3")
4. An entry can address multiple outcomes (e.g., `["O1", "O3"]`)

**Example**:
```json
// Course_data.txt:
{
  "course_structure": {
    "units": [
      {
        "outcomes": [
          {
            "id": "O1",
            "title": "Apply numerical skills to solve real-world problems"
          },
          {
            "id": "O2",
            "title": "Use graphical methods to represent and interpret data"
          }
        ]
      }
    ]
  }
}

// Output entries:
[
  {
    "label": "Teach: Percentages in Finance",
    "outcomeRefs": ["O1"],  // Numerical skills
    "assessmentStandardRefs": ["AS1.2"]
  },
  {
    "label": "Teach: Bar Charts and Pie Charts",
    "outcomeRefs": ["O2"],  // Graphical methods
    "assessmentStandardRefs": ["AS2.1"]
  },
  {
    "label": "Project: Budget Planning",
    "outcomeRefs": ["O1", "O2"],  // Both numerical + graphical
    "assessmentStandardRefs": ["AS1.2", "AS2.1"]
  }
]
```

---

#### `entries[].assessmentStandardRefs` (array of strings)

**Purpose**: Maps entry to specific Assessment Standards (granular skill descriptors).

**Data Source**:
- **Primary**: `Course_data.txt.course_structure.units[].outcomes[].assessment_standards[].code`

**Prompt Guidance**:
```
sow_author_prompts.py:265
"assessmentStandardRefs": ["AS1.2"],  // NEW: Assessment Standard codes (e.g., "AS1.2").

sow_author_prompts.py:412
5. Reference assessment standards from `course_structure.units[].outcomes[].assessment_standards[].code` (e.g., "AS1.2").

sow_author_prompts.py:131-132 (CRITICAL MANDATE):
For **each assessment standard** in every outcome, create a **multi-lesson sequence** that spans lesson types in order:
`teach → formative_assessment → independent_practice → revision → (optional) summative/mock_assessment`.
```

**Extraction Logic**:
1. Read `Course_data.txt.course_structure.units[].outcomes[].assessment_standards[]`
2. **For each assessment standard**, generate 4-5 entries (THIS IS WHY THERE ARE TOO MANY LESSONS!)
3. All entries in the sequence share the same `assessmentStandardRefs`

**Example**:
```json
// Course_data.txt:
{
  "outcomes": [
    {
      "id": "O1",
      "assessment_standards": [
        {
          "code": "AS1.1",
          "desc": "Select and use appropriate notation and units for everyday situations"
        },
        {
          "code": "AS1.2",
          "desc": "Carry out calculations involving fractions, decimals and percentages"
        }
      ]
    }
  ]
}

// Output: 4 entries PER assessment standard (8 lessons for 2 standards)

// AS1.1 sequence:
[
  { "order": 1, "lesson_type": "teach", "label": "Teach: Notation and Units", "assessmentStandardRefs": ["AS1.1"] },
  { "order": 2, "lesson_type": "formative_assessment", "label": "Formative: Notation Check", "assessmentStandardRefs": ["AS1.1"] },
  { "order": 3, "lesson_type": "independent_practice", "label": "Practice: Apply Notation", "assessmentStandardRefs": ["AS1.1"] },
  { "order": 4, "lesson_type": "revision", "label": "Revision: Notation Skills", "assessmentStandardRefs": ["AS1.1"] }
]

// AS1.2 sequence:
[
  { "order": 5, "lesson_type": "teach", "label": "Teach: Fractions, Decimals, Percentages", "assessmentStandardRefs": ["AS1.2"] },
  { "order": 6, "lesson_type": "formative_assessment", "label": "Formative: FDP Check", "assessmentStandardRefs": ["AS1.2"] },
  { "order": 7, "lesson_type": "independent_practice", "label": "Practice: FDP Problems", "assessmentStandardRefs": ["AS1.2"] },
  { "order": 8, "lesson_type": "revision", "label": "Revision: FDP Skills", "assessmentStandardRefs": ["AS1.2"] }
]
```

**⚠️ This is the root cause of the "too many lessons" problem identified in the refactor spec!**

---

#### `entries[].pedagogical_blocks` (array of strings, optional)

**Purpose**: Structural hints for Lesson DeepAgent to organize lesson cards.

**Data Source**:
- **Primary**: `research_pack_json.guidance_for_author.lesson_construction.card_design_patterns`
- **Fallback**: Standard Scottish lesson structure if not specified

**Prompt Guidance**:
```
sow_author_prompts.py:267-268
"pedagogical_blocks": [  // NEW (optional): aids lesson-template authoring.
  "starter", "modelling", "guided_practice", "independent_practice", "exit_ticket"
]

sow_author_prompts.py:161-164 (card_design_patterns):
"Start with a short, engaging starter activity.",
"Introduce the main concept with clear explanations and worked examples.",
"Provide opportunities for students to practice the new skill through a variety of activities.",
"End with a plenary or exit ticket to assess understanding."
```

**Extraction Logic**:
1. Read `research_pack_json.guidance_for_author.lesson_construction.card_design_patterns`
2. Map patterns to pedagogical blocks:
   - "Start with starter activity" → `"starter"`
   - "Introduce concept with examples" → `"modelling"`
   - "Students practice with support" → `"guided_practice"`
   - "Students practice independently" → `"independent_practice"`
   - "End with plenary/exit ticket" → `"exit_ticket"`
3. Vary blocks by lesson type:
   - **teach**: `["starter", "modelling", "guided_practice", "exit_ticket"]`
   - **practice**: `["starter", "independent_practice", "exit_ticket"]`
   - **formative**: `["assessment_intro", "assessment_items", "feedback"]`

**Example**:
```json
// Input (research_pack_json):
{
  "guidance_for_author": {
    "lesson_construction": {
      "card_design_patterns": [
        "Start with a short, engaging starter activity.",
        "Introduce the main concept with clear explanations and worked examples.",
        "Provide opportunities for students to practice the new skill through a variety of activities.",
        "End with a plenary or exit ticket to assess understanding."
      ]
    }
  }
}

// Output (teach lesson):
{
  "lesson_type": "teach",
  "label": "Teach: Percentages from Fractions",
  "pedagogical_blocks": ["starter", "modelling", "guided_practice", "independent_practice", "exit_ticket"]
}

// Output (independent practice lesson):
{
  "lesson_type": "independent_practice",
  "label": "Practice: Real-World Percentage Problems",
  "pedagogical_blocks": ["starter", "independent_practice", "exit_ticket"]
}

// Output (formative assessment lesson):
{
  "lesson_type": "formative_assessment",
  "label": "Formative: Percentage Check",
  "pedagogical_blocks": ["assessment_intro", "assessment_items", "reflection"]
}
```

---

#### `entries[].accessibility_profile` Object

**Purpose**: Entry-level accessibility overrides beyond global settings.

**Data Source**:
- **Primary**: `research_pack_json.distilled_data.pedagogical_patterns.accessibility_notes`
- **Inference**: LLM determines which entries need special accessibility emphasis

##### `accessibility_profile.dyslexia_friendly` (boolean)

**Extraction Logic**:
1. Check if topic is text-heavy or requires extensive reading
2. Check if research pack emphasizes dyslexia support
3. Set `true` for lessons with:
   - Word problems with complex sentences
   - Multi-step instructions
   - Heavy text content

**Example**:
```json
// Text-heavy lesson:
{
  "label": "Teach: Interpreting Statistical Reports",
  "accessibility_profile": {
    "dyslexia_friendly": true  // Complex reading required
  }
}

// Calculation-heavy lesson:
{
  "label": "Practice: Basic Arithmetic",
  "accessibility_profile": {
    "dyslexia_friendly": false  // Minimal reading
  }
}
```

##### `accessibility_profile.plain_language_level` (string)

**Extraction Logic**:
1. Determine course level from `research_pack_json.level`
2. Map to CEFR levels:
   - National 3 → `"CEFR_A2"`
   - National 4 → `"CEFR_B1"`
   - National 5 → `"CEFR_B1"`
   - Higher → `"CEFR_B2"`

**Example**:
```json
// National 4 lesson:
{
  "accessibility_profile": {
    "plain_language_level": "CEFR_B1"  // Independent user
  }
}
```

##### `accessibility_profile.extra_time` (boolean)

**Extraction Logic**:
1. Set `true` for assessment lessons (formative, mock, summative)
2. Set `true` for complex problem-solving lessons
3. Set `false` for practice drills and starters

**Example**:
```json
// Assessment lesson:
{
  "lesson_type": "formative_assessment",
  "accessibility_profile": {
    "extra_time": true  // Students with ASN may need 1.5x time
  }
}

// Practice drill:
{
  "lesson_type": "independent_practice",
  "accessibility_profile": {
    "extra_time": false  // Self-paced practice
  }
}
```

---

#### `entries[].estMinutes` (integer)

**Purpose**: Planned duration for this lesson.

**Data Source**:
- **Inference**: Based on lesson type and Scottish school period lengths
- **Informed by**: `research_pack_json.guidance_for_author.sow_construction.duration_estimates`

**Prompt Guidance**:
```
sow_author_prompts.py:277
"estMinutes": 45,  // Rough duration target for a session/lesson.

sow_author_prompts.py:321
- Do `estMinutes` values align with Scottish classroom periods (25–50 minutes)?
```

**Extraction Logic**:
1. Assign duration by lesson type:
   - **teach**: 45-50 minutes (full period)
   - **formative_assessment**: 25-35 minutes (short check)
   - **independent_practice**: 45 minutes (full period)
   - **revision**: 45-50 minutes (full period)
   - **mock_assessment**: 90-120 minutes (double period)
   - **summative_assessment**: 60-120 minutes (exam conditions)
   - **project**: 180-300 minutes (multi-session)

**Example**:
```json
[
  { "lesson_type": "teach", "estMinutes": 45 },
  { "lesson_type": "formative_assessment", "estMinutes": 30 },
  { "lesson_type": "independent_practice", "estMinutes": 45 },
  { "lesson_type": "revision", "estMinutes": 50 },
  { "lesson_type": "mock_assessment", "estMinutes": 90 }
]
```

---

#### `entries[].notes` (string)

**Purpose**: Teacher guidance not shown to students.

**Data Source**:
- **Synthesized** from multiple sources:
  - `research_pack_json.distilled_data.pedagogical_patterns.misconceptions`
  - `research_pack_json.guidance_for_author.lesson_construction.misconception_handling`
  - `research_pack_json.guidance_for_author.lesson_construction.engagement_tips`
  - Entry-specific context from `engagement_tags` and assessment standards

**Prompt Guidance**:
```
sow_author_prompts.py:278
"notes": "Use real supermarket flyers; model 10%+5% breakdowns."

sow_author_prompts.py:494
"notes": "string, teacher guidance not shown to students"
```

**Extraction Logic**:
1. Identify common misconceptions for this topic
2. Add teaching tips from engagement strategies
3. Include resource suggestions (manipulatives, real-world materials)
4. Synthesize into 2-4 sentences

**Example**:
```json
// Input (research_pack_json):
{
  "distilled_data": {
    "pedagogical_patterns": {
      "misconceptions": [
        "Errors in converting between fractions, decimals, and percentages."
      ]
    }
  },
  "guidance_for_author": {
    "lesson_construction": {
      "engagement_tips": [
        "Use real-world examples and contexts that are relevant to students' lives."
      ]
    }
  }
}

// Output (teach lesson on percentages):
{
  "label": "Teach: Percentages from Fractions",
  "engagement_tags": ["shopping", "sales", "discounts"],
  "notes": "Common misconception: dividing by 100 always. Emphasize fraction → decimal → percentage pathway. Use real supermarket flyers showing discounts (e.g., '20% off at Tesco'). Model 10% + 5% breakdown for 15%."
}
```

---

### Timestamps

#### `createdAt` & `updatedAt` (ISO datetime strings)

**Data Source**:
- **Generated** at runtime using current timestamp

**Prompt Guidance**:
```
sow_author_prompts.py:283-284
"createdAt": "2025-09-01T08:00:00Z",  // ISO UTC strings.
"updatedAt": "2025-09-01T10:00:00Z"
```

**Extraction Logic**:
- `createdAt`: Set to current timestamp when SoW is first authored
- `updatedAt`: Set to current timestamp; updated whenever SoW is revised

**Example**:
```json
{
  "createdAt": "2025-10-12T14:30:00Z",
  "updatedAt": "2025-10-12T14:30:00Z"  // Same initially
}

// After revision:
{
  "createdAt": "2025-10-12T14:30:00Z",  // Unchanged
  "updatedAt": "2025-10-15T09:15:00Z"   // Updated
}
```

---

## Worked Example: Mathematics National 4

Let's trace how the actual `mathematics_national-4.json` research pack produces a SoW.

### Input: Research Pack Extract

```json
{
  "research_pack_version": 3,
  "subject": "mathematics",
  "level": "National 4",

  "distilled_data": {
    "canonical_terms": [
      {
        "term": "Numeracy",
        "definition": "One of the three mandatory units, developing fundamental numerical skills",
        "application": "This unit should be a core component of the SoW, with a focus on practical applications."
      }
    ],
    "calculator_policy": {
      "no_calculator_topics": ["Basic arithmetic", "Fractions, decimals, and percentages"],
      "calculator_topics": ["Trigonometry", "Pythagoras' theorem"],
      "notes": "The Added Value Unit has a non-calculator paper (20 minutes) and a calculator-permitted paper (40 minutes)."
    }
  },

  "guidance_for_author": {
    "sow_construction": {
      "sequencing_principles": [
        "Start with Expressions and Formulae to build foundational skills.",
        "Integrate Numeracy throughout the course to provide real-world context."
      ],
      "duration_estimates": "The recommended total time allocation for the course is 160 hours.",
      "context_hooks": [
        "Planning a trip on ScotRail or First Bus.",
        "Calculating the cost of a day out at a Scottish landmark, such as Edinburgh Castle."
      ]
    }
  }
}
```

### Course_data.txt Extract (from course_outcome_subagent)

```
courseId: course_c84473
title: Mathematics (National 4)

course_structure:
  units:
    - code: HV7Y 73
      title: Numeracy (National 4)
      outcomes:
        - id: O1
          title: Apply numerical skills to solve real-world problems
          assessment_standards:
            - code: AS1.1
              desc: Select and use appropriate notation and units for everyday situations
            - code: AS1.2
              desc: Carry out calculations involving fractions, decimals and percentages

assessment_model:
  calculator_policy: "Calculators may be used in Paper 2 (40 minutes). Paper 1 (20 minutes) is non-calculator."
```

### Output: Authored SoW (Partial)

```json
{
  "$id": "csow_mathematics_national_4",
  "courseId": "course_c84473",
  "version": 1,
  "status": "draft",

  "metadata": {
    "coherence": {
      "policy_notes": [
        "Non-calculator skills first (Papers 1); calculator introduced for complex calculations (Paper 2)",
        "Formative assessments every 4-5 lessons to monitor progress"
      ],
      "sequencing_notes": [
        "Expressions and Formulae → Relationships (conceptual dependency)",
        "Numeracy integrated throughout for real-world application"
      ]
    },
    "accessibility_notes": [
      "Use plain language (CEFR B1 level); explain mathematical terms clearly",
      "Dyslexia-friendly: Arial font, 1.5 line spacing, clear layout"
    ],
    "engagement_notes": [
      "Use £ for all pricing (not $ or €)",
      "Scottish landmarks: Edinburgh Castle, Loch Lomond",
      "Transport: ScotRail, First Bus, Glasgow Subway",
      "Shops: Tesco, Morrisons, Co-op"
    ],
    "weeks": 32,
    "periods_per_week": 6
  },

  "entries": [
    // ========================================
    // Assessment Standard AS1.1 Sequence
    // ========================================
    {
      "order": 1,
      "lessonTemplateRef": "AUTO_TBD_1",
      "label": "Selecting Notation and Units",
      "lesson_type": "teach",
      "coherence": {
        "unit": "Numeracy (National 4)",
        "block_name": "Everyday Mathematics",
        "block_index": "1.1",
        "prerequisites": []
      },
      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": null
      },
      "engagement_tags": ["measurement", "cooking", "DIY"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.1"],
      "pedagogical_blocks": ["starter", "modelling", "guided_practice", "exit_ticket"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": false
      },
      "estMinutes": 45,
      "notes": "Focus on everyday units: cm/m/km, g/kg, ml/l. Use real recipes and DIY scenarios."
    },
    {
      "order": 2,
      "lessonTemplateRef": "AUTO_TBD_2",
      "label": "Formative: Notation Check",
      "lesson_type": "formative_assessment",
      "coherence": {
        "unit": "Numeracy (National 4)",
        "block_name": "Everyday Mathematics",
        "block_index": "1.2",
        "prerequisites": ["AUTO_TBD_1"]
      },
      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": "Units required in all answers. Follow-through marking applies."
      },
      "engagement_tags": ["measurement", "cooking"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.1"],
      "pedagogical_blocks": ["assessment_intro", "assessment_items", "reflection"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": true
      },
      "estMinutes": 30,
      "notes": "Quick check of notation understanding. Use mini-whiteboards for instant feedback."
    },
    {
      "order": 3,
      "lessonTemplateRef": "AUTO_TBD_3",
      "label": "Practice: Apply Notation in Context",
      "lesson_type": "independent_practice",
      "coherence": {
        "unit": "Numeracy (National 4)",
        "block_name": "Everyday Mathematics",
        "block_index": "1.3",
        "prerequisites": ["AUTO_TBD_2"]
      },
      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": null
      },
      "engagement_tags": ["ScotRail", "journey_planning", "timetables"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.1"],
      "pedagogical_blocks": ["starter", "independent_practice", "exit_ticket"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": false
      },
      "estMinutes": 45,
      "notes": "Use real ScotRail timetables. Students calculate journey times using 24-hour clock notation."
    },
    {
      "order": 4,
      "lessonTemplateRef": "AUTO_TBD_4",
      "label": "Revision: Notation and Units",
      "lesson_type": "revision",
      "coherence": {
        "unit": "Numeracy (National 4)",
        "block_name": "Everyday Mathematics",
        "block_index": "1.4",
        "prerequisites": ["AUTO_TBD_3"]
      },
      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": null
      },
      "engagement_tags": ["mixed_contexts"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.1"],
      "pedagogical_blocks": ["starter", "revision_activities", "exit_ticket"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": false
      },
      "estMinutes": 50,
      "notes": "Mixed revision covering all notation and unit conversions from AS1.1."
    },

    // ========================================
    // Assessment Standard AS1.2 Sequence
    // ========================================
    {
      "order": 5,
      "lessonTemplateRef": "AUTO_TBD_5",
      "label": "Fractions, Decimals, and Percentages",
      "lesson_type": "teach",
      "coherence": {
        "unit": "Numeracy (National 4)",
        "block_name": "Number Skills",
        "block_index": "2.1",
        "prerequisites": ["AUTO_TBD_1"]
      },
      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": null
      },
      "engagement_tags": ["shopping", "sales", "discounts", "Tesco"],
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.2"],
      "pedagogical_blocks": ["starter", "modelling", "guided_practice", "independent_practice", "exit_ticket"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": false
      },
      "estMinutes": 45,
      "notes": "Common misconception: always dividing by 100. Use fraction → decimal → percentage pathway. Real supermarket flyers showing '20% off at Tesco'."
    }
    // ... continues for formative, practice, revision of AS1.2 ...
  ],

  "createdAt": "2025-10-12T14:30:00Z",
  "updatedAt": "2025-10-12T14:30:00Z"
}
```

### Key Mappings Demonstrated

| Output Field | Input Source | Example |
|-------------|--------------|---------|
| `$id` | Generated from `subject` + `level` | `"csow_mathematics_national_4"` |
| `courseId` | `Course_data.txt.courseId` | `"course_c84473"` |
| `metadata.coherence.policy_notes` | `calculator_policy.notes` + `assessment_model` | `"Non-calculator skills first..."` |
| `metadata.engagement_notes` | `context_hooks[]` | `"Transport: ScotRail, First Bus"` |
| `entries[].coherence.unit` | `Course_data.txt.units[].title` (EXACT) | `"Numeracy (National 4)"` |
| `entries[].policy.calculator_section` | `calculator_policy.no_calculator_topics` | `"non_calc"` for fractions |
| `entries[].engagement_tags` | `context_hooks[]` (refined) | `["shopping", "sales", "Tesco"]` |
| `entries[].outcomeRefs` | `Course_data.txt.outcomes[].id` | `["O1"]` |
| `entries[].assessmentStandardRefs` | `Course_data.txt.assessment_standards[].code` | `["AS1.1"]` |
| `entries[].notes` | `misconceptions[]` + `engagement_tips[]` | `"Common misconception: dividing by 100..."` |

---

## Summary: Data Flow Principles

1. **Official SQA Data is Authoritative**:
   - `Course_data.txt` provides ground truth for units, outcomes, assessment standards
   - SoW must use **exact** terminology (validated by Authenticity Critic)

2. **Research Pack Provides Context**:
   - Calculator policies, pedagogical patterns, Scottish contexts
   - Synthesized into SoW metadata and entry-level guidance

3. **Prompt Mandates Drive Structure**:
   - Per-assessment-standard sequencing creates 4-5 lessons each
   - Lesson type progression: teach → formative → practice → revision

4. **LLM Synthesizes and Infers**:
   - Block names (not official SQA terms)
   - Prerequisites (conceptual dependencies)
   - Engagement tags (refined from context hooks)
   - Teacher notes (synthesized from misconceptions + tips)

5. **Critics Validate Traceability**:
   - Coverage Critic: All outcomes/standards addressed?
   - Authenticity Critic: Exact SQA terminology used?
   - Policy Critic: Calculator staging matches research pack?

---

**Next Steps**:
- See `tasks/sow_prompt-refactor.md` for proposals to reduce lesson count
- See `sow_author_prompts.py` for full prompt implementation
- See `data/Seeding_Data/output/sows/` for generated SoW examples

---

**Document Maintainer**: AI Systems Team
**Related Docs**: `tasks/sow_prompt-refactor.md`, `CLAUDE.md`
**Last Updated**: 2025-10-12
