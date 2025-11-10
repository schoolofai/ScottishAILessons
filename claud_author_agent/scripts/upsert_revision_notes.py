#!/usr/bin/env python3
"""
Standalone script to upsert revision notes from a completed workspace to Appwrite.

This script takes an existing workspace directory containing generated revision notes
and uploads them to Appwrite storage and database without regenerating content.

Usage:
    # Basic upsert (create-only, fails if documents already exist)
    python scripts/upsert_revision_notes.py \
        --workspace-path workspace/20251110_060554

    # Force mode (overwrites existing documents)
    python scripts/upsert_revision_notes.py \
        --workspace-path workspace/20251110_060554 \
        --force

    # Custom MCP config location
    python scripts/upsert_revision_notes.py \
        --workspace-path workspace/20251110_060554 \
        --mcp-config /path/to/.mcp.json

Requirements:
    - Workspace must contain inputs/Authored_SOW.json
    - Workspace must contain outputs/course_cheat_sheet.md
    - Workspace must contain outputs/lesson_notes_NN.md for each lesson in SOW
    - .mcp.json must be configured with Appwrite credentials
"""

import asyncio
import argparse
from pathlib import Path
import json
import sys
from datetime import datetime

# Add parent directory to path for imports (matches notes_author_cli.py pattern)
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.notes_storage_upserter import upsert_all_revision_notes
from src.utils.notes_validators import validate_output_files


def extract_metadata_from_workspace(workspace_path: Path) -> dict:
    """
    Extract metadata from workspace structure for upsert operation.

    Args:
        workspace_path: Path to workspace directory

    Returns:
        Dictionary with extracted metadata:
        - execution_id: Timestamp from directory name
        - course_id: From Authored_SOW.json
        - version: From Authored_SOW.json
        - lesson_count: Number of lessons in SOW
        - sow_version: From Authored_SOW.json

    Raises:
        FileNotFoundError: If required files missing
        json.JSONDecodeError: If SOW.json invalid
        KeyError: If required fields missing from SOW
    """
    # Extract execution_id from directory name (timestamp)
    execution_id = workspace_path.name
    print(f"📋 Execution ID: {execution_id}")

    # Read Authored_SOW.json for course metadata
    sow_path = workspace_path / "inputs" / "Authored_SOW.json"
    if not sow_path.exists():
        raise FileNotFoundError(
            f"Authored_SOW.json not found at {sow_path}\n"
            f"Expected workspace structure:\n"
            f"  {workspace_path}/\n"
            f"    ├── inputs/\n"
            f"    │   └── Authored_SOW.json\n"
            f"    └── outputs/\n"
            f"        ├── course_cheat_sheet.md\n"
            f"        └── lesson_notes_*.md"
        )

    sow_data = json.loads(sow_path.read_text())

    # Extract required fields
    course_id = sow_data["courseId"]
    version = sow_data.get("version", "1")
    sow_version = sow_data.get("version", "1")
    lesson_count = len(sow_data["entries"])

    print(f"📚 Course ID: {course_id}")
    print(f"📝 Version: {version}")
    print(f"🎯 Lesson Count: {lesson_count}")

    return {
        "execution_id": execution_id,
        "course_id": course_id,
        "version": version,
        "lesson_count": lesson_count,
        "sow_version": sow_version
    }


async def upsert_workspace(
    workspace_path: Path,
    force: bool = False,
    mcp_config_path: str = ".mcp.json"
) -> dict:
    """
    Upsert revision notes from workspace to Appwrite.

    Args:
        workspace_path: Path to workspace directory
        force: If True, overwrite existing documents
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary with upsert results:
        - cheat_sheet: {document_id, file_id}
        - lesson_notes: [{document_id, file_id, lesson_order}, ...]

    Raises:
        FileNotFoundError: If workspace structure invalid
        ValidationError: If output files missing or invalid
        Exception: If upsert operations fail
    """
    print(f"\n{'='*60}")
    print(f"🚀 Starting Upsert Operation")
    print(f"{'='*60}\n")

    # Extract metadata from workspace
    print("📊 Extracting Metadata...")
    metadata = extract_metadata_from_workspace(workspace_path)

    # Validate workspace structure and output files
    print(f"\n✅ Validating Workspace Structure...")
    validate_output_files(workspace_path, metadata["lesson_count"])
    print(f"   ✓ All {metadata['lesson_count']} lesson notes found")
    print(f"   ✓ Cheat sheet found")

    # Perform upsert operation
    print(f"\n📤 Uploading to Appwrite...")
    print(f"   Database: revision_notes")
    print(f"   Storage: documents")
    print(f"   Mode: {'FORCE (overwrite)' if force else 'CREATE (new only)'}")

    results = await upsert_all_revision_notes(
        outputs_dir=workspace_path / "outputs",
        course_id=metadata["course_id"],
        lesson_count=metadata["lesson_count"],
        version=metadata["version"],
        sow_version=metadata["sow_version"],
        execution_id=metadata["execution_id"],
        workspace_path=str(workspace_path),
        mcp_config_path=mcp_config_path,
        force=force
    )

    return results


