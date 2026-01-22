#!/usr/bin/env python3
"""
Seed NAT5+ Diagram Test Exam for E2E Testing

Creates a short 3-question NAT5+ exam with diagram-required questions for testing
multimodal grading with student-drawn diagrams via the SQA mock exam route.

This tests the SEPARATE code path:
- Route: /sqa-mock-exam/[examId]
- Components: SQAExamContainer → SQAQuestionDisplay → RichTextEditor
- Collection: nat5_plus_mock_exams
- Graph: graph_nat5_plus_exam

Usage:
    cd assistant-ui-frontend
    python scripts/seed_nat5_plus_diagram_exam.py

Environment variables (loaded from .env.local):
    NEXT_PUBLIC_APPWRITE_ENDPOINT - Appwrite endpoint URL
    NEXT_PUBLIC_APPWRITE_PROJECT_ID - Project ID
    APPWRITE_API_KEY - Server-side API key
"""

import json
import gzip
import base64
import os
from datetime import datetime, timezone

# Load environment from .env.local
from dotenv import load_dotenv
load_dotenv('.env.local')

from appwrite.client import Client
from appwrite.services.databases import Databases

# ========================================
# CONFIGURATION
# ========================================
DATABASE_ID = "default"
COLLECTION_ID = "nat5_plus_mock_exams"
EXAM_ID = "test_nat5_plus_diagram_exam"

# ========================================
# EXAM METADATA
# ========================================
EXAM_METADATA = {
    "title": "NAT5 Diagram & Drawing Test Exam",
    "total_marks": 9,
    "duration_minutes": 15,
    "calculator_allowed": True,
    "generated_at": "2025-01-21T10:00:00Z",
    "sqa_aligned": True
}

