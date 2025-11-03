"""JSON Validation Tool for Lesson Templates using Pydantic.

Provides fast-fail validation with detailed error messages before files reach the upserter.
Prevents silent failures by catching JSON syntax errors and schema violations early.

CRITICAL: This validates lesson_template.json OUTPUT schema (not SOW input schema).
Authoritative sources:
- src/prompts/lesson_author_prompt_v2.md (lines 58-96) - Output Schema
- docs/schema/lesson_template_schema.md - Additional details

Usage:
    Tool name: mcp__validator__validate_lesson_template
    Args: {"file_path": "lesson_template.json"}

Returns:
    - Success: {"is_valid": true, "message": "✅ Validation passed", ...}
    - Failure: {"is_valid": false, "error_type": "...", "errors": [...]}
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError, ConfigDict

from claude_agent_sdk import tool, create_sdk_mcp_server


# ═══════════════════════════════════════════════════════════════
# Configuration Constants
# ═══════════════════════════════════════════════════════════════

# Maximum number of detailed errors to return (prevents token overflow)
MAX_ERRORS_DETAILED = 10

# Maximum length for input values when included in error responses
MAX_INPUT_VALUE_LENGTH = 100


# ═══════════════════════════════════════════════════════════════
# Base Component Models (used by cards)
# ═══════════════════════════════════════════════════════════════

class RubricCriterion(BaseModel):
    """Single marking criterion."""
    model_config = ConfigDict(extra="forbid")

    description: str = Field(..., min_length=10, max_length=500, description="Clear success criterion")
    points: float = Field(..., gt=0, description="Marks awarded for this criterion")


class Rubric(BaseModel):
    """Complete marking scheme for a question or card."""
    model_config = ConfigDict(extra="forbid")

    total_points: float = Field(..., gt=0, description="Total marks available")
    criteria: List[RubricCriterion] = Field(..., min_length=1, description="Breakdown of mark allocation")

    @field_validator('criteria')
    @classmethod
    def validate_criteria_sum(cls, v, info):
        """Validate sum of criteria points equals total_points."""
        if not v:
            return v

        total_from_criteria = sum(criterion.points for criterion in v)
        total_points = info.data.get('total_points') if hasattr(info, 'data') else None

        if total_points and abs(total_from_criteria - total_points) > 0.01:
            raise ValueError(
                f"Sum of criteria points ({total_from_criteria}) "
                f"does not equal total_points ({total_points})"
            )
        return v


class Misconception(BaseModel):
    """Common student error and remediation strategy."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        ...,
        pattern=r'^MISC_[A-Z]+_[A-Z_]+_\d{3}$',
        description="Format: MISC_SUBJECT_TOPIC_NNN"
    )
    misconception: str = Field(..., min_length=10, max_length=200, description="Brief error description")
    clarification: str = Field(..., min_length=20, max_length=500, description="Corrective explanation")


# ═══════════════════════════════════════════════════════════════
# CFU Type-Specific Models
# ═══════════════════════════════════════════════════════════════

class CFU_MCQ(BaseModel):
    """Multiple Choice Question CFU - Exact schema per lesson_author_prompt_v2.md lines 105-141."""
    model_config = ConfigDict(extra="allow")  # Allow additional fields for extensibility

    type: Literal["mcq"] = Field(..., description="CFU type discriminator")
    id: str = Field(..., min_length=1, description="Unique question ID (e.g., q001)")
    stem: str = Field(..., min_length=10, description="Question text shown to student")
    options: List[str] = Field(..., min_length=3, max_length=5, description="Answer choices")
    answerIndex: int = Field(..., ge=0, description="Zero-indexed position of correct answer")
    rubric: Rubric = Field(..., description="Marking scheme")

    @field_validator('answerIndex')
    @classmethod
    def validate_answer_index_in_range(cls, v, info):
        """Ensure answerIndex points to valid option."""
        options = info.data.get('options') if hasattr(info, 'data') else None
        if options and v >= len(options):
            raise ValueError(
                f"answerIndex {v} out of range for {len(options)} options "
                f"(valid range: 0-{len(options)-1})"
            )
        return v


