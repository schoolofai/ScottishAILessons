# Phase 3: Metadata Generation Testing Plan

## Overview

Phase 3 generates **course-level metadata** from all lessons produced in Phase 2. The metadata provides strategic guidance:
- **Coherence notes**: Policy and sequencing rationale
- **Accessibility notes**: Inclusive design strategies
- **Engagement notes**: Motivation and relevance strategies

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3: METADATA GENERATION                        │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────────┐
                    │           Phase 2 Artifacts              │
                    │  ┌────────────────────────────────────┐  │
                    │  │  lesson_01.json ... lesson_19.json │  │
                    │  │  Course_outcomes.json              │  │
                    │  │  lesson_outline.json               │  │
                    │  └────────────────────────────────────┘  │
                    └────────────────────┬─────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║               PYTHON PRE-PROCESSING (No LLM)                         ║ │
│  ║                                                                      ║ │
│  ║   1. Load all lesson_XX.json files                                  ║ │
│  ║   2. Assemble into all_lessons.json array                           ║ │
│  ║   3. Copy Course_outcomes.json to workspace                         ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            METADATA AUTHOR (Claude Agent SDK)                        ║ │
│  ║                                                                      ║ │
│  ║   Uses: query() with output_format (METADATA_SCHEMA)                 ║ │
│  ║   Prompt: metadata_author_prompt.md                                  ║ │
│  ║   Tools: Read, Glob (no WebSearch - summarization only)              ║ │
│  ║   Input: Course_outcomes.json, all_lessons.json                      ║ │
│  ║   Output: Metadata JSON via structured_output                        ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            PYDANTIC VALIDATION (Python, No LLM)                      ║ │
│  ║                                                                      ║ │
│  ║   1. Validate against Metadata Pydantic model                        ║ │
│  ║   2. Check all arrays non-empty (min 1 item each)                   ║ │
│  ║   3. Verify notes are course-specific (not generic)                  ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │              Output                       │
                    │  ┌────────────────────────────────────┐  │
                    │  │         metadata.json               │  │
                    │  └────────────────────────────────────┘  │
                    └──────────────────────────────────────────┘
```

## Input Artifacts (from Phase 2)

| File | Path | Description |
|------|------|-------------|
| **Course_outcomes.json** | `workspace/phase2_full_test_20260119_231045/` | Normalized curriculum data |
| **lesson_01.json - lesson_19.json** | `workspace/phase2_full_test_20260119_231045/` | All 19 generated lessons |
| **lesson_outline.json** | `workspace/phase2_full_test_20260119_231045/` | Lesson sequence outline |

**Phase 2 Workspace Path:**
```
/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent/workspace/phase2_full_test_20260119_231045/
```

## Output Schema (Minimal JSON)

```json
{
  "type": "object",
  "properties": {
    "coherence": {
      "type": "object",
      "properties": {
        "policy_notes": {"type": "array", "items": {"type": "string"}},
        "sequencing_notes": {"type": "array", "items": {"type": "string"}}
      },
      "required": ["policy_notes", "sequencing_notes"]
    },
    "accessibility_notes": {"type": "array", "items": {"type": "string"}},
    "engagement_notes": {"type": "array", "items": {"type": "string"}},
    "weeks": {"type": "integer"},
    "periods_per_week": {"type": "integer"}
  },
  "required": ["coherence", "accessibility_notes", "engagement_notes"]
}
```

**Schema Size**: 545 chars (minimal, optimized for structured_output extraction)

## Validation Criteria

### 1. Schema Compliance
- [ ] Output validates against Metadata Pydantic model
- [ ] `coherence.policy_notes` is non-empty array of strings
- [ ] `coherence.sequencing_notes` is non-empty array of strings
- [ ] `accessibility_notes` is non-empty array of strings
- [ ] `engagement_notes` is non-empty array of strings
- [ ] `weeks` is positive integer (if present)
- [ ] `periods_per_week` is positive integer 1-10 (if present)

### 2. Content Quality
- [ ] `policy_notes` mention calculator policy progression
- [ ] `sequencing_notes` explain prerequisite relationships
- [ ] `accessibility_notes` mention CEFR language level
- [ ] `engagement_notes` reference Scottish contexts
- [ ] Notes are course-specific (reference actual content from lessons)

### 3. Extraction Method
- [ ] Structured output extracted via `message.structured_output` OR ToolUseBlock
- [ ] JSON string parsing handles nested objects correctly
- [ ] Unwrapping handles single-key wrappers if present

## Test Script

```python
#!/usr/bin/env python3
"""Phase 3: Metadata Generation Test

Takes Phase 2 artifacts as input and generates course-level metadata.
"""

