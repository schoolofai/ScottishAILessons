"""Integration tests for QuestionPracticeGraph flow.

Tests the complete practice session flow with real subgraphs and interrupt simulation.
"""

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage

from agent.sqa.graphs.question_practice import question_practice_graph


class TestQuestionPracticeFlow:
    """Test complete question practice flow with interrupts."""

    def test_single_question_correct_answer(self):
        """Test complete flow: fetch → present → answer (correct) → feedback → stop."""
        # Create thread config for checkpointing
        config = {
            "configurable": {
                "thread_id": "test_practice_single_correct"
            }
        }

        # Initial state
        initial_state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Step 1: Start session - should fetch and present question
        result1 = question_practice_graph.invoke(initial_state, config)

        assert "question" in result1
        assert result1["question"]["subject"] == "Mathematics"
        assert result1["question"]["level"] == "Nat 5"
        assert len(result1["used_question_ids"]) == 1

        # Check tool call was generated for presentation
        assert "messages" in result1
        messages = result1["messages"]
        tool_calls_found = any(
            hasattr(msg, "tool_calls") and msg.tool_calls
            for msg in messages
        )
        assert tool_calls_found, "Expected tool call for question presentation"

        # Step 2: Simulate user providing correct answer
        # For mock question "test_q_001", correct answer is "0.2"
        resume_state = {
            **result1,
            "user_answer": "0.2",
            "resume_data": {"continue": False}  # Don't continue after this question
        }

        result2 = question_practice_graph.invoke(resume_state, config)

        # Check diagnosis was correct
        assert result2["result"] == "correct"
        assert result2["total_questions"] == 1
        assert result2["correct_count"] == 1
        assert result2["streak"] == 1

        # Check feedback tool call was generated
        assert "messages" in result2
        feedback_found = any(
            hasattr(msg, "tool_calls")
            and msg.tool_calls
            and any(tc["name"] == "ShowFeedbackTool" for tc in msg.tool_calls)
            for msg in result2["messages"]
        )
        assert feedback_found, "Expected ShowFeedbackTool call"

    def test_single_question_wrong_answer(self):
        """Test complete flow with wrong answer and remediation."""
        config = {
            "configurable": {
                "thread_id": "test_practice_single_wrong"
            }
        }

        initial_state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Step 1: Fetch and present
        result1 = question_practice_graph.invoke(initial_state, config)
        assert "question" in result1

        # Step 2: Provide wrong answer
        resume_state = {
            **result1,
            "user_answer": "completely wrong",
            "resume_data": {"continue": False}
        }

        result2 = question_practice_graph.invoke(resume_state, config)

        # Check diagnosis
        assert result2["result"] == "wrong"
        assert result2["total_questions"] == 1
        assert result2["correct_count"] == 0
        assert result2["streak"] == 0

        # Check gap detection and remediation were generated
        assert "gap_tags" in result2
        assert result2["gap_tags"] is not None
        assert "remediation" in result2
        assert result2["remediation"] is not None

    def test_multi_question_session(self):
        """Test session with multiple questions and streak tracking."""
        config = {
            "configurable": {
                "thread_id": "test_practice_multi"
            }
        }

        state = {
            "subject": "Physics",
            "level": "Nat 5",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Question 1: Correct
        result1 = question_practice_graph.invoke(state, config)
        state = {
            **result1,
            "user_answer": "0.2",
            "resume_data": {"continue": True}
        }
        result1_feedback = question_practice_graph.invoke(state, config)

        assert result1_feedback["correct_count"] == 1
        assert result1_feedback["streak"] == 1

        # Question 2: Correct (streak continues)
        result2 = question_practice_graph.invoke({**result1_feedback, "resume_data": {"continue": True}}, config)
        state = {
            **result2,
            "user_answer": "0.2",
            "resume_data": {"continue": True}
        }
        result2_feedback = question_practice_graph.invoke(state, config)

        assert result2_feedback["correct_count"] == 2
        assert result2_feedback["streak"] == 2

        # Question 3: Wrong (streak broken)
        result3 = question_practice_graph.invoke({**result2_feedback, "resume_data": {"continue": True}}, config)
        state = {
            **result3,
            "user_answer": "completely wrong",
            "resume_data": {"continue": False}
        }
        result3_feedback = question_practice_graph.invoke(state, config)

        assert result3_feedback["total_questions"] == 3
        assert result3_feedback["correct_count"] == 2
        assert result3_feedback["streak"] == 0  # Streak broken

    def test_used_question_ids_accumulation(self):
        """Test that used_question_ids accumulates across session."""
        config = {
            "configurable": {
                "thread_id": "test_practice_used_ids"
            }
        }

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Process 3 questions
        for i in range(3):
            # Fetch question
            result = question_practice_graph.invoke(state, config)
            used_count = len(result["used_question_ids"])
            assert used_count == i + 1, f"Expected {i + 1} used IDs, got {used_count}"

            # Answer and continue
            state = {
                **result,
                "user_answer": "0.2",
                "resume_data": {"continue": True}
            }
            result = question_practice_graph.invoke(state, config)
            state = {**result, "resume_data": {"continue": True}}

        # Final check
        assert len(state["used_question_ids"]) == 3

    def test_target_outcome_respected(self):
        """Test that target outcome is respected when provided."""
        config = {
            "configurable": {
                "thread_id": "test_practice_target_outcome"
            }
        }

        target = "MNU-5-01"
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": target,
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Fetch question
        result = question_practice_graph.invoke(state, config)

        # Check question matches target outcome
        assert result["question"]["outcome_id"] == target

    def test_continue_loop_behavior(self):
        """Test that continue flag controls loop."""
        config = {
            "configurable": {
                "thread_id": "test_practice_continue"
            }
        }

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # First question - set continue=True
        result1 = question_practice_graph.invoke(state, config)
        state = {
            **result1,
            "user_answer": "0.2",
            "resume_data": {"continue": True}
        }
        result1_feedback = question_practice_graph.invoke(state, config)

        # Should have should_continue=True
        assert result1_feedback.get("should_continue") is True

        # Second question - set continue=False
        result2 = question_practice_graph.invoke({**result1_feedback, "resume_data": {"continue": True}}, config)
        state = {
            **result2,
            "user_answer": "0.2",
            "resume_data": {"continue": False}
        }
        result2_feedback = question_practice_graph.invoke(state, config)

        # Should have should_continue=False
        assert result2_feedback.get("should_continue") is False


class TestQuestionPracticeEdgeCases:
    """Test edge cases in practice flow."""

    def test_different_subjects(self):
        """Test practice works for different subjects."""
        subjects = [
            ("Mathematics", "Nat 5"),
            ("Physics", "Higher"),
            ("Chemistry", "Nat 4")
        ]

        for i, (subject, level) in enumerate(subjects):
            config = {
                "configurable": {
                    "thread_id": f"test_practice_subject_{i}"
                }
            }

            state = {
                "subject": subject,
                "level": level,
                "used_question_ids": [],
                "total_questions": 0,
                "correct_count": 0,
                "streak": 0
            }

            result = question_practice_graph.invoke(state, config)

            assert result["question"]["subject"] == subject
            assert result["question"]["level"] == level

    def test_large_streak(self):
        """Test streak tracking over many correct answers."""
        config = {
            "configurable": {
                "thread_id": "test_practice_large_streak"
            }
        }

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Answer 5 questions correctly
        for i in range(5):
            result = question_practice_graph.invoke(state, config)
            state = {
                **result,
                "user_answer": "0.2",
                "resume_data": {"continue": True}
            }
            result = question_practice_graph.invoke(state, config)
            assert result["streak"] == i + 1
            state = {**result, "resume_data": {"continue": True}}

        # Final check
        assert state["streak"] == 5
        assert state["correct_count"] == 5
        assert state["total_questions"] == 5


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