class CFU_Numeric(BaseModel):
    """Numeric Answer CFU - Exact schema per lesson_author_prompt_v2.md lines 144-193."""
    model_config = ConfigDict(extra="allow")

    type: Literal["numeric"] = Field(..., description="CFU type discriminator")
    id: str = Field(..., min_length=1, description="Unique question ID")
    stem: str = Field(..., min_length=10, description="Question text")
    expected: float = Field(..., description="Correct numeric answer")
    tolerance: float = Field(..., ge=0, description="Acceptable margin (e.g., 0.01 for money)")
    money2dp: bool = Field(..., description="Enforce 2 decimal places for currency")
    rubric: Rubric = Field(..., description="Marking scheme with method + accuracy marks")
    hints: Optional[List[str]] = Field(None, min_length=3, max_length=5, description="Progressive hint sequence")


class CFU_StructuredResponse(BaseModel):
    """Extended Written Answer CFU - Exact schema per lesson_author_prompt_v2.md lines 196-233."""
    model_config = ConfigDict(extra="allow")

    type: Literal["structured_response"] = Field(..., description="CFU type discriminator")
    id: str = Field(..., min_length=1, description="Unique question ID")
    stem: str = Field(..., min_length=10, description="Multi-part question with (a), (b), (c) structure")
    rubric: Rubric = Field(..., description="Detailed marking scheme with method + accuracy marks")


class CFU_ShortText(BaseModel):
    """Brief Written Response CFU - Exact schema per lesson_author_prompt_v2.md lines 236-272."""
    model_config = ConfigDict(extra="allow")

    type: Literal["short_text"] = Field(..., description="CFU type discriminator")
    id: str = Field(..., min_length=1, description="Unique question ID")
    stem: str = Field(..., min_length=10, description="Question prompting brief written response")
    rubric: Rubric = Field(..., description="Marking scheme with clear criteria")


# ═══════════════════════════════════════════════════════════════
# Lesson Template Card Model (OUTPUT SCHEMA)
# ═══════════════════════════════════════════════════════════════

class LessonTemplateCard(BaseModel):
    """Schema for lesson_template.json cards - Per lesson_author_prompt_v2.md lines 84-96.

    This is the OUTPUT schema, NOT the SOW input schema.
    DO NOT include: card_number, card_type, purpose (those are SOW fields).
    """

    model_config = ConfigDict(extra="allow")  # Allow additional fields for extensibility

    # === REQUIRED FIELDS FROM lesson_author_prompt_v2.md ===
    id: str = Field(..., pattern=r'^card_\d{3}$', description="Card ID (e.g., card_001, card_002)")
    title: str = Field(..., min_length=10, max_length=150, description="Card heading")
    explainer: str = Field(..., min_length=50, description="Detailed learning content (100-500 words)")
    explainer_plain: str = Field(..., min_length=30, description="CEFR A2-B1 accessible version")
    cfu: Dict[str, Any] = Field(..., description="Check For Understanding (type-specific validation below)")
    rubric: Rubric = Field(..., description="Card-level marking scheme")
    misconceptions: List[Misconception] = Field(..., min_length=1, description="Student error anticipation (1-3 items)")

    # === OPTIONAL FIELDS ===
    context_hooks: Optional[List[str]] = Field(None, description="Scottish context implementation notes")

    @field_validator('cfu')
    @classmethod
    def validate_cfu_type_specific(cls, v):
        """Deep validation: CFU must match one of 4 type-specific schemas."""
        if not isinstance(v, dict):
            raise ValueError("cfu must be an object/dict")

        # Check for 'type' field (NOT 'cfu_type')
        if 'type' not in v:
            raise ValueError(
                "cfu object must contain 'type' field. "
                "Valid types: mcq, numeric, structured_response, short_text"
            )

        cfu_type = v['type']

        # Validate against type-specific Pydantic model
        try:
            if cfu_type == 'mcq':
                CFU_MCQ(**v)
            elif cfu_type == 'numeric':
                CFU_Numeric(**v)
            elif cfu_type == 'structured_response':
                CFU_StructuredResponse(**v)
            elif cfu_type == 'short_text':
                CFU_ShortText(**v)
            else:
                raise ValueError(
                    f"Invalid CFU type: '{cfu_type}'. "
                    f"Must be one of: mcq, numeric, structured_response, short_text"
                )
        except ValidationError as e:
            # Format nested errors clearly
            errors = e.errors()
            error_details = []
            for err in errors:
                field_path = ".".join(str(loc) for loc in err['loc'])
                error_details.append(f"cfu.{field_path}: {err['msg']}")

            raise ValueError(
                f"CFU validation failed for type '{cfu_type}':\n  - " + "\n  - ".join(error_details)
            )

        return v


