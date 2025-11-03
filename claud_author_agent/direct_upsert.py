#!/usr/bin/env python3
"""Direct upsert script that bypasses import issues."""

import asyncio
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Import with correct module path
from src.utils.sow_upserter import upsert_sow_to_appwrite


async def main():
    workspace_path = Path("workspace/20251029_223001")  # Updated workspace
    sow_file = workspace_path / "authored_sow.json"

    # Load SOW (agent doesn't output courseId, we provide it)
    with open(sow_file) as f:
        sow_data = json.load(f)

    course_id = "course_c84476"  # Higher Applications of Mathematics
    subject = "applications-of-mathematics"
    level = "higher"  # Updated level
    execution_id = workspace_path.name

    print(f"🔄 Retrying upsert...")
    print(f"   SOW file: {sow_file}")
    print(f"   Course ID: {course_id}")
    print(f"   Subject: {subject}")
    print(f"   Level: {level}")
    print()

    try:
        mcp_config_path = Path(__file__).parent / ".mcp.json"

        document_id = await upsert_sow_to_appwrite(
            sow_file_path=str(sow_file),
            subject=subject,
            level=level,
            course_id=course_id,
            execution_id=execution_id,
            mcp_config_path=str(mcp_config_path)
        )

        print()
        print("=" * 60)
        print("✅ SUCCESS! SOW uploaded to Appwrite")
        print(f"📄 Document ID: {document_id}")
        print("=" * 60)

    except Exception as e:
        print()
        print("=" * 60)
        print(f"❌ UPSERT FAILED: {e}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
