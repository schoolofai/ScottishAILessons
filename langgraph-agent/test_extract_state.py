"""Simple test to extract actual state from the main langgraph agent running on port 2024."""

import asyncio
import json
from langchain_core.messages import HumanMessage
from langgraph_sdk import get_client


async def test_extract_main_graph_state():
    """Connect to the main graph and extract its teaching state."""

    # Connect to the main graph running on port 2024
    client = get_client(url="http://localhost:2024")
    assistant_id = "agent"  # From langgraph.json

    print("🔌 Connected to main graph on port 2024")

    # Create a thread for teaching session
    thread = await client.threads.create()
    print(f"📝 Created thread: {thread['thread_id']}")

    # Prepare teaching context (what the frontend would send)
    teaching_context = {
        "session_id": "test-state-extraction",
        "student_id": "test-student-456",
        "lesson_snapshot": {
            "courseId": "math-fractions-advanced",
            "title": "Advanced Fraction Operations",
            "topic": "Mathematics - Fraction Operations",
            "objectives": [
                "Add and subtract fractions with different denominators",
                "Multiply and divide fractions",
                "Solve word problems involving fractions"
            ],
            "cards": [
                {
                    "id": "card-1",
                    "content": "Add 1/4 + 2/3 by finding a common denominator",
                    "cfu": {"type": "text", "answer": "11/12"}
                },
                {
                    "id": "card-2",
                    "content": "Solve: 3/5 × 2/7",
                    "cfu": {"type": "text", "answer": "6/35"}
                }
            ]
        }
    }

    # Send message to trigger teaching mode
    input_data = {
        "messages": [HumanMessage(content="I need help with advanced fractions")],
        "session_context": teaching_context
    }

    print("📤 Sending input to main graph...")

    # Run one step to get the graph into teaching mode
    async for chunk in client.runs.stream(
        thread["thread_id"],
        assistant_id,
        input=input_data,
        stream_mode=["values"]
    ):
        if chunk.event == "values":
            print(f"📊 Received state snapshot")
            break

    # Extract the final state
    final_state = await client.threads.get_state(thread["thread_id"])

    print("🎯 Extracted final state structure!")
    print(f"📋 Available keys: {list(final_state.keys())}")

    # Save the extracted state
    with open("extracted_main_graph_state.json", "w") as f:
        json.dump(final_state, f, indent=2, default=str)

    print("💾 Saved state to: extracted_main_graph_state.json")

    # Also save just the values portion (this is what the generic chat needs)
    state_values = final_state.get("values", {})
    with open("main_graph_state_values.json", "w") as f:
        json.dump(state_values, f, indent=2, default=str)

    print("💾 Saved state.values to: main_graph_state_values.json")

    # Print summary of key fields
    print("\n🔍 KEY STATE FIELDS FOUND:")
    if state_values:
        print(f"  📌 Mode: {state_values.get('mode', 'NOT_FOUND')}")
        print(f"  📌 Session ID: {state_values.get('session_id', 'NOT_FOUND')}")
        print(f"  📌 Student ID: {state_values.get('student_id', 'NOT_FOUND')}")
        print(f"  📌 Course ID: {state_values.get('course_id', 'NOT_FOUND')}")
        print(f"  📌 Messages count: {len(state_values.get('messages', []))}")
        print(f"  📌 Interrupt count: {state_values.get('interrupt_count', 'NOT_FOUND')}")

        lesson_snapshot = state_values.get('lesson_snapshot', {})
        if lesson_snapshot:
            print(f"  📌 Lesson title: {lesson_snapshot.get('title', 'NOT_FOUND')}")
            print(f"  📌 Lesson topic: {lesson_snapshot.get('topic', 'NOT_FOUND')}")
            print(f"  📌 Cards count: {len(lesson_snapshot.get('cards', []))}")

    return final_state


if __name__ == "__main__":
    print("🚀 Starting state extraction test...")
    asyncio.run(test_extract_main_graph_state())
    print("✅ State extraction complete!")