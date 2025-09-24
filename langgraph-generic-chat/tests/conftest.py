"""
Test configuration and fixtures for context-aware chat agent integration testing.

This module provides:
- LangGraph dev server management for isolated testing
- Sample teaching contexts matching frontend format
- Client fixtures for SDK-based integration testing
"""

import pytest
import subprocess
import time
import requests
import signal
import os
from typing import Dict, Any
from langgraph_sdk import get_client


@pytest.fixture(scope="session")
def langgraph_server():
    """
    Start langgraph dev server on port 2700 for integration testing.

    RED STATE: This will initially fail because context-chat-agent doesn't exist yet.
    GREEN STATE: Server starts successfully when graph is implemented.
    """
    print("Starting LangGraph test server on port 2700...")

    # Start server with custom port to avoid conflicts
    process = subprocess.Popen(
        ["langgraph", "dev", "--port", "2700"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid  # Create process group for clean termination
    )

    # Wait for server to be ready
    server_ready = False
    for i in range(30):  # Wait up to 30 seconds
        try:
            response = requests.get("http://localhost:2700/docs", timeout=2)
            if response.status_code == 200:
                print("✅ LangGraph test server ready")
                server_ready = True
                break
        except requests.RequestException:
            pass
        print(f"Waiting for server... ({i+1}/30)")
        time.sleep(1)

    if not server_ready:
        process.terminate()
        pytest.fail("LangGraph test server failed to start within 30 seconds")

    yield "http://localhost:2700"

    # Cleanup: terminate the entire process group
    print("Stopping LangGraph test server...")
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        process.wait(timeout=5)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        # Force kill if graceful termination fails
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
    print("✅ Test server stopped")


@pytest.fixture
def langgraph_client(langgraph_server):
    """LangGraph SDK client for integration testing."""
    return get_client(url=langgraph_server)


@pytest.fixture
def teaching_context() -> Dict[str, Any]:
    """
    Sample teaching context matching the ACTUAL main graph state structure.

    This represents the exact state format from the running main teaching graph
    when a student is in the middle of a fraction lesson - direct state structure.
    """
    return {
        # Direct main graph state structure (flattened by main graph)
        "session_id": "test_session_123",
        "student_id": "student_456",
        "course_id": "math-fractions-101",
        "mode": "teaching",
        "lesson_snapshot": {
            "courseId": "math-fractions-101",
            "title": "Introduction to Fractions",
            "topic": "Mathematics - Fractions",
            "objectives": [
                "Understand numerator and denominator",
                "Compare simple fractions",
                "Recognize equivalent fractions"
            ],
            "cards": [
                {
                    "id": "card-1",
                    "content": "What is 2/10 simplified?",
                    "cfu": {
                        "type": "text",
                        "answer": "1/5"
                    }
                },
                {
                    "id": "card-2",
                    "content": "Which is larger: 3/4 or 2/3?",
                    "cfu": {
                        "type": "mcq",
                        "options": ["3/4", "2/3"],
                        "correct": 0
                    }
                }
            ]
        },
        "messages": [
            {
                "content": "I want to learn about fractions",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "human",
                "name": None,
                "id": "msg-1",
                "example": False
            },
            {
                "content": "Let's start with basic fractions. A fraction has two parts: the numerator (top number) and denominator (bottom number).",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "ai",
                "name": None,
                "id": "msg-2",
                "example": False
            },
            {
                "content": "What does 2/10 mean?",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "human",
                "name": None,
                "id": "msg-3",
                "example": False
            },
            {
                "content": "2/10 means you have 2 parts out of 10 total parts. This fraction can also be simplified to 1/5 since both 2 and 10 can be divided by 2.",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "ai",
                "name": None,
                "id": "msg-4",
                "example": False
            }
        ],
        # Fields that would be present in actual main graph state
        "student_response": "What does 2/10 mean?",
        "card_presentation_complete": False,
        "interrupt_count": 0,
        "interrupt_history": [],
        "tool_response_received": False,
        "cards_presented_via_ui": [],
        "feedback_interactions_count": 0,
        "can_resume_from_interrupt": True
    }


@pytest.fixture
def advanced_teaching_context() -> Dict[str, Any]:
    """
    Advanced teaching context for testing progression awareness - direct state structure.
    """
    return {
        # Direct main graph state structure (flattened by main graph)
        "session_id": "test_session_advanced",
        "student_id": "student_advanced",
        "course_id": "course_math_advanced",
        "mode": "teaching",
        "lesson_snapshot": {
            "title": "Advanced Fraction Operations",
            "topic": "Mathematics - Fraction Operations",
            "courseId": "course_math_advanced",
            "objectives": [
                "Add and subtract fractions with different denominators",
                "Multiply and divide fractions",
                "Solve word problems involving fractions"
            ],
            "cards": [
                {
                    "id": "card-adv-1",
                    "content": "Add 1/4 + 2/3 by finding a common denominator",
                    "cfu": {
                        "type": "text",
                        "answer": "11/12"
                    }
                },
                {
                    "id": "card-adv-2",
                    "content": "Solve: 3/5 × 2/7",
                    "cfu": {
                        "type": "text",
                        "answer": "6/35"
                    }
                }
            ]
        },
        "messages": [
            {
                "content": "How do I add 1/4 + 2/3?",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "human",
                "name": None,
                "id": "msg-adv-1",
                "example": False
            },
            {
                "content": "To add fractions with different denominators, we need to find a common denominator. For 1/4 + 2/3, the LCD is 12.",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "ai",
                "name": None,
                "id": "msg-adv-2",
                "example": False
            },
            {
                "content": "That makes sense! Can you show me the steps?",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "human",
                "name": None,
                "id": "msg-adv-3",
                "example": False
            },
            {
                "content": "Since you already understand basic fractions well, let me show you: 1/4 = 3/12 and 2/3 = 8/12. So 1/4 + 2/3 = 3/12 + 8/12 = 11/12.",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "ai",
                "name": None,
                "id": "msg-adv-4",
                "example": False
            }
        ],
        # Fields that would be present in actual main graph state
        "student_response": "That makes sense! Can you show me the steps?",
        "card_presentation_complete": False,
        "interrupt_count": 0,
        "interrupt_history": [],
        "tool_response_received": False,
        "cards_presented_via_ui": [],
        "feedback_interactions_count": 2,
        "can_resume_from_interrupt": True
    }


@pytest.fixture
def no_context_session() -> Dict[str, Any]:
    """
    Session context without teaching state for testing fallback behavior.
    """
    return {
        "session_id": "generic_chat_session",
        "student_id": "student_generic",
        # No lesson_snapshot or main_graph_state - should trigger generic mode
    }


@pytest.fixture
def search_teaching_context() -> Dict[str, Any]:
    """
    Teaching context specifically for testing search integration - direct state structure.
    """
    return {
        # Direct main graph state structure (flattened by main graph)
        "session_id": "test_search_session",
        "student_id": "student_search",
        "course_id": "course_numbers",
        "mode": "teaching",
        "lesson_snapshot": {
            "title": "Decimal and Fraction Relationships",
            "topic": "Mathematics - Number Relationships",
            "courseId": "course_numbers",
            "objectives": [
                "Convert between fractions and decimals",
                "Understand percentage relationships"
            ],
            "cards": [
                {
                    "id": "card-search-1",
                    "content": "Convert 3/4 to a decimal",
                    "cfu": {
                        "type": "text",
                        "answer": "0.75"
                    }
                }
            ]
        },
        "messages": [
            {
                "content": "I'm confused about how fractions relate to decimals",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "human",
                "name": None,
                "id": "msg-search-1",
                "example": False
            },
            {
                "content": "Fractions and decimals are different ways to represent the same value. For example, 1/2 = 0.5",
                "additional_kwargs": {},
                "response_metadata": {},
                "type": "ai",
                "name": None,
                "id": "msg-search-2",
                "example": False
            }
        ],
        # Fields that would be present in actual main graph state
        "student_response": "I'm confused about how fractions relate to decimals",
        "card_presentation_complete": False,
        "interrupt_count": 0,
        "interrupt_history": [],
        "tool_response_received": False,
        "cards_presented_via_ui": [],
        "feedback_interactions_count": 0,
        "can_resume_from_interrupt": True
    }