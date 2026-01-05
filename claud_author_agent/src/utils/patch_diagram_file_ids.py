"""Patch Diagram File IDs - Re-uploads diagrams with correct lesson-scoped IDs.

This script fixes the diagram file ID collision bug where diagrams from different
lessons were incorrectly sharing the same file IDs because the hash only used
question_id without lesson_template_id.

The script:
1. Reads the diagram manifest from each lesson workspace
2. Re-uploads local PNG files with correct (lesson-scoped) file IDs
3. Updates practice_questions documents in Appwrite with new file IDs
4. Updates the manifest with new file IDs

Usage:
    python -m src.utils.patch_diagram_file_ids workspace/batch_20251218_161845
    python -m src.utils.patch_diagram_file_ids workspace/batch_20251218_161845 -l lesson_08 -l lesson_10
"""

import asyncio
import hashlib
import json
import logging
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

import click
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.input_file import InputFile
from appwrite.query import Query
from appwrite.exception import AppwriteException

logger = logging.getLogger(__name__)


def _get_appwrite_client(mcp_config_path: str = ".mcp.json"):
    """Initialize Appwrite client from MCP config.

    Args:
        mcp_config_path: Path to .mcp.json

    Returns:
        Tuple of (client, databases, storage)

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

    return client, Databases(client), Storage(client)


def extract_lesson_id_from_folder(folder_name: str) -> str:
    """Extract lesson_template_id from folder name like 'lesson_10_68f528800031'.

    Args:
        folder_name: Folder name in format lesson_NN_XXXXXXXXXXXX

    Returns:
        Full lesson template ID (e.g., '68f528800031303f0522')
    """
    # Extract the hex ID portion after the last underscore
    parts = folder_name.split("_")
    if len(parts) >= 3:
        short_id = parts[-1]  # e.g., '68f528800031'
        # The full ID has additional characters - we'll match by prefix in queries
        return short_id
    raise ValueError(f"Cannot extract lesson ID from folder: {folder_name}")


def extract_block_id(question_id: str) -> str:
    """Extract block_id from question_id like 'q_block_001_easy_001'.

    Returns: 'block_001'
    """
    match = re.match(r"q_(block_\d+)_", question_id)
    if match:
        return match.group(1)
    raise ValueError(f"Cannot extract block_id from: {question_id}")


def extract_difficulty(question_id: str) -> str:
    """Extract difficulty from question_id like 'q_block_001_easy_001'.

    Returns: 'easy', 'medium', or 'hard'
    """
    if "_easy_" in question_id:
        return "easy"
    elif "_medium_" in question_id:
        return "medium"
    elif "_hard_" in question_id:
        return "hard"
    raise ValueError(f"Cannot extract difficulty from: {question_id}")


async def patch_lesson_diagrams(
    workspace_path: Path,
    lesson_template_id: str,
    mcp_config_path: str = ".mcp.json",
    dry_run: bool = False
) -> Dict[str, Any]:
    """Re-upload local diagrams with correct (lesson-scoped) file IDs.

    Args:
        workspace_path: Path to lesson workspace with diagram_manifest.json
        lesson_template_id: Lesson template ID prefix
        mcp_config_path: Path to MCP config
        dry_run: If True, only report what would be done

    Returns:
        Dict with patch results
    """
    results = {
        "lesson_template_id": lesson_template_id,
        "workspace": str(workspace_path),
        "diagrams_processed": 0,
        "diagrams_uploaded": 0,
        "documents_updated": 0,
        "errors": []
    }

    # 1. Read diagram_manifest.json from workspace
    manifest_path = workspace_path / "diagram_manifest.json"
    if not manifest_path.exists():
        results["errors"].append("No diagram_manifest.json found")
        return results

    with open(manifest_path) as f:
        manifest = json.load(f)

    # 2. Initialize Appwrite client
    client, databases, storage = _get_appwrite_client(mcp_config_path)
    database_id = "default"
    bucket_id = "practice_content"

    # 3. Find all practice_questions for this lesson
    # Query using prefix match on lessonTemplateId
    try:
        questions_result = databases.list_documents(
            database_id=database_id,
            collection_id="practice_questions",
            queries=[
                Query.starts_with("lessonTemplateId", lesson_template_id),
                Query.limit(200)
            ]
        )
        lesson_questions = {doc["$id"]: doc for doc in questions_result.get("documents", [])}
        logger.info(f"Found {len(lesson_questions)} questions for lesson {lesson_template_id}")
    except AppwriteException as e:
        results["errors"].append(f"Failed to query questions: {e}")
        return results

    # 4. Process each diagram
    for diagram in manifest.get("diagrams", []):
        if not diagram.get("success"):
            continue

        results["diagrams_processed"] += 1
        question_id = diagram["question_id"]
        local_image_path = diagram.get("image_path")
        old_file_id = diagram.get("image_file_id")

        if not local_image_path or not Path(local_image_path).exists():
            results["errors"].append(f"Image not found: {question_id} -> {local_image_path}")
            continue

        # 5. Generate NEW file ID with lesson_template_id
        # Use full lesson template ID from database if available
        full_lesson_id = None
        for doc in lesson_questions.values():
            if doc.get("lessonTemplateId"):
                full_lesson_id = doc["lessonTemplateId"]
                break

        if not full_lesson_id:
            full_lesson_id = lesson_template_id

        new_file_id = hashlib.md5(
            f"diagram:{full_lesson_id}:{question_id}".encode()
        ).hexdigest()[:36]

        if new_file_id == old_file_id:
            logger.debug(f"  {question_id}: Already has correct file ID")
            continue

        logger.info(f"  {question_id}: {old_file_id} -> {new_file_id}")

        if dry_run:
            results["diagrams_uploaded"] += 1
            continue

        # 6. Upload local PNG with new file ID
        try:
            input_file = InputFile.from_path(local_image_path)
            storage.create_file(
                bucket_id=bucket_id,
                file_id=new_file_id,
                file=input_file
            )
            logger.info(f"    Uploaded: {new_file_id}")
            results["diagrams_uploaded"] += 1
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                logger.debug(f"    File already exists: {new_file_id}")
                results["diagrams_uploaded"] += 1
            else:
                results["errors"].append(f"Upload failed for {question_id}: {e}")
                continue

        # 7. Find and update practice_questions document
        try:
            block_id = extract_block_id(question_id)
            difficulty = extract_difficulty(question_id)

            # Find matching document
            matching_docs = databases.list_documents(
                database_id=database_id,
                collection_id="practice_questions",
                queries=[
                    Query.starts_with("lessonTemplateId", lesson_template_id),
                    Query.equal("blockId", block_id),
                    Query.equal("difficulty", difficulty),
                    Query.limit(50)
                ]
            )

            # Match by old diagramFileId or question index
            updated = False
            for doc in matching_docs.get("documents", []):
                if doc.get("diagramFileId") == old_file_id:
                    databases.update_document(
                        database_id=database_id,
                        collection_id="practice_questions",
                        document_id=doc["$id"],
                        data={"diagramFileId": new_file_id}
                    )
                    logger.info(f"    Updated doc: {doc['$id']}")
                    results["documents_updated"] += 1
                    updated = True
                    break

            if not updated:
                logger.warning(f"    Could not find matching doc for {question_id}")

        except Exception as e:
            results["errors"].append(f"Update failed for {question_id}: {e}")

        # 8. Update manifest entry
        diagram["image_file_id"] = new_file_id

    # 9. Save updated manifest
    if not dry_run:
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        logger.info(f"  Updated manifest: {manifest_path}")

    return results


async def patch_batch(
    batch_path: Path,
    lesson_folders: Optional[List[str]] = None,
    mcp_config_path: str = ".mcp.json",
    dry_run: bool = False
) -> Dict[str, Any]:
    """Patch all lessons in a batch.

    Args:
        batch_path: Path to batch directory
        lesson_folders: Specific folders to patch (or None for all)
        mcp_config_path: Path to MCP config
        dry_run: If True, only report what would be done

    Returns:
        Combined results from all lessons
    """
    results = {
        "batch": str(batch_path),
        "lessons_processed": 0,
        "total_diagrams_uploaded": 0,
        "total_documents_updated": 0,
        "lesson_results": [],
        "errors": []
    }

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
            results["errors"].append(str(e))
            continue

        logger.info(f"\n{'='*60}")
        logger.info(f"Patching: {folder.name} (ID: {lesson_id})")
        logger.info(f"{'='*60}")

        lesson_result = await patch_lesson_diagrams(
            workspace_path=folder,
            lesson_template_id=lesson_id,
            mcp_config_path=mcp_config_path,
            dry_run=dry_run
        )

        results["lessons_processed"] += 1
        results["total_diagrams_uploaded"] += lesson_result["diagrams_uploaded"]
        results["total_documents_updated"] += lesson_result["documents_updated"]
        results["lesson_results"].append(lesson_result)
        results["errors"].extend(lesson_result["errors"])

    return results


@click.command()
@click.argument("batch_path", type=click.Path(exists=True))
@click.option("--lesson", "-l", multiple=True, help="Specific lesson folders to patch")
@click.option("--dry-run", is_flag=True, help="Only report what would be done")
@click.option("--mcp-config", default=".mcp.json", help="Path to MCP config")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
def main(batch_path: str, lesson: tuple, dry_run: bool, mcp_config: str, verbose: bool):
    """Patch diagram file IDs for affected lessons in a batch.

    Re-uploads local diagrams with correct (lesson-scoped) file IDs and
    updates practice_questions documents in Appwrite.

    \b
    Examples:
        python -m src.utils.patch_diagram_file_ids workspace/batch_20251218_161845
        python -m src.utils.patch_diagram_file_ids workspace/batch_20251218_161845 -l lesson_08_68f521ac000c
        python -m src.utils.patch_diagram_file_ids workspace/batch_20251218_161845 --dry-run
    """
    # Configure logging
    log_level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    if dry_run:
        logger.info("DRY RUN MODE - No changes will be made")

    batch = Path(batch_path)
    lesson_folders = list(lesson) if lesson else None

    # Run the patch
    results = asyncio.run(patch_batch(
        batch_path=batch,
        lesson_folders=lesson_folders,
        mcp_config_path=mcp_config,
        dry_run=dry_run
    ))

    # Print summary
    print("\n" + "=" * 60)
    print("PATCH SUMMARY")
    print("=" * 60)
    print(f"Batch: {results['batch']}")
    print(f"Lessons processed: {results['lessons_processed']}")
    print(f"Diagrams uploaded: {results['total_diagrams_uploaded']}")
    print(f"Documents updated: {results['total_documents_updated']}")

    if results["errors"]:
        print(f"\nErrors ({len(results['errors'])}):")
        for error in results["errors"]:
            print(f"  - {error}")

    if dry_run:
        print("\n[DRY RUN - No actual changes were made]")

    # Exit with error code if there were issues
    if results["errors"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
