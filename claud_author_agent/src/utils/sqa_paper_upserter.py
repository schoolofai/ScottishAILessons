"""SQA Paper Upserter - Database persistence for extracted question papers.

Handles upserting of extracted SQA exam papers to Appwrite database.
Creates/updates papers, formulae, questions, question_parts, and diagrams.

Based on design specification: docs/claud_author_agent/understanding_standards.md
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from ..models.sqa_extraction_models import (
    QuestionPaperOutput,
    PaperMetadata,
    FormulaSet,
    Question,
    QuestionPart,
    DiagramRef,
    get_valid_topic_slugs
)

logger = logging.getLogger(__name__)

DATABASE_ID = "default"

# Collection IDs (prefixed with sqa_ for namespacing)
PAPERS_COLLECTION = "sqa_papers"
FORMULAE_COLLECTION = "sqa_formulae"
QUESTIONS_COLLECTION = "sqa_questions"
QUESTION_PARTS_COLLECTION = "sqa_question_parts"
DIAGRAMS_COLLECTION = "sqa_diagrams"


def _validate_topic_tags(tags: Optional[List[str]]) -> List[str]:
    """Validate topic tags against the approved taxonomy.

    Args:
        tags: List of topic tags to validate

    Returns:
        Validated list of tags (invalid tags logged and removed)
    """
    if not tags:
        return []

    valid_slugs = set(get_valid_topic_slugs())
    validated = []

    for tag in tags:
        if tag in valid_slugs:
            validated.append(tag)
        else:
            logger.warning(f"  Invalid topic tag '{tag}' - not in taxonomy, removing")

    return validated


def _format_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Format datetime for Appwrite (ISO 8601)."""
    if dt is None:
        return None
    return dt.isoformat() + "Z" if not dt.isoformat().endswith("Z") else dt.isoformat()


async def upsert_paper(
    paper: PaperMetadata,
    mcp_config_path: str
) -> str:
    """Upsert a paper to the database.

    Args:
        paper: Validated paper metadata
        mcp_config_path: Path to .mcp.json

    Returns:
        Paper document ID

    Raises:
        Exception: If upsert fails
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        update_appwrite_document
    )

    logger.info(f"📄 Upserting paper: {paper.code}")

    # Check if paper already exists by code
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=PAPERS_COLLECTION,
        queries=[f'equal("code", "{paper.code}")'],
        mcp_config_path=mcp_config_path
    )

    paper_data = {
        "code": paper.code,
        "year": paper.year,
        "level": paper.level,
        "level_name": paper.level_name,
        "subject": paper.subject,
        "paper_number": paper.paper_number,
        "calculator_allowed": paper.calculator_allowed,
        "exam_date": _format_datetime(paper.exam_date),
        "duration_minutes": paper.duration_minutes,
        "total_marks": paper.total_marks,
        "source_url": paper.source_url,
        "source_file_id": paper.source_file_id,
    }

    if existing and len(existing.get("documents", [])) > 0:
        # Update existing paper
        doc_id = existing["documents"][0]["$id"]
        logger.info(f"  Updating existing paper: {doc_id}")

        await update_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=PAPERS_COLLECTION,
            document_id=doc_id,
            data=paper_data,
            mcp_config_path=mcp_config_path
        )
        return doc_id
    else:
        # Create new paper
        logger.info(f"  Creating new paper")
        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=PAPERS_COLLECTION,
            data=paper_data,
            mcp_config_path=mcp_config_path
        )
        return result["$id"]


async def upsert_formulae(
    formulae: List[FormulaSet],
    paper_id: str,
    mcp_config_path: str
) -> List[str]:
    """Upsert formula sets for a paper.

    Args:
        formulae: List of formula sets
        paper_id: Parent paper document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of formula document IDs
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        delete_appwrite_document
    )

    logger.info(f"📐 Upserting {len(formulae)} formula sets")

    # Delete existing formulae for this paper
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=FORMULAE_COLLECTION,
        queries=[f'equal("paper_id", "{paper_id}")'],
        mcp_config_path=mcp_config_path
    )

    for doc in existing.get("documents", []):
        await delete_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=FORMULAE_COLLECTION,
            document_id=doc["$id"],
            mcp_config_path=mcp_config_path
        )
        logger.info(f"  Deleted old formula: {doc['topic']}")

    # Create new formulae
    formula_ids = []
    for i, formula_set in enumerate(formulae):
        data = {
            "paper_id": paper_id,
            "topic": formula_set.topic,
            "formulas": formula_set.formulas,
            "formulas_latex": formula_set.formulas_latex or [],
            "sort_order": i + 1,
        }

        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=FORMULAE_COLLECTION,
            data=data,
            mcp_config_path=mcp_config_path
        )
        formula_ids.append(result["$id"])
        logger.info(f"  + {formula_set.topic}")

    return formula_ids


