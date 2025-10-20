"""
Example: Using JSON Validation Tool with Lesson Templates

Demonstrates:
1. Valid lesson template validation
2. Handling JSON syntax errors
3. Handling schema validation errors
4. Integration with lesson authoring workflow

Run this example:
    cd examples
    python example_validation_tool.py
"""

import anyio
import json
from pathlib import Path
from claude_agent_sdk import query, ClaudeAgentOptions
import sys

# Add parent directory to path to import from src
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.tools.json_validator_tool import validation_server


async def example_1_valid_template():
    """Example 1: Valid lesson template passes validation."""
    print("=" * 70)
    print("Example 1: Valid Lesson Template")
    print("=" * 70)
    print()

    # Create a minimal valid template
    valid_template = {
        "courseId": "course_test123",
        "label": "Introduction to Fractions",
        "outcomeRefs": ["O1", "AS1.2"],
        "lesson_type": "teach",
        "estMinutes": 45,
        "createdBy": "claude_agent_sdk",
        "sow_order": 1,
        "version": 1,
        "status": "draft",
        "engagement_tags": ["visual", "interactive"],
        "policy": {"calculator_allowed": False},
        "cards": [
            {
                "card_number": 1,
                "card_type": "direct_instruction",
                "title": "What are Fractions?",
                "purpose": "Introduce fraction concepts",
                "cfu": {
                    "cfu_type": "mcq",
                    "cfu_prompt": "What does the numerator represent?",
                    "cfu_options": [
                        {"letter": "A", "text": "Parts taken", "correct": True},
                        {"letter": "B", "text": "Total parts", "correct": False}
                    ]
                }
            },
            {
                "card_number": 2,
                "card_type": "guided_practice",
                "title": "Practice Identifying Fractions",
                "purpose": "Practice fraction identification",
                "cfu": {
                    "cfu_type": "numeric",
                    "cfu_prompt": "Write 'two thirds' as a fraction",
                    "correct_answer": "2/3"
                }
            },
            {
                "card_number": 3,
                "card_type": "independent_practice",
                "title": "Fraction Problems",
                "purpose": "Apply fraction knowledge",
                "cfu": {
                    "cfu_type": "structured_response",
                    "cfu_prompt": "Solve: 1/2 + 1/4",
                    "expected_response_elements": ["Common denominator", "Correct answer: 3/4"]
                }
            }
        ]
    }

    # Write to file
    test_file = Path("test_valid.json")
    test_file.write_text(json.dumps(valid_template, indent=2))

    # Validate using tool
    options = ClaudeAgentOptions(
        mcp_servers={"validator": validation_server},
        allowed_tools=["mcp__validator__validate_lesson_template"],
        permission_mode='acceptEdits'
    )

    prompt = "Validate the lesson template at test_valid.json using the mcp__validator__validate_lesson_template tool."

    print(f"Prompt: {prompt}")
    print()
    print("Validation Result:")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Cleanup
        test_file.unlink(missing_ok=True)


async def example_2_json_syntax_error():
    """Example 2: JSON syntax error - inline comment."""
    print("\n" + "=" * 70)
    print("Example 2: JSON Syntax Error (Inline Comment)")
    print("=" * 70)
    print()

    # This recreates the exact error from the user's bug report
    invalid_json = '''{
  "courseId": "course_test123",
  "label": "Test Lesson",
  "outcomeRefs": ["O1"],
  "lesson_type": "teach",
  "estMinutes": 45,
  "sow_order": 1,
  "engagement_tags": [],
  "policy": {},
  "cards": [
    {
      "card_number": 1,
      "card_type": "direct_instruction",
      "title": "Test Card",
      "cfu": {
        "cfu_type": "open_ended_short_answer",
        "cfu_prompt": "Test question",
        "sample_weak_response": "Too brief." [This is a comment - NOT allowed in JSON!]
      }
    }
  ]
}'''

    test_file = Path("test_invalid_syntax.json")
    test_file.write_text(invalid_json)

    options = ClaudeAgentOptions(
        mcp_servers={"validator": validation_server},
        allowed_tools=["mcp__validator__validate_lesson_template"],
        permission_mode='acceptEdits'
    )

    prompt = "Validate the lesson template at test_invalid_syntax.json using the mcp__validator__validate_lesson_template tool."

    print(f"Prompt: {prompt}")
    print()
    print("Validation Result (Expected: JSON_SYNTAX_ERROR):")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Cleanup
        test_file.unlink(missing_ok=True)


async def example_3_schema_errors():
    """Example 3: Schema validation errors - multiple issues."""
    print("\n" + "=" * 70)
    print("Example 3: Schema Validation Errors")
    print("=" * 70)
    print()

    # Valid JSON but invalid schema
    invalid_schema = {
        "courseId": "invalid_format",  # Should start with "course_"
        "label": "Test",
        "outcomeRefs": [],  # Should not be empty
        "lesson_type": "introduction",  # Invalid enum (should be 'teach', etc.)
        "estMinutes": 45,
        "sow_order": 1,
        "engagement_tags": [],
        "policy": {},
        "cards": [
            {
                "card_number": 1,
                "card_type": "invalid_type",  # Invalid card_type
                "title": "Test",
                "cfu": {
                    "cfu_type": "multiple_choice",  # Should be 'mcq'
                    "cfu_prompt": "Test?"
                }
            },
            {
                "card_number": 3,  # Should be 2 (not sequential)
                "card_type": "starter",
                "title": "Test 2",
                "cfu": {
                    "cfu_type": "numeric",
                    "cfu_prompt": "Test?"
                }
            },
            {
                "card_number": 3,  # Duplicate number
                "card_type": "explainer",
                "title": "Test 3",
                "cfu": None
            },
            {
                "card_number": 4,
                "card_type": "guided_practice",
                "title": "Test 4",
                "cfu": {
                    "cfu_type": "mcq",
                    "cfu_prompt": "Test?"
                }
            },
            {
                "card_number": 5,  # Too many cards for 'teach' lesson (should be 3-4)
                "card_type": "formative_check",
                "title": "Test 5",
                "cfu": {
                    "cfu_type": "mcq",
                    "cfu_prompt": "Test?"
                }
            }
        ]
    }

    test_file = Path("test_invalid_schema.json")
    test_file.write_text(json.dumps(invalid_schema, indent=2))

    options = ClaudeAgentOptions(
        mcp_servers={"validator": validation_server},
        allowed_tools=["mcp__validator__validate_lesson_template"],
        permission_mode='acceptEdits'
    )

    prompt = "Validate the lesson template at test_invalid_schema.json using the mcp__validator__validate_lesson_template tool."

    print(f"Prompt: {prompt}")
    print()
    print("Validation Result (Expected: SCHEMA_VALIDATION_ERROR):")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Cleanup
        test_file.unlink(missing_ok=True)


async def main():
    """Main entry point."""
    await example_1_valid_template()
    await example_2_json_syntax_error()
    await example_3_schema_errors()

    print()
    print("=" * 70)
    print("✅ All validation tool examples completed!")
    print("=" * 70)
    print()
    print("Key Takeaways:")
    print("1. Valid templates pass with details (card count, lesson type, etc.)")
    print("2. JSON syntax errors provide line/column information")
    print("3. Schema errors show field-level details for each violation")
    print("4. Tool naming: mcp__validator__validate_lesson_template")
    print()


if __name__ == "__main__":
    anyio.run(main())
