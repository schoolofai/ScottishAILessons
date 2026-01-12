"""Tests for Walkthrough Models - TDD approach.

These tests verify the Pydantic models for Past Paper Walkthrough generation.
"""

import pytest
import json
from typing import Dict, Any

from src.models.walkthrough_models import (
    WalkthroughStep,
    CommonError,
    QuestionWalkthrough,
    WalkthroughDocument,
    ErrorType,
    WalkthroughStatus,
)


# =============================================================================
# Sample Data Fixtures
# =============================================================================

@pytest.fixture
def sample_step() -> Dict[str, Any]:
    """Sample walkthrough step based on SQA marking scheme."""
    return {
        "bullet": 1,
        "label": "•1: strategy",
        "process": "convert to improper fraction and multiply by reciprocal",
        "working": "13/6 × 9/8",
        "working_latex": r"\frac{13}{6} \times \frac{9}{8}",
        "marks_earned": 1,
        "examiner_notes": "Must show conversion to improper fraction"
    }


@pytest.fixture
def sample_error() -> Dict[str, Any]:
    """Sample common error."""
    return {
        "error_type": "calculation",
        "description": "Student forgets to convert mixed number to improper fraction first",
        "why_marks_lost": "•1 lost - strategy mark requires showing conversion",
        "prevention_tip": "Always convert mixed numbers to improper fractions before dividing"
    }


@pytest.fixture
def sample_walkthrough(sample_step: Dict, sample_error: Dict) -> Dict[str, Any]:
    """Complete walkthrough for a fraction division question."""
    return {
        "question_stem": "Evaluate 2 1/6 ÷ 8/9",
        "question_stem_latex": r"Evaluate $2\frac{1}{6} \div \frac{8}{9}$",
        "topic_tags": ["fractions", "division", "mixed-numbers"],
        "total_marks": 2,
        "steps": [
            sample_step,
            {
                "bullet": 2,
                "label": "•2: calculation",
                "process": "simplify",
                "working": "39/16 = 2 7/16",
                "working_latex": r"\frac{39}{16} = 2\frac{7}{16}",
                "marks_earned": 1,
                "examiner_notes": "Must be fully simplified"
            }
        ],
        "common_errors": [sample_error],
        "examiner_summary": "Correct answer without working scores 0/2. Both marks require evidence of method.",
        "diagram_refs": []
    }


# =============================================================================
# WalkthroughStep Tests
# =============================================================================

class TestWalkthroughStep:
    """Tests for WalkthroughStep model."""

    def test_valid_step(self, sample_step: Dict):
        """Test creating a valid walkthrough step."""
        step = WalkthroughStep(**sample_step)

        assert step.bullet == 1
        assert step.label == "•1: strategy"
        assert step.process == "convert to improper fraction and multiply by reciprocal"
        assert step.marks_earned == 1
        assert step.examiner_notes == "Must show conversion to improper fraction"

    def test_step_without_examiner_notes(self, sample_step: Dict):
        """Test step with optional examiner_notes omitted."""
        del sample_step["examiner_notes"]
        step = WalkthroughStep(**sample_step)

        assert step.examiner_notes is None

    def test_step_bullet_must_be_positive(self, sample_step: Dict):
        """Test that bullet number must be >= 1."""
        sample_step["bullet"] = 0

        with pytest.raises(ValueError):
            WalkthroughStep(**sample_step)

    def test_step_marks_must_be_non_negative(self, sample_step: Dict):
        """Test that marks_earned must be >= 0."""
        sample_step["marks_earned"] = -1

        with pytest.raises(ValueError):
            WalkthroughStep(**sample_step)

    def test_step_requires_process(self, sample_step: Dict):
        """Test that process field is required."""
        del sample_step["process"]

        with pytest.raises(ValueError):
            WalkthroughStep(**sample_step)


# =============================================================================
# CommonError Tests
# =============================================================================

class TestCommonError:
    """Tests for CommonError model."""

    def test_valid_error(self, sample_error: Dict):
        """Test creating a valid common error."""
        error = CommonError(**sample_error)

        assert error.error_type == "calculation"  # Literal type, compare with string
        assert "forgets to convert" in error.description
        assert "•1 lost" in error.why_marks_lost
        assert "convert mixed numbers" in error.prevention_tip

    def test_all_error_types(self):
        """Test all valid error types."""
        valid_types = ["notation", "calculation", "concept", "omission"]

        for error_type in valid_types:
            error = CommonError(
                error_type=error_type,
                description="Test error",
                why_marks_lost="Test marks lost",
                prevention_tip="Test prevention"
            )
            assert error.error_type == error_type

    def test_invalid_error_type(self, sample_error: Dict):
        """Test that invalid error_type raises validation error."""
        sample_error["error_type"] = "invalid_type"

        with pytest.raises(ValueError):
            CommonError(**sample_error)


