"""
Integration Tests for Lead Teacher Flow

These tests verify the complete flow through the main graph:
entry → router → lead_teacher → course_manager/teaching_loop

Following TDD approach - these tests should initially fail and guide
the final integration of the Lead Teacher into the main graph workflow.
"""

import pytest
from datetime import datetime, timezone
from langchain_core.messages import HumanMessage, AIMessage

try:
    from src.agent.interrupt_state import InterruptUnifiedState
    from src.agent.graph_interrupt import graph_interrupt
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState
    from agent.graph_interrupt import graph_interrupt


class TestLeadTeacherMainGraphIntegration:
    """Test Lead Teacher integration with the main graph workflow."""

    @pytest.mark.asyncio
    async def test_complete_recommendation_flow_through_main_graph(self):
        """Test complete flow: HumanMessage → recommendations → display → selection → teaching."""
        # ARRANGE - User request for recommendations
        initial_state = {
            "messages": [HumanMessage(content="I need math recommendations")],
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {
                        "$id": "lt_nat3_aom_best_deal_v1",
                        "title": "Best Deal: Unit Price & Simple Discounts",
                        "status": "published",
                        "outcomeRefs": ["HV7Y73_O1.4", "H22573_O1.2"]
                    }
                ],
                "constraints": {"maxBlockMinutes": 25}
            },
            "thread_id": "integration_test_001"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(initial_state)

        # ASSERT - Should complete recommendation flow
        assert "course_recommendation" in result
        assert result["orchestration_phase"] == "recommendations_ready"
        assert result["mode"] == "awaiting_selection"
        assert result["thread_id"] == "integration_test_001"
        assert len(result["messages"]) >= 1

    @pytest.mark.asyncio
    async def test_teaching_flow_through_main_graph(self):
        """Test teaching flow: lesson selection → Lead Teacher → Teaching Loop."""
        # ARRANGE - State with lesson selection
        teaching_state = {
            "messages": [HumanMessage(content="Start my lesson")],
            "session_context": {
                "lesson_selection": {
                    "lessonTemplateId": "lt_nat3_aom_best_deal_v1",
                    "sessionId": "sess_integration_001"
                }
            },
            "mode": "teaching",
            "thread_id": "integration_test_002"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(teaching_state)

        # ASSERT - Should route to teaching through Lead Teacher
        assert result["routing_decision"] == "teaching"
        assert result["next_action"] == "start_lesson"
        assert result["teaching_status"] == "started"
        assert result["thread_id"] == "integration_test_002"

    @pytest.mark.asyncio
    async def test_mvp0_compatibility_through_main_graph(self):
        """Test MVP0 direct teaching still works through Lead Teacher."""
        # ARRANGE - MVP0 teaching state
        mvp0_state = {
            "messages": [HumanMessage(content="Continue lesson")],
            "session_context": {
                "session_id": "sess_mvp0_001",
                "bypass_course_manager": True
            },
            "mode": "teaching",
            "lesson_snapshot": {
                "title": "Test Lesson",
                "cards": [{"id": "q1", "type": "mcq"}]
            },
            "thread_id": "integration_test_mvp0"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(mvp0_state)

        # ASSERT - Should handle MVP0 mode correctly
        assert result["compatibility_mode"] == "mvp0"
        assert result["routing_decision"] == "direct_teaching"
        assert result["mode"] == "teaching"
        assert result["thread_id"] == "integration_test_mvp0"

    @pytest.mark.asyncio
    async def test_chat_flow_through_main_graph(self):
        """Test simple chat flow bypasses Lead Teacher."""
        # ARRANGE - Simple chat state
        chat_state = {
            "messages": [HumanMessage(content="Hello, how are you?")],
            "mode": "chat"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(chat_state)

        # ASSERT - Should process as chat
        assert len(result["messages"]) >= 2  # Original + response
        assert isinstance(result["messages"][-1], AIMessage)
        assert "Hello" in result["messages"][-1].content or "help" in result["messages"][-1].content.lower()

    @pytest.mark.asyncio
    async def test_error_handling_through_main_graph(self):
        """Test error handling propagates correctly through main graph."""
        # ARRANGE - State that will cause Course Manager to fail
        error_state = {
            "messages": [HumanMessage(content="Get recommendations")],
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [],  # Empty templates should cause validation error
                "constraints": {"maxBlockMinutes": 25}
            },
            "mode": "planning"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(error_state)

        # ASSERT - Should handle errors gracefully
        assert "error" in result
        assert result["error_source"] == "course_manager"
        assert result["routing_decision"] == "error"


class TestLeadTeacherStateFlowIntegration:
    """Test state persistence and flow through complete main graph execution."""

    @pytest.mark.asyncio
    async def test_state_persistence_through_complete_flow(self):
        """Test that state is properly preserved through entry → router → lead_teacher → subgraph."""
        # ARRANGE - Complex state with custom fields
        complex_state = {
            "messages": [HumanMessage(content="I need lesson recommendations")],
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {
                        "$id": "lt_1",
                        "title": "Test Lesson",
                        "status": "published",
                        "outcomeRefs": ["O1"]
                    }
                ],
                "constraints": {"maxBlockMinutes": 25}
            },
            "thread_id": "state_test_001",
            "custom_field": "preserve_me",
            "user_preferences": {"theme": "dark", "language": "en"},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # ACT - Run through complete main graph
        result = await graph_interrupt.ainvoke(complex_state)

        # ASSERT - All custom state should be preserved
        assert result["thread_id"] == "state_test_001"
        assert result["custom_field"] == "preserve_me"
        assert result["user_preferences"]["theme"] == "dark"
        assert result["timestamp"] == complex_state["timestamp"]
        assert "session_context" in result
        assert result["session_context"]["course"]["courseId"] == "course_c84473"

    @pytest.mark.asyncio
    async def test_message_history_preservation_through_flow(self):
        """Test that message history is preserved and enhanced through main graph flow."""
        # ARRANGE - State with message history
        message_history = [
            HumanMessage(content="Hi"),
            AIMessage(content="Hello! How can I help?"),
            HumanMessage(content="I need math help"),
            AIMessage(content="I can help with math. Let me get recommendations.")
        ]

        state_with_history = {
            "messages": message_history,
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {
                        "$id": "lt_1",
                        "title": "Test Lesson",
                        "status": "published",
                        "outcomeRefs": ["O1"]
                    }
                ],
                "constraints": {"maxBlockMinutes": 25}
            },
            "mode": "planning"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(state_with_history)

        # ASSERT - Message history should be preserved
        result_messages = result.get("messages", [])
        assert len(result_messages) >= len(message_history)

        # Original messages should still be present
        for i, original_msg in enumerate(message_history):
            if i < len(result_messages):
                assert result_messages[i].content == original_msg.content

    @pytest.mark.asyncio
    async def test_interrupt_state_handling_through_main_graph(self):
        """Test that interrupt-related state is properly handled through main graph."""
        # ARRANGE - State with interrupt fields
        interrupt_state = {
            "messages": [HumanMessage(content="Show me recommendations")],
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {
                        "$id": "lt_1",
                        "title": "Test Lesson",
                        "status": "published",
                        "outcomeRefs": ["O1"]
                    }
                ],
                "constraints": {"maxBlockMinutes": 25}
            },
            "interrupt_count": 0,
            "interrupt_history": [],
            "card_presentation_complete": False,
            "tool_response_received": False,
            "cards_presented_via_ui": [],
            "feedback_interactions_count": 0,
            "can_resume_from_interrupt": True
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(interrupt_state)

        # ASSERT - Interrupt state should be preserved and potentially updated
        assert "interrupt_count" in result
        assert "interrupt_history" in result
        assert "card_presentation_complete" in result
        assert "tool_response_received" in result
        assert result["can_resume_from_interrupt"] is True


