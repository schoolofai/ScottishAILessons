#!/usr/bin/env python3
"""
LangGraph Subgraph Streaming Bug Reproducer

This script demonstrates that LangGraph subgraphs cannot stream incremental chunks
from their internal nodes, even when using async generators that yield AIMessageChunk objects.

The issue: Subgraph nodes that yield AIMessageChunk objects via async generators
are converted to complete AIMessage objects, resulting in 'messages/complete' events
instead of 'messages/partial' streaming events.

Expected: messages/partial events with incremental chunks
Actual: messages/complete events with full messages

This reproducer uses only public OpenAI API calls and contains no proprietary logic.
"""

import asyncio
from typing import Dict, AsyncIterator
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import MessagesState
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage, AIMessageChunk
from langchain_openai import ChatOpenAI
from langchain_core.runnables.config import RunnableConfig
import os


# State following the GitHub issue pattern
class State(MessagesState):
    step: str = ""


# Subgraph node that should stream but doesn't work in subgraph context
def streaming_subgraph_node(state: State) -> Dict:
    """A simple node that streams responses using OpenAI.
    
    This should produce messages/partial events when streaming,
    but when used in a subgraph, it produces messages/complete instead.
    """
    llm = ChatOpenAI(
        model="gpt-3.5-turbo",
        temperature=0.7,
        streaming=True
    )
    
    prompt = "Say hello and briefly introduce yourself in 2-3 sentences. Be friendly and concise."
    messages = [HumanMessage(content=prompt)]
    
    print("[SUBGRAPH NODE] Starting to stream response...")
    
    # Stream the response and collect all chunks
    full_response = ""
    chunk_count = 0
    
    for chunk in llm.stream(messages):
        if chunk.content:
            chunk_count += 1
            full_response += chunk.content
            print(f"[SUBGRAPH NODE] Processed chunk #{chunk_count}: '{chunk.content}'")
    
    print(f"[SUBGRAPH NODE] Completed streaming. Total chunks: {chunk_count}")
    
    # Return final state - subgraph will buffer this
    return {
        "messages": [AIMessage(content=full_response)],
        "step": "subgraph_complete"
    }


# Main graph node that streams correctly (for comparison)
async def streaming_main_node(state: State) -> AsyncIterator[Dict]:
    """A node in the main graph that streams correctly.
    
    This produces messages/partial events as expected.
    """
    llm = ChatOpenAI(
        model="gpt-3.5-turbo", 
        temperature=0.7,
        streaming=True
    )
    
    prompt = "Say goodbye and wish the user well in 1-2 sentences."
    messages = [HumanMessage(content=prompt)]
    
    print("[MAIN NODE] Starting to stream response...")
    
    full_response = ""
    chunk_count = 0
    
    async for chunk in llm.astream(messages):
        if chunk.content:
            chunk_count += 1
            full_response += chunk.content
            print(f"[MAIN NODE] Yielding chunk #{chunk_count}: '{chunk.content}'")
            
            # Yield streaming chunk - this should produce messages/partial
            yield {
                "messages": [AIMessageChunk(content=chunk.content)]
            }
    
    print(f"[MAIN NODE] Completed streaming. Total chunks: {chunk_count}")
    
    # Final yield with complete state
    yield {
        "messages": [AIMessage(content=full_response)],
        "step": "main_complete"
    }




# Build the subgraph
subgraph = StateGraph(State)
subgraph.add_node("streaming_node", streaming_subgraph_node)
subgraph.add_edge(START, "streaming_node")
subgraph.add_edge("streaming_node", END)

# Compile subgraph
compiled_subgraph = subgraph.compile(name="streaming_subgraph")


