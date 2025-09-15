import pytest
import sys
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime, timedelta

# Add src to Python path for correct imports
src_path = Path(__file__).parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
def sample_student():
    return {
        "id": "test-student-123",
        "displayName": "Test Student",
        "accommodations": []
    }


@pytest.fixture
def sample_courses():
    return [
        {
            "$id": "course-math-123",
            "courseId": "C844 73",
            "subject": "Applications of Mathematics",
            "level": "National 3"
        },
        {
            "$id": "course-physics-456",
            "courseId": "C845 73",
            "subject": "Physics",
            "level": "National 3"
        }
    ]


@pytest.fixture
def sample_lesson_templates():
    return [
        {
            "$id": "template-fractions-123",
            "title": "Fractions ↔ Decimals ↔ Percents",
            "outcomeRefs": ["AOM3.1", "AOM3.2"],
            "estMinutes": 45,
            "status": "published"
        },
        {
            "$id": "template-area-456",
            "title": "Area and Perimeter",
            "outcomeRefs": ["AOM3.3"],
            "estMinutes": 30,
            "status": "published"
        }
    ]


@pytest.fixture
def sample_mastery_low():
    """Mastery data with low EMA scores (< 0.6)"""
    return {
        "emaByOutcome": {
            "AOM3.1": 0.3,  # Low mastery
            "AOM3.2": 0.5,  # Low mastery
            "AOM3.3": 0.8   # Good mastery
        }
    }


@pytest.fixture
def sample_routine_overdue():
    """Routine data with overdue outcomes"""
    yesterday = (datetime.now() - timedelta(days=1)).isoformat()
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()

    return {
        "dueAtByOutcome": {
            "AOM3.1": yesterday,  # Overdue
            "AOM3.2": yesterday,  # Overdue
            "AOM3.3": tomorrow    # Not due yet
        },
        "lastTaughtAt": (datetime.now() - timedelta(days=3)).isoformat(),
        "recentTemplateIds": []
    }


@pytest.fixture
def sample_scheduling_context(sample_student, sample_courses, sample_lesson_templates,
                               sample_mastery_low, sample_routine_overdue):
    """Complete scheduling context for testing"""
    return {
        "student": sample_student,
        "course": sample_courses[0],  # Mathematics course
        "sow": {
            "entries": [
                {"order": 1, "lessonTemplateId": "template-fractions-123"},
                {"order": 2, "lessonTemplateId": "template-area-456"}
            ]
        },
        "templates": sample_lesson_templates,
        "mastery": sample_mastery_low,
        "routine": sample_routine_overdue,
        "constraints": {
            "maxBlockMinutes": 25,
            "avoidRepeatWithinDays": 3,
            "preferOverdue": True,
            "preferLowEMA": True
        }
    }


# LangGraph Integration Testing Fixtures

@pytest.fixture
def mock_llm_teacher(mocker):
    """Mock LLMTeacher for deterministic responses"""
    from langchain_core.messages import AIMessage

    mock_teacher = mocker.patch('agent.teacher_graph_toolcall_interrupt.LLMTeacher')
    mock_instance = mock_teacher.return_value
    mock_instance.generate_lesson_card_content.return_value = AIMessage(
        content="Hello! I'm here to help.",
        id="test-msg-1"
    )
    mock_instance.assess_student_answer.return_value = {
        "is_correct": True,
        "feedback": "Great job!",
        "score": 1.0
    }
    return mock_instance


@pytest.fixture
def mock_teaching_llm_with_tool_calls(mocker):
    """Mock LLMTeacher that returns tool calls for teaching scenarios"""
    from langchain_core.messages import AIMessage, ToolCall

    mock_teacher = mocker.patch('agent.teacher_graph_toolcall_interrupt.LLMTeacher')
    mock_instance = mock_teacher.return_value
    mock_instance.generate_lesson_card_content.return_value = AIMessage(
        content="",
        tool_calls=[ToolCall(
            id="lesson-123",
            name="lesson_card_presentation",
            args={
                "card_content": "Test lesson content",
                "card_data": {
                    "title": "Introduction to Algebra",
                    "explainer": "Today we'll learn about variables..."
                }
            }
        )],
        id="test-msg-tool-1"
    )
    mock_instance.assess_student_answer.return_value = {
        "is_correct": True,
        "feedback": "Excellent work!",
        "score": 1.0
    }
    return mock_instance


@pytest.fixture
def test_graph_with_memory():
    """Create interrupt-enabled graph with in-memory checkpointer"""
    from langgraph.checkpoint.memory import InMemorySaver
    from agent.graph_interrupt import main_graph_interrupt

    # Compile with checkpointer
    memory = InMemorySaver()
    return main_graph_interrupt.compile(checkpointer=memory)


@pytest.fixture
def sample_session_context():
    """Sample session context for teaching mode"""
    return {
        "session_id": "test-session-123",
        "student_id": "test-student-456",
        "lesson_snapshot": {
            "title": "Test Lesson",
            "currentStage": "introduction",
            "lessonPlan": {
                "title": "Introduction to Algebra",
                "objectives": ["Understand variables", "Solve simple equations"]
            },
            "cards": [
                {
                    "id": "card_1",
                    "title": "Variables",
                    "explainer": "A variable is a letter that represents an unknown number.",
                    "cfu": {
                        "id": "cfu_1",
                        "type": "text",
                        "question": "What is x if x + 3 = 7?",
                        "expected": "4"
                    }
                }
            ]
        }
    }


@pytest.fixture
def expected_lesson_tool_call():
    """Expected tool call structure for lesson card presentation"""
    return {
        "name": "lesson_card_presentation",
        "args": {
            "card_content": "Test lesson content",
            "card_data": {
                "title": "Variables",
                "explainer": "A variable is a letter that represents an unknown number."
            }
        }
    }


@pytest.fixture
def debug_state_helper():
    """Helper function for debugging graph state during tests"""
    def debug_graph_state(state):
        print(f"Messages: {len(state.get('messages', []))}")
        print(f"Mode: {state.get('mode')}")
        print(f"Interrupt count: {state.get('interrupt_count')}")
        print(f"Tool calls: {[msg.tool_calls for msg in state.get('messages', []) if hasattr(msg, 'tool_calls')]}")
    return debug_graph_state
