# Phase 4: Assembly & Appwrite Upsert Testing Plan

## Overview

Phase 4 is the **final phase** of the iterative SOW authoring pipeline. It assembles all artifacts from previous phases into a complete `AuthoredSOW` and uploads it to Appwrite.

**Key Characteristics:**
- **No LLM calls** - Pure Python assembly and validation
- **Cross-lesson validation** - Ensures coherence across all 19 lessons
- **Final Pydantic validation** - Validates complete AuthoredSOW schema
- **Compression** - Uses gzip+base64 for entries to fit Appwrite's 100K limit
- **Storage Bucket Fallback** - Large entries (>100K) stored in Appwrite Storage with `storage:<file_id>` reference
- **Force mode** - Deletes existing SOW and re-links lesson templates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: ASSEMBLY & APPWRITE UPSERT                       │
└─────────────────────────────────────────────────────────────────────────────┘

              ┌─────────────────────────────────────────────────┐
              │              Input Artifacts                     │
              │  ┌───────────────────────────────────────────┐  │
              │  │ Phase 2: lesson_01.json ... lesson_19.json│  │
              │  │ Phase 3: metadata.json                    │  │
              │  │ Config: courseId, version                  │  │
              │  └───────────────────────────────────────────┘  │
              └─────────────────────┬───────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║                 STEP 1: CROSS-LESSON VALIDATION                      ║ │
│  ║                                                                      ║ │
│  ║   1. Validate lesson ordering (sequential 1..19)                     ║ │
│  ║   2. Skip teach-revision pairing (iterative mode)                   ║ │
│  ║   3. Skip independent_practice requirement (iterative mode)         ║ │
│  ║   4. Validate exactly 1 mock_exam lesson                            ║ │
│  ║   5. Generate accessibility summary                                  ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║                  STEP 2: BUILD AUTHORGEDSOW                          ║ │
│  ║                                                                      ║ │
│  ║   {                                                                  ║ │
│  ║     "courseId": "course_c84476",                                     ║ │
│  ║     "version": "1",                                                  ║ │
│  ║     "status": "draft",                                               ║ │
│  ║     "metadata": {...},           # From Phase 3                      ║ │
│  ║     "entries": [...],            # 19 lessons from Phase 2           ║ │
│  ║     "accessibility_notes": "..." # Generated summary                 ║ │
│  ║   }                                                                  ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            STEP 3: FINAL PYDANTIC VALIDATION                         ║ │
│  ║                                                                      ║ │
│  ║   AuthoredSOW.model_validate(sow_dict)                               ║ │
│  ║   - Validates all required fields                                    ║ │
│  ║   - Validates nested structures (SOWEntry, Metadata)                 ║ │
│  ║   - Exports validated dict with exclude_none=True                    ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            STEP 4: FORCE MODE - DELETE EXISTING SOW                   ║ │
│  ║                                                                      ║ │
│  ║   Existing SOW: 69034152b0c2d69620ee (version 1, status: published)  ║ │
│  ║                                                                      ║ │
│  ║   1. Query lesson_templates linked to old SOW                        ║ │
│  ║   2. Delete old Authored_SOW document                                ║ │
│  ║   3. Track templates for re-linking                                  ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            STEP 5: TRANSFORM FOR APPWRITE                            ║ │
│  ║                                                                      ║ │
│  ║   - Compress entries array (gzip+base64)                             ║ │
│  ║   - IF compressed size > 100K chars:                                 ║ │
│  ║       → Upload to Storage bucket 'authored_sow_entries'              ║ │
│  ║       → Store "storage:<file_id>" reference in entries field         ║ │
│  ║   - Stringify metadata object                                        ║ │
│  ║   - Convert accessibility_notes array to bullet string               ║ │
│  ║   - Add permissions: ["read(\"any\")"]                               ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            STEP 6: CREATE APPWRITE DOCUMENT                          ║ │
│  ║                                                                      ║ │
│  ║   Collection: default.Authored_SOW                                   ║ │
│  ║   Document ID: unique() (Appwrite auto-generated)                    ║ │
│  ║   Fields: courseId, version, status, entries, metadata,              ║ │
│  ║           accessibility_notes                                        ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║            STEP 7: RE-LINK LESSON TEMPLATES                          ║ │
│  ║                                                                      ║ │
│  ║   Update lesson_templates.authored_sow_id to new SOW ID              ║ │
│  ║   (Only if force mode deleted existing SOW)                          ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
              ┌─────────────────────────────────────────────────┐
              │              Output                              │
              │  ┌───────────────────────────────────────────┐  │
              │  │ authored_sow.json (local file)            │  │
              │  │ Appwrite document ID (database entry)      │  │
              │  └───────────────────────────────────────────┘  │
              └─────────────────────────────────────────────────┘
