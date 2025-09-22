"""
Course Manager utilities for lesson prioritization and scoring.
Implements the PRD-defined scoring rubric for multi-course recommendations.
"""

from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)


def _calculate_overdue_score_simplified(
    template_id: str,
    sow_data: List[Dict[str, Any]]
) -> Tuple[float, List[str], List[str]]:
    """Calculate overdue bonus score using simplified SOW data."""
    for sow_entry in sow_data:
        if sow_entry.get('templateId') == template_id:
            current_week = sow_entry.get('currentWeek', 1)
            lesson_week = sow_entry.get('week', 1)

            # If lesson week < current week, it's overdue
            if lesson_week < current_week:
                logger.debug(f"Template {template_id}: overdue (week {lesson_week} < current {current_week}) (+0.40)")
                return 0.40, ['overdue'], ['sow-overdue']

    return 0.0, [], []


def _calculate_overdue_score(
    outcome_refs: List[str],
    routine: Dict[str, Any],
    template_id: str
) -> Tuple[float, List[str], List[str]]:
    """Calculate overdue bonus score and reasons."""
    if not routine or 'dueAtByOutcome' not in routine:
        return 0.0, [], []

    now = datetime.now()
    overdue_count = 0

    for outcome_id in outcome_refs:
        due_at = routine['dueAtByOutcome'].get(outcome_id)
        if due_at:
            try:
                # Handle both ISO format and timezone variations
                if due_at.endswith('Z'):
                    due_date = datetime.fromisoformat(due_at.replace('Z', '+00:00'))
                else:
                    due_date = datetime.fromisoformat(due_at)

                if due_date < now:
                    overdue_count += 1
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid date format for outcome {outcome_id}: {due_at} - {e}")
                continue

    if overdue_count > 0:
        reasons = ['overdue']
        flags = ['all-overdue'] if overdue_count >= len(outcome_refs) else []
        logger.debug(f"Template {template_id}: {overdue_count} overdue outcomes (+0.40)")
        return 0.40, reasons, flags

    return 0.0, [], []


def _calculate_mastery_score_simplified(
    template_id: str,
    mastery_data: List[Dict[str, Any]]
) -> Tuple[float, List[str], List[str]]:
    """Calculate low mastery bonus score using simplified mastery data."""
    for mastery_entry in mastery_data:
        if mastery_entry.get('templateId') == template_id:
            mastery_level = mastery_entry.get('masteryLevel', 1.0)

            # If mastery < 0.5, get +0.25 bonus
            if mastery_level < 0.5:
                logger.debug(f"Template {template_id}: low mastery ({mastery_level:.2f} < 0.5) (+0.25)")
                flags = ['very-low-mastery'] if mastery_level < 0.3 else []
                return 0.25, ['low mastery'], flags

    return 0.0, [], []


def _calculate_mastery_score(
    outcome_refs: List[str],
    mastery: Dict[str, Any],
    template_id: str
) -> Tuple[float, List[str], List[str]]:
    """Calculate low mastery bonus score and reasons."""
    if not mastery or 'emaByOutcome' not in mastery:
        return 0.0, [], []

    low_mastery_count = 0
    total_ema = 0
    valid_ema_count = 0

    for outcome_id in outcome_refs:
        ema_score = mastery['emaByOutcome'].get(outcome_id)
        if ema_score is not None:
            total_ema += ema_score
            valid_ema_count += 1
            if ema_score < 0.6:
                low_mastery_count += 1

    if low_mastery_count > 0:
        reasons = ['low mastery']
        flags = []

        # Add flag for very low mastery (< 0.3)
        if valid_ema_count > 0:
            avg_ema = total_ema / valid_ema_count
            if avg_ema < 0.3:
                flags.append('very-low-mastery')

        logger.debug(f"Template {template_id}: {low_mastery_count} low mastery outcomes (+0.25)")
        return 0.25, reasons, flags

    return 0.0, [], []


def _calculate_order_score(sow_order: int, template_id: str) -> Tuple[float, List[str]]:
    """Calculate SoW order bonus score and reasons."""
    if sow_order <= 5:  # First 5 lessons get bonus
        order_bonus = 0.15 * (6 - sow_order) / 5
        logger.debug(f"Template {template_id}: early order {sow_order} (+{order_bonus:.3f})")
        return order_bonus, ['early order']

    return 0.0, []


