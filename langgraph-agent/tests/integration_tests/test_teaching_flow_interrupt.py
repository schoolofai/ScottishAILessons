import pytest
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command
from agent.interrupt_state import InterruptUnifiedState
from agent.graph_interrupt import entry_node_interrupt, router_node_interrupt, route_by_mode_interrupt
from agent.teacher_graph_toolcall_interrupt import (
    design_node, get_answer_node, mark_node, retry_node, get_answer_retry_node, progress_node,
    should_continue_from_design, should_continue_from_mark, should_continue_from_retry
)
from agent.llm_teacher import EvaluationResponse  # Import for type checking

# --- Mock Data for Integration Tests ---
@pytest.fixture
def mock_lesson_snapshot_full_features():
    return {
        "title": "Advanced Fractions & Decimals",
        "courseId": "C844_73",
        "lesson_type": "teach",
        "estMinutes": 60,
        "engagement_tags": ["real_world_context", "scaffolding", "visual_aids"],
        "policy": {"calculator_allowed": True, "assessment_notes": "Mixed question types"},
        "outcomeRefs": [
            {"unit": "MNU 3-07a", "outcome": "I can add and subtract fractions", "label": "Fractions Add/Sub"},
            {"unit": "MNU 3-07b", "outcome": "I can convert fractions to decimals", "label": "Fractions to Decimals"}
        ],
        "cards": [
            {
                "id": "card_001",
                "title": "Starter: Equivalent Fractions",
                "explainer": "Let's start with equivalent fractions. Remember, these are fractions that look different but have the same value.",
                "explainer_plain": "Equivalent fractions look different but are the same. For example, 1/2 is the same as 2/4.",
                "cfu": {
                    "type": "mcq",
                    "id": "q001",
                    "stem": "Which fraction is equivalent to 1/2?",
                    "options": ["1/4", "2/4", "3/4", "1/3"],
                    "answerIndex": 1,
                    "rubric": {"total_points": 1, "criteria": [{"description": "Correctly identifies equivalent fraction", "points": 1}]},
                    "hints": ["Think about multiplying top and bottom by the same number.", "If you double the top, what must you do to the bottom?"]
                },
                "misconceptions": [
                    {"id": "MISC_MATH_FRAC_001", "misconception": "Only numerator changes", "clarification": "Both numerator and denominator must change by the same factor."}
                ],
                "context_hooks": ["sharing a cake"]
            },
            {
                "id": "card_002",
                "title": "Modelling: Adding Fractions",
                "explainer": "Now let's add fractions with different denominators. The key is to find a common denominator first.",
                "explainer_plain": "To add fractions, make the bottom numbers the same. Then add the top numbers.",
                "cfu": {
                    "type": "numeric",
                    "id": "q002",
                    "stem": "What is 1/4 + 1/2? (Give your answer as a decimal to 2 decimal places)",
                    "expected": 0.75,
                    "tolerance": 0.01,
                    "money2dp": False,
                    "rubric": {
                        "total_points": 3,
                        "criteria": [
                            {"description": "Finds common denominator (4)", "points": 1},
                            {"description": "Correctly converts 1/2 to 2/4", "points": 1},
                            {"description": "Adds fractions correctly to get 3/4 or 0.75", "points": 1}
                        ]
                    },
                    "hints": ["Find a common denominator for 4 and 2.", "Convert 1/2 to an equivalent fraction with a denominator of 4.", "Now add the numerators and keep the common denominator."]
                },
                "misconceptions": [
                    {"id": "MISC_MATH_FRAC_002", "misconception": "Add numerators and denominators", "clarification": "Only numerators are added after finding a common denominator."}
                ],
                "context_hooks": ["measuring ingredients"]
            }
        ]
    }

