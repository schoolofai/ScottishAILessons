#!/usr/bin/env python3
"""Debug context extraction."""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from react_agent.utils import extract_teaching_context

def debug_extraction():
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

    print("Input session_context:")
    print(f"- lesson_snapshot: {session_context['lesson_snapshot']}")
    print(f"- main_graph_state: {session_context['main_graph_state']}")

    context = extract_teaching_context(session_context)
    print("\nExtracted TeachingContext:")
    print(f"- course_id: '{context.course_id}'")
    print(f"- lesson_title: '{context.lesson_title}'")
    print(f"- lesson_topic: '{context.lesson_topic}'")
    print(f"- current_stage: '{context.current_stage}'")
    print(f"- lesson_snapshot: {context.lesson_snapshot}")

if __name__ == "__main__":
    debug_extraction()