# Iterative SOW Author - Testing Specification

**Status**: Draft
**Created**: 2026-01-19
**Related Files**: `src/iterative_sow_author.py`, `src/utils/sow_assembler.py`

---

## Overview

This specification defines a systematic testing plan for the iterative SOW author's 4 phases, enabling isolated testing of each phase before full end-to-end validation.

---

## Phase Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ITERATIVE SOW AUTHOR - 4 PHASES                          │
└─────────────────────────────────────────────────────────────────────────────┘

   Phase 1                Phase 2                Phase 3              Phase 4
┌───────────┐         ┌───────────┐         ┌───────────┐        ┌───────────┐
│  OUTLINE  │────────▶│  LESSONS  │────────▶│ METADATA  │───────▶│ ASSEMBLY  │
│ GENERATION│         │ GENERATION│         │ GENERATION│        │           │
└───────────┘         └───────────┘         └───────────┘        └───────────┘
     │                     │                     │                    │
     ▼                     ▼                     ▼                    ▼
lesson_outline.json   lesson_01.json        metadata.json      authored_sow.json
                      lesson_02.json                            + Appwrite upsert
                      ...
                      lesson_N.json
```

---

## Phase 1: Outline Generation

### What It Does
- Reads `Course_data.txt` (extracted SQA curriculum)
- Plans lesson sequence (10-20 lessons typically)
- Establishes teach-revision pairing
- Maps assessment standards to lessons
- Outputs `lesson_outline.json`

### Key Files
| File | Role |
|------|------|
| `src/iterative_sow_author.py` | `_generate_outline()` method |
| `src/prompts/outline_author_prompt.md` | Prompt for outline subagent |
| `src/tools/sow_outline_validator_tool.py` | MCP validator tool |
| `src/tools/sow_schema_models.py` | `LessonOutline`, `LessonOutlineEntry` Pydantic models |

### Testing Strategy

#### Test 1.1: Pydantic Model Validation (Unit)
```python
def test_lesson_outline_model_valid():
    """Test LessonOutline Pydantic model with valid data."""
    json_data = {
        "course_id": "course_c84474",
        "total_lessons": 15,
        "outlines": [
            {
                "order": 1,
                "label": "Fractions Introduction",
                "lesson_type": "teach",
                "outcome_refs": ["O1"],
                "assessment_standard_refs": ["AS1.2"],
                "paired_revision_order": 3
            }
            # ... more entries
        ]
    }
    outline = LessonOutline.model_validate(json_data)
    assert outline.total_lessons == 15
```

#### Test 1.2: Validator Tool (Integration)
```python
def test_outline_validator_tool_valid():
    """Test outline validator MCP tool with valid outline."""
    outline_json = '{"course_id": "course_c84474", ...}'
    result = validate_lesson_outline(outline_json)
    assert result["valid"] == True
```

#### Test 1.3: Full Outline Generation (E2E)
```python
async def test_generate_outline_real_course():
    """Test full outline generation with real course data."""
    author = IterativeSOWAuthor()
    outline = await author._generate_outline(
        workspace_path=Path("/tmp/test"),
        course_data_path=Path("fixtures/Course_data.txt")
    )
    assert isinstance(outline, LessonOutline)
    assert outline.total_lessons >= 10
