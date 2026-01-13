"""Walkthrough Author Claude Agent implementation.

Orchestrates a 3-subagent pipeline to generate examiner-aligned walkthroughs
for SQA past paper questions from us_papers marking schemes to us_walkthroughs.
"""

import asyncio
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging
from .utils.paper_extractor import (
    extract_question_with_solution,
    parse_question_number,
)
from .utils.course_mapper import (
    get_course_id_for_paper,
    is_v2_pilot_paper,
)
from .utils.lesson_linker import build_prerequisite_links
from pydantic import ValidationError as PydanticValidationError
from .models.walkthrough_models import (
    WalkthroughDocument,
    QuestionWalkthrough,
    WalkthroughStep,
    CommonError,
    ErrorType,
    # Metadata models for observability/resume/debug
    ExecutionManifest,
    ExecutionLog,
    ExecutionStage,
    ExecutionTotals,
    FinalResult,
    InputContext,
    QuestionContext,
    SourceExtraction,
    AgentConfig,
    BatchContext,
    CommandContext,
    OutputMetrics,
    QualityMetrics,
    ExecutionMetrics,
    StageResult,
    StageTokens,
    ExecutionStatus,
    StageStatus,
    # File constants
    EXECUTION_MANIFEST_FILE,
    EXECUTION_LOG_FILE,
    FINAL_RESULT_FILE,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Helper Functions
# =============================================================================

def extract_question_source(
    paper_data: Dict[str, Any],
    question_number: str
) -> Optional[Dict[str, Any]]:
    """Extract question and solution data for walkthrough authoring.

    Wrapper around extract_question_with_solution that formats data
    for the walkthrough authoring pipeline.

    Args:
        paper_data: Parsed paper data from us_papers.data field
        question_number: Question number to extract

    Returns:
        Dictionary with question, solution, parent_context or None if not found
    """
    return extract_question_with_solution(paper_data, question_number)


def generate_blank_walkthrough_template(
    question_source: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate a blank walkthrough template pre-populated with source data.

    Creates the template structure that the walkthrough author agent
    will fill in using the Edit tool.

    Args:
        question_source: Extracted question source data

    Returns:
        Blank template dictionary ready for agent editing
    """
    question = question_source["question"]
    solution = question_source["solution"]

    return {
        "question_stem": question.get("text", ""),
        "question_stem_latex": question.get("text_latex", ""),
        "topic_tags": question.get("topic_tags", []),
        "total_marks": solution.get("max_marks", 0),
        "steps": [],  # To be filled by agent
        "common_errors": [],  # To be filled by errors subagent
        "examiner_summary": "",  # To be filled by agent
        "diagram_refs": [d.get("id", "") for d in question.get("diagrams", [])]
    }


def build_walkthrough_author_prompt(
    subject: str,
    level: str,
    year: int,
    paper_code: str,
    question_number: str,
    total_marks: int
) -> str:
    """Build the initial prompt for the walkthrough author pipeline.

    Args:
        subject: Subject name
        level: Level name
        year: Exam year
        paper_code: Paper code
        question_number: Question number
        total_marks: Total marks for the question

    Returns:
        Formatted prompt string for the agent
    """
    prompts_dir = Path(__file__).parent / "prompts"
    base_prompt = (prompts_dir / "walkthrough_author_prompt.md").read_text()

    # Replace template variables
    prompt = base_prompt.replace("{{subject}}", subject)
    prompt = prompt.replace("{{level}}", level)
    prompt = prompt.replace("{{year}}", str(year))
    prompt = prompt.replace("{{paper_code}}", paper_code)
    prompt = prompt.replace("{{question_number}}", question_number)
    prompt = prompt.replace("{{total_marks}}", str(total_marks))

    return prompt


def validate_walkthrough_output(
    template: Dict[str, Any],
    source: Dict[str, Any]
) -> Tuple[bool, List[str]]:
    """Validate generated walkthrough against marking scheme.

    Args:
        template: Generated walkthrough template
        source: Original question source with marking scheme

    Returns:
        Tuple of (is_valid, list of error messages)
    """
    errors = []
    generic_scheme = source.get("solution", {}).get("generic_scheme", [])

    # Check step count matches bullets
    expected_steps = len(generic_scheme)
    actual_steps = len(template.get("steps", []))
    if actual_steps != expected_steps:
        errors.append(
            f"Step count mismatch: expected {expected_steps} steps "
            f"(from generic_scheme), got {actual_steps}"
        )

    # Check marks sum
    total_marks = template.get("total_marks", 0)
    marks_sum = sum(s.get("marks_earned", 0) for s in template.get("steps", []))
    if marks_sum != total_marks:
        errors.append(
            f"Marks sum mismatch: steps total {marks_sum} "
            f"but total_marks is {total_marks}"
        )

    # Check bullet sequence
    bullets = [s.get("bullet") for s in template.get("steps", [])]
    expected_bullets = list(range(1, expected_steps + 1))
    if bullets != expected_bullets:
        errors.append(
            f"Bullet sequence incorrect: expected {expected_bullets}, "
            f"got {bullets}"
        )

    is_valid = len(errors) == 0
    return is_valid, errors


# =============================================================================
# Main Agent Class
# =============================================================================

class WalkthroughAuthorClaudeAgent:
    """Autonomous walkthrough authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    1. Paper Fetcher → Fetch paper document from us_papers
    2. Question Extractor → Extract question + solution from paper.data
    3. Template Generator → Create blank walkthrough_template.json

    Pipeline execution (3 subagents):
    4. Walkthrough Author → Generate step-by-step walkthrough
    5. Common Errors Subagent → Add realistic common errors
    6. Walkthrough Critic → Validate alignment and quality

    Post-processing (Python):
    7. Walkthrough Upserter → Write to us_walkthroughs collection

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        max_critic_retries: Maximum attempts for critic validation loop
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        max_critic_retries: int = 3,
        log_level: str = "INFO"
    ):
        """Initialize Walkthrough Author agent.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            max_critic_retries: Maximum attempts for critic validation
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.max_critic_retries = max_critic_retries

        # Generate execution ID (timestamp-based)
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging
        setup_logging(log_level=log_level)

        logger.info(f"Initialized WalkthroughAuthorClaudeAgent - Execution ID: {self.execution_id}")

    # =========================================================================
    # Metadata File Writers (Observability/Resume/Debug)
    # =========================================================================

    def _get_cli_invocation(
        self,
        paper_id: str,
        question_number: str,
        batch_context: Optional[Dict[str, Any]] = None
    ) -> CommandContext:
        """Reconstruct CLI invocation for debugging/resume.

        Args:
            paper_id: Paper document ID
            question_number: Question number
            batch_context: Optional batch context

        Returns:
            CommandContext with invocation details
        """
        cli_args = {
            "paper_id": paper_id,
            "question": question_number,
            "mcp_config": str(self.mcp_config_path),
            "persist_workspace": self.persist_workspace,
            "max_critic_retries": self.max_critic_retries,
        }

        if batch_context:
            invocation = f"python -m src.batch_walkthrough_generator --batch-id {batch_context.get('batch_id', 'unknown')}"
        else:
            invocation = f"python -m src.walkthrough_author_claude_client --paper-id {paper_id} --question {question_number}"

        return CommandContext(
            invocation=invocation,
            cli_args=cli_args,
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        )

    def _write_execution_manifest(
        self,
        workspace_path: Path,
        paper_id: str,
        question_number: str,
        paper_metadata: Dict[str, Any],
        question_source: Dict[str, Any],
        batch_context: Optional[Dict[str, Any]] = None,
        use_v2: bool = False
    ) -> None:
        """Write execution manifest at START of pre-processing.

        Args:
            workspace_path: Path to workspace
            paper_id: Paper document ID
            question_number: Question number
            paper_metadata: Paper metadata
            question_source: Extracted question source
            batch_context: Optional batch context for nested workspaces
            use_v2: If True, using V2 pedagogical prompts
        """
        solution = question_source.get("solution", {})
        question = question_source.get("question", {})

        manifest = ExecutionManifest(
            execution_id=self.execution_id,
            created_at=datetime.now().isoformat(),
            workspace_path=str(workspace_path),
            input=InputContext(
                paper_id=paper_id,
                question_number=question_number,
                paper_code=paper_metadata.get("paper_code", ""),
                year=paper_metadata.get("year", 0),
                subject=paper_metadata.get("subject", ""),
                level=paper_metadata.get("level", "")
            ),
            question_context=QuestionContext(
                marks=solution.get("max_marks", 0),
                topic_tags=question.get("topic_tags", []),
                has_diagrams=len(question.get("diagrams", [])) > 0,
                is_sub_question="(" in question_number or len(question_number) > 2,
                parent_question=question_number[0] if len(question_number) > 1 else None
            ),
            source_extraction=SourceExtraction(
                generic_scheme_bullets=len(solution.get("generic_scheme", [])),
                illustrative_scheme_bullets=len(solution.get("illustrative_scheme", [])),
                solution_notes_count=len(solution.get("notes", [])),
                extraction_warnings=[]
            ),
            agent_config=AgentConfig(
                model="claude-sonnet-4-5",
                max_critic_retries=self.max_critic_retries,
                prompt_versions={
                    "walkthrough_author": "v2.0" if use_v2 else "v1.0",
                    "common_errors_subagent": "v2.0" if use_v2 else "v1.0",
                    "walkthrough_critic": "v2.0" if use_v2 else "v1.0"
                }
            ),
            batch_context=BatchContext(**batch_context) if batch_context else None,
            command=self._get_cli_invocation(paper_id, question_number, batch_context)
        )

        manifest_path = workspace_path / EXECUTION_MANIFEST_FILE
        with open(manifest_path, 'w') as f:
            f.write(manifest.model_dump_json(indent=2))
        logger.info(f"✅ {EXECUTION_MANIFEST_FILE} written at: {manifest_path}")

    def _init_execution_log(self, workspace_path: Path) -> None:
        """Initialize execution log at START.

        Args:
            workspace_path: Path to workspace
        """
        execution_log = ExecutionLog(
            execution_id=self.execution_id,
            status=ExecutionStatus.IN_PROGRESS,
            started_at=datetime.now().isoformat(),
            stages=[]
        )

        log_path = workspace_path / EXECUTION_LOG_FILE
        with open(log_path, 'w') as f:
            f.write(execution_log.model_dump_json(indent=2))
        logger.debug(f"Execution log initialized at: {log_path}")

    def _update_execution_log(
        self,
        workspace_path: Path,
        stage_name: str,
        status: StageStatus,
        started_at: str,
        completed_at: Optional[str] = None,
        duration_ms: Optional[int] = None,
        tokens: Optional[Dict[str, int]] = None,
        result: Optional[Dict[str, Any]] = None,
        files_created: Optional[List[str]] = None,
        error_message: Optional[str] = None
    ) -> None:
        """Update execution log with stage progress.

        Args:
            workspace_path: Path to workspace
            stage_name: Name of the stage
            status: Stage status
            started_at: ISO timestamp when stage started
            completed_at: ISO timestamp when stage completed
            duration_ms: Duration in milliseconds
            tokens: Token usage dict with input/output
            result: Stage result data
            files_created: List of files created by this stage
            error_message: Error message if failed
        """
        log_path = workspace_path / EXECUTION_LOG_FILE

        # Read existing log
        with open(log_path, 'r') as f:
            log_data = json.load(f)

        # Build stage entry
        stage_tokens = None
        if tokens:
            stage_tokens = StageTokens(
                input=tokens.get("input", 0),
                output=tokens.get("output", 0)
            )

        stage_result = None
        if result:
            stage_result = StageResult(**result)

        stage = ExecutionStage(
            stage=stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            tokens=stage_tokens,
            result=stage_result,
            files_created=files_created,
            error_message=error_message
        )

        # Append stage
        log_data["stages"].append(json.loads(stage.model_dump_json()))

        # Update status if failed
        if status == StageStatus.FAILED:
            log_data["status"] = ExecutionStatus.FAILED.value

        # Write back
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        logger.debug(f"Execution log updated: {stage_name} -> {status.value}")

    def _finalize_execution_log(
        self,
        workspace_path: Path,
        status: ExecutionStatus,
        totals: Dict[str, Any]
    ) -> None:
        """Finalize execution log at END.

        Args:
            workspace_path: Path to workspace
            status: Final execution status
            totals: Token/cost totals
        """
        log_path = workspace_path / EXECUTION_LOG_FILE

        with open(log_path, 'r') as f:
            log_data = json.load(f)

        log_data["status"] = status.value
        log_data["completed_at"] = datetime.now().isoformat()

        # Calculate duration
        started = datetime.fromisoformat(log_data["started_at"])
        completed = datetime.now()
        log_data["duration_seconds"] = (completed - started).total_seconds()

        log_data["totals"] = totals

        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        logger.info(f"✅ {EXECUTION_LOG_FILE} finalized")

    def _write_final_result(
        self,
        workspace_path: Path,
        success: bool,
        doc_id: Optional[str] = None,
        steps_count: int = 0,
        errors_count: int = 0,
        total_marks: int = 0,
        critic_passed: bool = False,
        critic_attempts: int = 0,
        critic_scores: Optional[Dict[str, float]] = None,
        error_message: Optional[str] = None,
        error_type: Optional[str] = None
    ) -> None:
        """Write final result at END of pipeline.

        Args:
            workspace_path: Path to workspace
            success: Whether execution succeeded
            doc_id: Appwrite document ID if successful
            steps_count: Number of steps generated
            errors_count: Number of common errors generated
            total_marks: Total marks for question
            critic_passed: Whether critic validation passed
            critic_attempts: Number of critic attempts
            critic_scores: Dimensional scores from critic
            error_message: Error message if failed
            error_type: Error type if failed
        """
        metrics = self.cost_tracker.get_summary()

        final_result = FinalResult(
            execution_id=self.execution_id,
            success=success,
            completed_at=datetime.now().isoformat(),
            output=OutputMetrics(
                appwrite_document_id=doc_id,
                steps_count=steps_count,
                errors_count=errors_count,
                total_marks=total_marks
            ),
            quality=QualityMetrics(
                critic_passed=critic_passed,
                critic_attempts=critic_attempts,
                final_scores=critic_scores or {}
            ),
            metrics=ExecutionMetrics(
                total_duration_seconds=metrics.get("total_duration_seconds", 0),
                total_tokens=metrics.get("total_tokens", 0),
                estimated_cost_usd=metrics.get("total_cost_usd", 0)
            ),
            error_message=error_message,
            error_type=error_type
        )

        result_path = workspace_path / FINAL_RESULT_FILE
        with open(result_path, 'w') as f:
            f.write(final_result.model_dump_json(indent=2))
        logger.info(f"✅ {FINAL_RESULT_FILE} written at: {result_path}")

    # =========================================================================
    # Core Agent Methods
    # =========================================================================

    def _get_subagent_definitions(self, use_v2: bool = False) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Args:
            use_v2: If True, load V2 pedagogical prompts (concept-first, peer explainer)

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Note:
            3 subagents: walkthrough_author, common_errors_subagent, walkthrough_critic
        """
        prompts_dir = Path(__file__).parent / "prompts"

        if use_v2:
            # V2 prompts: pedagogically enhanced with concept explanations
            walkthrough_prompt = prompts_dir / "walkthrough_author_prompt_v2.md"
            errors_prompt = prompts_dir / "common_errors_subagent_v2.md"
            critic_prompt = prompts_dir / "walkthrough_critic_prompt_v2.md"
            logger.info("🎓 Using V2 pedagogical prompts (concept-first, peer explainer)")
        else:
            # V1 prompts: original examiner-focused
            walkthrough_prompt = prompts_dir / "walkthrough_author_prompt.md"
            errors_prompt = prompts_dir / "common_errors_subagent.md"
            critic_prompt = prompts_dir / "walkthrough_critic_prompt.md"
            logger.info("📋 Using V1 standard prompts")

        subagents = {
            "walkthrough_author": AgentDefinition(
                description="Walkthrough author for generating step-by-step solutions",
                prompt=walkthrough_prompt.read_text()
            ),
            "common_errors_subagent": AgentDefinition(
                description="Common errors subagent for identifying typical student mistakes",
                prompt=errors_prompt.read_text()
            ),
            "walkthrough_critic": AgentDefinition(
                description="Walkthrough critic for validating alignment and quality",
                prompt=critic_prompt.read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions (v{'2' if use_v2 else '1'})")
        return subagents

    def _validate_common_errors(
        self,
        workspace_path: Path
    ) -> Tuple[bool, List[str]]:
        """Validate common_errors against CommonError Pydantic schema.

        This validation runs AFTER the agent pipeline completes but BEFORE
        upserting to Appwrite, catching schema drift issues where the LLM
        generates fields with wrong names or invalid values.

        Args:
            workspace_path: Path to workspace containing walkthrough_template.json

        Returns:
            Tuple of (is_valid, list of validation error messages)
        """
        template_path = workspace_path / "walkthrough_template.json"

        if not template_path.exists():
            return False, ["walkthrough_template.json not found"]

        try:
            with open(template_path, 'r') as f:
                template = json.load(f)
        except json.JSONDecodeError as e:
            return False, [f"Invalid JSON in walkthrough_template.json: {e}"]

        errors = []
        common_errors = template.get("common_errors", [])

        if not common_errors:
            errors.append("common_errors array is empty")
            return False, errors

        # Get valid error types from the Literal type
        valid_error_types = list(ErrorType.__args__)

        for idx, error_data in enumerate(common_errors):
            try:
                # Attempt to validate against CommonError model
                CommonError.model_validate(error_data)
            except PydanticValidationError as e:
                # Format Pydantic errors into readable messages
                for pydantic_error in e.errors():
                    field = ".".join(str(loc) for loc in pydantic_error["loc"])
                    msg = pydantic_error["msg"]
                    error_type = pydantic_error["type"]

                    # Provide actionable error messages
                    if error_type == "missing":
                        errors.append(
                            f"Error {idx + 1}: Missing required field '{field}'. "
                            f"Expected fields: error_type, description, why_marks_lost, prevention_tip"
                        )
                    elif error_type == "string_too_short":
                        errors.append(
                            f"Error {idx + 1}: Field '{field}' is too short. {msg}"
                        )
                    elif error_type == "literal_error":
                        errors.append(
                            f"Error {idx + 1}: Invalid '{field}' value. "
                            f"Must be one of: {valid_error_types}"
                        )
                    else:
                        errors.append(f"Error {idx + 1}: {field} - {msg}")

            # Check for common schema drift issues (wrong field names)
            wrong_fields = []
            actual_fields = set(error_data.keys())

            # Detect fields that look like schema drift
            drift_mappings = {
                "error": "description",
                "error_description": "description",
                "explanation": "prevention_tip",
                "marking_impact": "why_marks_lost",
                "why_its_wrong": "prevention_tip",
                "bullet_reference": "why_marks_lost",
                "bullet_references": "why_marks_lost",
                "incorrect_answer": None,  # Not needed
                "correction": "prevention_tip",
                "example_or_explanation": "prevention_tip",
            }

            for wrong_field, correct_field in drift_mappings.items():
                if wrong_field in actual_fields:
                    if correct_field:
                        wrong_fields.append(f"'{wrong_field}' should be '{correct_field}'")
                    else:
                        wrong_fields.append(f"'{wrong_field}' is not a valid field")

            if wrong_fields:
                errors.append(
                    f"Error {idx + 1}: Schema drift detected - {', '.join(wrong_fields)}"
                )

        is_valid = len(errors) == 0
        if is_valid:
            logger.info(f"✅ common_errors validation passed ({len(common_errors)} errors)")
        else:
            logger.warning(f"❌ common_errors validation failed: {errors}")

        return is_valid, errors

    async def _run_common_errors_correction(
        self,
        workspace_path: Path,
        validation_errors: List[str],
        max_retries: int = 2
    ) -> Tuple[bool, List[str]]:
        """Run correction agent to fix common_errors schema issues.

        When the LLM generates common_errors with wrong field names or invalid
        values, this method sends a correction prompt to fix just the
        common_errors array in walkthrough_template.json.

        Args:
            workspace_path: Path to workspace
            validation_errors: List of validation error messages
            max_retries: Maximum correction attempts (default 2)

        Returns:
            Tuple of (success, remaining_errors)
        """
        # Load MCP config for correction agent
        mcp_config = {}
        if self.mcp_config_path.exists():
            with open(self.mcp_config_path, 'r') as f:
                mcp_config = json.load(f).get('mcpServers', {})

        # Get valid error types for the prompt
        valid_error_types = list(ErrorType.__args__)

        for attempt in range(1, max_retries + 1):
            logger.info(f"🔄 Running common_errors correction (attempt {attempt}/{max_retries})")

            correction_prompt = f"""## Common Errors Validation Failed

The common_errors array in walkthrough_template.json has validation errors:

{chr(10).join(f"- {err}" for err in validation_errors)}

## Required Schema

Each error in common_errors MUST use these EXACT field names:
- `error_type`: One of {valid_error_types}
- `description`: At least 10 characters describing what the student does wrong
- `why_marks_lost`: Reference specific bullets (e.g., "•1 lost", "•2 and •3 lost")
- `prevention_tip`: Actionable advice for avoiding the error

## FORBIDDEN field names (DO NOT USE):
- error → use description
- error_description → use description
- explanation → use prevention_tip
- marking_impact → use why_marks_lost
- why_its_wrong → use prevention_tip
- bullet_reference → use why_marks_lost
- bullet_references → use why_marks_lost

## Task

1. Read walkthrough_template.json
2. Fix ONLY the common_errors array to match the required schema
3. Update walkthrough_template.json with the corrected common_errors

Do NOT change any other fields in the template.
"""

            options = ClaudeAgentOptions(
                model='claude-sonnet-4-5',
                permission_mode='bypassPermissions',
                mcp_servers=mcp_config,
                allowed_tools=['Read', 'Write', 'Edit'],
                max_turns=20,
                cwd=str(workspace_path)
            )

            async with ClaudeSDKClient(options) as client:
                await client.query(correction_prompt)
                async for message in client.receive_messages():
                    if isinstance(message, ResultMessage):
                        # Record correction attempt metrics
                        usage = message.usage or {}
                        self.cost_tracker.record_subagent(
                            name=f"common_errors_correction_attempt_{attempt}",
                            input_tokens=usage.get('input_tokens', 0),
                            output_tokens=usage.get('output_tokens', 0),
                            cost=message.total_cost_usd or 0.0,
                            execution_time=(message.duration_ms or 0) / 1000.0,
                            success=not message.is_error,
                            error=""
                        )
                        break

            # Re-validate after correction
            is_valid, remaining_errors = self._validate_common_errors(workspace_path)

            if is_valid:
                logger.info(f"✅ common_errors correction succeeded on attempt {attempt}")
                return True, []

            logger.warning(f"Correction attempt {attempt} failed: {remaining_errors}")
            validation_errors = remaining_errors  # Update for next attempt

        logger.error(f"❌ common_errors correction failed after {max_retries} attempts")
        return False, validation_errors

    async def _fetch_paper(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Fetch paper document from us_papers collection.

        Args:
            paper_id: Paper document ID

        Returns:
            Paper document or None if not found
        """
        from .utils.paper_extractor import fetch_paper

        try:
            return await fetch_paper(paper_id, str(self.mcp_config_path))
        except NotImplementedError:
            # In tests, this will be mocked
            raise

    async def _run_agent_pipeline(
        self,
        workspace_path: Path,
        paper_metadata: Dict[str, Any],
        question_source: Dict[str, Any],
        use_v2: bool = False
    ) -> Dict[str, Any]:
        """Run the 3-subagent pipeline.

        Args:
            workspace_path: Path to isolated workspace
            paper_metadata: Paper metadata (subject, level, year, etc.)
            question_source: Extracted question and solution data
            use_v2: If True, use V2 pedagogical prompts

        Returns:
            Critic result dictionary with pass/fail status
        """
        # Load MCP config
        mcp_config = {}
        if self.mcp_config_path.exists():
            with open(self.mcp_config_path, 'r') as f:
                mcp_config = json.load(f).get('mcpServers', {})
            logger.info(f"Loaded MCP config with servers: {list(mcp_config.keys())}")

        # Configure Claude SDK client with appropriate prompt version
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            agents=self._get_subagent_definitions(use_v2=use_v2),
            permission_mode='bypassPermissions',
            mcp_servers=mcp_config,
            allowed_tools=[
                'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task'
            ],
            max_turns=100,
            cwd=str(workspace_path)
        )

        logger.info(f"Agent configured: bypassPermissions + cwd={workspace_path}")

        # Build initial prompt
        initial_prompt = self._build_initial_prompt(
            paper_metadata=paper_metadata,
            question_source=question_source,
            workspace_path=str(workspace_path)
        )

        # Execute pipeline
        async with ClaudeSDKClient(options) as client:
            logger.info("Sending initial prompt to Claude Agent SDK...")
            await client.query(initial_prompt)

            message_count = 0
            async for message in client.receive_messages():
                message_count += 1
                logger.debug(f"Message #{message_count}: {type(message).__name__}")

                if isinstance(message, ResultMessage):
                    logger.info(f"✅ Pipeline completed after {message_count} messages")

                    # Record metrics
                    usage = message.usage or {}
                    self.cost_tracker.record_subagent(
                        name="walkthrough_author_pipeline",
                        input_tokens=usage.get('input_tokens', 0),
                        output_tokens=usage.get('output_tokens', 0),
                        cost=message.total_cost_usd or 0.0,
                        execution_time=(message.duration_ms or 0) / 1000.0,
                        success=not message.is_error,
                        error=""
                    )
                    break

        # Read critic result
        critic_result_path = workspace_path / "walkthrough_critic_result.json"
        if critic_result_path.exists():
            with open(critic_result_path, 'r') as f:
                return json.load(f)
        else:
            return {"pass": False, "error": "Critic result not found"}

    def _build_initial_prompt(
        self,
        paper_metadata: Dict[str, Any],
        question_source: Dict[str, Any],
        workspace_path: str
    ) -> str:
        """Build the orchestration prompt for the pipeline.

        Args:
            paper_metadata: Paper metadata
            question_source: Question and solution data
            workspace_path: Path to workspace

        Returns:
            Initial prompt string
        """
        question_number = question_source["question"]["number"]
        total_marks = question_source["solution"]["max_marks"]

        return f"""You are orchestrating a walkthrough authoring pipeline.

## Context
- Subject: {paper_metadata.get('subject', 'Unknown')}
- Level: {paper_metadata.get('level', 'Unknown')}
- Year: {paper_metadata.get('year', 'Unknown')}
- Paper Code: {paper_metadata.get('paper_code', 'Unknown')}
- Question: {question_number}
- Total Marks: {total_marks}

## Workspace
Your workspace is: {workspace_path}

Files available:
- walkthrough_source.json: Question and marking scheme data
- paper_context.json: General marking principles
- walkthrough_template.json: Blank template to fill

## Pipeline Steps

Execute these subagents in order:

### Step 1: Walkthrough Author
Call the walkthrough_author subagent to:
1. Read walkthrough_source.json
2. Generate step-by-step walkthrough aligned with marking scheme
3. Write steps to walkthrough_template.json

### Step 2: Common Errors Subagent
Call the common_errors_subagent to:
1. Read walkthrough_source.json and walkthrough_template.json
2. Generate 2-4 common errors with bullet references
3. Update walkthrough_template.json with errors array

### Step 3: Walkthrough Critic
Call the walkthrough_critic subagent to:
1. Validate marking scheme alignment
2. Validate LaTeX syntax
3. Validate error quality
4. Write result to walkthrough_critic_result.json

If critic fails, revise and retry up to {self.max_critic_retries} times.

Begin by calling the walkthrough_author subagent.
"""

    async def _upsert_walkthrough(
        self,
        workspace_path: Path,
        paper_id: str,
        question_number: str,
        paper_metadata: Dict[str, Any],
        use_v2: bool = False
    ) -> str:
        """Upsert walkthrough to us_walkthroughs collection.

        Args:
            workspace_path: Path to workspace with generated files
            paper_id: Paper document ID
            question_number: Question number
            paper_metadata: Paper metadata
            use_v2: If True, mark as V2 pedagogical walkthrough

        Returns:
            Document ID of upserted walkthrough
        """
        from .utils.walkthrough_upserter import upsert_walkthrough

        template_path = workspace_path / "walkthrough_template.json"

        # V2 walkthroughs get a different model version for tracking
        model_version = "walkthrough_author_v2" if use_v2 else "walkthrough_author_v1"

        return await upsert_walkthrough(
            template_path=template_path,
            paper_id=paper_id,
            question_number=question_number,
            paper_metadata=paper_metadata,
            mcp_config_path=str(self.mcp_config_path),
            model_version=model_version
        )

    async def execute(
        self,
        paper_id: str,
        question_number: str,
        batch_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute the complete walkthrough authoring pipeline.

        Args:
            paper_id: Paper document ID (e.g., 'mathematics-n5-2023-X847-75-01')
            question_number: Question number (e.g., '1', '4a', '5b(i)')
            batch_context: Optional batch context for nested workspaces. Contains:
                - batch_id: Batch identifier
                - batch_dir: Path to batch directory for nested workspace
                - batch_index: Index in batch (0-based)
                - batch_total: Total questions in batch

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - appwrite_document_id: str (if successful)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If paper not found or question not in paper
        """
        logger.info(f"Starting walkthrough authoring: {paper_id} Q{question_number}")

        # Fetch paper document
        paper_doc = await self._fetch_paper(paper_id)
        if paper_doc is None:
            raise ValueError(f"Paper not found: {paper_id}")

        # Parse paper data
        paper_data = json.loads(paper_doc.get("data", "{}"))

        # Extract question source
        question_source = extract_question_source(paper_data, question_number)
        if question_source is None:
            raise ValueError(f"Question not found: {question_number} in paper {paper_id}")

        # Build paper metadata
        paper_metadata = {
            "subject": paper_doc.get("subject", ""),
            "level": paper_doc.get("level", ""),
            "year": paper_doc.get("year", 0),
            "paper_code": paper_doc.get("paper_code", ""),
            "paper_id": paper_id
        }

        # Determine parent directory for nested workspaces
        parent_dir = None
        if batch_context and batch_context.get("batch_dir"):
            parent_dir = Path(batch_context["batch_dir"])

        # Track workspace_path for error handling
        workspace_path = None

        try:
            # Create isolated workspace (nested under batch_dir if batch_context provided)
            with IsolatedFilesystem(
                self.execution_id,
                persist=self.persist_workspace,
                workspace_type="walkthrough_author",
                parent_dir=parent_dir
            ) as filesystem:
                workspace_path = filesystem.root

                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # V2 PILOT CHECK: Determine if using pedagogical prompts
                # ═══════════════════════════════════════════════════════════════

                use_v2 = is_v2_pilot_paper(paper_id)
                if use_v2:
                    logger.info(f"🎓 V2 PILOT ACTIVE for paper: {paper_id}")

                # ═══════════════════════════════════════════════════════════════
                # METADATA: Write execution manifest and init log at START
                # ═══════════════════════════════════════════════════════════════

                self._write_execution_manifest(
                    workspace_path=workspace_path,
                    paper_id=paper_id,
                    question_number=question_number,
                    paper_metadata=paper_metadata,
                    question_source=question_source,
                    batch_context=batch_context,
                    use_v2=use_v2
                )

                self._init_execution_log(workspace_path)

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract source and create template (NO AGENT)
                # ═══════════════════════════════════════════════════════════════

                preprocess_start = datetime.now()

                # Build prerequisite links for V2 papers
                if use_v2:
                    topic_tags = question_source.get("question", {}).get("topic_tags", [])
                    course_id = get_course_id_for_paper(
                        paper_metadata.get("subject", ""),
                        paper_metadata.get("level", "")
                    )
                    if course_id and topic_tags:
                        logger.info(f"📚 Building prerequisite links for {len(topic_tags)} topics...")
                        prerequisite_links = await build_prerequisite_links(
                            topic_tags=topic_tags,
                            course_id=course_id,
                            mcp_config_path=str(self.mcp_config_path)
                        )
                        question_source["prerequisite_links"] = prerequisite_links
                        logger.info(f"✅ Added {len(prerequisite_links)} prerequisite links")
                    else:
                        logger.warning(f"⚠️ Could not build prerequisite links: course_id={course_id}, topics={len(topic_tags)}")
                        question_source["prerequisite_links"] = []

                # Write walkthrough source
                source_path = workspace_path / "walkthrough_source.json"
                with open(source_path, 'w') as f:
                    json.dump(question_source, f, indent=2)
                logger.info(f"✅ walkthrough_source.json ready at: {source_path}")

                # Write paper context
                context_path = workspace_path / "paper_context.json"
                paper_context = {
                    "general_principles": paper_data.get("general_principles", []),
                    "formulae": paper_data.get("formulae", [])
                }
                with open(context_path, 'w') as f:
                    json.dump(paper_context, f, indent=2)
                logger.info(f"✅ paper_context.json ready at: {context_path}")

                # Generate blank template
                blank_template = generate_blank_walkthrough_template(question_source)
                template_path = workspace_path / "walkthrough_template.json"
                with open(template_path, 'w') as f:
                    json.dump(blank_template, f, indent=2)
                logger.info(f"✅ walkthrough_template.json ready at: {template_path}")

                preprocess_end = datetime.now()
                preprocess_duration_ms = int((preprocess_end - preprocess_start).total_seconds() * 1000)

                # Update execution log with pre-processing stage
                self._update_execution_log(
                    workspace_path=workspace_path,
                    stage_name="pre_processing",
                    status=StageStatus.COMPLETED,
                    started_at=preprocess_start.isoformat(),
                    completed_at=preprocess_end.isoformat(),
                    duration_ms=preprocess_duration_ms,
                    files_created=["walkthrough_source.json", "paper_context.json", "walkthrough_template.json"]
                )

                # ═══════════════════════════════════════════════════════════════
                # AGENT EXECUTION: 3 subagents
                # ═══════════════════════════════════════════════════════════════

                agent_start = datetime.now()

                critic_result = await self._run_agent_pipeline(
                    workspace_path=workspace_path,
                    paper_metadata=paper_metadata,
                    question_source=question_source,
                    use_v2=use_v2
                )

                agent_end = datetime.now()
                agent_duration_ms = int((agent_end - agent_start).total_seconds() * 1000)

                # Read final template to get counts
                steps_count = 0
                errors_count = 0
                total_marks = question_source.get("solution", {}).get("max_marks", 0)
                try:
                    with open(workspace_path / "walkthrough_template.json", 'r') as f:
                        final_template = json.load(f)
                        steps_count = len(final_template.get("steps", []))
                        errors_count = len(final_template.get("common_errors", []))
                except Exception:
                    pass  # Use defaults if template can't be read

                # Extract critic scores for metadata
                critic_scores = critic_result.get("dimensional_scores", {})
                # Critic uses "validation_passed" key in its output
                critic_passed = critic_result.get("validation_passed", critic_result.get("pass", False))

                # Update execution log with agent stage
                self._update_execution_log(
                    workspace_path=workspace_path,
                    stage_name="agent_pipeline",
                    status=StageStatus.COMPLETED if critic_passed else StageStatus.FAILED,
                    started_at=agent_start.isoformat(),
                    completed_at=agent_end.isoformat(),
                    duration_ms=agent_duration_ms,
                    result={
                        "pass": critic_passed,
                        "overall_score": critic_result.get("overall_score", 0),
                        "dimensional_scores": critic_scores
                    }
                )

                if not critic_passed:
                    logger.warning(f"Critic validation failed: {critic_result.get('issues', [])}")

                    # Write final result for failure
                    self._write_final_result(
                        workspace_path=workspace_path,
                        success=False,
                        steps_count=steps_count,
                        errors_count=errors_count,
                        total_marks=total_marks,
                        critic_passed=False,
                        critic_attempts=critic_result.get("attempts", 1),
                        critic_scores=critic_scores,
                        error_message="Critic validation failed",
                        error_type="critic_validation_failed"
                    )

                    # Finalize execution log
                    metrics = self.cost_tracker.get_summary()
                    self._finalize_execution_log(
                        workspace_path=workspace_path,
                        status=ExecutionStatus.FAILED,
                        totals={
                            "input_tokens": metrics.get("input_tokens", 0),
                            "output_tokens": metrics.get("output_tokens", 0),
                            "total_tokens": metrics.get("total_tokens", 0),
                            "estimated_cost_usd": metrics.get("total_cost_usd", 0),
                            "critic_attempts": critic_result.get("attempts", 1)
                        }
                    )

                    return {
                        "success": False,
                        "error_type": "critic_validation_failed",
                        "execution_id": self.execution_id,
                        "workspace_path": str(workspace_path),
                        "error": "Critic validation failed",
                        "critic_result": critic_result,
                        "metrics": metrics
                    }

                # ═══════════════════════════════════════════════════════════════
                # COMMON_ERRORS VALIDATION: Validate schema before upserting
                # ═══════════════════════════════════════════════════════════════

                validation_start = datetime.now()

                is_valid, validation_errors = self._validate_common_errors(workspace_path)

                if not is_valid:
                    logger.warning(f"common_errors validation failed: {validation_errors}")

                    # Attempt correction with retry loop
                    correction_success, remaining_errors = await self._run_common_errors_correction(
                        workspace_path=workspace_path,
                        validation_errors=validation_errors,
                        max_retries=2
                    )

                    if not correction_success:
                        # Correction failed - return with schema_validation_failed error
                        validation_end = datetime.now()
                        validation_duration_ms = int((validation_end - validation_start).total_seconds() * 1000)

                        self._update_execution_log(
                            workspace_path=workspace_path,
                            stage_name="common_errors_validation",
                            status=StageStatus.FAILED,
                            started_at=validation_start.isoformat(),
                            completed_at=validation_end.isoformat(),
                            duration_ms=validation_duration_ms,
                            error_message=f"Schema validation failed: {remaining_errors}"
                        )

                        self._write_final_result(
                            workspace_path=workspace_path,
                            success=False,
                            steps_count=steps_count,
                            errors_count=errors_count,
                            total_marks=total_marks,
                            critic_passed=True,  # Critic passed, but schema validation failed
                            critic_attempts=critic_result.get("attempts", 1),
                            critic_scores=critic_scores,
                            error_message=f"common_errors schema validation failed: {remaining_errors}",
                            error_type="schema_validation_failed"
                        )

                        metrics = self.cost_tracker.get_summary()
                        self._finalize_execution_log(
                            workspace_path=workspace_path,
                            status=ExecutionStatus.FAILED,
                            totals={
                                "input_tokens": metrics.get("input_tokens", 0),
                                "output_tokens": metrics.get("output_tokens", 0),
                                "total_tokens": metrics.get("total_tokens", 0),
                                "estimated_cost_usd": metrics.get("total_cost_usd", 0),
                                "critic_attempts": critic_result.get("attempts", 1)
                            }
                        )

                        return {
                            "success": False,
                            "error_type": "schema_validation_failed",
                            "execution_id": self.execution_id,
                            "workspace_path": str(workspace_path),
                            "error": f"common_errors schema validation failed after correction attempts",
                            "validation_errors": remaining_errors,
                            "metrics": metrics
                        }

                    # Correction succeeded - update errors_count from corrected template
                    try:
                        with open(workspace_path / "walkthrough_template.json", 'r') as f:
                            corrected_template = json.load(f)
                            errors_count = len(corrected_template.get("common_errors", []))
                    except Exception:
                        pass  # Keep original count if read fails

                validation_end = datetime.now()
                validation_duration_ms = int((validation_end - validation_start).total_seconds() * 1000)

                self._update_execution_log(
                    workspace_path=workspace_path,
                    stage_name="common_errors_validation",
                    status=StageStatus.COMPLETED,
                    started_at=validation_start.isoformat(),
                    completed_at=validation_end.isoformat(),
                    duration_ms=validation_duration_ms
                )

                logger.info("✅ common_errors validation passed")

                # ═══════════════════════════════════════════════════════════════
                # POST-PROCESSING: Upsert to us_walkthroughs (NO AGENT)
                # ═══════════════════════════════════════════════════════════════

                postprocess_start = datetime.now()

                doc_id = await self._upsert_walkthrough(
                    workspace_path=workspace_path,
                    paper_id=paper_id,
                    question_number=question_number,
                    paper_metadata=paper_metadata,
                    use_v2=use_v2
                )

                postprocess_end = datetime.now()
                postprocess_duration_ms = int((postprocess_end - postprocess_start).total_seconds() * 1000)

                # Update execution log with post-processing stage
                self._update_execution_log(
                    workspace_path=workspace_path,
                    stage_name="post_processing",
                    status=StageStatus.COMPLETED,
                    started_at=postprocess_start.isoformat(),
                    completed_at=postprocess_end.isoformat(),
                    duration_ms=postprocess_duration_ms
                )

                logger.info(f"✅ Walkthrough upserted: {doc_id}")

                # ═══════════════════════════════════════════════════════════════
                # METADATA: Write final result and finalize log
                # ═══════════════════════════════════════════════════════════════

                self._write_final_result(
                    workspace_path=workspace_path,
                    success=True,
                    doc_id=doc_id,
                    steps_count=steps_count,
                    errors_count=errors_count,
                    total_marks=total_marks,
                    critic_passed=True,
                    critic_attempts=critic_result.get("attempts", 1),
                    critic_scores=critic_scores
                )

                metrics = self.cost_tracker.get_summary()
                self._finalize_execution_log(
                    workspace_path=workspace_path,
                    status=ExecutionStatus.COMPLETED,
                    totals={
                        "input_tokens": metrics.get("input_tokens", 0),
                        "output_tokens": metrics.get("output_tokens", 0),
                        "total_tokens": metrics.get("total_tokens", 0),
                        "estimated_cost_usd": metrics.get("total_cost_usd", 0),
                        "critic_attempts": critic_result.get("attempts", 1)
                    }
                )

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "appwrite_document_id": doc_id,
                    "metrics": metrics
                }

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")

            # Write final result for exception if workspace exists
            if workspace_path and workspace_path.exists():
                try:
                    self._write_final_result(
                        workspace_path=workspace_path,
                        success=False,
                        error_message=str(e),
                        error_type=type(e).__name__
                    )
                    self._finalize_execution_log(
                        workspace_path=workspace_path,
                        status=ExecutionStatus.FAILED,
                        totals={}
                    )
                except Exception as meta_error:
                    logger.warning(f"Failed to write metadata on error: {meta_error}")

            return {
                "success": False,
                "error_type": type(e).__name__,
                "execution_id": self.execution_id,
                "workspace_path": str(workspace_path) if workspace_path else None,
                "error": str(e),
                "metrics": self.cost_tracker.get_summary()
            }
