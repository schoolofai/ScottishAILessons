"""Walkthrough Upserter - Upsert generated walkthroughs to us_walkthroughs collection.

This module provides functionality to:
- Read generated walkthrough template
- Validate walkthrough structure
- Compress and format for Appwrite storage
- Upsert to us_walkthroughs collection
"""

import base64
import gzip
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from ..models.walkthrough_models import (
    WalkthroughDocument,
    QuestionWalkthrough,
    WalkthroughStep,
    CommonError,
)

logger = logging.getLogger(__name__)


def compress_json_content(data: str) -> str:
    """Compress JSON string using gzip and encode as base64.

    Args:
        data: JSON string to compress

    Returns:
        Base64-encoded gzip-compressed string
    """
    # Encode to bytes, compress with gzip, then base64 encode
    compressed = gzip.compress(data.encode('utf-8'))
    return base64.b64encode(compressed).decode('ascii')


def decompress_json_content(compressed: str) -> str:
    """Decompress base64-encoded gzip-compressed JSON string.

    Args:
        compressed: Base64-encoded gzip-compressed string

    Returns:
        Original JSON string
    """
    # Decode base64, decompress gzip, decode to string
    decoded = base64.b64decode(compressed.encode('ascii'))
    return gzip.decompress(decoded).decode('utf-8')


def parse_walkthrough_template(template_path: Path) -> QuestionWalkthrough:
    """Parse walkthrough template JSON into Pydantic model.

    Args:
        template_path: Path to walkthrough_template.json

    Returns:
        QuestionWalkthrough model instance

    Raises:
        FileNotFoundError: If template file doesn't exist
        ValueError: If template structure is invalid
    """
    if not template_path.exists():
        raise FileNotFoundError(f"Walkthrough template not found: {template_path}")

    with open(template_path, 'r') as f:
        data = json.load(f)

    # Parse steps
    steps = []
    for step_data in data.get("steps", []):
        step = WalkthroughStep(
            bullet=step_data.get("bullet", 1),
            label=step_data.get("label", ""),
            process=step_data.get("process", ""),
            working=step_data.get("working", ""),
            working_latex=step_data.get("working_latex", ""),
            marks_earned=step_data.get("marks_earned", 1),
            examiner_notes=step_data.get("examiner_notes")
        )
        steps.append(step)

    # Parse common errors
    # Note: LLM generates varying field names across runs:
    # Variants seen:
    #   - error_description, why_its_wrong, correct_approach, bullets_affected
    #   - error_description, why_wrong, incorrect_working, bullets_lost
    # Model expects: description, why_marks_lost, prevention_tip
    errors = []
    for error_data in data.get("common_errors", []):
        # Map LLM field name variants to model field names
        description = (
            error_data.get("error_description") or
            error_data.get("description", "")
        )
        why_marks_lost = (
            error_data.get("why_its_wrong") or
            error_data.get("why_wrong") or
            error_data.get("why_marks_lost", "")
        )
        prevention_tip = (
            error_data.get("correct_approach") or
            error_data.get("prevention_tip") or
            error_data.get("incorrect_working", "")  # Fallback to show what's incorrect
        )

        error = CommonError(
            error_type=error_data.get("error_type", "calculation"),
            description=description,
            why_marks_lost=why_marks_lost,
            prevention_tip=prevention_tip
        )
        errors.append(error)

    # Create QuestionWalkthrough
    walkthrough = QuestionWalkthrough(
        question_stem=data.get("question_stem", ""),
        question_stem_latex=data.get("question_stem_latex", ""),
        topic_tags=data.get("topic_tags", []),
        total_marks=data.get("total_marks", 0),
        steps=steps,
        common_errors=errors,
        examiner_summary=data.get("examiner_summary", ""),
        diagram_refs=data.get("diagram_refs", [])
    )

    return walkthrough


