"""SQA Subgraphs Module

Contains reusable subgraphs used by main SQA graphs:
- SG_FetchQuestion: DRY question retrieval
- SG_DiagnoseAndPatch: Answer marking and remediation
"""

from .fetch_question import compiled_fetch_graph
from .diagnose_patch import compiled_diagnose_graph

__all__ = [
    "compiled_fetch_graph",
    "compiled_diagnose_graph",
]