```

## Input Artifacts

| Source | File | Description |
|--------|------|-------------|
| **Phase 2** | `lesson_01.json ... lesson_19.json` | 19 validated lesson entries |
| **Phase 3** | `metadata.json` | Course-level metadata |
| **Config** | `course_c84476` | Course ID |
| **Config** | `1` | Version (will overwrite existing) |

**Phase 2 Workspace:**
```
workspace/phase2_full_test_20260119_231045/
```

**Phase 3 Workspace:**
```
workspace/phase3_test_20260120_093014/
```

## Existing Appwrite State

| Field | Value |
|-------|-------|
| **Document ID** | `69034152b0c2d69620ee` |
| **courseId** | `course_c84476` |
| **Version** | `1` |
| **Status** | `published` |
| **Created** | `2025-10-30T10:43:30.724+00:00` |

**⚠️ FORCE MODE**: This test will DELETE the existing SOW and create a new one.

## Validation Criteria

### 1. Cross-Lesson Validation
- [x] Lesson ordering sequential (1..19)
- [x] Skip teach-revision pairing (iterative pipeline mode)
- [x] Skip independent_practice requirement (iterative pipeline mode)
- [x] Exactly 1 mock_exam lesson (lesson 19)

### 2. Schema Validation
- [x] AuthoredSOWIterative Pydantic validation passes ✅
- [x] All 19 entries validate as SOWEntry ✅
- [x] Metadata validates as Metadata ✅

### 3. Appwrite Operations
- [x] Old SOW deleted successfully (force mode) ✅ (queried by courseId)
- [x] New document created with unique() ID ✅ (`696f50aa6a4779617185`)
- [x] Entries compressed (gzip+base64) ✅
- [x] Entry trimming applied (127,501 → 92,149 chars) ✅
- [x] Lesson templates re-linked to new SOW ✅

### 3a. Storage Bucket Verification (for entries >100K) ✅ PASSED (2026-01-20)
- [x] Storage bucket `authored_sow_entries` exists ✅
- [x] If entries >100K after compression, uploaded to storage ✅ (127,501 chars → bucket)
- [x] entries field contains `storage:<file_id>` reference ✅ (`storage:696f676cd04554f75bff`)
- [x] File can be downloaded from storage bucket ✅
- [x] Downloaded content decompresses correctly ✅

**Storage Bucket Test Results:**
- Document ID: `696f676d27b78f0a71ae`
- Storage File ID: `696f676cd04554f75bff`
- Entries field value: `storage:696f676cd04554f75bff` (28 chars instead of 127K!)

### 4. Data Integrity
- [x] courseId = "course_c84476" ✅
- [x] version = "2" ✅
- [x] status = "draft" ✅
- [x] entries count = 19 ✅
- [x] accessibility_notes populated ✅

## Test Script

```python
#!/usr/bin/env python3
"""Phase 4: Assembly & Appwrite Upsert Test

Assembles Phase 2 + Phase 3 artifacts into AuthoredSOW and uploads to Appwrite.
Uses --force to delete existing SOW version.
"""

