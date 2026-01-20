"""Claude Agent SDK implementation of SOW Author.

This package provides an autonomous pipeline for authoring Schemes of Work (SOW)
for Scottish secondary education using Claude Agent SDK.

Two authoring modes are available:
- SOWAuthorClaudeAgent: Legacy monolithic approach (single-pass generation)
- IterativeSOWAuthor: New lesson-by-lesson approach (better schema compliance)
"""

from .sow_author_claude_client import SOWAuthorClaudeAgent
from .iterative_sow_author import IterativeSOWAuthor

__version__ = "1.1.0"
__all__ = ["SOWAuthorClaudeAgent", "IterativeSOWAuthor"]
