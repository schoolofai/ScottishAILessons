#!/usr/bin/env python3
"""Debug script to query lesson_templates directly."""

import asyncio
from src.utils.appwrite_mcp import list_appwrite_documents


async def main():
    courseId = "course_c84474"

    print(f"\n=== Querying ALL lessons for {courseId} ===\n")

    # Query all lessons for this course (no model_version filter)
    all_lessons = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=[f'equal("courseId", "{courseId}")'],
        mcp_config_path=".mcp.json"
    )

    print(f"Total lessons found: {len(all_lessons)}\n")

    for lesson in all_lessons:
        doc_id = lesson.get('$id', 'N/A')
        sow_order = lesson.get('sow_order', 'N/A')
        model_version = lesson.get('model_version', 'N/A')

        print(f"Doc ID: {doc_id}")
        print(f"  sow_order: {sow_order}")
        print(f"  model_version: {model_version}")
        print()

    print("\n=== Now querying ONLY claud_Agent_sdk lessons ===\n")

    sdk_lessons = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=[
            f'equal("courseId", "{courseId}")',
            'equal("model_version", "claud_Agent_sdk")'
        ],
        mcp_config_path=".mcp.json"
    )

    print(f"Total claud_Agent_sdk lessons found: {len(sdk_lessons)}\n")

    for lesson in sdk_lessons:
        doc_id = lesson.get('$id', 'N/A')
        sow_order = lesson.get('sow_order', 'N/A')
        model_version = lesson.get('model_version', 'N/A')

        print(f"Doc ID: {doc_id}")
        print(f"  sow_order: {sow_order}")
        print(f"  model_version: {model_version}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
