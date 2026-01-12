"""Tests for Paper Extractor - TDD approach.

These tests verify the extraction of questions and solutions from us_papers collection.
"""

import pytest
import json
from typing import Dict, Any
from unittest.mock import AsyncMock, patch, MagicMock

from src.utils.paper_extractor import (
    extract_questions_from_paper,
    extract_question_with_solution,
    build_paper_id,
    parse_question_number,
    QuestionExtractionResult,
)


# =============================================================================
# Sample Data Fixtures
# =============================================================================

@pytest.fixture
def sample_paper_data() -> Dict[str, Any]:
    """Sample paper data from us_papers.data field."""
    return {
        "subject": "Mathematics",
        "level": "National 5",
        "level_code": "N5",
        "paper_code": "X847/75/01",
        "year": 2023,
        "paper_number": 1,
        "topic_tags": ["fractions", "algebra", "quadratics"],
        "total_marks": 40,
        "duration_minutes": 60,
        "calculator_allowed": False,
        "questions": [
            {
                "number": "1",
                "text": "Evaluate 2 1/6 ÷ 8/9",
                "text_latex": r"Evaluate $2\frac{1}{6} \div \frac{8}{9}$",
                "marks": 2,
                "has_parts": False,
                "parts": [],
                "topic_tags": ["fractions", "division"],
                "diagrams": [],
                "solution": {
                    "max_marks": 2,
                    "generic_scheme": [
                        {"bullet": 1, "process": "convert to improper fraction and multiply by reciprocal"},
                        {"bullet": 2, "process": "simplify"}
                    ],
                    "illustrative_scheme": [
                        {"bullet": 1, "answer": "13/6 x 9/8", "answer_latex": r"\frac{13}{6} \times \frac{9}{8}"},
                        {"bullet": 2, "answer": "39/16 = 2 7/16", "answer_latex": r"\frac{39}{16} = 2\frac{7}{16}"}
                    ],
                    "notes": ["Correct answer without working: 0/2"]
                }
            },
            {
                "number": "4",
                "text": "The graph shows a parabola...",
                "text_latex": "The graph shows a parabola with equation $y = kx^2 + c$...",
                "marks": None,
                "has_parts": True,
                "parts": [
                    {
                        "part": "a",
                        "subpart": None,
                        "text": "State the coordinates of the minimum turning point.",
                        "text_latex": "State the coordinates of the minimum turning point.",
                        "marks": 1,
                        "topic_tags": ["quadratics", "graphs"],
                        "solution": {
                            "max_marks": 1,
                            "generic_scheme": [
                                {"bullet": 1, "process": "state coordinates of minimum TP"}
                            ],
                            "illustrative_scheme": [
                                {"bullet": 1, "answer": "(3, 2)", "answer_latex": "(3, 2)"}
                            ],
                            "notes": []
                        }
                    },
                    {
                        "part": "b",
                        "subpart": None,
                        "text": "Find the values of k and c.",
                        "text_latex": "Find the values of $k$ and $c$.",
                        "marks": 3,
                        "topic_tags": ["quadratics", "algebra"],
                        "solution": {
                            "max_marks": 3,
                            "generic_scheme": [
                                {"bullet": 1, "process": "substitute coordinates to form equation"},
                                {"bullet": 2, "process": "solve for k"},
                                {"bullet": 3, "process": "state value of c"}
                            ],
                            "illustrative_scheme": [
                                {"bullet": 1, "answer": "8 = k(0-3)^2 + 2", "answer_latex": "8 = k(0-3)^2 + 2"},
                                {"bullet": 2, "answer": "k = 2/3", "answer_latex": r"k = \frac{2}{3}"},
                                {"bullet": 3, "answer": "c = 2", "answer_latex": "c = 2"}
                            ],
                            "notes": ["Accept k = 0.67 or 0.666..."]
                        }
                    }
                ],
                "topic_tags": ["quadratics", "graphs"],
                "diagrams": [
                    {
                        "id": "diag-n5-2023-p1-q4",
                        "type": "graph",
                        "description": "Parabola graph with vertex at (3,2)"
                    }
                ]
            }
        ],
        "general_principles": [
            {
                "principle_id": "a",
                "principle": "positive_marking",
                "description": "Marks are of the 'accumulator' type..."
            }
        ],
        "formulae": []
    }


