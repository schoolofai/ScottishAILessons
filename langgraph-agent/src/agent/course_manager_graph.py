"""
Course Manager LangGraph Subgraph

This subgraph handles lesson recommendations for multi-course scenarios.
It analyzes scheduling context and returns prioritized lesson candidates
based on the PRD-defined scoring rubric.
"""

from typing import Dict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import AIMessage
from .shared_state import UnifiedState
from .course_manager_utils import (
    create_lesson_candidates,
    generate_rubric_explanation,
    validate_scheduling_context,
    generate_recommendation_summary
)
import json
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def course_manager_node(state: UnifiedState) -> UnifiedState:
    """
    Course Manager node that generates lesson recommendations.

    This is the core node that:
    1. Validates scheduling context
    2. Generates lesson candidates using scoring algorithm
    3. Creates structured recommendation response
    4. Returns results with transparent reasoning
    """
    try:
        logger.info("Course Manager node started")

        # Extract scheduling context from session_context
        session_context = state.get('session_context', {})

        if not session_context:
            error_msg = "No session context provided for course manager"
            logger.error(error_msg)
            raise ValueError(error_msg)

        # Validate scheduling context
        is_valid, error_message = validate_scheduling_context(session_context)
        if not is_valid:
            logger.error(f"Invalid scheduling context: {error_message}")
            raise ValueError(f"Invalid scheduling context: {error_message}")

        # Extract key information for logging
        course_info = session_context.get('course', {})
        student_info = session_context.get('student', {})
        template_count = len(session_context.get('templates', []))

        logger.info(f"Processing recommendations for student {student_info.get('id', 'unknown')} "
                   f"in course {course_info.get('courseId', 'unknown')} "
                   f"with {template_count} lesson templates")

        # Generate lesson candidates using scoring algorithm
        candidates = create_lesson_candidates(session_context)

        if not candidates:
            error_msg = "No valid lesson candidates found"
            logger.error(error_msg)
            raise ValueError(error_msg)

        # Generate recommendation summary for analytics
        summary = generate_recommendation_summary(candidates)
        logger.info(f"Recommendation summary: {summary}")

        # Create recommendation response
        course_id = course_info.get('courseId', '')
        graph_run_id = f"course-manager-{uuid.uuid4().hex[:8]}"

        recommendation = {
            'courseId': course_id,
            'generatedAt': datetime.now().isoformat(),
            'graphRunId': graph_run_id,
            'recommendations': candidates,  # Change to match test expectations
            'nextSteps': f"Start with '{candidates[0]['title']}' - {candidates[0]['reasons'][0] if candidates[0].get('reasons') else 'recommended lesson'}" if candidates else "No lessons available",
            'rubric': generate_rubric_explanation()
        }

        # Create response message with both human-readable and structured content
        top_candidate = candidates[0] if candidates else None
        human_content = f"Generated {len(candidates)} lesson recommendations for course {course_id}"

        if top_candidate:
            human_content += f". Top recommendation: '{top_candidate['title']}' "
            human_content += f"(score: {top_candidate['score']}, reasons: {', '.join(top_candidate['reasons'])})"

        response_message = AIMessage(
            content=human_content,
            additional_kwargs={
                'recommendation': recommendation,
                'summary': summary,
                'function_call': {
                    'name': 'generate_course_recommendations',
                    'arguments': json.dumps(recommendation)
                }
            }
        )

        logger.info(f"Course Manager completed successfully. Generated {len(candidates)} candidates.")

        return {
            **state,
            'messages': state.get('messages', []) + [response_message],
            'course_recommendation': recommendation,
            'recommendation_summary': summary
        }

    except Exception as e:
        logger.error(f"Course Manager node failed: {str(e)}", exc_info=True)

        # Create error response
        error_message = AIMessage(
            content=f"Course Manager failed: {str(e)}",
            additional_kwargs={
                'error': str(e),
                'error_type': 'course_manager_error',
                'function_call': {
                    'name': 'course_manager_error',
                    'arguments': json.dumps({'error': str(e)})
                }
            }
        )

        return {
            **state,
            'messages': state.get('messages', []) + [error_message],
            'error': str(e)
        }


def validation_node(state: UnifiedState) -> UnifiedState:
    """
    Optional validation node for complex scenarios.
    Performs additional checks on the scheduling context.
    """
    try:
        logger.info("Validation node started")

        session_context = state.get('session_context', {})

        # Perform extended validation
        validation_results = {
            'context_valid': True,
            'warnings': [],
            'recommendations': []
        }

        # Check for data quality issues
        mastery = session_context.get('mastery', {})
        if not mastery or not mastery.get('emaByOutcome'):
            validation_results['warnings'].append('No mastery data available - using SoW order only')

        routine = session_context.get('routine', {})
        if not routine or not routine.get('dueAtByOutcome'):
            validation_results['warnings'].append('No routine data available - cannot prioritize overdue outcomes')

        templates = session_context.get('templates', [])
        published_count = len([t for t in templates if t.get('status') == 'published'])
        if published_count != len(templates):
            validation_results['warnings'].append(f'Only {published_count}/{len(templates)} templates are published')

        # Check for potential issues
        constraints = session_context.get('constraints', {})
        max_minutes = constraints.get('maxBlockMinutes', 25)
        long_lessons = [t for t in templates if t.get('estMinutes', 0) > max_minutes]
        if long_lessons:
            validation_results['warnings'].append(f'{len(long_lessons)} lessons exceed time constraint')

        logger.info(f"Validation completed: {len(validation_results['warnings'])} warnings")

        return {
            **state,
            'validation_results': validation_results
        }

    except Exception as e:
        logger.error(f"Validation node failed: {e}")
        return {
            **state,
            'validation_results': {
                'context_valid': False,
                'error': str(e)
            }
        }


def create_course_manager_graph():
    """
    Create the Course Manager subgraph.

    This subgraph can operate in different modes:
    - Simple: Direct course_manager node only
    - Validated: validation_node -> course_manager_node
    """
    # Create graph with UnifiedState
    graph = StateGraph(UnifiedState)

    # Add nodes
    graph.add_node("validation", validation_node)
    graph.add_node("course_manager", course_manager_node)

    # Define entry point
    graph.set_entry_point("validation")

    # Add edges
    graph.add_edge("validation", "course_manager")
    graph.add_edge("course_manager", END)

    logger.info("Course Manager graph created successfully")
    return graph.compile()


def create_simple_course_manager_graph():
    """
    Create a simplified Course Manager subgraph with just the core node.
    Use this for faster execution when validation is not needed.
    """
    # Create graph
    graph = StateGraph(UnifiedState)

    # Add single node
    graph.add_node("course_manager", course_manager_node)

    # Define entry point
    graph.set_entry_point("course_manager")

    # Add finish edge
    graph.add_edge("course_manager", END)

    logger.info("Simple Course Manager graph created successfully")
    return graph.compile()


# Export the compiled graphs
course_manager_graph = create_course_manager_graph()
simple_course_manager_graph = create_simple_course_manager_graph()

# Export for use in main agent graph
__all__ = [
    'course_manager_graph',
    'simple_course_manager_graph',
    'course_manager_node',
    'CourseManagerState'
]