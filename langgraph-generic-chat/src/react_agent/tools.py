"""Context-aware tools for educational search and resource discovery.

This module provides search tools that can enhance queries with lesson context,
making search results more relevant to the student's current learning state.
Includes both general search and specialized educational resource search.
"""

from typing import Any, Callable, List, Optional, cast

from langchain_tavily import TavilySearch  # type: ignore[import-not-found]
from langgraph.runtime import get_runtime

from react_agent.context import Context


async def search(query: str) -> Optional[dict[str, Any]]:
    """Search for general web results.

    This function performs a search using the Tavily search engine, which is designed
    to provide comprehensive, accurate, and trusted results. It's particularly useful
    for answering questions about current events or general information.

    Args:
        query: Search query string

    Returns:
        Dictionary containing search results with titles, URLs, content snippets
    """
    runtime = get_runtime(Context)
    wrapped = TavilySearch(max_results=runtime.context.max_search_results)
    return cast(dict[str, Any], await wrapped.ainvoke({"query": query}))


async def search_lesson_resources(query: str, topic: str = "", difficulty_level: str = "") -> Optional[dict[str, Any]]:
    """Search for educational resources related to a specific lesson topic.

    This function enhances the search query with educational context to find
    more relevant learning materials, tutorials, and examples.

    Args:
        query: Base search query from the student
        topic: Current lesson topic (e.g., "fractions", "algebra")
        difficulty_level: Student's current level (e.g., "beginner", "intermediate")

    Returns:
        Dictionary containing educational search results
    """
    runtime = get_runtime(Context)

    # Enhance query with educational context
    enhanced_query = f"{query} {topic}"
    if difficulty_level:
        enhanced_query += f" {difficulty_level} level"

    # Add educational search terms
    enhanced_query += " tutorial explanation examples educational"

    wrapped = TavilySearch(max_results=runtime.context.max_search_results)
    return cast(dict[str, Any], await wrapped.ainvoke({"query": enhanced_query}))


async def search_math_examples(concept: str, current_examples: str = "", grade_level: str = "") -> Optional[dict[str, Any]]:
    """Search for additional mathematics examples and practice problems.

    Specialized search for mathematics education, finding examples similar to
    what the student is currently learning.

    Args:
        concept: Mathematical concept (e.g., "fraction addition", "slope")
        current_examples: Examples the student has already seen
        grade_level: Target grade level for appropriate difficulty

    Returns:
        Dictionary containing mathematics-focused search results
    """
    runtime = get_runtime(Context)

    # Build context-enhanced math query
    enhanced_query = f"{concept} examples practice problems"

    if grade_level:
        enhanced_query += f" grade {grade_level}"

    if current_examples:
        enhanced_query += f" similar to {current_examples}"

    # Add educational math terms
    enhanced_query += " mathematics education tutorial step by step"

    wrapped = TavilySearch(max_results=runtime.context.max_search_results)
    return cast(dict[str, Any], await wrapped.ainvoke({"query": enhanced_query}))


async def search_interactive_resources(topic: str, learning_style: str = "") -> Optional[dict[str, Any]]:
    """Search for interactive educational resources and activities.

    Finds interactive content like simulations, games, and hands-on activities
    that align with the current learning topic.

    Args:
        topic: Learning topic to search for
        learning_style: Preferred learning approach (visual, kinesthetic, etc.)

    Returns:
        Dictionary containing interactive resource search results
    """
    runtime = get_runtime(Context)

    # Build query for interactive content
    enhanced_query = f"{topic} interactive"

    if learning_style:
        enhanced_query += f" {learning_style}"

    # Add interactive search terms
    enhanced_query += " simulation game activity hands-on visual educational"

    wrapped = TavilySearch(max_results=runtime.context.max_search_results)
    return cast(dict[str, Any], await wrapped.ainvoke({"query": enhanced_query}))


def enhance_query_with_context(base_query: str, lesson_context: dict) -> str:
    """Enhance a search query with lesson context information.

    Takes a basic search query and enriches it with context from the current
    lesson to make search results more relevant and educational.

    Args:
        base_query: Original search query from user
        lesson_context: Dictionary containing lesson information

    Returns:
        Enhanced query string with context
    """
    enhanced = base_query

    # Add lesson topic if available
    if lesson_context.get("lesson_topic"):
        enhanced += f" {lesson_context['lesson_topic']}"

    # Add current stage for appropriate difficulty
    if lesson_context.get("current_stage"):
        stage = lesson_context["current_stage"]
        if "introduction" in stage.lower() or "basic" in stage.lower():
            enhanced += " beginner basic introduction"
        elif "advanced" in stage.lower():
            enhanced += " advanced"
        else:
            enhanced += " intermediate"

    # Add educational terms
    enhanced += " educational tutorial explanation"

    return enhanced.strip()


# Export all available tools
TOOLS: List[Callable[..., Any]] = [
    search,
    search_lesson_resources,
    search_math_examples,
    search_interactive_resources
]