@pytest.fixture
def sample_paper_document(sample_paper_data: Dict) -> Dict[str, Any]:
    """Sample document from us_papers collection."""
    return {
        "$id": "mathematics-n5-2023-X847-75-01",
        "subject": "Mathematics",
        "level": "National 5",
        "level_code": "N5",
        "paper_code": "X847/75/01",
        "year": 2023,
        "paper_number": 1,
        "topic_tags": ["fractions", "algebra", "quadratics"],
        "total_marks": 40,
        "duration_minutes": 60,
        "calculator_allowed": False,
        "data": json.dumps(sample_paper_data),
        "last_modified": "2024-01-01T00:00:00Z"
    }


# =============================================================================
# Helper Function Tests
# =============================================================================

class TestBuildPaperId:
    """Tests for paper ID building."""

    def test_basic_paper_id(self):
        """Test building standard paper ID."""
        paper_id = build_paper_id("Mathematics", "N5", 2023, "X847/75/01")
        assert paper_id == "mathematics-n5-2023-X847-75-01"

    def test_paper_id_normalizes_subject(self):
        """Test subject normalization."""
        paper_id = build_paper_id("Application of Mathematics", "N5", 2023, "X123/45/01")
        assert paper_id == "application-of-mathematics-n5-2023-X123-45-01"

    def test_paper_id_normalizes_level(self):
        """Test level code normalization."""
        paper_id = build_paper_id("Mathematics", "NH", 2023, "X847/76/11")
        assert paper_id == "mathematics-nh-2023-X847-76-11"

    def test_paper_id_handles_slashes(self):
        """Test paper code slash replacement."""
        paper_id = build_paper_id("Mathematics", "NAH", 2023, "X747/77/01")
        assert paper_id == "mathematics-nah-2023-X747-77-01"


class TestParseQuestionNumber:
    """Tests for question number parsing."""

    def test_simple_number(self):
        """Test simple question number."""
        base, part, subpart = parse_question_number("1")
        assert base == "1"
        assert part is None
        assert subpart is None

    def test_with_part(self):
        """Test question with part letter."""
        base, part, subpart = parse_question_number("4a")
        assert base == "4"
        assert part == "a"
        assert subpart is None

    def test_with_subpart_parentheses(self):
        """Test question with subpart in parentheses."""
        base, part, subpart = parse_question_number("5b(i)")
        assert base == "5"
        assert part == "b"
        assert subpart == "i"

    def test_with_subpart_roman(self):
        """Test question with roman numeral subpart."""
        base, part, subpart = parse_question_number("3c(ii)")
        assert base == "3"
        assert part == "c"
        assert subpart == "ii"


# =============================================================================
# Question Extraction Tests
# =============================================================================

class TestExtractQuestionsFromPaper:
    """Tests for extracting all questions from a paper."""

    def test_extracts_all_questions(self, sample_paper_data: Dict):
        """Test extracting all questions including parts."""
        results = extract_questions_from_paper(sample_paper_data)

        # Should have 3 questions: Q1, Q4a, Q4b
        assert len(results) == 3

    def test_simple_question_extraction(self, sample_paper_data: Dict):
        """Test extracting simple question without parts."""
        results = extract_questions_from_paper(sample_paper_data)

        q1 = next(r for r in results if r.question_number == "1")
        assert q1.marks == 2
        assert "fractions" in q1.topic_tags
        assert q1.has_solution is True

    def test_parts_question_extraction(self, sample_paper_data: Dict):
        """Test extracting question parts as separate items."""
        results = extract_questions_from_paper(sample_paper_data)

        q4a = next(r for r in results if r.question_number == "4a")
        assert q4a.marks == 1
        assert q4a.parent_question == "4"

        q4b = next(r for r in results if r.question_number == "4b")
        assert q4b.marks == 3
        assert q4b.parent_question == "4"

    def test_includes_diagram_refs(self, sample_paper_data: Dict):
        """Test that diagram references are included."""
        results = extract_questions_from_paper(sample_paper_data)

        q4a = next(r for r in results if r.question_number == "4a")
        assert len(q4a.diagram_refs) == 1
        assert q4a.diagram_refs[0]["id"] == "diag-n5-2023-p1-q4"


