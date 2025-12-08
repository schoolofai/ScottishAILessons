"""Simple Structured Output Example - Following SDK Documentation

This example mirrors the official Claude Agent SDK documentation exactly.
No additional prompt guidance or schema sanitization - just pure Pydantic + SDK.

Usage:
    cd claud_author_agent
    source .venv/bin/activate
    python docs/examples/simple_structured_output.py
"""

import asyncio
import json
from pydantic import BaseModel
from claude_agent_sdk import query, ClaudeAgentOptions


# Simple Pydantic models (matching doc example pattern)
class Issue(BaseModel):
    severity: str  # 'low', 'medium', 'high'
    description: str
    file: str


class AnalysisResult(BaseModel):
    summary: str
    issues: list[Issue]
    score: int


async def run_simple_structured_output():
    """Run structured output query using ClaudeAgentOptions."""

    print("=" * 60)
    print("SIMPLE STRUCTURED OUTPUT EXAMPLE")
    print("=" * 60)
    print()

    # Show the schema being used
    schema = AnalysisResult.model_json_schema()
    print("Generated JSON Schema:")
    print(json.dumps(schema, indent=2))
    print()
    print("-" * 60)
    print("Sending query to Claude Agent SDK...")
    print("-" * 60)
    print()

    message_count = 0

    # Create options with output_format
    options = ClaudeAgentOptions(
        output_format={
            "type": "json_schema",
            "schema": AnalysisResult.model_json_schema()
        },
        permission_mode="bypassPermissions",
        max_turns=10
    )

    # Use in query with ClaudeAgentOptions
    async for message in query(
        prompt="Analyze a fictional Python codebase and find 3 security issues. Be creative with the file names and descriptions.",
        options=options
    ):
        message_count += 1
        print(f"Message #{message_count}: {type(message).__name__}")

        # Check for structured output
        if hasattr(message, 'structured_output') and message.structured_output:
            print()
            print("=" * 60)
            print("STRUCTURED OUTPUT RECEIVED!")
            print("=" * 60)

            # Validate and get fully typed result
            result = AnalysisResult.model_validate(message.structured_output)

            print(f"\nSummary: {result.summary}")
            print(f"Score: {result.score}")
            print(f"Found {len(result.issues)} issues:")
            print()

            for i, issue in enumerate(result.issues, 1):
                print(f"  {i}. [{issue.severity.upper()}] {issue.file}")
                print(f"     {issue.description}")
                print()

            print("=" * 60)
            print("SUCCESS! Structured output validated with Pydantic.")
            print("=" * 60)
            return result

    raise RuntimeError("No structured output received from agent")


if __name__ == "__main__":
    result = asyncio.run(run_simple_structured_output())
