#!/usr/bin/env python3
"""Batch Walkthrough Generator CLI - Generate walkthroughs for past papers.

Generates examiner-aligned walkthroughs for SQA past paper questions in batch.

Key features:
- Filter by subject, level, and year
- Dry-run preview with question counts
- Skip existing walkthroughs (unless --force)
- Concurrent processing with configurable limit
- Per-paper logging and batch summary report

Usage:
    # Dry-run for all N5 Mathematics (preview only)
    python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --dry-run

    # Generate all N5 Mathematics walkthroughs
    python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5"

    # Generate for specific year
    python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --year 2023

    # Single paper mode
    python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01

    # Force regenerate (deletes existing)
    python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --force
"""

import argparse
import asyncio
import json
import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from dotenv import load_dotenv

from .models.walkthrough_models import (
    BatchManifest,
    BatchProgress,
    BatchCounts,
    CurrentProcessing,
    LastCompleted,
    FailedQuestions,
    FailedQuestion,
    BatchFilter,
    BatchScope,
    BatchConfig,
    BatchStatus,
    BATCH_MANIFEST_FILE,
    BATCH_PROGRESS_FILE,
    FAILED_QUESTIONS_FILE,
)

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
RESET = '\033[0m'


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class QuestionTask:
    """A single question to process."""
    paper_id: str
    question_number: str
    marks: int
    topic_tags: List[str]
    has_existing_walkthrough: bool = False


@dataclass
class PaperSummary:
    """Summary of a paper's questions."""
    paper_id: str
    subject: str
    level: str
    year: int
    paper_code: str
    questions: List[QuestionTask] = field(default_factory=list)
    total_marks: int = 0


@dataclass
class BatchResult:
    """Result of batch processing."""
    total_papers: int = 0
    total_questions: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    failed_questions: List[Dict[str, Any]] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# Argument Parsing
# =============================================================================

def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Batch Walkthrough Generator - Generate walkthroughs for SQA past papers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:

  # Discover available papers (exploration mode - no generation)
  python -m src.batch_walkthrough_generator --discover
  python -m src.batch_walkthrough_generator --discover --subject Mathematics
  python -m src.batch_walkthrough_generator --discover --subject Mathematics --level "National 5"

  # Dry-run for all N5 Mathematics (preview questions, no execution)
  python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --dry-run

  # Generate walkthroughs for all N5 Mathematics
  python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5"

  # Generate for specific year only
  python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --year 2023

  # Single paper mode (all questions in one paper)
  python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01

  # Single question mode (one specific question)
  python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1
  python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 4a

  # Force regenerate all (deletes existing walkthroughs)
  python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --force

  # Limit concurrent processing
  python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --max-concurrent 2

  # Retry failed questions from a previous batch
  python -m src.batch_walkthrough_generator --retry-failed batch_20260110_155503

  # Resume an interrupted batch from checkpoint
  python -m src.batch_walkthrough_generator --resume batch_20260110_155503

Note:
  - Discovery mode shows available papers without generating (fast, free)
  - Dry-run mode shows question counts without generating (fast, free)
  - Default is to skip questions with existing walkthroughs
  - Use --force to regenerate existing walkthroughs
  - Use --retry-failed to re-process only failed questions from a batch
  - Use --resume to continue an interrupted batch from its checkpoint
  - Creates batch logs in workspace/batch_{batch_id}/
        """
    )

    # Filter arguments
    parser.add_argument(
        '--subject',
        type=str,
        help="Filter by subject (e.g., 'Mathematics')"
    )

    parser.add_argument(
        '--level',
        type=str,
        help="Filter by level (e.g., 'National 5')"
    )

    parser.add_argument(
        '--year',
        type=int,
        help="Filter by year (e.g., 2023)"
    )

    parser.add_argument(
        '--paper-id',
        type=str,
        help="Process single paper by ID (e.g., 'mathematics-n5-2023-X847-75-01')"
    )

    parser.add_argument(
        '--question',
        type=str,
        help="Process single question (requires --paper-id, e.g., '1', '4a', '5b(i)')"
    )

    # Mode arguments
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Preview execution plan without generating walkthroughs"
    )

    parser.add_argument(
        '--discover',
        action='store_true',
        help="Discover available papers and questions (no generation, just exploration)"
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help="Force regenerate existing walkthroughs"
    )

    parser.add_argument(
        '--retry-failed',
        type=str,
        metavar='BATCH_ID',
        help="Retry failed questions from a previous batch (e.g., 'batch_20260110_155503')"
    )

    parser.add_argument(
        '--resume',
        type=str,
        metavar='BATCH_ID',
        help="Resume a batch from its progress checkpoint (e.g., 'batch_20260110_155503')"
    )

    # Configuration
    parser.add_argument(
        '--max-concurrent',
        type=int,
        default=3,
        help="Maximum concurrent question processing (default: 3)"
    )

    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        help="Path to MCP configuration file (default: .mcp.json)"
    )

    parser.add_argument(
        '--log-level',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help="Logging verbosity level (default: INFO)"
    )

    return parser.parse_args()


# =============================================================================
# Paper Discovery Functions
# =============================================================================

async def fetch_papers(
    subject: Optional[str],
    level: Optional[str],
    year: Optional[int],
    paper_id: Optional[str],
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Fetch papers matching the filter criteria.

    Args:
        subject: Filter by subject
        level: Filter by level
        year: Filter by year
        paper_id: Specific paper ID (overrides other filters)
        mcp_config_path: Path to MCP config

    Returns:
        List of paper documents
    """
    from .utils.paper_extractor import list_papers, fetch_paper

    if paper_id:
        # Single paper mode
        paper = await fetch_paper(paper_id, mcp_config_path)
        return [paper] if paper else []
    else:
        # Filter mode
        return await list_papers(
            subject=subject,
            level=level,
            year=year,
            mcp_config_path=mcp_config_path
        )


def extract_questions_from_papers(papers: List[Dict[str, Any]]) -> List[PaperSummary]:
    """Extract all questions from papers.

    Args:
        papers: List of paper documents

    Returns:
        List of PaperSummary with questions
    """
    from .utils.paper_extractor import extract_questions_from_paper

    summaries = []

    for paper_doc in papers:
        paper_data = json.loads(paper_doc.get("data", "{}"))

        summary = PaperSummary(
            paper_id=paper_doc.get("$id", ""),
            subject=paper_doc.get("subject", ""),
            level=paper_doc.get("level", ""),
            year=paper_doc.get("year", 0),
            paper_code=paper_doc.get("paper_code", "")
        )

        # Extract questions
        questions = extract_questions_from_paper(paper_data)

        for q in questions:
            if q.has_solution:  # Only process questions with solutions
                task = QuestionTask(
                    paper_id=summary.paper_id,
                    question_number=q.question_number,
                    marks=q.marks,
                    topic_tags=q.topic_tags
                )
                summary.questions.append(task)
                summary.total_marks += q.marks

        summaries.append(summary)

    return summaries


