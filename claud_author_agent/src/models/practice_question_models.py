"""Practice Question Models - Pydantic schemas for offline practice content generation.

These models define the structure for:
- Concept blocks extracted from lesson templates
- Practice questions at various difficulty levels
- Storage file references (for large content stored in Appwrite Storage)

Following the pattern from diagram_classifier_schema_models.py - these models
are used with Claude Agent SDK Write tool pattern.
"""

from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field, field_validator
import hashlib
import json


# =============================================================================
# Difficulty and Question Type Literals
# =============================================================================

DifficultyLevel = Literal["easy", "medium", "hard"]
QuestionType = Literal["multiple_choice", "numeric", "short_answer", "worked_example"]
DiagramToolType = Literal["NONE", "DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION"]


# =============================================================================
# Worked Example Model (shared between blocks and questions)
# =============================================================================

class WorkedExample(BaseModel):
    """Worked example with problem, solution steps, and final answer."""
    problem: str = Field(..., min_length=10, description="The example problem statement")
    solution_steps: List[str] = Field(..., min_length=1, description="Step-by-step solution")
    final_answer: str = Field(..., min_length=1, description="The final answer")


# =============================================================================
# Practice Block Models (for block extraction)
# =============================================================================

class ConceptBlockContent(BaseModel):
    """Full content for a concept block - stored in Appwrite Storage bucket.

    This is the complete content that gets written to a JSON file and
    referenced by `blockDataFileId` in the practice_blocks collection.
    """
    explanation: str = Field(..., min_length=20, description="Core concept explanation")
    worked_example: Optional[WorkedExample] = Field(None, description="Example problem with solution")
    key_formulas: List[str] = Field(default_factory=list, description="Mathematical formulas (LaTeX)")
    common_misconceptions: List[str] = Field(default_factory=list, description="Common student errors")


class ExtractedBlock(BaseModel):
    """A concept block extracted from a lesson template.

    This represents a distinct concept that can be practiced independently.
    """
    block_id: str = Field(..., description="Unique identifier for the block (e.g., 'block_001')")
    title: str = Field(..., max_length=255, description="Clear, concise block title")
    explanation_preview: str = Field(..., max_length=500, description="Short preview for display")
    explanation: str = Field(..., description="Full explanation of the concept")
    worked_example: Optional[WorkedExample] = Field(None, description="Worked example")
    key_formulas: List[str] = Field(default_factory=list, description="Key formulas")
    common_misconceptions: List[str] = Field(default_factory=list, description="Common errors")
    outcome_refs: List[str] = Field(default_factory=list, description="Learning outcome references")
    card_refs: List[str] = Field(default_factory=list, description="Source card IDs")

    def compute_content_hash(self) -> str:
        """Compute SHA256 hash of block content for cache invalidation."""
        content = f"{self.title}|{self.explanation}|{json.dumps(self.worked_example.model_dump() if self.worked_example else {})}"
        return hashlib.sha256(content.encode()).hexdigest()

    def get_storage_content(self) -> ConceptBlockContent:
        """Get content for storage bucket (large fields)."""
        return ConceptBlockContent(
            explanation=self.explanation,
            worked_example=self.worked_example,
            key_formulas=self.key_formulas,
            common_misconceptions=self.common_misconceptions
        )


class BlockExtractionResult(BaseModel):
    """Complete result from block extraction agent."""
    lesson_template_id: str = Field(..., description="Source lesson template ID")
    lesson_title: str = Field(..., description="Lesson title for reference")
    total_blocks: int = Field(..., ge=0, description="Number of blocks extracted")
    blocks: List[ExtractedBlock] = Field(..., description="Extracted concept blocks")

    @field_validator('blocks')
    @classmethod
    def validate_block_count(cls, v, info):
        """Ensure blocks array is not empty."""
        if len(v) == 0:
            raise ValueError("At least one block must be extracted from the lesson")
        return v


# =============================================================================
# Practice Question Models (for question generation)
# =============================================================================

class MultipleChoiceOption(BaseModel):
    """A single option for multiple choice questions."""
    label: str = Field(..., description="Option label (A, B, C, D)")
    text: str = Field(..., description="Option text")
    is_correct: bool = Field(False, description="Whether this is the correct answer")


