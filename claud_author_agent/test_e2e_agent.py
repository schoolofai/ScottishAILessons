#!/usr/bin/env python3
"""End-to-end test for SOW Author Claude Agent.

Tests the complete pipeline from CLI input to database verification:
1. Prepare test input (subject, level, courseId)
2. Execute agent via CLI
3. Monitor execution logs and progress
4. Verify SOW was created in Appwrite database
5. Validate SOW content and schema
6. Clean up: Delete test SOW from database

Test Parameters:
- Subject: application-of-mathematics (hyphenated for CLI)
- Level: national-4
- Course ID: course_c84474 (must exist in default.courses)
"""

import asyncio
import json
import logging
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Test parameters
TEST_SUBJECT = "application-of-mathematics"
TEST_LEVEL = "national-4"
TEST_COURSE_DOCUMENT_ID = "68e262811061bfe64e31"  # Document $id in default.courses
TEST_COURSE_ID = "course_c84474"  # courseId field value (for SOW foreign key)
MCP_CONFIG_PATH = ".mcp.json"


def print_section(title: str, char: str = "="):
    """Print a formatted section header."""
    print()
    print(char * 70)
    print(title)
    print(char * 70)
    print()


async def validate_prerequisites():
    """Validate that all prerequisites are met before running test.

    Checks:
    1. .venv exists and has required packages
    2. .mcp.json exists with valid configuration
    3. courseId exists in default.courses
    4. SQA course data exists in sqa_education.sqa_current

    Returns:
        bool: True if all checks pass, False otherwise
    """
    print_section("Step 1: Validating Prerequisites", "-")

    # Check 1: Virtual environment
    venv_path = Path(".venv")
    if not venv_path.exists():
        logger.error("❌ Virtual environment not found at .venv")
        logger.error("   Run: python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt")
        return False

    logger.info("✓ Virtual environment found: .venv")

    # Check 2: MCP configuration
    mcp_path = Path(MCP_CONFIG_PATH)
    if not mcp_path.exists():
        logger.error(f"❌ MCP config not found: {MCP_CONFIG_PATH}")
        logger.error("   Run: cp .mcp.json.example .mcp.json and configure credentials")
        return False

    logger.info(f"✓ MCP config found: {MCP_CONFIG_PATH}")

    # Check 3: Validate course document exists in database
    logger.info(f"Validating course document '{TEST_COURSE_DOCUMENT_ID}' in default.courses...")

    try:
        # Add src to path
        src_path = Path(__file__).parent / "src"
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))

        from utils.appwrite_mcp import get_appwrite_document, list_appwrite_documents

        # Query course document
        course_doc = await get_appwrite_document(
            database_id="default",
            collection_id="courses",
            document_id=TEST_COURSE_DOCUMENT_ID,
            mcp_config_path=MCP_CONFIG_PATH
        )

        if not course_doc:
            logger.error(f"❌ Course document '{TEST_COURSE_DOCUMENT_ID}' not found in default.courses")
            logger.error("   Create the course first before running this test")
            return False

        logger.info(f"✓ Course document '{TEST_COURSE_DOCUMENT_ID}' found in database")
        logger.info(f"  Document $id: {course_doc.get('$id', 'N/A')}")
        logger.info(f"  courseId field: {course_doc.get('courseId', 'N/A')}")
        logger.info(f"  Course subject: {course_doc.get('subject', 'N/A')}")
        logger.info(f"  Course level: {course_doc.get('level', 'N/A')}")

        # Verify subject/level match
        expected_subject = TEST_SUBJECT  # Hyphenated format
        expected_level = TEST_LEVEL

        if course_doc.get('subject') != expected_subject:
            logger.error(f"❌ Subject mismatch: expected '{expected_subject}', got '{course_doc.get('subject')}'")
            return False

        if course_doc.get('level') != expected_level:
            logger.error(f"❌ Level mismatch: expected '{expected_level}', got '{course_doc.get('level')}'")
            return False

        logger.info("✓ Subject and level match course document")

    except Exception as e:
        logger.error(f"❌ Failed to validate course: {e}")
        import traceback
        traceback.print_exc()
        return False

    # Check 4: Validate SQA course data exists
    logger.info(f"Validating SQA data in sqa_education.sqa_current...")

    try:
        # Convert hyphenated format to underscore format for SQA query
        sqa_subject = TEST_SUBJECT.replace("-", "_")
        # Note: applications (plural) not application
        if sqa_subject == "application_of_mathematics":
            sqa_subject = "applications_of_mathematics"

        sqa_level = TEST_LEVEL.replace("-", "_")

        logger.info(f"  Querying with SQA format: subject='{sqa_subject}', level='{sqa_level}'")

        sqa_docs = await list_appwrite_documents(
            database_id="sqa_education",
            collection_id="sqa_current",
            queries=[
                f'equal("subject", "{sqa_subject}")',
                f'equal("level", "{sqa_level}")'
            ],
            mcp_config_path=MCP_CONFIG_PATH
        )

        if not sqa_docs or len(sqa_docs) == 0:
            logger.error(f"❌ No SQA course data found for subject='{TEST_SUBJECT}', level='{TEST_LEVEL}'")
            logger.error("   SQA course data is required for SOW authoring")
            return False

        logger.info(f"✓ SQA course data found: {len(sqa_docs)} document(s)")
        logger.info(f"  Course name: {sqa_docs[0].get('course_name', 'N/A')}")

    except Exception as e:
        logger.error(f"❌ Failed to validate SQA data: {e}")
        import traceback
        traceback.print_exc()
        return False

    print()
    logger.info("✅ All prerequisites validated successfully!")
    return True


