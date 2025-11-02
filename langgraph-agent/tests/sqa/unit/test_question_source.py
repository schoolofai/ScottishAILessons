"""Unit tests for QuestionSource tool interface.

Tests all 5 methods with various inputs and edge cases.
"""

import pytest
from src.agent.sqa.question_source import QuestionSource
from src.agent.sqa.states import Question


class TestGetSQASpec:
    """Test suite for get_sqa_spec method."""

    def test_get_nat5_maths_spec(self):
        """Test retrieving Nat 5 Mathematics specification."""
        spec = QuestionSource.get_sqa_spec("Mathematics", "Nat 5")

        assert spec is not None
        assert "outcomes" in spec
        assert "assessment_structure" in spec
        assert len(spec["outcomes"]) == 4
        assert len(spec["assessment_structure"]) == 2

        # Check outcome structure
        outcome = spec["outcomes"][0]
        assert "id" in outcome
        assert "label" in outcome
        assert "weight" in outcome

        # Check assessment structure
        section = spec["assessment_structure"][0]
        assert "section" in section
        assert "outcome_ids" in section
        assert "marks" in section

    def test_get_higher_physics_spec(self):
        """Test retrieving Higher Physics specification."""
        spec = QuestionSource.get_sqa_spec("Physics", "Higher")

        assert spec is not None
        assert len(spec["outcomes"]) == 4
        assert len(spec["assessment_structure"]) == 2

        # Verify it has assignment section
        sections = [s["section"] for s in spec["assessment_structure"]]
        assert "Assignment" in sections

    def test_invalid_subject_level_combination(self):
        """Test that invalid combinations raise ValueError."""
        with pytest.raises(ValueError) as exc_info:
            QuestionSource.get_sqa_spec("InvalidSubject", "Nat 5")

        assert "not found" in str(exc_info.value)
        assert "Available" in str(exc_info.value)

    def test_weights_sum_to_one(self):
        """Test that outcome weights sum to approximately 1.0."""
        spec = QuestionSource.get_sqa_spec("Mathematics", "Nat 5")

        total_weight = sum(o["weight"] for o in spec["outcomes"])
        assert abs(total_weight - 1.0) < 0.01  # Allow small floating point error


class TestGetLocalQuestions:
    """Test suite for get_local_questions method."""

    def test_get_existing_outcome_questions(self):
        """Test retrieving questions for an existing outcome."""
        questions = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=5
        )

        assert isinstance(questions, list)
        assert len(questions) > 0

        # Verify question structure
        for q in questions:
            assert "id" in q
            assert "source" in q
            assert q["source"] == "local"
            assert q["subject"] == "Mathematics"
            assert q["level"] == "Nat 5"
            assert q["outcome_id"] == "MNU-5-01"
            assert "text" in q
            assert "marks" in q
            assert "marking_scheme" in q

    def test_get_nonexistent_outcome_questions(self):
        """Test that non-existent outcomes return empty list."""
        questions = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-99", limit=5
        )

        assert questions == []

    def test_limit_parameter(self):
        """Test that limit parameter works correctly."""
        questions_limited = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )

        assert len(questions_limited) <= 1

    def test_marking_scheme_structure(self):
        """Test that marking schemes have correct structure."""
        questions = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )

        if questions:
            scheme = questions[0]["marking_scheme"]
            assert "criteria" in scheme
            assert "total_marks" in scheme
            assert isinstance(scheme["criteria"], list)

            if scheme["criteria"]:
                criterion = scheme["criteria"][0]
                assert "step" in criterion
                assert "marks" in criterion


class TestGetUSOrPastQuestions:
    """Test suite for get_us_or_past_questions method."""

    def test_nat5_returns_questions(self):
        """Test that Nat 5 level returns US/past questions."""
        questions = QuestionSource.get_us_or_past_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=5
        )

        assert isinstance(questions, list)
        # Should return at least 1 question (mock generates 1-2)
        assert len(questions) >= 1

        for q in questions:
            assert q["source"] in ["us", "past"]
            assert q["level"] == "Nat 5"

    def test_higher_returns_questions(self):
        """Test that Higher level returns US/past questions."""
        questions = QuestionSource.get_us_or_past_questions(
            "Physics", "Higher", "PHY-H-01", limit=5
        )

        assert isinstance(questions, list)
        assert len(questions) >= 1

    def test_nat3_returns_empty(self):
        """Test that Nat 3 level returns empty list (no US/past papers)."""
        questions = QuestionSource.get_us_or_past_questions(
            "Mathematics", "Nat 3", "MNU-3-01", limit=5
        )

        assert questions == []

    def test_nat4_returns_empty(self):
        """Test that Nat 4 level returns empty list (no US/past papers)."""
        questions = QuestionSource.get_us_or_past_questions(
            "Mathematics", "Nat 4", "MNU-4-01", limit=5
        )

        assert questions == []

    def test_limit_respected(self):
        """Test that limit parameter is respected."""
        questions = QuestionSource.get_us_or_past_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )

        assert len(questions) <= 1


