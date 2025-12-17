#!/usr/bin/env python3
"""Generate Practice Questions CLI - Offline question generation for lessons.

This script orchestrates the offline generation of practice questions:
1. Fetches lesson template from Appwrite
2. Extracts concept blocks using PracticeBlockAgent
3. Generates questions at each difficulty using PracticeQuestionGeneratorAgent
4. Classifies and generates diagrams using existing diagram agents
5. Persists results to Appwrite collections

Usage:
    # Generate for single lesson
    python generate_practice_questions.py --lesson-id lt_abc123

    # Generate for entire course
    python generate_practice_questions.py --course-id course_c84874

    # Custom question counts
    python generate_practice_questions.py --lesson-id lt_abc123 --easy 10 --medium 8 --hard 5

    # Regenerate existing
    python generate_practice_questions.py --lesson-id lt_abc123 --regenerate

    # Skip diagrams (faster, for testing)
    python generate_practice_questions.py --lesson-id lt_abc123 --skip-diagrams
"""

import argparse
import asyncio
import json
import logging
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.agents.practice_block_agent import PracticeBlockAgent, run_block_extraction
from src.agents.practice_question_generator_agent import (
    PracticeQuestionGeneratorAgent,
    run_question_generation,
    DEFAULT_QUESTIONS_PER_DIFFICULTY
)
from src.utils.practice_question_upserter import (
    PracticeQuestionUpserter,
    run_practice_content_upsert
)
from src.utils.question_to_classifier_adapter import process_question_diagrams
from src.utils.appwrite_mcp import list_appwrite_documents, get_appwrite_document

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def fetch_lesson_template(
    lesson_template_id: str,
    mcp_config_path: str
) -> dict:
    """Fetch lesson template from Appwrite.

    Args:
        lesson_template_id: Lesson template ID
        mcp_config_path: Path to MCP config

    Returns:
        Lesson template data

    Raises:
        RuntimeError: If not found
    """
    from src.utils.appwrite_mcp import get_appwrite_document

    doc = await get_appwrite_document(
        database_id="default",
        collection_id="lesson_templates",
        document_id=lesson_template_id,
        mcp_config_path=mcp_config_path
    )

    if not doc:
        raise RuntimeError(f"Lesson template not found: {lesson_template_id}")

    # Decompress cards if compressed
    cards_compressed = doc.get("cardsCompressed")
    if cards_compressed:
        import base64
        import gzip

        cards_bytes = base64.b64decode(cards_compressed)
        cards_json = gzip.decompress(cards_bytes).decode('utf-8')
        doc["cards"] = json.loads(cards_json)

    return doc


async def fetch_lessons_by_course(
    course_id: str,
    mcp_config_path: str
) -> list:
    """Fetch all lesson templates for a course.

    Args:
        course_id: Course ID
        mcp_config_path: Path to MCP config

    Returns:
        List of lesson template documents
    """
    from src.utils.appwrite_mcp import list_appwrite_documents

    docs = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=[f'equal("courseId", "{course_id}")'],
        mcp_config_path=mcp_config_path
    )

    return docs.get("documents", [])


