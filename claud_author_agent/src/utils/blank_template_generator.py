"""Blank Lesson Template Generator

Generates a completely empty lesson_template.json with correct schema structure
based on sow_entry_input.json. Only card IDs and CFU types are populated.

This prevents agents from wasting time on schema structure errors by providing
the correct skeleton upfront.
"""

import json
from typing import Dict, Any, List


def infer_cfu_type(cfu_strategy: str) -> str:
    """Infer CFU type from SOW cfu_strategy string.

    Args:
        cfu_strategy: The CFU strategy description from SOW entry

    Returns:
        One of: "mcq", "numeric", "true_false", "short_answer"
    """
    strategy_lower = cfu_strategy.lower()

    if any(keyword in strategy_lower for keyword in ["mcq", "multiple choice", "select"]):
        return "mcq"
    elif any(keyword in strategy_lower for keyword in ["numeric", "number", "calculate"]):
        return "numeric"
    elif any(keyword in strategy_lower for keyword in ["true", "false", "boolean"]):
        return "true_false"
    else:
        return "short_answer"


def create_empty_cfu(card_number: int, cfu_strategy: str) -> Dict[str, Any]:
    """Create empty CFU object with only type, id, and required structure.

    Args:
        card_number: Card sequence number (1-based)
        cfu_strategy: CFU strategy from SOW entry

    Returns:
        Empty CFU object with correct type-specific fields
    """
    cfu_type = infer_cfu_type(cfu_strategy)
    cfu_id = f"CFU_{card_number:03d}"

    base_cfu = {
        "type": cfu_type,
        "id": cfu_id,
        "stem": ""
    }

    # Add type-specific empty fields
    if cfu_type == "mcq":
        base_cfu["options"] = ["", "", "", ""]
        base_cfu["answerIndex"] = 0
    elif cfu_type == "numeric":
        base_cfu["expected"] = 0.0
        base_cfu["tolerance"] = 0.1
    elif cfu_type == "true_false":
        base_cfu["expected"] = True
    elif cfu_type == "short_answer":
        base_cfu["expected"] = ""

    return base_cfu


def create_empty_card(sow_card: Dict[str, Any]) -> Dict[str, Any]:
    """Create completely empty lesson template card with only id and structure.

    Args:
        sow_card: SOW card entry from card_structure array

    Returns:
        Empty lesson template card with correct schema
    """
    card_number = sow_card["card_number"]
    card_id = f"card_{card_number:03d}"

    return {
        "id": card_id,
        "title": "",
        "explainer": "",
        "explainer_plain": "",
        "cfu": create_empty_cfu(card_number, sow_card.get("cfu_strategy", "short answer")),
        "rubric": {
            "total_points": 0,
            "criteria": []
        },
        "misconceptions": []
    }


def generate_blank_template(sow_entry: Dict[str, Any], course_id: str) -> Dict[str, Any]:
    """Generate blank lesson template from SOW entry.

    Only populates:
    - Template-level metadata (courseId, title, outcomeRefs, etc.)
    - Card IDs (card_001, card_002, etc.)
    - CFU IDs and types
    - Minimal empty structure for all other fields

    Args:
        sow_entry: SOW entry input dictionary
        course_id: Course identifier (from sow_context.json or CLI parameter)

    Returns:
        Blank lesson template with correct schema structure

    Raises:
        KeyError: If required fields are missing from SOW entry
    """
    lesson_plan = sow_entry["lesson_plan"]

    # Create empty cards with correct structure
    blank_cards = [
        create_empty_card(sow_card)
        for sow_card in lesson_plan["card_structure"]
    ]

    # Generate title from label if lesson_plan doesn't have explicit title
    # SOW entries use "label" at top level, not "title" in lesson_plan
    lesson_title = sow_entry.get("label", "Untitled Lesson")

    return {
        "courseId": course_id,
        "title": lesson_title,
        "outcomeRefs": sow_entry.get("outcomeRefs", []),
        "lesson_type": sow_entry.get("lesson_type", "teach"),
        "estMinutes": sow_entry.get("estMinutes", 50),
        "sow_order": sow_entry.get("order", 0),
        "cards": blank_cards
    }


def generate_blank_template_file(
    sow_input_path: str,
    output_path: str,
    course_id: str
) -> None:
    """Generate blank template file from SOW input file.

    Args:
        sow_input_path: Path to sow_entry_input.json
        output_path: Path to write blank lesson_template.json
        course_id: Course identifier (e.g., 'course_c75773')

    Raises:
        FileNotFoundError: If sow_input_path doesn't exist
        json.JSONDecodeError: If SOW input is invalid JSON
        KeyError: If required fields are missing from SOW entry
    """
    with open(sow_input_path, 'r') as f:
        sow_entry = json.load(f)

    blank_template = generate_blank_template(sow_entry, course_id)

    with open(output_path, 'w') as f:
        json.dump(blank_template, f, indent=2)

    card_ids = [c['id'] for c in blank_template['cards']]
    print(f"✅ Generated blank template: {output_path}")
    print(f"   - {len(blank_template['cards'])} empty cards created")
    print(f"   - Title: {blank_template['title']}")
    print(f"   - Card IDs: {', '.join(card_ids)}")


if __name__ == "__main__":
    # Example usage for testing
    import sys

    if len(sys.argv) != 4:
        print("Usage: python blank_template_generator.py <sow_input.json> <output.json> <course_id>")
        sys.exit(1)

    generate_blank_template_file(sys.argv[1], sys.argv[2], sys.argv[3])
