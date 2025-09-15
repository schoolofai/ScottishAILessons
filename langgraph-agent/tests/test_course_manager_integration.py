"""
Test Course Manager integration with main LangGraph system.
These tests verify the Course Manager works with the complete graph.
"""

import pytest
import json
from datetime import datetime, timedelta
from agent.course_manager_graph import (
    course_manager_node,
    create_course_manager_graph,
    create_simple_course_manager_graph
)


class MockUnifiedState(dict):
    """Mock UnifiedState for testing - inherits from dict to support LangGraph operations"""

    def __init__(self, data: dict):
        super().__init__(data)
        self._data = data

    def get(self, key, default=None):
        return super().get(key, default)

    def __getitem__(self, key):
        return super().__getitem__(key)

    def __contains__(self, key):
        return super().__contains__(key)

    def __setitem__(self, key, value):
        super().__setitem__(key, value)

    def update(self, other):
        super().update(other)


class TestCourseManagerNode:
    """Test the course_manager_node function"""

    def test_course_manager_node_with_valid_context(self):
        """Course manager node should process valid scheduling context"""
        # Create valid scheduling context
        state = MockUnifiedState({
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [{
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                }],
                'sow': {
                    'entries': [
                        {'order': 1, 'lessonTemplateId': 'template-123'}
                    ]
                },
                'mastery': {
                    'emaByOutcome': {
                        'AOM3.1': 0.4  # Low mastery for scoring
                    }
                },
                'routine': {},
                'constraints': {'maxBlockMinutes': 25}
            },
            'messages': []
        })

        result = course_manager_node(state)

        # Should return updated state with message and recommendation
        assert isinstance(result, dict)
        assert 'messages' in result
        assert 'course_recommendation' in result

        # Check the message
        messages = result['messages']
        assert len(messages) == 1
        message = messages[0]
        assert 'Generated' in message.content
        assert 'lesson recommendations' in message.content

        # Check the recommendation
        recommendation = result['course_recommendation']
        assert recommendation['courseId'] == 'C844 73'
        assert 'generatedAt' in recommendation
        assert 'graphRunId' in recommendation
        assert 'candidates' in recommendation
        assert 'rubric' in recommendation

        # Should have at least one candidate
        assert len(recommendation['candidates']) >= 1
        candidate = recommendation['candidates'][0]
        assert candidate['lessonTemplateId'] == 'template-123'
        assert candidate['title'] == 'Test Lesson'
        assert candidate['priorityScore'] > 0  # Should have low mastery bonus

    def test_course_manager_node_missing_context(self):
        """Course manager node should handle missing session context"""
        state = MockUnifiedState({'messages': []})

        result = course_manager_node(state)

        # Should return error state
        assert isinstance(result, dict)
        assert 'error' in result
        assert 'No session context provided' in result['error']

        # Should have error message
        messages = result['messages']
        assert len(messages) == 1
        message = messages[0]
        assert 'Course Manager failed' in message.content

    def test_course_manager_node_invalid_context(self):
        """Course manager node should handle invalid scheduling context"""
        state = MockUnifiedState({
            'session_context': {
                # Missing required fields
                'student': {'id': 'student-123'}
                # Missing course, templates, etc.
            },
            'messages': []
        })

        result = course_manager_node(state)

        # Should return error state
        assert isinstance(result, dict)
        assert 'error' in result

        # Should have error message
        messages = result['messages']
        assert len(messages) == 1
        message = messages[0]
        assert 'Course Manager failed' in message.content

    def test_course_manager_node_preserves_existing_messages(self):
        """Course manager node should preserve existing messages in state"""
        from langchain_core.messages import HumanMessage

        existing_message = HumanMessage(content="Hello")

        state = MockUnifiedState({
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [{
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                }],
                'sow': {'entries': []},
                'mastery': {},
                'routine': {},
                'constraints': {}
            },
            'messages': [existing_message]
        })

        result = course_manager_node(state)

        # Should preserve existing message and add new one
        messages = result['messages']
        assert len(messages) == 2
        assert messages[0] == existing_message
        assert 'Generated' in messages[1].content

    def test_course_manager_node_generates_unique_run_id(self):
        """Each call should generate a unique graph run ID"""
        state = MockUnifiedState({
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [{
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                }],
                'sow': {'entries': []},
                'mastery': {},
                'routine': {},
                'constraints': {}
            },
            'messages': []
        })

        result1 = course_manager_node(state)
        result2 = course_manager_node(state)

        # Should have different graph run IDs
        run_id1 = result1['course_recommendation']['graphRunId']
        run_id2 = result2['course_recommendation']['graphRunId']

        assert run_id1 != run_id2
        assert len(run_id1) > 0
        assert len(run_id2) > 0

    def test_course_manager_node_message_additional_kwargs(self):
        """Course manager node should include recommendation in message additional_kwargs"""
        state = MockUnifiedState({
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [{
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                }],
                'sow': {'entries': []},
                'mastery': {},
                'routine': {},
                'constraints': {}
            },
            'messages': []
        })

        result = course_manager_node(state)

        # Check message has recommendation in additional_kwargs
        message = result['messages'][0]
        assert hasattr(message, 'additional_kwargs')
        assert 'recommendation' in message.additional_kwargs

        # Should match the state recommendation
        message_rec = message.additional_kwargs['recommendation']
        state_rec = result['course_recommendation']
        assert message_rec == state_rec


