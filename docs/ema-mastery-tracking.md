# EMA Mastery Tracking System

## Overview

This document describes the Exponential Moving Average (EMA) system for tracking student mastery levels in the Scottish AI Lessons platform.

**Implementation Status**: ✅ Implemented (Phase 1 & 2 complete)  
**Feature Flag**: `NEXT_PUBLIC_ENABLE_EMA=true`  
**Location**: `assistant-ui-frontend/lib/utils/ema-calculator.ts`

---

## What is EMA?

**Exponential Moving Average (EMA)** is a weighted average that gives more importance to recent observations while still considering historical performance.

### Formula

```
new_ema = α * new_observation + (1 - α) * old_ema
```

Where:
- **α (alpha)** = smoothing factor (0 < α < 1)
- **new_observation** = score from the latest lesson
- **old_ema** = previous EMA value

### Why EMA?

**Problem with Previous Approach**:
- Used "last-score-wins" replacement
- One bad lesson erased all previous progress
- Caused unstable recommendations (yo-yo effect)

**EMA Benefits**:
- 📈 Smooth progression tracking
- 🛡️ Resilient to outliers (bad days don't catastrophically lower mastery)
- 📊 Better reflects long-term learning trajectory
- 🎯 More stable lesson recommendations

---

## Configuration

### Environment Variables

```bash
# Enable/disable EMA (feature flag for rollback)
NEXT_PUBLIC_ENABLE_EMA=true

# Smoothing factor (0.0-1.0, default: 0.3)
# Lower = more stable, Higher = more responsive
NEXT_PUBLIC_EMA_ALPHA=0.3

# Bootstrap settings for early observations
NEXT_PUBLIC_EMA_BOOTSTRAP_ALPHA=0.5          # Higher alpha for first observations
NEXT_PUBLIC_EMA_BOOTSTRAP_THRESHOLD=3        # Observations before normal alpha
```

### Alpha (α) Selection Guide

| Alpha | Weight on New | Weight on History | Use Case | Half-Life |
|-------|---------------|-------------------|----------|-----------|
| 0.1 | 10% | 90% | Very stable, core skills | ~6.6 lessons |
| 0.2 | 20% | 80% | Stable, established knowledge | ~3.1 lessons |
| **0.3** | **30%** | **70%** | **Default balance** | **~1.9 lessons** |
| 0.4 | 40% | 60% | Responsive, new topics | ~1.4 lessons |
| 0.5 | 50% | 50% | Highly responsive | 1.0 lessons |

**Current Default**: α = 0.3 (balanced approach)

**Half-Life**: Number of lessons needed for an old score's influence to decay to 50%

---

## Examples

### Example 1: Bad Day Recovery

**Scenario**: Student has mastered a topic (0.8) but has one bad lesson (0.3)

**Without EMA (old behavior)**:
```
Old mastery: 0.8
New score: 0.3
Result: 0.3  ❌ All progress lost
```

**With EMA (α = 0.3)**:
```
Old EMA: 0.8
New score: 0.3
New EMA = 0.3 * 0.3 + 0.7 * 0.8 = 0.65  ✅ Drops but not catastrophically
```

### Example 2: Breakthrough Improvement

**Scenario**: Student struggling (0.3) has a breakthrough lesson (1.0)

**Without EMA**:
```
Old mastery: 0.3
New score: 1.0
Result: 1.0  ❌ May be a fluke, needs confirmation
```

**With EMA (α = 0.3)**:
```
Old EMA: 0.3
New score: 1.0
New EMA = 0.3 * 1.0 + 0.7 * 0.3 = 0.51  ✅ Shows improvement, requires consistency
```

### Example 3: Stabilization Over Time

**Scenario**: Student practices consistently at 0.6 level

```
Lesson 1: Bootstrap → 1.0
Lesson 2: 0.7 → 0.85 (adaptive alpha 0.5)
Lesson 3: 0.3 → 0.58 (adaptive alpha 0.5)
Lesson 4: 0.6 → 0.59 (normal alpha 0.3)
Lesson 5: 0.6 → 0.59 (converging)
Lesson 6: 0.6 → 0.60 (stabilized)
```

**EMA converges toward consistent performance level**.

---

## Bootstrap Behavior

### First Observation
```typescript
// First time seeing an outcome
old_ema = null
new_score = 0.8
→ new_ema = 0.8  (bootstrap: set directly)
```

### Early Observations (First 3)
```typescript
// Use higher alpha for faster learning
observation_count < 3
effective_alpha = 0.5  (not 0.3)
→ More responsive to initial patterns
```

### Established Knowledge (4+)
```typescript
// Use normal alpha for stability
observation_count >= 3
effective_alpha = 0.3
→ Stable, history-weighted
```

---

## Implementation Details

### Architecture

**Location**: Frontend (`MasteryDriver.ts`)

**Rationale**:
- Backend remains stateless
- Frontend already has database access
- Simple calculation (no performance impact)
- Separation of concerns maintained

### Data Flow

```
1. Student completes lesson
   ↓
2. Backend calculates raw scores (1.0, 0.7, or 0.3)
   ↓
3. Frontend receives scores via tool call
   ↓
4. Frontend fetches existing MasteryV2 record
   ↓
5. EMA calculator computes new EMAs
   ↓
6. Frontend persists updated MasteryV2
```

### Code Structure

```typescript
// Core calculation (ema-calculator.ts)
calculateEMA(oldEMA, newScore, observationCount, config)

// Batch processing (ema-calculator.ts)
batchCalculateEMAs(existingEMAs, newScores, observationCounts, config)

// Integration (MasteryDriver.ts)
async batchUpdateEMAs(studentId, courseId, newScores, config?)
```

### Feature Flag

EMA can be disabled via environment variable:

```bash
NEXT_PUBLIC_ENABLE_EMA=false
```

When disabled, falls back to legacy direct replacement behavior.

---

## Testing

### Unit Tests

Location: `lib/utils/__tests__/ema-calculator.test.ts`

Coverage:
- ✅ Formula accuracy
- ✅ Bootstrap behavior
- ✅ Adaptive alpha
- ✅ Value clamping [0, 1]
- ✅ Batch operations
- ✅ Edge cases

### Integration Tests

Location: `__tests__/integration/MasteryDriver.test.ts`

Scenarios:
- ✅ Bad day recovery
- ✅ Breakthrough improvement
- ✅ Stabilization over time
- ✅ Untouched outcomes preserved
- ✅ Multiple trajectories

### Running Tests

```bash
cd assistant-ui-frontend
npm test ema-calculator
npm test MasteryDriver
```

---

## Monitoring

### EMA Analytics Logs

Every mastery update logs detailed analytics:

```typescript
[EMA Analytics] {
  studentId: "abc123",
  courseId: "nat5_computing",
  timestamp: "2025-10-21T14:30:00Z",
  alpha: 0.3,
  outcomesUpdated: 2,
  outcomes: [
    {
      outcomeId: "outcome_A",
      oldEMA: 0.80,
      newObservation: 0.30,
      newEMA: 0.65,
      change: -0.15,
      effectiveAlpha: 0.3,
      wasBootstrapped: false
    }
  ]
}
```

### Key Metrics to Monitor

1. **Mastery Stability**: Standard deviation of EMA changes
2. **Recommendation Stability**: Frequency of priority inversions
3. **User Satisfaction**: Student/teacher feedback
4. **Learning Correlation**: EMA vs. actual assessment performance

---

## Tuning Alpha

### If EMA is Too Stable (α = 0.3 too low)

**Symptoms**:
- Mastery doesn't respond quickly enough to real improvements
- Students frustrated by slow progress recognition

**Solution**:
```bash
NEXT_PUBLIC_EMA_ALPHA=0.4  # More responsive
```

### If EMA is Too Responsive (α = 0.3 too high)

**Symptoms**:
- Mastery swings too much between lessons
- Recommendations still unstable

**Solution**:
```bash
NEXT_PUBLIC_EMA_ALPHA=0.2  # More stable
```

### A/B Testing

Test different alpha values with different student cohorts:

```typescript
// Override for testing
import { overrideEMAConfig } from '@/lib/config/ema-config';

// Test cohort A: α = 0.2 (stable)
overrideEMAConfig({ alpha: 0.2 });

// Test cohort B: α = 0.4 (responsive)
overrideEMAConfig({ alpha: 0.4 });
```

---

## Troubleshooting

### Issue: EMA not being applied (scores still direct replacement)

**Check**:
1. Is `NEXT_PUBLIC_ENABLE_EMA=true`?
2. Are logs showing `[EMA mode]` or `[legacy]`?
3. Check browser console for EMA analytics logs

**Solution**: Verify environment variables and restart dev server

### Issue: EMA values outside [0, 1]

**Check**: EMA calculator clamps values automatically

**If seeing invalid values**:
- Check database for corrupted data
- Verify no manual updates bypassing EMA

### Issue: Bootstrap not working (first observation not set directly)

**Check**: `observationCount` should be 0 for first observation

**Debug**:
```typescript
console.log('Bootstrap check:', {
  oldEMA,
  observationCount,
  wasBootstrapped: result.wasBootstrapped
});
```

---

## Rollback Plan

### Quick Rollback (< 5 minutes)

**Option 1: Feature Flag**
```bash
NEXT_PUBLIC_ENABLE_EMA=false
```

**Option 2: Code Revert**
```bash
git revert <commit-hash>
git push origin main
```

### Gradual Rollout

Start with feature flag disabled, enable for:
1. 10% of users (1 day)
2. 50% of users (2 days)
3. 100% of users (ongoing)

Monitor metrics at each stage.

---

## Future Enhancements

### Phase 6: Observation Count Tracking

Track how many lessons contributed to each outcome's EMA:

```typescript
interface MasteryV2Data {
  emaByOutcome: { [outcomeId: string]: number };
  observationCount: { [outcomeId: string]: number };  // NEW
}
```

**Benefits**:
- Confidence intervals
- Better visualization
- Adaptive alpha

### Phase 6: Outcome-Specific Alpha

Different smoothing factors for different types of outcomes:

```typescript
interface CourseOutcome {
  emaAlpha?: number;  // Override default
}

// Examples:
// Core skills: α = 0.2 (stable)
// Advanced topics: α = 0.4 (responsive)
```

---

## References

### Related Documents
- **Implementation Plan**: `tasks/implement-true-ema-mastery-tracking.md`
- **Data Model**: `docs/appwrite-data-model.md`
- **Recommendation Algorithm**: `langgraph-agent/docs/recommendation-algorithm.md`

### Code Locations
- **EMA Calculator**: `assistant-ui-frontend/lib/utils/ema-calculator.ts`
- **EMA Config**: `assistant-ui-frontend/lib/config/ema-config.ts`
- **MasteryDriver**: `assistant-ui-frontend/lib/appwrite/driver/MasteryDriver.ts`
- **Tests**: `assistant-ui-frontend/lib/utils/__tests__/ema-calculator.test.ts`

### External Resources
- [Exponential Moving Average - Wikipedia](https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average)
- [Time Series Smoothing](https://otexts.com/fpp2/ses.html)

---

**Last Updated**: 2025-10-21  
**Version**: 1.0  
**Status**: Production Ready ✅
