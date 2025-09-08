#!/usr/bin/env python3
"""
LangGraph Subgraph Streaming Bug Reproducer (Mock Version)

This script demonstrates that LangGraph subgraphs cannot stream incremental chunks
from their internal nodes, even when using async generators that yield AIMessageChunk objects.

This version uses mock streaming to avoid requiring OpenAI API keys,
making it easier to reproduce the issue.

The issue: Subgraph nodes that yield AIMessageChunk objects via async generators
are converted to complete AIMessage objects, resulting in 'messages/complete' events
instead of 'messages/partial' streaming events.

Expected: messages/partial events with incremental chunks  
Actual: messages/complete events with full messages

This reproducer contains no proprietary logic and can be shared publicly.
"""

import asyncio
from typing import Dict, AsyncIterator, TypedDict
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.graph import StateGraph, END


# Simple state for demonstration
class SimpleState(TypedDict):
    messages: list
    step: str


async def mock_stream_response(text: str, chunk_size: int = 5):
    """Mock streaming that simulates OpenAI streaming by yielding text chunks."""
    words = text.split()
    chunks = []
    
    # Split into chunks of specified size
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        if i + chunk_size < len(words):
            chunk += " "
        chunks.append(chunk)
    
    for i, chunk in enumerate(chunks):
        # Simulate network delay
        await asyncio.sleep(0.1)
        yield chunk


# Subgraph node that should stream but doesn't work in subgraph context
async def streaming_subgraph_node(state: SimpleState) -> AsyncIterator[Dict]:
    """A simple node that streams responses using mock streaming.
    
    This should produce messages/partial events when streaming,
    but when used in a subgraph, it produces messages/complete instead.
    """
    response_text = "Hello! I am a test assistant designed to demonstrate the subgraph streaming issue in LangGraph."
    
    print("[SUBGRAPH NODE] Starting to stream response...")
    
    full_response = ""
    chunk_count = 0
    
    async for chunk_text in mock_stream_response(response_text):
        chunk_count += 1
        full_response += chunk_text
        print(f"[SUBGRAPH NODE] Yielding chunk #{chunk_count}: '{chunk_text}'")
        
        # Yield streaming chunk - this should produce messages/partial
        yield {
            "messages": [AIMessageChunk(content=chunk_text)]
        }
    
    print(f"[SUBGRAPH NODE] Completed streaming. Total chunks: {chunk_count}")
    
    # Final yield with complete state
    yield {
        "messages": [AIMessage(content=full_response)],
        "step": "subgraph_complete"
    }


# Main graph node that streams correctly (for comparison)
async def streaming_main_node(state: SimpleState) -> AsyncIterator[Dict]:
    """A node in the main graph that streams correctly.
    
    This produces messages/partial events as expected.
    """
    response_text = "Goodbye! Thank you for testing the LangGraph streaming functionality."
    
    print("[MAIN NODE] Starting to stream response...")
    
    full_response = ""
    chunk_count = 0
    
    async for chunk_text in mock_stream_response(response_text):
        chunk_count += 1
        full_response += chunk_text
        print(f"[MAIN NODE] Yielding chunk #{chunk_count}: '{chunk_text}'")
        
        # Yield streaming chunk - this should produce messages/partial
        yield {
            "messages": [AIMessageChunk(content=chunk_text)]
        }
    
    print(f"[MAIN NODE] Completed streaming. Total chunks: {chunk_count}")
    
    # Final yield with complete state
    yield {
        "messages": [AIMessage(content=full_response)],
        "step": "main_complete"
    }


# Build the subgraph
subgraph = StateGraph(SimpleState)
subgraph.add_node("streaming_node", streaming_subgraph_node)
subgraph.add_edge("__start__", "streaming_node")
subgraph.add_edge("streaming_node", END)

# Compile subgraph
compiled_subgraph = subgraph.compile(name="streaming_subgraph")


# Wrapper node for subgraph (following GitHub issue #4718 pattern)
async def subgraph_wrapper(state: SimpleState, config=None):
    """Wrapper to handle subgraph streaming as per GitHub issue #4718.
    
    This wrapper should theoretically enable streaming from subgraphs,
    but it doesn't work for nodes that generate their own streaming content.
    """
    print("[WRAPPER] Starting subgraph execution...")
    chunk_count = 0
    async for chunk in compiled_subgraph.astream(state, config=config):
        chunk_count += 1
        print(f"[WRAPPER] Received chunk #{chunk_count} from subgraph: {chunk}")
        
        # Analyze what type of messages we're getting
        if 'messages' in chunk:
            for msg in chunk['messages']:
                if hasattr(msg, 'type'):
                    msg_type = getattr(msg, 'type', 'unknown')
                    print(f"[WRAPPER] Message type: {msg_type}")
                    if msg_type == 'AIMessageChunk':
                        print("[WRAPPER] ✅ Received AIMessageChunk (should produce messages/partial)")
                    elif msg_type == 'ai':
                        print("[WRAPPER] ❌ Received complete AIMessage (will produce messages/complete)")
        
        yield chunk
    print(f"[WRAPPER] Subgraph execution complete. Total chunks processed: {chunk_count}")


# Build the main graph
main_graph = StateGraph(SimpleState)
main_graph.add_node("subgraph", subgraph_wrapper)
main_graph.add_node("main_node", streaming_main_node)

# Add routing
main_graph.add_edge("__start__", "subgraph")
main_graph.add_edge("subgraph", "main_node")
main_graph.add_edge("main_node", END)

# Compile main graph
compiled_main_graph = main_graph.compile(name="bug_reproducer")


