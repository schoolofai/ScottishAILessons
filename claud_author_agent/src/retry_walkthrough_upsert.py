#!/usr/bin/env python3
"""Retry Walkthrough Upsert - Re-upload existing templates to Appwrite.

This script reads existing walkthrough_template.json files from workspace
and upserts them to Appwrite WITHOUT re-running the LLM agent.

Useful when:
- Parser was fixed to include new fields (e.g., V2 schema)
- Uploads failed and templates need re-uploading
- Status needs to be changed (draft → published)

Usage:
    cd claud_author_agent
    source .venv/bin/activate

    # Re-upload all templates from a batch workspace
    python -m src.retry_walkthrough_upsert workspace/batch_20260111_233238

    # Re-upload with published status
    python -m src.retry_walkthrough_upsert workspace/batch_20260111_233238 --status published

    # Dry-run to see what would be uploaded
    python -m src.retry_walkthrough_upsert workspace/batch_20260111_233238 --dry-run
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
RESET = '\033[0m'


def find_walkthrough_templates(workspace_path: Path) -> List[Dict[str, Any]]:
    """Find all walkthrough templates in a batch workspace.

    Searches for walkthrough_template.json files and extracts metadata
    from execution_manifest.json in the same directory.

    Args:
        workspace_path: Path to batch workspace

    Returns:
        List of dicts with template_path and metadata
    """
    templates = []

    # Look for execution directories (format: YYYYMMDD_HHMMSS)
    for item in workspace_path.iterdir():
        if item.is_dir() and len(item.name) == 15 and "_" in item.name:
            template_path = item / "walkthrough_template.json"
            manifest_path = item / "execution_manifest.json"

            if template_path.exists():
                # Extract metadata from manifest
                metadata = {}
                if manifest_path.exists():
                    try:
                        with open(manifest_path, 'r') as f:
                            manifest = json.load(f)
                        metadata = {
                            "paper_id": manifest.get("input", {}).get("paper_id", ""),
                            "question_number": manifest.get("input", {}).get("question_number", ""),
                            "paper_code": manifest.get("input", {}).get("paper_code", ""),
                            "year": manifest.get("input", {}).get("year", 0),
                            "subject": manifest.get("input", {}).get("subject", ""),
                            "level": manifest.get("input", {}).get("level", ""),
                        }
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid manifest JSON: {manifest_path}")

                templates.append({
                    "template_path": template_path,
                    "execution_dir": item.name,
                    **metadata
                })

    return sorted(templates, key=lambda x: x.get("question_number", ""))


async def upsert_single_walkthrough(
    template_info: Dict[str, Any],
    status: str,
    mcp_config_path: str,
    dry_run: bool
) -> Dict[str, Any]:
    """Upsert a single walkthrough template.

    Args:
        template_info: Dict with template_path and metadata
        status: Publication status (draft, published, archived)
        mcp_config_path: Path to MCP config
        dry_run: If True, don't actually upsert

    Returns:
        Result dict with success status
    """
    template_path = template_info["template_path"]
    paper_id = template_info.get("paper_id", "unknown")
    question_number = template_info.get("question_number", "unknown")

    result = {
        "paper_id": paper_id,
        "question_number": question_number,
        "success": False,
        "doc_id": None,
        "error": None
    }

    try:
        if dry_run:
            # Just validate the template can be parsed
            from .utils.walkthrough_upserter import parse_walkthrough_template
            walkthrough = parse_walkthrough_template(template_path)

            # Show V2 field counts
            v2_steps_with_concept = sum(1 for s in walkthrough.steps if s.concept_explanation)
            v2_steps_with_peer_tip = sum(1 for s in walkthrough.steps if s.peer_tip)
            v2_steps_with_warning = sum(1 for s in walkthrough.steps if s.student_warning)
            v2_errors_with_gap = sum(1 for e in walkthrough.common_errors if e.learning_gap)
            v2_prereqs = len(walkthrough.prerequisite_links)

            logger.info(f"  {CYAN}V2 Fields:{RESET} {v2_steps_with_concept} concept_explanation, "
                       f"{v2_steps_with_peer_tip} peer_tip, {v2_steps_with_warning} student_warning, "
                       f"{v2_errors_with_gap} learning_gap, {v2_prereqs} prerequisite_links")

            result["success"] = True
            result["doc_id"] = f"{paper_id}_q{question_number} (dry-run)"
            return result

        # Import the upsert function
        from .utils.walkthrough_upserter import upsert_walkthrough

        # Build paper metadata
        paper_metadata = {
            "paper_code": template_info.get("paper_code", ""),
            "year": template_info.get("year", 0),
            "subject": template_info.get("subject", ""),
            "level": template_info.get("level", ""),
        }

        # Upsert the walkthrough
        doc_id = await upsert_walkthrough(
            template_path=template_path,
            paper_id=paper_id,
            question_number=question_number,
            paper_metadata=paper_metadata,
            mcp_config_path=mcp_config_path,
            model_version="walkthrough_author_v2",  # Mark as V2 re-upload
            status=status
        )

        result["success"] = True
        result["doc_id"] = doc_id

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"  {RED}Error:{RESET} {e}")

    return result


async def retry_batch_upsert(
    workspace_path: str,
    status: str = "published",
    mcp_config_path: str = ".mcp.json",
    dry_run: bool = False
) -> Dict[str, Any]:
    """Re-upload all walkthrough templates from a batch workspace.

    Args:
        workspace_path: Path to batch workspace
        status: Publication status for all uploads
        mcp_config_path: Path to MCP config
        dry_run: If True, only validate, don't upload

    Returns:
        Batch result summary
    """
    workspace = Path(workspace_path)

    if not workspace.exists():
        raise FileNotFoundError(f"Workspace not found: {workspace_path}")

    # Find all templates
    templates = find_walkthrough_templates(workspace)

    if not templates:
        logger.warning(f"No walkthrough templates found in {workspace_path}")
        return {"total": 0, "succeeded": 0, "failed": 0, "results": []}

    logger.info(f"\n{BLUE}Found {len(templates)} walkthrough templates{RESET}")

    if dry_run:
        logger.info(f"{YELLOW}DRY-RUN MODE - No changes will be made{RESET}\n")

    results = []
    succeeded = 0
    failed = 0

    for idx, template_info in enumerate(templates, 1):
        paper_id = template_info.get("paper_id", "unknown")
        q_num = template_info.get("question_number", "unknown")

        logger.info(f"[{idx}/{len(templates)}] {paper_id} Q{q_num}")

        result = await upsert_single_walkthrough(
            template_info=template_info,
            status=status,
            mcp_config_path=mcp_config_path,
            dry_run=dry_run
        )

        results.append(result)

        if result["success"]:
            succeeded += 1
            logger.info(f"  {GREEN}✅ Success:{RESET} {result['doc_id']}")
        else:
            failed += 1
            logger.info(f"  {RED}❌ Failed:{RESET} {result['error']}")

    return {
        "total": len(templates),
        "succeeded": succeeded,
        "failed": failed,
        "results": results
    }


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Re-upload existing walkthrough templates to Appwrite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Re-upload all templates from a batch
    python -m src.retry_walkthrough_upsert workspace/batch_20260111_233238

    # Re-upload with published status
    python -m src.retry_walkthrough_upsert workspace/batch_20260111_233238 --status published

    # Preview what would be uploaded (validate templates)
    python -m src.retry_walkthrough_upsert workspace/batch_20260111_233238 --dry-run
"""
    )

    parser.add_argument(
        "workspace",
        help="Path to batch workspace directory"
    )
    parser.add_argument(
        "--status",
        choices=["draft", "published", "archived"],
        default="published",
        help="Publication status for uploaded walkthroughs (default: published)"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP configuration file (default: .mcp.json)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate templates without uploading"
    )

    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_arguments()

    print(f"\n{'='*60}")
    print(f"{BLUE}Walkthrough Template Re-Uploader{RESET}")
    print(f"{'='*60}")
    print(f"Workspace: {args.workspace}")
    print(f"Status:    {args.status}")
    print(f"Dry-run:   {args.dry_run}")
    print(f"{'='*60}\n")

    # Run the batch upsert
    result = asyncio.run(retry_batch_upsert(
        workspace_path=args.workspace,
        status=args.status,
        mcp_config_path=args.mcp_config,
        dry_run=args.dry_run
    ))

    # Print summary
    print(f"\n{'='*60}")
    print(f"{BLUE}BATCH RE-UPLOAD RESULTS{RESET}")
    print(f"{'='*60}")
    print(f"Total templates:  {result['total']}")
    print(f"Succeeded:        {result['succeeded']} {GREEN}✅{RESET}")
    print(f"Failed:           {result['failed']} {RED}❌{RESET}")
    print(f"{'='*60}\n")

    # Exit with appropriate code
    if result['failed'] > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
