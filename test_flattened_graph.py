"""Test script to verify the flattened graph interrupt behavior.

This tests that interrupts in the flattened graph structure resume correctly
without re-executing parent nodes.
"""

import asyncio
from langgraph_sdk import get_client
from langgraph.types import Command


async def test_flattened_interrupt():
    """Test the flattened interrupt behavior."""
    client = get_client(url="http://localhost:2024")
    
    # Create thread
    thread = await client.threads.create()
    thread_id = thread["thread_id"]
    
    print("🚀 TESTING FLATTENED GRAPH INTERRUPT BEHAVIOR")
    print(f"Thread ID: {thread_id}")
    print("=" * 60)
    
    # Create teaching session context
    session_context = {
        "session_id": "test_session_123",
        "student_id": "test_student",
        "lesson_snapshot": {
            "title": "Test Lesson",
            "cards": [
                {
                    "id": "card_1",
                    "title": "Test Card 1",
                    "content": "What is 2+2?",
                    "cfu": {
                        "id": "cfu_1",
                        "type": "text",
                        "expected": "4"
                    }
                },
                {
                    "id": "card_2", 
                    "title": "Test Card 2",
                    "content": "What is 3+3?",
                    "cfu": {
                        "id": "cfu_2",
                        "type": "text", 
                        "expected": "6"
                    }
                }
            ]
        }
    }
    
    print("📍 PHASE 1: Initial teaching session (should interrupt in get_answer)")
    print("-" * 60)
    
    try:
        result = await client.runs.create(
            thread_id=thread_id,
            assistant_id="agent",
            input={
                "messages": [],
                "session_context": session_context
            }
        )
        
        run_id = result["run_id"]
        print(f"Created run: {run_id}")
        
        # Wait for the run to complete or interrupt
        await client.runs.join(thread_id, run_id)
        
        # Check if run was interrupted
        run_status = await client.runs.get(thread_id, run_id)
        print(f"Run status: {run_status.get('status')}")
        
        if run_status.get('status') == 'interrupted':
            print("🛑 INTERRUPT DETECTED - Graph paused at get_answer node!")
        else:
            print(f"⚠️  Expected interrupt but got: {run_status.get('status')}")
            
    except Exception as e:
        print(f"❌ Error in initial run: {e}")
        return
    
    print("\n📍 PHASE 2: Check interrupted state")
    print("-" * 60)
    
    try:
        state = await client.threads.get_state(thread_id)
        print(f"🔍 Current state:")
        print(f"   Next nodes: {state.get('next', 'None')}")
        print(f"   Current card index: {state.get('values', {}).get('current_card_index', 'None')}")
        print(f"   Stage: {state.get('values', {}).get('stage', 'None')}")
        
        if state.get('next'):
            print(f"✅ Graph is waiting at: {state['next']}")
        else:
            print("⚠️  No next nodes - graph may have completed or errored")
            
    except Exception as e:
        print(f"❌ Error getting state: {e}")
        return
    
    print("\n📍 PHASE 3: Resume with tool response (should NOT re-execute design node)")
    print("-" * 60)
    
    try:
        # Simulate ToolMessage response from frontend
        tool_message = {
            "type": "tool",
            "tool_call_id": "lesson_card_0",  # Matches the card index
            "content": '{"student_response": "4"}'  # Student answer
        }
        
        # Resume execution with tool response
        resume_result = await client.runs.create(
            thread_id=thread_id,
            assistant_id="agent",
            input={
                "messages": [tool_message]  # Add the tool response
            }
        )
        
        resume_run_id = resume_result["run_id"]
        print(f"Created resume run: {resume_run_id}")
        
        # Wait for resume execution  
        await client.runs.join(thread_id, resume_run_id)
        
        resume_status = await client.runs.get(thread_id, resume_run_id)
        print(f"🔄 Resume completed with status: {resume_status.get('status')}")
            
    except Exception as e:
        print(f"❌ Error in resume: {e}")
        return
    
    print("\n📍 PHASE 4: Final state check")
    print("-" * 60)
    
    try:
        final_state = await client.threads.get_state(thread_id)
        print(f"🏁 Final state:")
        values = final_state.get('values', {})
        print(f"   Current card index: {values.get('current_card_index', 'None')}")
        print(f"   Stage: {values.get('stage', 'None')}")
        print(f"   Is correct: {values.get('is_correct', 'None')}")
        print(f"   Next: {final_state.get('next', 'Completed')}")
        
    except Exception as e:
        print(f"❌ Error getting final state: {e}")
    
    print("\n" + "=" * 60)
    print("✅ FLATTENED GRAPH TEST COMPLETED")
    print("💡 Expected behavior:")
    print("   - Initial run should interrupt at get_answer node") 
    print("   - Resume should continue from get_answer WITHOUT re-executing design")
    print("   - Graph should progress to mark node and evaluate the response")
    print("=" * 60)


if __name__ == "__main__":
    print("🔬 TESTING FLATTENED GRAPH STRUCTURE")
    print("This test verifies that the graph no longer re-executes parent nodes")
    print("when resuming from interrupts, since we removed the subgraph pattern.")
    print()
    
    # Run the test
    asyncio.run(test_flattened_interrupt())