@pytest.fixture
def compiled_teaching_graph():
    # Build the interrupt-enabled main graph
    main_graph_interrupt = StateGraph(InterruptUnifiedState)
    main_graph_interrupt.add_node("entry", entry_node_interrupt)
    main_graph_interrupt.add_node("router", router_node_interrupt)
    main_graph_interrupt.add_node("design", design_node)
    main_graph_interrupt.add_node("get_answer", get_answer_node)
    main_graph_interrupt.add_node("mark", mark_node)
    main_graph_interrupt.add_node("progress", progress_node)
    main_graph_interrupt.add_node("retry", retry_node)
    main_graph_interrupt.add_node("get_answer_retry", get_answer_retry_node)

    main_graph_interrupt.add_edge(START, "entry")
    main_graph_interrupt.add_edge("entry", "router")
    main_graph_interrupt.add_conditional_edges(
        "router",
        route_by_mode_interrupt,
        {
            "chat": END,  # Stub for chat mode
            "teaching": "design",  # Directly route to design for teaching flow
            "course_manager": END  # Stub for course_manager
        }
    )

    # Teaching subgraph edges
    main_graph_interrupt.add_conditional_edges(
        "design",
        should_continue_from_design,
        {
            "get_answer": "get_answer",
            "mark": "mark",
            "progress": "progress",
            END: END
        }
    )
    main_graph_interrupt.add_edge("get_answer", "design")
    main_graph_interrupt.add_conditional_edges(
        "mark",
        should_continue_from_mark,
        {
            "progress": "progress",
            "retry": "retry"
        }
    )
    main_graph_interrupt.add_edge("progress", "design")
    main_graph_interrupt.add_conditional_edges(
        "retry",
        should_continue_from_retry,
        {
            "get_answer_retry": "get_answer_retry",
            "mark": "mark",
            "progress": "progress",
            END: END
        }
    )
    main_graph_interrupt.add_edge("get_answer_retry", "retry")

    # Compile with checkpointer
    checkpointer = SqliteSaver.from_conn_string(":memory:")
    return main_graph_interrupt.compile(checkpointer=checkpointer)

@pytest.fixture
def initial_config():
    return {"configurable": {"thread_id": "test-thread-1"}}

@pytest.fixture
def initial_state(mock_lesson_snapshot_full_features):
    return {
        "messages": [],
        "session_context": {
            "session_id": "test_session_123",
            "student_id": "test_student_456",
            "course_id": "C844_73",
            "lesson_snapshot": mock_lesson_snapshot_full_features,
            "course_subject": "mathematics",
            "course_level": "national-3",
            "sqa_course_code": "C844 73",
            "course_title": "National 3 Mathematics",
            "use_plain_text": False,
            "enriched_outcomes": mock_lesson_snapshot_full_features["outcomeRefs"]
        }
    }

# --- Tests ---

@pytest.mark.asyncio
async def test_full_teaching_flow_correct_answers(compiled_teaching_graph, initial_state, initial_config):
    # Start lesson - should present card_001
    result = await compiled_teaching_graph.ainvoke(initial_state, initial_config)
    assert result.get("__interrupt__")
    assert result["current_card_index"] == 0
    assert result["stage"] == "get_answer"

    # Submit correct answer for card_001 (MCQ)
    # Expected: "2/4" (index 1)
    resume_payload_1 = {"action": "submit_answer", "student_response": "2/4"}
    result = await compiled_teaching_graph.ainvoke(Command(resume=resume_payload_1), initial_config)
    
    # Should have marked correct and progressed to design for card_002
    assert result["stage"] == "get_answer"  # After progress, it goes to design, then get_answer for next card
    assert result["current_card_index"] == 1
    assert result["is_correct"] is True
    assert result["attempts"] == 0  # Reset for next card
    assert any(e["item_id"] == "q001" and e["correct"] is True for e in result["evidence"])

    # Submit correct answer for card_002 (Numeric)
    # Expected: 0.75, tolerance 0.01
    resume_payload_2 = {"action": "submit_answer", "student_response": "0.75"}
    result = await compiled_teaching_graph.ainvoke(Command(resume=resume_payload_2), initial_config)
    
    # Should have marked correct and progressed to lesson completion
    assert result["stage"] == "done"
    assert result["current_card_index"] == 2  # Beyond last card
    assert result["is_correct"] is True
    assert any(e["item_id"] == "q002" and e["correct"] is True for e in result["evidence"])
    assert result["should_exit"] is True
    assert "lesson_summary" in result
    assert "performance_analysis" in result

