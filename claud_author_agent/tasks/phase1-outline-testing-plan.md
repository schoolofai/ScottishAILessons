# Phase 1: Outline Generation - Testing Plan

**Status**: ✅ COMPLETED - ALL TESTS PASS (2026-01-19)
**Created**: 2026-01-19
**Last Updated**: 2026-01-19 22:10 (post minimal schema fix for structured_output)
**Target Course**: Applications of Mathematics Higher (`course_c84476`)

---

## ✅ Latest Test Results (2026-01-19 22:10)

| Test Suite | Result | Duration |
|-----------|--------|----------|
| Unit Tests | 32/32 PASSED ✅ | ~1s |
| Integration Tests | 27/27 PASSED ✅ | ~1s |
| E2E Tests | 19/19 PASSED ✅ | ~2 min |

### E2E Outline Generation Results

| Metric | Value | Status |
|--------|-------|--------|
| **Total Lessons** | 19 | ✅ In sweet spot (15-20) |
| **Critic Score** | 0.76 | ✅ PASS threshold (>0.7) |
| **Mock Exam Skills** | 10/10 | ✅ All skills covered |
| **Revision Attempts** | 1 | ✅ Passed first try |
| **Workspace** | `workspace/20260119_220800` | ✅ Preserved |

### Dimension Scores (from Outline Critic)

| Dimension | Score | Status | Notes |
|-----------|-------|--------|-------|
| Coverage | 1.0 | ✅ | All 10 skills mapped across 18 teach + 1 mock |
| Sequencing | 1.0 | ✅ | Excellent prerequisite ordering, mock exam last |
| Balance | 0.85 | ⚠️ | Statistics block 8/19 (42%), proportional to curriculum |
| Progression | 0.95 | ✅ | Clear complexity gradient foundational → advanced |
| Chunking | ~0.5 | ⚠️ | Some lessons have single skill (AS1 placeholder) |

### Lesson Distribution

| Block | Lessons | Skills Covered |
|-------|---------|----------------|
| Mathematical Modelling | 2 | SKILL_MODELLING, SKILL_SOFTWARE |
| Statistics & Probability | 8 | SKILL_PROBABILITY, SKILL_DATA_LITERACY, SKILL_CORRELATION, SKILL_DATA_ANALYSIS |
| Finance | 4 | SKILL_PV_FV, SKILL_FINANCIAL_PRODUCTS, SKILL_FINANCIAL_PLANNING |
| Planning & Decision Making | 2 | SKILL_PROJECT_PLANNING |
| Course Integration | 2 | Multi-topic synthesis |
| Exam Preparation (Mock) | 1 | All 10 skills |

### Key Improvements from Minimal Schema Fix

The minimal JSON schemas (`src/utils/minimal_schemas.py`) fixed structured_output extraction:

1. **Structured Output Working**: Both outline and critic return `structured_output` in ResultMessage ✅
2. **Schema Size Reduction**:
   - LESSON_OUTLINE_SCHEMA: 904 chars (82% reduction from 5,028)
   - OUTLINE_CRITIC_RESULT_SCHEMA: 1,375 chars (64% reduction from 3,824)
3. **No ToolUseBlock Fallback Needed**: SDK extracts JSON cleanly without workarounds
4. **Web Research**: Agent used 2-3 web searches for SOW exemplars

---

## ⚠️ ARCHITECTURE UPDATE: Simplified Outline Lesson Types

**CRITICAL CHANGE**: The iterative SOW author v2 uses a **simplified lesson type system** for outlines:

| Enum | Valid Values | Usage |
|------|--------------|-------|
| `OutlineLessonType` | `teach`, `mock_exam` | For outline entries only |
| `LessonType` | `teach`, `revision`, `mock_exam`, `independent_practice`, `formative_assessment` | For final AuthoredSOW |

**Why the change?**
- The iterative SOW author generates **only `teach` and `mock_exam`** outline entries
- Each `teach` lesson uses the **simplified 5-card flow**: starter → explainer → modelling → guided_practice → exit_ticket
- **Independent practice is handled by a SEPARATE system** outside of SOW authoring
- This simplifies outline generation and reduces schema drift

