#!/usr/bin/env python3
"""Quick standalone retry script for lesson template upload.

This script directly calls the lesson upserter without going through
the full import chain that may have circular dependencies.

Usage:
    python quick_retry_lesson.py
"""

import asyncio
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))


async def main():
    """Retry lesson template upload for workspace 20251030_111447."""

    # Configuration (hardcoded for this specific retry)
    workspace_path = "workspace/20251030_111447"
    courseId = "course_c84475"
    order = 12
    execution_id = "20251030_111447"
    mcp_config_path = ".mcp.json"

    print("🔄 Retrying Lesson Template Upload")
    print("=" * 70)
    print(f"Workspace:    {workspace_path}")
    print(f"Course ID:    {courseId}")
    print(f"Order:        {order}")
    print(f"Execution ID: {execution_id}")
    print("=" * 70)
    print()

    # Validate workspace exists
    workspace = Path(workspace_path)
    if not workspace.exists():
        print(f"❌ ERROR: Workspace not found: {workspace_path}")
        sys.exit(1)

    lesson_template_path = workspace / "lesson_template.json"
    if not lesson_template_path.exists():
        print(f"❌ ERROR: lesson_template.json not found: {lesson_template_path}")
        sys.exit(1)

    # Load lesson template to show details
    try:
        with open(lesson_template_path) as f:
            template = json.load(f)

        print(f"📄 Lesson Template Found")
        print(f"   Title: {template.get('title', 'N/A')}")
        print(f"   Type: {template.get('lesson_type', 'N/A')}")
        print(f"   Duration: {template.get('estMinutes', 'N/A')} minutes")
        print(f"   Cards: {len(template.get('cards', []))}")
        print()
    except Exception as e:
        print(f"⚠️  WARNING: Could not parse lesson_template.json: {e}")
        print()

    # Import and call the upserter
    try:
        from utils.lesson_upserter import upsert_lesson_template
        from utils.logging_config import setup_logging

        setup_logging(log_level="INFO")

        print("🚀 Starting upload to Appwrite...")
        print()

        document_id = await upsert_lesson_template(
            lesson_template_path=str(lesson_template_path),
            courseId=courseId,
            order=order,
            execution_id=execution_id,
            mcp_config_path=mcp_config_path
        )

        print()
        print("=" * 70)
        print("✅ SUCCESS!")
        print("=" * 70)
        print(f"Document ID: {document_id}")
        print(f"Collection:  default.lesson_templates")
        print(f"Query:       courseId=\"{courseId}\" AND sow_order={order}")
        print()
        print("You can verify in Appwrite Console:")
        print(f"  Database: default")
        print(f"  Collection: lesson_templates")
        print(f"  Filter: courseId = \"{courseId}\" AND sow_order = {order}")
        print()

    except ImportError as e:
        print(f"❌ ERROR: Import failed: {e}")
        print()
        print("This usually means the virtual environment is not activated.")
        print("Try running:")
        print("  source .venv/bin/activate")
        print("  python quick_retry_lesson.py")
        sys.exit(1)

    except Exception as e:
        print()
        print("=" * 70)
        print("❌ UPLOAD FAILED")
        print("=" * 70)
        print(f"Error: {e}")
        print()

        # Provide helpful error messages based on error type
        error_str = str(e).lower()

        if "estminutes" in error_str:
            print("📋 Diagnosis: estMinutes validation error")
            print()
            print("This error should be fixed by the recent schema updates.")
            print("If you're still seeing this, it may mean:")
            print("  - Appwrite database has not been updated")
            print("  - Frontend validation is running before database validation")
            print()

        elif "card" in error_str and "size" in error_str:
            print("📋 Diagnosis: Cards field size limit exceeded")
            print()
            print("The lesson has too many/large cards for the database field.")
            print("Solutions:")
            print("  1. Increase cards field size in Appwrite Console")
            print("  2. Or: Use compression (already implemented)")
            print()

        elif "permission" in error_str or "401" in error_str or "403" in error_str:
            print("📋 Diagnosis: Authentication/Permission error")
            print()
            print("Check:")
            print("  - .mcp.json has valid Appwrite API key")
            print("  - API key has write permissions to lesson_templates collection")
            print()

        else:
            print("📋 Generic troubleshooting:")
            print("  - Check network connection")
            print("  - Verify Appwrite service is accessible")
            print("  - Check .mcp.json configuration")
            print()

        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
