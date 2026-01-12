"""Isolated filesystem management for agent workspaces.

Provides a workspace with context-specific structure for different agent types:
- SOW Author: Course_data.txt, research_pack_json, authored_sow_json
- Lesson Migration: current_lesson.json, validation_errors.txt, migrated_lesson.json
- Diagram Author: lesson_template.json, diagrams/, diagram_metadata.json
- Lesson Author: (multi-stage lesson authoring workspace)
"""

import shutil
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class IsolatedFilesystem:
    """Manages isolated temporary filesystem for agent workspaces.

    Creates a context-specific workspace structure that persists across agent executions
    and can optionally be preserved after completion for debugging.

    Supports nested workspaces for batch processing where individual question workspaces
    live under a parent batch directory.

    Attributes:
        execution_id: Unique identifier for this execution
        persist: Whether to preserve workspace after completion
        workspace_type: Type of workspace (sow_author, migration, diagram, lesson_author, walkthrough_author)
        parent_dir: Optional parent directory for nested workspaces (e.g., batch folder)
        root: Path to the workspace root directory
    """

    def __init__(
        self,
        execution_id: str,
        persist: bool = True,
        workspace_type: str = "sow_author",
        parent_dir: Optional[Path] = None
    ):
        """Initialize isolated filesystem.

        Args:
            execution_id: Unique identifier for this execution (e.g., timestamp-based)
            persist: If True, preserve workspace after completion. If False, cleanup on exit.
            workspace_type: Workspace context type. Options:
                - "sow_author": SOW authoring workspace (default for backward compatibility)
                - "migration": Lesson migration workspace
                - "diagram": Diagram generation workspace
                - "lesson_author": Lesson authoring workspace
                - "walkthrough_author": Walkthrough authoring workspace
            parent_dir: Optional parent directory path. If provided, workspace is created
                as a subdirectory of parent_dir (for nested batch workspaces).
                If None, workspace is created in default location.
        """
        self.execution_id = execution_id
        self.persist = persist
        self.workspace_type = workspace_type
        self.parent_dir = Path(parent_dir) if parent_dir else None
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

    def _get_readme_content(self) -> str:
        """Generate context-specific README content based on workspace type.

        Returns:
            Markdown-formatted README content for the workspace
        """
        if self.workspace_type == "sow_author":
            return f"""# SOW Author Workspace - Execution {self.execution_id}

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

        elif self.workspace_type == "migration":
            return f"""# Lesson Migration Workspace - Execution {self.execution_id}

## Purpose
Upgrades existing lesson template to meet current schema requirements

## Workspace Files

### Input Files
- `current_lesson.json` - Existing lesson template that needs migration
- `validation_errors.txt` - Pydantic schema validation errors

### Output Files
- `migrated_lesson.json` - Upgraded lesson template (REQUIRED OUTPUT)

## Migration Process

1. **Migration Agent** reads `current_lesson.json` and `validation_errors.txt`
2. **Agent adds missing fields** (rubrics, misconceptions, etc.)
3. **Agent writes** complete migrated lesson to `migrated_lesson.json`
4. **Validation** confirms schema compliance
5. **Upsert** writes migrated lesson back to Appwrite

## Important Notes

⚠️ **The agent MUST create `migrated_lesson.json` as a new file**
- DO NOT modify `current_lesson.json` in-place
- Preserve ALL existing educational content
- Add ONLY missing required fields

The `/workspace/` path is mapped to: `{self.root}`
"""

        elif self.workspace_type == "diagram":
            return f"""# Diagram Generation Workspace - Execution {self.execution_id}

## Purpose
Generates Excalidraw diagrams for lesson cards

## Workspace Files

### Input Files
- `lesson_template.json` - Lesson template with cards to visualize

### Output Files
- `diagrams/` - Directory containing generated Excalidraw JSON files
- `diagram_metadata.json` - Metadata about generated diagrams

## Diagram Generation Process

1. **Diagram Agent** reads `lesson_template.json`
2. **For each card** eligible for visualization:
   - Generates Excalidraw JSON diagram
   - Saves to `diagrams/card_{{n}}_diagram.json`
3. **Metadata** tracks which cards have diagrams
4. **Upserter** uploads diagrams to Appwrite Storage

The `/workspace/` path is mapped to: `{self.root}`
"""

        elif self.workspace_type == "lesson_author":
            return f"""# Lesson Author Workspace - Execution {self.execution_id}

