"""Entry trimmer for reducing SOW entries size for storage.

Removes non-essential verbose fields from lesson entries to fit within
Appwrite's 100k character limit while preserving all data needed for
lesson delivery.

Fields removed are planning/guidance text not used by the frontend.
"""

import copy
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Fields to remove from entries for storage
# These are verbose planning/guidance text not needed for lesson delivery
FIELDS_TO_TRIM = {
    "root": [
        "lesson_instruction",  # Agent instructions, not displayed
    ],
    "lesson_plan": [
        "multi_standard_integration_strategy",  # Planning guidance
        "lesson_flow_summary",  # Summary text
        "assessment_progression",  # Planning guidance
        "misconceptions_embedded_in_cards",  # Planning notes
        "summary",  # Verbose summary
    ],
    "card_structure": [
        "pedagogical_approach",  # Teaching approach notes
        "misconceptions_addressed",  # Planning notes
        # Keep: worked_example, cfu_strategy, key_concepts (needed for delivery)
    ],
    "accessibility_profile": [
        # Keep all - these are needed for accessibility
    ],
}


def trim_entries_for_storage(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Trim non-essential fields from entries for storage.

    Creates a deep copy and removes verbose fields to reduce size.
    Original entries are not modified.

    Args:
        entries: List of SOWEntry dictionaries

    Returns:
        Trimmed copy of entries

    Example:
        >>> original_size = len(json.dumps(entries))
        >>> trimmed = trim_entries_for_storage(entries)
        >>> trimmed_size = len(json.dumps(trimmed))
        >>> print(f"Reduced by {(1 - trimmed_size/original_size)*100:.1f}%")
    """
    trimmed_entries = []

    for entry in entries:
        trimmed = copy.deepcopy(entry)

        # Remove root-level fields
        for field in FIELDS_TO_TRIM["root"]:
            trimmed.pop(field, None)

        # Remove lesson_plan fields
        if "lesson_plan" in trimmed:
            lp = trimmed["lesson_plan"]
            for field in FIELDS_TO_TRIM["lesson_plan"]:
                lp.pop(field, None)

            # Remove card_structure fields
            if "card_structure" in lp:
                for card in lp["card_structure"]:
                    for field in FIELDS_TO_TRIM["card_structure"]:
                        card.pop(field, None)

        trimmed_entries.append(trimmed)

    return trimmed_entries


def get_trimming_stats(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate trimming statistics.

    Args:
        entries: Original entries list

    Returns:
        Dictionary with:
        - original_size: Original JSON size
        - trimmed_size: Trimmed JSON size
        - reduction: Percentage reduction
        - fits_limit: Whether trimmed size fits 100k limit
    """
    import json

    original_json = json.dumps(entries)
    original_size = len(original_json)

    trimmed = trim_entries_for_storage(entries)
    trimmed_json = json.dumps(trimmed)
    trimmed_size = len(trimmed_json)

    reduction = (1 - trimmed_size / original_size) * 100 if original_size > 0 else 0

    # After compression, size is typically ~31% of original
    estimated_compressed = int(trimmed_size * 0.31)

    return {
        "original_size": original_size,
        "trimmed_size": trimmed_size,
        "reduction": f"{reduction:.1f}%",
        "estimated_compressed": estimated_compressed,
        "fits_limit": estimated_compressed < 100000,
    }


# CLI for testing
if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    if len(sys.argv) > 1:
        # Load entries from file
        entries_file = Path(sys.argv[1])

        if not entries_file.exists():
            print(f"Error: File not found: {entries_file}")
            sys.exit(1)

        with open(entries_file) as f:
            data = json.load(f)

        # Handle both direct entries list and SOW with entries field
        entries = data if isinstance(data, list) else data.get("entries", [])

        stats = get_trimming_stats(entries)

        print("Entry Trimming Stats:")
        print("=" * 50)
        print(f"Original size: {stats['original_size']:,} chars")
        print(f"Trimmed size:  {stats['trimmed_size']:,} chars")
        print(f"Reduction:     {stats['reduction']}")
        print(f"Est. compressed: {stats['estimated_compressed']:,} chars")
        print(f"Fits 100k limit: {'YES' if stats['fits_limit'] else 'NO'}")

    else:
        print("Usage: python entry_trimmer.py <path/to/entries.json>")
