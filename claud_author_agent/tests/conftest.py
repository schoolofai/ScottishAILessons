"""Shared pytest fixtures for Claude Author Agent tests.

Provides reusable fixtures for:
- Mock Appwrite client
- Sample lesson templates
- Sample SOW data
- Sample mock exam data
- Temporary workspace directories
- Compression test data
"""

import json
import pytest
from pathlib import Path
from typing import Dict, Any
from unittest.mock import AsyncMock, MagicMock, patch


# =============================================================================
# Path Fixtures
# =============================================================================

@pytest.fixture
def project_root() -> Path:
    """Return the project root directory."""
    return Path(__file__).parent.parent


@pytest.fixture
def src_path(project_root) -> Path:
    """Return the src directory path."""
    return project_root / "src"


@pytest.fixture
def prompts_path(src_path) -> Path:
    """Return the prompts directory path."""
    return src_path / "prompts"


# =============================================================================
# Workspace Fixtures
# =============================================================================

@pytest.fixture
def tmp_workspace(tmp_path) -> Path:
    """Create a temporary workspace directory with standard structure."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "diagrams").mkdir()
    return workspace


@pytest.fixture
def workspace_with_files(tmp_workspace) -> Path:
    """Create workspace with sample input files."""
    # Create sample lesson template input
    lesson_template = {
        "lesson_template_id": "test_template_001",
        "lesson_template": {
            "courseId": "course_test123",
            "title": "Test Lesson",
            "cards": []
        }
    }
    (tmp_workspace / "lesson_template_input.json").write_text(
        json.dumps(lesson_template, indent=2)
    )
    return tmp_workspace


# =============================================================================
# Sample Data Fixtures - SOW
# =============================================================================

@pytest.fixture
def sample_sow_entry() -> Dict[str, Any]:
    """Valid SOW entry for unit-based course (National 1-4)."""
    return {
        "order": 1,
        "label": "Introduction to Fractions - Understanding Parts of a Whole",
        "lesson_type": "teach",
        "estimated_minutes": 50,
        "calculator_section": "non_calc",
        "standards_or_skills_addressed": [
            {
                "code": "AS1.2",
                "outcome": "O1",
                "description": "Add and subtract fractions with same denominator"
            }
        ],
        "learning_intentions": ["Understand what a fraction represents"],
        "success_criteria": ["Identify numerator and denominator correctly"],
        "lesson_plan": {
            "summary": "This lesson introduces fractions as parts of a whole using Scottish context examples like sharing shortbread and pizza.",
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "starter",
                    "title": "Starter: What do you know about fractions?",
                    "purpose": "Activate prior knowledge about fractions",
                    "pedagogical_approach": "Think-pair-share with visual fraction representations",
                    "cfu_strategy": "Mini-whiteboard fraction identification"
                }
            ],
            "lesson_flow_summary": "Starter -> Explainer -> Practice",
            "multi_standard_integration_strategy": "Integrated throughout lesson",
            "assessment_progression": "Formative checks at each stage"
        },
        "accessibility_profile": {
            "dyslexia_friendly": True,
            "plain_language_level": "CEFR_B1"
        }
    }


@pytest.fixture
def sample_sow_entry_skills_based() -> Dict[str, Any]:
    """Valid SOW entry for skills-based course (National 5+)."""
    return {
        "order": 1,
        "label": "Working with Surds - Simplification and Rationalisation",
        "lesson_type": "teach",
        "estimated_minutes": 50,
        "calculator_section": "non_calc",
        "standards_or_skills_addressed": [
            {
                "skill_name": "Working with surds",
                "description": "Simplification, Rationalising denominators"
            }
        ],
        "learning_intentions": ["Simplify surds to their simplest form"],
        "success_criteria": ["Identify perfect square factors"],
        "lesson_plan": {
            "summary": "This lesson covers surd simplification using factor trees and rationalisation techniques.",
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "starter",
                    "title": "Starter: Review of square roots",
                    "purpose": "Activate prior knowledge of square roots",
                    "pedagogical_approach": "Quick-fire questions with mini-whiteboards",
                    "cfu_strategy": "Show me boards with simplified answers"
                }
            ],
            "lesson_flow_summary": "Starter -> Modelling -> Practice",
            "multi_standard_integration_strategy": "Progressive skill building",
            "assessment_progression": "Check at each example"
        },
        "accessibility_profile": {
            "dyslexia_friendly": True,
            "plain_language_level": "CEFR_B1"
        }
    }


@pytest.fixture
def sample_sow_metadata() -> Dict[str, Any]:
    """Valid SOW metadata."""
    return {
        "subject": "mathematics",
        "level": "national-4",
        "title": "National 4 Mathematics - Complete Course",
        "total_lessons": 12,
        "total_hours": 10
    }


# =============================================================================
# Sample Data Fixtures - Lesson Template
# =============================================================================

@pytest.fixture
def sample_lesson_card() -> Dict[str, Any]:
    """Valid lesson template card."""
    return {
        "id": "card_001",
        "title": "Starter: Fraction Recall Activity",
        "explainer": "Let's begin by recalling what we know about fractions. A fraction represents part of a whole and is written with a numerator (top number) and denominator (bottom number). The denominator tells us how many equal parts, and the numerator tells us how many we have.",
        "explainer_plain": "We will review fractions. A fraction has a top number and bottom number. The bottom number shows equal parts.",
        "cfu": {
            "type": "mcq",
            "id": "q001",
            "stem": "Which of these represents one-quarter?",
            "options": ["1/4", "1/2", "1/3", "4/1"],
            "answerIndex": 0,
            "rubric": {
                "total_points": 1,
                "criteria": [
                    {"description": "Correctly identifies quarter", "points": 1}
                ]
            }
        },
        "rubric": {
            "total_points": 1,
            "criteria": [
                {"description": "Correctly identifies quarter", "points": 1}
            ]
        },
        "misconceptions": [
            {
                "id": "MISC_MATH_FRAC_001",
                "misconception": "Confusing numerator and denominator positions",
                "clarification": "Remember: bottom shows total parts, top shows how many you have"
            }
        ],
        "context_hooks": ["Scottish currency £", "Sharing shortbread"]
    }


@pytest.fixture
def sample_lesson_template(sample_lesson_card) -> Dict[str, Any]:
    """Valid lesson template with 3 cards."""
    card1 = sample_lesson_card.copy()
    card2 = sample_lesson_card.copy()
    card2["id"] = "card_002"
    card2["title"] = "Modelling: Finding Fractions of Amounts"
    card3 = sample_lesson_card.copy()
    card3["id"] = "card_003"
    card3["title"] = "Practice: Apply Your Skills"

    return {
        "courseId": "course_test123",
        "title": "Introduction to Fractions for National 3",
        "outcomeRefs": ["O1", "AS1.2"],
        "lesson_type": "teach",
        "estMinutes": 50,
        "sow_order": 1,
        "createdBy": "lesson_author_agent",
        "version": 1,
        "status": "draft",
        "engagement_tags": ["shopping", "finance"],
        "policy": {"calculator_allowed": False},
        "cards": [card1, card2, card3]
    }


# =============================================================================
# Sample Data Fixtures - Mock Exam
# =============================================================================

@pytest.fixture
def sample_mock_exam_question() -> Dict[str, Any]:
    """Valid mock exam question."""
    return {
        "question_id": "q1",
        "question_number": 1,
        "marks": 3,
        "difficulty": "easy",
        "estimated_minutes": 3,
        "standards_addressed": [
            {
                "code": "AS1.1",
                "outcome": "O1",
                "description": "Selecting and using appropriate numerical notation"
            }
        ],
        "question_stem": "A supermarket sells milk for £1.35 per litre. Write this amount in pence.",
        "question_stem_plain": "A supermarket sells milk for one pound thirty-five pence per litre. Write this amount in pence.",
        "question_type": "numeric",
        "cfu_config": {
            "type": "numeric",
            "expected_answer": 135,
            "tolerance": 0,
            "answer_key": {
                "correct_answer": "135",
                "acceptable_variations": ["135p", "135 pence"],
                "marking_scheme": [
                    {"step": "Correct conversion", "marks": 3}
                ]
            }
        },
        "hints": [
            "Remember: £1 = 100p",
            "Add the pence to the converted pounds"
        ],
        "misconceptions": [
            {
                "error_pattern": "1.35",
                "feedback": "You need to convert to pence, not keep as pounds"
            }
        ],
        "worked_solution": {
            "steps": ["£1.35 = 100p + 35p = 135p"],
            "final_answer": "135 pence"
        }
    }


@pytest.fixture
def sample_mock_exam_section(sample_mock_exam_question) -> Dict[str, Any]:
    """Valid mock exam section."""
    return {
        "section_id": "section_a",
        "section_label": "Section A: Non-Calculator",
        "section_order": 1,
        "section_marks": 30,
        "section_time_allocation": 45,
        "section_instructions": "Do not use a calculator for this section.",
        "questions": [sample_mock_exam_question]
    }


@pytest.fixture
def sample_mock_exam(sample_mock_exam_section) -> Dict[str, Any]:
    """Valid complete mock exam."""
    return {
        "$schema": "mock_exam_v1",
        "examId": "exam_test001",
        "courseId": "course_test123",
        "sowId": "sow_test123",
        "sowEntryOrder": 16,
        "metadata": {
            "title": "National 4 Mathematics - Mock Examination",
            "subject": "mathematics",
            "level": "national-4",
            "totalMarks": 30,
            "timeLimit": 45,
            "instructions": "Answer ALL questions in the spaces provided.",
            "instructions_plain": "Answer every question. Write your answers in the spaces given.",
            "calculator_policy": "non_calc",
            "exam_conditions": True,
            "accessibility_profile": {
                "plain_language_level": "B1",
                "dyslexia_friendly": True,
                "extra_time_percentage": 25
            }
        },
        "sections": [sample_mock_exam_section],
        "summary": {
            "total_questions": 1,
            "questions_by_difficulty": {"easy": 1, "medium": 0, "hard": 0},
            "questions_by_type": {"numeric": 1},
            "standards_coverage": ["AS1.1"]
        },
        "generated_at": "2025-12-21T10:00:00Z",
        "agent_version": "mock_exam_author_v1.0"
    }


# =============================================================================
# Sample Data Fixtures - Practice Questions
# =============================================================================

@pytest.fixture
def sample_extracted_block() -> Dict[str, Any]:
    """Valid extracted concept block."""
    return {
        "block_id": "block_001",
        "title": "Adding Fractions with Same Denominator",
        "explanation_preview": "Learn to add fractions when they have the same bottom number...",
        "explanation": "When adding fractions with the same denominator, we keep the denominator the same and add the numerators. For example, 1/4 + 2/4 = 3/4. The denominator (4) stays the same because we're adding quarters to quarters.",
        "worked_example": {
            "problem": "Calculate 2/5 + 1/5",
            "solution_steps": [
                "Keep the denominator the same: 5",
                "Add the numerators: 2 + 1 = 3",
                "Write the answer: 3/5"
            ],
            "final_answer": "3/5"
        },
        "key_formulas": ["a/c + b/c = (a+b)/c"],
        "common_misconceptions": [
            "Adding denominators as well as numerators"
        ],
        "outcome_refs": ["AS1.2"],
        "card_refs": ["card_001", "card_002"]
    }


@pytest.fixture
def sample_generated_question() -> Dict[str, Any]:
    """Valid generated practice question."""
    return {
        "question_id": "pq_001",
        "block_id": "block_001",
        "block_title": "Adding Fractions with Same Denominator",
        "difficulty": "easy",
        "question_type": "numeric",
        "stem_preview": "Calculate: 1/6 + 2/6",
        "stem": "Calculate: $\\frac{1}{6} + \\frac{2}{6}$",
        "correct_answer": "3/6 or 1/2",
        "acceptable_answers": ["3/6", "1/2", "0.5"],
        "solution": "1/6 + 2/6 = 3/6 = 1/2 (simplified)",
        "hints": [
            "Keep the denominator the same",
            "Add only the top numbers",
            "Can you simplify the answer?"
        ],
        "diagram_needed": False,
        "diagram_tool": "NONE",
        "outcome_refs": ["AS1.2"]
    }


# =============================================================================
# Sample Data Fixtures - Diagram Classification
# =============================================================================

@pytest.fixture
def sample_classification_result() -> Dict[str, Any]:
    """Valid diagram classification result."""
    return {
        "question_id": "q3",
        "question_number": 3,
        "tool": "DESMOS",
        "confidence": "HIGH",
        "reasoning": {
            "selected_because": "DESMOS for linear functions",
            "content_analysis": "Graph y = 2x + 1",
            "decision_rule_applied": "Rule 2: graph y=",
            "alternatives_rejected": "JSXGRAPH for coords",
            "summary": "Linear function graphing"
        },
        "visualization_focus": "Line with gradient 2",
        "alternative_tool": None,
        "curriculum_topic": "Linear Functions",
        "diagram_specs": {
            "key_elements": ["line", "axes"],
            "educational_purpose": "Show equation-graph relationship"
        }
    }


@pytest.fixture
def sample_critique_result_accept() -> Dict[str, Any]:
    """Sample critique result that ACCEPTs the diagram."""
    return {
        "decision": "ACCEPT",
        "final_score": 0.88,
        "dimension_scores": {
            "clarity": 0.90,
            "accuracy": 0.88,
            "pedagogy": 0.85,
            "aesthetics": 0.82
        },
        "strengths": ["Clear axis labels", "Correct gradient shown"],
        "improvements": ["Could add grid lines"],
        "specific_changes": [],
        "critical_issues": [],
        "iteration_notes": "Good quality diagram"
    }


@pytest.fixture
def sample_critique_result_refine() -> Dict[str, Any]:
    """Sample critique result that requests REFINEMENT."""
    return {
        "decision": "REFINE",
        "final_score": 0.72,
        "dimension_scores": {
            "clarity": 0.75,
            "accuracy": 0.80,
            "pedagogy": 0.65,
            "aesthetics": 0.60
        },
        "strengths": ["Correct line equation"],
        "improvements": ["Add axis labels", "Increase font size"],
        "specific_changes": [
            "Add x-axis label 'x'",
            "Add y-axis label 'y'",
            "Mark y-intercept at (0, 1)"
        ],
        "critical_issues": [],
        "iteration_notes": "Needs axis labels"
    }


# =============================================================================
# Mock Appwrite Client Fixtures
# =============================================================================

@pytest.fixture
def mock_appwrite_document() -> Dict[str, Any]:
    """Sample Appwrite document response."""
    return {
        "$id": "doc_123456",
        "$collectionId": "test_collection",
        "$databaseId": "default",
        "$createdAt": "2025-12-21T10:00:00.000+00:00",
        "$updatedAt": "2025-12-21T10:00:00.000+00:00",
        "$permissions": ["read(\"user:test_user\")"],
        "courseId": "course_test123",
        "status": "draft",
        "version": "1"
    }


@pytest.fixture
def mock_appwrite_client():
    """Mock Appwrite client for unit tests."""
    client = MagicMock()

    # Mock databases service
    databases = MagicMock()
    client.databases = databases

    # Mock storage service
    storage = MagicMock()
    client.storage = storage

    return client


@pytest.fixture
def mock_get_appwrite_document(mock_appwrite_document):
    """Mock for get_appwrite_document utility."""
    async def _mock_get(*args, **kwargs):
        return mock_appwrite_document
    return _mock_get


@pytest.fixture
def mock_list_appwrite_documents(mock_appwrite_document):
    """Mock for list_appwrite_documents utility."""
    async def _mock_list(*args, **kwargs):
        return [mock_appwrite_document]
    return _mock_list


# =============================================================================
# Compression Test Fixtures
# =============================================================================

@pytest.fixture
def sample_json_data() -> Dict[str, Any]:
    """Sample JSON data for compression testing."""
    return {
        "entries": [
            {"order": i, "label": f"Lesson {i}", "content": "x" * 100}
            for i in range(1, 11)
        ]
    }


@pytest.fixture
def sample_compressed_data(sample_json_data) -> str:
    """Pre-compressed data for decompression testing."""
    from src.utils.compression import compress_json_gzip_base64
    return compress_json_gzip_base64(sample_json_data)


# =============================================================================
# Pytest Configuration
# =============================================================================

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires Claude subscription)"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test (requires full infrastructure)"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow-running"
    )
