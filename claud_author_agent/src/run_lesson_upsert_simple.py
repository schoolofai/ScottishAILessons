#!/usr/bin/env python3
"""Script to manually run lesson template upsert for failed lesson (order=30)."""

import asyncio
import json
import sys
from pathlib import Path

from utils.lesson_upserter import upsert_lesson_template


async def main():
    """Run upsert for failed lesson template."""
    workspace_path = Path("/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent/workspace/20251102_130827")
    lesson_template_path = workspace_path / "lesson_template.json"

    print(f"Loading lesson template from: {lesson_template_path}")

    # Load lesson template
    with open(lesson_template_path, 'r') as f:
        lesson_template = json.load(f)

    print(f"Lesson: {lesson_template.get('title')}")
    print(f"Order: {lesson_template.get('sow_order')}")
    print(f"Course ID: {lesson_template.get('courseId')}")
    print(f"Est Minutes: {lesson_template.get('estMinutes')} (will be kept as-is)")
    print(f"Number of cards: {len(lesson_template.get('cards', []))}")

    # Get MCP config path
    mcp_config_path = Path(__file__).parent.parent / ".mcp_config.json"

    print(f"\nStarting upsert with MCP config: {mcp_config_path}")

    # Run upsert
    try:
        doc_id = await upsert_lesson_template(
            lesson_template=lesson_template,
            course_id=lesson_template['courseId'],
            sow_order=lesson_template['sow_order'],
            mcp_config_path=str(mcp_config_path),
            authored_sow_id="6905e0493c88e2dca149",  # From error log
            authored_sow_version="1"  # From error log
        )

        print(f"\n✅ SUCCESS! Lesson template upserted with document ID: {doc_id}")

    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