def _calculate_penalty_scores_simplified(
    template: Dict[str, Any],
    routine_data: List[Dict[str, Any]],
    constraints: Dict[str, Any]
) -> Tuple[float, List[str], List[str]]:
    """Calculate penalty scores using simplified routine data."""
    score = 0.0
    reasons = []
    flags = []
    template_id = template.get('$id', '')

    # Check for recent sessions using daysSinceLastSession
    for routine_entry in routine_data:
        if routine_entry.get('templateId') == template_id:
            days_since = routine_entry.get('daysSinceLastSession', 999)
            # If recently completed (< 7 days ago), apply penalty
            if days_since < 7:
                score -= 0.10
                reasons.append('recent')
                flags.append('recently-taught')
                logger.debug(f"Template {template_id}: recently taught {days_since} days ago (-0.10)")
                break

    # Penalty for long lessons (-0.05)
    max_minutes = constraints.get('maxBlockMinutes', 25)
    est_minutes = template.get('estMinutes', 0)
    if est_minutes > max_minutes:
        score -= 0.05
        reasons.append('long lesson')
        if est_minutes > max_minutes * 1.5:  # Very long lessons
            flags.append('very-long')
        logger.debug(f"Template {template_id}: exceeds time limit {est_minutes}>{max_minutes} (-0.05)")

    # Add positive reason for short lessons (< 20 minutes)
    if est_minutes > 0 and est_minutes <= 20:
        reasons.append('short win')

    return score, reasons, flags


def _calculate_penalty_scores(
    template: Dict[str, Any],
    routine: Dict[str, Any],
    constraints: Dict[str, Any]
) -> Tuple[float, List[str], List[str]]:
    """Calculate penalty scores and reasons."""
    score = 0.0
    reasons = []
    flags = []
    template_id = template.get('$id', '')

    # Penalty for recently taught (-0.10)
    if routine and 'recentTemplateIds' in routine:
        recent_templates = routine.get('recentTemplateIds', [])
        if template_id in recent_templates:
            score -= 0.10
            reasons.append('recent')
            flags.append('recently-taught')
            logger.debug(f"Template {template_id}: recently taught (-0.10)")

    # Penalty for long lessons (-0.05)
    max_minutes = constraints.get('maxBlockMinutes', 25)
    est_minutes = template.get('estMinutes', 0)
    if est_minutes > max_minutes:
        score -= 0.05
        reasons.append('long lesson')
        if est_minutes > max_minutes * 1.5:  # Very long lessons
            flags.append('very-long')
        logger.debug(f"Template {template_id}: exceeds time limit {est_minutes}>{max_minutes} (-0.05)")

    # Add positive reason for short lessons (< 20 minutes)
    if est_minutes > 0 and est_minutes <= 20:
        reasons.append('short win')

    return score, reasons, flags


