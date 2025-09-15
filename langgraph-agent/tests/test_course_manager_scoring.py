"""
Test Course Manager scoring algorithm following TDD methodology.
Tests for scoring rubric implementation:
+0.40 for overdue outcomes
+0.25 for low mastery outcomes (EMA < 0.6)
+0.15 for early SoW order (scaled by position)
-0.10 for recently taught lessons
-0.05 for lessons exceeding max time constraint
"""

import pytest
from datetime import datetime, timedelta
from agent.course_manager_utils import (
    calculate_priority_score,
    create_lesson_candidates,
    generate_rubric_explanation,
    validate_scheduling_context
)


class TestLowMasteryScoring:
    """Test +0.25 scoring for low mastery outcomes (EMA < 0.6)"""

    def test_single_low_mastery_outcome_adds_quarter_point(self):
        """Single outcome with EMA < 0.6 should add +0.25"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20  # Within time constraint to avoid penalty
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.5  # Low mastery (< 0.6)
            }
        }

        routine = {}
        constraints = {'maxBlockMinutes': 25}  # Explicit constraint
        sow_order = 10  # High order to avoid early bonus

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.25
        assert 'low mastery' in result['reasons']

    def test_multiple_low_mastery_outcomes_still_quarter_point(self):
        """Multiple low mastery outcomes should still only add +0.25 once"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1', 'AOM3.2'],
            'estMinutes': 20  # Within constraint
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.3,  # Low mastery
                'AOM3.2': 0.4   # Low mastery
            }
        }

        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.25
        assert 'low mastery' in result['reasons']

    def test_mixed_mastery_levels_adds_quarter_point(self):
        """Mix of low and high mastery should still add +0.25"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1', 'AOM3.2', 'AOM3.3'],
            'estMinutes': 20  # Within constraint
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.5,  # Low mastery (< 0.6)
                'AOM3.2': 0.8,  # High mastery (>= 0.6)
                'AOM3.3': 0.9   # High mastery (>= 0.6)
            }
        }

        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.25
        assert 'low mastery' in result['reasons']

    def test_all_high_mastery_no_bonus(self):
        """All outcomes with EMA >= 0.6 should not add low mastery bonus"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1', 'AOM3.2'],
            'estMinutes': 20  # Within constraint
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.6,  # Just at threshold
                'AOM3.2': 0.8   # High mastery
            }
        }

        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'low mastery' not in result['reasons']

    def test_missing_mastery_data_no_bonus(self):
        """No mastery data should not add low mastery bonus"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20  # Within constraint
        }

        mastery = {}  # No mastery data
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'low mastery' not in result['reasons']

    def test_outcome_not_in_mastery_data_no_bonus(self):
        """Outcome missing from mastery data should not contribute to bonus"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1', 'AOM3.99'],  # AOM3.99 not in mastery
            'estMinutes': 20  # Within constraint
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.5  # Low mastery, but AOM3.99 missing
            }
        }

        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.25
        assert 'low mastery' in result['reasons']

    def test_very_low_mastery_gets_flag(self):
        """Very low mastery (< 0.3 average) should get special flag"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1', 'AOM3.2'],
            'estMinutes': 20  # Within constraint
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.2,  # Very low
                'AOM3.2': 0.25  # Very low (average = 0.225 < 0.3)
            }
        }

        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.25
        assert 'low mastery' in result['reasons']
        assert 'very-low-mastery' in result.get('flags', [])


class TestScoringCombinations:
    """Test combinations of scoring factors"""

    def test_overdue_and_low_mastery_combination(self):
        """Overdue + low mastery should add +0.65 total"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20  # Within constraint
        }

        # Low mastery
        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.4
            }
        }

        # Overdue
        yesterday = (datetime.now() - timedelta(days=1)).isoformat()
        routine = {
            'dueAtByOutcome': {
                'AOM3.1': yesterday
            }
        }

        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.65  # 0.40 + 0.25
        assert 'overdue' in result['reasons']
        assert 'low mastery' in result['reasons']

    def test_all_positive_factors_combination(self):
        """Test maximum positive score: overdue + low mastery + early order"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 15  # Short lesson gets 'short win' reason
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.3  # Low mastery
            }
        }

        yesterday = (datetime.now() - timedelta(days=1)).isoformat()
        routine = {
            'dueAtByOutcome': {
                'AOM3.1': yesterday  # Overdue
            }
        }

        constraints = {}
        sow_order = 1  # First in SoW gets maximum early bonus (0.15)

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        expected_score = 0.40 + 0.25 + 0.15  # overdue + low mastery + early order
        assert result['priorityScore'] == expected_score
        assert 'overdue' in result['reasons']
        assert 'low mastery' in result['reasons']
        assert 'early order' in result['reasons']
        assert 'short win' in result['reasons']


class TestCandidateRanking:
    """Test complete lesson candidate creation and ranking"""

    def test_candidates_ranked_by_priority_score(self):
        """Candidates should be ranked by priority score descending"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [
                {
                    '$id': 'template-high',
                    'title': 'High Priority Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 30
                },
                {
                    '$id': 'template-low',
                    'title': 'Low Priority Lesson',
                    'outcomeRefs': ['AOM3.2'],
                    'estMinutes': 30
                }
            ],
            'sow': {
                'entries': [
                    {'order': 1, 'lessonTemplateId': 'template-high'},
                    {'order': 2, 'lessonTemplateId': 'template-low'}
                ]
            },
            'mastery': {
                'emaByOutcome': {
                    'AOM3.1': 0.3,  # Low mastery - gets +0.25
                    'AOM3.2': 0.8   # High mastery - gets 0
                }
            },
            'routine': {},
            'constraints': {}
        }

        candidates = create_lesson_candidates(context)

        assert len(candidates) == 2
        assert candidates[0]['lessonTemplateId'] == 'template-high'
        assert candidates[1]['lessonTemplateId'] == 'template-low'
        assert candidates[0]['priorityScore'] > candidates[1]['priorityScore']

    def test_candidates_limited_to_five(self):
        """Should return maximum 5 candidates"""
        templates = []
        sow_entries = []

        for i in range(10):  # Create 10 templates
            templates.append({
                '$id': f'template-{i}',
                'title': f'Lesson {i}',
                'outcomeRefs': [f'outcome-{i}'],
                'estMinutes': 30
            })
            sow_entries.append({
                'order': i + 1,
                'lessonTemplateId': f'template-{i}'
            })

        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': templates,
            'sow': {'entries': sow_entries},
            'mastery': {},
            'routine': {},
            'constraints': {}
        }

        candidates = create_lesson_candidates(context)

        assert len(candidates) <= 5


