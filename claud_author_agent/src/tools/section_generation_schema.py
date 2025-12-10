"""Section-based generation schema for scalable mock exam authoring.

This schema generates ONE section at a time instead of the entire mock exam.
Benefits:
- Smaller structured output (~2-3K tokens per section vs ~9K+ for full exam)
- Parallel generation (sections can be generated concurrently)
- Partial recovery (failed section doesn't invalidate others)
- Section-level revision (only regenerate failed sections)

The Section and Question models are reused from mock_exam_generation_schema.py.
The SectionGeneration model adds context needed for section-aware generation.
"""

from pydantic import BaseModel
from typing import Literal, Optional, Any, List


# Type aliases using Literal (no enums = no $defs entries)
QuestionTypeValue = Literal["mcq", "mcq_multiselect", "numeric", "short_text", "structured_response"]
DifficultyValue = Literal["easy", "medium", "hard"]


class Question(BaseModel):
    """Flattened question structure - identical to mock_exam_generation_schema.Question."""

    # Identifiers
    question_id: str
    question_number: int
    marks: int
    difficulty: DifficultyValue
    estimated_minutes: int

    # Standards - list of dicts instead of nested StandardRef model
    # Uses field presence to determine type (NO "type" discriminator):
    # Unit-based format: [{"code": "AS1.1", "outcome": "O1", "description": "..."}]
    # Skills-based format: [{"skill_name": "Working with surds", "description": "..."}]
    standards_addressed: list[dict[str, Any]]

    # Question content
    question_stem: str
    question_stem_plain: str
    question_type: QuestionTypeValue

    # Answer key - flattened (no AnswerKey model)
    correct_answer: str
    acceptable_variations: list[str]
    # Format: [{"step": "Cancel common factor", "marks": 1}, ...]
    marking_scheme: list[dict[str, Any]]

    # MCQ options - only for mcq/mcq_multiselect types
    # Format: [{"label": "A", "text": "...", "is_correct": true, "feedback": "..."}]
    mcq_options: Optional[list[dict[str, Any]]] = None

    # Support content
    hints: list[str]
    # Format: [{"error_pattern": "350", "feedback": "Check your arithmetic..."}]
    misconceptions: list[dict[str, Any]]

    # Worked solution - flattened (no WorkedSolution model)
    worked_solution_steps: list[str]
    worked_solution_answer: str

    # Diagram references
    diagram_refs: list[str]


class SectionGeneration(BaseModel):
    """Schema for generating a single exam section.

    This is the output schema for the section author agent.
    Contains just the section data - exam-level metadata comes from context.
    """

    # Section identification
    section_id: str
    section_label: str
    section_order: int
    section_marks: int
    section_time_allocation: Optional[int] = None
    section_instructions: str

    # Questions in this section
    questions: list[Question]

    # Section-level summary (for validation)
    section_question_count: int
    section_total_marks: int


# Input context for section generation (not part of output schema)
class SectionGenerationContext(BaseModel):
    """Context provided to the section author agent.

    This is NOT the output schema - it's the input context.
    Contains exam-level information needed for consistent generation.
    """

    # Exam identifiers
    examId: str
    courseId: str
    sowId: str
    sowEntryOrder: int

    # Exam metadata for context
    subject: str
    level: str
    title: str
    total_exam_marks: int
    total_exam_time: int
    calculator_policy: str

    # Section-specific context
    section_index: int  # 0-indexed position
    total_sections: int
    section_spec: dict[str, Any]  # The card specification from mock_exam_source

    # Standards to address in this section
    standards_to_address: list[dict[str, Any]]

    # Question numbering context
    question_number_start: int  # First question number for this section


def convert_section_to_full_schema(section: dict, exam_context: dict) -> dict:
    """Convert section generation output to full schema section format.

    Args:
        section: Dict from SectionGeneration structured output
        exam_context: Exam-level context (examId, courseId, etc.)

    Returns:
        Dict matching the Section format in mock_exam_schema_models.py
    """
    converted_questions = []

    for q in section["questions"]:
        # Build CFU config
        cfu_config = {
            "type": q["question_type"],
            "expected_format": None,
            "allow_drawing": False,
            "options": q.get("mcq_options"),
            "answer_key": {
                "correct_answer": q["correct_answer"],
                "acceptable_variations": q["acceptable_variations"],
                "marking_scheme": q["marking_scheme"]
            }
        }

        # Build worked solution
        worked_solution = {
            "steps": q["worked_solution_steps"],
            "final_answer": q["worked_solution_answer"]
        }

        # Convert standards_addressed - uses field presence (NO type discriminator)
        standards = []
        for std in q["standards_addressed"]:
            converted_std = {
                "description": std.get("description", "")
            }
            if std.get("code"):
                converted_std["code"] = std["code"]
            if std.get("outcome"):
                converted_std["outcome"] = std["outcome"]
            if std.get("skill_name"):
                converted_std["skill_name"] = std["skill_name"]
            standards.append(converted_std)

        # MCQ correct option marking
        if q["question_type"] in ("mcq", "mcq_multiselect") and cfu_config.get("options"):
            correct_answer = q["correct_answer"]
            options = cfu_config["options"]

            has_agent_marking = any(opt.get("is_correct") is True for opt in options)

            if has_agent_marking:
                for opt in options:
                    if "is_correct" not in opt:
                        opt["is_correct"] = False
            else:
                for opt in options:
                    label = opt.get("label", "")
                    text = opt.get("text", "")
                    is_match = (
                        label == correct_answer or
                        text == correct_answer or
                        correct_answer in [label, text] or
                        label.lower() == correct_answer.lower()
                    )
                    opt["is_correct"] = is_match

        converted_questions.append({
            "question_id": q["question_id"],
            "question_number": q["question_number"],
            "marks": q["marks"],
            "difficulty": q["difficulty"],
            "estimated_minutes": q["estimated_minutes"],
            "standards_addressed": standards,
            "question_stem": q["question_stem"],
            "question_stem_plain": q["question_stem_plain"],
            "question_type": q["question_type"],
            "cfu_config": cfu_config,
            "hints": q["hints"],
            "misconceptions": q["misconceptions"],
            "worked_solution": worked_solution,
            "diagram_refs": q["diagram_refs"]
        })

    return {
        "section_id": section["section_id"],
        "section_label": section["section_label"],
        "section_order": section["section_order"],
        "section_marks": section["section_marks"],
        "section_time_allocation": section.get("section_time_allocation"),
        "section_instructions": section["section_instructions"],
        "questions": converted_questions
    }


def get_section_schema_stats() -> dict:
    """Get statistics about the section generation schema."""
    import json
    schema = SectionGeneration.model_json_schema()
    schema_str = json.dumps(schema)

    return {
        "schema_size_chars": len(schema_str),
        "definitions_count": len(schema.get("$defs", {})),
        "top_level_properties": list(schema.get("properties", {}).keys())
    }


# Constants for section generation
SECTION_GENERATION_OUTPUT_FILE = "section_output.json"