async def generate_for_lesson(
    lesson_template_id: str,
    mcp_config_path: str,
    questions_per_difficulty: dict,
    skip_diagrams: bool = False,
    regenerate: bool = False
) -> dict:
    """Generate practice questions for a single lesson.

    Args:
        lesson_template_id: Lesson template ID
        mcp_config_path: Path to MCP config
        questions_per_difficulty: Dict of difficulty -> count
        skip_diagrams: Skip diagram generation
        regenerate: Regenerate even if exists

    Returns:
        Generation result dict
    """
    execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    logger.info("=" * 70)
    logger.info(f"PRACTICE QUESTION GENERATION - {lesson_template_id}")
    logger.info(f"Execution ID: {execution_id}")
    logger.info("=" * 70)

    # Create workspace
    workspace_path = Path(tempfile.mkdtemp(prefix=f"practice_{execution_id}_"))
    logger.info(f"Workspace: {workspace_path}")

    try:
        # Step 1: Fetch lesson template
        logger.info("\n📚 Step 1: Fetching lesson template...")
        lesson_template = await fetch_lesson_template(
            lesson_template_id, mcp_config_path
        )
        logger.info(f"   Title: {lesson_template.get('title')}")
        logger.info(f"   Cards: {len(lesson_template.get('cards', []))}")

        # Step 2: Extract blocks
        logger.info("\n🧱 Step 2: Extracting concept blocks...")
        block_agent = PracticeBlockAgent(workspace_path=workspace_path)
        block_result = await block_agent.execute(lesson_template_id, lesson_template)

        blocks = block_result["extraction_result"].blocks
        logger.info(f"   Extracted {len(blocks)} blocks")

        # Step 3: Generate questions
        logger.info("\n❓ Step 3: Generating practice questions...")
        question_agent = PracticeQuestionGeneratorAgent(
            workspace_path=workspace_path,
            questions_per_difficulty=questions_per_difficulty
        )
        question_result = await question_agent.execute(
            lesson_template_id=lesson_template_id,
            blocks=blocks,
            execution_id=execution_id
        )

        questions = question_result["generation_result"].questions
        logger.info(f"   Generated {len(questions)} questions")

        # Step 4: Diagram processing (optional)
        if not skip_diagrams:
            logger.info("\n🎨 Step 4: Processing diagrams...")
            # Get subject/level from lesson template
            subject = lesson_template.get("courseSubject", "mathematics")
            level = lesson_template.get("courseLevel", "national-3")

            questions = await process_question_diagrams(
                workspace_path=workspace_path,
                questions=questions,
                lesson_template_id=lesson_template_id,
                execution_id=execution_id,
                subject=subject,
                level=level,
                run_diagram_author=True
            )
            diagram_count = sum(1 for q in questions if q.diagram_file_id)
            logger.info(f"   Generated {diagram_count} diagrams")
        else:
            logger.info("\n🎨 Step 4: Skipping diagram processing (--skip-diagrams)")

        # Step 5: Persist to Appwrite
        logger.info("\n💾 Step 5: Persisting to Appwrite...")
        upsert_result = await run_practice_content_upsert(
            mcp_config_path=mcp_config_path,
            lesson_template_id=lesson_template_id,
            blocks=blocks,
            questions=questions,
            execution_id=execution_id
        )
        logger.info(f"   Blocks upserted: {upsert_result['blocks_upserted']}")
        logger.info(f"   Questions upserted: {upsert_result['questions_upserted']}")

        # Summary
        logger.info("\n" + "=" * 70)
        logger.info("✅ GENERATION COMPLETE")
        logger.info("=" * 70)
        logger.info(f"   Lesson: {lesson_template.get('title')}")
        logger.info(f"   Blocks: {len(blocks)}")
        logger.info(f"   Questions: {len(questions)}")
        logger.info(f"   Diagrams: {sum(1 for q in questions if q.diagram_needed)}")
        logger.info(f"   Workspace: {workspace_path}")

        return {
            "success": True,
            "lesson_template_id": lesson_template_id,
            "blocks_extracted": len(blocks),
            "questions_generated": len(questions),
            "diagrams_generated": sum(1 for q in questions if q.diagram_file_id),
            "execution_id": execution_id,
            "workspace_path": str(workspace_path)
        }

    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        return {
            "success": False,
            "lesson_template_id": lesson_template_id,
            "error": str(e),
            "execution_id": execution_id
        }


