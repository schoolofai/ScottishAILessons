#!/usr/bin/env python3
"""
Test runner that manages LangGraph server lifecycle for integration testing.

This script:
1. Starts a LangGraph dev server on port 2700
2. Waits for server to be ready
3. Runs the context integration tests
4. Cleanly shuts down the server

Usage:
    python tests/utils/server_manager.py                           # Run all context integration tests
    python tests/utils/server_manager.py -k test_context          # Run specific test pattern
    python tests/utils/server_manager.py --cov=src --cov-report=html  # Run with coverage
"""

import sys
import subprocess
import time
import requests
import signal
import os
from typing import List, Optional


class LangGraphTestServer:
    """Manages LangGraph dev server for integration testing."""

    def __init__(self, port: int = 2700):
        self.port = port
        self.process: Optional[subprocess.Popen] = None
        self.base_url = f"http://localhost:{port}"

    def start(self) -> bool:
        """Start the LangGraph dev server and wait for it to be ready."""
        print(f"🚀 Starting LangGraph test server on port {self.port}...")

        try:
            self.process = subprocess.Popen(
                ["langgraph", "dev", "--port", str(self.port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid  # Create process group for clean termination
            )
        except FileNotFoundError:
            print("❌ langgraph command not found. Please install langgraph-cli:")
            print("   pip install 'langgraph-cli[inmem]'")
            return False

        # Wait for server to be ready
        print("⏳ Waiting for server to be ready...")
        for i in range(30):
            try:
                response = requests.get(f"{self.base_url}/docs", timeout=2)
                if response.status_code == 200:
                    print("✅ LangGraph test server ready")
                    return True
            except requests.RequestException:
                pass

            if self.process.poll() is not None:
                # Process has terminated
                stdout, stderr = self.process.communicate()
                print("❌ Server process terminated unexpectedly")
                print(f"STDOUT: {stdout.decode()}")
                print(f"STDERR: {stderr.decode()}")
                return False

            print(f"   Waiting... ({i+1}/30)")
            time.sleep(1)

        print("❌ Server failed to start within 30 seconds")
        self.stop()
        return False

    def stop(self) -> None:
        """Stop the LangGraph server gracefully."""
        if self.process is None:
            return

        print("🛑 Stopping LangGraph test server...")

        try:
            # Terminate the entire process group
            os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)

            # Wait for graceful shutdown
            try:
                self.process.wait(timeout=5)
                print("✅ Test server stopped gracefully")
            except subprocess.TimeoutExpired:
                print("⚠️  Graceful shutdown timed out, forcing termination...")
                os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                self.process.wait()
                print("✅ Test server force stopped")

        except (ProcessLookupError, OSError):
            print("✅ Test server already stopped")

        self.process = None

    def is_running(self) -> bool:
        """Check if server is running and responding."""
        try:
            response = requests.get(f"{self.base_url}/docs", timeout=1)
            return response.status_code == 200
        except requests.RequestException:
            return False


def run_tests(pytest_args: List[str]) -> int:
    """Run pytest with the given arguments."""
    print("🧪 Running context integration tests...")

    cmd = ["python", "-m", "pytest", "../integration_tests/test_context_integration.py"] + pytest_args

    print(f"Running: {' '.join(cmd)}")
    return subprocess.call(cmd)


def main():
    """Main test runner with server lifecycle management."""
    server = LangGraphTestServer()

    try:
        # Start the test server
        if not server.start():
            print("❌ Failed to start test server")
            sys.exit(1)

        # Prepare pytest arguments
        pytest_args = sys.argv[1:] if len(sys.argv) > 1 else ["-v", "--tb=short"]

        # Add some default helpful options if no args provided
        if not sys.argv[1:]:
            pytest_args.extend([
                "--disable-warnings",  # Reduce noise
                "-p", "no:cacheprovider",  # Disable cache for clean runs
            ])

        print(f"📊 Test arguments: {pytest_args}")

        # Run the tests
        exit_code = run_tests(pytest_args)

        if exit_code == 0:
            print("✅ All tests passed!")
        else:
            print(f"❌ Tests failed with exit code {exit_code}")

        sys.exit(exit_code)

    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        sys.exit(130)

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

    finally:
        # Always clean up the server
        server.stop()


if __name__ == "__main__":
    main()