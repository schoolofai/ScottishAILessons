"""SQA Marking Scheme Upserter - Database persistence for extracted marking instructions.

Handles upserting of extracted SQA marking instructions to Appwrite database.
Creates/updates marking_schemes, general_principles, solutions, generic_scheme,
and illustrative_scheme documents.

Based on design specification: docs/claud_author_agent/understanding_standards.md
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..models.sqa_extraction_models import (
    MarkingInstructionsOutput,
    MarkingSchemeMetadata,
    GeneralPrinciple,
    Solution,
    GenericMark,
    IllustrativeMark
)

logger = logging.getLogger(__name__)

DATABASE_ID = "default"

# Collection IDs (prefixed with sqa_ for namespacing)
MARKING_SCHEMES_COLLECTION = "sqa_marking_schemes"
GENERAL_PRINCIPLES_COLLECTION = "sqa_general_principles"
SOLUTIONS_COLLECTION = "sqa_solutions"
GENERIC_SCHEME_COLLECTION = "sqa_generic_scheme"
ILLUSTRATIVE_SCHEME_COLLECTION = "sqa_illustrative_scheme"
PAPERS_COLLECTION = "sqa_papers"
QUESTIONS_COLLECTION = "sqa_questions"


async def upsert_marking_scheme(
    marking_scheme: MarkingSchemeMetadata,
    mcp_config_path: str
) -> str:
    """Upsert a marking scheme to the database.

    Args:
        marking_scheme: Validated marking scheme metadata
        mcp_config_path: Path to .mcp.json

    Returns:
        Marking scheme document ID

    Raises:
        Exception: If upsert fails
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        update_appwrite_document
    )

    logger.info(f"📋 Upserting marking scheme for paper: {marking_scheme.paper_id}")

    # Check if marking scheme already exists for this paper
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=MARKING_SCHEMES_COLLECTION,
        queries=[f'equal("paper_id", "{marking_scheme.paper_id}")'],
        mcp_config_path=mcp_config_path
    )

    scheme_data = {
        "paper_id": marking_scheme.paper_id,
        "source_url": marking_scheme.source_url,
        "source_file_id": marking_scheme.source_file_id,
    }

    if existing and len(existing.get("documents", [])) > 0:
        # Update existing marking scheme
        doc_id = existing["documents"][0]["$id"]
        logger.info(f"  Updating existing marking scheme: {doc_id}")

        await update_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=MARKING_SCHEMES_COLLECTION,
            document_id=doc_id,
            data=scheme_data,
            mcp_config_path=mcp_config_path
        )
        return doc_id
    else:
        # Create new marking scheme
        logger.info(f"  Creating new marking scheme")
        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=MARKING_SCHEMES_COLLECTION,
            data=scheme_data,
            mcp_config_path=mcp_config_path
        )
        return result["$id"]


async def upsert_general_principles(
    principles: List[GeneralPrinciple],
    marking_scheme_id: str,
    mcp_config_path: str
) -> List[str]:
    """Upsert general marking principles.

    Args:
        principles: List of general principles
        marking_scheme_id: Parent marking scheme document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of principle document IDs
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        delete_appwrite_document
    )

    logger.info(f"📜 Upserting {len(principles)} general marking principles")

    # Delete existing principles for this marking scheme
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=GENERAL_PRINCIPLES_COLLECTION,
        queries=[f'equal("marking_scheme_id", "{marking_scheme_id}")'],
        mcp_config_path=mcp_config_path
    )

    for doc in existing.get("documents", []):
        await delete_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=GENERAL_PRINCIPLES_COLLECTION,
            document_id=doc["$id"],
            mcp_config_path=mcp_config_path
        )

    # Create new principles
    principle_ids = []
    for i, principle in enumerate(principles):
        data = {
            "marking_scheme_id": marking_scheme_id,
            "principle_id": principle.principle_id,
            "principle": principle.principle,
            "description": principle.description,
            "exceptions": principle.exceptions or [],
            "sort_order": i + 1,
        }

        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=GENERAL_PRINCIPLES_COLLECTION,
            data=data,
            mcp_config_path=mcp_config_path
        )
        principle_ids.append(result["$id"])
        logger.info(f"  + ({principle.principle_id}) {principle.principle}")

    return principle_ids


async def upsert_solution(
    solution: Solution,
    marking_scheme_id: str,
    mcp_config_path: str
) -> str:
    """Upsert a solution for a question/part.

    Args:
        solution: Solution data
        marking_scheme_id: Parent marking scheme document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Solution document ID
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        update_appwrite_document
    )

    # Build query based on whether it's for a whole question or a part
    queries = [
        f'equal("marking_scheme_id", "{marking_scheme_id}")',
        f'equal("question_id", "{solution.question_id}")',
    ]

    if solution.part_id:
        queries.append(f'equal("part_id", "{solution.part_id}")')

    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=SOLUTIONS_COLLECTION,
        queries=queries,
        mcp_config_path=mcp_config_path
    )

    solution_data = {
        "marking_scheme_id": marking_scheme_id,
        "question_id": solution.question_id,
        "part_id": solution.part_id,
        "max_marks": solution.max_marks,
        "notes": solution.notes or [],
    }

    if existing and len(existing.get("documents", [])) > 0:
        doc_id = existing["documents"][0]["$id"]
        await update_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=SOLUTIONS_COLLECTION,
            document_id=doc_id,
            data=solution_data,
            mcp_config_path=mcp_config_path
        )
        return doc_id
    else:
        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=SOLUTIONS_COLLECTION,
            data=solution_data,
            mcp_config_path=mcp_config_path
        )
        return result["$id"]


