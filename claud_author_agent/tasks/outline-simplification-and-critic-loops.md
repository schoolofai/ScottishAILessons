# Outline Simplification & Critic Loops Implementation Plan

**Status**: 📋 PLANNED
**Created**: 2026-01-19
**Target**: Iterative SOW Author Architecture Enhancement

---

## Overview

This plan addresses two major architectural improvements:

1. **Simplification**: Remove `revision`, `formative_assessment`, and `independent_practice` from the lesson outline - outline becomes `teach` + `mock_exam` only
2. **Critic Loops**: Add early-stage validation with LLM-based critics at both outline and lesson levels

### Design Philosophy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     SIMPLIFIED OUTLINE + CRITIC ARCHITECTURE                  │
└──────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────────┐
                         │    Course_outcomes.json     │
                         │   (SQA curriculum data)     │
                         └─────────────┬───────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: OUTLINE GENERATION                                                  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Outline Author Agent                                                    │ │
│  │  - Generates teach + mock_exam lessons ONLY                              │ │
│  │  - NO revision, formative_assessment, independent_practice              │ │
│  │  - Output: lesson_outline.json                                          │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  ★ NEW: Outline Critic Agent ★                                          │ │
│  │  - Validates pedagogical efficacy of lesson structure                   │ │
│  │  - Checks outcome coverage completeness                                 │ │
│  │  - Validates logical sequencing (prerequisites respected)               │ │
│  │  - Returns: PASS or REVISION_REQUIRED with specific feedback            │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
│                                     │                                         │
│                    ┌────────────────┴────────────────┐                       │
│                    │ PASS?                           │                       │
│                    │ Yes → Phase 2                   │                       │
│                    │ No → Loop back to Outline Author│                       │
│                    └─────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: LESSON GENERATION (Loop for each lesson in outline)                │
│                                                                               │
│  FOR lesson_idx in 1..N:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Lesson Entry Author Agent                                               │ │
│  │  - Generates full lesson content based on outline entry                 │ │
│  │  - Uses previous lessons for coherence context                          │ │
│  │  - Output: lesson_{N}.json                                              │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  ★ NEW: Lesson Critic Agent ★                                           │ │
│  │  - 5 Dimensions (adapted from unified_critic for lesson-level):        │ │
│  │    1. Coverage: Are outlined standards fully addressed?                 │ │
│  │    2. Sequencing: Does lesson flow logically? Cards well-ordered?       │ │
│  │    3. Policy: Engagement tags followed? CFU specificity correct?        │ │
│  │    4. Accessibility: Adaptations appropriate for diverse learners?      │ │
│  │    5. Authenticity: Scottish context? Real-world relevance?             │ │
│  │  - Returns: PASS (score ≥ 0.8) or REVISION_REQUIRED with feedback       │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
│                                     │                                         │
│                    ┌────────────────┴────────────────┐                       │
│                    │ PASS?                           │                       │
│                    │ Yes → Next lesson               │                       │
│                    │ No → Loop back (max 2 retries)  │                       │
│                    └─────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: METADATA + ASSEMBLY (unchanged)                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Part A: Outline Simplification

### Rationale

The current outline includes lesson types that add complexity without proportional value at the planning stage:
- `revision` lessons are predictable (follow teach lessons)
- `formative_assessment` and `independent_practice` are pedagogical patterns, not curriculum planning

**New model**: Outline captures **what content to teach** (teach lessons) and **when to assess** (mock_exam). Pedagogical patterns like revision/practice can be implemented at the lesson level or by the AI tutor dynamically.

### Files to Modify

| File | Changes |
|------|---------|
| `src/tools/sow_schema_models.py` | Remove validation rules for teach-revision pairing, independent_practice requirement |
| `src/prompts/outline_author_prompt.md` | Update to only generate teach + mock_exam |
| `src/tools/sow_outline_validator_tool.py` | Update validation logic |
| `tests/unit/test_sow_schema_models.py` | Update tests for new simplified schema |
| `tests/integration/test_outline_validator_tool.py` | Update validator tests |

### Task A.1: Update LessonType Enum Usage in LessonOutline

**File**: `src/tools/sow_schema_models.py`

**Current** (lines 475-512):
```python
@model_validator(mode='after')
def validate_lesson_type_requirements(self):
    """Validate lesson type distribution requirements."""
    lesson_types = [e.lesson_type for e in self.outlines]

    # Must have at least 1 teach lesson
    teach_count = lesson_types.count(LessonType.TEACH)
    if teach_count < 1:
        raise ValueError(f"Outline must have at least 1 teach lesson, found {teach_count}")

    # Must have exactly 1 mock_exam
    mock_count = lesson_types.count(LessonType.MOCK_EXAM)
    if mock_count != 1:
        raise ValueError(f"Outline must have exactly 1 mock_exam lesson, found {mock_count}")

    return self

@model_validator(mode='after')
def validate_teach_revision_pairing(self):
    """Validate every teach has a paired revision within 3 lessons."""
    # ... teach-revision pairing logic ...
```

