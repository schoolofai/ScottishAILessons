import pytest
from unittest.mock import MagicMock, patch
from agent.llm_teacher import LLMTeacher, EvaluationResponse, RubricCriterionResult

# Mock ChatOpenAI for LLMTeacher
@pytest.fixture
def mock_llm():
    mock = MagicMock()
    mock.invoke.return_value = MagicMock(content="LLM Response")
    mock.with_structured_output.return_value = MagicMock(
        invoke=MagicMock(return_value=EvaluationResponse(
            is_correct=True,
            confidence=0.9,
            feedback="Great job!",
            reasoning="Student understood the concept.",
            should_progress=True,
            partial_credit=1.0,
            rubric_breakdown=[RubricCriterionResult(description="Criterion 1", points_awarded=1.0, max_points=1.0)]
        ))
    )
    return mock

@pytest.fixture
def llm_teacher(mock_llm):
    with patch('agent.llm_teacher.ChatOpenAI', return_value=mock_llm):
        teacher = LLMTeacher()
        teacher.llm = mock_llm
        return teacher

# --- Test _format_rubric_for_prompt ---
def test_format_rubric_for_prompt_valid(llm_teacher):
    rubric = {
        "total_points": 3,
        "criteria": [
            {"description": "Criterion A", "points": 1},
            {"description": "Criterion B", "points": 2}
        ]
    }
    expected = "Total Points: 3\n1. [1 pts] Criterion A\n2. [2 pts] Criterion B"
    assert llm_teacher._format_rubric_for_prompt(rubric) == expected

def test_format_rubric_for_prompt_empty(llm_teacher):
    rubric = {}
    expected = "No specific rubric provided. Evaluate holistically."
    assert llm_teacher._format_rubric_for_prompt(rubric) == expected

def test_format_rubric_for_prompt_no_criteria(llm_teacher):
    rubric = {"total_points": 1, "criteria": []}
    expected = "No specific rubric provided. Evaluate holistically."
    assert llm_teacher._format_rubric_for_prompt(rubric) == expected

# --- Test _format_misconceptions_for_prompt ---
def test_format_misconceptions_for_prompt_valid(llm_teacher):
    misconceptions = [
        {"id": "M1", "misconception": "Misc 1", "clarification": "Clar 1"},
        {"id": "M2", "misconception": "Misc 2", "clarification": "Clar 2"}
    ]
    expected = "1. Misconception: Misc 1\n   Clarification: Clar 1\n2. Misconception: Misc 2\n   Clarification: Clar 2"
    assert llm_teacher._format_misconceptions_for_prompt(misconceptions) == expected

def test_format_misconceptions_for_prompt_empty(llm_teacher):
    misconceptions = []
    expected = "No specific misconceptions documented for this question."
    assert llm_teacher._format_misconceptions_for_prompt(misconceptions) == expected

# --- Test generate_hint_sync_full ---
@pytest.fixture
def mock_card_numeric():
    return {
        "title": "Numeric Card",
        "cfu": {
            "type": "numeric",
            "id": "q001",
            "stem": "What is 2 + 2?",
            "expected": 4.0,
            "tolerance": 0.01,
            "hints": ["Hint 1", "Hint 2"]
        }
    }

@pytest.fixture
def mock_state():
    return {
        "course_subject_display": "Mathematics",
        "course_level_display": "National 3",
        "course_context_block": "Subject: Mathematics\nLevel: National 3",
        "engagement_guidance": "",
        "policy_reminders": "",
        "sqa_alignment_summary": ""
    }

def test_generate_hint_sync_full(llm_teacher, mock_card_numeric, mock_state):
    student_response = "5"
    attempt_number = 3
    
    hint = llm_teacher.generate_hint_sync_full(
        current_card=mock_card_numeric,
        student_response=student_response,
        attempt_number=attempt_number,
        state=mock_state
    )
    
    llm_teacher.llm.invoke.assert_called_once()
    args, kwargs = llm_teacher.llm.invoke.call_args
    prompt_messages = args[0]
    
    # Check prompt content
    system_prompt = prompt_messages[0].content
    assert "Generate a helpful hint" in system_prompt
    assert "Numeric Card" in system_prompt
    assert "What is 2 + 2?" in system_prompt
    assert "Student's Response: 5" in system_prompt
    assert "Attempt Number: 3" in system_prompt
    assert "Mathematics" in system_prompt
    assert "National 3" in system_prompt
    
    assert hint == "LLM Response"

def test_generate_hint_sync_full_error_fallback(llm_teacher, mock_card_numeric, mock_state):
    llm_teacher.llm.invoke.side_effect = Exception("LLM API error")
    
    hint = llm_teacher.generate_hint_sync_full(
        current_card=mock_card_numeric,
        student_response="5",
        attempt_number=1,
        state=mock_state
    )
    
    assert hint == "Try reviewing the explanation and examples above, then attempt the question again."

# --- Test evaluate_response_with_structured_output ---
def test_evaluate_response_with_structured_output(llm_teacher, mock_card_numeric, mock_state):
    student_response = "4"
    expected_answer = 4.0
    attempt_number = 1
    max_attempts = 3
    
    evaluation = llm_teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=expected_answer,
        card_context=mock_card_numeric,
        attempt_number=attempt_number,
        max_attempts=max_attempts,
        state=mock_state
    )
    
    llm_teacher.llm.with_structured_output.return_value.invoke.assert_called_once()
    args, kwargs = llm_teacher.llm.with_structured_output.return_value.invoke.call_args
    prompt_messages = args[0]
    
    # Check prompt content
    system_prompt = prompt_messages[0].content
    assert "Rubric for Evaluation:" in system_prompt
    assert "No specific rubric provided. Evaluate holistically." in system_prompt  # Because mock_card_numeric has no rubric
    assert "Common Misconceptions for This Question:" in system_prompt
    assert "No specific misconceptions documented for this question." in system_prompt  # Because mock_card_numeric has no misconceptions
    assert "Question Type: numeric" in system_prompt
    assert "Question: What is 2 + 2?" in system_prompt
    assert "Expected Answer: 4.0" in system_prompt
    assert "Student Response: 4" in system_prompt
    
    assert isinstance(evaluation, EvaluationResponse)
    assert evaluation.is_correct is True
    assert evaluation.feedback == "Great job!"

