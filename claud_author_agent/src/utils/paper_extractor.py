"""Paper Extractor - Utilities for extracting questions from us_papers collection.

This module provides functions to:
- Build paper IDs from components
- Parse question numbers (including parts and subparts)
- Extract questions and solutions from paper data
- Fetch papers from Appwrite database

The paper data structure follows the us_papers collection schema where
the `data` field contains a JSON blob with questions, solutions, and metadata.
"""

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class QuestionExtractionResult:
    """Result from extracting a question from paper data.

    Represents a single question or question part that can be used
    for walkthrough generation.
    """
    question_number: str  # e.g., "1", "4a", "5b(i)"
    text: str
    text_latex: Optional[str]
    marks: int
    topic_tags: List[str]
    has_solution: bool
    diagram_refs: List[Dict[str, Any]]
    parent_question: Optional[str] = None  # For parts, the parent question number


# =============================================================================
# Helper Functions
# =============================================================================

def build_paper_id(
    subject: str,
    level_code: str,
    year: int,
    paper_code: str
) -> str:
    """Build unique paper ID from components.

    Format: {subject}-{level_code}-{year}-{paper_code_normalized}
    Example: mathematics-n5-2023-X847-75-01

    Args:
        subject: Subject name (e.g., "Mathematics", "Application of Mathematics")
        level_code: Level code (e.g., "N5", "NH", "NAH")
        year: Exam year
        paper_code: SQA paper code (e.g., "X847/75/01")

    Returns:
        Normalized paper ID string
    """
    # Normalize subject: lowercase, replace spaces with hyphens
    subject_normalized = subject.lower().replace(" ", "-")

    # Normalize level code: lowercase
    level_normalized = level_code.lower()

    # Normalize paper code: replace slashes with hyphens
    paper_code_normalized = paper_code.replace("/", "-")

    return f"{subject_normalized}-{level_normalized}-{year}-{paper_code_normalized}"


def parse_question_number(question_number: str) -> Tuple[str, Optional[str], Optional[str]]:
    """Parse question number into components.

    Handles formats:
    - "1" -> ("1", None, None)
    - "Q1" -> ("1", None, None)
    - "4a" -> ("4", "a", None)
    - "Q4a" -> ("4", "a", None)
    - "5b(i)" -> ("5", "b", "i")
    - "Q5b(i)" -> ("5", "b", "i")
    - "3c(ii)" -> ("3", "c", "ii")

    Args:
        question_number: Question number string

    Returns:
        Tuple of (base_number, part_letter, subpart)
    """
    # Strip optional "Q" or "q" prefix before parsing
    normalized = question_number.lower().lstrip('q')

    # Pattern: number, optional letter, optional (subpart)
    pattern = r"^(\d+)([a-z])?(?:\(([ivx]+)\))?$"
    match = re.match(pattern, normalized)

    if not match:
        # Return as-is if doesn't match pattern
        return (question_number, None, None)

    base = match.group(1)
    part = match.group(2)
    subpart = match.group(3)

    return (base, part, subpart)


# =============================================================================
# Question Extraction Functions
# =============================================================================

def extract_questions_from_paper(paper_data: Dict[str, Any]) -> List[QuestionExtractionResult]:
    """Extract all questions from paper data, including parts.

    For questions with parts (has_parts=True), each part is extracted
    as a separate QuestionExtractionResult with a parent_question reference.

    Args:
        paper_data: Parsed paper data from us_papers.data field

    Returns:
        List of QuestionExtractionResult objects
    """
    results = []
    questions = paper_data.get("questions", [])

    for question in questions:
        q_number = question.get("number", "")
        has_parts = question.get("has_parts", False)

        # Get parent-level diagrams (inherited by parts)
        parent_diagrams = question.get("diagrams", [])

        if has_parts:
            # Extract each part as a separate question
            parts = question.get("parts", [])
            for part in parts:
                part_letter = part.get("part", "")
                subpart = part.get("subpart")

                # Build question number for part
                if subpart:
                    part_number = f"{q_number}{part_letter}({subpart})"
                else:
                    part_number = f"{q_number}{part_letter}"

                # Check if part has solution
                part_solution = part.get("solution")
                has_solution = part_solution is not None

                results.append(QuestionExtractionResult(
                    question_number=part_number,
                    text=part.get("text", ""),
                    text_latex=part.get("text_latex"),
                    marks=part.get("marks", 0),
                    topic_tags=part.get("topic_tags", []),
                    has_solution=has_solution,
                    diagram_refs=parent_diagrams,  # Parts inherit parent diagrams
                    parent_question=q_number
                ))
        else:
            # Simple question without parts
            solution = question.get("solution")
            has_solution = solution is not None

            results.append(QuestionExtractionResult(
                question_number=q_number,
                text=question.get("text", ""),
                text_latex=question.get("text_latex"),
                marks=question.get("marks", 0),
                topic_tags=question.get("topic_tags", []),
                has_solution=has_solution,
                diagram_refs=parent_diagrams,
                parent_question=None
            ))

    return results


