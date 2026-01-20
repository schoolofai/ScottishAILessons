# Iterative SOW Author - Data Source Refactor Plan

**Status**: Draft
**Created**: 2026-01-19
**Priority**: High

---

## Executive Summary

The iterative SOW author currently reads course data from the **deprecated** `sqa_education.sqa_current` collection, while the devops pipeline seeds normalized course outcomes to `default.course_outcomes`. This creates an inconsistency where the SOW author ignores the richer, normalized data that downstream authors expect.

This plan addresses:
1. **Data Source Migration**: Update iterative SOW author to read from `default.course_outcomes`
2. **Downstream Integration**: Ensure SOW output is compatible with lesson author and diagram author

---

## Part 1: Problem Analysis

### Current Data Flow (BROKEN)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW (INCONSISTENT)                         │
└─────────────────────────────────────────────────────────────────────────────┘

  sqa_education.sqa_current          default.course_outcomes
  (Raw SQA JSON blob)                (Normalized outcomes)
           │                                   │
           │                                   │
    ┌──────▼──────┐                    ┌───────▼───────┐
    │ DEPRECATED  │                    │   Seeding     │
    │course_data_ │                    │  Pipeline     │
    │extractor.py │                    │ (TypeScript)  │
    └──────┬──────┘                    └───────────────┘
           │
           │ Course_data.txt
           │ (legacy format)
           ▼
    ┌─────────────┐
    │ Iterative   │  ❌ IGNORES default.course_outcomes
    │ SOW Author  │
    └──────┬──────┘
           │
           │ authored_sow.json
           │ (standards_or_skills_addressed)
           ▼
    ┌─────────────┐
    │ Lesson      │  ❌ EXPECTS outcomeRefs + assessmentStandardRefs
    │ Author      │
    └─────────────┘
```

### Target Data Flow (FIXED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TARGET FLOW (CONSISTENT)                           │
└─────────────────────────────────────────────────────────────────────────────┘

  sqa_education.sqa_current          default.course_outcomes
  (Raw SQA JSON blob)                (Normalized outcomes)
           │                                   │
           │                                   │
           │                           ┌───────▼───────┐
           │                           │   Seeding     │
           │                           │  Pipeline     │
           │                           │ (TypeScript)  │
           │                           └───────┬───────┘
           │                                   │
           │                                   │ Stores outcomes
           │                                   │ (unit-based OR skills-based)
           │                                   ▼
           │                           ┌───────────────┐
           │                           │course_outcomes│
           │                           │_extractor.py  │
           │                           │    (NEW)      │
           │                           └───────┬───────┘
           │                                   │
           │                                   │ Course_outcomes.json
           │                                   │ (enriched format)
           │                                   ▼
           │                           ┌─────────────┐
           │                           │ Iterative   │
           │                           │ SOW Author  │
           │                           └──────┬──────┘
           │                                  │
           │                                  │ authored_sow.json
           │                                  │ (outcomeRefs + assessmentStandardRefs)
           │                                  ▼
           │                           ┌─────────────┐
           │                           │ Lesson      │ ✅ COMPATIBLE
           │                           │ Author      │
           │                           └─────────────┘
```

---

## Part 2: Data Structure Analysis

### 2.1 Unit-Based Courses (National 3/4)

**Source**: `default.course_outcomes` after seeding

```json
{
  "courseId": "course_c84473",
  "courseSqaCode": "C844 73",
  "unitCode": "HV7Y 73",
  "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
  "outcomeId": "O1",
  "outcomeTitle": "Manage money in basic real-life contexts",
  "assessmentStandards": "[{\"code\":\"AS1.1\",\"desc\":\"Identifying factors affecting income and expenditure\",\"marking_guidance\":\"...\"}]",
  "teacherGuidance": "**AS1.1**: Identifying factors affecting income and expenditure...",
  "keywords": ["money", "income", "expenditure"]
}
```

