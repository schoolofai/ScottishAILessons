"""Claude Agent SDK implementation of SOW Author.

This package provides an autonomous pipeline for authoring Schemes of Work (SOW)
for Scottish secondary education using Claude Agent SDK.
"""

from .sow_author_claude_client import SOWAuthorClaudeAgent

__version__ = "1.0.0"
__all__ = ["SOWAuthorClaudeAgent"]
