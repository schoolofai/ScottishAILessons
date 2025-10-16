#!/usr/bin/env python3
"""Test script for lesson template upserter.

Tests:
1. Card compression/decompression roundtrip
2. Compression statistics calculation
3. Lesson template upsert to Appwrite
4. Data integrity verification

Usage:
    python tests/test_lesson_upserter.py
"""

import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.lesson_upserter import (
    compress_cards_gzip_base64,
    decompress_cards_gzip_base64,
    get_compression_stats,
    upsert_lesson_template
)
from src.utils.appwrite_mcp import list_appwrite_documents


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_success(message: str):
    """Print a success message."""
    print(f"✅ {message}")


def print_error(message: str):
    """Print an error message."""
    print(f"❌ {message}")


def print_info(message: str):
    """Print an info message."""
    print(f"ℹ️  {message}")


def test_compression_roundtrip():
    """Test that compression and decompression work correctly."""
    print_section("TEST 1: Compression/Decompression Roundtrip")

    # Load mock lesson template
    mock_template_path = Path(__file__).parent / "mock_lesson_template.json"

    print_info(f"Loading mock template from: {mock_template_path}")

    with open(mock_template_path, 'r') as f:
        template = json.load(f)

    cards = template.get("cards", [])
    print_info(f"Loaded {len(cards)} cards from template")

    # Test compression
    print_info("Compressing cards...")
    try:
        compressed = compress_cards_gzip_base64(cards)
        print_success(f"Compression successful: {len(compressed)} bytes")
    except Exception as e:
        print_error(f"Compression failed: {e}")
        return False

    # Test decompression
    print_info("Decompressing cards...")
    try:
        decompressed = decompress_cards_gzip_base64(compressed)
        print_success(f"Decompression successful: {len(decompressed)} cards")
    except Exception as e:
        print_error(f"Decompression failed: {e}")
        return False

    # Verify roundtrip integrity
    print_info("Verifying data integrity...")
    if json.dumps(cards, sort_keys=True) == json.dumps(decompressed, sort_keys=True):
        print_success("Roundtrip verification passed: Data matches exactly")
        return True
    else:
        print_error("Roundtrip verification failed: Data mismatch")
        print(f"Original: {len(json.dumps(cards))} chars")
        print(f"Decompressed: {len(json.dumps(decompressed))} chars")
        return False


def test_compression_stats():
    """Test compression statistics calculation."""
    print_section("TEST 2: Compression Statistics")

    # Load mock lesson template
    mock_template_path = Path(__file__).parent / "mock_lesson_template.json"

    with open(mock_template_path, 'r') as f:
        template = json.load(f)

    cards = template.get("cards", [])

    print_info("Calculating compression statistics...")
    try:
        stats = get_compression_stats(cards)
        print_success("Statistics calculated successfully:")
        print(f"   Original size: {stats['original_bytes']} bytes")
        print(f"   Compressed size: {stats['compressed_bytes']} bytes")
        print(f"   Compression ratio: {stats['ratio_percent']}")
        print(f"   Space savings: {stats['savings_percent']}")

        # Verify reasonable compression (should be 20-50% of original)
        ratio = float(stats['ratio_percent'].rstrip('%'))
        if 20 <= ratio <= 50:
            print_success(f"Compression ratio is reasonable: {ratio}%")
            return True
        else:
            print_error(f"Compression ratio unusual: {ratio}% (expected 20-50%)")
            return False

    except Exception as e:
        print_error(f"Statistics calculation failed: {e}")
        return False


