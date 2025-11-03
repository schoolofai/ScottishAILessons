"""Diagram extraction utilities for identifying lesson cards needing JSXGraph diagrams.

Provides functions for:
1. Fetching lesson templates from Appwrite
2. LLM-based card eligibility analysis (identifying cards that need diagrams)
3. Filtering cards requiring diagram generation

Key Design Decisions:
- LLM-based eligibility (FR-014, FR-015, FR-016) instead of keyword heuristics
- Fast-fail on missing lesson templates (FR-012)
- Pre-processing step before agent execution (keeps agent focused on creative tasks)

Usage:
    from diagram_extractor import fetch_lesson_template, extract_diagram_cards

    # Fetch lesson template
    template = await fetch_lesson_template("course_abc123", 5)

    # Extract cards needing diagrams (using LLM analysis)
    eligible_cards = await extract_diagram_cards(template, llm_client)
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

from .appwrite_mcp import get_appwrite_document, list_appwrite_documents
from .compression import decompress_json_gzip_base64

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Lesson Template Fetching
# ═══════════════════════════════════════════════════════════════

async def fetch_lesson_template(
    course_id: str,
    order: int,
    mcp_config_path: str = ".mcp.json"
) -> Dict[str, Any]:
    """Fetch lesson template from Appwrite by courseId and order.

    Implements FR-019: Query lesson_templates collection by courseId and sow_order.

    Args:
        course_id: Course identifier (e.g., "course_c84474")
        order: Sequential position in SOW (1-indexed)
        mcp_config_path: Path to MCP configuration file

    Returns:
        dict: Lesson template document

    Raises:
        ValueError: If lesson template not found (fast-fail, no fallback - FR-012)
        Exception: If Appwrite query fails
    """
    logger.info(f"Fetching lesson template: courseId={course_id}, order={order}")

    try:
        # Query lesson_templates collection
        # Filter: courseId = course_id AND sow_order = order
        documents = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_templates",
            queries=[
                f'equal("courseId", "{course_id}")',
                f'equal("sow_order", {order})'
            ],
            mcp_config_path=mcp_config_path
        )

        if not documents or len(documents) == 0:
            # FR-012: Throw exception when lesson template not found (fast-fail)
            raise ValueError(
                f"Lesson template not found for courseId='{course_id}', order={order}. "
                f"Verify courseId and order are correct. "
                f"Check default.lesson_templates collection in Appwrite."
            )

        if len(documents) > 1:
            # This should not happen if unique index is properly configured
            logger.warning(
                f"Multiple lesson templates found for courseId='{course_id}', order={order}. "
                f"Using first result. This may indicate a data integrity issue."
            )

        template = documents[0]
        lesson_template_id = template.get("$id", template.get("lessonTemplateId", "UNKNOWN"))
        title = template.get("title", "Untitled")

        # Decompress cards field if compressed (gzip+base64)
        # Cards may be stored as compressed string to fit within Appwrite size limits
        cards = template.get("cards", [])
        if isinstance(cards, str):
            logger.info(f"Decompressing cards field (compressed format detected)...")
            try:
                cards = decompress_json_gzip_base64(cards)
                template["cards"] = cards
                logger.info(f"✓ Cards decompressed successfully")
            except Exception as e:
                raise ValueError(
                    f"Failed to decompress cards field for lesson template {lesson_template_id}: {e}"
                )

        card_count = len(cards)

        logger.info(
            f"✓ Found lesson template: {lesson_template_id} - '{title}' "
            f"({card_count} cards)"
        )

        return template

    except ValueError:
        # Re-raise ValueError for not found case (already has detailed message)
        raise

    except Exception as e:
        # Wrap other exceptions with context (fast-fail - FR-012)
        raise Exception(
            f"Failed to fetch lesson template for courseId='{course_id}', order={order}: {str(e)}"
        ) from e


async def query_all_lesson_templates(
    course_id: str,
    mcp_config_path: str = ".mcp.json"
) -> List[Dict[str, Any]]:
    """Query all lesson templates for a course (for batch processing).

    Implements US2 batch mode requirement.

    Args:
        course_id: Course identifier (e.g., "course_c84474")
        mcp_config_path: Path to MCP configuration file

    Returns:
        list: List of lesson template documents sorted by sow_order (ascending)

    Raises:
        Exception: If Appwrite query fails (fast-fail)
    """
    logger.info(f"Querying all lesson templates for courseId={course_id}")

    try:
        # Query all lesson templates for course
        documents = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_templates",
            queries=[
                f'equal("courseId", "{course_id}")',
                'orderAsc("sow_order")'  # Sort by order ascending
            ],
            mcp_config_path=mcp_config_path
        )

        logger.info(f"✓ Found {len(documents)} lesson templates for course {course_id}")

        # Decompress cards field for each template if compressed
        for template in documents:
            cards = template.get("cards", [])
            if isinstance(cards, str):
                lesson_template_id = template.get("$id", "UNKNOWN")
                logger.debug(f"Decompressing cards for template {lesson_template_id}...")
                try:
                    cards = decompress_json_gzip_base64(cards)
                    template["cards"] = cards
                except Exception as e:
                    logger.warning(
                        f"Failed to decompress cards for template {lesson_template_id}: {e}. "
                        f"Skipping this template."
                    )
                    template["cards"] = []  # Set empty array to avoid errors

        return documents

    except Exception as e:
        raise Exception(
            f"Failed to query lesson templates for courseId='{course_id}': {str(e)}"
        ) from e


# ═══════════════════════════════════════════════════════════════
# Card Eligibility Analysis (LLM-based)
# ═══════════════════════════════════════════════════════════════

async def extract_diagram_cards(
    lesson_template: Dict[str, Any],
    llm_client: Any = None
) -> List[Dict[str, Any]]:
    """Extract cards from lesson template that require diagram generation.

    Implements FR-014, FR-015, FR-016: LLM-based card eligibility analysis.

    Uses Claude agent LLM to analyze card content, cardType, and title for contextual
    understanding of diagram needs. This replaces keyword-based heuristics with semantic
    understanding (e.g., distinguishes "calculate gradient" from "define gradient").

    Args:
        lesson_template: Lesson template document from Appwrite
        llm_client: Optional Claude LLM client for eligibility analysis
                    If None, uses simple heuristic (for testing without LLM costs)

    Returns:
        list: Filtered list of cards requiring diagrams with eligibility rationale

    Raises:
        ValueError: If lesson_template has no cards array
        Exception: If LLM analysis fails (fast-fail)
    """
    cards = lesson_template.get("cards", [])

    if not cards:
        logger.info("Lesson template has no cards - returning empty list")
        return []

    logger.info(f"Analyzing {len(cards)} cards for diagram eligibility...")

    # For MVP: Use simple heuristic if no LLM client provided
    # This allows testing without LLM costs, but production should use LLM analysis
    if llm_client is None:
        logger.warning(
            "No LLM client provided - using simple heuristic for card eligibility. "
            "For production, provide LLM client for semantic analysis."
        )
        return _simple_eligibility_heuristic(cards)

    # TODO: Implement LLM-based eligibility analysis
    # This will be implemented in Phase 3 when integrating with Claude agent
    # For now, fall back to simple heuristic
    logger.warning("LLM-based eligibility analysis not yet implemented - using heuristic")
    return _simple_eligibility_heuristic(cards)


def _simple_eligibility_heuristic(cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Simple keyword-based heuristic for card eligibility with dual context analysis.

    Analyzes cards to determine if they need diagrams for:
    - Lesson content (explainer field) - teaching concepts
    - CFU questions (cfu field) - assessment problems

    This is a simplified version for MVP testing. Production should use LLM analysis
    as specified in FR-014/FR-015/FR-016.

    Args:
        cards: List of card dictionaries from lesson template

    Returns:
        list: Filtered list of cards with diagram context information:
            - needs_lesson_diagram (bool): True if explainer needs diagram
            - needs_cfu_diagram (bool): True if cfu needs diagram
            - lesson_diagram_reason (str): Reason for lesson diagram
            - cfu_diagram_reason (str): Reason for cfu diagram
            - diagram_contexts (list): List of contexts ("lesson", "cfu", or both)
    """
    # Keywords indicating visual/mathematical content
    visual_keywords = [
        # Geometric terms
        "triangle", "rectangle", "circle", "square", "polygon", "angle",
        "line", "point", "coordinate", "graph", "plot", "axis",
        # Mathematical operations with visual component
        "gradient", "slope", "equation", "function", "parabola",
        "sketch", "draw", "diagram", "visualize", "represent",
        # Statistical terms
        "chart", "histogram", "scatter", "distribution",
        # Algebraic visual
        "quadratic", "linear", "simultaneous"
    ]

    # Keywords indicating text-only content (skip diagrams)
    skip_keywords = [
        "define", "definition", "explain", "describe", "list",
        "state", "what is", "meaning of"
    ]

    eligible_cards = []

    for card in cards:
        card_id = card.get("id", "UNKNOWN")
        title = card.get("title", "")
        explainer = card.get("explainer", "")
        cfu = card.get("cfu", {})

        # === DUAL ANALYSIS: Analyze explainer and cfu separately ===

        # Analyze explainer content (lesson teaching content)
        explainer_text = f"{title} {explainer}".lower()
        explainer_skip_count = sum(1 for keyword in skip_keywords if keyword in explainer_text)
        explainer_visual_count = sum(1 for keyword in visual_keywords if keyword in explainer_text)

        needs_lesson_diagram = explainer_visual_count > 0 and explainer_skip_count == 0
        lesson_diagram_reason = (
            f"Explainer matched {explainer_visual_count} visual keywords"
            if needs_lesson_diagram
            else f"Explainer has {explainer_skip_count} skip keywords or no visual content"
        )

        # Analyze CFU content (assessment questions)
        cfu_text = json.dumps(cfu).lower() if cfu else ""
        cfu_skip_count = sum(1 for keyword in skip_keywords if keyword in cfu_text)
        cfu_visual_count = sum(1 for keyword in visual_keywords if keyword in cfu_text)

        needs_cfu_diagram = cfu_visual_count > 0 and cfu_skip_count == 0 and cfu  # Only if CFU exists
        cfu_diagram_reason = (
            f"CFU matched {cfu_visual_count} visual keywords"
            if needs_cfu_diagram
            else f"CFU has {cfu_skip_count} skip keywords, no visual content, or missing"
        )

        # Determine diagram contexts needed
        diagram_contexts = []
        if needs_lesson_diagram:
            diagram_contexts.append("lesson")
        if needs_cfu_diagram:
            diagram_contexts.append("cfu")

        # Add card to eligible list if ANY context needs diagram
        if diagram_contexts:
            logger.info(
                f"✓ Card {card_id} eligible for diagrams: "
                f"contexts={', '.join(diagram_contexts)} "
                f"(lesson:{explainer_visual_count} visual, cfu:{cfu_visual_count} visual)"
            )
            eligible_cards.append({
                **card,
                "needs_lesson_diagram": needs_lesson_diagram,
                "needs_cfu_diagram": needs_cfu_diagram,
                "lesson_diagram_reason": lesson_diagram_reason,
                "cfu_diagram_reason": cfu_diagram_reason,
                "diagram_contexts": diagram_contexts,
                "_eligibility_method": "dual_context_heuristic"
            })
        else:
            logger.debug(
                f"Skipping card {card_id}: No visual content or definition-heavy "
                f"(explainer:{explainer_visual_count}/{explainer_skip_count}, "
                f"cfu:{cfu_visual_count}/{cfu_skip_count})"
            )

    logger.info(
        f"Dual eligibility analysis complete: {len(eligible_cards)}/{len(cards)} cards need diagrams "
        f"(may need lesson, cfu, or both contexts)"
    )

    return eligible_cards
