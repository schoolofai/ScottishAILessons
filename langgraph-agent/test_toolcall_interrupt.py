#!/usr/bin/env python3
"""Test script for the new tool call + interrupt pattern.

This script verifies that the two-node approach creates proper tool calls
that will be visible to Assistant UI for rendering interactive components.
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

def test_graph_structure():
    """Test that the tool call + interrupt graph has the correct structure."""
    print("=== Testing Tool Call + Interrupt Graph Structure ===")
    
    from agent.teacher_graph_toolcall_interrupt import compiled_teaching_graph_toolcall
    
    # Verify nodes
    expected_nodes = ['__start__', 'design', 'get_answer', 'mark', 'progress']
    actual_nodes = list(compiled_teaching_graph_toolcall.nodes.keys())
    
    print(f"Expected nodes: {expected_nodes}")
    print(f"Actual nodes: {actual_nodes}")
    
    assert set(actual_nodes) == set(expected_nodes), f"Node mismatch: {actual_nodes} vs {expected_nodes}"
    print("✅ Graph has correct nodes")


def test_main_graph_integration():
    """Test that main graph properly imports the new teaching subgraph."""
    print("\n=== Testing Main Graph Integration ===")
    
    from agent.graph_interrupt import graph_interrupt
    
    # Verify main graph structure
    expected_nodes = ['__start__', 'entry', 'router', 'chat', 'teaching']
    actual_nodes = list(graph_interrupt.nodes.keys())
    
    print(f"Main graph nodes: {actual_nodes}")
    assert set(actual_nodes) == set(expected_nodes), f"Main graph node mismatch: {actual_nodes}"
    print("✅ Main graph integration successful")


def test_design_node_logic():
    """Test design node creates proper tool calls."""
    print("\n=== Testing Design Node Tool Call Creation ===")
    
    from agent.teacher_graph_toolcall_interrupt import design_node
    from agent.interrupt_state import InterruptUnifiedState
    
    # Create test state for a lesson
    test_state = InterruptUnifiedState(
        lesson_snapshot={
            "title": "Test Lesson",
            "cards": [
                {
                    "id": "card_1",
                    "title": "Test Card",
                    "explainer": "This is a test card",
                    "cfu": {
                        "id": "cfu_1",
                        "type": "text",
                        "question": "What is 2+2?",
                        "expected": "4"
                    }
                }
            ]
        },
        current_card_index=0,
        student_id="test_student",
        messages=[]
    )
    
    try:
        result = design_node(test_state)
        
        # Check that AIMessage with tool call was created
        assert "messages" in result, "Design node should return messages"
        assert len(result["messages"]) == 1, "Should create exactly one message"
        
        message = result["messages"][0]
        assert hasattr(message, 'tool_calls'), "Message should have tool_calls"
        assert len(message.tool_calls) == 1, "Should have exactly one tool call"
        
        tool_call = message.tool_calls[0]
        assert tool_call.name == "lesson_card_presentation", f"Wrong tool name: {tool_call.name}"
        assert "card_content" in tool_call.args, "Tool call should have card_content"
        assert "card_data" in tool_call.args, "Tool call should have card_data"
        
        print("✅ Design node creates proper tool calls")
        print(f"   - Tool call ID: {tool_call.id}")
        print(f"   - Tool name: {tool_call.name}")
        print(f"   - Has card content: {bool(tool_call.args.get('card_content'))}")
        
    except Exception as e:
        print(f"❌ Design node test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def main():
    """Run all tests."""
    print("Testing Tool Call + Interrupt Implementation")
    print("=" * 50)
    
    try:
        test_graph_structure()
        test_main_graph_integration()
        success = test_design_node_logic()
        
        if success:
            print("\n=== Test Summary ===")
            print("✅ Tool call + interrupt graph structure correct")
            print("✅ Main graph integration working")  
            print("✅ Design node creates proper tool calls")
            print("✅ Ready for frontend testing with Assistant UI")
            
            print("\nNext steps:")
            print("1. Backend server is already running on port 2024")
            print("2. Frontend is already running on port 3000")
            print("3. Test by sending lesson session data to trigger tool UI display")
            print("4. Verify that tool calls are visible to Assistant UI components")
            
        else:
            print("\n❌ Some tests failed - check output above")
            return 1
            
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())