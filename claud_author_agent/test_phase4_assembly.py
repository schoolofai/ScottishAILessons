#!/usr/bin/env python3
"""Phase 4 Assembly Test Script.

Combines Phase 2 lesson artifacts and Phase 3 metadata into AuthoredSOW,
validates using AuthoredSOWIterative model, and upserts to Appwrite.

Usage:
    python test_phase4_assembly.py --force
"""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.utils.sow_assembler import assemble_sow, generate_accessibility_summary
from src.utils.sow_upserter import upsert_sow_to_appwrite

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def run_phase4_test(force: bool = False):
    """Run Phase 4 assembly and Appwrite upsert test."""

    start_time = time.time()

    # ═══════════════════════════════════════════════════════════════
    # Configuration
    # ═══════════════════════════════════════════════════════════════

    courseId = "course_c84476"  # National 3 Application of Mathematics
    version = "2"  # New version for iterative pipeline

    phase2_workspace = Path(__file__).parent / "workspace/phase2_full_test_20260119_231045"
    phase3_workspace = Path(__file__).parent / "workspace/phase3_test_20260120_093014"
    phase4_workspace = Path(__file__).parent / "workspace" / f"phase4_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    phase4_workspace.mkdir(parents=True, exist_ok=True)

    logger.info("═" * 60)
    logger.info("PHASE 4 ASSEMBLY TEST")
    logger.info("═" * 60)
    logger.info(f"Course ID: {courseId}")
    logger.info(f"Version: {version}")
    logger.info(f"Phase 2 Workspace: {phase2_workspace}")
    logger.info(f"Phase 3 Workspace: {phase3_workspace}")
    logger.info(f"Phase 4 Workspace: {phase4_workspace}")
    logger.info(f"Force mode: {force}")
    logger.info("═" * 60)

    # ═══════════════════════════════════════════════════════════════
    # Step 1: Load Phase 2 lessons
    # ═══════════════════════════════════════════════════════════════

    logger.info("\n📚 Step 1: Loading Phase 2 lessons...")

    lessons = []
    # Only match lesson_01.json through lesson_99.json (exclude lesson_outline.json)
    lesson_files = sorted([
        f for f in phase2_workspace.glob("lesson_[0-9][0-9].json")
    ])

    for lesson_file in lesson_files:
        with open(lesson_file) as f:
            lesson_data = json.load(f)
            lessons.append(lesson_data)
            logger.info(f"  ✓ Loaded {lesson_file.name}: {lesson_data.get('title', 'N/A')}")

    logger.info(f"  Total lessons loaded: {len(lessons)}")

    # Analyze lesson types
    lesson_types = {}
    for lesson in lessons:
        lt = lesson.get("lesson_type", "unknown")
        lesson_types[lt] = lesson_types.get(lt, 0) + 1

    logger.info(f"  Lesson type distribution: {lesson_types}")

    # ═══════════════════════════════════════════════════════════════
    # Step 2: Load Phase 3 metadata
    # ═══════════════════════════════════════════════════════════════

    logger.info("\n📊 Step 2: Loading Phase 3 metadata...")

    metadata_file = phase3_workspace / "metadata.json"
    with open(metadata_file) as f:
        metadata = json.load(f)

    logger.info(f"  ✓ Loaded metadata: {len(metadata.get('policy_notes', []))} policy notes")
    logger.info(f"  ✓ {len(metadata.get('sequencing_notes', []))} sequencing notes")
    logger.info(f"  ✓ {len(metadata.get('accessibility_notes', []))} accessibility notes")
    logger.info(f"  ✓ {len(metadata.get('engagement_notes', []))} engagement notes")

    # ═══════════════════════════════════════════════════════════════
    # Step 3: Generate accessibility summary
    # ═══════════════════════════════════════════════════════════════

    logger.info("\n♿ Step 3: Generating accessibility summary...")

    accessibility_summary = generate_accessibility_summary(lessons)
    logger.info(f"  Summary: {accessibility_summary}")

    # ═══════════════════════════════════════════════════════════════
    # Step 4: Assemble SOW
    # ═══════════════════════════════════════════════════════════════

    logger.info("\n🔧 Step 4: Assembling SOW...")

    try:
        final_sow = assemble_sow(
            lessons=lessons,
            metadata=metadata,
            courseId=courseId,
            version=version,
            accessibility_notes_summary=accessibility_summary,
            skip_revision_validation=True,  # Iterative pipeline mode
            skip_practice_validation=True   # Iterative pipeline mode
        )

        logger.info("  ✅ SOW assembly PASSED")
        logger.info(f"  Entries: {len(final_sow.get('entries', []))}")
        logger.info(f"  Status: {final_sow.get('status')}")

        # Save assembled SOW
        sow_file = phase4_workspace / "assembled_sow.json"
        with open(sow_file, "w") as f:
            json.dump(final_sow, f, indent=2)
        logger.info(f"  ✓ Saved to {sow_file}")

    except Exception as e:
        logger.error(f"  ❌ SOW assembly FAILED: {e}")
        raise

    # ═══════════════════════════════════════════════════════════════
    # Step 5: Upsert to Appwrite
    # ═══════════════════════════════════════════════════════════════

    logger.info("\n📤 Step 5: Upserting to Appwrite...")

    # Query for existing SOW for this course (force mode will delete it)
    existing_sow_id = None
    if force:
        from src.utils.appwrite_mcp import list_appwrite_documents
        mcp_config_path_temp = str(Path(__file__).parent / ".mcp.json")
        try:
            existing_sows = await list_appwrite_documents(
                database_id="default",
                collection_id="Authored_SOW",
                queries=[f'equal("courseId", "{courseId}")'],
                mcp_config_path=mcp_config_path_temp
            )
            if existing_sows:
                existing_sow_id = existing_sows[0].get('$id')
                logger.info(f"  Found existing SOW: {existing_sow_id}")
            else:
                logger.info("  No existing SOW found for this course")
        except Exception as e:
            logger.warning(f"  Could not query existing SOWs: {e}")

    # MCP config path (relative to claud_author_agent)
    mcp_config_path = str(Path(__file__).parent / ".mcp.json")

    # Execution ID (timestamp)
    execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    try:
        document_id = await upsert_sow_to_appwrite(
            sow_file_path=str(sow_file),
            subject="application-of-mathematics",
            level="national-3",
            course_id=courseId,
            version=version,
            execution_id=execution_id,
            mcp_config_path=mcp_config_path,
            existing_sow_id=existing_sow_id,
            iterative_mode=True  # Skip AuthoredSOW validation (already validated with AuthoredSOWIterative)
        )

        logger.info(f"  ✅ Appwrite upsert PASSED")
        logger.info(f"  Document ID: {document_id}")

    except Exception as e:
        logger.error(f"  ❌ Appwrite upsert FAILED: {e}")
        raise

    # ═══════════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════════

    elapsed = time.time() - start_time

    logger.info("\n" + "═" * 60)
    logger.info("PHASE 4 TEST RESULTS")
    logger.info("═" * 60)
    logger.info(f"✅ Assembly: PASSED ({len(lessons)} lessons)")
    logger.info(f"✅ Appwrite: PASSED (ID: {document_id})")
    logger.info(f"⏱️  Duration: {elapsed:.1f} seconds")
    logger.info("═" * 60)

    # Save test metrics
    metrics = {
        "phase": "4-assembly",
        "courseId": courseId,
        "version": version,
        "lessons_count": len(lessons),
        "lesson_types": lesson_types,
        "document_id": document_id,
        "duration_seconds": elapsed,
        "force_mode": force,
        "status": "PASSED"
    }

    metrics_file = phase4_workspace / "test_metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"\n📁 Test artifacts saved to: {phase4_workspace}")

    return metrics


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Phase 4 Assembly Test")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force delete existing Authored_SOW before creating new one"
    )

    args = parser.parse_args()

    asyncio.run(run_phase4_test(force=args.force))