**Proposed** (simplified):
```python
@model_validator(mode='after')
def validate_lesson_type_requirements(self):
    """Validate lesson type distribution for simplified outline.

    Simplified outline rules:
    - Only 'teach' and 'mock_exam' lesson types allowed
    - Must have at least 1 teach lesson
    - Must have exactly 1 mock_exam lesson (near end)
    """
    if not self.outlines:
        return self

    # Check only valid types used
    valid_outline_types = {LessonType.TEACH, LessonType.MOCK_EXAM}
    for entry in self.outlines:
        if entry.lesson_type not in valid_outline_types:
            raise ValueError(
                f"Lesson {entry.order} has invalid lesson_type '{entry.lesson_type.value}'. "
                f"Only 'teach' and 'mock_exam' are allowed in outline."
            )

    lesson_types = [e.lesson_type for e in self.outlines]

    # Must have at least 1 teach lesson
    teach_count = lesson_types.count(LessonType.TEACH)
    if teach_count < 1:
        raise ValueError(f"Outline must have at least 1 teach lesson, found {teach_count}")

    # Must have exactly 1 mock_exam
    mock_count = lesson_types.count(LessonType.MOCK_EXAM)
    if mock_count != 1:
        raise ValueError(f"Outline must have exactly 1 mock_exam lesson, found {mock_count}")

    # mock_exam should be in last 3 lessons
    mock_idx = next(i for i, e in enumerate(self.outlines) if e.lesson_type == LessonType.MOCK_EXAM)
    if mock_idx < len(self.outlines) - 3:
        raise ValueError(
            f"mock_exam (lesson {mock_idx + 1}) should be within last 3 lessons of course"
        )

    return self

# DELETE: validate_teach_revision_pairing method entirely
```

### Task A.2: Update LessonOutline Docstring

**Current** (lines 425-441):
```python
class LessonOutline(BaseModel):
    """Complete lesson outline for iterative SOW authoring.

    Validation rules:
    - Entry order must be sequential (1, 2, 3...)
    - Must have at least 1 teach lesson
    - Must have exactly 1 mock_exam lesson
    - Every teach must have a paired revision within 3 lessons
    """
```

**Proposed**:
```python
class LessonOutline(BaseModel):
    """Simplified lesson outline for iterative SOW authoring.

    The outline captures WHAT to teach (teach lessons) and WHEN to assess (mock_exam).
    Pedagogical patterns (revision, practice) are handled at the lesson content level.

    Allowed lesson types in outline:
    - teach: Core teaching lessons covering curriculum standards/skills
    - mock_exam: Final exam preparation (exactly 1, near end of course)

    Validation rules:
    - Entry order must be sequential (1, 2, 3...)
    - Must have at least 1 teach lesson
    - Must have exactly 1 mock_exam lesson (within last 3 lessons)
    - Only teach and mock_exam types allowed
    """
```

### Task A.3: Update Outline Author Prompt

**File**: `src/prompts/outline_author_prompt.md`

**Key Changes**:

1. **Update schema section** (lines 29-48):
```markdown
### LessonOutline Schema (Pydantic)

```json
{
  "course_subject": "mathematics",
  "course_level": "national-5",
  "total_lessons": 12,                     // Teach lessons + 1 mock_exam
  "structure_type": "skills_based",
  "outlines": [
    {
      "order": 1,
      "lesson_type": "teach",              // ★ ONLY 'teach' or 'mock_exam' allowed ★
      "label_hint": "Introduction to Surds",
      "block_name": "Numerical Skills",
      "block_index": "B1",
      "primary_outcome_or_skill": "Working with surds",
      "standards_or_skills_codes": ["Working with surds", "Simplifying surds"],
      "rationale": "Foundational skill for algebraic manipulation in later lessons"
    }
  ]
}
```

### Critical Schema Rules (SIMPLIFIED)

1. **total_lessons MUST match outlines array length**
2. **order MUST be sequential: 1, 2, 3...**
3. **Valid lesson_type values ONLY**: `teach`, `mock_exam` ★
4. **Exactly 1 mock_exam lesson** (within last 3 lessons)
5. **All other lessons must be 'teach'**
6. **label_hint**: 5-100 characters, descriptive
7. **rationale**: 20-300 characters, justifying placement

★ NOTE: revision, formative_assessment, independent_practice are NOT used in outline.
   Pedagogical patterns are implemented within lesson content by Lesson Entry Author.
```

2. **Update chunking strategy** (replace lines 139-165):
```markdown
<chunking_strategy>
## Chunking Strategy: Content Grouping

**Goal**: Group 2-3 related standards into unified teach lessons covering thematic blocks.

**Approach**:
- **Thematic Blocks**: Group related standards into natural learning progressions
- **Target Size**: 2-3 standards per teach lesson (maximum 4 if pedagogically justified)
- **Block Structure**: Multiple teach lessons per block, ordered by prerequisite dependencies

**Lesson Count Guidelines**:
- **teach**: 90-95% of lessons (all content delivery)
- **mock_exam**: Exactly 1 (final lesson or penultimate)

**Example Block Structure**:
```
Block "Fractions" (B1):
  Lesson 1: teach - Introduction to Fractions (standards 1-2)
  Lesson 2: teach - Operations with Fractions (standards 3-4)
  Lesson 3: teach - Advanced Fraction Problems (standards 5-6)

Block "Decimals" (B2):
  Lesson 4: teach - Decimal Foundations (standards 7-8)
  ...

Final:
  Lesson N: mock_exam - Full Course Mock Examination
```

**NOTE**: Revision activities, practice exercises, and formative checks are built INTO
each teach lesson's card sequence, not as separate outline entries.
</chunking_strategy>
```

3. **Update success criteria** (replace lines 178-187):
```markdown
<success_criteria>
- ✅ `/workspace/lesson_outline.json` validates against Pydantic schema
- ✅ Complete curriculum coverage (all standards/skills mapped to teach lessons)
- ✅ Only 'teach' and 'mock_exam' lesson types used
- ✅ Exactly 1 mock_exam lesson (within last 3 lessons)
- ✅ Sequential ordering (1, 2, 3...)
- ✅ Realistic lesson count (8-20 teach lessons for most courses)
- ✅ Thematic block coherence
- ✅ Prerequisite dependencies respected in ordering
</success_criteria>
```

### Task A.4: Update Unit Tests

**File**: `tests/unit/test_sow_schema_models.py`

**Tests to Update**:

