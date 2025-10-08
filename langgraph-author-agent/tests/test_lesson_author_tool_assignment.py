#!/usr/bin/env python3
"""Test lesson_author agent tool assignments.

Verifies that critic subagents have correct tool lists matching their prompts.
Ensures no unnecessary Appwrite tools are assigned to critics that don't use them.

This test validates the fix for the ToolException error caused by critics
having Appwrite tools they don't need.
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from lesson_author_agent import (
    pedagogical_design_critic,
    assessment_design_critic,
    accessibility_critic,
    scottish_context_critic,
    coherence_critic,
    research_subagent,
    lesson_author_subagent,
    all_tools,
    internet_only_tools,
    appwrite_only_tools
)


def test_pedagogical_critic_has_no_tools():
    """Pedagogical critic should have no external tools - only reads/writes files."""
    tools = pedagogical_design_critic["tools"]
    assert isinstance(tools, list), "Tools should be a list"
    assert len(tools) == 0, "Pedagogical critic should have empty tools list (no external tools needed)"


def test_assessment_critic_has_no_tools():
    """Assessment critic should have no external tools - only reads/writes files."""
    tools = assessment_design_critic["tools"]
    assert isinstance(tools, list), "Tools should be a list"
    assert len(tools) == 0, "Assessment critic should have empty tools list (no external tools needed)"


def test_accessibility_critic_has_internet_only():
    """Accessibility critic should have Tavily for research, no Appwrite."""
    tools = accessibility_critic["tools"]
    assert tools == internet_only_tools, \
        "Accessibility critic should have internet_only_tools (Tavily for accessibility research)"


def test_scottish_context_critic_has_internet_only():
    """Scottish context critic should have Tavily for context research, no Appwrite."""
    tools = scottish_context_critic["tools"]
    assert tools == internet_only_tools, \
        "Scottish context critic should have internet_only_tools (Tavily for Scottish context research)"


def test_coherence_critic_has_appwrite_only():
    """Coherence critic needs Appwrite for SoW validation queries."""
    tools = coherence_critic["tools"]
    assert tools == appwrite_only_tools, \
        "Coherence critic should have appwrite_only_tools (database access for SoW alignment)"


def test_research_subagent_has_all_tools():
    """Research subagent needs both Tavily and Appwrite for comprehensive research."""
    tools = research_subagent["tools"]
    assert tools == all_tools, \
        "Research subagent should have all_tools (Tavily + Appwrite for comprehensive research)"


def test_lesson_author_subagent_has_all_tools():
    """Lesson author subagent needs both Tavily and Appwrite for authoring."""
    tools = lesson_author_subagent["tools"]
    assert tools == all_tools, \
        "Lesson author subagent should have all_tools (Tavily + Appwrite for comprehensive authoring)"


def test_no_critic_has_all_tools():
    """Verify no critic subagent has all_tools (Tavily + Appwrite combined).

    This was the bug - critics had all_tools but prompts didn't use Appwrite,
    causing ToolException when LLM hallucinated Appwrite tool calls.
    """
    critics = [
        ("pedagogical_design_critic", pedagogical_design_critic),
        ("assessment_design_critic", assessment_design_critic),
        ("accessibility_critic", accessibility_critic),
        ("scottish_context_critic", scottish_context_critic),
        ("coherence_critic", coherence_critic)
    ]

    for name, critic in critics:
        tools = critic["tools"]
        if tools == all_tools:
            raise AssertionError(
                f"{name} has all_tools but should only have specific tools matching its prompt. "
                f"This causes ToolException when LLM hallucinates Appwrite tool usage."
            )


def test_tool_lists_are_defined():
    """Verify tool list constants exist and are lists."""
    assert isinstance(all_tools, list), "all_tools should be a list"
    assert isinstance(internet_only_tools, list), "internet_only_tools should be a list"
    assert isinstance(appwrite_only_tools, list), "appwrite_only_tools should be a list"

    # Verify they're different lists
    assert len(all_tools) > len(internet_only_tools), "all_tools should have more tools than internet_only"
    assert len(all_tools) > len(appwrite_only_tools), "all_tools should have more tools than appwrite_only"


if __name__ == "__main__":
    print("🧪 Testing lesson_author agent tool assignments...")
    print("=" * 60)

    try:
        test_pedagogical_critic_has_no_tools()
        print("✅ Pedagogical critic has no tools")

        test_assessment_critic_has_no_tools()
        print("✅ Assessment critic has no tools")

        test_accessibility_critic_has_internet_only()
        print("✅ Accessibility critic has internet_only_tools")

        test_scottish_context_critic_has_internet_only()
        print("✅ Scottish context critic has internet_only_tools")

        test_coherence_critic_has_appwrite_only()
        print("✅ Coherence critic has appwrite_only_tools")

        test_research_subagent_has_all_tools()
        print("✅ Research subagent has all_tools")

        test_lesson_author_subagent_has_all_tools()
        print("✅ Lesson author subagent has all_tools")

        test_no_critic_has_all_tools()
        print("✅ No critic has all_tools (prevents ToolException)")

        test_tool_lists_are_defined()
        print("✅ Tool lists are properly defined")

        print("=" * 60)
        print("🎉 All tests passed!")

    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
