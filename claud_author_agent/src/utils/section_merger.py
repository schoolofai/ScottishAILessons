"""Section Merger Utility - Merges generated sections into a complete MockExam.

Part of the section-based scaling solution for mock exam generation.
Combines independently generated sections into the full MockExam schema.

Responsibilities:
- Merge sections into proper order
- Renumber questions if needed (ensuring sequential numbering across sections)
- Compute summary statistics (total questions, marks, difficulty distribution)
- Validate section consistency (no gaps, proper ordering)
- Generate exam-level metadata
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..tools.mock_exam_schema_models import MockExam

logger = logging.getLogger(__name__)


class SectionMerger:
    """Merges multiple generated sections into a complete MockExam."""

    def __init__(
        self,
        exam_metadata: Dict[str, Any],
        sections: List[Dict[str, Any]]
    ):
        """Initialize Section Merger.

        Args:
            exam_metadata: Exam-level metadata (examId, courseId, title, etc.)
            sections: List of section dicts in full schema format
        """
        self.exam_metadata = exam_metadata
        self.sections = sorted(sections, key=lambda s: s.get("section_order", 0))

    def merge(self) -> Dict[str, Any]:
        """Merge sections into complete MockExam JSON.

        Returns:
            Dict conforming to full MockExam schema

        Raises:
            RuntimeError: If sections have inconsistencies
        """
        logger.info("=" * 60)
        logger.info("SECTION MERGER - Merging sections into MockExam")
        logger.info(f"   Sections to merge: {len(self.sections)}")
        logger.info("=" * 60)

        # Validate sections
        self._validate_sections()

        # Renumber questions across sections (ensure sequential)
        merged_sections = self._renumber_questions()

        # Compute summary statistics
        summary = self._compute_summary(merged_sections)

        # Build metadata object
        metadata = self._build_metadata()

        # Construct complete mock exam
        mock_exam = {
            "schema_version": self.exam_metadata.get("schema_version", "mock_exam_v1"),
            "examId": self.exam_metadata["examId"],
            "courseId": self.exam_metadata["courseId"],
            "sowId": self.exam_metadata["sowId"],
            "sowEntryOrder": self.exam_metadata["sowEntryOrder"],
            "metadata": metadata,
            "sections": merged_sections,
            "summary": summary,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "agent_version": "section_based_author_v1.0"
        }

        logger.info("✅ Merge complete")
        logger.info(f"   Total sections: {len(merged_sections)}")
        logger.info(f"   Total questions: {summary['total_questions']}")
        logger.info(f"   Total marks: {metadata['totalMarks']}")

        return mock_exam

    def _validate_sections(self):
        """Validate sections for consistency."""
        if not self.sections:
            raise RuntimeError("No sections provided for merging")

        # Check section orders are sequential starting from 1
        orders = [s.get("section_order", 0) for s in self.sections]
        expected_orders = list(range(1, len(self.sections) + 1))

        if sorted(orders) != expected_orders:
            logger.warning(f"Section orders not sequential: {orders}, expected {expected_orders}")
            # Auto-fix by reordering based on position
            for i, section in enumerate(self.sections):
                section["section_order"] = i + 1

        # Check each section has questions
        for i, section in enumerate(self.sections):
            questions = section.get("questions", [])
            if not questions:
                logger.warning(f"Section {i + 1} has no questions")

        logger.info("✅ Section validation passed")

    def _renumber_questions(self) -> List[Dict[str, Any]]:
        """Renumber questions sequentially across all sections.

        Returns:
            List of sections with renumbered questions
        """
        merged_sections = []
        current_question_num = 1

        for section in self.sections:
            new_section = section.copy()
            new_questions = []

            for question in section.get("questions", []):
                new_question = question.copy()

                # Update question number
                old_num = new_question.get("question_number", 0)
                new_question["question_number"] = current_question_num

                # Update question_id to match new number
                new_question["question_id"] = f"q{current_question_num}"

                if old_num != current_question_num:
                    logger.debug(f"  Renumbered Q{old_num} -> Q{current_question_num}")

                new_questions.append(new_question)
                current_question_num += 1

            new_section["questions"] = new_questions
            merged_sections.append(new_section)

        logger.info(f"✅ Questions renumbered: 1-{current_question_num - 1}")
        return merged_sections

    def _compute_summary(self, sections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute summary statistics from merged sections.

        Args:
            sections: List of merged sections

        Returns:
            Summary dict matching MockExam.summary schema
        """
        total_questions = 0
        difficulty_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        standard_counts: Dict[str, int] = {}

        for section in sections:
            for question in section.get("questions", []):
                total_questions += 1

                # Count by difficulty
                difficulty = question.get("difficulty", "medium")
                difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1

                # Count by question type
                q_type = question.get("question_type", "short_text")
                type_counts[q_type] = type_counts.get(q_type, 0) + 1

                # Count standards
                for standard in question.get("standards_addressed", []):
                    code = standard.get("code", standard.get("skill_name", ""))
                    if code:
                        standard_counts[code] = standard_counts.get(code, 0) + 1

        # Build summary (omit zero counts per validation rules)
        summary = {
            "total_questions": total_questions,
            "questions_by_difficulty": {k: v for k, v in difficulty_counts.items() if v > 0},
            "questions_by_type": {k: v for k, v in type_counts.items() if v > 0},
            "standards_coverage": [
                {"code": code, "question_count": count}
                for code, count in sorted(standard_counts.items())
                if count > 0
            ]
        }

        logger.info(f"  Difficulty distribution: {summary['questions_by_difficulty']}")
        logger.info(f"  Type distribution: {summary['questions_by_type']}")

        return summary

    def _build_metadata(self) -> Dict[str, Any]:
        """Build metadata object from exam_metadata."""
        em = self.exam_metadata

        # Calculate total marks from sections
        total_marks = sum(
            s.get("section_marks", 0)
            for s in self.sections
        )

        # Calculate total time from sections
        total_time = sum(
            s.get("section_time_allocation", 0) or 0
            for s in self.sections
        )

        # Use provided time if section allocations not specified
        if total_time == 0:
            total_time = em.get("timeLimit", 60)

        return {
            "title": em.get("title", "Mock Examination"),
            "subject": em.get("subject", "mathematics"),
            "level": em.get("level", "national-4"),
            "totalMarks": total_marks,
            "timeLimit": total_time,
            "instructions": em.get("instructions", "Answer ALL questions. Show all working clearly."),
            "instructions_plain": em.get("instructions_plain", "Answer every question. Write down your steps."),
            "calculator_policy": em.get("calculator_policy", "calc"),
            "exam_conditions": em.get("exam_conditions", True),
            "accessibility_profile": em.get("accessibility_profile", {
                "plain_language_level": "B1",
                "dyslexia_friendly": True,
                "extra_time_percentage": 25
            })
        }


