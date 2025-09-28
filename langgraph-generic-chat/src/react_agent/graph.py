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
from react_agent.state import InputState, State, TeachingContext, DynamicLessonContext
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
    format_card_explainer_and_examples,
    # New dual-source context functions
    extract_static_context,
    extract_dynamic_context,
    merge_dual_source_contexts,
    calculate_dual_source_quality_scores,
    format_dual_source_context_for_prompt
)
from react_agent.prompts import (
    LATEX_FORMATTING_INSTRUCTIONS,
    SYSTEM_PROMPT_DUAL_SOURCE_FULL,
    SYSTEM_PROMPT_STATIC_ONLY,
    SYSTEM_PROMPT_DYNAMIC_ONLY,
    SYSTEM_PROMPT_NO_DUAL_CONTEXT
)

# Define context extraction function


async def extract_context(
    state: State, runtime: Runtime[Context]
) -> Dict[str, any]:
    """Extract and process dual-source teaching context.

    This function processes both static_context (immutable session data) and
    dynamic_context (real-time card presentation data) to create comprehensive
    context that works even when main teaching graph is interrupted.

    Args:
        state (State): The current state with static_context and dynamic_context.
        runtime: Runtime context configuration.

    Returns:
        dict: Dictionary containing processed dual-source context and metadata.
    """
    print("🎯 [DUAL-SOURCE CONTEXT] Starting context extraction...")

    # Extract dual-source context
    static_context_data = state.static_context
    dynamic_context_data = state.dynamic_context

    print(f"Static context available: {static_context_data is not None}")
    print(f"Dynamic context available: {dynamic_context_data is not None}")

    # Extract static context (session data)
    static_context = None
    if static_context_data:
        static_context = extract_static_context(static_context_data)
        print(f"Static context extraction: {'Success' if static_context else 'Failed'}")

    # Extract dynamic context (current card data)
    dynamic_context = None
    if dynamic_context_data:
        dynamic_context = extract_dynamic_context(dynamic_context_data)
        print(f"Dynamic context extraction: {'Success' if dynamic_context else 'Failed'}")

    # Merge contexts
    merged_context = merge_dual_source_contexts(static_context, dynamic_context)
    print(f"Context merge completed with {len(merged_context)} fields")

    # Calculate quality scores
    quality_scores = calculate_dual_source_quality_scores(static_context, dynamic_context)
    print(f"Quality scores - Static: {quality_scores['static_quality']:.2f}, Dynamic: {quality_scores['dynamic_quality']:.2f}, Combined: {quality_scores['combined_quality']:.2f}")

    # Store processing timestamps
    current_time = datetime.now(tz=timezone.utc).isoformat()

    # Legacy compatibility: maintain teaching_context for existing code
    # Use static_context as the primary teaching context source
    legacy_teaching_context = static_context

    # LEGACY FALLBACK: If no dual-source context available, try session_context
    if not static_context and not dynamic_context and state.session_context:
        print("⚠️  [FALLBACK] Using legacy session_context for backward compatibility")
        legacy_teaching_context = extract_teaching_context(
            state.session_context,
            max_recent_exchanges=runtime.context.max_recent_exchanges
        )
        # Convert legacy quality score
        quality_scores["combined_quality"] = calculate_context_quality_score(legacy_teaching_context)

    return {
        # Dual-source context fields (NEW)
        "teaching_context": static_context,  # Primary static context
        "processed_dynamic_context": dynamic_context.__dict__ if dynamic_context else None,
        "context_fusion_metadata": merged_context,

        # Quality scores (NEW)
        "static_context_quality": quality_scores["static_quality"],
        "dynamic_context_quality": quality_scores["dynamic_quality"],
        "context_consistency_score": quality_scores["consistency_score"],
        "context_quality_score": quality_scores["combined_quality"],  # Legacy compatibility

        # Timestamps (NEW)
        "static_context_timestamp": current_time if static_context else None,
        "dynamic_context_timestamp": current_time if dynamic_context else None,

        # Processing flags
        "context_processed": True,

        # Legacy compatibility fields
        "main_graph_state": state.session_context  # Deprecated but maintained
    }


# Define the function that calls the model


