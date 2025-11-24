"""Diagram upserter utilities for persisting JSXGraph diagrams to Appwrite.

Provides functions for:
1. Upserting single lesson diagram to Appwrite lesson_diagrams collection
2. Batch upsert for multiple diagrams
3. Fast-fail error handling (no silent failures)

Collection Schema (default.lesson_diagrams):
    - lessonTemplateId (string, required): Foreign key to lesson_templates
    - cardId (string, required): Card identifier (e.g., "card_001")
    - jsxgraph_json (string, required): Serialized JSXGraph JSON
    - image_base64 (string, required): Base64-encoded PNG image
    - diagram_type (string, required): geometry|algebra|statistics|mixed
    - visual_critique_score (double, required): Final accepted score (0.0-1.0)
    - critique_iterations (integer, required): Number of refinement iterations (1-3)
    - critique_feedback (string, required): Serialized critique history (JSON)
    - execution_id (string, required): Unique generation execution ID
    - Unique index: (lessonTemplateId, cardId, diagram_context)

Usage:
    from diagram_upserter import upsert_lesson_diagram, batch_upsert_diagrams

    # Upsert single diagram
    diagram_doc = await upsert_lesson_diagram(
        lesson_template_id="lesson_template_001",
        card_id="card_002",
        jsxgraph_json='{"board": {...}, "elements": [...]}',
        image_base64="iVBORw0KGgoAAAANS...",
        diagram_type="geometry",
        visual_critique_score=0.87,
        critique_iterations=2,
        critique_feedback=[...],
        execution_id="exec_20250131_123456"
    )

    # Batch upsert multiple diagrams
    results = await batch_upsert_diagrams(diagrams_data)
"""

import hashlib
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .appwrite_mcp import create_appwrite_document, update_appwrite_document, get_appwrite_document
from .storage_uploader import upload_diagram_image

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Diagram Type Normalization
# ═══════════════════════════════════════════════════════════════

def normalize_diagram_type(diagram_type: str) -> str:
    """Normalize agent-generated diagram_type to valid enum values.

    Maps descriptive diagram types from the agent (e.g., 'trigonometry',
    'inverse_trigonometry', 'mixed_practice') to the Appwrite enum schema
    values: geometry, algebra, statistics, mixed.

    Args:
        diagram_type: Raw diagram type from agent (any string)

    Returns:
        str: Normalized diagram type matching Appwrite enum

    Examples:
        'trigonometry' -> 'geometry'
        'inverse_trigonometry' -> 'geometry'
        'mixed_practice' -> 'mixed'
        'algebraic_equations' -> 'algebra'
        'histogram' -> 'statistics'
    """
    diagram_type_lower = diagram_type.lower().replace("_", " ")

    # Trigonometry and geometric concepts
    if "trigonometry" in diagram_type_lower or "trig" in diagram_type_lower:
        logger.debug(f"Normalizing '{diagram_type}' -> 'geometry' (trigonometry)")
        return "geometry"
    elif "inverse" in diagram_type_lower and ("trig" in diagram_type_lower or "function" in diagram_type_lower):
        logger.debug(f"Normalizing '{diagram_type}' -> 'geometry' (inverse functions)")
        return "geometry"
    elif "geometry" in diagram_type_lower or "geometric" in diagram_type_lower:
        logger.debug(f"Normalizing '{diagram_type}' -> 'geometry'")
        return "geometry"

    # Practice and mixed content
    elif "practice" in diagram_type_lower or "mixed" in diagram_type_lower:
        logger.debug(f"Normalizing '{diagram_type}' -> 'mixed' (practice/mixed)")
        return "mixed"

    # Algebraic content
    elif "algebra" in diagram_type_lower or "equation" in diagram_type_lower or "expression" in diagram_type_lower:
        logger.debug(f"Normalizing '{diagram_type}' -> 'algebra'")
        return "algebra"

    # Statistical content
    elif "statistics" in diagram_type_lower or "stat" in diagram_type_lower or "histogram" in diagram_type_lower or "chart" in diagram_type_lower:
        logger.debug(f"Normalizing '{diagram_type}' -> 'statistics'")
        return "statistics"

    # Default fallback with warning
    else:
        logger.warning(
            f"Unknown diagram_type '{diagram_type}', defaulting to 'geometry'. "
            f"Consider updating normalize_diagram_type() function."
        )
        return "geometry"


# ═══════════════════════════════════════════════════════════════
# Single Diagram Upsert
# ═══════════════════════════════════════════════════════════════