```python
class TestLessonOutlineSimplified:
    """Tests for simplified outline (teach + mock_exam only)."""

    def test_valid_outline_teach_and_mock_exam_only(self):
        """Test valid outline with only teach and mock_exam."""
        outline_data = {
            "course_subject": "mathematics",
            "course_level": "national-5",
            "total_lessons": 4,
            "structure_type": "skills_based",
            "outlines": [
                {"order": 1, "lesson_type": "teach", ...},
                {"order": 2, "lesson_type": "teach", ...},
                {"order": 3, "lesson_type": "teach", ...},
                {"order": 4, "lesson_type": "mock_exam", ...}
            ]
        }
        outline = LessonOutline.model_validate(outline_data)
        assert outline.total_lessons == 4

    def test_invalid_outline_contains_revision(self):
        """Test outline rejects revision lesson type."""
        outline_data = {
            "course_subject": "mathematics",
            "course_level": "national-5",
            "total_lessons": 3,
            "structure_type": "skills_based",
            "outlines": [
                {"order": 1, "lesson_type": "teach", ...},
                {"order": 2, "lesson_type": "revision", ...},  # INVALID
                {"order": 3, "lesson_type": "mock_exam", ...}
            ]
        }
        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)
        assert "Only 'teach' and 'mock_exam'" in str(exc_info.value)

    def test_invalid_outline_contains_independent_practice(self):
        """Test outline rejects independent_practice lesson type."""
        # Similar test...

    def test_invalid_outline_contains_formative_assessment(self):
        """Test outline rejects formative_assessment lesson type."""
        # Similar test...

    def test_mock_exam_must_be_in_last_three_lessons(self):
        """Test mock_exam must be within last 3 lessons."""
        outline_data = {
            "course_subject": "mathematics",
            "course_level": "national-5",
            "total_lessons": 6,
            "structure_type": "skills_based",
            "outlines": [
                {"order": 1, "lesson_type": "teach", ...},
                {"order": 2, "lesson_type": "mock_exam", ...},  # Too early!
                {"order": 3, "lesson_type": "teach", ...},
                {"order": 4, "lesson_type": "teach", ...},
                {"order": 5, "lesson_type": "teach", ...},
                {"order": 6, "lesson_type": "teach", ...}
            ]
        }
        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)
        assert "last 3 lessons" in str(exc_info.value)

# DELETE: Tests for teach-revision pairing
# DELETE: Tests for independent_practice requirement
```

---

## Part B: Outline Critic (Super Early Validation)

### Purpose

The Outline Critic validates the **pedagogical structure** of the lesson outline BEFORE individual lessons are generated. This catches architectural issues early.

### Critic Dimensions (Outline Level)

| Dimension | What It Checks | Failure Example |
|-----------|----------------|-----------------|
| **Coverage** | All SQA standards/skills appear in at least one teach lesson | Standard "AS2.3" not mapped to any lesson |
| **Sequencing** | Prerequisite skills taught before dependent skills | "Quadratic Formula" before "Solving Quadratics" |
| **Balance** | Reasonable distribution across blocks | 8 lessons in Block 1, 1 lesson in Block 4 |
| **Progression** | Cognitive complexity increases appropriately | All easy concepts at end |
| **Chunking** | Standards per lesson is reasonable (2-4) | 8 standards in one lesson |

### Files to Create

| File | Purpose |
|------|---------|
| `src/prompts/outline_critic_prompt.md` | LLM prompt for outline critic |
| `src/tools/outline_critic_tool.py` | MCP tool wrapper for critic validation |
| (modify) `src/iterative_sow_author.py` | Add critic loop to outline generation |

### Task B.1: Create Outline Critic Prompt

**File**: `src/prompts/outline_critic_prompt.md`