def create_walkthrough_document(
    walkthrough: QuestionWalkthrough,
    paper_id: str,
    question_number: str,
    paper_metadata: Dict[str, Any],
    model_version: str,
    status: str = "draft"
) -> WalkthroughDocument:
    """Create a WalkthroughDocument ready for database storage.

    Args:
        walkthrough: Parsed walkthrough content
        paper_id: Paper document ID
        question_number: Question number
        paper_metadata: Paper metadata (subject, level, year, paper_code)
        model_version: Version of the author agent
        status: Publication status (draft, published, archived)

    Returns:
        WalkthroughDocument instance
    """
    return WalkthroughDocument(
        paper_id=paper_id,
        question_number=question_number,
        paper_code=paper_metadata.get("paper_code", ""),
        year=paper_metadata.get("year", 0),
        subject=paper_metadata.get("subject", ""),
        level=paper_metadata.get("level", ""),
        marks=walkthrough.total_marks,
        walkthrough=walkthrough,
        status=status,
        model_version=model_version,
        generation_metadata=None,
        catalog_version=None
    )


async def check_walkthrough_exists(
    walkthrough_id: str,
    mcp_config_path: str = ".mcp.json"
) -> bool:
    """Check if a walkthrough already exists in the database.

    Uses direct Appwrite SDK access for standalone CLI usage.

    Args:
        walkthrough_id: Walkthrough document ID (e.g., "mathematics-n5-2023-X847-75-01-q1")
        mcp_config_path: Path to MCP config file

    Returns:
        True if walkthrough exists, False otherwise
    """
    try:
        from .appwrite_infrastructure import _get_appwrite_client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        # Try to fetch the document
        databases.get_document(
            database_id="sqa_education",
            collection_id="us_walkthroughs",
            document_id=walkthrough_id
        )
        return True

    except AppwriteException as e:
        if e.code == 404:
            return False
        # Re-raise other errors (permissions, network, etc.)
        logger.error(f"Error checking walkthrough existence: {e.message} (code: {e.code})")
        raise

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")


async def list_walkthroughs_by_paper_ids(
    paper_ids: List[str],
    mcp_config_path: str = ".mcp.json"
) -> set:
    """List all existing walkthrough document IDs for the given paper IDs.

    Queries the us_walkthroughs collection to find all walkthroughs matching
    the provided paper IDs. Used for efficient batch skip-existing checking.

    Args:
        paper_ids: List of paper IDs to check (e.g., ["mathematics-n5-2023-X847-75-01"])
        mcp_config_path: Path to MCP config file

    Returns:
        Set of existing walkthrough document IDs

    Raises:
        ImportError: If Appwrite SDK not installed
        AppwriteException: If query fails
    """
    if not paper_ids:
        return set()

    try:
        from .appwrite_infrastructure import _get_appwrite_client
        from appwrite.services.databases import Databases
        from appwrite.query import Query
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        existing_ids = set()

        # Query in batches of 25 paper_ids (Appwrite Query.equal limit)
        batch_size = 25
        for i in range(0, len(paper_ids), batch_size):
            batch = paper_ids[i:i + batch_size]

            # Query walkthroughs where paper_id is in the batch
            result = databases.list_documents(
                database_id="sqa_education",
                collection_id="us_walkthroughs",
                queries=[
                    Query.equal("paper_id", batch),
                    Query.limit(500)  # Generous limit for papers with many questions
                ]
            )

            for doc in result.get("documents", []):
                existing_ids.add(doc["$id"])

            logger.debug(f"Batch query found {len(result.get('documents', []))} existing walkthroughs")

        logger.info(f"Found {len(existing_ids)} existing walkthroughs for {len(paper_ids)} papers")
        return existing_ids

    except AppwriteException as e:
        logger.error(f"Error listing walkthroughs: {e.message} (code: {e.code})")
        raise

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")


async def delete_walkthrough(
    walkthrough_id: str,
    mcp_config_path: str = ".mcp.json"
) -> bool:
    """Delete a walkthrough document from the database.

    Used by --force mode to delete existing walkthroughs before regenerating.

    Args:
        walkthrough_id: Walkthrough document ID to delete
        mcp_config_path: Path to MCP config file

    Returns:
        True if deleted successfully, False if document didn't exist

    Raises:
        ImportError: If Appwrite SDK not installed
        AppwriteException: If deletion fails (other than 404)
    """
    try:
        from .appwrite_infrastructure import _get_appwrite_client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        databases.delete_document(
            database_id="sqa_education",
            collection_id="us_walkthroughs",
            document_id=walkthrough_id
        )

        logger.info(f"Deleted walkthrough: {walkthrough_id}")
        return True

    except AppwriteException as e:
        if e.code == 404:
            logger.debug(f"Walkthrough not found (nothing to delete): {walkthrough_id}")
            return False
        logger.error(f"Error deleting walkthrough: {e.message} (code: {e.code})")
        raise

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")


