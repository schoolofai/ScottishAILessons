"""SDK MCP server for Mock Exam schema validation using Pydantic models.

This tool provides fast, deterministic validation of Mock Exam JSON files using the
Pydantic models defined in mock_exam_schema_models.py.

Integration: Claude Agent SDK registers this as mcp__validator__validate_mock_exam_schema
"""

import json
import logging
from typing import Dict, Any, List
from pathlib import Path

from pydantic import ValidationError
from claude_agent_sdk import tool, create_sdk_mcp_server

try:
    from .mock_exam_schema_models import MockExam, validate_mock_exam
except ImportError:
    from mock_exam_schema_models import MockExam, validate_mock_exam

logger = logging.getLogger(__name__)


def validate_mock_exam_schema(exam_json_str: str) -> Dict[str, Any]:
    """Validate Mock Exam JSON against Pydantic schema.

    Args:
        exam_json_str: JSON string of mock exam

    Returns:
        Dictionary with:
        - valid: bool - Whether exam passes all validation
        - errors: List[Dict] - Validation errors (max 10, with locations)
        - summary: str - Human-readable summary
        - stats: Dict - Exam statistics (questions, marks, types)

    Example error format:
    {
        "location": "sections[0].questions[2].marks",
        "message": "Question marks (3) must equal marking scheme total (4)",
        "value": 3,
        "type": "value_error"
    }
    """
    try:
        # Parse JSON
        try:
            exam_data = json.loads(exam_json_str)
        except json.JSONDecodeError as e:
            return {
                "valid": False,
                "errors": [{
                    "location": "root",
                    "message": f"Invalid JSON: {str(e)}",
                    "value": None,
                    "type": "json_error"
                }],
                "summary": "❌ JSON parsing failed",
                "stats": None
            }

        # Validate with Pydantic
        try:
            validated_exam = MockExam.model_validate(exam_data)

            # Collect statistics
            stats = _collect_exam_stats(validated_exam)

            return {
                "valid": True,
                "errors": [],
                "summary": f"✅ Mock exam validation passed ({stats['total_questions']} questions, {stats['total_marks']} marks)",
                "stats": stats
            }

        except ValidationError as e:
            # Format Pydantic errors into agent-friendly structure
            formatted_errors = _format_validation_errors(e)

            # Limit to 10 errors for concise feedback
            limited_errors = formatted_errors[:10]
            truncated_count = len(formatted_errors) - 10 if len(formatted_errors) > 10 else 0

            summary = f"❌ Mock exam validation failed with {len(formatted_errors)} errors"
            if truncated_count > 0:
                summary += f" (showing first 10, {truncated_count} more errors hidden)"

            return {
                "valid": False,
                "errors": limited_errors,
                "summary": summary,
                "stats": None
            }

    except Exception as e:
        logger.exception("Unexpected error during mock exam validation")
        return {
            "valid": False,
            "errors": [{
                "location": "root",
                "message": f"Unexpected validation error: {str(e)}",
                "value": None,
                "type": "internal_error"
            }],
            "summary": f"❌ Validation system error: {str(e)}",
            "stats": None
        }


def _format_validation_errors(validation_error: ValidationError) -> List[Dict[str, Any]]:
    """Convert Pydantic ValidationError into agent-friendly error objects.

    Args:
        validation_error: Pydantic ValidationError with error details

    Returns:
        List of error dictionaries with location, message, value, type
    """
    formatted = []

    for error in validation_error.errors():
        # Build location path from error['loc'] tuple
        # Example: ('sections', 0, 'questions', 2, 'marks')
        # Becomes: "sections[0].questions[2].marks"
        location_parts = []
        for part in error['loc']:
            if isinstance(part, int):
                # Array index
                if location_parts:
                    location_parts[-1] = f"{location_parts[-1]}[{part}]"
                else:
                    location_parts.append(f"[{part}]")
            else:
                # Field name
                location_parts.append(str(part))

        location = ".".join(location_parts)

        # Extract error details
        error_type = error.get('type', 'validation_error')
        message = error.get('msg', 'Validation error')

        # Get the actual value that failed (if available in context)
        value = error.get('input', None)

        formatted.append({
            "location": location,
            "message": message,
            "value": value,
            "type": error_type
        })

    return formatted


def _collect_exam_stats(exam: MockExam) -> Dict[str, Any]:
    """Collect statistics about validated mock exam.

    Args:
        exam: Validated MockExam instance

    Returns:
        Dictionary with counts and breakdowns
    """
    total_questions = 0
    question_type_counts = {}
    difficulty_counts = {}
    section_info = []

    for section in exam.sections:
        section_question_count = len(section.questions)
        total_questions += section_question_count

        section_info.append({
            "id": section.section_id,
            "label": section.section_label,
            "marks": section.section_marks,
            "questions": section_question_count
        })

        for question in section.questions:
            # Count question types
            q_type = question.question_type.value
            question_type_counts[q_type] = question_type_counts.get(q_type, 0) + 1

            # Count difficulties
            difficulty = question.difficulty.value
            difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1

    return {
        "exam_id": exam.examId,
        "course_id": exam.courseId,
        "sow_id": exam.sowId,
        "total_sections": len(exam.sections),
        "total_questions": total_questions,
        "total_marks": exam.metadata.totalMarks,
        "time_limit_minutes": exam.metadata.timeLimit,
        "question_types": question_type_counts,
        "difficulties": difficulty_counts,
        "sections": section_info
    }


# ════════════════════════════════════════════════════════════════════════════
# SDK MCP Server Definition for Claude Agent SDK
# ════════════════════════════════════════════════════════════════════════════

@tool(
    "validate_mock_exam_schema",
    "Validate Mock Exam JSON against Pydantic schema with detailed error reporting",
    {"exam_json_str": str}
)
async def validate_mock_exam_schema_tool(args):
    """SDK tool wrapper for Mock Exam schema validation.

    This tool validates a Mock Exam JSON file against the Scottish AI
    Lessons Pydantic schema. Returns detailed validation results with error
    locations, messages, and statistics.

    Args:
        args: Dictionary with 'exam_json_str' key containing complete Mock Exam JSON as string

    Returns:
        SDK tool result with validation details and error status
    """
    exam_json_str = args["exam_json_str"]

    # Call existing validation function
    result = validate_mock_exam_schema(exam_json_str)

    # Format result as JSON for agent consumption
    result_json = json.dumps(result, indent=2)

    # Return in SDK tool format
    return {
        "content": [{
            "type": "text",
            "text": result_json
        }],
        "isError": not result["valid"]
    }


# Create SDK MCP server (in-process, not subprocess)
mock_exam_validation_server = create_sdk_mcp_server(
    name="mock-exam-validator",
    version="1.0.0",
    tools=[validate_mock_exam_schema_tool]
)

# Tool naming convention: mcp__mock-exam-validator__validate_mock_exam_schema


# CLI entry point for standalone testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Test mode: validate file from command line
        file_path = Path(sys.argv[1])

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)

        print(f"Validating Mock Exam file: {file_path}")
        print("=" * 60)

        exam_json = file_path.read_text()
        result = validate_mock_exam_schema(exam_json)

        print(json.dumps(result, indent=2))

        sys.exit(0 if result["valid"] else 1)
    else:
        print("Usage:")
        print("  python mock_exam_validator_tool.py <path/to/mock_exam.json>")
        print("")
        print("Note: SDK MCP server is created as 'mock_exam_validation_server'")
        print("      Import and use directly in Claude Agent SDK applications")
        sys.exit(1)