class TestGenerateQuestion:
    """Test suite for generate_question method."""

    def test_generate_basic_question(self):
        """Test generating a basic LLM question."""
        question = QuestionSource.generate_question(
            "Mathematics", "Nat 5", "MNU-5-01", marks=4
        )

        assert question is not None
        assert question["id"].startswith("llm_")
        assert question["source"] == "llm"
        assert question["subject"] == "Mathematics"
        assert question["level"] == "Nat 5"
        assert question["outcome_id"] == "MNU-5-01"
        assert question["marks"] == 4
        assert "marking_scheme" in question

    def test_marking_scheme_matches_marks(self):
        """Test that generated marking scheme totals match requested marks."""
        for marks in [2, 3, 4, 5, 6]:
            question = QuestionSource.generate_question(
                "Physics", "Higher", "PHY-H-01", marks=marks
            )

            scheme = question["marking_scheme"]
            total = sum(c["marks"] for c in scheme["criteria"])
            assert total == marks
            assert scheme["total_marks"] == marks

    def test_unique_ids(self):
        """Test that generated questions have unique IDs."""
        q1 = QuestionSource.generate_question(
            "Mathematics", "Nat 5", "MNU-5-01", marks=4
        )
        q2 = QuestionSource.generate_question(
            "Mathematics", "Nat 5", "MNU-5-01", marks=4
        )

        assert q1["id"] != q2["id"]

    def test_metadata_includes_generated_flag(self):
        """Test that generated questions have metadata indicating LLM generation."""
        question = QuestionSource.generate_question(
            "Mathematics", "Nat 5", "MNU-5-01", marks=4
        )

        assert "metadata" in question
        assert question["metadata"]["generated"] is True


class TestMutateQuestion:
    """Test suite for mutate_question method."""

    def test_mutate_creates_variant(self):
        """Test that mutation creates a new variant."""
        original = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )[0]

        variant = QuestionSource.mutate_question(original)

        assert variant["id"] != original["id"]
        assert "_variant_" in variant["id"]
        assert variant["source"] == "variant"
        assert variant["subject"] == original["subject"]
        assert variant["level"] == original["level"]
        assert variant["outcome_id"] == original["outcome_id"]

    def test_mutate_preserves_metadata(self):
        """Test that mutation preserves original metadata."""
        original = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )[0]

        variant = QuestionSource.mutate_question(original)

        assert "metadata" in variant
        assert variant["metadata"]["variant_of"] == original["id"]

    def test_mutate_increments_variant_number(self):
        """Test that repeated mutations increment variant number."""
        original = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )[0]

        variant1 = QuestionSource.mutate_question(original)
        variant2 = QuestionSource.mutate_question(variant1)
        variant3 = QuestionSource.mutate_question(variant2)

        assert "_variant_1" in variant1["id"]
        assert "_variant_2" in variant2["id"]
        assert "_variant_3" in variant3["id"]

    def test_mutate_preserves_marking_scheme(self):
        """Test that mutation preserves the marking scheme."""
        original = QuestionSource.get_local_questions(
            "Mathematics", "Nat 5", "MNU-5-01", limit=1
        )[0]

        variant = QuestionSource.mutate_question(original)

        assert variant["marks"] == original["marks"]
        assert variant["marking_scheme"]["total_marks"] == original["marking_scheme"]["total_marks"]


class TestIntegration:
    """Integration tests for QuestionSource methods working together."""

    def test_full_question_retrieval_pipeline(self):
        """Test complete pipeline: local → US/past → LLM → mutate."""
        subject = "Mathematics"
        level = "Nat 5"
        outcome_id = "MNU-5-01"

        # Step 1: Get local questions
        local = QuestionSource.get_local_questions(subject, level, outcome_id, limit=5)
        assert len(local) > 0

        # Step 2: Get US/past questions
        us_past = QuestionSource.get_us_or_past_questions(subject, level, outcome_id, limit=5)
        assert len(us_past) > 0  # Nat 5 should have these

        # Step 3: Generate LLM fallback
        llm_q = QuestionSource.generate_question(subject, level, outcome_id, marks=4)
        assert llm_q["source"] == "llm"

        # Step 4: Mutate for novelty
        variant = QuestionSource.mutate_question(local[0])
        assert variant["source"] == "variant"

    def test_spec_outcomes_match_question_outcomes(self):
        """Test that questions exist for outcomes defined in spec."""
        spec = QuestionSource.get_sqa_spec("Mathematics", "Nat 5")
        outcomes = [o["id"] for o in spec["outcomes"]]

        # Check that we can retrieve questions for each outcome
        for outcome_id in outcomes:
            # Should get either local, US/past, or be able to generate
            local = QuestionSource.get_local_questions("Mathematics", "Nat 5", outcome_id)
            us_past = QuestionSource.get_us_or_past_questions("Mathematics", "Nat 5", outcome_id)
            llm = QuestionSource.generate_question("Mathematics", "Nat 5", outcome_id)

            # At least one source should work
            assert len(local) > 0 or len(us_past) > 0 or llm is not None


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
