"""Tests for Mock Exam Reviser Agent.

Tests the reviser's prompt building, summary correction, and file handling logic.
Integration tests that call the actual LLM are marked with @pytest.mark.integration.
"""

import json
import pytest
from pathlib import Path
from typing import Dict, Any

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agents.mock_exam_reviser_agent import MockExamReviserAgent
from src.tools.mock_exam_critic_schema_models import (
    MockExamCriticResult,
    SchemaGate,
    DimensionResult
)


# ═══════════════════════════════════════════════════════════════
# Test Fixtures - Mock Data
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_exam_with_issues() -> Dict[str, Any]:
    """A mock exam with deliberate issues for the reviser to fix.

    Issues included:
    - Q1 has arithmetic error in worked_solution (5 + 3 = 9 instead of 8)
    - Q2 missing question_stem_plain
    - Summary counts are wrong (will be auto-corrected)
    """
    return {
        "examId": "mock_exam_test_001",
        "metadata": {
            "title": "National 3 Mathematics - Practice Test",
            "subject": "mathematics",
            "level": "national-3",
            "totalMarks": 10,
            "timeLimit": 20,
            "calculator": "calc"
        },
        "sections": [
            {
                "section_id": "section_a",
                "section_order": 1,
                "title": "Section A: Numeracy",
                "instructions": "Answer all questions. Show your working.",
                "total_marks": 10,
                "questions": [
                    {
                        "question_number": 1,
                        "question_id": "q001",
                        "question_type": "numeric",
                        "difficulty": "easy",
                        "marks": 2,
                        "estimated_minutes": 2,
                        "question_stem": "Calculate $5 + 3$",
                        "question_stem_plain": "Calculate five plus three",
                        "marking_scheme": {
                            "total_marks": 2,
                            "steps": [
                                {"step": "Correct addition", "marks": 2}
                            ]
                        },
                        "worked_solution": {
                            "steps": [
                                "Add 5 and 3",
                                "5 + 3 = 9"  # DELIBERATE ERROR: should be 8
                            ],
                            "final_answer": "9"  # WRONG
                        },
                        "acceptable_variations": ["8", "eight"],
                        "hints": ["Think about counting on"],
                        "misconceptions": [
                            {
                                "error_pattern": "Counting error",
                                "feedback": "Count carefully"
                            }
                        ],
                        "standards_addressed": [
                            {"code": "N3.1", "type": "outcome"}
                        ],
                        "diagram_refs": []
                    },
                    {
                        "question_number": 2,
                        "question_id": "q002",
                        "question_type": "numeric",
                        "difficulty": "medium",
                        "marks": 3,
                        "estimated_minutes": 3,
                        "question_stem": "A shop sells apples for £0.50 each. How much do 6 apples cost?",
                        # MISSING: question_stem_plain - deliberate issue
                        "marking_scheme": {
                            "total_marks": 3,
                            "steps": [
                                {"step": "Multiply price by quantity", "marks": 2},
                                {"step": "Correct answer with units", "marks": 1}
                            ]
                        },
                        "worked_solution": {
                            "steps": [
                                "Price per apple = £0.50",
                                "Number of apples = 6",
                                "Total = £0.50 × 6 = £3.00"
                            ],
                            "final_answer": "£3.00"
                        },
                        "acceptable_variations": ["3", "3.00", "£3"],
                        "hints": [
                            "What is the price of one apple?",
                            "Multiply to find the total"
                        ],
                        "misconceptions": [
                            {
                                "error_pattern": "Adding instead of multiplying",
                                "feedback": "Remember, buying multiple items means multiplying"
                            }
                        ],
                        "standards_addressed": [
                            {"code": "N3.2", "type": "outcome"}
                        ],
                        "diagram_refs": []
                    },
                    {
                        "question_number": 3,
                        "question_id": "q003",
                        "question_type": "mcq",
                        "difficulty": "easy",
                        "marks": 2,
                        "estimated_minutes": 1,
                        "question_stem": "Which fraction is equivalent to $\\frac{1}{2}$?",
                        "question_stem_plain": "Which fraction is the same as one half?",
                        "options": [
                            {"label": "A", "text": "$\\frac{2}{4}$"},
                            {"label": "B", "text": "$\\frac{1}{4}$"},
                            {"label": "C", "text": "$\\frac{3}{4}$"},
                            {"label": "D", "text": "$\\frac{1}{3}$"}
                        ],
                        "correct_option": "A",
                        "marking_scheme": {
                            "total_marks": 2,
                            "steps": [
                                {"step": "Correct answer selected", "marks": 2}
                            ]
                        },
                        "worked_solution": {
                            "steps": [
                                "Simplify 2/4 by dividing both by 2",
                                "2÷2 = 1, 4÷2 = 2",
                                "So 2/4 = 1/2"
                            ],
                            "final_answer": "A"
                        },
                        "hints": ["Try simplifying each fraction"],
                        "misconceptions": [
                            {
                                "error_pattern": "Confusing numerator operations",
                                "feedback": "Divide both top and bottom by the same number"
                            }
                        ],
                        "standards_addressed": [
                            {"code": "N3.3", "type": "outcome"}
                        ],
                        "diagram_refs": []
                    },
                    {
                        "question_number": 4,
                        "question_id": "q004",
                        "question_type": "numeric",
                        "difficulty": "medium",
                        "marks": 3,
                        "estimated_minutes": 3,
                        "question_stem": "Calculate $12 \\div 4$",
                        "question_stem_plain": "Calculate twelve divided by four",
                        "marking_scheme": {
                            "total_marks": 3,
                            "steps": [
                                {"step": "Correct division", "marks": 3}
                            ]
                        },
                        "worked_solution": {
                            "steps": [
                                "12 ÷ 4 = 3"
                            ],
                            "final_answer": "3"
                        },
                        "acceptable_variations": ["3", "three"],
                        "hints": ["How many 4s make 12?"],
                        "misconceptions": [
                            {
                                "error_pattern": "Multiplying instead of dividing",
                                "feedback": "Division means sharing equally"
                            }
                        ],
                        "standards_addressed": [
                            {"code": "N3.1", "type": "outcome"}
                        ],
                        "diagram_refs": []
                    }
                ]
            }
        ],
        "summary": {
            "total_questions": 5,  # WRONG: should be 4
            "questions_by_difficulty": {
                "easy": 1,  # WRONG: should be 2
                "medium": 1  # WRONG: should be 2
            },
            "questions_by_type": {
                "numeric": 2,  # WRONG: should be 3
                "mcq": 1
            },
            "standards_coverage": [
                {"code": "N3.1", "question_count": 1}  # WRONG: should be 2
            ]
        },
        "accessibility_profile": {
            "plain_language_level": "B1",
            "dyslexia_friendly": True,
            "extra_time_percentage": 25
        }
    }


