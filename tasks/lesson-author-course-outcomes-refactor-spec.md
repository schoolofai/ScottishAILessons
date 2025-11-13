# Lesson Author Course Outcomes Refactor Specification

**Status**: Planning
**Priority**: High
**Created**: 2025-01-12
**Dependencies**:
- `bulk-course-seeding-spec.md` (completed - migration scripts exist)
- `skills-based-outcomes-mastery-support-spec.md` (completed - mastery system supports both formats)

---

## Executive Summary

Refactor the lesson author agent to use `default.course_outcomes` directly instead of querying `sqa_education.sqa_current`, eliminating unnecessary indirection introduced by legacy software architecture.

**Key Benefits**:
- ✅ Single source of truth: course_outcomes collection
- ✅ Deterministic outcome references (no human-readable text extraction)
- ✅ Unified support for traditional + skills-based courses
- ✅ Simplified data flow (1 database query instead of 2)
- ✅ Consistent with enrichment system (same keys used everywhere)

---

## Problem Statement

### Current Architecture Issues

**Indirection Problem**:
```
Lesson Author → sqa_education.sqa_current → Course_data.txt → Agent → outcomeRefs (human-readable)
                     ↓
              course_outcomes (NOT USED)
                     ↓
              Enrichment System (queries course_outcomes by outcomeRefs)
                     ↓
              MISMATCH: "Working with surds: Simplification..." != "SKILL_WORKING_WITH_SURDS"
```

**Issues**:
1. **Dual Database Queries**: Agent queries `sqa_education.sqa_current`, then enrichment queries `default.course_outcomes`
2. **Non-Deterministic References**: Agent generates human-readable outcome names from free text
3. **Format Mismatch**: Lesson templates reference "Working with surds: Simplification..." but course_outcomes stores "SKILL_WORKING_WITH_SURDS"
4. **Enrichment Failures**: CourseOutcomesDriver needs fallback logic to handle mismatches
5. **Legacy Indirection**: Migration scripts exist to populate course_outcomes, but lesson author doesn't use them

### Legacy Context

**Why This Existed**:
- Originally, only `sqa_education.sqa_current` had SQA course data
- `course_outcomes` collection was added later
- Migration scripts (`seedSingleCourse.ts`, `bulkSeedAllCourses.ts`) were created to populate course_outcomes
- Lesson author was never updated to use the new collection

**Migration Scripts Status**:
- ✅ `assistant-ui-frontend/scripts/seedSingleCourse.ts` - Extracts from sqa_current → course_outcomes
- ✅ `assistant-ui-frontend/scripts/bulkSeedAllCourses.ts` - Batch processing
- ✅ Both handle traditional (unit-based) and skills-based courses
- ✅ All courses should now be in course_outcomes

---

## Desired Architecture

### Simplified Data Flow

```
Lesson Author → default.course_outcomes → Course_outcomes.json → Agent → outcomeRefs (outcomeId)
                                                                             ↓
                                                                  "O1", "AS1.1", "SKILL_WORKING_WITH_SURDS"
                                                                             ↓
                                                              Enrichment System (direct match)
                                                                             ↓
                                                                   ✅ PERFECT MATCH
```

**Benefits**:
1. **Single Database**: Only queries `default.course_outcomes`
2. **Deterministic**: Uses `outcomeId` field directly from database
3. **Format Consistency**: Same keys used in lesson templates and enrichment
4. **No Fallbacks Needed**: Direct match on outcomeId
5. **Future-Proof**: Works for any course type (traditional, skills-based, future formats)

---

## Data Structure Comparison

### Current: Course_data.txt (from sqa_education.sqa_current)

**Format**: Structured JSON dump (NOT free-form text)
**Source**: Raw JSON extracted from `sqa_education.sqa_current` collection's `data` field
```json
{
  "level_name": "National 5",
  "qualification": {
    "title": "National 5 Mathematics",
    "course_code": "C847 75"
  },
  "course_structure": {
    "structure_type": "skills_based",
    "skills_framework": {
      "skills": [
        {
          "name": "Working with surds",
          "description": "Simplification, Rationalising denominators",
          "topic": "Numerical skills"
        },
        {
          "name": "Simplifying expressions using the laws of indices",
          "description": "Multiplication and division using positive and negative indices...",
          "topic": "Numerical skills"
        }
      ]
    }
  }
}
```

