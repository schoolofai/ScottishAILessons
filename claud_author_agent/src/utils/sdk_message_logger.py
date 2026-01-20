"""SDK Message Logger for Claude Agent SDK observability.

Provides pretty-formatted logging of all messages from Claude Agent SDK
to help observe what's happening under the hood during agent execution.
"""

import json
import logging
import textwrap
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Message type emoji mapping for visual distinction
MESSAGE_EMOJIS = {
    "AssistantMessage": "🤖",
    "UserMessage": "👤",
    "ToolUseMessage": "🔧",
    "ToolResultMessage": "📤",
    "ResultMessage": "✅",
    "ErrorMessage": "❌",
    "SystemMessage": "⚙️",
    "unknown": "❓"
}


def _truncate_content(content: str, max_length: int = 500) -> str:
    """Truncate content for logging, preserving readability."""
    if len(content) <= max_length:
        return content
    return content[:max_length] + f"... [truncated, {len(content)} chars total]"


def _format_tool_call(tool_call: dict) -> str:
    """Format a tool call for pretty logging."""
    name = tool_call.get("name", "unknown")
    args = tool_call.get("args", {})

    # Truncate long args
    args_str = json.dumps(args, indent=2)
    if len(args_str) > 300:
        args_str = args_str[:300] + "... [truncated]"

    return f"  Tool: {name}\n  Args: {args_str}"


def _format_tool_result(result: Any) -> str:
    """Format a tool result for pretty logging."""
    if isinstance(result, str):
        return _truncate_content(result, 400)
    elif isinstance(result, dict):
        result_str = json.dumps(result, indent=2)
        return _truncate_content(result_str, 400)
    else:
        return _truncate_content(str(result), 400)


def log_sdk_message(message: Any, phase: str = "agent") -> None:
    """Log a Claude Agent SDK message in a pretty, readable format.

    Args:
        message: The message object from Claude Agent SDK
        phase: The phase name for context (e.g., "outline", "lesson_1", "critic")
    """
    msg_type = type(message).__name__
    emoji = MESSAGE_EMOJIS.get(msg_type, MESSAGE_EMOJIS["unknown"])

    # Build the log output
    separator = "─" * 60

    logger.info(f"\n{separator}")
    logger.info(f"{emoji} [{phase.upper()}] {msg_type}")
    logger.info(separator)

    # Handle different message types
    if msg_type == "AssistantMessage":
        _log_assistant_message(message)
    elif msg_type == "UserMessage":
        _log_user_message(message)
    elif msg_type == "ToolUseMessage":
        _log_tool_use_message(message)
    elif msg_type == "ToolResultMessage":
        _log_tool_result_message(message)
    elif msg_type == "ResultMessage":
        _log_result_message(message)
    elif msg_type == "ErrorMessage":
        _log_error_message(message)
    else:
        # Fallback for unknown message types
        logger.info(f"  Raw: {str(message)[:500]}")

    logger.info(separator + "\n")


def _log_assistant_message(message: Any) -> None:
    """Log assistant message content."""
    content = getattr(message, 'content', None)
    if content:
        # Wrap long content for readability
        wrapped = textwrap.fill(str(content), width=80, initial_indent="  ", subsequent_indent="  ")
        logger.info(f"Content:\n{_truncate_content(wrapped, 800)}")

    # Check for tool calls
    tool_calls = getattr(message, 'tool_calls', None)
    if tool_calls:
        logger.info(f"  Tool Calls ({len(tool_calls)}):")
        for i, tc in enumerate(tool_calls[:5]):  # Limit to first 5
            logger.info(f"    [{i+1}] {tc.get('name', 'unknown')}")


def _log_user_message(message: Any) -> None:
    """Log user message content."""
    content = getattr(message, 'content', None)
    if content:
        wrapped = textwrap.fill(str(content), width=80, initial_indent="  ", subsequent_indent="  ")
        logger.info(f"Content:\n{_truncate_content(wrapped, 500)}")


def _log_tool_use_message(message: Any) -> None:
    """Log tool use details."""
    tool_name = getattr(message, 'name', getattr(message, 'tool_name', 'unknown'))
    tool_id = getattr(message, 'id', getattr(message, 'tool_id', 'unknown'))

    logger.info(f"  Tool: {tool_name}")
    logger.info(f"  ID: {tool_id}")

    # Log args if available
    args = getattr(message, 'args', getattr(message, 'input', None))
    if args:
        if isinstance(args, dict):
            # Special handling for common tools
            if tool_name in ('Read', 'Write', 'Glob', 'Grep'):
                path = args.get('file_path', args.get('path', args.get('pattern', '')))
                logger.info(f"  Path/Pattern: {path}")
            elif tool_name in ('WebSearch', 'WebFetch'):
                query = args.get('query', args.get('url', ''))
                logger.info(f"  Query/URL: {query}")
            else:
                args_preview = json.dumps(args)[:200]
                logger.info(f"  Args: {args_preview}...")
        else:
            logger.info(f"  Args: {str(args)[:200]}")


def _log_tool_result_message(message: Any) -> None:
    """Log tool result details."""
    tool_name = getattr(message, 'name', getattr(message, 'tool_name', 'unknown'))
    tool_id = getattr(message, 'id', getattr(message, 'tool_id', 'unknown'))

    logger.info(f"  Tool: {tool_name}")
    logger.info(f"  ID: {tool_id}")

    # Log result preview
    result = getattr(message, 'result', getattr(message, 'content', None))
    if result:
        result_preview = _format_tool_result(result)
        logger.info(f"  Result: {result_preview}")

    # Log error if present
    error = getattr(message, 'error', None)
    if error:
        logger.error(f"  ❌ Error: {error}")


def _log_result_message(message: Any) -> None:
    """Log final result message."""
    # Check for structured output
    structured = getattr(message, 'structured_output', None)
    if structured:
        logger.info("  ✅ Structured Output Received")
        if isinstance(structured, dict):
            # Log key fields for common schemas
            if 'total_lessons' in structured:
                logger.info(f"    Total Lessons: {structured['total_lessons']}")
            if 'verdict' in structured:
                logger.info(f"    Verdict: {structured['verdict']}")
            if 'overall_score' in structured:
                logger.info(f"    Score: {structured['overall_score']}")

    # Check for text content
    content = getattr(message, 'content', None)
    if content:
        logger.info(f"  Content: {_truncate_content(str(content), 300)}")


def _log_error_message(message: Any) -> None:
    """Log error message details."""
    error = getattr(message, 'error', getattr(message, 'content', str(message)))
    logger.error(f"  ❌ Error: {error}")


def create_phase_logger(phase: str, workspace_path: Optional[str] = None):
    """Create a context-aware logger for a specific phase.

    Args:
        phase: Phase name (e.g., "outline", "lesson_3", "critic")
        workspace_path: Optional workspace path for context

    Returns:
        A callable that logs SDK messages with phase context
    """
    def phase_log(message: Any) -> None:
        log_sdk_message(message, phase=phase)

    return phase_log