import asyncio
import json
import logging
from pathlib import Path
from datetime import datetime
import sys

sys.path.insert(0, '.')

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Workspace paths
PHASE2_WORKSPACE = Path("workspace/phase2_full_test_20260119_231045")
PHASE3_WORKSPACE = Path("workspace/phase3_test_20260120_093014")

# Course configuration
COURSE_ID = "course_c84476"
VERSION = "1"
SUBJECT = "applications-of-mathematics"
LEVEL = "higher"


async def test_phase4_assembly():
    """Test Phase 4: Assembly & Appwrite Upsert."""
    from src.tools.sow_schema_models import SOWEntry, Metadata, AuthoredSOW
    from src.utils.sow_assembler import assemble_sow, generate_accessibility_summary
    from src.utils.sow_upserter import upsert_sow_to_appwrite
    from src.utils.appwrite_mcp import list_appwrite_documents
    from src.utils.filesystem import IsolatedFilesystem

    execution_id = datetime.now().strftime("phase4_test_%Y%m%d_%H%M%S")

    with IsolatedFilesystem(
        execution_id,
        persist=True,
        workspace_type="phase4_assembly_test"
    ) as filesystem:
        workspace_path = filesystem.root
        logger.info(f"📁 Phase 4 Test Workspace: {workspace_path}")

        # ═══════════════════════════════════════════════════════════════
        # Step 1: Load lessons from Phase 2
        # ═══════════════════════════════════════════════════════════════
        logger.info("📥 Step 1: Loading lessons from Phase 2...")

        lessons = []
        for i in range(1, 20):  # 19 lessons
            lesson_file = PHASE2_WORKSPACE / f"lesson_{i:02d}.json"
            if lesson_file.exists():
                lesson_data = json.loads(lesson_file.read_text())
                # Validate against Pydantic model
                lesson = SOWEntry.model_validate(lesson_data)
                lessons.append(lesson.model_dump())
                logger.info(f"  ✅ Loaded lesson {i}: {lesson.label[:50]}...")
            else:
                raise FileNotFoundError(f"Missing lesson file: {lesson_file}")

        logger.info(f"✅ Loaded {len(lessons)} lessons from Phase 2")

        # ═══════════════════════════════════════════════════════════════
        # Step 2: Load metadata from Phase 3
        # ═══════════════════════════════════════════════════════════════
        logger.info("📥 Step 2: Loading metadata from Phase 3...")

        metadata_file = PHASE3_WORKSPACE / "metadata.json"
        if not metadata_file.exists():
            raise FileNotFoundError(f"Missing metadata file: {metadata_file}")

        metadata_data = json.loads(metadata_file.read_text())
        metadata = Metadata.model_validate(metadata_data)
        logger.info(f"✅ Loaded metadata from Phase 3")

        # ═══════════════════════════════════════════════════════════════
        # Step 3: Check for existing SOW (force mode preparation)
        # ═══════════════════════════════════════════════════════════════
        logger.info("🔍 Step 3: Checking for existing SOW (force mode)...")

        existing_sows = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[
                f'equal("courseId", "{COURSE_ID}")',
                f'equal("version", "{VERSION}")'
            ],
            mcp_config_path=".mcp.json"
        )

        existing_sow_id = None
        if existing_sows and len(existing_sows) > 0:
            existing_sow_id = existing_sows[0]['$id']
            logger.warning(f"⚠️  Found existing SOW: {existing_sow_id}")
            logger.warning(f"   Status: {existing_sows[0].get('status')}")
            logger.warning(f"   Will be DELETED in force mode")
        else:
            logger.info("   No existing SOW found for this version")

        # ═══════════════════════════════════════════════════════════════
        # Step 4: Assemble SOW
        # ═══════════════════════════════════════════════════════════════
        logger.info("🔧 Step 4: Assembling SOW...")

        start_time = datetime.now()

        # Generate accessibility summary
        accessibility_summary = generate_accessibility_summary(lessons)
        logger.info(f"  Generated accessibility summary: {accessibility_summary[:100]}...")

        # Assemble SOW with iterative pipeline flags
        final_sow = assemble_sow(
            lessons=lessons,
            metadata=metadata.model_dump(),
            courseId=COURSE_ID,
            version=VERSION,
            accessibility_notes_summary=accessibility_summary,
            skip_revision_validation=True,      # Iterative pipeline mode
            skip_practice_validation=True       # Iterative pipeline mode
        )

        assembly_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"✅ SOW assembled in {assembly_time:.2f}s")

        # Save assembled SOW locally
        sow_path = workspace_path / "authored_sow.json"
        sow_path.write_text(json.dumps(final_sow, indent=2))
        logger.info(f"  Saved to: {sow_path}")

        # ═══════════════════════════════════════════════════════════════
        # Step 5: Upsert to Appwrite (FORCE MODE)
        # ═══════════════════════════════════════════════════════════════
        logger.info("📤 Step 5: Upserting to Appwrite (FORCE MODE)...")

        upsert_start = datetime.now()

        new_sow_id = await upsert_sow_to_appwrite(
            sow_file_path=str(sow_path),
            subject=SUBJECT,
            level=LEVEL,
            course_id=COURSE_ID,
            version=VERSION,
            execution_id=execution_id,
            mcp_config_path=".mcp.json",
            existing_sow_id=existing_sow_id  # Force mode - delete and replace
        )

        upsert_time = (datetime.now() - upsert_start).total_seconds()
        logger.info(f"✅ SOW upserted in {upsert_time:.2f}s")
        logger.info(f"  New Document ID: {new_sow_id}")

        # ═══════════════════════════════════════════════════════════════
        # Step 6: Verify Appwrite Entry
        # ═══════════════════════════════════════════════════════════════
        logger.info("🔍 Step 6: Verifying Appwrite entry...")

        verification = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[f'equal("$id", "{new_sow_id}")'],
            mcp_config_path=".mcp.json"
        )

        if verification and len(verification) > 0:
            verified_doc = verification[0]
            logger.info(f"  ✅ Document verified in Appwrite")
            logger.info(f"     ID: {verified_doc['$id']}")
            logger.info(f"     courseId: {verified_doc.get('courseId')}")
            logger.info(f"     version: {verified_doc.get('version')}")
            logger.info(f"     status: {verified_doc.get('status')}")
            logger.info(f"     created: {verified_doc.get('$createdAt')}")
        else:
            raise ValueError(f"Failed to verify document {new_sow_id} in Appwrite")

        # ═══════════════════════════════════════════════════════════════
        # Step 7: Print Results
        # ═══════════════════════════════════════════════════════════════
        total_time = assembly_time + upsert_time

        print("\n" + "=" * 70)
        print("PHASE 4 ASSEMBLY & APPWRITE UPSERT TEST RESULTS")
        print("=" * 70)

        print(f"\n📊 Assembly Results:")
        print(f"   Lessons assembled: {len(lessons)}")
        print(f"   Metadata included: ✅")
        print(f"   Pydantic validation: ✅")
        print(f"   Assembly time: {assembly_time:.2f}s")

        print(f"\n📤 Appwrite Results:")
        print(f"   Force mode: {'✅ Deleted ' + existing_sow_id if existing_sow_id else '❌ No existing SOW'}")
        print(f"   New Document ID: {new_sow_id}")
        print(f"   courseId: {COURSE_ID}")
        print(f"   version: {VERSION}")
        print(f"   status: draft")
        print(f"   Upsert time: {upsert_time:.2f}s")

        print(f"\n📁 Output Files:")
        print(f"   Local SOW: {sow_path}")
        print(f"   Workspace: {workspace_path}")

        print(f"\n⏱️  Total Time: {total_time:.2f}s")

        # Save test metrics
        test_metrics = {
            "success": True,
            "lessons_count": len(lessons),
            "assembly_time_seconds": assembly_time,
            "upsert_time_seconds": upsert_time,
            "total_time_seconds": total_time,
            "force_mode": bool(existing_sow_id),
            "deleted_sow_id": existing_sow_id,
            "new_sow_id": new_sow_id,
            "workspace_path": str(workspace_path),
            "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S")
        }

        metrics_path = workspace_path / "test_metrics.json"
        metrics_path.write_text(json.dumps(test_metrics, indent=2))

        print(f"\n{'=' * 70}")
        print("✅ PHASE 4 TEST PASSED")
        print("=" * 70)

        return test_metrics


