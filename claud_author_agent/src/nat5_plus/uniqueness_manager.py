"""
Uniqueness Manager

Ensures generated exams are unique by tracking:
- Topic combinations already used
- Question fingerprints (content hashes)
- Style/difficulty distributions

Uses nat5_plus_exam_summaries collection for persistence.
"""

import json
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any, Set, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ExamSummary:
    """Summary of a generated exam for uniqueness tracking."""
    exam_id: str
    course_id: str
    topic_ids: List[str]
    question_styles: List[str]
    difficulty_mix: Dict[str, float]
    question_fingerprints: List[str]
    created_at: str


@dataclass
class UniquenessResult:
    """Result of uniqueness check."""
    is_unique: bool
    similarity_score: float  # 0-1, lower is more unique
    conflicting_exams: List[str]
    reason: Optional[str] = None


class UniquenessManager:
    """Manages exam uniqueness checking and tracking."""

    def __init__(
        self,
        existing_summaries: List[ExamSummary],
        similarity_threshold: float = 0.7
    ):
        """Initialize with existing exam summaries.

        Args:
            existing_summaries: Summaries of previously generated exams
            similarity_threshold: Max similarity before rejecting (0-1)
        """
        self.existing_summaries = existing_summaries
        self.similarity_threshold = similarity_threshold

        # Build lookup sets for fast checking
        self._topic_combinations: Dict[str, Set[str]] = {}
        self._fingerprints: Set[str] = set()

        for summary in existing_summaries:
            exam_key = summary.exam_id
            self._topic_combinations[exam_key] = set(summary.topic_ids)
            self._fingerprints.update(summary.question_fingerprints)

        logger.info(
            f"Initialized UniquenessManager with {len(existing_summaries)} existing exams, "
            f"{len(self._fingerprints)} known fingerprints"
        )

    def check_question_unique(self, question_content: str) -> bool:
        """Check if a question is unique by content fingerprint.

        Args:
            question_content: Question stem text

        Returns:
            True if unique, False if too similar to existing
        """
        fingerprint = self._generate_fingerprint(question_content)
        return fingerprint not in self._fingerprints

    def check_exam_unique(
        self,
        topic_ids: List[str],
        question_fingerprints: List[str]
    ) -> UniquenessResult:
        """Check if an exam combination is unique.

        Args:
            topic_ids: Topics covered by the exam
            question_fingerprints: Content fingerprints of questions

        Returns:
            UniquenessResult with similarity analysis
        """
        topic_set = set(topic_ids)
        fingerprint_set = set(question_fingerprints)

        max_similarity = 0.0
        conflicting = []

        for summary in self.existing_summaries:
            existing_topics = set(summary.topic_ids)
            existing_fps = set(summary.question_fingerprints)

            # Calculate Jaccard similarity for topics
            topic_similarity = self._jaccard_similarity(topic_set, existing_topics)

            # Calculate fingerprint overlap
            fp_overlap = len(fingerprint_set & existing_fps) / max(len(fingerprint_set), 1)

            # Combined similarity score
            combined = 0.6 * topic_similarity + 0.4 * fp_overlap

            if combined > max_similarity:
                max_similarity = combined

            if combined > self.similarity_threshold:
                conflicting.append(summary.exam_id)

        is_unique = max_similarity < self.similarity_threshold

        return UniquenessResult(
            is_unique=is_unique,
            similarity_score=max_similarity,
            conflicting_exams=conflicting,
            reason=None if is_unique else f"Too similar to existing exams: {conflicting[:3]}"
        )

    def register_question(self, question_content: str) -> str:
        """Register a question fingerprint.

        Args:
            question_content: Question stem text

        Returns:
            The fingerprint string
        """
        fingerprint = self._generate_fingerprint(question_content)
        self._fingerprints.add(fingerprint)
        return fingerprint

    def _generate_fingerprint(self, content: str) -> str:
        """Generate a content fingerprint.

        Uses normalized text to catch similar but not identical questions.
        """
        # Normalize: lowercase, remove extra whitespace, remove punctuation
        normalized = content.lower()
        normalized = " ".join(normalized.split())
        normalized = "".join(c for c in normalized if c.isalnum() or c.isspace())

        # Hash for compact storage
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def _jaccard_similarity(self, set1: Set[str], set2: Set[str]) -> float:
        """Calculate Jaccard similarity between two sets."""
        if not set1 and not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0


async def load_existing_summaries(course_id: str) -> List[ExamSummary]:
    """Load existing exam summaries from Appwrite.

    Args:
        course_id: Course to load summaries for

    Returns:
        List of ExamSummary objects
    """
    logger.info(f"Loading exam summaries for course: {course_id}")

    try:
        from ..utils.appwrite_client import get_databases
    except ImportError:
        logger.warning("Appwrite client not available, returning empty summaries")
        return []

    databases = get_databases()

    try:
        from appwrite.query import Query

        result = databases.list_documents(
            database_id="default",
            collection_id="nat5_plus_exam_summaries",
            queries=[Query.equal("courseId", course_id)]
        )

        summaries = []
        for doc in result["documents"]:
            summary = ExamSummary(
                exam_id=doc.get("exam_id", ""),
                course_id=doc.get("courseId", ""),
                topic_ids=doc.get("topic_ids", []),
                question_styles=doc.get("question_styles", []),
                difficulty_mix=_parse_json(doc.get("difficulty_mix", "{}")),
                question_fingerprints=_parse_json(doc.get("question_fingerprints", "[]")),
                created_at=doc.get("created_at", "")
            )
            summaries.append(summary)

        logger.info(f"Loaded {len(summaries)} existing exam summaries")
        return summaries

    except Exception as e:
        logger.warning(f"Failed to load summaries: {e}")
        return []


def _parse_json(value: str) -> Any:
    """Parse JSON string safely."""
    if not value:
        return {}
    try:
        if isinstance(value, (dict, list)):
            return value
        return json.loads(value)
    except json.JSONDecodeError:
        return {}
