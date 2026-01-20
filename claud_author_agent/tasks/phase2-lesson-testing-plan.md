# Phase 2: Per-Lesson Generation - Testing Plan

**Status**: ✅ FULL 19-LESSON TEST PASSED
**Created**: 2026-01-19
**Last Updated**: 2026-01-20 00:15
**Target Course**: Applications of Mathematics Higher (`course_c84476`)
**Input**: `workspace/20260119_220800/lesson_outline.json` (19 lessons from Phase 1)

---

## ✅ Full Test Results (2026-01-20 00:15)

### Test 3.3: Full 19-Lesson Generation

| Metric | Value | Status |
|--------|-------|--------|
| **Total Lessons** | 19/19 | ✅ Complete |
| **Pass Rate** | 100% | ✅ All passed |
| **Total Time** | 63.9 minutes | ✅ ~3.4 min/lesson avg |
| **First-Attempt Pass** | 18/19 (94.7%) | ✅ Excellent |
| **Required Revision** | 1 (Lesson 14) | ✅ Critic loop worked |
| **Failed** | 0 | ✅ |
| **Test Workspace** | `workspace/phase2_full_test_20260119_231045` | ✅ |

### Lesson-by-Lesson Results

| Lesson | Label | Type | Cards | Time | Attempts |
|--------|-------|------|-------|------|----------|
| 1 | Introduction to Mathematical Modelling | teach | 5 | 2.0m | 1 |
| 2 | Using Spreadsheet Software for Mathematical Calculations | teach | 5 | 3.1m | 1 |
| 3 | Basic Probability with Tree and Venn Diagrams | teach | 6 | 2.3m | 1 |
| 4 | Types of Data and Sampling Methods | teach | 6 | 4.2m | 1 |
| 5 | Statistical Diagrams and Data Representation | teach | 7 | 2.9m | 1 |
| 6 | Measures of Location and Dispersion | teach | 5 | 2.8m | 1 |
| 7 | Scatter Plots and Correlation | teach | 5 | 2.2m | 1 |
| 8 | Linear Regression and Prediction | teach | 5 | 3.6m | 1 |
| 9 | Hypothesis Testing and Confidence Intervals | teach | 6 | 3.9m | 1 |
| 10 | Statistical Tests: t-tests and z-tests | teach | 5 | 2.5m | 1 |
| 11 | Present and Future Values of Monetary Payments | teach | 5 | 3.2m | 1 |
| 12 | Credit Cards and Loans | teach | 5 | 3.0m | 1 |
| 13 | Savings and Investment Products | teach | 5 | 3.6m | 1 |
| **14** | **Insurance, Taxation and Financial Planning** | **teach** | **5** | **9.1m** | **2** |
| 15 | PERT Charts and Critical Path Analysis | teach | 5 | 2.8m | 1 |
| 16 | Gantt Charts and Expected Value in Decision Making | teach | 5 | 2.4m | 1 |
| 17 | Integrated Modelling Practice: Renewable Energy Project | teach | 5 | 2.9m | 1 |
| 18 | Cross-Topic Problem Solving | teach | 5 | 4.4m | 1 |
| 19 | Mock Examination: Higher Applications of Mathematics | mock_exam | 9 | 3.0m | 1 |

### Block Distribution

| Block | Lessons | Cards | Avg Time |
|-------|---------|-------|----------|
| Mathematical Modelling | 1-2 | 10 | 2.5m |
| Statistics & Probability | 3-10 | 45 | 3.1m |
| Finance | 11-14 | 20 | 4.7m |
| Planning & Decision Making | 15-16 | 10 | 2.6m |
| Course Integration | 17-18 | 10 | 3.7m |
| Mock Exam | 19 | 9 | 3.0m |

### Critic Scores (Lesson 19 Mock Exam)

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Coverage** | 0.90 | 9/10 skills fully covered |
| **Sequencing** | 1.0 | Perfect mock exam flow |
| **Policy** | 1.0 | All engagement tags reflected |
| **Accessibility** | 0.60 | Missing explainer_plain fields |
| **Authenticity** | 0.95 | Outstanding Scottish contexts |
| **Overall** | 0.88 | PASS |

