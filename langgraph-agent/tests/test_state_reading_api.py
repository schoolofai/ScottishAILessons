"""
Test suite for State Reading API Integration utilities.

Tests the functions that enable direct state reading from LangGraph threads
using the LangGraph SDK Client pattern.
"""

import pytest
from datetime import datetime
from typing import Dict, Any

from src.agent.course_manager_utils import (
    extract_recommendations_from_state,
    get_thread_readiness_status,
    validate_thread_for_state_reading,
    create_lesson_selection_context
)


class TestStateReadingAPIIntegration:
    """Test state reading utilities for LangGraph SDK integration."""

    def test_extract_recommendations_from_state_with_valid_data(self):
        """Test extracting recommendations from complete state."""
        # ARRANGE - State with course recommendations
        state = {
            "thread_id": "main_thread_123",
            "orchestration_phase": "recommendations_ready",
            "recommendations_ready": True,
            "course_recommendation": {
                "courseId": "course_c84473",
                "graphRunId": "course_manager_run_456",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_1",
                        "title": "Lesson 1",
                        "priorityScore": 0.85,
                        "reasons": ["overdue", "high_impact"]
                    },
                    {
                        "lessonTemplateId": "lt_2",
                        "title": "Lesson 2",
                        "priorityScore": 0.75,
                        "reasons": ["recent_activity"]
                    }
                ],
                "rubric": "Scored by priority algorithm",
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }

        # ACT
        result = extract_recommendations_from_state(state)

        # ASSERT
        assert result["available"] is True
        assert result["recommendations_ready"] is True
        assert result["thread_id"] == "main_thread_123"
        assert result["orchestration_phase"] == "recommendations_ready"
        assert len(result["candidates"]) == 2
        assert result["candidates"][0]["lessonTemplateId"] == "lt_1"
        assert result["metadata"]["course_id"] == "course_c84473"
        assert result["metadata"]["total_candidates"] == 2
        assert "summary" in result["metadata"]

    def test_extract_recommendations_from_state_with_empty_candidates(self):
        """Test extraction when no candidates are available."""
        # ARRANGE - State with empty recommendations
        state = {
            "thread_id": "main_thread_456",
            "orchestration_phase": "recommendations_ready",
            "recommendations_ready": True,
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [],
                "rubric": "No candidates found"
            }
        }

        # ACT
        result = extract_recommendations_from_state(state)

        # ASSERT
        assert result["available"] is False
        assert result["recommendations_ready"] is True
        assert len(result["candidates"]) == 0
        assert result["metadata"]["total_candidates"] == 0

    def test_extract_recommendations_from_state_without_course_recommendation(self):
        """Test extraction when course_recommendation is missing."""
        # ARRANGE - State without course recommendations
        state = {
            "thread_id": "main_thread_789",
            "orchestration_phase": "requesting_recommendations",
            "recommendations_ready": False
        }

        # ACT
        result = extract_recommendations_from_state(state)

        # ASSERT
        assert result["available"] is False
        assert result["recommendations_ready"] is False
        assert len(result["candidates"]) == 0
        assert result["metadata"] == {}

    def test_get_thread_readiness_status_recommendations_ready(self):
        """Test thread readiness when recommendations are available."""
        # ARRANGE - State with recommendations ready
        state = {
            "recommendations_ready": True,
            "course_recommendation": {
                "candidates": [{"lessonTemplateId": "lt_1"}]
            },
            "mode": "planning",
            "orchestration_phase": "recommendations_ready",
            "routing_decision": "complete",
            "thread_id": "thread_123"
        }

        # ACT
        result = get_thread_readiness_status(state)

        # ASSERT
        assert result["recommendations_ready"] is True
        assert result["can_select_lesson"] is True
        assert result["teaching_active"] is False
        assert result["orchestration_phase"] == "recommendations_ready"
        assert result["routing_decision"] == "complete"
        assert result["thread_id"] == "thread_123"

    def test_get_thread_readiness_status_teaching_active(self):
        """Test thread readiness during active teaching."""
        # ARRANGE - State in teaching mode
        state = {
            "recommendations_ready": False,
            "mode": "teaching",
            "orchestration_phase": "teaching_active",
            "routing_decision": "teaching",
            "thread_id": "thread_456"
        }

        # ACT
        result = get_thread_readiness_status(state)

        # ASSERT
        assert result["recommendations_ready"] is False
        assert result["can_select_lesson"] is False
        assert result["teaching_active"] is True
        assert result["orchestration_phase"] == "teaching_active"

    def test_validate_thread_for_state_reading_valid_thread(self):
        """Test thread validation with valid thread ID."""
        # ARRANGE
        thread_id = "valid_thread_123"

        # ACT
        result = validate_thread_for_state_reading(thread_id)

        # ASSERT
        assert result["valid"] is True
        assert result["thread_id"] == "valid_thread_123"
        assert result["ready_for_reading"] is True
        assert "error" not in result

    def test_validate_thread_for_state_reading_empty_thread(self):
        """Test thread validation with empty thread ID."""
        # ARRANGE
        thread_id = ""

        # ACT
        result = validate_thread_for_state_reading(thread_id)

        # ASSERT
        assert result["valid"] is False
        assert "Thread ID is required" in result["error"]
        assert "Create a new thread" in result["recommendation"]

    def test_validate_thread_for_state_reading_none_thread(self):
        """Test thread validation with None thread ID."""
        # ARRANGE
        thread_id = None

        # ACT
        result = validate_thread_for_state_reading(thread_id)

        # ASSERT
        assert result["valid"] is False
        assert "Thread ID is required" in result["error"]

    def test_create_lesson_selection_context_with_valid_data(self):
        """Test creating lesson selection context."""
        # ARRANGE
        selected_lesson_id = "lt_1"
        recommendations_state = {
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_1",
                        "title": "Algebra Basics",
                        "priorityScore": 0.85,
                        "reasons": ["overdue", "fundamental"]
                    }
                ]
            }
        }

        # ACT
        result = create_lesson_selection_context(selected_lesson_id, recommendations_state)

        # ASSERT
        assert result["lesson_selection"]["lessonTemplateId"] == "lt_1"
        assert "sessionId" in result["lesson_selection"]
        assert result["lesson_selection"]["sessionId"].startswith("sess_")
        assert result["mode"] == "teaching"
        assert result["selection_source"] == "course_recommendations"
        assert result["course_id"] == "course_c84473"
        assert result["lesson_selection"]["metadata"]["title"] == "Algebra Basics"
        assert result["lesson_selection"]["metadata"]["priority_score"] == 0.85

    def test_create_lesson_selection_context_lesson_not_found(self):
        """Test creating context when selected lesson is not in candidates."""
        # ARRANGE
        selected_lesson_id = "lt_missing"
        recommendations_state = {
            "course_recommendation": {
                "courseId": "course_c84473",
                "candidates": [
                    {"lessonTemplateId": "lt_1", "title": "Different Lesson"}
                ]
            }
        }

        # ACT
        result = create_lesson_selection_context(selected_lesson_id, recommendations_state)

        # ASSERT
        assert result["lesson_selection"]["lessonTemplateId"] == "lt_missing"
        assert result["course_id"] == "course_c84473"
        # Should not have metadata since lesson wasn't found
        assert "metadata" not in result["lesson_selection"]

    def test_create_lesson_selection_context_no_course_recommendation(self):
        """Test creating context when course_recommendation is missing."""
        # ARRANGE
        selected_lesson_id = "lt_1"
        recommendations_state = {}

        # ACT
        result = create_lesson_selection_context(selected_lesson_id, recommendations_state)

        # ASSERT
        assert result["lesson_selection"]["lessonTemplateId"] == "lt_1"
        assert result["mode"] == "teaching"
        assert "course_id" not in result  # Should not be set if missing