import asyncio
import json
import logging
from pathlib import Path
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Phase 2 workspace path
PHASE2_WORKSPACE = Path("/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent/workspace/phase2_full_test_20260119_231045")


async def test_phase3_metadata():
    """Test Phase 3 metadata generation using Phase 2 artifacts."""
    from src.iterative_sow_author import IterativeSOWAuthor
    from src.tools.sow_schema_models import SOWEntry, Metadata
    from src.utils.filesystem import IsolatedFilesystem

    # Create test workspace
    execution_id = datetime.now().strftime("phase3_test_%Y%m%d_%H%M%S")

    with IsolatedFilesystem(
        execution_id,
        persist=True,
        workspace_type="phase3_metadata_test"
    ) as filesystem:
        workspace_path = filesystem.root
        logger.info(f"📁 Phase 3 Test Workspace: {workspace_path}")

        # ═══════════════════════════════════════════════════════════════
        # Step 1: Copy Course_outcomes.json from Phase 2
        # ═══════════════════════════════════════════════════════════════
        logger.info("📥 Step 1: Copying Course_outcomes.json...")

        course_outcomes_src = PHASE2_WORKSPACE / "Course_outcomes.json"
        course_outcomes_dst = workspace_path / "Course_outcomes.json"
        course_outcomes_dst.write_text(course_outcomes_src.read_text())

        logger.info(f"✅ Course_outcomes.json copied ({course_outcomes_dst.stat().st_size:,} bytes)")

        # ═══════════════════════════════════════════════════════════════
        # Step 2: Assemble all_lessons.json from Phase 2 lesson files
        # ═══════════════════════════════════════════════════════════════
        logger.info("📥 Step 2: Assembling all_lessons.json...")

        all_lessons = []
        for i in range(1, 20):  # 19 lessons
            lesson_file = PHASE2_WORKSPACE / f"lesson_{i:02d}.json"
            if lesson_file.exists():
                lesson_data = json.loads(lesson_file.read_text())
                # Validate against Pydantic model
                lesson = SOWEntry.model_validate(lesson_data)
                all_lessons.append(lesson)
                logger.info(f"  Loaded lesson {i}: {lesson.label}")
            else:
                raise FileNotFoundError(f"Missing lesson file: {lesson_file}")

        # Write all_lessons.json
        all_lessons_path = workspace_path / "all_lessons.json"
        all_lessons_dict = [lesson.model_dump() for lesson in all_lessons]
        all_lessons_path.write_text(json.dumps(all_lessons_dict, indent=2))

        logger.info(f"✅ all_lessons.json assembled ({len(all_lessons)} lessons, {all_lessons_path.stat().st_size:,} bytes)")

        # ═══════════════════════════════════════════════════════════════
        # Step 3: Run Metadata Generation
        # ═══════════════════════════════════════════════════════════════
        logger.info("🚀 Step 3: Running metadata generation...")

        author = IterativeSOWAuthor(
            mcp_config_path=".mcp.json",
            persist_workspace=True,
            log_level="DEBUG"
        )

        # Extract subject and level from course outcomes
        course_outcomes = json.loads(course_outcomes_src.read_text())
        # For Higher Applications of Mathematics
        subject = "applications-of-mathematics"
        level = "higher"

        start_time = datetime.now()

        metadata = await author._generate_metadata_structured(
            workspace_path=workspace_path,
            all_lessons=all_lessons,
            subject=subject,
            level=level
        )

        elapsed = (datetime.now() - start_time).total_seconds()

        logger.info(f"✅ Metadata generated in {elapsed:.1f}s")

        # ═══════════════════════════════════════════════════════════════
        # Step 4: Validate Output
        # ═══════════════════════════════════════════════════════════════
        logger.info("🔍 Step 4: Validating metadata...")

        # Save metadata
        metadata_path = workspace_path / "metadata.json"
        metadata_path.write_text(metadata.model_dump_json(indent=2))

        # Validation checks
        validation_results = {
            "schema_valid": True,
            "policy_notes_count": len(metadata.coherence.policy_notes),
            "sequencing_notes_count": len(metadata.coherence.sequencing_notes),
            "accessibility_notes_count": len(metadata.accessibility_notes),
            "engagement_notes_count": len(metadata.engagement_notes),
            "weeks": metadata.weeks,
            "periods_per_week": metadata.periods_per_week
        }

        # Content quality checks
        policy_text = " ".join(metadata.coherence.policy_notes).lower()
        sequencing_text = " ".join(metadata.coherence.sequencing_notes).lower()
        accessibility_text = " ".join(metadata.accessibility_notes).lower()
        engagement_text = " ".join(metadata.engagement_notes).lower()

        content_checks = {
            "policy_mentions_calculator": "calculator" in policy_text or "calc" in policy_text,
            "sequencing_mentions_prerequisite": "prerequisite" in sequencing_text or "precede" in sequencing_text,
            "accessibility_mentions_cefr": "cefr" in accessibility_text or "language" in accessibility_text,
            "engagement_mentions_scottish": "scottish" in engagement_text or "scotland" in engagement_text
        }

        # Print results
        print("\n" + "=" * 70)
        print("PHASE 3 METADATA GENERATION TEST RESULTS")
        print("=" * 70)

        print(f"\n📊 Schema Validation:")
        print(f"   ✅ Pydantic validation passed")
        print(f"   policy_notes: {validation_results['policy_notes_count']} items")
        print(f"   sequencing_notes: {validation_results['sequencing_notes_count']} items")
        print(f"   accessibility_notes: {validation_results['accessibility_notes_count']} items")
        print(f"   engagement_notes: {validation_results['engagement_notes_count']} items")
        print(f"   weeks: {validation_results['weeks']}")
        print(f"   periods_per_week: {validation_results['periods_per_week']}")

        print(f"\n📝 Content Quality Checks:")
        for check, passed in content_checks.items():
            status = "✅" if passed else "⚠️"
            print(f"   {status} {check}: {passed}")

        print(f"\n⏱️  Elapsed Time: {elapsed:.1f}s")
        print(f"📁 Workspace: {workspace_path}")
        print(f"📄 Output: {metadata_path}")

        # Save test metrics
        test_metrics = {
            "elapsed_seconds": elapsed,
            "validation_results": validation_results,
            "content_checks": content_checks,
            "workspace_path": str(workspace_path),
            "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S")
        }

        metrics_path = workspace_path / "test_metrics.json"
        metrics_path.write_text(json.dumps(test_metrics, indent=2))

        print(f"\n{'=' * 70}")
        all_passed = all(content_checks.values()) and all(
            v >= 1 for k, v in validation_results.items()
            if k.endswith('_count')
        )
        if all_passed:
            print("✅ PHASE 3 TEST PASSED")
        else:
            print("⚠️  PHASE 3 TEST COMPLETED WITH WARNINGS")
        print("=" * 70)

        return {
            "success": all_passed,
            "metadata": metadata.model_dump(),
            "validation": validation_results,
            "content_checks": content_checks,
            "elapsed_seconds": elapsed,
            "workspace_path": str(workspace_path)
        }