# ========================================
# EXAM SECTIONS WITH QUESTIONS (Inline Data)
# ========================================
EXAM_SECTIONS = [
    {
        "section_id": "section_diagram_test",
        "section_name": "Section A - Diagram Questions",
        "total_marks": 9,
        "instructions": "Answer ALL questions. Include diagrams where requested. Show all working clearly.",
        "questions": [
            {
                "question_id": "q1_quadratic",
                "question_number": "1",
                "marks": 3,
                "difficulty": "easy",
                "question_style": "procedural",
                "stem": "Solve the quadratic equation x² - 5x + 6 = 0 by factorisation.",
                "stem_latex": "Solve the quadratic equation $x^2 - 5x + 6 = 0$ by factorisation.",
                "topic_ids": ["nat5_algebra_quadratics"],
                "template_paper_id": "sqa_nat5_math_2023_p1",
                "marking_scheme": {
                    "max_marks": 3,
                    "generic_scheme": [
                        {"bullet": 1, "process": "Factorise the quadratic expression", "marks": 1},
                        {"bullet": 2, "process": "Set each factor equal to zero", "marks": 1},
                        {"bullet": 3, "process": "State both solutions correctly", "marks": 1}
                    ],
                    "illustrative_scheme": [
                        {
                            "bullet": 1,
                            "answer": "(x - 2)(x - 3) = 0",
                            "answer_latex": "$(x - 2)(x - 3) = 0$",
                            "tolerance_range": None,
                            "acceptable_variations": ["(x-2)(x-3)=0", "(x-3)(x-2)=0"]
                        },
                        {
                            "bullet": 2,
                            "answer": "x - 2 = 0 or x - 3 = 0",
                            "answer_latex": "$x - 2 = 0$ or $x - 3 = 0$",
                            "tolerance_range": None,
                            "acceptable_variations": []
                        },
                        {
                            "bullet": 3,
                            "answer": "x = 2 or x = 3",
                            "answer_latex": "$x = 2$ or $x = 3$",
                            "tolerance_range": None,
                            "acceptable_variations": ["x=2, x=3", "x=3, x=2", "{2, 3}"]
                        }
                    ],
                    "notes": ["Accept solutions in any order", "Award marks for correct working even if final answer has sign error"]
                },
                "diagrams": [],
                "hints": ["What two numbers multiply to give +6 and add to give -5?", "Try (x - a)(x - b) form"],
                "common_errors": [
                    "Using wrong signs in factors",
                    "Forgetting to state both solutions",
                    "Sign errors when expanding to check"
                ]
            },
            {
                "question_id": "q2_diagram_circle",
                "question_number": "2",
                "marks": 3,
                "difficulty": "medium",
                "question_style": "application",
                "stem": "Draw a circle with centre O and radius 4cm. Mark a chord AB of length 6cm and draw the perpendicular from O to AB, marking the point M where it meets AB. Calculate the length OM.",
                "stem_latex": "Draw a circle with centre O and radius $4\\text{cm}$. Mark a chord AB of length $6\\text{cm}$ and draw the perpendicular from O to AB, marking the point M where it meets AB. Calculate the length OM.",
                "topic_ids": ["nat5_geometry_circles", "nat5_pythagoras"],
                "template_paper_id": "sqa_nat5_math_2022_p2",
                "marking_scheme": {
                    "max_marks": 3,
                    "generic_scheme": [
                        {"bullet": 1, "process": "Draw circle with chord and perpendicular correctly", "marks": 1},
                        {"bullet": 2, "process": "Identify that M bisects AB, so AM = 3cm", "marks": 1},
                        {"bullet": 3, "process": "Use Pythagoras to find OM = √(4² - 3²) = √7 ≈ 2.65cm", "marks": 1}
                    ],
                    "illustrative_scheme": [
                        {
                            "bullet": 1,
                            "answer": "Correct diagram with circle, chord AB, perpendicular OM",
                            "answer_latex": None,
                            "tolerance_range": "±10% on proportions",
                            "acceptable_variations": ["Any orientation"]
                        },
                        {
                            "bullet": 2,
                            "answer": "AM = MB = 3cm (perpendicular bisects chord)",
                            "answer_latex": "$AM = MB = 3\\text{cm}$",
                            "tolerance_range": None,
                            "acceptable_variations": []
                        },
                        {
                            "bullet": 3,
                            "answer": "OM = √7 ≈ 2.65cm",
                            "answer_latex": "$OM = \\sqrt{7} \\approx 2.65\\text{cm}$",
                            "tolerance_range": "±0.01",
                            "acceptable_variations": ["√7", "2.65", "2.6", "2.646"]
                        }
                    ],
                    "notes": [
                        "Accept any orientation of the diagram",
                        "The perpendicular from centre to chord bisects the chord",
                        "DIAGRAM REQUIRED: Evaluate student's drawn diagram for accuracy",
                        "Award bullet 1 if diagram shows correct geometric relationships"
                    ]
                },
                "diagrams": [],
                "hints": ["The perpendicular from centre to chord bisects the chord", "Use Pythagoras: OA² = OM² + AM²"],
                "common_errors": [
                    "Forgetting that perpendicular bisects the chord",
                    "Using wrong value for AM (using 6 instead of 3)",
                    "Arithmetic errors in Pythagoras calculation"
                ]
            },
            {
                "question_id": "q3_diagram_trig_graph",
                "question_number": "3",
                "marks": 3,
                "difficulty": "medium",
                "question_style": "application",
                "stem": "Sketch the graph of y = 2sin(x) for 0° ≤ x ≤ 360°. Mark clearly the maximum and minimum values and where the graph crosses the x-axis.",
                "stem_latex": "Sketch the graph of $y = 2\\sin(x)$ for $0° \\leq x \\leq 360°$. Mark clearly the maximum and minimum values and where the graph crosses the x-axis.",
                "topic_ids": ["nat5_trigonometry_graphs", "nat5_functions"],
                "template_paper_id": "sqa_nat5_math_2023_p2",
                "marking_scheme": {
                    "max_marks": 3,
                    "generic_scheme": [
                        {"bullet": 1, "process": "Draw sinusoidal curve with correct shape and period 360°", "marks": 1},
                        {"bullet": 2, "process": "Mark amplitude correctly: max at y=2, min at y=-2", "marks": 1},
                        {"bullet": 3, "process": "Mark x-intercepts at x=0°, 180°, 360°", "marks": 1}
                    ],
                    "illustrative_scheme": [
                        {
                            "bullet": 1,
                            "answer": "Sinusoidal curve completing one full period from 0° to 360°",
                            "answer_latex": None,
                            "tolerance_range": None,
                            "acceptable_variations": []
                        },
                        {
                            "bullet": 2,
                            "answer": "Maximum at (90°, 2), Minimum at (270°, -2)",
                            "answer_latex": "Maximum at $(90°, 2)$, Minimum at $(270°, -2)$",
                            "tolerance_range": None,
                            "acceptable_variations": []
                        },
                        {
                            "bullet": 3,
                            "answer": "Crosses x-axis at 0°, 180°, 360°",
                            "answer_latex": "Crosses $x$-axis at $0°, 180°, 360°$",
                            "tolerance_range": None,
                            "acceptable_variations": ["0, 180, 360"]
                        }
                    ],
                    "notes": [
                        "Accept follow-through if shape is correct but amplitude wrong",
                        "Graph must show characteristic sine wave shape",
                        "DIAGRAM REQUIRED: Evaluate student's drawn graph for accuracy",
                        "Award bullet 1 if graph shows recognisable sinusoidal shape with correct period"
                    ]
                },
                "diagrams": [],
                "hints": ["The '2' in front of sin stretches the graph vertically", "sin(0°)=0, sin(90°)=1, sin(180°)=0, sin(270°)=-1"],
                "common_errors": [
                    "Drawing cos graph instead of sin",
                    "Wrong amplitude (using 1 instead of 2)",
                    "Missing or incorrect x-intercept labels",
                    "Drawing a straight line or parabola"
                ]
            }
        ]
    }
]

# ========================================
# UTILITY FUNCTIONS
# ========================================