async def upsert_generic_marks(
    marks: List[GenericMark],
    solution_id: str,
    mcp_config_path: str
) -> List[str]:
    """Upsert generic marking scheme bullets.

    Args:
        marks: List of generic marks
        solution_id: Parent solution document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of generic mark document IDs
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        delete_appwrite_document
    )

    # Delete existing marks for this solution
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=GENERIC_SCHEME_COLLECTION,
        queries=[f'equal("solution_id", "{solution_id}")'],
        mcp_config_path=mcp_config_path
    )

    for doc in existing.get("documents", []):
        await delete_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=GENERIC_SCHEME_COLLECTION,
            document_id=doc["$id"],
            mcp_config_path=mcp_config_path
        )

    # Create new marks
    mark_ids = []
    for i, mark in enumerate(marks):
        data = {
            "solution_id": solution_id,
            "bullet": mark.bullet,
            "process": mark.process,
            "sort_order": i + 1,
        }

        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=GENERIC_SCHEME_COLLECTION,
            data=data,
            mcp_config_path=mcp_config_path
        )
        mark_ids.append(result["$id"])

    return mark_ids


async def upsert_illustrative_marks(
    marks: List[IllustrativeMark],
    solution_id: str,
    mcp_config_path: str
) -> List[str]:
    """Upsert illustrative marking scheme bullets.

    Args:
        marks: List of illustrative marks
        solution_id: Parent solution document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of illustrative mark document IDs
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        delete_appwrite_document
    )

    # Delete existing marks for this solution
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=ILLUSTRATIVE_SCHEME_COLLECTION,
        queries=[f'equal("solution_id", "{solution_id}")'],
        mcp_config_path=mcp_config_path
    )

    for doc in existing.get("documents", []):
        await delete_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=ILLUSTRATIVE_SCHEME_COLLECTION,
            document_id=doc["$id"],
            mcp_config_path=mcp_config_path
        )

    # Create new marks
    mark_ids = []
    for i, mark in enumerate(marks):
        data = {
            "solution_id": solution_id,
            "bullet": mark.bullet,
            "answer": mark.answer,
            "answer_latex": mark.answer_latex,
            "condition": mark.condition,
            "alternative": mark.alternative,
            "alternative_latex": mark.alternative_latex,
            "sort_order": i + 1,
        }

        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=ILLUSTRATIVE_SCHEME_COLLECTION,
            data=data,
            mcp_config_path=mcp_config_path
        )
        mark_ids.append(result["$id"])

    return mark_ids


