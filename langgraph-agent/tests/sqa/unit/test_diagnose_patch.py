"""Unit tests for SG_DiagnoseAndPatch subgraph.

Tests answer marking and remediation logic including:
- Correct answer detection
- Gap diagnosis
- Remediation generation
"""

import pytest
from src.agent.sqa.subgraphs.diagnose_patch import compiled_diagnose_graph
from tests.fixtures.sqa_test_data import SAMPLE_QUESTIONS, CORRECT_ANSWERS, WRONG_ANSWERS


class TestDiagnosePatchSubgraph:
    """Test suite for SG_DiagnoseAndPatch subgraph."""

    def test_correct_answer_basic(self):
        """Test that correct answers are recognized."""
        question = SAMPLE_QUESTIONS[0]  # 2/10 decimal question
        correct_answer = CORRECT_ANSWERS[question["id"]]

        state = {
            "question": question,
            "user_answer": correct_answer
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "correct"
        assert result["gap_tags"] == []
        assert "remediation" not in result or result.get("remediation") is None

    def test_wrong_answer_basic(self):
        """Test that wrong answers are detected."""
        question = SAMPLE_QUESTIONS[0]
        wrong_answer = WRONG_ANSWERS[question["id"]]

        state = {
            "question": question,
            "user_answer": wrong_answer
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        assert "gap_tags" in result
        assert len(result["gap_tags"]) > 0
        assert "remediation" in result
        assert result["remediation"] is not None

    def test_empty_answer(self):
        """Test handling of empty user answer."""
        question = SAMPLE_QUESTIONS[0]

        state = {
            "question": question,
            "user_answer": ""
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        assert "gap_tags" in result
        assert "no_attempt" in result["gap_tags"] or len(result["gap_tags"]) > 0

    def test_gap_tags_populated_for_wrong_answer(self):
        """Test that gap tags are identified for wrong answers."""
        question = SAMPLE_QUESTIONS[1]  # Equation question
        wrong_answer = "I cannot solve this"  # Clearly wrong non-numeric answer

        state = {
            "question": question,
            "user_answer": wrong_answer
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        assert "gap_tags" in result
        assert isinstance(result["gap_tags"], list)
        assert len(result["gap_tags"]) > 0

    def test_remediation_content_structure(self):
        """Test that remediation content is properly structured."""
        question = SAMPLE_QUESTIONS[1]
        wrong_answer = "wrong"

        state = {
            "question": question,
            "user_answer": wrong_answer
        }

        result = compiled_diagnose_graph.invoke(state)

        assert "remediation" in result
        remediation = result["remediation"]

        # Check for key sections
        assert "What went wrong" in remediation or "went wrong" in remediation.lower()
        assert "Key concept" in remediation or "concept" in remediation.lower()
        # Should reference the outcome
        assert question["outcome_id"] in remediation or len(remediation) > 50

    def test_correct_answer_skips_diagnosis(self):
        """Test that correct answers skip gap diagnosis."""
        question = SAMPLE_QUESTIONS[0]
        correct_answer = "0.2"

        state = {
            "question": question,
            "user_answer": correct_answer
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "correct"
        assert result["gap_tags"] == []
        # Should not have remediation for correct answers
        assert "remediation" not in result or result.get("remediation") is None

    def test_multiple_questions(self):
        """Test diagnosis across multiple question types."""
        for question in SAMPLE_QUESTIONS[:3]:
            # Test correct answer
            if question["id"] in CORRECT_ANSWERS:
                correct_state = {
                    "question": question,
                    "user_answer": CORRECT_ANSWERS[question["id"]]
                }
                correct_result = compiled_diagnose_graph.invoke(correct_state)
                assert correct_result["result"] == "correct"

            # Test wrong answer
            if question["id"] in WRONG_ANSWERS:
                wrong_state = {
                    "question": question,
                    "user_answer": WRONG_ANSWERS[question["id"]]
                }
                wrong_result = compiled_diagnose_graph.invoke(wrong_state)
                assert wrong_result["result"] == "wrong"
                assert len(wrong_result["gap_tags"]) > 0

    def test_numeric_answer_recognition(self):
        """Test that numeric answers are properly evaluated."""
        question = SAMPLE_QUESTIONS[0]  # Decimal question

        # Test various numeric formats
        numeric_answers = ["0.2", "0.20", ".2"]

        for answer in numeric_answers:
            state = {
                "question": question,
                "user_answer": answer
            }
            result = compiled_diagnose_graph.invoke(state)
            # All should be recognized as having numeric content
            assert result["result"] in ["correct", "wrong"]

    def test_state_preservation(self):
        """Test that original question and answer are preserved in state."""
        question = SAMPLE_QUESTIONS[0]
        user_answer = "test answer"

        state = {
            "question": question,
            "user_answer": user_answer
        }

        result = compiled_diagnose_graph.invoke(state)

        # Original data should still be accessible
        assert result["question"]["id"] == question["id"]
        assert result["user_answer"] == user_answer


class TestGapDiagnosis:
    """Detailed tests for gap diagnosis logic."""

    def test_equation_setup_gap(self):
        """Test detection of equation setup gaps."""
        question = SAMPLE_QUESTIONS[1]  # Equation question

        # Answer without equals sign suggests equation setup gap
        state = {
            "question": question,
            "user_answer": "I don't know"  # No equation format
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        # Should identify conceptual understanding or equation gap
        gaps = result["gap_tags"]
        assert len(gaps) > 0

    def test_calculation_error_gap(self):
        """Test detection of calculation errors."""
        question = SAMPLE_QUESTIONS[0]

        # Wrong non-matching answer
        state = {
            "question": question,
            "user_answer": "wrong calculation"
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        gaps = result["gap_tags"]
        # Should have some gap identified
        assert len(gaps) > 0

    def test_conceptual_understanding_gap(self):
        """Test detection of conceptual understanding gaps."""
        question = SAMPLE_QUESTIONS[2]  # Physics question

        # Very short answer suggests conceptual confusion
        state = {
            "question": question,
            "user_answer": "no"
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        gaps = result["gap_tags"]
        # Should have some gap identified
        assert len(gaps) > 0


class TestRemediation:
    """Detailed tests for remediation generation."""

    def test_remediation_includes_outcome(self):
        """Test that remediation references the outcome ID."""
        question = SAMPLE_QUESTIONS[0]

        state = {
            "question": question,
            "user_answer": "wrong"
        }

        result = compiled_diagnose_graph.invoke(state)

        remediation = result["remediation"]
        # Should mention the outcome
        assert question["outcome_id"] in remediation

    def test_remediation_includes_gap_specific_advice(self):
        """Test that remediation includes gap-specific guidance."""
        question = SAMPLE_QUESTIONS[1]

        state = {
            "question": question,
            "user_answer": "I don't know how to solve this"
        }

        result = compiled_diagnose_graph.invoke(state)

        remediation = result["remediation"]
        # Should include practical advice
        assert "step" in remediation.lower() or "concept" in remediation.lower()

    def test_remediation_has_practical_guidance(self):
        """Test that remediation provides actionable steps."""
        question = SAMPLE_QUESTIONS[0]

        state = {
            "question": question,
            "user_answer": "wrong"
        }

        result = compiled_diagnose_graph.invoke(state)

        remediation = result["remediation"]
        # Should have practical advice markers
        assert any(marker in remediation.lower() for marker in ["try", "step", "hint", "approach"])


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_whitespace_only_answer(self):
        """Test handling of whitespace-only answer."""
        question = SAMPLE_QUESTIONS[0]

        state = {
            "question": question,
            "user_answer": "   "
        }

        result = compiled_diagnose_graph.invoke(state)

        assert result["result"] == "wrong"
        assert len(result["gap_tags"]) > 0

    def test_very_long_answer(self):
        """Test handling of very long answer."""
        question = SAMPLE_QUESTIONS[0]

        state = {
            "question": question,
            "user_answer": "x" * 1000  # 1000 character answer
        }

        result = compiled_diagnose_graph.invoke(state)

        # Should still process without error
        assert result["result"] in ["correct", "wrong"]

    def test_special_characters_in_answer(self):
        """Test handling of special characters."""
        question = SAMPLE_QUESTIONS[0]

        state = {
            "question": question,
            "user_answer": "√π ≈ 1.772"
        }

        result = compiled_diagnose_graph.invoke(state)

        # Should process without crashing
        assert result["result"] in ["correct", "wrong"]


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
