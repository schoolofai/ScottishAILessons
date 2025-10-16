#!/usr/bin/env python3
"""Retry SOW upsert script - reuses existing upsert logic for failed uploads.

Usage:
    python retry_upsert.py --workspace <path> --input <input.json>

Example:
    python retry_upsert.py \\
        --workspace workspace/20251016_135240 \\
        --input input.json

Input JSON format (same as main CLI):
    {
        "subject": "application-of-mathematics",
        "level": "national-4",
        "courseId": "course_c84474"
    }

This script is useful when:
- Agent successfully authored SOW but upsert failed (schema issues, connection, etc.)
- You fixed the database schema and want to retry the upsert
- You want to re-upload a previously generated SOW
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add src to path so we can import utils
sys.path.insert(0, str(Path(__file__).parent / "src"))

from utils.sow_upserter import upsert_sow_to_appwrite
from utils.logging_config import setup_logging


def load_input_from_json(json_path: str) -> dict:
    """Load input parameters from JSON file.

    Expected JSON format:
    {
        "subject": "mathematics",
        "level": "national-5",
        "courseId": "course_c84874"
    }

    Args:
        json_path: Path to JSON input file

    Returns:
        Dictionary with subject, level, courseId

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
    required_fields = ["subject", "level", "courseId"]
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValueError(
            f"Missing required fields in JSON input: {', '.join(missing_fields)}. "
            f"Expected: {', '.join(required_fields)}"
        )

    return {
        "subject": data["subject"],
        "level": data["level"],
        "courseId": data["courseId"]
    }


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Retry SOW Upsert - Reuse existing SOW for database upload",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Using JSON input file
  python retry_upsert.py --workspace workspace/20251016_135240 --input input.json

  # With custom MCP config
  python retry_upsert.py \\
    --workspace workspace/20251016_135240 \\
    --input input.json \\
    --mcp-config custom.mcp.json
        """
    )

    parser.add_argument(
        '--workspace',
        type=str,
        required=True,
        metavar='PATH',
        help='Path to workspace folder containing authored_sow.json'
    )
    parser.add_argument(
        '--input',
        type=str,
        required=True,
        metavar='JSON_FILE',
        help='Path to JSON file containing subject, level, and courseId'
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
    """Retry upsert for a completed SOW authoring workspace."""

    try:
        args = parse_arguments()

        # Load input parameters from JSON
        params = load_input_from_json(args.input)
        workspace_path = args.workspace
        subject = params["subject"]
        level = params["level"]
        courseId = params["courseId"]

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

        # Check for authored_sow.json
        sow_file = workspace / "authored_sow.json"
        if not sow_file.exists():
            print(f"❌ ERROR: authored_sow.json not found in workspace: {sow_file}")
            print()
            print("Expected file location:")
            print(f"    {sow_file}")
            print()
            print("Make sure the agent completed successfully before retrying upsert.")
            sys.exit(1)

        # Derive execution_id from workspace folder name
        execution_id = workspace.name

        print("🔄 Retrying SOW upsert to Appwrite")
        print("=" * 60)
        print(f"Workspace:    {workspace_path}")
        print(f"SOW File:     {sow_file}")
        print(f"Subject:      {subject}")
        print(f"Level:        {level}")
        print(f"Course ID:    {courseId}")
        print(f"Execution ID: {execution_id}")
        print(f"MCP Config:   {args.mcp_config}")
        print("=" * 60)
        print()

        # Confirm with user
        print("⚠️  This will create/update a document in default.Authored_SOW collection.")
        response = input("Continue? (yes/no): ")
        if response.lower() not in ["yes", "y"]:
            print("❌ Aborted by user")
            sys.exit(0)

        print()

        # Call the upsert function
        try:
            document_id = await upsert_sow_to_appwrite(
                sow_file_path=str(sow_file),
                subject=subject,
                level=level,
                course_id=courseId,
                execution_id=execution_id,
                mcp_config_path=args.mcp_config
            )

            print()
            print("=" * 60)
            print("✅ SUCCESS: SOW upserted to Appwrite")
            print("=" * 60)
            print(f"Document ID: {document_id}")
            print(f"Collection:  default.Authored_SOW")
            print()

        except Exception as e:
            print()
            print("=" * 60)
            print("❌ FAILED: Upsert failed")
            print("=" * 60)
            print(f"Error: {e}")
            print()
            print("Possible causes:")
            print("  - Database schema mismatch (e.g., field size limits)")
            print("  - Network connection issues")
            print("  - Invalid courseId")
            print("  - Permission errors")
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
