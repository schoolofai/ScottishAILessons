# Lesson Author Prompts Refactoring Specification

**Created**: 2025-10-04
**Status**: Approved - Ready for Implementation
**Related Files**:
- `src/lesson_author_prompts.py`
- `data/mvp_2_changes.md`

---

## Summary of Key Changes

1. **Fix SoW Entry Input Schema** - Replace non-existent file reference with explicit JSON schema in `LESSON_AGENT_PROMPT`
2. **Update LessonTemplate Schema** - Align with actual Appwrite database structure (JSON strings vs nested objects, missing/extra fields)
3. **Remove Math Bias** - Make all 7 prompts subject-agnostic by replacing math-specific examples with generic guidance
4. **Update Documentation** - Fix `mvp_2_changes.md` to match actual database schema discovered via Appwrite MCP

---

## 1. Fix SoW Entry Input Schema (lesson_author_prompts.py:7-11)

**Current Problem**: References non-existent file `sow_authored_AOM_nat4.txt`

**Before**:
```python
<inputs>
- **Input Format**: You will receive TWO comma-separated JSON objects as a human message:
  1. A SoW entry matching the shape in `sow_authored_AOM_nat4.txt`
  2. A research pack containing exemplars, contexts, pedagogical patterns, and reference URLs
- **First Action**: Write these to `sow_entry_input.json` and `research_pack.json` before proceeding with lesson authoring.
</inputs>
```

**After**:
```python
<inputs>
- **Input Format**: You will receive TWO comma-separated JSON objects as a human message:
  1. **SoW Entry** with schema:
     ```json
     {
       "order": <integer>,
       "lessonTemplateRef": "AUTO_TBD_<order>",
       "label": "<lesson title>",
       "lesson_type": "<teach|independent_practice|formative_assessment|revision>",
       "coherence": {
         "unit": "<unit name from CfE/SQA>",
         "block_name": "<topic block>",
         "block_index": "<section number>",
         "prerequisites": ["<lesson labels>"]
       },
       "policy": {
         "calculator_section": "<calc|noncalc>",
         "assessment_notes": "<any notes>"
       },
       "engagement_tags": ["<tag1>", "<tag2>"],
       "outcomeRefs": ["<O1>", "<O2>"],
       "assessmentStandardRefs": ["<AS1.1>", "<AS2.2>"],
       "pedagogical_blocks": ["<starter>", "<guided_practice>"],
       "accessibility_profile": {
         "dyslexia_friendly": <boolean>,
         "plain_language_level": "CEFR_<A1|A2|B1>",
         "extra_time": <boolean>
       },
       "estMinutes": <integer 5-120>,
       "notes": "<authoring guidance>"
     }
     ```
  2. **Research Pack** containing exemplars, contexts, pedagogical patterns, and reference URLs
- **First Action**: Write these to `sow_entry_input.json` and `research_pack.json` before proceeding with lesson authoring.
</inputs>
```

---

## 2. Update LessonTemplate Schema (lesson_author_prompts.py:160-213)

**Critical Discovery**: Database stores complex fields as **JSON strings**, not nested objects

**Actual Database Fields** (from Appwrite MCP):
- `courseId` (string, required, size 50)
- `title` (string, required, size 255)
- `outcomeRefs` (string, required, size 4000) - **JSON string, not array**
- `cards` (string, required, size 8000) - **JSON string, not array**
- `version` (integer, default 1)
- `status` (enum: 'draft'|'published', default 'draft')
- `createdBy` (string, required, size 50) - **MISSING from docs**
- `estMinutes` (integer, min 5, max 120, default 30)
- `lesson_type` (string, size 50)
- `engagement_tags` (string, size 1000, default '[]') - **JSON string**
- `policy` (string, size 2000, default '{}') - **JSON string**
- `sow_order` (integer, min 1, max 1000) - **MISSING from docs**

**Update Required**: Add accurate schema guidance in `LESSON_AUTHOR_SUBAGENT_PROMPT` around line 160

**Add this section**:
```python
<lesson_template_schema>
## LessonTemplate Database Schema (Appwrite 'lesson_templates' collection)

**IMPORTANT**: The database stores complex fields as JSON strings. When authoring, create the nested structure, but understand it will be stringified on save.

**Required Fields**:
- `courseId` (string, max 50 chars) - Course identifier from SoW
- `title` (string, max 255 chars) - Lesson title matching SoW entry label
- `outcomeRefs` (JSON string, max 4000 chars) - Array of outcome IDs like ["O1", "O2"]
- `cards` (JSON string, max 8000 chars) - Array of pedagogical card objects (see card schema below)
- `createdBy` (string, max 50 chars) - Author identifier (use "lesson_author_agent")
- `lesson_type` (string, max 50 chars) - One of: teach, independent_practice, formative_assessment, revision
- `estMinutes` (integer, 5-120) - Estimated lesson duration

**Optional Fields with Defaults**:
- `version` (integer, default 1) - Template version number
- `status` (enum, default 'draft') - 'draft' or 'published'
- `engagement_tags` (JSON string, max 1000 chars, default '[]') - Array like ["consolidation", "revision_game"]
- `policy` (JSON string, max 2000 chars, default '{}') - Object with calculator_section, assessment_notes
- `sow_order` (integer, 1-1000) - Position in scheme of work

**Card Schema** (within cards JSON string):
```json
{
  "id": "<unique_card_id>",
  "title": "<card title>",
  "explainer": "<full explanation>",
  "explainer_plain": "<CEFR A2 simplified version>",
  "cfu": {
    "type": "<numeric|mcq|short|structured>",
    "id": "<question_id>",
    "stem": "<question text>",
    // Type-specific fields based on CFU type
  },
  "rubric": {
    "total_points": <integer>,
    "criteria": [
      {"description": "<criterion>", "points": <integer>}
    ]
  },
  "misconceptions": [
    {
      "id": "<MISC_ID>",
      "misconception": "<common error>",
      "clarification": "<correction guidance>"
    }
  ],
  "context_hooks": ["<Scottish context suggestions>"]
}
```
</lesson_template_schema>
```

