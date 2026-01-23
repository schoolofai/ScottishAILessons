"""
Nat5+ Mock Exam Generator Client

Main pipeline orchestrator for generating unique Nat5+ SQA mock exams.
Uses granular question-by-question generation with Claude Agent SDK structured outputs.

Pipeline:
1. Pre-processing: Extract SOW topics, past paper templates, existing summaries
2. Plan Exam: Generate exam plan with topic/difficulty distribution
3. Generate Questions: Parallel question generation with validation
4. Assemble & Post-process: Stitch questions, validate, upsert to Appwrite

Usage:
    # Generate an exam
    python -m src.nat5_plus.exam_generator_client generate \\
        --course-id "course_xyz" \\
        --workspace ./workspaces/exam_001

    # List exams for a course
    python -m src.nat5_plus.exam_generator_client list --course-id "course_xyz"

    # Delete an exam
    python -m src.nat5_plus.exam_generator_client delete --exam-id "exam_doc_id"
"""

import asyncio
import argparse
import logging
from dataclasses import asdict
from pathlib import Path
from typing import List

# Nat5PlusMockExam is returned by assemble_exam
from .sow_topic_extractor import extract_sow_topics
from .past_paper_template_extractor import extract_templates
from .uniqueness_manager import UniquenessManager, load_existing_summaries
from .question_generator_agent import generate_exam_plan, generate_single_question
from .exam_assembler import assemble_exam
from .exam_upserter import upsert_exam, update_exam_summary, delete_exam, list_exams

logger = logging.getLogger(__name__)


def chunk(lst: List, size: int):
    """Split list into chunks of given size."""
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


