# Lesson Recommendation Algorithm

## Overview

The lesson recommendation algorithm in `course_manager_utils.py` is a sophisticated scoring system that prioritizes lessons based on educational best practices and spaced repetition principles. It analyzes student mastery data, scheme of work scheduling, recent teaching history, and time constraints to recommend the most appropriate next lesson.

## Algorithm Philosophy

The system follows this priority hierarchy:
```
"Overdue > Low Mastery > Early Order | -Too Long"
```

This ensures that:
1. **Overdue lessons** get highest priority (unless already mastered)
2. **Content needing practice** (low mastery) is prioritized
3. **Logical sequence** (early SOW order) is maintained
4. **Time constraints are respected**

**Note**: Spaced repetition is handled separately and not part of the recommendation algorithm.

## Data Flow

```
Frontend Context → create_lesson_candidates() → calculate_priority_score() →
[Overdue + Mastery + Order + Time Penalties] → Ranked Recommendations
```

### Input Data
- **Templates**: Available lesson templates with outcomes and duration
- **SOW Data**: Scheme of Work with plannedAt dates and order
- **Mastery Data**: Student's mastery levels per outcome (0.0-1.0)
- **Constraints**: Time limits and preferences

## Algorithm Steps

### 1. Entry Point: `create_lesson_candidates()`

```python
def create_lesson_candidates(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    templates = context.get('templates', [])    # Available lesson templates
    sow_data = context.get('sow', [])           # Scheme of Work with plannedAt dates
    mastery_data = context.get('mastery', [])   # Student's mastery levels
    constraints = context.get('constraints', {}) # Time limits, preferences
```

This function orchestrates the entire recommendation process by:
- Extracting all relevant data from the context
- Processing each lesson template through the scoring algorithm
- Returning the top 5 candidates sorted by priority

### 2. SOW Order Lookup Creation

```python
sow_order_lookup = {}
for entry in sow_data:
    template_id = entry.get('templateId')
    order = entry.get('order', 999)  # Use order field, default high if missing
    if template_id:
        sow_order_lookup[template_id] = order
```

Creates a quick lookup dictionary for each lesson's planned sequence order (1, 2, 3, etc.)

### 3. Main Scoring Function: `calculate_priority_score()`

```python
def calculate_priority_score(
    template: Dict[str, Any],
    mastery_data: List[Dict[str, Any]],
    sow_data: List[Dict[str, Any]],
    sow_order: int,
    constraints: Dict[str, Any]
) -> Dict[str, Any]:
```

This function calculates a composite score (0.0 to 1.0+) by combining three scoring components:

## Scoring Components

### Component 1: Overdue Score (+0.40 max)

**Purpose**: Prioritize lessons that are past their planned date, but only if not already mastered.

```python
def _calculate_overdue_score_simplified(
    template_id: str,
    sow_data: List[Dict[str, Any]],
    mastery_data: List[Dict[str, Any]] = None,
    outcome_refs: List[str] = None
) -> Tuple[float, List[str], List[str]]:
```

**Logic:**
```python
# Check if lesson's plannedAt date is in the past
if planned_date < current_date:
    # BUT first check if already mastered
    if mastery_data and outcome_refs:
        # Calculate average mastery for outcomes
        for outcome_id in outcome_refs:
            for mastery_entry in mastery_data:
                if mastery_entry.get('outcomeRef') == outcome_id:
                    mastery_level = mastery_entry.get('masteryLevel', 0)
                    total_mastery += mastery_level

        if avg_mastery >= 0.8:  # High mastery threshold
            return 0.0, [], ['completed-on-time']  # No overdue bonus

    # Only mark as overdue if NOT mastered
    return 0.40, ['overdue'], [f'overdue-{days_overdue}-days']
```

**Key Feature**: Mastery-aware overdue detection prevents recommending content the student has already mastered.

### Component 2: Mastery Score (+0.25 or -0.20)

**Purpose**: Prioritize content that needs practice while deprioritizing mastered content.

```python
def _calculate_mastery_score_simplified(
    template_id: str,
    mastery_data: List[Dict[str, Any]],
    outcome_refs: List[str] = None
) -> Tuple[float, List[str], List[str]]:
```

**Logic:**
```python
# Find average mastery for template's outcomes
for outcome_id in outcome_refs:
    for mastery_entry in mastery_data:
        if mastery_entry.get('outcomeRef') == outcome_id:
            mastery_level = mastery_entry.get('masteryLevel', 0)
            total_mastery += mastery_level

if valid_mastery_count > 0:
    avg_mastery = total_mastery / valid_mastery_count

    if avg_mastery < 0.5:
        return 0.25, ['low mastery'], []     # Needs practice
    elif avg_mastery >= 0.8:
        return -0.20, ['high mastery'], []   # Already knows it
    else:
        return 0.0, ['moderate mastery'], [] # In progress
else:
    return 0.25, ['new content'], []        # Never studied
```

**Mastery Thresholds:**
- **< 0.5**: Low mastery (+0.25 bonus)
- **0.5-0.8**: Moderate mastery (no bonus/penalty)
- **≥ 0.8**: High mastery (-0.20 penalty)
- **No data**: New content (+0.25 bonus)

### Component 3: Order Score (+0.15 to +0.00)

**Purpose**: Prioritize lessons that come earlier in the planned sequence.

