"""Test client to demonstrate subgraph interrupt behavior.

This client will:
1. Start a graph that contains a subgraph with interrupt
2. Show how the parent node re-executes when resuming from interrupt
3. Compare with the documented LangGraph behavior
"""

import asyncio
from langgraph_sdk import get_client
from langgraph.types import Command


async def test_subgraph_interrupt():
    """Test the subgraph interrupt behavior."""
    client = get_client(url="http://localhost:2026")
    
    # Create thread
    thread = await client.threads.create()
    thread_id = thread["thread_id"]
    
    print("🚀 STARTING SUBGRAPH INTERRUPT TEST")
    print(f"Thread ID: {thread_id}")
    print("=" * 60)
    
    print("📍 PHASE 1: Initial run (will interrupt in subgraph)")
    print("-" * 60)
    
    # Start the graph - will interrupt in subgraph
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        result = await client.runs.create(
            thread_id=thread_id,
            assistant_id="agent",
            input={"count": 0, "messages": [], "interrupted": False}
        )
        
        run_id = result["run_id"]
        print(f"Created run: {run_id}")
        
        # Wait for the run to complete or interrupt
        await client.runs.join(thread_id, run_id)
        
        # Check if run was interrupted by examining the thread state
        run_status = await client.runs.get(thread_id, run_id)
        state = await client.threads.get_state(thread_id)
        
        # In LangGraph, interrupts cause the run to succeed but leave the graph waiting at next nodes
        interrupt_found = (run_status.get("status") == "success" and 
                          state.get("next") is not None and 
                          len(state.get("next", [])) > 0)
        
        print(f"Run status: {run_status.get('status')}")
        print(f"Thread next nodes: {state.get('next', [])}")
        if interrupt_found:
            print("🛑 INTERRUPT DETECTED! (Graph waiting at next nodes)")
        else:
            print("⚠️  No interrupt found - graph completed")
            
    except Exception as e:
        print(f"❌ Error in initial run: {e}")
        return
    
    print("\n📍 PHASE 2: Check interrupted state")
    print("-" * 60)
    
    try:
        state = await client.threads.get_state(thread_id)
        print(f"🔍 Current state:")
        print(f"   Next nodes: {state.get('next', 'None')}")
        print(f"   Values: {state.get('values', 'None')}")
        
        if state.get('next'):
            print(f"✅ Graph is waiting at: {state['next']}")
        else:
            print("⚠️  No next nodes - graph may have completed or errored")
            
    except Exception as e:
        print(f"❌ Error getting state: {e}")
        return
    
    print("\n📍 PHASE 3: Resume execution (parent node should re-execute)")
    print("-" * 60)
    
    try:
        # Resume with user response
        resume_result = await client.runs.create(
            thread_id=thread_id,
            assistant_id="agent",
            input=Command(resume="user_response_123")
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
        print(f"   Values: {final_state.get('values', 'None')}")
        print(f"   Next: {final_state.get('next', 'Completed')}")
        
    except Exception as e:
        print(f"❌ Error getting final state: {e}")
    
    print("\n" + "=" * 60)
    print("✅ TEST COMPLETED")
    print("💡 Expected behavior: Parent node executes twice")
    print("   - Once during initial run")
    print("   - Once again when resuming from interrupt")
    print("=" * 60)


async def test_simple_run():
    """Test a simple run without interrupts for comparison."""
    client = get_client(url="http://localhost:2027")
    
    # Create thread
    thread = await client.threads.create()
    thread_id = thread["thread_id"]
    
    print("🧪 SIMPLE TEST (no interrupts)")
    print(f"Thread ID: {thread_id}")
    
    try:
        result = await client.runs.create(
            thread_id=thread_id,
            assistant_id="agent",
            input={"count": 0, "messages": [], "interrupted": False}
        )
        
        run_id = result["run_id"]
        
        # Wait for completion
        await client.runs.join(thread_id, run_id)
        
        # Get final result
        final_state = await client.threads.get_state(thread_id)
        print(f"✅ Simple run completed: {final_state.get('values')}")
        
    except Exception as e:
        print(f"❌ Error in simple run: {e}")


if __name__ == "__main__":
    print("🔬 LANGGRAPH SUBGRAPH INTERRUPT TEST")
    print("This test demonstrates the documented behavior where parent")
    print("nodes re-execute when subgraphs with interrupts are resumed.")
    print()
    
    # Run the test
    asyncio.run(test_subgraph_interrupt())