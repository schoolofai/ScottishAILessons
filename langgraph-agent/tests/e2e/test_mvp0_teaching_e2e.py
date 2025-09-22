#!/usr/bin/env python3
"""E2E Tests for MVP0 Teaching Loop Compatibility using LangGraph Python SDK.

These tests verify that the MVP0 teaching loop functionality still works
correctly after Lead Teacher integration. Tests use the LangGraph SDK
to interact with a running backend server.
"""

import pytest
from typing import Dict, Any

from .utils import (
    send_and_wait_for_completion,
    stream_and_collect,
    get_thread_messages,
    assert_mvp0_compatibility,
    assert_state_persistence,
    create_human_message,
    wait_for_interrupts
)

pytestmark = pytest.mark.asyncio


class TestMVP0TeachingCompatibilityE2E:
    """Test MVP0 teaching loop compatibility through SDK."""

    async def test_mvp0_direct_teaching_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test MVP0 direct teaching mode bypasses Course Manager."""
        # ARRANGE - MVP0 teaching context with bypass flag
        mvp0_context = {
            "session_id": "sess_mvp0_e2e_001",
            "bypass_course_manager": True,
            "lesson_snapshot": {
                "title": "MVP0 Test Lesson",
                "cards": [
                    {
                        "id": "mvp0_card_1",
                        "type": "info",
                        "content": "This is an MVP0 test lesson card"
                    }
                ]
            }
        }

        input_data = {
            "messages": [create_human_message("Start MVP0 lesson")],
            "session_context": mvp0_context,
            "mode": "teaching"
        }

        # ACT - Send MVP0 teaching request
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data
        )

        # ASSERT - Should route to MVP0 compatibility mode
        assert result["status"] == "success", f"MVP0 run should succeed: {result}"
        assert_mvp0_compatibility(result)

        # Verify Lead Teacher detected MVP0 mode
        values = result["values"]
        assert values.get("mode") == "teaching"
        assert "session_id" in values

    async def test_session_continuation_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test continuing an existing teaching session."""
        # ARRANGE - Existing session context
        session_context = {
            "session_id": "sess_continuation_001",
            "student_id": "stu_continuation",
            "lesson_snapshot": {
                "title": "Continuing Lesson",
                "cards": [
                    {
                        "id": "cont_card_1",
                        "type": "mcq",
                        "question": "What is 2 + 2?",
                        "options": ["3", "4", "5"],
                        "correct": 1
                    },
                    {
                        "id": "cont_card_2",
                        "type": "info",
                        "content": "Next card content"
                    }
                ]
            },
            "current_card_index": 0,
            "cards_completed": []
        }

        input_data = {
            "messages": [create_human_message("Continue my lesson")],
            "session_context": session_context,
            "mode": "teaching"
        }

        # ACT - Continue session
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data
        )

        # ASSERT - Should handle session continuation
        assert result["status"] == "success", f"Session continuation should succeed: {result}"

        # Verify session context preserved
        values = result["values"]
        assert values.get("session_id") == "sess_continuation_001"
        assert values.get("student_id") == "stu_continuation"
        assert "lesson_snapshot" in values

    async def test_student_response_processing_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test processing student responses in MVP0 mode."""
        # ARRANGE - Teaching session with student response
        teaching_context = {
            "session_id": "sess_response_001",
            "student_id": "stu_response",
            "lesson_snapshot": {
                "title": "Response Processing Lesson",
                "cards": [
                    {
                        "id": "response_card",
                        "type": "text",
                        "question": "What is the capital of Scotland?",
                        "expected": "Edinburgh"
                    }
                ]
            },
            "current_card_index": 0
        }

        # First request to start lesson
        start_input = {
            "messages": [create_human_message("Start the lesson")],
            "session_context": teaching_context,
            "mode": "teaching"
        }

        await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            start_input
        )

        # Student response
        response_input = {
            "messages": [create_human_message("Edinburgh")],
            "session_context": teaching_context,
            "student_response": "Edinburgh"
        }

        # ACT - Send student response
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            response_input
        )

        # ASSERT - Should process student response
        assert result["status"] == "success", f"Response processing should succeed: {result}"

        # Verify response was processed
        values = result["values"]
        assert "student_response" in values
        assert values["student_response"] == "Edinburgh"

    async def test_lesson_progression_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test lesson progression through multiple cards."""
        # ARRANGE - Multi-card lesson
        progression_context = {
            "session_id": "sess_progression_001",
            "lesson_snapshot": {
                "title": "Multi-Card Progression Lesson",
                "cards": [
                    {
                        "id": "prog_card_1",
                        "type": "info",
                        "content": "First card"
                    },
                    {
                        "id": "prog_card_2",
                        "type": "mcq",
                        "question": "First question?",
                        "options": ["A", "B", "C"],
                        "correct": 0
                    },
                    {
                        "id": "prog_card_3",
                        "type": "info",
                        "content": "Final card"
                    }
                ]
            },
            "current_card_index": 0
        }

        # ACT - Progress through lesson
        card_responses = [
            "Continue to first question",
            "A",  # Correct answer
            "Complete the lesson"
        ]

        for i, response in enumerate(card_responses):
            input_data = {
                "messages": [create_human_message(response)],
                "session_context": {
                    **progression_context,
                    "current_card_index": i
                }
            }

            result = await send_and_wait_for_completion(
                langgraph_client,
                test_thread["thread_id"],
                input_data
            )

            # Each step should succeed
            assert result["status"] == "success", f"Step {i+1} should succeed: {result}"

        # ASSERT - Final state should show progression
        final_state = await langgraph_client.threads.get_state(test_thread["thread_id"])
        assert_state_persistence(final_state, [
            "session_id",
            "lesson_snapshot",
            "current_card_index"
        ])


