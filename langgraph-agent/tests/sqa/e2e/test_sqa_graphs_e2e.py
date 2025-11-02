"""End-to-end tests for SQA Graphs system.

Tests realistic user journeys across all SQA levels and subjects with
complete workflows from start to finish.
"""

import pytest
from langgraph.checkpoint.memory import MemorySaver

from agent.sqa.graphs.question_practice import question_practice_graph
from agent.sqa.graphs.exam_assessment import exam_assessment_graph


# ============================================================================
# E2E Practice Session Tests
# ============================================================================

class TestE2EPracticeSessions:
    """Test complete practice sessions for all SQA levels."""

    @pytest.mark.e2e
    def test_nat5_maths_practice_session(self):
        """Test realistic Nat 5 Mathematics practice session.

        User journey:
        1. Student requests Nat 5 Maths practice on outcome MNU-5-01
        2. Completes 10 questions with mixed results
        3. Tracks streak and statistics
        4. Decides to stop after 10 questions
        """
        config = {"configurable": {"thread_id": "e2e_nat5_maths_practice"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "target_outcome": "MNU-5-01",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Simulate 10 questions with realistic performance (70% correct)
        expected_correct = 7
        correct_so_far = 0

        for i in range(10):
            # Fetch question
            result = question_practice_graph.invoke(state, config)

            assert "question" in result
            assert result["question"]["subject"] == "Mathematics"
            assert result["question"]["level"] == "Nat 5"
            assert result["question"]["outcome_id"] == "MNU-5-01"

            # Student answers (70% correct rate)
            is_correct_attempt = (i + 1) <= expected_correct
            user_answer = "0.2" if is_correct_attempt else "wrong answer"

            state = {
                **result,
                "user_answer": user_answer,
                "resume_data": {"continue": i < 9}  # Continue until last question
            }

            result = question_practice_graph.invoke(state, config)

            # Verify diagnosis
            if is_correct_attempt:
                assert result["result"] == "correct"
                correct_so_far += 1
            else:
                assert result["result"] == "wrong"
                assert result["gap_tags"] is not None
                assert result["remediation"] is not None

            # Verify statistics
            assert result["total_questions"] == i + 1
            assert result["correct_count"] == correct_so_far

            # Update state for next iteration
            state = {**result, "resume_data": {"continue": i < 9}}

        # Final checks
        assert state["total_questions"] == 10
        assert state["correct_count"] == 7
        assert len(state["used_question_ids"]) == 10

    @pytest.mark.e2e
    def test_higher_physics_targeted_practice(self):
        """Test Higher Physics practice targeting specific weak outcomes.

        User journey:
        1. Student identifies weakness in outcome PHY-H-03
        2. Practices 5 questions on that outcome
        3. All questions should match the target outcome
        """
        config = {"configurable": {"thread_id": "e2e_higher_physics_targeted"}}

        state = {
            "subject": "Physics",
            "level": "Higher",
            "target_outcome": "PHY-H-03",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        for i in range(5):
            result = question_practice_graph.invoke(state, config)

            # Verify outcome targeting
            assert result["question"]["outcome_id"] == "PHY-H-03"

            state = {
                **result,
                "user_answer": "0.2",
                "resume_data": {"continue": i < 4}
            }

            result = question_practice_graph.invoke(state, config)
            state = {**result, "resume_data": {"continue": i < 4}}

        assert state["total_questions"] == 5

    @pytest.mark.e2e
    def test_nat3_chemistry_beginner_session(self):
        """Test Nat 3 Chemistry practice for beginner.

        User journey:
        1. Beginner student starts Nat 3 Chemistry
        2. Gets many wrong initially
        3. Receives remediation each time
        4. Gradually improves
        """
        config = {"configurable": {"thread_id": "e2e_nat3_chemistry_beginner"}}

        state = {
            "subject": "Chemistry",
            "level": "Nat 3",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # First 3 wrong, then 2 correct (improvement)
        answers = ["wrong", "wrong", "wrong", "0.2", "0.2"]

        for i, answer in enumerate(answers):
            result = question_practice_graph.invoke(state, config)

            state = {
                **result,
                "user_answer": answer,
                "resume_data": {"continue": i < len(answers) - 1}
            }

            result = question_practice_graph.invoke(state, config)

            # Verify remediation was provided for wrong answers
            if answer == "wrong":
                assert result["remediation"] is not None
                assert len(result["gap_tags"]) > 0

            state = {**result, "resume_data": {"continue": i < len(answers) - 1}}

        # Final performance: 2/5 correct (40%)
        assert state["correct_count"] == 2
        assert state["total_questions"] == 5


# ============================================================================
# E2E Exam Assessment Tests
# ============================================================================

class TestE2EExamAssessment:
    """Test complete exam workflows for all SQA levels."""

    @pytest.mark.e2e
    def test_nat5_maths_full_exam(self):
        """Test complete Nat 5 Mathematics exam from generation to results.

        User journey:
        1. Student requests Nat 5 Maths mock exam
        2. Exam is generated with ~30 questions
        3. Student completes all questions
        4. Exam is marked
        5. Grade is calculated
        6. Remediation provided for weak areas
        7. Student declines another exam
        """
        config = {"configurable": {"thread_id": "e2e_nat5_maths_exam"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        # Generate and deliver exam
        result1 = exam_assessment_graph.invoke(state, config)

        exam = result1["exam_package"]
        questions = result1["questions"]

        # Verify exam structure
        assert exam["subject"] == "Mathematics"
        assert exam["level"] == "Nat 5"
        assert exam["total_marks"] > 60  # Realistic Nat 5 total
        assert len(questions) >= 20  # Realistic question count

        # Simulate realistic performance (65% - Grade B)
        correct_count = int(len(questions) * 0.65)
        responses = {}

        for i in range(1, len(questions) + 1):
            if i <= correct_count:
                responses[str(i)] = "0.2"  # Correct
            else:
                responses[str(i)] = "wrong answer"  # Wrong

        state = {
            **result1,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        # Mark and get results
        result2 = exam_assessment_graph.invoke(state, config)

        # Verify marking
        marking = result2["marking"]
        assert len(marking) == len(questions)

        # Verify grade calculation
        results_tool = None
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        results_tool = tc
                        break

        assert results_tool is not None
        assert 60 <= results_tool["args"]["percentage"] <= 70
        assert results_tool["args"]["grade"] == "B"

        # Verify gap analysis
        assert len(result2["gap_outcomes"]) > 0

    @pytest.mark.e2e
    def test_higher_physics_strong_performance(self):
        """Test Higher Physics exam with strong student performance.

        User journey:
        1. Strong student takes Higher Physics exam
        2. Scores 85% (Grade A)
        3. Minimal gaps identified
        4. Requests another exam immediately
        5. Completes second exam with 80% (still Grade A)
        6. Satisfied and exits
        """
        config = {"configurable": {"thread_id": "e2e_higher_physics_strong"}}

        state = {
            "subject": "Physics",
            "level": "Higher",
            "used_question_ids": [],
            "exam_count": 0
        }

        # First exam - 85% performance
        result1 = exam_assessment_graph.invoke(state, config)
        questions1 = result1["questions"]

        correct_count1 = int(len(questions1) * 0.85)
        responses1 = {
            str(i): "0.2" if i <= correct_count1 else "wrong"
            for i in range(1, len(questions1) + 1)
        }

        state = {
            **result1,
            "responses": responses1,
            "resume_data": {"next_exam": True}  # Request another
        }

        result1_complete = exam_assessment_graph.invoke(state, config)

        # Verify first exam results
        for msg in result1_complete["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["grade"] == "A"

        # Verify continuation
        assert result1_complete.get("should_continue") is True
        assert result1_complete["exam_count"] == 1

        # Second exam - 80% performance
        result2 = exam_assessment_graph.invoke(
            {**result1_complete, "resume_data": {"next_exam": True}},
            config
        )
        questions2 = result2["questions"]

        correct_count2 = int(len(questions2) * 0.80)
        responses2 = {
            str(i): "0.2" if i <= correct_count2 else "wrong"
            for i in range(1, len(questions2) + 1)
        }

        state = {
            **result2,
            "responses": responses2,
            "resume_data": {"next_exam": False}  # Stop after this
        }

        result2_complete = exam_assessment_graph.invoke(state, config)

        # Verify second exam results
        for msg in result2_complete["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["grade"] == "A"

        assert result2_complete.get("should_continue") is False

    @pytest.mark.e2e
    def test_nat4_biology_struggling_student(self):
        """Test Nat 4 Biology exam with struggling student.

        User journey:
        1. Student struggles with Nat 4 Biology
        2. First exam: 35% (Fail)
        3. Reviews remediation
        4. Takes another exam: 55% (Pass)
        5. Satisfied with improvement
        """
        config = {"configurable": {"thread_id": "e2e_nat4_biology_struggling"}}

        state = {
            "subject": "Biology",
            "level": "Nat 4",
            "used_question_ids": [],
            "exam_count": 0
        }

        # First exam - 35% (Fail)
        result1 = exam_assessment_graph.invoke(state, config)
        questions1 = result1["questions"]

        correct_count1 = int(len(questions1) * 0.35)
        responses1 = {
            str(i): "0.2" if i <= correct_count1 else "wrong"
            for i in range(1, len(questions1) + 1)
        }

        state = {
            **result1,
            "responses": responses1,
            "resume_data": {"next_exam": True}
        }

        result1_complete = exam_assessment_graph.invoke(state, config)

        # Verify first exam failed
        for msg in result1_complete["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["grade"] == "Fail"

        # Significant gaps should be identified
        assert len(result1_complete["gap_outcomes"]) > 0

        # Second exam - 55% (Pass) - improvement after remediation
        result2 = exam_assessment_graph.invoke(
            {**result1_complete, "resume_data": {"next_exam": True}},
            config
        )
        questions2 = result2["questions"]

        correct_count2 = int(len(questions2) * 0.55)
        responses2 = {
            str(i): "0.2" if i <= correct_count2 else "wrong"
            for i in range(1, len(questions2) + 1)
        }

        state = {
            **result2,
            "responses": responses2,
            "resume_data": {"next_exam": False}
        }

        result2_complete = exam_assessment_graph.invoke(state, config)

        # Verify second exam passed
        for msg in result2_complete["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["grade"] == "Pass"

    @pytest.mark.e2e
    def test_advanced_higher_chemistry_comprehensive(self):
        """Test Advanced Higher Chemistry full workflow.

        User journey:
        1. Advanced student takes full exam
        2. Exam has high question count and marks
        3. Complex grading boundaries
        4. Detailed outcome breakdown
        """
        config = {"configurable": {"thread_id": "e2e_adv_higher_chemistry"}}

        state = {
            "subject": "Chemistry",
            "level": "Advanced Higher",
            "used_question_ids": [],
            "exam_count": 0
        }

        result1 = exam_assessment_graph.invoke(state, config)

        exam = result1["exam_package"]
        questions = result1["questions"]

        # Advanced Higher exams are comprehensive
        assert len(questions) >= 25

        # Simulate 72% performance (Grade A)
        correct_count = int(len(questions) * 0.72)
        responses = {
            str(i): "0.2" if i <= correct_count else "wrong"
            for i in range(1, len(questions) + 1)
        }

        state = {
            **result1,
            "responses": responses,
            "resume_data": {"next_exam": False}
        }

        result2 = exam_assessment_graph.invoke(state, config)

        # Verify comprehensive marking
        assert len(result2["marking"]) == len(questions)

        # Verify grade
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["grade"] == "A"


# ============================================================================
# E2E Edge Cases
# ============================================================================

class TestE2EEdgeCases:
    """Test edge cases in realistic scenarios."""

    @pytest.mark.e2e
    def test_perfect_score_journey(self):
        """Test student getting 100% on exam."""
        config = {"configurable": {"thread_id": "e2e_perfect_score"}}

        state = {
            "subject": "Mathematics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        result1 = exam_assessment_graph.invoke(state, config)

        # All correct answers
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

        # Verify 100% and Grade A
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["percentage"] == 100.0
                        assert tc["args"]["grade"] in ["A", "Pass"]

        # No gaps
        assert len(result2["gap_outcomes"]) == 0

    @pytest.mark.e2e
    def test_zero_score_journey(self):
        """Test student getting 0% on exam."""
        config = {"configurable": {"thread_id": "e2e_zero_score"}}

        state = {
            "subject": "Physics",
            "level": "Nat 5",
            "used_question_ids": [],
            "exam_count": 0
        }

        result1 = exam_assessment_graph.invoke(state, config)

        # All wrong answers
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

        # Verify 0% and failing grade
        for msg in result2["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "ShowExamResultsTool":
                        assert tc["args"]["percentage"] == 0.0
                        assert tc["args"]["grade"] in ["No Award", "Fail"]

        # All outcomes should be gaps
        assert len(result2["gap_outcomes"]) > 0

    @pytest.mark.e2e
    def test_marathon_practice_session(self):
        """Test extended practice session (50 questions)."""
        config = {"configurable": {"thread_id": "e2e_marathon"}}

        state = {
            "subject": "Mathematics",
            "level": "Higher",
            "used_question_ids": [],
            "total_questions": 0,
            "correct_count": 0,
            "streak": 0
        }

        # Answer 50 questions
        for i in range(50):
            result = question_practice_graph.invoke(state, config)

            # Realistic performance: 75% correct
            is_correct = (i % 4) != 3  # 3 out of 4 correct

            state = {
                **result,
                "user_answer": "0.2" if is_correct else "wrong",
                "resume_data": {"continue": i < 49}
            }

            result = question_practice_graph.invoke(state, config)
            state = {**result, "resume_data": {"continue": i < 49}}

        # Verify statistics
        assert state["total_questions"] == 50
        # Should be close to 75% (37-38 correct)
        assert 36 <= state["correct_count"] <= 39

        # All questions should be unique
        assert len(state["used_question_ids"]) == 50

    @pytest.mark.e2e
    def test_multi_subject_student_day(self):
        """Simulate student practicing multiple subjects in one day."""
        subjects = [
            ("Mathematics", "Nat 5", 10),
            ("Physics", "Nat 5", 8),
            ("Chemistry", "Nat 5", 7)
        ]

        for idx, (subject, level, question_count) in enumerate(subjects):
            config = {
                "configurable": {
                    "thread_id": f"e2e_multi_subject_{idx}"
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

            for i in range(question_count):
                result = question_practice_graph.invoke(state, config)

                assert result["question"]["subject"] == subject

                state = {
                    **result,
                    "user_answer": "0.2",
                    "resume_data": {"continue": i < question_count - 1}
                }

                result = question_practice_graph.invoke(state, config)
                state = {**result, "resume_data": {"continue": i < question_count - 1}}

            assert state["total_questions"] == question_count


# ============================================================================
# E2E Cross-Level Tests
# ============================================================================

class TestE2ECrossLevel:
    """Test scenarios across all SQA levels."""

    @pytest.mark.e2e
    def test_all_levels_maths_practice(self):
        """Test Mathematics practice across all levels."""
        levels = ["Nat 3", "Nat 4", "Nat 5", "Higher", "Advanced Higher"]

        for idx, level in enumerate(levels):
            config = {
                "configurable": {
                    "thread_id": f"e2e_all_levels_{idx}"
                }
            }

            state = {
                "subject": "Mathematics",
                "level": level,
                "used_question_ids": [],
                "total_questions": 0,
                "correct_count": 0,
                "streak": 0
            }

            # Do 5 questions per level
            for i in range(5):
                result = question_practice_graph.invoke(state, config)

                assert result["question"]["level"] == level

                state = {
                    **result,
                    "user_answer": "0.2",
                    "resume_data": {"continue": i < 4}
                }

                result = question_practice_graph.invoke(state, config)
                state = {**result, "resume_data": {"continue": i < 4}}

            assert state["total_questions"] == 5

    @pytest.mark.e2e
    def test_all_levels_exam_generation(self):
        """Test exam generation works for all levels."""
        levels = ["Nat 3", "Nat 4", "Nat 5", "Higher", "Advanced Higher"]

        for idx, level in enumerate(levels):
            config = {
                "configurable": {
                    "thread_id": f"e2e_exam_all_levels_{idx}"
                }
            }

            state = {
                "subject": "Physics",
                "level": level,
                "used_question_ids": [],
                "exam_count": 0
            }

            result = exam_assessment_graph.invoke(state, config)

            # Verify exam was generated
            assert result["exam_package"]["level"] == level
            assert len(result["questions"]) > 0

            # Verify grading system matches level
            responses = {
                str(i): "0.2"
                for i in range(1, len(result["questions"]) + 1)
            }

            state = {
                **result,
                "responses": responses,
                "resume_data": {"next_exam": False}
            }

            result2 = exam_assessment_graph.invoke(state, config)

            # Check appropriate grading for level
            for msg in result2["messages"]:
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        if tc["name"] == "ShowExamResultsTool":
                            grade = tc["args"]["grade"]
                            if level in ["Nat 3", "Nat 4"]:
                                assert grade in ["Pass", "Fail"]
                            else:
                                assert grade in ["A", "B", "C", "D", "No Award"]


# ============================================================================
# Pytest Configuration
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