def calculate_priority_score(
    template: Dict[str, Any],
    mastery_data: List[Dict[str, Any]],
    routine_data: List[Dict[str, Any]],
    sow_data: List[Dict[str, Any]],
    sow_order: int,
    constraints: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calculate priority score based on PRD scoring rubric.
    Refactored for better testability and performance.
    """
    outcome_refs = template.get('outcomeRefs', [])
    template_id = template.get('$id', '')

    try:
        score = 0.0
        all_reasons = []
        all_flags = []

        # Calculate overdue bonus using simplified data
        overdue_score, overdue_reasons, overdue_flags = _calculate_overdue_score_simplified(
            template_id, sow_data
        )
        score += overdue_score
        all_reasons.extend(overdue_reasons)
        all_flags.extend(overdue_flags)

        # Calculate mastery bonus using simplified data
        mastery_score, mastery_reasons, mastery_flags = _calculate_mastery_score_simplified(
            template_id, mastery_data
        )
        score += mastery_score
        all_reasons.extend(mastery_reasons)
        all_flags.extend(mastery_flags)

        # Calculate order bonus
        order_score, order_reasons = _calculate_order_score(sow_order, template_id)
        score += order_score
        all_reasons.extend(order_reasons)

        # Calculate penalties using simplified data
        penalty_score, penalty_reasons, penalty_flags = _calculate_penalty_scores_simplified(
            template, routine_data, constraints
        )
        score += penalty_score
        all_reasons.extend(penalty_reasons)
        all_flags.extend(penalty_flags)

        # Ensure score is not negative
        score = max(0.0, score)

        logger.info(f"Template {template_id}: final score {score:.2f}, reasons: {all_reasons}")

        return {
            'priorityScore': round(score, 2),
            'reasons': all_reasons,
            'flags': all_flags
        }

    except Exception as e:
        logger.error(f"Error calculating priority score for template {template_id}: {e}")
        return {
            'priorityScore': 0.0,
            'reasons': ['error'],
            'flags': ['calculation-error']
        }


def create_lesson_candidates(
    context: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Create ranked lesson candidates from scheduling context.
    Returns up to 5 candidates sorted by priority score.
    """
    candidates = []

    try:
        templates = context.get('templates', [])
        sow_data = context.get('sow', [])
        mastery_data = context.get('mastery', [])
        routine_data = context.get('routine', [])
        constraints = context.get('constraints', {})

        if not templates:
            logger.warning("No lesson templates provided in scheduling context")
            return []

        # Create lookup for SoW order from our Appwrite schema
        sow_order_lookup = {}
        for entry in sow_data:
            template_id = entry.get('templateId')
            week = entry.get('week', 999)  # Use week as order, default high if missing
            if template_id:
                sow_order_lookup[template_id] = week

        logger.info(f"Processing {len(templates)} lesson templates")

        for template in templates:
            template_id = template.get('$id', '')
            if not template_id:
                logger.warning("Template missing $id field, skipping")
                continue

            # Get SoW order (default high order for templates not in SoW)
            sow_order = sow_order_lookup.get(template_id, 999)

            # Calculate priority score
            score_data = calculate_priority_score(
                template, mastery_data, routine_data, sow_data, sow_order, constraints
            )

            candidate = {
                'lessonId': template_id,  # Change to match test expectations
                'title': template.get('title', 'Unknown Lesson'),
                'targetOutcomeIds': template.get('outcomeRefs', []),
                'estimatedMinutes': template.get('estMinutes'),
                'priority': 'high' if score_data['priorityScore'] >= 0.6 else 'medium' if score_data['priorityScore'] >= 0.3 else 'low',
                'score': score_data['priorityScore'],
                'reasons': score_data['reasons'],
                'flags': score_data.get('flags', [])
            }

            candidates.append(candidate)

        # Sort by priority score descending, then by SoW order ascending
        candidates.sort(
            key=lambda x: (-x['score'], sow_order_lookup.get(x['lessonId'], 999))
        )

        # Return top 5 candidates
        top_candidates = candidates[:5]

        logger.info(f"Generated {len(top_candidates)} lesson candidates")
        for i, candidate in enumerate(top_candidates):
            logger.info(f"  {i+1}. {candidate['title']} (score: {candidate['score']}, reasons: {candidate['reasons']})")

        return top_candidates

    except Exception as e:
        logger.error(f"Error creating lesson candidates: {e}")
        return []


def generate_rubric_explanation() -> str:
    """
    Generate human-readable explanation of scoring rubric.
    This provides transparency into the AI's decision-making process.
    """
    return "Overdue>LowEMA>Order | -Recent -TooLong"


def validate_scheduling_context(context: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate that the scheduling context contains required data.
    Returns (is_valid, error_message).
    """
    try:
        # Check required fields
        required_fields = ['student', 'course', 'templates']
        for field in required_fields:
            if field not in context:
                return False, f"Missing required field: {field}"

        # Validate student data
        student = context['student']
        if not isinstance(student, dict) or 'id' not in student:
            return False, "Invalid student data: missing id"

        # Validate course data
        course = context['course']
        required_course_fields = ['$id', 'courseId', 'subject']
        for field in required_course_fields:
            if field not in course:
                return False, f"Missing required course field: {field}"

        # Validate templates
        templates = context['templates']
        if not isinstance(templates, list) or len(templates) == 0:
            return False, "No lesson templates provided"

        for i, template in enumerate(templates):
            if not isinstance(template, dict):
                return False, f"Invalid template at index {i}: not a dictionary"

            required_template_fields = ['$id', 'title', 'outcomeRefs']
            for field in required_template_fields:
                if field not in template:
                    return False, f"Template {i} missing required field: {field}"

        logger.info("Scheduling context validation passed")
        return True, ""

    except Exception as e:
        logger.error(f"Error validating scheduling context: {e}")
        return False, f"Validation error: {str(e)}"


def generate_recommendation_summary(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate summary statistics for the recommendation set.
    Useful for debugging and analytics.
    """
    if not candidates:
        return {
            'total_candidates': 0,
            'avg_priority_score': 0,
            'top_reasons': [],
            'score_distribution': {}
        }

    total_candidates = len(candidates)
    scores = [c['score'] for c in candidates]
    avg_score = sum(scores) / len(scores) if scores else 0

    # Count reason frequency
    reason_counts = {}
    for candidate in candidates:
        for reason in candidate.get('reasons', []):
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

    # Get top 3 most common reasons
    top_reasons = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)[:3]

    # Score distribution
    score_ranges = {
        'high (0.6+)': len([s for s in scores if s >= 0.6]),
        'medium (0.3-0.6)': len([s for s in scores if 0.3 <= s < 0.6]),
        'low (<0.3)': len([s for s in scores if s < 0.3])
    }

    return {
        'total_candidates': total_candidates,
        'avg_priority_score': round(avg_score, 2),
        'top_reasons': [reason for reason, count in top_reasons],
        'score_distribution': score_ranges,
        'score_range': {
            'min': round(min(scores), 2) if scores else 0,
            'max': round(max(scores), 2) if scores else 0
        }
    }