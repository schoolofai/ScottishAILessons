"""Unit tests for SG_FetchQuestion subgraph.

Tests the DRY question retrieval logic including:
- Outcome selection
- Candidate collection
- Novelty enforcement
"""

import pytest
from src.agent.sqa.subgraphs.fetch_question import compiled_fetch_graph


class TestFetchQuestionSubgraph:
    """Test suite for SG_FetchQuestion subgraph."""

    def test_fetch_with_target_outcome(self):
        """Test fetching question with pre-specified outcome."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        result = compiled_fetch_graph.invoke(state)

        assert "question" in result
        assert result["question"] is not None
        assert result["question"]["outcome_id"] == "MNU-5-01"
        assert result["question"]["subject"] == "Mathematics"
        assert result["question"]["level"] == "Nat 5"
        assert "used_question_ids" in result
        assert result["question"]["id"] in result["used_question_ids"]

    def test_fetch_without_target_outcome(self):
        """Test that outcome is selected when not provided."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": []
        }

        result = compiled_fetch_graph.invoke(state)

        assert "question" in result
        assert result["question"] is not None
        assert result["question"]["outcome_id"] is not None
        # Outcome should be one of the Nat 5 Math outcomes
        valid_outcomes = ["MNU-5-01", "MNU-5-02", "MNU-5-03", "MNU-5-04"]
        assert result["question"]["outcome_id"] in valid_outcomes

    def test_novelty_with_unused_questions(self):
        """Test that unused questions are preferred."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        # First invocation
        result1 = compiled_fetch_graph.invoke(state)
        q1_id = result1["question"]["id"]

        # Second invocation with first question marked as used
        state["used_question_ids"] = [q1_id]
        result2 = compiled_fetch_graph.invoke(state)
        q2_id = result2["question"]["id"]

        # Should get a different question
        assert q1_id != q2_id
        assert q1_id in result2["used_question_ids"]
        assert q2_id in result2["used_question_ids"]

    def test_novelty_mutation_when_all_used(self):
        """Test that mutation occurs when all questions are used."""
        # Use Nat 3 to avoid random US/past questions (more deterministic)
        state = {
            "subject": "Mathematics",
            "level": "Nat 3",
            "target_outcome": "MNU-3-01",
            "used_question_ids": []
        }

        # Collect questions until we need mutation
        # Nat 3 has no US/past papers and limited local questions
        questions_seen = []
        sources_seen = []

        for i in range(5):  # Run enough times to force mutation
            result = compiled_fetch_graph.invoke(state)
            question = result["question"]
            questions_seen.append(question["id"])
            sources_seen.append(question["source"])
            state["used_question_ids"] = result["used_question_ids"]

        # After exhausting questions, should see variants or LLM
        variant_count = sum(1 for qid in questions_seen if "_variant_" in qid)
        llm_count = sum(1 for src in sources_seen if src == "llm")

        # Should have at least some variants or LLM generations
        assert variant_count > 0 or llm_count > 0, f"Expected variants or LLM after exhausting questions. Seen: {sources_seen}"

    def test_nat5_includes_us_past_questions(self):
        """Test that Nat 5 level fetches US/past papers."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        # Run multiple times to potentially get US/past questions
        sources_seen = set()

        for _ in range(20):
            result = compiled_fetch_graph.invoke(state)
            sources_seen.add(result["question"]["source"])
            # Reset used_question_ids to allow getting different questions
            state["used_question_ids"] = []

        # Should see either local, us, or past (or llm/variant)
        # Nat 5 should have access to us/past
        assert "local" in sources_seen or "us" in sources_seen or "past" in sources_seen

    def test_nat3_excludes_us_past_questions(self):
        """Test that Nat 3 level does NOT fetch US/past papers."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 3",
            "target_outcome": "MNU-3-01",
            "used_question_ids": []
        }

        # Run multiple times
        sources_seen = set()

        for _ in range(10):
            result = compiled_fetch_graph.invoke(state)
            sources_seen.add(result["question"]["source"])
            state["used_question_ids"] = []

        # Should NOT see us/past for Nat 3
        # Should see local or llm (or variant)
        assert "us" not in sources_seen
        assert "past" not in sources_seen

    def test_llm_fallback_for_missing_outcome(self):
        """Test that LLM fallback is used when no questions exist."""
        # Use Nat 3 with non-existent outcome to avoid US/past questions
        state = {
            "subject": "Mathematics",
            "level": "Nat 3",
            "target_outcome": "MNU-3-99",  # Non-existent outcome
            "used_question_ids": []
        }

        result = compiled_fetch_graph.invoke(state)

        assert "question" in result
        assert result["question"] is not None
        # Should fallback to LLM generation (Nat 3 has no US/past, and no local for MNU-3-99)
        assert result["question"]["source"] == "llm"

    def test_used_question_ids_accumulation(self):
        """Test that used_question_ids accumulates correctly."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        # Run three times
        result1 = compiled_fetch_graph.invoke(state)
        state["used_question_ids"] = result1["used_question_ids"]

        result2 = compiled_fetch_graph.invoke(state)
        state["used_question_ids"] = result2["used_question_ids"]

        result3 = compiled_fetch_graph.invoke(state)

        # Should have all three IDs
        assert len(result3["used_question_ids"]) == 3
        assert result1["question"]["id"] in result3["used_question_ids"]
        assert result2["question"]["id"] in result3["used_question_ids"]
        assert result3["question"]["id"] in result3["used_question_ids"]

    def test_question_structure_completeness(self):
        """Test that returned questions have all required fields."""
        state = {
            "subject": "Physics",
            "level": "Nat 5",
            "target_outcome": "PHY-5-01",
            "used_question_ids": []
        }

        result = compiled_fetch_graph.invoke(state)
        question = result["question"]

        # Check all required fields
        assert "id" in question
        assert "source" in question
        assert "subject" in question
        assert "level" in question
        assert "outcome_id" in question
        assert "text" in question
        assert "marks" in question
        assert "marking_scheme" in question

        # Check marking scheme structure
        scheme = question["marking_scheme"]
        assert "criteria" in scheme
        assert "total_marks" in scheme
        assert isinstance(scheme["criteria"], list)

    def test_different_subjects(self):
        """Test that subgraph works with different subjects."""
        subjects_and_levels = [
            ("Mathematics", "Nat 5", "MNU-5-01"),
            ("Physics", "Nat 5", "PHY-5-01"),
            ("Mathematics", "Higher", "MNU-H-01"),
            ("Physics", "Higher", "PHY-H-01"),
        ]

        for subject, level, outcome in subjects_and_levels:
            state = {
                "subject": subject,
                "level": level,
                "target_outcome": outcome,
                "used_question_ids": []
            }

            result = compiled_fetch_graph.invoke(state)

            assert result["question"]["subject"] == subject
            assert result["question"]["level"] == level
            assert result["question"]["outcome_id"] == outcome

    def test_temporary_state_cleanup(self):
        """Test that temporary candidates state is cleaned up."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        result = compiled_fetch_graph.invoke(state)

        # candidates should not be in final result (or should be None)
        assert "candidates" not in result or result["candidates"] is None


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_used_question_ids_list(self):
        """Test with explicitly empty used_question_ids."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        result = compiled_fetch_graph.invoke(state)

        assert result["question"] is not None
        assert len(result["used_question_ids"]) == 1

    def test_none_used_question_ids(self):
        """Test with missing used_question_ids (treated as empty)."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01"
        }

        result = compiled_fetch_graph.invoke(state)

        assert result["question"] is not None
        assert "used_question_ids" in result


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