---

## Test 3.1: Single Lesson Test (Earlier)

| Metric | Value | Status |
|--------|-------|--------|
| **Lesson Label** | Introduction to Mathematical Modelling | ✅ Generated |
| **Critic Score** | 0.86/1.0 | ✅ Above 0.7 threshold |
| **Revision Attempts** | 1 (first try) | ✅ Efficient |

### Bug Fixes Applied During Testing

1. **JSON String Parsing** (`_parse_json_strings_recursive`)
   - **Issue**: SDK returned nested objects (e.g., `lesson_plan`) as JSON strings
   - **Fix**: Added recursive JSON string parser in `_unwrap_structured_output`
   - **File**: `src/iterative_sow_author.py` (lines 62-94)

2. **lesson_order Injection**
   - **Issue**: Critic minimal schema doesn't include `lesson_order`, but Pydantic requires it
   - **Fix**: Inject `lesson_order` from known parameter before validation
   - **File**: `src/iterative_sow_author.py` (lines 637-650)

---

## Overview

This plan tests **Phase 2 (Per-Lesson Generation with Critic Loop)** of the iterative SOW author. Phase 2 takes the outline from Phase 1 and generates each lesson individually with quality validation.

### Phase 2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2: LESSON GENERATION                          │
│                                                                             │
│  Input: lesson_outline.json (19 lessons from Phase 1)                       │
│  Output: lesson_01.json ... lesson_19.json                                  │
└─────────────────────────────────────────────────────────────────────────────┘

FOR each lesson (1 to 19):
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  ┌─────────────────────────┐    ┌─────────────────────────┐            │
  │  │   LESSON AUTHOR         │    │   LESSON CRITIC         │            │
  │  │   (Claude Agent SDK)    │───▶│   (Claude Agent SDK)    │            │
  │  │                         │    │                         │            │
  │  │ Input:                  │    │ Evaluates 5 dimensions: │            │
  │  │ - Course_outcomes.json  │    │ 1. Coverage             │            │
  │  │ - current_outline.json  │    │ 2. Sequencing           │            │
  │  │ - previous_lessons.json │    │ 3. Policy               │            │
  │  │                         │    │ 4. Accessibility        │            │
  │  │ Output:                 │    │ 5. Authenticity         │            │
  │  │ - SOWEntry JSON         │    │                         │            │
  │  │   (structured_output)   │    │ Verdict: PASS / REVISE  │            │
  │  └─────────────────────────┘    └───────────┬─────────────┘            │
  │                                             │                          │
  │                    ┌────────────────────────┴────────────────────────┐ │
  │                    │                                                  │ │
  │                    ▼ PASS                               ▼ REVISE     │ │
  │           Save lesson_XX.json                 Loop (max 3 attempts)  │ │
  │           Add to previous_lessons                                    │ │
  └─────────────────────────────────────────────────────────────────────────┘