```

---

## Phase 2: Lesson Generation (Loop)

### What It Does
- Iterates through each outline entry
- For each lesson:
  - Reads `current_outline.json` (this lesson's outline entry)
  - Reads `previous_lessons.json` (coherence context)
  - Uses WebSearch/WebFetch for Scottish context
  - Generates full lesson with 6-12 cards
  - Validates via `sow_entry_validator_tool`
- Outputs `lesson_{N}.json` for each lesson

### Key Files
| File | Role |
|------|------|
| `src/iterative_sow_author.py` | `_generate_single_lesson()` method |
| `src/prompts/lesson_entry_prompt.md` | Prompt for lesson subagent |
| `src/tools/sow_entry_validator_tool.py` | MCP validator tool |
| `src/tools/sow_schema_models.py` | `SOWEntry` Pydantic model |

### Testing Strategy

#### Test 2.1: SOWEntry Model Validation (Unit)
```python
def test_sow_entry_model_valid():
    """Test SOWEntry Pydantic model with valid lesson data."""
    json_data = {
        "order": 1,
        "label": "Fractions Introduction",
        "lesson_type": "teach",
        "coherence": {...},
        "policy": {...},
        "engagement_tags": [...],
        "outcomeRefs": [...],
        "assessmentStandardRefs": [...],  # Enriched format
        "lesson_plan": {...},
        "accessibility_profile": {...},
        "estMinutes": 50,
        "lesson_instruction": "..."
    }
    entry = SOWEntry.model_validate(json_data)
    assert entry.order == 1
```

#### Test 2.2: Entry Validator Tool (Integration)
```python
def test_entry_validator_tool_enriched_format():
    """Test entry validator enforces enriched format."""
    # Should FAIL - bare string instead of object
    bad_json = '{"assessmentStandardRefs": ["AS1.2"], ...}'
    result = validate_sow_entry(bad_json)
    assert result["valid"] == False
    assert "enriched format" in str(result["errors"])
```

#### Test 2.3: Single Lesson Generation (Integration)
```python
async def test_generate_single_lesson():
    """Test single lesson generation with fixture outline."""
    author = IterativeSOWAuthor()
    outline_entry = LessonOutlineEntry.model_validate(FIXTURE_OUTLINE_ENTRY)

    lesson = await author._generate_single_lesson(
        workspace_path=Path("/tmp/test"),
        order=1,
        outline_entry=outline_entry,
        previous_lessons=[]
    )
    assert isinstance(lesson, SOWEntry)
    assert len(lesson.lesson_plan.card_structure) >= 6
```

#### Test 2.4: Lesson Sequence with Coherence (E2E)
```python
async def test_generate_lessons_maintain_coherence():
    """Test that later lessons reference earlier ones for coherence."""
    author = IterativeSOWAuthor()
    lessons = []

    for i, outline_entry in enumerate(FIXTURE_OUTLINE.outlines[:3]):
        lesson = await author._generate_single_lesson(
            workspace_path=Path("/tmp/test"),
            order=i + 1,
            outline_entry=outline_entry,
            previous_lessons=lessons
        )
        lessons.append(lesson)

    # Verify lesson 3 has coherence.prerequisites referencing earlier lessons
    assert len(lessons[2].coherence.prerequisites) > 0
```

---

## Phase 3: Metadata Generation

### What It Does
- Reads all generated lessons (`lesson_*.json`)
- Summarizes coherence notes across lessons
- Documents accessibility and engagement strategies
- Calculates weeks and periods_per_week
- Outputs `metadata.json`

### Key Files
| File | Role |
|------|------|
| `src/iterative_sow_author.py` | `_generate_metadata()` method |
| `src/prompts/metadata_author_prompt.md` | Prompt for metadata subagent |
| `src/tools/sow_metadata_validator_tool.py` | MCP validator tool |
| `src/tools/sow_schema_models.py` | `SOWMetadata` Pydantic model |

### Testing Strategy

#### Test 3.1: Metadata Model Validation (Unit)
```python
def test_sow_metadata_model_valid():
    """Test SOWMetadata Pydantic model with valid data."""
    json_data = {
        "coherence": {
            "policy_notes": ["Non-calculator first", "..."],
            "sequencing_notes": ["Fractions before decimals", "..."]
        },
        "accessibility_notes": ["Dyslexia-friendly fonts", "..."],
        "engagement_notes": ["Scottish shop prices", "..."],
        "weeks": 10,
        "periods_per_week": 4
    }
    metadata = SOWMetadata.model_validate(json_data)
    assert metadata.weeks == 10
```

#### Test 3.2: Metadata Validator Tool (Integration)
```python
def test_metadata_validator_tool_requires_arrays():
    """Test metadata validator requires non-empty arrays."""
    bad_json = '{"coherence": {"policy_notes": []}, ...}'
    result = validate_sow_metadata(bad_json)
    assert result["valid"] == False
