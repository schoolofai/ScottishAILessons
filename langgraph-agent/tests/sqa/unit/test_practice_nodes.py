"""Unit tests for QuestionPracticeGraph nodes.

Tests individual node functions since the graph uses interrupt-based flow.
For full graph testing with interrupts, see integration tests.
"""

import pytest
from agent.sqa.graphs.question_practice import (
    fetch_question_node,
    present_question_node,
    diagnose_node,
    show_feedback_node,
    check_continue_node,
    question_practice_graph
)


class TestFetchQuestionNode:
    """Test the fetch_question_node."""

    def test_fetch_basic(self):
        """Test basic question fetching."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": []
        }

        result = fetch_question_node(state)

        assert "question" in result
        assert result["question"]["subject"] == "Mathematics"
        assert result["question"]["level"] == "Nat 5"
        assert "used_question_ids" in result

    def test_fetch_with_outcome(self):
        """Test fetching with target outcome."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": []
        }

        result = fetch_question_node(state)

        assert result["question"]["outcome_id"] == "MNU-5-01"

    def test_fetch_updates_used_ids(self):
        """Test that used_question_ids is updated."""
        state = {
            "subject": "Physics",
            "level": "Nat 5",
            "used_question_ids": ["existing_id"]
        }

        result = fetch_question_node(state)

        assert len(result["used_question_ids"]) >= 2
        assert "existing_id" in result["used_question_ids"]


class TestPresentQuestionNode:
    """Test the present_question_node."""

    def test_present_generates_tool_call(self):
        """Test that presentation generates tool call message."""
        state = {
            "question": {
                "id": "test_q_1",
                "text": "Test question",
                "marks": 3,
                "outcome_id": "TEST-01",
                "subject": "Mathematics",
                "level": "Nat 5"
            }
        }

        result = present_question_node(state)

        assert "messages" in result
        assert len(result["messages"]) == 1

        message = result["messages"][0]
        assert hasattr(message, "tool_calls")
        assert len(message.tool_calls) == 1

        tool_call = message.tool_calls[0]
        assert tool_call["name"] == "PresentQuestionTool"
        assert "question_id" in tool_call["args"]
        assert tool_call["args"]["question_id"] == "test_q_1"


class TestDiagnoseNode:
    """Test the diagnose_node."""

    def test_diagnose_correct_answer(self):
        """Test diagnosis of correct answer."""
        state = {
            "question": {
                "id": "test_q_1",
                "text": "Calculate 2/10",
                "marks": 1,
                "marking_scheme": {
                    "criteria": [{"step": "Convert", "marks": 1}],
                    "total_marks": 1
                }
            },
            "user_answer": "0.2",
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        result = diagnose_node(state)

        assert result["result"] == "correct"
        assert result["total_questions"] == 1
        assert result["correct_count"] == 1
        assert result["streak"] == 1

    def test_diagnose_wrong_answer(self):
        """Test diagnosis of wrong answer."""
        state = {
            "question": {
                "id": "test_q_2",
                "text": "Calculate 2/10",
                "marks": 1,
                "marking_scheme": {
                    "criteria": [{"step": "Convert", "marks": 1}],
                    "total_marks": 1
                }
            },
            "user_answer": "wrong answer",
            "total_questions": 0,
            "correct_count": 0,
            "streak": 5
        }

        result = diagnose_node(state)

        assert result["result"] == "wrong"
        assert result["total_questions"] == 1
        assert result["correct_count"] == 0
        assert result["streak"] == 0  # Streak broken
        assert "gap_tags" in result
        assert "remediation" in result


class TestShowFeedbackNode:
    """Test the show_feedback_node."""

    def test_feedback_generates_tool_call(self):
        """Test that feedback generates tool call message."""
        state = {
            "question": {
                "id": "test_q_1",
                "marking_scheme": {"criteria": [], "total_marks": 1}
            },
            "result": "correct",
            "total_questions": 5,
            "correct_count": 4,
            "streak": 3,
            "gap_tags": [],
            "remediation": None
        }

        result = show_feedback_node(state)

        assert "messages" in result
        assert len(result["messages"]) == 1

        message = result["messages"][0]
        assert hasattr(message, "tool_calls")

        tool_call = message.tool_calls[0]
        assert tool_call["name"] == "ShowFeedbackTool"
        assert "result" in tool_call["args"]
        assert tool_call["args"]["result"] == "correct"
        assert "stats" in tool_call["args"]


class TestCheckContinueNode:
    """Test the check_continue_node."""

    def test_continue_true(self):
        """Test when user wants to continue."""
        state = {
            "resume_data": {"continue": True}
        }

        result = check_continue_node(state)

        assert result["should_continue"] is True

    def test_continue_false(self):
        """Test when user wants to stop."""
        state = {
            "resume_data": {"continue": False}
        }

        result = check_continue_node(state)

        assert result["should_continue"] is False

    def test_continue_default(self):
        """Test default behavior when resume_data missing."""
        state = {}

        result = check_continue_node(state)

        # Default should be True
        assert result["should_continue"] is True


class TestGraphCompilation:
    """Test graph structure and compilation."""

    def test_graph_compiles(self):
        """Test that graph compiles without errors."""
        assert question_practice_graph is not None

    def test_graph_has_nodes(self):
        """Test that all expected nodes are present."""
        # Graph should be compiled
        assert hasattr(question_practice_graph, "nodes")

    def test_graph_has_checkpointer(self):
        """Test that graph has checkpointer configured."""
        assert hasattr(question_practice_graph, "checkpointer")
        assert question_practice_graph.checkpointer is not None


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
