"""Eligibility Analyzer Agent - Determines which cards need JSXGraph diagrams.

Standalone Claude Agent SDK implementation for semantic card eligibility analysis.
Replaces LangChain-based LLM calls with proper agent architecture.

Architecture:
    - Single-purpose agent (no subagents needed)
    - Input: lesson_template dict
    - Output: eligible_cards list with dual-context analysis
    - Uses Claude Agent SDK for consistency with main diagram author

Usage:
    from eligibility_analyzer_agent import EligibilityAnalyzerAgent

    agent = EligibilityAnalyzerAgent()
    eligible_cards = await agent.analyze(lesson_template)
"""

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, List

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

logger = logging.getLogger(__name__)


class EligibilityAnalyzerAgent:
    """Standalone agent for analyzing lesson card eligibility.

    Uses Claude Agent SDK to determine which lesson cards need JSXGraph diagrams
    and which contexts (lesson vs CFU) require visualization.

    This replaces the LangChain-based eligibility analysis with a proper
    Claude Agent SDK architecture.

    Attributes:
        model: Claude model to use (default: claude-sonnet-4-5)
        temperature: Temperature for analysis (0.0 for deterministic)

    Example:
        >>> agent = EligibilityAnalyzerAgent()
        >>> eligible = await agent.analyze(lesson_template)
        >>> len(eligible)
        3
        >>> eligible[0]["diagram_contexts"]
        ["lesson", "cfu"]
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
            List of eligible cards with diagram context information:
                - needs_lesson_diagram (bool)
                - needs_cfu_diagram (bool)
                - lesson_diagram_reason (str)
                - cfu_diagram_reason (str)
                - diagram_contexts (list): ["lesson"], ["cfu"], or ["lesson", "cfu"]
                - _eligibility_method (str): "claude_agent_sdk_analysis"

        Raises:
            ValueError: If lesson_template has no cards
            Exception: If agent execution fails

        Example:
            >>> template = {"lessonTemplateId": "123", "cards": [...]}
            >>> eligible = await agent.analyze(template)
            >>> [card["diagram_contexts"] for card in eligible]
            [["lesson"], ["lesson", "cfu"], ["cfu"]]
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

            # Configure agent options (ClaudeSDKClient uses Claude subscription or ANTHROPIC_API_KEY from environment)
            options = ClaudeAgentOptions(
                model=self.model,
                allowed_tools=['Read', 'Write', 'Edit', 'Glob', 'Grep'],
                permission_mode='bypassPermissions',
                max_turns=20,  # Simple analysis shouldn't need many turns
                cwd=str(workspace_path)
            )

            # Run agent
            try:
                logger.info("Starting eligibility analysis agent...")

                # Initialize Claude SDK client with options (async context manager)
                async with ClaudeSDKClient(options) as client:
                    # Send prompt to agent
                    await client.query(self.prompt)

                    logger.info("Starting message stream - logging ALL raw messages...")
                    message_count = 0

                    # Process messages until agent completion
                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level (for debugging)
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Agent has completed eligibility analysis
                            logger.info(f"✅ Eligibility analysis completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # Agent completed - read eligible_cards.json from workspace
                eligible_cards_file = workspace_path / "eligible_cards.json"

                if not eligible_cards_file.exists():
                    raise Exception(
                        "Agent did not create eligible_cards.json. "
                        "Eligibility analysis failed."
                    )

                with open(eligible_cards_file, 'r') as f:
                    eligible_cards = json.load(f)

                logger.info(
                    f"✅ Eligibility analysis complete: "
                    f"{len(eligible_cards)}/{len(cards)} cards eligible"
                )

                # Log breakdown by context
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

                logger.info(
                    f"📊 Breakdown: {lesson_only} lesson-only, "
                    f"{cfu_only} cfu-only, {both_contexts} both contexts"
                )

                return eligible_cards

            except Exception as e:
                logger.error(f"Eligibility analysis agent failed: {e}", exc_info=True)
                raise Exception(
                    f"Failed to analyze card eligibility: {str(e)}"
                ) from e


# Convenience function for simple usage
async def analyze_lesson_eligibility(
    lesson_template: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Convenience function to analyze lesson card eligibility.

    Args:
        lesson_template: Lesson template dictionary with cards

    Returns:
        List of eligible cards with diagram context information

    Example:
        >>> from eligibility_analyzer_agent import analyze_lesson_eligibility
        >>> eligible = await analyze_lesson_eligibility(lesson_template)
    """
    agent = EligibilityAnalyzerAgent()
    return await agent.analyze(lesson_template)
