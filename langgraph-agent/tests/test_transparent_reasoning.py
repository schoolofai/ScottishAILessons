"""
Test transparent reasoning output for Course Manager recommendations.
These tests ensure the AI provides clear explanations for its decisions.
"""

import pytest
from datetime import datetime, timedelta
from agent.course_manager_utils import (
    generate_rubric_explanation,
    generate_recommendation_summary,
    create_lesson_candidates
)


class TestRubricExplanation:
    """Test human-readable rubric explanation"""

    def test_rubric_explanation_contains_all_factors(self):
        """Rubric explanation should mention all scoring factors"""
        rubric = generate_rubric_explanation()

        # Should mention positive factors
        assert 'Overdue' in rubric
        assert 'LowEMA' in rubric or 'mastery' in rubric.lower()
        assert 'Order' in rubric

        # Should mention negative factors (penalties)
        assert 'Recent' in rubric
        assert 'TooLong' in rubric or 'Long' in rubric

    def test_rubric_explanation_is_concise(self):
        """Rubric explanation should be concise (< 100 characters)"""
        rubric = generate_rubric_explanation()

        assert isinstance(rubric, str)
        assert len(rubric) < 100
        assert len(rubric) > 10  # But not too short

    def test_rubric_explanation_shows_priority_order(self):
        """Rubric should indicate priority order with > symbols"""
        rubric = generate_rubric_explanation()

        # Should use > to show priority order
        assert '>' in rubric
        # Should use | to separate positives from negatives
        assert '|' in rubric or '-' in rubric


class TestRecommendationSummary:
    """Test recommendation summary statistics generation"""

    def test_empty_candidates_summary(self):
        """Empty candidates should return zero summary"""
        summary = generate_recommendation_summary([])

        assert summary['total_candidates'] == 0
        assert summary['avg_priority_score'] == 0
        assert summary['top_reasons'] == []
        assert summary['score_distribution'] == {}

    def test_single_candidate_summary(self):
        """Single candidate should return proper summary"""
        candidates = [{
            'lessonTemplateId': 'template-123',
            'title': 'Test Lesson',
            'priorityScore': 0.65,
            'reasons': ['overdue', 'low mastery']
        }]

        summary = generate_recommendation_summary(candidates)

        assert summary['total_candidates'] == 1
        assert summary['avg_priority_score'] == 0.65
        assert 'overdue' in summary['top_reasons']
        assert 'low mastery' in summary['top_reasons']
        assert summary['score_distribution']['high (0.6+)'] == 1
        assert summary['score_range']['min'] == 0.65
        assert summary['score_range']['max'] == 0.65

    def test_multiple_candidates_summary(self):
        """Multiple candidates should return aggregated summary"""
        candidates = [
            {
                'lessonTemplateId': 'template-high',
                'title': 'High Priority',
                'priorityScore': 0.8,
                'reasons': ['overdue', 'low mastery', 'early order']
            },
            {
                'lessonTemplateId': 'template-medium',
                'title': 'Medium Priority',
                'priorityScore': 0.4,
                'reasons': ['low mastery']
            },
            {
                'lessonTemplateId': 'template-low',
                'title': 'Low Priority',
                'priorityScore': 0.1,
                'reasons': ['early order']
            }
        ]

        summary = generate_recommendation_summary(candidates)

        assert summary['total_candidates'] == 3
        assert summary['avg_priority_score'] == 0.43  # (0.8 + 0.4 + 0.1) / 3

        # Most common reason should be first
        assert summary['top_reasons'][0] == 'low mastery'  # appears 2 times

        # Score distribution
        assert summary['score_distribution']['high (0.6+)'] == 1
        assert summary['score_distribution']['medium (0.3-0.6)'] == 1
        assert summary['score_distribution']['low (<0.3)'] == 1

        # Score range
        assert summary['score_range']['min'] == 0.1
        assert summary['score_range']['max'] == 0.8

    def test_top_reasons_limited_to_three(self):
        """Top reasons should be limited to top 3"""
        candidates = [
            {
                'lessonTemplateId': 'template-1',
                'title': 'Lesson 1',
                'priorityScore': 0.5,
                'reasons': ['overdue', 'low mastery', 'early order', 'short win']
            }
        ]

        summary = generate_recommendation_summary(candidates)

        assert len(summary['top_reasons']) <= 3

    def test_reasons_sorted_by_frequency(self):
        """Reasons should be sorted by frequency (most common first)"""
        candidates = [
            {
                'lessonTemplateId': 'template-1',
                'title': 'Lesson 1',
                'priorityScore': 0.5,
                'reasons': ['overdue', 'low mastery']  # both appear once initially
            },
            {
                'lessonTemplateId': 'template-2',
                'title': 'Lesson 2',
                'priorityScore': 0.3,
                'reasons': ['low mastery', 'early order']  # low mastery appears again
            },
            {
                'lessonTemplateId': 'template-3',
                'title': 'Lesson 3',
                'priorityScore': 0.2,
                'reasons': ['low mastery']  # low mastery appears third time
            }
        ]

        summary = generate_recommendation_summary(candidates)

        # 'low mastery' appears 3 times, should be first
        assert summary['top_reasons'][0] == 'low mastery'


