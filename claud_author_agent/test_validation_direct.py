"""Direct test of Pydantic validation models without SDK dependencies."""

import json
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from tools.json_validator_tool import LessonTemplate, ValidationError

def test_file(file_path: str):
    """Test validation on a specific file."""
    print(f"\n{'='*70}")
    print(f"Testing: {file_path}")
    print('='*70)

    try:
        # Read file
        with open(file_path, 'r') as f:
            data = json.load(f)

        # Validate with Pydantic
        template = LessonTemplate(**data)

        # Success
        print("✅ VALIDATION PASSED")
        print(f"\nDetails:")
        print(f"  Title: {template.title or template.label}")
        print(f"  Lesson Type: {template.lesson_type}")
        print(f"  Card Count: {len(template.cards)}")
        print(f"  Course ID: {template.courseId}")
        print(f"  SOW Order: {template.sow_order}")

    except json.JSONDecodeError as e:
        # JSON syntax error
        print(f"❌ JSON SYNTAX ERROR")
        print(f"\nError at line {e.lineno}, column {e.colno}:")
        print(f"  {e.msg}")
        print(f"  Character position: {e.pos}")

    except ValidationError as e:
        # Pydantic validation error
        print(f"❌ SCHEMA VALIDATION ERROR")
        print(f"\nFound {len(e.errors())} error(s):\n")

        for i, error in enumerate(e.errors(), 1):
            field = ".".join(str(loc) for loc in error['loc'])
            print(f"{i}. Field: {field}")
            print(f"   Error: {error['msg']}")
            print(f"   Type: {error['type']}")
            if 'input' in error:
                print(f"   Input: {error.get('input')}")
            print()

    except FileNotFoundError:
        print(f"❌ FILE NOT FOUND: {file_path}")

    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {type(e).__name__}")
        print(f"   {str(e)}")


if __name__ == "__main__":
    # Test the corrected file
    test_file("workspace/20251020_104734/lesson_template.json")

    # Test with a minimal valid template
    print(f"\n\n{'='*70}")
    print("Creating and testing minimal valid template")
    print('='*70)

    minimal_valid = {
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
                "title": "Introduction",
                "cfu": {"cfu_type": "mcq", "cfu_prompt": "Test?"}
            },
            {
                "card_number": 2,
                "card_type": "guided_practice",
                "title": "Practice",
                "cfu": {"cfu_type": "numeric", "cfu_prompt": "Calculate?"}
            },
            {
                "card_number": 3,
                "card_type": "independent_practice",
                "title": "Apply",
                "cfu": {"cfu_type": "short_text", "cfu_prompt": "Explain?"}
            }
        ]
    }

    # Write and test
    test_path = Path("test_minimal.json")
    test_path.write_text(json.dumps(minimal_valid, indent=2))
    test_file(str(test_path))
    test_path.unlink()  # Cleanup

    print(f"\n\n{'='*70}")
    print("Testing invalid schema (wrong lesson_type, too many cards)")
    print('='*70)

    invalid_schema = {
        **minimal_valid,
        "lesson_type": "introduction",  # Invalid
        "cards": minimal_valid["cards"] * 2  # Too many for 'teach'
    }

    test_path = Path("test_invalid.json")
    test_path.write_text(json.dumps(invalid_schema, indent=2))
    test_file(str(test_path))
    test_path.unlink()  # Cleanup
