"""Configuration for interrupt-enabled graphs.

This module provides configuration constants and helper functions for
setting up interrupt-enabled LangGraph agents with proper checkpointer
configuration and Tool UI integration.
"""

import os
from typing import Dict, Any, Optional

# Checkpointer database configurations
DEFAULT_MAIN_INTERRUPTS_DB = os.getenv("MAIN_INTERRUPTS_DB", "main_interrupts.sqlite")
DEFAULT_TEACHING_INTERRUPTS_DB = os.getenv("TEACHING_INTERRUPTS_DB", "teaching_interrupts.sqlite")

# Interrupt timeout configurations (in seconds)
DEFAULT_CARD_TIMEOUT = int(os.getenv("CARD_INTERRUPT_TIMEOUT", "300"))  # 5 minutes
DEFAULT_FEEDBACK_TIMEOUT = int(os.getenv("FEEDBACK_INTERRUPT_TIMEOUT", "180"))  # 3 minutes
DEFAULT_PROGRESS_TIMEOUT = int(os.getenv("PROGRESS_INTERRUPT_TIMEOUT", "120"))  # 2 minutes
DEFAULT_SUMMARY_TIMEOUT = int(os.getenv("SUMMARY_INTERRUPT_TIMEOUT", "300"))  # 5 minutes

# Feature flags
ENABLE_INTERRUPTS = os.getenv("ENABLE_INTERRUPTS", "true").lower() == "true"
ENABLE_AUTO_FALLBACK = os.getenv("ENABLE_AUTO_FALLBACK", "true").lower() == "true"
MAX_INTERRUPT_ERRORS = int(os.getenv("MAX_INTERRUPT_ERRORS", "3"))

# Tool UI configurations
TOOL_UI_CONFIG = {
    "lesson_card_presentation": {
        "timeout": DEFAULT_CARD_TIMEOUT,
        "allow_partial": False,
        "retry_on_error": True,
        "auto_advance": False
    },
    "feedback_presentation": {
        "timeout": DEFAULT_FEEDBACK_TIMEOUT,
        "require_acknowledgment": True,
        "show_detailed_reasoning": True,
        "allow_hint_request": True
    },
    "progress_acknowledgment": {
        "timeout": DEFAULT_PROGRESS_TIMEOUT,
        "auto_continue": True,
        "show_next_preview": True,
        "enable_countdown": True
    },
    "lesson_summary_presentation": {
        "timeout": DEFAULT_SUMMARY_TIMEOUT,
        "allow_retry": True,
        "show_detailed_analysis": True,
        "enable_performance_breakdown": True
    }
}


def get_interrupt_config(tool_name: str) -> Dict[str, Any]:
    """Get configuration for a specific Tool UI component.
    
    Args:
        tool_name: Name of the tool (e.g., 'lesson_card_presentation')
        
    Returns:
        Configuration dictionary for the tool
    """
    return TOOL_UI_CONFIG.get(tool_name, {})


def should_enable_interrupts(session_context: Optional[Dict[str, Any]] = None) -> bool:
    """Determine if interrupts should be enabled for this session.
    
    Args:
        session_context: Session context from the frontend
        
    Returns:
        True if interrupts should be enabled
    """
    if not ENABLE_INTERRUPTS:
        return False
    
    if session_context and session_context.get("disable_interrupts", False):
        return False
    
    return True


def get_checkpointer_config(graph_type: str = "main") -> Dict[str, Any]:
    """Get checkpointer configuration for the specified graph type.
    
    Args:
        graph_type: Type of graph ('main' or 'teaching')
        
    Returns:
        Checkpointer configuration
    """
    if graph_type == "teaching":
        return {
            "conn_string": DEFAULT_TEACHING_INTERRUPTS_DB,
            "name": "teaching_loop_interrupt"
        }
    else:
        return {
            "conn_string": DEFAULT_MAIN_INTERRUPTS_DB,
            "name": "agent_interrupt"
        }


def create_interrupt_payload(
    tool_name: str,
    args: Dict[str, Any],
    config_overrides: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a standardized interrupt payload.
    
    Args:
        tool_name: Name of the Tool UI component
        args: Arguments to pass to the Tool UI
        config_overrides: Optional configuration overrides
        
    Returns:
        Formatted interrupt payload
    """
    tool_config = get_interrupt_config(tool_name)
    
    if config_overrides:
        tool_config = {**tool_config, **config_overrides}
    
    return {
        "tool": tool_name,
        "args": args,
        "config": tool_config
    }


# Environment-specific configurations
DEVELOPMENT_CONFIG = {
    "enable_debug_logging": True,
    "reduce_timeouts": True,
    "show_interrupt_metadata": True,
    "enable_interrupt_history": True
}

PRODUCTION_CONFIG = {
    "enable_debug_logging": False,
    "reduce_timeouts": False,
    "show_interrupt_metadata": False,
    "enable_interrupt_history": True
}


def get_environment_config() -> Dict[str, Any]:
    """Get configuration based on environment."""
    env = os.getenv("NODE_ENV", "development")
    
    if env == "production":
        return PRODUCTION_CONFIG
    else:
        return DEVELOPMENT_CONFIG