async def generate_nat5_plus_exam(
    course_id: str,
    workspace_path: Path,
    calculator_allowed: bool,
    target_marks: int = 90,
    target_questions: int = 15,
    force_regenerate: bool = False,
    dry_run: bool = False
) -> str:
    """Generate a Nat5+ mock exam for a course.

    Args:
        course_id: Target course ID
        workspace_path: Directory for intermediate outputs
        calculator_allowed: Whether calculator is allowed for this exam
        target_marks: Total marks target (default: 90)
        target_questions: Number of questions target (default: 15)
        force_regenerate: Skip uniqueness checks
        dry_run: Generate without upserting to Appwrite

    Returns:
        Document ID of the created exam (or "DRY_RUN" if dry_run=True)

    Raises:
        ValueError: If prerequisites not met or validation fails
    """
    logger.info(f"Starting exam generation for course: {course_id}")
    logger.info(f"Workspace: {workspace_path}")
    logger.info(f"Calculator allowed: {calculator_allowed}")
    logger.info(f"Target: {target_marks} marks, {target_questions} questions")

    # Ensure workspace exists
    workspace_path.mkdir(parents=True, exist_ok=True)
    questions_dir = workspace_path / "questions"
    questions_dir.mkdir(exist_ok=True)

    # ═══════════════════════════════════════════════════════════════
    # PHASE 1: Pre-processing (Python, 0 tokens)
    # ═══════════════════════════════════════════════════════════════
    logger.info("PHASE 1: Pre-processing")

    # Extract SOW topics for this course
    sow_extraction = await extract_sow_topics(course_id, workspace_path)
    sow_topics = [
        {
            "topic_id": t.topic_id,
            "topic_name": t.topic_name,
            "description": t.description,
            "sow_order": t.sow_order,
            "difficulty_level": t.difficulty_level,
            "learning_outcomes": t.learning_outcomes
        }
        for t in sow_extraction.topics
    ]
    logger.info(f"Extracted {len(sow_topics)} SOW topics")

    # Extract past paper templates for style reference (filtered by calculator policy)
    templates_result = await extract_templates(
        subject=sow_extraction.subject,
        level=sow_extraction.level,
        calculator_allowed=calculator_allowed
    )
    logger.info(f"Extracted {len(templates_result.templates)} past paper templates (calculator_allowed={calculator_allowed})")

    # Convert QuestionTemplate dataclasses to dicts for downstream functions
    templates = [asdict(t) for t in templates_result.templates]

    # Load existing exam summaries for uniqueness checking
    existing_summaries = await load_existing_summaries(course_id)
    uniqueness_manager = UniquenessManager(existing_summaries)
    logger.info(f"Loaded {len(existing_summaries)} existing exam summaries")

    # ═══════════════════════════════════════════════════════════════
    # PHASE 2: Plan Exam Structure (Claude SDK - small output)
    # ═══════════════════════════════════════════════════════════════
    logger.info("PHASE 2: Planning exam structure")

    exam_plan = await generate_exam_plan(
        sow_topics=sow_topics,
        templates=templates,
        existing_summaries=existing_summaries,
        target_marks=target_marks,
        target_questions=target_questions,
        subject=sow_extraction.subject,
        level=sow_extraction.level
    )
    logger.info(f"Generated exam plan with {len(exam_plan.question_specs)} questions")

    # ═══════════════════════════════════════════════════════════════
    # PHASE 3: Generate Questions (Parallel, Structured Output)
    # ═══════════════════════════════════════════════════════════════
    logger.info("PHASE 3: Generating questions")

    questions = []
    question_offset = 0
    for batch_idx, batch in enumerate(chunk(exam_plan.question_specs, size=5)):
        logger.info(f"Processing batch {batch_idx + 1}")
        batch_results = []
        for i, spec in enumerate(batch):
            try:
                result = await generate_single_question(
                    spec, sow_topics, templates, workspace_path, question_offset + i
                )
                batch_results.append(result)
            except Exception as e:
                batch_results.append(e)
        question_offset += len(batch)

        for i, result in enumerate(batch_results):
            if isinstance(result, Exception):
                logger.error(f"Question generation failed: {result}")
                raise ValueError(f"Failed to generate question: {result}")

            question = result
            # Check uniqueness (skip critic for now - can be added later)
            if not force_regenerate and not uniqueness_manager.check_question_unique(question.stem):
                logger.warning(f"Question not unique, continuing anyway (full regen not implemented)")
                # For now, still add it - full uniqueness regen needs more work

            questions.append(question)
            logger.info(f"Generated question {len(questions)}: {question.question_number}")

    logger.info(f"Generated {len(questions)} questions total")

    # ═══════════════════════════════════════════════════════════════
    # PHASE 3.5: Diagram Generation (Claude SDK + MCP tools)
    # ═══════════════════════════════════════════════════════════════
    logger.info("PHASE 3.5: Generating diagrams for questions")

    from .diagram_generator import generate_diagrams_for_exam

    diagram_map = await generate_diagrams_for_exam(
        questions=questions,
        workspace_path=workspace_path,
        subject=sow_extraction.subject,
        level=sow_extraction.level
    )
    logger.info(f"Generated diagrams for {len(diagram_map)} questions")

    # ═══════════════════════════════════════════════════════════════
    # PHASE 4: Assemble & Post-process (Python, 0 tokens)
    # ═══════════════════════════════════════════════════════════════
    logger.info("PHASE 4: Assembling exam")

    validated_exam = assemble_exam(
        exam_plan=exam_plan,
        questions=questions,
        course_id=course_id,
        subject=sow_extraction.subject,
        level=sow_extraction.level,
        calculator_allowed=calculator_allowed,
        paper_config=templates_result.paper_config,
        diagram_map=diagram_map  # Pass diagram map to assembler
    )
    logger.info(f"Assembled exam: {validated_exam.exam_id}")

    # Save to workspace for inspection
    exam_json_path = workspace_path / "mock_exam.json"
    with open(exam_json_path, "w") as f:
        f.write(validated_exam.model_dump_json(indent=2))
    logger.info(f"Saved exam to: {exam_json_path}")

    # Generate question fingerprints for uniqueness tracking
    question_fingerprints = []
    for question in questions:
        fingerprint = uniqueness_manager.register_question(question.stem)
        question_fingerprints.append(fingerprint)
    logger.info(f"Generated {len(question_fingerprints)} question fingerprints")

    if dry_run:
        logger.info("DRY RUN: Skipping Appwrite upsert")
        return "DRY_RUN"

    # Upsert to Appwrite
    doc_id = await upsert_exam(validated_exam)
    logger.info(f"Upserted exam to Appwrite: {doc_id}")

    # Update exam summary for future uniqueness tracking
    await update_exam_summary(validated_exam, doc_id, question_fingerprints)
    logger.info("Updated exam summary")

    return doc_id


