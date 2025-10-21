# EMA Quick Start Guide

## ✅ Implementation Complete!

True Exponential Moving Average (EMA) for mastery tracking has been implemented and is ready for testing.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Configure Environment

Add these lines to your `.env.local` (or set as environment variables):

```bash
# EMA Configuration
NEXT_PUBLIC_ENABLE_EMA=true                    # Enable EMA
NEXT_PUBLIC_EMA_ALPHA=0.3                      # Smoothing factor (recommended)
NEXT_PUBLIC_EMA_BOOTSTRAP_ALPHA=0.5            # Higher for first observations
NEXT_PUBLIC_EMA_BOOTSTRAP_THRESHOLD=3          # Bootstrap cutoff
```

### Step 2: Start Development Server

```bash
cd langgraph-agent
./start.sh
```

### Step 3: Test EMA

1. **Login** as test student (test@scottishailessons.com / red12345)
2. **Enroll** in a course
3. **Complete Lesson 1** with perfect score
4. **Check console** - you should see:
   ```
   [EMA Config] Loaded configuration: { alpha: 0.3, enabled: true }
   [EMA Analytics] { studentId: "...", outcomes: [{ wasBootstrapped: true, newEMA: 1.0 }] }
   ```
5. **Complete Lesson 2** with poor score (0.3)
6. **Check console** - EMA should show ~0.65 (not 0.3!):
   ```
   [EMA Analytics] { oldEMA: 1.0, newObservation: 0.3, newEMA: 0.72, change: -0.28 }
   ```

### Step 4: Verify in Appwrite

1. Go to Appwrite dashboard
2. Open `MasteryV2` collection
3. Find your student's record
4. Check `emaByOutcome` field - should show gradual changes, not jumps

---

## 🎯 What to Expect

### Scenario: Bad Day Recovery

**Without EMA (Old)**:
```
Lesson 1: Score 0.9 → Mastery = 0.9
Lesson 2: Score 0.3 → Mastery = 0.3  ❌ All progress lost
```

**With EMA (New)**:
```
Lesson 1: Score 0.9 → EMA = 0.9 (bootstrap)
Lesson 2: Score 0.3 → EMA = 0.72   ✅ Gradual decline (protected)
Lesson 3: Score 0.9 → EMA = 0.78   ✅ Gradual recovery
```

### Scenario: Consistent Performance

**Without EMA**:
```
Scores: [0.8, 0.6, 0.8, 0.6, 0.8]
Mastery: Jumps between 0.8 and 0.6 (volatile)
```

**With EMA**:
```
Scores: [0.8, 0.6, 0.8, 0.6, 0.8]
EMA: 0.8 → 0.7 → 0.73 → 0.70 → 0.73 (smooth convergence)
```

---

## 🔍 How to Monitor

### Console Logs to Watch For

#### On Startup
```
[EMA Config] Loaded configuration: {
  alpha: 0.3,
  bootstrapAlpha: 0.5,
  bootstrapThreshold: 3,
  enabled: true,
  halfLife: 1.94
}
```

#### On Lesson Completion
```
[MasteryDriver] batchUpdateEMAs called (EMA mode): {
  studentId: "abc123",
  courseId: "nat5_computing",
  newScores: { "outcome_1": 0.3, "outcome_2": 0.8 },
  alpha: 0.3,
  enabled: true
}

[MasteryDriver] EMA calculations:
  outcome_1: 0.800 → 0.650 (Δ-0.150, α=0.3)
  outcome_2: 0.400 → 0.520 (Δ+0.120, α=0.3)

[EMA Analytics] {
  studentId: "abc123",
  courseId: "nat5_computing",
  timestamp: "2025-10-21T14:30:00Z",
  alpha: 0.3,
  outcomesUpdated: 2,
  outcomes: [
    {
      outcomeId: "outcome_1",
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

#### Key Indicators
- ✅ `(EMA mode)` - EMA is active
- ✅ `wasBootstrapped: true` - First observation
- ✅ `effectiveAlpha: 0.5` - Adaptive alpha (first 3)
- ✅ `effectiveAlpha: 0.3` - Normal alpha (4+)
- ✅ `change: -0.15` - Gradual change (not -0.50)

---

## 🛠️ Troubleshooting

### Issue: Not seeing EMA logs

**Check**:
1. Is `NEXT_PUBLIC_ENABLE_EMA=true` in your environment?
2. Did you restart the dev server after adding variables?
3. Check browser console (not terminal)

### Issue: Seeing "legacy" instead of "EMA mode"

**Solution**:
```bash
# Verify environment variable
echo $NEXT_PUBLIC_ENABLE_EMA