class TestValidationAndErrorHandling:
    """Test scheduling context validation"""

    def test_validate_complete_context_passes(self):
        """Complete valid context should pass validation"""
        context = {
            'student': {
                'id': 'student-123'
            },
            'course': {
                '$id': 'course-123',
                'courseId': 'C844 73',
                'subject': 'Mathematics'
            },
            'templates': [
                {
                    '$id': 'template-123',
                    'title': 'Test Lesson',
                    'outcomeRefs': ['AOM3.1']
                }
            ]
        }

        is_valid, error_msg = validate_scheduling_context(context)

        assert is_valid is True
        assert error_msg == ""

    def test_validate_missing_student_fails(self):
        """Missing student should fail validation"""
        context = {
            'course': {
                '$id': 'course-123',
                'courseId': 'C844 73',
                'subject': 'Mathematics'
            },
            'templates': []
        }

        is_valid, error_msg = validate_scheduling_context(context)

        assert is_valid is False
        assert 'Missing required field: student' in error_msg

    def test_validate_empty_templates_fails(self):
        """Empty templates should fail validation"""
        context = {
            'student': {'id': 'student-123'},
            'course': {
                '$id': 'course-123',
                'courseId': 'C844 73',
                'subject': 'Mathematics'
            },
            'templates': []
        }

        is_valid, error_msg = validate_scheduling_context(context)

        assert is_valid is False
        assert 'No lesson templates provided' in error_msg


class TestRubricExplanation:
    """Test rubric explanation generation"""

    def test_rubric_explanation_format(self):
        """Rubric should return compact explanation"""
        rubric = generate_rubric_explanation()

        assert isinstance(rubric, str)
        assert 'Overdue' in rubric
        assert 'LowEMA' in rubric
        assert 'Order' in rubric
        assert 'Recent' in rubric
        assert 'TooLong' in rubric