**Footer Metadata**:
```text
---
Extracted from Appwrite: 2025-10-19T16:04:42.727518
Document extracted using Python utility (no LLM processing) - Raw JSON dump
```

**Agent Behavior**:
- Reads structured JSON (parseable, no ambiguity)
- Navigates nested paths: `course_structure.skills_framework.skills[].name`
- Concatenates skill name + description: `"Working with surds: Simplification, Rationalising denominators"`
- Generates `outcomeRefs` using these concatenated strings
- **Problem**: Still generates human-readable descriptions instead of using outcomeId field

---

### Desired: Course_outcomes.json (from default.course_outcomes)

**Format**: Structured JSON array from course_outcomes collection

**Traditional Course (National 3/4)**:
```json
{
  "courseId": "course_c84473",
  "courseSqaCode": "C844 73",
  "structure_type": "unit_based",
  "outcomes": [
    {
      "$id": "outcome_test_simple_o1",
      "outcomeId": "O1",
      "outcomeTitle": "Manage money in basic real-life contexts",
      "unitCode": "HV7Y 73",
      "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
      "assessmentStandards": "[{\"code\":\"AS1.1\",\"desc\":\"Identifying factors affecting income...\"},{\"code\":\"AS1.2\",\"desc\":\"Calculating income and expenditure...\"}]",
      "teacherGuidance": "**AS1.1**: Identifying factors affecting income...",
      "keywords": "[\"money\",\"income\",\"expenditure\"]"
    },
    {
      "$id": "outcome_test_simple_o2",
      "outcomeId": "O2",
      "outcomeTitle": "Interpret graphical data",
      "unitCode": "HV7Y 73",
      "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
      "assessmentStandards": "[{\"code\":\"AS2.1\",\"desc\":\"Reading data from charts...\"},{\"code\":\"AS2.2\",\"desc\":\"Interpreting trends...\"}]",
      "teacherGuidance": "**AS2.1**: Reading data from charts...",
      "keywords": "[\"graphs\",\"charts\",\"data\"]"
    }
  ]
}
```

**Skills-Based Course (National 5+)**:
```json
{
  "courseId": "course_c84775",
  "courseSqaCode": "C847 75",
  "structure_type": "skills_based",
  "outcomes": [
    {
      "$id": "topic_numerical_skills_doc_id",
      "outcomeId": "TOPIC_NUMERICAL_SKILLS",
      "outcomeTitle": "Numerical skills",
      "unitCode": "TOPIC_NUMERICAL_SKILLS",
      "unitTitle": "Numerical skills",
      "assessmentStandards": "[{\"code\":\"TOPIC_OVERVIEW\",\"desc\":\"This topic covers: Working with surds, Simplifying expressions...\",\"skills_list\":[\"Working with surds\",\"Simplifying expressions using the laws of indices\",\"Rounding\"]}]",
      "teacherGuidance": "**Topic Overview**: Numerical skills\n\nThis topic area groups 6 related skills.",
      "keywords": "[\"numerical\",\"skills\"]"
    },
    {
      "$id": "skill_working_with_surds_doc_id",
      "outcomeId": "SKILL_WORKING_WITH_SURDS",
      "outcomeTitle": "Working with surds",
      "unitCode": "SKILL_WORKING_WITH_SURDS",
      "unitTitle": "Working with surds",
      "assessmentStandards": "[{\"code\":\"AS1\",\"desc\":\"Simplification, Rationalising denominators\"}]",
      "teacherGuidance": "**Working with surds**\n\nSimplification, Rationalising denominators\n\n**Parent Topics**: Numerical skills",
      "keywords": "[\"working\",\"surds\",\"simplification\",\"rationalising\",\"denominators\"]"
    },
    {
      "$id": "skill_simplifying_expressions_doc_id",
      "outcomeId": "SKILL_SIMPLIFYING_EXPRESSIONS_USING_THE_LAWS_OF_INDICES",
      "outcomeTitle": "Simplifying expressions using the laws of indices",
      "unitCode": "SKILL_SIMPLIFYING_EXPRESSIONS_USING_THE_LAWS_OF_INDICES",
      "unitTitle": "Simplifying expressions using the laws of indices",
      "assessmentStandards": "[{\"code\":\"AS1\",\"desc\":\"Multiplication and division using positive and negative indices...\"}]",
      "teacherGuidance": "**Simplifying expressions using the laws of indices**\n\nMultiplication and division...",
      "keywords": "[\"simplifying\",\"expressions\",\"laws\",\"indices\"]"
    }
  ]
}
```

