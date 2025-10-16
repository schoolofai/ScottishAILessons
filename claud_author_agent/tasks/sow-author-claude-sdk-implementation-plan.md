# SOW Author Implementation Plan - Claude Agent SDK

**Created:** 2025-10-15
**Updated:** 2025-10-15 (Simplified to flat file structure)
**Status:** Planning
**Target:** Replicate LangGraph SOW author functionality using Claude Agent SDK

---

## 🔄 Recent Update: Simplified Filesystem

**Changed from:** Subdirectory structure (`/research/`, `/course_data/`, `/authored/`, `/output/`)
**Changed to:** Flat file structure (all 4 files in root workspace)

**Files:**
1. `research_pack_json`
2. `Course_data.txt`
3. `authored_sow_json`
4. `sow_critic_result_json`

This simplification reduces complexity while maintaining the context engineering pattern.

---

## Executive Summary

Implement a SOW (Scheme of Work) author agent using Claude Agent SDK that:
- Takes `{subject, level}` as input (matching `sqa_education.current_sqa` format)
- Generates research pack via research subagent
- Extracts SQA course data via Appwrite MCP
- Authors complete SOW following Scottish curriculum standards
- Validates via unified critic
- Upserts to Appwrite database via MCP

**Key Difference from LangGraph Version:** Fully autonomous pipeline from subject/level → authored SOW in database (no external file dependencies).

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOW Author Claude Client                      │
│                      (Main Orchestrator)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │  Isolated Filesystem  │
                │   /workspace/         │
                │   (flat structure)    │
                │   - research_pack_json│
                │   - Course_data.txt   │
                │   - authored_sow_json │
                │   - sow_critic_result │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Research    │    │ Course Data  │    │ SOW Author   │
