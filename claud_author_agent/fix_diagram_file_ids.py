#!/usr/bin/env python3
"""Fix diagramFileId in practice_questions collection from manifest.

This script reads the diagram_manifest.json from a previous execution
and updates the diagramFileId field in the database for each question.

Usage:
    python fix_diagram_file_ids.py --workspace workspace/20251215_010056
"""

import argparse
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_appwrite_client(mcp_config_path: str = ".mcp.json"):
    """Initialize Appwrite client from MCP config."""
    from appwrite.client import Client
    from appwrite.services.databases import Databases

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

    return Databases(client)


def fix_diagram_file_ids(workspace_path: str, mcp_config_path: str = ".mcp.json"):
    """Update diagramFileId in database from manifest.

    Args:
        workspace_path: Path to workspace with diagram_manifest.json
        mcp_config_path: Path to MCP config file
    """
    workspace = Path(workspace_path)
    manifest_path = workspace / "diagram_manifest.json"

    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    with open(manifest_path) as f:
        manifest = json.load(f)

    diagrams = manifest.get("diagrams", [])
    logger.info(f"Found {len(diagrams)} diagrams in manifest")

    # Get Appwrite client
    databases = get_appwrite_client(mcp_config_path)

    # Update each question with its diagram file ID
    updated = 0
    skipped = 0
    errors = 0

    for diagram in diagrams:
        question_id = diagram.get("question_id")
        image_file_id = diagram.get("image_file_id")
        success = diagram.get("success", False)

        if not success or not image_file_id:
            logger.debug(f"Skipping {question_id}: not successful or no file ID")
            skipped += 1
            continue

        try:
            # Update the document
            databases.update_document(
                database_id="default",
                collection_id="practice_questions",
                document_id=question_id,
                data={
                    "diagramFileId": image_file_id,
                    "diagramRequired": True
                }
            )
            logger.info(f"  ✅ Updated {question_id} -> {image_file_id}")
            updated += 1

        except Exception as e:
            logger.error(f"  ❌ Failed to update {question_id}: {e}")
            errors += 1

    logger.info("=" * 60)
    logger.info("FIX DIAGRAM FILE IDS - COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  Updated: {updated}")
    logger.info(f"  Skipped: {skipped}")
    logger.info(f"  Errors: {errors}")

    return {"updated": updated, "skipped": skipped, "errors": errors}


def main():
    parser = argparse.ArgumentParser(
        description="Fix diagramFileId in database from manifest"
    )
    parser.add_argument(
        "--workspace",
        required=True,
        help="Path to workspace directory with diagram_manifest.json"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP config file (default: .mcp.json)"
    )

    args = parser.parse_args()

    result = fix_diagram_file_ids(args.workspace, args.mcp_config)

    # Exit with error code if any errors
    if result["errors"] > 0:
        exit(1)


if __name__ == "__main__":
    main()
