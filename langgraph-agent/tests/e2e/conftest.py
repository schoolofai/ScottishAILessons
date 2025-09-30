#!/usr/bin/env python3
"""E2E Testing Configuration with Backend Server Management.

This module provides pytest fixtures for managing the LangGraph backend server
during E2E testing. Tests use the LangGraph Python SDK to interact with a
running backend server, providing true black-box testing.
"""

import pytest
import pytest_asyncio
import asyncio
import subprocess
import time
import httpx
import signal
import os
import sys
from typing import Generator
from pathlib import Path


@pytest.fixture(scope="session")
def backend_server() -> Generator[str, None, None]:
    """Start LangGraph backend server for E2E testing.

    Returns:
        str: Base URL of the running backend server
    """
    # Get the langgraph-agent directory
    script_dir = Path(__file__).parent.parent.parent

    # Change to the langgraph-agent directory
    original_cwd = os.getcwd()
    os.chdir(script_dir)

    # Activate virtual environment and start backend
    venv_path = script_dir.parent / "venv"
    if not venv_path.exists():
        raise RuntimeError(f"Virtual environment not found at {venv_path}")

    # Start langgraph dev server
    process = None
    try:
        print("🚀 Starting LangGraph backend server for E2E tests...")

        # Use the virtual environment's python and langgraph
        langgraph_cmd = str(venv_path / "bin" / "langgraph")

        process = subprocess.Popen(
            [langgraph_cmd, "dev", "--host", "127.0.0.1", "--port", "2024"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid  # Create new process group for cleanup
        )

        # Wait for server to be ready
        server_url = "http://127.0.0.1:2024"
        if not _wait_for_server(server_url, timeout=60):
            # Get process output for debugging
            stdout, stderr = process.communicate(timeout=5)
            raise RuntimeError(
                f"Backend server failed to start within 60 seconds.\n"
                f"stdout: {stdout}\n"
                f"stderr: {stderr}"
            )

        print(f"✅ Backend server ready at {server_url}")
        yield server_url

    finally:
        # Cleanup: Kill the server process
        if process:
            print("🛑 Stopping backend server...")
            try:
                # Kill the entire process group
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                process.wait(timeout=10)
            except (subprocess.TimeoutExpired, ProcessLookupError):
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            print("✅ Backend server stopped")

        # Restore original working directory
        os.chdir(original_cwd)


def _wait_for_server(url: str, timeout: int = 60) -> bool:
    """Wait for the server to be ready.

    Args:
        url: Base URL of the server
        timeout: Maximum time to wait in seconds

    Returns:
        bool: True if server is ready, False if timeout
    """
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            # Use the docs endpoint which should be available for GET
            response = httpx.get(f"{url}/docs", timeout=5.0)
            if response.status_code == 200:
                return True
        except (httpx.RequestError, httpx.TimeoutException):
            pass

        time.sleep(1)

    return False


@pytest_asyncio.fixture
async def langgraph_client(backend_server: str):
    """Create LangGraph SDK client for testing.

    Args:
        backend_server: Base URL from backend_server fixture

    Returns:
        LangGraph client configured for the test server
    """
    from langgraph_sdk import get_client

    client = get_client(url=backend_server)

    # Verify client can connect
    try:
        await client.assistants.search()
    except Exception as e:
        pytest.fail(f"Failed to connect to LangGraph server: {e}")

    return client


@pytest_asyncio.fixture
async def test_thread(langgraph_client):
    """Create a test thread for E2E testing.

    Args:
        langgraph_client: LangGraph client from langgraph_client fixture

    Returns:
        Thread object for testing
    """
    thread = await langgraph_client.threads.create()

    yield thread

    # Cleanup: Delete the thread after test
    try:
        await langgraph_client.threads.delete(thread["thread_id"])
    except Exception:
        # Thread cleanup failure shouldn't fail the test
        pass


@pytest.fixture
def sample_course_context():
    """Sample course context for recommendation testing."""
    return {
        "mode": "course_manager",  # Explicit mode for course manager
        "request_type": "get_recommendations",
        "course": {
            "$id": "course_c84473",
            "courseId": "course_c84473",
            "subject": "Applications of Mathematics",
            "level": "Nat3"
        },
        "student": {"$id": "stu_e2e_test", "id": "stu_e2e_test"},  # Both formats for compatibility
        "templates": [
            {
                "$id": "lt_nat3_aom_best_deal_v1",
                "templateId": "lt_nat3_aom_best_deal_v1",  # Add templateId field
                "title": "Best Deal: Unit Price & Simple Discounts",
                "status": "published",
                "outcomeRefs": ["HV7Y73_O1.4", "H22573_O1.2"],
                "estMinutes": 25
            },
            {
                "$id": "lt_nat3_num_frac_dec_pct_v1",
                "templateId": "lt_nat3_num_frac_dec_pct_v1",  # Add templateId field
                "title": "Fractions ↔ Decimals ↔ Percents",
                "status": "published",
                "outcomeRefs": ["H22573_O1.2", "H22573_O1.5"],
                "estMinutes": 20
            }
        ],
        # Add required data structures as flat lists (based on course_manager fixes)
        "sow": [
            {"order": 1, "templateId": "lt_nat3_aom_best_deal_v1"},
            {"order": 2, "templateId": "lt_nat3_num_frac_dec_pct_v1"}
        ],
        "mastery": [
            {"templateId": "lt_nat3_aom_best_deal_v1", "emaScore": 0.4},
            {"templateId": "lt_nat3_num_frac_dec_pct_v1", "emaScore": 0.6}
        ],
        "routine": [
            {"templateId": "lt_nat3_aom_best_deal_v1", "dueAt": "2024-01-15"},
            {"templateId": "lt_nat3_num_frac_dec_pct_v1", "dueAt": "2024-01-20"}
        ],
        "constraints": {"maxBlockMinutes": 25}
    }


@pytest.fixture
def sample_lesson_context():
    """Sample lesson context for teaching testing."""
    return {
        "session_id": "sess_e2e_test_001",
        "student_id": "stu_e2e_test",
        "lesson_snapshot": {
            "title": "Best Deal: Unit Price & Simple Discounts",
            "courseId": "course_c84473",  # Add courseId to lesson_snapshot
            "lessonTemplateId": "lt_nat3_aom_best_deal_v1",
            "cards": [
                {
                    "id": "intro_card",
                    "title": "Introduction",
                    "explainer": "Welcome to the lesson on finding the best deal! We'll learn about unit prices and simple discounts.",
                    "cfu": {
                        "id": "intro_cfu",
                        "type": "text",
                        "question": "Are you ready to learn about finding the best deal?",
                        "expected": "yes"
                    }
                },
                {
                    "id": "q1",
                    "title": "Practice Question",
                    "explainer": "Let's practice what we learned about unit prices.",
                    "cfu": {
                        "id": "q1_cfu",
                        "type": "multiple_choice",
                        "question": "Which is the better deal: $5 for 2 items or $7 for 3 items?",
                        "options": ["$5 for 2 items", "$7 for 3 items", "They are equal"],
                        "expected": "$7 for 3 items"
                    }
                }
            ]
        }
    }