#!/usr/bin/env python3
"""Run mock exam upsert from an existing workspace.

This script runs Steps 4-5 of the mock exam pipeline on an existing workspace:
- Step 4: Auto-correction and validation
- Step 5: Upsert to Appwrite (database persistence)

Useful for:
- Re-running upsert after fixing issues
- Running upsert after dry-run to persist to database
- Debugging upsert without re-running full pipeline

Usage:
    cd claud_author_agent
    source .venv/bin/activate

    # From workspace path (uses courseId from mock_exam.json)
    python scripts/upsert_mock_exam_from_workspace.py \\
        --workspace workspace/20251209_173055_sectioned

    # With explicit courseId (overrides)
    python scripts/upsert_mock_exam_from_workspace.py \\
        --workspace workspace/20251209_173055_sectioned \\
        --course course_c74774

    # With force mode (delete existing and recreate)
    python scripts/upsert_mock_exam_from_workspace.py \\
        --workspace workspace/20251209_173055_sectioned \\
        --force
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()


def setup_logging(log_level: str = "INFO") -> None:
    """Configure logging."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


async def run_upsert_from_workspace(
    workspace_path: str,
    course_id: str | None = None,
    version: str = "1",
    force: bool = False
) -> dict:
    """Run upsert from existing workspace.

    Args:
        workspace_path: Path to workspace directory containing mock_exam.json
        course_id: Course ID (optional, extracted from mock_exam.json if not provided)
        version: Mock exam version (default "1")
        force: If True, delete existing mock exam before upserting

    Returns:
        dict with upsert results including document_id
    """
    from src.utils.mock_exam_upserter import upsert_mock_exam_to_appwrite

    logger = logging.getLogger(__name__)
    workspace = Path(workspace_path)

    # Validate workspace exists
    if not workspace.exists():
        raise FileNotFoundError(f"Workspace not found: {workspace_path}")

    # Find mock_exam.json
    mock_exam_path = workspace / "mock_exam.json"
    if not mock_exam_path.exists():
        raise FileNotFoundError(
            f"mock_exam.json not found in workspace. "
            f"Expected at: {mock_exam_path}"
        )

    logger.info("=" * 60)
    logger.info("MOCK EXAM UPSERT FROM WORKSPACE")
    logger.info("=" * 60)
    logger.info(f"Workspace: {workspace}")
    logger.info(f"Mock exam file: {mock_exam_path}")

    # Extract courseId from mock_exam.json if not provided
    with open(mock_exam_path) as f:
        mock_exam_data = json.load(f)

    extracted_course_id = mock_exam_data.get("courseId", "")
    if course_id:
        logger.info(f"Using provided courseId: {course_id}")
    elif extracted_course_id:
        course_id = extracted_course_id
        logger.info(f"Using courseId from mock_exam.json: {course_id}")
    else:
        raise ValueError(
            "courseId not found in mock_exam.json and not provided via --course"
        )

    logger.info(f"Version: {version}")
    logger.info(f"Force mode: {'YES (will delete existing)' if force else 'NO'}")
    logger.info("=" * 60)

    # Run upsert
    try:
        doc_id = await upsert_mock_exam_to_appwrite(
            mock_exam_file_path=str(mock_exam_path),
            courseId=course_id,
            version=version,
            mcp_config_path=".mcp.json",
            force=force
        )

        logger.info("")
        logger.info("=" * 60)
        logger.info("UPSERT COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Document ID: {doc_id}")
        logger.info(f"Course ID: {course_id}")
        logger.info(f"Version: {version}")
        logger.info("=" * 60)

        return {
            "success": True,
            "document_id": doc_id,
            "course_id": course_id,
            "version": version,
            "workspace": str(workspace)
        }

    except Exception as e:
        logger.error(f"Upsert failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "course_id": course_id,
            "version": version,
            "workspace": str(workspace)
        }


def main():
    parser = argparse.ArgumentParser(
        description="Run mock exam upsert from existing workspace",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Basic upsert from workspace
    python scripts/upsert_mock_exam_from_workspace.py \\
        --workspace workspace/20251209_173055_sectioned

    # With force mode to overwrite existing
    python scripts/upsert_mock_exam_from_workspace.py \\
        --workspace workspace/20251209_173055_sectioned --force

    # With explicit courseId
    python scripts/upsert_mock_exam_from_workspace.py \\
        --workspace workspace/20251209_173055_sectioned \\
        --course course_c74774
"""
    )

    parser.add_argument(
        "--workspace",
        required=True,
        help="Path to workspace directory containing mock_exam.json"
    )
    parser.add_argument(
        "--course",
        dest="course_id",
        help="Course ID (optional, extracted from mock_exam.json if not provided)"
    )
    parser.add_argument(
        "--version",
        default="1",
        help="Mock exam version (default: 1)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing mock exam before upserting"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()

    setup_logging(args.log_level)

    result = asyncio.run(run_upsert_from_workspace(
        workspace_path=args.workspace,
        course_id=args.course_id,
        version=args.version,
        force=args.force
    ))

    if result["success"]:
        print(f"\n✅ Mock exam upserted successfully!")
        print(f"   Document ID: {result['document_id']}")
        return 0
    else:
        print(f"\n❌ Upsert failed: {result['error']}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