class TestTransparentReasoningInCandidates:
    """Test that candidates include clear reasoning"""

    def test_candidates_include_reasons_list(self):
        """Each candidate should include list of reasons"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Overdue Low Mastery Lesson',
                'outcomeRefs': ['AOM3.1'],
                'estMinutes': 15  # Short win
            }],
            'sow': {
                'entries': [
                    {'order': 1, 'lessonTemplateId': 'template-123'}  # Early order
                ]
            },
            'mastery': {
                'emaByOutcome': {
                    'AOM3.1': 0.4  # Low mastery
                }
            },
            'routine': {
                'dueAtByOutcome': {
                    'AOM3.1': (datetime.now() - timedelta(days=1)).isoformat()  # Overdue
                }
            },
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)

        assert len(candidates) == 1
        candidate = candidates[0]

        # Should have multiple reasons
        assert isinstance(candidate['reasons'], list)
        assert len(candidate['reasons']) > 0

        # Should include all applicable reasons
        assert 'overdue' in candidate['reasons']
        assert 'low mastery' in candidate['reasons']
        assert 'early order' in candidate['reasons']
        assert 'short win' in candidate['reasons']

    def test_candidates_include_flags_for_special_cases(self):
        """Candidates should include flags for special cases"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Very Low Mastery Lesson',
                'outcomeRefs': ['AOM3.1', 'AOM3.2'],
                'estMinutes': 40  # Very long
            }],
            'sow': {
                'entries': [
                    {'order': 10, 'lessonTemplateId': 'template-123'}
                ]
            },
            'mastery': {
                'emaByOutcome': {
                    'AOM3.1': 0.2,  # Very low
                    'AOM3.2': 0.25  # Very low (average = 0.225 < 0.3)
                }
            },
            'routine': {
                'recentTemplateIds': ['template-123']  # Recently taught
            },
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)

        assert len(candidates) == 1
        candidate = candidates[0]

        # Should have flags for special cases
        assert isinstance(candidate.get('flags', []), list)
        assert 'very-low-mastery' in candidate['flags']
        assert 'recently-taught' in candidate['flags']
        assert 'very-long' in candidate['flags']

    def test_reasoning_explains_score_components(self):
        """Reasoning should explain each component of the score"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Complex Scoring Lesson',
                'outcomeRefs': ['AOM3.1'],
                'estMinutes': 30  # Exceeds constraint -> penalty
            }],
            'sow': {
                'entries': [
                    {'order': 2, 'lessonTemplateId': 'template-123'}  # Early order -> bonus
                ]
            },
            'mastery': {
                'emaByOutcome': {
                    'AOM3.1': 0.5  # Low mastery -> bonus
                }
            },
            'routine': {},
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)

        assert len(candidates) == 1
        candidate = candidates[0]

        # Should explain positive factors
        assert 'low mastery' in candidate['reasons']
        assert 'early order' in candidate['reasons']

        # Should explain negative factors
        assert 'long lesson' in candidate['reasons']

        # Score should reflect combination: 0.25 + early_order_bonus - 0.05
        # Early order bonus for position 2 = 0.15 * 4/5 = 0.12
        expected_score = 0.25 + 0.12 - 0.05  # = 0.32
        assert abs(candidate['priorityScore'] - expected_score) < 0.01

    def test_no_applicable_factors_empty_reasons(self):
        """Lessons with no applicable factors should have minimal reasons"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Neutral Lesson',
                'outcomeRefs': ['AOM3.1'],
                'estMinutes': 22  # Within limits, not short win
            }],
            'sow': {
                'entries': [
                    {'order': 10, 'lessonTemplateId': 'template-123'}  # No early order bonus
                ]
            },
            'mastery': {
                'emaByOutcome': {
                    'AOM3.1': 0.8  # High mastery, no bonus
                }
            },
            'routine': {},  # No overdue, not recent
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)

        assert len(candidates) == 1
        candidate = candidates[0]

        # Should have minimal score and reasons
        assert candidate['priorityScore'] == 0.0
        # May have empty reasons or only neutral ones
        negative_reasons = ['overdue', 'low mastery', 'early order']
        for reason in negative_reasons:
            assert reason not in candidate['reasons']


