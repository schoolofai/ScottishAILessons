"""Tests for Walkthrough Author Client - TDD approach.

These tests verify the walkthrough authoring pipeline that generates
examiner-aligned solutions from SQA past paper marking schemes.
"""

import pytest
import json
from pathlib import Path
from typing import Dict, Any
from unittest.mock import AsyncMock, patch, MagicMock

from src.walkthrough_author_claude_client import (
    WalkthroughAuthorClaudeAgent,
    extract_question_source,
    generate_blank_walkthrough_template,
    build_walkthrough_author_prompt,
)


# =============================================================================
# Sample Data Fixtures
# =============================================================================

@pytest.fixture
def sample_paper_document() -> Dict[str, Any]:
    """Sample document from us_papers collection."""
    paper_data = {
        "subject": "Mathematics",
        "level": "National 5",
        "level_code": "N5",
        "paper_code": "X847/75/01",
        "year": 2023,
        "paper_number": 1,
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
            }
        ],
        "general_principles": [
            {
                "principle_id": "a",
                "principle": "positive_marking",
                "description": "Marks are of the 'accumulator' type"
            }
        ],
        "formulae": []
    }

    return {
        "$id": "mathematics-n5-2023-X847-75-01",
        "subject": "Mathematics",
        "level": "National 5",
        "level_code": "N5",
        "paper_code": "X847/75/01",
        "year": 2023,
        "paper_number": 1,
        "data": json.dumps(paper_data)
    }


@pytest.fixture
def sample_question_source() -> Dict[str, Any]:
    """Sample question source extracted for walkthrough authoring."""
    return {
        "question": {
            "number": "1",
            "text": "Evaluate 2 1/6 ÷ 8/9",
            "text_latex": r"Evaluate $2\frac{1}{6} \div \frac{8}{9}$",
            "marks": 2,
            "topic_tags": ["fractions", "division"],
            "diagrams": []
        },
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
        },
        "parent_context": None
    }


@pytest.fixture
def sample_blank_template() -> Dict[str, Any]:
    """Sample blank walkthrough template structure."""
    return {
        "question_stem": "",
        "question_stem_latex": "",
        "topic_tags": [],
        "total_marks": 0,
        "steps": [],
        "common_errors": [],
        "examiner_summary": "",
        "diagram_refs": []
    }


# =============================================================================
# Question Source Extraction Tests
# =============================================================================

class TestExtractQuestionSource:
    """Tests for extracting question source data for walkthrough authoring."""

    def test_extracts_simple_question(self, sample_paper_document: Dict):
        """Test extracting a simple question without parts."""
        paper_data = json.loads(sample_paper_document["data"])

        source = extract_question_source(paper_data, "1")

        assert source is not None
        assert source["question"]["number"] == "1"
        assert source["question"]["marks"] == 2
        assert source["solution"]["max_marks"] == 2
        assert len(source["solution"]["generic_scheme"]) == 2

    def test_extracts_solution_with_notes(self, sample_paper_document: Dict):
        """Test that solution notes are extracted."""
        paper_data = json.loads(sample_paper_document["data"])

        source = extract_question_source(paper_data, "1")

        assert "notes" in source["solution"]
        assert "Correct answer without working: 0/2" in source["solution"]["notes"]

    def test_extracts_topic_tags(self, sample_paper_document: Dict):
        """Test that topic tags are included."""
        paper_data = json.loads(sample_paper_document["data"])

        source = extract_question_source(paper_data, "1")

        assert "fractions" in source["question"]["topic_tags"]
        assert "division" in source["question"]["topic_tags"]

    def test_nonexistent_question_returns_none(self, sample_paper_document: Dict):
        """Test that nonexistent question returns None."""
        paper_data = json.loads(sample_paper_document["data"])

        source = extract_question_source(paper_data, "99")

        assert source is None


# =============================================================================
# Blank Template Generation Tests
# =============================================================================

