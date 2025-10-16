#!/usr/bin/env python3
"""Test script to verify workspace location changes."""

import sys
from pathlib import Path
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from utils.filesystem import IsolatedFilesystem


def test_workspace_location():
    """Test that workspace is created in the correct local directory."""
    print("🧪 Testing workspace location...")
    print("=" * 60)

    # Create test execution ID
    test_execution_id = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"Test execution ID: {test_execution_id}")

    # Expected workspace path
    project_root = Path(__file__).parent
    expected_base = project_root / "workspace"
    expected_workspace = expected_base / test_execution_id

    print(f"Expected workspace path: {expected_workspace}")
    print()

    # Create workspace
    with IsolatedFilesystem(test_execution_id, persist=True) as fs:
        actual_workspace = fs.root
        print(f"✅ Workspace created at: {actual_workspace}")

        # Verify path is correct
        assert actual_workspace == expected_workspace, \
            f"Workspace path mismatch: {actual_workspace} != {expected_workspace}"
        print(f"✅ Workspace path is correct")

        # Verify workspace exists
        assert actual_workspace.exists(), "Workspace directory doesn't exist"
        print(f"✅ Workspace directory exists")

        # Verify it's in the local project, not /var
        assert not str(actual_workspace).startswith("/var"), \
            f"Workspace is still in /var: {actual_workspace}"
        print(f"✅ Workspace is NOT in /var (it's local)")

        # Test file operations
        test_file = "test_file.txt"
        test_content = "Hello from local workspace!"
        fs.write_file(test_file, test_content)
        print(f"✅ Test file written: {test_file}")

        # Verify file exists
        assert fs.file_exists(test_file), "Test file doesn't exist"
        print(f"✅ Test file exists")

        # Verify file content
        read_content = fs.read_file(test_file)
        assert read_content == test_content, "File content mismatch"
        print(f"✅ Test file content matches")

        # Verify README was created
        readme_path = actual_workspace / "README.md"
        assert readme_path.exists(), "README.md was not created"
        print(f"✅ README.md created")

    print()
    print("=" * 60)
    print(f"🎉 All tests passed!")
    print(f"📁 Workspace persisted at: {expected_workspace}")
    print()
    print("To clean up test workspace, run:")
    print(f"  rm -rf {expected_workspace}")


if __name__ == "__main__":
    try:
        test_workspace_location()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
