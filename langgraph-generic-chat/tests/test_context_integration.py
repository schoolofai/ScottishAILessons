"""
Backend Integration Tests for Context-Aware Chat Agent

These tests validate the context-aware chat agent in complete isolation using
the LangGraph Python SDK against a live `langgraph dev` server on port 2700.

RED STATE: All tests will initially FAIL as context processing doesn't exist yet.
GREEN STATE: Tests pass when context-aware agent is fully implemented.

Test Coverage:
- Context awareness and lesson understanding
- Student progress adaptation
- Search integration with context
- Error handling for missing context
- Response quality and relevance
"""

import pytest
import asyncio
from langchain_core.messages import HumanMessage
from typing import Dict, Any, List


class TestContextAwareAgent:
    """Integration tests for context-aware chat agent core functionality."""

    @pytest.mark.asyncio
    async def test_agent_understands_current_lesson_context(
        self, langgraph_client, teaching_context
    ):
        """
        RED: This test will fail initially - context processing doesn't exist.

        Test that agent demonstrates understanding of current lesson state
        by referencing specific content from the teaching context.
        """
        # Create new thread for this test
        thread = await langgraph_client.threads.create()

        # Input matching exact frontend format
        input_data = {
            "messages": [
                HumanMessage(content="What fraction are we currently discussing in this lesson?")
            ],
            "session_context": teaching_context
        }

        # Stream response and collect content
        response_content = ""
        event_count = 0

        try:
            async for chunk in langgraph_client.runs.stream(
                thread["thread_id"],
                "context-chat-agent",  # This agent doesn't exist yet - will fail
                input=input_data,
                stream_mode=["messages"]
            ):
                event_count += 1
                if chunk.event == "messages/partial":
                    if chunk.data and len(chunk.data) > 0:
                        content = chunk.data[0].get("content", "")
                        if content:
                            response_content += content

        except Exception as e:
            pytest.fail(f"Agent failed to process context-aware request: {str(e)}")

        # Assertions: Agent should demonstrate context awareness
        assert len(response_content) > 10, "Agent should provide substantial response"

        # Should reference specific fraction from teaching context (2/10 or \frac{2}{10})
        assert "2/10" in response_content or "2}{10" in response_content, (
            f"Agent should reference the specific fraction '2/10' from lesson context. "
            f"Got: {response_content[:500]}..."
        )

        # Should show topic awareness
        assert "fraction" in response_content.lower(), (
            f"Agent should demonstrate awareness of fraction topic. Got: {response_content}"
        )

        # Should show lesson awareness
        lesson_indicators = ["lesson", "learning", "studying", "current", "discussing"]
        assert any(indicator in response_content.lower() for indicator in lesson_indicators), (
            f"Agent should reference current lesson context. Got: {response_content}"
        )

        # Should NOT provide generic responses (anti-pattern)
        generic_phrases = [
            "I can help you with",
            "How can I assist",
            "I'm here to help",
            "What would you like to know"
        ]
        assert not any(phrase in response_content for phrase in generic_phrases), (
            f"Agent should not provide generic responses when context is available. "
            f"Got: {response_content}"
        )

        print(f"✅ Context awareness test passed. Response: {response_content[:100]}...")

    @pytest.mark.asyncio
    async def test_agent_adapts_to_student_progress_level(
        self, langgraph_client, teaching_context
    ):
        """
        RED: This test will fail initially.

        Test that agent adapts responses based on student's current progress
        and understanding level from the teaching context.
        """
        thread = await langgraph_client.threads.create()

        input_data = {
            "messages": [
                HumanMessage(content="What should I learn next in my fraction studies?")
            ],
            "session_context": teaching_context
        }

        response_content = ""
        async for chunk in langgraph_client.runs.stream(
            thread["thread_id"], "context-chat-agent",
            input=input_data, stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content += content

        # Should reference student's beginner level
        beginner_indicators = ["beginner", "basic", "simple", "start", "begin"]
        assert any(indicator in response_content.lower() for indicator in beginner_indicators), (
            f"Agent should acknowledge beginner difficulty level. Got: {response_content}"
        )

        # Should suggest appropriate next steps based on progress
        next_step_indicators = ["next", "practice", "example", "try", "work on"]
        assert any(indicator in response_content.lower() for indicator in next_step_indicators), (
            f"Agent should suggest next learning steps. Got: {response_content}"
        )

        # Should reference current step from context (fraction_examples)
        assert any(word in response_content.lower() for word in ["example", "practice"]), (
            f"Agent should reference current learning step. Got: {response_content}"
        )

        print(f"✅ Progress adaptation test passed. Response: {response_content[:100]}...")

    @pytest.mark.asyncio
    async def test_agent_can_search_with_lesson_context(
        self, langgraph_client, search_teaching_context
    ):
        """
        RED: This test will fail initially.

        Test that agent integrates search functionality and enhances
        queries with lesson context when appropriate.
        """
        thread = await langgraph_client.threads.create()

        input_data = {
            "messages": [
                HumanMessage(content="Can you search for more examples of fraction-decimal conversions like we're studying?")
            ],
            "session_context": search_teaching_context
        }

        tool_calls_made = []
        response_content = ""

        async for chunk in langgraph_client.runs.stream(
            thread["thread_id"], "context-chat-agent",
            input=input_data, stream_mode=["messages", "updates"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    msg = chunk.data[0]
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        tool_calls_made.extend(msg.tool_calls)
                    content = msg.get("content", "")
                    if content:
                        response_content += content

        # Should have either made a search tool call OR provided context-aware response
        has_tool_calls = len(tool_calls_made) > 0
        has_contextual_response = any(keyword in response_content.lower()
                                    for keyword in ["fraction", "decimal", "conversion", "examples"])

        assert has_tool_calls or has_contextual_response, (
            f"Agent should either make search tool call or provide contextual response. "
            f"Tool calls made: {tool_calls_made}. Response: {response_content[:200]}..."
        )

        # If tool calls were made, validate search functionality
        if tool_calls_made:
            # Find search tool call
            search_call = next((
                call for call in tool_calls_made
                if call.get("name") in ["search", "search_lesson_resources"]
            ), None)

            if search_call:
                # Validate search query includes context
                search_query = search_call.get("args", {}).get("query", "")
                context_keywords = ["fraction", "decimal", "mathematics", "conversion"]

                assert any(keyword in search_query.lower() for keyword in context_keywords), (
                    f"Search query should include lesson context keywords. "
                    f"Query: '{search_query}', Expected one of: {context_keywords}"
                )

        # If no tool calls, ensure response is contextually aware
        elif has_contextual_response:
            print(f"✅ Agent provided contextual response without tool calls: {response_content[:100]}...")

        print(f"✅ Search integration test passed. Tool calls: {len(tool_calls_made)}, Context response: {has_contextual_response}")

        # Response should include search results
        search_indicators = ["found", "search", "example", "resource", "result"]
        assert any(indicator in response_content.lower() for indicator in search_indicators), (
            f"Response should indicate search results. Got: {response_content}"
        )

        print(f"✅ Search integration test passed. Query: {search_query}")

    @pytest.mark.asyncio
    async def test_agent_handles_advanced_context(
        self, langgraph_client, advanced_teaching_context
    ):
        """
        RED: This test will fail initially.

        Test that agent adapts to more advanced lesson contexts
        and student progress levels.
        """
        thread = await langgraph_client.threads.create()

        input_data = {
            "messages": [
                HumanMessage(content="I'm struggling with finding common denominators. Can you help?")
            ],
            "session_context": advanced_teaching_context
        }

        response_content = ""
        async for chunk in langgraph_client.runs.stream(
            thread["thread_id"], "context-chat-agent",
            input=input_data, stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content += content

        # Should reference advanced context
        assert "denominator" in response_content.lower(), (
            f"Should address common denominator concept. Got: {response_content}"
        )

        # Should show understanding of intermediate level
        intermediate_indicators = ["intermediate", "next level", "building on", "since you know"]
        intermediate_found = any(indicator in response_content.lower() for indicator in intermediate_indicators)

        # Should reference prior knowledge appropriately
        prior_knowledge = ["equivalent", "basic", "foundation", "already learned"]
        prior_found = any(knowledge in response_content.lower() for knowledge in prior_knowledge)

        assert intermediate_found or prior_found, (
            f"Should acknowledge intermediate level or prior knowledge. Got: {response_content}"
        )

        print(f"✅ Advanced context test passed. Response: {response_content[:100]}...")

    @pytest.mark.asyncio
    async def test_agent_handles_no_teaching_context_gracefully(
        self, langgraph_client, no_context_session
    ):
        """
        RED: This test will fail initially.

        Test that agent handles requests without teaching context
        by operating in generic mode (but still not providing fallback responses).
        """
        thread = await langgraph_client.threads.create()

        input_data = {
            "messages": [
                HumanMessage(content="Can you help me understand fractions?")
            ],
            "session_context": no_context_session
        }

        response_content = ""
        async for chunk in langgraph_client.runs.stream(
            thread["thread_id"], "context-chat-agent",
            input=input_data, stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content += content

        # Should still provide helpful response even without context
        assert len(response_content) > 10, "Should provide response even without context"
        assert "fraction" in response_content.lower(), "Should address the topic"

        # But should NOT reference specific lesson content that doesn't exist
        specific_references = ["2/10", "current lesson", "we're studying"]
        assert not any(ref in response_content.lower() for ref in specific_references), (
            f"Should not reference non-existent lesson content. Got: {response_content}"
        )

        print(f"✅ No context handling test passed. Response: {response_content[:100]}...")


class TestContextProcessingEdgeCases:
    """Test edge cases and error conditions in context processing."""

    @pytest.mark.asyncio
    async def test_malformed_teaching_context(self, langgraph_client):
        """
        RED: This test will fail initially.

        Test agent behavior with malformed or incomplete teaching context.
        """
        thread = await langgraph_client.threads.create()

        # Malformed context with missing required fields
        malformed_context = {
            "session_id": "test_malformed",
            # Missing student_id, lesson_snapshot, main_graph_state
            "invalid_field": "should be ignored"
        }

        input_data = {
            "messages": [HumanMessage(content="Help me with math")],
            "session_context": malformed_context
        }

        # Should not crash, should handle gracefully
        response_content = ""
        try:
            async for chunk in langgraph_client.runs.stream(
                thread["thread_id"], "context-chat-agent",
                input=input_data, stream_mode=["messages"]
            ):
                if chunk.event == "messages/partial":
                    if chunk.data and len(chunk.data) > 0:
                        content = chunk.data[0].get("content", "")
                        if content:
                            response_content += content

        except Exception as e:
            pytest.fail(f"Agent should handle malformed context gracefully: {str(e)}")

        assert len(response_content) > 0, "Should provide some response despite malformed context"
        print(f"✅ Malformed context test passed.")

    @pytest.mark.asyncio
    async def test_empty_lesson_snapshot(self, langgraph_client):
        """
        RED: This test will fail initially.

        Test behavior when lesson_snapshot exists but is empty.
        """
        thread = await langgraph_client.threads.create()

        empty_lesson_context = {
            "session_id": "test_empty_lesson",
            "student_id": "student_test",
            "lesson_snapshot": {},  # Empty but present
            "main_graph_state": {
                "messages": [],
                "current_stage": "unknown"
            }
        }

        input_data = {
            "messages": [HumanMessage(content="What are we learning?")],
            "session_context": empty_lesson_context
        }

        response_content = ""
        async for chunk in langgraph_client.runs.stream(
            thread["thread_id"], "context-chat-agent",
            input=input_data, stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content += content

        # Should handle empty lesson gracefully
        assert len(response_content) > 0, "Should provide response for empty lesson"

        # Should not reference specific content that doesn't exist
        assert "undefined" not in response_content.lower(), "Should not show undefined values"
        assert "null" not in response_content.lower(), "Should not show null values"

        print(f"✅ Empty lesson snapshot test passed.")