**Removed Validation Rules**:
- ~~Every `teach` must have paired `revision` within 3 entries~~ (NO LONGER APPLIES)
- ~~At least 1 `independent_practice` required~~ (Handled by separate system)

---

## Overview

This plan tests **Phase 1 (Outline Generation)** of the iterative SOW author in isolation before proceeding to subsequent phases.

### Target Course Details
| Field | Value |
|-------|-------|
| courseId | `course_c84476` |
| subject | `applications-of-mathematics` |
| level | `higher` |
| sqaCode | `C844 76` |
| structure_type | `skills_based` (Higher level courses use skills framework) |

---

## Test Levels

### Level 1: Unit Tests (No LLM, No Network)

#### Test 1.1: LessonOutlineEntry Model Validation

**File**: `tests/unit/test_sow_schema_models.py`

```python
def test_lesson_outline_entry_valid_teach():
    """Test LessonOutlineEntry with valid teach lesson.

    NOTE: Uses OutlineLessonType which only allows 'teach' and 'mock_exam'.
    """
    entry_data = {
        "order": 1,
        "lesson_type": "teach",
        "label_hint": "Introduction to Financial Mathematics",
        "block_name": "Financial Mathematics",
        "block_index": "B1",
        "primary_outcome_or_skill": "Compound interest calculations",
        "standards_or_skills_codes": ["Compound interest", "Depreciation"],
        "rationale": "Foundation for all financial calculation skills in the course"
    }
    entry = LessonOutlineEntry.model_validate(entry_data)
    assert entry.order == 1
    assert entry.lesson_type == OutlineLessonType.TEACH
```

```python
def test_lesson_outline_entry_invalid_revision():
    """Test LessonOutlineEntry rejects 'revision' (not valid for outlines).

    NOTE: The iterative SOW author only uses 'teach' and 'mock_exam' for outlines.
    """
    entry_data = {
        "order": 1,
        "lesson_type": "revision",  # INVALID for outlines
        "label_hint": "Review Lesson",
        "block_name": "Test Block",
        "block_index": "B1",
        "primary_outcome_or_skill": "Test Skill",
        "standards_or_skills_codes": ["Skill1"],
        "rationale": "Test rationale for this lesson placement"
    }
    with pytest.raises(ValidationError):
        LessonOutlineEntry.model_validate(entry_data)
```

```python
def test_lesson_outline_entry_invalid_independent_practice():
    """Test LessonOutlineEntry rejects 'independent_practice'.

    NOTE: Independent practice is handled by a SEPARATE system outside of SOW authoring.
    """
    entry_data = {
        "order": 1,
        "lesson_type": "independent_practice",  # INVALID for outlines
        "label_hint": "Practice Lesson",
        "block_name": "Test Block",
        "block_index": "B1",
        "primary_outcome_or_skill": "Test Skill",
        "standards_or_skills_codes": ["Skill1"],
        "rationale": "Test rationale"
    }
    with pytest.raises(ValidationError):
        LessonOutlineEntry.model_validate(entry_data)
```

#### Test 1.2: LessonOutline Model Validation

```python
def test_lesson_outline_valid_skills_based():
    """Test LessonOutline with valid skills-based course data.

    NOTE: Uses simplified outline types (teach + mock_exam only).
    """
    outline_data = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 3,
        "structure_type": "skills_based",
        "outlines": [
            {
                "order": 1,
                "lesson_type": "teach",
                "label_hint": "Compound Interest Introduction",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Compound interest",
                "standards_or_skills_codes": ["Compound interest"],
                "rationale": "Foundation skill for financial calculations"
            },
            {
                "order": 2,
                "lesson_type": "teach",  # All content lessons are 'teach' in simplified architecture
                "label_hint": "Depreciation Calculations",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Depreciation",
                "standards_or_skills_codes": ["Compound interest", "Depreciation"],
                "rationale": "Build on compound interest for depreciation skills"
            },
            {
                "order": 3,
                "lesson_type": "mock_exam",
                "label_hint": "Course Assessment",
                "block_name": "Assessment",
                "block_index": "A1",
                "primary_outcome_or_skill": "All skills",
                "standards_or_skills_codes": ["All"],
                "rationale": "Final assessment covering all course content"
            }
        ]
    }
    outline = LessonOutline.model_validate(outline_data)
    assert outline.total_lessons == 3
    assert outline.structure_type == "skills_based"
```

