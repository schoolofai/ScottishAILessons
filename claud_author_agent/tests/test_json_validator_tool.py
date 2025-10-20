"""Comprehensive unit tests for JSON Validation Tool.

Tests all validation rules for lesson_template.json schema.
"""

import json
import pytest
from pathlib import Path
from pydantic import ValidationError

# Import models from validation tool
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tools.json_validator_tool import (
    LessonTemplate,
    LessonTemplateCard,
    Rubric,
    RubricCriterion,
    Misconception,
    CFU_MCQ,
    CFU_Numeric,
    CFU_StructuredResponse,
    CFU_ShortText
)


# ═══════════════════════════════════════════════════════════════
# Test Fixtures
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def valid_rubric():
    """Valid rubric matching schema."""
    return {
        "total_points": 3,
        "criteria": [
            {"description": "Correctly identifies fraction notation", "points": 1},
            {"description": "Shows working clearly", "points": 1},
            {"description": "States answer with units", "points": 1}
        ]
    }


@pytest.fixture
def valid_misconception():
    """Valid misconception matching schema."""
    return {
        "id": "MISC_MATH_FRAC_001",
        "misconception": "Confusing numerator and denominator",
        "clarification": "Remember: bottom number shows how many equal parts, top number shows how many you have"
    }


@pytest.fixture
def valid_cfu_mcq(valid_rubric):
    """Valid MCQ CFU."""
    return {
        "type": "mcq",
        "id": "q001",
        "stem": "Which of these represents one-quarter?",
        "options": ["1/4", "1/2", "1/3", "2/4"],
        "answerIndex": 0,
        "rubric": valid_rubric
    }


@pytest.fixture
def valid_cfu_numeric(valid_rubric):
    """Valid numeric CFU."""
    return {
        "type": "numeric",
        "id": "q002",
        "stem": "A box costs £12. It's reduced by 1/3. How much is the discount?",
        "expected": 4.0,
        "tolerance": 0.01,
        "money2dp": True,
        "rubric": valid_rubric,
        "hints": [
            "Divide £12 by 3 to find 1/3",
            "What is £12 ÷ 3?",
            "Check: 1/3 is about 33%, so discount should be around £4"
        ]
    }


@pytest.fixture
def valid_card(valid_cfu_mcq, valid_rubric, valid_misconception):
    """Valid lesson template card."""
    return {
        "id": "card_001",
        "title": "Starter: Fraction Recall",
        "explainer": "Let's begin by recalling what we know about fractions. A fraction represents part of a whole and is written with a numerator (top number) and denominator (bottom number).",
        "explainer_plain": "We will review fractions. What do you remember about fractions? They have a top number and bottom number.",
        "cfu": valid_cfu_mcq,
        "rubric": valid_rubric,
        "misconceptions": [valid_misconception],
        "context_hooks": ["Scottish currency £", "Tesco pricing"]
    }


@pytest.fixture
def minimal_valid_template(valid_card):
    """Minimal valid lesson template (teach type, 3 cards)."""
    card1 = valid_card.copy()
    card2 = valid_card.copy()
    card2["id"] = "card_002"
    card2["title"] = "Modelling: Finding Fractions of Amounts"
    card3 = valid_card.copy()
    card3["id"] = "card_003"
    card3["title"] = "Practice: Apply Skills"

    return {
        "courseId": "course_test123",
        "title": "Introduction to Fractions for National 3",
        "outcomeRefs": ["O1", "AS1.2"],
        "lesson_type": "teach",
        "estMinutes": 50,
        "sow_order": 1,
        "createdBy": "lesson_author_agent",
        "version": 1,
        "status": "draft",
        "engagement_tags": ["shopping", "finance"],
        "policy": {"calculator_allowed": False},
        "cards": [card1, card2, card3]
    }


# ═══════════════════════════════════════════════════════════════
# Rubric Validation Tests
# ═══════════════════════════════════════════════════════════════

def test_rubric_valid(valid_rubric):
    """Test valid rubric passes validation."""
    rubric = Rubric(**valid_rubric)
    assert rubric.total_points == 3
    assert len(rubric.criteria) == 3


def test_rubric_criteria_sum_mismatch():
    """Test rubric fails when criteria sum doesn't match total_points."""
    invalid_rubric = {
        "total_points": 5,  # Says 5
        "criteria": [
            {"description": "Test criterion", "points": 2}  # Only sums to 2
        ]
    }
    with pytest.raises(ValidationError) as exc_info:
        Rubric(**invalid_rubric)
    assert "does not equal total_points" in str(exc_info.value)


