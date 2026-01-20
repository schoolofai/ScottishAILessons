"""Unit tests for critic schema models.

Tests for the Pydantic models used in the iterative SOW authoring system's
quality validation loops:
- DimensionScore: Reusable score object for each dimension
- OutlineCriticResult: Evaluates lesson outline against 5 dimensions
- LessonCriticResult: Evaluates individual lessons against 5 dimensions
- Utility functions: calculate_overall_score, should_pass

These tests verify schema validation without requiring LLM calls.
"""

import json
import pytest
from pathlib import Path
import sys

# Add src to path for imports
CLAUD_AUTHOR_AGENT_ROOT = Path(__file__).parent.parent.parent
if str(CLAUD_AUTHOR_AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(CLAUD_AUTHOR_AGENT_ROOT))

from pydantic import ValidationError
from src.tools.critic_schema_models import (
    DimensionScore,
    OutlineCriticDimensions,
    OutlineCriticResult,
    LessonCriticDimensions,
    LessonCriticResult,
    calculate_overall_score,
    should_pass,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Test Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

def create_dimension_score(score: float = 0.85, issues: list = None, notes: str = "") -> dict:
    """Create a valid DimensionScore dictionary."""
    return {
        "score": score,
        "issues": issues or [],
        "notes": notes
    }


def create_outline_critic_dimensions() -> dict:
    """Create valid OutlineCriticDimensions dictionary."""
    return {
        "coverage": create_dimension_score(0.9, [], "All standards mapped"),
        "sequencing": create_dimension_score(0.85, ["Minor ordering issue"], "Prerequisites mostly respected"),
        "balance": create_dimension_score(0.8, [], "Good distribution"),
        "progression": create_dimension_score(0.9, [], "Appropriate complexity increase"),
        "chunking": create_dimension_score(0.85, [], "2-4 standards per lesson")
    }


def create_lesson_critic_dimensions() -> dict:
    """Create valid LessonCriticDimensions dictionary."""
    return {
        "coverage": create_dimension_score(0.9, [], "All assigned standards addressed"),
        "sequencing": create_dimension_score(0.85, [], "Card flow follows I-We-You"),
        "policy": create_dimension_score(0.9, [], "Engagement tags reflected, CFU specific"),
        "accessibility": create_dimension_score(0.8, ["Missing explainer_plain on card 3"], "Mostly accessible"),
        "authenticity": create_dimension_score(0.95, [], "Strong Scottish context")
    }


def create_valid_outline_critic_result() -> dict:
    """Create a valid OutlineCriticResult dictionary (PASS verdict)."""
    return {
        "verdict": "PASS",
        "overall_score": 0.86,
        "dimensions": create_outline_critic_dimensions(),
        "revision_guidance": [],
        "summary": "Outline meets quality threshold with strong coverage and sequencing."
    }


def create_revision_required_outline_result() -> dict:
    """Create a valid OutlineCriticResult dictionary (REVISION_REQUIRED verdict)."""
    return {
        "verdict": "REVISION_REQUIRED",
        "overall_score": 0.65,
        "dimensions": {
            "coverage": create_dimension_score(0.6, ["Standard X not mapped"], "Coverage gaps"),
            "sequencing": create_dimension_score(0.7, ["Prerequisite violation"], "Sequencing issues"),
            "balance": create_dimension_score(0.65, ["Block A over-represented"], "Balance issues"),
            "progression": create_dimension_score(0.65, [], "Progression could improve"),
            "chunking": create_dimension_score(0.65, ["Lesson 3 has 6 standards"], "Chunking issues")
        },
        "revision_guidance": [
            "Map standard X to a teach lesson",
            "Reorder lessons 3 and 4 to respect prerequisites",
            "Reduce standards in lesson 3 from 6 to 3"
        ],
        "summary": "Outline needs revision due to coverage gaps and sequencing issues."
    }


def create_valid_lesson_critic_result() -> dict:
    """Create a valid LessonCriticResult dictionary (PASS verdict)."""
    return {
        "verdict": "PASS",
        "overall_score": 0.88,
        "lesson_order": 3,
        "dimensions": create_lesson_critic_dimensions(),
        "revision_guidance": [],
        "summary": "Lesson 3 meets quality threshold with strong authenticity and coverage."
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DimensionScore Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestDimensionScore:
    """Tests for DimensionScore model."""

    def test_valid_dimension_score(self):
        """Test creating a valid DimensionScore."""
        score = DimensionScore(
            score=0.85,
            issues=["Minor issue"],
            notes="Good performance"
        )
        assert score.score == 0.85
        assert score.issues == ["Minor issue"]
        assert score.notes == "Good performance"

    def test_dimension_score_defaults(self):
        """Test DimensionScore with default values."""
        score = DimensionScore(score=0.75)
        assert score.score == 0.75
        assert score.issues == []
        assert score.notes == ""

    def test_dimension_score_min_boundary(self):
        """Test score at minimum boundary (0.0)."""
        score = DimensionScore(score=0.0)
        assert score.score == 0.0

    def test_dimension_score_max_boundary(self):
        """Test score at maximum boundary (1.0)."""
        score = DimensionScore(score=1.0)
        assert score.score == 1.0

    def test_dimension_score_below_min(self):
        """Test score below minimum raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            DimensionScore(score=-0.1)
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_dimension_score_above_max(self):
        """Test score above maximum raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            DimensionScore(score=1.1)
        assert "less than or equal to 1" in str(exc_info.value).lower()

    def test_dimension_score_multiple_issues(self):
        """Test DimensionScore with multiple issues."""
        score = DimensionScore(
            score=0.5,
            issues=["Issue 1", "Issue 2", "Issue 3"],
            notes="Several problems identified"
        )
        assert len(score.issues) == 3

    def test_dimension_score_json_serialization(self):
        """Test DimensionScore JSON serialization."""
        score = DimensionScore(score=0.85, issues=["Test"], notes="Note")
        json_str = score.model_dump_json()
        data = json.loads(json_str)
        assert data["score"] == 0.85
        assert data["issues"] == ["Test"]
        assert data["notes"] == "Note"


# ═══════════════════════════════════════════════════════════════════════════════
# OutlineCriticDimensions Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineCriticDimensions:
    """Tests for OutlineCriticDimensions model."""

    def test_valid_outline_dimensions(self):
        """Test creating valid OutlineCriticDimensions."""
        dims = OutlineCriticDimensions(**create_outline_critic_dimensions())
        assert dims.coverage.score == 0.9
        assert dims.sequencing.score == 0.85
        assert dims.balance.score == 0.8
        assert dims.progression.score == 0.9
        assert dims.chunking.score == 0.85

    def test_outline_dimensions_missing_coverage(self):
        """Test missing coverage dimension raises ValidationError."""
        data = create_outline_critic_dimensions()
        del data["coverage"]
        with pytest.raises(ValidationError):
            OutlineCriticDimensions(**data)

    def test_outline_dimensions_missing_sequencing(self):
        """Test missing sequencing dimension raises ValidationError."""
        data = create_outline_critic_dimensions()
        del data["sequencing"]
        with pytest.raises(ValidationError):
            OutlineCriticDimensions(**data)

    def test_outline_dimensions_missing_balance(self):
        """Test missing balance dimension raises ValidationError."""
        data = create_outline_critic_dimensions()
        del data["balance"]
        with pytest.raises(ValidationError):
            OutlineCriticDimensions(**data)

    def test_outline_dimensions_missing_progression(self):
        """Test missing progression dimension raises ValidationError."""
        data = create_outline_critic_dimensions()
        del data["progression"]
        with pytest.raises(ValidationError):
            OutlineCriticDimensions(**data)

    def test_outline_dimensions_missing_chunking(self):
        """Test missing chunking dimension raises ValidationError."""
        data = create_outline_critic_dimensions()
        del data["chunking"]
        with pytest.raises(ValidationError):
            OutlineCriticDimensions(**data)

    def test_outline_dimensions_all_perfect_scores(self):
        """Test OutlineCriticDimensions with all perfect scores."""
        dims = OutlineCriticDimensions(
            coverage=DimensionScore(score=1.0),
            sequencing=DimensionScore(score=1.0),
            balance=DimensionScore(score=1.0),
            progression=DimensionScore(score=1.0),
            chunking=DimensionScore(score=1.0),
        )
        assert all(getattr(dims, d).score == 1.0 for d in ["coverage", "sequencing", "balance", "progression", "chunking"])


# ═══════════════════════════════════════════════════════════════════════════════
# OutlineCriticResult Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineCriticResult:
    """Tests for OutlineCriticResult model."""

    def test_valid_pass_result(self):
        """Test creating valid OutlineCriticResult with PASS verdict."""
        result = OutlineCriticResult(**create_valid_outline_critic_result())
        assert result.verdict == "PASS"
        assert result.overall_score == 0.86
        assert result.revision_guidance == []

    def test_valid_revision_required_result(self):
        """Test creating valid OutlineCriticResult with REVISION_REQUIRED verdict."""
        result = OutlineCriticResult(**create_revision_required_outline_result())
        assert result.verdict == "REVISION_REQUIRED"
        assert result.overall_score == 0.65
        assert len(result.revision_guidance) == 3

    def test_revision_required_needs_guidance(self):
        """Test REVISION_REQUIRED verdict requires revision_guidance."""
        data = create_revision_required_outline_result()
        data["revision_guidance"] = []  # Empty guidance should fail
        with pytest.raises(ValidationError) as exc_info:
            OutlineCriticResult(**data)
        assert "revision_guidance" in str(exc_info.value).lower()

    def test_pass_allows_empty_guidance(self):
        """Test PASS verdict allows empty revision_guidance."""
        data = create_valid_outline_critic_result()
        data["revision_guidance"] = []
        result = OutlineCriticResult(**data)
        assert result.revision_guidance == []

    def test_invalid_verdict(self):
        """Test invalid verdict raises ValidationError."""
        data = create_valid_outline_critic_result()
        data["verdict"] = "MAYBE"  # Invalid
        with pytest.raises(ValidationError):
            OutlineCriticResult(**data)

    def test_overall_score_bounds(self):
        """Test overall_score must be between 0.0 and 1.0."""
        data = create_valid_outline_critic_result()

        # Below minimum
        data["overall_score"] = -0.1
        with pytest.raises(ValidationError):
            OutlineCriticResult(**data)

        # Above maximum
        data["overall_score"] = 1.1
        with pytest.raises(ValidationError):
            OutlineCriticResult(**data)

    def test_json_serialization(self):
        """Test OutlineCriticResult JSON serialization."""
        result = OutlineCriticResult(**create_valid_outline_critic_result())
        json_str = result.model_dump_json()
        data = json.loads(json_str)
        assert data["verdict"] == "PASS"
        assert data["overall_score"] == 0.86
        assert "dimensions" in data

    def test_model_validate_json(self):
        """Test OutlineCriticResult can be validated from JSON string."""
        original = create_valid_outline_critic_result()
        json_str = json.dumps(original)
        result = OutlineCriticResult.model_validate_json(json_str)
        assert result.verdict == "PASS"


# ═══════════════════════════════════════════════════════════════════════════════
# LessonCriticDimensions Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestLessonCriticDimensions:
    """Tests for LessonCriticDimensions model."""

    def test_valid_lesson_dimensions(self):
        """Test creating valid LessonCriticDimensions."""
        dims = LessonCriticDimensions(**create_lesson_critic_dimensions())
        assert dims.coverage.score == 0.9
        assert dims.sequencing.score == 0.85
        assert dims.policy.score == 0.9
        assert dims.accessibility.score == 0.8
        assert dims.authenticity.score == 0.95

    def test_lesson_dimensions_has_policy(self):
        """Test LessonCriticDimensions has policy dimension (unlike outline)."""
        dims = LessonCriticDimensions(**create_lesson_critic_dimensions())
        assert hasattr(dims, "policy")
        assert dims.policy.score >= 0

    def test_lesson_dimensions_has_accessibility(self):
        """Test LessonCriticDimensions has accessibility dimension."""
        dims = LessonCriticDimensions(**create_lesson_critic_dimensions())
        assert hasattr(dims, "accessibility")

    def test_lesson_dimensions_has_authenticity(self):
        """Test LessonCriticDimensions has authenticity dimension."""
        dims = LessonCriticDimensions(**create_lesson_critic_dimensions())
        assert hasattr(dims, "authenticity")

    def test_lesson_dimensions_missing_policy(self):
        """Test missing policy dimension raises ValidationError."""
        data = create_lesson_critic_dimensions()
        del data["policy"]
        with pytest.raises(ValidationError):
            LessonCriticDimensions(**data)


# ═══════════════════════════════════════════════════════════════════════════════
# LessonCriticResult Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestLessonCriticResult:
    """Tests for LessonCriticResult model."""

    def test_valid_lesson_result(self):
        """Test creating valid LessonCriticResult."""
        result = LessonCriticResult(**create_valid_lesson_critic_result())
        assert result.verdict == "PASS"
        assert result.lesson_order == 3
        assert result.overall_score == 0.88

    def test_lesson_order_required(self):
        """Test lesson_order is required."""
        data = create_valid_lesson_critic_result()
        del data["lesson_order"]
        with pytest.raises(ValidationError):
            LessonCriticResult(**data)

    def test_lesson_order_minimum(self):
        """Test lesson_order must be >= 1."""
        data = create_valid_lesson_critic_result()
        data["lesson_order"] = 0  # Invalid
        with pytest.raises(ValidationError) as exc_info:
            LessonCriticResult(**data)
        assert "greater than or equal to 1" in str(exc_info.value).lower()

    def test_lesson_revision_required_needs_guidance(self):
        """Test REVISION_REQUIRED verdict requires revision_guidance for lessons."""
        data = create_valid_lesson_critic_result()
        data["verdict"] = "REVISION_REQUIRED"
        data["revision_guidance"] = []  # Should fail
        with pytest.raises(ValidationError):
            LessonCriticResult(**data)

    def test_lesson_revision_required_with_guidance(self):
        """Test REVISION_REQUIRED verdict with guidance passes."""
        data = create_valid_lesson_critic_result()
        data["verdict"] = "REVISION_REQUIRED"
        data["overall_score"] = 0.6
        data["revision_guidance"] = ["Add scaffolding to card 3"]
        result = LessonCriticResult(**data)
        assert result.verdict == "REVISION_REQUIRED"
        assert len(result.revision_guidance) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Utility Function Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestUtilityFunctions:
    """Tests for utility functions."""

    def test_calculate_overall_score_outline(self):
        """Test calculate_overall_score for outline dimensions."""
        dims = OutlineCriticDimensions(**create_outline_critic_dimensions())
        score = calculate_overall_score(dims)
        # Expected: (0.9 + 0.85 + 0.8 + 0.9 + 0.85) / 5 = 0.86
        assert abs(score - 0.86) < 0.01

    def test_calculate_overall_score_lesson(self):
        """Test calculate_overall_score for lesson dimensions."""
        dims = LessonCriticDimensions(**create_lesson_critic_dimensions())
        score = calculate_overall_score(dims)
        # Expected: (0.9 + 0.85 + 0.9 + 0.8 + 0.95) / 5 = 0.88
        assert abs(score - 0.88) < 0.01

    def test_calculate_overall_score_all_perfect(self):
        """Test calculate_overall_score with all perfect scores."""
        dims = OutlineCriticDimensions(
            coverage=DimensionScore(score=1.0),
            sequencing=DimensionScore(score=1.0),
            balance=DimensionScore(score=1.0),
            progression=DimensionScore(score=1.0),
            chunking=DimensionScore(score=1.0),
        )
        score = calculate_overall_score(dims)
        assert score == 1.0

    def test_calculate_overall_score_all_zero(self):
        """Test calculate_overall_score with all zero scores."""
        dims = OutlineCriticDimensions(
            coverage=DimensionScore(score=0.0),
            sequencing=DimensionScore(score=0.0),
            balance=DimensionScore(score=0.0),
            progression=DimensionScore(score=0.0),
            chunking=DimensionScore(score=0.0),
        )
        score = calculate_overall_score(dims)
        assert score == 0.0

    def test_should_pass_above_threshold(self):
        """Test should_pass returns True when score >= threshold."""
        assert should_pass(0.8) is True
        assert should_pass(0.7) is True
        assert should_pass(1.0) is True

    def test_should_pass_below_threshold(self):
        """Test should_pass returns False when score < threshold."""
        assert should_pass(0.69) is False
        assert should_pass(0.5) is False
        assert should_pass(0.0) is False

    def test_should_pass_custom_threshold(self):
        """Test should_pass with custom threshold."""
        assert should_pass(0.6, threshold=0.5) is True
        assert should_pass(0.6, threshold=0.8) is False

    def test_should_pass_exact_threshold(self):
        """Test should_pass at exact threshold boundary."""
        assert should_pass(0.7, threshold=0.7) is True


# ═══════════════════════════════════════════════════════════════════════════════
# JSON Schema Export Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestJSONSchemaExport:
    """Tests for JSON schema export (used with Claude Agent SDK)."""

    def test_outline_critic_result_json_schema(self):
        """Test OutlineCriticResult can export JSON schema."""
        schema = OutlineCriticResult.model_json_schema()
        assert "properties" in schema
        assert "verdict" in schema["properties"]
        assert "overall_score" in schema["properties"]
        assert "dimensions" in schema["properties"]

    def test_lesson_critic_result_json_schema(self):
        """Test LessonCriticResult can export JSON schema."""
        schema = LessonCriticResult.model_json_schema()
        assert "properties" in schema
        assert "lesson_order" in schema["properties"]
        assert "dimensions" in schema["properties"]

    def test_dimension_score_json_schema(self):
        """Test DimensionScore can export JSON schema."""
        schema = DimensionScore.model_json_schema()
        assert "properties" in schema
        assert "score" in schema["properties"]
        assert "issues" in schema["properties"]
        assert "notes" in schema["properties"]
