"""
Integration tests for state reading API with Lead Teacher node.

Tests the complete workflow: Lead Teacher → State Reading → Lesson Selection
"""

import pytest
from typing import Dict, Any

from src.agent.graph_interrupt import lead_teacher_node
from src.agent.course_manager_utils import (
    extract_recommendations_from_state,
    get_thread_readiness_status,
    validate_thread_for_state_reading,
    create_lesson_selection_context
)


class TestStateReadingWithLeadTeacher:
    """Integration tests combining Lead Teacher with state reading utilities."""

    @pytest.mark.asyncio
    async def test_complete_state_reading_workflow_with_lead_teacher(self):
        """Test full workflow: Lead Teacher → extract recommendations → create context."""
        # ARRANGE - Initial state for Lead Teacher to generate recommendations
        initial_state = {
            "thread_id": "integration_test_thread_001",
            "student_id": "stu_123",
            "course_id": "course_c84473",
            "mode": "planning",
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {
                        "$id": "lt_algebra_1",
                        "title": "Linear Equations",
                        "status": "published",
                        "outcomeRefs": ["O1.2"]
                    }
                ],
                "constraints": {"maxBlockMinutes": 25}
            },
            "messages": []
        }

        # ACT - Step 1: Lead Teacher processes and routes to Course Manager
        lead_teacher_result = await lead_teacher_node(initial_state)

        # ASSERT - Lead Teacher routed correctly
        assert lead_teacher_result["routing_decision"] == "course_manager"
        assert lead_teacher_result["orchestration_phase"] == "requesting_recommendations"
        assert lead_teacher_result["thread_id"] == "integration_test_thread_001"

        # SIMULATE - Course Manager completion with recommendations
        # (In real system, this would happen in the Course Manager subgraph)
        completed_state = {
            **lead_teacher_result,
            "course_recommendation": {
                "courseId": "course_c84473",
                "graphRunId": "course_manager_run_789",
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
                ],
                "rubric": "Prioritized by learning objectives",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }

        # ACT - Step 2: Lead Teacher handles completed recommendations
        final_state = await lead_teacher_node(completed_state)

        # ASSERT - Lead Teacher completed with direct state return
        assert final_state["routing_decision"] == "complete"
        assert final_state["orchestration_phase"] == "recommendations_ready"
        assert final_state["recommendations_ready"] is True

        # ACT - Step 3: Extract recommendations using state reading API
        recommendations = extract_recommendations_from_state(final_state)

        # ASSERT - Recommendations extracted correctly
        assert recommendations["available"] is True
        assert len(recommendations["candidates"]) == 2
        assert recommendations["recommendations_ready"] is True
        assert recommendations["thread_id"] == "integration_test_thread_001"
        assert recommendations["candidates"][0]["lessonTemplateId"] == "lt_algebra_1"
        assert recommendations["metadata"]["course_id"] == "course_c84473"
        assert "summary" in recommendations["metadata"]

        # ACT - Step 4: Check thread readiness
        readiness = get_thread_readiness_status(final_state)

        # ASSERT - Thread ready for lesson selection
        assert readiness["recommendations_ready"] is True
        assert readiness["can_select_lesson"] is True
        assert readiness["teaching_active"] is False

        # ACT - Step 5: User selects lesson (simulate frontend action)
        selected_lesson_id = "lt_algebra_1"
        lesson_context = create_lesson_selection_context(selected_lesson_id, final_state)

        # ASSERT - Lesson context created correctly
        assert lesson_context["lesson_selection"]["lessonTemplateId"] == "lt_algebra_1"
        assert lesson_context["mode"] == "teaching"
        assert lesson_context["course_id"] == "course_c84473"
        assert lesson_context["lesson_selection"]["metadata"]["title"] == "Linear Equations"
        assert lesson_context["lesson_selection"]["metadata"]["priority_score"] == 0.92

        # ACT - Step 6: Continue with selected lesson (Lead Teacher handles teaching)
        teaching_state = {
            **final_state,
            "session_context": {
                **final_state["session_context"],
                **lesson_context
            },
            "mode": "teaching"
        }

        teaching_result = await lead_teacher_node(teaching_state)

        # ASSERT - Lead Teacher routes to teaching loop correctly
        assert teaching_result["routing_decision"] == "teaching"
        assert teaching_result["next_action"] == "start_lesson"
        assert teaching_result["teaching_status"] == "started"

    @pytest.mark.asyncio
    async def test_state_reading_with_empty_recommendations(self):
        """Test state reading when Course Manager returns no candidates."""
        # ARRANGE - State with empty recommendations from Course Manager
        state_with_empty_recommendations = {
            "thread_id": "empty_recommendations_thread",
            "orchestration_phase": "recommendations_ready",
            "recommendations_ready": True,
            "routing_decision": "complete",
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [],
                "rubric": "No suitable candidates found",
                "graphRunId": "course_manager_empty_123"
            }
        }

        # ACT - Extract recommendations
        recommendations = extract_recommendations_from_state(state_with_empty_recommendations)

        # ASSERT - Handles empty recommendations gracefully
        assert recommendations["available"] is False
        assert len(recommendations["candidates"]) == 0
        assert recommendations["recommendations_ready"] is True
        assert recommendations["metadata"]["total_candidates"] == 0

        # ACT - Check readiness
        readiness = get_thread_readiness_status(state_with_empty_recommendations)

        # ASSERT - Cannot select lesson when no candidates
        assert readiness["recommendations_ready"] is True
        assert readiness["can_select_lesson"] is False

    @pytest.mark.asyncio
    async def test_error_handling_in_state_reading_workflow(self):
        """Test error handling throughout the state reading workflow."""
        # Test 1: Invalid thread ID
        invalid_thread_validation = validate_thread_for_state_reading("")
        assert invalid_thread_validation["valid"] is False
        assert "Thread ID is required" in invalid_thread_validation["error"]

        # Test 2: Malformed state
        malformed_state = {
            "thread_id": "valid_thread",
            "course_recommendation": "not_a_dict"  # Should be dictionary
        }

        recommendations = extract_recommendations_from_state(malformed_state)
        assert recommendations["available"] is False
        assert len(recommendations["candidates"]) == 0

        # Test 3: Missing lesson in selection context
        state_with_candidates = {
            "course_recommendation": {
                "courseId": "course_123",
                "candidates": [
                    {"lessonTemplateId": "lt_different", "title": "Different Lesson"}
                ]
            }
        }

        # Try to select lesson that doesn't exist
        context = create_lesson_selection_context("lt_missing", state_with_candidates)
        assert context["lesson_selection"]["lessonTemplateId"] == "lt_missing"
        assert "metadata" not in context["lesson_selection"]  # No metadata for missing lesson

    @pytest.mark.asyncio
    async def test_thread_id_persistence_across_workflow(self):
        """Test that thread ID is preserved throughout the entire workflow."""
        persistent_thread_id = "persistent_thread_456"

        # ARRANGE - Initial state with specific thread ID
        initial_state = {
            "thread_id": persistent_thread_id,
            "mode": "planning",
            "session_context": {
                "request_type": "get_recommendations",
                "course": {"courseId": "course_c84473"},
                "student": {"id": "stu_123"},
                "templates": [{"$id": "lt_1", "title": "Test"}],
                "constraints": {"maxBlockMinutes": 25}
            }
        }

        # ACT - Lead Teacher processing
        result1 = await lead_teacher_node(initial_state)

        # ASSERT - Thread ID preserved after routing
        assert result1["thread_id"] == persistent_thread_id

        # SIMULATE - Add recommendations
        state_with_recommendations = {
            **result1,
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_1",
                        "title": "Test Lesson",
                        "priorityScore": 0.8,
                        "reasons": ["test_reason"]
                    }
                ]
            }
        }

        # ACT - Lead Teacher completion
        result2 = await lead_teacher_node(state_with_recommendations)

        # ASSERT - Thread ID still preserved
        assert result2["thread_id"] == persistent_thread_id

        # ACT - State reading utilities
        recommendations = extract_recommendations_from_state(result2)
        readiness = get_thread_readiness_status(result2)

        # ASSERT - Thread ID available in all utilities
        assert recommendations["thread_id"] == persistent_thread_id
        assert readiness["thread_id"] == persistent_thread_id

        # ACT - Lesson selection context
        context = create_lesson_selection_context("lt_1", result2)

        # ASSERT - Context preserves course info for thread continuity
        assert context["course_id"] == "course_c84473"

    @pytest.mark.asyncio
    async def test_performance_state_reading_vs_interrupts(self):
        """Verify that direct state reading is faster than interrupt patterns."""
        import time

        # ARRANGE - State for direct return
        state_for_direct_return = {
            "thread_id": "performance_test_thread",
            "mode": "planning",
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {"lessonTemplateId": "lt_1", "title": "Test Lesson", "priorityScore": 0.8}
                ]
            }
        }

        # ACT - Time the direct state reading approach
        start_time = time.time()

        # Lead Teacher returns state directly
        result = await lead_teacher_node(state_for_direct_return)
        assert result["routing_decision"] == "complete"

        # Extract recommendations immediately
        recommendations = extract_recommendations_from_state(result)
        assert recommendations["available"] is True

        end_time = time.time()
        direct_reading_time = end_time - start_time

        # ASSERT - Direct reading should be very fast (< 100ms for this test)
        assert direct_reading_time < 0.1, f"Direct reading took {direct_reading_time:.3f}s, should be < 0.1s"

        # Additional verification: no interrupt-related fields in result
        assert "interrupt" not in result.get("routing_decision", "")
        assert result.get("orchestration_phase") != "awaiting_selection"
        assert result.get("recommendations_ready", False) is True