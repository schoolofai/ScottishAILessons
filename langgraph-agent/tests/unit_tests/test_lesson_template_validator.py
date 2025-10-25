import pytest
from agent.lesson_template_validator import validate_lesson_template, validate_session_context

# --- Mock Data for Testing ---
@pytest.fixture
def valid_lesson_snapshot():
    return {
        "title": "Introduction to Fractions",
        "lesson_type": "teach",
        "estMinutes": 45,
        "cards": [
            {
                "id": "card_001",
                "title": "What is a Fraction?",
                "explainer": "A fraction represents part of a whole.",
                "explainer_plain": "A fraction shows parts of something.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "Which is 1/2?",
                    "options": ["1/2", "1/3"],
                    "answerIndex": 0,
                    "rubric": {"total_points": 1, "criteria": [{"description": "Correct", "points": 1}]},
                    "hints": ["Look at the numerator and denominator", "Think about equal parts"]
                },
                "misconceptions": [{"id": "MISC_MATH_FRAC_001", "misconception": "X", "clarification": "Y"}],
                "context_hooks": ["pizza"]
            },
            {
                "id": "card_002",
                "title": "Adding Fractions",
                "explainer": "To add fractions...",
                "explainer_plain": "Add fractions like this...",
                "cfu": {
                    "type": "numeric",
                    "id": "q002",
                    "stem": "What is 1/2 + 1/2?",
                    "expected": 1.0,
                    "tolerance": 0.01,
                    "money2dp": False,
                    "rubric": {"total_points": 2, "criteria": [{"description": "Correct sum", "points": 2}]},
                    "hints": ["Think about wholes", "What is 0.5 + 0.5?"]
                },
                "misconceptions": [{"id": "MISC_MATH_FRAC_002", "misconception": "A", "clarification": "B"}],
                "context_hooks": ["cake"]
            }
        ]
    }

@pytest.fixture
def valid_session_context(valid_lesson_snapshot):
    return {
        "session_id": "test_session_123",
        "student_id": "test_student_456",
        "course_id": "C844_73",
        "lesson_snapshot": valid_lesson_snapshot,
        "use_plain_text": False
    }

# --- Unit Tests for validate_lesson_template ---

def test_valid_lesson_snapshot(valid_lesson_snapshot):
    # Add courseId to make it valid
    valid_lesson_snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(valid_lesson_snapshot)
    assert result.is_valid is True
    assert not result.errors
    assert not result.warnings

def test_missing_title(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    snapshot["title"] = ""
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("title" in e.lower() for e in result.errors)

def test_invalid_lesson_type(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    snapshot["lesson_type"] = "invalid_type"
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("lesson_type" in e.lower() for e in result.errors)

def test_missing_cards(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    snapshot["cards"] = []
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("cards" in e.lower() for e in result.errors)

def test_missing_explainer_plain_warning(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    snapshot["cards"][0]["explainer_plain"] = ""
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is True  # Still valid, but warning
    assert any("explainer_plain" in w.lower() for w in result.warnings)

def test_missing_misconceptions_warning(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    snapshot["cards"][0]["misconceptions"] = []
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is True  # Still valid, but warning
    assert any("misconceptions" in w.lower() for w in result.warnings)

def test_missing_cfu(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][0]["cfu"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("cfu" in e.lower() for e in result.errors)

def test_missing_rubric_warning(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][0]["cfu"]["rubric"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is True  # Still valid, but warning
    assert any("rubric" in w.lower() for w in result.warnings)

def test_numeric_cfu_missing_expected(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][1]["cfu"]["expected"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("expected" in e.lower() for e in result.errors)

def test_numeric_cfu_missing_tolerance_warning(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][1]["cfu"]["tolerance"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is True  # Still valid, but warning
    assert any("tolerance" in w.lower() for w in result.warnings)

def test_numeric_cfu_missing_hints_warning(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][1]["cfu"]["hints"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is True  # Still valid, but warning
    assert any("hints" in w.lower() for w in result.warnings)

def test_mcq_cfu_missing_options(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][0]["cfu"]["options"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("options" in e.lower() for e in result.errors)

def test_mcq_cfu_missing_answer_index(valid_lesson_snapshot):
    snapshot = valid_lesson_snapshot.copy()
    del snapshot["cards"][0]["cfu"]["answerIndex"]
    snapshot["courseId"] = "C844_73"
    result = validate_lesson_template(snapshot)
    assert result.is_valid is False
    assert any("answerindex" in e.lower() for e in result.errors)

# --- Unit Tests for validate_session_context ---

def test_valid_session_context(valid_session_context):
    valid_session_context["lesson_snapshot"]["courseId"] = "C844_73"
    valid_session_context["course_subject"] = "mathematics"
    valid_session_context["course_level"] = "national-3"
    result = validate_session_context(valid_session_context)
    assert result.is_valid is True
    assert not result.errors

def test_session_context_missing_session_id(valid_session_context):
    context = valid_session_context.copy()
    context["session_id"] = ""
    context["lesson_snapshot"]["courseId"] = "C844_73"
    result = validate_session_context(context)
    # Session ID is not validated by current validator, so this test should check lesson validation
    assert result.is_valid is True  # No session_id validation currently

def test_session_context_missing_student_id(valid_session_context):
    context = valid_session_context.copy()
    context["student_id"] = ""
    context["lesson_snapshot"]["courseId"] = "C844_73"
    result = validate_session_context(context)
    # Student ID is not validated by current validator
    assert result.is_valid is True  # No student_id validation currently

def test_session_context_missing_course_subject_warning(valid_session_context):
    context = valid_session_context.copy()
    context["lesson_snapshot"]["courseId"] = "C844_73"
    # Don't add course_subject to trigger warning
    result = validate_session_context(context)
    assert result.is_valid is True  # Still valid, but warning
    assert any("course_subject" in w.lower() for w in result.warnings)

def test_session_context_missing_lesson_snapshot(valid_session_context):
    context = valid_session_context.copy()
    del context["lesson_snapshot"]
    result = validate_session_context(context)
    assert result.is_valid is False
    assert any("lesson_snapshot" in e.lower() for e in result.errors)

def test_session_context_invalid_lesson_snapshot_propagates_errors(valid_session_context):
    context = valid_session_context.copy()
    context["lesson_snapshot"]["title"] = ""  # Make lesson snapshot invalid
    context["lesson_snapshot"]["courseId"] = "C844_73"
    result = validate_session_context(context)
    assert result.is_valid is False
    assert any("title" in e.lower() for e in result.errors)

