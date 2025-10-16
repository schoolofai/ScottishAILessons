#!/usr/bin/env python3
"""List all available subject/level combinations."""

import asyncio
import sys
sys.path.insert(0, "src")

from utils.appwrite_mcp import list_appwrite_documents


async def main():
    """List all subject/level combinations."""
    print("Listing all subject/level combinations in sqa_current...")

    try:
        docs = await list_appwrite_documents(
            database_id="sqa_education",
            collection_id="sqa_current",
            mcp_config_path=".mcp.json"
        )

        if not docs:
            print("No documents found!")
            return

        print(f"\nFound {len(docs)} total document(s)\n")

        # Collect unique combinations
        combinations = set()
        for doc in docs:
            subject = doc.get('subject', 'N/A')
            level = doc.get('level', 'N/A')
            combinations.add((subject, level))

        # Sort and display
        for subject, level in sorted(combinations):
            print(f"  - subject: {subject}")
            print(f"    level: {level}")
            print()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