def compress_json(data: dict | list) -> str:
    """Compress a dictionary/list to gzip+base64 string (Python/raw format).

    Note: Python format is raw base64 WITHOUT the 'gzip:' prefix.
    The frontend decompressJSON handles both formats.
    """
    json_str = json.dumps(data)
    compressed = gzip.compress(json_str.encode('utf-8'))
    return base64.b64encode(compressed).decode('utf-8')


def create_exam_document(databases: Databases) -> str:
    """Create or update the NAT5+ diagram test exam in Appwrite.

    Returns:
        Document ID of the created exam
    """
    print(f"\nCreating exam: {EXAM_ID}")

    # Compress sections for storage
    compressed_sections = compress_json(EXAM_SECTIONS)
    print(f"  Sections compressed: {len(json.dumps(EXAM_SECTIONS))} -> {len(compressed_sections)} chars")

    # Prepare document data matching Nat5PlusMockExam interface
    document_data = {
        "courseId": "test_course_nat5_math",
        "subject": "Mathematics",
        "level": "national-5",
        "exam_version": 1,
        "status": "published",
        "metadata": json.dumps(EXAM_METADATA),
        "sections": compressed_sections,
        "topic_coverage": [
            "nat5_algebra_quadratics",
            "nat5_geometry_circles",
            "nat5_pythagoras",
            "nat5_trigonometry_graphs",
            "nat5_functions"
        ],
        "difficulty_distribution": json.dumps({
            "easy": 0.33,
            "medium": 0.67,
            "hard": 0.0
        }),
        "template_sources": [
            "sqa_nat5_math_2022_p2",
            "sqa_nat5_math_2023_p1",
            "sqa_nat5_math_2023_p2"
        ],
        "generation_metadata": json.dumps({
            "model": "test_fixture",
            "tokens_used": 0,
            "generation_timestamp": "2025-01-21T10:00:00Z",
            "pipeline_version": "test_1.0.0"
        }),
        "created_at": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000+00:00'),
        "last_modified": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000+00:00')
    }

    # Try to delete existing document first (idempotent)
    try:
        databases.delete_document(DATABASE_ID, COLLECTION_ID, EXAM_ID)
        print(f"  Deleted existing exam: {EXAM_ID}")
    except Exception:
        pass  # Document doesn't exist, that's fine

    # Create new document with specific ID
    try:
        result = databases.create_document(
            database_id=DATABASE_ID,
            collection_id=COLLECTION_ID,
            document_id=EXAM_ID,
            data=document_data
        )
        doc_id = result["$id"]
        print(f"  Created exam document: {doc_id}")
        return doc_id
    except Exception as e:
        raise RuntimeError(f"Failed to create exam document: {e}")


def main() -> None:
    """Main entry point."""
    print("=" * 60)
    print("Seed NAT5+ Diagram Test Exam for E2E Testing")
    print("=" * 60)

    # Get environment variables
    endpoint = os.environ.get("NEXT_PUBLIC_APPWRITE_ENDPOINT")
    project_id = os.environ.get("NEXT_PUBLIC_APPWRITE_PROJECT_ID")
    api_key = os.environ.get("APPWRITE_API_KEY")

    if not all([endpoint, project_id, api_key]):
        raise ValueError(
            "Missing environment variables. Ensure .env.local contains:\n"
            "  - NEXT_PUBLIC_APPWRITE_ENDPOINT\n"
            "  - NEXT_PUBLIC_APPWRITE_PROJECT_ID\n"
            "  - APPWRITE_API_KEY"
        )

    print(f"\nConfiguration:")
    print(f"  Endpoint: {endpoint}")
    print(f"  Project: {project_id}")
    print(f"  Database: {DATABASE_ID}")
    print(f"  Collection: {COLLECTION_ID}")
    print(f"  Exam ID: {EXAM_ID}")

    # Initialize Appwrite client
    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)

    # Create exam
    doc_id = create_exam_document(databases)

    # Summary
    print("\n" + "=" * 60)
    print("Done! NAT5+ Diagram test exam seeded successfully.")
    print("=" * 60)
    print(f"\nExam Details:")
    print(f"  - Exam ID: {doc_id}")
    print(f"  - Title: {EXAM_METADATA['title']}")
    print(f"  - Total Marks: {EXAM_METADATA['total_marks']}")
    print(f"  - Questions: {len(EXAM_SECTIONS[0]['questions'])}")
    print(f"    - Q1: Quadratic equation (text-only baseline)")
    print(f"    - Q2: Circle/chord geometry (DIAGRAM REQUIRED)")
    print(f"    - Q3: Trig graph y=2sin(x) (DIAGRAM REQUIRED)")
    print(f"\nTest the exam at:")
    print(f"  http://localhost:3000/sqa-mock-exam/{doc_id}")
    print(f"\nRun E2E test with:")
    print(f"  cd assistant-ui-frontend")
    print(f"  npx playwright test sqa-mock-exam.spec.ts --headed")


if __name__ == "__main__":
    main()
