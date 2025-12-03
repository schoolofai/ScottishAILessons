"""Test script to run upsert from existing workspace data.

Usage:
    cd claud_author_agent
    source .venv/bin/activate
    python test_upsert_from_workspace.py --workspace workspace/nano_exec_20251201_174710
"""

import argparse
import asyncio
import base64
import json
import logging
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from src.utils.diagram_upserter import batch_upsert_diagrams

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def run_upsert_test(workspace_path: str) -> dict:
    """Load workspace data and run batch upsert.

    Args:
        workspace_path: Path to workspace directory

    Returns:
        dict: Upsert results
    """
    workspace = Path(workspace_path)

    # Load diagrams_output.json
    diagrams_output_path = workspace / "diagrams_output.json"
    if not diagrams_output_path.exists():
        raise FileNotFoundError(f"diagrams_output.json not found in {workspace}")

    with open(diagrams_output_path, "r") as f:
        diagrams_output = json.load(f)

    # Load lesson_template.json
    lesson_template_path = workspace / "lesson_template.json"
    if not lesson_template_path.exists():
        raise FileNotFoundError(f"lesson_template.json not found in {workspace}")

    with open(lesson_template_path, "r") as f:
        lesson_template = json.load(f)

    lesson_template_id = lesson_template.get("$id")
    if not lesson_template_id:
        raise ValueError("lesson_template.json missing $id field")

    logger.info(f"Lesson Template ID: {lesson_template_id}")
    logger.info(f"Diagrams to upsert: {len(diagrams_output['diagrams'])}")

    # Build diagram data for batch_upsert_diagrams
    diagrams_data = []

    for diagram in diagrams_output["diagrams"]:
        # Load PNG and convert to base64
        image_path = Path(diagram["image_path"])
        if not image_path.exists():
            logger.error(f"Image not found: {image_path}")
            continue

        with open(image_path, "rb") as f:
            image_bytes = f.read()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        # Parse critique_feedback (may be string or list)
        critique_feedback = diagram.get("critique_feedback", "")
        if isinstance(critique_feedback, str):
            # Convert string feedback to list format expected by upserter
            critique_feedback = [{"feedback": critique_feedback, "score": diagram.get("visual_critique_score", 0.0)}]

        # Build upsert data
        upsert_data = {
            "lesson_template_id": lesson_template_id,
            "card_id": diagram["cardId"],
            "diagram_index": diagram.get("diagram_index", 0),
            "jsxgraph_json": diagram.get("jsxgraph_json", ""),  # Empty for gemini_nano backend
            "image_base64": image_base64,
            "diagram_type": diagram.get("diagram_type", "geometry"),
            "visual_critique_score": diagram.get("visual_critique_score", 0.0),
            "critique_iterations": diagram.get("critique_iterations", 1),
            "critique_feedback": critique_feedback,
            "execution_id": workspace.name,  # Use workspace folder name as execution_id
            "diagram_context": diagram.get("diagram_context", "lesson"),
            "diagram_description": diagram.get("diagram_description", ""),
            "rendering_backend": diagram.get("rendering_backend", "gemini_nano")
        }

        diagrams_data.append(upsert_data)
        logger.info(
            f"  Prepared: {diagram['cardId']} - {diagram.get('diagram_context', 'lesson')} - "
            f"index {diagram.get('diagram_index', 0)} - {len(image_base64)} bytes base64"
        )

    if not diagrams_data:
        raise ValueError("No diagrams found to upsert")

    # Run batch upsert
    logger.info(f"\n{'='*60}")
    logger.info(f"RUNNING BATCH UPSERT: {len(diagrams_data)} diagrams")
    logger.info(f"{'='*60}\n")

    results = await batch_upsert_diagrams(
        diagrams_data=diagrams_data,
        mcp_config_path=".mcp.json"
    )

    return results


def main():
    parser = argparse.ArgumentParser(description="Test upsert from workspace")
    parser.add_argument(
        "--workspace",
        required=True,
        help="Path to workspace directory (e.g., workspace/nano_exec_20251201_174710)"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("DIAGRAM UPSERT TEST")
    print("=" * 60)
    print(f"Workspace: {args.workspace}")
    print("=" * 60)

    results = asyncio.run(run_upsert_test(args.workspace))

    print("\n" + "=" * 60)
    print("UPSERT RESULTS")
    print("=" * 60)
    print(f"  Total: {results['total']}")
    print(f"  Succeeded: {results['succeeded']}")
    print(f"  Failed: {results['failed']}")

    if results["documents"]:
        print("\n✅ Created/Updated Documents:")
        for doc in results["documents"]:
            print(f"    - {doc.get('$id')} ({doc.get('cardId')} - {doc.get('diagram_context', 'unknown')})")

    if results["errors"]:
        print("\n❌ Errors:")
        for err in results["errors"]:
            print(f"    - {err['card_id']}: {err['error']}")

    print("=" * 60)

    return 0 if results["failed"] == 0 else 1


if __name__ == "__main__":
    exit(main())