@pytest.fixture
def critic_result_failed() -> Dict[str, Any]:
    """A critic result showing FAILED evaluation with specific issues."""
    return {
        "pass": False,
        "overall_score": 3.1,
        "schema_gate": {
            "pass": True,
            "failed_checks": []
        },
        "validation_errors": [],
        "dimensions": {
            "question_clarity": {
                "score": 3.0,
                "pass": False,
                "threshold": 3.5,
                "issues": [
                    "Q2 missing question_stem_plain - required for accessibility",
                    "Q1 question_stem could be more explicit about expected format"
                ],
                "successes": [
                    "Q3 and Q4 have clear stems with proper LaTeX",
                    "Scottish currency context used appropriately in Q2"
                ]
            },
            "marking_transparency": {
                "score": 2.8,
                "pass": False,
                "threshold": 3.5,
                "issues": [
                    "Q1 worked_solution has arithmetic error: 5 + 3 = 9 should be 5 + 3 = 8",
                    "Q1 final_answer shows 9 instead of 8"
                ],
                "successes": [
                    "All questions have marking schemes",
                    "Marks sum correctly at section level"
                ]
            },
            "navigation_flow": {
                "score": 4.0,
                "pass": True,
                "threshold": 3.5,
                "issues": [],
                "successes": [
                    "Questions sequentially numbered",
                    "Time estimates reasonable",
                    "Clear section organization"
                ]
            },
            "accessibility": {
                "score": 3.2,
                "pass": False,
                "threshold": 3.5,
                "issues": [
                    "Q2 missing question_stem_plain field",
                    "accessibility_profile present but incomplete coverage"
                ],
                "successes": [
                    "Other questions have CEFR B1 plain language",
                    "Dyslexia-friendly formatting used"
                ]
            }
        },
        "summary": "Mock exam failed with overall score 3.1/5.0. Three dimensions below threshold.",
        "improvements_required": [
            "[High] [Marking Transparency] Q1: Fix arithmetic error in worked_solution - change '5 + 3 = 9' to '5 + 3 = 8' and update final_answer",
            "[High] [Question Clarity] Q2: Add missing question_stem_plain field with CEFR B1 level text",
            "[Medium] [Accessibility] Ensure all questions have question_stem_plain for screen reader support"
        ],
        "stats": {
            "total_questions": 4,
            "total_marks": 10,
            "time_limit_minutes": 20
        }
    }


