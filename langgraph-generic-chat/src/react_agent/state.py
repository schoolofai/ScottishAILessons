"""Define the state structures for the agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence, Dict, Any, List, Optional

from langchain_core.messages import AnyMessage
from langgraph.graph import add_messages
from langgraph.managed import IsLastStep
from typing_extensions import Annotated


@dataclass
class TeachingContext:
    """Teaching session context from main graph.

    This represents the extracted state from the main teaching thread,
    providing context about the current lesson, student progress, and
    recent learning interactions for contextual responses.
    """

    session_id: str = ""
    """Unique identifier for the teaching session"""

    student_id: str = ""
    """Unique identifier for the student"""

    course_id: str = ""
    """Unique identifier for the course"""

    lesson_title: str = ""
    """Title of the current lesson (e.g., 'Introduction to Fractions')"""

    lesson_topic: str = ""
    """Topic area of the lesson (e.g., 'Mathematics - Fractions')"""

    current_stage: str = ""
    """Current stage of the lesson (e.g., 'fraction_introduction', 'examples')"""

    lesson_snapshot: Dict[str, Any] = field(default_factory=dict)
    """Complete lesson snapshot data including objectives, description, etc."""

    recent_exchanges: List[Dict[str, Any]] = field(default_factory=list)
    """Recent message exchanges from the teaching session"""

    student_progress: Dict[str, Any] = field(default_factory=dict)
    """Student's current progress including difficulty level, understanding, etc."""

    timestamp: str = ""
    """When this context was captured"""

    # Teaching progression fields from main graph state
    current_card_index: int = 0
    """Current position in the lesson cards (0-based index)"""

    current_card: Optional[Dict[str, Any]] = None
    """Current lesson card data including question, explainer, examples"""

    cards_completed: List[str] = field(default_factory=list)
    """List of completed card IDs"""

    is_correct: Optional[bool] = None
    """Whether the student's last answer was correct"""

    should_progress: Optional[bool] = None
    """Whether the student should move to the next card"""

    feedback: Optional[str] = None
    """Generated feedback message for the student's last response"""

    hint_level: int = 0
    """Current hint level (0-3) for the current question"""

    attempts: int = 0
    """Number of attempts on the current question"""

    max_attempts: int = 3
    """Maximum attempts allowed before force progression"""

    evidence: List[Dict[str, Any]] = field(default_factory=list)
    """Performance tracking data for the current session"""

    mastery_updates: List[Dict[str, Any]] = field(default_factory=list)
    """Skill mastery changes during the session"""

    stage: str = ""
    """Teaching flow stage: design/deliver/mark/progress/done"""

    should_exit: bool = False
    """Whether the lesson has been completed"""


@dataclass
class InputState:
    """Defines the input state for the agent, representing a narrower interface to the outside world.

    This class is used to define the initial state and structure of incoming data,
    including optional session context for context-aware responses.
    """

    messages: Annotated[Sequence[AnyMessage], add_messages] = field(
        default_factory=list
    )
    """
    Messages tracking the primary execution state of the agent.

    Typically accumulates a pattern of:
    1. HumanMessage - user input
    2. AIMessage with .tool_calls - agent picking tool(s) to use to collect information
    3. ToolMessage(s) - the responses (or errors) from the executed tools
    4. AIMessage without .tool_calls - agent responding in unstructured format to the user
    5. HumanMessage - user responds with the next conversational turn

    Steps 2-5 may repeat as needed.

    The `add_messages` annotation ensures that new messages are merged with existing ones,
    updating by ID to maintain an "append-only" state unless a message with the same ID is provided.
    """

    session_context: Optional[Dict[str, Any]] = None
    """
    Optional session context from frontend containing teaching session information.

    When provided, contains:
    - session_id, student_id: identifiers
    - lesson_snapshot: current lesson details
    - main_graph_state: extracted teaching thread state

    This enables context-aware responses based on current learning state.
    """


@dataclass
class State(InputState):
    """Represents the complete state of the agent, extending InputState with additional attributes.

    This class can be used to store any information needed throughout the agent's lifecycle,
    including context-aware processing state and search results.
    """

    is_last_step: IsLastStep = field(default=False)
    """
    Indicates whether the current step is the last one before the graph raises an error.

    This is a 'managed' variable, controlled by the state machine rather than user code.
    It is set to 'True' when the step count reaches recursion_limit - 1.
    """

    teaching_context: Optional[TeachingContext] = None
    """
    Processed teaching context extracted from session_context.

    This is populated by the context extraction node and contains
    structured information about the current lesson, student progress,
    and recent learning interactions.
    """

    main_graph_state: Optional[Dict[str, Any]] = None
    """
    Raw main graph state extracted from session_context.

    Contains the complete state from the teaching thread for
    detailed context processing and debugging.
    """

    search_results: List[Dict[str, Any]] = field(default_factory=list)
    """
    Search results from external tools (e.g., Tavily search).

    Stores context-enhanced search results for educational resources
    related to the current lesson topic.
    """

    context_processed: bool = field(default=False)
    """
    Flag indicating whether context processing has been completed.

    Used by the graph to track processing state and avoid
    redundant context extraction operations.
    """

    # Context-aware processing metadata
    context_extraction_timestamp: Optional[str] = None
    """Timestamp when context was last extracted and processed"""

    context_quality_score: float = field(default=0.0)
    """Quality score of available context (0.0 = no context, 1.0 = rich context)"""