# =============================================================================
# QuestionWalkthrough Tests
# =============================================================================

class TestQuestionWalkthrough:
    """Tests for QuestionWalkthrough model."""

    def test_valid_walkthrough(self, sample_walkthrough: Dict):
        """Test creating a valid walkthrough."""
        wt = QuestionWalkthrough(**sample_walkthrough)

        assert wt.question_stem == "Evaluate 2 1/6 ÷ 8/9"
        assert len(wt.steps) == 2
        assert len(wt.common_errors) == 1
        assert wt.total_marks == 2

    def test_walkthrough_steps_must_not_be_empty(self, sample_walkthrough: Dict):
        """Test that steps array cannot be empty."""
        sample_walkthrough["steps"] = []

        with pytest.raises(ValueError):
            QuestionWalkthrough(**sample_walkthrough)

    def test_walkthrough_marks_validation(self, sample_walkthrough: Dict):
        """Test that step marks should sum to total_marks."""
        wt = QuestionWalkthrough(**sample_walkthrough)

        # Verify marks sum correctly
        total_step_marks = sum(step.marks_earned for step in wt.steps)
        assert total_step_marks == wt.total_marks

    def test_walkthrough_without_errors(self, sample_walkthrough: Dict):
        """Test walkthrough with empty common_errors."""
        sample_walkthrough["common_errors"] = []
        wt = QuestionWalkthrough(**sample_walkthrough)

        assert len(wt.common_errors) == 0

    def test_walkthrough_with_diagram_refs(self, sample_walkthrough: Dict):
        """Test walkthrough with diagram references."""
        sample_walkthrough["diagram_refs"] = ["diag-n5-2023-p1-q4"]
        wt = QuestionWalkthrough(**sample_walkthrough)

        assert len(wt.diagram_refs) == 1
        assert wt.diagram_refs[0] == "diag-n5-2023-p1-q4"

    def test_walkthrough_json_serialization(self, sample_walkthrough: Dict):
        """Test that walkthrough can be serialized to JSON."""
        wt = QuestionWalkthrough(**sample_walkthrough)
        json_str = wt.model_dump_json()

        # Verify can be parsed back
        parsed = json.loads(json_str)
        assert parsed["question_stem"] == sample_walkthrough["question_stem"]
        assert len(parsed["steps"]) == 2

    def test_walkthrough_dict_export(self, sample_walkthrough: Dict):
        """Test model_dump for database storage."""
        wt = QuestionWalkthrough(**sample_walkthrough)
        data = wt.model_dump()

        assert isinstance(data, dict)
        assert "steps" in data
        assert all(isinstance(s, dict) for s in data["steps"])


# =============================================================================
# WalkthroughDocument Tests (Full DB Document)
# =============================================================================