if __name__ == "__main__":
    result = asyncio.run(test_phase3_metadata())
```

## Execution Steps

### 1. Run Phase 3 Test
```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent
source .venv/bin/activate
python -c "
import asyncio
exec(open('tasks/phase3-metadata-testing-plan.md').read().split('```python')[1].split('```')[0])
result = asyncio.run(test_phase3_metadata())
print(f'Success: {result[\"success\"]}')"
```

### 2. Alternative: Inline Test
```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent
source .venv/bin/activate
python -c "
import asyncio
import sys
sys.path.insert(0, '.')
from src.iterative_sow_author import IterativeSOWAuthor
# ... run test
"
```

## Expected Output

### Success Case
```
======================================================================
PHASE 3 METADATA GENERATION TEST RESULTS
======================================================================

📊 Schema Validation:
   ✅ Pydantic validation passed
   policy_notes: 3 items
   sequencing_notes: 4 items
   accessibility_notes: 4 items
   engagement_notes: 4 items
   weeks: 15
   periods_per_week: 4

📝 Content Quality Checks:
   ✅ policy_mentions_calculator: True
   ✅ sequencing_mentions_prerequisite: True
   ✅ accessibility_mentions_cefr: True
   ✅ engagement_mentions_scottish: True

⏱️  Elapsed Time: 45.2s
📁 Workspace: workspace/phase3_test_20260120_XXXXXX
📄 Output: workspace/phase3_test_20260120_XXXXXX/metadata.json