---

## 3. Remove Math Bias - Make Prompts Subject-Agnostic

### 3.1 Update CFU Variety Guide (lesson_author_prompts.py:246-261)

**Before** (math-biased):
```python
<cfu_variety_guide>
## CFU Type Distribution by Lesson Type

**teach**: Primarily numeric and short, introduce one MCQ for checking
**independent_practice**: Mix of numeric (60%), short (30%), structured (10%)
**formative_assessment**: All types represented - numeric, MCQ, short, structured
**revision**: MCQ (40%), numeric (40%), short (20%)

**CFU Type Details**:
- `numeric`: Expected value with tolerance, money2dp flag for currency
- `mcq`: Options array with answerIndex
- `short`: Text expected response
- `structured`: Multi-part question with sub-criteria in rubric

Always align CFU difficulty with assessment standard requirements from Course_data.txt.
</cfu_variety_guide>
```

**After** (subject-agnostic):
```python
<cfu_variety_guide>
## CFU Type Distribution by Lesson Type

**Subject-Agnostic Guidance**: Choose CFU types based on the learning objective and subject domain.

**teach**: Primarily fact-recall and comprehension checks; introduce one MCQ for concept verification
**independent_practice**: Mix of application (60%), comprehension (30%), analysis (10%)
**formative_assessment**: All types represented - vary based on subject (numeric for STEM, short for humanities, structured for analysis)
**revision**: MCQ (40%) for quick recall, application questions (40%), comprehension (20%)

**CFU Type Details by Subject Domain**:
- **STEM subjects** (Math, Science, Computing): Favor `numeric` (with tolerance for calculations) and `structured` (multi-step problems)
- **Humanities** (English, History, Modern Studies): Favor `short` (text responses) and `mcq` (concept checks)
- **Practical subjects** (Design, PE, Music): Favor `structured` (process steps) and `short` (reflection)
- **Languages**: Favor `short` (translations, comprehension) and `mcq` (grammar, vocabulary)

**CFU Type Technical Specs**:
- `numeric`: Expected value with tolerance (STEM subjects, exact calculations)
- `mcq`: Options array with answerIndex (all subjects, quick concept checks)
- `short`: Text expected response (humanities, open-ended comprehension)
- `structured`: Multi-part question with sub-criteria in rubric (analysis, multi-step processes)

Always align CFU difficulty with assessment standard requirements from the SoW entry and research pack.
</cfu_variety_guide>
```

### 3.2 Replace Math-Specific Card Example (lesson_author_prompts.py:185-210)

**Before** (math percentage example):
```python
{
  "id": "c1",
  "title": "Starter (Retrieval)",
  "explainer": "Find 15% of £80 by combining 10% and 5%...",
  "explainer_plain": "10% of 80 is 8; 5% is 4; together 12.",
  "cfu": {
    "type": "numeric",
    "id": "q1",
    "stem": "Find 15% of £80.",
    "expected": 12,
    "tolerance": 0.0,
    "money2dp": true
  },
  "rubric": {
    "total_points": 2,
    "criteria": [
      {"description": "Method shows correct percentage breakdown", "points": 1},
      {"description": "Final value and units correct", "points": 1}
    ]
  },
  "misconceptions": [
    {
      "id": "MISC_PERCENT_DIV100",
      "misconception": "Students always divide by 100 at end",
      "clarification": "Convert to decimal or split 10% + 5% and multiply values."
    }
  ],
  "context_hooks": ["Use Scottish supermarket flyers"]
}
```