class TestExtractQuestionWithSolution:
    """Tests for extracting single question with full solution data."""

    def test_simple_question_extraction(self, sample_paper_data: Dict):
        """Test extracting simple question with solution."""
        result = extract_question_with_solution(sample_paper_data, "1")

        assert result is not None
        assert result["question"]["number"] == "1"
        assert result["solution"]["max_marks"] == 2
        assert len(result["solution"]["generic_scheme"]) == 2

    def test_part_question_extraction(self, sample_paper_data: Dict):
        """Test extracting question part with solution."""
        result = extract_question_with_solution(sample_paper_data, "4a")

        assert result is not None
        assert result["question"]["text"] == "State the coordinates of the minimum turning point."
        assert result["solution"]["max_marks"] == 1

    def test_nonexistent_question_returns_none(self, sample_paper_data: Dict):
        """Test that nonexistent question returns None."""
        result = extract_question_with_solution(sample_paper_data, "99")
        assert result is None

    def test_includes_parent_context(self, sample_paper_data: Dict):
        """Test that part questions include parent question context."""
        result = extract_question_with_solution(sample_paper_data, "4b")

        assert result is not None
        assert "parent_context" in result
        assert result["parent_context"]["text"] == "The graph shows a parabola..."

    def test_includes_examiner_notes(self, sample_paper_data: Dict):
        """Test that examiner notes are extracted."""
        result = extract_question_with_solution(sample_paper_data, "1")

        assert "notes" in result["solution"]
        assert "Correct answer without working: 0/2" in result["solution"]["notes"]


# =============================================================================
# Integration Tests with Mock Appwrite
# =============================================================================

class TestPaperExtractionIntegration:
    """Integration tests with mocked Appwrite calls."""

    @pytest.mark.asyncio
    async def test_fetch_and_extract_paper(self, sample_paper_document: Dict):
        """Test full workflow of fetching and extracting paper."""
        from src.utils.paper_extractor import fetch_paper, extract_questions_from_paper

        # Mock the Appwrite fetch
        with patch('src.utils.paper_extractor.get_appwrite_document') as mock_fetch:
            mock_fetch.return_value = sample_paper_document

            paper = await fetch_paper(
                "mathematics-n5-2023-X847-75-01",
                mcp_config_path=".mcp.json"
            )

            assert paper is not None
            assert paper["$id"] == "mathematics-n5-2023-X847-75-01"

            # Parse data field and extract questions
            paper_data = json.loads(paper["data"])
            results = extract_questions_from_paper(paper_data)

            assert len(results) == 3

    @pytest.mark.asyncio
    async def test_list_papers_by_filter(self, sample_paper_document: Dict):
        """Test listing papers with filters."""
        from src.utils.paper_extractor import list_papers

        with patch('src.utils.paper_extractor.list_appwrite_documents') as mock_list:
            mock_list.return_value = [sample_paper_document]

            papers = await list_papers(
                subject="Mathematics",
                level="National 5",
                mcp_config_path=".mcp.json"
            )

            assert len(papers) == 1
            assert papers[0]["subject"] == "Mathematics"

            # Verify query was called with correct filters
            mock_list.assert_called_once()
            call_args = mock_list.call_args
            assert 'equal("subject", "Mathematics")' in str(call_args)
            assert 'equal("level", "National 5")' in str(call_args)