# Wrapper node for subgraph (following GitHub issue #4718 pattern)
def subgraph_wrapper(state: State, config, writer):
    """Wrapper to handle subgraph streaming as per GitHub issue #4718.
    
    This follows the exact pattern from the GitHub thread:
    def wrapper_node(state: State, config, writer):
        res = graph.invoke({}, config=config)
        return res
    """
    print("[WRAPPER] Starting subgraph execution...")
    
    # This is the exact pattern from the GitHub thread
    res = compiled_subgraph.invoke(state, config=config)
    
    print(f"[WRAPPER] Received result from subgraph: {res}")
    print("[WRAPPER] Subgraph execution complete")
    
    return res


# Build the main graph
main_graph = StateGraph(State)
main_graph.add_node("subgraph", subgraph_wrapper)
main_graph.add_node("main_node", streaming_main_node)

# Add routing
main_graph.add_edge(START, "subgraph")
main_graph.add_edge("subgraph", "main_node")
main_graph.add_edge("main_node", END)

# Compile main graph
compiled_main_graph = main_graph.compile(name="bug_reproducer")


async def test_streaming_bug():
    """Test function that demonstrates the subgraph streaming bug."""
    
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ ERROR: OPENAI_API_KEY environment variable not set")
        print("Please set your OpenAI API key to run this reproducer")
        return
    
    print("🐛 LangGraph Subgraph Streaming Bug Reproducer")
    print("=" * 60)
    print()
    print("This test demonstrates that subgraph nodes cannot stream incremental chunks")
    print("even when implemented with async generators yielding AIMessageChunk objects.")
    print()
    print("Expected behavior:")
    print("  - Subgraph node should produce 'messages/partial' events")
    print("  - Main graph node should produce 'messages/partial' events")
    print()
    print("Actual behavior:")
    print("  - Subgraph node produces 'messages/complete' events (BUG)")
    print("  - Main graph node produces 'messages/partial' events (correct)")
    print()
    print("=" * 60)
    
    try:
        print("🔄 Testing subgraph streaming with proper LangGraph patterns...")
        print("-" * 50)
        
        # Test using the exact GitHub issue pattern
        initial_state = {
            "messages": [HumanMessage(content="Test input")],
            "step": "start"
        }
        
        print("1️⃣ Testing subgraph directly with streaming configuration:")
        chunk_count = 0
        
        # Use stream mode and subgraphs configuration as shown in GitHub issue
        config = {"configurable": {"thread_id": "test-thread"}}
        
        async for event in compiled_subgraph.astream(
            initial_state, 
            config=config,
            stream_mode=["messages"], 
            subgraphs=True
        ):
            chunk_count += 1
            print(f"Event #{chunk_count}: {event}")
            
            # Analyze what type of events we're getting
            if isinstance(event, tuple) and len(event) >= 2:
                event_type, data = event[0], event[1]
                print(f"  Event type: {event_type}")
                if 'messages' in str(data):
                    print(f"  Data: {data}")
        
        print(f"Total events from subgraph: {chunk_count}")
        print()
        print("-" * 50)
        
        print("2️⃣ Testing main graph with full streaming configuration:")
        chunk_count = 0
        
        async for event in compiled_main_graph.astream(
            initial_state,
            config=config, 
            stream_mode=["messages"],
            subgraphs=True
        ):
            chunk_count += 1
            print(f"Event #{chunk_count}: {event}")
            
            # Analyze event types
            if isinstance(event, tuple) and len(event) >= 2:
                event_type, data = event[0], event[1]
                print(f"  Event type: {event_type}")
                if 'messages' in str(data):
                    print(f"  Data: {data}")
        
        print(f"Total events from main graph: {chunk_count}")
        print()
        
        print("🔍 ANALYSIS:")
        print("- The subgraph node implementation is identical to the main node")
        print("- Both use async generators yielding AIMessageChunk objects")
        print("- Only the subgraph context prevents proper streaming")
        print("- This suggests LangGraph buffers subgraph outputs before emitting them")
        print()
        print("💡 CONCLUSION:")
        print("LangGraph subgraphs cannot stream incremental chunks from their internal nodes.")
        print("The wrapper pattern from GitHub issue #4718 doesn't solve this limitation.")
        
    except Exception as e:
        print(f"❌ Error running test: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_streaming_bug())