```python
def test_lesson_outline_total_mismatch():
    """Test LessonOutline fails when total_lessons != len(outlines)."""
    outline_data = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 5,  # MISMATCH - only 2 entries
        "structure_type": "skills_based",
        "outlines": [
            {"order": 1, "lesson_type": "teach", ...},
            {"order": 2, "lesson_type": "mock_exam", ...}
        ]
    }
    with pytest.raises(ValidationError) as exc_info:
        LessonOutline.model_validate(outline_data)
    assert "must match" in str(exc_info.value)
```

```python
def test_lesson_outline_missing_mock_exam():
    """Test LessonOutline fails without exactly 1 mock_exam."""
    outline_data = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 2,
        "structure_type": "skills_based",
        "outlines": [
            {"order": 1, "lesson_type": "teach", ...},
            {"order": 2, "lesson_type": "teach", ...}
            # NO mock_exam
        ]
    }
    with pytest.raises(ValidationError) as exc_info:
        LessonOutline.model_validate(outline_data)
    assert "exactly 1 mock_exam" in str(exc_info.value)
```

```python
def test_lesson_outline_all_teach_valid():
    """Test LessonOutline accepts multiple consecutive teach lessons.

    NOTE: No teach-revision pairing required in simplified architecture.
    The iterative SOW author uses only 'teach' and 'mock_exam' for outlines.
    """
    outline_data = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 5,
        "structure_type": "skills_based",
        "outlines": [
            {"order": 1, "lesson_type": "teach", ...},
            {"order": 2, "lesson_type": "teach", ...},
            {"order": 3, "lesson_type": "teach", ...},
            {"order": 4, "lesson_type": "teach", ...},
            {"order": 5, "lesson_type": "mock_exam", ...}
        ]
    }
    # Should PASS - no teach-revision pairing required
    outline = LessonOutline.model_validate(outline_data)
    assert outline.total_lessons == 5
```

---

### Level 2: Integration Tests (Validator Tool)

#### Test 2.1: Outline Validator Tool - Valid Input

**File**: `tests/integration/test_outline_validator_tool.py`

```python
def test_outline_validator_valid_json():
    """Test outline validator accepts valid JSON with simplified types."""
    valid_outline = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 3,
        "structure_type": "skills_based",
        "outlines": [
            {
                "order": 1,
                "lesson_type": "teach",
                "label_hint": "Financial Mathematics Intro",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Compound interest",
                "standards_or_skills_codes": ["Compound interest"],
                "rationale": "Foundation for financial calculations"
            },
            {
                "order": 2,
                "lesson_type": "teach",  # All content lessons are 'teach' in simplified architecture
                "label_hint": "Depreciation Calculations",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Depreciation",
                "standards_or_skills_codes": ["Depreciation"],
                "rationale": "Build on compound interest skills"
            },
            {
                "order": 3,
                "lesson_type": "mock_exam",
                "label_hint": "Course Assessment",
                "block_name": "Assessment",
                "block_index": "A1",
                "primary_outcome_or_skill": "All",
                "standards_or_skills_codes": ["All"],
                "rationale": "Final assessment"
            }
        ]
    }

    result = validate_lesson_outline(json.dumps(valid_outline))

    assert result["valid"] == True
    assert result["stats"]["total_lessons"] == 3
    assert result["stats"]["structure_type"] == "skills_based"
    assert result["stats"]["lesson_types"]["teach"] == 2
    assert result["stats"]["lesson_types"]["mock_exam"] == 1
```

#### Test 2.2: Outline Validator Tool - Invalid JSON

```python
def test_outline_validator_invalid_json():
    """Test outline validator rejects malformed JSON."""
    result = validate_lesson_outline("{invalid json")

    assert result["valid"] == False
    assert "json_error" in result["errors"][0]["type"]
```

#### Test 2.3: Outline Validator Tool - Schema Violations

