"""Unit tests for ExamAssessmentGraph nodes.

Tests individual node functions since the graph uses interrupt-based flow.
For full graph testing with interrupts, see integration tests.
"""

import pytest
from agent.sqa.graphs.exam_assessment import (
    build_blueprint_node,
    fill_slots_node,
    assemble_exam_node,
    deliver_exam_node,
    mark_exam_node,
    show_results_node,
    check_next_exam_node,
    get_sqa_grade,
    exam_assessment_graph
)


class TestBuildBlueprintNode:
    """Test the build_blueprint_node."""

    def test_build_blueprint_nat5(self):
        """Test blueprint creation for Nat 5."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5"
        }

        result = build_blueprint_node(state)

        assert "blueprint" in result
        blueprint = result["blueprint"]

        assert isinstance(blueprint, list)
        assert len(blueprint) > 0

        # Check blueprint structure
        for slot in blueprint:
            assert "section" in slot
            assert "outcome_id" in slot
            assert "marks" in slot
            assert slot["marks"] > 0

    def test_blueprint_different_subjects(self):
        """Test blueprint for different subjects."""
        subjects = [("Mathematics", "Nat 5"), ("Physics", "Higher")]

        for subject, level in subjects:
            state = {"subject": subject, "level": level}
            result = build_blueprint_node(state)

            assert len(result["blueprint"]) > 0


class TestFillSlotsNode:
    """Test the fill_slots_node."""

    def test_fill_all_slots(self):
        """Test that all blueprint slots are filled."""
        # First build blueprint
        blueprint_state = {"subject": "Mathematics", "level": "Nat 5"}
        blueprint_result = build_blueprint_node(blueprint_state)

        # Then fill slots
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "blueprint": blueprint_result["blueprint"],
            "used_question_ids": []
        }

        result = fill_slots_node(state)

        assert "questions" in result
        assert "used_question_ids" in result

        # Should have same number of questions as blueprint slots
        assert len(result["questions"]) == len(state["blueprint"])

        # Check questions are valid
        for question in result["questions"]:
            assert "id" in question
            assert "text" in question
            assert "marks" in question
            assert "outcome_id" in question

    def test_marks_match_blueprint(self):
        """Test that question marks match blueprint."""
        blueprint_state = {"subject": "Physics", "level": "Nat 5"}
        blueprint_result = build_blueprint_node(blueprint_state)

        state = {
            "subject": "Physics",
            "level": "Nat 5",
            "blueprint": blueprint_result["blueprint"],
            "used_question_ids": []
        }

        result = fill_slots_node(state)

        # Check marks match
        for i, question in enumerate(result["questions"]):
            expected_marks = state["blueprint"][i]["marks"]
            assert question["marks"] == expected_marks


class TestAssembleExamNode:
    """Test the assemble_exam_node."""

    def test_assemble_basic_exam(self):
        """Test basic exam assembly."""
        # Setup with questions
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "questions": [
                {
                    "id": "q1",
                    "text": "Question 1",
                    "marks": 5,
                    "outcome_id": "MNU-5-01"
                },
                {
                    "id": "q2",
                    "text": "Question 2",
                    "marks": 4,
                    "outcome_id": "MNU-5-02"
                }
            ],
            "blueprint": [
                {"section": "Paper 1", "outcome_id": "MNU-5-01", "marks": 5},
                {"section": "Paper 1", "outcome_id": "MNU-5-02", "marks": 4}
            ],
            "exam_count": 0
        }

        result = assemble_exam_node(state)

        assert "exam_package" in result
        exam = result["exam_package"]

        assert "exam_id" in exam
        assert "total_marks" in exam
        assert exam["total_marks"] == 9  # 5 + 4
        assert "question_count" in exam
        assert exam["question_count"] == 2
        assert "sections" in exam

    def test_time_calculation(self):
        """Test exam time is calculated correctly."""
        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "questions": [{"id": "q1", "marks": 60}],  # 60 marks
            "blueprint": [{"section": "Paper 1", "outcome_id": "MNU-5-01", "marks": 60}],
            "exam_count": 0
        }

        result = assemble_exam_node(state)
        exam = result["exam_package"]

        # Should be ~90 minutes (60 * 1.5)
        assert "time_allowed_minutes" in exam
        assert 85 <= exam["time_allowed_minutes"] <= 95


class TestDeliverExamNode:
    """Test the deliver_exam_node."""

    def test_deliver_generates_tool_call(self):
        """Test that delivery generates tool call."""
        state = {
            "exam_package": {
                "exam_id": "test_exam_1",
                "subject": "Mathematics",
                "level": "Nat 5",
                "total_marks": 90,
                "time_allowed_minutes": 135,
                "sections": {},
                "question_count": 30,
                "instructions": "Test instructions"
            },
            "questions": []
        }

        result = deliver_exam_node(state)

        assert "messages" in result
        assert len(result["messages"]) == 1

        message = result["messages"][0]
        assert hasattr(message, "tool_calls")

        tool_call = message.tool_calls[0]
        assert tool_call["name"] == "DeliverExamTool"
        assert tool_call["args"]["exam_id"] == "test_exam_1"


class TestMarkExamNode:
    """Test the mark_exam_node."""

    def test_mark_all_correct(self):
        """Test marking when all answers correct."""
        state = {
            "questions": [
                {
                    "id": "q1",
                    "text": "2/10 as decimal",
                    "marks": 1,
                    "outcome_id": "MNU-5-01",
                    "marking_scheme": {
                        "criteria": [{"step": "Convert", "marks": 1}],
                        "total_marks": 1
                    }
                }
            ],
            "responses": {
                "1": "0.2"  # Correct answer
            }
        }

        result = mark_exam_node(state)

        assert "marking" in result
        assert "gap_outcomes" in result

        marking = result["marking"]
        assert "1" in marking
        assert marking["1"]["correct"] is True
        assert marking["1"]["marks_awarded"] == 1

        # No gaps since all correct
        assert len(result["gap_outcomes"]) == 0

    def test_mark_some_wrong(self):
        """Test marking when some answers wrong."""
        state = {
            "questions": [
                {
                    "id": "q1",
                    "text": "Question 1",
                    "marks": 2,
                    "outcome_id": "MNU-5-01",
                    "marking_scheme": {
                        "criteria": [{"step": "Step", "marks": 2}],
                        "total_marks": 2
                    }
                },
                {
                    "id": "q2",
                    "text": "Question 2",
                    "marks": 3,
                    "outcome_id": "MNU-5-02",
                    "marking_scheme": {
                        "criteria": [{"step": "Step", "marks": 3}],
                        "total_marks": 3
                    }
                }
            ],
            "responses": {
                "1": "0.2",  # Correct
                "2": "wrong answer"  # Wrong
            }
        }

        result = mark_exam_node(state)

        marking = result["marking"]

        # Q1 correct
        assert marking["1"]["correct"] is True
        # Q2 wrong
        assert marking["2"]["correct"] is False

        # Should have gap outcomes
        assert len(result["gap_outcomes"]) == 1
        assert "MNU-5-02" in result["gap_outcomes"]


class TestShowResultsNode:
    """Test the show_results_node."""

    def test_show_results_tool_call(self):
        """Test that results generate tool call."""
        state = {
            "exam_package": {"exam_id": "test_exam_1"},
            "marking": {
                "1": {
                    "question_id": "q1",
                    "correct": True,
                    "marks_available": 5,
                    "marks_awarded": 5,
                    "gap_tags": []
                }
            },
            "gap_outcomes": [],
            "questions": [
                {"id": "q1", "outcome_id": "MNU-5-01"}
            ],
            "level": "Nat 5"
        }

        result = show_results_node(state)

        assert "messages" in result
        assert len(result["messages"]) == 1

        tool_call = result["messages"][0].tool_calls[0]
        assert tool_call["name"] == "ShowExamResultsTool"
        assert "percentage" in tool_call["args"]
        assert "grade" in tool_call["args"]


class TestCheckNextExamNode:
    """Test the check_next_exam_node."""

    def test_next_exam_true(self):
        """Test when user wants next exam."""
        state = {
            "resume_data": {"next_exam": True},
            "exam_count": 2
        }

        result = check_next_exam_node(state)

        assert result["should_continue"] is True
        assert result["exam_count"] == 3  # Incremented

    def test_next_exam_false(self):
        """Test when user doesn't want next exam."""
        state = {
            "resume_data": {"next_exam": False},
            "exam_count": 1
        }

        result = check_next_exam_node(state)

        assert result["should_continue"] is False
        # Count should not increment
        assert result["exam_count"] == 1


