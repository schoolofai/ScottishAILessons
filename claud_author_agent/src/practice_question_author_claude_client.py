"""Main Practice Question Author Claude Agent implementation.

Orchestrates offline practice question generation for the Infinite Practice V2 system.
Extracts concept blocks from lesson templates and generates questions at multiple
difficulty levels using Claude Agent SDK.

Pipeline:
1. Fetch lesson template from Appwrite
2. Extract concept blocks (PracticeBlockAgent)
3. Generate questions per block/difficulty (PracticeQuestionGeneratorAgent)
3.5. Diagram Classification & Generation (AUTOMATIC based on existence check)
4. Persist to Appwrite (PracticeQuestionUpserter)

Simplified CLI Behavior (no --generate-diagrams flag needed):
- Nothing exists → Full pipeline (blocks + questions + diagrams)
- Content exists, no diagrams → Diagrams only
- Everything exists → Skip all (nothing to do)
- --regenerate → Delete everything and regenerate everything
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from .utils.filesystem import IsolatedFilesystem
from .utils.appwrite_mcp import get_appwrite_document
from .utils.compression import decompress_json_gzip_base64
from .utils.logging_config import setup_logging, add_workspace_file_handler, remove_workspace_file_handler
from .agents.practice_block_agent import PracticeBlockAgent
from .agents.practice_question_generator_agent import PracticeQuestionGeneratorAgent
from .utils.practice_question_upserter import run_practice_content_upsert, PracticeQuestionUpserter
from .utils.question_to_classifier_adapter import process_question_diagrams
from .models.practice_question_models import (
    BlockExtractionResult,
    QuestionGenerationResult
)

logger = logging.getLogger(__name__)


# Default question counts per difficulty per block
DEFAULT_QUESTIONS_PER_DIFFICULTY = {
    "easy": 5,
    "medium": 5,
    "hard": 3
}


class PracticeQuestionAuthorClaudeClient:
    """Offline practice question generator for Infinite Practice V2.

    Pipeline:
    1. Fetch lesson template from Appwrite (Python utility)
    2. Extract concept blocks (PracticeBlockAgent - Claude Agent SDK)
    3. Generate questions per block/difficulty (PracticeQuestionGeneratorAgent)
    4. Persist to Appwrite (PracticeQuestionUpserter - Python utility)

    Architecture Notes:
        - All Appwrite operations are in Python (deterministic, no LLM needed)
        - LLM agents only handle creative tasks (block extraction, question generation)
        - Content hashing for deduplication - skip if content unchanged
        - Fail-fast pattern - no fallback mechanisms
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        questions_per_difficulty: Optional[Dict[str, int]] = None,
        log_level: str = "INFO"
    ):
        """Initialize Practice Question Author agent.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            questions_per_difficulty: Dict of difficulty -> count per block
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)

        Note:
            Diagrams are generated AUTOMATICALLY based on existence check:
            - If content exists but no diagrams → run diagram pipeline only
            - If nothing exists → full pipeline including diagrams
            - If everything exists → skip all
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.questions_per_difficulty = questions_per_difficulty or DEFAULT_QUESTIONS_PER_DIFFICULTY

        # Generate execution ID (timestamp-based)
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Setup logging
        setup_logging(log_level=log_level)

        # Calculate expected questions per lesson
        total_questions_per_block = sum(self.questions_per_difficulty.values())
        logger.info(f"Initialized PracticeQuestionAuthorClaudeClient")
        logger.info(f"   Execution ID: {self.execution_id}")
        logger.info(f"   Questions per block: {total_questions_per_block}")
        logger.info(f"   Per difficulty: {self.questions_per_difficulty}")
        logger.info(f"   Diagrams: AUTOMATIC (based on existence check)")

    async def execute(
        self,
        lesson_template_id: str,
        regenerate: bool = False
    ) -> Dict[str, Any]:
        """Execute practice question generation for a lesson template.

        Simplified automatic behavior (no --generate-diagrams flag needed):
        - With --regenerate: DELETE everything → Full pipeline (blocks + questions + diagrams)
        - Without --regenerate: CHECK existence →
            - Nothing exists → Full pipeline (blocks + questions + diagrams)
            - Content exists, no diagrams → Diagrams only
            - Everything exists → Skip all (nothing to do)

        Args:
            lesson_template_id: Lesson template document ID from Appwrite
            regenerate: If True, delete all existing content and regenerate

        Returns:
            Dictionary containing execution results and statistics

        Raises:
            ValueError: If lesson template not found
            RuntimeError: If agent pipeline fails
        """
        logger.info("=" * 70)
        logger.info("PRACTICE QUESTION AUTHOR - Starting execution")
        logger.info(f"   Lesson Template ID: {lesson_template_id}")
        logger.info(f"   Execution ID: {self.execution_id}")
        logger.info(f"   Regenerate: {regenerate}")
        logger.info(f"   Diagrams: AUTOMATIC")
        logger.info("=" * 70)

        # Create isolated workspace using context manager pattern
        filesystem = IsolatedFilesystem(
            execution_id=self.execution_id,
            persist=self.persist_workspace,
            workspace_type="practice_questions"
        )

        workspace_path = None  # Initialize for finally block safety
        try:
            workspace_path = filesystem.setup()
            logger.info(f"Workspace created: {workspace_path}")

            # Add file handler to capture ALL logs to workspace
            # This persists all agent activity for observability and analytics
            log_file = add_workspace_file_handler(
                workspace_path=workspace_path,
                log_filename="full_run.log",  # Detailed logs (run.log is summary)
                log_level="DEBUG"
            )
            logger.info(f"📝 Full logging enabled: {log_file}")

            # Initialize upserter for content checks and operations
            upserter = PracticeQuestionUpserter(str(self.mcp_config_path))

            # ═══════════════════════════════════════════════════════════════
            # BRANCHING LOGIC: 3-way check based on existence
            # ═══════════════════════════════════════════════════════════════
            execution_mode = None  # "full_pipeline" | "diagrams_only" | "skip_all"
            existing_questions = None

            if regenerate:
                # --regenerate: Delete everything and run full pipeline
                logger.info("\n🗑️ REGENERATE MODE: Deleting all existing content...")
                deleted_counts = await upserter.delete_lesson_content(lesson_template_id)
                logger.info(
                    f"   Deleted {deleted_counts['blocks']} blocks, "
                    f"{deleted_counts['questions']} questions, "
                    f"{deleted_counts['storage_files']} storage files"
                )
                execution_mode = "full_pipeline"
            else:
                # Check content and diagram existence
                content_exists, block_count, question_count, diagrams_exist = \
                    await upserter.check_content_exists(lesson_template_id)

                if not content_exists:
                    # Scenario 1: Nothing exists → Full pipeline
                    logger.info("\n🆕 NO EXISTING CONTENT: Running full pipeline...")
                    execution_mode = "full_pipeline"

                elif content_exists and not diagrams_exist:
                    # Scenario 2: Content exists but no diagrams → Diagrams only
                    logger.info(
                        f"\n📂 CONTENT EXISTS ({block_count} blocks, {question_count} questions) "
                        f"BUT NO DIAGRAMS"
                    )
                    logger.info("   Running diagram pipeline only...")
                    execution_mode = "diagrams_only"
                    existing_questions = await upserter.load_existing_questions(
                        lesson_template_id
                    )

                else:
                    # Scenario 3: Everything exists → Skip all
                    logger.info(
                        f"\n✅ EVERYTHING EXISTS: {block_count} blocks, "
                        f"{question_count} questions, diagrams present"
                    )
                    logger.info("   Nothing to do, skipping...")
                    execution_mode = "skip_all"

            # ═══════════════════════════════════════════════════════════════
            # EXECUTION PATH A: Full Pipeline (first run or regenerate)
            # ═══════════════════════════════════════════════════════════════
            if execution_mode == "full_pipeline":
                result = await self._run_full_pipeline(
                    lesson_template_id=lesson_template_id,
                    workspace_path=workspace_path,
                    upserter=upserter
                )
                return result

            # ═══════════════════════════════════════════════════════════════
            # EXECUTION PATH B: Diagrams Only (content exists, no diagrams)
            # ═══════════════════════════════════════════════════════════════
            elif execution_mode == "diagrams_only":
                questions = existing_questions
                diagrams_generated = 0

                logger.info("\n--- Phase 3.5: Diagram Processing (EXISTING QUESTIONS) ---")

                # Need lesson template for subject/level metadata
                lesson_template = await self._fetch_lesson_template(lesson_template_id)
                lesson_title = lesson_template.get("title", "Untitled")
                subject = lesson_template.get("courseSubject", "mathematics")
                level = lesson_template.get("courseLevel", "national-3")
                logger.info(f"   Subject: {subject}, Level: {level}")

                # Run diagram classification and generation
                questions = await process_question_diagrams(
                    workspace_path=workspace_path,
                    questions=questions,
                    lesson_template_id=lesson_template_id,
                    execution_id=self.execution_id,
                    subject=subject,
                    level=level,
                    run_diagram_author=True,
                    mcp_config_path=str(self.mcp_config_path)
                )

                # Count successfully generated diagrams
                diagrams_generated = sum(1 for q in questions if q.diagram_file_id)
                logger.info(f"✅ Generated {diagrams_generated} diagrams")

                # Phase 4: Update ONLY diagram fields (not full upsert)
                if diagrams_generated > 0:
                    logger.info("\n--- Phase 4: Updating diagram fields only ---")
                    updated_count = await upserter.update_diagram_fields(questions)
                    logger.info(f"✅ Updated diagram fields for {updated_count} questions")

                # Success result for diagrams-only path
                logger.info("\n" + "=" * 70)
                logger.info("PRACTICE QUESTION AUTHOR - Complete (Diagrams Only)")
                logger.info("=" * 70)

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "lesson_template_id": lesson_template_id,
                    "lesson_title": lesson_title,
                    "blocks_extracted": 0,
                    "questions_generated": 0,
                    "questions_loaded": len(questions),
                    "questions_by_difficulty": {},
                    "diagrams_generated": diagrams_generated,
                    "blocks_upserted": 0,
                    "questions_upserted": 0,
                    "diagrams_only_mode": True
                }

            # ═══════════════════════════════════════════════════════════════
            # EXECUTION PATH C: Skip All (everything exists)
            # ═══════════════════════════════════════════════════════════════
            else:  # execution_mode == "skip_all"
                logger.info("\n" + "=" * 70)
                logger.info("PRACTICE QUESTION AUTHOR - Complete (Nothing To Do)")
                logger.info("=" * 70)

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "lesson_template_id": lesson_template_id,
                    "lesson_title": "Existing Lesson",
                    "blocks_extracted": 0,
                    "questions_generated": 0,
                    "questions_loaded": 0,
                    "questions_by_difficulty": {},
                    "diagrams_generated": 0,
                    "blocks_upserted": 0,
                    "questions_upserted": 0,
                    "skip_all_mode": True
                }

        except Exception as e:
            logger.error(f"❌ Pipeline failed: {e}", exc_info=True)
            return {
                "success": False,
                "execution_id": self.execution_id,
                "workspace_path": str(filesystem.root) if filesystem.root else None,
                "lesson_template_id": lesson_template_id,
                "error": str(e)
            }

        finally:
            # Remove file handler to prevent handler accumulation
            if workspace_path:
                remove_workspace_file_handler(workspace_path)

            if not self.persist_workspace:
                filesystem.cleanup()

    async def _run_full_pipeline(
        self,
        lesson_template_id: str,
        workspace_path: Path,
        upserter: PracticeQuestionUpserter
    ) -> Dict[str, Any]:
        """Run the full generation pipeline (blocks → questions → diagrams → upsert).

        Args:
            lesson_template_id: Lesson template document ID
            workspace_path: Path to workspace directory
            upserter: Initialized upserter instance

        Returns:
            Execution result dictionary
        """
        # Phase 1: Fetch lesson template from Appwrite
        logger.info("\n--- Phase 1: Fetch Lesson Template ---")
        lesson_template = await self._fetch_lesson_template(lesson_template_id)
        logger.info(f"✅ Fetched lesson: {lesson_template.get('title', 'Untitled')}")

        # Phase 1.5: Fetch Course Outcomes (for curriculum scope constraints)
        logger.info("\n--- Phase 1.5: Fetch Course Outcomes ---")
        course_id = lesson_template.get("courseId", "")
        subject = lesson_template.get("courseSubject", "mathematics")
        level = lesson_template.get("courseLevel", "national-3")

        if not course_id:
            raise ValueError(
                f"lesson_template '{lesson_template_id}' missing 'courseId'. "
                f"Cannot fetch course outcomes without courseId. "
                f"Ensure the lesson template has courseId field populated."
            )

        # Reuse existing course outcomes extractor
        from .utils.course_outcomes_extractor import extract_course_outcomes_to_file

        outcomes_file = workspace_path / "Course_outcomes.json"
        course_outcomes_data = await extract_course_outcomes_to_file(
            courseId=course_id,
            mcp_config_path=str(self.mcp_config_path),
            output_path=outcomes_file
        )

        logger.info(f"✅ Fetched {len(course_outcomes_data['outcomes'])} course outcomes")
        logger.info(f"   Course: {subject} ({level}), SQA Code: {course_outcomes_data.get('courseSqaCode', 'N/A')}")

        # Phase 2: Extract concept blocks
        logger.info("\n--- Phase 2: Extract Concept Blocks ---")
        block_agent = PracticeBlockAgent(workspace_path=workspace_path)
        block_result = await block_agent.execute(
            lesson_template_id=lesson_template_id,
            lesson_template=lesson_template
        )

        extraction_result: BlockExtractionResult = block_result["extraction_result"]
        blocks = extraction_result.blocks
        logger.info(f"✅ Extracted {len(blocks)} concept blocks")

        # Phase 3: Generate questions for each block
        logger.info("\n--- Phase 3: Generate Practice Questions ---")
        question_agent = PracticeQuestionGeneratorAgent(
            workspace_path=workspace_path,
            questions_per_difficulty=self.questions_per_difficulty,
            # Course context for curriculum scope constraints
            course_subject=subject,
            course_level=level,
            course_outcomes=course_outcomes_data['outcomes']
        )

        generation_result_dict = await question_agent.execute(
            lesson_template_id=lesson_template_id,
            blocks=blocks,
            execution_id=self.execution_id
        )

        generation_result: QuestionGenerationResult = generation_result_dict["generation_result"]
        questions = generation_result.questions
        logger.info(f"✅ Generated {len(questions)} questions")
        logger.info(f"   By difficulty: {generation_result.questions_by_difficulty}")

        # Phase 3.5: Diagram Processing (AUTOMATIC - always runs in full pipeline)
        logger.info("\n--- Phase 3.5: Diagram Classification & Generation ---")
        diagrams_generated = 0
        # Note: subject and level already extracted in Phase 1.5

        # Run diagram classification and generation for all questions
        questions = await process_question_diagrams(
            workspace_path=workspace_path,
            questions=questions,
            lesson_template_id=lesson_template_id,
            execution_id=self.execution_id,
            subject=subject,
            level=level,
            run_diagram_author=True,
            mcp_config_path=str(self.mcp_config_path)
        )

        # Count successfully generated diagrams
        diagrams_generated = sum(1 for q in questions if q.diagram_file_id)
        logger.info(f"✅ Generated {diagrams_generated} diagrams")

        # Phase 4: Upsert to Appwrite
        logger.info("\n--- Phase 4: Persist to Appwrite ---")
        upsert_result = await run_practice_content_upsert(
            mcp_config_path=str(self.mcp_config_path),
            lesson_template_id=lesson_template_id,
            blocks=blocks,
            questions=questions,
            execution_id=self.execution_id
        )
        logger.info(f"✅ Persisted {upsert_result['blocks_upserted']} blocks")
        logger.info(f"✅ Persisted {upsert_result['questions_upserted']} questions")

        # Success result
        logger.info("\n" + "=" * 70)
        logger.info("PRACTICE QUESTION AUTHOR - Complete (Full Pipeline)")
        logger.info("=" * 70)

        return {
            "success": True,
            "execution_id": self.execution_id,
            "workspace_path": str(workspace_path),
            "lesson_template_id": lesson_template_id,
            "lesson_title": lesson_template.get("title", "Untitled"),
            "blocks_extracted": len(blocks),
            "questions_generated": len(questions),
            "questions_by_difficulty": generation_result.questions_by_difficulty,
            "diagrams_generated": diagrams_generated,
            "blocks_upserted": upsert_result["blocks_upserted"],
            "questions_upserted": upsert_result["questions_upserted"],
            "diagrams_only_mode": False
        }

    async def _prescan_lessons(
        self,
        lesson_templates: List[Dict[str, Any]],
        regenerate: bool
    ) -> Dict[str, Dict[str, Any]]:
        """Pre-scan all lessons to determine execution mode for each.

        Args:
            lesson_templates: List of lesson template documents
            regenerate: Whether --regenerate flag was passed

        Returns:
            Dict mapping lesson_id -> scan result with mode and counts
        """
        upserter = PracticeQuestionUpserter(str(self.mcp_config_path))
        scan_results = {}

        for idx, lesson in enumerate(lesson_templates):
            lesson_id = lesson.get("$id")
            lesson_title = lesson.get("title", "Untitled")

            if regenerate:
                # Force full_pipeline for all lessons when regenerating
                scan_results[lesson_id] = {
                    "mode": "full_pipeline",
                    "title": lesson_title,
                    "blocks": 0,
                    "questions": 0,
                    "diagrams": False,
                    "reason": "REGENERATE flag set"
                }
            else:
                # Check content existence
                content_exists, block_count, question_count, diagrams_exist = \
                    await upserter.check_content_exists(lesson_id)

                if not content_exists:
                    mode = "full_pipeline"
                    reason = "No existing content"
                elif content_exists and not diagrams_exist:
                    mode = "diagrams_only"
                    reason = f"Has {question_count} questions, no diagrams"
                else:
                    mode = "skip"
                    reason = f"Complete ({block_count} blocks, {question_count} questions, has diagrams)"

                scan_results[lesson_id] = {
                    "mode": mode,
                    "title": lesson_title,
                    "blocks": block_count,
                    "questions": question_count,
                    "diagrams": diagrams_exist,
                    "reason": reason
                }

            # Progress indicator
            logger.info(f"   [{idx + 1}/{len(lesson_templates)}] {lesson_title[:40]:<40} → {scan_results[lesson_id]['mode'].upper()}")

        return scan_results

    def _print_batch_plan(
        self,
        lesson_templates: List[Dict[str, Any]],
        scan_results: Dict[str, Dict[str, Any]],
        regenerate: bool
    ) -> None:
        """Print a clear summary table showing what will be processed vs skipped.

        Args:
            lesson_templates: List of lesson template documents
            scan_results: Pre-scan results from _prescan_lessons
            regenerate: Whether regenerate flag was set
        """
        # Count by mode
        full_count = sum(1 for r in scan_results.values() if r["mode"] == "full_pipeline")
        diagrams_count = sum(1 for r in scan_results.values() if r["mode"] == "diagrams_only")
        skip_count = sum(1 for r in scan_results.values() if r["mode"] == "skip")

        print()
        print("=" * 80)
        print("                         BATCH EXECUTION PLAN")
        print("=" * 80)
        print()
        print(f"  {'#':<4} {'Lesson Title':<45} {'Mode':<18} {'Reason'}")
        print("  " + "-" * 76)

        for idx, lesson in enumerate(lesson_templates):
            lesson_id = lesson.get("$id")
            result = scan_results[lesson_id]
            title = result["title"][:43] + ".." if len(result["title"]) > 45 else result["title"]

            # Mode with emoji
            mode = result["mode"]
            if mode == "full_pipeline":
                mode_display = "🆕 GENERATE"
            elif mode == "diagrams_only":
                mode_display = "📊 DIAGRAMS"
            else:
                mode_display = "⏭️  SKIP"

            reason = result["reason"][:30] if len(result["reason"]) > 30 else result["reason"]

            print(f"  {idx + 1:<4} {title:<45} {mode_display:<18} {reason}")

        print()
        print("  " + "-" * 76)
        print(f"  SUMMARY: {full_count} to generate, {diagrams_count} diagrams only, {skip_count} to skip")
        print("=" * 80)
        print()

        # Log to file as well
        logger.info(f"\nBatch Plan Summary: {full_count} generate, {diagrams_count} diagrams, {skip_count} skip")

    async def _write_lesson_run_log(
        self,
        execution_id: str,
        log_entries: List[str]
    ) -> None:
        """Write run.log file to the lesson workspace folder.

        Args:
            execution_id: The execution ID (contains batch_folder/lesson_XX_id path)
            log_entries: List of log entry strings to write
        """
        # Construct workspace path
        workspace_base = Path(__file__).parent.parent / "workspace"
        workspace_path = workspace_base / execution_id

        # Ensure workspace exists (it should, created by execute())
        if not workspace_path.exists():
            workspace_path.mkdir(parents=True, exist_ok=True)

        # Write run.log
        log_file = workspace_path / "run.log"
        log_content = "\n".join(log_entries)

        log_file.write_text(log_content, encoding='utf-8')
        logger.debug(f"Written run.log to {log_file}")

    async def execute_batch(
        self,
        course_id: str,
        regenerate: bool = False,
        max_concurrent: int = 3
    ) -> Dict[str, Any]:
        """Generate practice questions for ALL lessons in a course (PARALLEL).

        Same automatic behavior as single lesson mode, applied per-lesson:
        - With --regenerate: Delete and regenerate everything for ALL lessons
        - Without flag: Per-lesson smart check:
            - Nothing exists → Full pipeline
            - Content exists, no diagrams → Diagrams only
            - Everything exists → Skip all

        Parallel Execution:
            Uses asyncio.Semaphore to limit concurrent executions to max_concurrent.
            This prevents Appwrite rate limit issues (60 req/min free, 300 req/min pro).

        Workspace Structure:
            workspace/
            └── batch_20251215_120000/
                ├── lesson_01_lt_abc123/
                │   ├── lesson_template.json
                │   ├── blocks_output.json
                │   ├── questions_output.json
                │   └── run.log              # Per-lesson agent output log
                ├── lesson_02_lt_def456/
                │   └── ...
                └── batch_summary.json

        Args:
            course_id: Course ID to process all lessons for
            regenerate: If True, delete and regenerate all content for all lessons
            max_concurrent: Maximum parallel executions (default 3 for rate limit safety)

        Returns:
            Dict with batch results and statistics
        """
        # Generate batch-level ID for parent folder
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        batch_folder = f"batch_{batch_id}"

        execution_mode = "PARALLEL" if max_concurrent > 1 else "SEQUENTIAL"
        logger.info("=" * 70)
        logger.info(f"PRACTICE QUESTION AUTHOR - Batch Execution ({execution_mode})")
        logger.info(f"   Course ID: {course_id}")
        logger.info(f"   Batch ID: {batch_id}")
        logger.info(f"   Workspace: workspace/{batch_folder}/")
        logger.info(f"   Regenerate: {regenerate}")
        logger.info(f"   Execution: {execution_mode}" + (f" (max {max_concurrent})" if max_concurrent > 1 else ""))
        logger.info(f"   Mode: {'DELETE ALL + FULL PIPELINE' if regenerate else 'SMART AUTO-DETECT'}")
        logger.info("=" * 70)

        # Fetch all lesson templates for this course
        all_lessons = await self._fetch_lessons_by_course(course_id)

        if not all_lessons:
            raise ValueError(f"No lesson templates found for course: {course_id}")

        # Filter to "teach" and "revision" type lessons (practice questions for learning content)
        # Excludes: mock_exam, assessment, intro types
        ELIGIBLE_LESSON_TYPES = {"teach", "revision"}
        lesson_templates = [
            lesson for lesson in all_lessons
            if lesson.get("lesson_type", "teach") in ELIGIBLE_LESSON_TYPES
        ]

        logger.info(f"Found {len(all_lessons)} total lessons, {len(lesson_templates)} are 'teach' or 'revision' type")

        if not lesson_templates:
            raise ValueError(
                f"No 'teach' or 'revision' type lessons found for course: {course_id}. "
                f"Total lessons: {len(all_lessons)}"
            )

        # ═══════════════════════════════════════════════════════════════
        # PRE-SCAN PHASE: Categorize lessons before execution
        # ═══════════════════════════════════════════════════════════════
        logger.info("\n" + "=" * 70)
        logger.info("PRE-SCAN: Checking existing content for all lessons...")
        logger.info("=" * 70)

        scan_results = await self._prescan_lessons(lesson_templates, regenerate)

        # Print clear summary table
        self._print_batch_plan(lesson_templates, scan_results, regenerate)

        logger.info(f"\nWorkspace structure: workspace/{batch_folder}/lesson_NN_<id>/")
        if max_concurrent > 1:
            logger.info(f"🚀 Running lessons in parallel (max {max_concurrent} concurrent)...")
        else:
            logger.info("🚀 Running lessons sequentially...")

        # Create semaphore for rate limiting
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_lesson_with_semaphore(
            idx: int,
            lesson: Dict[str, Any]
        ) -> Dict[str, Any]:
            """Process a single lesson with semaphore-controlled concurrency.

            Each task gets its own execution_id for workspace isolation.
            Writes run.log to the lesson workspace folder upon completion.
            """
            async with semaphore:
                lesson_id = lesson.get("$id")
                lesson_title = lesson.get("title", "Untitled")
                scan_info = scan_results.get(lesson_id, {})

                # Generate per-lesson execution_id as subfolder of batch
                # Format: batch_20251215_120000/lesson_01_lt_abc123
                lesson_short_id = lesson_id[:12] if len(lesson_id) > 12 else lesson_id
                execution_id = f"{batch_folder}/lesson_{idx + 1:02d}_{lesson_short_id}"

                logger.info(f"\n🔄 [{idx + 1}/{len(lesson_templates)}] Starting: {lesson_title}")
                logger.info(f"   Workspace: workspace/{execution_id}/")
                logger.info(f"   Mode: {scan_info.get('mode', 'unknown').upper()}")

                # Capture log entries for this lesson
                log_entries = []
                start_time = datetime.now()
                log_entries.append(f"{'=' * 70}")
                log_entries.append(f"PRACTICE QUESTION AUTHOR - Lesson Execution Log")
                log_entries.append(f"{'=' * 70}")
                log_entries.append(f"Lesson ID:     {lesson_id}")
                log_entries.append(f"Lesson Title:  {lesson_title}")
                log_entries.append(f"Execution ID:  {execution_id}")
                log_entries.append(f"Start Time:    {start_time.isoformat()}")
                log_entries.append(f"Pre-scan Mode: {scan_info.get('mode', 'unknown').upper()}")
                log_entries.append(f"Pre-scan Info: {scan_info.get('reason', 'N/A')}")
                log_entries.append(f"{'=' * 70}")
                log_entries.append("")

                try:
                    # Create a new client instance for this task to avoid shared state
                    # This ensures workspace isolation and thread safety
                    task_client = PracticeQuestionAuthorClaudeClient(
                        mcp_config_path=str(self.mcp_config_path),
                        persist_workspace=self.persist_workspace,
                        questions_per_difficulty=self.questions_per_difficulty,
                        log_level="INFO"
                    )
                    # Override execution_id for this specific lesson
                    task_client.execution_id = execution_id

                    result = await task_client.execute(
                        lesson_template_id=lesson_id,
                        regenerate=regenerate
                    )

                    # Add lesson metadata to result
                    result["lesson_index"] = idx + 1
                    result["lesson_title"] = lesson_title

                    end_time = datetime.now()
                    duration = (end_time - start_time).total_seconds()

                    if result["success"]:
                        logger.info(f"✅ [{idx + 1}/{len(lesson_templates)}] Complete: {lesson_title}")
                        log_entries.append(f"STATUS: SUCCESS")
                    else:
                        logger.error(f"❌ [{idx + 1}/{len(lesson_templates)}] Failed: {lesson_title}")
                        log_entries.append(f"STATUS: FAILED")
                        log_entries.append(f"ERROR: {result.get('error', 'Unknown')}")

                    # Add execution details to log
                    log_entries.append(f"End Time:      {end_time.isoformat()}")
                    log_entries.append(f"Duration:      {duration:.1f} seconds")
                    log_entries.append("")
                    log_entries.append("EXECUTION RESULTS:")
                    log_entries.append(f"  Blocks Extracted:    {result.get('blocks_extracted', 0)}")
                    log_entries.append(f"  Questions Generated: {result.get('questions_generated', 0)}")
                    log_entries.append(f"  Diagrams Generated:  {result.get('diagrams_generated', 0)}")
                    log_entries.append(f"  Blocks Upserted:     {result.get('blocks_upserted', 0)}")
                    log_entries.append(f"  Questions Upserted:  {result.get('questions_upserted', 0)}")

                    if result.get('skip_all_mode'):
                        log_entries.append("")
                        log_entries.append("MODE: SKIP_ALL - All content already exists")
                    elif result.get('diagrams_only_mode'):
                        log_entries.append("")
                        log_entries.append("MODE: DIAGRAMS_ONLY - Generated diagrams for existing questions")

                    # Write run.log to workspace
                    await self._write_lesson_run_log(execution_id, log_entries)

                    return result

                except Exception as e:
                    logger.error(f"❌ [{idx + 1}/{len(lesson_templates)}] Exception: {lesson_title}: {e}")

                    # Log exception details
                    end_time = datetime.now()
                    duration = (end_time - start_time).total_seconds()
                    log_entries.append(f"STATUS: EXCEPTION")
                    log_entries.append(f"ERROR: {str(e)}")
                    log_entries.append(f"End Time: {end_time.isoformat()}")
                    log_entries.append(f"Duration: {duration:.1f} seconds")

                    # Try to write log even on failure
                    try:
                        await self._write_lesson_run_log(execution_id, log_entries)
                    except Exception:
                        pass  # Don't fail if we can't write the log

                    return {
                        "success": False,
                        "lesson_template_id": lesson_id,
                        "lesson_title": lesson_title,
                        "lesson_index": idx + 1,
                        "error": str(e)
                    }

        # Create all tasks
        tasks = [
            process_lesson_with_semaphore(idx, lesson)
            for idx, lesson in enumerate(lesson_templates)
        ]

        # Execute all tasks in parallel (limited by semaphore)
        # return_exceptions=True ensures we get all results even if some fail
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results (handle any unexpected exceptions from gather)
        processed_results = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                # This shouldn't happen with try/except in process_lesson_with_semaphore
                # but handle it just in case
                lesson = lesson_templates[idx]
                processed_results.append({
                    "success": False,
                    "lesson_template_id": lesson.get("$id"),
                    "lesson_title": lesson.get("title", "Untitled"),
                    "lesson_index": idx + 1,
                    "error": str(result)
                })
            else:
                processed_results.append(result)

        # Calculate statistics
        success_count = sum(1 for r in processed_results if r.get("success", False))
        total_questions = 0
        total_blocks = 0
        total_diagrams = 0
        lessons_full_pipeline = 0
        lessons_diagrams_only = 0
        lessons_skipped = 0

        for result in processed_results:
            if result.get("success"):
                if result.get("skip_all_mode"):
                    lessons_skipped += 1
                elif result.get("diagrams_only_mode"):
                    lessons_diagrams_only += 1
                    total_diagrams += result.get("diagrams_generated", 0)
                else:
                    # Full pipeline
                    lessons_full_pipeline += 1
                    total_questions += result.get("questions_generated", 0)
                    total_blocks += result.get("blocks_extracted", 0)
                    total_diagrams += result.get("diagrams_generated", 0)

        # Build batch summary result
        batch_result = {
            "success": success_count == len(processed_results),
            "batch_id": batch_id,
            "batch_folder": batch_folder,
            "course_id": course_id,
            "max_concurrent": max_concurrent,
            "lessons_processed": len(processed_results),
            "lessons_succeeded": success_count,
            "lessons_failed": len(processed_results) - success_count,
            "lessons_full_pipeline": lessons_full_pipeline,
            "lessons_diagrams_only": lessons_diagrams_only,
            "lessons_skipped": lessons_skipped,
            "total_blocks": total_blocks,
            "total_questions": total_questions,
            "total_diagrams": total_diagrams,
            "results": processed_results
        }

        # Write batch summary file to batch folder
        batch_workspace_path = Path(__file__).parent.parent / "workspace" / batch_folder
        if batch_workspace_path.exists():
            summary_path = batch_workspace_path / "batch_summary.json"
            summary_path.write_text(json.dumps(batch_result, indent=2, default=str))
            logger.info(f"Batch summary written to: {summary_path}")

        # Log batch summary
        logger.info("\n" + "=" * 70)
        logger.info(f"BATCH EXECUTION SUMMARY ({execution_mode})")
        logger.info("=" * 70)
        logger.info(f"   Batch folder:      workspace/{batch_folder}/")
        logger.info(f"   Execution:         {execution_mode}" + (f" (max {max_concurrent})" if max_concurrent > 1 else ""))
        logger.info(f"   Lessons processed: {len(processed_results)}")
        logger.info(f"   Full pipeline:     {lessons_full_pipeline}")
        logger.info(f"   Diagrams only:     {lessons_diagrams_only}")
        logger.info(f"   Skipped:           {lessons_skipped}")
        logger.info(f"   Failed:            {len(processed_results) - success_count}")
        logger.info("=" * 70)

        return batch_result

    async def _fetch_lesson_template(
        self,
        lesson_template_id: str
    ) -> Dict[str, Any]:
        """Fetch lesson template from Appwrite and decompress cards.

        Args:
            lesson_template_id: Document ID in lesson_templates collection

        Returns:
            Lesson template dict with decompressed cards

        Raises:
            ValueError: If lesson template not found
        """
        logger.info(f"Fetching lesson template: {lesson_template_id}")

        # Fetch from Appwrite
        lesson_template = await get_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            document_id=lesson_template_id,
            mcp_config_path=str(self.mcp_config_path)
        )

        if not lesson_template:
            raise ValueError(
                f"Lesson template not found: {lesson_template_id}. "
                f"Please verify the lesson exists in default.lesson_templates collection."
            )

        # Decompress cards if compressed
        cards = lesson_template.get("cards", [])
        if isinstance(cards, str):
            try:
                cards = decompress_json_gzip_base64(cards)
                lesson_template["cards"] = cards
                logger.info(f"Decompressed {len(cards)} cards")
            except ValueError as e:
                raise ValueError(
                    f"Failed to decompress cards for lesson {lesson_template_id}: {e}"
                )

        return lesson_template

    async def _fetch_lessons_by_course(
        self,
        course_id: str
    ) -> List[Dict[str, Any]]:
        """Fetch all lesson templates for a course.

        Args:
            course_id: Course ID to query

        Returns:
            List of lesson template documents
        """
        from .utils.appwrite_mcp import list_appwrite_documents

        lessons = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_templates",
            queries=[f'equal("courseId", "{course_id}")'],
            mcp_config_path=str(self.mcp_config_path)
        )

        # Sort by sow_order
        lessons_sorted = sorted(
            lessons,
            key=lambda l: l.get("sow_order", 0)
        )

        return lessons_sorted


async def run_practice_question_generation(
    lesson_template_id: str,
    mcp_config_path: str = ".mcp.json",
    questions_per_difficulty: Optional[Dict[str, int]] = None,
    persist_workspace: bool = True
) -> Dict[str, Any]:
    """Convenience function to run practice question generation.

    Diagrams are generated AUTOMATICALLY based on existence check.

    Args:
        lesson_template_id: Lesson template ID
        mcp_config_path: Path to MCP config
        questions_per_difficulty: Optional custom counts
        persist_workspace: Whether to preserve workspace

    Returns:
        Execution result dictionary
    """
    client = PracticeQuestionAuthorClaudeClient(
        mcp_config_path=mcp_config_path,
        questions_per_difficulty=questions_per_difficulty,
        persist_workspace=persist_workspace
    )

    return await client.execute(lesson_template_id)
