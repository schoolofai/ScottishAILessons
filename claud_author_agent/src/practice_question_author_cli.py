#!/usr/bin/env python3
"""CLI wrapper for Practice Question Author Claude Agent.

Automatic Behavior (Smart Generation):
- If NO content exists → Full pipeline (blocks + questions + diagrams)
- If content exists but NO diagrams → Diagrams only
- If EVERYTHING exists → Skip all (nothing to do)
- Use --regenerate to delete and regenerate everything

Supports three input methods:
1. JSON file: --input input.json
2. Command-line args: --lesson-id 68f51d0d0009edd1b817
3. Interactive prompts: (no args provided)

Also supports batch mode with parallel execution:
   --course-id course_c84474 --max-concurrent 3

Usage Examples:
    # Single lesson (auto-detects what needs generating)
    python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817

    # Batch mode - parallel execution (default: 3 concurrent)
    python -m src.practice_question_author_cli --course-id course_c84474

    # Batch mode with custom parallelism
    python -m src.practice_question_author_cli --course-id course_c84474 --max-concurrent 5

    # Delete everything and regenerate from scratch
    python -m src.practice_question_author_cli --lesson-id lt_abc123 --regenerate

    # Custom question counts
    python -m src.practice_question_author_cli --lesson-id lt_abc123 --easy 10 --medium 8 --hard 5
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any

from .practice_question_author_claude_client import PracticeQuestionAuthorClaudeClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_input_from_json(json_path: str) -> Dict[str, Any]:
    """Load input parameters from JSON file.

    Expected JSON format:
    {
        "lesson_template_id": "68f51d0d0009edd1b817"
    }

    Or for batch mode:
    {
        "course_id": "course_c84474"
    }

    Args:
        json_path: Path to JSON input file

    Returns:
        Dictionary with input parameters

    Raises:
        FileNotFoundError: If JSON file not found
        ValueError: If JSON is invalid or missing required fields
    """
    json_file = Path(json_path)

    if not json_file.exists():
        raise FileNotFoundError(f"Input JSON file not found: {json_path}")

    try:
        with open(json_file) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in input file: {e}")

    # Must have either lesson_template_id or course_id
    if "lesson_template_id" not in data and "course_id" not in data:
        raise ValueError(
            "Missing required field in JSON input. "
            "Expected either 'lesson_template_id' or 'course_id'."
        )

    return data


def interactive_input() -> Dict[str, Any]:
    """Prompt user for input parameters interactively.

    Returns:
        Dictionary with lesson_template_id or course_id
    """
    print("=" * 70)
    print("Practice Question Author - Interactive Input")
    print("=" * 70)
    print()
    print("Choose mode:")
    print("  1. Single lesson (provide lesson template ID)")
    print("  2. Batch mode (process all lessons in a course)")
    print()

    mode = input("Enter mode (1 or 2): ").strip()

    if mode == "1":
        print("\nLesson Template ID (e.g., '68f51d0d0009edd1b817'):")
        print("  (Must exist in default.lesson_templates collection)")
        lesson_id = input("  > ").strip()

        if not lesson_id:
            raise ValueError("Lesson Template ID cannot be empty")

        return {"lesson_template_id": lesson_id}

    elif mode == "2":
        print("\nCourse ID (e.g., 'course_c84474'):")
        print("  (Will process all lessons in this course)")
        course_id = input("  > ").strip()

        if not course_id:
            raise ValueError("Course ID cannot be empty")

        return {"course_id": course_id}

    else:
        raise ValueError(f"Invalid mode: {mode}. Enter 1 or 2.")


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Practice Question Author Claude Agent - CLI Wrapper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Smart Automatic Behavior:
  - If NO content exists     → Full pipeline (blocks + questions + diagrams)
  - If content but NO diagrams → Diagrams only
  - If EVERYTHING exists     → Skip all (no work needed)

Examples:
  # Single lesson (auto-detects what needs generating)
  python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817

  # Batch mode (all lessons in course)
  python -m src.practice_question_author_cli --course-id course_c84474

  # Delete everything and regenerate from scratch
  python -m src.practice_question_author_cli --lesson-id lt_abc123 --regenerate

  # Custom question counts
  python -m src.practice_question_author_cli \\
    --lesson-id lt_abc123 \\
    --easy 10 --medium 8 --hard 5

  # Interactive mode (no arguments)
  python -m src.practice_question_author_cli

Note: This generates pre-cached practice questions for the Infinite Practice V2 system.
      Questions are stored in Appwrite and served instantly to students.
      Diagrams are generated automatically when content is created.
        """
    )

    # Input method options
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        '--input',
        type=str,
        metavar='JSON_FILE',
        help='Path to JSON file containing lesson_template_id or course_id'
    )
    input_group.add_argument(
        '--lesson-id',
        type=str,
        help='Single lesson template ID to process'
    )
    input_group.add_argument(
        '--course-id',
        type=str,
        help='Course ID for batch mode (process all lessons)'
    )

    # Question count options
    parser.add_argument(
        '--easy',
        type=int,
        default=5,
        metavar='N',
        help='Number of easy questions per block (default: 5)'
    )
    parser.add_argument(
        '--medium',
        type=int,
        default=5,
        metavar='N',
        help='Number of medium questions per block (default: 5)'
    )
    parser.add_argument(
        '--hard',
        type=int,
        default=3,
        metavar='N',
        help='Number of hard questions per block (default: 3)'
    )

    # Configuration options
    parser.add_argument(
        '--regenerate',
        action='store_true',
        help='Delete all existing content and regenerate from scratch (blocks + questions + diagrams)'
    )
    parser.add_argument(
        '--max-concurrent',
        type=int,
        default=3,
        metavar='N',
        help='Max parallel lessons in batch mode (default: 3, prevents Appwrite rate limits)'
    )
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        metavar='PATH',
        help='Path to MCP configuration file (default: .mcp.json)'
    )
    parser.add_argument(
        '--no-persist-workspace',
        action='store_true',
        help='Delete workspace after execution (default: persist for debugging)'
    )
    parser.add_argument(
        '--log-level',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Logging level (default: INFO)'
    )
    return parser.parse_args()


