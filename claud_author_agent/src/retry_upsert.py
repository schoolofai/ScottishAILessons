#!/usr/bin/env python3
"""Retry script to re-run diagram upsert from preserved workspace.

Usage:
    cd claud_author_agent
    source .venv/bin/activate
    python -m src.retry_upsert <workspace_path>

Example:
    python -m src.retry_upsert workspace/exec_20260109_154723
"""

import asyncio
import base64
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, Any, List

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_diagrams_output(workspace_path: str) -> List[Dict[str, Any]]:
    """Load diagrams from diagrams_output.json."""
    diagrams_file = Path(workspace_path) / "diagrams_output.json"

    if not diagrams_file.exists():
        raise FileNotFoundError(f"diagrams_output.json not found at {diagrams_file}")

    with open(diagrams_file, "r") as f:
        data = json.load(f)

    diagrams = data.get("diagrams", [])
    logger.info(f"Loaded {len(diagrams)} diagrams from {diagrams_file}")
    return diagrams


def convert_png_to_base64(image_path: str) -> str:
    """Convert PNG file to base64 string."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    return base64.b64encode(image_bytes).decode("utf-8")


def transform_diagram_for_upserter(diagram: Dict[str, Any], execution_id: str) -> Dict[str, Any]:
    """Transform diagram data to match batch_upsert_diagrams expected format.

    Field mapping:
        - lessonTemplateId → lesson_template_id
        - cardId → card_id
        - image_path → image_base64 (converted)
        - Add execution_id
        - Handle optional critique fields safely
    """
    # Convert image to base64
    image_path = diagram["image_path"]
    logger.info(f"Converting {os.path.basename(image_path)} to base64...")
    image_base64 = convert_png_to_base64(image_path)

    # Build upserter-compatible data structure
    transformed = {
        "lesson_template_id": diagram["lessonTemplateId"],
        "card_id": diagram["cardId"],
        "jsxgraph_json": diagram.get("jsxgraph_json", ""),
        "image_base64": image_base64,
        "diagram_type": diagram.get("diagram_type", "geometry"),
        # Safe access for optional critique fields (fixed in this version)
        "visual_critique_score": diagram.get("visual_critique_score", 0.0),
        "critique_iterations": diagram.get("critique_iterations", 0),
        "critique_feedback": diagram.get("critique_feedback", ""),
        "execution_id": execution_id,
        "diagram_context": diagram.get("diagram_context"),  # lesson or cfu
        "diagram_description": diagram.get("diagram_description"),
        "diagram_index": diagram.get("diagram_index", 0),
        "rendering_backend": "jsxgraph"  # Default backend
    }

    return transformed


async def retry_batch_upsert(workspace_path: str) -> Dict[str, Any]:
    """Retry batch upsert from preserved workspace."""
    # Import the upserter (relative import from src package)
    from .utils.diagram_upserter import batch_upsert_diagrams

    # Extract execution_id from workspace folder name
    workspace_name = os.path.basename(workspace_path.rstrip("/"))
    execution_id = workspace_name  # e.g., "exec_20260109_154723"
    logger.info(f"Execution ID: {execution_id}")

    # Load diagrams
    diagrams = load_diagrams_output(workspace_path)

    if not diagrams:
        logger.warning("No diagrams found in workspace")
        return {"total": 0, "succeeded": 0, "failed": 0, "documents": [], "errors": []}

    # Transform diagrams for upserter
    transformed_diagrams = []
    for idx, diagram in enumerate(diagrams):
        try:
            logger.info(f"[{idx+1}/{len(diagrams)}] Transforming {diagram.get('cardId', 'unknown')}...")
            transformed = transform_diagram_for_upserter(diagram, execution_id)
            transformed_diagrams.append(transformed)
        except Exception as e:
            logger.error(f"Failed to transform diagram {idx}: {e}")
            raise

    logger.info(f"\n{'='*60}")
    logger.info(f"Starting batch upsert of {len(transformed_diagrams)} diagrams...")
    logger.info(f"{'='*60}\n")

    # Run batch upsert
    result = await batch_upsert_diagrams(
        diagrams_data=transformed_diagrams,
        mcp_config_path=".mcp.json"
    )

    return result


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python -m src.retry_upsert <workspace_path>")
        print("Example: python -m src.retry_upsert workspace/exec_20260109_154723")
        sys.exit(1)

    workspace_path = sys.argv[1]

    # Validate workspace exists
    if not os.path.isdir(workspace_path):
        print(f"❌ Workspace not found: {workspace_path}")
        sys.exit(1)

    logger.info(f"Retrying upsert from workspace: {workspace_path}")

    # Run async upsert
    result = asyncio.run(retry_batch_upsert(workspace_path))

    # Print results
    print(f"\n{'='*60}")
    print("BATCH UPSERT RESULTS")
    print(f"{'='*60}")
    print(f"Total diagrams:   {result['total']}")
    print(f"Succeeded:        {result['succeeded']} ✅")
    print(f"Failed:           {result['failed']} ❌")

    if result['errors']:
        print(f"\nErrors:")
        for error in result['errors']:
            print(f"  - {error['card_id']}: {error['error'][:100]}...")

    print(f"{'='*60}\n")

    # Exit code based on success
    if result['failed'] > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