def extract_question_with_solution(
    paper_data: Dict[str, Any],
    question_number: str
) -> Optional[Dict[str, Any]]:
    """Extract a single question with full solution data.

    For part questions (e.g., "4a"), includes parent question context.

    Args:
        paper_data: Parsed paper data from us_papers.data field
        question_number: Question number to extract (e.g., "1", "4a", "5b(i)")

    Returns:
        Dictionary with question, solution, and parent_context (if applicable),
        or None if question not found
    """
    questions = paper_data.get("questions", [])
    base, part, subpart = parse_question_number(question_number)

    # Find the base question
    target_question = None
    for question in questions:
        if question.get("number") == base:
            target_question = question
            break

    if target_question is None:
        return None

    # If no part specified, return the main question
    if part is None:
        solution = target_question.get("solution")
        if solution is None:
            return None

        return {
            "question": {
                "number": target_question.get("number"),
                "text": target_question.get("text"),
                "text_latex": target_question.get("text_latex"),
                "marks": target_question.get("marks"),
                "topic_tags": target_question.get("topic_tags", []),
                "diagrams": target_question.get("diagrams", [])
            },
            "solution": solution
        }

    # Find the specific part
    parts = target_question.get("parts", [])
    target_part = None

    for p in parts:
        p_letter = p.get("part", "")
        p_subpart = p.get("subpart")

        # Match part letter
        if p_letter == part:
            # If subpart specified, must also match
            if subpart is not None:
                if p_subpart == subpart:
                    target_part = p
                    break
            else:
                # No subpart specified, match if part has no subpart
                # Handle both None and empty string "" as "no subpart"
                if not p_subpart:  # None or "" both evaluate to False
                    target_part = p
                    break

    if target_part is None:
        return None

    solution = target_part.get("solution")
    if solution is None:
        return None

    return {
        "question": {
            "number": question_number,
            "text": target_part.get("text"),
            "text_latex": target_part.get("text_latex"),
            "marks": target_part.get("marks"),
            "topic_tags": target_part.get("topic_tags", []),
            "diagrams": target_question.get("diagrams", [])  # Inherit from parent
        },
        "solution": solution,
        "parent_context": {
            "number": target_question.get("number"),
            "text": target_question.get("text"),
            "text_latex": target_question.get("text_latex")
        }
    }


# =============================================================================
# Appwrite Integration Functions
# =============================================================================

async def get_appwrite_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    mcp_config_path: str = ".mcp.json"
) -> Optional[Dict[str, Any]]:
    """Fetch a single document from Appwrite.

    Uses direct Appwrite SDK access for standalone CLI usage.

    Args:
        database_id: Database ID
        collection_id: Collection ID
        document_id: Document ID
        mcp_config_path: Path to MCP config file

    Returns:
        Document data or None if not found

    Raises:
        ImportError: If Appwrite SDK not installed
        FileNotFoundError: If MCP config not found
        ValueError: If credentials missing
    """
    try:
        from .appwrite_infrastructure import _get_appwrite_client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.get_document(
            database_id=database_id,
            collection_id=collection_id,
            document_id=document_id
        )
        return result

    except AppwriteException as e:
        if e.code == 404:
            return None
        raise
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")


