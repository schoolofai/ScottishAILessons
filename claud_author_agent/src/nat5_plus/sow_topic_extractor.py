"""
SOW Topic Extractor

Extracts topics from the Authored_SOW collection for a given course.
These topics drive question generation and ensure curriculum alignment.

Usage:
    topics = await extract_sow_topics(course_id, workspace_path)
"""

import json
import logging
import gzip
import base64
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Storage bucket constants for SOW entries
STORAGE_PREFIX = "storage:"
STORAGE_BUCKET_ID = "authored_sow_entries"


def _decompress_entries(entries_str: str) -> List[Dict[str, Any]]:
    """Decompress SOW entries, handling all storage formats.

    The Authored_SOW collection uses dual storage strategy:
    1. Inline storage: 'gzip:BASE64_DATA' for entries < 100KB
    2. Storage bucket: 'storage:<file_id>' for entries > 100KB

    Args:
        entries_str: Raw entries string from Appwrite document

    Returns:
        List of parsed SOW entry dictionaries

    Raises:
        ValueError: If decompression fails (no silent fallback per CLAUDE.md)
    """
    if not entries_str:
        raise ValueError("Empty entries string - cannot decompress")

    # Case 1: Storage bucket reference - fetch from storage, then decompress
    if entries_str.startswith(STORAGE_PREFIX):
        file_id = entries_str[len(STORAGE_PREFIX):]
        logger.info(f"📦 Fetching entries from storage bucket: {file_id}")

        from ..utils.appwrite_client import download_file_content
        entries_bytes = download_file_content(STORAGE_BUCKET_ID, file_id)
        entries_str = entries_bytes.decode('utf-8')  # Now has gzip: prefix

    # Case 2: Inline compressed with gzip: prefix
    if entries_str.startswith("gzip:"):
        entries_str = entries_str[5:]  # Remove 'gzip:' prefix

    # Case 3: Base64 decode and gzip decompress
    try:
        compressed_data = base64.b64decode(entries_str)
        decompressed_data = gzip.decompress(compressed_data)
        entries = json.loads(decompressed_data.decode('utf-8'))
        if not isinstance(entries, list):
            raise ValueError(f"Expected list of entries, got {type(entries).__name__}")
        return entries
    except Exception as e:
        logger.error(f"Failed to decompress entries: {e}")
        raise ValueError(f"Failed to decompress SOW entries: {e}")


@dataclass
class SOWTopic:
    """Represents a single SOW topic for question generation."""
    topic_id: str
    topic_name: str
    description: str
    learning_outcomes: List[str]
    sow_order: int
    difficulty_level: str  # beginner, intermediate, advanced
    prerequisite_topics: List[str]
    keywords: List[str]


@dataclass
class SOWExtraction:
    """Result of SOW topic extraction."""
    course_id: str
    subject: str
    level: str
    topics: List[SOWTopic]
    total_topics: int


async def extract_sow_topics(
    course_id: str,
    workspace_path: Path
) -> SOWExtraction:
    """Extract SOW topics for a course from Appwrite.

    Args:
        course_id: Course ID to extract topics for
        workspace_path: Directory to save extracted data

    Returns:
        SOWExtraction with all topics

    Raises:
        ValueError: If course not found or has no SOW
    """
    logger.info(f"Extracting SOW topics for course: {course_id}")

    # Import Appwrite client
    try:
        from ..utils.appwrite_client import get_databases
    except ImportError:
        logger.error("Appwrite client not available")
        raise ValueError("Appwrite client not configured")

    databases = get_databases()

    # Query Authored_SOW collection
    try:
        from appwrite.query import Query

        # Get course document first for metadata
        # Note: Query by courseId field, not $id (which is Appwrite's internal doc ID)
        courses = databases.list_documents(
            database_id="default",
            collection_id="courses",
            queries=[Query.equal("courseId", course_id)]
        )

        if not courses["documents"]:
            raise ValueError(f"Course not found: {course_id}")

        course = courses["documents"][0]
        subject = course.get("subject", "Unknown")
        level = course.get("level", "Unknown")

        # Get SOW document for this course (one document per course)
        sow_docs = databases.list_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[
                Query.equal("courseId", course_id)
            ]
        )

        if not sow_docs["documents"]:
            raise ValueError(f"No SOW found for course: {course_id}")

        # Get the SOW document (should be one per course)
        sow_doc = sow_docs["documents"][0]
        logger.info(f"Found SOW document: {sow_doc['$id']} version {sow_doc.get('version', 'unknown')}")

        # Decompress and parse entries
        entries_raw = sow_doc.get("entries", "")
        entries = _decompress_entries(entries_raw)

        if not entries:
            raise ValueError(f"No entries found in SOW for course: {course_id}")

        logger.info(f"Decompressed {len(entries)} SOW entries")

        # Parse topics from entries
        topics = []
        for idx, entry in enumerate(entries):
            # Each entry in the SOW contains topic information
            topic = SOWTopic(
                topic_id=entry.get("id", f"{course_id}_topic_{idx}"),
                topic_name=entry.get("topic_name", entry.get("title", entry.get("name", f"Topic {idx + 1}"))),
                description=entry.get("description", entry.get("content", "")),
                learning_outcomes=_parse_json_array(entry.get("learning_outcomes", entry.get("outcomes", []))),
                sow_order=entry.get("sow_order", entry.get("order", idx)),
                difficulty_level=_infer_difficulty_from_entry(entry, idx, len(entries)),
                prerequisite_topics=_parse_json_array(entry.get("prerequisites", [])),
                keywords=_extract_keywords_from_entry(entry)
            )
            topics.append(topic)

        # Sort by sow_order
        topics.sort(key=lambda t: t.sow_order)

        extraction = SOWExtraction(
            course_id=course_id,
            subject=subject,
            level=level,
            topics=topics,
            total_topics=len(topics)
        )

        # Save to workspace
        output_path = workspace_path / "sow_topics.json"
        _save_extraction(extraction, output_path)

        logger.info(f"Extracted {len(topics)} topics for {subject} {level}")
        return extraction

    except Exception as e:
        logger.error(f"Failed to extract SOW topics: {e}")
        raise ValueError(f"SOW extraction failed: {e}")