```python
def _calculate_order_score(sow_order: int, template_id: str) -> Tuple[float, List[str]]:
    if sow_order <= 3:
        score = 0.15 - (sow_order - 1) * 0.03  # 0.15, 0.12, 0.09
        return score, ['early order']
    elif sow_order <= 10:
        score = 0.06 - (sow_order - 4) * 0.01  # Gradual decrease
        return score, []
    else:
        return 0.0, []  # No bonus for lessons far in sequence
```

**Order Bonuses:**
- **Order 1**: +0.15
- **Order 2**: +0.12
- **Order 3**: +0.09
- **Order 4-10**: +0.06 to +0.01 (gradual decrease)
- **Order 11+**: +0.00

### Component 3: Time Constraint Penalty (-0.05 for long lessons only)

**Purpose**: Respect time constraints - no longer considers recent teaching history.

```python
def _calculate_time_constraint_penalty(
    template: Dict[str, Any],
    constraints: Dict[str, Any]
) -> Tuple[float, List[str], List[str]]:
```

**Long Lesson Penalty:**
```python
# Penalty for lessons exceeding time limit
max_minutes = constraints.get('maxBlockMinutes', 25)
est_minutes = template.get('estMinutes', 0)
if est_minutes > max_minutes:
    score -= 0.05
    reasons.append('long lesson')
```

**Positive Indicator:**
```python
# Positive reason for short lessons (no score bonus)
if est_minutes > 0 and est_minutes <= 20:
    reasons.append('short win')
```

**Note**: Recent teaching penalties have been removed. Spaced repetition is now handled separately from the recommendation algorithm.

## Final Score Calculation and Ranking

### Score Combination
```python
# Combine all components
score = overdue_score + mastery_score + order_score + time_penalty_score
score = max(0.0, score)  # Never negative
```

### Sorting Logic
```python
# Sort candidates by:
# 1. Priority score (descending) - higher scores first
# 2. SOW order (ascending) - earlier lessons first as tiebreaker
candidates.sort(
    key=lambda x: (-x['score'], sow_order_lookup.get(x['lessonId'], 999))
)

# Return top 5
return candidates[:5]
```

### Priority Classification
```python
'priority': 'high' if score >= 0.6 else 'medium' if score >= 0.3 else 'low'
```

## Scoring Rubric Summary

### Maximum Possible Scores
- **Overdue lesson**: +0.40
- **New/low mastery content**: +0.25
- **First in sequence**: +0.15
- **Total maximum**: 0.80 (if overdue + new + first)

### Penalties
- **High mastery (≥80%)**: -0.20
- **Too long (>25 min)**: -0.05

## Real-World Examples

### Example 1: Overdue + Low Mastery + Early Order
```
Lesson: "Fractions Basics"
- plannedAt: 2025-09-20 (5 days ago) → +0.40 overdue
- Mastery: 0.3 (low) → +0.25 low mastery
- Order: 1 (first) → +0.15 early order
- Duration: 25 min → no penalty
- Recent: No → no penalty
Final Score: 0.80 (HIGH priority)
```

### Example 2: Mastered Content
```
Lesson: "Fractions & Decimals"
- plannedAt: 2025-09-20 (5 days ago) but mastery ≥ 0.8
- Mastery: 1.0 (perfect) → Overdue ignored, -0.20 high mastery
- Order: 1 (first) → +0.15 early order
- Duration: 30 min (> 25) → -0.05 long lesson
- Recent: No → no penalty
Final Score: 0.00 (LOW priority) - correctly deprioritized
```

### Example 3: New Content in Sequence
```
Lesson: "Linear Equations"
- plannedAt: 2025-09-25 (future) → no overdue bonus
- Mastery: None (new) → +0.25 new content
- Order: 2 (second) → +0.12 early order
- Duration: 20 min → +0.00 no penalty, "short win" reason
- Recent: No → no penalty
Final Score: 0.37 (MEDIUM priority)
```

## Configuration Parameters

### Constraints Object
```python
constraints = {
    'maxBlockMinutes': 25,      # Time limit for lessons
    'avoidRepeatWithinDays': 3, # Days to avoid repetition
    'preferOverdue': True,      # Enable overdue bonus
    'preferLowEMA': True        # Enable mastery-based scoring
}
```

### Thresholds
- **High mastery threshold**: 0.8 (80%)
- **Low mastery threshold**: 0.5 (50%)
- **Priority thresholds**: High ≥ 0.6, Medium ≥ 0.3, Low < 0.3
- **Early order bonus**: Orders 1-3 get significant bonus
- **Short lesson bonus**: ≤ 20 minutes (reason only, no score)

## Algorithm Benefits

1. **Educational Soundness**: Based on spaced repetition and mastery learning
2. **Personalization**: Adapts to individual student progress
3. **Sequence Awareness**: Respects curriculum order while allowing flexibility
4. **Time Management**: Considers lesson duration and available time
5. **Avoids Repetition**: Prevents teaching same content too frequently
6. **Mastery-Aware**: Doesn't push already mastered content as overdue
7. **Transparent**: Clear scoring breakdown for debugging and tuning

## Maintenance Notes

- **Mastery data structure**: Uses `outcomeRef` + `masteryLevel` format
- **SOW data structure**: Uses `templateId` + `order` + `plannedAt` format
- **Date handling**: All dates in ISO format with timezone support
- **Error handling**: Graceful degradation with default scores
- **Logging**: Comprehensive logging for debugging score calculations

This algorithm provides intelligent, educationally-sound lesson recommendations that adapt to student progress while maintaining curriculum coherence.