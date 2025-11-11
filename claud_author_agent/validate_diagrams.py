#!/usr/bin/env python3
"""Quick validation script to verify dual-context diagram upload fix."""

import asyncio
from src.utils.appwrite_mcp import list_appwrite_documents

async def main():
    lesson_template_id = "68f51d0d0009edd1b817"

    print("\n" + "=" * 80)
    print(f"Validating diagrams for lesson template: {lesson_template_id}")
    print("=" * 80 + "\n")

    # Query all diagrams for this lesson template
    diagrams = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_diagrams",
        queries=[
            f'equal("lessonTemplateId", "{lesson_template_id}")'
        ],
        mcp_config_path=".mcp.json"
    )

    print(f"Total diagrams found: {len(diagrams)}\n")

    if len(diagrams) == 0:
        print("❌ No diagrams found!")
        return

    # Create a table
    print(f"{'Document ID':<20} {'Card ID':<12} {'Context':<10} {'Image File ID':<25}")
    print("-" * 80)

    for diagram in sorted(diagrams, key=lambda x: (x['cardId'], x.get('diagram_context', ''))):
        doc_id = diagram['$id']
        card_id = diagram['cardId']
        context = diagram.get('diagram_context', 'N/A')
        image_id = diagram.get('image_file_id', 'N/A')

        print(f"{doc_id:<20} {card_id:<12} {context:<10} {image_id:<25}")

    # Validate uniqueness
    print("\n" + "=" * 80)
    print("Validation Checks:")
    print("=" * 80 + "\n")

    document_ids = [d['$id'] for d in diagrams]
    image_ids = [d.get('image_file_id') for d in diagrams if d.get('image_file_id')]

    unique_docs = len(set(document_ids))
    unique_images = len(set(image_ids))

    print(f"✓ Total documents: {len(diagrams)}")
    print(f"✓ Unique document IDs: {unique_docs} (expected: {len(diagrams)})")
    print(f"✓ Unique image file IDs: {unique_images} (expected: {len(diagrams)})")

    # Check for context distribution
    lesson_count = sum(1 for d in diagrams if d.get('diagram_context') == 'lesson')
    cfu_count = sum(1 for d in diagrams if d.get('diagram_context') == 'cfu')

    print(f"✓ Lesson diagrams: {lesson_count}")
    print(f"✓ CFU diagrams: {cfu_count}")

    # Final verdict
    print("\n" + "=" * 80)
    if unique_docs == len(diagrams) and unique_images == len(diagrams):
        print("✅ SUCCESS: All documents and images have unique IDs!")
        print("✅ Dual-context diagram upload bug is FIXED!")
    else:
        print("❌ FAILURE: Found duplicate IDs!")
        if unique_docs != len(diagrams):
            print(f"   - Document ID duplicates: {len(diagrams) - unique_docs}")
        if unique_images != len(diagrams):
            print(f"   - Image file ID duplicates: {len(diagrams) - unique_images}")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
