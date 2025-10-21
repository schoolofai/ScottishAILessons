# Implementation Plan: True EMA for Mastery Tracking

## Executive Summary

**Goal**: Replace the current "last-score-wins" approach with true Exponential Moving Average (EMA) to provide stable, history-aware mastery tracking that weighs recent performance while preserving historical context.

**Status**: 🟡 In Progress

**Key Benefits**:
- 📈 Smoother mastery progression (reduces yo-yo effects)
- 🛡️ Resilience to bad days (one poor lesson doesn't erase progress)
- 📊 More accurate long-term learning representation
- 🎯 Better recommendation stability (fewer priority swings)

---

## Current State Analysis

### Problem: Last-Score-Wins Approach

The current implementation **replaces** mastery scores rather than blending them:

```typescript
// Current behavior (MasteryDriver.ts:394-398)
Object.entries(emaUpdates).forEach(([outcomeId, score]) => {
  emaByOutcome[outcomeId] = score;  // ❌ DIRECT REPLACEMENT
});
```

**Example Issue**:
```
Student's history for Outcome A: [1.0, 0.9, 0.8, 0.7]
One bad lesson: 0.3
Final mastery: 0.3  ❌ Erases all previous progress
```

### Solution: True EMA

```typescript
// Proposed behavior
newEMA = α * newScore + (1 - α) * oldEMA

// Example with α = 0.3:
Old EMA: 0.8, New score: 0.3
New EMA: 0.3 * 0.3 + 0.7 * 0.8 = 0.65  ✅ Preserves history
```

---

## Phase 1: Design & Architecture Decisions

### Decision 1: Where to Calculate EMA?

**✅ Recommendation: Frontend (MasteryDriver)**

**Rationale**:
- ✅ Backend remains stateless (doesn't need to fetch existing mastery)
- ✅ Frontend already has database access via drivers
- ✅ EMA calculation is simple (one-line formula)
- ✅ Keeps backend focused on pedagogical scoring
- ❌ Con: Frontend must fetch existing mastery before update

**Alternative Rejected**: Backend calculates EMA
- Would require backend to query Appwrite for existing mastery
- Adds database dependency to LangGraph
- Violates separation of concerns

---

### Decision 2: Alpha (α) Value Selection

**✅ Recommendation: α = 0.3 (configurable)**

**Rationale**:
```
α = 0.3 means:
- 30% weight on new observation
- 70% weight on historical EMA
```

**Examples with α = 0.3**:

| Scenario | Old EMA | New Score | New EMA | Interpretation |
|----------|---------|-----------|---------|----------------|
| Bad day | 0.8 | 0.3 | 0.65 | ✅ Drops but not catastrophically |
| Breakthrough | 0.3 | 1.0 | 0.51 | ✅ Improves noticeably |
| Consolidation | 0.6 | 0.6 | 0.60 | ✅ Stable |
| Regression | 0.9 | 0.5 | 0.77 | ✅ Gentle decline |

**Configuration Options**:
- Store α in environment variable: `EMA_ALPHA=0.3`
- Different α per outcome type (future enhancement)
- Adaptive α based on confidence (future enhancement)

---

### Decision 3: Schema Changes

**✅ Recommendation: Option A - Minimal (No Schema Changes)**

No schema changes - calculate EMA in-place during `batchUpdateEMAs`

**Future Enhancement (Phase 6)**: Add metadata fields:
```typescript
interface MasteryV2Data {
  studentId: string;
  courseId: string;
  emaByOutcome: { [outcomeId: string]: number };
  
  // FUTURE FIELDS (Phase 6):
  observationCount?: { [outcomeId: string]: number };  // How many lessons contributed
  lastObservation?: { [outcomeId: string]: number };   // Most recent raw score
  alpha?: number;                                       // EMA smoothing factor
  updatedAt: string;
}
```

---

### Decision 4: First Observation Handling

**✅ Recommendation: Bootstrap Strategy with Adaptive Alpha**

```typescript
if (observationCount === 0 || oldEMA === null || oldEMA === 0.0) {
  // First observation: set EMA directly
  newEMA = newScore;
  effectiveAlpha = 1.0;
} else if (observationCount < 3) {
  // First few observations: higher responsiveness
  newEMA = 0.5 * newScore + 0.5 * oldEMA;
  effectiveAlpha = 0.5;
} else {
  // Established knowledge: normal EMA
  newEMA = 0.3 * newScore + 0.7 * oldEMA;
  effectiveAlpha = 0.3;
}
```

---

## Phase 2: Core Implementation

### Task 2.1: Create EMA Utility Function ✅ TO IMPLEMENT

**File**: `assistant-ui-frontend/lib/utils/ema-calculator.ts` (new file)

**Exports**:
- `calculateEMA()` - Single outcome EMA calculation
- `batchCalculateEMAs()` - Multiple outcomes
- `simulateEMATrajectory()` - Testing/visualization helper

**Features**:
- Bootstrap for first observation
- Adaptive alpha for early observations
- Value clamping [0, 1]
- Detailed calculation metadata
- Configurable parameters

**Test Coverage**: Unit tests in `__tests__/ema-calculator.test.ts`

---

### Task 2.2: Update MasteryDriver ✅ TO IMPLEMENT

**File**: `assistant-ui-frontend/lib/appwrite/driver/MasteryDriver.ts`

**Changes**:
- Import `batchCalculateEMAs` from utility
- Modify `batchUpdateEMAs` method (lines 375-421)
- Fetch existing mastery before calculating new EMAs
- Apply EMA formula instead of direct replacement
- Add detailed logging for debugging

**Backward Compatibility**: ✅ No breaking changes to method signature

---

### Task 2.3: Frontend Component ✅ NO CHANGES

**File**: `assistant-ui-frontend/components/tools/LessonCompletionSummaryTool.tsx`

✅ **No changes required** - Component already calls `batchUpdateEMAs` correctly.

---

### Task 2.4: Configuration ✅ TO IMPLEMENT

**Files**:
- `.env.local` - Environment variables
- `lib/config/ema-config.ts` - Config loader with validation

**Environment Variables**:
```bash
NEXT_PUBLIC_EMA_ALPHA=0.3                    # Smoothing factor
NEXT_PUBLIC_EMA_BOOTSTRAP_ALPHA=0.5          # Higher responsiveness for first observations
NEXT_PUBLIC_EMA_BOOTSTRAP_THRESHOLD=3        # Observations before normal alpha
NEXT_PUBLIC_ENABLE_EMA=true                  # Feature flag for rollback
```

---

## Phase 3: Data Migration Strategy

### ✅ Recommendation: Option A - No Migration

**Strategy**: Accept existing values as "current EMA" and apply true EMA going forward.

**Rationale**:
- ✅ Zero migration effort
- ✅ No data loss
- ✅ System self-corrects over time (new lessons smooth out old values)
- ✅ Mathematically valid (existing score = "EMA after 1 observation")
- ❌ First few lessons post-migration may show discontinuity

**Implementation**:
```typescript
// Treat existing scores as if they were calculated with EMA
// Next observation will apply: new_ema = 0.3 * new_score + 0.7 * old_score
// No migration script needed
```

**Alternative Rejected**: Soft reset with confidence adjustment
- Adds complexity
- Loses information
- Not necessary for correct EMA going forward

---

## Phase 4: Testing & Validation

### Task 4.1: Unit Tests ✅ TO IMPLEMENT

**File**: `assistant-ui-frontend/lib/utils/__tests__/ema-calculator.test.ts`

**Coverage**:
- ✅ EMA calculation accuracy (formula verification)
- ✅ Bootstrap behavior (first observations)
- ✅ Adaptive alpha (first 3 observations use higher alpha)
- ✅ Clamping (bounds checking [0, 1])
- ✅ Batch operations (multiple outcomes)
- ✅ Config validation (invalid alpha values)
- ✅ Edge cases (null, zero, negative values)

---

### Task 4.2: Integration Tests ✅ TO IMPLEMENT

**File**: `assistant-ui-frontend/__tests__/integration/MasteryDriver.test.ts`

**New Test Cases**:
- EMA applied correctly on second update
- Untouched outcomes preserved during updates
- EMA stabilization over multiple lessons
- Bootstrap behavior on first observation
- Config override works correctly

---

### Task 4.3: End-to-End Testing ⏭️ MANUAL

**Manual Test Scenario**:
1. Enroll in course → Check MasteryV2 initialized with 0.0 values
2. Complete Lesson 1 (perfect) → Verify EMA = 1.0 (bootstrap)
3. Complete Lesson 2 (poor 0.3) → Verify EMA ≈ 0.65 (not 0.3)
4. Complete Lesson 3 (perfect 1.0) → Verify EMA ≈ 0.76 (not 1.0)
5. Check dashboard → Verify mastery shows smooth progression

**Playwright Test** (optional):
- File: `e2e/tests/ema-mastery-tracking.spec.ts`
- Automate the manual scenario above

---

## Phase 5: Monitoring & Analytics

### Task 5.1: Enhanced Logging ✅ IMPLEMENTED IN TASK 2.2

**Location**: MasteryDriver.batchUpdateEMAs method

**Log Format**:
```typescript
console.log('[EMA Analytics]', {
  studentId: 'abc123',
  courseId: 'nat5_computing',
  timestamp: '2025-10-21T14:30:00Z',
  outcomes: [
    {
      outcomeId: 'outcome_A',
      oldEMA: 0.80,
      newObservation: 0.30,
      newEMA: 0.65,
      change: -0.15,
      effectiveAlpha: 0.3,
      wasBootstrapped: false
    }
  ]
});
```

---

### Task 5.2: Dashboard Visualization ⏭️ FUTURE ENHANCEMENT

**Component**: `components/dashboard/MasteryTrendChart.tsx` (new)

**Features**:
- Line chart showing EMA progression over time
- Raw scores vs. EMA overlay
- Highlight bootstrap observations
- Show effective alpha for each point

**Requires**: Observation count tracking (Phase 6)

---

## Phase 6: Advanced Enhancements (Optional)

### Enhancement 6.1: Observation Count Tracking

**Schema Extension**:
```typescript
interface MasteryV2Data {
  emaByOutcome: { [outcomeId: string]: number };
  observationCount: { [outcomeId: string]: number };  // NEW
  updatedAt: string;
}
```

**Benefits**:
- Confidence intervals (more observations = higher confidence)
- Adaptive alpha (higher for new content, lower for established)
- Analytics (how many lessons contributed to each outcome)
- Better dashboard visualizations

**Effort**: ~1 week (schema migration, driver updates, tests)

---

### Enhancement 6.2: Adaptive Alpha

**Strategy**: Adjust alpha based on observation count

```typescript
function getAdaptiveAlpha(observationCount: number): number {
  if (observationCount < 3) return 0.5;      // Responsive to early patterns
  if (observationCount < 10) return 0.3;     // Standard learning
  return 0.2;                                // Stable, established knowledge
}
```

**Benefits**:
- More responsive to initial learning patterns
- More stable for well-established knowledge
- Better reflects learning curve stages

**Effort**: ~2 days (update calculator, add tests)

---

### Enhancement 6.3: Outcome-Specific Alpha

**Strategy**: Different α for different types of outcomes

**Schema Addition**:
```typescript
interface CourseOutcome {
  outcomeRef: string;
  emaAlpha?: number;  // Optional override (default: 0.3)
}
```

**Use Cases**:
- Core skills (multiplication): α = 0.2 (stable, slow to change)
- Advanced topics (calculus): α = 0.4 (responsive, rapid learning)
- Memorization (vocabulary): α = 0.5 (highly responsive)

**Effort**: ~1 week (schema update, driver lookup, curriculum authoring)

---

## Implementation Timeline

### Sprint 1 (Week 1): Foundation & Core Implementation

**Days 1-2**:
- [x] Create planning document
- [ ] Task 2.1: Create EMA utility function
- [ ] Task 4.1: Unit tests for EMA calculator

**Days 3-4**:
- [ ] Task 2.2: Update MasteryDriver
- [ ] Task 2.4: Add configuration
- [ ] Task 4.2: Integration tests

**Day 5**:
- [ ] Code review
- [ ] Documentation updates
- [ ] Merge to main branch

---

### Sprint 2 (Week 2): Testing & Validation

**Days 1-2**:
- [ ] Deploy to staging environment
- [ ] Task 4.3: Manual E2E testing
- [ ] Monitor staging logs for EMA calculations

**Days 3-4**:
- [ ] Test with multiple student accounts
- [ ] Verify Course Manager recommendations stabilize
- [ ] Load testing (concurrent updates)

**Day 5**:
- [ ] Production deployment preparation
- [ ] Rollback plan verification
- [ ] Deploy to production (with feature flag)

---

### Sprint 3 (Week 3): Monitoring & Refinement

**Days 1-5**:
- [ ] Monitor production EMA calculations
- [ ] Gather user feedback (students/teachers)
- [ ] Analyze mastery stability metrics
- [ ] Tune alpha if needed (0.3 → 0.25 or 0.35)
- [ ] Enable EMA for 100% of users (remove feature flag)

---

### Sprint 4+ (Week 4+): Advanced Enhancements (Optional)

- [ ] Enhancement 6.1: Observation count tracking
- [ ] Enhancement 6.2: Adaptive alpha
- [ ] Task 5.2: Dashboard visualization
- [ ] Enhancement 6.3: Outcome-specific alpha

---

## Rollback Plan

### Emergency Rollback (< 5 minutes)

**Option 1: Feature Flag**
```bash
# .env.local
NEXT_PUBLIC_ENABLE_EMA=false
```

**Option 2: Code Revert**
```typescript
// In MasteryDriver.batchUpdateEMAs
// Comment out EMA calculation, restore direct replacement:
Object.entries(emaUpdates).forEach(([outcomeId, score]) => {
  emaByOutcome[outcomeId] = score;  // Back to old behavior
});
```

**Option 3: Git Revert**
```bash
git revert <commit-hash>
git push origin main
# Redeploy frontend
```

---

## Success Metrics

### Primary Metrics

1. **Mastery Stability**
   - **Metric**: Standard deviation of mastery changes per outcome
   - **Target**: 30% reduction in variance
   - **Measurement**: Compare 2 weeks pre/post implementation

2. **Recommendation Stability**
   - **Metric**: Frequency of lesson priority inversions
   - **Target**: 50% reduction in "yo-yo" recommendations
   - **Measurement**: Track Course Manager recommendation changes

3. **User Experience**
   - **Metric**: Student/teacher feedback on mastery accuracy
   - **Target**: 80% satisfaction rate
   - **Measurement**: In-app survey + interviews

4. **Learning Analytics**
   - **Metric**: Correlation between EMA and long-term retention
   - **Target**: 15% improvement in predictive accuracy
   - **Measurement**: Compare EMA vs. actual test performance

---

### Secondary Metrics

5. **System Performance**
   - Database query time for mastery updates
   - Frontend calculation latency
   - Memory usage for EMA calculations

6. **Data Quality**
   - Percentage of outcomes with >5 observations
   - EMA convergence rate (time to stabilize)
   - Outlier detection (extreme EMA changes)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Alpha too low (0.3 too stable) | Medium | Medium | Configurable alpha, easy to tune |
| Alpha too high (too responsive) | Low | Low | Start at 0.3, monitor and adjust |
| Performance degradation | Low | Medium | Simple calculation, well-tested |
| Data migration issues | Low | Low | No migration needed (Option 3A) |
| User confusion (scores change slowly) | Low | Low | Dashboard shows trend, not just final EMA |
| Rollback needed | Low | Low | Feature flag + 5-min rollback plan |

---

## Documentation Updates

### Files to Update

1. **`docs/appwrite-data-model.md`**
   - Update MasteryV2 description to mention EMA calculation
   - Add formula: `new_ema = α * new_score + (1 - α) * old_ema`
   - Explain bootstrap behavior

2. **`assistant-ui-frontend/README.md`**
   - Add EMA configuration section
   - Explain alpha parameter tuning
   - Link to new EMA documentation

3. **`langgraph-agent/docs/recommendation-algorithm.md`**
   - Update mastery scoring section to reflect EMA smoothing
   - Explain how EMA improves recommendation stability
   - Show before/after examples

4. **New file**: `docs/ema-mastery-tracking.md`
   - Complete EMA documentation
   - Mathematical foundation (formula derivation)
   - Examples with different alpha values
   - Troubleshooting guide
   - Comparison with alternatives (simple average, weighted average)

---

## Testing Checklist

### Unit Tests
- [ ] EMA formula accuracy (compare with manual calculation)
- [ ] Bootstrap first observation (returns input directly)
- [ ] Adaptive alpha (higher for first 3 observations)
- [ ] Value clamping (bounds [0, 1])
- [ ] Batch operations (multiple outcomes processed correctly)
- [ ] Config validation (reject invalid alpha)
- [ ] Edge cases (null, zero, negative, NaN)
- [ ] Trajectory simulation (convergence behavior)

### Integration Tests
- [ ] First mastery update (bootstrap)
- [ ] Second mastery update (EMA applied)
- [ ] Third mastery update (normal alpha used)
- [ ] Untouched outcomes preserved
- [ ] Multiple outcomes updated simultaneously
- [ ] Config override works
- [ ] Auto-creation of initial MasteryV2 record

### End-to-End Tests
- [ ] Complete lesson with perfect score (EMA = 1.0)
- [ ] Complete second lesson poorly (EMA drops gracefully)
- [ ] Complete third lesson perfectly (EMA recovers gradually)
- [ ] Dashboard shows smooth progression
- [ ] Course Manager recommendations stabilize
- [ ] Multiple students updating concurrently

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Feature flag configured
- [ ] Rollback plan tested
- [ ] Staging environment validated

### Deployment
- [ ] Deploy frontend to staging
- [ ] Smoke test on staging (enroll, complete lesson, check EMA)
- [ ] Monitor staging for 24 hours
- [ ] Deploy to production with feature flag OFF
- [ ] Enable feature flag for 10% of users
- [ ] Monitor for 48 hours
- [ ] Gradually increase to 50%, then 100%

### Post-Deployment
- [ ] Monitor EMA calculation logs
- [ ] Track success metrics (mastery stability, etc.)
- [ ] Gather user feedback
- [ ] Document any issues or unexpected behavior
- [ ] Plan next iteration (adaptive alpha, etc.)

---

## Summary

**Total Effort**: 3-4 weeks (with testing, monitoring, and refinement)

**Core Changes**:
- ✅ New utility: `ema-calculator.ts` (~200 LOC)
- ✅ Updated: `MasteryDriver.batchUpdateEMAs` (~50 LOC changed)
- ✅ Tests: ~300 LOC
- ✅ Config: ~20 LOC
- ✅ Total new/modified code: ~570 LOC
- ✅ No backend changes required
- ✅ No database schema migration required

**Expected Outcomes**:
- 📈 70% reduction in mastery score volatility (estimated)
- 🛡️ Protects against "bad day" performance drops
- 🎯 50% reduction in recommendation priority swings
- 📊 Better reflects long-term learning trajectory
- 🎓 Improved student confidence (gradual progress shown)

**Key Success Factors**:
- Feature flag for safe rollout
- Configurable alpha for tuning
- Comprehensive testing at all levels
- Clear documentation for maintenance
- Monitoring and analytics in place

---

## Appendix: EMA Formula Derivation

### Basic EMA Formula
```
EMA(t) = α * X(t) + (1 - α) * EMA(t-1)

Where:
- EMA(t) = Exponential moving average at time t
- X(t) = New observation at time t
- α = Smoothing factor (0 < α < 1)
- EMA(t-1) = Previous EMA value
```

### Expanded Form (Historical Weighting)
```
EMA(t) = α * X(t) + α(1-α) * X(t-1) + α(1-α)² * X(t-2) + α(1-α)³ * X(t-3) + ...

Shows that:
- Most recent observation: weight = α
- Previous observation: weight = α(1-α)
- Two observations ago: weight = α(1-α)²
- etc.

Weights decay exponentially with age.
```

### Example with α = 0.3
```
Observation weights:
- X(t):     0.3
- X(t-1):   0.3 * 0.7 = 0.21
- X(t-2):   0.3 * 0.49 = 0.147
- X(t-3):   0.3 * 0.343 = 0.103
- X(t-4):   0.3 * 0.240 = 0.072

Sum approaches 1.0 (weights normalized)
```

### Half-Life Calculation
```
Half-life = ln(0.5) / ln(1 - α)

For α = 0.3:
Half-life = ln(0.5) / ln(0.7) ≈ 1.9 observations

Meaning: After ~2 lessons, an old score's influence drops to 50%.
```

---

## Contact & Support

**Implementation Lead**: Development Team  
**Documentation**: This file  
**Questions**: See inline comments or ask in team chat  
**Issues**: Track in project management tool  

**Last Updated**: 2025-10-21  
**Status**: Ready for Implementation ✅
