"""Test Pydantic models directly without SDK dependencies."""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, ValidationError, ConfigDict


# Copy of Pydantic V2 models (without SDK dependencies)
class LessonTemplateCard(BaseModel):
    """Schema for individual lesson cards."""

    model_config = ConfigDict(extra="allow")

    card_number: int = Field(..., ge=1)
    card_type: str
    title: str = Field(..., min_length=10, max_length=150)
    purpose: Optional[str] = None
    cfu: Optional[Dict[str, Any]] = None

    @field_validator('card_type')
    @classmethod
    def validate_card_type(cls, v):
        allowed_types = {
            "starter", "explainer", "direct_instruction",
            "guided_practice", "independent_practice",
            "formative_check", "worked_example",
            "challenge", "reflection"
        }
        if v not in allowed_types:
            raise ValueError(f"Invalid card_type: '{v}'. Must be one of: {', '.join(sorted(allowed_types))}")
        return v

    @field_validator('cfu')
    @classmethod
    def validate_cfu_structure(cls, v):
        if v is not None:
            if not isinstance(v, dict):
                raise ValueError("cfu must be an object/dict")
            if 'cfu_type' not in v:
                raise ValueError("cfu object must contain 'cfu_type' field")
            allowed_cfu_types = {'mcq', 'numeric', 'structured_response', 'short_text', 'open_ended_short_answer'}
            if v['cfu_type'] not in allowed_cfu_types:
                raise ValueError(f"Invalid cfu_type: '{v['cfu_type']}'")
        return v


class LessonTemplate(BaseModel):
    """Complete lesson template schema."""

    model_config = ConfigDict(extra="allow")

    courseId: str = Field(..., pattern=r'^course_[a-zA-Z0-9]+$')
    title: Optional[str] = None
    label: Optional[str] = None
    outcomeRefs: List[str] = Field(..., min_length=1)
    lesson_type: str
    estMinutes: int = Field(..., ge=30, le=120)
    sow_order: int = Field(..., ge=1)
    createdBy: Optional[str] = "claude_agent_sdk"
    version: Optional[int] = 1
    status: Optional[str] = "draft"
    engagement_tags: List[str] = Field(default_factory=list)
    policy: Dict[str, Any] = Field(default_factory=dict)
    cards: List[LessonTemplateCard] = Field(..., min_length=1)

    @field_validator('title', mode='before')
    @classmethod
    def validate_title_or_label(cls, v, info):
        label = info.data.get('label') if hasattr(info, 'data') else None
        if not v and not label:
            raise ValueError("Either 'title' or 'label' must be provided")
        if not v and label:
            return label
        if v and (len(v) < 10 or len(v) > 150):
            raise ValueError(f"title/label must be 10-150 characters, got {len(v)}")
        return v

    @field_validator('lesson_type')
    @classmethod
    def validate_lesson_type(cls, v):
        allowed_types = {"teach", "independent_practice", "formative_assessment", "revision", "mock_exam"}
        if v not in allowed_types:
            raise ValueError(f"Invalid lesson_type: '{v}'. Must be one of: {', '.join(sorted(allowed_types))}")
        return v

    @field_validator('cards')
    @classmethod
    def validate_card_count(cls, v, info):
        lesson_type = info.data.get('lesson_type') if hasattr(info, 'data') else None
        count = len(v)
        ranges = {
            "teach": (3, 4),
            "independent_practice": (3, 5),
            "formative_assessment": (2, 6),
            "revision": (4, 8),
            "mock_exam": (8, 15)
        }
        if lesson_type in ranges:
            min_cards, max_cards = ranges[lesson_type]
            if not (min_cards <= count <= max_cards):
                raise ValueError(f"lesson_type '{lesson_type}' requires {min_cards}-{max_cards} cards, got {count}")

        # Validate sequential card numbers
        expected = 1
        for card in v:
            if card.card_number != expected:
                raise ValueError(f"Card numbers must be sequential. Expected {expected}, got {card.card_number}")
            expected += 1
        return v


def test_file(file_path: str):
    """Test validation on a specific file."""
    print(f"\n{'='*70}")
    print(f"Testing: {file_path}")
    print('='*70)

    try:
        with open(file_path, 'r') as f:
            data = json.load(f)

        template = LessonTemplate(**data)

        print("✅ VALIDATION PASSED")
        print(f"\nDetails:")
        print(f"  Title: {template.title or template.label}")
        print(f"  Lesson Type: {template.lesson_type}")
        print(f"  Card Count: {len(template.cards)}")
        print(f"  Course ID: {template.courseId}")
        print(f"  SOW Order: {template.sow_order}")

    except json.JSONDecodeError as e:
        print(f"❌ JSON SYNTAX ERROR")
        print(f"\nError at line {e.lineno}, column {e.colno}:")
        print(f"  {e.msg}")

    except ValidationError as e:
        print(f"❌ SCHEMA VALIDATION ERROR")
        print(f"\nFound {len(e.errors())} error(s):\n")
        for i, error in enumerate(e.errors(), 1):
            field = ".".join(str(loc) for loc in error['loc'])
            print(f"{i}. Field: {field}")
            print(f"   Error: {error['msg']}")
            print(f"   Type: {error['type']}")
            print()

    except FileNotFoundError:
        print(f"❌ FILE NOT FOUND: {file_path}")


if __name__ == "__main__":
    # Test the corrected file
    test_file("workspace/20251020_104734/lesson_template.json")

    # Test minimal valid
    print(f"\n\n{'='*70}")
    print("Creating minimal valid template")
    print('='*70)

    minimal_valid = {
        "courseId": "course_test123",
        "label": "Test Lesson for Fractions",
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
                "title": "Introduction to Fractions",
                "cfu": {"cfu_type": "mcq", "cfu_prompt": "What is a fraction?"}
            },
            {
                "card_number": 2,
                "card_type": "guided_practice",
                "title": "Practice with Fractions",
                "cfu": {"cfu_type": "numeric", "cfu_prompt": "Calculate 1/2 + 1/4"}
            },
            {
                "card_number": 3,
                "card_type": "independent_practice",
                "title": "Apply Fraction Skills",
                "cfu": {"cfu_type": "short_text", "cfu_prompt": "Explain how you solved it"}
            }
        ]
    }

    test_path = Path("test_minimal.json")
    test_path.write_text(json.dumps(minimal_valid, indent=2))
    test_file(str(test_path))
    test_path.unlink()

    print(f"\n\n{'='*70}")
    print("Testing invalid schema")
    print('='*70)

    invalid_schema = {
        **minimal_valid,
        "courseId": "invalid_format",  # Missing 'course_' prefix
        "lesson_type": "introduction",  # Invalid enum
        "cards": minimal_valid["cards"] * 2  # Too many cards
    }

    test_path = Path("test_invalid.json")
    test_path.write_text(json.dumps(invalid_schema, indent=2))
    test_file(str(test_path))
    test_path.unlink()

    print("\n✅ All tests completed!")