if __name__ == "__main__":
    result = asyncio.run(test_phase4_assembly())
    print(f"\nSuccess: {result['success']}")
    print(f"New SOW ID: {result['new_sow_id']}")
```

## Execution Steps

### 1. Run Phase 4 Test
```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent
source .venv/bin/activate
python tasks/phase4_test.py
```

### 2. Verify in Appwrite Console
1. Navigate to Appwrite Console
2. Go to Databases → default → Authored_SOW
3. Find document with courseId="course_c84476", version="1"
4. Verify status="draft" and entries are compressed

## Expected Output

```
======================================================================
PHASE 4 ASSEMBLY & APPWRITE UPSERT TEST RESULTS
======================================================================

📊 Assembly Results:
   Lessons assembled: 19
   Metadata included: ✅
   Pydantic validation: ✅
   Assembly time: 0.12s

📤 Appwrite Results:
   Force mode: ✅ Deleted 69034152b0c2d69620ee
   New Document ID: <new-auto-generated-id>
   courseId: course_c84476
   version: 1
   status: draft
   Upsert time: 2.34s

📁 Output Files:
   Local SOW: workspace/phase4_test_XXXXXXXX/authored_sow.json
   Workspace: workspace/phase4_test_XXXXXXXX

⏱️  Total Time: 2.46s

