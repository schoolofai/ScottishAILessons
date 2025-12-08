"""Mock Exam Orchestrator - Coordinates author-critic iteration loop.

Manages the iteration between Author/Reviser and Critic until the mock exam
passes all quality checks or max iterations is reached.

Flow:
    Iteration 1: Author → Critic
    Iteration 2+: Reviser → Critic (if previous iteration failed)
    Exit: When critic passes OR max iterations reached

No fallback pattern - fails fast if max iterations exceeded.
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..tools.mock_exam_schema_models import MockExam
from ..tools.mock_exam_critic_schema_models import MockExamCriticResult

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MAX_ITERATIONS = 3
MOCK_EXAM_FILE = "mock_exam.json"
CRITIC_RESULT_FILE = "mock_exam_critic_result.json"


@dataclass
class IterationResult:
    """Result of a single author-critic iteration."""
    iteration: int
    mock_exam: Optional[MockExam]
    critic_result: Optional[MockExamCriticResult]
    passed: bool
    message_counts: Dict[str, int] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class OrchestrationResult:
    """Final result of the orchestration loop."""
    success: bool
    final_mock_exam: Optional[MockExam]
    final_critic_result: Optional[MockExamCriticResult]
    iterations_completed: int
    iteration_history: List[IterationResult]
    total_message_count: int
    error: Optional[str] = None


class MockExamOrchestrator:
    """Orchestrates the author-critic iteration loop.

    Coordinates between:
    - MockExamAuthorAgent (initial generation)
    - MockExamCriticAgent (quality evaluation)
    - MockExamReviserAgent (targeted fixes)
    """

    def __init__(
        self,
        workspace_path: Path,
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        model: str = 'claude-sonnet-4-5'
    ):
        """Initialize Mock Exam Orchestrator.

        Args:
            workspace_path: Path to workspace with input files
            max_iterations: Maximum author-critic iterations (default: 3)
            model: Claude model to use for all agents
        """
        self.workspace_path = workspace_path
        self.max_iterations = max_iterations
        self.model = model
        self.iteration_history: List[IterationResult] = []

    async def execute(self) -> OrchestrationResult:
        """Execute the author-critic loop until pass or max iterations.

        Returns:
            OrchestrationResult with final exam, critic result, and history

        Raises:
            RuntimeError: If orchestration fails fatally (not just iteration failures)
        """
        logger.info("=" * 80)
        logger.info("MOCK EXAM ORCHESTRATOR - Starting iteration loop")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Max iterations: {self.max_iterations}")
        logger.info("=" * 80)

        total_messages = 0
        final_mock_exam = None
        final_critic_result = None

        for iteration in range(1, self.max_iterations + 1):
            logger.info("")
            logger.info("─" * 60)
            logger.info(f"ITERATION {iteration}/{self.max_iterations}")
            logger.info("─" * 60)

            try:
                iteration_result = await self._run_iteration(iteration)
                self.iteration_history.append(iteration_result)

                # Track message counts
                for agent, count in iteration_result.message_counts.items():
                    total_messages += count

                # Update final results
                final_mock_exam = iteration_result.mock_exam
                final_critic_result = iteration_result.critic_result

                # Check if passed
                if iteration_result.passed:
                    logger.info("")
                    logger.info("=" * 80)
                    logger.info(f"✅ ORCHESTRATION PASSED on iteration {iteration}")
                    logger.info(f"   Overall score: {final_critic_result.overall_score:.2f}/5.0")
                    logger.info(f"   Total messages: {total_messages}")
                    logger.info("=" * 80)

                    return OrchestrationResult(
                        success=True,
                        final_mock_exam=final_mock_exam,
                        final_critic_result=final_critic_result,
                        iterations_completed=iteration,
                        iteration_history=self.iteration_history,
                        total_message_count=total_messages
                    )

                # Log failure and continue to next iteration
                logger.warning(
                    f"⚠️ Iteration {iteration} FAILED - "
                    f"Score: {final_critic_result.overall_score:.2f}/5.0"
                )
                if final_critic_result.improvements_required:
                    logger.info("   Required improvements:")
                    for imp in final_critic_result.improvements_required[:3]:
                        logger.info(f"      - {imp}")

            except Exception as e:
                logger.error(f"❌ Iteration {iteration} error: {e}")
                self.iteration_history.append(IterationResult(
                    iteration=iteration,
                    mock_exam=None,
                    critic_result=None,
                    passed=False,
                    error=str(e)
                ))
                # Continue to next iteration - don't fail entire orchestration

        # Max iterations reached without passing
        logger.error("")
        logger.error("=" * 80)
        logger.error(f"❌ ORCHESTRATION FAILED - Max iterations ({self.max_iterations}) exceeded")
        if final_critic_result:
            logger.error(f"   Final score: {final_critic_result.overall_score:.2f}/5.0")
            if final_critic_result.dimensions:
                for dim, score in final_critic_result.dimensions.items():
                    status = "✓" if score.pass_ else "✗"
                    logger.error(f"      {status} {dim}: {score.score:.1f}")
        logger.error("=" * 80)

        return OrchestrationResult(
            success=False,
            final_mock_exam=final_mock_exam,
            final_critic_result=final_critic_result,
            iterations_completed=self.max_iterations,
            iteration_history=self.iteration_history,
            total_message_count=total_messages,
            error=f"Max iterations ({self.max_iterations}) exceeded without passing"
        )

    async def _run_iteration(self, iteration: int) -> IterationResult:
        """Run a single author/reviser → critic iteration.

        Args:
            iteration: Current iteration number (1-indexed)

        Returns:
            IterationResult with exam, critic result, and pass status
        """
        message_counts = {}

        # Step 1: Generate or revise mock exam
        if iteration == 1:
            # First iteration: use Author agent
            logger.info("📝 Running Mock Exam Author...")
            from .mock_exam_author_agent import run_mock_exam_author

            mock_exam = await run_mock_exam_author(
                workspace_path=self.workspace_path,
                write_to_file=True
            )
            message_counts["author"] = 0  # TODO: capture from agent
        else:
            # Subsequent iterations: use Reviser agent
            logger.info(f"🔧 Running Mock Exam Reviser (iteration {iteration})...")
            from .mock_exam_reviser_agent import run_mock_exam_reviser

            mock_exam = await run_mock_exam_reviser(
                workspace_path=self.workspace_path,
                iteration=iteration,
                max_iterations=self.max_iterations
            )
            message_counts["reviser"] = 0  # TODO: capture from agent

        logger.info(f"   ✅ Mock exam ready: {mock_exam.examId}")
        logger.info(f"      Questions: {mock_exam.summary.total_questions}")

        # Step 2: Run critic
        logger.info("🔍 Running Mock Exam Critic...")
        from .mock_exam_critic_agent import run_mock_exam_critic

        critic_result = await run_mock_exam_critic(
            workspace_path=self.workspace_path
        )
        message_counts["critic"] = 0  # TODO: capture from agent

        # Log critic results
        logger.info(f"   Schema Gate: {'PASS' if critic_result.schema_gate.pass_ else 'FAIL'}")
        logger.info(f"   Overall: {'PASS' if critic_result.pass_ else 'FAIL'}")
        logger.info(f"   Score: {critic_result.overall_score:.2f}/5.0")

        if critic_result.dimensions:
            logger.info("   Dimensions:")
            for dim, score in critic_result.dimensions.items():
                status = "✓" if score.pass_ else "✗"
                logger.info(f"      {status} {dim}: {score.score:.1f}/5.0")

        return IterationResult(
            iteration=iteration,
            mock_exam=mock_exam,
            critic_result=critic_result,
            passed=critic_result.pass_,
            message_counts=message_counts
        )


async def run_mock_exam_orchestrator(
    workspace_path: Path,
    max_iterations: int = DEFAULT_MAX_ITERATIONS
) -> OrchestrationResult:
    """Run the mock exam orchestration loop.

    Args:
        workspace_path: Path to workspace with input files
        max_iterations: Maximum iterations (default: 3)

    Returns:
        OrchestrationResult with final exam and history

    Raises:
        RuntimeError: If orchestration fails fatally
    """
    orchestrator = MockExamOrchestrator(
        workspace_path=workspace_path,
        max_iterations=max_iterations
    )
    return await orchestrator.execute()


# Standalone test
async def test_orchestrator():
    """Test the orchestrator with existing workspace."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from src.utils.logging_config import setup_logging
    setup_logging(log_level="INFO")

    # Use existing workspace
    workspace = Path("workspace/20251205_220701")

    if not workspace.exists():
        print(f"❌ Workspace not found: {workspace}")
        return

    result = await run_mock_exam_orchestrator(
        workspace_path=workspace,
        max_iterations=3
    )

    print()
    print("=" * 60)
    print("ORCHESTRATION RESULT")
    print("=" * 60)
    print(f"Success: {result.success}")
    print(f"Iterations: {result.iterations_completed}")
    print(f"Total messages: {result.total_message_count}")

    if result.final_mock_exam:
        print(f"Exam ID: {result.final_mock_exam.examId}")
        print(f"Questions: {result.final_mock_exam.summary.total_questions}")

    if result.final_critic_result:
        print(f"Final score: {result.final_critic_result.overall_score:.2f}/5.0")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_orchestrator())
