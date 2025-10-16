#!/usr/bin/env python3
"""Verify SOW Author Claude Agent setup."""

import sys
from pathlib import Path


def check_imports():
    """Check if all required packages can be imported."""
    print("Checking package imports...")

    packages = {
        "claude_agent_sdk": "Claude Agent SDK",
        "anyio": "AnyIO",
        "pytest": "Pytest",
        "mypy": "MyPy"
    }

    all_ok = True
    for package, name in packages.items():
        try:
            __import__(package)
            print(f"  ✓ {name}")
        except ImportError as e:
            print(f"  ✗ {name} - {e}")
            all_ok = False

    return all_ok


def check_file_structure():
    """Check if all required files exist."""
    print("\nChecking file structure...")

    required_files = [
        "src/__init__.py",
        "src/sow_author_claude_client.py",
        "src/utils/filesystem.py",
        "src/utils/validation.py",
        "src/utils/metrics.py",
        "src/utils/logging_config.py",
        "src/utils/sow_upserter.py",
        "src/utils/appwrite_mcp.py",
        "src/prompts/research_subagent_prompt.md",
        "src/prompts/course_data_extractor_prompt.md",
        "src/prompts/sow_author_prompt.md",
        "src/prompts/unified_critic_prompt.md",
        "src/schemas/sow_schema.md",
        "src/schemas/research_pack_schema.md",
        "src/schemas/critic_result_schema.md",
        "src/schemas/course_data_schema.md",
        "requirements.txt",
        ".mcp.json",
        "README.md"
    ]

    all_ok = True
    for file_path in required_files:
        path = Path(file_path)
        if path.exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} - MISSING")
            all_ok = False

    return all_ok


def check_mcp_config():
    """Check if MCP configuration is set up."""
    print("\nChecking MCP configuration...")

    mcp_file = Path(".mcp.json")
    if not mcp_file.exists():
        print("  ✗ .mcp.json not found")
        return False

    import json
    try:
        with open(mcp_file) as f:
            config = json.load(f)

        if "mcpServers" not in config:
            print("  ✗ mcpServers section missing")
            return False

        if "appwrite" not in config["mcpServers"]:
            print("  ✗ Appwrite server not configured")
            return False

        api_key = config["mcpServers"]["appwrite"]["env"].get("APPWRITE_API_KEY", "")
        if api_key == "<YOUR_APPWRITE_API_KEY_HERE>" or not api_key:
            print("  ⚠️  .mcp.json exists but APPWRITE_API_KEY needs to be configured")
            print("     Edit .mcp.json and add your Appwrite API key")
            return False

        print("  ✓ MCP configuration looks good")
        return True

    except Exception as e:
        print(f"  ✗ Error reading .mcp.json: {e}")
        return False


def main():
    """Run all verification checks."""
    print("=" * 70)
    print("SOW Author Claude Agent - Setup Verification")
    print("=" * 70)
    print()

    checks = [
        ("Package Imports", check_imports),
        ("File Structure", check_file_structure),
        ("MCP Configuration", check_mcp_config)
    ]

    results = []
    for name, check_func in checks:
        result = check_func()
        results.append((name, result))
        print()

    print("=" * 70)
    print("Summary:")
    print("=" * 70)

    all_passed = True
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {name}")
        if not result:
            all_passed = False

    print()
    if all_passed:
        print("🎉 All checks passed! The agent is ready to use.")
        print()
        print("Next steps:")
        print("  1. Ensure Appwrite is running and accessible")
        print("  2. Test with: python -m src.sow_author_claude_client")
        return 0
    else:
        print("⚠️  Some checks failed. Please address the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