def print_results(results: dict, lesson_count: int) -> None:
    """
    Print formatted upsert results.

    Args:
        results: Upsert results dictionary
        lesson_count: Expected number of lessons
    """
    print(f"\n{'='*60}")
    print(f"✅ Upsert Complete!")
    print(f"{'='*60}\n")

    # Cheat sheet
    cheat_sheet = results.get("cheat_sheet", {})
    print(f"📄 Cheat Sheet:")
    print(f"   Document ID: {cheat_sheet.get('document_id', 'N/A')}")
    print(f"   File ID: {cheat_sheet.get('file_id', 'N/A')}")

    # Lesson notes
    lesson_notes = results.get("lesson_notes", [])
    print(f"\n📚 Lesson Notes:")
    print(f"   Uploaded: {len(lesson_notes)}/{lesson_count}")

    # Show first 3 and last 3 if many lessons
    if len(lesson_notes) > 6:
        print(f"\n   First 3 lessons:")
        for note in lesson_notes[:3]:
            print(f"      Lesson {note['lesson_order']:02d}: {note['document_id']}")
        print(f"   ...")
        print(f"   Last 3 lessons:")
        for note in lesson_notes[-3:]:
            print(f"      Lesson {note['lesson_order']:02d}: {note['document_id']}")
    else:
        for note in lesson_notes:
            print(f"      Lesson {note['lesson_order']:02d}: {note['document_id']}")

    print(f"\n{'='*60}\n")


def main():
    """
    Main entry point for standalone upsert script.
    """
    parser = argparse.ArgumentParser(
        description="Upsert revision notes from workspace to Appwrite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic upsert (create mode)
  python scripts/upsert_revision_notes.py --workspace-path workspace/20251110_060554

  # Force overwrite existing documents
  python scripts/upsert_revision_notes.py --workspace-path workspace/20251110_060554 --force

  # Custom MCP config
  python scripts/upsert_revision_notes.py --workspace-path workspace/20251110_060554 --mcp-config /path/to/.mcp.json
        """
    )

    parser.add_argument(
        "--workspace-path",
        required=True,
        help="Path to workspace directory containing inputs/ and outputs/ folders"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing documents (default: create new only)"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP config file (default: .mcp.json)"
    )

    args = parser.parse_args()

    # Validate workspace path exists
    workspace_path = Path(args.workspace_path)
    if not workspace_path.exists():
        print(f"❌ Error: Workspace path does not exist: {workspace_path}")
        sys.exit(1)

    if not workspace_path.is_dir():
        print(f"❌ Error: Workspace path is not a directory: {workspace_path}")
        sys.exit(1)

    # Validate MCP config exists
    mcp_config_path = Path(args.mcp_config)
    if not mcp_config_path.exists():
        print(f"❌ Error: MCP config not found: {mcp_config_path}")
        print(f"   Please ensure .mcp.json is configured with Appwrite credentials")
        sys.exit(1)

    try:
        # Run upsert operation
        results = asyncio.run(upsert_workspace(
            workspace_path=workspace_path,
            force=args.force,
            mcp_config_path=str(mcp_config_path)
        ))

        # Extract lesson count for result printing
        metadata = extract_metadata_from_workspace(workspace_path)

        # Print formatted results
        print_results(results, metadata["lesson_count"])

        print("✅ All operations completed successfully!")
        sys.exit(0)

    except FileNotFoundError as e:
        print(f"\n❌ Error: Missing required files")
        print(f"   {e}")
        sys.exit(1)

    except json.JSONDecodeError as e:
        print(f"\n❌ Error: Invalid JSON in SOW file")
        print(f"   {e}")
        sys.exit(1)

    except KeyError as e:
        print(f"\n❌ Error: Missing required field in SOW")
        print(f"   {e}")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ Error: Upsert operation failed")
        print(f"   {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
