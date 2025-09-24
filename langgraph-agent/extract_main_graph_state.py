"""Extract and dump the actual state from the main teaching graph."""

import asyncio
import json
from langchain_core.messages import HumanMessage
from langgraph_sdk import get_client

async def extract_teaching_state():
    """Connect to main graph and extract its state during a teaching session."""

    # Connect to the running LangGraph server on port 2024
    client = get_client(url="http://localhost:2024")  # Default langgraph dev port
    assistant_id = "agent"  # From langgraph.json

    # Create a thread for teaching session
    thread = await client.threads.create()
    print(f"Created thread: {thread['thread_id']}")

    # Start a teaching session with full context
    teaching_context = {
        "session_id": "test-extraction-session",
        "student_id": "test-student-123",
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
                    "cfu": {"type": "text", "answer": "1/5"}
                },
                {
                    "id": "card-2",
                    "content": "Which is larger: 3/4 or 2/3?",
                    "cfu": {"type": "mcq", "options": ["3/4", "2/3"], "correct": 0}
                }
            ]
        }
    }

    # Send initial message to trigger teaching mode
    input_data = {
        "messages": [HumanMessage(content="Let's start the lesson")],
        "session_context": teaching_context
    }

    # Run the graph and capture state
    print("\n=== Sending input to main graph ===")
    print(json.dumps(teaching_context, indent=2))

    # Stream the response and capture state updates
    state_snapshots = []

    async for chunk in client.runs.stream(
        thread["thread_id"],
        assistant_id,
        input=input_data,
        stream_mode=["values", "updates", "debug"]  # Get all state information
    ):
        if chunk.event == "values":
            # This is a complete state snapshot
            step_info = getattr(chunk, 'metadata', {}).get('step', 'unknown') if hasattr(chunk, 'metadata') else 'unknown'
            print(f"\n=== State Snapshot at {step_info} ===")
            state_snapshots.append(chunk.data)

            # Save the state to file
            with open(f"state_snapshot_{len(state_snapshots)}.json", "w") as f:
                json.dump(chunk.data, f, indent=2, default=str)
                print(f"Saved state snapshot {len(state_snapshots)}")

        elif chunk.event == "debug":
            print(f"DEBUG: {chunk.data}")
        elif chunk.event == "updates":
            print(f"UPDATE: {chunk.data}")

    # Get the final state
    final_state = await client.threads.get_state(thread["thread_id"])

    print("\n=== FINAL STATE STRUCTURE ===")
    print("Keys available:", list(final_state.keys()))

    # Save complete final state
    with open("final_teaching_state.json", "w") as f:
        json.dump(final_state, f, indent=2, default=str)
        print("Saved final state to final_teaching_state.json")

    # Analyze state structure
    print("\n=== STATE ANALYSIS ===")
    analyze_state_structure(final_state)

    return final_state

def analyze_state_structure(state):
    """Analyze and print the structure of the state."""

    def print_structure(obj, prefix="", max_depth=3, current_depth=0):
        if current_depth >= max_depth:
            return

        if isinstance(obj, dict):
            for key, value in obj.items():
                print(f"{prefix}{key}: {type(value).__name__}")
                if isinstance(value, (dict, list)):
                    print_structure(value, prefix + "  ", max_depth, current_depth + 1)
                elif isinstance(value, str) and len(value) < 50:
                    print(f"{prefix}  = '{value}'")
        elif isinstance(obj, list) and len(obj) > 0:
            print(f"{prefix}[0]: {type(obj[0]).__name__}")
            if isinstance(obj[0], (dict, list)):
                print_structure(obj[0], prefix + "  ", max_depth, current_depth + 1)

    print_structure(state)

if __name__ == "__main__":
    asyncio.run(extract_teaching_state())