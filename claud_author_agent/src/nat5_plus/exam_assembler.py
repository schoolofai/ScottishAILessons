"""
Exam Assembler

Stitches individually generated questions into a complete exam structure.
Handles section organization, mark totals, and metadata generation.

Pipeline Position: Phase 4 (after question generation)
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass

from ..models.nat5_plus_exam_models import (
    Nat5PlusMockExam,
    ExamSection,
    Nat5PlusQuestion,
    QuestionDiagram,
    ExamMetadata,
    GenerationMetadata,
    DifficultyDistribution,
    MarkingScheme,
    MarkingBullet,
    IllustrativeAnswer,
)
from ..models.nat5_plus_question_generation_schema import (
    ExamPlan,
    QuestionGeneration,
)
from .past_paper_template_extractor import PaperConfig

logger = logging.getLogger(__name__)


def assemble_exam(
    exam_plan: ExamPlan,
    questions: List[QuestionGeneration],
    course_id: str,
    subject: str,
    level: str,
    calculator_allowed: bool,
    paper_config: Optional[PaperConfig] = None,
    exam_version: int = 1,
    diagram_map: Optional[Dict[str, List[QuestionDiagram]]] = None
) -> Nat5PlusMockExam:
    """Assemble questions into a complete exam.

    Args:
        exam_plan: The exam plan that guided generation
        questions: Generated questions
        course_id: Course identifier
        subject: Subject name
        level: Qualification level
        calculator_allowed: Whether calculator is allowed for this exam
        paper_config: Configuration from past papers (marks, duration)
        exam_version: Version number for this course
        diagram_map: Optional mapping of question_id to List[QuestionDiagram]

    Returns:
        Complete Nat5PlusMockExam structure (single section, no splitting)
    """
    calc_label = "calculator" if calculator_allowed else "non-calculator"
    logger.info(f"Assembling {calc_label} exam with {len(questions)} questions")

    if diagram_map is None:
        diagram_map = {}

    # Use paper_config for duration if available, otherwise defaults
    duration = paper_config.typical_duration if paper_config else 90

    # Convert QuestionGeneration to Nat5PlusQuestion
    converted_questions = [
        _convert_question(q, idx + 1, diagram_map)
        for idx, q in enumerate(questions)
    ]

    # Renumber questions sequentially (1, 2, 3, ...)
    # Note: _renumber_questions only updates question_number, preserves question_id
    _renumber_questions(converted_questions, start=1)

    # Build SINGLE section (no splitting based on calculator/marks)
    instruction = (
        "Answer ALL questions. A calculator may be used."
        if calculator_allowed
        else "Answer ALL questions. You may NOT use a calculator."
    )

    total_marks = sum(q.marks for q in converted_questions)

    section = ExamSection(
        section_id="main",
        section_name="Questions",
        total_marks=total_marks,
        instructions=instruction,
        questions=converted_questions
    )

    # Build difficulty distribution
    difficulty_dist = _calculate_difficulty_distribution(converted_questions)

    # Collect all topic IDs
    all_topics = set()
    for q in converted_questions:
        all_topics.update(q.topic_ids)

    # Collect template sources
    template_sources = list(set(
        q.template_paper_id for q in converted_questions if q.template_paper_id
    ))

    # Generate exam ID
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    calc_suffix = "calc" if calculator_allowed else "nocalc"
    exam_id = f"exam_{subject.lower().replace(' ', '_')}_{level.lower().replace(' ', '_')}_{calc_suffix}_{timestamp}"

    # Build metadata with correct calculator_allowed from parameter
    metadata = ExamMetadata(
        title=f"{level} {subject} Mock Exam - Version {exam_version}",
        total_marks=total_marks,
        duration_minutes=duration,
        calculator_allowed=calculator_allowed,
        generated_at=datetime.utcnow().isoformat() + "Z",
        sqa_aligned=True
    )

    # Build generation metadata
    gen_metadata = GenerationMetadata(
        model="claude-3-5-sonnet-20241022",
        tokens_used=0,  # Would be tracked during generation
        generation_timestamp=datetime.utcnow().isoformat() + "Z",
        pipeline_version="1.0.0"
    )

    # Assemble final exam with single section
    exam = Nat5PlusMockExam(
        exam_id=exam_id,
        course_id=course_id,
        subject=subject,
        level=level,
        exam_version=exam_version,
        status="draft",
        metadata=metadata,
        sections=[section],  # Single section, no splitting
        topic_coverage=list(all_topics),
        difficulty_distribution=difficulty_dist,
        template_sources=template_sources,
        generation_metadata=gen_metadata
    )

    logger.info(
        f"Assembled {calc_label} exam: {exam_id} with {len(converted_questions)} questions, "
        f"{total_marks} total marks, {duration} min"
    )

    return exam


def _convert_question(
    q: QuestionGeneration,
    index: int,
    diagram_map: Dict[str, List[QuestionDiagram]]
) -> Nat5PlusQuestion:
    """Convert QuestionGeneration to Nat5PlusQuestion.

    Args:
        q: The generated question
        index: Question index (1-based)
        diagram_map: Mapping of question_id to diagrams from Phase 3.5

    Returns:
        Nat5PlusQuestion with diagrams populated if available
    """
    # Convert marking scheme
    generic_bullets = [
        MarkingBullet(
            bullet=b.bullet,
            process=b.process,
            marks=b.marks
        )
        for b in q.marking_scheme.generic_scheme
    ]

    illustrative_bullets = [
        IllustrativeAnswer(
            bullet=b.bullet,
            answer=b.answer,
            answer_latex=b.answer_latex,
            tolerance_range=None,
            acceptable_variations=[]
        )
        for b in q.marking_scheme.illustrative_scheme
    ]

    marking_scheme = MarkingScheme(
        max_marks=q.marking_scheme.max_marks,
        generic_scheme=generic_bullets,
        illustrative_scheme=illustrative_bullets,
        notes=q.marking_scheme.notes
    )

    # Get diagrams for this question from diagram_map (Phase 3.5 output)
    question_id = q.question_id or f"q{index}"
    diagrams = diagram_map.get(question_id, [])

    if diagrams:
        logger.info(f"   Question {question_id}: {len(diagrams)} diagram(s) attached")

    return Nat5PlusQuestion(
        question_id=question_id,
        question_number=str(index),
        marks=q.marks,
        difficulty=q.difficulty,
        question_style="procedural",  # Default, could be enhanced
        stem=q.stem,
        stem_latex=q.stem_latex,
        topic_ids=q.topic_ids,
        template_paper_id="",  # Would be set during generation
        marking_scheme=marking_scheme,
        diagrams=diagrams,  # Populated from Phase 3.5 diagram generation
        hints=q.hints,
        common_errors=q.common_errors
    )


def _renumber_questions(questions: List[Nat5PlusQuestion], start: int) -> None:
    """Renumber question display numbers in place.

    Note: Only updates question_number for display purposes.
    Preserves original question_id for diagram mapping and tracking.
    """
    for idx, q in enumerate(questions):
        q.question_number = str(start + idx)


def _calculate_difficulty_distribution(
    questions: List[Nat5PlusQuestion]
) -> DifficultyDistribution:
    """Calculate difficulty distribution from questions."""
    if not questions:
        return DifficultyDistribution()

    total = len(questions)
    easy = sum(1 for q in questions if q.difficulty == "easy")
    medium = sum(1 for q in questions if q.difficulty == "medium")
    hard = sum(1 for q in questions if q.difficulty == "hard")

    return DifficultyDistribution(
        easy=easy / total,
        medium=medium / total,
        hard=hard / total
    )


def save_exam_to_workspace(exam: Nat5PlusMockExam, workspace_path: Path) -> Path:
    """Save assembled exam to workspace directory.

    Args:
        exam: The assembled exam
        workspace_path: Directory to save to

    Returns:
        Path to saved file
    """
    output_path = workspace_path / "mock_exam.json"
    workspace_path.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        f.write(exam.model_dump_json(indent=2))

    logger.info(f"Saved exam to {output_path}")
    return output_path
