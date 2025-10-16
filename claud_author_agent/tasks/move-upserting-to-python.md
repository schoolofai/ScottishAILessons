# Plan: Move SOW Upserting from Claude Agent to Python Code

## Database Schema Analysis

**Collection**: `default.Authored_SOW`

**Required Attributes**:
- `courseId` (string, max 50 chars, required)
- `version` (string, max 20 chars, required)
- `entries` (string, max 100000 chars, required) - JSON stringified
- `status` (enum: draft/published/archived, required)

**Optional Attributes**:
- `metadata` (string, max 10000 chars, default: '{}')
- `accessibility_notes` (string, max 2000 chars, default: '')

**Index**: `course_version_idx` on (courseId ASC, version DESC)

---

## Agent Output Structure

The SOW author produces `authored_sow_json` with this structure:
```json
{
  "metadata": {
    "subject": "mathematics",
    "level": "national-5",
    "total_lessons": 15,
    "coherence": "...",
    "accessibility_notes": "...",
    "engagement_notes": "..."
  },
  "entries": [
    { /* 10-20 lesson entries */ }
  ]
}
```

---

## Upserting Strategy

### Data Transformation Required

**Agent Output → Appwrite Document:**
1. Read `authored_sow_json` file (agent's output)
2. Extract `metadata.accessibility_notes` → top-level `accessibility_notes` field
3. Stringify `entries` array → `entries` string field
4. Stringify `metadata` object → `metadata` string field
5. Add required fields:
   - `courseId` = validated courseId from input
   - `version` = "1" (hardcoded for now)
   - `status` = "draft" (hardcoded)

### Document ID Generation

**Format**: `{subject}_{level}_v{version}_{executionId}`
**Example**: `mathematics_national-5_v1_20251015_174530`

---

## Implementation Plan

### 1. **Create Python Upserter Module** (NEW: `src/utils/sow_upserter.py`)

```python
async def upsert_sow_to_appwrite(
    sow_file_path: str,
    subject: str,
    level: str,
    course_id: str,
    execution_id: str,
    mcp_config_path: str
) -> str:
    """Upsert SOW to Appwrite deterministically.

    Process:
    1. Read authored_sow_json file
    2. Validate JSON structure (has metadata, entries)
    3. Transform to Appwrite schema:
       - Extract accessibility_notes from metadata
       - Stringify entries array
       - Stringify metadata object
       - Add courseId, version="1", status="draft"
    4. Generate document ID
    5. Create document in default.Authored_SOW
    6. Return document ID

    Args:
        sow_file_path: Path to authored_sow_json file
        subject: Subject slug (e.g., 'mathematics')
        level: Level slug (e.g., 'national-5')
        course_id: Validated courseId field value (e.g., 'course_c84474')
        execution_id: Execution timestamp ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Appwrite document ID

    Raises:
        ValueError: If SOW file invalid
        FileNotFoundError: If SOW file missing
    """
```

**Key Implementation Details:**
```python
# 1. Read and parse SOW
with open(sow_file_path) as f:
    sow_data = json.load(f)

# 2. Validate structure
if "metadata" not in sow_data or "entries" not in sow_data:
    raise ValueError("Invalid SOW: missing metadata or entries")

# 3. Transform to Appwrite schema
accessibility_notes = sow_data["metadata"].get("accessibility_notes", "")
entries_str = json.dumps(sow_data["entries"])
metadata_str = json.dumps(sow_data["metadata"])

# 4. Build document
document_data = {
    "courseId": course_id,
    "version": "1",  # Hardcoded for now
    "status": "draft",  # Hardcoded
    "entries": entries_str,
    "metadata": metadata_str,
    "accessibility_notes": accessibility_notes
}

# 5. Generate document ID
doc_id = f"{subject}_{level}_v1_{execution_id}"

# 6. Create document
from .appwrite_mcp import create_appwrite_document
result = await create_appwrite_document(
    database_id="default",
    collection_id="Authored_SOW",
    document_id=doc_id,
    data=document_data,
    permissions=["read(\"any\")"],
    mcp_config_path=mcp_config_path
)

return result['$id']
```

### 2. **Add Create Document Function** (`src/utils/appwrite_mcp.py`)

```python
async def create_appwrite_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    data: Dict[str, Any],
    permissions: List[str],
    mcp_config_path: str
) -> Dict[str, Any]:
    """Create a new document in Appwrite.

    Uses Appwrite SDK's create_document (not upsert).

    Returns:
        Document data including $id

    Raises:
        AppwriteException: If document ID already exists or other error
    """
    # Similar pattern to get_appwrite_document
    # Uses databases.create_document(...)
```

### 3. **Remove Upserter Subagent**

**File**: `src/sow_author_claude_client.py`

**Changes:**
```python
# DELETE from _get_subagent_definitions() (lines 102-105):
"upserter": AgentDefinition(
    name="upserter",
    prompt=(prompts_dir / "upserter_subagent_prompt.md").read_text()
)
```

### 4. **Update Orchestration Prompt**

**File**: `src/sow_author_claude_client.py` (lines 367-420)

**Changes:**
```markdown
# Change header:
Execute the following 4 subagents in sequence:  # Was: 5 subagents

# DELETE entire Step 5 (Upserter) section

# UPDATE Final Output section:
## Final Output
Confirm all 4 subagents completed successfully:
- ✓ Research pack created
- ✓ Course data extracted
- ✓ SOW authored
- ✓ Critic validation passed

The SOW will be persisted to Appwrite by the orchestration layer.
```

### 5. **Integrate Python Upserter in Execute Flow**

**File**: `src/sow_author_claude_client.py` (lines 182-202)

**Replace:**
```python
# OLD:
async for message in client.receive_messages():
    if isinstance(message, ResultMessage):
        appwrite_document_id = self._extract_document_id(message, filesystem)
        break

# NEW:
async for message in client.receive_messages():
    if isinstance(message, ResultMessage):
        logger.info("✓ Agent pipeline complete (4 subagents)")
        break

# Python upserting after agent completes
logger.info("Starting Python-based SOW upserting...")
from .utils.sow_upserter import upsert_sow_to_appwrite

sow_file = workspace_path / "authored_sow_json"
if not sow_file.exists():
    raise FileNotFoundError(
        f"Agent did not create authored_sow_json at {sow_file}. "
        f"Check agent logs for errors."
    )

appwrite_document_id = await upsert_sow_to_appwrite(
    sow_file_path=str(sow_file),
    subject=subject,
    level=level,
    course_id=courseId,
    execution_id=self.execution_id,
    mcp_config_path=str(self.mcp_config_path)
)

logger.info(f"✓ SOW upserted to Appwrite: {appwrite_document_id}")
```

### 6. **Delete Placeholder Method**

**File**: `src/sow_author_claude_client.py` (lines 422-439)

**DELETE:**
```python
def _extract_document_id(
    self,
    result_message: ResultMessage,
    filesystem: IsolatedFilesystem
) -> Optional[str]:
    # ... entire method
```

### 7. **Update Exports**

**File**: `src/utils/__init__.py`

**Add:**
```python
from .sow_upserter import upsert_sow_to_appwrite

__all__ = [
    # ... existing exports
    "upsert_sow_to_appwrite"
]
```

### 8. **Archive Upserter Prompt**

**Move (don't delete):**
- `src/prompts/upserter_subagent_prompt.md` → `src/prompts/_archived/upserter_subagent_prompt.md`

**Add note at top:**
```markdown
# ARCHIVED: Upserter Subagent (No Longer Used)

**Date Archived**: 2025-10-15
**Reason**: Upserting moved to deterministic Python code for reliability
**See**: `src/utils/sow_upserter.py` for current implementation

---

[Original prompt content below]
```

### 9. **Update Documentation**

**File**: `README.md`

**Changes:**
```markdown
# Change overview:
This agent takes a `{subject, level, courseId}` input and produces
a complete, validated SOW in the Appwrite database through a
4-subagent pipeline:  # Was: 5-subagent

1. **Research Subagent** → Web research → `research_pack_json`
2. **Course Data Extractor** → Appwrite MCP → `Course_data.txt`
3. **SOW Author** → Authoring → `authored_sow_json`
4. **Unified Critic** → Validation (with retry) → `sow_critic_result_json`
5. **Python Upserter** → Database write → Appwrite `default.Authored_SOW`  # NEW
```

**File**: `verify_setup.py`

**Remove from required files:**
```python
# Line ~46: DELETE
"src/prompts/upserter_subagent_prompt.md",
```

---

## Benefits

✅ **Deterministic Database Operations**: Consistent document structure, no LLM variability
✅ **Simplified Versioning**: Hardcoded `version="1"` for MVP, easy to extend later
✅ **Fail-Fast Error Handling**: Python exceptions with clear messages
✅ **Reduced Token Costs**: ~500-1000 tokens saved per execution
✅ **Easier Testing**: Can unit test upserter independently
✅ **Clear Responsibility**: Agent authors, Python persists

---

## Testing Strategy

### Test File: `test_sow_upserter.py`

**Complete integration test with Appwrite cleanup:**

```python
#!/usr/bin/env python3
"""Integration test for SOW upserter with real Appwrite database."""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from utils.sow_upserter import upsert_sow_to_appwrite
from utils.appwrite_mcp import get_appwrite_document, delete_appwrite_document


async def test_upsert_sow():
    """Test upserting with real Appwrite and cleanup fake data."""

    print("=" * 70)
    print("SOW Upserter Integration Test")
    print("=" * 70)
    print()

    # Test parameters
    subject = "mathematics"
    level = "national-5"
    course_id = "course_c84474"  # Real courseId field value
    execution_id = f"TEST_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    expected_doc_id = f"{subject}_{level}_v1_{execution_id}"

    print(f"Test Configuration:")
    print(f"  Subject:      {subject}")
    print(f"  Level:        {level}")
    print(f"  Course ID:    {course_id}")
    print(f"  Execution ID: {execution_id}")
    print(f"  Expected Doc ID: {expected_doc_id}")
    print()

    # Step 1: Create fake SOW file
    print("-" * 70)
    print("Step 1: Creating fake SOW file")
    print("-" * 70)

    fake_sow_data = {
        "metadata": {
            "subject": subject,
            "level": level,
            "total_lessons": 2,
            "coherence": "Test coherence narrative",
            "accessibility_notes": "Test dyslexia-friendly approach",
            "engagement_notes": "Test Scottish contexts"
        },
        "entries": [
            {
                "order": 1,
                "label": "Test Lesson 1",
                "lesson_type": "teach",
                "coherence": {
                    "block_name": "Test Block 1",
                    "block_index": 1,
                    "prerequisites": []
                },
                "policy": {
                    "calculator_allowed": True,
                    "assessment_notes": "Test notes"
                },
                "engagement_tags": ["edinburgh", "glasgow"],
                "outcomeRefs": ["O1"],
                "assessmentStandardRefs": [
                    {
                        "code": "AS1.1",
                        "description": "Test standard description",
                        "outcome": "O1"
                    }
                ],
                "lesson_plan": {
                    "summary": "Test lesson summary",
                    "card_structure": [
                        {
                            "card_number": 1,
                            "card_type": "starter",
                            "title": "Test Card",
                            "purpose": "Test purpose",
                            "standards_addressed": [],
                            "pedagogical_approach": "Test approach",
                            "cfu_strategy": "Test CFU",
                            "estimated_minutes": 5
                        }
                    ],
                    "lesson_flow_summary": "Test flow",
                    "multi_standard_integration_strategy": "Test strategy",
                    "misconceptions_embedded_in_cards": ["Test misconception"],
                    "assessment_progression": "Test progression"
                },
                "accessibility_profile": {
                    "key_terms_simplified": ["test term"],
                    "extra_time_strategy": "Test strategy",
                    "dyslexia_accommodations": ["Test accommodation"]
                },
                "estMinutes": 45,
                "lesson_instruction": "Test instruction"
            },
            {
                "order": 2,
                "label": "Test Lesson 2",
                "lesson_type": "revision",
                "coherence": {
                    "block_name": "Test Block 1",
                    "block_index": 1,
                    "prerequisites": []
                },
                "policy": {
                    "calculator_allowed": False
                },
                "engagement_tags": ["stirling"],
                "outcomeRefs": ["O1"],
                "assessmentStandardRefs": [],
                "lesson_plan": {
                    "summary": "Test revision summary",
                    "card_structure": [],
                    "lesson_flow_summary": "Test flow",
                    "multi_standard_integration_strategy": "Test strategy",
                    "misconceptions_embedded_in_cards": [],
                    "assessment_progression": "Test progression"
                },
                "accessibility_profile": {
                    "key_terms_simplified": [],
                    "extra_time_strategy": "Test strategy",
                    "dyslexia_accommodations": []
                },
                "estMinutes": 45,
                "lesson_instruction": "Test revision instruction"
            }
        ]
    }

    test_sow_path = f"/tmp/test_sow_{execution_id}.json"
    with open(test_sow_path, "w") as f:
        json.dump(fake_sow_data, f, indent=2)

    print(f"✓ Created fake SOW file: {test_sow_path}")
    print(f"  Total lessons: {len(fake_sow_data['entries'])}")
    print()

    # Step 2: Test upserting
    print("-" * 70)
    print("Step 2: Testing upsert_sow_to_appwrite()")
    print("-" * 70)

    try:
        doc_id = await upsert_sow_to_appwrite(
            sow_file_path=test_sow_path,
            subject=subject,
            level=level,
            course_id=course_id,
            execution_id=execution_id,
            mcp_config_path=".mcp.json"
        )

        print(f"✓ Upsert successful!")
        print(f"  Document ID: {doc_id}")
        print()

        # Verify document ID format
        assert doc_id == expected_doc_id, f"Document ID mismatch: {doc_id} != {expected_doc_id}"
        print(f"✓ Document ID format correct")

    except Exception as e:
        print(f"❌ Upsert failed: {e}")
        # Cleanup temp file
        Path(test_sow_path).unlink(missing_ok=True)
        return False

    # Step 3: Verify in database
    print()
    print("-" * 70)
    print("Step 3: Verifying document in Appwrite")
    print("-" * 70)

    try:
        doc = await get_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=doc_id,
            mcp_config_path=".mcp.json"
        )

        print(f"✓ Document retrieved from Appwrite")
        print(f"  Document $id: {doc['$id']}")
        print()

        # Verify required fields
        print("Verifying required fields:")

        assert doc['courseId'] == course_id, f"courseId mismatch: {doc['courseId']} != {course_id}"
        print(f"  ✓ courseId: {doc['courseId']}")

        assert doc['version'] == "1", f"version mismatch: {doc['version']} != '1'"
        print(f"  ✓ version: {doc['version']}")

        assert doc['status'] == "draft", f"status mismatch: {doc['status']} != 'draft'"
        print(f"  ✓ status: {doc['status']}")

        # Verify entries were stringified and can be parsed
        entries = json.loads(doc['entries'])
        assert len(entries) == 2, f"entries count mismatch: {len(entries)} != 2"
        assert entries[0]['order'] == 1, "First entry order should be 1"
        print(f"  ✓ entries: {len(entries)} lessons (JSON valid)")

        # Verify metadata was stringified and can be parsed
        metadata = json.loads(doc['metadata'])
        assert metadata['subject'] == subject, "metadata.subject mismatch"
        assert metadata['level'] == level, "metadata.level mismatch"
        print(f"  ✓ metadata: JSON valid")

        # Verify accessibility_notes
        assert doc['accessibility_notes'] == "Test dyslexia-friendly approach"
        print(f"  ✓ accessibility_notes: extracted from metadata")

        print()
        print("✅ All verifications passed!")

    except Exception as e:
        print(f"❌ Verification failed: {e}")
        # Still try cleanup
        await cleanup_test_document(doc_id)
        Path(test_sow_path).unlink(missing_ok=True)
        return False

    # Step 4: Cleanup
    print()
    print("-" * 70)
    print("Step 4: Cleaning up test data")
    print("-" * 70)

    cleanup_success = await cleanup_test_document(doc_id)

    # Cleanup temp file
    Path(test_sow_path).unlink(missing_ok=True)
    print(f"✓ Deleted temp file: {test_sow_path}")

    print()
    print("=" * 70)
    if cleanup_success:
        print("✅ TEST PASSED - All fake data cleaned up")
    else:
        print("⚠️  TEST PASSED - But cleanup had issues (check logs)")
    print("=" * 70)
    print()

    return cleanup_success


async def cleanup_test_document(doc_id: str) -> bool:
    """Delete test document from Appwrite.

    Args:
        doc_id: Document ID to delete

    Returns:
        True if cleanup successful, False otherwise
    """
    try:
        await delete_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=doc_id,
            mcp_config_path=".mcp.json"
        )

        print(f"✓ Deleted test document from Appwrite: {doc_id}")
        return True

    except Exception as e:
        print(f"❌ Failed to delete test document: {e}")
        print(f"   Manual cleanup required for: {doc_id}")
        return False


async def main():
    """Run the test."""
    try:
        success = await test_upsert_sow()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Test failed with unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
```

### Additional Function Required in `appwrite_mcp.py`

**Add delete function:**

```python
async def delete_appwrite_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    mcp_config_path: str
) -> None:
    """Delete a document from Appwrite.

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Collection ID (e.g., 'Authored_SOW')
        document_id: Document ID to delete
        mcp_config_path: Path to .mcp.json

    Raises:
        AppwriteException: If document doesn't exist or other error
    """
    logger.info(f"MCP Delete: Deleting document {document_id} from {database_id}.{collection_id}")

    try:
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        # Load credentials (same pattern as get_document)
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract Appwrite credentials
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

        endpoint = None
        api_key = None
        project_id = None

        for arg in args:
            if arg.startswith("APPWRITE_ENDPOINT="):
                endpoint = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_API_KEY="):
                api_key = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_PROJECT_ID="):
                project_id = arg.split("=", 1)[1]

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)

        # Delete document
        databases.delete_document(
            database_id=database_id,
            collection_id=collection_id,
            document_id=document_id
        )

        logger.info(f"✓ Document deleted: {document_id}")

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise
```

### Test Execution

```bash
# Make executable
chmod +x test_sow_upserter.py

# Run test
source .venv/bin/activate
python test_sow_upserter.py
```

**Expected Output:**
```
======================================================================
SOW Upserter Integration Test
======================================================================

Test Configuration:
  Subject:      mathematics
  Level:        national-5
  Course ID:    course_c84474
  Execution ID: TEST_20251015_180530
  Expected Doc ID: mathematics_national-5_v1_TEST_20251015_180530

----------------------------------------------------------------------
Step 1: Creating fake SOW file
----------------------------------------------------------------------
✓ Created fake SOW file: /tmp/test_sow_TEST_20251015_180530.json
  Total lessons: 2

----------------------------------------------------------------------
Step 2: Testing upsert_sow_to_appwrite()
----------------------------------------------------------------------
✓ Upsert successful!
  Document ID: mathematics_national-5_v1_TEST_20251015_180530

✓ Document ID format correct

----------------------------------------------------------------------
Step 3: Verifying document in Appwrite
----------------------------------------------------------------------
✓ Document retrieved from Appwrite
  Document $id: mathematics_national-5_v1_TEST_20251015_180530

Verifying required fields:
  ✓ courseId: course_c84474
  ✓ version: 1
  ✓ status: draft
  ✓ entries: 2 lessons (JSON valid)
  ✓ metadata: JSON valid
  ✓ accessibility_notes: extracted from metadata

✅ All verifications passed!

----------------------------------------------------------------------
Step 4: Cleaning up test data
----------------------------------------------------------------------
✓ Deleted test document from Appwrite: mathematics_national-5_v1_TEST_20251015_180530
✓ Deleted temp file: /tmp/test_sow_TEST_20251015_180530.json

======================================================================
✅ TEST PASSED - All fake data cleaned up
======================================================================
```

---

## Files Modified

1. ✨ **NEW**: `src/utils/sow_upserter.py` (~150 lines)
2. ✏️ `src/utils/appwrite_mcp.py` (+50 lines - add create_document)
3. ✏️ `src/sow_author_claude_client.py` (-60 lines, +15 lines)
4. ✏️ `src/utils/__init__.py` (+1 export)
5. 📦 `src/prompts/_archived/upserter_subagent_prompt.md` (moved)
6. ✏️ `README.md` (update pipeline description)
7. ✏️ `verify_setup.py` (remove upserter check)

**Total Changes**: ~200 lines added, ~70 lines removed
**Risk Level**: Low (file interface unchanged, only who writes to DB)