def test_rubric_missing_criterion_fields():
    """Test rubric fails when criterion missing required fields."""
    invalid_rubric = {
        "total_points": 1,
        "criteria": [
            {"description": "Missing points field"}  # No 'points'
        ]
    }
    with pytest.raises(ValidationError) as exc_info:
        Rubric(**invalid_rubric)
    assert "points" in str(exc_info.value).lower()


def test_rubric_empty_criteria():
    """Test rubric fails with empty criteria array."""
    invalid_rubric = {
        "total_points": 1,
        "criteria": []
    }
    with pytest.raises(ValidationError) as exc_info:
        Rubric(**invalid_rubric)
    assert "at least 1" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════
# Misconception Validation Tests
# ═══════════════════════════════════════════════════════════════

def test_misconception_valid(valid_misconception):
    """Test valid misconception passes validation."""
    misc = Misconception(**valid_misconception)
    assert misc.id == "MISC_MATH_FRAC_001"


def test_misconception_invalid_id_format():
    """Test misconception fails with wrong ID format."""
    invalid_misc = {
        "id": "INVALID_FORMAT",  # Wrong format
        "misconception": "Some error description here",
        "clarification": "Some explanation here that is long enough to pass validation"
    }
    with pytest.raises(ValidationError) as exc_info:
        Misconception(**invalid_misc)
    assert "pattern" in str(exc_info.value).lower() or "string does not match" in str(exc_info.value).lower()


def test_misconception_too_short():
    """Test misconception fails with too-short fields."""
    invalid_misc = {
        "id": "MISC_MATH_FRAC_001",
        "misconception": "Too short",  # Less than 10 chars
        "clarification": "This is a valid length clarification for the misconception"
    }
    with pytest.raises(ValidationError) as exc_info:
        Misconception(**invalid_misc)
    assert "at least 10" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════
# CFU MCQ Validation Tests
# ═══════════════════════════════════════════════════════════════

def test_cfu_mcq_valid(valid_cfu_mcq):
    """Test valid MCQ CFU passes validation."""
    cfu = CFU_MCQ(**valid_cfu_mcq)
    assert cfu.type == "mcq"
    assert cfu.answerIndex == 0


def test_cfu_mcq_missing_answer_index(valid_cfu_mcq):
    """Test MCQ fails without answerIndex."""
    invalid_cfu = valid_cfu_mcq.copy()
    del invalid_cfu["answerIndex"]

    with pytest.raises(ValidationError) as exc_info:
        CFU_MCQ(**invalid_cfu)
    # Pydantic lowercases field names in error messages
    assert "answerindex" in str(exc_info.value).lower()


def test_cfu_mcq_answer_index_out_of_range(valid_cfu_mcq):
    """Test MCQ fails when answerIndex >= len(options)."""
    invalid_cfu = valid_cfu_mcq.copy()
    invalid_cfu["answerIndex"] = 10  # Out of range for 4 options

    with pytest.raises(ValidationError) as exc_info:
        CFU_MCQ(**invalid_cfu)
    assert "out of range" in str(exc_info.value)


def test_cfu_mcq_too_few_options(valid_cfu_mcq):
    """Test MCQ fails with less than 3 options."""
    invalid_cfu = valid_cfu_mcq.copy()
    invalid_cfu["options"] = ["1/4", "1/2"]  # Only 2 options

    with pytest.raises(ValidationError) as exc_info:
        CFU_MCQ(**invalid_cfu)
    assert "at least 3" in str(exc_info.value)


def test_cfu_mcq_missing_rubric(valid_cfu_mcq):
    """Test MCQ fails without rubric."""
    invalid_cfu = valid_cfu_mcq.copy()
    del invalid_cfu["rubric"]

    with pytest.raises(ValidationError) as exc_info:
        CFU_MCQ(**invalid_cfu)
    assert "rubric" in str(exc_info.value).lower()


# ═══════════════════════════════════════════════════════════════
# CFU Numeric Validation Tests
# ═══════════════════════════════════════════════════════════════

def test_cfu_numeric_valid(valid_cfu_numeric):
    """Test valid numeric CFU passes validation."""
    cfu = CFU_Numeric(**valid_cfu_numeric)
    assert cfu.type == "numeric"
    assert cfu.expected == 4.0


