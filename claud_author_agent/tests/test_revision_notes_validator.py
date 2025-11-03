"""Unit tests for Revision Notes Validator Tool.

Tests Pydantic schema validation, cognitive science checks,
and quality metrics calculation.
"""

import pytest
import json
from src.tools.revision_notes_validator_tool import (
    RevisionNotes,
    KeyConcept,
    WorkedExample,
    CommonMistake,
    QuickCheckQuestion,
    MemoryAid,
    RevisionNotesMetadata,
    _calculate_quality_metrics
)
from pydantic import ValidationError


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def create_valid_revision_notes() -> dict:
    """Create a valid revision notes structure for testing."""
    return {
        "summary": "This lesson covers fraction simplification by finding the HCF. Essential for National 3 algebra and appears in 60% of SQA exam papers. Students will practice both simple and complex fraction problems.",
        "key_concepts": [
            {
                "title": "Simplifying Fractions",
                "explanation": "Divide numerator and denominator by their highest common factor (HCF) to simplify. For example, 8/12 has HCF of 4, so divide both by 4 to get 2/3. This is essential for algebra and appears frequently in SQA exams.",
                "visual_representation": "$$\\frac{8}{12} \\xrightarrow{\\div 4} \\frac{2}{3}$$",
                "real_world_connection": "Splitting a £12 restaurant bill among 8 friends: £12 ÷ 8 = £1.50 each"
            },
            {
                "title": "Finding HCF",
                "explanation": "List factors of both numbers and find the highest common one. For 8 and 12: factors of 8 are 1,2,4,8 and factors of 12 are 1,2,3,4,6,12. The highest common factor is 4.",
                "visual_representation": None,
                "real_world_connection": "Used when dividing items evenly, like splitting 12 sweets among 8 people"
            },
            {
                "title": "Equivalent Fractions",
                "explanation": "Fractions that represent the same value but look different. For example, 1/2 = 2/4 = 3/6. Multiply or divide both numerator and denominator by the same number to create equivalent fractions.",
                "visual_representation": "$$\\frac{1}{2} = \\frac{1 \\times 2}{2 \\times 2} = \\frac{2}{4}$$",
                "real_world_connection": "Half a pizza is the same as 2 quarters or 4 eighths"
            }
        ],
        "worked_examples": [
            {
                "problem": "Simplify the fraction 18/24",
                "solution_steps": [
                    "Step 1: Find factors of 18: 1, 2, 3, 6, 9, 18",
                    "Step 2: Find factors of 24: 1, 2, 3, 4, 6, 8, 12, 24",
                    "Step 3: Identify highest common factor: HCF = 6",
                    "Step 4: Divide both numerator and denominator by 6: 18÷6 = 3, 24÷6 = 4",
                    "Step 5: Simplified fraction is 3/4"
                ],
                "answer": "3/4",
                "key_insight": "Always find the HCF first to simplify in one step rather than multiple small steps"
            }
        ],
        "common_mistakes": [
            {
                "mistake": "Adding fractions with different denominators: 1/3 + 1/4 = 2/7",
                "why_wrong": "Cannot add numerators when denominators differ. Like adding 1 apple + 1 orange does not equal 2 apples. Need common denominator first.",
                "correction": "Find common denominator (12), convert both fractions: 1/3 = 4/12, 1/4 = 3/12, then add: 4/12 + 3/12 = 7/12",
                "tip": "Remember: Denominators Down Below must MATCH before you GO"
            },
            {
                "mistake": "Simplifying by subtracting: 8/12 becomes 6/10 by subtracting 2",
                "why_wrong": "Must divide, not subtract. Simplifying means keeping the same value in simpler form.",
                "correction": "Divide both parts by the HCF: 8÷4 = 2 and 12÷4 = 3, giving 2/3",
                "tip": "Simplifying uses division, never subtraction"
            },
            {
                "mistake": "Finding HCF incorrectly by just picking any common factor",
                "why_wrong": "Need the HIGHEST common factor for maximum simplification. Using a smaller factor means fraction is not fully simplified.",
                "correction": "List ALL factors of both numbers, then choose the largest one that appears in both lists",
                "tip": "Check your final answer cannot be simplified further"
            }
        ],
        "quick_quiz": [
            {
                "question": "Simplify 6/9",
                "answer": "2/3",
                "explanation": "HCF of 6 and 9 is 3, so divide both by 3"
            },
            {
                "question": "What is the HCF of 12 and 18?",
                "answer": "6",
                "explanation": "Factors of 12: 1,2,3,4,6,12. Factors of 18: 1,2,3,6,9,18. Highest common is 6"
            },
            {
                "question": "Is 4/8 fully simplified?",
                "answer": "No, it simplifies to 1/2",
                "explanation": "Both 4 and 8 can be divided by 4 to get 1/2"
            }
        ],
        "memory_aids": [
            {
                "type": "mnemonic",
                "content": "HCF: Highest Common Factor - think 'Highest Common Friend' - the biggest number that is friends with both numbers",
                "application": "Use when finding what to divide by when simplifying fractions"
            },
            {
                "type": "pattern",
                "content": "If both numbers are even, 2 is definitely a common factor. Divide by 2 first, then check if you can simplify more",
                "application": "Quick check for fractions with even numerator and denominator"
            }
        ],
        "exam_tips": [
            "Always show your working when simplifying fractions to get method marks even if final answer is wrong",
            "Check your simplified fraction cannot be divided further - test by seeing if numerator and denominator share any factors",
            "In calculator section, use your calculator to check: divide numerator by denominator and verify your simplified fraction gives same decimal"
        ],
        "metadata": {
            "difficulty_level": "National 3",
            "estimated_study_time": 20,
            "sqa_outcome_refs": ["MTH 3-07a", "MTH 3-07b"]
        }
    }