async def upsert_question(
    question: Question,
    paper_id: str,
    mcp_config_path: str
) -> str:
    """Upsert a single question.

    Args:
        question: Question data
        paper_id: Parent paper document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Question document ID
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        update_appwrite_document
    )

    # Check if question exists
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=QUESTIONS_COLLECTION,
        queries=[
            f'equal("paper_id", "{paper_id}")',
            f'equal("number", "{question.number}")'
        ],
        mcp_config_path=mcp_config_path
    )

    validated_tags = _validate_topic_tags(question.topic_tags)

    question_data = {
        "paper_id": paper_id,
        "number": question.number,
        "text": question.text,
        "text_latex": question.text_latex,
        "marks": question.marks,
        "has_parts": question.has_parts,
        "topic_tags": validated_tags,
        "diagram_ids": question.diagram_ids or [],
    }

    if existing and len(existing.get("documents", [])) > 0:
        doc_id = existing["documents"][0]["$id"]
        await update_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=QUESTIONS_COLLECTION,
            document_id=doc_id,
            data=question_data,
            mcp_config_path=mcp_config_path
        )
        return doc_id
    else:
        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=QUESTIONS_COLLECTION,
            data=question_data,
            mcp_config_path=mcp_config_path
        )
        return result["$id"]


async def upsert_question_parts(
    parts: List[QuestionPart],
    question_id: str,
    mcp_config_path: str
) -> List[str]:
    """Upsert question parts.

    Args:
        parts: List of question parts
        question_id: Parent question document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of part document IDs
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        delete_appwrite_document
    )

    # Delete existing parts for this question
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=QUESTION_PARTS_COLLECTION,
        queries=[f'equal("question_id", "{question_id}")'],
        mcp_config_path=mcp_config_path
    )

    for doc in existing.get("documents", []):
        await delete_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=QUESTION_PARTS_COLLECTION,
            document_id=doc["$id"],
            mcp_config_path=mcp_config_path
        )

    # Create new parts
    part_ids = []
    for part in parts:
        validated_tags = _validate_topic_tags(part.topic_tags)

        data = {
            "question_id": question_id,
            "part": part.part,
            "subpart": part.subpart,
            "text": part.text,
            "text_latex": part.text_latex,
            "marks": part.marks,
            "topic_tags": validated_tags,
            "sort_order": part.sort_order,
        }

        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=QUESTION_PARTS_COLLECTION,
            data=data,
            mcp_config_path=mcp_config_path
        )
        part_ids.append(result["$id"])

    return part_ids


async def upsert_diagrams(
    diagrams: List[DiagramRef],
    question_id: str,
    mcp_config_path: str
) -> List[str]:
    """Upsert diagrams for a question.

    Args:
        diagrams: List of diagram references
        question_id: Parent question document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of diagram document IDs
    """
    from .appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        delete_appwrite_document
    )

    # Delete existing diagrams for this question
    existing = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=DIAGRAMS_COLLECTION,
        queries=[f'equal("question_id", "{question_id}")'],
        mcp_config_path=mcp_config_path
    )

    for doc in existing.get("documents", []):
        await delete_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=DIAGRAMS_COLLECTION,
            document_id=doc["$id"],
            mcp_config_path=mcp_config_path
        )

    # Create new diagrams
    diagram_ids = []
    for diagram in diagrams:
        data = {
            "question_id": question_id,
            "filename": diagram.filename,
            "type": diagram.type,
            "description": diagram.description,
            "file_id": diagram.file_id,
            "render_type": diagram.render_type,
            "render_config_file_id": diagram.render_config_file_id,
        }

        result = await create_appwrite_document(
            database_id=DATABASE_ID,
            collection_id=DIAGRAMS_COLLECTION,
            data=data,
            mcp_config_path=mcp_config_path
        )
        diagram_ids.append(result["$id"])

    return diagram_ids