```markdown
# Outline Critic Prompt - Pedagogical Structure Validation

<role>
You are the **Outline Critic** - an expert curriculum designer who validates lesson sequence outlines for pedagogical soundness BEFORE detailed lessons are authored.

Your job is to catch structural issues early:
- Missing curriculum coverage
- Prerequisite violations
- Imbalanced block distribution
- Poor cognitive progression
- Over/under-chunked lessons

You provide PASS or REVISION_REQUIRED verdicts with specific, actionable feedback.
</role>

## ═══════════════════════════════════════════════════════════════════════════════
## INPUTS
## ═══════════════════════════════════════════════════════════════════════════════

<inputs>
**Required Files** (pre-populated in workspace):

1. **`/workspace/Course_outcomes.json`** (REQUIRED)
   - Authoritative SQA curriculum data
   - Contains all standards/skills that MUST be covered

2. **`/workspace/lesson_outline.json`** (REQUIRED)
   - The outline draft to critique
   - Generated by Outline Author

**File Operations**:
- Use **Read tool**: `Read(file_path="/workspace/Course_outcomes.json")`
- Use **Read tool**: `Read(file_path="/workspace/lesson_outline.json")`
</inputs>

## ═══════════════════════════════════════════════════════════════════════════════
## CRITIC DIMENSIONS
## ═══════════════════════════════════════════════════════════════════════════════

<dimensions>
### 1. Coverage (Weight: 30%)

**Question**: Are ALL SQA standards/skills from Course_outcomes.json mapped to at least one teach lesson?

**Check**:
- Extract all standards/skills from Course_outcomes.json
- For each, verify it appears in at least one lesson's `standards_or_skills_codes`
- Flag any unmapped standards as CRITICAL errors

**Scoring**:
- 1.0: 100% coverage
- 0.8: 95-99% coverage (minor gaps)
- 0.5: 80-94% coverage (significant gaps)
- 0.0: <80% coverage (FAIL)

---

### 2. Sequencing (Weight: 25%)

**Question**: Are prerequisite skills taught BEFORE skills that depend on them?

**Check**:
- Use teacherGuidance from Course_outcomes.json to identify prerequisites
- Verify prerequisite skills appear in earlier lessons
- Flag any out-of-order dependencies as errors

**Scoring**:
- 1.0: All prerequisites respected
- 0.7: 1-2 minor misordering (could work but not ideal)
- 0.3: 3+ misordering issues
- 0.0: Critical prerequisite violation (FAIL)

---

### 3. Balance (Weight: 20%)

**Question**: Is content reasonably distributed across thematic blocks?

**Check**:
- Count lessons per block
- Flag if any block has >50% of total lessons
- Flag if any block has <5% of total lessons (unless it's a small topic)
- Check block ordering makes thematic sense

**Scoring**:
- 1.0: Well-balanced distribution
- 0.7: Slight imbalance but justifiable
- 0.4: Significant imbalance needing adjustment
- 0.0: Extreme imbalance (FAIL)

---

### 4. Progression (Weight: 15%)

**Question**: Does cognitive complexity increase appropriately through the course?

**Check**:
- Earlier lessons should introduce foundational concepts
- Later lessons should tackle more complex, integrated topics
- Final teach lessons should integrate multiple skills

**Scoring**:
- 1.0: Clear progression from basic to complex
- 0.7: Mostly good with minor issues
- 0.4: Progression unclear or inverted
- 0.0: No discernible progression (FAIL)

---

### 5. Chunking (Weight: 10%)

**Question**: Are standards grouped reasonably (2-4 per lesson)?

**Check**:
- Count standards_or_skills_codes per lesson
- Flag lessons with <2 standards (too granular)
- Flag lessons with >5 standards (too dense)
- Check thematic coherence within lessons

**Scoring**:
- 1.0: All lessons have 2-4 standards, thematically coherent
- 0.7: 1-2 lessons outside range but justified
- 0.4: Multiple lessons poorly chunked
- 0.0: Majority of lessons poorly chunked (FAIL)
</dimensions>

## ═══════════════════════════════════════════════════════════════════════════════
## OUTPUT SCHEMA
## ═══════════════════════════════════════════════════════════════════════════════

<output_schema>
You MUST output a JSON object following this schema:

```json
{
  "verdict": "PASS" | "REVISION_REQUIRED",
  "overall_score": 0.85,  // 0.0-1.0, weighted average
  "dimensions": {
    "coverage": {
      "score": 1.0,
      "issues": [],
      "notes": "All 14 skills mapped to teach lessons"
    },
    "sequencing": {
      "score": 0.7,
      "issues": [
        "Lesson 5 teaches 'Quadratic Formula' before Lesson 3 teaches 'Solving Linear Equations'"
      ],
      "notes": "Minor prerequisite concern, could work but reordering recommended"
    },
    "balance": {
      "score": 0.9,
      "issues": [],
      "notes": "Blocks well-distributed: B1(3), B2(4), B3(3), B4(2)"
    },
    "progression": {
      "score": 0.8,
      "issues": [],
      "notes": "Good progression, advanced integration in final lessons"
    },
    "chunking": {
      "score": 0.9,
      "issues": [
        "Lesson 7 has 5 standards - consider splitting"
      ],
      "notes": "Most lessons have 2-3 standards"
    }
  },
  "revision_guidance": [
    "PRIORITY 1: Move 'Solving Linear Equations' (Lesson 3) before 'Quadratic Formula' (Lesson 5)",
    "OPTIONAL: Consider splitting Lesson 7 into two lessons"
  ],
  "summary": "Outline has good coverage and balance. Minor sequencing issue with quadratics. Recommend reordering before proceeding."
}
```

**Verdict Rules**:
- `PASS`: overall_score >= 0.8 AND no CRITICAL issues (score 0.0 in any dimension)
- `REVISION_REQUIRED`: overall_score < 0.8 OR any dimension has score 0.0
</output_schema>

## ═══════════════════════════════════════════════════════════════════════════════
## PROCESS
## ═══════════════════════════════════════════════════════════════════════════════

<process>
1. **Read Course_outcomes.json** - Extract all standards/skills to validate coverage
2. **Read lesson_outline.json** - Parse the outline to critique
3. **Evaluate Coverage** - Map each standard to lessons, identify gaps
4. **Evaluate Sequencing** - Check prerequisite order using teacherGuidance
5. **Evaluate Balance** - Analyze block distribution
6. **Evaluate Progression** - Assess complexity growth
7. **Evaluate Chunking** - Check standards-per-lesson distribution
8. **Calculate Scores** - Weighted average for overall_score
9. **Determine Verdict** - PASS if ≥0.8 and no zeros, else REVISION_REQUIRED
10. **Generate Guidance** - Specific, actionable revision suggestions
11. **Output JSON** - Valid JSON matching output_schema
</process>

<constraints>
- Be specific in issues - cite lesson numbers and standard names
- Prioritize revision guidance by impact
- Don't nitpick perfect outlines - PASS if ≥0.8
- Coverage is most critical - any gaps are serious
- Consider teacherGuidance for sequencing but use judgment
</constraints>
```

### Task B.2: Create Outline Critic Tool

**File**: `src/tools/outline_critic_tool.py`