async def upsert_lesson_diagram(
    lesson_template_id: str,
    card_id: str,
    jsxgraph_json: str,
    image_base64: str,
    diagram_type: str,
    visual_critique_score: float,
    critique_iterations: int,
    critique_feedback: List[Dict[str, Any]],
    execution_id: str,
    diagram_context: Optional[str] = None,
    diagram_description: Optional[str] = None,
    diagram_index: int = 0,
    mcp_config_path: str = ".mcp.json"
) -> Dict[str, Any]:
    """Upsert lesson diagram to Appwrite lesson_diagrams collection.

    Implements FR-044: Persist diagram data to Appwrite with upsert semantics.
    - If (lessonTemplateId, cardId, diagram_context, diagram_index) combination exists: UPDATE
    - If not exists: CREATE

    Args:
        lesson_template_id: Foreign key to lesson_templates
        card_id: Card identifier (e.g., "card_001", "card_002")
        jsxgraph_json: Serialized JSXGraph JSON string
        image_base64: Base64-encoded PNG image
        diagram_type: Diagram category (geometry|algebra|statistics|mixed)
        visual_critique_score: Final accepted score (0.0-1.0)
        critique_iterations: Number of refinement iterations (1-3)
        critique_feedback: List of VisualCritique dictionaries
        execution_id: Unique generation execution ID (timestamp-based)
        diagram_context: Diagram usage context ("lesson" for explainer, "cfu" for assessment) - optional for backward compatibility
        diagram_description: Optional 1-2 sentence description for downstream LLMs
        diagram_index: Diagram index for multi-diagram cards (0-indexed, default 0 for backward compatibility)
        mcp_config_path: Path to MCP configuration file

    Returns:
        dict: Created/updated Appwrite document

    Raises:
        ValueError: If validation fails (invalid score, missing fields, etc.)
        Exception: If Appwrite operation fails (fast-fail - FR-047)
    """
    logger.info(
        f"Upserting lesson diagram: lessonTemplateId={lesson_template_id}, "
        f"cardId={card_id}, diagram_index={diagram_index}, score={visual_critique_score}, iterations={critique_iterations}"
    )

    # Validation (FR-044: Input validation before persistence)
    if not lesson_template_id:
        raise ValueError("lessonTemplateId is required")
    if not card_id:
        raise ValueError("cardId is required")
    if not jsxgraph_json:
        raise ValueError("jsxgraph_json is required")
    if not image_base64:
        raise ValueError("image_base64 is required")
    if not diagram_type:
        raise ValueError("diagram_type is required")

    # Normalize diagram_type before validation (maps agent values to schema enums)
    diagram_type = normalize_diagram_type(diagram_type)

    # Validate diagram_type enum (should always pass after normalization)
    valid_types = ["geometry", "algebra", "statistics", "mixed"]
    if diagram_type not in valid_types:
        raise ValueError(
            f"Invalid diagram_type '{diagram_type}'. "
            f"Must be one of: {', '.join(valid_types)}"
        )

    # Validate diagram_context if provided
    if diagram_context is not None:
        valid_contexts = ["lesson", "cfu"]
        if diagram_context not in valid_contexts:
            raise ValueError(
                f"Invalid diagram_context '{diagram_context}'. "
                f"Must be one of: {', '.join(valid_contexts)} (or None for backward compatibility)"
            )
        logger.info(f"Diagram context: {diagram_context}")

    # Upload image to Appwrite Storage and get file ID
    logger.info("Uploading image to Appwrite Storage...")
    try:
        image_file_id = await upload_diagram_image(
            lesson_template_id=lesson_template_id,
            card_id=card_id,
            image_base64=image_base64,
            diagram_context=diagram_context,  # Pass diagram_context for unique file IDs (lesson vs CFU)
            diagram_index=diagram_index,  # Pass diagram_index for unique file IDs per diagram
            mcp_config_path=mcp_config_path
        )
        logger.info(f"✓ Image uploaded to Storage: {image_file_id}")
    except Exception as e:
        # Fast-fail on storage upload failure
        raise Exception(
            f"Failed to upload image to Storage for lessonTemplateId='{lesson_template_id}', "
            f"cardId='{card_id}', diagram_index={diagram_index}: {str(e)}"
        ) from e

    # Validate score range (0.0-1.0)
    if not (0.0 <= visual_critique_score <= 1.0):
        raise ValueError(
            f"visual_critique_score must be between 0.0 and 1.0, got {visual_critique_score}"
        )

    # Validate iterations (1-3)
    if not (1 <= critique_iterations <= 3):
        raise ValueError(
            f"critique_iterations must be between 1 and 3, got {critique_iterations}"
        )

    # Serialize critique_feedback to JSON string
    critique_feedback_json = json.dumps(critique_feedback)

    # Check if document exists (query by lessonTemplateId + cardId)
    # Note: Appwrite doesn't have native upsert, so we check-then-create/update
    try:
        from .appwrite_mcp import list_appwrite_documents

        # Build queries - include diagram_context and diagram_index to uniquely identify diagram
        queries = [
            f'equal("lessonTemplateId", "{lesson_template_id}")',
            f'equal("cardId", "{card_id}")',
            f'equal("diagram_index", {diagram_index})'  # Include diagram_index in query
        ]
        if diagram_context is not None:
            queries.append(f'equal("diagram_context", "{diagram_context}")')

        existing_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_diagrams",
            queries=queries,
            mcp_config_path=mcp_config_path
        )

        if existing_docs and len(existing_docs) > 0:
            # Update existing document
            existing_doc_id = existing_docs[0]["$id"]
            logger.info(
                f"Found existing diagram {existing_doc_id} - updating "
                f"(force regeneration or refinement)"
            )

            # Prepare update data
            update_data = {
                "jsxgraph_json": jsxgraph_json,
                "image_file_id": image_file_id,  # Storage reference instead of base64
                "diagram_type": diagram_type,
                "visual_critique_score": visual_critique_score,
                "critique_iterations": critique_iterations,
                "critique_feedback": critique_feedback_json,
                "execution_id": execution_id,
                "failure_reason": None  # Clear any previous failure reason on success
                # lessonTemplateId, cardId, and diagram_index are immutable (not updated)
            }

            # Add diagram_context if provided (optional for backward compatibility)
            if diagram_context is not None:
                update_data["diagram_context"] = diagram_context

            # Add diagram_description if provided (optional for backward compatibility)
            if diagram_description is not None:
                update_data["diagram_description"] = diagram_description

            updated_doc = await update_appwrite_document(
                database_id="default",
                collection_id="lesson_diagrams",
                document_id=existing_doc_id,
                data=update_data,
                mcp_config_path=mcp_config_path
            )

            logger.info(f"✓ Updated lesson diagram: {existing_doc_id}")
            return updated_doc

        else:
            # Create new document with hash-based ID (Appwrite 36-char limit)
            # Format: dgm_<8-char-hash> (12 chars total)
            # Hash is deterministic MD5 of lessonTemplateId + cardId + diagram_context + diagram_index for reproducibility
            # Include diagram_context and diagram_index in hash to generate unique IDs for each diagram
            context_suffix = f"_{diagram_context}" if diagram_context else ""
            combined = f"{lesson_template_id}_{card_id}{context_suffix}_{diagram_index}"
            hash_suffix = hashlib.md5(combined.encode()).hexdigest()[:8]
            document_id = f"dgm_{hash_suffix}"

            logger.debug(
                f"Generated document ID: {document_id} "
                f"(hash of {lesson_template_id}_{card_id}{context_suffix}_{diagram_index})"
            )

            # Prepare create data
            create_data = {
                "lessonTemplateId": lesson_template_id,
                "cardId": card_id,
                "diagram_index": diagram_index,  # Add diagram_index for multi-diagram support
                "jsxgraph_json": jsxgraph_json,
                "image_file_id": image_file_id,  # Storage reference instead of base64
                "diagram_type": diagram_type,
                "visual_critique_score": visual_critique_score,
                "critique_iterations": critique_iterations,
                "critique_feedback": critique_feedback_json,
                "execution_id": execution_id,
                "failure_reason": None  # No failure on successful creation
            }

            # Add diagram_context if provided (optional for backward compatibility)
            if diagram_context is not None:
                create_data["diagram_context"] = diagram_context

            # Add diagram_description if provided (optional for backward compatibility)
            if diagram_description is not None:
                create_data["diagram_description"] = diagram_description

            created_doc = await create_appwrite_document(
                database_id="default",
                collection_id="lesson_diagrams",
                document_id=document_id,
                data=create_data,
                mcp_config_path=mcp_config_path
            )

            logger.info(f"✓ Created lesson diagram: {document_id}")
            return created_doc

    except ValueError:
        # Re-raise validation errors
        raise

    except Exception as e:
        # FR-047: Throw exception on persistence failure (fast-fail, no fallback)
        raise Exception(
            f"Failed to upsert lesson diagram for lessonTemplateId='{lesson_template_id}', "
            f"cardId='{card_id}': {str(e)}"
        ) from e


