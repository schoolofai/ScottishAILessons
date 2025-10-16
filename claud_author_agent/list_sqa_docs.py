#!/usr/bin/env python3
"""List SQA documents to see what subject/level values exist."""

import asyncio
import sys
sys.path.insert(0, "src")

from utils.appwrite_mcp import list_appwrite_documents


async def main():
    """List SQA documents."""
    print("Listing documents in sqa_education.sqa_current...")
    print()

    try:
        docs = await list_appwrite_documents(
            database_id="sqa_education",
            collection_id="sqa_current",
            mcp_config_path=".mcp.json"
        )

        if not docs:
            print("No documents found!")
            return

        print(f"Found {len(docs)} document(s):\n")

        # Show first 10 documents
        for i, doc in enumerate(docs[:10]):
            print(f"{i+1}. Document ID: {doc.get('$id', 'N/A')}")
            print(f"   Course Name: {doc.get('course_name', 'N/A')}")
            print(f"   Subject: {doc.get('subject', 'N/A')}")
            print(f"   Level: {doc.get('level', 'N/A')}")
            print()

        if len(docs) > 10:
            print(f"... and {len(docs) - 10} more documents")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