async def run_single_lesson(
    lesson_template_id: str,
    questions_per_difficulty: Dict[str, int],
    mcp_config_path: str,
    persist_workspace: bool,
    log_level: str,
    regenerate: bool
) -> Dict[str, Any]:
    """Run practice question generation for a single lesson.

    Automatic behavior:
    - If no content exists: Full pipeline (blocks + questions + diagrams)
    - If content exists but no diagrams: Diagrams only
    - If everything exists: Skip all

    Args:
        lesson_template_id: Lesson template ID
        questions_per_difficulty: Question counts per difficulty
        mcp_config_path: Path to MCP config
        persist_workspace: Whether to preserve workspace
        log_level: Logging level
        regenerate: Whether to delete and regenerate all content

    Returns:
        Result dictionary from agent execution
    """
    print("=" * 70)
    print("Practice Question Author Claude Agent")
    print("=" * 70)
    print()
    print("Input Parameters:")
    print(f"  Lesson ID:     {lesson_template_id}")
    print(f"  Questions:     easy={questions_per_difficulty['easy']}, "
          f"medium={questions_per_difficulty['medium']}, "
          f"hard={questions_per_difficulty['hard']}")
    print(f"  MCP Config:    {mcp_config_path}")
    print(f"  Persist WS:    {persist_workspace}")
    print(f"  Regenerate:    {regenerate}")
    print(f"  Log Level:     {log_level}")
    print()
    print("=" * 70)
    print()

    agent = PracticeQuestionAuthorClaudeClient(
        mcp_config_path=mcp_config_path,
        persist_workspace=persist_workspace,
        questions_per_difficulty=questions_per_difficulty,
        log_level=log_level
    )

    return await agent.execute(
        lesson_template_id=lesson_template_id,
        regenerate=regenerate
    )


