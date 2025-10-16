#!/usr/bin/env python3
"""Integration test for SOW upserter with fake data and cleanup.

Tests the complete upserting flow:
1. Create fake SOW JSON file
2. Upsert to Appwrite default.Authored_SOW
3. Verify document was created
4. Clean up: Delete document and temporary files
"""

import asyncio
import json
import logging
import sys
import tempfile
from pathlib import Path
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Fake SOW data for testing
FAKE_SOW_DATA = {
    "metadata": {
        "subject": "mathematics",
        "level": "national-5",
        "title": "Test SOW for Integration Testing",
        "total_lessons": 3,
        "accessibility_notes": "This is a test SOW with fake data for integration testing.",
        "created_by": "test_sow_upserter.py",
        "created_at": datetime.now().isoformat()
    },
    "entries": [
        {
            "lesson_number": 1,
            "title": "Test Lesson 1",
            "learning_objectives": ["Test objective 1", "Test objective 2"],
            "content": "This is fake lesson content for testing.",
            "assessment": "Test assessment",
            "resources": ["Test resource 1"]
        },
        {
            "lesson_number": 2,
            "title": "Test Lesson 2",
            "learning_objectives": ["Test objective 3", "Test objective 4"],
            "content": "This is fake lesson content for testing.",
            "assessment": "Test assessment",
            "resources": ["Test resource 2"]
        },
        {
            "lesson_number": 3,
            "title": "Test Lesson 3",
            "learning_objectives": ["Test objective 5", "Test objective 6"],
            "content": "This is fake lesson content for testing.",
            "assessment": "Test assessment",
            "resources": ["Test resource 3"]
        }
    ]
}


