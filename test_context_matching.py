"""Test to verify that the generic chat can process the actual main graph state structure."""

import asyncio
import json
from langchain_core.messages import HumanMessage
from langgraph_sdk import get_client


# Load the actual extracted state from the main graph
def load_actual_main_graph_state():
    """Load the state structure extracted from the running main graph."""
    with open("langgraph-agent/main_graph_state_values.json", "r") as f:
        return json.load(f)


async def test_generic_chat_with_actual_state():
    """Test the generic chat with the exact state structure from the main graph."""

    print("🔍 Loading actual main graph state structure...")
    main_graph_state = load_actual_main_graph_state()

    # Create the session context that the frontend would send to generic chat
    # This should match exactly what the frontend extracts from the main graph
    session_context = {
        "session_id": main_graph_state["session_id"],
        "student_id": main_graph_state["student_id"],
        "lesson_snapshot": main_graph_state["lesson_snapshot"],
        "main_graph_state": main_graph_state  # The complete state snapshot
    }

    print("📋 Created session context for generic chat:")
    print(f"  - Session ID: {session_context['session_id']}")
    print(f"  - Student ID: {session_context['student_id']}")
    print(f"  - Course ID: {main_graph_state.get('course_id')}")
    print(f"  - Lesson: {session_context['lesson_snapshot']['title']}")
    print(f"  - Messages: {len(main_graph_state.get('messages', []))}")

    # Connect to the generic chat agent (port 2700)
    client = get_client(url="http://localhost:2700")
    assistant_id = "context-chat-agent"

    print("\n🔌 Connecting to generic chat on port 2700...")

    # Create thread for generic chat
    thread = await client.threads.create()
    print(f"📝 Created thread: {thread['thread_id']}")

    # Test with a question that should use intermediate-level language
    input_data = {
        "messages": [
            HumanMessage(content="Since I already understand basic fractions, what should I learn next?")
        ],
        "session_context": session_context
    }

    print("📤 Sending question to generic chat with actual main graph context...")

    # Stream the response
    response_content = ""
    try:
        async for chunk in client.runs.stream(
            thread["thread_id"],
            assistant_id,
            input=input_data,
            stream_mode=["messages"]
        ):
            if chunk.event == "messages/partial":
                if chunk.data and len(chunk.data) > 0:
                    content = chunk.data[0].get("content", "")
                    if content:
                        response_content += content

        print("\n🎯 RESPONSE FROM GENERIC CHAT:")
        print("=" * 50)
        print(response_content)
        print("=" * 50)

        # Check for intermediate level language indicators
        intermediate_indicators = [
            "since you know", "building on", "next level", "intermediate",
            "already learned", "foundation", "basic", "equivalent"
        ]

        found_indicators = []
        for indicator in intermediate_indicators:
            if indicator in response_content.lower():
                found_indicators.append(indicator)

        print(f"\n📊 INTERMEDIATE LANGUAGE INDICATORS FOUND: {len(found_indicators)}")
        if found_indicators:
            for indicator in found_indicators:
                print(f"  ✅ '{indicator}'")
        else:
            print("  ❌ No intermediate language indicators found")

        # Check if it mentions the actual lesson content
        lesson_indicators = ["fraction", "denominator", "advanced", "operations"]
        lesson_found = []
        for indicator in lesson_indicators:
            if indicator in response_content.lower():
                lesson_found.append(indicator)

        print(f"\n📚 LESSON CONTEXT USAGE: {len(lesson_found)} indicators")
        if lesson_found:
            for indicator in lesson_found:
                print(f"  ✅ '{indicator}'")
        else:
            print("  ❌ No lesson context indicators found")

        return {
            "response": response_content,
            "intermediate_indicators": found_indicators,
            "lesson_indicators": lesson_found,
            "success": len(found_indicators) > 0 or len(lesson_found) > 0
        }

    except Exception as e:
        print(f"❌ Error during streaming: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    print("🚀 Testing generic chat with actual main graph state...")
    result = asyncio.run(test_generic_chat_with_actual_state())

    if result.get("success"):
        print("\n✅ SUCCESS: Generic chat is processing main graph context correctly!")
    else:
        print("\n❌ ISSUE: Generic chat may not be using context as expected")
        if result.get("error"):
            print(f"Error: {result['error']}")

    print("\n🎯 This demonstrates the exact context structure that generic chat needs to expect.")