async def check_existing_walkthroughs(
    summaries: List[PaperSummary],
    mcp_config_path: str
) -> List[PaperSummary]:
    """Check which questions already have walkthroughs in Appwrite.

    Queries the us_walkthroughs collection to identify questions that already
    have generated walkthroughs. This enables skip-existing behavior in batch
    processing (unless --force is specified).

    Document ID Pattern:
        {paper_id}_q{question_number}
        Example: mathematics_n5_2023_X847_75_01_q4a
        Note: Hyphens replaced with underscores for Appwrite compatibility

    Args:
        summaries: Paper summaries with questions
        mcp_config_path: Path to MCP config

    Returns:
        Updated summaries with has_existing_walkthrough flags set
    """
    from .utils.walkthrough_upserter import list_walkthroughs_by_paper_ids

    # Collect all paper IDs
    paper_ids = [s.paper_id for s in summaries]

    if not paper_ids:
        return summaries

    # Query Appwrite for existing walkthroughs
    print(f"{CYAN}Checking for existing walkthroughs...{RESET}")
    existing_ids = await list_walkthroughs_by_paper_ids(paper_ids, mcp_config_path)

    if not existing_ids:
        print(f"{GREEN}No existing walkthroughs found{RESET}")
        return summaries

    # Mark questions that have existing walkthroughs
    existing_count = 0
    for summary in summaries:
        for question in summary.questions:
            # Build document ID matching WalkthroughDocument.generate_document_id()
            # Strip leading q to avoid double-q, replace hyphens with underscores
            q_normalized = question.question_number.lower().replace("(", "").replace(")", "").lstrip("q")
            paper_id_safe = summary.paper_id.replace("-", "_")
            doc_id = f"{paper_id_safe}_q{q_normalized}"

            if doc_id in existing_ids:
                question.has_existing_walkthrough = True
                existing_count += 1

    print(f"{YELLOW}Found {existing_count} questions with existing walkthroughs{RESET}")
    return summaries


# =============================================================================
# Batch Metadata Writers
# =============================================================================

def _get_batch_dir(batch_id: str) -> Path:
    """Get the batch directory path.

    Args:
        batch_id: Batch identifier

    Returns:
        Path to batch directory
    """
    project_root = Path(__file__).parent.parent
    return project_root / "workspace" / batch_id


def _write_batch_manifest(
    batch_dir: Path,
    batch_id: str,
    args: argparse.Namespace,
    summaries: List[PaperSummary],
    total_questions: int
) -> None:
    """Write batch manifest at START of batch processing.

    Args:
        batch_dir: Path to batch directory
        batch_id: Batch identifier
        args: CLI arguments
        summaries: Paper summaries
        total_questions: Total questions to process
    """
    cli_command = f"python -m src.batch_walkthrough_generator"
    if args.paper_id:
        cli_command += f" --paper-id {args.paper_id}"
    else:
        if args.subject:
            cli_command += f" --subject {args.subject}"
        if args.level:
            cli_command += f" --level '{args.level}'"
        if args.year:
            cli_command += f" --year {args.year}"
    if args.force:
        cli_command += " --force"

    manifest = BatchManifest(
        batch_id=batch_id,
        created_at=datetime.now().isoformat(),
        filter=BatchFilter(
            subject=args.subject,
            level=args.level,
            year=args.year,
            paper_id=args.paper_id
        ),
        cli_command=cli_command,
        scope=BatchScope(
            total_papers=len(summaries),
            total_questions=total_questions,
            paper_ids=[s.paper_id for s in summaries]
        ),
        config=BatchConfig(
            max_concurrent=args.max_concurrent,
            force_regenerate=args.force,
            mcp_config_path=args.mcp_config
        )
    )

    manifest_path = batch_dir / BATCH_MANIFEST_FILE
    with open(manifest_path, 'w') as f:
        f.write(manifest.model_dump_json(indent=2))
    logger.info(f"✅ {BATCH_MANIFEST_FILE} written at: {manifest_path}")


def _init_batch_progress(batch_dir: Path, batch_id: str, total: int) -> None:
    """Initialize batch progress file.

    Args:
        batch_dir: Path to batch directory
        batch_id: Batch identifier
        total: Total questions
    """
    progress = BatchProgress(
        batch_id=batch_id,
        updated_at=datetime.now().isoformat(),
        status=BatchStatus.IN_PROGRESS,
        counts=BatchCounts(
            total=total,
            completed=0,
            failed=0,
            skipped=0,
            pending=total
        ),
        current_processing=[],
        last_completed=None
    )

    progress_path = batch_dir / BATCH_PROGRESS_FILE
    with open(progress_path, 'w') as f:
        f.write(progress.model_dump_json(indent=2))
    logger.debug(f"Batch progress initialized at: {progress_path}")


def _update_batch_progress(
    batch_dir: Path,
    completed: int,
    failed: int,
    skipped: int,
    pending: int,
    current_processing: Optional[List[Dict[str, Any]]] = None,
    last_completed: Optional[Dict[str, Any]] = None
) -> None:
    """Update batch progress file.

    Args:
        batch_dir: Path to batch directory
        completed: Completed count
        failed: Failed count
        skipped: Skipped count
        pending: Pending count
        current_processing: Currently processing questions
        last_completed: Last completed question info
    """
    progress_path = batch_dir / BATCH_PROGRESS_FILE

    with open(progress_path, 'r') as f:
        progress_data = json.load(f)

    progress_data["updated_at"] = datetime.now().isoformat()
    progress_data["counts"]["completed"] = completed
    progress_data["counts"]["failed"] = failed
    progress_data["counts"]["skipped"] = skipped
    progress_data["counts"]["pending"] = pending

    if current_processing is not None:
        progress_data["current_processing"] = current_processing

    if last_completed is not None:
        progress_data["last_completed"] = last_completed

    with open(progress_path, 'w') as f:
        json.dump(progress_data, f, indent=2)