```

#### Test 3.3: Full Metadata Generation (E2E)
```python
async def test_generate_metadata_from_lessons():
    """Test metadata generation with fixture lessons."""
    author = IterativeSOWAuthor()

    metadata = await author._generate_metadata(
        workspace_path=Path("/tmp/test"),
        generated_lessons=FIXTURE_LESSONS
    )
    assert isinstance(metadata, SOWMetadata)
    assert len(metadata.coherence.policy_notes) > 0
```

---

## Phase 4: Assembly (Pure Python)

### What It Does
- Combines all `lesson_*.json` files into `entries` array
- Adds `metadata.json` content
- Cross-lesson validation:
  - Order sequencing (1, 2, 3...)
  - Teach-revision pairing (1:1 within 3 entries)
  - Course requirements (≥1 independent_practice, =1 mock_assessment)
- Final `AuthoredSOW` Pydantic validation
- Upserts to Appwrite

### Key Files
| File | Role |
|------|------|
| `src/utils/sow_assembler.py` | `SOWAssembler` class |
| `src/tools/sow_schema_models.py` | `AuthoredSOW` Pydantic model |

### Testing Strategy

#### Test 4.1: Order Sequencing Validation (Unit)
```python
def test_assembler_validates_order_sequence():
    """Test assembler detects out-of-order lessons."""
    lessons = [
        SOWEntry(order=1, ...),
        SOWEntry(order=3, ...),  # Missing order=2
        SOWEntry(order=4, ...)
    ]
    assembler = SOWAssembler()
    errors = assembler.validate_order_sequence(lessons)
    assert len(errors) > 0
    assert "order 2" in str(errors)
```

#### Test 4.2: Teach-Revision Pairing Validation (Unit)
```python
def test_assembler_validates_teach_revision_pairing():
    """Test assembler enforces teach-revision pairing within 3 entries."""
    lessons = [
        SOWEntry(order=1, lesson_type="teach", ...),
        SOWEntry(order=2, lesson_type="teach", ...),
        SOWEntry(order=3, lesson_type="teach", ...),
        SOWEntry(order=4, lesson_type="teach", ...),
        # Missing revision for order=1 (gap > 3)
    ]
    assembler = SOWAssembler()
    errors = assembler.validate_teach_revision_pairing(lessons)
    assert len(errors) > 0
```

#### Test 4.3: Course Requirements Validation (Unit)
```python
def test_assembler_validates_course_requirements():
    """Test assembler enforces >=1 independent_practice and =1 mock_assessment."""
    lessons = [
        SOWEntry(lesson_type="teach", ...),
        SOWEntry(lesson_type="revision", ...),
        # Missing independent_practice and mock_assessment
    ]
    assembler = SOWAssembler()
    errors = assembler.validate_course_requirements(lessons)
    assert "independent_practice" in str(errors)
    assert "mock_assessment" in str(errors)
```

#### Test 4.4: Full Assembly Without Appwrite (Integration)
```python
def test_assembler_produces_valid_authored_sow():
    """Test full assembly produces valid AuthoredSOW schema."""
    assembler = SOWAssembler()

    authored_sow = assembler.assemble(
        lessons=FIXTURE_LESSONS,
        metadata=FIXTURE_METADATA,
        course_id="course_c84474",
        version="1"
    )

    # Validate against AuthoredSOW Pydantic model
    validated = AuthoredSOW.model_validate(authored_sow)
    assert validated.courseId == "course_c84474"
    assert len(validated.entries) == len(FIXTURE_LESSONS)
