#!/usr/bin/env python3
"""Inspect a specific document structure."""

import asyncio
import sys
import json
sys.path.insert(0, "src")

from utils.appwrite_mcp import list_appwrite_documents


async def main():
    """Inspect document structure."""
    if len(sys.argv) != 3:
        print("Usage: inspect_document.py <subject> <level>")
        sys.exit(1)

    subject = sys.argv[1]
    level = sys.argv[2]

    print(f"Inspecting document for {subject} at {level}...")

    try:
        docs = await list_appwrite_documents(
            database_id="sqa_education",
            collection_id="sqa_current",
            mcp_config_path=".mcp.json"
        )

        # Filter for matching subject and level
        matching_docs = [
            doc for doc in docs
            if doc.get('subject') == subject and doc.get('level') == level
        ]

        if not matching_docs:
            print(f"No documents found for {subject} at {level}")
            return

        doc = matching_docs[0]

        print("\n=== Document Structure ===")
        print(f"Document ID: {doc.get('$id')}")
        print(f"Subject: {doc.get('subject')}")
        print(f"Level: {doc.get('level')}")
        print(f"Course Code: {doc.get('course_code')}")
        print(f"Catalog Version: {doc.get('catalog_version')}")
        print(f"Last Modified: {doc.get('last_modified')}")
        print()

        # Parse data field
        data_str = doc.get('data', '{}')
        print(f"Data field length: {len(data_str)} characters")
        print()

        try:
            data = json.loads(data_str)
            print("=== Data Structure (Top-level keys) ===")
            for key in data.keys():
                value = data[key]
                if isinstance(value, list):
                    print(f"  {key}: [list with {len(value)} items]")
                elif isinstance(value, dict):
                    print(f"  {key}: [dict with {len(value)} keys]")
                elif isinstance(value, str):
                    preview = value[:100] + "..." if len(value) > 100 else value
                    print(f"  {key}: {preview}")
                else:
                    print(f"  {key}: {value}")
            print()

            # Show sample of first few keys
            print("=== Sample Data Content ===")
            print(json.dumps(data, indent=2)[:2000])
            print("...")

        except json.JSONDecodeError as e:
            print(f"Error parsing data JSON: {e}")
            print("First 500 chars of data:")
            print(data_str[:500])

        # Parse metadata field
        metadata_str = doc.get('metadata', '{}')
        try:
            metadata = json.loads(metadata_str)
            print("\n=== Metadata ===")
            print(json.dumps(metadata, indent=2))
        except json.JSONDecodeError as e:
            print(f"Error parsing metadata JSON: {e}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