```python
def test_outline_validator_schema_violation():
    """Test outline validator reports schema violations clearly."""
    invalid_outline = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 10,  # MISMATCH
        "structure_type": "skills_based",
        "outlines": []  # EMPTY
    }

    result = validate_lesson_outline(json.dumps(invalid_outline))

    assert result["valid"] == False
    assert len(result["errors"]) > 0
```

#### Test 2.4: Outline Validator Tool - Rejects Invalid Lesson Types

```python
def test_outline_validator_rejects_revision():
    """Test outline validator rejects 'revision' as outline lesson type."""
    invalid_outline = {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 2,
        "structure_type": "skills_based",
        "outlines": [
            {
                "order": 1,
                "lesson_type": "teach",
                "label_hint": "Lesson 1",
                ...
            },
            {
                "order": 2,
                "lesson_type": "revision",  # INVALID for outlines
                "label_hint": "Lesson 2",
                ...
            }
        ]
    }

    result = validate_lesson_outline(json.dumps(invalid_outline))

    assert result["valid"] == False
    # Error should mention invalid lesson type
```

---

### Level 3: E2E Test (Real LLM, Real Course Data)

#### Test 3.1: Full Outline Generation for Applications of Mathematics Higher

**Command**:
```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent

# Activate virtual environment
source .venv/bin/activate

# Run Phase 1 ONLY (outline generation)
python -c "
import asyncio
from pathlib import Path
from src.iterative_sow_author import IterativeSOWAuthor

async def test_phase1_outline():
    author = IterativeSOWAuthor(
        mcp_config_path='.mcp.json',
        persist_workspace=True,
        log_level='DEBUG'
    )

    # Test Phase 1 only: Generate outline
    courseId = 'course_c84476'  # Applications of Mathematics Higher

    # This will generate Course_outcomes.json and lesson_outline.json
    result = await author._test_phase1_outline_only(courseId)

    outline = result['outline']
    print(f'✅ Outline generated: {outline[\"total_lessons\"]} lessons')
    print(f'   Structure type: {outline[\"structure_type\"]}')
    print(f'   Blocks: {set(e[\"block_name\"] for e in outline[\"outlines\"])}')

    # Count lesson types (should only be teach + mock_exam)
    types = {}
    for e in outline['outlines']:
        lt = e['lesson_type']
        types[lt] = types.get(lt, 0) + 1
    print(f'   Lesson types: {types}')

    return result

asyncio.run(test_phase1_outline())
"
```

**Expected Outputs**:
1. `/workspace/Course_outcomes.json` - Extracted from Appwrite `default.course_outcomes`
2. `/workspace/lesson_outline.json` - Generated outline with:
   - `structure_type: "skills_based"` (Higher level)
   - 10-25 lessons (realistic for Higher course)
   - **All lessons are either `teach` or `mock_exam`** (simplified types)
   - Exactly 1 `mock_exam` (within last 3 lessons)
   - At least 1 `teach` lesson

**Validation Criteria**:
| Criterion | Expected |
|-----------|----------|
| JSON parses successfully | ✅ |
| Pydantic validation passes | ✅ |
| total_lessons matches array length | ✅ |
| Sequential order (1, 2, 3...) | ✅ |
| structure_type = "skills_based" | ✅ |
| Exactly 1 mock_exam | ✅ |
| mock_exam within last 3 lessons | ✅ |
| Only `teach` and `mock_exam` lesson types | ✅ |
| All skills from Course_outcomes.json covered | ✅ |

**REMOVED Criteria** (no longer apply):
| ~~Criterion~~ | Reason |
|---------------|--------|
| ~~At least 1 independent_practice~~ | Handled by SEPARATE system outside SOW authoring |
| ~~Every teach has revision within 3~~ | Not used in simplified iterative architecture |

---

## Test Files Summary

### Existing Tests (Updated for New Architecture)

| Level | File | Tests | Status |
|-------|------|-------|--------|
| Unit | `tests/unit/test_sow_schema_models.py` | 32 tests | ✅ All passing |
| Unit | `tests/unit/test_critic_schema_models.py` | 44 tests | ✅ All passing (NEW) |
| Integration | `tests/integration/test_outline_validator_tool.py` | 27 tests | ✅ All passing |
| E2E | `tests/phases/test_phase1_outline.py` | 17 tests | Ready to run |