def _finalize_batch_progress(batch_dir: Path, status: BatchStatus) -> None:
    """Finalize batch progress with final status.

    Args:
        batch_dir: Path to batch directory
        status: Final status
    """
    progress_path = batch_dir / BATCH_PROGRESS_FILE

    with open(progress_path, 'r') as f:
        progress_data = json.load(f)

    progress_data["status"] = status.value
    progress_data["updated_at"] = datetime.now().isoformat()
    progress_data["current_processing"] = []

    with open(progress_path, 'w') as f:
        json.dump(progress_data, f, indent=2)

    logger.info(f"✅ {BATCH_PROGRESS_FILE} finalized with status: {status.value}")


def _append_failed_question(
    batch_dir: Path,
    batch_id: str,
    task: QuestionTask,
    result: Dict[str, Any],
    execution_id: Optional[str] = None,
    workspace_path: Optional[str] = None
) -> None:
    """Append a failed question to the failures file.

    Args:
        batch_dir: Path to batch directory
        batch_id: Batch identifier
        task: The question task that failed
        result: Result dictionary with error info
        execution_id: Execution ID if available
        workspace_path: Workspace path if available
    """
    failed_path = batch_dir / FAILED_QUESTIONS_FILE

    # Load existing or create new
    if failed_path.exists():
        with open(failed_path, 'r') as f:
            failed_data = json.load(f)
    else:
        failed_data = {
            "batch_id": batch_id,
            "updated_at": datetime.now().isoformat(),
            "failures": [],
            "retry_command": f"python -m src.batch_walkthrough_generator --retry-failed {batch_id}"
        }

    # Append failure
    failure = FailedQuestion(
        paper_id=task.paper_id,
        question_number=task.question_number,
        execution_id=execution_id,
        failed_at=datetime.now().isoformat(),
        error_type=result.get("error_type", "unknown"),
        error_message=result.get("error", "Unknown error"),
        critic_attempts=result.get("metrics", {}).get("critic_attempts"),
        workspace_path=workspace_path
    )

    failed_data["failures"].append(json.loads(failure.model_dump_json()))
    failed_data["updated_at"] = datetime.now().isoformat()

    with open(failed_path, 'w') as f:
        json.dump(failed_data, f, indent=2)

    logger.debug(f"Appended failure to {FAILED_QUESTIONS_FILE}")


# =============================================================================
# Batch Processing
# =============================================================================

