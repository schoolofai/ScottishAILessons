"""Define a custom Reasoning and Action agent.

Works with a chat model with tool calling support.
"""

from datetime import datetime, timezone
from typing import Dict, List, Literal, cast, Optional

from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.runtime import Runtime

from react_agent.context import Context
from react_agent.state import InputState, State, TeachingContext
from react_agent.tools import TOOLS
from react_agent.utils import (
    load_chat_model,
    extract_teaching_context,
    calculate_context_quality_score,
    format_recent_exchanges,
    format_student_progress,
    format_lesson_objectives,
    format_current_card_context,
    format_learning_progress,
    format_card_explainer_and_examples
)
from react_agent.prompts import LATEX_FORMATTING_INSTRUCTIONS

# Define context extraction function


async def extract_context(
    state: State, runtime: Runtime[Context]
) -> Dict[str, Optional[TeachingContext]]:
    """Extract and process teaching context from session context.

    This function processes the session_context to extract structured
    teaching information and calculate context quality for prompt selection.

    Args:
        state (State): The current state with session_context.
        runtime: Runtime context configuration.

    Returns:
        dict: Dictionary containing processed teaching context.
    """
    session_context = state.session_context

    if not session_context:
        return {
            "teaching_context": None,
            "context_quality_score": 0.0,
            "context_processed": True
        }

    # Extract structured teaching context
    teaching_context = extract_teaching_context(
        session_context,
        max_recent_exchanges=runtime.context.max_recent_exchanges
    )

    # Calculate context quality score
    quality_score = calculate_context_quality_score(teaching_context)

    return {
        "teaching_context": teaching_context,
        "context_quality_score": quality_score,
        "context_processed": True
    }


# Define the function that calls the model


async def call_model(
    state: State, runtime: Runtime[Context]
) -> Dict[str, List[AIMessage]]:
    """Call the LLM with context-aware prompt selection.

    This function selects the appropriate prompt based on teaching context
    availability and quality, then calls the model for response generation.

    Args:
        state (State): The current state of the conversation.
        runtime: Runtime context configuration.

    Returns:
        dict: A dictionary containing the model's response message.
    """
    # Initialize the model with tool binding
    model = load_chat_model(runtime.context.model).bind_tools(TOOLS)

    # Select appropriate prompt based on context quality
    teaching_context = state.teaching_context
    quality_score = state.context_quality_score

    if teaching_context and quality_score >= runtime.context.context_quality_threshold:
        # Use rich context-aware prompt
        system_prompt = runtime.context.system_prompt_with_context

        # Format context information for prompt
        recent_exchanges = format_recent_exchanges(
            teaching_context.recent_exchanges,
            max_count=runtime.context.max_recent_exchanges
        )
        student_progress = format_student_progress(teaching_context.student_progress)
        lesson_objectives = format_lesson_objectives(teaching_context.lesson_snapshot)

        # Format new teaching progression context
        current_card_context = format_current_card_context(teaching_context)
        learning_progress = format_learning_progress(teaching_context)
        card_explainer_and_examples = format_card_explainer_and_examples(teaching_context.current_card)

        system_message = system_prompt.format(
            system_time=datetime.now(tz=timezone.utc).isoformat(),
            session_id=teaching_context.session_id,
            student_id=teaching_context.student_id,
            lesson_title=teaching_context.lesson_title,
            lesson_topic=teaching_context.lesson_topic,
            current_stage=teaching_context.current_stage,
            recent_exchanges=recent_exchanges,
            student_progress=student_progress,
            lesson_objectives=lesson_objectives,
            # New context-aware fields
            current_card_context=current_card_context,
            learning_progress=learning_progress,
            card_explainer_and_examples=card_explainer_and_examples,
            # LaTeX formatting instructions
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS
        )

    elif teaching_context and quality_score > 0.0:
        # Use degraded context prompt
        system_prompt = runtime.context.system_prompt_degraded_context

        available_context = f"Lesson: {teaching_context.lesson_title or 'Unknown'}, Topic: {teaching_context.lesson_topic or 'Unknown'}"

        system_message = system_prompt.format(
            system_time=datetime.now(tz=timezone.utc).isoformat(),
            session_id=teaching_context.session_id,
            available_context_summary=available_context,
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS
        )

    else:
        # Use standard prompt with no context
        system_prompt = runtime.context.system_prompt_no_context
        system_message = system_prompt.format(
            system_time=datetime.now(tz=timezone.utc).isoformat(),
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS
        )

    # Get the model's response
    response = cast(
        AIMessage,
        await model.ainvoke(
            [{"role": "system", "content": system_message}, *state.messages]
        ),
    )

    # Handle the case when it's the last step and the model still wants to use a tool
    if state.is_last_step and response.tool_calls:
        return {
            "messages": [
                AIMessage(
                    id=response.id,
                    content="Sorry, I could not find an answer to your question in the specified number of steps.",
                )
            ]
        }

    # Return the model's response as a list to be added to existing messages
    return {"messages": [response]}


# Define routing function (used by context_chat_agent below)

def route_model_output(state: State) -> Literal["__end__", "tools"]:
    """Determine the next node based on the model's output.

    This function checks if the model's last message contains tool calls.

    Args:
        state (State): The current state of the conversation.

    Returns:
        str: The name of the next node to call ("__end__" or "tools").
    """
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(
            f"Expected AIMessage in output edges, but got {type(last_message).__name__}"
        )
    # If there is no tool call, then we finish
    if not last_message.tool_calls:
        return "__end__"
    # Otherwise we execute the requested actions
    return "tools"

# Create context-aware chat agent as separate graph
context_builder = StateGraph(State, input_schema=InputState, context_schema=Context)

# Build context-aware graph with extract_context -> call_model -> tools flow
context_builder.add_node("extract_context", extract_context)
context_builder.add_node("call_model", call_model)
context_builder.add_node("tools", ToolNode(TOOLS))

# Set up the context-aware flow
context_builder.add_edge("__start__", "extract_context")
context_builder.add_edge("extract_context", "call_model")

# Add the same routing logic for tools
context_builder.add_conditional_edges(
    "call_model",
    route_model_output,
)

context_builder.add_edge("tools", "call_model")

# Compile the context-aware graph
context_chat_agent = context_builder.compile(name="Context Chat Agent")