**Agent Behavior** (Desired):
- Reads structured JSON
- Uses `outcomeId` field directly
- Generates `outcomeRefs: ["O1", "AS1.1"]` (traditional) or `outcomeRefs: ["SKILL_WORKING_WITH_SURDS"]` (skills-based)
- **Benefit**: Deterministic, format-agnostic

---

## Implementation Steps

### Step 1: Create Course Outcomes Extractor Utility (NEW)

**File**: `claud_author_agent/src/utils/course_outcomes_extractor.py`

**Purpose**: Extract course_outcomes from `default.course_outcomes` and write to workspace

**Function Signature**:
```python
async def extract_course_outcomes_to_file(
    courseId: str,
    mcp_config_path: str,
    output_path: Path
) -> Dict[str, Any]:
    """Extract course_outcomes from default.course_outcomes.

    Args:
        courseId: Course identifier (e.g., "course_c84473")
        mcp_config_path: Path to .mcp.json configuration
        output_path: Path to write Course_outcomes.json

    Returns:
        Dictionary containing:
            - courseId: str
            - courseSqaCode: str
            - structure_type: str ("unit_based" or "skills_based")
            - outcomes: List[CourseOutcome]

    Raises:
        ValueError: If courseId not found in course_outcomes
        ValueError: If no outcomes found for courseId

    Note:
        Queries default.course_outcomes collection via Appwrite MCP.
        Detects structure_type automatically:
        - unit_based: If any outcomeId matches /^[A-Z]+\d+$/
        - skills_based: If any outcomeId matches /^(TOPIC|SKILL)_/
    """
```

**Implementation Logic**:
```python
from .appwrite_mcp import list_appwrite_documents
import json
import logging

logger = logging.getLogger(__name__)

async def extract_course_outcomes_to_file(
    courseId: str,
    mcp_config_path: str,
    output_path: Path
) -> Dict[str, Any]:
    """Extract course_outcomes from default.course_outcomes."""

    logger.info(f"Extracting course_outcomes for courseId: {courseId}")

    # Query course_outcomes collection
    outcomes_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="course_outcomes",
        queries=[
            f'equal("courseId", "{courseId}")',
            'limit(500)'  # Support large skills-based courses (National 5 Math = 46 outcomes)
        ],
        mcp_config_path=mcp_config_path
    )

    if not outcomes_docs or len(outcomes_docs) == 0:
        raise ValueError(
            f"No course_outcomes found for courseId '{courseId}'. "
            f"Ensure the course has been seeded using seedSingleCourse.ts or bulkSeedAllCourses.ts."
        )

    logger.info(f"Found {len(outcomes_docs)} course_outcomes for {courseId}")

    # Extract courseSqaCode from first outcome
    courseSqaCode = outcomes_docs[0].get("courseSqaCode", "")

    # Detect structure_type automatically
    structure_type = _detect_structure_type(outcomes_docs)

    logger.info(f"Detected structure_type: {structure_type}")

    # Build output structure
    output_data = {
        "courseId": courseId,
        "courseSqaCode": courseSqaCode,
        "structure_type": structure_type,
        "outcomes": outcomes_docs
    }

    # Write to file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Wrote course_outcomes to: {output_path}")

    return output_data


def _detect_structure_type(outcomes: List[Dict[str, Any]]) -> str:
    """Auto-detect course structure type from outcomeIds.

    Args:
        outcomes: List of course_outcome documents

    Returns:
        "unit_based" or "skills_based"

    Logic:
        - If any outcomeId matches TOPIC_ or SKILL_ → skills_based
        - Otherwise → unit_based
    """
    for outcome in outcomes:
        outcome_id = outcome.get("outcomeId", "")
        if outcome_id.startswith("TOPIC_") or outcome_id.startswith("SKILL_"):
            return "skills_based"

    return "unit_based"
```

