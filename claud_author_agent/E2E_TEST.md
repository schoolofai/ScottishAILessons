# End-to-End Test Plan - SOW Author Claude Agent

## Overview

This test validates the complete SOW authoring pipeline from CLI input to database persistence.

## Test Configuration

- **Subject**: `application-of-mathematics` (hyphenated format)
- **Level**: `national-4`
- **Course ID**: `course_c84474` (must exist in `default.courses`)
- **Expected Output**: Complete SOW in `default.Authored_SOW` with 10+ lessons

## Prerequisites

Before running the test, ensure:

1. ✅ Virtual environment exists and is activated
2. ✅ All dependencies installed: `pip install -r requirements.txt`
3. ✅ `.mcp.json` configured with valid Appwrite credentials
4. ✅ Course with `courseId = "course_c84474"` exists in `default.courses` with:
   - `subject = "application-of-mathematics"`
   - `level = "national-4"`
5. ✅ SQA course data exists in `sqa_education.sqa_current`:
   - `subject = "applications_of_mathematics"` (note: plural)
   - `level = "national_4"` (underscore format)

## Test Execution Steps

### 1. Prerequisites Validation
- Check `.venv` exists
- Check `.mcp.json` exists and is valid
- Query `default.courses` by courseId field to verify `course_c84474` exists
- Verify subject/level match expected values
- Query `sqa_education.sqa_current` to verify SQA course data exists

### 2. Input Preparation
- Create `test_e2e_input.json` with test parameters
- Validate JSON structure

### 3. Agent Execution
- Execute CLI command: `python -m src.sow_author_cli --input test_e2e_input.json`
- Stream output in real-time for monitoring
- Capture stdout/stderr for analysis
- Measure execution time

### 4. Log Analysis
- Check for completion of 4 subagents:
  - `research_subagent`
  - `course_data_extractor`
  - `sow_author`
  - `unified_critic`
- Check for Python upserter execution
- Extract document ID from logs
- Scan for errors/warnings

### 5. Database Verification
- Query `default.Authored_SOW` with extracted document ID
- Validate document exists
- Verify required fields:
  - `courseId = "course_c84474"`
  - `version = "1"`
  - `status = "draft"`
- Validate `entries` field:
  - Is valid JSON
  - Contains at least 10 lessons
- Validate `metadata` field:
  - Is valid JSON
  - Contains required fields: `subject`, `level`, `title`
- Check `accessibility_notes` is present

### 6. Cleanup
- Prompt user to delete test SOW
- If confirmed, delete document from database
- Delete temporary test files

## Running the Test

### Quick Start

```bash
# Activate virtual environment
source .venv/bin/activate

# Run end-to-end test
python test_e2e_agent.py
```

### Expected Output