# ═══════════════════════════════════════════════════════════════
# Top-Level Lesson Template Model
# ═══════════════════════════════════════════════════════════════

class LessonTemplate(BaseModel):
    """Complete lesson_template.json schema - Per lesson_author_prompt_v2.md lines 58-79.

    Validates output from lesson_author subagent for Scottish secondary education.
    """

    model_config = ConfigDict(extra="allow")  # Allow additional fields

    # === CORE REQUIRED FIELDS ===
    courseId: str = Field(..., pattern=r'^course_[a-zA-Z0-9]+$', description="Course identifier")
    title: Optional[str] = Field(None, min_length=30, max_length=80, description="Lesson title")
    label: Optional[str] = Field(None, min_length=30, max_length=80, description="Alternative to title")
    outcomeRefs: List[str] = Field(..., min_length=1, description="SQA outcome + assessment standard codes")
    lesson_type: str = Field(..., description="Pedagogical category")
    estMinutes: int = Field(..., ge=5, le=180, description="Estimated duration (5-120 regular, 5-180 mock_exam)")
    sow_order: int = Field(..., ge=1, description="Sequential position in SOW (1-indexed)")

    # === METADATA FIELDS ===
    createdBy: str = Field(default="lesson_author_agent", description="Agent identifier")
    version: int = Field(default=1, ge=1, description="Template version number")
    status: str = Field(default="draft", description="Publication state")

    # === CONTEXT FIELDS ===
    engagement_tags: List[str] = Field(default_factory=list, description="Scottish context tags")
    policy: Dict[str, Any] = Field(default_factory=dict, description="Lesson constraints")

    # === CARDS ARRAY ===
    cards: List[LessonTemplateCard] = Field(..., min_length=1, description="Learning cards")

    @model_validator(mode='after')
    def validate_title_or_label(self):
        """Ensure either 'title' or 'label' is provided."""
        if not self.title and not self.label:
            raise ValueError("Either 'title' or 'label' must be provided")

        # Validate length
        value_to_check = self.title if self.title else self.label
        if value_to_check and (len(value_to_check) < 30 or len(value_to_check) > 80):
            raise ValueError(f"title/label must be 30-80 characters, got {len(value_to_check)}")

        return self

    @field_validator('lesson_type')
    @classmethod
    def validate_lesson_type_enum(cls, v):
        """Validate lesson_type is valid enum."""
        allowed_types = {"teach", "independent_practice", "formative_assessment", "revision", "mock_exam"}

        if v not in allowed_types:
            raise ValueError(
                f"Invalid lesson_type: '{v}'. "
                f"Must be one of: {', '.join(sorted(allowed_types))}"
            )
        return v

    @field_validator('status')
    @classmethod
    def validate_status_enum(cls, v):
        """Validate status is valid enum."""
        if v is not None:
            allowed_statuses = {"draft", "review", "published"}
            if v not in allowed_statuses:
                raise ValueError(
                    f"Invalid status: '{v}'. "
                    f"Must be one of: {', '.join(sorted(allowed_statuses))}"
                )
        return v

    @model_validator(mode='after')
    def validate_est_minutes_by_lesson_type(self):
        """Validate estMinutes based on lesson_type.

        Mock exams can be up to 180 minutes (to accommodate full SQA exam simulations
        with multiple papers, e.g., Paper 1: 50min + Break: 5min + Paper 2: 100min).
        Regular lessons are capped at 120 minutes (double period).
        """
        lesson_type = self.lesson_type
        est_minutes = self.estMinutes

        is_mock_exam = lesson_type in ('mock_exam', 'mock_assessment')
        max_minutes = 180 if is_mock_exam else 120

        if not (5 <= est_minutes <= max_minutes):
            lesson_type_label = "Mock exams" if is_mock_exam else "Regular lessons"
            raise ValueError(
                f"Invalid estMinutes for lesson_type '{lesson_type}': {est_minutes}. "
                f"{lesson_type_label} must be between 5 and {max_minutes} minutes."
            )

        return self

    @field_validator('cards')
    @classmethod
    def validate_card_count_and_sequence(cls, v, info):
        """Validate card count within universal bounds and cards have sequential IDs."""
        count = len(v)

        # Universal card count bounds (pedagogical flexibility with practical limits)
        MIN_CARDS = 1  # At least one card required
        MAX_CARDS = 20  # Practical upper limit for token constraints and session length

        if not (MIN_CARDS <= count <= MAX_CARDS):
            raise ValueError(
                f"Lesson must have {MIN_CARDS}-{MAX_CARDS} cards, got {count}. "
                f"Create as many cards as needed based on pedagogical requirements and estMinutes."
            )

        # Validate sequential card IDs (card_001, card_002, ...)
        expected_id_num = 1
        for i, card in enumerate(v):
            expected_id = f"card_{expected_id_num:03d}"
            if card.id != expected_id:
                raise ValueError(
                    f"Card {i+1} has ID '{card.id}', expected '{expected_id}'. "
                    f"Card IDs must be sequential: card_001, card_002, ..."
                )
            expected_id_num += 1

        return v


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def _format_validation_errors(pydantic_errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Format Pydantic validation errors with token limits.

    Args:
        pydantic_errors: List of error dictionaries from Pydantic ValidationError.errors()

    Returns:
        Dictionary with formatted errors, limited to MAX_ERRORS_DETAILED items
        to prevent token overflow in MCP tool responses.

    Note:
        - Excludes input_value for complex types (dict, list) to reduce token count
        - Only includes truncated input_value for primitive types (str, int, float, bool)
        - Adds truncation notice when total errors exceed MAX_ERRORS_DETAILED
    """
    total_errors = len(pydantic_errors)
    detailed_errors = []

    # Process first MAX_ERRORS_DETAILED errors only
    for error in pydantic_errors[:MAX_ERRORS_DETAILED]:
        # Build field path (e.g., "cards.0.cfu.type")
        field_path = ".".join(str(loc) for loc in error['loc'])

        # Build concise error object (exclude input_value by default)
        error_info = {
            "field": field_path,
            "error": error['msg'],
            "type": error['type']
        }

        # Optional: Include truncated input ONLY for primitive types
        # SKIP for dicts/lists/objects to prevent token overflow
        input_val = error.get('input')
        if input_val is not None and isinstance(input_val, (str, int, float, bool)):
            input_str = str(input_val)
            if len(input_str) > MAX_INPUT_VALUE_LENGTH:
                error_info["input_value"] = input_str[:MAX_INPUT_VALUE_LENGTH] + "..."
            else:
                error_info["input_value"] = input_val

        detailed_errors.append(error_info)

    # Build response with error summary
    response = {
        "is_valid": False,
        "error_type": "SCHEMA_VALIDATION_ERROR",
        "message": f"Found {total_errors} validation error(s)",
        "errors_shown": len(detailed_errors),
        "total_errors": total_errors,
        "errors": detailed_errors,
        "fix_suggestions": [
            "Check that all required fields are present",
            "Verify CFU uses 'type' field (NOT 'cfu_type')",
            "Ensure card IDs are sequential (card_001, card_002, ...)",
            "Validate rubric: total_points must equal sum of criteria points",
            "Check misconception ID format: MISC_[SUBJECT]_[TOPIC]_NNN",
            "Verify CFU type-specific fields (e.g., MCQ needs answerIndex)",
            "Ensure lesson_type enum is valid",
            "Check courseId format (must start with 'course_')",
            "Verify card count is within 1-20 range",
            "Ensure card count aligns with estMinutes (typically 10-15 min per card)"
        ]
    }

    # Add truncation notice if errors were limited
    if total_errors > MAX_ERRORS_DETAILED:
        response["truncation_notice"] = (
            f"Showing first {MAX_ERRORS_DETAILED} of {total_errors} errors. "
            f"Fix these errors and re-validate to see remaining issues."
        )

    return response


# ═══════════════════════════════════════════════════════════════
# Custom Tool Implementation
# ═══════════════════════════════════════════════════════════════

@tool(
    "validate_lesson_template",
    "Validate lesson_template.json against complete Pydantic schema with deep type-specific validation",
    {"file_path": str}
)
async def validate_lesson_template(args):
    """Validate lesson template JSON file using comprehensive Pydantic models.

    Args:
        args: Dictionary with 'file_path' key pointing to JSON file

    Returns:
        Tool response with validation results:
        - Success: is_valid=True with template details
        - Failure: is_valid=False with detailed error list

    Error Types:
        - JSON_SYNTAX_ERROR: Invalid JSON format (missing commas, quotes, etc.)
        - SCHEMA_VALIDATION_ERROR: Valid JSON but violates Pydantic schema
        - FILE_NOT_FOUND: File does not exist at given path
    """
    file_path = args["file_path"]

    try:
        # Read and parse JSON file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Validate with Pydantic
        template = LessonTemplate(**data)

        # Success response
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "is_valid": True,
                    "message": "✅ Validation passed",
                    "details": {
                        "title": template.title if template.title else template.label,
                        "card_count": len(template.cards),
                        "lesson_type": template.lesson_type,
                        "courseId": template.courseId,
                        "sow_order": template.sow_order
                    }
                }, indent=2)
            }]
        }

    except json.JSONDecodeError as e:
        # JSON parsing error - syntax issue
        error_msg = {
            "is_valid": False,
            "error_type": "JSON_SYNTAX_ERROR",
            "message": f"Invalid JSON syntax at line {e.lineno}, column {e.colno}",
            "details": {
                "error": str(e.msg),
                "position": f"line {e.lineno}, column {e.colno}",
                "char_position": e.pos
            },
            "fix_suggestions": [
                "Check for missing commas between fields",
                "Remove any inline comments (JSON doesn't support comments)",
                "Ensure all strings are properly quoted",
                "Check for trailing commas (not allowed in JSON)",
                "Validate JSON structure with a JSON linter"
            ]
        }
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }

    except ValidationError as e:
        # Pydantic validation errors - schema violation
        # Use helper function to format errors with token limits
        error_msg = _format_validation_errors(e.errors())

        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }

    except FileNotFoundError:
        # File doesn't exist
        error_msg = {
            "is_valid": False,
            "error_type": "FILE_NOT_FOUND",
            "message": f"File not found: {file_path}",
            "details": {
                "file_path": file_path,
                "absolute_path": str(Path(file_path).absolute())
            },
            "fix_suggestions": [
                "Check that the file path is correct",
                "Ensure the file has been written before validation",
                "Verify you're in the correct working directory"
            ]
        }
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }

    except Exception as e:
        # Unexpected error
        error_msg = {
            "is_valid": False,
            "error_type": "UNEXPECTED_ERROR",
            "message": f"Unexpected error during validation: {type(e).__name__}",
            "details": str(e)
        }
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(error_msg, indent=2)
            }],
            "isError": True
        }


# ═══════════════════════════════════════════════════════════════
# Create MCP Server
# ═══════════════════════════════════════════════════════════════

validation_server = create_sdk_mcp_server(
    name="lesson-validator",
    version="2.0.0",
    tools=[validate_lesson_template]
)

# Tool naming convention: mcp__lesson-validator__validate_lesson_template