async def call_model(
    state: State, runtime: Runtime[Context]
) -> Dict[str, List[AIMessage]]:
    """Call the LLM with dual-source context-aware prompt selection.

    This function selects the appropriate prompt based on availability of
    static context (session data) and dynamic context (current card data),
    providing the most accurate context even during graph interrupts.

    Args:
        state (State): The current state with dual-source context.
        runtime: Runtime context configuration.

    Returns:
        dict: A dictionary containing the model's response message.
    """
    print("🎯 [DUAL-SOURCE MODEL] Starting model call with context selection...")

    # Initialize the model with tool binding
    model = load_chat_model(runtime.context.model).bind_tools(TOOLS)

    # Get dual-source context information
    static_context = state.teaching_context  # TeachingContext from static data
    dynamic_context = state.processed_dynamic_context  # Dynamic card data
    merged_context = state.context_fusion_metadata  # Merged context information

    static_quality = state.static_context_quality
    dynamic_quality = state.dynamic_context_quality
    combined_quality = state.context_quality_score
    consistency_score = state.context_consistency_score

    print(f"Context qualities - Static: {static_quality:.2f}, Dynamic: {dynamic_quality:.2f}, Combined: {combined_quality:.2f}")

    # Select prompt based on dual-source context availability
    if static_context and dynamic_context and combined_quality >= runtime.context.context_quality_threshold:
        # BEST CASE: Both static and dynamic context available
        print("🟢 Using DUAL-SOURCE FULL context prompt")

        formatted_dual_context = format_dual_source_context_for_prompt(merged_context)

        system_message = SYSTEM_PROMPT_DUAL_SOURCE_FULL.format(
            formatted_dual_context=formatted_dual_context,
            static_available="✓ Available",
            dynamic_available="✓ Available",
            consistency_status="✓ Good" if consistency_score > 0.8 else "⚠️ Some issues detected",
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS,
            system_time=datetime.now(tz=timezone.utc).isoformat()
        )

    elif static_context and static_quality >= 0.5:
        # MEDIUM CASE: Only static context available
        print("🟡 Using STATIC ONLY context prompt")

        # Format static session information
        static_session_info = f"""
Session ID: {static_context.session_id}
Student ID: {static_context.student_id}
Lesson Title: {static_context.lesson_title}
Subject Area: {static_context.lesson_topic}
Total Cards: {len(static_context.lesson_snapshot.get('cards', [])) if static_context.lesson_snapshot else 'Unknown'}
        """.strip()

        system_message = SYSTEM_PROMPT_STATIC_ONLY.format(
            static_session_info=static_session_info,
            lesson_title=static_context.lesson_title,
            lesson_topic=static_context.lesson_topic,
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS,
            system_time=datetime.now(tz=timezone.utc).isoformat()
        )

    elif dynamic_context and dynamic_quality >= 0.5:
        # MEDIUM CASE: Only dynamic context available
        print("🟡 Using DYNAMIC ONLY context prompt")

        # Format dynamic card information
        card_data = dynamic_context.get("card_data", {}) if dynamic_context else {}
        question_info = ""
        if isinstance(card_data, dict) and card_data.get("cfu"):
            cfu = card_data["cfu"]
            question_info = f"Question: {cfu.get('stem', 'No question available')}"

        dynamic_card_info = f"""
Current Position: Card {dynamic_context.get('card_index', 0) + 1} of {dynamic_context.get('total_cards', '?')}
Interaction State: {dynamic_context.get('interaction_state', 'unknown').title()}
{question_info}
        """.strip()

        system_message = SYSTEM_PROMPT_DYNAMIC_ONLY.format(
            dynamic_card_info=dynamic_card_info,
            question_topic=card_data.get("title", "current topic") if isinstance(card_data, dict) else "current topic",
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS,
            system_time=datetime.now(tz=timezone.utc).isoformat()
        )

    else:
        # FALLBACK CASE: No sufficient context available
        print("🔴 Using NO DUAL CONTEXT prompt (fallback)")

        system_message = SYSTEM_PROMPT_NO_DUAL_CONTEXT.format(
            latex_formatting=LATEX_FORMATTING_INSTRUCTIONS,
            system_time=datetime.now(tz=timezone.utc).isoformat()
        )

    print(f"Selected prompt length: {len(system_message)} characters")

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

    print("✅ Model response generated successfully")

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