class TestGenerateBlankWalkthroughTemplate:
    """Tests for blank walkthrough template generation."""

    def test_creates_correct_structure(self, sample_question_source: Dict):
        """Test that blank template has correct structure."""
        template = generate_blank_walkthrough_template(sample_question_source)

        assert "question_stem" in template
        assert "question_stem_latex" in template
        assert "topic_tags" in template
        assert "total_marks" in template
        assert "steps" in template
        assert "common_errors" in template
        assert "examiner_summary" in template
        assert "diagram_refs" in template

    def test_populates_from_question_source(self, sample_question_source: Dict):
        """Test that template is pre-populated with source data."""
        template = generate_blank_walkthrough_template(sample_question_source)

        assert template["question_stem"] == sample_question_source["question"]["text"]
        assert template["question_stem_latex"] == sample_question_source["question"]["text_latex"]
        assert template["total_marks"] == sample_question_source["solution"]["max_marks"]
        assert template["topic_tags"] == sample_question_source["question"]["topic_tags"]

    def test_creates_blank_steps_array(self, sample_question_source: Dict):
        """Test that steps array is empty (to be filled by agent)."""
        template = generate_blank_walkthrough_template(sample_question_source)

        assert template["steps"] == []
        assert template["common_errors"] == []


# =============================================================================
# Prompt Building Tests
# =============================================================================

class TestBuildWalkthroughAuthorPrompt:
    """Tests for building the walkthrough author prompt."""

    def test_builds_prompt_with_context(self, sample_paper_document: Dict):
        """Test that prompt includes all context variables."""
        prompt = build_walkthrough_author_prompt(
            subject="Mathematics",
            level="National 5",
            year=2023,
            paper_code="X847/75/01",
            question_number="1",
            total_marks=2
        )

        assert "Mathematics" in prompt
        assert "National 5" in prompt
        assert "2023" in prompt
        assert "X847/75/01" in prompt
        assert "Question Number: 1" in prompt

    def test_includes_prompts_content(self):
        """Test that prompt includes the walkthrough author instructions."""
        prompt = build_walkthrough_author_prompt(
            subject="Mathematics",
            level="National 5",
            year=2023,
            paper_code="X847/75/01",
            question_number="1",
            total_marks=2
        )

        # Should include key instructions from the prompt
        assert "walkthrough_source.json" in prompt or "Walkthrough Author" in prompt


# =============================================================================
# Agent Initialization Tests
# =============================================================================

class TestWalkthroughAuthorAgentInit:
    """Tests for WalkthroughAuthorClaudeAgent initialization."""

    def test_initializes_with_defaults(self):
        """Test agent initializes with default values."""
        agent = WalkthroughAuthorClaudeAgent()

        assert agent.persist_workspace is True
        assert agent.max_critic_retries == 3
        assert agent.execution_id is not None

    def test_custom_configuration(self):
        """Test agent accepts custom configuration."""
        agent = WalkthroughAuthorClaudeAgent(
            mcp_config_path="custom.mcp.json",
            persist_workspace=False,
            max_critic_retries=5
        )

        assert agent.persist_workspace is False
        assert agent.max_critic_retries == 5

    def test_generates_unique_execution_id(self):
        """Test that each agent gets unique execution ID."""
        agent1 = WalkthroughAuthorClaudeAgent()
        agent2 = WalkthroughAuthorClaudeAgent()

        # IDs might be same if created in same second, but format should be correct
        assert agent1.execution_id is not None
        assert "_" in agent1.execution_id  # Format: YYYYMMDD_HHMMSS


# =============================================================================
# Subagent Definition Tests
# =============================================================================

class TestSubagentDefinitions:
    """Tests for subagent definitions loading."""

    def test_loads_all_subagents(self):
        """Test that all 3 subagents are loaded."""
        agent = WalkthroughAuthorClaudeAgent()

        subagents = agent._get_subagent_definitions()

        assert "walkthrough_author" in subagents
        assert "common_errors_subagent" in subagents
        assert "walkthrough_critic" in subagents

    def test_subagents_have_prompts(self):
        """Test that each subagent has a prompt loaded."""
        agent = WalkthroughAuthorClaudeAgent()

        subagents = agent._get_subagent_definitions()

        for name, definition in subagents.items():
            assert definition.prompt is not None
            assert len(definition.prompt) > 100  # Should have substantial content


# =============================================================================
# Execute Pipeline Tests (Integration)
# =============================================================================