async def run_batch(
    course_id: str,
    questions_per_difficulty: Dict[str, int],
    mcp_config_path: str,
    persist_workspace: bool,
    log_level: str,
    regenerate: bool,
    max_concurrent: int = 3
) -> Dict[str, Any]:
    """Run practice question generation for all lessons in a course (PARALLEL).

    Automatic behavior per lesson:
    - If no content exists: Full pipeline (blocks + questions + diagrams)
    - If content exists but no diagrams: Diagrams only
    - If everything exists: Skip all

    Args:
        course_id: Course ID
        questions_per_difficulty: Question counts per difficulty
        mcp_config_path: Path to MCP config
        persist_workspace: Whether to preserve workspace
        log_level: Logging level
        regenerate: Whether to delete and regenerate all content
        max_concurrent: Maximum parallel lesson executions (default 3)

    Returns:
        Result dictionary from batch execution
    """
    print("=" * 70)
    print("Practice Question Author - BATCH MODE (PARALLEL)")
    print("=" * 70)
    print()
    print("Input Parameters:")
    print(f"  Course ID:       {course_id}")
    print(f"  Max Concurrent:  {max_concurrent}")
    print(f"  Questions:       easy={questions_per_difficulty['easy']}, "
          f"medium={questions_per_difficulty['medium']}, "
          f"hard={questions_per_difficulty['hard']}")
    print(f"  MCP Config:      {mcp_config_path}")
    print(f"  Regenerate:      {regenerate}")
    print()
    print("=" * 70)
    print()

    agent = PracticeQuestionAuthorClaudeClient(
        mcp_config_path=mcp_config_path,
        persist_workspace=persist_workspace,
        questions_per_difficulty=questions_per_difficulty,
        log_level=log_level
    )

    return await agent.execute_batch(
        course_id=course_id,
        regenerate=regenerate,
        max_concurrent=max_concurrent
    )


def print_result(result: Dict[str, Any], is_batch: bool = False) -> None:
    """Print execution result in a user-friendly format.

    Args:
        result: Result dictionary from agent execution
        is_batch: Whether this is a batch result
    """
    print()
    print("=" * 70)

    if result["success"]:
        if is_batch:
            print("✅ BATCH GENERATION COMPLETED SUCCESSFULLY!")
            print("=" * 70)
            print()
            print("Batch Details:")
            print(f"  Batch ID:           {result.get('batch_id')}")
            print(f"  Batch Folder:       workspace/{result.get('batch_folder')}/")
            print(f"  Course ID:          {result.get('course_id')}")
            print(f"  Max Concurrent:     {result.get('max_concurrent', 3)} (parallel execution)")
            print()
            print("Results:")
            print(f"  Lessons Processed:  {result.get('lessons_processed')}")
            print(f"  Lessons Succeeded:  {result.get('lessons_succeeded')}")
            print(f"  Lessons Failed:     {result.get('lessons_failed')}")
            print()
            print("Execution Mode Breakdown:")
            print(f"  Full Pipeline:      {result.get('lessons_full_pipeline', 0)} lessons")
            print(f"  Diagrams Only:      {result.get('lessons_diagrams_only', 0)} lessons")
            print(f"  Skipped (exists):   {result.get('lessons_skipped', 0)} lessons")
            print()
            print("Totals:")
            print(f"  Blocks Extracted:   {result.get('total_blocks', 0)}")
            print(f"  Questions Generated: {result.get('total_questions', 0)}")
            print(f"  Diagrams Generated: {result.get('total_diagrams', 0)}")
            print()
            print("📁 Workspace Structure:")
            print(f"  workspace/{result.get('batch_folder')}/")
            print(f"    ├── lesson_01_<id>/")
            print(f"    ├── lesson_02_<id>/")
            print(f"    └── batch_summary.json")
        elif result.get('skip_all_mode'):
            # Skip-all mode output - everything exists
            print("⏭️  CONTENT ALREADY EXISTS - SKIPPED")
            print("=" * 70)
            print()
            print("Mode: SKIP ALL (all content already generated)")
            print()
            print("Results:")
            print(f"  Lesson ID:          {result.get('lesson_template_id')}")
            print(f"  Lesson Title:       {result.get('lesson_title')}")
            print()
            print("Existing Content:")
            print(f"  Blocks:             {result.get('existing_blocks', 0)}")
            print(f"  Questions:          {result.get('existing_questions', 0)}")
            print(f"  Diagrams:           ✓ Present")
            print()
            print("💡 To regenerate all content, run with --regenerate flag")
        elif result.get('diagrams_only_mode'):
            # Diagrams-only mode output
            print("✅ DIAGRAM PROCESSING COMPLETED!")
            print("=" * 70)
            print()
            print("Mode: DIAGRAMS ONLY (existing content preserved)")
            print()
            print("Results:")
            print(f"  Execution ID:       {result.get('execution_id')}")
            print(f"  Workspace Path:     {result.get('workspace_path')}")
            print(f"  Lesson ID:          {result.get('lesson_template_id')}")
            print(f"  Lesson Title:       {result.get('lesson_title')}")
            print()
            print("Content Status:")
            print(f"  Questions Loaded:   {result.get('questions_loaded', 0)}")
            print(f"  Diagrams Generated: {result.get('diagrams_generated', 0)}")
            print()
            if result.get('diagrams_generated', 0) > 0:
                print("✓ Diagram fields updated in Appwrite")
            else:
                print("⚠️ No diagrams were generated (no questions flagged for diagrams)")
        else:
            print("✅ PRACTICE QUESTION GENERATION COMPLETED!")
            print("=" * 70)
            print()
            print("Mode: FULL PIPELINE")
            print()
            print("Results:")
            print(f"  Execution ID:       {result.get('execution_id')}")
            print(f"  Workspace Path:     {result.get('workspace_path')}")
            print(f"  Lesson ID:          {result.get('lesson_template_id')}")
            print(f"  Lesson Title:       {result.get('lesson_title')}")
            print()
            print("Generation Stats:")
            print(f"  Blocks Extracted:   {result.get('blocks_extracted')}")
            print(f"  Questions Generated: {result.get('questions_generated')}")
            print()
            qbd = result.get('questions_by_difficulty', {})
            print("Questions by Difficulty:")
            print(f"  Easy:   {qbd.get('easy', 0)}")
            print(f"  Medium: {qbd.get('medium', 0)}")
            print(f"  Hard:   {qbd.get('hard', 0)}")
            print()
            diagrams = result.get('diagrams_generated', 0)
            if diagrams > 0:
                print("Diagrams:")
                print(f"  Generated:          {diagrams}")
                print()
            print("Appwrite Persistence:")
            print(f"  Blocks Upserted:    {result.get('blocks_upserted')}")
            print(f"  Questions Upserted: {result.get('questions_upserted')}")

        # Only print storage info if something was saved (not skip_all mode)
        if not result.get('skip_all_mode'):
            print()
            print("✓ Data saved to Appwrite collections:")
            print("  - default.practice_blocks")
            print("  - default.practice_questions")

    else:
        print("❌ PRACTICE QUESTION GENERATION FAILED")
        print("=" * 70)
        print()
        print(f"Error: {result.get('error', 'Unknown error')}")
        print()
        if result.get('workspace_path'):
            print(f"Workspace (for debugging): {result['workspace_path']}")

    print("=" * 70)
    print()