class TestMVP0InterruptHandlingE2E:
    """Test interrupt handling in MVP0 mode through SDK."""

    async def test_lesson_card_interrupts_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test that lesson cards generate proper interrupts for UI."""
        # ARRANGE - Lesson context for interrupt testing
        interrupt_context = {
            "session_id": "sess_interrupt_001",
            "lesson_snapshot": {
                "title": "Interrupt Test Lesson",
                "cards": [
                    {
                        "id": "interrupt_card",
                        "type": "mcq",
                        "question": "Test question for interrupt?",
                        "options": ["Option 1", "Option 2"],
                        "correct": 0
                    }
                ]
            },
            "current_card_index": 0
        }

        input_data = {
            "messages": [create_human_message("Start lesson with interrupts")],
            "session_context": interrupt_context,
            "mode": "teaching"
        }

        # ACT - Start lesson that should trigger interrupts
        run = await langgraph_client.runs.create(
            thread_id=test_thread["thread_id"],
            assistant_id="agent",
            input=input_data
        )

        # Wait for potential interrupts
        try:
            interrupts = await wait_for_interrupts(
                langgraph_client,
                test_thread["thread_id"],
                run["run_id"],
                timeout=10
            )

            # ASSERT - Should receive interrupts for lesson cards
            assert len(interrupts) > 0, "Should receive interrupts for lesson presentation"

        except asyncio.TimeoutError:
            # If no interrupts, verify the run completed successfully
            run_status = await langgraph_client.runs.get(test_thread["thread_id"], run["run_id"])
            assert run_status["status"] == "success", "If no interrupts, run should complete"

    async def test_interrupt_resume_flow_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test resuming from interrupts with user input."""
        # ARRANGE - Start a lesson that will interrupt
        lesson_context = {
            "session_id": "sess_resume_001",
            "lesson_snapshot": {
                "title": "Resume Test Lesson",
                "cards": [
                    {
                        "id": "resume_card",
                        "type": "text",
                        "question": "Enter your answer:",
                        "expected": "test answer"
                    }
                ]
            }
        }

        # Start lesson
        start_input = {
            "messages": [create_human_message("Start resumable lesson")],
            "session_context": lesson_context,
            "mode": "teaching"
        }

        run = await langgraph_client.runs.create(
            thread_id=test_thread["thread_id"],
            assistant_id="agent",
            input=start_input
        )

        # Wait for interrupt or completion
        run_status = await langgraph_client.runs.get(test_thread["thread_id"], run["run_id"])

        if run_status["status"] == "interrupted":
            # ACT - Resume with user input
            resume_input = {
                "user_interaction_response": {
                    "student_answer": "test answer"
                }
            }

            resumed_run = await langgraph_client.runs.create(
                thread_id=test_thread["thread_id"],
                assistant_id="agent",
                input=resume_input
            )

            # Wait for resumed run completion
            resumed_result = await send_and_wait_for_completion(
                langgraph_client,
                test_thread["thread_id"],
                {},
                timeout=15
            )

            # ASSERT - Should resume successfully
            assert resumed_result["status"] == "success", "Resume should succeed"

        else:
            # If run completed without interrupt, that's also valid MVP0 behavior
            assert run_status["status"] == "success", "Run should complete successfully"


class TestMVP0ErrorHandlingE2E:
    """Test error handling in MVP0 mode through SDK."""

    async def test_invalid_lesson_context_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test handling of invalid lesson context in MVP0 mode."""
        # ARRANGE - Invalid lesson context
        invalid_context = {
            "session_id": "",  # Empty session ID
            "lesson_snapshot": {
                "title": "",  # Empty title
                "cards": []  # No cards
            }
        }

        input_data = {
            "messages": [create_human_message("Start invalid lesson")],
            "session_context": invalid_context,
            "mode": "teaching"
        }

        # ACT - Send invalid context
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            input_data
        )

        # ASSERT - Should handle gracefully (success or controlled error)
        assert result["status"] in ["success", "error"], "Should handle invalid context gracefully"

        if result["status"] == "success":
            # If handled gracefully, should have some error indication in state
            values = result.get("values", {})
            # Check for error handling markers or fallback behavior
            assert "session_id" in values  # Should preserve what it can

    async def test_corrupted_state_recovery_e2e(
        self,
        langgraph_client,
        test_thread
    ):
        """Test recovery from corrupted state scenarios."""
        # ARRANGE - Start with good context, then send corrupted update
        good_context = {
            "session_id": "sess_recovery_001",
            "lesson_snapshot": {
                "title": "Recovery Test",
                "cards": [{"id": "recovery_card", "type": "info", "content": "Test"}]
            }
        }

        # Start with good context
        start_input = {
            "messages": [create_human_message("Start lesson")],
            "session_context": good_context,
            "mode": "teaching"
        }

        await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            start_input
        )

        # Send corrupted update
        corrupted_input = {
            "messages": [create_human_message("Corrupted request")],
            "session_context": {"corrupted": "data"},
            "invalid_field": "should_be_ignored"
        }

        # ACT - Send corrupted update
        result = await send_and_wait_for_completion(
            langgraph_client,
            test_thread["thread_id"],
            corrupted_input
        )

        # ASSERT - Should maintain stability
        assert result["status"] == "success", "Should handle corrupted input gracefully"

        # Verify original good state preserved where possible
        final_state = await langgraph_client.threads.get_state(test_thread["thread_id"])
        values = final_state["values"]
        assert values.get("session_id") == "sess_recovery_001", "Should preserve valid session ID"