### Key Test Updates Made

1. **`test_sow_schema_models.py`**:
   - Added tests verifying `revision`, `independent_practice`, `formative_assessment` are **rejected** for outline entries
   - Added `test_all_teach_lessons_valid()` confirming no teach-revision pairing required
   - Updated fixtures to use `OutlineLessonType` enum

2. **`test_outline_validator_tool.py`**:
   - Updated all fixtures to use `teach` + `mock_exam` only
   - Updated `test_missing_mock_exam` to use teach-only outline

3. **`test_phase1_outline.py`** (E2E):
   - Replaced `test_outline_teach_revision_pairing` with `test_outline_uses_simplified_lesson_types`
   - Updated `test_all_entries_have_valid_lesson_types` to only allow teach + mock_exam

---

## Run Commands

```bash
# Unit + Integration tests (no LLM, fast)
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent
source .venv/bin/activate
pytest tests/unit/test_sow_schema_models.py tests/unit/test_critic_schema_models.py tests/integration/test_outline_validator_tool.py -v

# E2E test (requires LLM, ~1-3 minutes)
pytest tests/phases/test_phase1_outline.py -v -s
```

---

## Architecture Reference

### Simplified Lesson Type Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OUTLINE GENERATION (Phase 1)                              │
│                                                                              │
│  OutlineLessonType enum: ONLY 'teach' and 'mock_exam'                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ lesson_outline.json                                                      ││
│  │                                                                          ││
│  │ outlines: [                                                              ││
│  │   {order: 1, lesson_type: "teach", ...},                                ││
│  │   {order: 2, lesson_type: "teach", ...},                                ││
│  │   {order: 3, lesson_type: "teach", ...},                                ││
│  │   ...                                                                   ││
│  │   {order: N, lesson_type: "mock_exam", ...}  ← Must be within last 3    ││
│  │ ]                                                                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LESSON GENERATION (Phase 2)                               │
│                                                                              │
│  Each 'teach' lesson uses SIMPLIFIED 5-CARD FLOW:                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ lesson_01.json (teach)                                                   ││
│  │                                                                          ││
│  │ card_structure: [                                                        ││
│  │   {card_type: "starter", ...},           ← Prior knowledge activation   ││
│  │   {card_type: "explainer", ...},         ← Core content delivery        ││
│  │   {card_type: "modelling", ...},         ← Teacher demonstration        ││
│  │   {card_type: "guided_practice", ...},   ← Scaffolded practice          ││
│  │   {card_type: "exit_ticket", ...}        ← Quick formative check        ││
│  │ ]                                                                        ││
│  │                                                                          ││
│  │ NOTE: Independent practice is handled by a SEPARATE system              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Validation Rules Summary

| Rule | Phase 1 (Outline) | Phase 2+ (Lessons) |
|------|-------------------|-------------------|
| Valid lesson types | `teach`, `mock_exam` | Same as outline (`teach`, `mock_exam`) |
| Valid card types | N/A | `starter`, `explainer`, `modelling`, `guided_practice`, `exit_ticket` (5 cards) |
| Mock exam count | Exactly 1 | N/A (from outline) |
| Mock exam position | Within last 3 | N/A (from outline) |
| Teach-revision pairing | **NOT REQUIRED** | N/A (not used in iterative architecture) |
| Sequential order | Required (1, 2, 3...) | Required |
| Standards coverage | All skills mapped | All assigned standards addressed |
| Independent practice | N/A | **Handled by SEPARATE system** |

---

## Notes

- **No Force Required**: Phase 1 only generates the outline locally - Appwrite upserts happen at the end of the entire authoring process (Phase 4 Assembly), so `--force` is not needed for Phase 1 testing
- **Skills-Based**: Applications of Mathematics Higher uses skills framework (SKILL_* outcomes)
- **Course Data**: Will be extracted from `default.course_outcomes` collection
- **Workspace**: Persisted for debugging (can examine intermediate files)
- **Critic Loop**: Phase 1 includes outline critic validation before proceeding

---

**End of Plan**