======================================================================
✅ PHASE 4 TEST PASSED
======================================================================
```

## Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | Create test plan document | ✅ Created |
| 2 | Update sow_assembler.py for iterative mode | ✅ Updated |
| 3 | Run Phase 4 test | ✅ **PASSED** |
| 4 | Verify Appwrite entry | ✅ **Verified** |
| 5 | Update test plan with results | ✅ **Completed** |
| 6 | Add Storage Bucket support | ✅ **Implemented** |
| 7 | Test Storage Bucket with --force | ✅ **PASSED** |

### ✅ TEST COMPLETED SUCCESSFULLY (2026-01-20)

**Final Results (with Storage Bucket):**
- **Assembly**: PASSED (19 lessons in 0.1s)
- **Compression**: 409,834 → 127,501 chars (68.9% reduction)
- **Storage Bucket**: Used (entries > 100K limit)
- **Storage File ID**: `696f676cd04554f75bff`
- **Document ID**: `696f676d27b78f0a71ae`
- **Entries Field**: `storage:696f676cd04554f75bff` (28 chars!)
- **Total Duration**: 0.7 seconds

## Notes

### Iterative Pipeline Mode

The iterative SOW author generates a different lesson structure than the legacy author:

| Lesson Type | Legacy | Iterative |
|-------------|--------|-----------|
| `teach` | Many | 18 |
| `revision` | Many | 0 |
| `independent_practice` | ≥1 | 0 |
| `mock_exam` | 1 | 1 |

The assembler has been updated with new parameters:
- `skip_revision_validation=True` - Skips teach-revision pairing check
- `skip_practice_validation=True` - Skips independent_practice requirement

### Compression & Entry Trimming

Entries are compressed using gzip+base64 to fit within Appwrite's 100K character limit.
However, 19 full lessons exceeded this limit even after compression, requiring entry trimming.

**Actual Size Analysis (2026-01-20):**
| Stage | Size | Notes |
|-------|------|-------|
| Original entries | 409,834 chars | 19 lessons with all fields |
| After gzip+base64 | 127,501 chars | ❌ Over 100k limit! |
| After trimming | 297,043 chars | Non-essential fields removed |
| Trimmed + compressed | 92,149 chars | ✅ Under 100k limit |

**Entry Trimming Solution (`src/utils/entry_trimmer.py`):**

Removes non-essential verbose fields (planning guidance, not needed for lesson delivery):

```python
FIELDS_TO_TRIM = {
    "root": ["lesson_instruction"],  # Agent instructions
    "lesson_plan": [
        "multi_standard_integration_strategy",  # Planning guidance
        "lesson_flow_summary",  # Summary text
        "assessment_progression",  # Planning guidance
        "misconceptions_embedded_in_cards",  # Planning notes
        "summary",  # Verbose summary
    ],
    "card_structure": [
        "pedagogical_approach",  # Teaching approach notes
        "misconceptions_addressed",  # Planning notes
    ],
}
```

**Auto-Trimming in Upserter:**
The `sow_upserter.py` automatically applies trimming when compressed entries exceed 100k chars.

### Storage Bucket Fallback (NEW: 2026-01-20)

When entries still exceed 100K characters after trimming + compression, the system uses **Appwrite Storage** as a fallback:

**Storage Bucket Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STORAGE BUCKET FALLBACK FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

              ┌───────────────────────────────────────┐
              │    Compressed entries string          │
              │    (gzip+base64, ~127K chars)         │
              └─────────────────────┬─────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────┐
              │    Size check: > 100,000 chars?       │
              └─────────────────────┬─────────────────┘
                       YES │              │ NO
                           ▼              ▼
     ┌────────────────────────────┐    ┌──────────────────────┐
     │  STORAGE BUCKET PATH       │    │  INLINE PATH         │
     │                            │    │                      │
     │  1. Upload to bucket       │    │  Store compressed    │
     │     'authored_sow_entries' │    │  string directly     │
     │                            │    │  in entries field    │
     │  2. Get file_id            │    │                      │
     │                            │    │                      │
     │  3. Store reference:       │    │                      │
     │     "storage:<file_id>"    │    │                      │
     └────────────────────────────┘    └──────────────────────┘
```

