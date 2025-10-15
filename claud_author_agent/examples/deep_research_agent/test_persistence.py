"""
test_persistence.py

Test workspace persistence without needing API key.
"""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from deep_research_agent_full import IsolatedFilesystem

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_persistence():
    """Test that workspace persists"""
    print("\n" + "=" * 80)
    print("WORKSPACE PERSISTENCE TEST")
    print("=" * 80)

    # Test 1: With persistence enabled (default)
    print("\nTest 1: Workspace with persistence enabled")
    print("-" * 80)

    with IsolatedFilesystem("test_persist", persist=True) as fs:
        workspace_path = fs.root
        print(f"Workspace created: {workspace_path}")

        # Create a test file
        test_file = fs.output_dir / "test.txt"
        test_file.write_text("This file should persist")
        print(f"Created test file: {test_file}")

    # Check if workspace still exists
    if workspace_path.exists():
        print(f"✓ SUCCESS: Workspace persisted at {workspace_path}")
        print(f"✓ Files in workspace:")
        for item in workspace_path.rglob("*"):
            if item.is_file():
                print(f"  - {item.relative_to(workspace_path)}")
    else:
        print(f"✗ FAILED: Workspace was deleted")

    # Test 2: With persistence disabled
    print("\n" + "-" * 80)
    print("Test 2: Workspace with persistence disabled")
    print("-" * 80)

    with IsolatedFilesystem("test_no_persist", persist=False) as fs:
        workspace_path2 = fs.root
        print(f"Workspace created: {workspace_path2}")

        # Create a test file
        test_file2 = fs.output_dir / "test.txt"
        test_file2.write_text("This file should be deleted")
        print(f"Created test file: {test_file2}")

    # Check if workspace was cleaned up
    if workspace_path2.exists():
        print(f"✗ FAILED: Workspace was not cleaned up")
    else:
        print(f"✓ SUCCESS: Workspace was cleaned up as expected")

    print("\n" + "=" * 80)
    print("PERSISTENCE TEST COMPLETE")
    print("=" * 80)
    print(f"\nPersistent workspace still available at:")
    print(f"  {workspace_path}")
    print("\nYou can inspect the files with:")
    print(f"  ls -la {workspace_path}")
    print(f"  cat {workspace_path}/output/test.txt")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    test_persistence()
