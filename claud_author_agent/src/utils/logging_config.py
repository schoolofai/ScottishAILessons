"""Logging configuration for SOW author agent.

Sets up structured logging with appropriate levels and formatters.
"""

import logging
import sys
from pathlib import Path
from typing import Optional

# Track file handlers added to workspaces for cleanup
_workspace_file_handlers: dict[str, logging.FileHandler] = {}


def add_workspace_file_handler(
    workspace_path: Path,
    log_filename: str = "run.log",
    log_level: str = "DEBUG"
) -> Path:
    """Add a file handler to write logs to the workspace.

    This should be called AFTER workspace creation to capture all agent activity
    to a run.log file in the workspace directory.

    Args:
        workspace_path: Path to the workspace directory
        log_filename: Name of the log file (default: run.log)
        log_level: Logging level for file output (default: DEBUG for full detail)

    Returns:
        Path to the created log file
    """
    log_file = workspace_path / log_filename
    numeric_level = getattr(logging, log_level.upper(), logging.DEBUG)

    # Create detailed formatter for file logs
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Create file handler
    file_handler = logging.FileHandler(log_file, mode='w')  # 'w' to start fresh each run
    file_handler.setLevel(numeric_level)
    file_handler.setFormatter(formatter)

    # Add to root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)

    # Track for potential cleanup
    workspace_key = str(workspace_path)
    _workspace_file_handlers[workspace_key] = file_handler

    root_logger.info(f"📝 Logging to workspace file: {log_file}")

    return log_file


def remove_workspace_file_handler(workspace_path: Path) -> None:
    """Remove the file handler for a workspace (cleanup).

    Args:
        workspace_path: Path to the workspace directory
    """
    workspace_key = str(workspace_path)
    if workspace_key in _workspace_file_handlers:
        handler = _workspace_file_handlers.pop(workspace_key)
        root_logger = logging.getLogger()
        root_logger.removeHandler(handler)
        handler.close()


def setup_logging(
    log_level: str = "DEBUG",
    log_file: Optional[Path] = None,
    include_timestamp: bool = True
) -> logging.Logger:
    """Configure logging for the SOW author agent.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
                   Default is DEBUG for maximum verbosity in pipeline execution.
        log_file: Optional file path to write logs to
        include_timestamp: Whether to include timestamps in log messages

    Returns:
        Configured root logger instance
    """
    # Convert string level to logging constant
    # Default to DEBUG for fail-fast pipeline debugging
    numeric_level = getattr(logging, log_level.upper(), logging.DEBUG)

    # Create formatter
    if include_timestamp:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    else:
        formatter = logging.Formatter(
            '%(name)s - %(levelname)s - %(message)s'
        )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove existing handlers
    root_logger.handlers.clear()

    # Add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Add file handler if specified
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
        root_logger.info(f"Logging to file: {log_file}")

    root_logger.info(f"Logging configured at level: {log_level}")

    return root_logger