async def test_sow_upserter():
    """Run integration test for SOW upserter."""
    print("=" * 70)
    print("SOW Upserter Integration Test")
    print("=" * 70)
    print()

    # Test parameters
    subject = "mathematics"
    level = "national-5"
    course_id = "test_course_integration"  # Fake course ID for testing
    execution_id = datetime.now().strftime("%Y%m%d_%H%M%S_test")
    mcp_config_path = ".mcp.json"

    print(f"Test Parameters:")
    print(f"  Subject:      {subject}")
    print(f"  Level:        {level}")
    print(f"  Course ID:    {course_id}")
    print(f"  Execution ID: {execution_id}")
    print()

    # Check if MCP config exists
    if not Path(mcp_config_path).exists():
        print(f"❌ ERROR: MCP config not found at {mcp_config_path}")
        print(f"   Please ensure .mcp.json exists with Appwrite credentials")
        return False

    print(f"✓ MCP config found: {mcp_config_path}")
    print()

    # Import upserter utilities
    try:
        # Add src to path if needed
        src_path = Path(__file__).parent / "src"
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))

        from utils.sow_upserter import upsert_sow_to_appwrite
        from utils.appwrite_mcp import delete_appwrite_document
        print("✓ Successfully imported upserter utilities")
    except ImportError as e:
        print(f"❌ ERROR: Failed to import utilities: {e}")
        print(f"   Run: pip install -r requirements.txt")
        import traceback
        traceback.print_exc()
        return False

    # Create temporary SOW file
    print()
    print("-" * 70)
    print("Step 1: Creating fake SOW JSON file")
    print("-" * 70)

    temp_dir = Path(tempfile.mkdtemp(prefix="sow_upserter_test_"))
    sow_file_path = temp_dir / "authored_sow_json"

    try:
        with open(sow_file_path, 'w') as f:
            json.dump(FAKE_SOW_DATA, f, indent=2)

        print(f"✓ Fake SOW file created: {sow_file_path}")
        print(f"  Entries: {len(FAKE_SOW_DATA['entries'])}")
        print(f"  Metadata fields: {list(FAKE_SOW_DATA['metadata'].keys())}")
    except Exception as e:
        print(f"❌ ERROR: Failed to create fake SOW file: {e}")
        return False

    # Test upserting
    print()
    print("-" * 70)
    print("Step 2: Upserting SOW to Appwrite")
    print("-" * 70)

    document_id = None
    try:
        document_id = await upsert_sow_to_appwrite(
            sow_file_path=str(sow_file_path),
            subject=subject,
            level=level,
            course_id=course_id,
            execution_id=execution_id,
            mcp_config_path=mcp_config_path
        )

        print(f"✓ SOW upserted successfully!")
        print(f"  Document ID: {document_id}")
    except Exception as e:
        print(f"❌ ERROR: Failed to upsert SOW: {e}")
        import traceback
        traceback.print_exc()

        # Cleanup temp file even on failure
        try:
            sow_file_path.unlink()
            temp_dir.rmdir()
            print(f"✓ Cleaned up temporary files")
        except Exception as cleanup_error:
            print(f"⚠️  Warning: Failed to cleanup temp files: {cleanup_error}")

        return False

    # Verify document was created
    print()
    print("-" * 70)
    print("Step 3: Verifying document in database")
    print("-" * 70)

    try:
        from utils.appwrite_mcp import get_appwrite_document

        retrieved_doc = await get_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=document_id,
            mcp_config_path=mcp_config_path
        )

        if not retrieved_doc:
            print(f"❌ ERROR: Document {document_id} not found in database!")
            return False

        print(f"✓ Document verified in database")
        print(f"  Document $id: {retrieved_doc.get('$id', 'N/A')}")
        print(f"  Course ID:    {retrieved_doc.get('courseId', 'N/A')}")
        print(f"  Version:      {retrieved_doc.get('version', 'N/A')}")
        print(f"  Status:       {retrieved_doc.get('status', 'N/A')}")

        # Verify transformation worked correctly
        entries_str = retrieved_doc.get('entries', '')
        metadata_str = retrieved_doc.get('metadata', '')
        accessibility_notes = retrieved_doc.get('accessibility_notes', '')

        # Parse back to verify
        entries = json.loads(entries_str) if entries_str else []
        metadata = json.loads(metadata_str) if metadata_str else {}

        print(f"  Entries:      {len(entries)} (stringified JSON)")
        print(f"  Metadata:     {len(metadata)} fields (stringified JSON)")
        print(f"  Accessibility: '{accessibility_notes[:50]}...'")

        # Validate schema transformation
        if len(entries) != 3:
            print(f"❌ ERROR: Expected 3 entries, got {len(entries)}")
            return False

        if 'subject' not in metadata:
            print(f"❌ ERROR: Metadata missing 'subject' field")
            return False

        print(f"✓ Schema transformation verified")

    except Exception as e:
        print(f"❌ ERROR: Failed to verify document: {e}")
        import traceback
        traceback.print_exc()
        return False

    # Cleanup: Delete document from database
    print()
    print("-" * 70)
    print("Step 4: Cleaning up test data")
    print("-" * 70)

    try:
        await delete_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=document_id,
            mcp_config_path=mcp_config_path
        )

        print(f"✓ Test document deleted: {document_id}")
    except Exception as e:
        print(f"❌ ERROR: Failed to delete test document: {e}")
        print(f"   ⚠️  WARNING: Test document {document_id} still exists in database!")
        print(f"   Please manually delete it from Appwrite console")
        import traceback
        traceback.print_exc()

    # Cleanup: Delete temporary files
    try:
        sow_file_path.unlink()
        temp_dir.rmdir()
        print(f"✓ Temporary files cleaned up: {temp_dir}")
    except Exception as e:
        print(f"⚠️  Warning: Failed to cleanup temp files: {e}")

    print()
    print("=" * 70)
    print("✅ INTEGRATION TEST PASSED!")
    print("=" * 70)
    print()
    print("Summary:")
    print("  1. ✓ Fake SOW file created")
    print("  2. ✓ SOW upserted to Appwrite")
    print("  3. ✓ Document verified in database")
    print("  4. ✓ Schema transformation validated")
    print("  5. ✓ Test data cleaned up")
    print()

    return True


async def main():
    """Run the integration test."""
    try:
        success = await test_sow_upserter()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test failed with unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