**After** (generic subject-agnostic example):
```python
{
  "id": "c1",
  "title": "Starter (Retrieval)",
  "explainer": "<Subject-appropriate explanation introducing the concept with clear steps>",
  "explainer_plain": "<CEFR A2 simplified version using short sentences and common words>",
  "cfu": {
    "type": "<numeric|mcq|short|structured - choose based on subject and learning objective>",
    "id": "q1",
    "stem": "<Clear question aligned with the card's learning goal>",
    // Type-specific fields:
    // numeric: "expected", "tolerance", optional "money2dp" for currency
    // mcq: "options" array, "answerIndex"
    // short: "expected" text
    // structured: "parts" array with sub-questions
  },
  "rubric": {
    "total_points": <2-4 points typical for single card>,
    "criteria": [
      {"description": "<Method/process criterion>", "points": <1>},
      {"description": "<Accuracy/correctness criterion>", "points": <1>}
    ]
  },
  "misconceptions": [
    {
      "id": "MISC_<SUBJECT>_<ERROR_TYPE>",
      "misconception": "<Common student error for this concept>",
      "clarification": "<How to correct the misconception>"
    }
  ],
  "context_hooks": ["<Scottish context suggestions relevant to the subject>"]
}
```

### 3.3 Replace Scottish Context Examples (lesson_author_prompts.py:567-571)

**Before** (math-specific contexts):
```python
- bus fares £2-£5, supermarket items
- ScotRail, NHS Scotland, local supermarkets (Tesco, Asda, Sainsbury's)
```

**After** (subject-agnostic contexts):
```python
- Subject-appropriate Scottish contexts: transport (ScotRail, buses), health (NHS Scotland), retail (local supermarkets), geography (Scottish landmarks, cities), history (Scottish events, figures), culture (festivals, traditions)
- Adapt context to subject: STEM uses measurements and data from Scottish sources; Humanities uses Scottish historical/cultural examples; Languages uses Scottish place names and cultural references
```

### 3.4 Other Math References to Generalize

**Lines to update**:
- Line 441: Replace "A jumper costs £45. The shop offers 20% off" with generic example
- Line 539: Replace "percentage can be calculated..." with subject-agnostic wording
- Line 47, 147: Keep ScotRail, NHS (these are Scottish contexts, not math-specific)
- Line 209, 613: Replace "Scottish supermarket flyers" and "ScotRail timetable" with generic "Scottish real-world contexts"

---

## 4. Update mvp_2_changes.md Documentation (lines 124-167)

**Before** (outdated schema):
```json
{
  "$id": "lt_best_deals_revision_v1",
  "courseId": "course_c84473",
  "title": "Revision: Best Deals",
  "tags": ["money", "revision"],
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": ["AS1.4"],
  "lesson_type": "revision",
  "estMinutes": 50,
  "version": 1,
  "status": "draft",
  "engagement_tags": ["consolidation", "revision_game"],
  "policy": {
    "calculator_allowed": true
  },
  "accessibility": {
    "explainer_plain": "Short sentences, clear layout."
  },
  "cards": [...]
}
```

**After** (actual database schema):
```json
{
  // Document ID is stored at document level, not as field
  "courseId": "course_c84473",  // string (max 50 chars, required)
  "title": "Revision: Best Deals",  // string (max 255 chars, required)
  "outcomeRefs": "[\"O1\", \"AS1.4\"]",  // JSON string (max 4000 chars, required) - stores both outcomes and assessment standards
  "lesson_type": "revision",  // string (max 50 chars)
  "estMinutes": 50,  // integer (5-120, default 30)
  "version": 1,  // integer (default 1)
  "status": "draft",  // enum: 'draft' or 'published' (default 'draft')
  "createdBy": "lesson_author_agent",  // string (max 50 chars, required)
  "sow_order": 57,  // integer (1-1000) - position in scheme of work
  "engagement_tags": "[\"consolidation\", \"revision_game\"]",  // JSON string (max 1000 chars, default '[]')
  "policy": "{\"calculator_allowed\": true}",  // JSON string (max 2000 chars, default '{}')
  "cards": "[{...card objects...}]"  // JSON string (max 8000 chars, required) - includes explainer_plain for accessibility
}
```

**Add note in documentation**:
```markdown
**IMPORTANT**:
- Complex fields (outcomeRefs, cards, engagement_tags, policy) are stored as **JSON strings** in the database
- Accessibility features (explainer_plain, dyslexia-friendly) are embedded within card objects in the cards JSON
- Assessment standards are combined with outcomeRefs in a single JSON array
- Document $id is managed by Appwrite, not stored as a field
```

---

## Files Affected

1. `/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/langgraph-author-agent/src/lesson_author_prompts.py` (~8 sections, ~50 lines total)
2. `/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/langgraph-author-agent/data/mvp_2_changes.md` (LessonTemplate section, ~40 lines)

---

## Implementation Steps

1. Read full `lesson_author_prompts.py` to identify all math-specific references
2. Apply schema fixes (objectives 1 & 2)
3. Apply subject-agnostic refactoring (objective 3)
4. Update `mvp_2_changes.md` documentation (objective 4)
5. Verify all changes maintain prompt functionality while removing bias

---

## Validation Criteria

- [ ] No references to non-existent files in prompts
- [ ] LessonTemplate schema matches actual Appwrite database structure
- [ ] No math-specific examples in generic prompt sections
- [ ] Scottish context examples work across all subjects
- [ ] Documentation accurately reflects database schema
- [ ] All 7 prompts are subject-agnostic
- [ ] CFU variety guide supports STEM, Humanities, Practical, and Language subjects equally
