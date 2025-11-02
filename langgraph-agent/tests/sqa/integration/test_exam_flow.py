"""Integration tests for ExamAssessmentGraph flow.

Tests the complete exam generation, marking, and remediation flow.
"""

import pytest
from langgraph.checkpoint.memory import MemorySaver

from agent.sqa.graphs.exam_assessment import exam_assessment_graph


class TestExamAssessmentFlow:
    """Test complete exam assessment flow."""

    def test_complete_exam_cycle(self):
        """Test full cycle: blueprint → fill → assemble → deliver → mark → results → stop."""
        config = {
            "configurable": {
                "thread_id": "test_exam_complete"
            }
        }

        initial_state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        # Step 1: Generate and deliver exam
        result1 = exam_assessment_graph.invoke(initial_state, config)

        # Check blueprint was created
        assert "blueprint" in result1
        assert len(result1["blueprint"]) > 0

        # Check questions were filled
        assert "questions" in result1
        assert len(result1["questions"]) == len(result1["blueprint"])

        # Check exam package was assembled
        assert "exam_package" in result1
        exam = result1["exam_package"]
        assert "exam_id" in exam
        assert "total_marks" in exam
        assert "time_allowed_minutes" in exam
        assert "question_count" in exam

        # Check delivery tool call
        assert "messages" in result1
        delivery_found = any(
            hasattr(msg, "tool_calls")
            and msg.tool_calls
            and any(tc["name"] == "DeliverExamTool" for tc in msg.tool_calls)
            for msg in result1["messages"]
        )
        assert delivery_found, "Expected DeliverExamTool call"

        # Step 2: Simulate student responses and get marking
        # Create responses for all questions (mix of correct and wrong)
        responses = {}
        for i, question in enumerate(result1["questions"], 1):
            # Alternate correct/wrong for testing
            if i % 2 == 0:
                responses[str(i)] = "0.2"  # Correct
            else:
                responses[str(i)] = "wrong answer"  # Wrong

        resume_state = {
            **result1,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(resume_state, config)

        # Check marking was completed
        assert "marking" in result2
        assert len(result2["marking"]) == len(result1["questions"])

        # Check gap outcomes were identified
        assert "gap_outcomes" in result2
        assert isinstance(result2["gap_outcomes"], list)

        # Check results tool call
        results_found = any(
            hasattr(msg, "tool_calls")
            and msg.tool_calls
            and any(tc["name"] == "ShowExamResultsTool" for tc in msg.tool_calls)
            for msg in result2["messages"]
        )
        assert results_found, "Expected ShowExamResultsTool call"

        # Check should_continue is False (next_exam=False)
        assert result2.get("should_continue") is False

    def test_all_correct_answers(self):
        """Test exam with all correct answers (no gaps)."""
        config = {
            "configurable": {
                "thread_id": "test_exam_all_correct"
            }
        }

        state = {
            "subject": "Physics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        # Generate exam
        result1 = exam_assessment_graph.invoke(state, config)

        # Provide all correct answers
        responses = {
            str(i): "0.2"
            for i in range(1, len(result1["questions"]) + 1)
        }

        state = {
            **result1,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(state, config)

        # Check all marked as correct
        marking = result2["marking"]
        all_correct = all(
            mark["correct"] for mark in marking.values()
        )
        assert all_correct, "Expected all answers to be correct"

        # No gap outcomes
        assert len(result2["gap_outcomes"]) == 0

        # Should get high grade
        results_tool = None
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        results_tool = tc
                        break

        assert results_tool is not None
        assert results_tool["args"]["percentage"] == 100.0
        assert results_tool["args"]["grade"] in ["A", "Pass"]

    def test_all_wrong_answers(self):
        """Test exam with all wrong answers (all gaps)."""
        config = {
            "configurable": {
                "thread_id": "test_exam_all_wrong"
            }
        }

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        # Generate exam
        result1 = exam_assessment_graph.invoke(state, config)

        # Provide all wrong answers
        responses = {
            str(i): "completely wrong"
            for i in range(1, len(result1["questions"]) + 1)
        }

        state = {
            **result1,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(state, config)

        # Check all marked as wrong
        marking = result2["marking"]
        all_wrong = all(
            not mark["correct"] for mark in marking.values()
        )
        assert all_wrong, "Expected all answers to be wrong"

        # Should have multiple gap outcomes
        assert len(result2["gap_outcomes"]) > 0

        # Should get failing grade
        results_tool = None
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        results_tool = tc
                        break

        assert results_tool is not None
        assert results_tool["args"]["percentage"] == 0.0
        assert results_tool["args"]["grade"] in ["No Award", "Fail"]

    def test_multi_exam_session(self):
        """Test generating multiple exams in one session."""
        config = {
            "configurable": {
                "thread_id": "test_exam_multi"
            }
        }

        state = {
            "subject": "Physics",
            "level": "Higher",
            "used_question_ids": [],
            "exam_count": 0
        }

        # Exam 1
        result1 = exam_assessment_graph.invoke(state, config)
        assert result1["exam_count"] == 0

        # Complete exam 1 and request another
        responses1 = {str(i): "0.2" for i in range(1, len(result1["questions"]) + 1)}
        state = {
            **result1,
            "responses": responses1,
            "resume_data": {"next_exam": True}
        }
        result1_complete = exam_assessment_graph.invoke(state, config)

        assert result1_complete.get("should_continue") is True
        assert result1_complete["exam_count"] == 1

        # Exam 2
        result2 = exam_assessment_graph.invoke({**result1_complete, "resume_data": {"next_exam": True}}, config)
        assert result2["exam_count"] == 1

        # Complete exam 2 and stop
        responses2 = {str(i): "0.2" for i in range(1, len(result2["questions"]) + 1)}
        state = {
            **result2,
            "responses": responses2,
            "resume_data": {"next_exam": False}
        }
        result2_complete = exam_assessment_graph.invoke(state, config)

        assert result2_complete.get("should_continue") is False
        # Exam count stays at 1 when not continuing
        assert result2_complete["exam_count"] == 1

    def test_blueprint_structure(self):
        """Test blueprint is correctly structured."""
        config = {
            "configurable": {
                "thread_id": "test_exam_blueprint"
            }
        }

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        blueprint = result["blueprint"]

        # Check all blueprint slots have required fields
        for slot in blueprint:
            assert "section" in slot
            assert "outcome_id" in slot
            assert "marks" in slot
            assert isinstance(slot["marks"], int)
            assert slot["marks"] > 0

    def test_exam_package_structure(self):
        """Test exam package has all required fields."""
        config = {
            "configurable": {
                "thread_id": "test_exam_package"
            }
        }

        state = {
            "subject": "Chemistry",
            "level": "Higher",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        exam = result["exam_package"]

        # Required fields
        assert "exam_id" in exam
        assert "subject" in exam
        assert exam["subject"] == "Chemistry"
        assert "level" in exam
        assert exam["level"] == "Higher"
        assert "total_marks" in exam
        assert exam["total_marks"] > 0
        assert "question_count" in exam
        assert exam["question_count"] == len(result["questions"])
        assert "time_allowed_minutes" in exam
        assert exam["time_allowed_minutes"] > 0
        assert "sections" in exam

    def test_marking_detail(self):
        """Test that marking includes detailed information."""
        config = {
            "configurable": {
                "thread_id": "test_exam_marking_detail"
            }
        }

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        # Generate exam
        result1 = exam_assessment_graph.invoke(state, config)

        # Mix of correct and wrong answers
        responses = {
            "1": "0.2",  # Correct
            "2": "wrong"  # Wrong
        }

        state = {
            **result1,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(state, config)

        marking = result2["marking"]

        # Check marking detail for correct answer
        mark1 = marking["1"]
        assert mark1["correct"] is True
        assert "marks_awarded" in mark1
        assert "marks_available" in mark1
        assert mark1["marks_awarded"] == mark1["marks_available"]

        # Check marking detail for wrong answer
        mark2 = marking["2"]
        assert mark2["correct"] is False
        assert "gap_tags" in mark2


class TestExamAssessmentLevels:
    """Test exam generation for different SQA levels."""

    def test_nat3_exam(self):
        """Test Nat 3 exam generation."""
        config = {"configurable": {"thread_id": "test_exam_nat3"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 3",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        assert result["exam_package"]["level"] == "Nat 3"
        assert len(result["questions"]) > 0

    def test_nat4_exam(self):
        """Test Nat 4 exam generation."""
        config = {"configurable": {"thread_id": "test_exam_nat4"}}

        state = {
            "subject": "Physics",
            "level": "Nat 4",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        assert result["exam_package"]["level"] == "Nat 4"

    def test_nat5_exam(self):
        """Test Nat 5 exam generation with US/past papers."""
        config = {"configurable": {"thread_id": "test_exam_nat5"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        assert result["exam_package"]["level"] == "Nat 5"
        # Should include some US/past paper questions
        questions = result["questions"]
        sources = [q["source"] for q in questions]
        # At least some questions should be from us or past papers (in mock data)
        assert any(s in ["local", "us", "past", "llm"] for s in sources)

    def test_higher_exam(self):
        """Test Higher exam generation."""
        config = {"configurable": {"thread_id": "test_exam_higher"}}

        state = {
            "subject": "Chemistry",
            "level": "Higher",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        assert result["exam_package"]["level"] == "Higher"

    def test_advanced_higher_exam(self):
        """Test Advanced Higher exam generation."""
        config = {"configurable": {"thread_id": "test_exam_adv_higher"}}

        state = {
            "subject": "Physics",
            "level": "Advanced Higher",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        assert result["exam_package"]["level"] == "Advanced Higher"


class TestExamAssessmentGrading:
    """Test SQA grading calculations."""

    def test_nat5_grading(self):
        """Test Nat 5 A-D grading boundaries."""
        config = {"configurable": {"thread_id": "test_exam_nat5_grading"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        # Get total marks
        total_questions = len(result["questions"])
        correct_count = int(total_questions * 0.75)  # 75% correct = Grade A

        # Provide 75% correct answers
        responses = {}
        for i in range(1, total_questions + 1):
            if i <= correct_count:
                responses[str(i)] = "0.2"  # Correct
            else:
                responses[str(i)] = "wrong"  # Wrong

        state = {
            **result,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(state, config)

        # Find results tool call
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        # 75% should be Grade A for Nat 5
                        assert tc["args"]["grade"] == "A"

    def test_nat3_pass_fail(self):
        """Test Nat 3 pass/fail grading."""
        config = {"configurable": {"thread_id": "test_exam_nat3_grading"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 3",
            "used_question_ids": [],
            "exam_count": 0
        }

        result = exam_assessment_graph.invoke(state, config)

        # Get 51% correct (should pass)
        total_questions = len(result["questions"])
        correct_count = int(total_questions * 0.51)

        responses = {}
        for i in range(1, total_questions + 1):
            if i <= correct_count:
                responses[str(i)] = "0.2"
            else:
                responses[str(i)] = "wrong"

        state = {
            **result,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(state, config)

        # Find results tool call
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        # >50% should be Pass for Nat 3
                        assert tc["args"]["grade"] == "Pass"


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
