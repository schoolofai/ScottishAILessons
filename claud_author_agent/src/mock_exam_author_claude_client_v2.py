"""Mock Exam Author Claude Agent v2 - Fully Integrated Pipeline.

Complete pipeline with fail-fast behavior and extensive DEBUG logging.
Each step must succeed before proceeding to the next.

Pipeline Architecture:
    Step 1: PRE-PROCESSING (Python)
        - Extract mock_exam entries from Authored_SOW
        - Copy diagram examples to workspace
        - Verify diagram services health (FAIL-FAST if unavailable)

    Step 2: AUTHOR-CRITIC ITERATION LOOP (Orchestrator pattern)
        - Iteration 1: MockExamAuthorAgent → mock_exam.json
        - MockExamCriticAgent → mock_exam_critic_result.json
        - If critic fails (score < 3.5 on any dimension):
            - Iteration 2+: MockExamReviserAgent → revised mock_exam.json
            - MockExamCriticAgent → re-evaluate
        - Exit: When critic passes OR max iterations (3) reached
        - FAIL-FAST: Throws exception if max iterations exceeded without passing

    Step 3: DIAGRAM CLASSIFICATION (ClaudeSDK Agent)
        - DiagramClassifierAgent → classification_output.json
        - Classifies each question for optimal diagram tool
        - FAIL-FAST: Throws exception if classification fails

    Step 4: DIAGRAM AUTHORING (ClaudeSDK Agent with MCP Tools)
        - DiagramAuthorAgent → diagrams/ directory with PNG files
        - Generates diagrams using specialized MCP tool servers
        - Iterative critique loop with DiagramCriticSubagent
        - FAIL-FAST: Throws exception if any diagram fails

    Step 5: UPSERT TO APPWRITE (Python)
        - Upsert mock_exam.json to Appwrite mock_exams collection
        - Upload diagrams to Appwrite storage
        - FAIL-FAST: Throws exception if upsert fails

LOGGING: Uses DEBUG level by default for maximum verbosity.
FAIL-FAST: No fallback patterns - all errors throw exceptions.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from .utils.logging_config import setup_logging, add_workspace_file_handler, remove_workspace_file_handler
from .utils.metrics import CostTracker, format_cost_report

logger = logging.getLogger(__name__)

# Set maximum output token limit for Claude Agent SDK
os.environ.setdefault('CLAUDE_CODE_MAX_OUTPUT_TOKENS', '100000')


@dataclass
class PipelineStepResult:
    """Result of a single pipeline step."""
    step_name: str
    success: bool
    duration_seconds: float
    message_count: int = 0
    error: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineMetrics:
    """Complete pipeline execution metrics."""
    execution_id: str
    total_duration_seconds: float
    step_results: List[PipelineStepResult]
    mock_exam_id: Optional[str] = None
    appwrite_document_id: Optional[str] = None
    diagrams_generated: int = 0
    diagrams_failed: int = 0
    total_message_count: int = 0
    cost_usd: float = 0.0


class MockExamAuthorClaudeAgentV2:
    """Fully integrated mock exam authoring pipeline with fail-fast behavior.

    Each step must complete successfully before proceeding.
    Uses DEBUG logging by default for maximum verbosity.
    No fallback patterns - all errors throw exceptions immediately.
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "DEBUG"  # CHANGED: Default to DEBUG for max verbosity
    ):
        """Initialize Mock Exam Author agent v2.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            log_level: Logging level (DEBUG by default for maximum verbosity)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.log_level = log_level

        # Generate execution ID
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging with DEBUG level by default
        setup_logging(log_level=log_level)

        # Track step results
        self.step_results: List[PipelineStepResult] = []

        logger.info("=" * 80)
        logger.info("MOCK EXAM AUTHOR PIPELINE v2 - INITIALIZED")
        logger.info(f"   Execution ID: {self.execution_id}")
        logger.info(f"   Log Level: {log_level}")
        logger.info(f"   MCP Config: {mcp_config_path}")
        logger.info(f"   Persist Workspace: {persist_workspace}")
        logger.info("=" * 80)

    async def execute(
        self,
        courseId: str,
        version: str = "1",
        force: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Execute the complete mock exam authoring pipeline.

        FAIL-FAST: Each step must succeed. Any failure throws an exception.

        Args:
            courseId: Course identifier (e.g., 'course_c84473')
            version: Mock exam version number (default: "1")
            force: If True, overwrite existing mock exam for this version
            dry_run: If True, generate mock exam but don't upsert to Appwrite

        Returns:
            Dictionary with success status, workspace path, and metrics

        Raises:
            RuntimeError: If any pipeline step fails (fail-fast)
        """
        pipeline_start = time.time()

        logger.info("\n" + "=" * 80)
        logger.info("MOCK EXAM AUTHOR v2 - STARTING PIPELINE EXECUTION")
        logger.info("=" * 80)
        logger.info(f"   courseId: {courseId}")
        logger.info(f"   version: {version}")
        logger.info(f"   force: {force}")
        logger.info(f"   dry_run: {dry_run}")
        logger.info(f"   execution_id: {self.execution_id}")
        logger.info("=" * 80)

        workspace_path = None

        try:
            # ═══════════════════════════════════════════════════════════════
            # STEP 1: PRE-PROCESSING
            # ═══════════════════════════════════════════════════════════════
            workspace_path, preprocessing_result = await self._execute_step_1_preprocessing(
                courseId=courseId
            )

            # ═══════════════════════════════════════════════════════════════
            # STEP 2: AUTHOR-CRITIC ITERATION LOOP
            # ═══════════════════════════════════════════════════════════════
            mock_exam, critic_result, orchestration_result = await self._execute_step_2_orchestration(
                workspace_path=workspace_path
            )

            mock_exam_id = mock_exam.examId

            # ═══════════════════════════════════════════════════════════════
            # STEP 3: DIAGRAM CLASSIFICATION
            # ═══════════════════════════════════════════════════════════════
            classification_result = await self._execute_step_3_classification(
                workspace_path=workspace_path
            )

            questions_needing_diagrams = classification_result.questions_needing_diagrams

            # ═══════════════════════════════════════════════════════════════
            # STEP 4: DIAGRAM AUTHORING (conditional, but FAIL-FAST)
            # ═══════════════════════════════════════════════════════════════
            diagram_result = None
            diagrams_generated = 0
            diagrams_failed = 0

            if questions_needing_diagrams > 0:
                diagram_result = await self._execute_step_4_diagram_authoring(
                    workspace_path=workspace_path
                )
                diagrams_generated = diagram_result.successful_diagrams
                diagrams_failed = diagram_result.failed_diagrams
            else:
                logger.info("\n" + "=" * 60)
                logger.info("STEP 4: DIAGRAM AUTHORING (SKIPPED)")
                logger.info("=" * 60)
                logger.info("   No questions require diagrams - skipping")
                self.step_results.append(PipelineStepResult(
                    step_name="diagram_authoring",
                    success=True,
                    duration_seconds=0.0,
                    details={"skipped": True, "reason": "no_diagrams_needed"}
                ))

            # ═══════════════════════════════════════════════════════════════
            # STEP 5: UPSERT TO APPWRITE
            # ═══════════════════════════════════════════════════════════════
            appwrite_document_id = None

            if not dry_run:
                appwrite_document_id = await self._execute_step_5_upsert(
                    workspace_path=workspace_path,
                    courseId=courseId,
                    version=version,
                    force=force
                )
            else:
                logger.info("\n" + "=" * 60)
                logger.info("STEP 5: UPSERT TO APPWRITE (DRY RUN - SKIPPED)")
                logger.info("=" * 60)
                logger.info("   dry_run=True - skipping Appwrite upsert")
                self.step_results.append(PipelineStepResult(
                    step_name="upsert",
                    success=True,
                    duration_seconds=0.0,
                    details={"skipped": True, "reason": "dry_run"}
                ))

            # ═══════════════════════════════════════════════════════════════
            # PIPELINE COMPLETE - SUCCESS
            # ═══════════════════════════════════════════════════════════════
            pipeline_duration = time.time() - pipeline_start

            # Calculate total messages
            total_messages = sum(r.message_count for r in self.step_results)

            logger.info("\n" + "=" * 80)
            logger.info("✅ PIPELINE COMPLETE - SUCCESS")
            logger.info("=" * 80)
            logger.info(f"   Execution ID: {self.execution_id}")
            logger.info(f"   Duration: {pipeline_duration:.2f}s")
            logger.info(f"   Workspace: {workspace_path}")
            logger.info(f"   Mock Exam ID: {mock_exam_id}")
            logger.info(f"   Appwrite Document: {appwrite_document_id or 'N/A (dry_run)'}")
            logger.info(f"   Questions: {mock_exam.summary.total_questions}")
            logger.info(f"   Diagrams Generated: {diagrams_generated}")
            logger.info(f"   Diagrams Failed: {diagrams_failed}")
            logger.info(f"   Total Messages: {total_messages}")
            logger.info("")
            logger.info("Step Summary:")
            for step in self.step_results:
                status = "✅" if step.success else "❌"
                logger.info(f"   {status} {step.step_name}: {step.duration_seconds:.2f}s")
            logger.info("=" * 80)

            # Cleanup file handler
            if workspace_path:
                remove_workspace_file_handler(workspace_path)

            return {
                "success": True,
                "execution_id": self.execution_id,
                "workspace_path": str(workspace_path),
                "mock_exam_id": mock_exam_id,
                "appwrite_document_id": appwrite_document_id,
                "pipeline_metrics": {
                    "total_duration_seconds": pipeline_duration,
                    "total_messages": total_messages,
                    "steps": [
                        {
                            "name": r.step_name,
                            "success": r.success,
                            "duration_seconds": r.duration_seconds,
                            "message_count": r.message_count,
                            "details": r.details
                        }
                        for r in self.step_results
                    ]
                },
                "diagram_metrics": {
                    "questions_classified": classification_result.total_questions,
                    "questions_needing_diagrams": questions_needing_diagrams,
                    "diagrams_generated": diagrams_generated,
                    "diagrams_failed": diagrams_failed
                },
                "cost_metrics": self.cost_tracker.get_summary()
            }

        except Exception as e:
            # FAIL-FAST: Log full exception and re-raise
            pipeline_duration = time.time() - pipeline_start

            logger.error("\n" + "=" * 80)
            logger.error("❌ PIPELINE FAILED - FAIL-FAST")
            logger.error("=" * 80)
            logger.error(f"   Execution ID: {self.execution_id}")
            logger.error(f"   Duration: {pipeline_duration:.2f}s")
            logger.error(f"   Error: {e}")
            logger.error("")
            logger.error("Step Summary (before failure):")
            for step in self.step_results:
                status = "✅" if step.success else "❌"
                logger.error(f"   {status} {step.step_name}: {step.duration_seconds:.2f}s")
            logger.error("=" * 80)
            logger.exception("Full exception traceback:")

            # Cleanup file handler
            if workspace_path:
                try:
                    remove_workspace_file_handler(workspace_path)
                except Exception:
                    pass

            # Re-raise to fail fast
            raise RuntimeError(
                f"Pipeline failed at execution_id={self.execution_id}: {e}"
            ) from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: PRE-PROCESSING
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_1_preprocessing(
        self,
        courseId: str
    ) -> tuple:
        """Execute Step 1: Pre-processing.

        FAIL-FAST: Throws exception if preprocessing fails.

        Returns:
            Tuple of (workspace_path, preprocessing_result)
        """
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 1: PRE-PROCESSING")
        logger.info("=" * 60)
        logger.debug(f"   courseId: {courseId}")
        logger.debug(f"   mcp_config_path: {self.mcp_config_path}")

        from .agents.preprocessing import run_preprocessing

        try:
            preprocessing_result = await run_preprocessing(
                courseId=courseId,
                mcp_config_path=str(self.mcp_config_path),
                persist_workspace=self.persist_workspace,
                verify_diagram_services=True,  # FAIL-FAST if diagram services unavailable
                execution_id=self.execution_id
            )

            workspace_path = preprocessing_result.workspace_path
            duration = time.time() - step_start

            logger.info(f"✅ Pre-processing complete")
            logger.info(f"   Workspace: {workspace_path}")
            logger.info(f"   Mock exam entries: {len(preprocessing_result.mock_exam_entries)}")
            logger.info(f"   Duration: {duration:.2f}s")
            logger.debug(f"   SOW metadata: {preprocessing_result.sow_metadata}")

            self.step_results.append(PipelineStepResult(
                step_name="preprocessing",
                success=True,
                duration_seconds=duration,
                details={
                    "workspace_path": str(workspace_path),
                    "mock_exam_entries": len(preprocessing_result.mock_exam_entries),
                    "sow_id": preprocessing_result.sow_metadata.get("sowId")
                }
            ))

            return workspace_path, preprocessing_result

        except Exception as e:
            duration = time.time() - step_start
            logger.error(f"❌ Pre-processing FAILED: {e}")

            self.step_results.append(PipelineStepResult(
                step_name="preprocessing",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))

            # FAIL-FAST: Re-raise
            raise RuntimeError(f"Step 1 (Preprocessing) failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: AUTHOR-CRITIC ORCHESTRATION
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_2_orchestration(
        self,
        workspace_path: Path
    ) -> tuple:
        """Execute Step 2: Author-Critic iteration loop.

        FAIL-FAST: Throws exception if orchestration fails or max iterations exceeded.

        Returns:
            Tuple of (mock_exam, critic_result, orchestration_result)
        """
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: AUTHOR-CRITIC ITERATION LOOP")
        logger.info("=" * 60)
        logger.debug(f"   Workspace: {workspace_path}")
        logger.debug(f"   Max iterations: 3")

        from .agents.mock_exam_orchestrator import run_mock_exam_orchestrator

        try:
            orchestration_result = await run_mock_exam_orchestrator(
                workspace_path=workspace_path,
                max_iterations=3
            )

            duration = time.time() - step_start

            # FAIL-FAST: Check orchestration success
            if not orchestration_result.success:
                raise RuntimeError(
                    f"Author-Critic loop failed after {orchestration_result.iterations_completed} iterations: "
                    f"{orchestration_result.error}"
                )

            mock_exam = orchestration_result.final_mock_exam
            critic_result = orchestration_result.final_critic_result

            logger.info(f"✅ Author-Critic orchestration complete")
            logger.info(f"   Iterations: {orchestration_result.iterations_completed}")
            logger.info(f"   Exam ID: {mock_exam.examId}")
            logger.info(f"   Questions: {mock_exam.summary.total_questions}")
            logger.info(f"   Total marks: {mock_exam.metadata.totalMarks}")
            logger.info(f"   Critic score: {critic_result.overall_score:.2f}/5.0")
            logger.info(f"   Duration: {duration:.2f}s")
            logger.debug(f"   Total messages: {orchestration_result.total_message_count}")

            self.step_results.append(PipelineStepResult(
                step_name="orchestration",
                success=True,
                duration_seconds=duration,
                message_count=orchestration_result.total_message_count,
                details={
                    "iterations": orchestration_result.iterations_completed,
                    "exam_id": mock_exam.examId,
                    "total_questions": mock_exam.summary.total_questions,
                    "critic_score": critic_result.overall_score
                }
            ))

            return mock_exam, critic_result, orchestration_result

        except Exception as e:
            duration = time.time() - step_start
            logger.error(f"❌ Orchestration FAILED: {e}")

            self.step_results.append(PipelineStepResult(
                step_name="orchestration",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))

            # FAIL-FAST: Re-raise
            raise RuntimeError(f"Step 2 (Orchestration) failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3: DIAGRAM CLASSIFICATION
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_3_classification(
        self,
        workspace_path: Path
    ):
        """Execute Step 3: Diagram classification.

        FAIL-FAST: Throws exception if classification fails.

        Returns:
            DiagramClassificationResult
        """
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 3: DIAGRAM CLASSIFICATION")
        logger.info("=" * 60)
        logger.debug(f"   Workspace: {workspace_path}")

        from .agents.diagram_classifier_agent import run_diagram_classifier

        try:
            classification_result = await run_diagram_classifier(
                workspace_path=workspace_path
            )

            duration = time.time() - step_start

            # Log tool distribution
            tool_counts = {}
            for c in classification_result.classifications:
                tool_counts[c.tool] = tool_counts.get(c.tool, 0) + 1

            logger.info(f"✅ Classification complete")
            logger.info(f"   Total questions: {classification_result.total_questions}")
            logger.info(f"   Questions needing diagrams: {classification_result.questions_needing_diagrams}")
            logger.info(f"   Questions without diagrams: {classification_result.questions_no_diagram}")
            logger.info(f"   Duration: {duration:.2f}s")
            logger.info("   Tool distribution:")
            for tool, count in sorted(tool_counts.items()):
                logger.info(f"      {tool}: {count}")

            self.step_results.append(PipelineStepResult(
                step_name="classification",
                success=True,
                duration_seconds=duration,
                details={
                    "total_questions": classification_result.total_questions,
                    "questions_needing_diagrams": classification_result.questions_needing_diagrams,
                    "tool_distribution": tool_counts
                }
            ))

            return classification_result

        except Exception as e:
            duration = time.time() - step_start
            logger.error(f"❌ Classification FAILED: {e}")

            self.step_results.append(PipelineStepResult(
                step_name="classification",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))

            # FAIL-FAST: Re-raise
            raise RuntimeError(f"Step 3 (Classification) failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 4: DIAGRAM AUTHORING
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_4_diagram_authoring(
        self,
        workspace_path: Path
    ):
        """Execute Step 4: Diagram authoring.

        FAIL-FAST: Throws exception if ANY diagram fails to generate.
        This ensures complete quality - no partial results.

        Returns:
            DiagramAuthorResult
        """
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 4: DIAGRAM AUTHORING")
        logger.info("=" * 60)
        logger.debug(f"   Workspace: {workspace_path}")

        from .agents.diagram_author_agent import run_diagram_author

        try:
            diagram_result = await run_diagram_author(
                workspace_path=workspace_path
            )

            duration = time.time() - step_start

            # FAIL-FAST: Check for ANY diagram failures
            if diagram_result.failed_diagrams > 0:
                # Log details of failed diagrams
                failed_details = []
                for d in diagram_result.diagrams:
                    if not d.success:
                        failed_details.append(f"Q{d.question_number} ({d.tool}): {d.error}")

                raise RuntimeError(
                    f"Diagram authoring failed: {diagram_result.failed_diagrams} diagram(s) failed. "
                    f"Details: {'; '.join(failed_details)}"
                )

            logger.info(f"✅ Diagram authoring complete")
            logger.info(f"   Total diagrams: {diagram_result.total_diagrams}")
            logger.info(f"   Successful: {diagram_result.successful_diagrams}")
            logger.info(f"   Failed: {diagram_result.failed_diagrams}")
            logger.info(f"   Total iterations: {diagram_result.total_iterations}")
            logger.info(f"   Duration: {duration:.2f}s")
            logger.debug(f"   Manifest: {diagram_result.manifest_path}")

            self.step_results.append(PipelineStepResult(
                step_name="diagram_authoring",
                success=True,
                duration_seconds=duration,
                details={
                    "total_diagrams": diagram_result.total_diagrams,
                    "successful_diagrams": diagram_result.successful_diagrams,
                    "total_iterations": diagram_result.total_iterations,
                    "manifest_path": diagram_result.manifest_path
                }
            ))

            return diagram_result

        except Exception as e:
            duration = time.time() - step_start
            logger.error(f"❌ Diagram authoring FAILED: {e}")

            self.step_results.append(PipelineStepResult(
                step_name="diagram_authoring",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))

            # FAIL-FAST: Re-raise
            raise RuntimeError(f"Step 4 (Diagram Authoring) failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 5: UPSERT TO APPWRITE
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_5_upsert(
        self,
        workspace_path: Path,
        courseId: str,
        version: str,
        force: bool
    ) -> str:
        """Execute Step 5: Upsert to Appwrite.

        FAIL-FAST: Throws exception if upsert fails.

        Returns:
            Appwrite document ID
        """
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 5: UPSERT TO APPWRITE")
        logger.info("=" * 60)
        logger.debug(f"   Workspace: {workspace_path}")
        logger.debug(f"   Course ID: {courseId}")
        logger.debug(f"   Version: {version}")
        logger.debug(f"   Force: {force}")

        from .utils.mock_exam_upserter import upsert_mock_exam_to_appwrite

        mock_exam_file = workspace_path / "mock_exam.json"

        try:
            document_id = await upsert_mock_exam_to_appwrite(
                mock_exam_file_path=str(mock_exam_file),
                courseId=courseId,
                version=version,
                mcp_config_path=str(self.mcp_config_path),
                force=force
            )

            duration = time.time() - step_start

            logger.info(f"✅ Appwrite upsert complete")
            logger.info(f"   Document ID: {document_id}")
            logger.info(f"   Collection: default.mock_exams")
            logger.info(f"   Duration: {duration:.2f}s")

            self.step_results.append(PipelineStepResult(
                step_name="upsert",
                success=True,
                duration_seconds=duration,
                details={
                    "document_id": document_id,
                    "collection": "mock_exams",
                    "force_mode": force
                }
            ))

            return document_id

        except Exception as e:
            duration = time.time() - step_start
            logger.error(f"❌ Appwrite upsert FAILED: {e}")

            self.step_results.append(PipelineStepResult(
                step_name="upsert",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))

            # FAIL-FAST: Re-raise
            raise RuntimeError(f"Step 5 (Upsert) failed: {e}") from e


async def main():
    """Test the v2 agent with full pipeline execution."""
    agent = MockExamAuthorClaudeAgentV2(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="DEBUG"  # Maximum verbosity
    )

    try:
        result = await agent.execute(
            courseId="course_c84473",
            version="1",
            dry_run=True  # Set to False to actually upsert to Appwrite
        )

        print(f"\n{'=' * 80}")
        print("PIPELINE EXECUTION RESULT")
        print("=" * 80)

        if result["success"]:
            print(f"✅ SUCCESS")
            print(f"   Execution ID: {result['execution_id']}")
            print(f"   Workspace: {result['workspace_path']}")
            print(f"   Mock Exam ID: {result['mock_exam_id']}")
            print(f"   Appwrite Document: {result.get('appwrite_document_id', 'N/A')}")
            print(f"\nPipeline Metrics:")
            metrics = result['pipeline_metrics']
            print(f"   Total Duration: {metrics['total_duration_seconds']:.2f}s")
            print(f"   Total Messages: {metrics['total_messages']}")
            print(f"\nDiagram Metrics:")
            diagrams = result['diagram_metrics']
            print(f"   Questions Classified: {diagrams['questions_classified']}")
            print(f"   Questions Needing Diagrams: {diagrams['questions_needing_diagrams']}")
            print(f"   Diagrams Generated: {diagrams['diagrams_generated']}")
            print(f"   Diagrams Failed: {diagrams['diagrams_failed']}")
        else:
            print(f"❌ FAILED: {result.get('error', 'Unknown error')}")

        print("=" * 80)

    except RuntimeError as e:
        print(f"\n❌ PIPELINE FAILED (FAIL-FAST): {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