async def upsert_marking_instructions(
    extraction_file_path: str,
    paper_id: str,
    mcp_config_path: str,
    generic_marks_data: Optional[Dict[str, List[GenericMark]]] = None,
    illustrative_marks_data: Optional[Dict[str, List[IllustrativeMark]]] = None
) -> Dict[str, Any]:
    """Upsert a complete marking instructions extraction to the database.

    This is the main entry point for persisting extracted marking instructions.
    It validates the extraction data, then upserts all components:
    - Marking scheme metadata
    - General marking principles
    - Solutions with generic and illustrative schemes

    Args:
        extraction_file_path: Path to the extraction JSON file
        paper_id: Parent paper document ID (links marking scheme to paper)
        mcp_config_path: Path to .mcp.json configuration
        generic_marks_data: Optional dict mapping solution_id to generic marks
        illustrative_marks_data: Optional dict mapping solution_id to illustrative marks

    Returns:
        Summary of upserted documents:
        {
            "marking_scheme_id": str,
            "principle_count": int,
            "solution_count": int,
            "generic_mark_count": int,
            "illustrative_mark_count": int
        }

    Raises:
        FileNotFoundError: If extraction file doesn't exist
        ValueError: If extraction data is invalid
    """
    logger.info(f"🔄 Starting marking instructions upsert")
    logger.info(f"  Extraction file: {extraction_file_path}")
    logger.info(f"  Paper ID: {paper_id}")

    # Step 1: Load extraction file
    extraction_path = Path(extraction_file_path)
    if not extraction_path.exists():
        raise FileNotFoundError(f"Extraction file not found: {extraction_file_path}")

    try:
        with open(extraction_path) as f:
            extraction_data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in extraction file: {e}")

    logger.info("✓ Extraction file loaded")

    # Step 2: Validate with Pydantic
    try:
        mi_output = MarkingInstructionsOutput(**extraction_data)
    except Exception as e:
        raise ValueError(f"Extraction data failed validation: {e}")

    logger.info(f"✓ Validation passed: {len(mi_output.solutions)} solutions")

    # Step 3: Upsert marking scheme (update with paper_id)
    marking_scheme = MarkingSchemeMetadata(
        paper_id=paper_id,
        source_url=mi_output.marking_scheme.source_url,
        source_file_id=mi_output.marking_scheme.source_file_id
    )
    marking_scheme_id = await upsert_marking_scheme(marking_scheme, mcp_config_path)
    logger.info(f"✓ Marking scheme upserted: {marking_scheme_id}")

    # Step 4: Upsert general principles
    principle_ids = await upsert_general_principles(
        mi_output.general_principles,
        marking_scheme_id,
        mcp_config_path
    )
    logger.info(f"✓ General principles upserted: {len(principle_ids)}")

    # Step 5: Upsert solutions
    total_generic = 0
    total_illustrative = 0

    for solution in mi_output.solutions:
        # Update solution with marking_scheme_id
        solution_with_scheme = Solution(
            marking_scheme_id=marking_scheme_id,
            question_id=solution.question_id,
            part_id=solution.part_id,
            max_marks=solution.max_marks,
            notes=solution.notes
        )

        solution_id = await upsert_solution(solution_with_scheme, marking_scheme_id, mcp_config_path)
        logger.info(f"  + Solution for Q{solution.question_id}: {solution_id}")

        # Upsert generic marks if provided
        if generic_marks_data and solution.question_id in generic_marks_data:
            generic_ids = await upsert_generic_marks(
                generic_marks_data[solution.question_id],
                solution_id,
                mcp_config_path
            )
            total_generic += len(generic_ids)

        # Upsert illustrative marks if provided
        if illustrative_marks_data and solution.question_id in illustrative_marks_data:
            illustrative_ids = await upsert_illustrative_marks(
                illustrative_marks_data[solution.question_id],
                solution_id,
                mcp_config_path
            )
            total_illustrative += len(illustrative_ids)

    summary = {
        "marking_scheme_id": marking_scheme_id,
        "paper_id": paper_id,
        "principle_count": len(principle_ids),
        "solution_count": len(mi_output.solutions),
        "generic_mark_count": total_generic,
        "illustrative_mark_count": total_illustrative,
    }

    logger.info("\n" + "=" * 50)
    logger.info("✅ Marking instructions upsert complete!")
    logger.info(f"  Marking scheme: {marking_scheme_id}")
    logger.info(f"  Principles: {summary['principle_count']}")
    logger.info(f"  Solutions: {summary['solution_count']}")
    logger.info(f"  Generic marks: {summary['generic_mark_count']}")
    logger.info(f"  Illustrative marks: {summary['illustrative_mark_count']}")
    logger.info("=" * 50)

    return summary


async def get_marking_scheme_for_paper(
    paper_id: str,
    mcp_config_path: str
) -> Optional[Dict[str, Any]]:
    """Get a marking scheme by paper ID.

    Args:
        paper_id: Paper document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Marking scheme document or None if not found
    """
    from .appwrite_mcp import list_appwrite_documents

    result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=MARKING_SCHEMES_COLLECTION,
        queries=[f'equal("paper_id", "{paper_id}")'],
        mcp_config_path=mcp_config_path
    )

    docs = result.get("documents", [])
    return docs[0] if docs else None


async def get_solution_with_marks(
    solution_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Get a solution with its generic and illustrative marks.

    Args:
        solution_id: Solution document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Solution document with embedded generic and illustrative marks
    """
    from .appwrite_mcp import list_appwrite_documents, get_appwrite_document

    # Get solution
    solution = await get_appwrite_document(
        database_id=DATABASE_ID,
        collection_id=SOLUTIONS_COLLECTION,
        document_id=solution_id,
        mcp_config_path=mcp_config_path
    )

    # Get generic marks
    generic_result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=GENERIC_SCHEME_COLLECTION,
        queries=[f'equal("solution_id", "{solution_id}")'],
        mcp_config_path=mcp_config_path
    )

    # Get illustrative marks
    illustrative_result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=ILLUSTRATIVE_SCHEME_COLLECTION,
        queries=[f'equal("solution_id", "{solution_id}")'],
        mcp_config_path=mcp_config_path
    )

    # Combine
    solution["generic_scheme"] = sorted(
        generic_result.get("documents", []),
        key=lambda x: x.get("sort_order", 0)
    )
    solution["illustrative_scheme"] = sorted(
        illustrative_result.get("documents", []),
        key=lambda x: x.get("sort_order", 0)
    )

    return solution
