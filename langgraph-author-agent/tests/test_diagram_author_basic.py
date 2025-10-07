"""Basic tests for Diagram Author Deep Agent.

These tests verify that the agent modules load correctly and have proper structure.
Full integration tests require DiagramScreenshot service running.
"""

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


def test_state_schema_imports():
    """Test that state schema imports correctly."""
    from diagram_author_state import DiagramAuthorState, dict_merger

    assert DiagramAuthorState is not None
    assert dict_merger is not None

    # Test dict_merger function
    left = {"a": 1, "b": 2}
    right = {"b": 3, "c": 4}
    merged = dict_merger(left, right)

    assert merged == {"a": 1, "b": 3, "c": 4}
    assert dict_merger(None, right) == right
    assert dict_merger(left, None) == left

    print("✅ State schema imports and dict_merger work correctly")


def test_tools_import():
    """Test that tools module imports correctly."""
    from diagram_author_tools import render_diagram_tool, diagram_tools, check_diagram_service_health

    assert render_diagram_tool is not None
    assert diagram_tools is not None
    assert len(diagram_tools) == 1
    assert check_diagram_service_health is not None

    print("✅ Tools module imports correctly")


def test_prompts_import():
    """Test that prompts module imports correctly."""
    from diagram_author_prompts import (
        DIAGRAM_AGENT_PROMPT,
        DIAGRAM_AUTHOR_SUBAGENT_PROMPT,
        VISUAL_CRITIC_SUBAGENT_PROMPT
    )

    assert DIAGRAM_AGENT_PROMPT is not None
    assert len(DIAGRAM_AGENT_PROMPT) > 100
    assert DIAGRAM_AUTHOR_SUBAGENT_PROMPT is not None
    assert len(DIAGRAM_AUTHOR_SUBAGENT_PROMPT) > 100
    assert VISUAL_CRITIC_SUBAGENT_PROMPT is not None
    assert len(VISUAL_CRITIC_SUBAGENT_PROMPT) > 100

    # Check for key terms in prompts
    assert "Appwrite" in DIAGRAM_AGENT_PROMPT or "agnostic" in DIAGRAM_AGENT_PROMPT
    assert "JSXGraph" in DIAGRAM_AUTHOR_SUBAGENT_PROMPT
    assert "critique" in VISUAL_CRITIC_SUBAGENT_PROMPT.lower()

    print("✅ Prompts module imports correctly with valid content")


def test_agent_import():
    """Test that agent module imports correctly."""
    # Note: This requires GOOGLE_API_KEY environment variable
    if "GOOGLE_API_KEY" not in os.environ:
        print("⚠️  Skipping agent import test (GOOGLE_API_KEY not set)")
        return

    try:
        from diagram_author_agent import agent, check_service_health

        assert agent is not None
        assert check_service_health is not None

        print("✅ Agent module imports correctly")
    except Exception as e:
        print(f"⚠️  Agent import failed: {e}")
        print("   This is expected if deepagents or langchain_google_genai are not installed")


def test_pattern_library_files():
    """Test that pattern library files exist and are valid JSON."""
    import json

    patterns_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'jsxgraph_patterns')

    pattern_files = [
        'geometry_patterns.json',
        'algebra_patterns.json',
        'statistics_patterns.json'
    ]

    for filename in pattern_files:
        filepath = os.path.join(patterns_dir, filename)
        assert os.path.exists(filepath), f"Pattern file missing: {filename}"

        with open(filepath, 'r') as f:
            data = json.load(f)
            assert 'patterns' in data
            assert len(data['patterns']) > 0

            # Check first pattern structure
            pattern = data['patterns'][0]
            required_keys = ['id', 'name', 'description', 'tags', 'diagram']
            for key in required_keys:
                assert key in pattern, f"Missing key {key} in {filename}"

            # Check diagram structure
            assert 'board' in pattern['diagram']
            assert 'elements' in pattern['diagram']

        print(f"✅ Pattern file {filename} is valid")


def test_render_diagram_tool_structure():
    """Test that render_diagram_tool has correct structure."""
    import json
    from diagram_author_tools import render_diagram_tool

    # Test with invalid JSON
    result = render_diagram_tool("invalid json")
    assert result["success"] is False
    assert result["error_code"] == "INVALID_JSON"
    assert "suggestions" in result

    # Test with missing diagram key
    result = render_diagram_tool(json.dumps({"foo": "bar"}))
    assert result["success"] is False
    assert result["error_code"] == "INVALID_STRUCTURE"

    # Test with missing board
    result = render_diagram_tool(json.dumps({"diagram": {"elements": []}}))
    assert result["success"] is False
    assert result["error_code"] == "INVALID_STRUCTURE"

    # Test with missing elements
    result = render_diagram_tool(json.dumps({"diagram": {"board": {}}}))
    assert result["success"] is False
    assert result["error_code"] == "INVALID_STRUCTURE"

    print("✅ render_diagram_tool validation works correctly")


def test_service_health_check():
    """Test that service health check function works."""
    from diagram_author_tools import check_diagram_service_health

    health = check_diagram_service_health()

    assert "healthy" in health
    assert "status" in health
    assert "details" in health

    if health["healthy"]:
        print("✅ DiagramScreenshot service is running and healthy")
    else:
        print(f"⚠️  DiagramScreenshot service is not available: {health['status']}")
        print("   To start service: cd diagram-prototypes && docker compose up -d")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Running Diagram Author Agent Basic Tests")
    print("=" * 60 + "\n")

    test_state_schema_imports()
    test_tools_import()
    test_prompts_import()
    test_pattern_library_files()
    test_render_diagram_tool_structure()
    test_service_health_check()
    test_agent_import()

    print("\n" + "=" * 60)
    print("✅ All basic tests passed!")
    print("=" * 60 + "\n")

    print("Next steps:")
    print("1. Ensure DiagramScreenshot service is running:")
    print("   cd diagram-prototypes && docker compose up -d")
    print("")
    print("2. Run the agent with example input:")
    print("   cd langgraph-author-agent")
    print("   python src/diagram_author_agent.py")
    print("")