@pytest.fixture
def critic_result_passed() -> Dict[str, Any]:
    """A critic result showing PASSED evaluation."""
    return {
        "pass": True,
        "overall_score": 4.5,
        "schema_gate": {
            "pass": True,
            "failed_checks": []
        },
        "validation_errors": [],
        "dimensions": {
            "question_clarity": {
                "score": 4.5,
                "pass": True,
                "threshold": 3.5,
                "issues": [],
                "successes": ["All questions clear and well-formatted"]
            },
            "marking_transparency": {
                "score": 4.5,
                "pass": True,
                "threshold": 3.5,
                "issues": [],
                "successes": ["Complete marking schemes"]
            },
            "navigation_flow": {
                "score": 4.5,
                "pass": True,
                "threshold": 3.5,
                "issues": [],
                "successes": ["Logical flow"]
            },
            "accessibility": {
                "score": 4.5,
                "pass": True,
                "threshold": 3.5,
                "issues": [],
                "successes": ["Full accessibility coverage"]
            }
        },
        "summary": "Mock exam passed all quality checks.",
        "improvements_required": [],
        "stats": {
            "total_questions": 4,
            "total_marks": 10,
            "time_limit_minutes": 20
        }
    }


@pytest.fixture
def sow_context() -> Dict[str, Any]:
    """Course context for the mock exam."""
    return {
        "courseId": "course_test123",
        "subject": "mathematics",
        "level": "national-3",
        "sqa_course_code": "C849",
        "title": "National 3 Mathematics"
    }


@pytest.fixture
def mock_exam_source() -> Dict[str, Any]:
    """Original SOW entry (minimal, for reference)."""
    return {
        "label": "Unit 1 Assessment",
        "lesson_type": "mock_exam",
        "outcomes": ["N3.1", "N3.2", "N3.3"],
        "cards": []
    }


@pytest.fixture
def test_workspace(tmp_path, mock_exam_with_issues, critic_result_failed, sow_context, mock_exam_source):
    """Create a test workspace with all required files."""
    workspace = tmp_path / "test_workspace"
    workspace.mkdir()

    # Write mock_exam.json
    (workspace / "mock_exam.json").write_text(
        json.dumps(mock_exam_with_issues, indent=2)
    )

    # Write critic result
    (workspace / "mock_exam_critic_result.json").write_text(
        json.dumps(critic_result_failed, indent=2)
    )

    # Write context
    (workspace / "sow_context.json").write_text(
        json.dumps(sow_context, indent=2)
    )

    # Write source
    (workspace / "mock_exam_source.json").write_text(
        json.dumps(mock_exam_source, indent=2)
    )

    return workspace


# ═══════════════════════════════════════════════════════════════
# Unit Tests - Prompt Building
# ═══════════════════════════════════════════════════════════════

