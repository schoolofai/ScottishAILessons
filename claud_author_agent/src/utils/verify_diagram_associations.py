"""Verify Diagram Associations - Validates diagram file IDs across lessons.

This script queries Appwrite to verify that:
1. Every question with diagramRequired=true has a diagramFileId
2. No two questions from DIFFERENT lessons share the same diagramFileId
3. Each diagramFileId follows the lesson-scoped hash pattern

Usage:
    python -m src.utils.verify_diagram_associations workspace/batch_20251218_161845
    python -m src.utils.verify_diagram_associations workspace/batch_20251218_161845 --fix
"""

import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Set

import click
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.exception import AppwriteException

logger = logging.getLogger(__name__)


def _get_appwrite_client(mcp_config_path: str = ".mcp.json"):
    """Initialize Appwrite client from MCP config.

    Args:
        mcp_config_path: Path to .mcp.json

    Returns:
        Tuple of (client, databases)

    Raises:
        ValueError: If credentials missing
    """
    config_path = Path(mcp_config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

    with open(config_path) as f:
        mcp_config = json.load(f)

    appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
    args = appwrite_config.get("args", [])

    endpoint = None
    api_key = None
    project_id = None

    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="):
            endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_API_KEY="):
            api_key = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="):
            project_id = arg.split("=", 1)[1]

    if not all([endpoint, api_key, project_id]):
        raise ValueError("Missing Appwrite credentials in MCP config")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    return client, Databases(client)


def extract_lesson_id_from_folder(folder_name: str) -> str:
    """Extract lesson_template_id prefix from folder name.

    Args:
        folder_name: Folder name like 'lesson_10_68f528800031'

    Returns:
        Lesson template ID prefix (e.g., '68f528800031')
    """
    parts = folder_name.split("_")
    if len(parts) >= 3:
        return parts[-1]
    raise ValueError(f"Cannot extract lesson ID from folder: {folder_name}")


def compute_expected_file_id(lesson_template_id: str, question_id: str) -> str:
    """Compute expected file ID using lesson-scoped hash.

    Args:
        lesson_template_id: Full lesson template ID
        question_id: Question ID (e.g., q_block_001_easy_001)

    Returns:
        Expected file ID hash
    """
    return hashlib.md5(
        f"diagram:{lesson_template_id}:{question_id}".encode()
    ).hexdigest()[:36]


def verify_lesson_diagrams(
    databases: Databases,
    lesson_template_id: str,
    manifest: Dict[str, Any],
    database_id: str = "default"
) -> Dict[str, Any]:
    """Verify diagram associations for a single lesson.

    Args:
        databases: Appwrite Databases service
        lesson_template_id: Lesson template ID prefix for querying
        manifest: Diagram manifest from workspace
        database_id: Appwrite database ID

    Returns:
        Verification results for this lesson
    """
    results = {
        "lesson_template_id": lesson_template_id,
        "questions_checked": 0,
        "diagrams_expected": 0,
        "diagrams_found": 0,
        "correct_ids": 0,
        "incorrect_ids": 0,
        "missing_ids": 0,
        "issues": [],
        "file_ids": []  # Track all file IDs for cross-lesson collision detection
    }

    # Count expected diagrams from manifest
    expected_diagrams = {}
    for diagram in manifest.get("diagrams", []):
        if diagram.get("success"):
            question_id = diagram.get("question_id")
            expected_diagrams[question_id] = diagram
            results["diagrams_expected"] += 1

    # Query all questions for this lesson
    try:
        questions_result = databases.list_documents(
            database_id=database_id,
            collection_id="practice_questions",
            queries=[
                Query.starts_with("lessonTemplateId", lesson_template_id),
                Query.limit(200)
            ]
        )
        questions = questions_result.get("documents", [])
        results["questions_checked"] = len(questions)

        # Get full lesson template ID from first document
        full_lesson_id = None
        for doc in questions:
            if doc.get("lessonTemplateId"):
                full_lesson_id = doc["lessonTemplateId"]
                break

        if not full_lesson_id:
            results["issues"].append("Could not find full lessonTemplateId")
            return results

        # Check each question
        for doc in questions:
            diagram_required = doc.get("diagramRequired", False)
            diagram_file_id = doc.get("diagramFileId")
            block_id = doc.get("blockId", "")
            difficulty = doc.get("difficulty", "")

            # Construct question_id pattern
            question_id_pattern = f"q_{block_id}_{difficulty}"

            if diagram_required:
                results["diagrams_found"] += 1

                if not diagram_file_id:
                    results["missing_ids"] += 1
                    results["issues"].append(
                        f"MISSING: {doc['$id']} ({block_id}/{difficulty}) requires diagram but has no diagramFileId"
                    )
                    continue

                # Track file ID for collision detection
                results["file_ids"].append({
                    "file_id": diagram_file_id,
                    "doc_id": doc["$id"],
                    "block_id": block_id,
                    "difficulty": difficulty
                })

                # Find matching manifest entry to get exact question_id
                matching_manifest = None
                for qid, diag in expected_diagrams.items():
                    if block_id in qid and difficulty in qid:
                        matching_manifest = (qid, diag)
                        break

                if matching_manifest:
                    question_id, diag = matching_manifest
                    expected_file_id = compute_expected_file_id(full_lesson_id, question_id)

                    if diagram_file_id == expected_file_id:
                        results["correct_ids"] += 1
                    else:
                        results["incorrect_ids"] += 1
                        results["issues"].append(
                            f"WRONG_ID: {doc['$id']} has {diagram_file_id[:12]}... "
                            f"expected {expected_file_id[:12]}... for {question_id}"
                        )

    except AppwriteException as e:
        results["issues"].append(f"Query failed: {e}")

    return results


def detect_cross_lesson_collisions(
    all_results: List[Dict[str, Any]]
) -> List[str]:
    """Detect file IDs shared across different lessons.

    Args:
        all_results: Results from all lessons

    Returns:
        List of collision issues
    """
    file_id_map: Dict[str, List[Dict[str, Any]]] = {}
    collisions = []

    for result in all_results:
        lesson_id = result["lesson_template_id"]
        for file_entry in result.get("file_ids", []):
            fid = file_entry["file_id"]
            if fid not in file_id_map:
                file_id_map[fid] = []
            file_id_map[fid].append({
                "lesson_id": lesson_id,
                "doc_id": file_entry["doc_id"],
                "block_id": file_entry["block_id"],
                "difficulty": file_entry["difficulty"]
            })

    # Find collisions (same file_id used by different lessons)
    for file_id, usages in file_id_map.items():
        unique_lessons = set(u["lesson_id"] for u in usages)
        if len(unique_lessons) > 1:
            lessons_str = ", ".join(sorted(unique_lessons))
            collisions.append(
                f"COLLISION: {file_id[:16]}... shared by lessons: {lessons_str}"
            )

    return collisions


def verify_batch(
    batch_path: Path,
    lesson_folders: Optional[List[str]] = None,
    mcp_config_path: str = ".mcp.json"
) -> Dict[str, Any]:
    """Verify all lessons in a batch.

    Args:
        batch_path: Path to batch directory
        lesson_folders: Specific folders to verify (or None for all)
        mcp_config_path: Path to MCP config

    Returns:
        Combined verification results
    """
    results = {
        "batch": str(batch_path),
        "lessons_verified": 0,
        "total_questions": 0,
        "total_diagrams_expected": 0,
        "total_diagrams_found": 0,
        "total_correct": 0,
        "total_incorrect": 0,
        "total_missing": 0,
        "lesson_results": [],
        "cross_lesson_collisions": [],
        "all_issues": []
    }

    # Initialize Appwrite
    _, databases = _get_appwrite_client(mcp_config_path)

    # Find lesson folders
    if lesson_folders:
        folders = [batch_path / f for f in lesson_folders]
    else:
        folders = sorted(batch_path.glob("lesson_*"))

    for folder in folders:
        if not folder.is_dir():
            continue

        manifest_path = folder / "diagram_manifest.json"
        if not manifest_path.exists():
            logger.info(f"Skipping {folder.name}: no diagram manifest")
            continue

        try:
            lesson_id = extract_lesson_id_from_folder(folder.name)
        except ValueError as e:
            results["all_issues"].append(str(e))
            continue

        with open(manifest_path) as f:
            manifest = json.load(f)

        logger.info(f"\nVerifying: {folder.name} (ID: {lesson_id})")

        lesson_result = verify_lesson_diagrams(
            databases=databases,
            lesson_template_id=lesson_id,
            manifest=manifest
        )

        results["lessons_verified"] += 1
        results["total_questions"] += lesson_result["questions_checked"]
        results["total_diagrams_expected"] += lesson_result["diagrams_expected"]
        results["total_diagrams_found"] += lesson_result["diagrams_found"]
        results["total_correct"] += lesson_result["correct_ids"]
        results["total_incorrect"] += lesson_result["incorrect_ids"]
        results["total_missing"] += lesson_result["missing_ids"]
        results["lesson_results"].append(lesson_result)
        results["all_issues"].extend(lesson_result["issues"])

        # Print lesson summary
        status = "✅" if not lesson_result["issues"] else "⚠️"
        logger.info(
            f"  {status} {lesson_result['questions_checked']} questions, "
            f"{lesson_result['correct_ids']}/{lesson_result['diagrams_found']} correct IDs"
        )
        if lesson_result["incorrect_ids"] > 0:
            logger.warning(f"  ⚠️  {lesson_result['incorrect_ids']} incorrect file IDs")
        if lesson_result["missing_ids"] > 0:
            logger.warning(f"  ⚠️  {lesson_result['missing_ids']} missing file IDs")

    # Detect cross-lesson collisions
    results["cross_lesson_collisions"] = detect_cross_lesson_collisions(
        results["lesson_results"]
    )
    results["all_issues"].extend(results["cross_lesson_collisions"])

    return results


@click.command()
@click.argument("batch_path", type=click.Path(exists=True))
@click.option("--lesson", "-l", multiple=True, help="Specific lesson folders to verify")
@click.option("--mcp-config", default=".mcp.json", help="Path to MCP config")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
@click.option("--json-output", "-j", is_flag=True, help="Output results as JSON")
def main(batch_path: str, lesson: tuple, mcp_config: str, verbose: bool, json_output: bool):
    """Verify diagram associations for all lessons in a batch.

    Queries Appwrite to ensure:
    - All diagram-required questions have diagramFileId set
    - File IDs match the expected lesson-scoped hash
    - No cross-lesson file ID collisions exist

    \\b
    Examples:
        python -m src.utils.verify_diagram_associations workspace/batch_20251218_161845
        python -m src.utils.verify_diagram_associations workspace/batch_20251218_161845 -l lesson_10_68f528800031
        python -m src.utils.verify_diagram_associations workspace/batch_20251218_161845 -v --json-output
    """
    # Configure logging
    log_level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    batch = Path(batch_path)
    lesson_folders = list(lesson) if lesson else None

    # Run verification
    results = verify_batch(
        batch_path=batch,
        lesson_folders=lesson_folders,
        mcp_config_path=mcp_config
    )

    if json_output:
        # Strip file_ids from each lesson result to reduce output size
        for lr in results["lesson_results"]:
            lr.pop("file_ids", None)
        print(json.dumps(results, indent=2))
        return

    # Print summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"Batch: {results['batch']}")
    print(f"Lessons verified: {results['lessons_verified']}")
    print(f"Total questions: {results['total_questions']}")
    print(f"Diagrams expected: {results['total_diagrams_expected']}")
    print(f"Diagrams found: {results['total_diagrams_found']}")
    print()
    print(f"✅ Correct file IDs: {results['total_correct']}")
    print(f"❌ Incorrect file IDs: {results['total_incorrect']}")
    print(f"⚠️  Missing file IDs: {results['total_missing']}")

    if results["cross_lesson_collisions"]:
        print(f"\n🚨 Cross-lesson collisions: {len(results['cross_lesson_collisions'])}")
        for collision in results["cross_lesson_collisions"]:
            print(f"  - {collision}")

    if results["all_issues"]:
        print(f"\n❌ Total issues: {len(results['all_issues'])}")
        if verbose:
            for issue in results["all_issues"]:
                print(f"  - {issue}")
        else:
            # Show first 10 issues
            for issue in results["all_issues"][:10]:
                print(f"  - {issue}")
            if len(results["all_issues"]) > 10:
                print(f"  ... and {len(results['all_issues']) - 10} more issues")
    else:
        print("\n✅ ALL LESSONS PASS - No issues found")

    # Exit with error code if there were issues
    if results["all_issues"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