async def process_single_question(
    task: QuestionTask,
    mcp_config_path: str,
    semaphore: asyncio.Semaphore,
    batch_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Process a single question with semaphore control.

    Args:
        task: Question task to process
        mcp_config_path: Path to MCP config
        semaphore: Concurrency limiter
        batch_context: Optional batch context for nested workspaces

    Returns:
        Result dictionary with success status
    """
    from .walkthrough_author_claude_client import WalkthroughAuthorClaudeAgent

    async with semaphore:
        try:
            agent = WalkthroughAuthorClaudeAgent(
                mcp_config_path=mcp_config_path,
                persist_workspace=True
            )

            result = await agent.execute(
                paper_id=task.paper_id,
                question_number=task.question_number,
                batch_context=batch_context
            )

            return {
                "paper_id": task.paper_id,
                "question_number": task.question_number,
                "success": result.get("success", False),
                "document_id": result.get("appwrite_document_id"),
                "execution_id": result.get("execution_id"),
                "workspace_path": result.get("workspace_path"),
                "error": result.get("error"),
                "error_type": result.get("error_type") or "unknown" if not result.get("success") else None,
                "metrics": result.get("metrics", {})
            }

        except Exception as e:
            logger.error(f"Failed {task.paper_id} Q{task.question_number}: {e}")
            return {
                "paper_id": task.paper_id,
                "question_number": task.question_number,
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }


async def run_batch_processing(
    summaries: List[PaperSummary],
    mcp_config_path: str,
    max_concurrent: int,
    force: bool,
    args: argparse.Namespace
) -> BatchResult:
    """Run batch processing on all questions with metadata tracking.

    Args:
        summaries: Paper summaries with questions
        mcp_config_path: Path to MCP config
        max_concurrent: Max concurrent processing
        force: Whether to regenerate existing
        args: CLI arguments (for batch manifest)

    Returns:
        BatchResult with statistics
    """
    result = BatchResult()
    semaphore = asyncio.Semaphore(max_concurrent)

    # Generate batch ID and create batch directory
    batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    batch_dir = _get_batch_dir(batch_id)
    batch_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Created batch directory: {batch_dir}")

    # Count total questions and track overwrites
    all_tasks: List[QuestionTask] = []
    overwrite_count = 0

    for summary in summaries:
        result.total_papers += 1
        for question in summary.questions:
            result.total_questions += 1
            # Skip existing unless force
            if question.has_existing_walkthrough and not force:
                result.skipped += 1
            else:
                all_tasks.append(question)
                if question.has_existing_walkthrough and force:
                    overwrite_count += 1

    # Display overwrite warning if --force is being used
    if overwrite_count > 0:
        print(f"{YELLOW}⚠️  --force mode: {overwrite_count} existing walkthroughs will be overwritten{RESET}")

    # Write batch manifest at START
    _write_batch_manifest(
        batch_dir=batch_dir,
        batch_id=batch_id,
        args=args,
        summaries=summaries,
        total_questions=len(all_tasks)
    )

    # Initialize progress file
    _init_batch_progress(batch_dir, batch_id, len(all_tasks))

    # Process tasks sequentially to update progress properly
    if all_tasks:
        print(f"\n{CYAN}Processing {len(all_tasks)} questions (max {max_concurrent} concurrent)...{RESET}")
        print(f"{CYAN}Batch directory: {batch_dir}{RESET}\n")

        completed_count = 0
        failed_count = 0
        pending_count = len(all_tasks)

        for idx, task in enumerate(all_tasks):
            # Update progress with current processing
            _update_batch_progress(
                batch_dir=batch_dir,
                completed=completed_count,
                failed=failed_count,
                skipped=result.skipped,
                pending=pending_count,
                current_processing=[{
                    "paper_id": task.paper_id,
                    "question_number": task.question_number,
                    "started_at": datetime.now().isoformat()
                }]
            )

            # Process with batch context for nested workspace
            batch_context = {
                "batch_id": batch_id,
                "batch_dir": str(batch_dir),
                "batch_index": idx,
                "batch_total": len(all_tasks)
            }

            r = await process_single_question(
                task=task,
                mcp_config_path=mcp_config_path,
                semaphore=semaphore,
                batch_context=batch_context
            )

            pending_count -= 1

            if r.get("success"):
                completed_count += 1
                result.successful += 1
                print(f"{GREEN}✓{RESET} [{completed_count}/{len(all_tasks)}] {r['paper_id']} Q{r['question_number']}")

                # Update progress with last completed
                _update_batch_progress(
                    batch_dir=batch_dir,
                    completed=completed_count,
                    failed=failed_count,
                    skipped=result.skipped,
                    pending=pending_count,
                    last_completed={
                        "paper_id": r["paper_id"],
                        "question_number": r["question_number"],
                        "execution_id": r.get("execution_id"),
                        "success": True
                    }
                )
            else:
                failed_count += 1
                result.failed += 1
                result.failed_questions.append(r)
                print(f"{RED}✗{RESET} [{completed_count}/{len(all_tasks)}] {r['paper_id']} Q{r['question_number']}: {r.get('error', 'Unknown error')}")

                # Append to failed questions file (wrapped for resilience)
                try:
                    _append_failed_question(
                        batch_dir=batch_dir,
                        batch_id=batch_id,
                        task=task,
                        result=r,
                        execution_id=r.get("execution_id"),
                        workspace_path=r.get("workspace_path")
                    )
                except Exception as record_error:
                    logger.error(f"Failed to record failure for {task.paper_id} Q{task.question_number}: {record_error}")
                    # Continue processing - never crash the batch from recording failures

                # Update progress
                _update_batch_progress(
                    batch_dir=batch_dir,
                    completed=completed_count,
                    failed=failed_count,
                    skipped=result.skipped,
                    pending=pending_count,
                    last_completed={
                        "paper_id": r["paper_id"],
                        "question_number": r["question_number"],
                        "execution_id": r.get("execution_id"),
                        "success": False
                    }
                )

        # Finalize progress
        final_status = BatchStatus.COMPLETED if failed_count == 0 else BatchStatus.COMPLETED_WITH_ERRORS
        _finalize_batch_progress(batch_dir, final_status)

    print(f"\n{CYAN}Batch workspace: {batch_dir}{RESET}")

    return result


# =============================================================================
# Display Functions
# =============================================================================

def display_dry_run_summary(summaries: List[PaperSummary], force: bool = False):
    """Display dry-run summary of papers and questions.

    Args:
        summaries: Paper summaries to display
        force: Whether --force mode is enabled
    """
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}DRY-RUN PREVIEW - Walkthrough Generation Plan{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    total_papers = len(summaries)
    total_questions = sum(len(s.questions) for s in summaries)
    total_marks = sum(s.total_marks for s in summaries)

    # Calculate existing vs new
    existing_count = sum(
        1 for s in summaries for q in s.questions if q.has_existing_walkthrough
    )
    new_count = total_questions - existing_count

    print(f"{CYAN}Summary:{RESET}")
    print(f"  Papers: {total_papers}")
    print(f"  Questions: {total_questions}")
    print(f"  Total marks: {total_marks}")
    print()

    # Show clear generation plan
    print(f"{CYAN}Execution Plan:{RESET}")
    if force:
        print(f"  {GREEN}To generate: {total_questions}{RESET} (--force: overwriting all)")
        if existing_count > 0:
            print(f"  {YELLOW}⚠️  Overwriting: {existing_count} existing walkthroughs{RESET}")
    else:
        print(f"  {GREEN}To generate: {new_count}{RESET}")
        print(f"  {YELLOW}To skip: {existing_count}{RESET} (already exist in Appwrite)")

    print()

    for summary in summaries:
        # Count existing per paper
        paper_existing = sum(1 for q in summary.questions if q.has_existing_walkthrough)
        paper_new = len(summary.questions) - paper_existing

        print(f"{YELLOW}Paper: {summary.paper_id}{RESET}")
        print(f"  Subject: {summary.subject}, Level: {summary.level}, Year: {summary.year}")
        print(f"  Paper code: {summary.paper_code}")
        print(f"  Questions: {len(summary.questions)}, Total marks: {summary.total_marks}")
        print(f"  {GREEN}New: {paper_new}{RESET} | {YELLOW}Existing: {paper_existing}{RESET}")

        for q in summary.questions[:5]:  # Show first 5
            status = f"{YELLOW}[exists]{RESET}" if q.has_existing_walkthrough else f"{GREEN}[new]{RESET}"
            print(f"    Q{q.question_number} ({q.marks} marks) {status}")

        if len(summary.questions) > 5:
            remaining = summary.questions[5:]
            remaining_new = sum(1 for q in remaining if not q.has_existing_walkthrough)
            remaining_existing = len(remaining) - remaining_new
            print(f"    ... and {len(remaining)} more ({GREEN}{remaining_new} new{RESET}, {YELLOW}{remaining_existing} existing{RESET})")
        print()

    # Clear next step instructions
    print(f"{CYAN}{'─'*70}{RESET}")
    if new_count > 0:
        print(f"{CYAN}To generate {new_count} new walkthroughs, run without --dry-run:{RESET}")
        print(f"  python -m src.batch_walkthrough_generator [same args]")
    else:
        print(f"{GREEN}All {total_questions} questions already have walkthroughs!{RESET}")
        print(f"  Use --force to regenerate existing walkthroughs")


def _print_cli_suggestions(
    subject: Optional[str],
    level: Optional[str],
    year: Optional[int],
    summaries: List[PaperSummary]
) -> None:
    """Print CLI command suggestions based on discovered papers.

    Args:
        subject: Subject filter used
        level: Level filter used
        year: Year filter used
        summaries: Paper summaries found
    """
    base_cmd = "python -m src.batch_walkthrough_generator"

    # Build filter string for commands
    filter_args = []
    if subject:
        filter_args.append(f'--subject {subject}')
    if level:
        filter_args.append(f'--level "{level}"')
    if year:
        filter_args.append(f'--year {year}')

    filter_str = " ".join(filter_args)

    print(f"{CYAN}To generate walkthroughs for all shown papers:{RESET}")
    if filter_str:
        print(f"  {base_cmd} {filter_str}")
    else:
        print(f"  {RED}(Specify at least --subject to generate){RESET}")
    print()

    if not year and summaries:
        # Suggest year-specific command
        years = sorted(set(s.year for s in summaries), reverse=True)
        if len(years) > 1:
            latest_year = years[0]
            print(f"{CYAN}To generate for a specific year:{RESET}")
            year_filter = f"{filter_str} --year {latest_year}" if filter_str else f"--year {latest_year}"
            print(f"  {base_cmd} {year_filter}")
            print()

    if summaries:
        # Suggest single paper command
        print(f"{CYAN}To generate for a specific paper:{RESET}")
        print(f"  {base_cmd} --paper-id {summaries[0].paper_id}")
        print()

    print(f"{CYAN}To preview without executing (dry-run):{RESET}")
    if filter_str:
        print(f"  {base_cmd} {filter_str} --dry-run")
    else:
        print(f"  {base_cmd} --subject <SUBJECT> --dry-run")


def display_discovery_results(
    summaries: List[PaperSummary],
    subject: Optional[str],
    level: Optional[str],
    year: Optional[int]
) -> None:
    """Display paper discovery results in a readable format.

    Args:
        summaries: Paper summaries with questions
        subject: Subject filter used (for CLI suggestions)
        level: Level filter used (for CLI suggestions)
        year: Year filter used (for CLI suggestions)
    """
    # Header
    filter_parts = []
    if subject:
        filter_parts.append(subject)
    if level:
        filter_parts.append(level)
    filter_str = " / ".join(filter_parts) if filter_parts else "All Papers"

    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}PAPER DISCOVERY - {filter_str}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

    # Summary stats
    total_papers = len(summaries)
    total_questions = sum(len(s.questions) for s in summaries)
    total_marks = sum(s.total_marks for s in summaries)

    print(f"{CYAN}Summary:{RESET}")
    print(f"  Papers found: {total_papers}")
    print(f"  Total questions: {total_questions}")
    print(f"  Total marks: {total_marks}")
    print()

    # Per-paper details
    for summary in summaries:
        print(f"{YELLOW}{'-'*80}{RESET}")
        print(f"{YELLOW}📄 Paper: {summary.paper_id}{RESET}")
        print(f"   Subject: {summary.subject} | Level: {summary.level} | Year: {summary.year}")
        print(f"   Paper Code: {summary.paper_code}")
        print(f"   Questions: {len(summary.questions)} | Total Marks: {summary.total_marks}")
        print()
        print(f"   Questions:")

        # Show questions with tree-style formatting
        max_display = 10
        questions_to_show = summary.questions[:max_display]
        for idx, q in enumerate(questions_to_show):
            is_last = idx == len(questions_to_show) - 1 and len(summary.questions) <= max_display
            prefix = "└─" if is_last else "├─"
            tags_str = f"[{', '.join(q.topic_tags[:3])}]" if q.topic_tags else ""
            print(f"   {prefix} Q{q.question_number:<4} ({q.marks} marks)  {tags_str}")

        if len(summary.questions) > max_display:
            remaining = len(summary.questions) - max_display
            print(f"   └─ ... {remaining} more questions")
        print()

    # CLI suggestions
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}CLI SUGGESTIONS{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

    _print_cli_suggestions(subject, level, year, summaries)


def display_batch_result(result: BatchResult):
    """Display batch processing result summary.

    Args:
        result: BatchResult to display
    """
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}BATCH PROCESSING COMPLETE{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    print(f"{CYAN}Results:{RESET}")
    print(f"  Papers processed: {result.total_papers}")
    print(f"  Questions total: {result.total_questions}")
    print(f"  {GREEN}Successful: {result.successful}{RESET}")
    print(f"  {YELLOW}Skipped: {result.skipped}{RESET}")
    print(f"  {RED}Failed: {result.failed}{RESET}")

    if result.failed_questions:
        print(f"\n{RED}Failed questions:{RESET}")
        for q in result.failed_questions[:10]:
            print(f"  - {q['paper_id']} Q{q['question_number']}: {q.get('error', 'Unknown')}")
        if len(result.failed_questions) > 10:
            print(f"  ... and {len(result.failed_questions) - 10} more failures")

    success_rate = (result.successful / result.total_questions * 100) if result.total_questions > 0 else 0
    print(f"\n{CYAN}Success rate: {success_rate:.1f}%{RESET}")


# =============================================================================
# Discovery Mode
# =============================================================================

async def run_discovery_mode(args: argparse.Namespace) -> int:
    """Run discovery mode to explore available papers.

    Args:
        args: CLI arguments

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Batch Walkthrough Generator - Discovery Mode{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

    # Display current filter
    print(f"{CYAN}Filter:{RESET}")
    print(f"  Subject: {args.subject or '(all)'}")
    print(f"  Level: {args.level or '(all)'}")
    print(f"  Year: {args.year or '(all)'}")
    print()

    try:
        # Fetch papers
        print(f"{CYAN}Fetching papers...{RESET}")
        papers = await fetch_papers(
            subject=args.subject,
            level=args.level,
            year=args.year,
            paper_id=None,  # Discovery mode doesn't use paper_id
            mcp_config_path=args.mcp_config
        )

        if not papers:
            print(f"{YELLOW}No papers found matching criteria{RESET}")
            print()
            print(f"{CYAN}Try with different filters or no filters to see all papers{RESET}")
            return 0

        print(f"{GREEN}Found {len(papers)} papers{RESET}")

        # Extract questions
        print(f"{CYAN}Extracting questions...{RESET}")
        summaries = extract_questions_from_papers(papers)

        total_questions = sum(len(s.questions) for s in summaries)
        print(f"{GREEN}Found {total_questions} questions with solutions{RESET}")

        # Display discovery results
        display_discovery_results(
            summaries=summaries,
            subject=args.subject,
            level=args.level,
            year=args.year
        )

        return 0

    except Exception as e:
        logger.exception(f"Discovery failed: {e}")
        print(f"\n{RED}Error: {e}{RESET}")
        return 1


# =============================================================================
# Single Question Mode
# =============================================================================

async def run_single_question_mode(args: argparse.Namespace) -> int:
    """Run single question mode to generate walkthrough for one question.

    Args:
        args: CLI arguments (requires paper_id and question)

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Walkthrough Generator - Single Question Mode{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    print(f"{CYAN}Target:{RESET}")
    print(f"  Paper ID: {args.paper_id}")
    print(f"  Question: {args.question}")
    print(f"  Force: {args.force}")
    print()

    try:
        # Fetch the paper
        print(f"{CYAN}Fetching paper...{RESET}")
        from .utils.paper_extractor import fetch_paper, extract_question_with_solution

        paper = await fetch_paper(
            paper_id=args.paper_id,
            mcp_config_path=args.mcp_config
        )

        if not paper:
            print(f"{RED}Error: Paper not found: {args.paper_id}{RESET}")
            return 1

        print(f"{GREEN}✅ Paper found: {paper.get('subject')} - {paper.get('level')} ({paper.get('year')}){RESET}")

        # Parse paper data
        import json
        paper_data_str = paper.get("data", "{}")
        if isinstance(paper_data_str, str):
            paper_data = json.loads(paper_data_str)
        else:
            paper_data = paper_data_str

        # Extract the specific question
        print(f"{CYAN}Extracting question {args.question}...{RESET}")
        question_source = extract_question_with_solution(paper_data, args.question)

        if not question_source:
            print(f"{RED}Error: Question {args.question} not found or has no solution{RESET}")
            print()
            print(f"{CYAN}Available questions in this paper:{RESET}")
            from .utils.paper_extractor import extract_questions_from_paper
            all_questions = extract_questions_from_paper(paper_data)
            for q in all_questions[:20]:
                status = "✅" if q.has_solution else "❌"
                print(f"  {status} Q{q.question_number} ({q.marks} marks)")
            if len(all_questions) > 20:
                print(f"  ... and {len(all_questions) - 20} more")
            return 1

        marks = question_source.get("solution", {}).get("max_marks", 0)
        print(f"{GREEN}✅ Question found: {args.question} ({marks} marks){RESET}")

        # Check for existing walkthrough
        # Build document ID matching WalkthroughDocument.generate_document_id()
        # Strip leading q to avoid double-q, replace hyphens with underscores
        q_normalized = args.question.lower().replace("(", "").replace(")", "").lstrip("q")
        paper_id_safe = args.paper_id.replace("-", "_")
        walkthrough_id = f"{paper_id_safe}_q{q_normalized}"

        from .utils.walkthrough_upserter import check_walkthrough_exists, delete_walkthrough
        exists = await check_walkthrough_exists(walkthrough_id, args.mcp_config)

        if exists:
            if not args.force:
                print(f"{YELLOW}⏭️  Walkthrough already exists: {walkthrough_id}{RESET}")
                print(f"{CYAN}Use --force to regenerate{RESET}")
                return 0
            else:
                # --force mode: delete existing before regenerating
                print(f"{YELLOW}🗑️  Deleting existing walkthrough: {walkthrough_id}{RESET}")
                await delete_walkthrough(walkthrough_id, args.mcp_config)
                print(f"{GREEN}✅ Deleted, regenerating...{RESET}")

        # Generate walkthrough
        print()
        print(f"{CYAN}Generating walkthrough...{RESET}")
        print(f"{YELLOW}This may take 1-2 minutes{RESET}")
        print()

        from .walkthrough_author_claude_client import WalkthroughAuthorClaudeAgent

        agent = WalkthroughAuthorClaudeAgent(
            mcp_config_path=args.mcp_config,
            persist_workspace=True
        )

        result = await agent.execute(
            paper_id=args.paper_id,
            question_number=args.question
        )

        # Display result
        print()
        if result.get("success"):
            print(f"{GREEN}{'='*70}{RESET}")
            print(f"{GREEN}✅ WALKTHROUGH GENERATED SUCCESSFULLY{RESET}")
            print(f"{GREEN}{'='*70}{RESET}")
            print()
            print(f"{CYAN}Details:{RESET}")
            print(f"  Execution ID: {result.get('execution_id')}")
            print(f"  Appwrite ID: {result.get('appwrite_document_id')}")
            print(f"  Workspace: {result.get('workspace_path')}")
            metrics = result.get("metrics", {})
            print()
            print(f"{CYAN}Metrics:{RESET}")
            print(f"  Total tokens: {metrics.get('total_tokens', 0):,}")
            print(f"  Estimated cost: ${metrics.get('total_cost_usd', 0):.4f}")
            return 0
        else:
            print(f"{RED}{'='*70}{RESET}")
            print(f"{RED}❌ WALKTHROUGH GENERATION FAILED{RESET}")
            print(f"{RED}{'='*70}{RESET}")
            print()
            print(f"{CYAN}Error:{RESET} {result.get('error', 'Unknown error')}")
            print(f"{CYAN}Workspace:{RESET} {result.get('workspace_path')}")
            return 1

    except Exception as e:
        logger.exception(f"Single question mode failed: {e}")
        print(f"\n{RED}Error: {e}{RESET}")
        return 1


# =============================================================================
# Retry Failed Mode
# =============================================================================

async def run_retry_failed_mode(args: argparse.Namespace) -> int:
    """Retry failed questions from a previous batch run.

    Loads the failed_questions.json from the specified batch directory and
    re-processes only those questions that previously failed.

    Args:
        args: CLI arguments (requires retry_failed batch_id)

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    batch_id = args.retry_failed

    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Walkthrough Generator - Retry Failed Mode{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    print(f"{CYAN}Batch ID:{RESET} {batch_id}")
    print()

    # Locate the batch directory
    batch_dir = _get_batch_dir(batch_id)

    if not batch_dir.exists():
        print(f"{RED}Error: Batch directory not found: {batch_dir}{RESET}")
        print(f"{CYAN}Available batches:{RESET}")
        workspace_root = batch_dir.parent
        if workspace_root.exists():
            batches = sorted([d.name for d in workspace_root.iterdir()
                            if d.is_dir() and d.name.startswith("batch_")])
            for b in batches[-10:]:  # Show last 10
                print(f"  - {b}")
            if len(batches) > 10:
                print(f"  ... and {len(batches) - 10} more")
        return 1

    # Load failed_questions.json
    failed_file = batch_dir / FAILED_QUESTIONS_FILE
    if not failed_file.exists():
        print(f"{YELLOW}No failed questions file found: {failed_file}{RESET}")
        print(f"{GREEN}All questions in this batch may have succeeded!{RESET}")
        return 0

    try:
        with open(failed_file, 'r') as f:
            failed_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"{RED}Error: Invalid JSON in failed_questions.json: {e}{RESET}")
        return 1

    failures = failed_data.get("failures", [])
    if not failures:
        print(f"{GREEN}No failed questions to retry!{RESET}")
        return 0

    print(f"{YELLOW}Found {len(failures)} failed questions to retry{RESET}")
    print()

    # Display failed questions
    print(f"{CYAN}Questions to retry:{RESET}")
    for idx, fail in enumerate(failures[:10], 1):
        print(f"  {idx}. {fail['paper_id']} Q{fail['question_number']} - {fail.get('error_type', 'unknown')}")
    if len(failures) > 10:
        print(f"  ... and {len(failures) - 10} more")
    print()

    # Create retry batch directory (nested under original batch)
    retry_batch_id = f"retry_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    retry_batch_dir = batch_dir / retry_batch_id
    retry_batch_dir.mkdir(parents=True, exist_ok=True)

    print(f"{CYAN}Retry workspace: {retry_batch_dir}{RESET}")
    print()

    # Process failed questions
    semaphore = asyncio.Semaphore(args.max_concurrent)
    result = BatchResult()
    result.total_questions = len(failures)

    print(f"{CYAN}Processing {len(failures)} failed questions (max {args.max_concurrent} concurrent)...{RESET}\n")

    completed_count = 0
    failed_count = 0
    new_failures = []

    for idx, fail in enumerate(failures):
        paper_id = fail["paper_id"]
        question_number = fail["question_number"]

        # Create task
        task = QuestionTask(
            paper_id=paper_id,
            question_number=question_number,
            marks=0,  # Not needed for retry
            topic_tags=[]
        )

        # Batch context for nested workspace
        batch_context = {
            "batch_id": retry_batch_id,
            "batch_dir": str(retry_batch_dir),
            "batch_index": idx,
            "batch_total": len(failures)
        }

        r = await process_single_question(
            task=task,
            mcp_config_path=args.mcp_config,
            semaphore=semaphore,
            batch_context=batch_context
        )

        if r.get("success"):
            completed_count += 1
            result.successful += 1
            print(f"{GREEN}✓{RESET} [{completed_count}/{len(failures)}] {paper_id} Q{question_number}")
        else:
            failed_count += 1
            result.failed += 1
            new_failures.append(r)
            print(f"{RED}✗{RESET} [{completed_count}/{len(failures)}] {paper_id} Q{question_number}: {r.get('error', 'Unknown')}")

    # Write new failures file if any
    if new_failures:
        new_failed_file = retry_batch_dir / FAILED_QUESTIONS_FILE
        new_failed_data = {
            "batch_id": retry_batch_id,
            "original_batch_id": batch_id,
            "updated_at": datetime.now().isoformat(),
            "failures": [
                {
                    "paper_id": f["paper_id"],
                    "question_number": f["question_number"],
                    "error_type": f.get("error_type", "unknown"),
                    "error_message": f.get("error", "Unknown"),
                    "failed_at": datetime.now().isoformat()
                }
                for f in new_failures
            ],
            "retry_command": f"python -m src.batch_walkthrough_generator --retry-failed {batch_id}/{retry_batch_id}"
        }
        with open(new_failed_file, 'w') as f:
            json.dump(new_failed_data, f, indent=2)

    # Display summary
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}RETRY COMPLETE{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    print(f"{CYAN}Results:{RESET}")
    print(f"  Total retried: {len(failures)}")
    print(f"  {GREEN}Successful: {completed_count}{RESET}")
    print(f"  {RED}Still failing: {failed_count}{RESET}")

    if new_failures:
        print(f"\n{YELLOW}Some questions still failed. Check:{RESET}")
        print(f"  {retry_batch_dir / FAILED_QUESTIONS_FILE}")

    success_rate = (completed_count / len(failures) * 100) if failures else 0
    print(f"\n{CYAN}Success rate: {success_rate:.1f}%{RESET}")

    return 0 if failed_count == 0 else 1


async def run_resume_mode(args: argparse.Namespace) -> int:
    """Resume a batch from its progress checkpoint.

    Loads the batch manifest and progress, then continues processing
    only the questions that haven't been completed yet.

    Args:
        args: CLI arguments containing batch_id in args.resume

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    batch_id = args.resume

    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Walkthrough Generator - Resume Mode{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    print(f"{CYAN}Batch ID:{RESET} {batch_id}")

    # Locate the batch directory
    batch_dir = _get_batch_dir(batch_id)

    if not batch_dir.exists():
        print(f"\n{RED}Error: Batch directory not found: {batch_dir}{RESET}")
        # List available batches
        workspace = Path("workspace")
        if workspace.exists():
            batches = sorted([d.name for d in workspace.iterdir() if d.is_dir() and d.name.startswith("batch_")])
            if batches:
                print(f"{CYAN}Available batches:{RESET}")
                for b in batches[-10:]:
                    print(f"  - {b}")
                if len(batches) > 10:
                    print(f"  ... and {len(batches) - 10} more")
        return 1

    # Load batch manifest
    manifest_file = batch_dir / BATCH_MANIFEST_FILE
    if not manifest_file.exists():
        print(f"\n{RED}Error: Batch manifest not found: {manifest_file}{RESET}")
        return 1

    with open(manifest_file, 'r') as f:
        manifest_data = json.load(f)

    # Load progress
    progress_file = batch_dir / BATCH_PROGRESS_FILE
    if not progress_file.exists():
        print(f"\n{RED}Error: Progress file not found: {progress_file}{RESET}")
        return 1

    with open(progress_file, 'r') as f:
        progress_data = json.load(f)

    counts = progress_data.get("counts", {})
    completed_count = counts.get("completed", 0)
    failed_count = counts.get("failed", 0)
    total_count = counts.get("total", 0)
    pending_count = counts.get("pending", 0)

    print(f"\n{CYAN}Progress from checkpoint:{RESET}")
    print(f"  Total questions: {total_count}")
    print(f"  Completed: {GREEN}{completed_count}{RESET}")
    print(f"  Failed: {RED}{failed_count}{RESET}")
    print(f"  Pending: {YELLOW}{pending_count}{RESET}")

    if pending_count == 0:
        print(f"\n{GREEN}This batch is already complete!{RESET}")
        return 0

    # Re-fetch papers using original filter
    filter_data = manifest_data.get("filter", {})
    config_data = manifest_data.get("config", {})

    print(f"\n{CYAN}Fetching papers with original filter...{RESET}")
    papers = await fetch_papers(
        subject=filter_data.get("subject"),
        level=filter_data.get("level"),
        year=filter_data.get("year"),
        paper_id=filter_data.get("paper_id"),
        mcp_config_path=config_data.get("mcp_config_path", ".mcp.json")
    )

    if not papers:
        print(f"{RED}Error: No papers found with original filter{RESET}")
        return 1

    # Extract questions
    summaries = extract_questions_from_papers(papers)
    all_tasks = []
    for summary in summaries:
        for q in summary.questions:
            all_tasks.append(QuestionTask(
                paper_id=summary.paper_id,
                question_number=q.question_number,
                marks=q.marks,
                topic_tags=q.topic_tags
            ))

    # Find completed questions by checking workspace directories
    completed_questions = set()
    for item in batch_dir.iterdir():
        if item.is_dir() and not item.name.startswith("retry_"):
            # Check if this workspace has a final_result.json with success=true
            final_result = item / "final_result.json"
            if final_result.exists():
                with open(final_result, 'r') as f:
                    result_data = json.load(f)
                if result_data.get("success", False):
                    # Get paper_id and question from execution_manifest's input field
                    exec_manifest = item / "execution_manifest.json"
                    if exec_manifest.exists():
                        with open(exec_manifest, 'r') as f:
                            exec_data = json.load(f)
                        # Data is nested inside 'input' object
                        input_data = exec_data.get("input", {})
                        paper_id = input_data.get("paper_id", "")
                        question = input_data.get("question_number", "")
                        completed_questions.add((paper_id, question))

    # Filter to only pending tasks
    pending_tasks = [t for t in all_tasks if (t.paper_id, t.question_number) not in completed_questions]

    print(f"\n{CYAN}Questions to resume:{RESET} {len(pending_tasks)}")
    if not pending_tasks:
        print(f"\n{GREEN}All questions have been completed!{RESET}")
        return 0

    # Update progress to in_progress
    progress_data["status"] = "in_progress"
    progress_data["updated_at"] = datetime.now().isoformat()
    with open(progress_file, 'w') as f:
        json.dump(progress_data, f, indent=2)

    # Process remaining questions
    max_concurrent = config_data.get("max_concurrent", 3)
    print(f"\n{CYAN}Resuming processing of {len(pending_tasks)} questions (max {max_concurrent} concurrent)...{RESET}\n")

    semaphore = asyncio.Semaphore(max_concurrent)
    mcp_config_path = config_data.get("mcp_config_path", ".mcp.json")

    new_completed = 0
    new_failed = 0

    for idx, task in enumerate(pending_tasks):
        # Build batch context for nested workspace
        batch_context = {
            "batch_id": batch_id,
            "batch_dir": str(batch_dir),
            "batch_index": completed_count + idx,
            "batch_total": total_count
        }

        r = await process_single_question(
            task=task,
            mcp_config_path=mcp_config_path,
            semaphore=semaphore,
            batch_context=batch_context
        )

        current_total = completed_count + new_completed + new_failed + 1
        if r.get("success"):
            new_completed += 1
            print(f"{GREEN}✓{RESET} [{current_total}/{total_count}] {r['paper_id']} Q{r['question_number']}")
        else:
            new_failed += 1
            print(f"{RED}✗{RESET} [{current_total}/{total_count}] {r['paper_id']} Q{r['question_number']}: {r.get('error', 'Unknown error')}")

            # Record failure with resilience wrapper
            try:
                _append_failed_question(
                    batch_dir=batch_dir,
                    batch_id=batch_id,
                    task=task,
                    result=r,
                    execution_id=r.get("execution_id"),
                    workspace_path=r.get("workspace_path")
                )
            except Exception as record_error:
                logger.error(f"Failed to record failure: {record_error}")

        # Update progress
        _update_batch_progress(
            batch_dir=batch_dir,
            completed=completed_count + new_completed,
            failed=failed_count + new_failed,
            skipped=counts.get("skipped", 0),
            pending=pending_count - (new_completed + new_failed),
            last_completed={
                "paper_id": r["paper_id"],
                "question_number": r["question_number"],
                "execution_id": r.get("execution_id"),
                "success": r.get("success", False)
            }
        )

    # Finalize
    final_status = BatchStatus.COMPLETED if (failed_count + new_failed) == 0 else BatchStatus.COMPLETED_WITH_ERRORS
    _finalize_batch_progress(batch_dir, final_status)

    # Summary
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}RESUME COMPLETE{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    print(f"{CYAN}Results:{RESET}")
    print(f"  Previously completed: {completed_count}")
    print(f"  Newly completed: {GREEN}{new_completed}{RESET}")
    print(f"  Newly failed: {RED}{new_failed}{RESET}")
    print(f"  Total completed: {GREEN}{completed_count + new_completed}{RESET} / {total_count}")

    return 0 if new_failed == 0 else 1


# =============================================================================
# Main Entry Point
# =============================================================================

async def main_async() -> int:
    """Main async entry point.

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    args = parse_arguments()

    # Setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Handle discover mode (before validation that requires --subject)
    if args.discover:
        return await run_discovery_mode(args)

    # Handle retry-failed mode
    if args.retry_failed:
        return await run_retry_failed_mode(args)

    # Handle resume mode
    if args.resume:
        return await run_resume_mode(args)

    # Handle single-question mode
    if args.question:
        if not args.paper_id:
            print(f"{RED}Error: --question requires --paper-id{RESET}")
            return 1
        return await run_single_question_mode(args)

    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Batch Walkthrough Generator{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")

    # Validate arguments for generation mode
    if not args.paper_id and not args.subject:
        print(f"{RED}Error: Must specify --paper-id or --subject{RESET}")
        return 1

    # Display filter info
    print(f"{CYAN}Filter:{RESET}")
    if args.paper_id:
        print(f"  Paper ID: {args.paper_id}")
    else:
        print(f"  Subject: {args.subject or 'All'}")
        print(f"  Level: {args.level or 'All'}")
        print(f"  Year: {args.year or 'All'}")
    print(f"  Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE'}")
    print(f"  Force: {args.force}")
    print()

    try:
        # Fetch papers
        print(f"{CYAN}Fetching papers...{RESET}")
        papers = await fetch_papers(
            subject=args.subject,
            level=args.level,
            year=args.year,
            paper_id=args.paper_id,
            mcp_config_path=args.mcp_config
        )

        if not papers:
            print(f"{YELLOW}No papers found matching criteria{RESET}")
            return 0

        print(f"{GREEN}Found {len(papers)} papers{RESET}")

        # Extract questions
        print(f"{CYAN}Extracting questions...{RESET}")
        summaries = extract_questions_from_papers(papers)

        total_questions = sum(len(s.questions) for s in summaries)
        print(f"{GREEN}Found {total_questions} questions with solutions{RESET}")

        # Check existing walkthroughs
        # Always check in dry-run mode (to show what exists)
        # Also check in normal mode when not --force (to skip existing)
        if args.dry_run or not args.force:
            summaries = await check_existing_walkthroughs(summaries, args.mcp_config)

        # Dry-run or execute
        if args.dry_run:
            display_dry_run_summary(summaries, force=args.force)
            return 0
        else:
            result = await run_batch_processing(
                summaries=summaries,
                mcp_config_path=args.mcp_config,
                max_concurrent=args.max_concurrent,
                force=args.force,
                args=args
            )
            display_batch_result(result)
            return 0 if result.failed == 0 else 1

    except Exception as e:
        logger.exception(f"Batch processing failed: {e}")
        print(f"\n{RED}Error: {e}{RESET}")
        return 1


def main():
    """Main synchronous entry point."""
    sys.exit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()
