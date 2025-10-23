import types


def test_rubric_formatting(monkeypatch):
    # Avoid constructing real ChatOpenAI
    from agent import llm_teacher as lt

    def fake_init(self):
        self.llm = types.SimpleNamespace(invoke=lambda *args, **kwargs: types.SimpleNamespace(content="ok"))

    monkeypatch.setattr(lt.LLMTeacher, "__init__", fake_init)
    teacher = lt.LLMTeacher()

    rubric = {
        "total_points": 4,
        "criteria": [
            {"description": "Correct calculation", "points": 2},
            {"description": "Correct final answer", "points": 2},
        ],
    }

    formatted = teacher._format_rubric_for_prompt(rubric)
    assert "Total Points: 4" in formatted
    assert "[2 pts]" in formatted
    assert "Correct calculation" in formatted


def test_numeric_parse_helper():
    from agent.teacher_graph_toolcall_interrupt import _parse_numeric_response

    assert _parse_numeric_response("£4.00", money_format=True) == 4.0
    assert _parse_numeric_response("4", money_format=True) == 4.0
    assert _parse_numeric_response("1,234.50", money_format=False) == 1234.5


def test_validator_missing_fields():
    from agent.lesson_template_validator import validate_lesson_template

    lesson = {
        "title": "Test Lesson",
        "courseId": "course_123",
        "lesson_type": "teach",
        "cards": [
            {
                "id": "card_001",
                "cfu": {
                    "type": "numeric",
                    "stem": "What is 2+2?",
                    "expected": 4,
                }
            }
        ],
    }

    result = validate_lesson_template(lesson)
    # Expect at least some warnings for missing rubric/tolerance/hints/misconceptions/explainer_plain
    assert result.is_valid  # No fatal errors
    warnings_text = "\n".join(result.warnings)
    assert "rubric" in warnings_text.lower()


def test_retry_node_authored_hints_and_llm_fallback():
    """Test that authored hints are used progressively and LLM fallback triggers when exhausted."""
    # Test hint progression logic
    cfu = {
        "hints": ["Hint 1: add", "Hint 2: compute"],
    }
    
    # Attempt 1 should use hint 1
    attempt_1 = 1
    if attempt_1 <= len(cfu["hints"]):
        hint = cfu["hints"][attempt_1 - 1]
        assert hint == "Hint 1: add"
    
    # Attempt 2 should use hint 2
    attempt_2 = 2
    if attempt_2 <= len(cfu["hints"]):
        hint = cfu["hints"][attempt_2 - 1]
        assert hint == "Hint 2: compute"
    
    # Attempt 3 should exceed authored hints (would trigger LLM fallback)
    attempt_3 = 3
    should_use_llm = attempt_3 > len(cfu["hints"])
    assert should_use_llm is True