```

#### Test 4.5: Schema Compatibility with Legacy (Integration)
```python
def test_iterative_output_matches_legacy_schema():
    """Test iterative output matches legacy AuthoredSOW schema exactly."""
    iterative_sow = load_json("fixtures/iterative_authored_sow.json")
    legacy_sow = load_json("fixtures/legacy_authored_sow.json")

    # Both should validate against same AuthoredSOW model
    iterative_validated = AuthoredSOW.model_validate(iterative_sow)
    legacy_validated = AuthoredSOW.model_validate(legacy_sow)

    # Schema structure should be identical
    assert set(iterative_sow.keys()) == set(legacy_sow.keys())
    assert set(iterative_sow["entries"][0].keys()) == set(legacy_sow["entries"][0].keys())
```

---

## Progressive Testing Approach

### Level 1: Unit Tests (No LLM, No Network)
```bash
# Test Pydantic models and validators in isolation
pytest tests/unit/test_sow_schema_models.py -v
pytest tests/unit/test_sow_assembler.py -v
```

### Level 2: Integration Tests (Mock LLM responses)
```bash
# Test validator tools with sample data
pytest tests/integration/test_validator_tools.py -v
```

### Level 3: Phase Tests (Real LLM, Single Phase)
```bash
# Test each phase with fixtures from previous phases
pytest tests/phases/test_phase1_outline.py -v
pytest tests/phases/test_phase2_lessons.py -v  # Uses fixture outline
pytest tests/phases/test_phase3_metadata.py -v  # Uses fixture lessons
pytest tests/phases/test_phase4_assembly.py -v  # Uses fixture everything
```

### Level 4: End-to-End Tests (Full Pipeline)
```bash
# Test complete flow with real courseId
pytest tests/e2e/test_iterative_sow_author.py -v --courseId course_c84474
```

---

## Fixture Strategy

To test phases in isolation, we need fixtures:

```
tests/fixtures/
├── course_data/
│   └── Course_data_mathematics_n5.txt    # Real extracted course data
├── phase1_outputs/
│   └── lesson_outline_mathematics_n5.json # Valid outline fixture
├── phase2_outputs/
│   ├── lesson_01.json                     # Valid lesson fixtures
│   ├── lesson_02.json
│   └── ...
├── phase3_outputs/
│   └── metadata.json                       # Valid metadata fixture
└── expected_outputs/
    └── authored_sow_mathematics_n5.json    # Expected assembled output
```

---

## Test Directory Structure

```
claud_author_agent/
├── tests/
│   ├── __init__.py
│   ├── conftest.py                  # Shared fixtures
│   ├── unit/
│   │   ├── test_sow_schema_models.py
│   │   └── test_sow_assembler.py
│   ├── integration/
│   │   ├── test_outline_validator_tool.py
│   │   ├── test_entry_validator_tool.py
│   │   └── test_metadata_validator_tool.py
│   ├── phases/
│   │   ├── test_phase1_outline.py
│   │   ├── test_phase2_lessons.py
│   │   ├── test_phase3_metadata.py
│   │   └── test_phase4_assembly.py
│   ├── e2e/
│   │   └── test_iterative_sow_author.py
│   └── fixtures/
│       └── ... (as above)
```

---

## Success Criteria

| Phase | Test Type | Pass Criteria |
|-------|-----------|---------------|
| 1 | Unit | LessonOutline model validates correctly |
| 1 | Integration | Validator tool catches invalid outlines |
| 1 | E2E | Real course produces valid outline |
| 2 | Unit | SOWEntry model validates correctly |
| 2 | Integration | Validator enforces enriched format |
| 2 | E2E | Lessons maintain coherence with previous |
| 3 | Unit | SOWMetadata model validates correctly |
| 3 | Integration | Validator requires non-empty arrays |
| 3 | E2E | Metadata summarizes all lessons |
| 4 | Unit | Cross-lesson validations work |
| 4 | Integration | Assembly produces valid AuthoredSOW |
| 4 | E2E | Output matches legacy schema exactly |

---

## Implementation Priority

1. **Phase 4 Tests First** - Ensure output schema compatibility with legacy
2. **Phase 1 Tests** - Foundation for all subsequent phases
3. **Phase 2 Tests** - Most complex phase with web research
4. **Phase 3 Tests** - Straightforward aggregation
5. **E2E Tests** - Full pipeline validation

---

**End of Specification**
