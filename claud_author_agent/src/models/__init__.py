"""Models package for claud_author_agent.

Contains dataclasses and Pydantic models for structured data throughout the pipeline.
"""

from .diagram_spec import DiagramSpec, DiagramSpecList
from .practice_question_models import (
    ExtractedBlock,
    BlockExtractionResult,
    GeneratedQuestion,
    QuestionBatch,
    QuestionGenerationResult,
)
from .sqa_extraction_models import (
    # Paper models
    PaperMetadata,
    FormulaSet,
    Question,
    QuestionPart,
    DiagramRef,
    QuestionPaperOutput,
    # Marking models
    MarkingSchemeMetadata,
    GeneralPrinciple,
    Solution,
    GenericMark,
    IllustrativeMark,
    CommonlyObservedResponse,
    MarkingInstructionsOutput,
    # Topic models
    Topic,
    TOPIC_TAXONOMY,
    get_topic_taxonomy,
    get_valid_topic_slugs,
)

__all__ = [
    # Diagram models
    "DiagramSpec",
    "DiagramSpecList",
    # Practice question models
    "ExtractedBlock",
    "BlockExtractionResult",
    "GeneratedQuestion",
    "QuestionBatch",
    "QuestionGenerationResult",
    # SQA paper models
    "PaperMetadata",
    "FormulaSet",
    "Question",
    "QuestionPart",
    "DiagramRef",
    "QuestionPaperOutput",
    # SQA marking models
    "MarkingSchemeMetadata",
    "GeneralPrinciple",
    "Solution",
    "GenericMark",
    "IllustrativeMark",
    "CommonlyObservedResponse",
    "MarkingInstructionsOutput",
    # Topic models
    "Topic",
    "TOPIC_TAXONOMY",
    "get_topic_taxonomy",
    "get_valid_topic_slugs",
]