class TestSQAGrading:
    """Test the SQA grading helper function."""

    def test_grade_nat5(self):
        """Test Nat 5 grading boundaries."""
        assert get_sqa_grade(75, "Nat 5") == "A"
        assert get_sqa_grade(65, "Nat 5") == "B"
        assert get_sqa_grade(55, "Nat 5") == "C"
        assert get_sqa_grade(48, "Nat 5") == "D"
        assert get_sqa_grade(40, "Nat 5") == "No Award"

    def test_grade_higher(self):
        """Test Higher grading."""
        assert get_sqa_grade(80, "Higher") == "A"
        assert get_sqa_grade(60, "Higher") == "B"

    def test_grade_nat3_pass_fail(self):
        """Test Nat 3/4 pass/fail."""
        assert get_sqa_grade(50, "Nat 3") == "Pass"
        assert get_sqa_grade(49, "Nat 3") == "Fail"

    def test_grade_boundaries(self):
        """Test exact grade boundaries."""
        assert get_sqa_grade(70.0, "Nat 5") == "A"
        assert get_sqa_grade(69.9, "Nat 5") == "B"


class TestGraphCompilation:
    """Test graph structure and compilation."""

    def test_graph_compiles(self):
        """Test that graph compiles without errors."""
        assert exam_assessment_graph is not None

    def test_graph_has_checkpointer(self):
        """Test that graph has checkpointer configured."""
        assert hasattr(exam_assessment_graph, "checkpointer")
        assert exam_assessment_graph.checkpointer is not None


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
