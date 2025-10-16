#!/usr/bin/env python3
"""List all courses in default.courses to find the correct courseId."""

import asyncio
import sys
sys.path.insert(0, "src")

from utils.appwrite_mcp import list_appwrite_documents


async def main():
    """List all courses."""
    print("Listing all courses in default.courses...")
    print()

    try:
        docs = await list_appwrite_documents(
            database_id="default",
            collection_id="courses",
            mcp_config_path=".mcp.json"
        )

        if not docs:
            print("No courses found!")
            return

        print(f"Found {len(docs)} course(s):\n")

        for doc in docs:
            print(f"Course ID: {doc.get('$id', 'N/A')}")
            print(f"  Subject: {doc.get('subject', 'N/A')}")
            print(f"  Level:   {doc.get('level', 'N/A')}")
            print()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