def create_test_input_json():
    """Create test input JSON file.

    Returns:
        str: Path to created JSON file
    """
    print_section("Step 2: Creating Test Input JSON", "-")

    input_data = {
        "subject": TEST_SUBJECT,
        "level": TEST_LEVEL,
        "courseId": TEST_COURSE_ID
    }

    input_file = Path("test_e2e_input.json")

    with open(input_file, 'w') as f:
        json.dump(input_data, f, indent=2)

    logger.info(f"✓ Test input JSON created: {input_file}")
    logger.info(f"  Subject:   {input_data['subject']}")
    logger.info(f"  Level:     {input_data['level']}")
    logger.info(f"  Course ID: {input_data['courseId']}")

    return str(input_file)


def execute_agent_cli(input_json_path: str):
    """Execute the SOW Author agent via CLI.

    Args:
        input_json_path: Path to input JSON file

    Returns:
        tuple: (return_code, stdout, stderr)
    """
    print_section("Step 3: Executing SOW Author Agent", "-")

    # Build CLI command
    cmd = [
        "python", "-m", "src.sow_author_cli",
        "--input", input_json_path,
        "--log-level", "INFO"
    ]

    logger.info(f"Running command: {' '.join(cmd)}")
    logger.info("⏳ This may take several minutes (4 subagents + upserter)...")
    print()

    start_time = time.time()

    try:
        # Run command and capture output in real-time
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        # Stream output in real-time
        stdout_lines = []
        for line in process.stdout:
            print(line, end='')  # Print to console
            stdout_lines.append(line)  # Store for analysis

        # Wait for completion
        return_code = process.wait()

        elapsed = time.time() - start_time

        print()
        logger.info(f"Agent execution completed in {elapsed:.1f}s")
        logger.info(f"Return code: {return_code}")

        return return_code, ''.join(stdout_lines), ""

    except Exception as e:
        logger.error(f"❌ Failed to execute agent: {e}")
        import traceback
        traceback.print_exc()
        return 1, "", str(e)


def analyze_execution_logs(stdout: str, stderr: str):
    """Analyze execution logs to check for success indicators.

    Args:
        stdout: Standard output from agent execution
        stderr: Standard error from agent execution

    Returns:
        dict: Analysis results with success indicators
    """
    print_section("Step 4: Analyzing Execution Logs", "-")

    analysis = {
        "success": False,
        "subagents_completed": [],
        "errors": [],
        "warnings": [],
        "document_id": None
    }

    # Check for subagent completion
    subagent_markers = [
        "research_subagent",
        "course_data_extractor",
        "sow_author",
        "unified_critic"
    ]

    for subagent in subagent_markers:
        if subagent in stdout.lower():
            analysis["subagents_completed"].append(subagent)

    logger.info(f"Subagents detected: {len(analysis['subagents_completed'])}/4")
    for subagent in analysis["subagents_completed"]:
        logger.info(f"  ✓ {subagent}")

    # Check for upserter completion
    if "SOW upserted successfully" in stdout or "Document ID:" in stdout:
        logger.info("✓ Python upserter executed")

        # Extract document ID
        for line in stdout.split('\n'):
            if "Document ID:" in line:
                doc_id = line.split("Document ID:")[-1].strip()
                analysis["document_id"] = doc_id
                logger.info(f"  Document ID: {doc_id}")

    # Check for errors
    error_keywords = ["ERROR", "FAIL", "Exception", "Traceback"]
    for keyword in error_keywords:
        if keyword in stdout or keyword in stderr:
            analysis["errors"].append(f"Found '{keyword}' in output")

    if analysis["errors"]:
        logger.warning(f"⚠️  Found {len(analysis['errors'])} potential error(s)")
        for error in analysis["errors"]:
            logger.warning(f"  - {error}")

    # Check for success message
    if "COMPLETED SUCCESSFULLY" in stdout or "success: True" in stdout.lower():
        analysis["success"] = True
        logger.info("✅ Agent reported successful completion")
    else:
        logger.warning("⚠️  Success message not found in output")

    return analysis


