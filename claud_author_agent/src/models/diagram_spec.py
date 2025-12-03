"""DiagramSpec dataclass for structured diagram specifications.

Used by EligibilityAnalyzerAgent to communicate diagram requirements
to PromptArchitectAgent. Each spec describes a single diagram to generate.

Architecture:
    EligibilityAnalyzerAgent → DiagramSpec[] → PromptArchitectAgent → Gemini Prompts
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class DiagramSpec:
    """Specification for a single diagram to generate.

    Created by EligibilityAnalyzerAgent during semantic analysis.
    Consumed by PromptArchitectAgent for Gemini prompt crafting.

    Attributes:
        description: Human-readable description of what the diagram shows.
            Example: "Pie chart for Problem 1: Transport to Work (4 sectors)"

        reasoning: Why this diagram is needed for learning/assessment.
            Example: "First worked example - shows angle calculation result"

        key_elements: List of visual elements that MUST be included.
            Example: ["4 sectors", "Walk 60°", "Car 90°", "angle labels"]

        excluded: List of elements that must NOT appear (especially for CFU).
            Example: ["answer value", "calculated angles", "solution steps"]
            Empty for lesson diagrams where answers are shown.

        diagram_type: Category for visual critique scoring.
            Values: "geometry", "algebra", "statistics", "mixed", "science",
                    "geography", "history", or inferred from content.

        diagram_index: Index for multiple diagrams per card per context.
            0 for first/only diagram, 1, 2, etc. for additional diagrams.

        context_type: Diagram context - "lesson" or "cfu".
            - "lesson": Teaching diagram, answers shown, comprehensive
            - "cfu": Assessment diagram, answers hidden, minimal

        educational_focus: What concept this diagram reinforces.
            Example: "Students see how frequency maps to proportional angles"
    """

    description: str
    reasoning: str
    key_elements: List[str]
    diagram_type: str
    diagram_index: int
    context_type: str
    excluded: List[str] = field(default_factory=list)
    educational_focus: Optional[str] = None

    def __post_init__(self):
        """Validate spec after initialization."""
        self._validate()

    def _validate(self):
        """Fast-fail validation for required fields."""
        if not self.description:
            raise ValueError("DiagramSpec.description cannot be empty")

        if not self.reasoning:
            raise ValueError("DiagramSpec.reasoning cannot be empty")

        if not self.key_elements:
            raise ValueError("DiagramSpec.key_elements cannot be empty")

        valid_contexts = {"lesson", "cfu"}
        if self.context_type not in valid_contexts:
            raise ValueError(
                f"DiagramSpec.context_type must be one of {valid_contexts}, "
                f"got '{self.context_type}'"
            )

        if self.diagram_index < 0:
            raise ValueError(
                f"DiagramSpec.diagram_index must be >= 0, got {self.diagram_index}"
            )

        # CFU diagrams should have excluded elements (answers, solutions)
        if self.context_type == "cfu" and not self.excluded:
            # Warning, not error - allow empty but encourage specifying
            pass

    @property
    def is_lesson(self) -> bool:
        """Check if this is a lesson diagram."""
        return self.context_type == "lesson"

    @property
    def is_cfu(self) -> bool:
        """Check if this is a CFU (assessment) diagram."""
        return self.context_type == "cfu"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "description": self.description,
            "reasoning": self.reasoning,
            "key_elements": self.key_elements,
            "excluded": self.excluded,
            "diagram_type": self.diagram_type,
            "diagram_index": self.diagram_index,
            "context_type": self.context_type,
            "educational_focus": self.educational_focus,
        }

    @classmethod
    def from_dict(cls, data: dict, context_type: str) -> "DiagramSpec":
        """Create DiagramSpec from dictionary (eligibility output).

        Args:
            data: Dictionary containing spec fields
            context_type: "lesson" or "cfu" - injected if not in data

        Returns:
            DiagramSpec instance

        Raises:
            ValueError: If required fields are missing or invalid
        """
        return cls(
            description=data.get("description", ""),
            reasoning=data.get("reasoning", ""),
            key_elements=data.get("key_elements", []),
            excluded=data.get("excluded", []),
            diagram_type=data.get("diagram_type", "mixed"),
            diagram_index=data.get("diagram_index", 0),
            context_type=data.get("context_type", context_type),
            educational_focus=data.get("educational_focus"),
        )


@dataclass
class DiagramSpecList:
    """Container for multiple diagram specs from eligibility analysis.

    Groups lesson and CFU specs for a single card.

    Attributes:
        card_id: ID of the card these specs belong to
        card_title: Title of the card (for logging)
        lesson_specs: List of DiagramSpec for lesson context
        cfu_specs: List of DiagramSpec for CFU context
        eligibility_method: How eligibility was determined
    """

    card_id: str
    card_title: str
    lesson_specs: List[DiagramSpec] = field(default_factory=list)
    cfu_specs: List[DiagramSpec] = field(default_factory=list)
    eligibility_method: str = "claude_agent_sdk_analysis"

    @property
    def needs_lesson_diagram(self) -> bool:
        """Check if any lesson diagrams are needed."""
        return len(self.lesson_specs) > 0

    @property
    def needs_cfu_diagram(self) -> bool:
        """Check if any CFU diagrams are needed."""
        return len(self.cfu_specs) > 0

    @property
    def total_diagrams(self) -> int:
        """Total number of diagrams to generate for this card."""
        return len(self.lesson_specs) + len(self.cfu_specs)

    @property
    def diagram_contexts(self) -> List[str]:
        """List of contexts with diagrams (for backward compatibility)."""
        contexts = []
        if self.needs_lesson_diagram:
            contexts.append("lesson")
        if self.needs_cfu_diagram:
            contexts.append("cfu")
        return contexts

    def all_specs(self) -> List[DiagramSpec]:
        """Get all specs in order: lesson first, then CFU."""
        return self.lesson_specs + self.cfu_specs

    @classmethod
    def from_eligibility_output(cls, card_data: dict) -> "DiagramSpecList":
        """Create from enhanced eligibility analyzer output.

        Args:
            card_data: Dictionary with card info and diagram specs

        Returns:
            DiagramSpecList instance

        Expected input format:
        {
            "id": "card_001",
            "title": "Card Title",
            "needs_lesson_diagram": true,
            "needs_cfu_diagram": true,
            "lesson_diagram_specs": [{...}, {...}],
            "cfu_diagram_specs": [{...}],
            "_eligibility_method": "claude_agent_sdk_analysis"
        }
        """
        card_id = card_data.get("id", "unknown")
        card_title = card_data.get("title", "")

        # Parse lesson specs
        lesson_specs = []
        if card_data.get("needs_lesson_diagram", False):
            raw_lesson_specs = card_data.get("lesson_diagram_specs", [])
            for spec_data in raw_lesson_specs:
                try:
                    spec = DiagramSpec.from_dict(spec_data, context_type="lesson")
                    lesson_specs.append(spec)
                except ValueError as e:
                    # Log error but continue with other specs
                    import logging
                    logging.warning(
                        f"Invalid lesson diagram spec for {card_id}: {e}"
                    )

        # Parse CFU specs
        cfu_specs = []
        if card_data.get("needs_cfu_diagram", False):
            raw_cfu_specs = card_data.get("cfu_diagram_specs", [])
            for spec_data in raw_cfu_specs:
                try:
                    spec = DiagramSpec.from_dict(spec_data, context_type="cfu")
                    cfu_specs.append(spec)
                except ValueError as e:
                    import logging
                    logging.warning(
                        f"Invalid CFU diagram spec for {card_id}: {e}"
                    )

        return cls(
            card_id=card_id,
            card_title=card_title,
            lesson_specs=lesson_specs,
            cfu_specs=cfu_specs,
            eligibility_method=card_data.get(
                "_eligibility_method", "claude_agent_sdk_analysis"
            ),
        )

    def to_legacy_format(self) -> dict:
        """Convert to legacy eligibility format for backward compatibility.

        Returns dict compatible with existing diagram_author_nano_client.py
        """
        return {
            "id": self.card_id,
            "title": self.card_title,
            "needs_lesson_diagram": self.needs_lesson_diagram,
            "needs_cfu_diagram": self.needs_cfu_diagram,
            "diagram_contexts": self.diagram_contexts,
            "_eligibility_method": self.eligibility_method,
            # New structured fields
            "lesson_diagram_specs": [s.to_dict() for s in self.lesson_specs],
            "cfu_diagram_specs": [s.to_dict() for s in self.cfu_specs],
        }