class TestPromptBuilding:
    """Tests for the _build_prompt method."""

    def test_build_prompt_includes_exam_id(
        self,
        test_workspace,
        mock_exam_with_issues,
        critic_result_failed,
        sow_context
    ):
        """Test that built prompt includes exam ID."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)
        critic = MockExamCriticResult.model_validate(critic_result_failed)

        prompt = agent._build_prompt(
            mock_exam_data=mock_exam_with_issues,
            critic_result=critic,
            context_data=sow_context,
            iteration=2,
            max_iterations=3
        )

        assert "mock_exam_test_001" in prompt

    def test_build_prompt_includes_iteration_info(
        self,
        test_workspace,
        mock_exam_with_issues,
        critic_result_failed,
        sow_context
    ):
        """Test that prompt includes iteration context."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)
        critic = MockExamCriticResult.model_validate(critic_result_failed)

        prompt = agent._build_prompt(
            mock_exam_data=mock_exam_with_issues,
            critic_result=critic,
            context_data=sow_context,
            iteration=2,
            max_iterations=3
        )

        assert "2" in prompt  # Iteration number
        assert "3" in prompt  # Max iterations

    def test_build_prompt_includes_dimension_scores(
        self,
        test_workspace,
        mock_exam_with_issues,
        critic_result_failed,
        sow_context
    ):
        """Test that prompt includes dimension scores with pass/fail status."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)
        critic = MockExamCriticResult.model_validate(critic_result_failed)

        prompt = agent._build_prompt(
            mock_exam_data=mock_exam_with_issues,
            critic_result=critic,
            context_data=sow_context,
            iteration=2,
            max_iterations=3
        )

        # Check dimension names appear
        assert "question_clarity" in prompt
        assert "marking_transparency" in prompt
        assert "navigation_flow" in prompt
        assert "accessibility" in prompt

        # Check PASS/FAIL indicators
        assert "PASS" in prompt
        assert "FAIL" in prompt

    def test_build_prompt_includes_improvements_required(
        self,
        test_workspace,
        mock_exam_with_issues,
        critic_result_failed,
        sow_context
    ):
        """Test that prompt includes specific improvements from critic."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)
        critic = MockExamCriticResult.model_validate(critic_result_failed)

        prompt = agent._build_prompt(
            mock_exam_data=mock_exam_with_issues,
            critic_result=critic,
            context_data=sow_context,
            iteration=2,
            max_iterations=3
        )

        # Check that high-priority issues are included
        assert "Q1" in prompt
        assert "arithmetic error" in prompt.lower() or "5 + 3 = 8" in prompt
        assert "Q2" in prompt
        assert "question_stem_plain" in prompt

    def test_build_prompt_includes_dimension_issues(
        self,
        test_workspace,
        mock_exam_with_issues,
        critic_result_failed,
        sow_context
    ):
        """Test that prompt includes specific issues per dimension."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)
        critic = MockExamCriticResult.model_validate(critic_result_failed)

        prompt = agent._build_prompt(
            mock_exam_data=mock_exam_with_issues,
            critic_result=critic,
            context_data=sow_context,
            iteration=2,
            max_iterations=3
        )

        # Check specific issues from dimensions
        assert "worked_solution" in prompt.lower()


# ═══════════════════════════════════════════════════════════════
# Unit Tests - Summary Correction
# ═══════════════════════════════════════════════════════════════

class TestSummaryCorrection:
    """Tests for the _fix_summary_counts method."""

    def test_fix_summary_counts_total_questions(self, test_workspace, mock_exam_with_issues):
        """Test that total_questions is corrected from actual data."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)

        # Original has wrong count (5 instead of 4)
        assert mock_exam_with_issues["summary"]["total_questions"] == 5

        fixed = agent._fix_summary_counts(mock_exam_with_issues)

        # Should be corrected to actual count
        assert fixed["summary"]["total_questions"] == 4

    def test_fix_summary_counts_difficulty_distribution(self, test_workspace, mock_exam_with_issues):
        """Test that difficulty counts are corrected."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)

        fixed = agent._fix_summary_counts(mock_exam_with_issues)

        # Should match actual: 2 easy (Q1, Q3), 2 medium (Q2, Q4)
        assert fixed["summary"]["questions_by_difficulty"]["easy"] == 2
        assert fixed["summary"]["questions_by_difficulty"]["medium"] == 2

    def test_fix_summary_counts_type_distribution(self, test_workspace, mock_exam_with_issues):
        """Test that question type counts are corrected."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)

        fixed = agent._fix_summary_counts(mock_exam_with_issues)

        # Should match actual: 3 numeric (Q1, Q2, Q4), 1 mcq (Q3)
        assert fixed["summary"]["questions_by_type"]["numeric"] == 3
        assert fixed["summary"]["questions_by_type"]["mcq"] == 1

    def test_fix_summary_counts_standards_coverage(self, test_workspace, mock_exam_with_issues):
        """Test that standards coverage is corrected."""
        agent = MockExamReviserAgent(workspace_path=test_workspace)

        fixed = agent._fix_summary_counts(mock_exam_with_issues)

        # Extract coverage as dict for easier testing
        coverage = {
            item["code"]: item["question_count"]
            for item in fixed["summary"]["standards_coverage"]
        }

        # N3.1 appears in Q1 and Q4
        assert coverage.get("N3.1") == 2
        # N3.2 appears in Q2
        assert coverage.get("N3.2") == 1
        # N3.3 appears in Q3
        assert coverage.get("N3.3") == 1