class TestLeadTeacherGraphStructureIntegration:
    """Test graph structure and edge traversal with Lead Teacher integration."""

    @pytest.mark.asyncio
    async def test_entry_to_router_to_lead_teacher_flow(self):
        """Test specific path: entry → router → lead_teacher."""
        # ARRANGE - Planning mode state
        planning_state = {
            "messages": [HumanMessage(content="Plan my lesson")],
            "session_context": {
                "request_type": "get_recommendations",
                "course": {
                    "$id": "course_c84473",
                    "courseId": "course_c84473",
                    "subject": "Applications of Mathematics",
                    "level": "Nat3"
                },
                "student": {"id": "stu_123"},
                "templates": [
                    {
                        "$id": "lt_1",
                        "title": "Test Lesson",
                        "status": "published",
                        "outcomeRefs": ["O1"]
                    }
                ],
                "constraints": {"maxBlockMinutes": 25}
            }
        }

        # ACT - Run through main graph and capture flow
        result = await graph_interrupt.ainvoke(planning_state)

        # ASSERT - Should have gone through Lead Teacher
        assert result["routing_decision"] in ["course_manager", "teaching", "interrupt"]
        assert "orchestration_phase" in result
        # Mode should be set by entry, then modified by Lead Teacher
        assert result["mode"] in ["awaiting_selection", "teaching", "planning"]

    @pytest.mark.asyncio
    async def test_lead_teacher_to_teaching_subgraph_flow(self):
        """Test path: lead_teacher → teaching subgraph."""
        # ARRANGE - State that should route to teaching
        teaching_state = {
            "messages": [HumanMessage(content="Start teaching")],
            "session_context": {
                "lesson_selection": {
                    "lessonTemplateId": "lt_test",
                    "sessionId": "sess_test"
                }
            },
            "mode": "teaching"
        }

        # ACT - Run through main graph
        result = await graph_interrupt.ainvoke(teaching_state)

        # ASSERT - Should route through Lead Teacher to teaching
        assert result["routing_decision"] == "teaching"
        assert result["next_action"] == "start_lesson"
        assert "orchestration_phase" in result

    @pytest.mark.asyncio
    async def test_graph_performance_with_lead_teacher(self):
        """Test that Lead Teacher integration doesn't significantly impact performance."""
        import time

        # ARRANGE - Simple state for performance test
        simple_state = {
            "messages": [HumanMessage(content="Test performance")],
            "mode": "chat"
        }

        # ACT - Measure execution time
        start_time = time.time()
        result = await graph_interrupt.ainvoke(simple_state)
        execution_time = time.time() - start_time

        # ASSERT - Should complete quickly (under 1 second for simple chat)
        assert execution_time < 1.0
        assert len(result["messages"]) >= 2