**Key Fields**:
- `unitCode`: Unit identifier (e.g., "HV7Y 73")
- `unitTitle`: Full unit name
- `outcomeId`: Outcome reference (e.g., "O1", "O2")
- `assessmentStandards`: JSON array with code, desc, marking_guidance

### 2.2 Skills-Based Courses (National 5+)

**Source**: `default.course_outcomes` after seeding

Skills-based courses create two types of outcome documents:

**TOPIC documents** (grouping/navigation):
```json
{
  "courseId": "course_abc123",
  "outcomeId": "TOPIC_NUMERICAL_SKILLS",
  "outcomeTitle": "Numerical Skills",
  "assessmentStandards": "[]",
  "teacherGuidance": "Topic area for Numerical Skills"
}
```

**SKILL documents** (granular tracking):
```json
{
  "courseId": "course_abc123",
  "outcomeId": "SKILL_WORKING_WITH_SURDS",
  "outcomeTitle": "Working with Surds",
  "assessmentStandards": "[{\"code\":\"SKILL_WORKING_WITH_SURDS\",\"desc\":\"Simplification, Rationalising denominators\"}]",
  "teacherGuidance": "Simplify surds...",
  "keywords": ["surds", "rationalise", "simplify"]
}
```

**Key Differences from Unit-Based**:
- No `unitCode` or `unitTitle` (skills-based doesn't use units)
- `outcomeId` uses prefixes: `TOPIC_` or `SKILL_`
- Assessment standards reference the skill itself

### 2.3 Detection Logic

The `course_outcomes_extractor.py` auto-detects structure type:

```python
def detect_structure_type(outcomes: List[Dict]) -> str:
    """Detect if outcomes are unit-based or skills-based."""
    for outcome in outcomes:
        outcome_id = outcome.get("outcomeId", "")
        if outcome_id.startswith("TOPIC_") or outcome_id.startswith("SKILL_"):
            return "skills_based"
    return "unit_based"
```

---

## Part 3: Implementation Plan

### Phase 1: Update Data Extraction (Estimated: 2 hours)

#### 1.1 Replace Deprecated Extractor

**File**: `claud_author_agent/src/iterative_sow_author.py`

**Current (Line ~527)**:
```python
from .utils.course_data_extractor import extract_course_data_to_file

await extract_course_data_to_file(
    subject=subject,
    level=level,
    mcp_config_path=str(self.mcp_config_path),
    output_path=course_data_path  # Course_data.txt
)
```

**Target**:
```python
from .utils.course_outcomes_extractor import extract_course_outcomes_to_file

result = await extract_course_outcomes_to_file(
    courseId=courseId,  # Use courseId instead of subject+level
    mcp_config_path=str(self.mcp_config_path),
    output_path=course_outcomes_path  # Course_outcomes.json
)

structure_type = result["structure_type"]  # "unit_based" or "skills_based"
```

#### 1.2 Update Workspace File Names

| Old File | New File | Purpose |
|----------|----------|---------|
| `Course_data.txt` | `Course_outcomes.json` | Structured JSON instead of text |
| N/A | `course_structure_type.txt` | Store "unit_based" or "skills_based" |

#### 1.3 Update Method Signatures

**Current**:
```python
async def execute(self, subject: str, level: str, ...) -> Dict[str, Any]:
```

**Target**:
```python
async def execute(self, courseId: str, ...) -> Dict[str, Any]:
    # Look up subject/level from courseId if needed for logging
```

---

### Phase 2: Update Prompts (Estimated: 3 hours)

#### 2.1 Outline Author Prompt

**File**: `claud_author_agent/src/prompts/outline_author_prompt.md`

**Changes Required**:

1. Update input file reference:
```markdown
## BEFORE
1. **`/workspace/Course_data.txt`** (REQUIRED)
   - Official SQA course structure
   - Extract exact descriptions for enrichment

## AFTER
1. **`/workspace/Course_outcomes.json`** (REQUIRED)
   - Normalized course outcomes from default.course_outcomes
   - Contains: courseId, outcomeId, outcomeTitle, assessmentStandards, teacherGuidance
   - Structure type: unit_based OR skills_based (indicated in file header)
```

2. Add structure-type awareness:
```markdown
## Course Structure Types

**Unit-Based (National 3/4)**:
- outcomes have `unitCode`, `unitTitle`, `outcomeId` (O1, O2...)
- assessmentStandards contain AS codes (AS1.1, AS1.2...)
- Map lessons to units → outcomes → assessment standards

**Skills-Based (National 5+)**:
- outcomes have `outcomeId` with TOPIC_ or SKILL_ prefixes
- TOPIC_ = navigation/grouping, SKILL_ = granular tracking
- Map lessons to skills directly
```

3. Update output schema to include structure type:
```json
{
  "course_id": "course_c84474",
  "structure_type": "unit_based",
  "total_lessons": 15,
  "outlines": [...]
}
```

#### 2.2 Lesson Entry Prompt

**File**: `claud_author_agent/src/prompts/lesson_entry_prompt.md`

**Critical Change**: Output `outcomeRefs` + `assessmentStandardRefs` format

**Current Output Schema**:
```json
{
  "standards_or_skills_addressed": [
    {"skill_name": "Working with surds", "description": "Simplification..."}
  ]
}
```

**Target Output Schema (Unit-Based)**:
```json
{
  "outcomeRefs": ["O1", "O2"],
  "assessmentStandardRefs": [
    {"code": "AS1.1", "description": "Identifying factors...", "outcome": "O1"},
    {"code": "AS1.2", "description": "Using basic money...", "outcome": "O1"}
  ]
}
```

**Target Output Schema (Skills-Based)**:
```json
{
  "outcomeRefs": ["SKILL_WORKING_WITH_SURDS"],
  "assessmentStandardRefs": [
    {"code": "SKILL_WORKING_WITH_SURDS", "description": "Simplification, Rationalising denominators"}
  ]
}
```

**Prompt Update**:
```markdown
### Output Schema by Structure Type

**For unit_based courses (National 3/4)**:
- `outcomeRefs`: Array of outcome IDs (e.g., ["O1", "O2"])
- `assessmentStandardRefs`: Array of enriched objects:
  ```json
  {
    "code": "AS1.2",
    "description": "EXACT description from Course_outcomes.json",
    "outcome": "O1"
  }
  ```

**For skills_based courses (National 5+)**:
- `outcomeRefs`: Array of SKILL_ IDs (e.g., ["SKILL_WORKING_WITH_SURDS"])
- `assessmentStandardRefs`: Array of enriched objects:
  ```json
  {
    "code": "SKILL_WORKING_WITH_SURDS",
    "description": "EXACT description from Course_outcomes.json"
  }
  ```

**CRITICAL**: Descriptions must match Course_outcomes.json EXACTLY (no paraphrasing)
```

#### 2.3 Metadata Author Prompt

**File**: `claud_author_agent/src/prompts/metadata_author_prompt.md`

**Minor Changes**:
- Reference `Course_outcomes.json` instead of `Course_data.txt`
- Include `structure_type` in metadata output

---

### Phase 3: Update Pydantic Models (Estimated: 1 hour)

**File**: `claud_author_agent/src/tools/sow_schema_models.py`

#### 3.1 Add Structure Type to LessonOutline

```python
class LessonOutline(BaseModel):
    course_id: str
    structure_type: Literal["unit_based", "skills_based"]  # NEW
    total_lessons: int
    outlines: List[LessonOutlineEntry]
```

#### 3.2 Update SOWEntry for Downstream Compatibility

```python
class AssessmentStandardRef(BaseModel):
    """Enriched assessment standard reference."""
    code: str  # e.g., "AS1.2" or "SKILL_WORKING_WITH_SURDS"
    description: str  # Exact from Course_outcomes.json
    outcome: Optional[str] = None  # Parent outcome for unit-based

class SOWEntry(BaseModel):
    order: int
    label: str
    lesson_type: LessonType

    # NEW: Downstream-compatible format
    outcomeRefs: List[str]  # ["O1", "O2"] or ["SKILL_X"]
    assessmentStandardRefs: List[AssessmentStandardRef]

    # DEPRECATED: Remove after migration
    # standards_or_skills_addressed: List[...]
```

#### 3.3 Add Validation for Enriched Format

```python
@field_validator('assessmentStandardRefs')
def validate_enriched_format(cls, v):
    """Ensure assessment standard refs are enriched objects, not bare strings."""
    for ref in v:
        if isinstance(ref, str):
            raise ValueError(
                f"assessmentStandardRefs must be enriched objects, not bare strings. "
                f"Got: {ref}"
            )
    return v
```

---

### Phase 4: Update Validator Tools (Estimated: 1 hour)

#### 4.1 Entry Validator

**File**: `claud_author_agent/src/tools/sow_entry_validator_tool.py`

Add validation for:
- `outcomeRefs` is non-empty array
- `assessmentStandardRefs` contains enriched objects
- All codes exist in Course_outcomes.json (cross-reference validation)

```python
def validate_sow_entry(entry_json: str, course_outcomes_path: str) -> Dict:
    """Validate SOW entry against schema and course outcomes."""

    # Load course outcomes for cross-reference
    with open(course_outcomes_path) as f:
        course_outcomes = json.load(f)

    valid_outcome_ids = {o["outcomeId"] for o in course_outcomes["outcomes"]}
    valid_as_codes = set()
    for o in course_outcomes["outcomes"]:
        for as_item in json.loads(o.get("assessmentStandards", "[]")):
            valid_as_codes.add(as_item["code"])

    # Validate outcomeRefs exist
    entry = json.loads(entry_json)
    for ref in entry.get("outcomeRefs", []):
        if ref not in valid_outcome_ids:
            errors.append(f"Unknown outcomeRef: {ref}")

    # Validate assessmentStandardRefs exist
    for as_ref in entry.get("assessmentStandardRefs", []):
        if as_ref["code"] not in valid_as_codes:
            errors.append(f"Unknown assessment standard code: {as_ref['code']}")

    return {"valid": len(errors) == 0, "errors": errors}
```

---

### Phase 5: Update Downstream Integration (Estimated: 2 hours)

#### 5.1 Verify Lesson Author Compatibility

**File**: `claud_author_agent/src/prompts/lesson_author_prompt.md`

The lesson author prompt already expects `outcomeRefs` + `assessmentStandardRefs`. Verify the transformation rules align:

```markdown
# Transformation #1: COMBINE REFS (CRITICAL)
input_outcomeRefs = ["O1"]
input_assessmentStandardRefs = [
  {"code": "AS1.2", "description": "...", "outcome": "O1"},
]
output_outcomeRefs = ["O1", "AS1.2"]  # Combined for frontend
```

**No changes needed** - lesson author is already compatible.

#### 5.2 Verify Diagram Author Compatibility

The diagram author reads from `lesson_templates` collection which stores the lesson author output. Since lesson author output is unchanged (same `outcomeRefs` format), diagram author remains compatible.

**No changes needed** - diagram author is already compatible.

#### 5.3 Update DevOps Pipeline

**File**: `devops/lib/step_runner.py`

Update the SOW step to pass `courseId` instead of `subject`+`level`:

```python
# BEFORE
async def run_sow_step(subject: str, level: str, ...):
    sow_author = IterativeSOWAuthor(...)
    await sow_author.execute(subject=subject, level=level, ...)

# AFTER
async def run_sow_step(courseId: str, ...):
    sow_author = IterativeSOWAuthor(...)
    await sow_author.execute(courseId=courseId, ...)
```

---

## Part 4: Testing Strategy

### 4.1 Unit Tests

| Test | Purpose |
|------|---------|
| `test_detect_unit_based_structure` | Verify detection of National 3/4 courses |
| `test_detect_skills_based_structure` | Verify detection of National 5+ courses |
| `test_outcome_refs_validation` | Verify outcomeRefs format validation |
| `test_assessment_standard_refs_enriched` | Verify enriched format validation |

### 4.2 Integration Tests

| Test | Purpose |
|------|---------|
| `test_extract_nat4_outcomes` | Extract real National 4 course outcomes |
| `test_extract_nat5_outcomes` | Extract real National 5 course outcomes |
| `test_lesson_entry_with_unit_based` | Generate lesson with unit-based outcomes |
| `test_lesson_entry_with_skills_based` | Generate lesson with skills-based outcomes |

### 4.3 End-to-End Tests

| Test | Purpose |
|------|---------|
| `test_full_pipeline_nat4` | Full pipeline with National 4 course |
| `test_full_pipeline_nat5` | Full pipeline with National 5 course |
| `test_downstream_lesson_author` | Verify lesson author accepts SOW output |

---

## Part 5: Migration Checklist

### Pre-Migration

- [ ] Backup existing `Course_data.txt` files for reference
- [ ] Ensure `default.course_outcomes` has data for target courses
- [ ] Run seeding for any missing courses

### Migration Steps

1. [ ] Update `course_outcomes_extractor.py` with structure type detection
2. [ ] Update `iterative_sow_author.py` to use new extractor
3. [ ] Update `outline_author_prompt.md` for new input format
4. [ ] Update `lesson_entry_prompt.md` for new output schema
5. [ ] Update `sow_schema_models.py` with new fields
6. [ ] Update `sow_entry_validator_tool.py` for cross-reference validation
7. [ ] Update `step_runner.py` for courseId parameter
8. [ ] Run unit tests
9. [ ] Run integration tests
10. [ ] Run E2E test with National 4 course
11. [ ] Run E2E test with National 5 course
12. [ ] Verify downstream lesson author works with new SOW format

### Post-Migration

- [ ] Remove deprecated `course_data_extractor.py`
- [ ] Update documentation
- [ ] Archive old `Course_data.txt` format specs

---

## Part 6: Risk Mitigation

### Risk 1: Schema Mismatch with Downstream

**Mitigation**: The lesson author already expects `outcomeRefs` + `assessmentStandardRefs` format. This change aligns SOW output with existing expectations.

### Risk 2: Missing Course Outcomes

**Mitigation**: Add validation in SOW author to fail fast if course outcomes are not seeded:
```python
if not outcomes:
    raise ValueError(
        f"No course outcomes found for courseId={courseId}. "
        f"Run seeding pipeline first: ./devops/pipeline.sh lessons --subject X --level Y"
    )
```

### Risk 3: Structure Type Detection Failures

**Mitigation**: Use explicit `structure_type` field in course metadata if available, fall back to prefix detection only if needed.

---

## Appendix: File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/iterative_sow_author.py` | Modify | Use new extractor, pass courseId |
| `src/utils/course_outcomes_extractor.py` | Minor | Add structure_type to output |
| `src/prompts/outline_author_prompt.md` | Modify | New input format, structure awareness |
| `src/prompts/lesson_entry_prompt.md` | Modify | New output schema with outcomeRefs |
| `src/tools/sow_schema_models.py` | Modify | Add AssessmentStandardRef, update SOWEntry |
| `src/tools/sow_entry_validator_tool.py` | Modify | Add cross-reference validation |
| `devops/lib/step_runner.py` | Modify | Pass courseId instead of subject+level |
| `src/utils/course_data_extractor.py` | Delete | Deprecated, remove after migration |

---

**End of Plan**