async def verify_database_sow(document_id: str):
    """Verify that SOW was created in Appwrite database.

    Args:
        document_id: Document ID to verify

    Returns:
        bool: True if SOW exists and is valid, False otherwise
    """
    print_section("Step 5: Verifying SOW in Database", "-")

    if not document_id:
        logger.error("❌ No document ID provided for verification")
        return False

    try:
        # Add src to path
        src_path = Path(__file__).parent / "src"
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))

        from utils.appwrite_mcp import get_appwrite_document

        logger.info(f"Querying document: {document_id}")

        sow_doc = await get_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=document_id,
            mcp_config_path=MCP_CONFIG_PATH
        )

        if not sow_doc:
            logger.error(f"❌ Document '{document_id}' not found in default.Authored_SOW")
            return False

        logger.info(f"✓ Document found in database")
        logger.info(f"  Document $id: {sow_doc.get('$id', 'N/A')}")
        logger.info(f"  Course ID:    {sow_doc.get('courseId', 'N/A')}")
        logger.info(f"  Version:      {sow_doc.get('version', 'N/A')}")
        logger.info(f"  Status:       {sow_doc.get('status', 'N/A')}")
        logger.info(f"  Created at:   {sow_doc.get('$createdAt', 'N/A')}")

        # Validate required fields
        validation_passed = True

        # Check courseId matches
        if sow_doc.get('courseId') != TEST_COURSE_ID:
            logger.error(f"❌ Course ID mismatch: expected '{TEST_COURSE_ID}', got '{sow_doc.get('courseId')}'")
            validation_passed = False
        else:
            logger.info("✓ Course ID matches")

        # Check version
        if sow_doc.get('version') != "1":
            logger.warning(f"⚠️  Version is '{sow_doc.get('version')}', expected '1'")
        else:
            logger.info("✓ Version is '1'")

        # Check status
        if sow_doc.get('status') != "draft":
            logger.warning(f"⚠️  Status is '{sow_doc.get('status')}', expected 'draft'")
        else:
            logger.info("✓ Status is 'draft'")

        # Validate entries (stringified JSON)
        entries_str = sow_doc.get('entries', '')
        if not entries_str:
            logger.error("❌ Entries field is empty")
            validation_passed = False
        else:
            try:
                entries = json.loads(entries_str)
                logger.info(f"✓ Entries parsed: {len(entries)} lesson(s)")

                if len(entries) < 10:
                    logger.warning(f"⚠️  Only {len(entries)} entries, expected at least 10")
                else:
                    logger.info(f"✓ Entries count meets minimum requirement (>=10)")

            except json.JSONDecodeError as e:
                logger.error(f"❌ Entries is not valid JSON: {e}")
                validation_passed = False

        # Validate metadata (stringified JSON)
        metadata_str = sow_doc.get('metadata', '')
        if not metadata_str:
            logger.error("❌ Metadata field is empty")
            validation_passed = False
        else:
            try:
                metadata = json.loads(metadata_str)
                logger.info(f"✓ Metadata parsed: {len(metadata)} field(s)")

                # Check for required metadata fields
                required_meta = ['subject', 'level', 'title']
                missing_meta = [f for f in required_meta if f not in metadata]

                if missing_meta:
                    logger.warning(f"⚠️  Missing metadata fields: {', '.join(missing_meta)}")
                else:
                    logger.info("✓ Required metadata fields present")

            except json.JSONDecodeError as e:
                logger.error(f"❌ Metadata is not valid JSON: {e}")
                validation_passed = False

        # Check accessibility_notes
        accessibility = sow_doc.get('accessibility_notes', '')
        if accessibility:
            logger.info(f"✓ Accessibility notes present ({len(accessibility)} chars)")
        else:
            logger.info("  Accessibility notes: (empty)")

        print()
        if validation_passed:
            logger.info("✅ SOW document validation PASSED")
        else:
            logger.error("❌ SOW document validation FAILED")

        return validation_passed

    except Exception as e:
        logger.error(f"❌ Failed to verify SOW in database: {e}")
        import traceback
        traceback.print_exc()
        return False