class TestReasoningConsistency:
    """Test that reasoning is consistent with scoring"""

    def test_overdue_reason_matches_overdue_score(self):
        """If 'overdue' is in reasons, score should include +0.40"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Overdue Lesson',
                'outcomeRefs': ['AOM3.1'],
                'estMinutes': 20
            }],
            'sow': {
                'entries': [
                    {'order': 10, 'lessonTemplateId': 'template-123'}
                ]
            },
            'mastery': {},
            'routine': {
                'dueAtByOutcome': {
                    'AOM3.1': (datetime.now() - timedelta(days=1)).isoformat()
                }
            },
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)
        candidate = candidates[0]

        if 'overdue' in candidate['reasons']:
            # Score should be at least 0.40 (could be reduced by penalties)
            assert candidate['priorityScore'] >= 0.35  # Allow for small penalties

    def test_low_mastery_reason_matches_low_mastery_score(self):
        """If 'low mastery' is in reasons, score should include +0.25"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Low Mastery Lesson',
                'outcomeRefs': ['AOM3.1'],
                'estMinutes': 20
            }],
            'sow': {
                'entries': [
                    {'order': 10, 'lessonTemplateId': 'template-123'}
                ]
            },
            'mastery': {
                'emaByOutcome': {
                    'AOM3.1': 0.4  # Low mastery
                }
            },
            'routine': {},
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)
        candidate = candidates[0]

        if 'low mastery' in candidate['reasons']:
            # Score should be at least 0.25
            assert candidate['priorityScore'] >= 0.20  # Allow for small penalties

    def test_penalty_reasons_reduce_score(self):
        """Penalty reasons should correspond to score reductions"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [{
                '$id': 'template-123',
                'title': 'Penalized Lesson',
                'outcomeRefs': ['AOM3.1'],
                'estMinutes': 35  # Long lesson penalty
            }],
            'sow': {
                'entries': [
                    {'order': 1, 'lessonTemplateId': 'template-123'}  # +0.15 early order
                ]
            },
            'mastery': {},
            'routine': {
                'recentTemplateIds': ['template-123']  # -0.10 recent penalty
            },
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)
        candidate = candidates[0]

        expected_score = 0.15 - 0.10 - 0.05  # early order - recent - long = 0.00
        assert candidate['priorityScore'] == max(0.0, expected_score)

        assert 'early order' in candidate['reasons']
        assert 'recent' in candidate['reasons']
        assert 'long lesson' in candidate['reasons']