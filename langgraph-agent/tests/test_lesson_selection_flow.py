"""
Test suite for Lesson Selection Flow implementation.

Tests the complete flow: Recommendations → User Selection → Teaching Loop
"""

import pytest
from typing import Dict, Any

from src.agent.graph_interrupt import lead_teacher_node
from src.agent.course_manager_utils import (
    extract_recommendations_from_state,
    create_lesson_selection_context
)


class TestLessonSelectionFlow:
    """Test lesson selection and transition to teaching loop."""

    @pytest.mark.asyncio
    async def test_lesson_selection_with_existing_thread_id(self):
        """Test that lesson selection maintains the same thread ID."""
        # ARRANGE - State after recommendations are ready
        recommendations_state = {
            "thread_id": "lesson_selection_thread_001",
            "student_id": "stu_123",
            "course_id": "course_c84473",
            "mode": "planning",
            "orchestration_phase": "recommendations_ready",
            "routing_decision": "complete",
            "recommendations_ready": True,
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_algebra_1",
                        "title": "Linear Equations",
                        "priorityScore": 0.92,
                        "reasons": ["foundational", "overdue"]
                    },
                    {
                        "lessonTemplateId": "lt_geometry_1",
                        "title": "Basic Shapes",
                        "priorityScore": 0.78,
                        "reasons": ["recent_activity"]
                    }
                ]
            }
        }

        # ACT - User selects a lesson (simulate frontend action)
        selected_lesson_id = "lt_algebra_1"
        lesson_context = create_lesson_selection_context(selected_lesson_id, recommendations_state)

        # Create new state with lesson selection
        selection_state = {
            **recommendations_state,
            "session_context": {
                **recommendations_state.get("session_context", {}),
                **lesson_context
            },
            "mode": "teaching"
        }

        # Lead Teacher processes lesson selection
        result = await lead_teacher_node(selection_state)

        # ASSERT - Thread ID maintained throughout selection
        assert result["thread_id"] == "lesson_selection_thread_001"
        assert result["routing_decision"] == "teaching"
        assert result["next_action"] == "start_lesson"
        assert result["teaching_status"] == "started"

        # Verify lesson selection context preserved
        lesson_selection = result["session_context"]["lesson_selection"]
        assert lesson_selection["lessonTemplateId"] == "lt_algebra_1"
        assert lesson_selection["metadata"]["title"] == "Linear Equations"
        assert lesson_selection["metadata"]["priority_score"] == 0.92

    @pytest.mark.asyncio
    async def test_complete_recommendations_to_teaching_flow(self):
        """Test complete flow from recommendations through selection to teaching."""
        # ARRANGE - Initial planning state
        initial_state = {
            "thread_id": "complete_flow_thread",
            "student_id": "stu_123",
            "course_id": "course_c84473",
            "mode": "planning",
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Mathematics"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {"$id": "lt_1", "title": "Lesson 1", "status": "published"},
                    {"$id": "lt_2", "title": "Lesson 2", "status": "published"}
                ]
            }
        }

        # ACT - Step 1: Get recommendations (simulate Course Manager completion)
        recommendations_result = await lead_teacher_node(initial_state)

        # Simulate Course Manager adding recommendations
        state_with_recommendations = {
            **recommendations_result,
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_1",
                        "title": "Algebra Fundamentals",
                        "priorityScore": 0.85,
                        "reasons": ["foundational"]
                    }
                ]
            }
        }

        # Step 2: Process recommendations
        final_recommendations = await lead_teacher_node(state_with_recommendations)

        # ASSERT - Recommendations ready
        assert final_recommendations["routing_decision"] == "complete"
        assert final_recommendations["recommendations_ready"] is True

        # ACT - Step 3: User selects lesson
        selected_lesson = "lt_1"
        lesson_context = create_lesson_selection_context(selected_lesson, final_recommendations)

        selection_state = {
            **final_recommendations,
            "session_context": {
                **final_recommendations["session_context"],
                **lesson_context
            },
            "mode": "teaching"
        }

        # Step 4: Process lesson selection
        teaching_result = await lead_teacher_node(selection_state)

        # ASSERT - Complete flow successful
        assert teaching_result["thread_id"] == "complete_flow_thread"  # Thread continuity
        assert teaching_result["routing_decision"] == "teaching"
        assert teaching_result["teaching_status"] == "started"
        assert teaching_result["next_action"] == "start_lesson"

        # Verify lesson context passed correctly
        assert teaching_result["session_context"]["lesson_selection"]["lessonTemplateId"] == "lt_1"
        assert teaching_result["session_context"]["mode"] == "teaching"

    @pytest.mark.asyncio
    async def test_lesson_selection_preserves_recommendation_context(self):
        """Test that lesson selection preserves context from original recommendations."""
        # ARRANGE - Rich recommendation state
        recommendations_state = {
            "thread_id": "context_preservation_thread",
            "student_id": "stu_456",
            "course_id": "course_math_101",
            "custom_field": "preserve_me",
            "session_context": {
                "original_request": "get_recommendations",
                "course": {"courseId": "course_math_101", "subject": "Mathematics"},
                "student": {"id": "stu_456", "level": "beginner"}
            },
            "course_recommendation": {
                "courseId": "course_math_101",
                "graphRunId": "recommendation_run_123",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_basics_1",
                        "title": "Math Basics",
                        "priorityScore": 0.95,
                        "reasons": ["beginner_friendly", "foundational"]
                    }
                ],
                "rubric": "Prioritized for beginner students"
            },
            "messages": [{"content": "I need help with math", "role": "user"}],
            "recommendations_ready": True
        }

        # ACT - Create lesson selection context
        lesson_context = create_lesson_selection_context("lt_basics_1", recommendations_state)

        # Create selection state
        selection_state = {
            **recommendations_state,
            "session_context": {
                **recommendations_state["session_context"],
                **lesson_context
            },
            "mode": "teaching"
        }

        # Process lesson selection
        result = await lead_teacher_node(selection_state)

        # ASSERT - All context preserved
        assert result["thread_id"] == "context_preservation_thread"
        assert result["student_id"] == "stu_456"
        assert result["course_id"] == "course_math_101"
        assert result["custom_field"] == "preserve_me"

        # Original session context preserved
        assert result["session_context"]["original_request"] == "get_recommendations"
        assert result["session_context"]["course"]["subject"] == "Mathematics"
        assert result["session_context"]["student"]["level"] == "beginner"

        # Lesson selection context added
        assert result["session_context"]["lesson_selection"]["lessonTemplateId"] == "lt_basics_1"
        assert result["session_context"]["lesson_selection"]["metadata"]["priority_score"] == 0.95

        # Original course recommendation still available
        assert result["course_recommendation"]["graphRunId"] == "recommendation_run_123"
        assert result["course_recommendation"]["rubric"] == "Prioritized for beginner students"

        # Messages preserved
        assert len(result["messages"]) >= 1
        assert result["messages"][0]["content"] == "I need help with math"

    @pytest.mark.asyncio
    async def test_lesson_selection_invalid_lesson_id(self):
        """Test lesson selection with lesson ID not in recommendations."""
        # ARRANGE - State with specific candidates
        recommendations_state = {
            "thread_id": "invalid_lesson_thread",
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {"lessonTemplateId": "lt_valid_1", "title": "Valid Lesson 1", "priorityScore": 0.8},
                    {"lessonTemplateId": "lt_valid_2", "title": "Valid Lesson 2", "priorityScore": 0.7}
                ]
            },
            "recommendations_ready": True
        }

        # ACT - Try to select lesson not in candidates
        invalid_lesson_id = "lt_nonexistent"
        lesson_context = create_lesson_selection_context(invalid_lesson_id, recommendations_state)

        # ASSERT - Context created but without metadata (lesson not found)
        assert lesson_context["lesson_selection"]["lessonTemplateId"] == "lt_nonexistent"
        assert "metadata" not in lesson_context["lesson_selection"]
        assert lesson_context["mode"] == "teaching"
        assert lesson_context["course_id"] == "course_c84473"

        # Create selection state and test Lead Teacher handles it
        selection_state = {
            **recommendations_state,
            "session_context": lesson_context,
            "mode": "teaching"
        }

        result = await lead_teacher_node(selection_state)

        # ASSERT - Lead Teacher still routes to teaching (graceful handling)
        assert result["routing_decision"] == "teaching"
        assert result["teaching_status"] == "started"
        assert result["session_context"]["lesson_selection"]["lessonTemplateId"] == "lt_nonexistent"

    @pytest.mark.asyncio
    async def test_multiple_lesson_selections_same_thread(self):
        """Test multiple lesson selections on the same thread (user changes mind)."""
        # ARRANGE - Base recommendations state
        base_state = {
            "thread_id": "multi_selection_thread",
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {"lessonTemplateId": "lt_option_1", "title": "Option 1", "priorityScore": 0.9},
                    {"lessonTemplateId": "lt_option_2", "title": "Option 2", "priorityScore": 0.8}
                ]
            },
            "recommendations_ready": True
        }

        # ACT - First selection
        first_context = create_lesson_selection_context("lt_option_1", base_state)
        first_selection_state = {
            **base_state,
            "session_context": first_context,
            "mode": "teaching"
        }

        first_result = await lead_teacher_node(first_selection_state)

        # ASSERT - First selection processed
        assert first_result["session_context"]["lesson_selection"]["lessonTemplateId"] == "lt_option_1"
        assert first_result["routing_decision"] == "teaching"

        # ACT - Second selection (user changes mind)
        second_context = create_lesson_selection_context("lt_option_2", base_state)
        second_selection_state = {
            **base_state,
            "session_context": second_context,
            "mode": "teaching"
        }

        second_result = await lead_teacher_node(second_selection_state)

        # ASSERT - Second selection processed, same thread
        assert second_result["thread_id"] == "multi_selection_thread"
        assert second_result["session_context"]["lesson_selection"]["lessonTemplateId"] == "lt_option_2"
        assert second_result["routing_decision"] == "teaching"

    @pytest.mark.asyncio
    async def test_lesson_selection_session_id_generation(self):
        """Test that lesson selection generates properly formatted session IDs."""
        import time

        # ARRANGE
        recommendations_state = {
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [{"lessonTemplateId": "lt_1", "title": "Test", "priorityScore": 0.8}]
            }
        }

        # ACT - Create lesson context
        context1 = create_lesson_selection_context("lt_1", recommendations_state)

        # Small delay to ensure different timestamps
        time.sleep(0.001)

        context2 = create_lesson_selection_context("lt_1", recommendations_state)

        # ASSERT - Session IDs have correct format
        session_id_1 = context1["lesson_selection"]["sessionId"]
        session_id_2 = context2["lesson_selection"]["sessionId"]

        assert session_id_1.startswith("sess_")
        assert session_id_2.startswith("sess_")

        # Should have timestamp format: sess_YYYYMMDD_HHMMSS
        assert len(session_id_1) == len("sess_20250921_230349")
        assert len(session_id_2) == len("sess_20250921_230349")

        # Both should have same lesson template
        assert context1["lesson_selection"]["lessonTemplateId"] == "lt_1"
        assert context2["lesson_selection"]["lessonTemplateId"] == "lt_1"


