"""Schema sanitizer for Claude Structured Outputs.

The Claude API's structured outputs feature has limited JSON Schema support.
This module transforms Pydantic-generated schemas to be compatible.

Supported features:
- All basic types: object, array, string, integer, number, boolean, null
- enum, const, required, additionalProperties (must be false)
- String formats: date-time, date, email, uri, uuid, etc.
- $ref, $def, and definitions

NOT supported (will be stripped):
- minLength, maxLength (on strings)
- minimum, maximum, exclusiveMinimum, exclusiveMaximum (on numbers)
- minItems, maxItems (on arrays, except minItems 0 or 1)
- pattern (complex regex)

Reference: https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs
"""

import copy
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# Constraints that are NOT supported by structured outputs
UNSUPPORTED_STRING_CONSTRAINTS = {'minLength', 'maxLength'}
UNSUPPORTED_NUMBER_CONSTRAINTS = {'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'}
UNSUPPORTED_ARRAY_CONSTRAINTS = {'maxItems'}  # minItems 0/1 is supported


def sanitize_schema_for_structured_output(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize a JSON schema for Claude structured outputs compatibility.

    This function:
    1. Removes unsupported constraints (minLength, maximum, etc.)
    2. Adds additionalProperties: false to all objects
    3. Moves constraint info to descriptions for prompt guidance

    Args:
        schema: Pydantic-generated JSON schema

    Returns:
        Sanitized schema compatible with structured outputs
    """
    # Deep copy to avoid mutating original
    sanitized = copy.deepcopy(schema)

    # Track removed constraints for logging
    removed_constraints: List[str] = []

    def process_schema_node(node: Any, path: str = "root") -> Any:
        """Recursively process schema nodes."""
        if not isinstance(node, dict):
            return node

        # Process $defs first (definitions)
        if '$defs' in node:
            for def_name, def_schema in node['$defs'].items():
                process_schema_node(def_schema, f"$defs.{def_name}")

        # Handle properties in objects
        if 'properties' in node:
            for prop_name, prop_schema in node['properties'].items():
                process_schema_node(prop_schema, f"{path}.{prop_name}")

            # Add additionalProperties: false to objects
            if 'additionalProperties' not in node:
                node['additionalProperties'] = False

        # Handle array items
        if 'items' in node:
            process_schema_node(node['items'], f"{path}.items")

        # Handle anyOf/allOf/oneOf
        for key in ['anyOf', 'allOf', 'oneOf']:
            if key in node:
                for i, sub_schema in enumerate(node[key]):
                    process_schema_node(sub_schema, f"{path}.{key}[{i}]")

        # Remove unsupported string constraints
        constraint_info = []
        for constraint in UNSUPPORTED_STRING_CONSTRAINTS:
            if constraint in node:
                value = node.pop(constraint)
                removed_constraints.append(f"{path}.{constraint}={value}")
                if constraint == 'minLength' and value > 0:
                    constraint_info.append(f"min {value} chars")
                elif constraint == 'maxLength':
                    constraint_info.append(f"max {value} chars")

        # Remove unsupported number constraints
        for constraint in UNSUPPORTED_NUMBER_CONSTRAINTS:
            if constraint in node:
                value = node.pop(constraint)
                removed_constraints.append(f"{path}.{constraint}={value}")
                if constraint == 'minimum':
                    constraint_info.append(f"min: {value}")
                elif constraint == 'maximum':
                    constraint_info.append(f"max: {value}")

        # Remove unsupported array constraints (keep minItems 0/1)
        if 'minItems' in node and node['minItems'] > 1:
            value = node.pop('minItems')
            removed_constraints.append(f"{path}.minItems={value}")
            constraint_info.append(f"min {value} items")

        if 'maxItems' in node:
            value = node.pop('maxItems')
            removed_constraints.append(f"{path}.maxItems={value}")
            constraint_info.append(f"max {value} items")

        # Add constraint info to description for prompt guidance
        if constraint_info and 'description' in node:
            node['description'] = f"{node['description']} ({', '.join(constraint_info)})"
        elif constraint_info:
            node['description'] = f"({', '.join(constraint_info)})"

        return node

    # Process the entire schema
    process_schema_node(sanitized, "root")

    # Ensure top-level additionalProperties is false
    if 'additionalProperties' not in sanitized:
        sanitized['additionalProperties'] = False

    # Log summary
    if removed_constraints:
        logger.info(f"Schema sanitization: removed {len(removed_constraints)} unsupported constraints")
        logger.debug(f"Removed constraints: {removed_constraints[:10]}...")

    return sanitized


def get_schema_stats(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Get statistics about a JSON schema.

    Args:
        schema: JSON schema

    Returns:
        Dict with schema statistics
    """
    import json

    schema_str = json.dumps(schema)

    return {
        "size_chars": len(schema_str),
        "definitions_count": len(schema.get('$defs', {})),
        "top_level_properties": list(schema.get('properties', {}).keys()),
        "has_additional_properties_false": schema.get('additionalProperties') == False
    }