```
======================================================================
SOW AUTHOR CLAUDE AGENT - END-TO-END TEST
======================================================================

Test Configuration:
  Subject:   application-of-mathematics
  Level:     national-4
  Course ID: course_c84474
  MCP Config: .mcp.json

----------------------------------------------------------------------
Step 1: Validating Prerequisites
----------------------------------------------------------------------
✓ Virtual environment found: .venv
✓ MCP config found: .mcp.json
✓ Course ID 'course_c84474' found in database
  Course subject: application-of-mathematics
  Course level: national-4
✓ Subject and level match course document
✓ SQA course data found: 1 document(s)
  Course name: Applications of Mathematics

✅ All prerequisites validated successfully!

----------------------------------------------------------------------
Step 2: Creating Test Input JSON
----------------------------------------------------------------------
✓ Test input JSON created: test_e2e_input.json
  Subject:   application-of-mathematics
  Level:     national-4
  Course ID: course_c84474

----------------------------------------------------------------------
Step 3: Executing SOW Author Agent
----------------------------------------------------------------------
Running command: python -m src.sow_author_cli --input test_e2e_input.json --log-level INFO
⏳ This may take several minutes (4 subagents + upserter)...

[Agent execution logs stream here...]

Agent execution completed in 180.5s
Return code: 0

----------------------------------------------------------------------
Step 4: Analyzing Execution Logs
----------------------------------------------------------------------
Subagents detected: 4/4
  ✓ research_subagent
  ✓ course_data_extractor
  ✓ sow_author
  ✓ unified_critic
✓ Python upserter executed
  Document ID: sow_appna_20251015_a1b2c3d4
✅ Agent reported successful completion

----------------------------------------------------------------------
Step 5: Verifying SOW in Database
----------------------------------------------------------------------
Querying document: sow_appna_20251015_a1b2c3d4
✓ Document found in database
  Document $id: sow_appna_20251015_a1b2c3d4
  Course ID:    course_c84474
  Version:      1
  Status:       draft
  Created at:   2025-10-15T18:30:45.123+00:00
✓ Course ID matches
✓ Version is '1'
✓ Status is 'draft'
✓ Entries parsed: 12 lesson(s)
✓ Entries count meets minimum requirement (>=10)
✓ Metadata parsed: 8 field(s)
✓ Required metadata fields present
✓ Accessibility notes present (215 chars)

✅ SOW document validation PASSED

----------------------------------------------------------------------
Step 6: Cleaning Up Test Data
----------------------------------------------------------------------
Test SOW document ID: sow_appna_20251015_a1b2c3d4
Delete test SOW from database? (y/n): y
✓ Test SOW deleted: sow_appna_20251015_a1b2c3d4
✓ Test input JSON deleted: test_e2e_input.json

======================================================================
TEST SUMMARY
======================================================================

Test Steps:
  ✅ PASS - Prerequisites
  ✅ PASS - Input Created
  ✅ PASS - Agent Executed
  ✅ PASS - Logs Analyzed
  ✅ PASS - Database Verified
  ✅ PASS - Cleanup Completed

🎉 ALL TESTS PASSED!

The SOW Author Agent is functioning correctly end-to-end:
  ✓ Prerequisites validated
  ✓ Agent executed successfully
  ✓ All 4 subagents completed
  ✓ Python upserter persisted to database
  ✓ SOW document validated in Appwrite

======================================================================
```

## Success Criteria

The test passes if:

1. ✅ All prerequisites are validated
2. ✅ Agent CLI executes without errors (return code 0)
3. ✅ All 4 subagents complete successfully
4. ✅ Python upserter executes and reports document ID
5. ✅ Document exists in `default.Authored_SOW`
6. ✅ Document has correct `courseId`, `version`, and `status`
7. ✅ Entries field contains valid JSON with 10+ lessons
8. ✅ Metadata field contains valid JSON with required fields

## Troubleshooting

### Test fails at Prerequisites step

**Problem**: Course `course_c84474` not found

**Solution**: Create the course first:
```bash
# Use Appwrite console or API to create course document
```

**Problem**: SQA data not found

**Solution**: Ensure SQA data seeding completed successfully. Check `sqa_education.sqa_current` collection.

### Test fails at Agent Execution step

**Problem**: Agent crashes or times out

**Solutions**:
- Check `.mcp.json` credentials are valid
- Verify internet connectivity for web research
- Check Appwrite API quotas/limits
- Review agent logs for specific error messages

### Test fails at Database Verification step

**Problem**: Document not found in database

**Solution**: Check agent logs for upserter errors. Verify Appwrite write permissions.

**Problem**: Entries count < 10

**Solution**: This may indicate SOW Author subagent didn't complete properly. Check critic feedback in logs.

## Estimated Duration

- Prerequisites validation: ~5 seconds
- Agent execution: ~3-5 minutes (varies by LLM response times)
- Database verification: ~2 seconds
- **Total**: ~3-5 minutes

## Continuous Integration

To run this test in CI/CD:

```bash
#!/bin/bash
set -e

# Activate venv
source .venv/bin/activate

# Run test with timeout
timeout 600 python test_e2e_agent.py

# Test exits with code 0 on success, 1 on failure
```

## Notes

- The test creates a real SOW in the production database
- Always clean up test data after test completion
- Document IDs are timestamped for uniqueness
- Test can be run multiple times without conflicts