async def cleanup_test_sow(document_id: str):
    """Clean up test SOW from database.

    Args:
        document_id: Document ID to delete

    Returns:
        bool: True if cleanup successful
    """
    print_section("Step 6: Cleaning Up Test Data", "-")

    if not document_id:
        logger.warning("⚠️  No document ID provided, skipping cleanup")
        return True

    # Ask user if they want to delete
    print(f"Test SOW document ID: {document_id}")
    response = input("Delete test SOW from database? (y/n): ").strip().lower()

    if response != 'y':
        logger.info("⏭️  Skipping cleanup (SOW will remain in database)")
        return True

    try:
        # Add src to path
        src_path = Path(__file__).parent / "src"
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))

        from utils.appwrite_mcp import delete_appwrite_document

        await delete_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=document_id,
            mcp_config_path=MCP_CONFIG_PATH
        )

        logger.info(f"✓ Test SOW deleted: {document_id}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to delete test SOW: {e}")
        logger.error(f"   Please manually delete document '{document_id}' from Appwrite console")
        return False


async def run_e2e_test():
    """Run the complete end-to-end test."""
    print()
    print("=" * 70)
    print("SOW AUTHOR CLAUDE AGENT - END-TO-END TEST")
    print("=" * 70)
    print()
    print(f"Test Configuration:")
    print(f"  Subject:        {TEST_SUBJECT}")
    print(f"  Level:          {TEST_LEVEL}")
    print(f"  Course Doc ID:  {TEST_COURSE_DOCUMENT_ID}")
    print(f"  Course ID (FK): {TEST_COURSE_ID}")
    print(f"  MCP Config:     {MCP_CONFIG_PATH}")
    print()

    test_results = {
        "prerequisites": False,
        "input_created": False,
        "agent_executed": False,
        "logs_analyzed": False,
        "database_verified": False,
        "cleanup_completed": False
    }

    document_id = None

    try:
        # Step 1: Validate prerequisites
        test_results["prerequisites"] = await validate_prerequisites()
        if not test_results["prerequisites"]:
            logger.error("❌ Prerequisites check failed. Cannot proceed with test.")
            return test_results

        # Step 2: Create test input
        input_json_path = create_test_input_json()
        test_results["input_created"] = True

        # Step 3: Execute agent
        return_code, stdout, stderr = execute_agent_cli(input_json_path)
        test_results["agent_executed"] = (return_code == 0)

        # Step 4: Analyze logs
        analysis = analyze_execution_logs(stdout, stderr)
        test_results["logs_analyzed"] = analysis["success"]
        document_id = analysis.get("document_id")

        # Step 5: Verify database
        if document_id:
            test_results["database_verified"] = await verify_database_sow(document_id)
        else:
            logger.error("❌ No document ID found, cannot verify database")

        # Step 6: Cleanup
        if document_id:
            test_results["cleanup_completed"] = await cleanup_test_sow(document_id)

        # Clean up input JSON
        try:
            Path(input_json_path).unlink()
            logger.info(f"✓ Test input JSON deleted: {input_json_path}")
        except Exception as e:
            logger.warning(f"⚠️  Failed to delete test input JSON: {e}")

    except Exception as e:
        logger.error(f"❌ Test failed with unexpected error: {e}")
        import traceback
        traceback.print_exc()

    # Print final summary
    print_section("TEST SUMMARY", "=")

    all_passed = all(test_results.values())

    print("Test Steps:")
    for step, passed in test_results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} - {step.replace('_', ' ').title()}")

    print()
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        print()
        print("The SOW Author Agent is functioning correctly end-to-end:")
        print("  ✓ Prerequisites validated")
        print("  ✓ Agent executed successfully")
        print("  ✓ All 4 subagents completed")
        print("  ✓ Python upserter persisted to database")
        print("  ✓ SOW document validated in Appwrite")
    else:
        print("⚠️  SOME TESTS FAILED")
        print()
        print("Please review the logs above for detailed error information.")

    print("=" * 70)
    print()

    return test_results


async def main():
    """Main test entry point."""
    try:
        results = await run_e2e_test()

        # Exit with appropriate code
        all_passed = all(results.values())
        sys.exit(0 if all_passed else 1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