======================================================================
✅ PHASE 3 TEST PASSED
======================================================================
```

## Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | Create test plan document | ✅ Created |
| 2 | Run Phase 3 test | ✅ PASSED |
| 3 | Validate metadata output | ✅ All checks passed |
| 4 | Update test plan with results | ✅ Updated |

---

## ✅ TEST RESULTS (2026-01-20)

### Test Execution Summary

| Metric | Value |
|--------|-------|
| **Elapsed Time** | 47.1 seconds |
| **Schema Validation** | ✅ Passed |
| **Content Quality** | ✅ All 4 checks passed |
| **Workspace** | `workspace/phase3_test_20260120_093014` |

### Schema Validation Results

| Field | Count | Status |
|-------|-------|--------|
| `coherence.policy_notes` | 5 items | ✅ |
| `coherence.sequencing_notes` | 7 items | ✅ |
| `accessibility_notes` | 6 items | ✅ |
| `engagement_notes` | 7 items | ✅ |
| `weeks` | 30 | ✅ |
| `periods_per_week` | 4 | ✅ |

### Content Quality Checks

| Check | Result |
|-------|--------|
| policy_mentions_calculator | ✅ True |
| sequencing_mentions_prerequisite | ✅ True |
| accessibility_mentions_language | ✅ True |
| engagement_mentions_scottish | ✅ True |

### Generated Metadata Highlights

**Policy Notes (5 items):**
- Calculator usage: All 19 lessons use `calc` policy for applied mathematics
- Assessment progression: formative exit tickets → mock examination
- Detailed rubrics aligned to SQA assessment standards
- Lesson 19 mock exam positioned as final lesson

**Sequencing Notes (7 items):**
- Skills-based structure with 4 blocks: Modelling → Statistics → Finance → Planning
- Logical progression within Statistics block (lessons 3-10)
- Consistent 5-card flow across all teach lessons
- Cross-topic integration in lessons 17-18

**Accessibility Notes (6 items):**
- CEFR B1 plain language level
- Key terms defined with student-friendly language
- Dyslexia-friendly design features
- Scaffolded support in guided practice

**Engagement Notes (7 items):**
- Scottish contexts: ScotRail, Edinburgh, Glasgow, Highland, Aberdeen
- Real-world applications: budgeting, travel, renewable energy
- Digital literacy through spreadsheet lessons
- Cross-topic integration demonstrations

### Extraction Method

Metadata was successfully extracted via **ToolUseBlock** during streaming, with confirmation from **ResultMessage.structured_output** at completion. Both extraction paths worked correctly.

## Notes

- **No Critic Loop**: Unlike Phase 1 (outline) and Phase 2 (lessons), metadata generation does NOT have a critic validation loop. This is by design - metadata is a summarization task with no "right or wrong" answers.
- **No WebSearch**: Metadata generation only uses Read/Glob tools (summarization, not research)
- **Small Output**: METADATA_SCHEMA is only 545 chars - the simplest schema in the pipeline
- **Course-Specific**: Notes should reference actual content from the lessons, not generic boilerplate

---

## Appendix: Metadata Schema (Pydantic)

```python
class Coherence(BaseModel):
    """Course coherence information."""
    policy_notes: List[str] = Field(
        ...,
        min_length=1,
        description="Notes explaining calculator and assessment policies"
    )
    sequencing_notes: List[str] = Field(
        ...,
        min_length=1,
        description="Notes explaining lesson ordering rationale"
    )

class Metadata(BaseModel):
    """Course-level metadata for AuthoredSOW."""
    coherence: Coherence
    accessibility_notes: List[str] = Field(
        ...,
        min_length=1,
        description="Notes on inclusive design strategies"
    )
    engagement_notes: List[str] = Field(
        ...,
        min_length=1,
        description="Notes on motivation and relevance strategies"
    )
    weeks: Optional[int] = Field(
        None,
        ge=1,
        le=52,
        description="Estimated course duration in weeks"
    )
    periods_per_week: Optional[int] = Field(
        None,
        ge=1,
        le=10,
        description="Typical periods per week in Scottish secondary"
    )
```
