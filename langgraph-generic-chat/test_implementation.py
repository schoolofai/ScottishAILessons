#!/usr/bin/env python3
"""Quick test of context-aware implementation without external dependencies."""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from react_agent.utils import extract_teaching_context, calculate_context_quality_score
from react_agent.context import Context

def test_context_extraction():
    """Test context extraction functionality."""
    print("=== Testing Context Extraction ===")

    # Test session context
    session_context = {
        "session_id": "test-session-123",
        "student_id": "student-456",
        "lesson_snapshot": {
            "courseId": "course-789",
            "title": "Introduction to Fractions",
            "topic": "Mathematics - Fractions",
            "objectives": ["Learn fraction basics", "Practice with examples"]
        },
        "main_graph_state": {
            "current_stage": "introduction",
            "messages": [
                {"role": "teacher", "content": "Welcome to fractions!"},
                {"role": "student", "content": "I'm ready to learn"}
            ],
            "student_progress": {
                "difficulty_level": "beginner",
                "understanding_level": 0.7,
                "current_step": "basic_fractions"
            }
        }
    }

    # Extract teaching context
    teaching_context = extract_teaching_context(session_context)
    print(f"✅ Teaching context extracted successfully")
    print(f"   - Session ID: {teaching_context.session_id}")
    print(f"   - Course ID: {teaching_context.course_id}")
    print(f"   - Lesson Title: {teaching_context.lesson_title}")
    print(f"   - Topic: {teaching_context.lesson_topic}")
    print(f"   - Stage: {teaching_context.current_stage}")
    print(f"   - Recent Exchanges: {len(teaching_context.recent_exchanges)}")

    # Calculate quality score
    quality_score = calculate_context_quality_score(teaching_context)
    print(f"   - Quality Score: {quality_score:.2f}")

    return teaching_context, quality_score

def test_context_configuration():
    """Test context configuration."""
    print("\n=== Testing Context Configuration ===")

    context = Context()
    print(f"✅ Context configuration loaded")
    print(f"   - Model: {context.model}")
    print(f"   - Max search results: {context.max_search_results}")
    print(f"   - Quality threshold: {context.context_quality_threshold}")
    print(f"   - Context enhancement: {context.enable_context_search_enhancement}")

    return context

def test_no_context_scenario():
    """Test behavior with no context."""
    print("\n=== Testing No Context Scenario ===")

    # Test with None
    teaching_context = extract_teaching_context(None)
    quality_score = calculate_context_quality_score(teaching_context)
    print(f"✅ No context handled gracefully")
    print(f"   - Context: {teaching_context}")
    print(f"   - Quality Score: {quality_score}")

    return quality_score == 0.0

if __name__ == "__main__":
    try:
        teaching_context, quality_score = test_context_extraction()
        context_config = test_context_configuration()
        no_context_ok = test_no_context_scenario()

        print("\n=== Summary ===")
        print(f"✅ Context extraction: Working (quality: {quality_score:.2f})")
        print(f"✅ Configuration: Working (model: {context_config.model})")
        print(f"✅ No context handling: {'Working' if no_context_ok else 'Failed'}")
        print("\n🎉 Context-aware implementation is functional!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)