## Purpose
Multi-stage lesson authoring with research, authoring, and critique

## Workspace Files

### Input/Output Files
- `research_pack.json` - Educational research and examples
- `lesson_template.json` - Generated lesson template
- `critique_results.json` - Validation and feedback from critic
- `final_lesson.json` - Final validated lesson template

## Authoring Pipeline

1. **Research Subagent** → Creates research pack
2. **Lesson Author Subagent** → Generates lesson template
3. **Critic Subagent** → Validates and provides feedback
4. **Refinement Loop** → Iterates until validation passes
5. **Upserter** → Writes final lesson to Appwrite

The `/workspace/` path is mapped to: `{self.root}`
"""

        elif self.workspace_type == "mock_exam":
            return f"""# Mock Exam Author Workspace - Execution {self.execution_id}

## Purpose
Generate frontend-ready mock exam JSON from Authored_SOW mock_exam entries

## Workspace Structure

### Input Files (Pre-populated by Python extraction)
- `mock_exam_source.json` - Mock exam entry extracted from Authored_SOW
  - Contains: courseId, sowId, mock_exam_entries array
- `sow_context.json` - Course-level SOW metadata
  - Contains: subject, level, accessibility_notes, engagement_notes

### Output Files (Created by Subagents)
- `mock_exam.json` - Complete frontend-ready exam structure
- `mock_exam_critic_result.json` - UX quality validation results

## Mock Exam Authoring Pipeline

1. **Pre-processing (Python)** → Extracts mock_exam entries from Authored_SOW
2. **Mock Exam Author Subagent** → Transforms SOW entry to exam JSON
3. **UX Critic Subagent** → Validates frontend UX quality
4. **Revision Loop** → Iterates until UX validation passes
5. **Post-processing (Python)** → Upserts to Appwrite mock_exams collection

## Schema Validation

Use `mcp__validator__validate_mock_exam_schema` tool for Pydantic validation:
- Validates question structure, marks sums, accessibility fields
- Returns specific error locations for quick fixes

## Key Requirements

- Every question_stem must have question_stem_plain
- Marks must sum correctly (scheme → question → section → total)
- Worked solutions must be complete and step-by-step
- Scottish contexts only (£, NHS, Scottish shops)
- Time estimates must not exceed timeLimit

The `/workspace/` path is mapped to: `{self.root}`
"""

        elif self.workspace_type == "notes_author":
            return f"""# Revision Notes Author Workspace - Execution {self.execution_id}

## Purpose
Generate Cornell-method revision notes from published SOW and lesson templates

## Workspace Structure

### Input Directory: `inputs/`
- `course_metadata.json` - Course information (title, subject, level)
- `sow_entry.json` - Published SOW with lesson topics and outcomes
- `lesson_templates/` - Directory containing all lesson template JSON files
  - `lesson_01.json`
  - `lesson_02.json`
  - ... (one per lesson)

### Output Directory: `outputs/`
- `course_cheat_sheet.md` - High-level course summary (Cornell method)
- `lesson_notes_01.md` - Per-lesson revision notes
- `lesson_notes_02.md` - Per-lesson revision notes
- ... (one per lesson)

## Notes Generation Pipeline

1. **Pre-processing** → Python utilities extract course data, SOW, lesson templates
2. **Notes Author Subagent** → Generates all markdown files using Cornell method
3. **Validation** → Confirms all expected files exist (1 cheat sheet + N lesson notes)
4. **Upload** → Markdown files uploaded to Storage, metadata to database

## Cornell Method Structure

Each note contains:
- **Cues** - Key questions/prompts (left column)
- **Notes** - Main content with examples (right column)
- **Summary** - Bottom section synthesizing key points

## Spaced Repetition Schedule

Generated notes include review schedule:
- Day 2 (initial reinforcement)
- Day 5 (short-term consolidation)
- Week 2 (medium-term retention)
- Month 1 (long-term mastery)

The `/workspace/` path is mapped to: `{self.root}`
"""

        elif self.workspace_type == "practice_questions":
            return f"""# Practice Question Author Workspace - Execution {self.execution_id}

## Purpose
Generate offline practice questions for Infinite Practice V2 system

## Workspace Structure

### Input Files (Pre-populated by Python extraction)
- `lesson_template.json` - Lesson template with decompressed cards

### Intermediate Files (Created by Block Agent)
- `blocks_output.json` - Extracted concept blocks with content hashes

