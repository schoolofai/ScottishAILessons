"""Eligibility Analyzer Agent - Determines which cards need diagrams with detailed specs.

Standalone Claude Agent SDK implementation for semantic card eligibility analysis.
Subject-agnostic: supports mathematics, science, geography, history, and any subject.

Architecture:
    - Single-purpose agent (no subagents needed)
    - Input: lesson_template dict
    - Output: eligible_cards list with diagram specifications
    - Uses Claude Agent SDK for consistency with main diagram author

Enhanced Output:
    Each eligible card now includes detailed diagram specifications:
    - lesson_diagram_specs[]: Array of DiagramSpec for lesson context
    - cfu_diagram_specs[]: Array of DiagramSpec for CFU context
    - Each spec includes: description, reasoning, key_elements, excluded

Usage:
    from eligibility_analyzer_agent import EligibilityAnalyzerAgent

    agent = EligibilityAnalyzerAgent()
    eligible_cards = await agent.analyze(lesson_template)

    # Or get structured DiagramSpecList objects
    spec_lists = await agent.analyze_with_specs(lesson_template)
"""

import json
import logging
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from .models.diagram_spec import DiagramSpec, DiagramSpecList

logger = logging.getLogger(__name__)


class EligibilityAnalyzerAgent:
    """Standalone agent for analyzing lesson card eligibility with diagram specs.

    Uses Claude Agent SDK to determine which lesson cards need diagrams and
    provides detailed specifications for each diagram to generate.

    This is the "heavy lifter" in the diagram pipeline - it does semantic
    analysis and provides diagram descriptions, not just boolean eligibility.

    Subject-Agnostic: Supports any subject (math, science, geography, etc.)
    by inferring subject from lesson template content.

    Attributes:
        model: Claude model to use (default: claude-sonnet-4-5)
        temperature: Temperature for analysis (0.0 for deterministic)

    Example:
        >>> agent = EligibilityAnalyzerAgent()
        >>> eligible = await agent.analyze(lesson_template)
        >>> len(eligible)
        3
        >>> eligible[0]["lesson_diagram_specs"][0]["description"]
        "Right triangle with labeled sides a=3cm, b=4cm, c=5cm"
    """

    def __init__(
        self,
        model: str = "claude-sonnet-4-5-20250929",
        temperature: float = 0.0
    ):
        """Initialize Eligibility Analyzer Agent.

        Args:
            model: Claude model to use
            temperature: Temperature for analysis (0.0 = deterministic)
        """
        self.model = model
        self.temperature = temperature

        # Load prompt
        prompts_dir = Path(__file__).parent / "prompts"
        prompt_file = prompts_dir / "eligibility_analyzer_prompt.md"

        if not prompt_file.exists():
            raise FileNotFoundError(
                f"Eligibility analyzer prompt not found: {prompt_file}"
            )

        self.prompt = prompt_file.read_text()

        logger.info(f"Initialized EligibilityAnalyzerAgent with model {model}")

    async def analyze(
        self,
        lesson_template: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Analyze lesson template cards for diagram eligibility.

        Creates a temporary workspace, writes lesson_template.json, runs the
        eligibility analysis agent, and reads the eligible_cards.json output.

        Args:
            lesson_template: Lesson template dictionary with cards array

        Returns:
            List of eligible cards with enhanced diagram specifications:
                - needs_lesson_diagram (bool)
                - needs_cfu_diagram (bool)
                - lesson_diagram_specs (list): Array of diagram spec dicts
                - cfu_diagram_specs (list): Array of diagram spec dicts
                - diagram_contexts (list): ["lesson"], ["cfu"], or ["lesson", "cfu"]
                - _eligibility_method (str): "claude_agent_sdk_analysis"

            Each diagram spec dict contains:
                - description (str): What the diagram shows
                - reasoning (str): Why it helps learning/assessment
                - key_elements (list): Elements to include
                - excluded (list): Elements to NOT include (for CFU)
                - diagram_type (str): Category (geometry, statistics, etc.)
                - diagram_index (int): 0, 1, 2 for multiple diagrams

        Raises:
            ValueError: If lesson_template has no cards
            Exception: If agent execution fails

        Example:
            >>> template = {"lessonTemplateId": "123", "cards": [...]}
            >>> eligible = await agent.analyze(template)
            >>> eligible[0]["lesson_diagram_specs"][0]["key_elements"]
            ["right triangle", "side a=3cm", "side b=4cm"]
        """
        cards = lesson_template.get("cards", [])

        if not cards:
            logger.info("Lesson template has no cards - returning empty list")
            return []

        logger.info(f"Analyzing {len(cards)} cards for diagram eligibility...")

        # Create temporary workspace for agent execution
        with tempfile.TemporaryDirectory() as workspace_dir:
            workspace_path = Path(workspace_dir)

            # Write lesson_template.json to workspace
            lesson_template_file = workspace_path / "lesson_template.json"
            with open(lesson_template_file, 'w') as f:
                json.dump(lesson_template, f, indent=2)

            logger.debug(f"Wrote lesson_template.json to {workspace_path}")

            # Configure agent options
            options = ClaudeAgentOptions(
                model=self.model,
                allowed_tools=['Read', 'Write', 'Edit', 'Glob', 'Grep'],
                permission_mode='bypassPermissions',
                max_turns=20,
                cwd=str(workspace_path)
            )

            # Run agent
            try:
                logger.info("Starting eligibility analysis agent...")

                async with ClaudeSDKClient(options) as client:
                    await client.query(self.prompt)

                    logger.info("Starting message stream...")
                    message_count = 0

                    async for message in client.receive_messages():
                        message_count += 1

                        logger.debug(
                            f"Message #{message_count} | Type: {type(message).__name__}"
                        )

                        if isinstance(message, ResultMessage):
                            logger.info(
                                f"Eligibility analysis completed after "
                                f"{message_count} messages"
                            )
                            break

                # Read eligible_cards.json from workspace
                eligible_cards_file = workspace_path / "eligible_cards.json"

                if not eligible_cards_file.exists():
                    raise Exception(
                        "Agent did not create eligible_cards.json. "
                        "Eligibility analysis failed."
                    )

                with open(eligible_cards_file, 'r') as f:
                    eligible_cards = json.load(f)

                # Log summary with diagram spec counts
                self._log_analysis_summary(eligible_cards, len(cards))

                return eligible_cards

            except Exception as e:
                logger.error(
                    f"Eligibility analysis agent failed: {e}",
                    exc_info=True
                )
                raise Exception(
                    f"Failed to analyze card eligibility: {str(e)}"
                ) from e

    async def analyze_with_specs(
        self,
        lesson_template: Dict[str, Any]
    ) -> List[DiagramSpecList]:
        """Analyze and return structured DiagramSpecList objects.

        Same as analyze() but returns DiagramSpecList instances instead of
        raw dictionaries. Useful for type safety and convenience methods.

        Args:
            lesson_template: Lesson template dictionary with cards array

        Returns:
            List of DiagramSpecList objects, one per eligible card

        Example:
            >>> spec_lists = await agent.analyze_with_specs(template)
            >>> for spec_list in spec_lists:
            ...     print(f"{spec_list.card_id}: {spec_list.total_diagrams} diagrams")
            ...     for spec in spec_list.lesson_specs:
            ...         print(f"  Lesson: {spec.description}")
        """
        eligible_cards = await self.analyze(lesson_template)

        spec_lists = []
        for card_data in eligible_cards:
            try:
                spec_list = DiagramSpecList.from_eligibility_output(card_data)
                spec_lists.append(spec_list)
            except Exception as e:
                logger.warning(
                    f"Failed to parse DiagramSpecList for card "
                    f"{card_data.get('id', 'unknown')}: {e}"
                )

        return spec_lists

    def _log_analysis_summary(
        self,
        eligible_cards: List[Dict[str, Any]],
        total_cards: int
    ):
        """Log detailed analysis summary with diagram counts."""
        logger.info(
            f"Eligibility analysis complete: "
            f"{len(eligible_cards)}/{total_cards} cards eligible"
        )

        # Count by context
        lesson_only = sum(
            1 for c in eligible_cards
            if c.get("diagram_contexts") == ["lesson"]
        )
        cfu_only = sum(
            1 for c in eligible_cards
            if c.get("diagram_contexts") == ["cfu"]
        )
        both_contexts = sum(
            1 for c in eligible_cards
            if set(c.get("diagram_contexts", [])) == {"lesson", "cfu"}
        )

        # Count total diagram specs
        total_lesson_specs = sum(
            len(c.get("lesson_diagram_specs", []))
            for c in eligible_cards
        )
        total_cfu_specs = sum(
            len(c.get("cfu_diagram_specs", []))
            for c in eligible_cards
        )

        logger.info(
            f"Context breakdown: {lesson_only} lesson-only, "
            f"{cfu_only} cfu-only, {both_contexts} both"
        )
        logger.info(
            f"Total diagrams to generate: {total_lesson_specs} lesson + "
            f"{total_cfu_specs} CFU = {total_lesson_specs + total_cfu_specs}"
        )


def parse_diagram_specs_from_card(
    card_data: Dict[str, Any]
) -> DiagramSpecList:
    """Parse diagram specifications from an eligible card dictionary.

    Utility function for parsing enhanced eligibility output into
    structured DiagramSpec objects.

    Args:
        card_data: Dictionary from eligible_cards.json with diagram specs

    Returns:
        DiagramSpecList containing all specs for this card

    Raises:
        ValueError: If card_data is missing required fields

    Example:
        >>> card_data = eligible_cards[0]
        >>> spec_list = parse_diagram_specs_from_card(card_data)
        >>> spec_list.needs_lesson_diagram
        True
    """
    return DiagramSpecList.from_eligibility_output(card_data)


# Convenience function for simple usage
async def analyze_lesson_eligibility(
    lesson_template: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Convenience function to analyze lesson card eligibility.

    Args:
        lesson_template: Lesson template dictionary with cards

    Returns:
        List of eligible cards with diagram specifications

    Example:
        >>> from eligibility_analyzer_agent import analyze_lesson_eligibility
        >>> eligible = await analyze_lesson_eligibility(lesson_template)
    """
    agent = EligibilityAnalyzerAgent()
    return await agent.analyze(lesson_template)


async def analyze_lesson_with_specs(
    lesson_template: Dict[str, Any]
) -> List[DiagramSpecList]:
    """Convenience function to get structured diagram specs.

    Args:
        lesson_template: Lesson template dictionary with cards

    Returns:
        List of DiagramSpecList objects for eligible cards

    Example:
        >>> from eligibility_analyzer_agent import analyze_lesson_with_specs
        >>> spec_lists = await analyze_lesson_with_specs(lesson_template)
    """
    agent = EligibilityAnalyzerAgent()
    return await agent.analyze_with_specs(lesson_template)