---

### Step 2: Replace Course_data.txt Extraction

**File**: `claud_author_agent/src/lesson_author_claude_client.py`

**Current Code** (lines 185-208):
```python
logger.info("Pre-processing: Extracting Course_data.txt via Python utility...")

from .utils.course_data_extractor import extract_course_data_to_file

course_data_path = workspace_path / "Course_data.txt"

from .utils.sow_extractor import get_course_metadata_from_sow

subject, level = await get_course_metadata_from_sow(
    courseId=courseId,
    mcp_config_path=str(self.mcp_config_path)
)

await extract_course_data_to_file(
    subject=subject,
    level=level,
    mcp_config_path=str(self.mcp_config_path),
    output_path=course_data_path
)

logger.info(f"✅ Course_data.txt ready at: {course_data_path}")
logger.info("   Python extraction complete - no LLM tokens used")
```

**New Code**:
```python
logger.info("Pre-processing: Extracting Course_outcomes.json via Python utility...")

from .utils.course_outcomes_extractor import extract_course_outcomes_to_file

course_outcomes_path = workspace_path / "Course_outcomes.json"

await extract_course_outcomes_to_file(
    courseId=courseId,
    mcp_config_path=str(self.mcp_config_path),
    output_path=course_outcomes_path
)

logger.info(f"✅ Course_outcomes.json ready at: {course_outcomes_path}")
logger.info(f"   Extracted {len(outcomes_data['outcomes'])} outcomes from default.course_outcomes")
logger.info("   Python extraction complete - no LLM tokens used")
```

---

### Step 3: Update Agent Initial Prompt

**File**: `claud_author_agent/src/lesson_author_claude_client.py`

**Current Prompt** (lines 532-545):
```python
✅ `Course_data.txt` has been pre-populated by Python extraction (no subagent needed)
   - Source: sqa_education.sqa_current collection
   - Extracted: Official SQA course structure, units, outcomes, assessment standards
   - Location: `/workspace/Course_data.txt`
```

**New Prompt**:
```python
✅ `Course_outcomes.json` has been pre-populated by Python extraction (no subagent needed)
   - Source: default.course_outcomes collection
   - Extracted: All course outcomes with outcomeId, outcomeTitle, assessmentStandards
   - Structure Type: {structure_type} (unit_based or skills_based)
   - Total Outcomes: {len(outcomes)}
   - Location: `/workspace/Course_outcomes.json`
   - Format: Structured JSON array (deterministic outcome references)
```

---

### Step 4: Update Lesson Author Prompt (Agent Instructions)

**File**: `claud_author_agent/src/prompts/lesson_author_prompt_v2.md`

**Current References to Course_data.txt**:
```markdown
**Pre-loaded Inputs**:
  - `/workspace/sow_entry_input.json` (SOW lesson design with rich pedagogical detail)
  - `/workspace/sow_context.json` (Course-level coherence, accessibility, engagement notes)
  - `/workspace/Course_data.txt` (Official SQA outcomes, assessment standards)
```