def _parse_json_array(value: str) -> List[str]:
    """Parse a JSON array string safely."""
    if not value:
        return []
    try:
        if isinstance(value, list):
            return value
        return json.loads(value)
    except json.JSONDecodeError:
        return []


def _infer_difficulty(doc: Dict[str, Any]) -> str:
    """Infer difficulty level from SOW document (legacy - for backward compatibility)."""
    sow_order = doc.get("sow_order", 0)
    total_expected = 20  # Typical course has ~20 topics

    ratio = sow_order / total_expected
    if ratio < 0.33:
        return "beginner"
    elif ratio < 0.66:
        return "intermediate"
    else:
        return "advanced"


def _infer_difficulty_from_entry(entry: Dict[str, Any], idx: int, total: int) -> str:
    """Infer difficulty level from SOW entry position.

    Uses position in curriculum to estimate difficulty:
    - First third: beginner
    - Middle third: intermediate
    - Last third: advanced
    """
    # Check if entry has explicit difficulty
    if "difficulty" in entry:
        return entry["difficulty"]

    # Use order-based inference
    sow_order = entry.get("sow_order", entry.get("order", idx))
    total_expected = max(total, 20)  # Use actual count or default

    ratio = sow_order / total_expected
    if ratio < 0.33:
        return "beginner"
    elif ratio < 0.66:
        return "intermediate"
    else:
        return "advanced"


def _extract_keywords(doc: Dict[str, Any]) -> List[str]:
    """Extract keywords from topic description and outcomes (legacy)."""
    keywords = []

    # From topic name
    name = doc.get("topic_name", "")
    if name:
        keywords.extend(name.lower().split())

    # From explicit keywords field if exists
    if "keywords" in doc:
        keywords.extend(_parse_json_array(doc.get("keywords", "[]")))

    # Deduplicate
    return list(set(keywords))


def _extract_keywords_from_entry(entry: Dict[str, Any]) -> List[str]:
    """Extract keywords from SOW entry."""
    keywords = []

    # From topic name/title
    name = entry.get("topic_name", entry.get("title", entry.get("name", "")))
    if name:
        # Filter out common words
        common_words = {"the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with"}
        words = [w.lower() for w in name.split() if w.lower() not in common_words]
        keywords.extend(words)

    # From explicit keywords field if exists
    if "keywords" in entry:
        kw = entry.get("keywords", [])
        if isinstance(kw, list):
            keywords.extend(kw)
        elif isinstance(kw, str):
            keywords.extend(_parse_json_array(kw))

    # From tags if present
    if "tags" in entry:
        tags = entry.get("tags", [])
        if isinstance(tags, list):
            keywords.extend(tags)

    # Deduplicate
    return list(set(keywords))


def _save_extraction(extraction: SOWExtraction, output_path: Path) -> None:
    """Save extraction to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "course_id": extraction.course_id,
        "subject": extraction.subject,
        "level": extraction.level,
        "total_topics": extraction.total_topics,
        "topics": [
            {
                "topic_id": t.topic_id,
                "topic_name": t.topic_name,
                "description": t.description,
                "learning_outcomes": t.learning_outcomes,
                "sow_order": t.sow_order,
                "difficulty_level": t.difficulty_level,
                "prerequisite_topics": t.prerequisite_topics,
                "keywords": t.keywords
            }
            for t in extraction.topics
        ]
    }

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    logger.info(f"Saved SOW extraction to {output_path}")
