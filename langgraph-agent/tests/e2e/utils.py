#!/usr/bin/env python3
"""E2E Testing Utilities for LangGraph SDK Tests.

This module provides helper functions for E2E testing with the LangGraph SDK,
including response validation, streaming utilities, and common test patterns.
"""

import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage


async def send_and_wait_for_completion(
    client,
    thread_id: str,
    input_data: Dict[str, Any],
    timeout: int = 30
) -> Dict[str, Any]:
    """Send input to graph and wait for completion.

    Args:
        client: LangGraph SDK client
        thread_id: Thread ID for the conversation
        input_data: Input data to send to the graph
        timeout: Maximum time to wait for completion

    Returns:
        Final run result with thread state values included

    Raises:
        asyncio.TimeoutError: If run doesn't complete within timeout
    """
    # Start the run
    run = await client.runs.create(
        thread_id=thread_id,
        assistant_id="agent",
        input=input_data
    )

    # Wait for completion
    start_time = asyncio.get_event_loop().time()
    while True:
        run_status = await client.runs.get(thread_id, run["run_id"])

        if run_status["status"] in ["success", "error"]:
            # Get the final thread state and merge it with run status
            thread_state = await client.threads.get_state(thread_id)
            result = {
                **run_status,
                "values": thread_state.get("values", {})
            }
            return result

        if asyncio.get_event_loop().time() - start_time > timeout:
            raise asyncio.TimeoutError(f"Run did not complete within {timeout} seconds")

        await asyncio.sleep(0.5)


async def stream_and_collect(
    client,
    thread_id: str,
    input_data: Dict[str, Any],
    stream_mode: str = "values"
) -> List[Dict[str, Any]]:
    """Stream a run and collect all chunks.

    Args:
        client: LangGraph SDK client
        thread_id: Thread ID for the conversation
        input_data: Input data to send to the graph
        stream_mode: Stream mode ("values", "updates", "messages")

    Returns:
        List of all streaming chunks
    """
    chunks = []

    async for chunk in client.runs.stream(
        thread_id=thread_id,
        assistant_id="agent",
        input=input_data,
        stream_mode=stream_mode
    ):
        chunks.append(chunk)

    return chunks


async def get_thread_messages(client, thread_id: str) -> List[BaseMessage]:
    """Get all messages from a thread.

    Args:
        client: LangGraph SDK client
        thread_id: Thread ID to retrieve messages from

    Returns:
        List of messages in the thread
    """
    thread_state = await client.threads.get_state(thread_id)
    return thread_state.get("values", {}).get("messages", [])


def assert_has_course_recommendation(result: Dict[str, Any]) -> None:
    """Assert that result contains valid course recommendation.

    Args:
        result: Run result to validate

    Raises:
        AssertionError: If recommendation is missing or invalid
    """
    assert "values" in result, "Result should have 'values' field"
    values = result["values"]

    assert "course_recommendation" in values, "Should have course_recommendation"
    recommendation = values["course_recommendation"]

    assert "candidates" in recommendation, "Recommendation should have candidates"
    assert len(recommendation["candidates"]) > 0, "Should have at least one candidate"

    # Validate candidate structure
    for candidate in recommendation["candidates"]:
        assert "lessonTemplateId" in candidate, "Candidate should have lessonTemplateId"
        assert "title" in candidate, "Candidate should have title"
        assert "priorityScore" in candidate, "Candidate should have priorityScore"
        assert "reasons" in candidate, "Candidate should have reasons"


def assert_has_teaching_preparation(result: Dict[str, Any]) -> None:
    """Assert that result shows teaching preparation.

    Args:
        result: Run result to validate

    Raises:
        AssertionError: If teaching preparation is missing
    """
    assert "values" in result, "Result should have 'values' field"
    values = result["values"]

    assert values.get("routing_decision") == "teaching", "Should route to teaching"
    assert values.get("next_action") == "start_lesson", "Should prepare to start lesson"
    assert "teaching_status" in values, "Should have teaching status"


def assert_mvp0_compatibility(result: Dict[str, Any]) -> None:
    """Assert that result shows MVP0 compatibility mode.

    Args:
        result: Run result to validate

    Raises:
        AssertionError: If MVP0 mode is not detected
    """
    assert "values" in result, "Result should have 'values' field"
    values = result["values"]

    assert values.get("compatibility_mode") == "mvp0", "Should be in MVP0 mode"
    assert values.get("routing_decision") == "direct_teaching", "Should route directly to teaching"


def assert_state_persistence(state: Dict[str, Any], expected_fields: List[str]) -> None:
    """Assert that state contains expected persisted fields.

    Args:
        state: Thread state to validate
        expected_fields: List of field names that should be present

    Raises:
        AssertionError: If expected fields are missing
    """
    assert "values" in state, "State should have 'values' field"
    values = state["values"]

    for field in expected_fields:
        assert field in values, f"State should preserve field: {field}"
        assert values[field] is not None, f"Field {field} should not be None"


def assert_error_handling(result: Dict[str, Any], expected_error_source: Optional[str] = None) -> None:
    """Assert that result shows proper error handling.

    Args:
        result: Run result to validate
        expected_error_source: Expected source of the error

    Raises:
        AssertionError: If error handling is not proper
    """
    assert "values" in result, "Result should have 'values' field"
    values = result["values"]

    assert "error" in values, "Should have error field"
    assert values.get("routing_decision") == "error", "Should route to error handling"

    if expected_error_source:
        assert values.get("error_source") == expected_error_source, \
            f"Error source should be {expected_error_source}"


async def wait_for_interrupts(
    client,
    thread_id: str,
    run_id: str,
    timeout: int = 30
) -> List[Dict[str, Any]]:
    """Wait for and collect interrupts from a run.

    Args:
        client: LangGraph SDK client
        thread_id: Thread ID for the conversation
        run_id: Run ID to monitor for interrupts
        timeout: Maximum time to wait

    Returns:
        List of interrupt events

    Raises:
        asyncio.TimeoutError: If no interrupts received within timeout
    """
    interrupts = []
    start_time = asyncio.get_event_loop().time()

    while True:
        run_status = await client.runs.get(thread_id, run_id)

        if run_status["status"] == "interrupted":
            # Get interrupt details
            interrupt_data = run_status.get("interrupted_by", {})
            interrupts.append(interrupt_data)
            break

        if run_status["status"] in ["success", "error"]:
            break

        if asyncio.get_event_loop().time() - start_time > timeout:
            raise asyncio.TimeoutError(f"No interrupts received within {timeout} seconds")

        await asyncio.sleep(0.5)

    return interrupts


def create_human_message(content: str) -> Dict[str, Any]:
    """Create a human message for testing.

    Args:
        content: Message content

    Returns:
        Message dictionary for SDK input
    """
    return {
        "role": "human",
        "content": content
    }


def validate_streaming_chunks(chunks: List[Dict[str, Any]]) -> None:
    """Validate that streaming chunks have proper format.

    Args:
        chunks: List of streaming chunks to validate

    Raises:
        AssertionError: If chunks are malformed
    """
    assert len(chunks) > 0, "Should receive at least one chunk"

    for chunk in chunks:
        assert isinstance(chunk, dict), "Each chunk should be a dictionary"
        # Add more specific validations based on expected chunk format