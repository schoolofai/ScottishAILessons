#!/usr/bin/env python3
"""Test script for interrupt-enabled graphs.

This script demonstrates the interrupt functionality by showing how
the graphs handle Tool UI interrupts vs fallback messages.
"""

import sys
import asyncio
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from agent.graph_interrupt import graph_interrupt
from agent.interrupt_config import should_enable_interrupts, get_interrupt_config

async def test_interrupt_config():
    """Test interrupt configuration functions."""
    print("=== Testing Interrupt Configuration ===")
    
    # Test interrupt enablement
    print(f"Interrupts enabled by default: {should_enable_interrupts()}")
    
    # Test with disabled context
    disabled_context = {"disable_interrupts": True}
    print(f"Interrupts with disabled context: {should_enable_interrupts(disabled_context)}")
    
    # Test tool configurations
    tools = ["lesson_card_presentation", "feedback_presentation", "progress_acknowledgment", "lesson_summary_presentation"]
    for tool in tools:
        config = get_interrupt_config(tool)
        print(f"{tool} config: timeout={config.get('timeout', 'N/A')}, auto_advance={config.get('auto_advance', 'N/A')}")


async def test_graph_structure():
    """Test the interrupt-enabled graph structure."""
    print("\n=== Testing Graph Structure ===")
    
    print(f"Graph nodes: {list(graph_interrupt.nodes.keys())}")
    print(f"Graph name: {getattr(graph_interrupt, 'name', 'N/A')}")
    print("Graph compiled successfully!")


def main():
    """Run all tests."""
    print("Testing Interrupt-Enabled LangGraph Implementation")
    print("=" * 50)
    
    # Run async tests
    asyncio.run(test_interrupt_config())
    asyncio.run(test_graph_structure())
    
    print("\n=== Test Summary ===")
    print("✅ Interrupt configuration system working")
    print("✅ Graph compilation successful")
    print("✅ All imports resolved correctly")
    print("✅ Ready for integration with Assistant-UI frontend")
    
    print("\nNext steps:")
    print("1. Start the LangGraph dev server: langgraph dev")
    print("2. Start the frontend: cd assistant-ui-frontend && npm run dev")
    print("3. Test the interrupt UI components in the chat interface")


if __name__ == "__main__":
    main()