```

### Input from Phase 1

| Metric | Value |
|--------|-------|
| **Workspace** | `workspace/20260119_220800` |
| **Total Lessons** | 19 |
| **Lesson Types** | 18 teach + 1 mock_exam |
| **Structure Type** | skills_based (Higher level) |

### Lesson Distribution from Phase 1 Outline

| Block | Lessons | Order Range |
|-------|---------|-------------|
| Mathematical Modelling | 2 | 1-2 |
| Statistics & Probability | 8 | 3-10 |
| Finance | 4 | 11-14 |
| Planning & Decision Making | 2 | 15-16 |
| Course Integration | 2 | 17-18 |
| Exam Preparation (Mock) | 1 | 19 |

---

## Test Levels

### Level 1: Unit Tests (No LLM, No Network)

#### Test 1.1: SOWEntry Model Validation

**File**: `tests/unit/test_sow_schema_models.py`

```python
def test_sow_entry_valid_teach():
    """Test SOWEntry with valid teach lesson structure."""
    entry_data = {
        "order": 1,
        "label": "Introduction to Mathematical Modelling and Software",
        "lesson_type": "teach",
        "coherence": {
            "block_name": "Mathematical Modelling",
            "block_index": "B1",
            "prerequisites": []
        },
        "policy": {
            "calculator_section": "calc",
            "assessment_notes": "Use spreadsheet software for calculations"
        },
        "engagement_tags": ["Scottish contexts", "Real-world applications"],
        "standards_or_skills_addressed": [
            {
                "skill_name": "Mathematical Modelling",
                "description": "Understanding and applying the process of mathematical modelling"
            }
        ],
        "lesson_plan": {
            "summary": "Students learn the mathematical modelling cycle...",
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "starter",
                    "title": "Prior Knowledge Activation",
                    "purpose": "Activate prior knowledge of problem-solving",
                    "pedagogical_approach": "Quick recall of real-world problem contexts",
                    "cfu_strategy": "MCQ: Which is an example of modelling? A) Adding numbers...",
                    "estimated_minutes": 5
                }
                # ... more cards
            ],
            "lesson_flow_summary": "5min starter → 15min explainer → 10min modelling → 15min guided_practice → 5min exit_ticket",
            "multi_standard_integration_strategy": "Focus on modelling cycle as foundation",
            "assessment_progression": "Formative CFU in each card → summative exit ticket"
        },
        "accessibility_profile": {
            "dyslexia_friendly": True,
            "plain_language_level": "CEFR_B1"
        },
        "estMinutes": 50,
        "lesson_instruction": "This lesson introduces the mathematical modelling process..."
    }
    entry = SOWEntry.model_validate(entry_data)
    assert entry.order == 1
    assert entry.lesson_type == LessonType.TEACH
```

```python
def test_sow_entry_valid_mock_exam():
    """Test SOWEntry with valid mock_exam lesson structure."""
    entry_data = {
        "order": 19,
        "label": "Higher Applications of Mathematics Mock Exam",
        "lesson_type": "mock_exam",
        "coherence": {
            "block_name": "Exam Preparation",
            "block_index": "B6"
        },
        "policy": {
            "calculator_section": "exam_conditions"
        },
        "engagement_tags": ["Exam preparation"],
        "standards_or_skills_addressed": [
            {"skill_name": "All Skills", "description": "Comprehensive assessment"}
        ],
        "lesson_plan": {
            "summary": "Mock examination covering all skills...",
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "starter",  # Instructions card
                    "title": "Exam Instructions",
                    "purpose": "Explain exam conditions and timing",
                    "pedagogical_approach": "Clear instructions for exam setup",
                    "cfu_strategy": "Confirm understanding of time allocation",
                    "estimated_minutes": 5
                }
                # ... question cards
            ],
            "lesson_flow_summary": "Instructions → Question cards with progressive difficulty",
            "multi_standard_integration_strategy": "All 10 skills assessed",
            "assessment_progression": "Progressive difficulty matching SQA exam format"
        },
        "accessibility_profile": {"dyslexia_friendly": True},
        "lesson_instruction": "This mock exam covers all 10 skills from the course..."
    }
    entry = SOWEntry.model_validate(entry_data)
    assert entry.lesson_type == LessonType.MOCK_EXAM
```

```python
def test_sow_entry_requires_5_card_flow():
    """Test SOWEntry card_structure uses simplified 5-card flow."""
    entry_data = {
        "order": 1,
        "label": "Test Lesson with Complete Card Structure",
        "lesson_type": "teach",
        # ... minimal required fields
        "lesson_plan": {
            "summary": "Test lesson",
            "card_structure": [
                {"card_number": 1, "card_type": "starter", ...},
                {"card_number": 2, "card_type": "explainer", ...},
                {"card_number": 3, "card_type": "modelling", ...},
                {"card_number": 4, "card_type": "guided_practice", ...},
                {"card_number": 5, "card_type": "exit_ticket", ...}
            ],
            # ...
        }
    }
    entry = SOWEntry.model_validate(entry_data)
    card_types = [c["card_type"] for c in entry.lesson_plan.card_structure]
    assert "starter" in card_types
    assert "explainer" in card_types
    assert "modelling" in card_types
    assert "guided_practice" in card_types
    assert "exit_ticket" in card_types