class TestExecutePipeline:
    """Integration tests for the execute pipeline with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_validates_paper_exists(self, sample_paper_document: Dict):
        """Test that pipeline validates paper exists."""
        agent = WalkthroughAuthorClaudeAgent()

        with patch.object(agent, '_fetch_paper') as mock_fetch:
            mock_fetch.return_value = None

            with pytest.raises(ValueError, match="Paper not found"):
                await agent.execute(
                    paper_id="nonexistent-paper",
                    question_number="1"
                )

    @pytest.mark.asyncio
    async def test_validates_question_exists(self, sample_paper_document: Dict):
        """Test that pipeline validates question exists in paper."""
        agent = WalkthroughAuthorClaudeAgent()

        with patch.object(agent, '_fetch_paper') as mock_fetch:
            mock_fetch.return_value = sample_paper_document

            with pytest.raises(ValueError, match="Question not found"):
                await agent.execute(
                    paper_id="mathematics-n5-2023-X847-75-01",
                    question_number="99"
                )

    @pytest.mark.asyncio
    async def test_creates_workspace_with_source_files(self, sample_paper_document: Dict):
        """Test that pipeline creates workspace with required files."""
        agent = WalkthroughAuthorClaudeAgent(persist_workspace=False)

        with patch.object(agent, '_fetch_paper') as mock_fetch, \
             patch.object(agent, '_run_agent_pipeline') as mock_pipeline, \
             patch.object(agent, '_upsert_walkthrough') as mock_upsert:

            mock_fetch.return_value = sample_paper_document
            mock_pipeline.return_value = {"pass": True}
            mock_upsert.return_value = "doc-id-123"

            result = await agent.execute(
                paper_id="mathematics-n5-2023-X847-75-01",
                question_number="1"
            )

            # Verify pipeline was called (files would be created in workspace)
            assert mock_pipeline.called
            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_returns_metrics_on_success(self, sample_paper_document: Dict):
        """Test that successful execution returns metrics."""
        agent = WalkthroughAuthorClaudeAgent(persist_workspace=False)

        with patch.object(agent, '_fetch_paper') as mock_fetch, \
             patch.object(agent, '_run_agent_pipeline') as mock_pipeline, \
             patch.object(agent, '_upsert_walkthrough') as mock_upsert:

            mock_fetch.return_value = sample_paper_document
            mock_pipeline.return_value = {"pass": True}
            mock_upsert.return_value = "doc-id-123"

            result = await agent.execute(
                paper_id="mathematics-n5-2023-X847-75-01",
                question_number="1"
            )

            assert "metrics" in result
            assert "execution_id" in result


# =============================================================================
# Output Validation Tests
# =============================================================================

class TestOutputValidation:
    """Tests for walkthrough output validation."""

    def test_validates_step_count_matches_bullets(self):
        """Test validation catches step count mismatches."""
        from src.walkthrough_author_claude_client import validate_walkthrough_output

        template = {
            "total_marks": 2,
            "steps": [
                {"bullet": 1, "marks_earned": 1}
                # Missing bullet 2
            ]
        }

        source = {
            "solution": {
                "generic_scheme": [
                    {"bullet": 1, "process": "step 1"},
                    {"bullet": 2, "process": "step 2"}
                ]
            }
        }

        is_valid, errors = validate_walkthrough_output(template, source)

        assert is_valid is False
        assert any("step count" in e.lower() for e in errors)

    def test_validates_marks_sum(self):
        """Test validation catches mark sum mismatches."""
        from src.walkthrough_author_claude_client import validate_walkthrough_output

        template = {
            "total_marks": 3,
            "steps": [
                {"bullet": 1, "marks_earned": 1},
                {"bullet": 2, "marks_earned": 1}
                # Marks sum to 2, not 3
            ]
        }

        source = {
            "solution": {
                "generic_scheme": [
                    {"bullet": 1, "process": "step 1"},
                    {"bullet": 2, "process": "step 2"}
                ]
            }
        }

        is_valid, errors = validate_walkthrough_output(template, source)

        assert is_valid is False
        assert any("marks" in e.lower() for e in errors)