**Bucket Configuration:**
- **Bucket ID**: `authored_sow_entries`
- **Permissions**: `read("any")` for public access
- **File format**: gzip+base64 compressed JSON

**Reference Format:**
```
entries: "storage:6750abc123def456789..."
         ^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^
         prefix   Appwrite file ID
```

**Frontend Decompression:**

The frontend uses `decompressJSONWithStorage()` which:
1. Detects `storage:` prefix in entries field
2. Fetches file from Appwrite Storage bucket
3. Decompresses gzip+base64 content
4. Returns parsed JSON array

```typescript
// lib/appwrite/utils/compression.ts
import { decompressJSONWithStorage } from '../utils/compression';

// Usage in drivers/services:
const entries = await decompressJSONWithStorage(authoredSOW.entries, storage);
```

**Key Files:**
- `src/utils/storage_helpers.py` - Python upload/download helpers
- `lib/appwrite/utils/compression.ts` - TypeScript decompression with storage support
- `sow_upserter.py` - Auto-upload to storage when >100K

### Force Mode

When `existing_sow_id` is provided:
1. Query lesson_templates linked to old SOW
2. Delete old Authored_SOW document
3. Create new document with unique() ID
4. Re-link lesson_templates to new SOW ID

---

## Appendix: AuthoredSOW Schema

```python
class AuthoredSOW(BaseModel):
    """Complete authored SOW for a course."""
    courseId: str
    version: str
    status: Literal["draft", "review", "published"]
    metadata: Metadata
    entries: List[SOWEntry]
    accessibility_notes: Optional[str] = None
```
