#!/usr/bin/env python3
"""Test script for course validation without running the full agent.

Tests validation for:
- courseId: course_c84474
- database: default, collection: courses
- database: sqa_education, collection: current_sqa
- subject: application-of-mathematics
- level: national-4
"""

import asyncio
import logging
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_course_validation():
    """Test the course validation function independently."""
    import sys as sys_module
    from pathlib import Path as PathLib

    print("=" * 70)
    print("SOW Author - Course Validation Test")
    print("=" * 70)
    print()

    # Test parameters
    subject = "application-of-mathematics"
    level = "national-4"
    courseId = "course_c84474"  # courseId field value (not document $id)
    mcp_config_path = ".mcp.json"

    print(f"Test Parameters:")
    print(f"  Subject:   {subject}")
    print(f"  Level:     {level}")
    print(f"  Course ID: {courseId}")
    print()

    # Check if MCP config exists
    if not PathLib(mcp_config_path).exists():
        print(f"❌ ERROR: MCP config not found at {mcp_config_path}")
        print(f"   Please ensure .mcp.json exists with Appwrite credentials")
        return False

    print(f"✓ MCP config found: {mcp_config_path}")
    print()

    # Import validation utilities
    try:
        # Add src to path if needed
        src_path = PathLib(__file__).parent / "src"
        if str(src_path) not in sys_module.path:
            sys_module.path.insert(0, str(src_path))

        from utils.appwrite_mcp import get_appwrite_document, list_appwrite_documents
        print("✓ Successfully imported appwrite_mcp utilities")
    except ImportError as e:
        print(f"❌ ERROR: Failed to import utilities: {e}")
        print(f"   Run: pip install -r requirements.txt")
        import traceback
        traceback.print_exc()
        return False

    print()
    print("-" * 70)
    print("Test 1: Validate course exists in default.courses")
    print("-" * 70)

    try:
        # Query by courseId field (not document $id)
        course_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="courses",
            queries=[f'equal("courseId", "{courseId}")'],
            mcp_config_path=mcp_config_path
        )

        if not course_docs or len(course_docs) == 0:
            print(f"❌ FAIL: Course with courseId={courseId} not found in default.courses")
            return False

        course_doc = course_docs[0]  # Get first matching course

        print(f"✓ PASS: Course document found")
        print(f"  Document ID: {course_doc.get('$id', 'N/A')}")
        print(f"  Course ID:   {course_doc.get('courseId', 'N/A')}")
        print(f"  Subject:     {course_doc.get('subject', 'N/A')}")
        print(f"  Level:       {course_doc.get('level', 'N/A')}")

        # Validate subject matches
        course_subject = course_doc.get('subject', '')
        if course_subject != subject:
            print(f"❌ FAIL: Subject mismatch!")
            print(f"  Expected: {subject}")
            print(f"  Found:    {course_subject}")
            return False

        print(f"✓ PASS: Subject matches")

        # Validate level matches
        course_level = course_doc.get('level', '')
        if course_level != level:
            print(f"❌ FAIL: Level mismatch!")
            print(f"  Expected: {level}")
            print(f"  Found:    {course_level}")
            return False

        print(f"✓ PASS: Level matches")

    except Exception as e:
        print(f"❌ FAIL: Error querying default.courses: {e}")
        return False

    print()
    print("-" * 70)
    print("Test 2: Validate SQA data exists in sqa_education.sqa_current")
    print("-" * 70)

    try:
        # Convert hyphenated format to underscore format for SQA collection
        sqa_subject = subject.replace("-", "_")
        if sqa_subject == "application_of_mathematics":
            sqa_subject = "applications_of_mathematics"
        sqa_level = level.replace("-", "_")

        print(f"  Querying SQA format: subject='{sqa_subject}', level='{sqa_level}'")

        sqa_docs = await list_appwrite_documents(
            database_id="sqa_education",
            collection_id="sqa_current",
            queries=[
                f'equal("subject", "{sqa_subject}")',
                f'equal("level", "{sqa_level}")'
            ],
            mcp_config_path=mcp_config_path
        )

        if not sqa_docs or len(sqa_docs) == 0:
            print(f"❌ FAIL: No SQA course data found for subject={subject}, level={level}")
            return False

        print(f"✓ PASS: SQA course data found")
        print(f"  Documents: {len(sqa_docs)}")

        # Show first document details
        first_doc = sqa_docs[0]
        print(f"  Course Name: {first_doc.get('course_name', 'N/A')}")
        print(f"  Course Code: {first_doc.get('course_code', 'N/A')}")
        print(f"  Subject:     {first_doc.get('subject', 'N/A')}")
        print(f"  Level:       {first_doc.get('level', 'N/A')}")

    except Exception as e:
        print(f"❌ FAIL: Error querying sqa_education.current_sqa: {e}")
        return False

    print()
    print("=" * 70)
    print("✅ ALL VALIDATION TESTS PASSED!")
    print("=" * 70)
    print()
    print("The validation function is working correctly and ready to use.")
    print()

    return True


async def main():
    """Run the test."""
    try:
        success = await test_course_validation()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test failed with unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
