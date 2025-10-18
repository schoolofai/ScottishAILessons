#!/usr/bin/env python3
"""Debug script to find a specific document."""

import asyncio
from src.utils.appwrite_mcp import get_appwrite_document


async def main():
    doc_id = "68f1326f00109d28e024"

    print(f"\n=== Searching for document {doc_id} ===\n")

    try:
        doc = await get_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            document_id=doc_id,
            mcp_config_path=".mcp.json"
        )

        print(f"Document FOUND!")
        print(f"  Doc ID: {doc.get('$id', 'N/A')}")
        print(f"  courseId: {doc.get('courseId', 'N/A')}")
        print(f"  sow_order: {doc.get('sow_order', 'N/A')}")
        print(f"  model_version: {doc.get('model_version', 'N/A')}")
        print()

    except Exception as e:
        print(f"Document NOT FOUND or error: {e}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