# Should output: true
# If not, add to .env.local and restart
```

### Issue: Mastery still jumping directly to new scores

**Debug**:
```typescript
// Check in browser console
console.log('EMA Config:', window.process?.env?.NEXT_PUBLIC_ENABLE_EMA);

// Should be "true"
```

**Fix**: Environment variables must start with `NEXT_PUBLIC_` for Next.js

---

## ⚙️ Configuration Options

### Default (Recommended)
```bash
NEXT_PUBLIC_EMA_ALPHA=0.3  # Balanced
```
- **Use case**: General purpose
- **Behavior**: 30% new, 70% history
- **Half-life**: ~1.9 lessons

### More Stable
```bash
NEXT_PUBLIC_EMA_ALPHA=0.2  # Conservative
```
- **Use case**: Core skills that shouldn't change rapidly
- **Behavior**: 20% new, 80% history
- **Half-life**: ~3.1 lessons

### More Responsive
```bash
NEXT_PUBLIC_EMA_ALPHA=0.4  # Reactive
```
- **Use case**: New topics with rapid learning
- **Behavior**: 40% new, 60% history
- **Half-life**: ~1.4 lessons

---

## 🧪 Testing Scenarios

### Test 1: Bootstrap (First Lesson)
1. Enroll in new course
2. Complete first lesson perfectly
3. **Expected**: EMA = 1.0 (bootstrap), `wasBootstrapped: true`

### Test 2: Bad Day Protection
1. Complete lesson with EMA = 0.8
2. Complete next lesson with score 0.3
3. **Expected**: New EMA ≈ 0.65 (not 0.3)

### Test 3: Gradual Improvement
1. Complete lesson with EMA = 0.3
2. Complete next lesson with score 1.0
3. **Expected**: New EMA ≈ 0.51 (not 1.0)

### Test 4: Stabilization
1. Complete 5 lessons with score 0.6
2. **Expected**: EMA converges toward 0.6

---

## 🔄 Rollback (If Needed)

### Instant Rollback (< 1 minute)
```bash
# Change in .env.local
NEXT_PUBLIC_ENABLE_EMA=false

# Restart dev server
cd langgraph-agent
./stop.sh
./start.sh
```

### Verify Rollback
```
Console should show: [MasteryDriver] Using legacy direct replacement (EMA disabled)
```

---

## 📚 Documentation

**Full Details**: See these files for complete information:
- `tasks/implement-true-ema-mastery-tracking.md` - Complete implementation plan
- `docs/ema-mastery-tracking.md` - User documentation
- `tasks/EMA_IMPLEMENTATION_STATUS.md` - Status and code changes
- `IMPLEMENTATION_SUMMARY.md` - Summary and metrics

**Code Files**:
- `assistant-ui-frontend/lib/utils/ema-calculator.ts` - EMA logic
- `assistant-ui-frontend/lib/config/ema-config.ts` - Configuration
- `assistant-ui-frontend/lib/appwrite/driver/MasteryDriver.ts` - Integration

---

## ✅ Success Checklist

After testing, you should see:
- [ ] `[EMA Config]` logs on startup
- [ ] `[EMA mode]` in batchUpdateEMAs logs
- [ ] `[EMA Analytics]` logs after lessons
- [ ] Gradual mastery changes (not jumps)
- [ ] Bootstrap behavior on first lesson
- [ ] Adaptive alpha (0.5) for first 3 lessons
- [ ] Normal alpha (0.3) after 3 lessons

---

## 🎉 Ready to Deploy?

Once manual testing confirms EMA works as expected:

1. ✅ Verify all logs show correct behavior
2. ✅ Test rollback (disable and re-enable)
3. ✅ Deploy to staging for extended testing
4. ✅ Monitor for 24-48 hours
5. ✅ Deploy to production with feature flag
6. ✅ Monitor metrics (mastery stability, user feedback)

---

**Questions?** Check the full documentation or console logs for debugging info.

**Status**: ✅ READY FOR TESTING