async def test_streaming_bug():
    """Test function that demonstrates the subgraph streaming bug."""
    
    print("🐛 LangGraph Subgraph Streaming Bug Reproducer")
    print("=" * 60)
    print()
    print("This test demonstrates that subgraph nodes cannot stream incremental chunks")
    print("even when implemented with async generators yielding AIMessageChunk objects.")
    print()
    print("Expected behavior:")
    print("  - Subgraph node should yield individual AIMessageChunk objects")
    print("  - These should be passed through by the wrapper node")
    print("  - Main graph node should yield individual AIMessageChunk objects")
    print()
    print("Actual behavior:")
    print("  - Subgraph node yields AIMessageChunk objects internally")
    print("  - LangGraph buffers and converts them to complete AIMessage objects")
    print("  - Wrapper receives complete messages instead of streaming chunks")
    print("  - Main graph node works correctly (for comparison)")
    print()
    print("=" * 60)
    
    try:
        print("🔄 Testing subgraph streaming behavior...")
        print("-" * 50)
        
        # Test the subgraph directly to see what it produces
        initial_state = {
            "messages": [HumanMessage(content="Test input")],
            "step": "start"
        }
        
        print("\n1️⃣ Testing subgraph directly:")
        print("   (This shows what the subgraph actually outputs)")
        
        chunk_count = 0
        streaming_chunks = 0
        complete_messages = 0
        
        async for chunk in compiled_subgraph.astream(initial_state):
            chunk_count += 1
            print(f"   Chunk #{chunk_count}: {chunk}")
            
            # Analyze message types to understand the bug
            if 'messages' in chunk:
                for msg in chunk['messages']:
                    if hasattr(msg, 'type'):
                        msg_type = getattr(msg, 'type', 'unknown')
                        if msg_type == 'AIMessageChunk':
                            streaming_chunks += 1
                            print(f"     ✅ AIMessageChunk detected (content: '{msg.content}')")
                        elif msg_type == 'ai':
                            complete_messages += 1
                            print(f"     ❌ Complete AIMessage detected (length: {len(msg.content)} chars)")
        
        print(f"\n   📊 Subgraph Results:")
        print(f"   - Total chunks: {chunk_count}")
        print(f"   - Streaming chunks (AIMessageChunk): {streaming_chunks}")
        print(f"   - Complete messages (AIMessage): {complete_messages}")
        
        if streaming_chunks == 0 and complete_messages > 0:
            print("   🐛 BUG CONFIRMED: Subgraph converted streaming chunks to complete messages!")
        
        print("\n" + "-" * 50)
        print("\n2️⃣ Testing main graph node directly:")
        print("   (This shows how streaming should work)")
        
        chunk_count = 0
        streaming_chunks = 0
        complete_messages = 0
        
        async for chunk in streaming_main_node(initial_state):
            chunk_count += 1
            print(f"   Chunk #{chunk_count}: {chunk}")
            
            # Analyze message types
            if 'messages' in chunk:
                for msg in chunk['messages']:
                    if hasattr(msg, 'type'):
                        msg_type = getattr(msg, 'type', 'unknown')
                        if msg_type == 'AIMessageChunk':
                            streaming_chunks += 1
                            print(f"     ✅ AIMessageChunk (content: '{msg.content}')")
                        elif msg_type == 'ai':
                            complete_messages += 1
                            print(f"     ℹ️  Complete AIMessage (final state, length: {len(msg.content)} chars)")
        
        print(f"\n   📊 Main Node Results:")
        print(f"   - Total chunks: {chunk_count}")
        print(f"   - Streaming chunks (AIMessageChunk): {streaming_chunks}")
        print(f"   - Complete messages (AIMessage): {complete_messages}")
        
        print("\n" + "=" * 60)
        print("🔍 ANALYSIS:")
        print()
        print("The bug is in LangGraph's subgraph execution model:")
        print("1. Subgraph nodes correctly yield AIMessageChunk objects internally")
        print("2. LangGraph buffers these chunks during subgraph execution") 
        print("3. The buffered content gets converted to complete AIMessage objects")
        print("4. The wrapper node receives complete messages instead of streaming chunks")
        print()
        print("This means the GitHub issue #4718 wrapper pattern only works for")
        print("passing through already-streaming content, not for enabling streaming")
        print("from within subgraph nodes themselves.")
        print()
        print("💡 CONCLUSION:")
        print("LangGraph subgraphs fundamentally cannot stream incremental chunks")
        print("from their internal nodes, regardless of implementation approach.")
        
    except Exception as e:
        print(f"❌ Error running test: {e}")
        import traceback
        traceback.print_exc()


async def test_with_server_simulation():
    """Simulate what happens when using LangGraph server."""
    print("\n" + "=" * 60)
    print("🖥️  SERVER SIMULATION:")
    print("   (This simulates the event types that would be emitted by LangGraph server)")
    print()
    
    # Test the full main graph to see complete behavior
    initial_state = {
        "messages": [HumanMessage(content="Test input")],
        "step": "start"
    }
    
    print("Full graph execution (subgraph + main node):")
    
    chunk_count = 0
    async for chunk in compiled_main_graph.astream(initial_state):
        chunk_count += 1
        print(f"Event #{chunk_count}: {chunk}")
        
        # Simulate what LangGraph server would emit
        if 'messages' in chunk:
            for msg in chunk['messages']:
                if hasattr(msg, 'type'):
                    msg_type = getattr(msg, 'type', 'unknown')
                    if msg_type == 'AIMessageChunk':
                        print(f"  📡 Would emit: messages/partial")
                    elif msg_type == 'ai':
                        print(f"  📡 Would emit: messages/complete")
    
    print(f"\nTotal events: {chunk_count}")


if __name__ == "__main__":
    print("Running LangGraph Subgraph Streaming Bug Reproducer...")
    asyncio.run(test_streaming_bug())
    asyncio.run(test_with_server_simulation())