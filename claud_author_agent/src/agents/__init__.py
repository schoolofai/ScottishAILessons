"""Agents package for Mock Exam Author pipeline.

Each agent in this package is a standalone ClaudeSDKClient with structured output,
designed to be called independently or as part of the orchestrated pipeline.

Agents:
- mock_exam_author: Generates mock_exam.json from SOW entry
- mock_exam_critic: Validates and critiques mock exam quality
- diagram_classifier: Classifies questions for diagram requirements
- diagram_author: Generates diagrams using MCP tools

Utilities:
- preprocessing: Workspace setup and data extraction
- postprocessing: Appwrite upsert and cleanup
"""

from .preprocessing import run_preprocessing, PreprocessingResult
from .mock_exam_author_agent import run_mock_exam_author, MockExamAuthorAgent

__all__ = [
    'run_preprocessing',
    'PreprocessingResult',
    'run_mock_exam_author',
    'MockExamAuthorAgent',
]