│  Subagent    │───▶│  Extractor   │───▶│  Subagent    │
│              │    │  Subagent    │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │   Unified    │
                                        │   Critic     │
                                        │   Subagent   │
                                        └──────┬───────┘
                                               │
                                        [Pass? ├─No──▶ Retry
                                               │       (max 3)
                                               ├─Yes
                                               ▼
                                        ┌──────────────┐
                                        │   Upserter   │
                                        │   Subagent   │
                                        │  (Appwrite)  │
                                        └──────────────┘
```

### 1.2 Key Design Principles

1. **Filesystem-Based Context Engineering**: Each subagent reads/writes files in shared workspace to offload context
2. **Fail-Fast Validation**: Check prerequisites before execution (MCP connectivity, input schema)
3. **Comprehensive Logging**: Track execution at each stage with timestamps and costs
4. **Todo Tracking**: Use SDK TodoWrite for progress monitoring
5. **Workspace Persistence**: Keep files for debugging (controlled by flag)
6. **Cost Transparency**: Report token usage and costs per subagent

---

## 2. Input/Output Specification

### 2.1 Input Schema

```json
{
  "subject": "application_of_mathematics",
  "level": "national_3"
}
```

**Format Rules:**
- Subject: underscore-separated, matches `sqa_education.current_sqa.subject`
- Level: underscore-separated, matches `sqa_education.current_sqa.level`
- Example conversions:
  - `"Application of Mathematics"` → `"application_of_mathematics"`
  - `"National 3"` → `"national_3"`

### 2.2 Output Schema

```json
{
  "execution_id": "abc12345",
  "session_id": "session_xyz",
  "result": "success",
  "sow_document_id": "67890abc",
  "workspace": "/tmp/agent_abc12345_xyz/",
  "files": {
    "research_pack": "/workspace/research_pack_json",
    "course_data": "/workspace/Course_data.txt",
    "authored_sow": "/workspace/authored_sow_json",
    "critic_result": "/workspace/sow_critic_result_json"
  },
  "metrics": {
    "total_cost_usd": 0.45,
    "message_count": 23,
    "execution_time_sec": 125.3,
    "subagent_costs": {
      "research": 0.12,
      "course_data_extractor": 0.03,
      "sow_author": 0.20,
      "unified_critic": 0.08,
      "upserter": 0.02
    }
  },
  "todos": [
    {"content": "Research Scottish contexts", "status": "completed"},
    {"content": "Extract SQA course data", "status": "completed"},
    {"content": "Author SOW", "status": "completed"},
    {"content": "Validate with critic", "status": "completed"},
    {"content": "Upsert to Appwrite", "status": "completed"}
  ]
}
```

---

## 3. Subagent Definitions

### 3.1 Research Subagent

**Role:** Create comprehensive research pack for Scottish curriculum

**Input:**
- Subject (e.g., "application_of_mathematics")
- Level (e.g., "national_3")

**Output:**
- `research_pack_json` (v3 schema)

**Tools:**
- `WebSearch` (for Scottish curriculum resources)
- `Write` (to create research pack file)
- `TodoWrite` (progress tracking)

**Prompt (based on LangGraph `SUB_RESEARCH_PROMPT`):**

```markdown
# Research Subagent - Scottish Curriculum Researcher

You are a dedicated researcher specializing in Scottish secondary education (CfE and SQA).

## Your Task

Conduct comprehensive research and create a research pack v3 for:
- **Subject**: {subject}
- **Level**: {level}

## Grounding Data Source

IMPORTANT: A file `/workspace/Course_data.txt` will contain official SQA course data for this subject/level.

When conducting your research, you MUST:
- Consult this file first for accurate unit names, codes, outcome descriptions, assessment standards, and SQA terminology
- Ensure all findings align with official SQA specifications
- Use official terminology from Course_data.txt in your research pack

## Research Areas

### 1. Official SQA Resources
- Course specifications and assessment exemplars
- Marking schemes and examiner reports
- Official terminology and standards

### 2. Scottish Curriculum Frameworks (CfE)
- Curriculum for Excellence principles
- Benchmark standards for this level
- Progression pathways

### 3. Pedagogical Patterns
- Lesson starters appropriate for this level
- CFU (Check for Understanding) strategies for Scottish one-to-one AI tutoring
- Common misconceptions documented in SQA materials
- Effective teaching approaches for Scottish students

### 4. Scottish Context Hooks
- Currency: Always £ (never $ or €)
- Scottish services: NHS, councils, transport (Ridacard, bus fares)
- Scottish contexts: Tesco, Asda, Edinburgh Zoo, Glasgow Science Centre
- Scottish high street: Primark, Sports Direct, local shops

### 5. Assessment Stems
- Question stems matching SQA assessment style
- Specific to this subject and level
- Extracted from SQA exemplars

### 6. Accessibility Strategies
- Dyslexia-friendly approaches
- Plain language guidelines
- Extra time provisions
- Strategies documented in SQA accessibility guidance

## Output Format

Write your complete research pack to:
**File Path**: `/workspace/research_pack_json`

**Schema**: Research Pack v3
```json
{
  "research_pack_version": 3,
  "subject": "{subject}",
  "level": "{level}",
  "exemplars_from_sources": [
    {
      "source_title": "...",
      "source_url": "...",
      "source_type": "sqa_exemplar | pedagogical_guide | ...",
      "relevant_extract": "...",
      "relevance": "..."
    }
  ],
  "distilled_data": {
    "canonical_terms": { ... },
    "assessment_stems": [ ... ],
    "pedagogical_patterns": { ... },
    "calculator_policy": { ... }
  },
  "guidance_for_author": {
    "sequencing_principles": [ ... ],
    "context_hooks": [ ... ],
    "accessibility_patterns": [ ... ],
    "chunking_examples": [ ... ]
  },
  "citations": [ ... ],
  "research_metadata": {
    "date_generated": "ISO timestamp",
    "research_duration_minutes": number
  }
}
```

## Quality Requirements

- **At least 5 exemplars** with full source content and citations
- **Canonical terms** directly from CfE/SQA documentation
- **Authentic Scottish contexts** throughout (no Americanisms)
- **Specific pedagogical patterns** (not generic advice like "ask questions")
- **Assessment stems** matching SQA question style and difficulty for this level
- **Complete citations** for all sources

## Workflow

1. Read `/workspace/Course_data.txt` to understand official SQA structure
2. Conduct web research using WebSearch tool
3. Extract relevant information from sources
4. Organize into research pack v3 schema
5. Write complete JSON to `/workspace/research_pack_json`
6. Use TodoWrite to track research progress

Conduct thorough research and create a comprehensive pack. Only your FINAL research pack will be passed to the SOW author.
```

**Success Criteria:**
- Valid research_pack_json file created
- All required v3 schema fields present
- At least 5 exemplars with complete sources
- Scottish contexts identified and authentic
- Pedagogical patterns specific to level
- Alignment with Course_data.txt verified

---

### 3.2 Course Data Extractor Subagent

**Role:** Fetch official SQA course data from Appwrite database

**Input:**
- Subject (normalized format)
- Level (normalized format)

**Output:**
- `Course_data.txt` (SQA course specification)

**Tools:**
- `mcp__appwrite__databases_list_documents`
- `Write`
- `TodoWrite`

**Prompt:**

```markdown
# Course Data Extractor Subagent

You are a database specialist extracting official SQA course data from Appwrite.

## Your Task

Extract complete SQA course data for:
- **Subject**: {subject}
- **Level**: {level}

## Process

### Step 1: Query Appwrite Database

Use `mcp__appwrite__databases_list_documents` with:
- **Database**: `sqa_education`
- **Collection**: `current_sqa`
- **Query Filters**:
  ```json
  [
    Query.equal('subject', '{subject}'),
    Query.equal('level', '{level}'),
    Query.limit(1)
  ]
  ```

### Step 2: Validate Response

Check:
- ✓ At least 1 document returned
- ✓ Required fields present: course_name, units, outcomes, assessment_standards
- ✓ Descriptions not truncated

**Handle Edge Cases:**
- **No documents found**: Throw error with message: "No SQA course data found for {subject} at {level}. Check subject/level formatting."
- **Multiple documents**: Select the first (most recent by default)
- **Missing required fields**: Throw error listing missing fields

### Step 3: Format as Readable Text

Extract and format the following structure:

```
# SQA Course Data: {course_name}
Subject: {subject}
Level: {level}
Course Code: {course_code}

## Units

### Unit 1: {unit_name}
Code: {unit_code}
Description: {unit_description}

#### Outcomes
- O1: {outcome_description}
- O2: {outcome_description}

#### Assessment Standards
- AS1.1: {standard_description}
- AS1.2: {standard_description}

[Repeat for all units]

## Marking Guidance
{marking_guidance if available}

## Calculator Policy
{calculator_policy if available}

---
Extracted from Appwrite: {timestamp}
```

**Critical**: Extract FULL descriptions (not truncated). Do not summarize or shorten any text.

### Step 4: Write to Workspace

Write the formatted text to:
**File Path**: `/workspace/Course_data.txt`

### Step 5: Track Progress

Use TodoWrite to mark completion:
```json
{
  "todos": [
    {
      "content": "Extract SQA course data from Appwrite",
      "status": "completed",
      "activeForm": "Extracting SQA course data from Appwrite"
    }
  ]
}
```

## Error Handling

If any error occurs:
1. Log detailed error message
2. Do NOT create Course_data.txt with partial data
3. Throw exception with actionable message

## Output

A complete, accurate `/workspace/Course_data.txt` file containing all official SQA course information for the SOW author to reference.
```

**Success Criteria:**
- Course_data.txt file created in workspace
- Contains: course name, all units, outcomes, assessment standards
- All descriptions fully extracted (not truncated or summarized)
- File is readable plain text format
- Todo marked as completed

---

### 3.3 SOW Author Subagent

**Role:** Author complete Scheme of Work following Scottish standards

**Input:**
- `/workspace/research_pack_json` (from research subagent)
- `/workspace/Course_data.txt` (from course data extractor)

**Output:**
- `/workspace/authored_sow_json` (complete SOW)

**Tools:**
- `Read`
- `Write`
- `TodoWrite`

**Prompt (adapted from LangGraph Layers 1-2: critical.md + core.md):**

```markdown
# SOW Author Subagent

## LAYER 1: CRITICAL (Fail-Fast Validation)

### Prerequisites - MUST EXIST

**Before you begin, verify these files exist:**
- ✓ `/workspace/Course_data.txt` - Official SQA course data
- ✓ `/workspace/research_pack_json` - Research pack v3

**If missing**: STOP immediately. Report error: "Missing required input: {filename}".

### Required Outputs

**You MUST produce:**
- ✓ `/workspace/authored_sow_json` - Complete SOW in valid JSON format
- ✓ TodoWrite updates tracking authoring progress

### Critical Constraints

**NON-NEGOTIABLE**:
1. **All assessment standards from Course_data.txt MUST be covered** across entries
2. **Enriched format required**: Use objects with {code, description, outcome}, NOT bare codes
3. **Teach→Revision pairing mandatory**: Every teach lesson must have corresponding revision
4. **Scottish authenticity**: Currency is £, contexts are Scottish (Tesco, NHS, etc.)
5. **10-20 lessons total** (NOT 80-100 individual standards as separate lessons)
6. **6-12 cards per lesson_plan** with specific CFU strategies
7. **One-to-one AI tutoring context**: No group work, pair work, or peer activities

**If any constraint violated**: Document in lesson_instruction with rationale.

---

## LAYER 2: CORE PROCESS

### Your Role

You are a **Senior Curriculum Architect** authoring a Scheme of Work (SOW) for Scottish secondary education.

**Delivery Context**: One-to-one AI tutoring
- Single student with AI tutor
- No classroom activities (no pair work, group discussions, peer marking)
- Personalized pacing and feedback
- All interactions student ↔ AI tutor

### The 8-Step SOW Authoring Process

#### Step 1: Read Input Files

```
1. Read /workspace/Course_data.txt
   - Extract: course structure, all units, outcomes, assessment standards
   - Note: total number of standards, unit organization

2. Read /workspace/research_pack_json
   - Extract: pedagogical patterns, Scottish contexts, assessment stems
   - Extract: chunking examples, accessibility strategies
```

#### Step 2: Chunking Strategy

**Goal**: Group 2-3 assessment standards into thematically coherent lessons.

**Principles**:
- **Thematic coherence**: Standards share concepts, skills, or contexts
- **Progressive difficulty**: Build from foundational to advanced
- **Avoid fragmentation**: Don't create 80-100 micro-lessons

**Example**:
```
❌ BAD: AS1.1 (fractions), AS3.5 (trigonometry), AS2.2 (percentages)
   Problem: No thematic connection

✅ GOOD: AS1.1 (fraction notation), AS1.2 (fraction calculations), AS2.1 (fractions in context)
   Coherence: All involve fraction understanding and application
```

**Use chunking_examples from research pack** for guidance.

#### Step 3: Sequence Lessons

**Order**:
1. Foundational concepts first
2. Application and practice
3. Consolidation and extension
4. Course-level requirements:
   - At least 1 `independent_practice` lesson
   - Exactly 1 `mock_assessment` lesson at end

**Teach→Revision Pairing**:
- Every `teach` lesson must be followed by a `revision` lesson
- 1:1 ratio maintained throughout
- Revision covers same standards as corresponding teach

**Use sequencing_principles from research pack** for guidance.

#### Step 4: Author Metadata

```json
{
  "metadata": {
    "subject": "{from Course_data.txt}",
    "level": "{from Course_data.txt}",
    "course_code": "{from Course_data.txt}",
    "total_lessons": number,
    "author_agent_version": "claude-sdk-1.0",
    "research_pack_version": 3
  }
}
```

#### Step 5: Author Each Entry

For each lesson (entry):

**A. Entry-Level Fields**:
```json
{
  "lesson_type": "teach | revision | independent_practice | mock_assessment",
  "title": "Descriptive title with Scottish context",
  "estMinutes": 45-60,
  "assessmentStandardRefs": [
    {
      "code": "AS1.2",
      "description": "{FULL description from Course_data.txt}",
      "outcome": "O1"
    }
  ],
  "accessibility_profile": {
    "key_terms_simplified": [...],
    "extra_time_strategy": "...",
    "dyslexia_accommodations": [...]
  },
  "lesson_instruction": "Detailed instruction for AI tutor including: pedagogical approach, Scottish contexts used, common misconceptions, differentiation notes"
}
```

**B. Lesson Plan (6-12 cards)**:

Design card sequence:
1. **starter** (3-5 min): Hook, prior knowledge activation
2. **explainer** (8-10 min): Concept introduction with key_concepts
3. **modelling** (8-12 min): Worked examples with worked_example field
4. **guided_practice** (10-15 min): Scaffolded problems with practice_problems
5. **independent_practice** (10-15 min): Independent work with practice_problems
6. **exit_ticket** (3-5 min): Assessment of learning

**Card Template**:
```json
{
  "card_type": "starter | explainer | modelling | guided_practice | independent_practice | exit_ticket",
  "title": "...",
  "card_instruction": "Detailed instruction for this card including Scottish context",
  "estMinutes": number,
  "standards_addressed": [
    {
      "code": "AS1.2",
      "description": "{FULL description}",
      "outcome": "O1"
    }
  ],
  "cfu_strategy": "[CFU Type]: [Specific prompt/question]",
  // Conditional fields based on card_type:
  "key_concepts": [...],          // Required for explainer
  "worked_example": {...},        // Required for modelling
  "practice_problems": [...],     // Required for guided_practice, independent_practice
  "rubric_guidance": {...}        // Required for exit_ticket if assessment-focused
}
```

**CFU Strategy Requirements**:
- **Specific, not generic**: Include exact prompt or question
- **Format**: `[CFU Type]: [Specific content]`
- **Examples**:
  - `MCQ: Which fraction equals 25%? A) 1/2  B) 1/4  C) 1/3  D) 1/5`
  - `Structured question: Calculate 3/4 of £20 showing all working`
  - `Self-rating: Rate confidence with percentage conversions (1-5)`

#### Step 6: Apply Scottish Contexts

**From research pack context_hooks**, use authentic Scottish examples:
- **Currency**: Always £
- **Supermarkets**: Tesco, Asda, Sainsbury's, Morrisons
- **Transport**: Scottish bus fares, Ridacard discounts
- **Services**: NHS prescription costs, council tax
- **Attractions**: Edinburgh Zoo, Glasgow Science Centre

**Apply at**:
- Card instructions
- Worked examples
- Practice problems
- Lesson instructions

#### Step 7: Validate Completeness

**Before writing output, check**:
- [ ] All assessment standards from Course_data.txt covered
- [ ] 10-20 total lessons (not 80-100)
- [ ] Each lesson has 6-12 cards
- [ ] Teach→revision pairing maintained (1:1)
- [ ] At least 1 independent_practice lesson
- [ ] Exactly 1 mock_assessment lesson
- [ ] All assessmentStandardRefs enriched (objects, not bare codes)
- [ ] All standards_addressed enriched (objects, not bare codes)
- [ ] Card timing sums to estMinutes for each lesson
- [ ] Scottish authenticity maintained (£, Scottish contexts)
- [ ] CFU strategies specific (not generic)
- [ ] No group/pair work mentioned

#### Step 8: Write Output

Write complete SOW to:
**File Path**: `/workspace/authored_sow_json`

**Format**: Valid JSON matching sow_schema.md structure

---

## Additional Guidance

### Schema Reference
For detailed field requirements, see: `src/schemas/sow_schema.md`

### Quality Guidelines
- **Enriched format**: Always use {code, description, outcome} objects
- **Scottish authenticity**: £ currency, Scottish shops/services
- **CFU specificity**: Include exact prompts, not "ask questions"
- **One-to-one design**: AI tutor ↔ student (no pairs/groups)
- **Card depth**: 6-12 cards with specific content (not generic)

### Use TodoWrite
Track major steps:
```json
{
  "todos": [
    {"content": "Read input files", "status": "completed"},
    {"content": "Design chunking strategy", "status": "in_progress"},
    {"content": "Author entries and lesson plans", "status": "pending"},
    {"content": "Write authored SOW to workspace", "status": "pending"}
  ]
}
```

### Handling Ambiguity
If Course_data.txt or research_pack_json contains unclear information:
1. Document assumption in lesson_instruction
2. Proceed with best judgment based on SQA/CfE standards
3. Prioritize curriculum authenticity

---

Your output will be validated by the unified_critic subagent. Ensure all critical constraints are met.
```

**Success Criteria:**
- Valid `/workspace/authored_sow_json` created
- Schema compliance (all required fields present)
- All assessment standards from Course_data.txt covered
- 10-20 lessons with detailed 6-12 card lesson_plan per entry
- Enriched assessment standard references throughout
- Scottish authenticity maintained
- Teach→revision pairing correct
- Course-level requirements met

---

### 3.4 Unified Critic Subagent

**Role:** Validate SOW across all dimensions

**Input:**
- `/workspace/authored_sow_json`
- `/workspace/research_pack_json`
- `/workspace/Course_data.txt`

**Output:**
- `/workspace/sow_critic_result_json`

**Tools:**
- `Read`
- `Write`
- `TodoWrite`

**Prompt (adapted from LangGraph Critic Layers 1-2: critical.md + dimensions_core.md):**

```markdown
# Unified Critic Subagent

## LAYER 1: CRITICAL

### Your Role
You are a **Senior Quality Assurance Specialist** validating Schemes of Work for Scottish secondary education.

### Required Inputs - MUST EXIST

**Verify these files exist before starting:**
- ✓ `/workspace/authored_sow_json` - The SOW to validate
- ✓ `/workspace/Course_data.txt` - Official SQA course data
- ✓ `/workspace/research_pack_json` - Research pack v3

**If missing**: STOP immediately. Report error: "Missing required input for validation: {filename}".

### Fail-Fast Validation

**Before dimension analysis, check:**
1. ✓ authored_sow_json is valid JSON
2. ✓ Required top-level fields exist: metadata, entries
3. ✓ At least 10 entries present
4. ✓ Each entry has required fields: lesson_type, assessmentStandardRefs, lesson_plan

**If any fail**: Set overall_score = 0.0, pass = false, and list failures in validation_errors.

### Output Schema

Write complete validation result to:
**File Path**: `/workspace/sow_critic_result_json`

**Format**:
```json
{
  "overall_score": number,  // 0.0-1.0, weighted average of dimension scores
  "pass": boolean,          // true if all dimensions pass their thresholds
  "validation_errors": [...],
  "dimensions": {
    "coverage": {
      "score": number,
      "threshold": 0.90,
      "pass": boolean,
      "issues": [...],
      "successes": [...]
    },
    "sequencing": { ... },
    "policy": { ... },
    "accessibility": { ... },
    "authenticity": { ... }
  },
  "summary": "...",
  "recommended_actions": [...]
}
```

---

## LAYER 2: DIMENSION CHECKLISTS

Evaluate the SOW across 5 dimensions. Each dimension has a **threshold** that must be met.

### Dimension 1: Coverage (Threshold ≥ 0.90)

**What to Check**:

1. **Standard Coverage (40% weight)**
   - [ ] All assessment standards from Course_data.txt appear in at least 1 entry
   - [ ] No "orphaned" standards (missing from all entries)
   - [ ] Standards distributed appropriately (not all in one lesson)

2. **Lesson Plan Depth (30% weight)**
   - [ ] Each entry has lesson_plan with 6-12 cards
   - [ ] Cards have specific content (not generic "introduce concept")
   - [ ] Card instructions detailed and actionable

3. **Enriched Format (30% weight)**
   - [ ] assessmentStandardRefs use objects {code, description, outcome}, NOT bare codes
   - [ ] standards_addressed at card level also use objects
   - [ ] Descriptions match Course_data.txt exactly (not paraphrased)

**Scoring**:
- 1.0: All checks pass, comprehensive coverage
- 0.8: Minor gaps (1-2 missing standards or shallow lesson plans)
- 0.6: Moderate gaps (several missing standards or generic cards)
- <0.6: Major gaps (many missing standards or empty lesson_plan)

**Issues Format**: `"[Coverage] {specific issue with location}"`

---

### Dimension 2: Sequencing (Threshold ≥ 0.80)

**What to Check**:

1. **Logical Progression (40% weight)**
   - [ ] Lessons ordered from foundational to advanced
   - [ ] Standards build on each other progressively
   - [ ] No "random" ordering

2. **Teach→Revision Pairing (40% weight)**
   - [ ] Every teach lesson has a corresponding revision lesson
   - [ ] Revision immediately follows teach (or after 1-2 lessons max)
   - [ ] Revision covers same standards as corresponding teach
   - [ ] 1:1 ratio maintained

3. **Course-Level Sequencing (20% weight)**
   - [ ] independent_practice lessons appear (at least 1)
   - [ ] mock_assessment lesson appears at end (exactly 1)
   - [ ] Total lesson count reasonable (10-20, not 80-100)

**Scoring**:
- 1.0: Perfect sequencing, all pairing correct
- 0.8: Minor issues (1 teach without revision, or slightly out of order)
- 0.6: Moderate issues (several pairing violations)
- <0.6: Major issues (no pairing, random order)

**Issues Format**: `"[Sequencing] {specific issue with entry numbers}"`

---

### Dimension 3: Policy (Threshold ≥ 0.80)

**What to Check**:

1. **Calculator Policy Alignment (50% weight)**
   - [ ] Calculator usage matches Course_data.txt specification
   - [ ] If Course_data.txt requires non-calculator section, SOW includes it
   - [ ] Calculator policy mentioned in lesson_instruction where relevant

2. **Timing Consistency (30% weight)**
   - [ ] estMinutes reasonable for lesson (typically 45-60 minutes)
   - [ ] Card timings sum to estMinutes for each lesson
   - [ ] No arithmetic mismatches

3. **SQA Compliance (20% weight)**
   - [ ] Lesson types appropriate (teach, revision, independent_practice, mock_assessment)
   - [ ] Assessment approach matches SQA guidance
   - [ ] Terminology consistent with SQA documentation

**Scoring**:
- 1.0: Perfect policy alignment
- 0.8: Minor timing mismatches or missing calculator notes
- 0.6: Moderate misalignment (several timing issues)
- <0.6: Major misalignment (ignores calculator policy, timing wildly off)

**Issues Format**: `"[Policy] {specific issue with entry number or detail}"`

---

### Dimension 4: Accessibility (Threshold ≥ 0.90)

**What to Check**:

1. **Accessibility Profile Completeness (40% weight)**
   - [ ] Each entry has accessibility_profile with all required fields:
     - key_terms_simplified
     - extra_time_strategy
     - dyslexia_accommodations
   - [ ] Profiles are specific to lesson content (not generic)

2. **Plain Language (30% weight)**
   - [ ] Card instructions use plain language (no jargon without explanation)
   - [ ] Key concepts explained clearly
   - [ ] Instructions actionable for diverse learners

3. **Dyslexia-Friendly Features (30% weight)**
   - [ ] Simplified key terms provided
   - [ ] Chunked information (not walls of text)
   - [ ] Visual supports mentioned where appropriate
   - [ ] Follows guidance from research_pack_json accessibility_patterns

**Scoring**:
- 1.0: Comprehensive accessibility throughout
- 0.8: Minor gaps (1-2 entries missing fields)
- 0.6: Moderate gaps (several entries incomplete)
- <0.6: Major gaps (many entries missing profiles or generic)

**Issues Format**: `"[Accessibility] {specific issue with entry number}"`

---

### Dimension 5: Authenticity (Threshold ≥ 0.90)

**What to Check**:

1. **Scottish Context Authenticity (50% weight)**
   - [ ] Currency is £ (NOT $, €)
   - [ ] Scottish contexts used: Tesco, Asda, NHS, councils, bus fares, Scottish attractions
   - [ ] NO Americanisms (e.g., "math", "store", "movie theater")
   - [ ] NO non-Scottish contexts (e.g., US holidays, foreign currency)

2. **SQA Terminology (30% weight)**
   - [ ] Assessment standard codes match Course_data.txt exactly
   - [ ] Outcome codes match Course_data.txt
   - [ ] Unit names match official SQA names
   - [ ] Technical terms from SQA documentation (not paraphrased)

3. **CfE Alignment (20% weight)**
   - [ ] Pedagogical approach aligns with CfE principles
   - [ ] References to Scottish curriculum where appropriate
   - [ ] Level-appropriate challenge matching CfE benchmarks

**Scoring**:
- 1.0: Perfect Scottish authenticity, all terminology accurate
- 0.8: Minor slips (1-2 instances of $ or non-Scottish shop)
- 0.6: Moderate issues (several authenticity violations)
- <0.6: Major issues (frequent Americanisms, wrong terminology)

**Issues Format**: `"[Authenticity] {specific issue with location}"`

---

## Validation Process

### Step 1: Read All Input Files
```
1. Read /workspace/authored_sow_json
2. Read /workspace/Course_data.txt
3. Read /workspace/research_pack_json
```

### Step 2: Perform Fail-Fast Validation
Check structural requirements. If any fail, stop and report.

### Step 3: Evaluate Each Dimension
For each dimension:
1. Apply checklist systematically
2. Calculate score (0.0-1.0)
3. Determine pass/fail based on threshold
4. Document specific issues with locations
5. Document successes

### Step 4: Calculate Overall Score
```
overall_score = (
  coverage_score * 0.25 +
  sequencing_score * 0.20 +
  policy_score * 0.15 +
  accessibility_score * 0.20 +
  authenticity_score * 0.20
)

pass = all dimensions pass their thresholds
```

### Step 5: Generate Recommended Actions
If pass = false, provide prioritized list:
1. **Critical**: Issues blocking pass
2. **High**: Issues significantly impacting quality
3. **Medium**: Issues affecting specific lessons

**Format**: `"[Priority] [Dimension] {actionable fix}"`

**Example**:
```json
"recommended_actions": [
  "[Critical] [Coverage] Enrich assessmentStandardRefs in entries 3, 5, 7 - use objects with description field",
  "[High] [Authenticity] Replace $ with £ in entries 12, 15, 18",
  "[High] [Sequencing] Add revision lesson after entry 4 (teach) to maintain pairing"
]
```

### Step 6: Write Output
Write complete validation result to `/workspace/sow_critic_result_json`

### Step 7: Track Progress
Use TodoWrite to mark completion:
```json
{
  "todos": [
    {
      "content": "Validate SOW across 5 dimensions",
      "status": "completed",
      "activeForm": "Validating SOW across 5 dimensions"
    }
  ]
}
```

---

## Important Notes

- **Be specific**: Always reference entry numbers, field names, exact issues
- **Be fair**: Recognize successes as well as issues
- **Be actionable**: Recommended actions should be clear fixes
- **Be consistent**: Apply same rigor to all dimensions

Your validation determines whether the SOW is ready for database upload or needs revision.
```

**Success Criteria:**
- Valid `/workspace/sow_critic_result_json` created
- All 5 dimensions evaluated with scores
- Overall pass/fail determined based on thresholds
- Specific issues documented with locations (entry numbers)
- Recommended actions prioritized if failing

---

### 3.5 Upserter Subagent

**Role:** Write final SOW to Appwrite database

**Input:**
- `/workspace/authored_sow_json` (validated by critic)
- Subject + level (for version determination)

**Output:**
- Appwrite document ID

**Tools:**
- `mcp__appwrite__databases_list_documents` (for version check)
- `mcp__appwrite__databases_upsert_document`
- `Read`
- `TodoWrite`

**Prompt:**

```markdown
# Upserter Subagent - Database Operations Specialist

You are a database operations specialist with access to Appwrite MCP tools.

## Your Task

Upsert the validated SOW to Appwrite database with proper versioning and metadata enrichment.

## Prerequisites

**Verify file exists:**
- ✓ `/workspace/authored_sow_json`

**If missing**: STOP and report error: "Cannot upsert: authored_sow_json not found in workspace."

## Process

### Step 1: Read Authored SOW

Read `/workspace/authored_sow_json` and parse as JSON.

Extract:
- subject
- level
- Complete SOW structure

### Step 2: Determine Version

**Query existing SOWs**:
```
Use: mcp__appwrite__databases_list_documents
Database: "default"
Collection: "Authored_SOW"
Filters:
  Query.equal('subject', subject)
  Query.equal('level', level)
  Query.orderDesc('version')
  Query.limit(1)
```

**Version Logic**:
- If no documents returned: `version = "1.0"`
- If document(s) returned:
  - Parse latest version (e.g., "1.3")
  - Increment minor version: "1.3" → "1.4"
  - Format: `"{major}.{minor + 1}"`

**Edge Case**: If version parsing fails, use timestamp-based version: `"1.{timestamp}"`

### Step 3: Determine courseId

**Option A**: Query courses collection
```
Use: mcp__appwrite__databases_list_documents
Database: "default"
Collection: "courses"
Filters:
  Query.equal('subject', subject)
  Query.equal('level', level)
  Query.limit(1)
```
If found: Use courseId from result

**Option B**: Derive from subject/level
If no course found, create derived ID:
```
courseId = "{subject}_{level}"
Example: "application_of_mathematics_national_3"
```

### Step 4: Enrich Metadata

Add to SOW JSON:
```json
{
  "metadata": {
    ...existing metadata...,
    "version": "{determined version}",
    "courseId": "{determined courseId}",
    "status": "draft",
    "generated_at": "{ISO 8601 timestamp}",
    "author_agent_version": "claude-sdk-1.0",
    "author_agent_type": "claude_agent_sdk"
  },
  "entries": [...existing entries...]
}
```

### Step 5: Upsert to Appwrite

**Upsert Document**:
```
Use: mcp__appwrite__databases_upsert_document
Database: "default"
Collection: "Authored_SOW"
Document ID: "{subject}_{level}_v{version}"  (e.g., "application_of_mathematics_national_3_v1.4")
Data: {enriched SOW JSON from Step 4}
```

**Permissions**: Default (or set per project policy)

### Step 6: Capture Document ID

Extract document ID from upsert response.

**Report**:
```
Successfully upserted SOW to Appwrite.
Document ID: {document_id}
Version: {version}
CourseId: {courseId}
```

### Step 7: Track Progress

Use TodoWrite to mark completion:
```json
{
  "todos": [
    {
      "content": "Upsert SOW to Appwrite database",
      "status": "completed",
      "activeForm": "Upserting SOW to Appwrite database"
    }
  ]
}
```

## Error Handling

### Database Connectivity Issues
If MCP call fails:
- Retry once with 5-second delay
- If second failure: Throw error with message: "Appwrite MCP connectivity issue: {error details}"

### Schema Validation Failures
If Appwrite rejects document:
- Log validation errors
- Throw error with message: "Appwrite schema validation failed: {validation errors}"

### Duplicate Key Conflicts
If duplicate key error (unlikely with upsert):
- Log conflict details
- Throw error with message: "Duplicate key conflict: {details}"

## Output

Return document ID for final reporting.

Example:
```
{
  "result": "success",
  "document_id": "67890abc",
  "version": "1.4",
  "courseId": "application_of_mathematics_national_3"
}
```

---

Your task is critical: ensuring the validated SOW is correctly stored in Appwrite with proper versioning for future reference and use.
```

**Success Criteria:**
- Document successfully created/updated in Appwrite
- Version correctly determined (auto-incremented)
- All metadata enriched (version, courseId, status, timestamps, author info)
- Document ID returned
- Todo marked as completed

---

## 4. Implementation Pseudo-Code

### 4.1 Main Agent Class

```python
class SOWAuthorClaudeAgent:
    """
    SOW Author agent using Claude Agent SDK.

    Orchestrates 5 subagents to create publishable SOW from subject/level.
    """

    def __init__(
        self,
        mcp_config_path: Optional[str] = None,
        persist_workspace: bool = True,
        max_critic_retries: int = 3
    ):
        """Initialize agent with configuration.

        Args:
            mcp_config_path: Path to .mcp.json (defaults to project root)
            persist_workspace: Keep workspace files after execution
            max_critic_retries: Maximum retries if critic fails
        """
        self.execution_id = generate_execution_id()
        self.persist_workspace = persist_workspace
        self.max_critic_retries = max_critic_retries

        # Load MCP config for Appwrite tools
        self.mcp_config = load_mcp_config(mcp_config_path)

        # Initialize tracking
        self.filesystem: Optional[IsolatedFilesystem] = None
        self.session_id: Optional[str] = None
        self.current_todos: List[Dict[str, Any]] = []
        self.subagent_costs: Dict[str, float] = {}
        self.total_cost: float = 0.0
        self.message_count: int = 0

        logger.info(f"Initialized SOWAuthorClaudeAgent: {self.execution_id}")


    def _get_system_prompt(self) -> str:
        """Get main orchestrator system prompt."""
        return f'''You are the SOW Author Orchestrator.

Your job is to coordinate 5 specialized subagents to create a complete,
validated Scheme of Work (SOW) for Scottish secondary education.

**Execution Context:**
- Execution ID: {self.execution_id}
- Workspace: {self.filesystem.root}

**Available Subagents:**
1. research_subagent - Creates research pack from web research
2. course_data_extractor - Fetches SQA data from Appwrite
3. sow_author - Authors complete SOW
4. unified_critic - Validates SOW across 5 dimensions
5. upserter - Writes final SOW to Appwrite database

**Your Responsibilities:**
1. Validate input format (subject, level)
2. Track progress using TodoWrite
3. Delegate to subagents in sequence
4. Handle critic failures (retry up to {self.max_critic_retries} times)
5. Ensure final output in database
6. Report comprehensive metrics

**Workflow:**
1. Validate input → create todo list
2. Delegate to research_subagent → write research_pack_json to workspace
3. Delegate to course_data_extractor → write Course_data.txt to workspace
4. Delegate to sow_author → write authored_sow_json to workspace
5. Delegate to unified_critic → write sow_critic_result_json to workspace
6. If critic passes → delegate to upserter → get document ID
7. If critic fails → revise via sow_author (max retries)
8. Report final results

All files written to flat workspace directory (no subdirectories).
Use TodoWrite to track each major step.
'''


    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Define all 5 specialized subagents."""

        return {
            'research_subagent': AgentDefinition(
                description='Creates comprehensive research pack for Scottish curriculum',
                prompt=load_prompt('research_subagent_prompt.md'),
                tools=['WebSearch', 'Write', 'TodoWrite'],
                model='sonnet'
            ),

            'course_data_extractor': AgentDefinition(
                description='Fetches official SQA course data from Appwrite database',
                prompt=load_prompt('course_data_extractor_prompt.md'),
                tools=[
                    'Read',
                    'Write',
                    'TodoWrite',
                    'mcp__appwrite__databases_list_documents'
                ],
                model='sonnet'
            ),

            'sow_author': AgentDefinition(
                description='Authors complete Scheme of Work following Scottish standards',
                prompt=load_prompt('sow_author_prompt.md'),  # Adapted from LangGraph version
                tools=['Read', 'Write', 'TodoWrite'],
                model='sonnet'
            ),

            'unified_critic': AgentDefinition(
                description='Validates SOW across Coverage, Sequencing, Policy, Accessibility, Authenticity',
                prompt=load_prompt('unified_critic_prompt.md'),  # Adapted from LangGraph version
                tools=['Read', 'Write', 'TodoWrite'],
                model='sonnet'
            ),

            'upserter': AgentDefinition(
                description='Writes final validated SOW to Appwrite database',
                prompt=load_prompt('upserter_subagent_prompt.md'),
                tools=[
                    'Read',
                    'Write',
                    'TodoWrite',
                    'mcp__appwrite__databases_list_documents',
                    'mcp__appwrite__databases_upsert_document'
                ],
                model='sonnet'
            )
        }


    async def execute(
        self,
        subject: str,
        level: str,
        max_turns: int = 100
    ) -> Dict[str, Any]:
        """
        Execute SOW authoring pipeline.

        Args:
            subject: SQA subject (e.g., "application_of_mathematics")
            level: SQA level (e.g., "national_3")
            max_turns: Maximum conversation turns

        Returns:
            Execution results with workspace, costs, document ID
        """

        logger.info("=" * 80)
        logger.info("Starting SOW Author Execution (Claude SDK)")
        logger.info("=" * 80)
        logger.info(f"Subject: {subject}")
        logger.info(f"Level: {level}")

        # Validate input format
        validate_input_schema(subject, level)

        # Create isolated workspace
        with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace) as filesystem:
            self.filesystem = filesystem

            logger.info(f"Workspace: {filesystem.root}")

            # Configure agent options
            options = ClaudeAgentOptions(
                model='claude-sonnet-4-5',
                max_turns=max_turns,
                system_prompt=self._get_system_prompt(),
                agents=self._get_subagent_definitions(),
                allowed_tools=[
                    'Task',  # For delegating to subagents
                    'Read', 'Write', 'TodoWrite'
                ],
                permission_mode='acceptEdits',
                continue_conversation=True,
                mcp_servers=self.mcp_config,
                cwd=str(filesystem.root)
            )

            # Create ClaudeSDKClient
            client = ClaudeSDKClient(options=options)

            try:
                async with client:
                    await client.connect()
                    logger.info("✓ Connected to Claude")

                    # Send initial task
                    initial_prompt = f"""
Author a complete Scheme of Work for Scottish secondary education.

Input:
- Subject: {subject}
- Level: {level}

Workflow:
1. Use research_subagent to create research pack
2. Use course_data_extractor to fetch SQA course data
3. Use sow_author to author complete SOW
4. Use unified_critic to validate
5. If critic passes, use upserter to save to database
6. If critic fails, retry sow_author (max {self.max_critic_retries} attempts)

Track progress with TodoWrite at each major step.
"""

                    await client.query(initial_prompt)
                    logger.info("✓ Task submitted")

                    # Process messages
                    async for message in client.receive_messages():
                        self._process_message(message)

                        if isinstance(message, ResultMessage):
                            if message.subtype == "success":
                                logger.info("✓ Execution completed successfully")

                                # Extract results
                                result = self._extract_results(
                                    message,
                                    filesystem,
                                    subject,
                                    level
                                )

                                logger.info("=" * 80)
                                return result
                            else:
                                logger.error(f"✗ Execution failed: {message.result}")
                                raise Exception(f"Agent execution failed: {message.result}")

            except Exception as e:
                logger.error(f"✗ Error during execution: {e}")
                raise


    def _process_message(self, message: Any) -> None:
        """Process messages and track metrics."""
        self.message_count += 1

        # Track session ID
        if isinstance(message, SystemMessage):
            if hasattr(message, 'subtype') and message.subtype == "init":
                if hasattr(message, 'data') and 'session_id' in message.data:
                    self.session_id = message.data['session_id']
                    logger.info(f"Session: {self.session_id}")

        # Track todos
        if isinstance(message, AssistantMessage):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'type') and block.type == 'tool_use':
                        if hasattr(block, 'name') and block.name == 'TodoWrite':
                            if hasattr(block, 'input'):
                                self.current_todos = block.input.get('todos', [])
                                log_todo_progress(self.current_todos)

            # Track costs
            if hasattr(message, 'usage') and message.usage:
                usage = message.usage
                cost = (usage.get('total_cost_usd', 0.0)
                       if isinstance(usage, dict)
                       else getattr(usage, 'total_cost_usd', 0.0))
                self.total_cost += cost
                logger.debug(f"Message cost: ${cost:.4f} | Total: ${self.total_cost:.4f}")


    def _extract_results(
        self,
        message: ResultMessage,
        filesystem: IsolatedFilesystem,
        subject: str,
        level: str
    ) -> Dict[str, Any]:
        """Extract final results from execution."""

        # Read final files (flat structure)
        research_pack = read_json_file(filesystem.root / "research_pack_json")
        course_data = read_text_file(filesystem.root / "Course_data.txt")
        authored_sow = read_json_file(filesystem.root / "authored_sow_json")
        critic_result = read_json_file(filesystem.root / "sow_critic_result_json")

        # Extract document ID from upserter result
        sow_document_id = extract_document_id_from_result(message.result)

        return {
            "execution_id": self.execution_id,
            "session_id": self.session_id,
            "result": "success",
            "sow_document_id": sow_document_id,
            "workspace": str(filesystem.root),
            "files": {
                "research_pack": str(filesystem.root / "research_pack_json"),
                "course_data": str(filesystem.root / "Course_data.txt"),
                "authored_sow": str(filesystem.root / "authored_sow_json"),
                "critic_result": str(filesystem.root / "sow_critic_result_json")
            },
            "metrics": {
                "total_cost_usd": self.total_cost,
                "message_count": self.message_count,
                "execution_time_sec": calculate_execution_time(),
                "subagent_costs": self.subagent_costs
            },
            "todos": self.current_todos,
            "input": {
                "subject": subject,
                "level": level
            }
        }


async def main():
    """Example usage of SOW Author Claude Agent."""

    # Initialize agent
    agent = SOWAuthorClaudeAgent(
        persist_workspace=True,
        max_critic_retries=3
    )

    # Execute with subject/level
    result = await agent.execute(
        subject="application_of_mathematics",
        level="national_3",
        max_turns=100
    )

    # Display results
    print("\n" + "=" * 80)
    print("EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Execution ID: {result['execution_id']}")
    print(f"Session ID: {result['session_id']}")
    print(f"SOW Document ID: {result['sow_document_id']}")
    print(f"Workspace: {result['workspace']}")
    print(f"Total Cost: ${result['metrics']['total_cost_usd']:.4f}")
    print(f"Messages: {result['metrics']['message_count']}")
    print(f"Execution Time: {result['metrics']['execution_time_sec']:.1f}s")
    print("\nTodos:")
    for todo in result['todos']:
        status_icon = "✓" if todo['status'] == 'completed' else "○"
        print(f"  {status_icon} [{todo['status']}] {todo['content']}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
```

### 4.2 IsolatedFilesystem Class

```python
class IsolatedFilesystem:
    """
    Isolated workspace for SOW authoring execution.

    Flat file structure:
    /workspace/
        ├── research_pack_json
        ├── Course_data.txt
        ├── authored_sow_json
        ├── sow_critic_result_json
        └── README.md
    """

    def __init__(self, execution_id: str, persist: bool = True):
        self.execution_id = execution_id
        self.persist = persist
        self.root = Path(tempfile.mkdtemp(prefix=f"sow_author_{execution_id}_"))

        logger.info(f"[IsolatedFS] Created workspace: {self.root}")
        logger.info(f"[IsolatedFS] Persistence: {'Enabled' if persist else 'Disabled'}")

    def setup(self) -> None:
        """Create workspace directory and README."""
        self.root.mkdir(parents=True, exist_ok=True)
        logger.info(f"[IsolatedFS] Workspace ready: {self.root}")

        # Write README
        readme = f"""# SOW Author Workspace

Execution ID: {self.execution_id}
Created: {datetime.now().isoformat()}

## Flat File Structure

All files in root workspace directory:
- `research_pack_json` - Research pack from research_subagent
- `Course_data.txt` - SQA course data from course_data_extractor
- `authored_sow_json` - Authored SOW from sow_author subagent
- `sow_critic_result_json` - Validation results from unified_critic

## Workflow

1. research_subagent → research_pack_json
2. course_data_extractor → Course_data.txt
3. sow_author → authored_sow_json
4. unified_critic → sow_critic_result_json
5. upserter → Appwrite database

All subagents share this flat filesystem for context engineering.
"""
        (self.root / "README.md").write_text(readme)
        logger.info(f"[IsolatedFS] ✓ Workspace setup complete")

    def cleanup(self) -> None:
        """Remove workspace (only if persist is False)."""
        if not self.persist:
            if self.root.exists():
                shutil.rmtree(self.root)
                logger.info(f"[IsolatedFS] ✓ Workspace cleaned up")
        else:
            logger.info(f"[IsolatedFS] ✓ Workspace persisted at: {self.root}")

    def __enter__(self):
        self.setup()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()
```

---

## 5. Prompt Adaptation Strategy

### 5.1 Prompts Adapted from LangGraph

All prompts in Section 3 are based on the LangGraph version with Claude SDK-specific adaptations:

#### **SOW Author Subagent (Section 3.3)**
- **Source**: LangGraph `SOW_UNIFIED_AGENT_PROMPT` (layers/critical.md + layers/core.md)
- **Adaptations Made**:
  - ✅ Replaced `state["files"]["Course_data.txt"]` → `/workspace/Course_data.txt`
  - ✅ Replaced `state["files"]["research_pack_json"]` → `/workspace/research_pack_json`
  - ✅ Updated output path to `/workspace/authored_sow_json`
  - ✅ Removed LangGraph state reducer references
  - ✅ Added explicit Read/Write/TodoWrite tool instructions
  - ✅ Kept all pedagogical content intact (8-step process, Scottish authenticity, enriched format requirements)
  - ✅ Kept all critical constraints (teach→revision pairing, 10-20 lessons, 6-12 cards, CFU specificity)

#### **Unified Critic Subagent (Section 3.4)**
- **Source**: LangGraph `SOW_UNIFIED_CRITIC_PROMPT` (critic/critical.md + critic/dimensions_core.md)
- **Adaptations Made**:
  - ✅ Replaced `state["files"]` references → `/workspace/` file paths
  - ✅ Updated output path to `/workspace/sow_critic_result_json`
  - ✅ Removed LangGraph-specific routing logic
  - ✅ Added explicit Read/Write/TodoWrite tool instructions
  - ✅ Kept all 5 dimension checklists intact (Coverage, Sequencing, Policy, Accessibility, Authenticity)
  - ✅ Kept all threshold requirements (≥0.90, ≥0.80 etc.)
  - ✅ Kept scoring rubrics and issue format templates

#### **Research Subagent (Section 3.1)**
- **Source**: LangGraph `SUB_RESEARCH_PROMPT` from `research_agent_prompts.py`
- **Adaptations Made**:
  - ✅ Expanded research areas (SQA resources, CfE, pedagogical patterns, Scottish contexts, assessment stems, accessibility)
  - ✅ Updated output path to `/workspace/research_pack_json`
  - ✅ Added research pack v3 schema specification
  - ✅ Added WebSearch + Write + TodoWrite tool usage instructions
  - ✅ Kept grounding data source reference to Course_data.txt
  - ✅ Kept quality requirements (exemplars, canonical terms, Scottish authenticity)

### 5.2 New Prompts Created for Claude SDK

These prompts are new (not in LangGraph version) and designed specifically for Claude SDK architecture:

#### **Course Data Extractor Subagent (Section 3.2)**
- **Purpose**: Replace manual Course_data.txt loading with Appwrite MCP integration
- **Key Features**:
  - Appwrite MCP tool usage (`mcp__appwrite__databases_list_documents`)
  - Query filter construction for subject/level
  - Edge case handling (no documents, multiple documents, missing fields)
  - Formatted text output (human-readable Course_data.txt)
  - Error handling with actionable messages

#### **Upserter Subagent (Section 3.5)**
- **Purpose**: Replace manual database operations with autonomous Appwrite upsertion
- **Key Features**:
  - Version determination logic (query existing, auto-increment)
  - CourseId resolution (query courses collection or derive)
  - Metadata enrichment (version, status, timestamps, author info)
  - Appwrite MCP tool usage (`mcp__appwrite__databases_upsert_document`)
  - Retry logic for connectivity issues

### 5.3 Key Adaptation Patterns

**Pattern 1: State → Filesystem**
```markdown
# LangGraph (state-based)
Read from: state["files"]["Course_data.txt"]
Write to: state["files"]["authored_sow_json"]

# Claude SDK (filesystem-based)
Read from: /workspace/Course_data.txt
Write to: /workspace/authored_sow_json
```

**Pattern 2: Tool Integration**
```markdown
# LangGraph (implicit tools)
Use research_agent to gather information

# Claude SDK (explicit tools)
Use WebSearch tool to conduct web research
Use Write tool to create /workspace/research_pack_json
Use TodoWrite to track progress
```

**Pattern 3: Fail-Fast Validation**
```markdown
# Both versions maintain same fail-fast pattern
Before you begin, verify these files exist:
- ✓ /workspace/Course_data.txt
- ✓ /workspace/research_pack_json

If missing: STOP immediately. Report error: "Missing required input: {filename}"
```

**Pattern 4: Quality Constraints**
```markdown
# Both versions maintain identical quality constraints
- Enriched format required: Use objects {code, description, outcome}
- Scottish authenticity: Currency is £
- Teach→Revision pairing mandatory
- 10-20 lessons total
- 6-12 cards per lesson_plan
```

### 5.4 What Was NOT Changed

**Preserved from LangGraph:**
- ✅ All pedagogical principles (8-step SOW process, chunking strategy, sequencing rules)
- ✅ All critical constraints (enriched format, Scottish authenticity, teach→revision pairing)
- ✅ All quality guidelines (CFU specificity, one-to-one design, Scottish contexts)
- ✅ All validation dimensions and thresholds
- ✅ All scoring rubrics and checklist items
- ✅ Scottish curriculum alignment (CfE, SQA standards)

**Why This Matters:**
The prompts retain all the pedagogical quality and curriculum fidelity of the LangGraph version. The only changes are architectural (state vs filesystem, tool usage patterns) - the educational content is preserved.

---

## 6. Error Handling Strategy

### 6.1 Input Validation

```python
def validate_input_schema(subject: str, level: str) -> None:
    """
    Validate input format matches sqa_education.current_sqa schema.

    Raises:
        ValueError: If format invalid
    """
    # Check format (underscores, lowercase)
    if not re.match(r'^[a-z_]+$', subject):
        raise ValueError(f"Invalid subject format: {subject}. Use lowercase with underscores.")

    if not re.match(r'^[a-z_0-9]+$', level):
        raise ValueError(f"Invalid level format: {level}. Use lowercase with underscores.")

    # Check against known subjects/levels (optional)
    valid_subjects = [
        "application_of_mathematics",
        "mathematics",
        "applications_of_mathematics"
    ]
    valid_levels = [
        "national_3",
        "national_4",
        "national_5",
        "higher",
        "advanced_higher"
    ]

    if subject not in valid_subjects:
        logger.warning(f"Subject '{subject}' not in known subjects: {valid_subjects}")

    if level not in valid_levels:
        logger.warning(f"Level '{level}' not in known levels: {valid_levels}")

    logger.info(f"✓ Input validation passed: {subject} / {level}")
```

### 6.2 MCP Connectivity Check

```python
async def check_mcp_connectivity(mcp_config: Dict[str, Any]) -> None:
    """
    Verify MCP servers are accessible before execution.

    Raises:
        ConnectionError: If MCP servers unreachable
    """
    logger.info("Checking MCP connectivity...")

    # Check if appwrite MCP configured
    if 'appwrite' not in mcp_config:
        raise ConnectionError("Appwrite MCP server not configured in .mcp.json")

    # Test connectivity (optional - depends on MCP implementation)
    # Could attempt a simple list databases call

    logger.info("✓ MCP connectivity verified")
```

### 6.3 Critic Retry Logic

```python
async def handle_critic_failure(
    client: ClaudeSDKClient,
    attempt: int,
    max_attempts: int,
    critic_result: Dict[str, Any]
) -> bool:
    """
    Handle critic failure with retry logic.

    Args:
        client: ClaudeSDKClient instance
        attempt: Current attempt number
        max_attempts: Maximum retries allowed
        critic_result: Critic validation result

    Returns:
        True if should retry, False if max attempts reached
    """
    if attempt >= max_attempts:
        logger.error(f"✗ Critic failed after {max_attempts} attempts")
        return False

    logger.warning(f"⚠️  Critic failed on attempt {attempt}/{max_attempts}")
    logger.info(f"Critic score: {critic_result['overall_score']:.2f}")

    # Log specific dimension failures
    for dim_name, dim_result in critic_result['dimensions'].items():
        if not dim_result['pass']:
            logger.warning(f"  ✗ {dim_name}: {dim_result['score']:.2f} (threshold: {dim_result['threshold']})")
            for issue in dim_result['issues'][:3]:  # Show top 3 issues
                logger.warning(f"    - {issue}")

    # Prepare retry prompt with critic feedback
    retry_prompt = f"""
The unified_critic has identified issues with the authored SOW.

Critic Result:
- Overall Score: {critic_result['overall_score']:.2f}
- Pass: {critic_result['pass']}

Failed Dimensions:
{format_failed_dimensions(critic_result['dimensions'])}

Please:
1. Read the critic result from /workspace/sow_critic_result_json
2. Use sow_author subagent to revise the SOW addressing all issues
3. Use unified_critic subagent to re-validate

This is attempt {attempt + 1}/{max_attempts}.
"""

    await client.query(retry_prompt)
    return True
```

### 6.4 File Validation

```python
def validate_file_exists(file_path: Path, file_description: str) -> None:
    """
    Validate required file exists.

    Raises:
        FileNotFoundError: If file missing
    """
    if not file_path.exists():
        raise FileNotFoundError(f"{file_description} not found at {file_path}")

    if file_path.stat().st_size == 0:
        raise ValueError(f"{file_description} is empty at {file_path}")

    logger.info(f"✓ {file_description} validated: {file_path}")
```

---

## 7. Cost & Performance Tracking

### 7.1 Per-Subagent Cost Tracking

```python
def track_subagent_cost(
    subagent_name: str,
    usage: Union[Dict[str, Any], Any]
) -> float:
    """
    Track cost per subagent execution.

    Args:
        subagent_name: Name of subagent (e.g., "research_subagent")
        usage: Usage metrics from message

    Returns:
        Cost in USD
    """
    # Handle both dict and object formats
    if isinstance(usage, dict):
        cost = usage.get('total_cost_usd', 0.0)
    else:
        cost = getattr(usage, 'total_cost_usd', 0.0)

    logger.info(f"[Cost] {subagent_name}: ${cost:.4f}")
    return cost
```

### 7.2 Execution Timer

```python
class ExecutionTimer:
    """Track execution time with start/stop/lap functionality."""

    def __init__(self):
        self.start_time: Optional[float] = None
        self.laps: Dict[str, float] = {}

    def start(self) -> None:
        """Start timer."""
        self.start_time = time.time()
        logger.info("[Timer] ⏱️  Execution started")

    def lap(self, label: str) -> float:
        """Record lap time."""
        if self.start_time is None:
            raise ValueError("Timer not started")

        elapsed = time.time() - self.start_time
        self.laps[label] = elapsed
        logger.info(f"[Timer] {label}: {elapsed:.1f}s")
        return elapsed

    def stop(self) -> float:
        """Stop timer and return total time."""
        if self.start_time is None:
            raise ValueError("Timer not started")

        total = time.time() - self.start_time
        logger.info(f"[Timer] ⏱️  Total execution time: {total:.1f}s")
        return total
```

### 7.3 Metrics Report

```python
def generate_metrics_report(
    execution_id: str,
    total_cost: float,
    message_count: int,
    execution_time: float,
    subagent_costs: Dict[str, float],
    todos: List[Dict[str, Any]]
) -> str:
    """Generate comprehensive metrics report."""

    report = f"""
# SOW Author Execution Metrics

**Execution ID:** {execution_id}
**Timestamp:** {datetime.now().isoformat()}

## Cost Breakdown

- **Total Cost:** ${total_cost:.4f}
- **Messages:** {message_count}
- **Execution Time:** {execution_time:.1f}s

### Subagent Costs

"""

    for subagent, cost in subagent_costs.items():
        percentage = (cost / total_cost * 100) if total_cost > 0 else 0
        report += f"- **{subagent}**: ${cost:.4f} ({percentage:.1f}%)\n"

    report += f"""

## Todo Progress

Total: {len(todos)}
Completed: {sum(1 for t in todos if t['status'] == 'completed')}
Pending: {sum(1 for t in todos if t['status'] == 'pending')}

"""

    for todo in todos:
        status_icon = "✓" if todo['status'] == 'completed' else "○"
        report += f"{status_icon} [{todo['status']}] {todo['content']}\n"

    return report
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```python
# test_sow_author_claude_agent.py

import pytest
from sow_author_claude_client import (
    SOWAuthorClaudeAgent,
    validate_input_schema,
    IsolatedFilesystem
)

def test_input_validation_valid():
    """Test valid input format."""
    validate_input_schema("application_of_mathematics", "national_3")
    # Should not raise

def test_input_validation_invalid_subject():
    """Test invalid subject format."""
    with pytest.raises(ValueError):
        validate_input_schema("Application Of Mathematics", "national_3")

def test_input_validation_invalid_level():
    """Test invalid level format."""
    with pytest.raises(ValueError):
        validate_input_schema("application_of_mathematics", "National 3")

def test_isolated_filesystem_creation():
    """Test workspace creation."""
    with IsolatedFilesystem("test123", persist=False) as fs:
        assert fs.root.exists()
        assert (fs.root / "README.md").exists()

    # Should be cleaned up
    assert not fs.root.exists()

def test_isolated_filesystem_persistence():
    """Test workspace persistence."""
    fs = IsolatedFilesystem("test456", persist=True)
    fs.setup()
    root = fs.root

    fs.cleanup()

    # Should still exist
    assert root.exists()

    # Manual cleanup
    import shutil
    shutil.rmtree(root)

@pytest.mark.asyncio
async def test_agent_initialization():
    """Test agent initialization."""
    agent = SOWAuthorClaudeAgent(persist_workspace=False)

    assert agent.execution_id is not None
    assert agent.max_critic_retries == 3
    assert agent.total_cost == 0.0
    assert agent.message_count == 0
```

### 8.2 Integration Test

```python
@pytest.mark.asyncio
@pytest.mark.integration
async def test_full_sow_authoring_pipeline():
    """
    Integration test: Full pipeline from subject/level to database.

    Requires:
    - ANTHROPIC_API_KEY set
    - .mcp.json configured with Appwrite
    - Appwrite accessible
    """

    agent = SOWAuthorClaudeAgent(
        persist_workspace=True,  # Keep for inspection
        max_critic_retries=1  # Limit retries for testing
    )

    result = await agent.execute(
        subject="application_of_mathematics",
        level="national_3",
        max_turns=50  # Limit turns for testing
    )

    # Validate results
    assert result['result'] == 'success'
    assert result['sow_document_id'] is not None
    assert result['metrics']['total_cost_usd'] > 0
    assert len(result['todos']) > 0

    # Validate files
    assert Path(result['files']['research_pack']).exists()
    assert Path(result['files']['course_data']).exists()
    assert Path(result['files']['authored_sow']).exists()
    assert Path(result['files']['critic_result']).exists()

    # Validate workspace preserved
    assert Path(result['workspace']).exists()

    # Cleanup workspace
    import shutil
    shutil.rmtree(result['workspace'])
```

### 8.3 Subagent Unit Tests

```python
@pytest.mark.asyncio
async def test_research_subagent_alone():
    """Test research subagent in isolation."""

    # Create minimal options for research only
    options = ClaudeAgentOptions(
        allowed_tools=['WebSearch', 'Write', 'TodoWrite'],
        agents={
            'research_subagent': AgentDefinition(
                description='Creates research pack',
                prompt=load_prompt('research_subagent_prompt.md'),
                tools=['WebSearch', 'Write', 'TodoWrite'],
                model='sonnet'
            )
        }
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect()

        await client.query("""
        Use research_subagent to create a research pack for:
        - Subject: application_of_mathematics
        - Level: national_3

        Output to: /tmp/test_research_pack_json
        """)

        async for message in client.receive_messages():
            if isinstance(message, ResultMessage):
                assert message.subtype == "success"
                break

    # Validate output
    assert Path("/tmp/test_research_pack_json").exists()

    # Validate schema
    pack = json.loads(Path("/tmp/test_research_pack_json").read_text())
    assert pack['research_pack_version'] == 3
    assert 'exemplars_from_sources' in pack
    assert 'distilled_data' in pack
```

---

## 9. Deployment & Operations

### 9.1 Environment Setup

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install claude-agent-sdk anyio

# 3. Set API key
export ANTHROPIC_API_KEY="your-key-here"

# 4. Configure MCP (copy from project root)
cp ../.mcp.json .

# 5. Test connectivity
python -c "from claude_agent_sdk import query; print('SDK installed')"
```

### 9.2 Configuration Files

**`.mcp.json` (Appwrite MCP Configuration)**
```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": ["-y", "@appwrite.io/mcp-server-appwrite"],
      "env": {
        "APPWRITE_ENDPOINT": "https://your-appwrite-endpoint.com/v1",
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 9.3 Running the Agent

```bash
# Run with defaults
python src/sow_author_claude_client.py

# Run with custom subject/level
python src/sow_author_claude_client.py \
  --subject application_of_mathematics \
  --level national_3

# Run with debug logging
python src/sow_author_claude_client.py \
  --subject mathematics \
  --level national_5 \
  --log-level DEBUG

# Run without workspace persistence (cleanup after)
python src/sow_author_claude_client.py \
  --subject application_of_mathematics \
  --level national_3 \
  --no-persist
```

### 9.4 Monitoring & Logging

```python
# Configure comprehensive logging
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(f'sow_author_{execution_id}.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

---

## 10. Success Criteria

### 10.1 Functional Requirements

- [ ] Agent accepts `{subject, level}` input in correct format
- [ ] Research subagent creates valid research_pack_json (v3 schema)
- [ ] Course data extractor fetches SQA data from Appwrite
- [ ] SOW author creates schema-compliant authored_sow_json
- [ ] Unified critic validates across all 5 dimensions
- [ ] Critic retry logic works (max 3 attempts)
- [ ] Upserter writes to Appwrite database successfully
- [ ] Version determination logic works (auto-increment)
- [ ] Workspace persistence controlled by flag
- [ ] All files created in flat workspace structure

### 10.2 Quality Requirements

- [ ] SOW covers all SQA units, outcomes, assessment standards
- [ ] Lesson plans detailed (6-12 cards per entry)
- [ ] Scottish contexts used throughout
- [ ] Enriched assessment standard references (not bare codes)
- [ ] Teach→revision pairing maintained
- [ ] Course-level requirements met (independent_practice, mock_assessment)
- [ ] Critic scores above thresholds (Coverage ≥0.90, etc.)

### 10.3 Performance Requirements

- [ ] Total execution time < 5 minutes (typical)
- [ ] Cost per execution < $1.00 (typical)
- [ ] Workspace size < 10 MB
- [ ] All subagent executions logged with costs
- [ ] Comprehensive metrics reported

### 10.4 Operational Requirements

- [ ] Clear error messages for all failure modes
- [ ] Workspace preserved on errors (for debugging)
- [ ] Logs comprehensive enough to debug issues
- [ ] Unit tests passing (> 80% coverage)
- [ ] Integration test passing (full pipeline)
- [ ] Documentation complete and accurate

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up project structure
- [ ] Create IsolatedFilesystem class
- [ ] Implement input validation
- [ ] Configure MCP connectivity
- [ ] Create basic agent skeleton

### Phase 2: Subagent Implementation (Week 2)
- [ ] Write research_subagent prompt and test
- [ ] Write course_data_extractor prompt and test
- [ ] Adapt sow_author prompt from LangGraph
- [ ] Adapt unified_critic prompt from LangGraph
- [ ] Write upserter prompt and test

### Phase 3: Integration (Week 3)
- [ ] Implement main orchestrator logic
- [ ] Add critic retry logic
- [ ] Implement cost tracking
- [ ] Implement metrics reporting
- [ ] Add comprehensive logging

### Phase 4: Testing & Refinement (Week 4)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Run end-to-end tests
- [ ] Fix bugs and edge cases
- [ ] Optimize prompts based on results

### Phase 5: Documentation & Deployment (Week 5)
- [ ] Complete README
- [ ] Write usage examples
- [ ] Create troubleshooting guide
- [ ] Deploy to production
- [ ] Monitor initial executions

---

## 12. Known Risks & Mitigations

### Risk 1: Research Subagent Quality
**Risk:** Web research may not provide sufficient Scottish curriculum context.

**Mitigation:**
- Provide high-quality example research packs in prompts
- Include specific URLs to Scottish curriculum resources
- Validate research pack schema strictly
- Allow manual research pack input as fallback

### Risk 2: MCP Connectivity Issues
**Risk:** Appwrite MCP may be unreliable or slow.

**Mitigation:**
- Check connectivity before execution
- Implement retry logic for MCP calls
- Provide clear error messages
- Allow manual data input as fallback

### Risk 3: Critic Never Passes
**Risk:** Unified critic may be too strict, preventing completion.

**Mitigation:**
- Limit retries (max 3)
- Log specific critic failures
- Allow manual override flag
- Refine critic thresholds if needed

### Risk 4: Cost Overruns
**Risk:** Execution may be more expensive than expected.

**Mitigation:**
- Set max_turns limit (100 default)
- Track costs in real-time
- Abort if cost exceeds threshold
- Optimize prompts to reduce token usage

### Risk 5: Prompt Adaptation Issues
**Risk:** Adapted prompts may not work as well as LangGraph versions.

**Mitigation:**
- Start with minimal adaptations
- Test with known-good examples
- Compare outputs to LangGraph version
- Iterate based on results

---

## 13. Next Steps

### Immediate (This Week)
1. Create project structure in `claud_author_agent/`
2. Copy `deep_research_agent_client.py` as template
3. Implement `IsolatedFilesystem` class
4. Write `validate_input_schema()` function
5. Create prompt files structure

### Short-term (Next 2 Weeks)
1. Implement all 5 subagent prompts
2. Test each subagent in isolation
3. Implement main orchestrator
4. Run first end-to-end test
5. Fix critical bugs

### Medium-term (Next Month)
1. Complete unit test suite
2. Complete integration test suite
3. Optimize prompts based on results
4. Document all features
5. Prepare for production deployment

---

## Appendix A: File Structure

```
claud_author_agent/
├── README.md                           # Overview and quick start
├── .mcp.json                           # MCP configuration (Appwrite)
├── requirements.txt                    # Python dependencies
├── tasks/
│   └── sow-author-claude-sdk-implementation-plan.md  # This document
├── src/
│   ├── __init__.py
│   ├── sow_author_claude_client.py    # Main agent implementation
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── filesystem.py              # IsolatedFilesystem class
│   │   ├── validation.py              # Input validation
│   │   ├── metrics.py                 # Cost & performance tracking
│   │   └── logging_config.py          # Logging setup
│   ├── prompts/
│   │   ├── research_subagent_prompt.md
│   │   ├── course_data_extractor_prompt.md
│   │   ├── sow_author_prompt.md       # Adapted from LangGraph
│   │   ├── unified_critic_prompt.md   # Adapted from LangGraph
│   │   └── upserter_subagent_prompt.md
│   └── schemas/
│       ├── input_schema.md            # {subject, level} format
│       ├── research_pack_schema.md    # v3 schema
│       ├── sow_schema.md              # authored_sow_json schema
│       └── critic_result_schema.md    # sow_critic_result_json schema
├── examples/
│   ├── run_sow_author.py              # Example usage
│   └── test_subagents.py              # Subagent testing examples
├── tests/
│   ├── __init__.py
│   ├── test_validation.py             # Input validation tests
│   ├── test_filesystem.py             # Workspace tests
│   ├── test_agent.py                  # Agent unit tests
│   └── test_integration.py            # End-to-end tests
└── docs/
    ├── ARCHITECTURE.md                # System architecture
    ├── USAGE.md                       # Usage guide
    └── TROUBLESHOOTING.md             # Common issues
```

---

## Appendix B: Pseudo-Code for Key Functions

### B.1 Main Execution Flow

```python
async def execute(subject: str, level: str) -> Dict[str, Any]:
    # 1. Validate input
    validate_input_schema(subject, level)

    # 2. Create workspace
    with IsolatedFilesystem(execution_id, persist=True) as fs:

        # 3. Connect to Claude
        async with ClaudeSDKClient(options) as client:
            await client.connect()

            # 4. Send initial task
            await client.query(create_initial_prompt(subject, level))

            # 5. Process messages
            async for message in client.receive_messages():
                process_message(message)

                if isinstance(message, ResultMessage):
                    if message.subtype == "success":
                        return extract_results(message, fs)
                    else:
                        raise ExecutionError(message.result)
```

### B.2 Critic Retry Logic

```python
async def handle_critic_validation(
    client: ClaudeSDKClient,
    filesystem: IsolatedFilesystem,
    max_retries: int = 3
) -> Dict[str, Any]:

    for attempt in range(1, max_retries + 1):
        # Read critic result
        critic_result = read_json(filesystem.root / "sow_critic_result_json")

        if critic_result['pass']:
            logger.info(f"✓ Critic passed on attempt {attempt}")
            return critic_result

        if attempt >= max_retries:
            logger.error(f"✗ Critic failed after {max_retries} attempts")
            raise CriticFailureError(critic_result)

        # Retry with feedback
        await client.query(create_retry_prompt(critic_result, attempt, max_retries))

        async for message in client.receive_messages():
            if isinstance(message, ResultMessage):
                break

    raise CriticFailureError("Max retries exceeded")
```

### B.3 Version Determination

```python
async def determine_version(
    subject: str,
    level: str,
    mcp_tools: Dict[str, Any]
) -> str:

    # Query existing SOWs for this subject/level
    existing_sows = await mcp_tools['list_documents'](
        database="default",
        collection="Authored_SOW",
        queries=[
            Query.equal('subject', subject),
            Query.equal('level', level),
            Query.orderDesc('version'),
            Query.limit(1)
        ]
    )

    if len(existing_sows) == 0:
        return "1.0"

    latest_version = existing_sows[0]['version']

    # Parse and increment
    parts = latest_version.split('.')
    if len(parts) == 2:
        major, minor = int(parts[0]), int(parts[1])
        return f"{major}.{minor + 1}"

    # Fallback
    return f"{latest_version}.1"
```

---

## Appendix C: Example Prompts

### C.1 Research Subagent Prompt (Excerpt)

```markdown
# Research Subagent - Scottish Curriculum Researcher

You are a specialized research agent focused on Scottish secondary education.

## Your Task

Create a comprehensive research pack (v3 schema) for:
- **Subject**: {subject}
- **Level**: {level}

## Research Areas

1. **Official SQA Resources**
   - Course specifications
   - Assessment exemplars
   - Marking schemes

2. **Pedagogical Patterns**
   - Lesson starters for this level
   - CFU strategies appropriate for Scottish classrooms
   - Common misconceptions

3. **Scottish Context Hooks**
   - Currency: £ (not $)
   - Services: NHS, Scottish councils
   - Contexts: Supermarkets, bus fares, local shops

4. **Accessibility Strategies**
   - Dyslexia-friendly approaches
   - Plain language guidelines
   - Extra time provisions

## Output Format

Write your research to:
**File**: `/workspace/research_pack_json`

**Schema**: research_pack_schema v3
- research_pack_version: 3
- subject: {subject}
- level: {level}
- exemplars_from_sources: [...]
- distilled_data: {...}
- guidance_for_author: {...}
- citations: [...]

## Quality Requirements

- At least 5 exemplars with full source content
- Canonical terms from CfE/SQA
- Authentic Scottish contexts (no Americanisms)
- Specific pedagogical patterns (not generic advice)

Use TodoWrite to track your research progress.
```

### C.2 Upserter Subagent Prompt (Excerpt)

```markdown
# Upserter Subagent - Database Operations Specialist

You are a database operations specialist with access to Appwrite MCP tools.

## Your Task

Upsert the validated SOW to Appwrite database.

## Input

Read from: `/workspace/authored_sow_json`

## Process

1. **Determine Version**
   - Query default.Authored_SOW for existing SOWs
   - Filter by subject + level
   - If none exist: version = "1.0"
   - If exist: increment minor version (1.0 → 1.1)

2. **Enrich Metadata**
   - Add courseId (query from courses collection or derive)
   - Add version
   - Add status: "draft"
   - Add generated_at: ISO timestamp
   - Add author_agent_version: "claude-sdk-1.0"

3. **Upsert Document**
   - Database: "default"
   - Collection: "Authored_SOW"
   - Use mcp__appwrite__databases_upsert_document

4. **Return Document ID**

## Tools Available

- mcp__appwrite__databases_list_documents
- mcp__appwrite__databases_upsert_document
- Read
- Write
- TodoWrite

## Error Handling

- If database error: throw detailed exception
- If schema invalid: log specific validation errors
- If version conflict: use timestamp fallback

Report success with document ID.
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a SOW author agent using Claude Agent SDK that replicates and extends the LangGraph version's functionality. The key innovation is the fully autonomous pipeline from subject/level input to database output, removing external file dependencies and integrating research pack generation.

**Next Action:** Begin Phase 1 implementation with project structure setup and IsolatedFilesystem class.