def _parse_query_string(query_str: str):
    """Parse a query string into Appwrite Query object.

    Converts strings like 'equal("field", "value")' to Query.equal("field", ["value"])

    Args:
        query_str: Query string in format 'method("field", value)'

    Returns:
        Appwrite Query object
    """
    from appwrite.query import Query

    # Parse: method("field", value)
    # Supported: equal, notEqual, lessThan, greaterThan, contains, search
    if query_str.startswith('equal('):
        # Extract: equal("field", "value") or equal("field", number)
        inner = query_str[6:-1]  # Remove 'equal(' and ')'
        parts = inner.split(', ', 1)
        field = parts[0].strip('"')
        value = parts[1]
        # Check if value is quoted string or number
        if value.startswith('"') and value.endswith('"'):
            value = value.strip('"')
        else:
            value = int(value)  # Assume integer for numbers
        return Query.equal(field, [value])

    elif query_str.startswith('notEqual('):
        inner = query_str[9:-1]
        parts = inner.split(', ', 1)
        field = parts[0].strip('"')
        value = parts[1]
        if value.startswith('"') and value.endswith('"'):
            value = value.strip('"')
        else:
            value = int(value)
        return Query.not_equal(field, [value])

    elif query_str.startswith('lessThan('):
        inner = query_str[9:-1]
        parts = inner.split(', ', 1)
        field = parts[0].strip('"')
        value = int(parts[1])
        return Query.less_than(field, value)

    elif query_str.startswith('greaterThan('):
        inner = query_str[12:-1]
        parts = inner.split(', ', 1)
        field = parts[0].strip('"')
        value = int(parts[1])
        return Query.greater_than(field, value)

    else:
        raise ValueError(f"Unsupported query format: {query_str}")


async def list_appwrite_documents(
    database_id: str,
    collection_id: str,
    queries: List[str],
    mcp_config_path: str = ".mcp.json"
) -> List[Dict[str, Any]]:
    """List documents from Appwrite with queries.

    Uses direct Appwrite SDK access for standalone CLI usage.

    Args:
        database_id: Database ID
        collection_id: Collection ID
        queries: List of query strings in format 'equal("field", "value")'
        mcp_config_path: Path to MCP config file

    Returns:
        List of matching documents

    Raises:
        ImportError: If Appwrite SDK not installed
        FileNotFoundError: If MCP config not found
        ValueError: If credentials missing or invalid query
    """
    try:
        from .appwrite_infrastructure import _get_appwrite_client
        from appwrite.services.databases import Databases
        from appwrite.query import Query

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        # Convert query strings to Query objects
        appwrite_queries = [_parse_query_string(q) for q in queries]

        # Fetch documents with pagination (Appwrite returns max 25 by default)
        all_documents = []
        offset = 0
        limit = 100  # Fetch in batches

        while True:
            paginated_queries = appwrite_queries + [
                Query.limit(limit),
                Query.offset(offset)
            ]

            result = databases.list_documents(
                database_id=database_id,
                collection_id=collection_id,
                queries=paginated_queries
            )

            documents = result.get("documents", [])
            all_documents.extend(documents)

            # Check if we've fetched all documents
            if len(documents) < limit:
                break
            offset += limit

        return all_documents

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")


async def fetch_paper(
    paper_id: str,
    mcp_config_path: str = ".mcp.json"
) -> Optional[Dict[str, Any]]:
    """Fetch a paper document from us_papers collection.

    Args:
        paper_id: Paper document ID (e.g., "mathematics-n5-2023-X847-75-01")
        mcp_config_path: Path to MCP config file

    Returns:
        Paper document or None if not found
    """
    return await get_appwrite_document(
        database_id="sqa_education",
        collection_id="us_papers",
        document_id=paper_id,
        mcp_config_path=mcp_config_path
    )


async def list_papers(
    subject: Optional[str] = None,
    level: Optional[str] = None,
    year: Optional[int] = None,
    mcp_config_path: str = ".mcp.json"
) -> List[Dict[str, Any]]:
    """List papers from us_papers collection with filters.

    Args:
        subject: Filter by subject name (e.g., "Mathematics")
        level: Filter by level (e.g., "National 5")
        year: Filter by year
        mcp_config_path: Path to MCP config file

    Returns:
        List of matching paper documents
    """
    queries = []

    if subject:
        queries.append(f'equal("subject", "{subject}")')
    if level:
        queries.append(f'equal("level", "{level}")')
    if year:
        queries.append(f'equal("year", {year})')

    return await list_appwrite_documents(
        database_id="sqa_education",
        collection_id="us_papers",
        queries=queries,
        mcp_config_path=mcp_config_path
    )