# ═══════════════════════════════════════════════════════════════
# Batch Upsert
# ═══════════════════════════════════════════════════════════════

async def batch_upsert_diagrams(
    diagrams_data: List[Dict[str, Any]],
    mcp_config_path: str = ".mcp.json"
) -> Dict[str, Any]:
    """Batch upsert multiple lesson diagrams to Appwrite.

    Implements US2 batch processing with partial success model (FR-050).
    Continues on individual failures and collects errors for reporting.

    Args:
        diagrams_data: List of diagram data dictionaries with fields:
            - lesson_template_id (str)
            - card_id (str)
            - jsxgraph_json (str)
            - image_base64 (str)
            - diagram_type (str)
            - visual_critique_score (float)
            - critique_iterations (int)
            - critique_feedback (list)
            - execution_id (str)
            - diagram_context (str, optional): "lesson" or "cfu" - context for diagram usage
            - diagram_description (str, optional): Brief description for downstream LLMs
            - diagram_index (int, optional): Diagram index for multi-diagram cards (default 0)
        mcp_config_path: Path to MCP configuration file

    Returns:
        dict: Batch results with keys:
            - total: Total diagrams attempted
            - succeeded: Number of successful upserts
            - failed: Number of failed upserts
            - documents: List of created/updated documents (successful)
            - errors: List of error dictionaries with context (failed)

    Raises:
        Never raises - returns partial success results with errors array
    """
    logger.info(f"Batch upserting {len(diagrams_data)} lesson diagrams...")

    total = len(diagrams_data)
    succeeded = 0
    failed = 0
    documents = []
    errors = []

    for idx, diagram_data in enumerate(diagrams_data, start=1):
        try:
            # Extract fields from diagram_data
            lesson_template_id = diagram_data["lesson_template_id"]
            card_id = diagram_data["card_id"]
            diagram_index = diagram_data.get("diagram_index", 0)  # Extract diagram_index (default 0)

            logger.info(
                f"[{idx}/{total}] Upserting diagram: "
                f"lessonTemplateId={lesson_template_id}, cardId={card_id}, diagram_index={diagram_index}"
            )

            # Upsert single diagram
            doc = await upsert_lesson_diagram(
                lesson_template_id=lesson_template_id,
                card_id=card_id,
                jsxgraph_json=diagram_data["jsxgraph_json"],
                image_base64=diagram_data["image_base64"],
                diagram_type=diagram_data["diagram_type"],
                visual_critique_score=diagram_data["visual_critique_score"],
                critique_iterations=diagram_data["critique_iterations"],
                critique_feedback=diagram_data["critique_feedback"],
                execution_id=diagram_data["execution_id"],
                diagram_context=diagram_data.get("diagram_context"),  # Optional - may not be present
                diagram_description=diagram_data.get("diagram_description"),  # Optional - brief description for LLMs
                diagram_index=diagram_index,  # Pass diagram_index for multi-diagram support
                mcp_config_path=mcp_config_path
            )

            documents.append(doc)
            succeeded += 1

        except Exception as e:
            # FR-050: Partial success model - continue on failure, collect errors
            failed += 1
            error_entry = {
                "lesson_template_id": diagram_data.get("lesson_template_id", "UNKNOWN"),
                "card_id": diagram_data.get("card_id", "UNKNOWN"),
                "error": str(e),
                "exception_type": type(e).__name__,
                "index": idx
            }
            errors.append(error_entry)
            logger.error(
                f"[{idx}/{total}] Failed to upsert diagram: "
                f"lessonTemplateId={error_entry['lesson_template_id']}, "
                f"cardId={error_entry['card_id']}, error={str(e)}"
            )

    # Log batch summary
    logger.info(
        f"Batch upsert complete: {succeeded} succeeded, {failed} failed out of {total}"
    )

    return {
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "documents": documents,
        "errors": errors
    }