class TestCourseManagerGraphCreation:
    """Test Course Manager graph compilation"""

    def test_create_course_manager_graph(self):
        """Should create compilable course manager graph"""
        graph = create_course_manager_graph()

        # Should be callable (compiled)
        assert hasattr(graph, 'invoke')
        assert hasattr(graph, 'stream')

    def test_create_simple_course_manager_graph(self):
        """Should create simple compilable course manager graph"""
        graph = create_simple_course_manager_graph()

        # Should be callable (compiled)
        assert hasattr(graph, 'invoke')
        assert hasattr(graph, 'stream')

    def test_course_manager_graph_execution(self):
        """Course manager graph should execute successfully"""
        graph = create_simple_course_manager_graph()

        # Input state
        input_state = {
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [{
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                }],
                'sow': {'entries': [{'order': 1, 'lessonTemplateId': 'template-123'}]},
                'mastery': {'emaByOutcome': {'AOM3.1': 0.3}},
                'routine': {},
                'constraints': {'maxBlockMinutes': 25}
            },
            'messages': []
        }

        # Execute graph
        result = graph.invoke(input_state)

        # Should complete successfully
        assert isinstance(result, dict)
        assert 'course_recommendation' in result
        assert 'messages' in result
        assert len(result['messages']) > 0

    def test_validation_graph_execution(self):
        """Full course manager graph with validation should execute"""
        graph = create_course_manager_graph()

        input_state = {
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [{
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                }],
                'sow': {'entries': []},
                'mastery': {},
                'routine': {},
                'constraints': {}
            },
            'messages': []
        }

        # Execute graph with validation
        result = graph.invoke(input_state)

        # Should complete successfully with validation results
        assert isinstance(result, dict)
        assert 'course_recommendation' in result
        assert 'validation_results' in result


