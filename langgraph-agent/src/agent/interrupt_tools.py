"""Helper utilities for interrupt handling in LangGraph teaching graphs.

Provides helper functions for the interactive lesson card system.
"""

from __future__ import annotations

try:
    from .interrupt_state import InterruptUnifiedState
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState


def should_use_interrupts(state: InterruptUnifiedState) -> bool:
    """Determine if interrupts should be used - ALWAYS TRUE, FAIL FAST.

    Args:
        state: Current state

    Returns:
        Always True - no fallback, interrupts must work or fail
    """
    print(f"🚨 INTERRUPT DEBUG - should_use_interrupts() called")
    print(f"🚨 INTERRUPT DEBUG - fallback_to_messages: {state.get('fallback_to_messages', 'NOT_SET')}")
    print(f"🚨 INTERRUPT DEBUG - interrupt_errors: {state.get('interrupt_errors', [])}")
    print(f"🚨 INTERRUPT DEBUG - session_context disable_interrupts: {state.get('session_context', {}).get('disable_interrupts', 'NOT_SET')}")
    print(f"🚨 INTERRUPT DEBUG - Forcing interrupts to be used - NO FALLBACK")

    # ALWAYS return True - no fallback mechanism
    return True
