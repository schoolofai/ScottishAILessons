#!/usr/bin/env python3
"""E2E Tests for Lead Teacher Orchestration using LangGraph Python SDK.

These tests verify the complete Lead Teacher orchestration flow through the
LangGraph Python SDK, treating the backend as a black box. The backend
runs via `langgraph dev` and tests use RemoteGraph through the SDK.
"""

import pytest
from typing import Dict, Any
from langchain_core.messages import HumanMessage

from .utils import (
    send_and_wait_for_completion,
    stream_and_collect,
    get_thread_messages,
    assert_has_course_recommendation,
    assert_has_teaching_preparation,
    assert_state_persistence,
    assert_error_handling,
    create_human_message,
    validate_streaming_chunks
)

pytestmark = pytest.mark.asyncio


class TestLeadTeacherRecommendationFlowE2E:
    """Test Lead Teacher recommendation flow through SDK."""

    async def test_complete_recommendation_flow_e2e(
        self,
        langgraph_client,
        test_thread,
        sample_course_context
    ):
        """Test complete recommendation flow: request → Lead Teacher → Course Manager → recommendations."""
        # ARRANGE - Recommendation request
        input_data = {
            "messages": [create_human_message("I need math lesson recommendations")],
            "session_context": sample_course_context,
            "thread_id": test_thread["thread_id"]
        }

        # ACT - Send request and wait for completion
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data
        )

        # ASSERT - Should complete recommendation flow
        assert result["status"] == "success", f"Run should succeed: {result}"
        assert_has_course_recommendation(result)

        # Verify orchestration through Lead Teacher
        values = result["values"]
        assert values.get("orchestration_phase") == "recommendations_ready"
        assert values.get("mode") == "awaiting_selection"
        assert values.get("routing_decision") == "course_manager"

        # Verify thread persistence
        thread_state = await langgraph_client.threads.get_state(test_thread["thread_id"])
        assert_state_persistence(thread_state, [
            "course_recommendation",
            "orchestration_phase",
            "thread_id",
            "session_context"
        ])

    async def test_recommendation_streaming_e2e(
        self,
        langgraph_client,
        test_thread,
        sample_course_context
    ):
        """Test recommendation flow with streaming enabled."""
        # ARRANGE - Streaming request
        input_data = {
            "messages": [create_human_message("Show me available lessons")],
            "session_context": sample_course_context
        }

        # ACT - Stream the response
        chunks = await stream_and_collect(
            langgraph_client,
            test_thread["thread_id"],
            input_data,
            stream_mode="values"
        )

        # ASSERT - Should receive streaming chunks
        validate_streaming_chunks(chunks)

        # Find final chunk with recommendations
        final_chunk = chunks[-1] if chunks else {}
        assert "course_recommendation" in final_chunk, "Final chunk should have recommendations"

        # Verify recommendation structure
        recommendation = final_chunk["course_recommendation"]
        assert len(recommendation.get("candidates", [])) > 0, "Should have candidates"

    async def test_lesson_selection_flow_e2e(
        self,
        langgraph_client,
        test_thread,
        sample_lesson_context
    ):
        """Test lesson selection → Lead Teacher → Teaching Loop flow."""
        # ARRANGE - Lesson selection request
        input_data = {
            "messages": [create_human_message("Start my selected lesson")],
            "session_context": sample_lesson_context,
            "mode": "teaching"
        }

        # ACT - Send lesson selection
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data
        )

        # ASSERT - Should route to teaching through Lead Teacher
        assert result["status"] == "success", f"Run should succeed: {result}"
        assert_has_teaching_preparation(result)

        # Verify Lead Teacher orchestration
        values = result["values"]
        assert values.get("next_action") == "start_lesson"
        assert values.get("orchestration_phase") == "teaching_active"

    async def test_error_handling_flow_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test error handling through Lead Teacher."""
        # ARRANGE - Invalid recommendation request (empty templates)
        invalid_context = {
            "request_type": "get_recommendations",
            "course": {
                "$id": "course_invalid",
                "courseId": "course_invalid",
                "subject": "Invalid Subject",
                "level": "Invalid"
            },
            "student": {"id": "stu_invalid"},
            "templates": [],  # Empty templates should cause error
            "constraints": {"maxBlockMinutes": 25}
        }

        input_data = {
            "messages": [create_human_message("Get recommendations")],
            "session_context": invalid_context,
            "mode": "planning"
        }

        # ACT - Send invalid request
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data
        )

        # ASSERT - Should handle error gracefully
        assert result["status"] == "success", "Should handle error gracefully"
        assert_error_handling(result, expected_error_source="course_manager")


class TestLeadTeacherStateManagementE2E:
    """Test state persistence and management through SDK."""

    async def test_thread_continuity_across_requests_e2e(
        self,
        langgraph_client,
        test_thread,
        sample_course_context
    ):
        """Test that state persists across multiple requests."""
        # ARRANGE - First request for recommendations
        first_input = {
            "messages": [create_human_message("I need lesson recommendations")],
            "session_context": sample_course_context,
            "custom_field": "preserve_me",
            "user_preferences": {"theme": "dark"}
        }

        # ACT - Send first request
        first_result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            first_input
        )

        # Get thread state after first request
        thread_state = await langgraph_client.threads.get_state(test_thread["thread_id"])

        # Send second request (lesson selection)
        second_input = {
            "messages": [create_human_message("I'll take the first recommendation")],
            "session_context": {
                "lesson_selection": {
                    "lessonTemplateId": "lt_nat3_aom_best_deal_v1",
                    "sessionId": "sess_continuity_test"
                }
            }
        }

        second_result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            second_input
        )

        # ASSERT - State should persist across requests
        final_state = await langgraph_client.threads.get_state(test_thread["thread_id"])

        # Verify custom fields preserved
        final_values = final_state["values"]
        assert final_values.get("custom_field") == "preserve_me"
        assert final_values.get("user_preferences", {}).get("theme") == "dark"

        # Verify orchestration progression
        assert final_values.get("course_recommendation") is not None  # From first request
        assert final_values.get("routing_decision") == "teaching"  # From second request

    async def test_message_history_preservation_e2e(
        self,
        langgraph_client,
        test_thread,
        sample_course_context
    ):
        """Test that message history is preserved and enhanced."""
        # ARRANGE - Send multiple messages
        messages = [
            "Hi, I need help with math",
            "Can you recommend some lessons?",
            "I want to work on applications of mathematics"
        ]

        # ACT - Send messages sequentially
        for i, message_content in enumerate(messages):
            input_data = {
                "messages": [create_human_message(message_content)],
                "session_context": sample_course_context if i == 1 else {}  # Add context on second message
            }

            await send_and_wait_for_completion(
                langgraph_client,
                test_thread["thread_id"],
                input_data
            )

        # ASSERT - Message history should be preserved
        thread_messages = await get_thread_messages(langgraph_client, test_thread["thread_id"])
        assert len(thread_messages) >= len(messages), "Should preserve all human messages"

        # Verify message content preserved
        human_messages = [msg for msg in thread_messages if isinstance(msg, HumanMessage)]
        assert len(human_messages) >= len(messages), "Should have all human messages"

    async def test_concurrent_thread_isolation_e2e(
        self,
        langgraph_client,
        sample_course_context
    ):
        """Test that concurrent threads don't interfere with each other."""
        # ARRANGE - Create two separate threads
        thread1 = await langgraph_client.threads.create()
        thread2 = await langgraph_client.threads.create()

        try:
            # Different contexts for each thread
            context1 = {**sample_course_context, "student": {"id": "student_1"}}
            context2 = {**sample_course_context, "student": {"id": "student_2"}}

            input1 = {
                "messages": [create_human_message("Request for student 1")],
                "session_context": context1,
                "thread_marker": "thread_1"
            }

            input2 = {
                "messages": [create_human_message("Request for student 2")],
                "session_context": context2,
                "thread_marker": "thread_2"
            }

            # ACT - Send requests concurrently
            import asyncio
            results = await asyncio.gather(
                send_and_wait_for_completion(langgraph_client, thread1["thread_id"], input1),
                send_and_wait_for_completion(langgraph_client, thread2["thread_id"], input2)
            )

            # ASSERT - Each thread should maintain its own state
            result1, result2 = results

            values1 = result1["values"]
            values2 = result2["values"]

            # Verify thread isolation
            assert values1.get("thread_marker") == "thread_1"
            assert values2.get("thread_marker") == "thread_2"

            # Verify different student contexts preserved
            assert values1["session_context"]["student"]["id"] == "student_1"
            assert values2["session_context"]["student"]["id"] == "student_2"

        finally:
            # Cleanup threads
            await langgraph_client.threads.delete(thread1["thread_id"])
            await langgraph_client.threads.delete(thread2["thread_id"])