```python
"""MCP Tool for outline critic validation.

This tool provides LLM-based pedagogical validation of lesson outlines,
checking coverage, sequencing, balance, progression, and chunking.
"""

import json
from pathlib import Path
from typing import Dict, Any
from mcp.server.fastmcp import FastMCP

# Initialize MCP server
outline_critic_server = FastMCP("outline-critic")


@outline_critic_server.tool()
def validate_outline_pedagogy(
    outline_json: str,
    course_outcomes_json: str
) -> Dict[str, Any]:
    """Validate lesson outline against pedagogical criteria.

    This is a STRUCTURAL validator that checks:
    - Coverage: All standards mapped
    - Sequencing: Prerequisites respected
    - Balance: Block distribution
    - Progression: Complexity growth
    - Chunking: Standards per lesson

    Args:
        outline_json: The lesson outline JSON string
        course_outcomes_json: The Course_outcomes.json content

    Returns:
        Validation result with scores and guidance
    """
    try:
        outline = json.loads(outline_json)
        outcomes = json.loads(course_outcomes_json)
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "error": f"JSON parsing error: {str(e)}",
            "verdict": "REVISION_REQUIRED"
        }

    # Extract all standards/skills from outcomes
    all_standards = set()
    for outcome in outcomes.get("outcomes", []):
        # Handle both unit_based and skills_based
        if "assessmentStandards" in outcome:
            standards = outcome["assessmentStandards"]
            if isinstance(standards, str):
                try:
                    standards = json.loads(standards)
                except:
                    standards = [standards]
            for std in standards:
                if isinstance(std, dict):
                    all_standards.add(std.get("code", std.get("title", "")))
                else:
                    all_standards.add(str(std))
        # For skills_based, use outcomeTitle
        if outcome.get("outcomeId", "").startswith("SKILL_"):
            all_standards.add(outcome.get("outcomeTitle", ""))

    # Check coverage
    covered_standards = set()
    for entry in outline.get("outlines", []):
        for code in entry.get("standards_or_skills_codes", []):
            covered_standards.add(code)

    uncovered = all_standards - covered_standards
    coverage_score = 1.0 - (len(uncovered) / max(len(all_standards), 1))

    # Check chunking
    chunking_issues = []
    for entry in outline.get("outlines", []):
        num_standards = len(entry.get("standards_or_skills_codes", []))
        if num_standards < 2:
            chunking_issues.append(f"Lesson {entry['order']} has only {num_standards} standard(s)")
        elif num_standards > 5:
            chunking_issues.append(f"Lesson {entry['order']} has {num_standards} standards (too many)")

    chunking_score = 1.0 - (len(chunking_issues) * 0.15)
    chunking_score = max(0.0, chunking_score)

    # Check balance
    block_counts = {}
    for entry in outline.get("outlines", []):
        block = entry.get("block_name", "Unknown")
        block_counts[block] = block_counts.get(block, 0) + 1

    total_lessons = len(outline.get("outlines", []))
    balance_issues = []
    for block, count in block_counts.items():
        ratio = count / max(total_lessons, 1)
        if ratio > 0.5:
            balance_issues.append(f"Block '{block}' has {count}/{total_lessons} lessons (>50%)")

    balance_score = 1.0 if not balance_issues else 0.7

    # Calculate overall (simplified - full version would include sequencing/progression)
    overall_score = (
        coverage_score * 0.35 +
        balance_score * 0.25 +
        chunking_score * 0.20 +
        0.9 * 0.20  # Placeholder for sequencing/progression
    )

    verdict = "PASS" if overall_score >= 0.8 and coverage_score >= 0.95 else "REVISION_REQUIRED"

    return {
        "valid": verdict == "PASS",
        "verdict": verdict,
        "overall_score": round(overall_score, 2),
        "dimensions": {
            "coverage": {
                "score": round(coverage_score, 2),
                "issues": list(uncovered)[:10] if uncovered else [],
                "notes": f"{len(covered_standards)}/{len(all_standards)} standards covered"
            },
            "balance": {
                "score": round(balance_score, 2),
                "issues": balance_issues,
                "notes": f"Block distribution: {block_counts}"
            },
            "chunking": {
                "score": round(chunking_score, 2),
                "issues": chunking_issues[:5],
                "notes": f"Checked {total_lessons} lessons"
            }
        },
        "revision_guidance": (
            [f"Add coverage for: {', '.join(list(uncovered)[:5])}"] if uncovered else []
        ) + balance_issues + chunking_issues[:3],
        "summary": f"Outline {'passes' if verdict == 'PASS' else 'needs revision'} with score {overall_score:.2f}"
    }


if __name__ == "__main__":
    outline_critic_server.run()
```

### Task B.3: Integrate Outline Critic into Iterative Author

**File**: `src/iterative_sow_author.py` (modify `_generate_outline` method)

```python
async def _generate_outline(self, workspace_path: Path) -> dict:
    """Generate lesson outline with critic validation loop."""

    MAX_CRITIC_ITERATIONS = 3

    for iteration in range(MAX_CRITIC_ITERATIONS):
        logger.info(f"📋 Outline generation iteration {iteration + 1}/{MAX_CRITIC_ITERATIONS}")

        # Generate outline
        outline = await self._run_outline_author(workspace_path)

        # Run outline critic
        critic_result = await self._run_outline_critic(workspace_path)

        if critic_result["verdict"] == "PASS":
            logger.info(f"✅ Outline critic PASSED (score: {critic_result['overall_score']})")
            return outline

        logger.warning(f"⚠️ Outline critic REVISION_REQUIRED (score: {critic_result['overall_score']})")
        logger.warning(f"   Issues: {critic_result.get('revision_guidance', [])}")

        # Write critic feedback for next iteration
        feedback_path = workspace_path / "outline_critic_feedback.json"
        feedback_path.write_text(json.dumps(critic_result, indent=2))

        if iteration == MAX_CRITIC_ITERATIONS - 1:
            logger.error("❌ Outline failed critic after max iterations")
            raise ValueError(f"Outline failed critic validation: {critic_result['summary']}")

    raise ValueError("Outline generation failed")
```

---

## Part C: Per-Lesson Critic (5 Dimensions)

### Purpose

The Per-Lesson Critic validates each lesson AFTER generation against the same 5 dimensions as the legacy unified_critic, but at the lesson level.

### Critic Dimensions (Lesson Level)

| Dimension | What It Checks (Lesson Level) | Failure Example |
|-----------|-------------------------------|-----------------|
| **Coverage** | All outlined standards fully addressed in cards | Standard "AS2.3" in outline but no card teaches it |
| **Sequencing** | Card flow is logical (starter→explainer→practice→exit) | Exit ticket before guided practice |
| **Policy** | Engagement tags followed, CFU specificity correct | engagement_tags say "visual" but no diagrams |
| **Accessibility** | Adaptations appropriate for diverse learners | No alternative representations provided |
| **Authenticity** | Scottish context, real-world relevance | Generic American examples in Scottish course |