class QuestionContent(BaseModel):
    """Full content for a practice question - stored in Appwrite Storage bucket.

    This is the complete content that gets written to a JSON file and
    referenced by `questionDataFileId` in the practice_questions collection.
    """
    stem: str = Field(..., description="Full question stem (may contain LaTeX)")
    options: Optional[List[MultipleChoiceOption]] = Field(None, description="MCQ options")
    correct_answer: str = Field(..., description="Correct answer or answer key")
    acceptable_answers: Optional[List[str]] = Field(None, description="Alternative acceptable answers")
    solution: str = Field(..., description="Complete solution explanation")
    hints: List[str] = Field(default_factory=list, description="Progressive hints (2-3)")
    diagram_json: Optional[str] = Field(None, description="JSXGraph JSON if applicable")


class GeneratedQuestion(BaseModel):
    """A practice question generated for a concept block.

    Questions are generated at specific difficulty levels with full solutions.
    """
    question_id: str = Field(..., description="Unique question ID")
    block_id: str = Field(..., description="Parent block ID")
    block_title: str = Field(..., description="Block title for reference")
    difficulty: DifficultyLevel = Field(..., description="Question difficulty")
    question_type: QuestionType = Field(..., description="Type of question")

    # Preview fields (stored in collection)
    stem_preview: str = Field(..., max_length=500, description="Short stem preview")
    options_preview: Optional[str] = Field(None, max_length=500, description="MCQ options preview")

    # Full content (stored in storage bucket)
    stem: str = Field(..., description="Full question stem")
    options: Optional[List[MultipleChoiceOption]] = Field(None, description="MCQ options")
    correct_answer: str = Field(..., description="Correct answer")
    acceptable_answers: Optional[List[str]] = Field(None, description="Alternative answers")
    solution: str = Field(..., description="Complete solution")
    hints: List[str] = Field(default_factory=list, description="Progressive hints")

    # Diagram information
    diagram_needed: bool = Field(False, description="Whether diagram would help")
    diagram_tool: DiagramToolType = Field("NONE", description="Recommended diagram tool")
    diagram_file_id: Optional[str] = Field(None, description="Appwrite file ID if generated")
    diagram_json: Optional[str] = Field(None, description="JSXGraph JSON if applicable")

    # Curriculum links
    outcome_refs: List[str] = Field(default_factory=list, description="Learning outcomes")
    curriculum_topic: Optional[str] = Field(None, description="Curriculum topic area")

    def compute_content_hash(self) -> str:
        """Compute SHA256 hash of question content."""
        content = f"{self.block_id}|{self.difficulty}|{self.stem}|{self.correct_answer}"
        return hashlib.sha256(content.encode()).hexdigest()

    def get_storage_content(self) -> QuestionContent:
        """Get content for storage bucket."""
        return QuestionContent(
            stem=self.stem,
            options=self.options,
            correct_answer=self.correct_answer,
            acceptable_answers=self.acceptable_answers,
            solution=self.solution,
            hints=self.hints,
            diagram_json=self.diagram_json
        )


class QuestionBatch(BaseModel):
    """Batch of generated questions for a single block at one difficulty."""
    block_id: str = Field(..., description="Block ID")
    difficulty: DifficultyLevel = Field(..., description="Difficulty level")
    questions: List[GeneratedQuestion] = Field(..., description="Generated questions")

    @field_validator('questions')
    @classmethod
    def validate_question_count(cls, v, info):
        """Ensure at least one question generated."""
        if len(v) == 0:
            raise ValueError("At least one question must be generated")
        return v


class QuestionGenerationResult(BaseModel):
    """Complete result from question generation for a lesson."""
    lesson_template_id: str = Field(..., description="Source lesson template ID")
    execution_id: str = Field(..., description="Execution ID for tracking")
    total_questions: int = Field(..., ge=0, description="Total questions generated")
    questions_by_difficulty: Dict[str, int] = Field(
        default_factory=dict,
        description="Count by difficulty"
    )
    questions: List[GeneratedQuestion] = Field(..., description="All generated questions")


# =============================================================================
# File Name Constants
# =============================================================================

BLOCK_EXTRACTION_INPUT_FILE = "lesson_template_input.json"
BLOCK_EXTRACTION_OUTPUT_FILE = "extracted_blocks.json"
QUESTION_GENERATION_OUTPUT_FILE = "generated_questions.json"