@pytest.mark.asyncio
async def test_numeric_tolerance_pre_validation(compiled_teaching_graph, initial_state, initial_config):
    # Start lesson - should present card_001
    result = await compiled_teaching_graph.ainvoke(initial_state, initial_config)
    assert result.get("__interrupt__")
    assert result["current_card_index"] == 0

    # Submit correct answer for card_001 (MCQ)
    resume_payload_1 = {"action": "submit_answer", "student_response": "2/4"}
    result = await compiled_teaching_graph.ainvoke(Command(resume=resume_payload_1), initial_config)
    assert result["current_card_index"] == 1
    assert result["is_correct"] is True

    # Submit numeric answer within tolerance for card_002 (e.g., 0.749)
    resume_payload_2 = {"action": "submit_answer", "student_response": "0.749"}
    result = await compiled_teaching_graph.ainvoke(Command(resume=resume_payload_2), initial_config)
    
    # Should be marked correct by pre-validation, skipping LLM
    assert result["stage"] == "done"
    assert result["is_correct"] is True
    assert any(e["item_id"] == "q002" and e["correct"] is True for e in result["evidence"])
    # Check reasoning contains tolerance message
    last_evidence = [e for e in result["evidence"] if e["item_id"] == "q002"][-1]
    assert "tolerance" in last_evidence.get("reasoning", "").lower()

@pytest.mark.asyncio
async def test_backward_compatibility_missing_fields(compiled_teaching_graph, initial_config):
    # Create a lesson snapshot missing optional fields like misconceptions, hints, explainer_plain
    # and policy fields that are now used.
    minimal_lesson_snapshot = {
        "title": "Basic Math",
        "courseId": "C001",
        "lesson_type": "teach",
        "estMinutes": 30,
        "engagement_tags": [],
        "policy": {},  # Empty policy
        "outcomeRefs": [],
        "cards": [
            {
                "id": "card_001",
                "title": "Simple Addition",
                "explainer": "Add these numbers.",
                "cfu": {
                    "type": "numeric",
                    "id": "q001",
                    "stem": "What is 2 + 3?",
                    "expected": 5.0,
                    "rubric": {"total_points": 1, "criteria": [{"description": "Correct sum", "points": 1}]}
                    # Missing tolerance, hints
                },
                # Missing explainer_plain, misconceptions, context_hooks
            }
        ]
    }

    initial_state_minimal = {
        "messages": [],
        "session_context": {
            "session_id": "test_session_minimal",
            "student_id": "test_student_minimal",
            "course_id": "C001",
            "lesson_snapshot": minimal_lesson_snapshot,
            "course_subject": "mathematics",
            "course_level": "basic",
            "use_plain_text": False,
            "enriched_outcomes": []
        }
    }

    # Start lesson - validator should log warnings but proceed
    result = await compiled_teaching_graph.ainvoke(initial_state_minimal, initial_config)
    assert result.get("__interrupt__")
    assert result["current_card_index"] == 0
    assert result["stage"] == "get_answer"
    
    # Check for warnings from validator (requires inspecting logs, not direct state)
    # For now, we assert that the graph did NOT fail due to missing fields.

    # Submit correct answer
    resume_payload = {"action": "submit_answer", "student_response": "5"}
    result = await compiled_teaching_graph.ainvoke(Command(resume=resume_payload), initial_config)
    
    assert result["stage"] == "done"
    assert result["is_correct"] is True
    assert any(e["item_id"] == "q001" and e["correct"] is True for e in result["evidence"])
    assert result["should_exit"] is True