class TestStateReadingIntegration:
    """Integration tests for state reading with actual state structures."""

    def test_full_state_reading_workflow(self):
        """Test complete workflow: extract → validate → create context."""
        # ARRANGE - Complete state from Lead Teacher after recommendations
        complete_state = {
            "thread_id": "integration_thread_001",
            "student_id": "stu_123",
            "course_id": "course_c84473",
            "mode": "planning",
            "orchestration_phase": "recommendations_ready",
            "routing_decision": "complete",
            "recommendations_ready": True,
            "course_recommendation": {
                "courseId": "course_c84473",
                "graphRunId": "cm_run_789",
                "candidates": [
                    {
                        "lessonTemplateId": "lt_algebra_1",
                        "title": "Linear Equations",
                        "priorityScore": 0.92,
                        "reasons": ["overdue", "foundational"]
                    }
                ]
            }
        }

        # ACT - Step 1: Extract recommendations
        recommendations = extract_recommendations_from_state(complete_state)

        # ASSERT - Recommendations extracted correctly
        assert recommendations["available"] is True
        assert len(recommendations["candidates"]) == 1
        assert recommendations["thread_id"] == "integration_thread_001"

        # ACT - Step 2: Check thread readiness
        readiness = get_thread_readiness_status(complete_state)

        # ASSERT - Thread is ready for lesson selection
        assert readiness["recommendations_ready"] is True
        assert readiness["can_select_lesson"] is True

        # ACT - Step 3: Create lesson selection context
        selected_lesson = recommendations["candidates"][0]["lessonTemplateId"]
        lesson_context = create_lesson_selection_context(selected_lesson, complete_state)

        # ASSERT - Context created for teaching transition
        assert lesson_context["lesson_selection"]["lessonTemplateId"] == "lt_algebra_1"
        assert lesson_context["mode"] == "teaching"
        assert lesson_context["course_id"] == "course_c84473"
        assert lesson_context["lesson_selection"]["metadata"]["title"] == "Linear Equations"

    def test_state_reading_error_handling(self):
        """Test error handling in state reading workflow."""
        # ARRANGE - Malformed state
        malformed_state = {
            "thread_id": None,
            "course_recommendation": "invalid_type"  # Should be dict
        }

        # ACT & ASSERT - Should handle gracefully
        recommendations = extract_recommendations_from_state(malformed_state)
        assert recommendations["available"] is False
        assert recommendations["thread_id"] is None

        readiness = get_thread_readiness_status(malformed_state)
        assert readiness["recommendations_ready"] is False
        assert readiness["can_select_lesson"] is False

        # Thread validation should catch None thread
        validation = validate_thread_for_state_reading(malformed_state.get("thread_id"))
        assert validation["valid"] is False