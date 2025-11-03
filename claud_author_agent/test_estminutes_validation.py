#!/usr/bin/env python3
"""Test script to verify estMinutes validation with lesson_type awareness.

Tests that mock_exam lessons can have estMinutes up to 180, while regular
lessons are capped at 120 minutes.
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from tools.json_validator_tool import LessonTemplate


def test_regular_lesson_valid():
    """Test that regular lessons with 120 minutes pass validation."""
    data = {
        "courseId": "course_test123",
        "title": "Test Lesson Title - Learning Fractions and Percentages",
        "outcomeRefs": ["MNU_4_07a"],
        "lesson_type": "teach",
        "estMinutes": 120,
        "sow_order": 1,
        "cards": [
            {
                "id": "card_001",
                "title": "Introduction to Fractions - Understanding Parts of a Whole",
                "explainer": "A fraction represents a part of a whole. The top number (numerator) tells us how many parts we have, while the bottom number (denominator) tells us how many equal parts the whole is divided into.",
                "explainer_plain": "A fraction shows part of something. The top number shows how many parts we have. The bottom number shows how many parts the whole thing is split into.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "What fraction is shaded in this diagram? [3 out of 8 boxes shaded]",
                    "options": ["1/8", "3/8", "5/8", "8/3"],
                    "answerIndex": 1,
                    "rubric": {
                        "criteria": [
                            {
                                "descriptor": "Correctly identifies numerator and denominator",
                                "points": 1
                            }
                        ],
                        "total_points": 1
                    }
                },
                "misconceptions": [
                    {
                        "id": "MISC_MATHS_FRACTIONS_001",
                        "error_pattern": "Student counts unshaded boxes instead of shaded",
                        "why_it_happens": "Visual attention to wrong part of diagram",
                        "how_to_address": "Explicitly label 'shaded' vs 'total' parts before counting"
                    }
                ]
            }
        ]
    }

    try:
        model = LessonTemplate(**data)
        print("✅ PASS: Regular lesson with 120 minutes validated successfully")
        return True
    except Exception as e:
        print(f"❌ FAIL: Regular lesson with 120 minutes failed validation: {e}")
        return False


def test_regular_lesson_too_long():
    """Test that regular lessons with 121+ minutes fail validation."""
    data = {
        "courseId": "course_test123",
        "title": "Test Lesson Title - Learning Fractions and Percentages",
        "outcomeRefs": ["MNU_4_07a"],
        "lesson_type": "teach",
        "estMinutes": 121,
        "sow_order": 1,
        "cards": [
            {
                "id": "card_001",
                "title": "Introduction to Fractions - Understanding Parts of a Whole",
                "explainer": "A fraction represents a part of a whole. The top number (numerator) tells us how many parts we have, while the bottom number (denominator) tells us how many equal parts the whole is divided into.",
                "explainer_plain": "A fraction shows part of something. The top number shows how many parts we have. The bottom number shows how many parts the whole thing is split into.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "What fraction is shaded in this diagram? [3 out of 8 boxes shaded]",
                    "options": ["1/8", "3/8", "5/8", "8/3"],
                    "answerIndex": 1,
                    "rubric": {
                        "criteria": [
                            {
                                "descriptor": "Correctly identifies numerator and denominator",
                                "points": 1
                            }
                        ],
                        "total_points": 1
                    }
                },
                "misconceptions": [
                    {
                        "id": "MISC_MATHS_FRACTIONS_001",
                        "error_pattern": "Student counts unshaded boxes instead of shaded",
                        "why_it_happens": "Visual attention to wrong part of diagram",
                        "how_to_address": "Explicitly label 'shaded' vs 'total' parts before counting"
                    }
                ]
            }
        ]
    }

    try:
        model = LessonTemplate(**data)
        print("❌ FAIL: Regular lesson with 121 minutes should have failed validation")
        return False
    except ValueError as e:
        if "121" in str(e) and "120" in str(e):
            print("✅ PASS: Regular lesson with 121 minutes correctly rejected")
            return True
        else:
            print(f"❌ FAIL: Wrong error message: {e}")
            return False


def test_mock_exam_165_minutes():
    """Test that mock_exam lessons with 165 minutes pass validation."""
    data = {
        "courseId": "course_test123",
        "title": "Mock Assessment - Paper 1 and Paper 2 Full Simulation National 5 Exam",
        "outcomeRefs": ["MNU_4_07a"],
        "lesson_type": "mock_exam",
        "estMinutes": 165,
        "sow_order": 12,
        "cards": [
            {
                "id": "card_001",
                "title": "Mock Exam Briefing - Understanding Assessment Conditions Today",
                "explainer": "Today you will complete a full mock exam simulating the SQA National 5 Mathematics exam. You will complete Paper 1 (non-calculator, 50 minutes) and Paper 2 (calculator allowed, 100 minutes) with a 5-minute break in between.",
                "explainer_plain": "Today you will do a practice exam. You will do Paper 1 without a calculator for 50 minutes. Then you will have a 5 minute break. Then you will do Paper 2 with a calculator for 100 minutes.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "What is NOT allowed during Paper 1 of today's mock exam?",
                    "options": ["Pen", "Ruler", "Calculator", "Pencil"],
                    "answerIndex": 2,
                    "rubric": {
                        "criteria": [
                            {
                                "descriptor": "Correctly identifies exam restrictions",
                                "points": 1
                            }
                        ],
                        "total_points": 1
                    }
                },
                "misconceptions": [
                    {
                        "id": "MISC_MATHS_EXAM_001",
                        "error_pattern": "Student forgets which paper allows calculator",
                        "why_it_happens": "Confusion between Paper 1 and Paper 2 rules",
                        "how_to_address": "Explicitly remind: Paper 1 = no calculator, Paper 2 = calculator allowed"
                    }
                ]
            }
        ]
    }

    try:
        model = LessonTemplate(**data)
        print("✅ PASS: Mock exam with 165 minutes validated successfully")
        return True
    except Exception as e:
        print(f"❌ FAIL: Mock exam with 165 minutes failed validation: {e}")
        return False


def test_mock_exam_180_minutes():
    """Test that mock_exam lessons with 180 minutes (max) pass validation."""
    data = {
        "courseId": "course_test123",
        "title": "Mock Assessment - Extended Multi-Paper Full Simulation National 5 Exam",
        "outcomeRefs": ["MNU_4_07a"],
        "lesson_type": "mock_exam",
        "estMinutes": 180,
        "sow_order": 12,
        "cards": [
            {
                "id": "card_001",
                "title": "Mock Exam Briefing - Understanding Assessment Conditions Today",
                "explainer": "Today you will complete an extended mock exam simulating the full SQA National 5 Mathematics exam with additional review time.",
                "explainer_plain": "Today you will do a practice exam with extra time to review your work.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "What is the purpose of today's mock exam?",
                    "options": ["Homework", "Practice", "Real exam", "Class discussion"],
                    "answerIndex": 1,
                    "rubric": {
                        "criteria": [
                            {
                                "descriptor": "Understands mock exam purpose",
                                "points": 1
                            }
                        ],
                        "total_points": 1
                    }
                },
                "misconceptions": [
                    {
                        "id": "MISC_MATHS_EXAM_001",
                        "error_pattern": "Student thinks mock exam counts toward grade",
                        "why_it_happens": "Confusion about practice vs real assessment",
                        "how_to_address": "Clarify that mock exams are for practice and feedback only"
                    }
                ]
            }
        ]
    }

    try:
        model = LessonTemplate(**data)
        print("✅ PASS: Mock exam with 180 minutes (max) validated successfully")
        return True
    except Exception as e:
        print(f"❌ FAIL: Mock exam with 180 minutes failed validation: {e}")
        return False


def test_mock_exam_too_long():
    """Test that mock_exam lessons with 181+ minutes fail validation."""
    data = {
        "courseId": "course_test123",
        "title": "Mock Assessment - Extended Multi-Paper Full Simulation National 5 Exam",
        "outcomeRefs": ["MNU_4_07a"],
        "lesson_type": "mock_exam",
        "estMinutes": 181,
        "sow_order": 12,
        "cards": [
            {
                "id": "card_001",
                "title": "Mock Exam Briefing - Understanding Assessment Conditions Today",
                "explainer": "Today you will complete an extended mock exam simulating the full SQA National 5 Mathematics exam with additional review time.",
                "explainer_plain": "Today you will do a practice exam with extra time to review your work.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "What is the purpose of today's mock exam?",
                    "options": ["Homework", "Practice", "Real exam", "Class discussion"],
                    "answerIndex": 1,
                    "rubric": {
                        "criteria": [
                            {
                                "descriptor": "Understands mock exam purpose",
                                "points": 1
                            }
                        ],
                        "total_points": 1
                    }
                },
                "misconceptions": [
                    {
                        "id": "MISC_MATHS_EXAM_001",
                        "error_pattern": "Student thinks mock exam counts toward grade",
                        "why_it_happens": "Confusion about practice vs real assessment",
                        "how_to_address": "Clarify that mock exams are for practice and feedback only"
                    }
                ]
            }
        ]
    }

    try:
        model = LessonTemplate(**data)
        print("❌ FAIL: Mock exam with 181 minutes should have failed validation")
        return False
    except ValueError as e:
        if "181" in str(e) and "180" in str(e):
            print("✅ PASS: Mock exam with 181 minutes correctly rejected")
            return True
        else:
            print(f"❌ FAIL: Wrong error message: {e}")
            return False


def main():
    """Run all tests and report results."""
    print("=" * 70)
    print("Testing estMinutes Validation with Lesson-Type Awareness")
    print("=" * 70)
    print()

    tests = [
        ("Regular lesson (120 min - valid)", test_regular_lesson_valid),
        ("Regular lesson (121 min - invalid)", test_regular_lesson_too_long),
        ("Mock exam (165 min - valid)", test_mock_exam_165_minutes),
        ("Mock exam (180 min - max valid)", test_mock_exam_180_minutes),
        ("Mock exam (181 min - invalid)", test_mock_exam_too_long),
    ]

    results = []
    for test_name, test_func in tests:
        print(f"\nTest: {test_name}")
        print("-" * 70)
        passed = test_func()
        results.append((test_name, passed))

    print()
    print("=" * 70)
    print("Test Summary")
    print("=" * 70)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    all_passed = all(passed for _, passed in results)
    print()
    if all_passed:
        print("🎉 All tests passed! estMinutes validation is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Review the output above for details.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