```

```python
def test_sow_entry_rejects_independent_practice():
    """Test SOWEntry rejects independent_practice card type.

    NOTE: Independent practice is handled by a SEPARATE system outside SOW authoring.
    """
    entry_data = {
        # ... valid base structure
        "lesson_plan": {
            "card_structure": [
                {"card_number": 1, "card_type": "starter", ...},
                {"card_number": 2, "card_type": "independent_practice", ...}  # INVALID
            ]
        }
    }
    with pytest.raises(ValidationError):
        SOWEntry.model_validate(entry_data)
```

#### Test 1.2: LessonCriticResult Model Validation

**File**: `tests/unit/test_critic_schema_models.py`

```python
def test_lesson_critic_result_valid_pass():
    """Test LessonCriticResult with PASS verdict."""
    result_data = {
        "verdict": "PASS",
        "overall_score": 0.85,
        "lesson_order": 1,
        "dimensions": {
            "coverage": {"score": 0.90, "issues": [], "notes": "All standards addressed"},
            "sequencing": {"score": 0.85, "issues": [], "notes": "Good card flow"},
            "policy": {"score": 0.80, "issues": [], "notes": "Tags reflected"},
            "accessibility": {"score": 0.85, "issues": [], "notes": "CEFR B1 compliant"},
            "authenticity": {"score": 0.85, "issues": [], "notes": "Scottish context present"}
        },
        "revision_guidance": [],
        "summary": "Lesson meets quality standards."
    }
    result = LessonCriticResult.model_validate(result_data)
    assert result.verdict == "PASS"
    assert result.overall_score >= 0.7
```

```python
def test_lesson_critic_result_valid_revision_required():
    """Test LessonCriticResult with REVISION_REQUIRED verdict."""
    result_data = {
        "verdict": "REVISION_REQUIRED",
        "overall_score": 0.55,
        "lesson_order": 3,
        "dimensions": {
            "coverage": {"score": 0.50, "issues": ["Standard X not covered"], "notes": "Gap in coverage"},
            "sequencing": {"score": 0.60, "issues": ["Card 3 before card 2"], "notes": "Ordering issue"},
            "policy": {"score": 0.70, "issues": [], "notes": "OK"},
            "accessibility": {"score": 0.40, "issues": ["Missing plain language"], "notes": "Needs work"},
            "authenticity": {"score": 0.55, "issues": ["Uses $ not £"], "notes": "Currency issue"}
        },
        "revision_guidance": [
            "Add coverage for Standard X in Card 2",
            "Fix card ordering: modelling before practice",
            "Add plain language alternatives"
        ],
        "summary": "Lesson needs revision for coverage and accessibility."
    }
    result = LessonCriticResult.model_validate(result_data)
    assert result.verdict == "REVISION_REQUIRED"
    assert result.overall_score < 0.7
    assert len(result.revision_guidance) > 0
```

---

### Level 2: Integration Tests (Validator Tools)

#### Test 2.1: SOWEntry Validator Tool - Valid Input

**File**: `tests/integration/test_lesson_validator_tool.py`

```python
def test_lesson_validator_valid_teach():
    """Test lesson validator accepts valid teach lesson."""
    valid_lesson = {
        "order": 1,
        "label": "Introduction to Mathematical Modelling",
        "lesson_type": "teach",
        "coherence": {"block_name": "Mathematical Modelling", "block_index": "B1"},
        "policy": {"calculator_section": "calc"},
        "engagement_tags": ["Scottish contexts"],
        "standards_or_skills_addressed": [
            {"skill_name": "Modelling", "description": "Understanding modelling process"}
        ],
        "lesson_plan": {
            "summary": "Introduction to modelling cycle",
            "card_structure": [
                {"card_number": 1, "card_type": "starter", "title": "Warm-up",
                 "purpose": "Activate prior knowledge", "pedagogical_approach": "Recall",
                 "cfu_strategy": "MCQ: What is a model?", "estimated_minutes": 5},
                {"card_number": 2, "card_type": "explainer", "title": "Modelling Cycle",
                 "purpose": "Explain modelling process", "pedagogical_approach": "Direct instruction",
                 "cfu_strategy": "Identify stages of modelling", "estimated_minutes": 15},
                {"card_number": 3, "card_type": "modelling", "title": "Worked Example",
                 "purpose": "Demonstrate modelling", "pedagogical_approach": "Think-aloud",
                 "cfu_strategy": "Predict next step", "estimated_minutes": 10},
                {"card_number": 4, "card_type": "guided_practice", "title": "Practice",
                 "purpose": "Scaffolded practice", "pedagogical_approach": "Guided",
                 "cfu_strategy": "Complete with hints", "estimated_minutes": 15},
                {"card_number": 5, "card_type": "exit_ticket", "title": "Check",
                 "purpose": "Assessment", "pedagogical_approach": "Individual",
                 "cfu_strategy": "Short problem", "estimated_minutes": 5}
            ],
            "lesson_flow_summary": "5-15-10-15-5 minutes",
            "multi_standard_integration_strategy": "Single standard focus",
            "assessment_progression": "Formative → summative"
        },
        "accessibility_profile": {"dyslexia_friendly": True},
        "lesson_instruction": "This lesson introduces the mathematical modelling process used throughout the course."
    }

    result = validate_sow_entry(json.dumps(valid_lesson))

    assert result["valid"] == True
    assert result["stats"]["order"] == 1
    assert result["stats"]["lesson_type"] == "teach"
    assert result["stats"]["card_count"] == 5