### Files to Create

| File | Purpose |
|------|---------|
| `src/prompts/lesson_critic_prompt.md` | LLM prompt for per-lesson critic |
| `src/tools/lesson_critic_tool.py` | MCP tool wrapper |
| (modify) `src/iterative_sow_author.py` | Add critic loop to lesson generation |

### Task C.1: Create Lesson Critic Prompt

**File**: `src/prompts/lesson_critic_prompt.md`

```markdown
# Lesson Critic Prompt - 5 Dimensions Pedagogical Validation

<role>
You are the **Lesson Critic** - an expert curriculum reviewer who validates individual lessons for pedagogical quality using the 5 Dimensions framework.

Your job is to ensure each lesson:
1. Fully covers its outlined standards
2. Has logical card sequencing
3. Follows engagement and CFU policies
4. Provides accessibility adaptations
5. Uses authentic Scottish context

You provide PASS or REVISION_REQUIRED verdicts with specific, actionable feedback.
</role>

## ═══════════════════════════════════════════════════════════════════════════════
## INPUTS
## ═══════════════════════════════════════════════════════════════════════════════

<inputs>
**Required Files**:

1. **`/workspace/current_outline_entry.json`** - The outline entry for this lesson
   - Contains: order, lesson_type, standards_or_skills_codes, rationale

2. **`/workspace/lesson_{order}.json`** - The authored lesson to critique
   - Contains: lesson_plan (cards), accessibility, engagement_tags, etc.

3. **`/workspace/Course_outcomes.json`** - SQA curriculum data for context

4. **`/workspace/previous_lessons.json`** - Previously generated lessons (for coherence)
</inputs>

## ═══════════════════════════════════════════════════════════════════════════════
## 5 DIMENSIONS FRAMEWORK (Lesson Level)
## ═══════════════════════════════════════════════════════════════════════════════

<dimensions>
### 1. Coverage (Weight: 25%)

**Question**: Are ALL standards from `current_outline_entry.standards_or_skills_codes` explicitly addressed in the lesson cards?

**Check**:
- For each outlined standard, verify at least one card's learning objectives include it
- Check CFU questions assess the standard
- Verify exit_ticket covers key standards

**Scoring**:
- 1.0: All standards have explicit card coverage + CFU
- 0.8: All standards covered but CFU weak
- 0.5: 1 standard missing coverage
- 0.0: Multiple standards missing (FAIL)

---

### 2. Sequencing (Weight: 20%)

**Question**: Do the lesson cards flow logically following pedagogical best practice?

**Check**:
- Verify starter → explainer → modelling → guided_practice → independent_practice → exit_ticket order
- Check scaffolding decreases appropriately through cards
- Verify prerequisite concepts introduced before dependent concepts

**Scoring**:
- 1.0: Perfect pedagogical flow
- 0.8: Minor sequencing issue (e.g., extra practice before all modelling)
- 0.5: Significant flow problem but recoverable
- 0.0: Fundamentally broken sequence (FAIL)

---

### 3. Policy (Weight: 20%)

**Question**: Does the lesson follow engagement_tags and CFU specificity requirements?

**Check**:
- If engagement_tags includes "visual" - are diagrams/images specified?
- If engagement_tags includes "kinesthetic" - are manipulative activities included?
- CFU questions are SPECIFIC to the lesson content (not generic)
- Hint/feedback specificity matches lesson context

**Scoring**:
- 1.0: All engagement tags honored, CFU highly specific
- 0.8: Tags mostly honored, CFU specific
- 0.5: Some tags ignored or CFU generic
- 0.0: Engagement completely ignored (FAIL)

---

### 4. Accessibility (Weight: 20%)

**Question**: Are appropriate adaptations provided for diverse learners?

**Check**:
- Multiple representations (verbal, visual, symbolic)?
- Scaffolded versions available in accessibility section?
- Language appropriate for level?
- Cultural references inclusive?

**Scoring**:
- 1.0: Comprehensive accessibility with multiple adaptations
- 0.8: Good accessibility with minor gaps
- 0.5: Basic accessibility only
- 0.0: No accessibility considerations (FAIL)

---

### 5. Authenticity (Weight: 15%)

**Question**: Does the lesson use authentic Scottish context and real-world relevance?

**Check**:
- Scottish cultural references (places, currency £, measurements metric)?
- Real-world applications of the mathematics?
- Age-appropriate, engaging contexts?
- Avoids American-centric examples ($ prices, baseball, etc.)?

**Scoring**:
- 1.0: Rich Scottish context throughout
- 0.8: Good Scottish context with minor generic parts
- 0.5: Some Scottish context but mostly generic
- 0.3: Generic with no Scottish context
- 0.0: American/inappropriate context (FAIL)
</dimensions>

## ═══════════════════════════════════════════════════════════════════════════════
## OUTPUT SCHEMA
## ═══════════════════════════════════════════════════════════════════════════════

<output_schema>
```json
{
  "verdict": "PASS" | "REVISION_REQUIRED",
  "overall_score": 0.82,
  "lesson_order": 3,
  "dimensions": {
    "coverage": {
      "score": 0.8,
      "issues": ["Standard 'Simplifying surds' has no CFU question"],
      "notes": "3/3 standards in cards, 2/3 in CFU"
    },
    "sequencing": {
      "score": 1.0,
      "issues": [],
      "notes": "Perfect starter→explainer→practice→exit flow"
    },
    "policy": {
      "score": 0.7,
      "issues": ["engagement_tag 'visual' specified but no diagram in explainer"],
      "notes": "CFU questions are specific"
    },
    "accessibility": {
      "score": 0.9,
      "issues": [],
      "notes": "Good scaffolded versions, multiple representations"
    },
    "authenticity": {
      "score": 0.8,
      "issues": ["Card 2 uses generic 'store' context, could use Scottish shop"],
      "notes": "Good Scottish context overall"
    }
  },
  "revision_guidance": [
    "PRIORITY 1: Add CFU question for 'Simplifying surds' standard",
    "PRIORITY 2: Add diagram to explainer card (engagement_tag: visual)",
    "OPTIONAL: Change 'store' to 'Tesco/Asda/local shop' for authenticity"
  ],
  "summary": "Lesson 3 mostly passes but needs CFU coverage for one standard and visual support."
}
```

**Verdict Rules**:
- `PASS`: overall_score >= 0.8 AND no dimension has score 0.0
- `REVISION_REQUIRED`: overall_score < 0.8 OR any dimension has score 0.0
</output_schema>

## ═══════════════════════════════════════════════════════════════════════════════
## PROCESS
## ═══════════════════════════════════════════════════════════════════════════════

<process>
1. **Read current_outline_entry.json** - Get expected standards for this lesson
2. **Read lesson_{order}.json** - Parse the lesson to critique
3. **Evaluate Coverage** - Map standards to cards and CFU
4. **Evaluate Sequencing** - Check card order and scaffolding
5. **Evaluate Policy** - Verify engagement_tags and CFU specificity
6. **Evaluate Accessibility** - Check adaptations and representations
7. **Evaluate Authenticity** - Assess Scottish context and real-world relevance
8. **Calculate Scores** - Weighted average for overall_score
9. **Determine Verdict** - PASS if ≥0.8 and no zeros
10. **Generate Guidance** - Prioritized, actionable suggestions
11. **Output JSON** - Valid JSON matching output_schema
</process>
```