async def test_upsert_to_appwrite():
    """Test upserting lesson template to Appwrite."""
    print_section("TEST 3: Upsert to Appwrite")

    # Test parameters
    mock_template_path = Path(__file__).parent / "mock_lesson_template.json"
    courseId = "course_test_mock"
    order = 1
    execution_id = "test_20250116_150000"
    mcp_config_path = ".mcp.json"

    print_info("Test parameters:")
    print(f"   courseId: {courseId}")
    print(f"   order: {order}")
    print(f"   execution_id: {execution_id}")
    print(f"   mock_template: {mock_template_path}")

    # Verify mock template exists
    if not mock_template_path.exists():
        print_error(f"Mock template not found: {mock_template_path}")
        return False

    print_info("Upserting lesson template to Appwrite...")
    try:
        doc_id = await upsert_lesson_template(
            lesson_template_path=str(mock_template_path),
            courseId=courseId,
            order=order,
            execution_id=execution_id,
            mcp_config_path=mcp_config_path
        )
        print_success(f"Upsert successful: Document ID = {doc_id}")
        return doc_id

    except FileNotFoundError as e:
        print_error(f"File not found: {e}")
        return None
    except ValueError as e:
        print_error(f"Validation error: {e}")
        return None
    except Exception as e:
        print_error(f"Upsert failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_verify_appwrite_data(doc_id: str):
    """Verify the lesson template was correctly stored in Appwrite."""
    print_section("TEST 4: Verify Appwrite Data")

    if not doc_id:
        print_error("No document ID provided (upsert may have failed)")
        return False

    print_info(f"Fetching document from Appwrite: {doc_id}")

    try:
        # Query by courseId and sow_order
        docs = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_templates",
            queries=[
                'equal("courseId", "course_test_mock")',
                'equal("sow_order", 1)'
            ],
            mcp_config_path=".mcp.json"
        )

        if not docs or len(docs) == 0:
            print_error("Document not found in Appwrite")
            return False

        doc = docs[0]
        print_success(f"Document found in Appwrite")

        # Verify key fields
        print_info("Verifying document fields...")

        checks = [
            ("courseId", "course_test_mock"),
            ("sow_order", 1),
            ("title", "Calculating Fractions of Amounts"),
            ("createdBy", "lesson_author_agent"),
            ("lesson_type", "teach"),
            ("estMinutes", 50),
            ("status", "draft")
        ]

        all_passed = True
        for field, expected in checks:
            actual = doc.get(field)
            if actual == expected:
                print_success(f"   {field}: {actual} ✓")
            else:
                print_error(f"   {field}: expected '{expected}', got '{actual}'")
                all_passed = False

        # Verify outcomeRefs (JSON field)
        print_info("Verifying outcomeRefs...")
        outcome_refs = doc.get("outcomeRefs", "[]")
        if isinstance(outcome_refs, str):
            outcome_refs = json.loads(outcome_refs)

        expected_outcomes = ["O1", "AS1.2"]
        if outcome_refs == expected_outcomes:
            print_success(f"   outcomeRefs: {outcome_refs} ✓")
        else:
            print_error(f"   outcomeRefs: expected {expected_outcomes}, got {outcome_refs}")
            all_passed = False

        # Verify cards are compressed (should be base64 string, not JSON array)
        print_info("Verifying cards compression...")
        cards_field = doc.get("cards", "")

        if isinstance(cards_field, str) and len(cards_field) > 0:
            # Should be base64 string (not JSON array)
            if cards_field.startswith('['):
                print_error("   cards: Not compressed (stored as JSON array)")
                all_passed = False
            else:
                print_success(f"   cards: Compressed (base64 string, {len(cards_field)} bytes)")

                # Try to decompress
                try:
                    decompressed_cards = decompress_cards_gzip_base64(cards_field)
                    print_success(f"   cards: Decompression successful ({len(decompressed_cards)} cards)")
                except Exception as e:
                    print_error(f"   cards: Decompression failed: {e}")
                    all_passed = False
        else:
            print_error(f"   cards: Invalid format (type: {type(cards_field)})")
            all_passed = False

        if all_passed:
            print_success("All data integrity checks passed!")
            return True
        else:
            print_error("Some data integrity checks failed")
            return False

    except Exception as e:
        print_error(f"Verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def cleanup_test_data():
    """Clean up test data from Appwrite (optional)."""
    print_section("CLEANUP: Remove Test Data")

    print_info("Cleaning up test data is OPTIONAL")
    print_info("Test document: courseId='course_test_mock', sow_order=1")
    print_info("You can manually delete it from Appwrite console if needed")
    print_info("Or leave it for manual inspection")

    # Note: We don't automatically delete to allow manual verification
    return True


async def main():
    """Run all tests."""
    print("\n" + "🧪" * 40)
    print("LESSON TEMPLATE UPSERTER TEST SUITE")
    print("🧪" * 40)

    # Track test results
    results = {
        "test_compression_roundtrip": False,
        "test_compression_stats": False,
        "test_upsert": False,
        "test_verify": False
    }

    # Test 1: Compression roundtrip
    results["test_compression_roundtrip"] = test_compression_roundtrip()

    # Test 2: Compression statistics
    results["test_compression_stats"] = test_compression_stats()

    # Test 3: Upsert to Appwrite
    doc_id = await test_upsert_to_appwrite()
    results["test_upsert"] = (doc_id is not None)

    # Test 4: Verify Appwrite data
    if doc_id:
        results["test_verify"] = await test_verify_appwrite_data(doc_id)

    # Cleanup (optional)
    await cleanup_test_data()

    # Summary
    print_section("TEST SUMMARY")

    total_tests = len(results)
    passed_tests = sum(1 for r in results.values() if r)

    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"   {test_name}: {status}")

    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")

    if passed_tests == total_tests:
        print_success("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print_error(f"\n⚠️  {total_tests - passed_tests} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
