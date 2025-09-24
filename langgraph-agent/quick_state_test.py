"""Quick test to dump main graph state."""

import asyncio
import json
from langgraph_sdk import get_client
from langchain_core.messages import HumanMessage

async def main():
    # Connect to main graph on port 2024
    client = get_client(url="http://localhost:2024")

    # Create thread
    thread = await client.threads.create()
    print(f"Thread ID: {thread['thread_id']}")

    # Simple teaching context
    context = {
        "session_id": "test-123",
        "student_id": "student-456",
        "lesson_snapshot": {
            "courseId": "math-101",
            "title": "Fractions",
            "topic": "Math",
            "objectives": ["Learn fractions"]
        }
    }

    # Send message
    input_data = {
        "messages": [HumanMessage(content="Start lesson")],
        "session_context": context
    }

    # Run and get state
    async for chunk in client.runs.stream(
        thread["thread_id"],
        "agent",
        input=input_data,
        stream_mode=["values"]
    ):
        if chunk.event == "values":
            print("\n=== STATE VALUES ===")
            print(json.dumps(chunk.data, indent=2, default=str))
            break

    # Get final state
    state = await client.threads.get_state(thread["thread_id"])

    # Save to file
    with open("main_graph_state.json", "w") as f:
        json.dump(state, f, indent=2, default=str)

    print(f"\nState saved to main_graph_state.json")
    print(f"State keys: {list(state.get('values', {}).keys())}")

if __name__ == "__main__":
    asyncio.run(main())