class TestWalkthroughDocument:
    """Tests for the full document model stored in Appwrite."""

    def test_valid_document(self, sample_walkthrough: Dict):
        """Test creating a valid document for storage."""
        doc = WalkthroughDocument(
            paper_id="mathematics-n5-2023-X847-75-01",
            question_number="1",
            paper_code="X847/75/01",
            year=2023,
            subject="Mathematics",
            level="National 5",
            marks=2,
            walkthrough=QuestionWalkthrough(**sample_walkthrough),
            status="published",
            model_version="walkthrough_author_v1"
        )

        assert doc.paper_id == "mathematics-n5-2023-X847-75-01"
        assert doc.status == "published"  # Literal type, compare with string
        assert doc.walkthrough.total_marks == 2

    def test_document_status_enum(self, sample_walkthrough: Dict):
        """Test all valid status values."""
        for status in ["draft", "published", "archived"]:
            doc = WalkthroughDocument(
                paper_id="test-paper-id",
                question_number="1",
                paper_code="X847/75/01",
                year=2023,
                subject="Mathematics",
                level="National 5",
                marks=2,
                walkthrough=QuestionWalkthrough(**sample_walkthrough),
                status=status,
                model_version="v1"
            )
            assert doc.status == status

    def test_document_generate_id(self, sample_walkthrough: Dict):
        """Test document ID generation for Appwrite."""
        doc = WalkthroughDocument(
            paper_id="mathematics-n5-2023-X847-75-01",
            question_number="4a",
            paper_code="X847/75/01",
            year=2023,
            subject="Mathematics",
            level="National 5",
            marks=3,
            walkthrough=QuestionWalkthrough(**sample_walkthrough),
            status="draft",
            model_version="v1"
        )

        # ID should combine paper_id and question_number
        doc_id = doc.generate_document_id()
        assert "mathematics-n5-2023" in doc_id
        assert "4a" in doc_id

    def test_document_compress_content(self, sample_walkthrough: Dict):
        """Test content compression for storage."""
        doc = WalkthroughDocument(
            paper_id="test-paper",
            question_number="1",
            paper_code="X847/75/01",
            year=2023,
            subject="Mathematics",
            level="National 5",
            marks=2,
            walkthrough=QuestionWalkthrough(**sample_walkthrough),
            status="draft",
            model_version="v1"
        )

        compressed = doc.compress_walkthrough()

        # Should be base64 encoded string
        assert isinstance(compressed, str)

        # Should be smaller than raw JSON (gzip compression)
        raw_json = doc.walkthrough.model_dump_json()
        # Note: For small data, compressed might be larger due to overhead
        # Just verify it's valid base64
        import base64
        decoded = base64.b64decode(compressed)
        assert len(decoded) > 0

    def test_document_to_appwrite_row(self, sample_walkthrough: Dict):
        """Test conversion to Appwrite row format."""
        doc = WalkthroughDocument(
            paper_id="mathematics-n5-2023-X847-75-01",
            question_number="1",
            paper_code="X847/75/01",
            year=2023,
            subject="Mathematics",
            level="National 5",
            marks=2,
            walkthrough=QuestionWalkthrough(**sample_walkthrough),
            status="published",
            model_version="walkthrough_author_v1",
            generation_metadata={"tokens": 1500, "cost_usd": 0.05}
        )

        row = doc.to_appwrite_row()

        assert row["paper_id"] == "mathematics-n5-2023-X847-75-01"
        assert row["question_number"] == "1"
        assert row["status"] == "published"
        assert "walkthrough_content" in row  # Compressed content
        assert "last_modified" in row


# =============================================================================
# Integration Tests
# =============================================================================

class TestWalkthroughModelIntegration:
    """Integration tests for the full workflow."""

    def test_full_workflow_from_marking_scheme(self):
        """Test creating walkthrough from SQA marking scheme data."""
        # Simulating data from us_papers.data
        marking_scheme = {
            "max_marks": 2,
            "generic_scheme": [
                {"bullet": 1, "process": "start to invert and multiply"},
                {"bullet": 2, "process": "simplify"}
            ],
            "illustrative_scheme": [
                {"bullet": 1, "answer": "13/6 x 9/8", "answer_latex": r"\frac{13}{6} \times \frac{9}{8}"},
                {"bullet": 2, "answer": "39/16 = 2 7/16", "answer_latex": r"\frac{39}{16} = 2\frac{7}{16}"}
            ],
            "notes": ["Correct answer without working: 0/2"]
        }

        # Build steps from marking scheme
        steps = []
        for generic, illustrative in zip(
            marking_scheme["generic_scheme"],
            marking_scheme["illustrative_scheme"]
        ):
            step = WalkthroughStep(
                bullet=generic["bullet"],
                label=f"•{generic['bullet']}: {generic['process'].split()[0]}",
                process=generic["process"],
                working=illustrative["answer"],
                working_latex=illustrative["answer_latex"],
                marks_earned=1
            )
            steps.append(step)

        # Create walkthrough
        wt = QuestionWalkthrough(
            question_stem="Evaluate 2 1/6 ÷ 8/9",
            question_stem_latex=r"$2\frac{1}{6} \div \frac{8}{9}$",
            topic_tags=["fractions"],
            total_marks=marking_scheme["max_marks"],
            steps=steps,
            common_errors=[],
            examiner_summary=marking_scheme["notes"][0],
            diagram_refs=[]
        )

        assert wt.total_marks == 2
        assert len(wt.steps) == 2
        assert wt.steps[0].bullet == 1
        assert wt.steps[1].bullet == 2