class TestLessonSelectionErrorHandling:
    """Test error handling in lesson selection flow."""

    @pytest.mark.asyncio
    async def test_lesson_selection_with_empty_recommendations(self):
        """Test lesson selection when no recommendations are available."""
        # ARRANGE - State with empty recommendations
        empty_state = {
            "thread_id": "empty_rec_thread",
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": []
            },
            "recommendations_ready": True
        }

        # ACT - Try to select lesson from empty recommendations
        lesson_context = create_lesson_selection_context("lt_any", empty_state)

        # ASSERT - Context created but no metadata
        assert lesson_context["lesson_selection"]["lessonTemplateId"] == "lt_any"
        assert "metadata" not in lesson_context["lesson_selection"]

        # Test Lead Teacher handles empty selection gracefully
        selection_state = {
            **empty_state,
            "session_context": lesson_context,
            "mode": "teaching"
        }

        result = await lead_teacher_node(selection_state)
        assert result["routing_decision"] == "teaching"

    @pytest.mark.asyncio
    async def test_lesson_selection_missing_course_recommendation(self):
        """Test lesson selection when course_recommendation is missing entirely."""
        # ARRANGE - State without course_recommendation
        missing_rec_state = {
            "thread_id": "missing_rec_thread",
            "recommendations_ready": False
        }

        # ACT - Create lesson context without recommendations
        lesson_context = create_lesson_selection_context("lt_test", missing_rec_state)

        # ASSERT - Basic context created
        assert lesson_context["lesson_selection"]["lessonTemplateId"] == "lt_test"
        assert lesson_context["mode"] == "teaching"
        assert "course_id" not in lesson_context  # Not set when missing

        # Test Lead Teacher handles missing recommendations
        selection_state = {
            **missing_rec_state,
            "session_context": lesson_context,
            "mode": "teaching"
        }

        result = await lead_teacher_node(selection_state)
        assert result["routing_decision"] == "teaching"
        assert result["teaching_status"] == "started"