# ═══════════════════════════════════════════════════════════════
# Diagram Existence Check (for Batch Skip Logic)
# ═══════════════════════════════════════════════════════════════

async def check_existing_diagrams(
    lesson_template_id: str,
    mcp_config_path: str = ".mcp.json"
) -> List[str]:
    """Check which cards already have diagrams for a lesson template.

    Implements US2 batch skip logic: skip lessons with existing diagrams (unless --force).

    Args:
        lesson_template_id: Lesson template ID to check
        mcp_config_path: Path to MCP configuration file

    Returns:
        list: List of card IDs that already have diagrams

    Raises:
        Exception: If Appwrite query fails (fast-fail)
    """
    logger.info(f"Checking existing diagrams for lessonTemplateId={lesson_template_id}")

    try:
        from .appwrite_mcp import list_appwrite_documents

        existing_diagrams = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_diagrams",
            queries=[
                f'equal("lessonTemplateId", "{lesson_template_id}")'
            ],
            mcp_config_path=mcp_config_path
        )

        card_ids = [diagram["cardId"] for diagram in existing_diagrams]
        logger.info(
            f"Found {len(card_ids)} existing diagrams for lesson {lesson_template_id}: "
            f"{', '.join(card_ids) if card_ids else 'none'}"
        )

        return card_ids

    except Exception as e:
        raise Exception(
            f"Failed to check existing diagrams for lessonTemplateId='{lesson_template_id}': {str(e)}"
        ) from e