def merge_sections(
    exam_metadata: Dict[str, Any],
    sections: List[Dict[str, Any]],
    validate: bool = True
) -> Dict[str, Any]:
    """Merge sections into complete MockExam.

    Args:
        exam_metadata: Exam-level metadata
        sections: List of section dicts in full schema format
        validate: If True, validate with Pydantic after merge

    Returns:
        Complete MockExam dict

    Raises:
        RuntimeError: If merge or validation fails
    """
    merger = SectionMerger(
        exam_metadata=exam_metadata,
        sections=sections
    )

    mock_exam_dict = merger.merge()

    if validate:
        logger.info("Validating merged MockExam with Pydantic...")
        try:
            MockExam.model_validate(mock_exam_dict)
            logger.info("✅ MockExam validation passed")
        except Exception as e:
            logger.error(f"MockExam validation failed: {e}")
            raise RuntimeError(f"Merged exam failed validation: {e}")

    return mock_exam_dict


def write_merged_exam(
    exam_metadata: Dict[str, Any],
    sections: List[Dict[str, Any]],
    output_path: Path,
    validate: bool = True
) -> MockExam:
    """Merge sections and write to file.

    Args:
        exam_metadata: Exam-level metadata
        sections: List of section dicts
        output_path: Path to write mock_exam.json
        validate: If True, validate before writing

    Returns:
        Validated MockExam Pydantic model

    Raises:
        RuntimeError: If merge, validation, or write fails
    """
    mock_exam_dict = merge_sections(
        exam_metadata=exam_metadata,
        sections=sections,
        validate=validate
    )

    # Write to file
    with open(output_path, 'w') as f:
        json.dump(mock_exam_dict, f, indent=2)
    logger.info(f"✅ Written mock_exam.json to {output_path}")

    # Return validated model
    return MockExam.model_validate(mock_exam_dict)
