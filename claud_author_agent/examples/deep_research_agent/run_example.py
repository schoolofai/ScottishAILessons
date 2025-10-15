"""
run_example.py

Simple runner script for the Deep Research Agent.
Demonstrates how to use the agent with different research queries.
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from context_engineering_agent import ContextEngineeringAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


async def example_basic_research():
    """Example 1: Basic research query"""
    print("\n" + "="*80)
    print("EXAMPLE 1: Basic Research")
    print("="*80)

    agent = ContextEngineeringAgent()

    user_query = """
Research: "Modern approaches to prompt engineering in AI systems"

Please:
1. Research current best practices
2. Document key findings
3. Create a comprehensive summary
"""

    result = await agent.execute(user_query, max_turns=50)
    print_results(result)


async def example_with_appwrite():
    """Example 2: Research with Appwrite data integration"""
    print("\n" + "="*80)
    print("EXAMPLE 2: Research with Appwrite Integration")
    print("="*80)

    agent = ContextEngineeringAgent()

    user_query = """
Research: "RAG (Retrieval Augmented Generation) Systems"

Steps:
1. Use researcher to research RAG systems
2. If you find previous research on this topic,
   use data-manager to query Appwrite for existing findings
3. Build on existing research
4. Use synthesizer to create comprehensive summary
"""

    result = await agent.execute(user_query, max_turns=100)
    print_results(result)


async def example_multi_topic():
    """Example 3: Multi-topic research"""
    print("\n" + "="*80)
    print("EXAMPLE 3: Multi-Topic Deep Dive")
    print("="*80)

    agent = ContextEngineeringAgent()

    user_query = """
Deep Research: "AI Agent Architecture Patterns"

Topics to cover:
1. Agent orchestration patterns
2. Context management strategies
3. Tool integration approaches
4. Error handling and recovery

For each topic:
- Research thoroughly
- Document findings in separate files
- Create synthesis showing connections between topics
"""

    result = await agent.execute(user_query, max_turns=150)
    print_results(result)


def print_results(result: dict):
    """Print execution results in a formatted way"""
    print("\n" + "-"*80)
    print("RESULTS")
    print("-"*80)
    print(f"Execution ID: {result['execution_id']}")
    print(f"Session ID: {result['session_id']}")
    print(f"Workspace: {result['workspace']}")
    print(f"Cost: ${result['cost_usd']:.4f}")

    if result['todos']:
        completed = sum(1 for t in result['todos'] if t['status'] == 'completed')
        print(f"\nProgress: {completed}/{len(result['todos'])} todos completed")

    if result['output_files']:
        print(f"\nOutput Files ({len(result['output_files'])}):")
        for f in result['output_files']:
            print(f"  ✓ {f}")

    print(f"\nResult: {result['result']}")
    print("-"*80 + "\n")


async def main():
    """Run examples"""
    print("\n" + "🔬 " * 20)
    print("Deep Research Agent - Example Runner")
    print("🔬 " * 20)

    examples = {
        '1': ('Basic Research', example_basic_research),
        '2': ('Research with Appwrite', example_with_appwrite),
        '3': ('Multi-Topic Deep Dive', example_multi_topic),
    }

    print("\nAvailable Examples:")
    for key, (name, _) in examples.items():
        print(f"  {key}. {name}")
    print("  all. Run all examples")

    choice = input("\nSelect example (1-3 or 'all'): ").strip()

    if choice == 'all':
        for name, func in examples.values():
            print(f"\n\n{'='*80}")
            print(f"Running: {name}")
            print(f"{'='*80}")
            await func()
            await asyncio.sleep(2)  # Brief pause between examples
    elif choice in examples:
        await examples[choice][1]()
    else:
        print(f"Invalid choice: {choice}")
        return

    print("\n" + "✅ " * 20)
    print("Examples Complete!")
    print("✅ " * 20 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