### Output Files (Created by Question Agent)
- `questions_output.json` - Generated questions per block/difficulty

## Practice Question Pipeline

1. **Pre-processing (Python)** → Fetches lesson template from Appwrite
2. **Block Extraction Agent** → Extracts concept blocks from lesson cards
3. **Question Generation Agent** → Generates N questions per block per difficulty
4. **Post-processing (Python)** → Upserts to practice_questions + practice_blocks

## Question Structure

Each generated question contains:
- `block_id` - Source concept block
- `difficulty` - easy | medium | hard
- `question_type` - multiple_choice | numeric | short_answer
- `stem` - Question text with LaTeX math
- `options` - For MCQ only
- `correct_answer` - Expected answer
- `solution` - Step-by-step worked solution
- `hints` - Progressive hints (2-3 levels)
- `content_hash` - For deduplication

## Default Question Counts

Per block:
- Easy: 5 questions
- Medium: 5 questions
- Hard: 3 questions

Total: 13 questions × N blocks

The `/workspace/` path is mapped to: `{self.root}`
"""

        elif self.workspace_type == "walkthrough_author":
            batch_info = ""
            if self.parent_dir:
                batch_info = f"""
## Batch Context
This workspace is NESTED under batch directory: `{self.parent_dir}`
All question workspaces for this batch live under the same parent folder.
"""
            return f"""# Walkthrough Author Workspace - Execution {self.execution_id}

## Purpose
Generate examiner-aligned step-by-step walkthrough for SQA past paper question.
{batch_info}
## Workspace Structure

### Metadata Files (for observability/debug/resume)
- `execution_manifest.json` - Full execution context written at START
- `execution_log.json` - Step-by-step progress updated during pipeline
- `final_result.json` - Final outcome with metrics written at END

### Input Files (Pre-populated by Python extraction)
- `walkthrough_source.json` - Question + marking scheme data
- `paper_context.json` - General marking principles and formulae

### Output Files (Created by Subagents)
- `walkthrough_template.json` - Generated walkthrough (populated by agents)
- `walkthrough_critic_result.json` - Validation results from critic

## Walkthrough Authoring Pipeline

1. **Pre-processing (Python)** → Extract question, create manifest, write source files
2. **Walkthrough Author Subagent** → Generate step-by-step walkthrough
3. **Common Errors Subagent** → Add realistic common errors
4. **Walkthrough Critic Subagent** → Validate alignment and quality
5. **Post-processing (Python)** → Write final_result, upsert to Appwrite

## Key Files for Debugging

- `execution_manifest.json` - Contains paper_id, question_number, CLI args
- `execution_log.json` - Shows which stage failed and when
- `final_result.json` - Success/failure status and metrics

The `/workspace/` path is mapped to: `{self.root}`
"""

        else:
            # Generic fallback for unknown workspace types
            return f"""# Agent Workspace - Execution {self.execution_id}

## Workspace Type
{self.workspace_type}

## Purpose
Isolated workspace for agent execution

## Location
The `/workspace/` path is mapped to: `{self.root}`
"""

    def setup(self) -> Path:
        """Create workspace directory and initialize context-specific README.

        If parent_dir was provided during initialization, the workspace is created
        as a nested subdirectory under that parent (for batch processing).
        Otherwise, workspace is created in the default location.

        Returns:
            Path to the workspace root directory

        Raises:
            OSError: If directory creation fails
        """
        if self.parent_dir:
            # NESTED: Create workspace under parent directory (batch mode)
            # Ensure parent exists
            self.parent_dir.mkdir(parents=True, exist_ok=True)
            self.root = self.parent_dir / self.execution_id
            logger.info(f"Creating nested workspace under batch: {self.parent_dir}")
        else:
            # STANDALONE: Create in default location
            project_root = Path(__file__).parent.parent.parent
            workspace_base = project_root / "workspace"
            workspace_base.mkdir(parents=True, exist_ok=True)
            self.root = workspace_base / self.execution_id

        self.root.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created workspace: {self.root} (type: {self.workspace_type}, nested: {self.parent_dir is not None})")

        # Write context-specific README to document workspace structure
        readme_path = self.root / "README.md"
        readme_content = self._get_readme_content()
        readme_path.write_text(readme_content)
        logger.info(f"Workspace initialized with {self.workspace_type} README at: {readme_path}")

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
