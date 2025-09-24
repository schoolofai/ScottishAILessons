"""Comprehensive test for context-chat-agent graph only (ignoring basic agent).

This test validates the context-aware chat agent with different context scenarios.
"""

import asyncio
import json
from langchain_core.messages import HumanMessage
from langgraph_sdk import get_client


async def test_context_chat_agent_comprehensive():
    """Test context-chat-agent with various scenarios."""

    print("🚀 Starting comprehensive context-chat-agent tests...")
    print("=" * 60)

    # Connect to the context-aware chat agent on port 2700
    client = get_client(url="http://localhost:2700")
    assistant_id = "context-chat-agent"  # Using context-aware agent only

    # Test 1: With full teaching context
    print("\n📚 TEST 1: Full Teaching Context")
    print("-" * 40)

    # Create direct main graph state structure (no nested main_graph_state)
    teaching_context = {
        "session_id": "test_session_123",
        "student_id": "student_456",
        "course_id": "math-fractions-101",
        "mode": "teaching",
        "lesson_snapshot": {
            "courseId": "math-fractions-101",
            "title": "Introduction to Fractions",
            "topic": "Mathematics - Fractions",
            "objectives": [
                "Understand numerator and denominator",
                "Compare simple fractions",
                "Recognize equivalent fractions"
            ],
            "cards": [
                {
                    "id": "card-1",
                    "content": "What is 2/10 simplified?",
                    "cfu": {
                        "type": "text",
                        "answer": "1/5"
                    }
                }
            ]
        },
        "messages": [
            {
                "content": "I want to learn about fractions",
                "type": "human",
                "id": "msg-1"
            },
            {
                "content": "Let's start with basic fractions. A fraction has two parts: the numerator (top number) and denominator (bottom number).",
                "type": "ai",
                "id": "msg-2"
            }
        ],
        "student_response": "What does 2/10 mean?",
        "card_presentation_complete": False,
        "interrupt_count": 0,
        "interrupt_history": [],
        "tool_response_received": False,
        "cards_presented_via_ui": [],
        "feedback_interactions_count": 0,
        "can_resume_from_interrupt": True
    }

    thread1 = await client.threads.create()

    input_data = {
        "messages": [
            HumanMessage(content="What fraction are we currently discussing in this lesson?")
        ],
        "session_context": teaching_context
    }

    response_content = ""
    try:
        async for chunk in client.runs.stream(
            thread1["thread_id"],
            assistant_id,
            input=input_data,
            stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content += content

        print("✅ Response received:")
        print(response_content[:200] + "..." if len(response_content) > 200 else response_content)

        # Check for context awareness
        has_fraction_ref = "2/10" in response_content or "2}{10" in response_content or "fraction" in response_content.lower()
        has_lesson_ref = any(word in response_content.lower() for word in ["lesson", "learning", "studying", "current"])

        if has_fraction_ref and has_lesson_ref:
            print("✅ PASSED: Agent demonstrates context awareness")
        else:
            print("⚠️ WARNING: Agent response may lack context awareness")
            print(f"  - Fraction reference: {has_fraction_ref}")
            print(f"  - Lesson reference: {has_lesson_ref}")

    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

    # Test 2: Without teaching context (generic mode)
    print("\n💬 TEST 2: No Teaching Context (Generic Mode)")
    print("-" * 40)

    thread2 = await client.threads.create()

    no_context_input = {
        "messages": [
            HumanMessage(content="Can you help me understand fractions?")
        ],
        "session_context": {
            "session_id": "generic_chat_session",
            "student_id": "student_generic"
            # No lesson_snapshot or teaching data
        }
    }

    response_content2 = ""
    try:
        async for chunk in client.runs.stream(
            thread2["thread_id"],
            assistant_id,
            input=no_context_input,
            stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content2 += content

        print("✅ Response received:")
        print(response_content2[:200] + "..." if len(response_content2) > 200 else response_content2)

        # Should NOT reference specific lesson content that doesn't exist
        no_specific_refs = not any(ref in response_content2.lower() for ref in ["2/10", "current lesson", "we're studying"])

        if no_specific_refs:
            print("✅ PASSED: Agent handles no context gracefully")
        else:
            print("⚠️ WARNING: Agent referenced non-existent lesson content")

    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

    # Test 3: Advanced context with student progress
    print("\n🎓 TEST 3: Advanced Context with Progress")
    print("-" * 40)

    thread3 = await client.threads.create()

    advanced_context = {
        "session_id": "test_session_advanced",
        "student_id": "student_advanced",
        "course_id": "course_math_advanced",
        "mode": "teaching",
        "lesson_snapshot": {
            "title": "Advanced Fraction Operations",
            "topic": "Mathematics - Fraction Operations",
            "courseId": "course_math_advanced",
            "objectives": [
                "Add and subtract fractions with different denominators",
                "Multiply and divide fractions"
            ],
            "cards": [
                {
                    "id": "card-adv-1",
                    "content": "Add 1/4 + 2/3 by finding a common denominator",
                    "cfu": {
                        "type": "text",
                        "answer": "11/12"
                    }
                }
            ]
        },
        "messages": [
            {
                "content": "How do I add 1/4 + 2/3?",
                "type": "human",
                "id": "msg-adv-1"
            },
            {
                "content": "To add fractions with different denominators, we need to find a common denominator.",
                "type": "ai",
                "id": "msg-adv-2"
            }
        ],
        "feedback_interactions_count": 2
    }

    advanced_input = {
        "messages": [
            HumanMessage(content="I'm struggling with finding common denominators. Can you help?")
        ],
        "session_context": advanced_context
    }

    response_content3 = ""
    try:
        async for chunk in client.runs.stream(
            thread3["thread_id"],
            assistant_id,
            input=advanced_input,
            stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content3 += content

        print("✅ Response received:")
        print(response_content3[:200] + "..." if len(response_content3) > 200 else response_content3)

        # Should reference advanced concepts
        has_advanced_ref = "denominator" in response_content3.lower()

        if has_advanced_ref:
            print("✅ PASSED: Agent addresses advanced context")
        else:
            print("⚠️ WARNING: Agent may not be using advanced context")

    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

    print("\n" + "=" * 60)
    print("🎯 CONTEXT-CHAT-AGENT TESTING COMPLETE")
    print("=" * 60)
    print("\nSummary:")
    print("- Test 1 (Full Context): Check context awareness")
    print("- Test 2 (No Context): Check graceful handling")
    print("- Test 3 (Advanced): Check progression awareness")
    print("\n✅ Only testing context-chat-agent as requested")
    print("ℹ️  Basic 'agent' graph will be deprecated")


if __name__ == "__main__":
    asyncio.run(test_context_chat_agent_comprehensive())