class TestCourseManagerIntegrationScenarios:
    """Test realistic integration scenarios"""

    def test_multiple_courses_scenario(self):
        """Test course manager with multiple course data"""
        graph = create_simple_course_manager_graph()

        # Complex scenario with multiple templates
        input_state = {
            'session_context': {
                'student': {'id': 'student-123', 'displayName': 'Test Student'},
                'course': {
                    '$id': 'course-math-123',
                    'courseId': 'C844 73',
                    'subject': 'Applications of Mathematics',
                    'level': 'National 3'
                },
                'templates': [
                    {
                        '$id': 'template-fractions',
                        'title': 'Fractions ↔ Decimals ↔ Percents',
                        'outcomeRefs': ['AOM3.1', 'AOM3.2'],
                        'estMinutes': 45
                    },
                    {
                        '$id': 'template-area',
                        'title': 'Area and Perimeter',
                        'outcomeRefs': ['AOM3.3'],
                        'estMinutes': 30
                    },
                    {
                        '$id': 'template-statistics',
                        'title': 'Basic Statistics',
                        'outcomeRefs': ['AOM3.4'],
                        'estMinutes': 25
                    }
                ],
                'sow': {
                    'entries': [
                        {'order': 1, 'lessonTemplateId': 'template-fractions'},
                        {'order': 2, 'lessonTemplateId': 'template-area'},
                        {'order': 5, 'lessonTemplateId': 'template-statistics'}
                    ]
                },
                'mastery': {
                    'emaByOutcome': {
                        'AOM3.1': 0.3,  # Low mastery
                        'AOM3.2': 0.4,  # Low mastery
                        'AOM3.3': 0.8,  # Good mastery
                        'AOM3.4': 0.6   # Acceptable mastery
                    }
                },
                'routine': {
                    'dueAtByOutcome': {
                        'AOM3.1': (datetime.now() - timedelta(days=1)).isoformat(),  # Overdue
                        'AOM3.3': (datetime.now() + timedelta(days=7)).isoformat()   # Future
                    },
                    'recentTemplateIds': []  # Nothing taught recently
                },
                'constraints': {
                    'maxBlockMinutes': 25,
                    'preferOverdue': True,
                    'preferLowEMA': True
                }
            },
            'messages': []
        }

        result = graph.invoke(input_state)

        # Should prioritize correctly
        recommendation = result['course_recommendation']
        candidates = recommendation['candidates']

        assert len(candidates) >= 2

        # First candidate should be fractions (overdue + low mastery + early order)
        top_candidate = candidates[0]
        assert top_candidate['lessonTemplateId'] == 'template-fractions'
        assert top_candidate['priorityScore'] > 0.5  # High score due to multiple factors

        # Should have explanation
        assert 'overdue' in top_candidate['reasons']
        assert 'low mastery' in top_candidate['reasons']
        assert 'early order' in top_candidate['reasons']

    def test_error_recovery_scenario(self):
        """Test course manager handles various error conditions"""
        graph = create_simple_course_manager_graph()

        # Test with missing templates
        input_state = {
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': [],  # No templates
                'sow': {'entries': []},
                'mastery': {},
                'routine': {},
                'constraints': {}
            },
            'messages': []
        }

        result = graph.invoke(input_state)

        # Should handle error gracefully
        assert isinstance(result, dict)
        assert 'error' in result

        # Should have error message
        messages = result['messages']
        assert len(messages) == 1
        assert 'failed' in messages[0].content.lower()

    def test_performance_with_large_dataset(self):
        """Test course manager performance with many templates"""
        graph = create_simple_course_manager_graph()

        # Create many templates
        templates = []
        sow_entries = []
        mastery_data = {}

        for i in range(50):  # 50 templates
            template_id = f'template-{i:03d}'
            outcome_id = f'outcome-{i:03d}'

            templates.append({
                '$id': template_id,
                'title': f'Lesson {i}',
                'outcomeRefs': [outcome_id],
                'estMinutes': 20 + (i % 20)  # Vary duration
            })

            sow_entries.append({
                'order': i + 1,
                'lessonTemplateId': template_id
            })

            mastery_data[outcome_id] = 0.3 + (i % 5) * 0.1  # Vary mastery

        input_state = {
            'session_context': {
                'student': {'id': 'student-123'},
                'course': {'$id': 'course-123', 'courseId': 'C844 73', 'subject': 'Mathematics'},
                'templates': templates,
                'sow': {'entries': sow_entries},
                'mastery': {'emaByOutcome': mastery_data},
                'routine': {},
                'constraints': {'maxBlockMinutes': 25}
            },
            'messages': []
        }

        # Should complete in reasonable time
        import time
        start_time = time.time()
        result = graph.invoke(input_state)
        execution_time = time.time() - start_time

        # Should complete within 1 second
        assert execution_time < 1.0

        # Should return top 5 candidates
        recommendation = result['course_recommendation']
        candidates = recommendation['candidates']
        assert len(candidates) == 5

        # Candidates should be properly ranked
        for i in range(1, len(candidates)):
            assert candidates[i-1]['priorityScore'] >= candidates[i]['priorityScore']