**New References**:
```markdown
**Pre-loaded Inputs**:
  - `/workspace/sow_entry_input.json` (SOW lesson design with rich pedagogical detail)
  - `/workspace/sow_context.json` (Course-level coherence, accessibility, engagement notes)
  - `/workspace/Course_outcomes.json` (Course outcomes with deterministic outcomeId references)

**Course_outcomes.json Structure**:
```json
{
  "courseId": "course_c84775",
  "structure_type": "skills_based",  // or "unit_based"
  "outcomes": [
    {
      "outcomeId": "SKILL_WORKING_WITH_SURDS",  // USE THIS in outcomeRefs
      "outcomeTitle": "Working with surds",
      "unitTitle": "Working with surds",
      "assessmentStandards": "[{\"code\":\"AS1\",\"desc\":\"Simplification, Rationalising denominators\"}]",
      "teacherGuidance": "...",
      "keywords": "[\"surds\",\"simplification\"]"
    }
  ]
}
```

**CRITICAL: outcomeRefs Field**:
You MUST use the `outcomeId` field directly from Course_outcomes.json when populating `lesson_template.json`.

**Traditional Courses (unit_based)**:
- outcomeRefs: `["O1", "O2"]` (outcome-level references)
- OR: `["AS1.1", "AS1.2"]` (assessment standard-level references)

**Skills-Based Courses (skills_based)**:
- outcomeRefs: `["SKILL_WORKING_WITH_SURDS", "SKILL_ROUNDING"]` (skill-level references)
- OR: `["TOPIC_NUMERICAL_SKILLS"]` (topic-level references)

**DO NOT**:
- ❌ Use human-readable descriptions: "Working with surds: Simplification, Rationalising denominators"
- ❌ Generate outcome names from free text
- ❌ Reference outcomes that don't exist in Course_outcomes.json

**DO**:
- ✅ Use `outcomeId` field directly: "SKILL_WORKING_WITH_SURDS"
- ✅ Validate all outcomeRefs exist in Course_outcomes.json
- ✅ Match lesson content to outcome's `teacherGuidance` and `assessmentStandards`
```

---

### Step 5: Update Lesson Critic Validation

**File**: `claud_author_agent/src/prompts/lesson_critic_prompt_v2.md`

**Add New Validation Check**:
```markdown
### Schema Gate: outcomeRefs Validation (CRITICAL)

**Requirement**: All outcomeRefs must exist in Course_outcomes.json

**Check**:
```python
# Read Course_outcomes.json
with open('/workspace/Course_outcomes.json', 'r') as f:
    course_outcomes = json.load(f)

valid_outcome_ids = {outcome['outcomeId'] for outcome in course_outcomes['outcomes']}

# Read lesson_template.json
with open('/workspace/lesson_template.json', 'r') as f:
    lesson_template = json.load(f)

outcome_refs = json.loads(lesson_template['outcomeRefs'])

# Validate all refs exist
invalid_refs = [ref for ref in outcome_refs if ref not in valid_outcome_ids]

if invalid_refs:
    # INSTANT FAIL
    return {
        "overall_pass": False,
        "schema_gate_pass": False,
        "error": f"Invalid outcomeRefs: {invalid_refs}. Must use outcomeId from Course_outcomes.json"
    }
```

**Examples**:
- ✅ PASS: `["O1", "AS1.1"]` (both exist in Course_outcomes.json)
- ✅ PASS: `["SKILL_WORKING_WITH_SURDS"]` (exists in Course_outcomes.json)
- ❌ FAIL: `["Working with surds: Simplification..."]` (human-readable, not in Course_outcomes.json)
- ❌ FAIL: `["SKILL_NONEXISTENT"]` (not in Course_outcomes.json)
```

---

### Step 6: Update Blank Template Generator

**File**: `claud_author_agent/src/utils/blank_template_generator.py`

**Current Logic**:
- Initializes `outcomeRefs: "[]"` (empty array)
- Agent fills in outcomeRefs manually

**No Changes Needed**:
- Keep same initialization logic
- Agent will populate outcomeRefs using Course_outcomes.json

---

### Step 7: Deprecate Old Utilities (Optional Cleanup)

**Files to Mark as Deprecated**:
- `claud_author_agent/src/utils/course_data_extractor.py` (replaced by course_outcomes_extractor.py)

**Add Deprecation Notice**:
```python
"""
DEPRECATED: This module is deprecated and will be removed in a future version.

Reason: Lesson author now uses default.course_outcomes directly instead of sqa_education.sqa_current.

Replacement: Use course_outcomes_extractor.py instead.

Migration: See tasks/lesson-author-course-outcomes-refactor-spec.md
"""
import warnings

warnings.warn(
    "course_data_extractor.py is deprecated. Use course_outcomes_extractor.py instead.",
    DeprecationWarning,
    stacklevel=2
)
```

---

## File Format Changes

### Before: Course_data.txt

**Format**: Free-form text
**Source**: `sqa_education.sqa_current`
**Example**:
```text
Course: C847 75 - National 5 Mathematics

Skills Framework:
- Working with surds: Simplification, Rationalising denominators
- Simplifying expressions using the laws of indices: Multiplication and division...

Topic Areas:
- Numerical skills
  Skills: Working with surds, Simplifying expressions, Rounding
```