async def main() -> int:
    """Main CLI entry point.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        args = parse_arguments()

        # Build questions per difficulty
        questions_per_difficulty = {
            "easy": args.easy,
            "medium": args.medium,
            "hard": args.hard
        }

        # Determine input method and load parameters
        if args.input:
            # Method 1: JSON file input
            logger.info(f"Loading input from JSON file: {args.input}")
            params = load_input_from_json(args.input)

        elif args.lesson_id:
            # Method 2: Single lesson via command-line
            logger.info("Using command-line argument: --lesson-id")
            params = {"lesson_template_id": args.lesson_id}

        elif args.course_id:
            # Method 3: Batch mode via command-line
            logger.info("Using command-line argument: --course-id (batch mode)")
            params = {"course_id": args.course_id}

        else:
            # Method 4: Interactive prompts
            logger.info("No input provided, entering interactive mode")
            params = interactive_input()

        # Execute appropriate mode
        if "course_id" in params:
            # Batch mode (parallel execution)
            result = await run_batch(
                course_id=params["course_id"],
                questions_per_difficulty=questions_per_difficulty,
                mcp_config_path=args.mcp_config,
                persist_workspace=not args.no_persist_workspace,
                log_level=args.log_level,
                regenerate=args.regenerate,
                max_concurrent=args.max_concurrent
            )
            print_result(result, is_batch=True)
        else:
            # Single lesson mode
            result = await run_single_lesson(
                lesson_template_id=params["lesson_template_id"],
                questions_per_difficulty=questions_per_difficulty,
                mcp_config_path=args.mcp_config,
                persist_workspace=not args.no_persist_workspace,
                log_level=args.log_level,
                regenerate=args.regenerate
            )
            print_result(result, is_batch=False)

        return 0 if result["success"] else 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        return 1

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"\n❌ ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