```

#### Test 2.2: SOWEntry Validator Tool - Schema Violations

```python
def test_lesson_validator_missing_cards():
    """Test lesson validator rejects lesson with no cards."""
    invalid_lesson = {
        "order": 1,
        "label": "Test lesson",
        "lesson_type": "teach",
        # ... other fields
        "lesson_plan": {
            "summary": "Test",
            "card_structure": [],  # EMPTY - invalid
            # ...
        }
    }

    result = validate_sow_entry(json.dumps(invalid_lesson))
    assert result["valid"] == False
    assert "card_structure" in str(result["errors"])
```

#### Test 2.3: LessonCriticResult Validator Tool

```python
def test_lesson_critic_validator_valid():
    """Test lesson critic validator accepts valid result."""
    valid_result = {
        "verdict": "PASS",
        "overall_score": 0.80,
        "lesson_order": 5,
        "dimensions": {
            "coverage": {"score": 0.85},
            "sequencing": {"score": 0.80},
            "policy": {"score": 0.75},
            "accessibility": {"score": 0.80},
            "authenticity": {"score": 0.80}
        },
        "summary": "Lesson meets quality standards."
    }

    result = validate_lesson_critic_result(json.dumps(valid_result))
    assert result["valid"] == True
```

---

### Level 3: E2E Tests (Real LLM, Real Course Data)

#### Test 3.1: Single Lesson Generation (Lesson 1)

**Purpose**: Test isolated lesson generation for first lesson only.

**Command**:
```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent

source .venv/bin/activate

python -c "
import asyncio
import json
from pathlib import Path
from src.iterative_sow_author import IterativeSOWAuthor

async def test_single_lesson():
    author = IterativeSOWAuthor(
        mcp_config_path='.mcp.json',
        persist_workspace=True,
        log_level='DEBUG'
    )

    # Use the outline from Phase 1
    workspace_path = Path('workspace/20260119_220800')

    # Load outline
    outline = json.loads((workspace_path / 'lesson_outline.json').read_text())

    # Generate lesson 1 only
    lesson = await author._generate_lesson_with_critique_loop(
        workspace_path=workspace_path,
        order=1,
        outline_entry=outline['outlines'][0],
        previous_lessons=[],
        subject='applications-of-mathematics',
        level='higher'
    )

    print(f'✅ Lesson 1 generated: {lesson.label}')
    print(f'   Lesson type: {lesson.lesson_type}')
    print(f'   Cards: {len(lesson.lesson_plan.card_structure)}')
    print(f'   Card types: {[c.card_type for c in lesson.lesson_plan.card_structure]}')

    return lesson