# ═══════════════════════════════════════════════════════════════
# Unit Tests - File Validation
# ═══════════════════════════════════════════════════════════════

class TestFileValidation:
    """Tests for file existence validation."""

    def test_missing_mock_exam_raises_error(self, tmp_path, sow_context, mock_exam_source, critic_result_failed):
        """Test that missing mock_exam.json raises RuntimeError."""
        workspace = tmp_path / "incomplete_workspace"
        workspace.mkdir()

        # Only write some files - missing mock_exam.json
        (workspace / "mock_exam_critic_result.json").write_text(
            json.dumps(critic_result_failed, indent=2)
        )
        (workspace / "sow_context.json").write_text(
            json.dumps(sow_context, indent=2)
        )
        (workspace / "mock_exam_source.json").write_text(
            json.dumps(mock_exam_source, indent=2)
        )

        agent = MockExamReviserAgent(workspace_path=workspace)

        with pytest.raises(RuntimeError, match="Missing required file"):
            import asyncio
            asyncio.run(agent.execute(iteration=2, max_iterations=3))

    def test_missing_critic_result_raises_error(self, tmp_path, mock_exam_with_issues, sow_context, mock_exam_source):
        """Test that missing critic result raises RuntimeError."""
        workspace = tmp_path / "incomplete_workspace"
        workspace.mkdir()

        # Missing mock_exam_critic_result.json
        (workspace / "mock_exam.json").write_text(
            json.dumps(mock_exam_with_issues, indent=2)
        )
        (workspace / "sow_context.json").write_text(
            json.dumps(sow_context, indent=2)
        )
        (workspace / "mock_exam_source.json").write_text(
            json.dumps(mock_exam_source, indent=2)
        )

        agent = MockExamReviserAgent(workspace_path=workspace)

        with pytest.raises(RuntimeError, match="Missing required file"):
            import asyncio
            asyncio.run(agent.execute(iteration=2, max_iterations=3))


# ═══════════════════════════════════════════════════════════════
# Unit Tests - Critic Result Parsing
# ═══════════════════════════════════════════════════════════════

class TestCriticResultParsing:
    """Tests for parsing critic results."""

    def test_parse_failed_critic_result(self, critic_result_failed):
        """Test parsing a failed critic result."""
        result = MockExamCriticResult.model_validate(critic_result_failed)

        assert result.pass_ == False
        assert result.overall_score == 3.1
        assert result.schema_gate.pass_ == True

        # Check dimensions
        assert result.dimensions["question_clarity"].pass_ == False
        assert result.dimensions["marking_transparency"].pass_ == False
        assert result.dimensions["navigation_flow"].pass_ == True
        assert result.dimensions["accessibility"].pass_ == False

        # Check improvements required
        assert len(result.improvements_required) == 3
        assert any("Q1" in imp for imp in result.improvements_required)

    def test_parse_passed_critic_result(self, critic_result_passed):
        """Test parsing a passed critic result."""
        result = MockExamCriticResult.model_validate(critic_result_passed)

        assert result.pass_ == True
        assert result.overall_score == 4.5

        # All dimensions should pass
        for dim_name, dim_score in result.dimensions.items():
            assert dim_score.pass_ == True, f"{dim_name} should pass"


# ═══════════════════════════════════════════════════════════════
# Integration Tests (Requires Claude Agent SDK / Claude Code Subscription)
# ═══════════════════════════════════════════════════════════════

@pytest.mark.integration
@pytest.mark.asyncio
async def test_reviser_agent_full_execution(test_workspace):
    """Integration test: Run full reviser agent execution.

    This test requires:
    - Claude Agent SDK installed (uses Claude Code subscription, NOT ANTHROPIC_API_KEY)
    - Network access to Claude API

    Run with: pytest -m integration tests/test_mock_exam_reviser_agent.py
    """
    from src.agents.mock_exam_reviser_agent import run_mock_exam_reviser

    result = await run_mock_exam_reviser(
        workspace_path=test_workspace,
        iteration=2,
        max_iterations=3
    )

    # Basic assertions on result
    assert result is not None
    assert result.examId is not None

    # Check that revised exam still validates
    assert len(result.sections) > 0
    assert result.summary.total_questions > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "not integration"])
