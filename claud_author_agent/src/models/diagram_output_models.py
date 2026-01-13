"""Pydantic models for diagram output with SDK structured output validation.

These models define the schema for diagram generation output, validated at generation time
by the Claude Agent SDK's structured output feature.

Schema Changes from Legacy:
- Removed: jsxgraph_json (legacy, unused by frontend)
- Added: code (diagram definition as JSON string)
- Added: tool_name (which tool generated the diagram)

Usage:
    from .models.diagram_output_models import DiagramsOutput

    options = ClaudeAgentOptions(
        output_format={
            "type": "json_schema",
            "schema": DiagramsOutput.model_json_schema()
        }
    )
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal


class DiagramEntry(BaseModel):
    """Single diagram entry with SDK structured output validation.

    Required fields are validated at generation time by the SDK.
    Local Pydantic validation catches constraints the SDK doesn't enforce
    (e.g., score range 0.0-1.0).

    Attributes:
        lessonTemplateId: Lesson template document ID
        cardId: Card identifier (e.g., "card_001")
        code: Diagram definition object as JSON string (sent to render tool)
        tool_name: Which tool generated the diagram
        image_path: Absolute path to PNG file in workspace
        diagram_type: Category of diagram
        diagram_context: "lesson" or "cfu" context
        diagram_description: Optional AI-generated description
        visual_critique_score: Optional quality score 0.0-1.0
        critique_iterations: Optional number of refinement iterations
        critique_feedback: Optional critique history
    """

    lessonTemplateId: str = Field(
        ...,
        min_length=1,
        description="Lesson template document ID"
    )
    cardId: str = Field(
        ...,
        description="Card identifier e.g. card_001"
    )
    code: str = Field(
        ...,
        min_length=2,
        description="Diagram definition - JSON object for JSXGraph/Desmos/Plotly, or Python code for Matplotlib"
    )
    tool_name: Literal["jsxgraph", "desmos", "matplotlib", "plotly", "imagen"] = Field(
        ...,
        description="Which tool generated this diagram"
    )
    image_path: str = Field(
        ...,
        min_length=1,
        description="Absolute path to PNG file in workspace"
    )
    diagram_type: Literal["geometry", "algebra", "statistics", "mixed", "science", "geography", "history"] = Field(
        ...,
        description="Category of diagram"
    )
    diagram_context: Literal["lesson", "cfu"] = Field(
        ...,
        description="lesson (teaching) or cfu (assessment) context"
    )

    # Optional fields
    diagram_description: Optional[str] = Field(
        None,
        description="AI-generated description of the diagram"
    )
    visual_critique_score: Optional[float] = Field(
        None,
        description="Quality score between 0.0 and 1.0"
    )
    critique_iterations: Optional[int] = Field(
        None,
        description="Number of refinement iterations"
    )
    critique_feedback: Optional[List[dict]] = Field(
        None,
        description="Critique history with iteration, score, and feedback"
    )

    @field_validator('visual_critique_score')
    @classmethod
    def validate_score_range(cls, v: Optional[float]) -> Optional[float]:
        """Validate score is 0.0-1.0.

        The SDK doesn't enforce min/max constraints, so we validate locally.
        """
        if v is not None and (v < 0.0 or v > 1.0):
            raise ValueError("visual_critique_score must be between 0.0 and 1.0")
        return v

    @field_validator('critique_iterations')
    @classmethod
    def validate_iterations_non_negative(cls, v: Optional[int]) -> Optional[int]:
        """Validate iterations is non-negative."""
        if v is not None and v < 0:
            raise ValueError("critique_iterations must be non-negative")
        return v


class DiagramError(BaseModel):
    """Error entry for diagrams that failed generation.

    Used to track which cards/contexts failed and why, enabling
    retry logic or debugging.

    Attributes:
        cardId: Which card failed
        diagram_context: Which context failed (lesson or cfu)
        error: Error description
        final_score: Last achieved score before giving up
    """

    cardId: str = Field(
        ...,
        description="Card identifier that failed"
    )
    diagram_context: str = Field(
        ...,
        description="Context that failed (lesson or cfu)"
    )
    error: str = Field(
        ...,
        description="Error description"
    )
    final_score: Optional[float] = Field(
        None,
        description="Last achieved score before failure"
    )


class SingleDiagramResult(BaseModel):
    """Minimal single diagram output - ONE diagram per call.

    Used with SDK structured output for reliable per-diagram generation.
    Only 5 required fields - no lists, no optionals, no nested structures.

    The orchestrator tracks additional metadata (lessonTemplateId, critique scores, etc.)
    and merges them before Appwrite upsert.

    Why this exists:
    - The full DiagramsOutput schema (11 fields, lists, nested structures) causes
      SDK structured output to fail with "Agent could not produce valid schema output"
    - Single diagram per call dramatically improves reliability
    - Orchestrator loops through cards and contexts, collecting results

    Attributes:
        cardId: Card identifier (e.g., "card_001")
        diagram_context: "lesson" (teaching) or "cfu" (assessment)
        tool_name: Which rendering tool to use
        image_path: Path to rendered PNG file
        code: Diagram definition (JSON for JSXGraph/Desmos/Plotly, Python for Matplotlib)
    """

    cardId: str = Field(
        ...,
        description="Card identifier e.g. card_001"
    )
    diagram_context: Literal["lesson", "cfu"] = Field(
        ...,
        description="lesson (teaching) or cfu (assessment) context"
    )
    tool_name: Literal["jsxgraph", "desmos", "matplotlib", "plotly", "imagen"] = Field(
        ...,
        description="Which tool generates this diagram"
    )
    image_path: str = Field(
        ...,
        description="Path to rendered PNG file"
    )
    code: str = Field(
        ...,
        min_length=2,
        description="Diagram definition - JSON for JSXGraph/Desmos/Plotly, Python for Matplotlib"
    )


class DiagramsOutput(BaseModel):
    """Complete structured output schema for diagram generation.

    This is the top-level schema used with SDK structured output.
    The agent returns this structure, and the SDK validates it at generation time.

    Usage:
        options = ClaudeAgentOptions(
            output_format={
                "type": "json_schema",
                "schema": DiagramsOutput.model_json_schema()
            }
        )

    Attributes:
        diagrams: List of successfully generated diagrams
        errors: List of diagrams that failed generation
    """

    diagrams: List[DiagramEntry] = Field(
        ...,
        description="List of successfully generated diagrams"
    )
    errors: List[DiagramError] = Field(
        default_factory=list,
        description="List of diagrams that failed generation"
    )