# ═══════════════════════════════════════════════════════════════
# Tests for Component Models
# ═══════════════════════════════════════════════════════════════

def test_key_concept_valid():
    """Test valid key concept passes validation."""
    concept = KeyConcept(
        title="Test Concept",
        explanation="This is a valid explanation with exactly thirty-five words to meet the minimum word count requirement for key concept explanations in revision notes schema validation testing process.",
        visual_representation="$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$",
        real_world_connection="Used in Edinburgh tram fare calculations"
    )
    assert concept.title == "Test Concept"
    assert len(concept.explanation.split()) >= 30


def test_key_concept_explanation_too_short():
    """Test validation fails when explanation < 30 words."""
    with pytest.raises(ValidationError) as excinfo:
        KeyConcept(
            title="Test",
            explanation="Too short"  # Only 2 words
        )
    assert "30 words" in str(excinfo.value).lower()


def test_key_concept_latex_unbalanced():
    """Test validation fails with unbalanced LaTeX delimiters."""
    with pytest.raises(ValidationError) as excinfo:
        KeyConcept(
            title="Test",
            explanation="A" * 50,  # 50 words
            visual_representation="$$\\frac{1}{2}$"  # Missing closing $$
        )
    assert "unbalanced" in str(excinfo.value).lower()


def test_worked_example_valid():
    """Test valid worked example passes validation."""
    example = WorkedExample(
        problem="Solve for x: 2x + 3 = 7",
        solution_steps=[
            "Step 1: Subtract 3 from both sides to isolate term with x",
            "Step 2: Divide both sides by 2 to get x alone"
        ],
        answer="x = 2",
        key_insight="Always perform same operation on both sides to maintain equality"
    )
    assert len(example.solution_steps) >= 2


def test_worked_example_steps_too_brief():
    """Test validation fails when solution steps < 5 words."""
    with pytest.raises(ValidationError) as excinfo:
        WorkedExample(
            problem="Solve x",
            solution_steps=[
                "Add two",  # Only 2 words - too brief
                "Then divide"  # Also too brief
            ],
            answer="x = 2",
            key_insight="Always show full working"
        )
    assert "too brief" in str(excinfo.value).lower()


# ═══════════════════════════════════════════════════════════════
# Tests for Top-Level Model
# ═══════════════════════════════════════════════════════════════

def test_valid_revision_notes():
    """Test valid revision notes pass validation."""
    valid_data = create_valid_revision_notes()
    notes = RevisionNotes(**valid_data)

    assert len(notes.key_concepts) == 3
    assert len(notes.worked_examples) == 1
    assert len(notes.common_mistakes) == 3
    assert len(notes.quick_quiz) == 3
    assert len(notes.memory_aids) == 2
    assert len(notes.exam_tips) == 3


def test_revision_notes_key_concepts_count_too_low():
    """Test validation fails when key concepts < 3."""
    invalid_data = create_valid_revision_notes()
    invalid_data["key_concepts"] = invalid_data["key_concepts"][:2]  # Only 2

    with pytest.raises(ValidationError) as excinfo:
        RevisionNotes(**invalid_data)

    assert "at least 3" in str(excinfo.value).lower()


def test_revision_notes_key_concepts_count_too_high():
    """Test validation fails when key concepts > 5."""
    invalid_data = create_valid_revision_notes()

    # Add 3 more concepts to exceed maximum of 5
    extra_concept = invalid_data["key_concepts"][0].copy()
    for i in range(3):
        invalid_data["key_concepts"].append(extra_concept)

    assert len(invalid_data["key_concepts"]) == 6  # Should be 6 now

    with pytest.raises(ValidationError) as excinfo:
        RevisionNotes(**invalid_data)

    assert "at most 5" in str(excinfo.value).lower()


def test_revision_notes_invalid_difficulty_level():
    """Test validation fails with invalid SQA difficulty level."""
    invalid_data = create_valid_revision_notes()
    invalid_data["metadata"]["difficulty_level"] = "Grade 9"  # Invalid - should be "National X"

    with pytest.raises(ValidationError) as excinfo:
        RevisionNotes(**invalid_data)

    assert "National" in str(excinfo.value)


def test_revision_notes_exam_tips_too_brief():
    """Test validation fails when exam tips < 5 words."""
    invalid_data = create_valid_revision_notes()
    invalid_data["exam_tips"] = [
        "Show working",  # Only 2 words - too brief
        "Check answer",  # Only 2 words
        "Use calculator"  # Only 2 words
    ]

    with pytest.raises(ValidationError) as excinfo:
        RevisionNotes(**invalid_data)

    assert "too brief" in str(excinfo.value).lower()


# ═══════════════════════════════════════════════════════════════
# Tests for Quality Metrics
# ═══════════════════════════════════════════════════════════════

def test_quality_metrics_calculation():
    """Test quality metrics calculation."""
    valid_data = create_valid_revision_notes()
    notes = RevisionNotes(**valid_data)

    metrics = _calculate_quality_metrics(notes)

    assert "total_word_count" in metrics
    assert "dual_coding_coverage" in metrics
    assert "cognitive_science_alignment" in metrics

    assert metrics["total_word_count"] > 0
    assert metrics["key_concepts_count"] == 3
    assert metrics["worked_examples_count"] == 1

    # Check cognitive science alignment
    alignment = metrics["cognitive_science_alignment"]
    assert "chunking" in alignment
    assert "dual_coding" in alignment
    assert "retrieval_practice" in alignment


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