asyncio.run(test_single_lesson())
"
```

**Expected Results**:

| Criterion | Expected |
|-----------|----------|
| Lesson generated | ✅ |
| Pydantic validation passes | ✅ |
| lesson_type = "teach" | ✅ |
| 5 cards present | ✅ |
| Card types: starter, explainer, modelling, guided_practice, exit_ticket | ✅ |
| CFU strategies are specific (not generic) | ✅ |
| Scottish context present | ✅ |
| structured_output returned (not ToolUseBlock fallback) | ✅ |

#### Test 3.2: Lesson Critic Validation

**Purpose**: Test critic correctly evaluates lesson quality.

**Command**:
```bash
python -c "
import asyncio
import json
from pathlib import Path
from src.iterative_sow_author import IterativeSOWAuthor

async def test_lesson_critic():
    author = IterativeSOWAuthor(
        mcp_config_path='.mcp.json',
        persist_workspace=True,
        log_level='DEBUG'
    )

    workspace_path = Path('workspace/20260119_220800')

    # Load outline
    outline = json.loads((workspace_path / 'lesson_outline.json').read_text())

    # Generate lesson 1
    lesson = await author._generate_lesson_structured(
        workspace_path=workspace_path,
        order=1,
        outline_entry=outline['outlines'][0],
        previous_lessons=[],
        subject='applications-of-mathematics',
        level='higher',
        revision_guidance=None
    )

    # Critique the lesson
    critique = await author._critique_lesson(workspace_path, lesson, order=1)

    print(f'📊 Lesson 1 Critique:')
    print(f'   Verdict: {critique.verdict}')
    print(f'   Score: {critique.overall_score:.2f}')
    print(f'   Dimensions:')
    print(f'     Coverage: {critique.dimensions.coverage.score:.2f}')
    print(f'     Sequencing: {critique.dimensions.sequencing.score:.2f}')
    print(f'     Policy: {critique.dimensions.policy.score:.2f}')
    print(f'     Accessibility: {critique.dimensions.accessibility.score:.2f}')
    print(f'     Authenticity: {critique.dimensions.authenticity.score:.2f}')

    return critique

asyncio.run(test_lesson_critic())
"
```

**Expected Results**:

| Criterion | Expected |
|-----------|----------|
| Critique returned | ✅ |
| Verdict is PASS or REVISION_REQUIRED | ✅ |
| All 5 dimensions scored | ✅ |
| Score >= 0.7 for PASS | ✅ |
| Revision guidance if < 0.7 | ✅ |
| structured_output returned (not ToolUseBlock fallback) | ✅ |

#### Test 3.3: Full Phase 2 - All 19 Lessons

**Purpose**: Generate all 19 lessons with critic validation.

**Command**:
```bash
python -c "
import asyncio
import json
from pathlib import Path
from src.iterative_sow_author import IterativeSOWAuthor

async def test_full_phase2():
    author = IterativeSOWAuthor(
        mcp_config_path='.mcp.json',
        persist_workspace=True,
        log_level='INFO'  # Use INFO to reduce verbosity
    )

    # Test Phase 2 only: Generate all lessons from existing outline
    courseId = 'course_c84476'

    result = await author._test_phase2_lessons_only(
        courseId=courseId,
        outline_workspace='workspace/20260119_220800'
    )

    print(f'✅ Phase 2 Complete:')
    print(f'   Total lessons: {len(result[\"lessons\"])}')
    print(f'   Teach lessons: {sum(1 for l in result[\"lessons\"] if l[\"lesson_type\"] == \"teach\")}')
    print(f'   Mock exam: {sum(1 for l in result[\"lessons\"] if l[\"lesson_type\"] == \"mock_exam\")}')
    print(f'   Average critic score: {result[\"average_critic_score\"]:.2f}')
    print(f'   Lessons requiring revision: {result[\"revision_count\"]}')

    return result