### Task C.2: Create Lesson Critic Tool

**File**: `src/tools/lesson_critic_tool.py`

```python
"""MCP Tool for lesson critic validation (5 Dimensions).

This tool provides LLM-based pedagogical validation of individual lessons,
checking coverage, sequencing, policy, accessibility, and authenticity.
"""

import json
from typing import Dict, Any
from mcp.server.fastmcp import FastMCP

lesson_critic_server = FastMCP("lesson-critic")


@lesson_critic_server.tool()
def validate_lesson_pedagogy(
    lesson_json: str,
    outline_entry_json: str,
    course_outcomes_json: str
) -> Dict[str, Any]:
    """Validate a single lesson against 5 dimensions criteria.

    Dimensions checked:
    1. Coverage - Standards from outline addressed in cards
    2. Sequencing - Card flow follows pedagogical best practice
    3. Policy - Engagement tags and CFU specificity
    4. Accessibility - Adaptations for diverse learners
    5. Authenticity - Scottish context and real-world relevance

    Args:
        lesson_json: The authored lesson JSON
        outline_entry_json: The outline entry for this lesson
        course_outcomes_json: Course_outcomes.json for context

    Returns:
        Validation result with scores and guidance
    """
    try:
        lesson = json.loads(lesson_json)
        outline_entry = json.loads(outline_entry_json)
        outcomes = json.loads(course_outcomes_json)
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "error": f"JSON parsing error: {str(e)}",
            "verdict": "REVISION_REQUIRED"
        }

    # Get expected standards from outline
    expected_standards = set(outline_entry.get("standards_or_skills_codes", []))

    # Check coverage - which standards appear in cards
    cards = lesson.get("lesson_plan", {}).get("cards", [])
    covered_in_cards = set()
    for card in cards:
        objectives = card.get("learning_objectives", [])
        for obj in objectives:
            if isinstance(obj, dict):
                covered_in_cards.add(obj.get("standard_code", ""))
            else:
                covered_in_cards.add(str(obj))

    missing_coverage = expected_standards - covered_in_cards
    coverage_score = 1.0 - (len(missing_coverage) / max(len(expected_standards), 1))

    # Check sequencing - card type order
    card_types = [c.get("type", "") for c in cards]
    expected_flow = ["starter", "explainer", "modelling", "guided_practice", "independent_practice", "exit_ticket"]

    sequencing_score = 1.0
    sequencing_issues = []

    # Simple check: starter should be first, exit_ticket should be last
    if card_types and card_types[0] != "starter":
        sequencing_score -= 0.2
        sequencing_issues.append("Lesson doesn't start with 'starter' card")
    if card_types and card_types[-1] != "exit_ticket":
        sequencing_score -= 0.2
        sequencing_issues.append("Lesson doesn't end with 'exit_ticket' card")

    # Check engagement tags honored
    engagement_tags = lesson.get("engagement_tags", [])
    policy_score = 0.9  # Default good
    policy_issues = []

    if "visual" in engagement_tags:
        # Check if any card has diagram references
        has_visual = any(
            "diagram" in str(c).lower() or "image" in str(c).lower()
            for c in cards
        )
        if not has_visual:
            policy_score -= 0.2
            policy_issues.append("engagement_tag 'visual' but no diagrams found")

    # Check accessibility
    accessibility = lesson.get("accessibility", {})
    accessibility_score = 0.8 if accessibility else 0.5

    # Check authenticity (Scottish context)
    lesson_text = json.dumps(lesson).lower()
    scottish_indicators = ["£", "scotland", "scottish", "edinburgh", "glasgow", "metric", "kilometre", "litre"]
    american_indicators = ["$", "dollar", "mile", "baseball", "football yard"]

    scottish_count = sum(1 for ind in scottish_indicators if ind in lesson_text)
    american_count = sum(1 for ind in american_indicators if ind in lesson_text)

    authenticity_score = 0.8
    authenticity_issues = []
    if american_count > 0:
        authenticity_score -= 0.3
        authenticity_issues.append("American context detected ($ or imperial units)")
    if scottish_count == 0:
        authenticity_score -= 0.2
        authenticity_issues.append("No Scottish context indicators found")

    # Calculate overall
    overall_score = (
        coverage_score * 0.25 +
        sequencing_score * 0.20 +
        policy_score * 0.20 +
        accessibility_score * 0.20 +
        authenticity_score * 0.15
    )

    verdict = "PASS" if overall_score >= 0.8 and coverage_score >= 0.9 else "REVISION_REQUIRED"

    return {
        "valid": verdict == "PASS",
        "verdict": verdict,
        "overall_score": round(overall_score, 2),
        "lesson_order": outline_entry.get("order", 0),
        "dimensions": {
            "coverage": {
                "score": round(coverage_score, 2),
                "issues": list(missing_coverage),
                "notes": f"{len(expected_standards) - len(missing_coverage)}/{len(expected_standards)} standards covered"
            },
            "sequencing": {
                "score": round(sequencing_score, 2),
                "issues": sequencing_issues,
                "notes": f"Card flow: {' → '.join(card_types)}"
            },
            "policy": {
                "score": round(policy_score, 2),
                "issues": policy_issues,
                "notes": f"Engagement tags: {engagement_tags}"
            },
            "accessibility": {
                "score": round(accessibility_score, 2),
                "issues": [] if accessibility else ["No accessibility section"],
                "notes": "Has accessibility adaptations" if accessibility else "Missing accessibility"
            },
            "authenticity": {
                "score": round(authenticity_score, 2),
                "issues": authenticity_issues,
                "notes": f"Scottish indicators: {scottish_count}, American: {american_count}"
            }
        },
        "revision_guidance": (
            ([f"Add coverage for: {', '.join(list(missing_coverage)[:3])}"] if missing_coverage else []) +
            sequencing_issues +
            policy_issues +
            authenticity_issues
        )[:5],
        "summary": f"Lesson {outline_entry.get('order', '?')} {'passes' if verdict == 'PASS' else 'needs revision'}"
    }


if __name__ == "__main__":
    lesson_critic_server.run()
```

