"""Pre-processing module for Mock Exam Author Agent v2.

Handles workspace setup and data extraction from Appwrite before agent execution.
This module can be run independently for testing.

Pre-processing steps:
1. Validate prerequisites (course exists, published SOW with mock_exam entries)
2. Create isolated workspace
3. Extract mock_exam entries to workspace files
4. Copy diagram examples to workspace
5. Verify diagram services health
"""

import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple

from ..utils.mock_exam_extractor import (
    extract_mock_exam_entries_to_workspace,
    validate_mock_exam_prerequisites
)
from ..utils.filesystem import IsolatedFilesystem
from ..utils.logging_config import add_workspace_file_handler

import httpx
import os

logger = logging.getLogger(__name__)


class PreprocessingResult:
    """Result of pre-processing step."""

    def __init__(
        self,
        workspace_path: Path,
        mock_exam_entries: list,
        sow_metadata: Dict[str, Any],
        examples_path: Path,
        filesystem: IsolatedFilesystem
    ):
        self.workspace_path = workspace_path
        self.mock_exam_entries = mock_exam_entries
        self.sow_metadata = sow_metadata
        self.examples_path = examples_path
        self.filesystem = filesystem


async def run_preprocessing(
    courseId: str,
    mcp_config_path: str,
    persist_workspace: bool = True,
    verify_diagram_services: bool = True,
    execution_id: str = None
) -> PreprocessingResult:
    """Run all pre-processing steps for mock exam authoring.

    Args:
        courseId: Course identifier (e.g., 'course_c84474')
        mcp_config_path: Path to MCP configuration file
        persist_workspace: If True, preserve workspace after execution
        verify_diagram_services: If True, check diagram services health (FAIL-FAST)
        execution_id: Unique identifier for this execution (auto-generated if None)

    Returns:
        PreprocessingResult with workspace path and extracted data

    Raises:
        ValueError: If prerequisites not met or extraction fails
        RuntimeError: If diagram services unavailable (when verify_diagram_services=True)
    """
    if execution_id is None:
        execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    logger.info(f"Starting pre-processing for courseId='{courseId}' execution_id='{execution_id}'")

    # Step 1: Validate prerequisites
    logger.info("Step 1: Validating prerequisites...")
    prereq_result = await validate_mock_exam_prerequisites(
        courseId=courseId,
        mcp_config_path=mcp_config_path
    )
    logger.info(f"✅ Prerequisites validated: {prereq_result['mock_exam_count']} mock exam(s) found")

    # Step 2: Verify diagram services health (FAIL-FAST)
    if verify_diagram_services:
        logger.info("Step 2: Verifying diagram services health...")
        await _verify_diagram_services_health()
        logger.info("✅ Diagram services healthy")
    else:
        logger.info("Step 2: Skipping diagram services health check")

    # Step 3: Create isolated workspace
    logger.info("Step 3: Creating isolated workspace...")
    filesystem = IsolatedFilesystem(
        execution_id,
        persist=persist_workspace,
        workspace_type="mock_exam"
    )
    # Manually enter context (caller must handle cleanup via filesystem)
    filesystem.__enter__()
    workspace_path = filesystem.root
    logger.info(f"✅ Workspace created: {workspace_path}")

    # Step 4: Set up workspace file logging
    log_file_path = add_workspace_file_handler(
        workspace_path=workspace_path,
        log_filename="run.log",
        log_level="DEBUG"
    )
    logger.info(f"✅ Logging to: {log_file_path}")

    # Step 5: Extract mock_exam entries to workspace
    logger.info("Step 5: Extracting mock_exam entries...")
    mock_exam_entries, sow_metadata = await extract_mock_exam_entries_to_workspace(
        courseId=courseId,
        mcp_config_path=mcp_config_path,
        workspace_path=workspace_path
    )
    logger.info(f"✅ Extracted {len(mock_exam_entries)} mock_exam entry(ies)")

    # Step 6: Copy diagram examples to workspace
    logger.info("Step 6: Copying diagram examples...")
    examples_result = _copy_diagram_examples_to_workspace(workspace_path)
    logger.info(f"✅ Copied {examples_result['count']} diagram example files")

    # Step 7: Write README to workspace
    _write_workspace_readme(workspace_path, courseId, sow_metadata, len(mock_exam_entries))
    logger.info("✅ Written workspace README")

    logger.info("=" * 60)
    logger.info("PRE-PROCESSING COMPLETE")
    logger.info(f"   Workspace: {workspace_path}")
    logger.info(f"   Mock exam entries: {len(mock_exam_entries)}")
    logger.info(f"   Diagram examples: {examples_result['path']}")
    logger.info("=" * 60)

    return PreprocessingResult(
        workspace_path=workspace_path,
        mock_exam_entries=mock_exam_entries,
        sow_metadata=sow_metadata,
        examples_path=Path(examples_result['path']),
        filesystem=filesystem
    )


