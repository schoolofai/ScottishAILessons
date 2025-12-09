"""Simplified MockExam schema for structured output generation.

This schema is optimized for Claude Agent SDK structured outputs:
- Only 3 model definitions (vs 17+ in full schema)
- No enums (uses Literal inline)
- No validators (moved to post-processing)
- Flat structure (2 levels max nesting)
- ~2-3KB schema size (vs ~13KB)

Use this schema for output_format in the agent.
Use mock_exam_schema_models.py for post-processing validation.
"""

from pydantic import BaseModel
from typing import Literal, Optional, Any


# Type aliases using Literal (no enums = no $defs entries)
QuestionTypeValue = Literal["mcq", "mcq_multiselect", "numeric", "short_text", "structured_response"]
DifficultyValue = Literal["easy", "medium", "hard"]
CalculatorPolicyValue = Literal["non_calc", "calc", "mixed", "exam_conditions"]
CEFRLevelValue = Literal["A1", "A2", "B1", "B2"]
StandardTypeValue = Literal["outcome", "skill"]


class Question(BaseModel):
    """Flattened question structure - all nested models inlined as dict/list."""

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


class Section(BaseModel):
    """Exam section containing questions."""
    section_id: str
    section_label: str
    section_order: int
    section_marks: int
    section_time_allocation: Optional[int] = None
    section_instructions: str
    questions: list[Question]


class MockExamGeneration(BaseModel):
    """Simplified mock exam schema for structured output generation.

    Only 3 model definitions total:
    - MockExamGeneration (this)
    - Section
    - Question

    All other nested structures use dict/list for simplicity.
    """

    # Schema version
    schema_version: str = "mock_exam_v1"

    # Identifiers
    examId: str
    courseId: str
    sowId: str
    sowEntryOrder: int

    # Metadata - flattened (no ExamMetadata model)
    title: str
    subject: str
    level: str
    totalMarks: int
    timeLimit: int
    instructions: str
    instructions_plain: str
    calculator_policy: CalculatorPolicyValue
    exam_conditions: bool = True

    # Accessibility - flattened (no AccessibilityProfile model)
    plain_language_level: CEFRLevelValue = "B1"
    dyslexia_friendly: bool = True
    extra_time_percentage: int = 25

    # Content
    sections: list[Section]

    # Summary - use dict for computed fields
    # Format: {"total_questions": 15, "questions_by_difficulty": {"easy": 5, ...}, ...}
    summary: dict[str, Any]

    # Agent metadata
    generated_at: str
    agent_version: str = "mock_exam_author_v1.0"


def convert_to_full_schema(simplified: dict) -> dict:
    """Convert simplified generation schema to full MockExam schema.

    This restructures the flattened output into the nested format
    expected by the frontend and validation systems.

    Args:
        simplified: Dict from MockExamGeneration structured output

    Returns:
        Dict conforming to full MockExam schema
    """
    # Build metadata object
    metadata = {
        "title": simplified["title"],
        "subject": simplified["subject"],
        "level": simplified["level"],
        "totalMarks": simplified["totalMarks"],
        "timeLimit": simplified["timeLimit"],
        "instructions": simplified["instructions"],
        "instructions_plain": simplified["instructions_plain"],
        "calculator_policy": simplified["calculator_policy"],
        "exam_conditions": simplified.get("exam_conditions", True),
        "accessibility_profile": {
            "plain_language_level": simplified.get("plain_language_level", "B1"),
            "dyslexia_friendly": simplified.get("dyslexia_friendly", True),
            "extra_time_percentage": simplified.get("extra_time_percentage", 25)
        }
    }

    # Convert questions to full schema format
    converted_sections = []
    for section in simplified["sections"]:
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
            # Unit-based: code + outcome + description
            # Skills-based: skill_name + description
            standards = []
            for std in q["standards_addressed"]:
                # Pass through fields as-is - validation happens in Pydantic schema
                converted_std = {
                    "description": std.get("description", "")
                }

                # Copy optional fields if present
                if std.get("code"):
                    converted_std["code"] = std["code"]
                if std.get("outcome"):
                    converted_std["outcome"] = std["outcome"]
                if std.get("skill_name"):
                    converted_std["skill_name"] = std["skill_name"]

                standards.append(converted_std)

            # For MCQ/MCQ_multiselect, ensure correct option(s) are marked
            if q["question_type"] in ("mcq", "mcq_multiselect") and cfu_config.get("options"):
                correct_answer = q["correct_answer"]
                options = cfu_config["options"]

                # Check if agent already set is_correct on any option
                has_agent_marking = any(opt.get("is_correct") is True for opt in options)

                if has_agent_marking:
                    # Trust agent's explicit marking - ensure all options have is_correct field
                    for opt in options:
                        if "is_correct" not in opt:
                            opt["is_correct"] = False
                else:
                    # No agent marking - try to infer from correct_answer field
                    # Strategy: match by label first, then by text content
                    matched = False
                    for opt in options:
                        label = opt.get("label", "")
                        text = opt.get("text", "")

                        # Match by label (A, B, C, D) or by text content
                        is_match = (
                            label == correct_answer or
                            text == correct_answer or
                            correct_answer in [label, text] or
                            label.lower() == correct_answer.lower()
                        )
                        opt["is_correct"] = is_match
                        if is_match:
                            matched = True

                    # If no match found, log warning but don't fail silently
                    # The downstream validator will catch this as "0 correct options"
                    if not matched:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(
                            f"MCQ q{q.get('question_number', '?')}: Could not match "
                            f"correct_answer '{correct_answer}' to any option label/text"
                        )

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

        converted_sections.append({
            "section_id": section["section_id"],
            "section_label": section["section_label"],
            "section_order": section["section_order"],
            "section_marks": section["section_marks"],
            "section_time_allocation": section.get("section_time_allocation"),
            "section_instructions": section["section_instructions"],
            "questions": converted_questions
        })

    return {
        "schema_version": simplified.get("schema_version", "mock_exam_v1"),
        "examId": simplified["examId"],
        "courseId": simplified["courseId"],
        "sowId": simplified["sowId"],
        "sowEntryOrder": simplified["sowEntryOrder"],
        "metadata": metadata,
        "sections": converted_sections,
        "summary": simplified["summary"],
        "generated_at": simplified["generated_at"],
        "agent_version": simplified.get("agent_version", "mock_exam_author_v1.0")
    }


def get_schema_stats() -> dict:
    """Get statistics about the simplified schema."""
    import json
    schema = MockExamGeneration.model_json_schema()
    schema_str = json.dumps(schema)

    return {
        "schema_size_chars": len(schema_str),
        "definitions_count": len(schema.get("$defs", {})),
        "top_level_properties": list(schema.get("properties", {}).keys())
    }