asyncio.run(test_full_phase2())
"
```

**Expected Results**:

| Criterion | Expected |
|-----------|----------|
| 19 lessons generated | ✅ |
| 18 teach + 1 mock_exam | ✅ |
| All lessons pass critic (score >= 0.7) | ✅ |
| Structured output for all lessons | ✅ |
| Structured output for all critiques | ✅ |
| Progressive coherence (previous_lessons used) | ✅ |
| Workspace preserved | ✅ |

---

## Validation Criteria by Lesson Type

### For "teach" Lessons (1-18)

| Criterion | Validation |
|-----------|------------|
| **Card Flow** | starter → explainer → modelling → guided_practice → exit_ticket |
| **Card Count** | Exactly 5 cards (simplified flow) |
| **CFU Quality** | Specific, not generic (no "ask questions") |
| **Standards** | All assigned standards from outline addressed |
| **Scottish Context** | £ currency, Scottish locations, services |
| **Accessibility** | Dyslexia-friendly, CEFR B1 language |
| **Coherence** | References previous lessons appropriately |

### For "mock_exam" Lesson (19)

| Criterion | Validation |
|-----------|------------|
| **Structure** | Instructions card + question cards |
| **Skill Coverage** | All 10 skills assessed |
| **Question Style** | SQA exam format |
| **Difficulty** | Progressive (A→C grade questions) |
| **Timing** | Realistic exam time allocation |

---

## Critic Dimension Thresholds

| Dimension | PASS (>= 0.7) | NEEDS WORK (0.5-0.7) | FAIL (< 0.5) |
|-----------|---------------|----------------------|--------------|
| **Coverage** | All standards addressed | 80%+ addressed | <80% addressed |
| **Sequencing** | Perfect card flow | 1-2 ordering issues | Wrong sequence |
| **Policy** | All tags reflected, CFU specific | Partial coverage | Tags ignored |
| **Accessibility** | All features present | Minor gaps | Major failures |
| **Authenticity** | Scottish throughout | Some generic | No Scottish context |

---

## Test Files Summary

| Level | File | Tests | Status |
|-------|------|-------|--------|
| Unit | `tests/unit/test_sow_schema_models.py` | SOWEntry validation | ✅ Existing |
| Unit | `tests/unit/test_critic_schema_models.py` | LessonCriticResult validation | ✅ Existing |
| Integration | `tests/integration/test_lesson_validator_tool.py` | SOWEntry MCP tool | 🔄 To create |
| Integration | `tests/integration/test_lesson_critic_validator_tool.py` | LessonCritic MCP tool | 🔄 To create |
| E2E | `tests/phases/test_phase2_lessons.py` | Full lesson generation | 🔄 To create |

---

## Minimal Schema Verification

Phase 2 uses minimal schemas (created in Phase 1 work) for structured_output:

| Schema | Size | File |
|--------|------|------|
| `SOW_ENTRY_SCHEMA` | 3,545 chars | `src/utils/minimal_schemas.py` |
| `LESSON_CRITIC_RESULT_SCHEMA` | 1,385 chars | `src/utils/minimal_schemas.py` |

These schemas should ensure `structured_output` is returned in `ResultMessage` without needing `ToolUseBlock` fallback extraction.

---

## Run Commands

```bash
# Unit tests only (no LLM, fast)
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent
source .venv/bin/activate
pytest tests/unit/test_sow_schema_models.py -v -k "sow_entry"

# Integration tests (no LLM)
pytest tests/integration/test_lesson_validator_tool.py -v

# E2E: Single lesson test (~2-3 minutes)
pytest tests/phases/test_phase2_lessons.py::test_single_lesson_generation -v -s

# E2E: Full Phase 2 (~30-60 minutes for 19 lessons)
pytest tests/phases/test_phase2_lessons.py::test_full_phase2_all_lessons -v -s
```

---

## Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| **Lessons Generated** | 19/19 | All outline entries converted |
| **First-Pass Rate** | >80% | Lessons passing critic on first attempt |
| **Average Critic Score** | >0.75 | Quality threshold |
| **Structured Output Rate** | 100% | No ToolUseBlock fallback needed |
| **Total Time** | <60 min | For all 19 lessons + critiques |

---

## Notes

- **Input Workspace**: `workspace/20260119_220800` from Phase 1 contains `lesson_outline.json` and `Course_outcomes.json`
- **Progressive Context**: Each lesson generation receives `previous_lessons.json` for coherence
- **Revision Loop**: Max 3 attempts per lesson before failure
- **Scottish Focus**: All lessons should use £, Scottish locations, NHS Scotland, ScotRail contexts
- **5-Card Flow**: Simplified from legacy 6-card flow (independent_practice handled separately)

---

**End of Plan**