class TestLeadTeacherPerformanceE2E:
    """Test performance characteristics through SDK."""

    async def test_response_time_e2e(
        self,
        langgraph_client,
        test_thread,
        sample_course_context
    ):
        """Test that responses complete within acceptable time limits."""
        import time

        # ARRANGE - Standard recommendation request
        input_data = {
            "messages": [create_human_message("Quick recommendation request")],
            "session_context": sample_course_context
        }

        # ACT - Measure response time
        start_time = time.time()
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data,
            timeout=10  # Should complete quickly
        )
        end_time = time.time()

        # ASSERT - Should complete within reasonable time
        response_time = end_time - start_time
        assert response_time < 5.0, f"Response should be under 5 seconds, got {response_time:.2f}s"
        assert result["status"] == "success", "Should complete successfully"

    async def test_large_context_handling_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test handling of large context data."""
        # ARRANGE - Large context with many templates
        large_context = {
            "request_type": "get_recommendations",
            "course": {
                "$id": "course_large",
                "courseId": "course_large",
                "subject": "Large Course Test",
                "level": "Nat3"
            },
            "student": {"id": "stu_large_test"},
            "templates": [
                {
                    "$id": f"template_{i}",
                    "title": f"Lesson Template {i}",
                    "status": "published",
                    "outcomeRefs": [f"outcome_{i}_1", f"outcome_{i}_2"],
                    "estMinutes": 20 + (i % 10)
                }
                for i in range(50)  # 50 templates
            ],
            "constraints": {"maxBlockMinutes": 25}
        }

        input_data = {
            "messages": [create_human_message("Handle large context")],
            "session_context": large_context
        }

        # ACT - Send large context
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data,
            timeout=30  # Allow more time for large context
        )

        # ASSERT - Should handle large context successfully
        assert result["status"] == "success", "Should handle large context"
        assert_has_course_recommendation(result)

        # Verify recommendations generated (should be limited to top candidates)
        recommendation = result["values"]["course_recommendation"]
        candidates = recommendation.get("candidates", [])
        assert len(candidates) <= 5, "Should limit to top 5 candidates"