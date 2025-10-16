"""Isolated filesystem management for SOW authoring process.

Provides a workspace with flat file structure for subagent communication:
- Course_data.txt
- research_pack_json
- authored_sow_json
- sow_critic_result_json
"""

import shutil
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class IsolatedFilesystem:
    """Manages isolated temporary filesystem for SOW authoring.

    Creates a flat file structure workspace that persists across subagent executions
    and can optionally be preserved after completion for debugging.

    Attributes:
        execution_id: Unique identifier for this execution
        persist: Whether to preserve workspace after completion
        root: Path to the workspace root directory
    """

    def __init__(self, execution_id: str, persist: bool = True):
        """Initialize isolated filesystem.

        Args:
            execution_id: Unique identifier for this execution (e.g., timestamp-based)
            persist: If True, preserve workspace after completion. If False, cleanup on exit.
        """
        self.execution_id = execution_id
        self.persist = persist
        self.root: Optional[Path] = None

    def __enter__(self) -> "IsolatedFilesystem":
        """Context manager entry - create workspace."""
        self.setup()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup if not persisting."""
        if not self.persist:
            self.cleanup()
        else:
            logger.info(f"Workspace preserved at: {self.root}")
        return False

    def setup(self) -> Path:
        """Create workspace directory and initialize README.

        Returns:
            Path to the workspace root directory

        Raises:
            OSError: If directory creation fails
        """
        # Get project root (claud_author_agent/)
        project_root = Path(__file__).parent.parent.parent
        workspace_base = project_root / "workspace"

        # Create workspace base directory if it doesn't exist
        workspace_base.mkdir(parents=True, exist_ok=True)

        # Create execution-specific subfolder
        self.root = workspace_base / self.execution_id
        self.root.mkdir(parents=True, exist_ok=True)

        logger.info(f"Created workspace: {self.root}")

        # Write README to document workspace structure
        readme_path = self.root / "README.md"
        readme_content = f"""# SOW Author Workspace - Execution {self.execution_id}

## Workspace Structure (Flat Files)

This workspace uses a flat file structure for subagent communication:

### Input Files (Created by Subagents)
- `Course_data.txt` - SQA course data extracted from Appwrite
- `research_pack_json` - Research pack created by research subagent

### Output Files (Created by Author/Critic)
- `authored_sow_json` - Complete authored SOW
- `sow_critic_result_json` - Validation results from unified critic

## Subagent Execution Order

1. **Research Subagent** → Creates `research_pack_json`
2. **Course Data Extractor** → Creates `Course_data.txt`
3. **SOW Author** → Reads inputs, creates `authored_sow_json`
4. **Unified Critic** → Validates, creates `sow_critic_result_json`
5. **Upserter** → Reads `authored_sow_json`, writes to Appwrite

## File Access Pattern

All subagents access files via:
- `/workspace/Course_data.txt`
- `/workspace/research_pack_json`
- `/workspace/authored_sow_json`
- `/workspace/sow_critic_result_json`

The `/workspace/` path is mapped to: `{self.root}`
"""
        readme_path.write_text(readme_content)
        logger.info(f"Workspace initialized with README at: {readme_path}")

        return self.root

    def cleanup(self):
        """Remove workspace directory and all contents.

        Only called if persist=False. Otherwise workspace is preserved for inspection.
        """
        if self.root and self.root.exists():
            try:
                shutil.rmtree(self.root)
                logger.info(f"Cleaned up workspace: {self.root}")
            except Exception as e:
                logger.error(f"Failed to cleanup workspace {self.root}: {e}")
        else:
            logger.warning("No workspace to cleanup or already removed")

    def get_file_path(self, filename: str) -> Path:
        """Get absolute path to a file in the workspace.

        Args:
            filename: Name of the file (e.g., 'Course_data.txt')

        Returns:
            Absolute path to the file

        Raises:
            ValueError: If workspace not initialized
        """
        if not self.root:
            raise ValueError("Workspace not initialized. Call setup() first.")
        return self.root / filename

    def file_exists(self, filename: str) -> bool:
        """Check if a file exists in the workspace.

        Args:
            filename: Name of the file to check

        Returns:
            True if file exists, False otherwise
        """
        if not self.root:
            return False
        return (self.root / filename).exists()

    def read_file(self, filename: str) -> str:
        """Read contents of a file from workspace.

        Args:
            filename: Name of the file to read

        Returns:
            File contents as string

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If workspace not initialized
        """
        file_path = self.get_file_path(filename)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return file_path.read_text()

    def write_file(self, filename: str, content: str):
        """Write content to a file in workspace.

        Args:
            filename: Name of the file to write
            content: Content to write

        Raises:
            ValueError: If workspace not initialized
        """
        file_path = self.get_file_path(filename)
        file_path.write_text(content)
        logger.debug(f"Wrote file: {file_path} ({len(content)} bytes)")

    def list_files(self) -> list[str]:
        """List all files in the workspace.

        Returns:
            List of filenames (not full paths)
        """
        if not self.root or not self.root.exists():
            return []
        return [f.name for f in self.root.iterdir() if f.is_file()]