**Issues**:
- Non-deterministic parsing
- Human-readable names (no IDs)
- Requires agent to extract outcome names manually

---

### After: Course_outcomes.json

**Format**: Structured JSON
**Source**: `default.course_outcomes`
**Example** (Traditional):
```json
{
  "courseId": "course_c84473",
  "courseSqaCode": "C844 73",
  "structure_type": "unit_based",
  "outcomes": [
    {
      "$id": "outcome_test_simple_o1",
      "outcomeId": "O1",
      "outcomeTitle": "Manage money in basic real-life contexts",
      "unitCode": "HV7Y 73",
      "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
      "assessmentStandards": "[{\"code\":\"AS1.1\",\"desc\":\"Identifying factors affecting income...\"},{\"code\":\"AS1.2\",\"desc\":\"Calculating income and expenditure...\"}]",
      "teacherGuidance": "**AS1.1**: Identifying factors affecting income...",
      "keywords": "[\"money\",\"income\",\"expenditure\"]"
    }
  ]
}
```

**Example** (Skills-Based):
```json
{
  "courseId": "course_c84775",
  "courseSqaCode": "C847 75",
  "structure_type": "skills_based",
  "outcomes": [
    {
      "$id": "skill_working_with_surds_doc_id",
      "outcomeId": "SKILL_WORKING_WITH_SURDS",
      "outcomeTitle": "Working with surds",
      "unitCode": "SKILL_WORKING_WITH_SURDS",
      "unitTitle": "Working with surds",
      "assessmentStandards": "[{\"code\":\"AS1\",\"desc\":\"Simplification, Rationalising denominators\"}]",
      "teacherGuidance": "**Working with surds**\n\nSimplification, Rationalising denominators\n\n**Parent Topics**: Numerical skills",
      "keywords": "[\"working\",\"surds\",\"simplification\"]"
    }
  ]
}
```

**Benefits**:
- Deterministic outcomeId field
- Structured data (no parsing needed)
- Same format for traditional + skills-based courses
- Direct mapping to enrichment system

---

## Testing Strategy

### Test Case 1: Traditional Course (National 3 App of Math)

**Setup**:
1. Run lesson author for `courseId: "course_c84473"`, `order: 1`
2. Verify Course_outcomes.json created with `structure_type: "unit_based"`
3. Verify lesson_template.json has `outcomeRefs: ["O1"]` or `["AS1.1", "AS1.2"]`

**Validation**:
- ✅ Course_outcomes.json contains outcomes with `outcomeId: "O1"`, `"O2"`, etc.
- ✅ outcomeRefs field uses outcomeId directly
- ✅ No human-readable descriptions in outcomeRefs
- ✅ All outcomeRefs exist in Course_outcomes.json

---

### Test Case 2: Skills-Based Course (National 5 Math)

**Setup**:
1. Run lesson author for `courseId: "course_c84775"`, `order: 1`
2. Verify Course_outcomes.json created with `structure_type: "skills_based"`
3. Verify lesson_template.json has `outcomeRefs: ["SKILL_WORKING_WITH_SURDS"]`

**Validation**:
- ✅ Course_outcomes.json contains outcomes with `outcomeId: "SKILL_WORKING_WITH_SURDS"`, `"TOPIC_NUMERICAL_SKILLS"`, etc.
- ✅ outcomeRefs field uses outcomeId directly
- ✅ No human-readable descriptions in outcomeRefs
- ✅ All outcomeRefs exist in Course_outcomes.json

---

### Test Case 3: Enrichment Flow End-to-End

**Setup**:
1. Author lesson template using new system
2. Create lesson session using authored lesson template
3. Complete lesson
4. Verify enrichment works without fallback queries

**Validation**:
- ✅ lesson_template.json has `outcomeRefs: ["SKILL_X"]`
- ✅ Session creation enriches outcomes by querying course_outcomes
- ✅ Primary query (by outcomeId) succeeds (no fallback needed)
- ✅ enriched_outcomes populated correctly
- ✅ Mastery tracking works
- ✅ Spaced repetition recommendations generated

---

## Migration Path