def main():
    """CLI entry point with subcommands: generate, list, delete."""
    parser = argparse.ArgumentParser(
        description="Nat5+ SQA Mock Exam CLI"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ═══════════════════════════════════════════════════════════════
    # GENERATE subcommand
    # ═══════════════════════════════════════════════════════════════
    generate_parser = subparsers.add_parser(
        "generate",
        help="Generate a new mock exam"
    )
    generate_parser.add_argument(
        "--course-id",
        required=True,
        help="Target course ID"
    )
    generate_parser.add_argument(
        "--workspace",
        required=True,
        type=Path,
        help="Output directory for intermediate files"
    )
    generate_parser.add_argument(
        "--target-marks",
        type=int,
        default=90,
        help="Total marks target (default: 90)"
    )
    generate_parser.add_argument(
        "--target-questions",
        type=int,
        default=15,
        help="Number of questions target (default: 15)"
    )
    generate_parser.add_argument(
        "--force-regenerate",
        action="store_true",
        help="Skip uniqueness checks"
    )
    generate_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate without upserting to Appwrite"
    )
    generate_parser.add_argument(
        "--calculator",
        type=lambda x: x.lower() == "true",
        required=True,
        help="Whether calculator is allowed for this exam (true/false)"
    )

    # ═══════════════════════════════════════════════════════════════
    # LIST subcommand
    # ═══════════════════════════════════════════════════════════════
    list_parser = subparsers.add_parser(
        "list",
        help="List exams for a course"
    )
    list_parser.add_argument(
        "--course-id",
        required=False,
        help="Filter by course ID (optional, lists all if not provided)"
    )

    # ═══════════════════════════════════════════════════════════════
    # DELETE subcommand
    # ═══════════════════════════════════════════════════════════════
    delete_parser = subparsers.add_parser(
        "delete",
        help="Delete an exam and its summary"
    )
    delete_parser.add_argument(
        "--exam-id",
        required=True,
        help="Document ID of the exam to delete"
    )

    # ═══════════════════════════════════════════════════════════════
    # REGENERATE-DIAGRAM subcommand
    # ═══════════════════════════════════════════════════════════════
    regenerate_parser = subparsers.add_parser(
        "regenerate-diagram",
        help="Regenerate diagram for a single question from existing workspace"
    )
    regenerate_parser.add_argument(
        "--workspace", "-w",
        required=True,
        type=Path,
        help="Path to existing exam workspace (e.g., ./workspaces/nat5_maths_exam_001)"
    )
    regenerate_parser.add_argument(
        "--question-id", "-q",
        required=True,
        help="Question ID to regenerate (e.g., q8)"
    )
    regenerate_parser.add_argument(
        "--max-iterations",
        type=int,
        default=3,
        help="Max critique iterations (default: 3)"
    )
    regenerate_parser.add_argument(
        "--max-turns",
        type=int,
        default=200,
        help="Max LLM turns per iteration (default: 200)"
    )
    regenerate_parser.add_argument(
        "--force-tool",
        choices=["MATPLOTLIB", "DESMOS", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION"],
        help="Override tool classification (e.g., try JSXGRAPH instead of MATPLOTLIB)"
    )

    args = parser.parse_args()

    # Handle no command provided
    if not args.command:
        parser.print_help()
        return

    # Execute appropriate command
    if args.command == "generate":
        result = asyncio.run(generate_nat5_plus_exam(
            course_id=args.course_id,
            workspace_path=args.workspace,
            calculator_allowed=args.calculator,
            target_marks=args.target_marks,
            target_questions=args.target_questions,
            force_regenerate=args.force_regenerate,
            dry_run=args.dry_run
        ))
        calc_label = "Calculator" if args.calculator else "Non-Calculator"
        print(f"Generated {calc_label} exam: {result}")

    elif args.command == "list":
        exams = asyncio.run(list_exams(course_id=args.course_id))
        if not exams:
            print("No exams found.")
            return
        print(f"\nFound {len(exams)} exam(s):\n")
        print("-" * 90)
        for exam in exams:
            print(f"Exam ID:    {exam['exam_id']}")
            print(f"Course:     {exam['course_id']}")
            print(f"Subject:    {exam['subject']} ({exam['level']})")
            print(f"Status:     {exam['status']} | Version: {exam['version']}")
            print(f"Questions:  {exam['question_count']} | Marks: {exam['total_marks']}")
            print(f"Created:    {exam['created_at']}")
            print("-" * 90)

    elif args.command == "delete":
        result = asyncio.run(delete_exam(exam_doc_id=args.exam_id))
        if result["exam_deleted"]:
            print(f"✅ Deleted exam: {args.exam_id}")
            if result["summary_deleted"]:
                print(f"✅ Deleted summary: {result['summary_id']}")
            else:
                print("⚠️  No associated summary found (fingerprints may still be in use)")
        else:
            print(f"❌ Failed to delete exam: {args.exam_id}")

    elif args.command == "regenerate-diagram":
        from .diagram_generator import regenerate_single_diagram

        print(f"\n🔄 Regenerating diagram for {args.question_id}")
        print(f"   Workspace: {args.workspace}")
        print(f"   Max turns: {args.max_turns}")
        print(f"   Max iterations: {args.max_iterations}")
        if args.force_tool:
            print(f"   Force tool: {args.force_tool}")
        print()

        try:
            result = asyncio.run(regenerate_single_diagram(
                workspace_path=args.workspace,
                question_id=args.question_id,
                max_iterations=args.max_iterations,
                max_turns=args.max_turns,
                force_tool=args.force_tool
            ))

            if result.success:
                print(f"\n✅ Diagram regeneration SUCCESSFUL")
                print(f"   Question: {result.question_id}")
                print(f"   Image: {result.image_path}")
                print(f"   Score: {result.final_score:.2f}")
                print(f"   Iterations: {result.iterations}")
                print(f"\n💡 Next steps:")
                print(f"   1. View: open {result.image_path}")
                print(f"   2. Re-upsert exam: python -m src.nat5_plus.exam_generator_client upsert --workspace {args.workspace}")
            else:
                print(f"\n❌ Diagram regeneration FAILED")
                print(f"   Error: {result.error}")
                if result.iterations > 0:
                    print(f"   Iterations attempted: {result.iterations}")
                print(f"\n💡 Try:")
                print(f"   1. Increase max turns: --max-turns 300")
                print(f"   2. Try different tool: --force-tool JSXGRAPH")

        except ValueError as e:
            print(f"\n❌ Error: {e}")
        except RuntimeError as e:
            print(f"\n❌ Service error: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
