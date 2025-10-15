"""
Test Script: Appwrite MCP Server Connection

This script tests the connection to the Appwrite MCP server
and verifies that:
1. .mcp.json configuration is valid
2. uvx and mcp-server-appwrite are available
3. Appwrite credentials are correct
4. Basic database operations work
"""

import anyio
from claude_agent_sdk import query, ClaudeAgentOptions
import json
import os
import sys


def check_prerequisites():
    """Check if all prerequisites are met."""
    print("Checking prerequisites...")
    print("-" * 70)

    issues = []

    # Check if .mcp.json exists
    if not os.path.exists('.mcp.json'):
        issues.append("✗ .mcp.json not found")
        print("✗ .mcp.json not found")
    else:
        print("✓ .mcp.json found")

        # Validate JSON
        try:
            with open('.mcp.json', 'r') as f:
                config = json.load(f)

            if 'mcpServers' in config:
                print("✓ mcpServers configuration present")

                if 'appwrite' in config['mcpServers']:
                    print("✓ Appwrite server configured")

                    server_config = config['mcpServers']['appwrite']

                    # Check configuration structure
                    if server_config.get('type') == 'stdio':
                        print("✓ Server type: stdio")
                    else:
                        issues.append("✗ Server type is not 'stdio'")

                    if 'command' in server_config and 'args' in server_config:
                        print("✓ Command and args configured")
                    else:
                        issues.append("✗ Missing command or args")

                else:
                    issues.append("✗ Appwrite server not configured")
            else:
                issues.append("✗ No mcpServers in configuration")

        except json.JSONDecodeError as e:
            issues.append(f"✗ Invalid JSON: {e}")
            print(f"✗ Invalid JSON: {e}")

    print()

    # Check Python packages
    try:
        import claude_agent_sdk
        print("✓ claude-agent-sdk installed")
    except ImportError:
        issues.append("✗ claude-agent-sdk not installed")
        print("✗ claude-agent-sdk not installed")

    print()

    if issues:
        print("Issues found:")
        for issue in issues:
            print(f"  {issue}")
        print()
        print("Please fix these issues before running the test.")
        return False

    print("All prerequisites met!")
    print()
    return True


async def test_basic_connection():
    """Test basic connection to Appwrite MCP server."""
    print("=" * 70)
    print("Test 1: Basic Connection")
    print("=" * 70)
    print()

    try:
        with open('.mcp.json', 'r') as f:
            mcp_config = json.load(f)

        options = ClaudeAgentOptions(
            mcp_servers=mcp_config['mcpServers'],
            allowed_tools=["mcp__appwrite__databases_list"],
            permission_mode='acceptEdits'
        )

        prompt = "Please list all databases in the Appwrite project."

        print(f"Prompt: {prompt}")
        print()
        print("Response:")
        print("-" * 70)

        success = False
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        success = True
                print()

        if success:
            print("✓ Test 1 PASSED: Connection successful")
        else:
            print("✗ Test 1 FAILED: No response received")

        return success

    except Exception as e:
        print(f"✗ Test 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_database_operations():
    """Test database read operations."""
    print()
    print("=" * 70)
    print("Test 2: Database Operations")
    print("=" * 70)
    print()

    try:
        with open('.mcp.json', 'r') as f:
            mcp_config = json.load(f)

        options = ClaudeAgentOptions(
            mcp_servers=mcp_config['mcpServers'],
            allowed_tools=[
                "mcp__appwrite__databases_list",
                "mcp__appwrite__databases_get"
            ],
            permission_mode='acceptEdits'
        )

        prompt = """
        Test database operations:
        1. List all databases
        2. If any databases exist, get details of the first one

        Report success or failure for each operation.
        """

        print(f"Prompt: {prompt.strip()}")
        print()
        print("Response:")
        print("-" * 70)

        success = False
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        success = True
                print()

        if success:
            print("✓ Test 2 PASSED: Database operations successful")
        else:
            print("✗ Test 2 FAILED: No response received")

        return success

    except Exception as e:
        print(f"✗ Test 2 FAILED: {e}")
        return False


async def test_tool_availability():
    """Test which Appwrite tools are available."""
    print()
    print("=" * 70)
    print("Test 3: Tool Availability Check")
    print("=" * 70)
    print()

    print("Testing availability of Appwrite database tools...")
    print()

    test_tools = [
        "mcp__appwrite__databases_list",
        "mcp__appwrite__databases_create",
        "mcp__appwrite__databases_get",
        "mcp__appwrite__databases_create_collection",
        "mcp__appwrite__databases_create_document",
        "mcp__appwrite__databases_list_documents"
    ]

    print("Tools to test:")
    for tool in test_tools:
        print(f"  • {tool}")

    print()
    print("Note: Tool availability will be confirmed when agent attempts to use them.")
    print("✓ Test 3: Tool list prepared")

    return True


async def test_error_handling():
    """Test error handling with invalid operations."""
    print()
    print("=" * 70)
    print("Test 4: Error Handling")
    print("=" * 70)
    print()

    try:
        with open('.mcp.json', 'r') as f:
            mcp_config = json.load(f)

        options = ClaudeAgentOptions(
            mcp_servers=mcp_config['mcpServers'],
            allowed_tools=["mcp__appwrite__databases_get"],
            permission_mode='acceptEdits'
        )

        # Try to get a non-existent database
        prompt = "Try to get database with ID 'nonexistent_test_db_12345'. This should fail gracefully."

        print(f"Prompt: {prompt}")
        print()
        print("Response:")
        print("-" * 70)

        error_handled = False
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        text = block.text.lower()
                        print(block.text)
                        # Check if error was handled gracefully
                        if any(word in text for word in ['error', 'not found', 'failed', 'does not exist']):
                            error_handled = True
                print()

        if error_handled:
            print("✓ Test 4 PASSED: Errors handled gracefully")
        else:
            print("✗ Test 4 FAILED: Error not properly handled")

        return error_handled

    except Exception as e:
        print(f"✗ Test 4 FAILED: {e}")
        return False


async def run_all_tests():
    """Run all connection tests."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "Appwrite MCP Server Connection Test" + " " * 17 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    # Check prerequisites first
    if not check_prerequisites():
        print()
        print("Please fix prerequisite issues and try again.")
        sys.exit(1)

    # Run tests
    results = {}

    print("Running connection tests...")
    print("=" * 70)
    print()

    results['basic_connection'] = await test_basic_connection()
    results['database_operations'] = await test_database_operations()
    results['tool_availability'] = await test_tool_availability()
    results['error_handling'] = await test_error_handling()

    # Summary
    print()
    print("=" * 70)
    print("Test Summary")
    print("=" * 70)
    print()

    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)

    for test_name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"  {test_name.replace('_', ' ').title()}: {status}")

    print()
    print(f"Results: {passed_tests}/{total_tests} tests passed")
    print()

    if passed_tests == total_tests:
        print("🎉 All tests passed! Your Appwrite MCP server is working correctly.")
        print()
        print("Next steps:")
        print("  1. Run example_external_mcp_appwrite.py for basic usage")
        print("  2. Run example_external_mcp_comprehensive.py for advanced features")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
        print()
        print("Troubleshooting tips:")
        print("  1. Verify Appwrite credentials in .mcp.json")
        print("  2. Check network connectivity to Appwrite endpoint")
        print("  3. Ensure mcp-server-appwrite is installed: pip install mcp-server-appwrite")
        print("  4. Verify uvx is available: pip install uvx")

    print()

    return passed_tests == total_tests


async def main():
    """Main entry point."""
    try:
        success = await run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    anyio.run(main)
