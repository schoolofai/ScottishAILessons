#!/usr/bin/env python3
"""
Seed Diagram Test Exam for E2E Testing

Creates a short 3-question exam with diagram-required questions for testing
multimodal grading with student-drawn diagrams.

Usage:
    cd assistant-ui-frontend
    python scripts/seed_diagram_test_exam.py

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
from appwrite.id import ID

# ========================================
# CONFIGURATION
# ========================================
DATABASE_ID = "default"
COLLECTION_ID = "nat5_plus_mock_exams"
EXAM_ID = "test_short_exam_diagram"

# ========================================
# EXAM METADATA
# ========================================
EXAM_METADATA = {
    "title": "NAT4 Diagram & Drawing Test Exam",
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
                "question_id": "q1_latex",
                "question_number": "1",
                "marks": 3,
                "difficulty": "easy",
                "question_style": "procedural",
                "stem": "Simplify the expression (2x + 4) \u00f7 2",
                "stem_latex": "Simplify $\\frac{2x + 4}{2}$",
                "topic_ids": ["nat4_algebra_simplify"],
                "template_paper_id": "sqa_nat4_math_2023_p1",
                "marking_scheme": {
                    "max_marks": 3,
                    "generic_scheme": [
                        {"bullet": 1, "process": "Factor numerator to show common factor", "marks": 1},
                        {"bullet": 2, "process": "Cancel common factor of 2", "marks": 1},
                        {"bullet": 3, "process": "State final simplified expression correctly", "marks": 1}
                    ],
                    "illustrative_scheme": [
                        {
                            "bullet": 1,
                            "answer": "2(x + 2) / 2",
                            "answer_latex": "$\\frac{2(x + 2)}{2}$",
                            "tolerance_range": None,
                            "acceptable_variations": ["2(x+2)/2", "(2x+4)/2"]
                        },
                        {
                            "bullet": 2,
                            "answer": "Cancel the 2",
                            "answer_latex": None,
                            "tolerance_range": None,
                            "acceptable_variations": ["divide by 2"]
                        },
                        {
                            "bullet": 3,
                            "answer": "x + 2",
                            "answer_latex": "$x + 2$",
                            "tolerance_range": None,
                            "acceptable_variations": ["x+2", "(x+2)", "2+x"]
                        }
                    ],
                    "notes": ["Accept equivalent algebraic forms", "Award marks for correct working even if final answer has sign error"]
                },
                "diagrams": [],
                "hints": ["Look for a common factor in the numerator", "What number divides into both 2x and 4?"],
                "common_errors": [
                    "Forgetting to factor the numerator",
                    "Only simplifying 2x/2 and leaving +4",
                    "Writing x + 4 instead of x + 2"
                ]
            },
            {
                "question_id": "q2_diagram_triangle",
                "question_number": "2",
                "marks": 3,
                "difficulty": "medium",
                "question_style": "application",
                "stem": "Draw a right-angled triangle with sides measuring 3cm, 4cm, and 5cm. Label all three sides with their lengths and clearly mark the right angle with a small square symbol.",
                "stem_latex": "Draw a right-angled triangle with sides measuring $3\\text{cm}$, $4\\text{cm}$, and $5\\text{cm}$. Label all three sides with their lengths and clearly mark the right angle with a small square symbol.",
                "topic_ids": ["nat4_geometry_triangles", "nat4_pythagoras"],
                "template_paper_id": "sqa_nat4_math_2022_p2",
                "marking_scheme": {
                    "max_marks": 3,
                    "generic_scheme": [
                        {"bullet": 1, "process": "Draw a triangle with correct 3:4:5 proportions", "marks": 1},
                        {"bullet": 2, "process": "Label all three sides correctly (3cm, 4cm, 5cm)", "marks": 1},
                        {"bullet": 3, "process": "Mark right angle at correct vertex (between 3cm and 4cm sides)", "marks": 1}
                    ],
                    "illustrative_scheme": [
                        {
                            "bullet": 1,
                            "answer": "Triangle with sides in 3:4:5 ratio",
                            "answer_latex": None,
                            "tolerance_range": "\u00b110% on proportions",
                            "acceptable_variations": ["Any orientation of 3-4-5 triangle"]
                        },
                        {
                            "bullet": 2,
                            "answer": "Labels: 3cm, 4cm, 5cm on correct sides",
                            "answer_latex": None,
                            "tolerance_range": None,
                            "acceptable_variations": ["3, 4, 5 (without cm)", "3 cm, 4 cm, 5 cm"]
                        },
                        {
                            "bullet": 3,
                            "answer": "Right angle symbol (small square) at 90\u00b0 vertex",
                            "answer_latex": None,
                            "tolerance_range": None,
                            "acceptable_variations": ["90\u00b0 label", "Right angle arc with dot"]
                        }
                    ],
                    "notes": [
                        "Accept any orientation of the triangle",
                        "The 5cm side must be the hypotenuse (opposite the right angle)",
                        "Award bullet 1 if triangle is recognisable even if proportions not exact",
                        "DIAGRAM REQUIRED: Evaluate student's drawn diagram for accuracy"
                    ]
                },
                "diagrams": [],
                "hints": ["The longest side (5cm) is always opposite the right angle", "Use Pythagoras: 3\u00b2 + 4\u00b2 = 5\u00b2"],
                "common_errors": [
                    "Placing the right angle opposite the 5cm side instead of between 3cm and 4cm",
                    "Drawing an equilateral or isosceles triangle",
                    "Missing the right angle symbol"
                ]
            },
            {
                "question_id": "q3_diagram_graph",
                "question_number": "3",
                "marks": 3,
                "difficulty": "medium",
                "question_style": "application",
                "stem": "Draw the straight line y = 2x + 1 for values of x from -2 to 2. Label the y-intercept clearly on your graph.",
                "stem_latex": "Draw the straight line $y = 2x + 1$ for values of $x$ from $-2$ to $2$. Label the $y$-intercept clearly on your graph.",
                "topic_ids": ["nat4_algebra_linear_graphs", "nat4_coordinate_geometry"],
                "template_paper_id": "sqa_nat4_math_2023_p2",
                "marking_scheme": {
                    "max_marks": 3,
                    "generic_scheme": [
                        {"bullet": 1, "process": "Plot at least 3 correct points from the line equation", "marks": 1},
                        {"bullet": 2, "process": "Draw a straight line through the plotted points", "marks": 1},
                        {"bullet": 3, "process": "Label the y-intercept at (0, 1)", "marks": 1}
                    ],
                    "illustrative_scheme": [
                        {
                            "bullet": 1,
                            "answer": "Points: (-2,-3), (-1,-1), (0,1), (1,3), (2,5)",
                            "answer_latex": "Points: $(-2,-3), (-1,-1), (0,1), (1,3), (2,5)$",
                            "tolerance_range": "\u00b10.5 units on coordinates",
                            "acceptable_variations": ["Any 3+ correct points from the line"]
                        },
                        {
                            "bullet": 2,
                            "answer": "Straight line connecting points with positive gradient",
                            "answer_latex": None,
                            "tolerance_range": None,
                            "acceptable_variations": ["Line extending beyond plotted points is acceptable"]
                        },
                        {
                            "bullet": 3,
                            "answer": "y-intercept labelled as (0,1) or 'y-int = 1' or c = 1",
                            "answer_latex": "$y$-intercept $= 1$ or $(0, 1)$",
                            "tolerance_range": None,
                            "acceptable_variations": ["1", "(0,1)", "y-int: 1", "c=1"]
                        }
                    ],
                    "notes": [
                        "Accept follow-through marks if points are calculated incorrectly but method shown",
                        "Line must be reasonably straight (not curved)",
                        "DIAGRAM REQUIRED: Evaluate student's drawn graph for accuracy",
                        "Award bullet 1 if at least 3 points satisfy y = 2x + 1"
                    ]
                },
                "diagrams": [],
                "hints": ["Substitute x values to find y: when x=0, y=1", "The gradient is 2 (rises 2 for every 1 across)"],
                "common_errors": [
                    "Drawing a horizontal or vertical line",
                    "Wrong gradient (e.g., gradient of 1 instead of 2)",
                    "Plotting y-intercept at wrong location",
                    "Drawing a curve instead of a straight line"
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
    """Create or update the diagram test exam in Appwrite.

    Returns:
        Document ID of the created exam
    """
    print(f"\nCreating exam: {EXAM_ID}")

    # Compress sections for storage
    compressed_sections = compress_json(EXAM_SECTIONS)
    print(f"  Sections compressed: {len(json.dumps(EXAM_SECTIONS))} -> {len(compressed_sections)} chars")

    # Prepare document data matching ExamDocument interface
    # NOTE: Using "national-4" for enhanced components with Excalidraw drawing support
    document_data = {
        "courseId": "test_course_nat4_math",
        "subject": "Mathematics",
        "level": "national-4",
        "exam_version": 1,
        "status": "published",
        "metadata": json.dumps(EXAM_METADATA),
        "sections": compressed_sections,
        "topic_coverage": [
            "nat4_algebra_simplify",
            "nat4_geometry_triangles",
            "nat4_pythagoras",
            "nat4_algebra_linear_graphs",
            "nat4_coordinate_geometry"
        ],
        "difficulty_distribution": json.dumps({
            "easy": 0.33,
            "medium": 0.67,
            "hard": 0.0
        }),
        "template_sources": [
            "sqa_nat4_math_2022_p2",
            "sqa_nat4_math_2023_p1",
            "sqa_nat4_math_2023_p2"
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
    print("Seed Diagram Test Exam for E2E Testing")
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
    print("Done! Diagram test exam seeded successfully.")
    print("=" * 60)
    print(f"\nExam Details:")
    print(f"  - Exam ID: {doc_id}")
    print(f"  - Title: {EXAM_METADATA['title']}")
    print(f"  - Total Marks: {EXAM_METADATA['total_marks']}")
    print(f"  - Questions: {len(EXAM_SECTIONS[0]['questions'])}")
    print(f"    - Q1: LaTeX/Algebra (text-only baseline)")
    print(f"    - Q2: Right-angled Triangle (DIAGRAM REQUIRED)")
    print(f"    - Q3: Linear Graph y=2x+1 (DIAGRAM REQUIRED)")
    print(f"\nTest the exam at:")
    print(f"  http://localhost:3000/sqa-mock-exam/{doc_id}")
    print(f"\nRun E2E test with:")
    print(f"  cd assistant-ui-frontend")
    print(f"  npx playwright test diagram-exam.spec.ts --headed")


if __name__ == "__main__":
    main()
