"""
Test SoW order bonus and penalty scenarios for Course Manager scoring.
Tests for:
+0.15 for early SoW order (scaled by position)
-0.10 for recently taught lessons
-0.05 for lessons exceeding max time constraint
"""

import pytest
from datetime import datetime, timedelta
from agent.course_manager_utils import (
    calculate_priority_score,
    create_lesson_candidates
)


class TestSoWOrderScoring:
    """Test +0.15 scoring for early SoW order (scaled by position)"""

    def test_first_sow_position_maximum_bonus(self):
        """First position in SoW should get full +0.15 bonus"""
        template = {
            '$id': 'template-123',
            'title': 'First Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 1  # First position

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.15
        assert 'early order' in result['reasons']

    def test_second_sow_position_scaled_bonus(self):
        """Second position should get 4/5 of bonus = 0.12"""
        template = {
            '$id': 'template-123',
            'title': 'Second Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 2

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        expected_bonus = 0.15 * (6 - 2) / 5  # 0.15 * 4/5 = 0.12
        assert result['priorityScore'] == expected_bonus
        assert 'early order' in result['reasons']

    def test_fifth_sow_position_minimal_bonus(self):
        """Fifth position should get 1/5 of bonus = 0.03"""
        template = {
            '$id': 'template-123',
            'title': 'Fifth Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 5

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        expected_bonus = 0.15 * (6 - 5) / 5  # 0.15 * 1/5 = 0.03
        assert result['priorityScore'] == expected_bonus
        assert 'early order' in result['reasons']

    def test_sixth_sow_position_no_bonus(self):
        """Sixth position should get no early order bonus"""
        template = {
            '$id': 'template-123',
            'title': 'Sixth Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 6

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'early order' not in result['reasons']

    def test_high_sow_order_no_bonus(self):
        """High order positions should get no early order bonus"""
        template = {
            '$id': 'template-123',
            'title': 'Late Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 20

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'early order' not in result['reasons']


class TestRecentlyTaughtPenalty:
    """Test -0.10 penalty for recently taught lessons"""

    def test_recently_taught_lesson_gets_penalty(self):
        """Lesson in recent templates list should get -0.10 penalty"""
        template = {
            '$id': 'template-123',
            'title': 'Recent Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {
            'recentTemplateIds': ['template-123', 'template-456']  # Contains our template
        }
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0  # max(0, -0.10)
        assert 'recent' in result['reasons']
        assert 'recently-taught' in result.get('flags', [])

    def test_not_recently_taught_lesson_no_penalty(self):
        """Lesson not in recent templates list should get no penalty"""
        template = {
            '$id': 'template-123',
            'title': 'Not Recent Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {
            'recentTemplateIds': ['template-456', 'template-789']  # Doesn't contain our template
        }
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'recent' not in result['reasons']

    def test_missing_recent_templates_no_penalty(self):
        """Missing recentTemplateIds should not apply penalty"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}  # No recentTemplateIds field
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'recent' not in result['reasons']

    def test_recent_penalty_with_positive_score(self):
        """Recent penalty should reduce positive scores"""
        template = {
            '$id': 'template-123',
            'title': 'Recent but Low Mastery Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.4  # Low mastery +0.25
            }
        }
        routine = {
            'recentTemplateIds': ['template-123']  # Recently taught -0.10
        }
        constraints = {'maxBlockMinutes': 25}
        sow_order = 1  # First position +0.15

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        expected_score = 0.25 + 0.15 - 0.10  # low mastery + early order - recent = 0.30
        assert abs(result['priorityScore'] - expected_score) < 0.001
        assert 'low mastery' in result['reasons']
        assert 'early order' in result['reasons']
        assert 'recent' in result['reasons']


class TestTimeLimitPenalty:
    """Test -0.05 penalty for lessons exceeding max time constraint"""

    def test_lesson_exceeding_time_limit_gets_penalty(self):
        """Lesson longer than maxBlockMinutes should get -0.05 penalty"""
        template = {
            '$id': 'template-123',
            'title': 'Long Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 30  # Exceeds 25 minute limit
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0  # max(0, -0.05)
        assert 'long lesson' in result['reasons']

    def test_lesson_at_time_limit_no_penalty(self):
        """Lesson exactly at maxBlockMinutes should get no penalty"""
        template = {
            '$id': 'template-123',
            'title': 'Exactly Right Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 25  # Exactly at limit
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'long lesson' not in result['reasons']

    def test_lesson_under_time_limit_no_penalty(self):
        """Lesson under maxBlockMinutes should get no penalty"""
        template = {
            '$id': 'template-123',
            'title': 'Short Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20  # Under limit
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'long lesson' not in result['reasons']

    def test_very_long_lesson_gets_flag(self):
        """Lesson exceeding 1.5x time limit should get special flag"""
        template = {
            '$id': 'template-123',
            'title': 'Very Long Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 40  # 40 > 25 * 1.5 (37.5)
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0
        assert 'long lesson' in result['reasons']
        assert 'very-long' in result.get('flags', [])

    def test_time_penalty_with_positive_score(self):
        """Time penalty should reduce positive scores"""
        template = {
            '$id': 'template-123',
            'title': 'Long but Low Mastery Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 30  # Exceeds limit -0.05
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.4  # Low mastery +0.25
            }
        }
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 1  # First position +0.15

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        expected_score = 0.25 + 0.15 - 0.05  # low mastery + early order - long = 0.35
        assert abs(result['priorityScore'] - expected_score) < 0.001
        assert 'low mastery' in result['reasons']
        assert 'early order' in result['reasons']
        assert 'long lesson' in result['reasons']

    def test_missing_time_constraints_uses_default(self):
        """Missing maxBlockMinutes should use default of 25"""
        template = {
            '$id': 'template-123',
            'title': 'Test Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 30  # Should exceed default 25
        }

        mastery = {}
        routine = {}
        constraints = {}  # No maxBlockMinutes specified
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert result['priorityScore'] == 0.0  # Should get penalty
        assert 'long lesson' in result['reasons']


class TestShortWinReason:
    """Test 'short win' reason for lessons <= 20 minutes"""

    def test_short_lesson_gets_short_win_reason(self):
        """Lesson <= 20 minutes should get 'short win' reason"""
        template = {
            '$id': 'template-123',
            'title': 'Quick Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 15
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert 'short win' in result['reasons']

    def test_twenty_minute_lesson_gets_short_win(self):
        """20 minute lesson should get 'short win' reason"""
        template = {
            '$id': 'template-123',
            'title': 'Twenty Minute Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 20
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert 'short win' in result['reasons']

    def test_longer_lesson_no_short_win(self):
        """Lesson > 20 minutes should not get 'short win' reason"""
        template = {
            '$id': 'template-123',
            'title': 'Longer Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 25
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert 'short win' not in result['reasons']

    def test_missing_est_minutes_no_short_win(self):
        """Missing estMinutes should not get 'short win' reason"""
        template = {
            '$id': 'template-123',
            'title': 'No Time Lesson',
            'outcomeRefs': ['AOM3.1']
            # No estMinutes field
        }

        mastery = {}
        routine = {}
        constraints = {'maxBlockMinutes': 25}
        sow_order = 10

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        assert 'short win' not in result['reasons']


class TestComplexScoringScenarios:
    """Test complex combinations of all scoring factors"""

    def test_worst_case_scenario(self):
        """Recently taught + long lesson should result in minimal score"""
        template = {
            '$id': 'template-123',
            'title': 'Bad Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 35  # Long
        }

        mastery = {
            'emaByOutcome': {
                'AOM3.1': 0.9  # High mastery (no bonus)
            }
        }
        routine = {
            'recentTemplateIds': ['template-123']  # Recently taught
        }
        constraints = {'maxBlockMinutes': 25}
        sow_order = 20  # Late in SoW

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        # Should be max(0, -0.10 - 0.05) = 0
        assert result['priorityScore'] == 0.0
        assert 'recent' in result['reasons']
        assert 'long lesson' in result['reasons']

    def test_best_case_scenario(self):
        """Overdue + low mastery + early order + short should give high score"""
        template = {
            '$id': 'template-123',
            'title': 'Perfect Lesson',
            'outcomeRefs': ['AOM3.1'],
            'estMinutes': 15  # Short win
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

        constraints = {'maxBlockMinutes': 25}
        sow_order = 1  # First position

        result = calculate_priority_score(template, mastery, routine, sow_order, constraints)

        # Should be 0.40 + 0.25 + 0.15 = 0.80
        expected_score = 0.40 + 0.25 + 0.15
        assert result['priorityScore'] == expected_score
        assert 'overdue' in result['reasons']
        assert 'low mastery' in result['reasons']
        assert 'early order' in result['reasons']
        assert 'short win' in result['reasons']


class TestCandidatesSoWOrdering:
    """Test that candidates are properly ordered by SoW when scores are equal"""

    def test_equal_scores_ordered_by_sow_position(self):
        """Candidates with equal scores should be ordered by SoW position"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [
                {
                    '$id': 'template-late',
                    'title': 'Late Lesson',
                    'outcomeRefs': ['AOM3.3'],
                    'estMinutes': 20
                },
                {
                    '$id': 'template-early',
                    'title': 'Early Lesson',
                    'outcomeRefs': ['AOM3.2'],
                    'estMinutes': 20
                }
            ],
            'sow': {
                'entries': [
                    {'order': 7, 'lessonTemplateId': 'template-early'},  # No early order bonus
                    {'order': 8, 'lessonTemplateId': 'template-late'}    # No early order bonus
                ]
            },
            'mastery': {},
            'routine': {},
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)

        # Both should have equal priority scores (0), but early should come first due to SoW order
        assert len(candidates) == 2
        assert candidates[0]['lessonTemplateId'] == 'template-early'
        assert candidates[1]['lessonTemplateId'] == 'template-late'
        assert candidates[0]['priorityScore'] == candidates[1]['priorityScore']

    def test_templates_not_in_sow_get_high_order(self):
        """Templates not in SoW should get default high order (999)"""
        context = {
            'student': {'id': 'student-123'},
            'course': {'courseId': 'C844 73'},
            'templates': [
                {
                    '$id': 'template-in-sow',
                    'title': 'In SoW Lesson',
                    'outcomeRefs': ['AOM3.1'],
                    'estMinutes': 20
                },
                {
                    '$id': 'template-not-in-sow',
                    'title': 'Not in SoW Lesson',
                    'outcomeRefs': ['AOM3.2'],
                    'estMinutes': 20
                }
            ],
            'sow': {
                'entries': [
                    {'order': 3, 'lessonTemplateId': 'template-in-sow'}
                    # template-not-in-sow is missing from SoW
                ]
            },
            'mastery': {},
            'routine': {},
            'constraints': {'maxBlockMinutes': 25}
        }

        candidates = create_lesson_candidates(context)

        # Template in SoW should come first despite equal scores
        assert len(candidates) == 2
        assert candidates[0]['lessonTemplateId'] == 'template-in-sow'
        assert candidates[1]['lessonTemplateId'] == 'template-not-in-sow'