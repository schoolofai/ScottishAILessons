"""Section-Based Orchestrator - Coordinates section-by-section mock exam generation.

Part of the section-based scaling solution for mock exam generation.
Orchestrates the generation of individual sections and their assembly.

Key Features:
- Parallel or sequential section generation
- Section-level error recovery
- Uses existing Critic for full exam evaluation
- Section-level revision when critic fails

Flow:
    1. Parse source to identify sections (assessment cards)
    2. Generate each section (parallel or sequential)
    3. Merge sections into complete exam
    4. Run Critic on full exam
    5. If Critic fails: Section-level revision on failed sections
    6. Exit when Critic passes OR max iterations reached
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..tools.mock_exam_schema_models import MockExam
from ..tools.mock_exam_critic_schema_models import MockExamCriticResult
from ..tools.section_generation_schema import SectionGenerationContext
from ..utils.section_merger import merge_sections, write_merged_exam

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MAX_ITERATIONS = 3
MOCK_EXAM_FILE = "mock_exam.json"


@dataclass
class SectionResult:
    """Result of generating a single section."""
    section_index: int
    success: bool
    section: Optional[Dict[str, Any]] = None
    message_count: int = 0
    error: Optional[str] = None


@dataclass
class SectionOrchestrationResult:
    """Final result of section-based orchestration."""
    success: bool
    final_mock_exam: Optional[MockExam]
    final_critic_result: Optional[MockExamCriticResult]
    sections_generated: int
    iterations_completed: int
    total_message_count: int
    parallel_generation: bool
    error: Optional[str] = None


class SectionBasedOrchestrator:
    """Orchestrates section-by-section mock exam generation.

    Generates sections independently (optionally in parallel),
    then assembles and validates with the existing Critic.
    """

    def __init__(
        self,
        workspace_path: Path,
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        parallel: bool = True,
        model: str = 'claude-sonnet-4-5'
    ):
        """Initialize Section-Based Orchestrator.

        Args:
            workspace_path: Path to workspace with input files
            max_iterations: Maximum author-critic iterations (default: 3)
            parallel: If True, generate sections in parallel
            model: Claude model to use for all agents
        """
        self.workspace_path = workspace_path
        self.max_iterations = max_iterations
        self.parallel = parallel
        self.model = model

    async def execute(self) -> SectionOrchestrationResult:
        """Execute section-based generation.

        Returns:
            SectionOrchestrationResult with final exam and metrics

        Raises:
            RuntimeError: If orchestration fails fatally
        """
        logger.info("=" * 80)
        logger.info("SECTION-BASED ORCHESTRATOR - Starting")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Max iterations: {self.max_iterations}")
        logger.info(f"   Parallel generation: {self.parallel}")
        logger.info("=" * 80)

        # Load source data
        source_file = self.workspace_path / "mock_exam_source.json"
        context_file = self.workspace_path / "sow_context.json"

        if not source_file.exists():
            raise RuntimeError(f"Missing input file: {source_file}")
        if not context_file.exists():
            raise RuntimeError(f"Missing input file: {context_file}")

        with open(source_file) as f:
            source_data = json.load(f)
        with open(context_file) as f:
            context_data = json.load(f)

        # Parse sections from source
        section_specs = self._parse_section_specs(source_data, context_data)
        logger.info(f"Parsed {len(section_specs)} sections from source")

        total_messages = 0
        final_mock_exam = None
        final_critic_result = None

        for iteration in range(1, self.max_iterations + 1):
            logger.info("")
            logger.info("─" * 60)
            logger.info(f"ITERATION {iteration}/{self.max_iterations}")
            logger.info("─" * 60)

            try:
                # Step 1: Generate all sections
                if iteration == 1:
                    section_results = await self._generate_all_sections(section_specs)
                else:
                    # On revision iterations, only regenerate failed sections
                    section_results = await self._revise_failed_sections(
                        section_specs,
                        final_critic_result,
                        final_mock_exam
                    )

                # Count messages
                for result in section_results:
                    total_messages += result.message_count

                # Check for any section failures
                failed_sections = [r for r in section_results if not r.success]
                if failed_sections:
                    errors = [f"Section {r.section_index}: {r.error}" for r in failed_sections]
                    logger.error(f"Section generation failed: {errors}")
                    continue  # Try next iteration

                # Step 2: Merge sections
                sections = [r.section for r in section_results if r.section]
                exam_metadata = self._build_exam_metadata(source_data, context_data)

                mock_exam_dict = merge_sections(
                    exam_metadata=exam_metadata,
                    sections=sections,
                    validate=False  # Validate after write
                )

                # Write merged exam
                output_path = self.workspace_path / MOCK_EXAM_FILE
                with open(output_path, 'w') as f:
                    json.dump(mock_exam_dict, f, indent=2)
                logger.info(f"✅ Written merged mock_exam.json")

                # Validate with Pydantic
                try:
                    final_mock_exam = MockExam.model_validate(mock_exam_dict)
                    logger.info("✅ MockExam schema validation passed")
                except Exception as e:
                    logger.error(f"MockExam validation failed: {e}")
                    # Continue to critic - it will catch specific issues
                    final_mock_exam = MockExam.model_construct(**mock_exam_dict)

                # Step 3: Run Critic
                logger.info("🔍 Running Mock Exam Critic...")
                from .mock_exam_critic_agent import run_mock_exam_critic

                final_critic_result = await run_mock_exam_critic(
                    workspace_path=self.workspace_path
                )

                # Log critic results
                logger.info(f"   Schema Gate: {'PASS' if final_critic_result.schema_gate.pass_ else 'FAIL'}")
                logger.info(f"   Overall: {'PASS' if final_critic_result.pass_ else 'FAIL'}")
                logger.info(f"   Score: {final_critic_result.overall_score:.2f}/5.0")

                if final_critic_result.pass_:
                    logger.info("")
                    logger.info("=" * 80)
                    logger.info(f"✅ SECTION ORCHESTRATION PASSED on iteration {iteration}")
                    logger.info(f"   Sections: {len(sections)}")
                    logger.info(f"   Questions: {final_mock_exam.summary.total_questions}")
                    logger.info(f"   Total messages: {total_messages}")
                    logger.info("=" * 80)

                    return SectionOrchestrationResult(
                        success=True,
                        final_mock_exam=final_mock_exam,
                        final_critic_result=final_critic_result,
                        sections_generated=len(sections),
                        iterations_completed=iteration,
                        total_message_count=total_messages,
                        parallel_generation=self.parallel
                    )

                # Log failure and continue
                logger.warning(
                    f"⚠️ Iteration {iteration} FAILED - "
                    f"Score: {final_critic_result.overall_score:.2f}/5.0"
                )

            except Exception as e:
                logger.error(f"❌ Iteration {iteration} error: {e}")
                # Continue to next iteration

        # Max iterations exceeded
        logger.error("")
        logger.error("=" * 80)
        logger.error(f"❌ SECTION ORCHESTRATION FAILED - Max iterations ({self.max_iterations}) exceeded")
        logger.error("=" * 80)

        return SectionOrchestrationResult(
            success=False,
            final_mock_exam=final_mock_exam,
            final_critic_result=final_critic_result,
            sections_generated=len(section_specs),
            iterations_completed=self.max_iterations,
            total_message_count=total_messages,
            parallel_generation=self.parallel,
            error=f"Max iterations ({self.max_iterations}) exceeded"
        )

    def _parse_section_specs(
        self,
        source_data: Dict[str, Any],
        context_data: Dict[str, Any]
    ) -> List[SectionGenerationContext]:
        """Parse section specifications from mock exam source.

        Identifies assessment cards and creates context for each.
        """
        mock_entry = source_data.get("mock_exam_entries", [{}])[0]
        card_structure = mock_entry.get("lesson_plan", {}).get("card_structure", [])

        # Filter to assessment cards only (these contain practice_problems)
        assessment_cards = [
            card for card in card_structure
            if card.get("card_type") == "assessment" and card.get("practice_problems")
        ]

        logger.info(f"Found {len(assessment_cards)} assessment cards")

        # Build exam metadata
        exam_id = f"exam_{source_data.get('sowId', 'unknown')}_{mock_entry.get('order', 1)}"
        total_marks = sum(
            self._estimate_card_marks(card)
            for card in assessment_cards
        )
        total_time = mock_entry.get("estMinutes", 60)

        section_contexts = []
        question_num = 1

        for i, card in enumerate(assessment_cards):
            # Estimate questions for this card
            num_questions = len(card.get("practice_problems", []))

            context = SectionGenerationContext(
                examId=exam_id,
                courseId=source_data.get("courseId", ""),
                sowId=source_data.get("sowId", ""),
                sowEntryOrder=mock_entry.get("order", 1),
                subject=context_data.get("subject", "mathematics"),
                level=context_data.get("level", "national-4"),
                title=mock_entry.get("label", "Mock Examination"),
                total_exam_marks=total_marks,
                total_exam_time=total_time,
                calculator_policy=mock_entry.get("policy", {}).get("calculator_section", "calc"),
                section_index=i,
                total_sections=len(assessment_cards),
                section_spec=card,
                standards_to_address=card.get("standards_addressed", []),
                question_number_start=question_num
            )

            section_contexts.append(context)
            question_num += num_questions

        return section_contexts

    def _estimate_card_marks(self, card: Dict[str, Any]) -> int:
        """Estimate total marks for a card from practice_problems."""
        import re
        total = 0
        for problem in card.get("practice_problems", []):
            match = re.search(r'\[(\d+)\s*marks?\]', problem, re.IGNORECASE)
            if match:
                total += int(match.group(1))
            else:
                total += 3  # Default marks per question
        return total

    def _build_exam_metadata(
        self,
        source_data: Dict[str, Any],
        context_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build exam-level metadata for merger."""
        mock_entry = source_data.get("mock_exam_entries", [{}])[0]

        # Extract subject/level, handling empty strings from context_data
        subject = context_data.get("subject") or "mathematics"
        level = context_data.get("level") or "national-4"

        # Map calculator_section values to valid enum values
        # Valid: 'non_calc', 'calc', 'mixed', 'exam_conditions'
        raw_calc_policy = mock_entry.get("policy", {}).get("calculator_section", "calc")
        calc_policy_map = {
            "both": "mixed",           # 'both' means mixed sections
            "non_calc": "non_calc",
            "calc": "calc",
            "mixed": "mixed",
            "exam_conditions": "exam_conditions",
            "non-calc": "non_calc",    # Handle hyphenated variant
        }
        calculator_policy = calc_policy_map.get(raw_calc_policy, "exam_conditions")

        # Get accessibility profile with proper enum values
        raw_accessibility = mock_entry.get("accessibility_profile", {})
        accessibility_profile = {
            "plain_language_level": "B1",  # Valid: A1, A2, B1, B2
            "dyslexia_friendly": raw_accessibility.get("dyslexia_friendly", True),
            "extra_time_percentage": raw_accessibility.get("extra_time_percentage", 25)
        }
        # Fix CEFR_B1 -> B1 etc.
        raw_lang_level = raw_accessibility.get("plain_language_level", "B1")
        if raw_lang_level.startswith("CEFR_"):
            accessibility_profile["plain_language_level"] = raw_lang_level[5:]  # Strip CEFR_ prefix

        return {
            "schema_version": "mock_exam_v1",
            "examId": f"exam_{source_data.get('sowId', 'unknown')}_{mock_entry.get('order', 1)}",
            "courseId": source_data.get("courseId", ""),
            "sowId": source_data.get("sowId", ""),
            "sowEntryOrder": mock_entry.get("order", 1),
            "title": mock_entry.get("label", "Mock Examination"),
            "subject": subject,
            "level": level,
            "timeLimit": mock_entry.get("estMinutes", 60),
            "instructions": "Answer ALL questions. Show all working clearly.",
            "instructions_plain": "Answer every question. Write down your steps.",
            "calculator_policy": calculator_policy,
            "exam_conditions": True,
            "accessibility_profile": accessibility_profile
        }

    async def _generate_all_sections(
        self,
        section_specs: List[SectionGenerationContext]
    ) -> List[SectionResult]:
        """Generate all sections (parallel or sequential).

        Args:
            section_specs: List of section contexts

        Returns:
            List of SectionResult objects
        """
        from .section_author_agent import run_section_author

        if self.parallel:
            logger.info(f"🚀 Generating {len(section_specs)} sections in PARALLEL")
            tasks = [
                self._generate_section(spec)
                for spec in section_specs
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Convert exceptions to SectionResult
            section_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    section_results.append(SectionResult(
                        section_index=i,
                        success=False,
                        error=str(result)
                    ))
                else:
                    section_results.append(result)

            return section_results
        else:
            logger.info(f"📝 Generating {len(section_specs)} sections SEQUENTIALLY")
            results = []
            for spec in section_specs:
                result = await self._generate_section(spec)
                results.append(result)
            return results

    async def _generate_section(
        self,
        spec: SectionGenerationContext
    ) -> SectionResult:
        """Generate a single section."""
        from .section_author_agent import run_section_author

        try:
            result = await run_section_author(
                workspace_path=self.workspace_path,
                section_context=spec
            )

            return SectionResult(
                section_index=spec.section_index,
                success=result["success"],
                section=result.get("section"),
                message_count=result.get("message_count", 0)
            )
        except Exception as e:
            logger.error(f"Section {spec.section_index} failed: {e}")
            return SectionResult(
                section_index=spec.section_index,
                success=False,
                error=str(e)
            )

    async def _revise_failed_sections(
        self,
        section_specs: List[SectionGenerationContext],
        critic_result: MockExamCriticResult,
        current_exam: MockExam
    ) -> List[SectionResult]:
        """Revise sections that caused critic failure.

        For now, regenerates all sections. Future: identify specific failed sections.
        """
        # TODO: Parse critic result to identify which sections need revision
        # For MVP, regenerate all sections
        logger.info("🔧 Regenerating all sections for revision...")
        return await self._generate_all_sections(section_specs)


async def run_section_based_orchestrator(
    workspace_path: Path,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    parallel: bool = True
) -> SectionOrchestrationResult:
    """Run section-based orchestration.

    Args:
        workspace_path: Path to workspace with input files
        max_iterations: Maximum iterations (default: 3)
        parallel: If True, generate sections in parallel

    Returns:
        SectionOrchestrationResult with final exam

    Raises:
        RuntimeError: If orchestration fails
    """
    orchestrator = SectionBasedOrchestrator(
        workspace_path=workspace_path,
        max_iterations=max_iterations,
        parallel=parallel
    )
    return await orchestrator.execute()