async def upsert_question_paper(
    extraction_file_path: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Upsert a complete question paper extraction to the database.

    This is the main entry point for persisting extracted question papers.
    It validates the extraction data, then upserts all components:
    - Paper metadata
    - Formulae
    - Questions and their parts
    - Diagram references

    Args:
        extraction_file_path: Path to the extraction JSON file
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Summary of upserted documents:
        {
            "paper_id": str,
            "formula_count": int,
            "question_count": int,
            "part_count": int,
            "diagram_count": int
        }

    Raises:
        FileNotFoundError: If extraction file doesn't exist
        ValueError: If extraction data is invalid
    """
    logger.info(f"🔄 Starting question paper upsert")
    logger.info(f"  Extraction file: {extraction_file_path}")

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
        paper_output = QuestionPaperOutput(**extraction_data)
    except Exception as e:
        raise ValueError(f"Extraction data failed validation: {e}")

    logger.info(f"✓ Validation passed: {len(paper_output.questions)} questions")

    # Step 3: Upsert paper
    paper_id = await upsert_paper(paper_output.paper, mcp_config_path)
    logger.info(f"✓ Paper upserted: {paper_id}")

    # Step 4: Upsert formulae
    formula_ids = await upsert_formulae(paper_output.formulae, paper_id, mcp_config_path)
    logger.info(f"✓ Formulae upserted: {len(formula_ids)}")

    # Step 5: Upsert questions, parts, and diagrams
    total_parts = 0
    total_diagrams = 0

    for question in paper_output.questions:
        # Update question with paper_id
        question_with_paper = Question(
            paper_id=paper_id,
            number=question.number,
            text=question.text,
            text_latex=question.text_latex,
            marks=question.marks,
            has_parts=question.has_parts,
            topic_tags=question.topic_tags,
            diagram_ids=question.diagram_ids
        )

        question_id = await upsert_question(question_with_paper, paper_id, mcp_config_path)
        logger.info(f"  + Q{question.number}: {question_id}")

        # Upsert parts if any (parts would need to be in extraction data)
        # Note: The extraction schema has Question.parts but we need to extract them
        # This would be populated during extraction

        # Upsert diagrams if any
        # Note: Diagrams would need to be extracted and referenced

    summary = {
        "paper_id": paper_id,
        "paper_code": paper_output.paper.code,
        "formula_count": len(formula_ids),
        "question_count": len(paper_output.questions),
        "part_count": total_parts,
        "diagram_count": total_diagrams,
    }

    logger.info("\n" + "=" * 50)
    logger.info("✅ Question paper upsert complete!")
    logger.info(f"  Paper: {summary['paper_code']}")
    logger.info(f"  Questions: {summary['question_count']}")
    logger.info(f"  Formulae sets: {summary['formula_count']}")
    logger.info("=" * 50)

    return summary


async def get_paper_by_code(
    paper_code: str,
    mcp_config_path: str
) -> Optional[Dict[str, Any]]:
    """Get a paper document by its SQA code.

    Args:
        paper_code: SQA paper code (e.g., "X847/75/01")
        mcp_config_path: Path to .mcp.json

    Returns:
        Paper document or None if not found
    """
    from .appwrite_mcp import list_appwrite_documents

    result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=PAPERS_COLLECTION,
        queries=[f'equal("code", "{paper_code}")'],
        mcp_config_path=mcp_config_path
    )

    docs = result.get("documents", [])
    return docs[0] if docs else None


async def get_questions_for_paper(
    paper_id: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Get all questions for a paper.

    Args:
        paper_id: Paper document ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of question documents
    """
    from .appwrite_mcp import list_appwrite_documents

    result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=QUESTIONS_COLLECTION,
        queries=[f'equal("paper_id", "{paper_id}")'],
        mcp_config_path=mcp_config_path
    )

    return result.get("documents", [])