def test_cfu_numeric_missing_expected(valid_cfu_numeric):
    """Test numeric fails without expected value."""
    invalid_cfu = valid_cfu_numeric.copy()
    del invalid_cfu["expected"]

    with pytest.raises(ValidationError) as exc_info:
        CFU_Numeric(**invalid_cfu)
    assert "expected" in str(exc_info.value).lower()


def test_cfu_numeric_negative_tolerance(valid_cfu_numeric):
    """Test numeric fails with negative tolerance."""
    invalid_cfu = valid_cfu_numeric.copy()
    invalid_cfu["tolerance"] = -0.5  # Negative

    with pytest.raises(ValidationError) as exc_info:
        CFU_Numeric(**invalid_cfu)
    assert "greater than or equal to 0" in str(exc_info.value)


def test_cfu_numeric_hints_wrong_count(valid_cfu_numeric):
    """Test numeric fails with wrong hint count."""
    invalid_cfu = valid_cfu_numeric.copy()
    invalid_cfu["hints"] = ["Only one hint"]  # Less than 3

    with pytest.raises(ValidationError) as exc_info:
        CFU_Numeric(**invalid_cfu)
    assert "at least 3" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════
# Card Validation Tests
# ═══════════════════════════════════════════════════════════════

def test_card_valid(valid_card):
    """Test valid card passes validation."""
    card = LessonTemplateCard(**valid_card)
    assert card.id == "card_001"
    assert card.cfu["type"] == "mcq"


def test_card_invalid_id_format(valid_card):
    """Test card fails with wrong ID format."""
    invalid_card = valid_card.copy()
    invalid_card["id"] = "invalid_id"  # Wrong format

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplateCard(**invalid_card)
    assert "pattern" in str(exc_info.value).lower() or "string does not match" in str(exc_info.value).lower()


def test_card_missing_explainer(valid_card):
    """Test card fails without explainer."""
    invalid_card = valid_card.copy()
    del invalid_card["explainer"]

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplateCard(**invalid_card)
    assert "explainer" in str(exc_info.value).lower()


def test_card_explainer_too_short(valid_card):
    """Test card fails with too-short explainer."""
    invalid_card = valid_card.copy()
    invalid_card["explainer"] = "Too short"  # Less than 50 chars

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplateCard(**invalid_card)
    assert "at least 50" in str(exc_info.value)


def test_card_cfu_wrong_field_name(valid_card, valid_rubric):
    """Test card fails when CFU uses 'cfu_type' instead of 'type'."""
    invalid_card = valid_card.copy()
    invalid_card["cfu"] = {
        "cfu_type": "mcq",  # WRONG field name
        "id": "q001",
        "stem": "Test question?",
        "options": ["A", "B", "C"],
        "answerIndex": 0,
        "rubric": valid_rubric
    }

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplateCard(**invalid_card)
    assert "must contain 'type' field" in str(exc_info.value)


def test_card_empty_misconceptions(valid_card):
    """Test card fails with empty misconceptions array."""
    invalid_card = valid_card.copy()
    invalid_card["misconceptions"] = []

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplateCard(**invalid_card)
    assert "at least 1" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════
# Lesson Template Top-Level Tests
# ═══════════════════════════════════════════════════════════════

def test_template_valid(minimal_valid_template):
    """Test valid template passes validation."""
    template = LessonTemplate(**minimal_valid_template)
    assert template.courseId == "course_test123"
    assert template.lesson_type == "teach"
    assert len(template.cards) == 3


def test_template_invalid_course_id_format(minimal_valid_template):
    """Test template fails with wrong courseId format."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["courseId"] = "invalid_format"  # Missing 'course_' prefix

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "pattern" in str(exc_info.value).lower() or "string does not match" in str(exc_info.value).lower()


def test_template_missing_title_and_label(minimal_valid_template):
    """Test template fails without title or label."""
    invalid_template = minimal_valid_template.copy()
    del invalid_template["title"]  # No label either

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "'title' or 'label' must be provided" in str(exc_info.value)


def test_template_invalid_lesson_type(minimal_valid_template):
    """Test template fails with invalid lesson_type."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["lesson_type"] = "introduction"  # Not in enum

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "Invalid lesson_type" in str(exc_info.value)