async def generate_for_course(
    course_id: str,
    mcp_config_path: str,
    questions_per_difficulty: dict,
    skip_diagrams: bool = False,
    regenerate: bool = False
) -> dict:
    """Generate practice questions for all lessons in a course.

    Args:
        course_id: Course ID
        mcp_config_path: Path to MCP config
        questions_per_difficulty: Dict of difficulty -> count
        skip_diagrams: Skip diagram generation
        regenerate: Regenerate even if exists

    Returns:
        Batch result dict
    """
    logger.info(f"Fetching lessons for course: {course_id}")
    lessons = await fetch_lessons_by_course(course_id, mcp_config_path)

    if not lessons:
        raise RuntimeError(f"No lessons found for course: {course_id}")

    logger.info(f"Found {len(lessons)} lessons")

    results = []
    for lesson in lessons:
        lesson_id = lesson.get("$id")
        logger.info(f"\n{'=' * 70}")
        logger.info(f"Processing: {lesson.get('title')} ({lesson_id})")

        result = await generate_for_lesson(
            lesson_template_id=lesson_id,
            mcp_config_path=mcp_config_path,
            questions_per_difficulty=questions_per_difficulty,
            skip_diagrams=skip_diagrams,
            regenerate=regenerate
        )
        results.append(result)

    # Summary
    successful = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]

    logger.info("\n" + "=" * 70)
    logger.info("BATCH GENERATION COMPLETE")
    logger.info("=" * 70)
    logger.info(f"   Total lessons: {len(results)}")
    logger.info(f"   Successful: {len(successful)}")
    logger.info(f"   Failed: {len(failed)}")
    logger.info(f"   Total questions: {sum(r.get('questions_generated', 0) for r in successful)}")

    if failed:
        logger.warning("Failed lessons:")
        for r in failed:
            logger.warning(f"   - {r['lesson_template_id']}: {r.get('error')}")

    return {
        "success": len(failed) == 0,
        "course_id": course_id,
        "lessons_processed": len(results),
        "successful": len(successful),
        "failed": len(failed),
        "total_questions": sum(r.get("questions_generated", 0) for r in successful),
        "total_diagrams": sum(r.get("diagrams_generated", 0) for r in successful),
        "results": results
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate offline practice questions for lessons.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Required arguments (one of)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--lesson-id",
        help="Single lesson template ID to process"
    )
    group.add_argument(
        "--course-id",
        help="Course ID to process all lessons"
    )

    # Optional arguments
    parser.add_argument(
        "--easy",
        type=int,
        default=DEFAULT_QUESTIONS_PER_DIFFICULTY["easy"],
        help=f"Number of easy questions per block (default: {DEFAULT_QUESTIONS_PER_DIFFICULTY['easy']})"
    )
    parser.add_argument(
        "--medium",
        type=int,
        default=DEFAULT_QUESTIONS_PER_DIFFICULTY["medium"],
        help=f"Number of medium questions per block (default: {DEFAULT_QUESTIONS_PER_DIFFICULTY['medium']})"
    )
    parser.add_argument(
        "--hard",
        type=int,
        default=DEFAULT_QUESTIONS_PER_DIFFICULTY["hard"],
        help=f"Number of hard questions per block (default: {DEFAULT_QUESTIONS_PER_DIFFICULTY['hard']})"
    )
    parser.add_argument(
        "--regenerate",
        action="store_true",
        help="Regenerate even if questions already exist"
    )
    parser.add_argument(
        "--skip-diagrams",
        action="store_true",
        help="Skip diagram classification and generation"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP config file (default: .mcp.json)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    args = parser.parse_args()

    # Configure logging level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # Build questions_per_difficulty
    questions_per_difficulty = {
        "easy": args.easy,
        "medium": args.medium,
        "hard": args.hard
    }

    # Run generation
    if args.lesson_id:
        result = asyncio.run(generate_for_lesson(
            lesson_template_id=args.lesson_id,
            mcp_config_path=args.mcp_config,
            questions_per_difficulty=questions_per_difficulty,
            skip_diagrams=args.skip_diagrams,
            regenerate=args.regenerate
        ))
    else:
        result = asyncio.run(generate_for_course(
            course_id=args.course_id,
            mcp_config_path=args.mcp_config,
            questions_per_difficulty=questions_per_difficulty,
            skip_diagrams=args.skip_diagrams,
            regenerate=args.regenerate
        ))

    # Exit code
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