# Test fixtures for realistic integration data
@pytest.fixture
def realistic_course_context():
    """Realistic course context for integration testing."""
    return {
        "course": {
            "$id": "course_c84473",
            "courseId": "course_c84473",
            "subject": "Applications of Mathematics",
            "level": "Nat3",
            "description": "National 3 Applications of Mathematics"
        },
        "student": {
            "id": "stu_integration_test",
            "displayName": "Integration Test Student",
            "level": "Nat3"
        },
        "templates": [
            {
                "$id": "lt_nat3_num_frac_dec_pct_v1",
                "title": "Fractions ↔ Decimals ↔ Percents",
                "outcomeRefs": ["H22573_O1.2", "H22573_O1.5"],
                "estMinutes": 20,
                "status": "published"
            },
            {
                "$id": "lt_nat3_aom_best_deal_v1",
                "title": "Best Deal: Unit Price & Simple Discounts",
                "outcomeRefs": ["HV7Y73_O1.4", "H22573_O1.2"],
                "estMinutes": 25,
                "status": "published"
            }
        ],
        "constraints": {
            "maxBlockMinutes": 25,
            "preferOverdue": True,
            "preferLowEMA": True
        }
    }


@pytest.fixture
def realistic_lesson_context():
    """Realistic lesson context for integration testing."""
    return {
        "session_id": "sess_integration_test_001",
        "lesson_snapshot": {
            "title": "Best Deal: Unit Price & Simple Discounts",
            "outcomeRefs": ["HV7Y73_O1.4", "H22573_O1.2"],
            "cards": [
                {
                    "id": "intro_card",
                    "type": "info",
                    "content": "Welcome to the lesson on finding the best deal!"
                },
                {
                    "id": "q1",
                    "type": "mcq",
                    "question": "Which is the better deal?",
                    "options": ["Option A", "Option B", "Option C"],
                    "correct": 1
                }
            ],
            "templateVersion": 1
        },
        "student_progress": {
            "completed_cards": [],
            "current_card_index": 0,
            "lesson_started_at": datetime.now(timezone.utc).isoformat()
        }
    }


if __name__ == "__main__":
    # Run specific integration tests
    pytest.main([__file__, "-v", "--tb=short"])