def test_template_wrong_card_count_for_type(minimal_valid_template):
    """Test template fails when card count doesn't match lesson_type."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["lesson_type"] = "teach"  # Requires 3-4 cards
    invalid_template["cards"] = invalid_template["cards"][:2]  # Only 2 cards

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "requires 3-4 cards, got 2" in str(exc_info.value)


def test_template_non_sequential_card_ids(minimal_valid_template):
    """Test template fails with non-sequential card IDs."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["cards"][1]["id"] = "card_005"  # Gap in sequence

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "expected 'card_002'" in str(exc_info.value)


def test_template_empty_outcome_refs(minimal_valid_template):
    """Test template fails with empty outcomeRefs."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["outcomeRefs"] = []

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "at least 1" in str(exc_info.value)


def test_template_est_minutes_out_of_range(minimal_valid_template):
    """Test template fails with estMinutes outside 30-120 range."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["estMinutes"] = 150  # Too high

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "less than or equal to 120" in str(exc_info.value)


def test_template_invalid_status(minimal_valid_template):
    """Test template fails with invalid status."""
    invalid_template = minimal_valid_template.copy()
    invalid_template["status"] = "pending"  # Not in enum

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**invalid_template)
    assert "Invalid status" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════
# Integration Tests (Full File Validation)
# ═══════════════════════════════════════════════════════════════

def test_validate_actual_template_file_success(tmp_path, minimal_valid_template):
    """Test validation succeeds for valid JSON file."""
    # Write valid template to file
    test_file = tmp_path / "valid_template.json"
    test_file.write_text(json.dumps(minimal_valid_template, indent=2))

    # Validate
    with open(test_file, 'r') as f:
        data = json.load(f)

    template = LessonTemplate(**data)
    assert template.courseId == "course_test123"


def test_validate_actual_template_file_failure(tmp_path, minimal_valid_template):
    """Test validation fails for invalid JSON file with clear error."""
    # Create invalid template
    invalid_template = minimal_valid_template.copy()
    invalid_template["courseId"] = "wrong_format"  # Invalid

    # Write to file
    test_file = tmp_path / "invalid_template.json"
    test_file.write_text(json.dumps(invalid_template, indent=2))

    # Validate
    with open(test_file, 'r') as f:
        data = json.load(f)

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplate(**data)

    assert "courseId" in str(exc_info.value).lower() or "pattern" in str(exc_info.value).lower()


# ═══════════════════════════════════════════════════════════════
# Edge Cases and Additional Tests
# ═══════════════════════════════════════════════════════════════

def test_template_with_label_instead_of_title(minimal_valid_template):
    """Test template valid when using 'label' instead of 'title'."""
    template_data = minimal_valid_template.copy()
    del template_data["title"]
    template_data["label"] = "Alternative Title Using Label Field"

    template = LessonTemplate(**template_data)
    assert template.label == "Alternative Title Using Label Field"


def test_cfu_structured_response_valid(valid_rubric):
    """Test valid structured_response CFU."""
    cfu_data = {
        "type": "structured_response",
        "id": "q003",
        "stem": "A train ticket costs £24. Sarah gets 1/3 off.\n(a) Calculate the discount\n(b) Calculate final price",
        "rubric": valid_rubric
    }

    cfu = CFU_StructuredResponse(**cfu_data)
    assert cfu.type == "structured_response"


def test_cfu_short_text_valid(valid_rubric):
    """Test valid short_text CFU."""
    cfu_data = {
        "type": "short_text",
        "id": "q004",
        "stem": "Explain in your own words what a fraction represents.",
        "rubric": valid_rubric
    }

    cfu = CFU_ShortText(**cfu_data)
    assert cfu.type == "short_text"


def test_card_cfu_nested_validation_error(valid_card):
    """Test card shows clear nested error when CFU field is missing."""
    invalid_card = valid_card.copy()
    # MCQ missing answerIndex
    invalid_card["cfu"] = {
        "type": "mcq",
        "id": "q001",
        "stem": "Test question?",
        "options": ["A", "B", "C"]
        # Missing: answerIndex, rubric
    }

    with pytest.raises(ValidationError) as exc_info:
        LessonTemplateCard(**invalid_card)

    error_msg = str(exc_info.value)
    assert "cfu" in error_msg.lower()
    # Should mention the missing field
    assert "answerIndex" in error_msg or "rubric" in error_msg


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