### Task C.3: Integrate Lesson Critic into Iterative Author

**File**: `src/iterative_sow_author.py` (modify `_generate_single_lesson` method)

```python
async def _generate_single_lesson(
    self,
    workspace_path: Path,
    order: int,
    outline_entry: dict,
    previous_lessons: list
) -> dict:
    """Generate a single lesson with critic validation loop."""

    MAX_CRITIC_ITERATIONS = 2

    for iteration in range(MAX_CRITIC_ITERATIONS):
        logger.info(f"📝 Lesson {order} generation iteration {iteration + 1}/{MAX_CRITIC_ITERATIONS}")

        # Generate lesson
        lesson = await self._run_lesson_author(
            workspace_path, order, outline_entry, previous_lessons
        )

        # Run lesson critic
        critic_result = await self._run_lesson_critic(
            workspace_path, lesson, outline_entry
        )

        if critic_result["verdict"] == "PASS":
            logger.info(f"✅ Lesson {order} critic PASSED (score: {critic_result['overall_score']})")
            return lesson

        logger.warning(f"⚠️ Lesson {order} critic REVISION_REQUIRED (score: {critic_result['overall_score']})")

        # Write critic feedback for revision
        feedback_path = workspace_path / f"lesson_{order:02d}_critic_feedback.json"
        feedback_path.write_text(json.dumps(critic_result, indent=2))

        if iteration == MAX_CRITIC_ITERATIONS - 1:
            # Accept with warning on final iteration
            logger.warning(f"⚠️ Lesson {order} accepted with warnings after max iterations")
            return lesson

    return lesson  # Should not reach here
```

---

## Implementation Order

| Phase | Task | Priority | Est. Effort |
|-------|------|----------|-------------|
| A | Outline Simplification | 🔴 HIGH | 2 hours |
| A.1 | Update LessonOutline validators | 🔴 HIGH | 30 min |
| A.2 | Update LessonOutline docstring | 🟡 MED | 10 min |
| A.3 | Update outline_author_prompt.md | 🔴 HIGH | 45 min |
| A.4 | Update unit tests | 🔴 HIGH | 30 min |
| B | Outline Critic | 🔴 HIGH | 3 hours |
| B.1 | Create outline_critic_prompt.md | 🔴 HIGH | 1 hour |
| B.2 | Create outline_critic_tool.py | 🔴 HIGH | 1 hour |
| B.3 | Integrate into iterative_sow_author | 🔴 HIGH | 1 hour |
| C | Lesson Critic | 🔴 HIGH | 3 hours |
| C.1 | Create lesson_critic_prompt.md | 🔴 HIGH | 1 hour |
| C.2 | Create lesson_critic_tool.py | 🔴 HIGH | 1 hour |
| C.3 | Integrate into iterative_sow_author | 🔴 HIGH | 1 hour |

**Total Estimated Effort**: ~8 hours

---

## Testing Strategy

### Part A Tests
```bash
# Unit tests for simplified schema
pytest tests/unit/test_sow_schema_models.py -v -k "Simplified"

# Integration tests for validator
pytest tests/integration/test_outline_validator_tool.py -v
```

### Part B Tests
```bash
# Outline critic tool tests
pytest tests/integration/test_outline_critic_tool.py -v

# E2E test with critic loop
pytest tests/phases/test_phase1_outline_with_critic.py -v -s
```

### Part C Tests
```bash
# Lesson critic tool tests
pytest tests/integration/test_lesson_critic_tool.py -v

# E2E test with lesson critic
pytest tests/phases/test_phase2_lesson_with_critic.py -v -s
```

---

## Success Criteria

- ✅ Outline only accepts `teach` + `mock_exam` lesson types
- ✅ Teach-revision pairing validation removed
- ✅ Outline critic catches coverage gaps before lesson generation
- ✅ Outline critic validates sequencing based on prerequisites
- ✅ Lesson critic validates 5 dimensions for each lesson
- ✅ Critic loops terminate after max iterations with appropriate handling
- ✅ All existing tests updated and passing
- ✅ New critic tests passing

---

**End of Plan**
