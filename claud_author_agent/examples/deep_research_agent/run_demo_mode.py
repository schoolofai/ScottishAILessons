"""
run_demo_mode.py

Run the Deep Research Agent without ANTHROPIC_API_KEY.
The SDK will fall back to Claude subscription if available.
"""

import asyncio
import os
import sys
import logging
from pathlib import Path

# Deliberately unset the API key to use Claude subscription
if 'ANTHROPIC_API_KEY' in os.environ:
    del os.environ['ANTHROPIC_API_KEY']
    print("🔒 Deliberately unset ANTHROPIC_API_KEY - will use Claude subscription\n")

sys.path.insert(0, str(Path(__file__).parent))

from deep_research_agent_full import DeepResearchAgent

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


async def main():
    """Run agent without API key (uses Claude subscription if available)"""

    print("=" * 80)
    print("DEEP RESEARCH AGENT - SUBSCRIPTION MODE")
    print("=" * 80)
    print()
    print("Running without ANTHROPIC_API_KEY")
    print("SDK will use Claude subscription if available")
    print()
    print("=" * 80)
    print()

    # Initialize agent
    agent = DeepResearchAgent()

    # User's research query
    user_query = '''
Research: "Context Engineering in AI Agent Systems"

Steps:
1. Use researcher subagent to research context engineering
2. Write findings to /context/findings.md
3. Write detailed analysis to /research/context_engineering.md
4. Use synthesizer to create summary in /output/summary.md

Track progress with todos.
'''

    # Execute - SDK will use subscription or API key
    try:
        result = await agent.execute(user_query, max_turns=100)

        print("\n" + "=" * 80)
        print("EXECUTION SUMMARY")
        print("=" * 80)
        print(f"Execution ID: {result['execution_id']}")
        print(f"Session ID: {result['session_id']}")
        print(f"Workspace: {result['workspace']}")
        print(f"Result file: {result['result_file']}")
        print(f"Cost: ${result['cost_usd']:.4f}")
        print(f"Messages: {result['message_count']}")
        print()
        print(f"Result: {result['result'][:200]}...")
        print("=" * 80 + "\n")

    except Exception as e:
        print("\n" + "=" * 80)
        print("EXECUTION FAILED")
        print("=" * 80)
        print(f"\nError: {e}\n")
        print("This could mean:")
        print("  - No Claude subscription available")
        print("  - No API key set")
        print("  - Network/authentication issue")
        print()
        print("To run with API key:")
        print("  export ANTHROPIC_API_KEY='your-key-here'")
        print("  python3 deep_research_agent_full.py")
        print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
