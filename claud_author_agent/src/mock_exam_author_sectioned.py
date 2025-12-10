"""Mock Exam Author - Section-Based Pipeline.

Alternative implementation using section-by-section generation for better scaling.
Keeps the original monolithic mock_exam_author_claude_client_v2.py intact.

Key Differences from v2:
- Generates sections independently (optionally in parallel)
- Smaller structured outputs (~2-3K tokens per section vs ~9K+)
- Section-level error recovery (failed section doesn't invalidate others)
- Section-level revision (only regenerate failed sections)

Pipeline Architecture:
    Step 1: PRE-PROCESSING (Python) - Same as v2
    Step 2: SECTION-BASED AUTHOR-CRITIC LOOP
        - Generate sections (parallel or sequential)
        - Merge into complete exam
        - Critic evaluates full exam
        - Section-level revision if needed
    Step 3: DIAGRAM CLASSIFICATION - Same as v2
    Step 4: DIAGRAM AUTHORING - Same as v2
    Step 5: UPSERT TO APPWRITE - Same as v2
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

# Set maximum output token limit
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


class MockExamAuthorSectioned:
    """Section-based mock exam authoring pipeline.

    Alternative to MockExamAuthorClaudeAgentV2 that uses section-by-section
    generation for better scaling with large exams.
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "DEBUG",
        parallel_sections: bool = True
    ):
        """Initialize Mock Exam Author (Sectioned).

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            log_level: Logging level
            parallel_sections: If True, generate sections in parallel
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.log_level = log_level
        self.parallel_sections = parallel_sections

        # Generate execution ID
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_sectioned"

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging
        setup_logging(log_level=log_level)

        # Track step results
        self.step_results: List[PipelineStepResult] = []

        logger.info("=" * 80)
        logger.info("MOCK EXAM AUTHOR PIPELINE (SECTIONED) - INITIALIZED")
        logger.info(f"   Execution ID: {self.execution_id}")
        logger.info(f"   Log Level: {log_level}")
        logger.info(f"   Parallel Sections: {parallel_sections}")
        logger.info("=" * 80)

    async def execute(
        self,
        courseId: str,
        version: str = "1",
        force: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Execute the section-based mock exam authoring pipeline.

        Args:
            courseId: Course identifier
            version: Mock exam version number
            force: If True, overwrite existing mock exam
            dry_run: If True, generate but don't upsert to Appwrite

        Returns:
            Dictionary with success status and metrics

        Raises:
            RuntimeError: If any pipeline step fails
        """
        pipeline_start = time.time()

        logger.info("\n" + "=" * 80)
        logger.info("MOCK EXAM AUTHOR (SECTIONED) - STARTING PIPELINE")
        logger.info("=" * 80)
        logger.info(f"   courseId: {courseId}")
        logger.info(f"   version: {version}")
        logger.info(f"   parallel_sections: {self.parallel_sections}")
        logger.info(f"   execution_id: {self.execution_id}")
        logger.info("=" * 80)

        workspace_path = None

        try:
            # ═══════════════════════════════════════════════════════════════
            # STEP 1: PRE-PROCESSING (same as v2)
            # ═══════════════════════════════════════════════════════════════
            workspace_path, preprocessing_result = await self._execute_step_1_preprocessing(
                courseId=courseId
            )

            # ═══════════════════════════════════════════════════════════════
            # STEP 2: SECTION-BASED AUTHOR-CRITIC LOOP
            # ═══════════════════════════════════════════════════════════════
            mock_exam, critic_result, orchestration_result = await self._execute_step_2_section_orchestration(
                workspace_path=workspace_path
            )

            mock_exam_id = mock_exam.examId

            # ═══════════════════════════════════════════════════════════════
            # STEP 3: DIAGRAM CLASSIFICATION (same as v2)
            # ═══════════════════════════════════════════════════════════════
            classification_result = await self._execute_step_3_classification(
                workspace_path=workspace_path
            )

            questions_needing_diagrams = classification_result.questions_needing_diagrams

            # ═══════════════════════════════════════════════════════════════
            # STEP 4: DIAGRAM AUTHORING (same as v2)
            # ═══════════════════════════════════════════════════════════════
            diagrams_generated = 0
            diagrams_failed = 0

            if questions_needing_diagrams > 0:
                diagram_result = await self._execute_step_4_diagram_authoring(
                    workspace_path=workspace_path
                )
                diagrams_generated = diagram_result.successful_diagrams
                diagrams_failed = diagram_result.failed_diagrams
            else:
                logger.info("STEP 4: DIAGRAM AUTHORING (SKIPPED)")
                self.step_results.append(PipelineStepResult(
                    step_name="diagram_authoring",
                    success=True,
                    duration_seconds=0.0,
                    details={"skipped": True}
                ))

            # ═══════════════════════════════════════════════════════════════
            # STEP 5: UPSERT TO APPWRITE (same as v2)
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
                logger.info("STEP 5: UPSERT TO APPWRITE (DRY RUN - SKIPPED)")
                self.step_results.append(PipelineStepResult(
                    step_name="upsert",
                    success=True,
                    duration_seconds=0.0,
                    details={"skipped": True, "reason": "dry_run"}
                ))

            # ═══════════════════════════════════════════════════════════════
            # PIPELINE COMPLETE
            # ═══════════════════════════════════════════════════════════════
            pipeline_duration = time.time() - pipeline_start
            total_messages = sum(r.message_count for r in self.step_results)

            logger.info("\n" + "=" * 80)
            logger.info("✅ SECTIONED PIPELINE COMPLETE - SUCCESS")
            logger.info("=" * 80)
            logger.info(f"   Execution ID: {self.execution_id}")
            logger.info(f"   Duration: {pipeline_duration:.2f}s")
            logger.info(f"   Sections Generated: {orchestration_result.sections_generated}")
            logger.info(f"   Parallel: {orchestration_result.parallel_generation}")
            logger.info(f"   Questions: {mock_exam.summary.total_questions}")
            logger.info("=" * 80)

            if workspace_path:
                remove_workspace_file_handler(workspace_path)

            return {
                "success": True,
                "execution_id": self.execution_id,
                "workspace_path": str(workspace_path),
                "mock_exam_id": mock_exam_id,
                "appwrite_document_id": appwrite_document_id,
                "pipeline_type": "sectioned",
                "pipeline_metrics": {
                    "total_duration_seconds": pipeline_duration,
                    "total_messages": total_messages,
                    "sections_generated": orchestration_result.sections_generated,
                    "parallel_generation": orchestration_result.parallel_generation,
                    "steps": [
                        {
                            "name": r.step_name,
                            "success": r.success,
                            "duration_seconds": r.duration_seconds,
                            "message_count": r.message_count
                        }
                        for r in self.step_results
                    ]
                },
                "diagram_metrics": {
                    "questions_classified": classification_result.total_questions,
                    "questions_needing_diagrams": questions_needing_diagrams,
                    "diagrams_generated": diagrams_generated,
                    "diagrams_failed": diagrams_failed
                }
            }

        except Exception as e:
            pipeline_duration = time.time() - pipeline_start

            logger.error("\n" + "=" * 80)
            logger.error("❌ SECTIONED PIPELINE FAILED")
            logger.error("=" * 80)
            logger.error(f"   Error: {e}")
            logger.exception("Full traceback:")

            if workspace_path:
                try:
                    remove_workspace_file_handler(workspace_path)
                except Exception:
                    pass

            raise RuntimeError(f"Sectioned pipeline failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: PRE-PROCESSING (same as v2)
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_1_preprocessing(self, courseId: str) -> tuple:
        """Execute Step 1: Pre-processing."""
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 1: PRE-PROCESSING")
        logger.info("=" * 60)

        from .agents.preprocessing import run_preprocessing

        try:
            preprocessing_result = await run_preprocessing(
                courseId=courseId,
                mcp_config_path=str(self.mcp_config_path),
                persist_workspace=self.persist_workspace,
                verify_diagram_services=True,
                execution_id=self.execution_id
            )

            workspace_path = preprocessing_result.workspace_path
            duration = time.time() - step_start

            logger.info(f"✅ Pre-processing complete")
            logger.info(f"   Workspace: {workspace_path}")

            self.step_results.append(PipelineStepResult(
                step_name="preprocessing",
                success=True,
                duration_seconds=duration,
                details={"workspace_path": str(workspace_path)}
            ))

            return workspace_path, preprocessing_result

        except Exception as e:
            duration = time.time() - step_start
            self.step_results.append(PipelineStepResult(
                step_name="preprocessing",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))
            raise RuntimeError(f"Step 1 (Preprocessing) failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: SECTION-BASED ORCHESTRATION (NEW)
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_2_section_orchestration(self, workspace_path: Path) -> tuple:
        """Execute Step 2: Section-based author-critic loop."""
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: SECTION-BASED AUTHOR-CRITIC LOOP")
        logger.info("=" * 60)
        logger.info(f"   Parallel: {self.parallel_sections}")

        from .agents.section_based_orchestrator import run_section_based_orchestrator

        try:
            orchestration_result = await run_section_based_orchestrator(
                workspace_path=workspace_path,
                max_iterations=3,
                parallel=self.parallel_sections
            )

            duration = time.time() - step_start

            if not orchestration_result.success:
                raise RuntimeError(
                    f"Section orchestration failed after {orchestration_result.iterations_completed} iterations"
                )

            mock_exam = orchestration_result.final_mock_exam
            critic_result = orchestration_result.final_critic_result

            logger.info(f"✅ Section orchestration complete")
            logger.info(f"   Sections: {orchestration_result.sections_generated}")
            logger.info(f"   Iterations: {orchestration_result.iterations_completed}")
            logger.info(f"   Critic score: {critic_result.overall_score:.2f}/5.0")

            self.step_results.append(PipelineStepResult(
                step_name="section_orchestration",
                success=True,
                duration_seconds=duration,
                message_count=orchestration_result.total_message_count,
                details={
                    "sections": orchestration_result.sections_generated,
                    "iterations": orchestration_result.iterations_completed,
                    "parallel": orchestration_result.parallel_generation,
                    "critic_score": critic_result.overall_score
                }
            ))

            return mock_exam, critic_result, orchestration_result

        except Exception as e:
            duration = time.time() - step_start
            self.step_results.append(PipelineStepResult(
                step_name="section_orchestration",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))
            raise RuntimeError(f"Step 2 (Section Orchestration) failed: {e}") from e

    # ═══════════════════════════════════════════════════════════════════════
    # STEPS 3-5: Same as v2 (import from v2 or duplicate)
    # ═══════════════════════════════════════════════════════════════════════

    async def _execute_step_3_classification(self, workspace_path: Path):
        """Execute Step 3: Diagram classification."""
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 3: DIAGRAM CLASSIFICATION")
        logger.info("=" * 60)

        from .agents.diagram_classifier_agent import run_diagram_classifier

        try:
            classification_result = await run_diagram_classifier(
                workspace_path=workspace_path
            )

            duration = time.time() - step_start

            logger.info(f"✅ Classification complete")
            logger.info(f"   Questions needing diagrams: {classification_result.questions_needing_diagrams}")

            self.step_results.append(PipelineStepResult(
                step_name="classification",
                success=True,
                duration_seconds=duration,
                details={
                    "total_questions": classification_result.total_questions,
                    "questions_needing_diagrams": classification_result.questions_needing_diagrams
                }
            ))

            return classification_result

        except Exception as e:
            duration = time.time() - step_start
            self.step_results.append(PipelineStepResult(
                step_name="classification",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))
            raise RuntimeError(f"Step 3 (Classification) failed: {e}") from e

    async def _execute_step_4_diagram_authoring(self, workspace_path: Path):
        """Execute Step 4: Diagram authoring."""
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 4: DIAGRAM AUTHORING")
        logger.info("=" * 60)

        from .agents.diagram_author_agent import run_diagram_author

        try:
            diagram_result = await run_diagram_author(
                workspace_path=workspace_path
            )

            duration = time.time() - step_start

            if diagram_result.failed_diagrams > 0:
                raise RuntimeError(
                    f"Diagram authoring failed: {diagram_result.failed_diagrams} diagrams failed"
                )

            logger.info(f"✅ Diagram authoring complete")
            logger.info(f"   Diagrams generated: {diagram_result.successful_diagrams}")

            self.step_results.append(PipelineStepResult(
                step_name="diagram_authoring",
                success=True,
                duration_seconds=duration,
                details={
                    "total_diagrams": diagram_result.total_diagrams,
                    "successful_diagrams": diagram_result.successful_diagrams
                }
            ))

            return diagram_result

        except Exception as e:
            duration = time.time() - step_start
            self.step_results.append(PipelineStepResult(
                step_name="diagram_authoring",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))
            raise RuntimeError(f"Step 4 (Diagram Authoring) failed: {e}") from e

    async def _execute_step_5_upsert(
        self,
        workspace_path: Path,
        courseId: str,
        version: str,
        force: bool
    ) -> str:
        """Execute Step 5: Upsert to Appwrite."""
        step_start = time.time()

        logger.info("\n" + "=" * 60)
        logger.info("STEP 5: UPSERT TO APPWRITE")
        logger.info("=" * 60)

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

            self.step_results.append(PipelineStepResult(
                step_name="upsert",
                success=True,
                duration_seconds=duration,
                details={"document_id": document_id}
            ))

            return document_id

        except Exception as e:
            duration = time.time() - step_start
            self.step_results.append(PipelineStepResult(
                step_name="upsert",
                success=False,
                duration_seconds=duration,
                error=str(e)
            ))
            raise RuntimeError(f"Step 5 (Upsert) failed: {e}") from e


async def main():
    """Test the sectioned pipeline."""
    agent = MockExamAuthorSectioned(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="DEBUG",
        parallel_sections=True
    )

    try:
        result = await agent.execute(
            courseId="course_c74774",
            version="1",
            dry_run=True
        )

        print(f"\n{'=' * 80}")
        print("SECTIONED PIPELINE RESULT")
        print("=" * 80)

        if result["success"]:
            print(f"✅ SUCCESS")
            print(f"   Execution ID: {result['execution_id']}")
            print(f"   Workspace: {result['workspace_path']}")
            print(f"   Mock Exam ID: {result['mock_exam_id']}")
            metrics = result['pipeline_metrics']
            print(f"   Duration: {metrics['total_duration_seconds']:.2f}s")
            print(f"   Sections: {metrics['sections_generated']}")
            print(f"   Parallel: {metrics['parallel_generation']}")

    except RuntimeError as e:
        print(f"\n❌ PIPELINE FAILED: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