async def upsert_walkthrough_via_mcp(
    document: WalkthroughDocument,
    mcp_config_path: str
) -> str:
    """Upsert walkthrough document to Appwrite.

    Uses direct Appwrite SDK access for standalone CLI usage.

    Args:
        document: WalkthroughDocument to upsert
        mcp_config_path: Path to MCP configuration

    Returns:
        Document ID of upserted record

    Raises:
        ImportError: If Appwrite SDK not installed
        AppwriteException: If upsert fails
    """
    try:
        from .appwrite_infrastructure import _get_appwrite_client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException
        from appwrite.permission import Permission
        from appwrite.role import Role

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        # Generate document ID
        doc_id = document.generate_document_id()

        # Convert document to Appwrite-compatible format
        # Store walkthrough as gzip + base64 compressed JSON string (per spec)
        walkthrough_json = document.walkthrough.model_dump_json()
        walkthrough_data = compress_json_content(walkthrough_json)
        logger.debug(f"Compressed walkthrough: {len(walkthrough_json)} -> {len(walkthrough_data)} bytes")

        # Generate ISO 8601 timestamp for last_modified
        from datetime import datetime, timezone
        last_modified = datetime.now(timezone.utc).isoformat()

        doc_data = {
            "paper_id": document.paper_id,
            "question_number": document.question_number,
            "paper_code": document.paper_code,
            "year": document.year,
            "subject": document.subject,
            "level": document.level,
            "marks": document.marks,
            "walkthrough_content": walkthrough_data,  # Field name matches Appwrite collection schema
            "status": document.status,
            "model_version": document.model_version,
            "last_modified": last_modified,  # Required datetime field
        }

        if document.generation_metadata:
            doc_data["generation_metadata"] = json.dumps(document.generation_metadata)
        if document.catalog_version:
            doc_data["catalog_version"] = document.catalog_version

        # Check if document exists
        exists = await check_walkthrough_exists(doc_id, mcp_config_path)

        if exists:
            # Update existing document
            logger.info(f"Updating existing walkthrough: {doc_id}")
            result = databases.update_document(
                database_id="sqa_education",
                collection_id="us_walkthroughs",
                document_id=doc_id,
                data=doc_data
            )
        else:
            # Create new document
            logger.info(f"Creating new walkthrough: {doc_id}")
            result = databases.create_document(
                database_id="sqa_education",
                collection_id="us_walkthroughs",
                document_id=doc_id,
                data=doc_data,
                permissions=[
                    Permission.read(Role.any())
                ]
            )

        logger.info(f"✅ Walkthrough upserted: {result['$id']}")
        return result['$id']

    except AppwriteException as e:
        logger.error(f"Failed to upsert walkthrough: {e.message} (code: {e.code})")
        raise

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")


async def upsert_walkthrough(
    template_path: Path,
    paper_id: str,
    question_number: str,
    paper_metadata: Dict[str, Any],
    mcp_config_path: str,
    model_version: str = "walkthrough_author_v1",
    status: str = "draft"
) -> str:
    """Complete workflow to upsert a walkthrough from template file.

    Args:
        template_path: Path to walkthrough_template.json
        paper_id: Paper document ID
        question_number: Question number
        paper_metadata: Paper metadata
        mcp_config_path: Path to MCP configuration
        model_version: Version of the author agent
        status: Publication status

    Returns:
        Document ID of upserted record
    """
    logger.info(f"Upserting walkthrough: {paper_id} Q{question_number}")

    # Parse template
    walkthrough = parse_walkthrough_template(template_path)
    logger.info(f"Parsed walkthrough with {len(walkthrough.steps)} steps")

    # Create document
    document = create_walkthrough_document(
        walkthrough=walkthrough,
        paper_id=paper_id,
        question_number=question_number,
        paper_metadata=paper_metadata,
        model_version=model_version,
        status=status
    )

    # Generate document ID
    doc_id = document.generate_document_id()
    logger.info(f"Generated document ID: {doc_id}")

    # Upsert via MCP
    result_id = await upsert_walkthrough_via_mcp(document, mcp_config_path)

    logger.info(f"✅ Walkthrough upserted: {result_id}")
    return result_id