async def _verify_diagram_services_health() -> Dict[str, Any]:
    """Verify diagram rendering services are healthy.

    Raises:
        RuntimeError: If diagram services are unavailable (fail-fast)
    """
    api_base_url = os.getenv("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
    api_key = os.getenv("DIAGRAM_SCREENSHOT_API_KEY", "dev-api-key-change-in-production")

    logger.info(f"Checking diagram services at: {api_base_url}/health")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{api_base_url}/health",
                headers={"X-API-Key": api_key}
            )

            if response.status_code != 200:
                raise RuntimeError(
                    f"Diagram service health check failed with status {response.status_code}. "
                    f"URL: {api_base_url}/health"
                )

            health_data = response.json()

            if health_data.get("status") != "healthy":
                raise RuntimeError(
                    f"Diagram service reports unhealthy status: {health_data.get('status')}"
                )

            # Verify required renderers
            # Note: matplotlib runs locally (not via DiagramScreenshot), so not included here
            renderers = health_data.get("renderers", {})
            required_renderers = ["jsxgraph", "plotly", "desmos", "imagen"]
            unavailable = []

            for renderer in required_renderers:
                renderer_status = renderers.get(renderer, {})
                is_ready = (
                    renderer_status.get("initialized", False) or
                    renderer_status.get("configured", False)
                )
                if not is_ready:
                    unavailable.append(renderer)

            if unavailable:
                raise RuntimeError(
                    f"Required diagram renderers not initialized: {unavailable}"
                )

            return health_data

    except httpx.ConnectError as e:
        raise RuntimeError(
            f"Cannot connect to diagram service at {api_base_url}. "
            f"Ensure diagramScreenshot service is running. Error: {e}"
        )
    except httpx.TimeoutException as e:
        raise RuntimeError(
            f"Diagram service health check timed out. Error: {e}"
        )


def _copy_diagram_examples_to_workspace(workspace_path: Path) -> Dict[str, Any]:
    """Copy validated diagram examples to workspace.

    Args:
        workspace_path: Path to the isolated workspace

    Returns:
        dict with copied count, path, and inventory

    Raises:
        RuntimeError: If examples not found (fail-fast)
    """
    # Source: diagramScreenshot/tests/examples/*.examples.ts
    examples_source = (
        Path(__file__).parent.parent.parent.parent /
        "diagramScreenshot" / "tests" / "examples"
    )
    examples_dest = workspace_path / "diagram_examples"

    if not examples_source.exists():
        raise RuntimeError(f"Diagram examples not found at {examples_source}")

    examples_dest.mkdir(parents=True, exist_ok=True)

    example_files = [
        "desmos.examples.ts",
        "jsxgraph.examples.ts",
        "plotly.examples.ts",
        "imagen.examples.ts"
        # Note: matplotlib runs locally with Python code, no external examples needed
    ]

    inventory = {}
    copied_count = 0

    for filename in example_files:
        src = examples_source / filename
        if src.exists():
            shutil.copy(src, examples_dest / filename)
            tool_name = filename.replace(".examples.ts", "").upper()
            inventory[tool_name] = filename
            copied_count += 1

    if copied_count == 0:
        raise RuntimeError("No diagram example files found to copy")

    return {
        "copied": True,
        "path": str(examples_dest),
        "inventory": inventory,
        "count": copied_count
    }


def _write_workspace_readme(
    workspace_path: Path,
    courseId: str,
    sow_metadata: Dict[str, Any],
    mock_exam_count: int
) -> None:
    """Write README file to workspace for debugging/inspection."""
    readme_content = f"""# Mock Exam Author Workspace

## Course Information
- **Course ID**: {courseId}
- **SOW ID**: {sow_metadata.get('sowId', 'N/A')}
- **Subject**: {sow_metadata.get('subject', 'N/A')}
- **Level**: {sow_metadata.get('level', 'N/A')}

## Files
- `mock_exam_source.json` - Extracted mock_exam entries from SOW
- `sow_context.json` - Course-level SOW metadata
- `diagram_examples/` - Validated diagram rendering examples
- `run.log` - Execution log

## Mock Exam Entries
- Total entries: {mock_exam_count}

## Pipeline Stages
1. Pre-processing (this step) - Extract data from Appwrite
2. Mock Exam Author Agent - Generate mock_exam.json
3. Mock Exam Critic Agent - Validate and provide feedback
4. Diagram Classifier Agent - Classify questions for diagrams
5. Diagram Author Agent - Generate diagrams
6. Post-processing - Upsert to Appwrite
"""

    readme_path = workspace_path / "README.md"
    readme_path.write_text(readme_content)


# Standalone test function
async def test_preprocessing():
    """Test pre-processing independently."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from src.utils.logging_config import setup_logging
    setup_logging(log_level="INFO")

    result = await run_preprocessing(
        courseId="course_c84473",
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        verify_diagram_services=False  # Skip for quick test
    )

    print(f"✅ Pre-processing complete!")
    print(f"   Workspace: {result.workspace_path}")
    print(f"   Mock exam entries: {len(result.mock_exam_entries)}")
    print(f"   Examples path: {result.examples_path}")

    return result


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_preprocessing())
