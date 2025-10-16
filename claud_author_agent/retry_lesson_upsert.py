#!/usr/bin/env python3
"""Retry Lesson Template upsert script - reuses existing upsert logic for failed uploads.

Usage:
    python retry_lesson_upsert.py --workspace <path> --input <input.json>

Example:
    python retry_lesson_upsert.py \\
        --workspace workspace/20251016_173424 \\
        --input lesson_input.json

Input JSON format:
    {
        "courseId": "course_c84474",
        "order": 1
    }

This script is useful when:
- Agent successfully authored lesson template but upsert failed (schema issues, connection, etc.)
- You fixed the database schema (e.g., increased cards field size limit)
- You want to re-upload a previously generated lesson template
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add src to path so we can import utils
sys.path.insert(0, str(Path(__file__).parent / "src"))

from utils.lesson_upserter import upsert_lesson_template
from utils.logging_config import setup_logging


def load_input_from_json(json_path: str) -> dict:
    """Load input parameters from JSON file.

    Expected JSON format:
    {
        "courseId": "course_c84874",
        "order": 1
    }

    Args:
        json_path: Path to JSON input file

    Returns:
        Dictionary with courseId and order

    Raises:
        FileNotFoundError: If JSON file not found
        ValueError: If JSON is invalid or missing required fields
    """
    json_file = Path(json_path)

    if not json_file.exists():
        raise FileNotFoundError(f"Input JSON file not found: {json_path}")

    try:
        with open(json_file) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in input file: {e}")

    # Validate required fields
    required_fields = ["courseId", "order"]
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValueError(
            f"Missing required fields in JSON input: {', '.join(missing_fields)}. "
            f"Expected: {', '.join(required_fields)}"
        )

    # Validate order type
    if not isinstance(data["order"], int):
        raise ValueError(f"'order' must be an integer, got: {type(data['order']).__name__}")

    # Validate order value (1-indexed)
    if data["order"] < 1:
        raise ValueError(f"'order' must be >= 1 (1-indexed), got: {data['order']}")

    return {
        "courseId": data["courseId"],
        "order": data["order"]
    }


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Retry Lesson Template Upsert - Reuse existing lesson template for database upload",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Using JSON input file
  python retry_lesson_upsert.py --workspace workspace/20251016_173424 --input lesson_input.json

  # With custom MCP config
  python retry_lesson_upsert.py \\
    --workspace workspace/20251016_173424 \\
    --input lesson_input.json \\
    --mcp-config custom.mcp.json
        """
    )

    parser.add_argument(
        '--workspace',
        type=str,
        required=True,
        metavar='PATH',
        help='Path to workspace folder containing lesson_template.json'
    )
    parser.add_argument(
        '--input',
        type=str,
        required=True,
        metavar='JSON_FILE',
        help='Path to JSON file containing courseId and order'
    )
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        metavar='PATH',
        help='Path to MCP configuration file (default: .mcp.json)'
    )

    return parser.parse_args()


async def main():
    """Retry upsert for a completed lesson authoring workspace."""

    try:
        args = parse_arguments()

        # Load input parameters from JSON
        params = load_input_from_json(args.input)
        workspace_path = args.workspace
        courseId = params["courseId"]
        order = params["order"]

        # Setup logging
        setup_logging(log_level="INFO")

        # Validate workspace path
        workspace = Path(workspace_path)
        if not workspace.exists():
            print(f"❌ ERROR: Workspace path does not exist: {workspace_path}")
            sys.exit(1)

        if not workspace.is_dir():
            print(f"❌ ERROR: Workspace path is not a directory: {workspace_path}")
            sys.exit(1)

        # Check for lesson_template.json
        lesson_template_file = workspace / "lesson_template.json"
        if not lesson_template_file.exists():
            print(f"❌ ERROR: lesson_template.json not found in workspace: {lesson_template_file}")
            print()
            print("Expected file location:")
            print(f"    {lesson_template_file}")
            print()
            print("Make sure the agent completed successfully before retrying upsert.")
            sys.exit(1)

        # Derive execution_id from workspace folder name
        execution_id = workspace.name

        # Load lesson template to show title
        try:
            with open(lesson_template_file) as f:
                lesson_template = json.load(f)
                lesson_title = lesson_template.get("metadata", {}).get("label", "N/A")
        except Exception:
            lesson_title = "N/A"

        print("🔄 Retrying Lesson Template upsert to Appwrite")
        print("=" * 60)
        print(f"Workspace:      {workspace_path}")
        print(f"Template File:  {lesson_template_file}")
        print(f"Lesson Title:   {lesson_title}")
        print(f"Course ID:      {courseId}")
        print(f"SOW Order:      {order}")
        print(f"Execution ID:   {execution_id}")
        print(f"MCP Config:     {args.mcp_config}")
        print("=" * 60)
        print()

        # Confirm with user
        print("⚠️  This will create/update a document in default.lesson_templates collection.")
        response = input("Continue? (yes/no): ")
        if response.lower() not in ["yes", "y"]:
            print("❌ Aborted by user")
            sys.exit(0)

        print()

        # Call the upsert function
        try:
            document_id = await upsert_lesson_template(
                lesson_template_path=str(lesson_template_file),
                courseId=courseId,
                order=order,
                execution_id=execution_id,
                mcp_config_path=args.mcp_config
            )

            print()
            print("=" * 60)
            print("✅ SUCCESS: Lesson template upserted to Appwrite")
            print("=" * 60)
            print(f"Document ID:  {document_id}")
            print(f"Collection:   default.lesson_templates")
            print(f"Lesson:       {lesson_title}")
            print()

        except Exception as e:
            print()
            print("=" * 60)
            print("❌ FAILED: Upsert failed")
            print("=" * 60)
            print(f"Error: {e}")
            print()
            print("Possible causes:")
            print("  - Database schema mismatch (e.g., cards field size limit too small)")
            print("  - Network connection issues")
            print("  - Invalid courseId or order")
            print("  - Permission errors")
            print()
            print("If error mentions 'cards' field size:")
            print("  - Check Appwrite Console → default.lesson_templates → cards attribute")
            print("  - Ensure size limit is at least 90000 characters")
            print()
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
