#!/usr/bin/env python3
"""Test of dual-source context-aware implementation."""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../src'))

from react_agent.utils import (
    extract_teaching_context,
    calculate_context_quality_score,
    extract_static_context,
    extract_dynamic_context,
    merge_dual_source_contexts,
    calculate_dual_source_quality_scores
)
from react_agent.context import Context
from react_agent.state import DynamicLessonContext


def test_legacy_context_extraction():
    """Test legacy context extraction functionality."""
    print("=== Testing Legacy Context Extraction ===")

    # Test legacy session context format
    session_context = {
        "session_id": "test-session-123",
        "student_id": "student-456",
        "lesson_snapshot": {
            "courseId": "course-789",
            "title": "Introduction to Fractions",
            "topic": "Mathematics - Fractions",
            "objectives": ["Learn fraction basics", "Practice with examples"]
        }
    }

    # Extract teaching context
    teaching_context = extract_teaching_context(session_context)
    assert teaching_context is not None
    assert teaching_context.session_id == "test-session-123"
    assert teaching_context.student_id == "student-456"
    assert teaching_context.lesson_title == "Introduction to Fractions"

    # Calculate quality score
    quality_score = calculate_context_quality_score(teaching_context)
    assert 0.0 <= quality_score <= 1.0
    print(f"✅ Legacy context extraction working (quality: {quality_score:.2f})")

    return teaching_context, quality_score


def test_dual_source_context_extraction():
    """Test new dual-source context extraction."""
    print("=== Testing Dual-Source Context Extraction ===")

    # Test static context
    static_context_data = {
        "session_id": "test-session-456",
        "student_id": "student-789",
        "lesson_snapshot": {
            "courseId": "math-advanced",
            "title": "Advanced Fractions",
            "topic": "Mathematics - Advanced Fractions"
        },
        "mode": "teaching"
    }

    static_context = extract_static_context(static_context_data)
    assert static_context is not None
    assert static_context.session_id == "test-session-456"
    assert static_context.lesson_title == "Advanced Fractions"

    # Test dynamic context
    dynamic_context_data = {
        "card_data": {
            "id": "card-1",
            "content": "Simplify 4/8",
            "cfu": {"type": "text", "answer": "1/2"}
        },
        "card_index": 2,
        "total_cards": 5,
        "interaction_state": "presenting"
    }

    dynamic_context = extract_dynamic_context(dynamic_context_data)
    assert dynamic_context is not None
    assert dynamic_context.card_index == 2
    assert dynamic_context.total_cards == 5

    # Test context merging
    merged_context = merge_dual_source_contexts(static_context, dynamic_context)
    assert isinstance(merged_context, dict)
    assert "static_available" in merged_context
    assert "dynamic_available" in merged_context
    assert merged_context["static_available"] == True
    assert merged_context["dynamic_available"] == True
    # Check nested session data
    if "session" in merged_context:
        assert "session_id" in merged_context["session"]
    # Check current card data
    if "current_card" in merged_context:
        assert "card_index" in merged_context["current_card"]

    # Test quality scoring
    quality_scores = calculate_dual_source_quality_scores(static_context, dynamic_context)
    assert "static_quality" in quality_scores
    assert "dynamic_quality" in quality_scores
    assert "combined_quality" in quality_scores
    assert 0.0 <= quality_scores["combined_quality"] <= 1.0

    print(f"✅ Dual-source context extraction working")
    print(f"   - Static quality: {quality_scores['static_quality']:.2f}")
    print(f"   - Dynamic quality: {quality_scores['dynamic_quality']:.2f}")
    print(f"   - Combined quality: {quality_scores['combined_quality']:.2f}")

    return static_context, dynamic_context, merged_context, quality_scores

def test_context_configuration():
    """Test context configuration."""
    print("\n=== Testing Context Configuration ===")

    context = Context()
    assert context.model == "anthropic/claude-3-5-sonnet-20240620"
    assert context.max_search_results == 5
    assert context.context_quality_threshold == 0.3
    assert context.enable_context_search_enhancement == True

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

    assert teaching_context is None
    assert quality_score == 0.0

    print(f"✅ No context handled gracefully")
    print(f"   - Context: {teaching_context}")
    print(f"   - Quality Score: {quality_score}")

    return True


if __name__ == "__main__":
    try:
        # Run all tests
        legacy_context, legacy_quality = test_legacy_context_extraction()
        static_ctx, dynamic_ctx, merged_ctx, quality_scores = test_dual_source_context_extraction()
        context_config = test_context_configuration()
        no_context_ok = test_no_context_scenario()

        print("\n=== Summary ===")
        print(f"✅ Legacy context extraction: Working (quality: {legacy_quality:.2f})")
        print(f"✅ Dual-source context: Working (combined quality: {quality_scores['combined_quality']:.2f})")
        print(f"✅ Configuration: Working (model: {context_config.model})")
        print(f"✅ No context handling: {'Working' if no_context_ok else 'Failed'}")
        print("\n🎉 Dual-source context-aware implementation is functional!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)