### Phase 1: Implement New Extractor (Week 1)

**Tasks**:
- [ ] Create `course_outcomes_extractor.py` utility
- [ ] Add unit tests for structure_type detection
- [ ] Test with traditional course (course_c84473)
- [ ] Test with skills-based course (course_c84775)

**Acceptance Criteria**:
- Extractor creates valid Course_outcomes.json
- Auto-detection works for both course types
- All outcome fields present (outcomeId, teacherGuidance, assessmentStandards)

---

### Phase 2: Update Lesson Author Client (Week 1)

**Tasks**:
- [ ] Replace Course_data.txt extraction with Course_outcomes.json
- [ ] Update initial prompt to reference Course_outcomes.json
- [ ] Update MCP tool registration (no changes needed)
- [ ] Test with existing prompt (verify agent can read JSON)

**Acceptance Criteria**:
- Agent receives Course_outcomes.json in workspace
- Agent can read and parse JSON
- No errors in pre-processing step

---

### Phase 3: Update Agent Prompts (Week 2)

**Tasks**:
- [ ] Update lesson_author_prompt_v2.md with outcomeRefs instructions
- [ ] Add Course_outcomes.json structure documentation
- [ ] Add validation examples (DO/DON'T)
- [ ] Update lesson_critic_prompt_v2.md with outcomeRefs validation

**Acceptance Criteria**:
- Agent uses outcomeId field directly
- outcomeRefs validation works (critic checks)
- No human-readable descriptions generated

---

### Phase 4: Integration Testing (Week 2)

**Tasks**:
- [ ] Test traditional course authoring
- [ ] Test skills-based course authoring
- [ ] Test enrichment flow end-to-end
- [ ] Compare old vs new outcomeRefs format

**Acceptance Criteria**:
- All tests pass
- Enrichment works without fallback
- No regression in lesson quality

---

### Phase 5: Cleanup (Week 3)

**Tasks**:
- [x] Add deprecation notices to old utilities
- [ ] Update documentation
- [ ] Remove fallback query from CourseOutcomesDriver (optional - can keep for safety)
- [ ] Archive old Course_data.txt examples

---

### Phase 8: Token Optimization & Data Validation (Corrections)

**Purpose**: Remove unnecessary provenance metadata from agent prompts and validate data integrity

**Tasks Completed**:
- [x] Remove "Source:" metadata from all agent prompts (37% token reduction in metadata)
- [x] Fix Course_data.txt format documentation (was incorrectly described as "free-form text")
- [x] Create `validateOutcomeIdUniqueness.ts` script for data integrity checks

**Files Modified**:
1. `claud_author_agent/src/lesson_author_claude_client.py` - Removed Source/Extracted lines
2. `claud_author_agent/src/sow_author_claude_client.py` - Removed Source/Extracted lines
3. `claud_author_agent/src/prompts/unified_critic_prompt.md` - Removed Source line
4. `claud_author_agent/src/prompts/sow_author_prompt.md` - Removed Source lines (2)
5. `tasks/lesson-author-course-outcomes-refactor-spec.md` - Fixed format documentation

**New Script Created**:
- `assistant-ui-frontend/scripts/validateOutcomeIdUniqueness.ts`
  - Validates outcomeId uniqueness within each course
  - Detects duplicate outcomeIds (data integrity check)
  - Run before migration to ensure clean data

**Token Savings**:
- Lesson Author: ~20 tokens per execution
- SOW Author: ~14 tokens per execution
- Unified Critic: ~10 tokens per execution
- **Total**: ~44 tokens saved per full authoring pipeline

**Rationale**:
- Agents don't need provenance (where data came from)
- Agents only need: Location (where file is) + Format (how to parse it)
- "Source:" metadata is for humans (documentation), not execution
- Cleaner prompts = better focus on actionable information

**Composite Format Decision**:
- **NOT IMPLEMENTED**: `documentId:outcomeId` composite format
- **Reason**: Current (courseId, outcomeId) composite works fine
- **Validation**: Use script to check for within-course duplicates only
- High complexity (8+ locations need parsing) vs low benefit

**Bug Fix**:
- Fixed `NameError: name 'outcomes_data' is not defined` at line 537
- Root cause: Token optimization removed "Source:" metadata but introduced reference to variable not in scope
- Solution: Added `outcomes_data: Dict[str, Any]` parameter to `_build_initial_prompt()` method signature
- Also fixed: SyntaxWarning for invalid escape sequence `\d` in course_outcomes_extractor.py docstring

---

## Acceptance Criteria

### Critical ✅

- [ ] **course_outcomes_extractor.py** implemented and tested
- [ ] **Course_outcomes.json** created with correct structure for both course types
- [ ] **structure_type auto-detection** works (unit_based vs skills_based)
- [ ] **outcomeRefs field** uses outcomeId directly (no human-readable text)
- [ ] **Enrichment primary query** succeeds (no fallback needed)
- [ ] **Traditional courses** generate valid outcomeRefs ("O1", "AS1.1")
- [ ] **Skills-based courses** generate valid outcomeRefs ("SKILL_X", "TOPIC_X")

### Important ✅

- [ ] **Lesson critic** validates outcomeRefs against Course_outcomes.json
- [ ] **Agent prompts** updated with clear instructions
- [ ] **Integration tests** pass for both course types
- [ ] **Deprecation notices** added to old utilities

### Nice-to-Have 📝

- [ ] **Fallback query removed** from CourseOutcomesDriver (if safe)
- [ ] **Documentation updated** with new data flow
- [ ] **Migration guide** for existing lesson templates

---

## Risk Assessment

### Low Risk ✅

- **course_outcomes collection exists**: Already populated by migration scripts
- **Data structure known**: Same format used by enrichment system
- **Extraction logic simple**: Standard Appwrite MCP query
- **Auto-detection straightforward**: Check for TOPIC_/SKILL_ prefix

### Medium Risk ⚠️

- **Agent behavior change**: Requires prompt updates to use outcomeId
  - **Mitigation**: Clear DO/DON'T examples in prompt
  - **Mitigation**: Critic validates outcomeRefs format

- **Existing lesson templates**: May have old outcomeRefs format
  - **Mitigation**: Keep fallback query in CourseOutcomesDriver for compatibility
  - **Mitigation**: Re-author templates gradually

### Zero Risk 🎯

- **Backward compatibility**: Old lesson templates continue to work (fallback query)
- **Incremental rollout**: Can test with single course before full deployment
- **Rollback easy**: Revert to Course_data.txt extraction if needed

---

## References

### Related Specifications
- `bulk-course-seeding-spec.md` - Migration scripts that populate course_outcomes
- `skills-based-outcomes-mastery-support-spec.md` - Mastery system support for both formats
- `OUTCOME_MIGRATION_GUIDE.md` - Course outcomes seeding workflow

### Implementation Files
- `claud_author_agent/src/lesson_author_claude_client.py` - Main orchestrator
- `claud_author_agent/src/utils/course_outcomes_extractor.py` - NEW utility
- `claud_author_agent/src/utils/course_data_extractor.py` - OLD utility (deprecated)
- `claud_author_agent/src/prompts/lesson_author_prompt_v2.md` - Agent instructions
- `claud_author_agent/src/prompts/lesson_critic_prompt_v2.md` - Validation logic

### Migration Scripts
- `assistant-ui-frontend/scripts/seedSingleCourse.ts` - Single course migration
- `assistant-ui-frontend/scripts/bulkSeedAllCourses.ts` - Batch migration
- `assistant-ui-frontend/scripts/lib/unitBasedExtraction.ts` - Traditional extraction
- `assistant-ui-frontend/scripts/lib/skillsBasedExtraction.ts` - Skills-based extraction

---

## Summary

This refactor eliminates the indirection through `sqa_education.sqa_current` by using `default.course_outcomes` directly, resulting in:

1. **Deterministic outcomeRefs**: Uses outcomeId field instead of human-readable text
2. **Single source of truth**: course_outcomes collection
3. **Format-agnostic**: Works for traditional and skills-based courses
4. **Simplified data flow**: One database query instead of two
5. **Enrichment compatibility**: Direct match on outcomeId (no fallbacks needed)

The migration can be done incrementally with minimal risk, and existing lesson templates remain compatible via the fallback query mechanism.
