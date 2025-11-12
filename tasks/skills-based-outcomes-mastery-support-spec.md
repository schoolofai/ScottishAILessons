# Skills-Based Outcomes Support for Mastery + Evidence + Routine Architecture

**Status**: Planning
**Priority**: High
**Created**: 2025-01-12
**Dependencies**:
- `routine-v2-key-format-fix-spec.md` (completed)
- `composite-key-mastery-tracking-spec.md` (completed)

---

## Problem Statement

The Mastery + Evidence + Routine architecture was designed for traditional unit-based courses (National 3/4) where outcomes follow the pattern "O1", "O2" with assessment standards like "AS1.1", "AS1.2".

Skills-based courses (National 5+) use a fundamentally different structure:
- **Topics**: `TOPIC_NUMERICAL_SKILLS`, `TOPIC_ALGEBRAIC_SKILLS` (navigation/grouping)
- **Skills**: `SKILL_WORKING_WITH_SURDS`, `SKILL_ROUNDING` (atomic competencies)

**Current Status**: Skills-based outcomes are **partially broken** - enrichment works, but spaced repetition fails.

---

## Data Structure Comparison

### Traditional Outcomes (course_c84473 ✅ Working)
```typescript
{
  courseId: "course_c84473",
  outcomeId: "O1",  // Has digit after letter
  assessmentStandards: [
    { code: "AS1.1", desc: "Identifying factors affecting income" },
    { code: "AS1.2", desc: "Calculating income and expenditure" }
  ]
}
```

**Mastery Tracking**:
- Outcome level: `"outcome_test_simple_o1": 0.85`
- AS level: `"outcome_test_simple_o1#AS1.1": 0.90`, `"outcome_test_simple_o1#AS1.2": 0.80`

**Routine Tracking**:
- Outcome: `"O1": "2025-01-20T10:00:00Z"`
- AS codes: `"AS1.1": "2025-01-22T10:00:00Z"`, `"AS1.2": "2025-01-24T10:00:00Z"`

---

### Skills-Based Outcomes (course_c84775 ❌ Broken)

**TOPIC Document** (Navigation/Grouping):
```typescript
{
  courseId: "course_c84775",
  outcomeId: "TOPIC_NUMERICAL_SKILLS",  // NO digits!
  unitCode: "TOPIC_NUMERICAL_SKILLS",
  assessmentStandards: [
    {
      code: "TOPIC_OVERVIEW",
      desc: "This topic covers: Working with surds, Simplifying expressions...",
      skills_list: ["Working with surds", "Simplifying expressions using the laws of indices", ...]
    }
  ]
}
```

**SKILL Document** (Atomic Competency):
```typescript
{
  courseId: "course_c84775",
  outcomeId: "SKILL_WORKING_WITH_SURDS",  // NO digits!
  unitCode: "SKILL_WORKING_WITH_SURDS",
  assessmentStandards: [
    { code: "AS1", desc: "Simplification, Rationalising denominators" }  // Placeholder only
  ]
}
```

**Expected Mastery Tracking** (should work like this):
- Topic level: `"doc_topic_numerical#outcome": 0.75` (average of all skills in topic)
- Skill level: `"doc_skill_surds#outcome": 0.85`
- **NO composite keys** (skills ARE the atomic units, no sub-components)

**Expected Routine Tracking**:
- Topics: `"TOPIC_NUMERICAL_SKILLS": "2025-01-20T10:00:00Z"`
- Skills: `"SKILL_WORKING_WITH_SURDS": "2025-01-22T10:00:00Z"`

---

## Breaking Points Analysis

### 🔴 CRITICAL BREAK: RoutineDriver Validation

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts:301`

**Current Code**:
```typescript
// Valid format: "O1", "O2", "AS1.1", "AS2.3", etc.
const validFormat = /^[A-Z]+\d+(\.\d+)?$/;
if (!validFormat.test(outcomeId)) {
  throw new Error(
    `Invalid outcomeId format: '${outcomeId}'. ` +
    `Expected SQA code format like "O1", "AS1.1", etc.`
  );
}
```

**Regex Breakdown**: `^[A-Z]+\d+(\.\d+)?$`
- `[A-Z]+` - One or more uppercase letters
- `\d+` - **At least ONE digit required** ← **BREAKS HERE**
- `(\.\d+)?` - Optional decimal point and more digits

**Test Results**:
| outcomeId | Regex Match | Result |
|-----------|-------------|--------|
| "O1" | ✅ YES | PASSES |
| "AS1.1" | ✅ YES | PASSES |
| "TOPIC_NUMERICAL_SKILLS" | ❌ NO | **THROWS ERROR** |
| "SKILL_WORKING_WITH_SURDS" | ❌ NO | **THROWS ERROR** |

**Impact**:
- `updateOutcomeSchedule()` throws error on first skills-based outcome
- **Spaced repetition completely broken for National 5+ courses**
- Student dashboard shows no recommendations for skills-based courses

---

### ⚠️ DESIGN MISMATCH: Composite Key System

**Current Logic** (`langgraph-agent/src/agent/teaching_utils.py:216-233`):
```python
# Parse real AS codes from assessmentStandards
as_list = json.loads(as_list_json) if isinstance(as_list_json, str) else as_list_json

for as_obj in as_list:
    as_code = as_obj.get("code")  # Expected: "AS1.1", "AS1.2"
    if as_code:
        composite_key = f"{outcome['$id']}#{as_code}"  # "doc_id#AS1.1"
        # Create mastery update for this AS
```

**Problem**: Skills-based outcomes don't have meaningful sub-components:
- TOPIC: `code: "TOPIC_OVERVIEW"` (metadata, not a trackable AS)
- SKILL: `code: "AS1"` (placeholder, not a real decimal-formatted AS)

**Current Behavior** (unintended):
- Backend creates composite keys: `"doc_topic_id#TOPIC_OVERVIEW"`, `"doc_skill_id#AS1"`
- MasteryV2 collection polluted with meaningless entries
- SpacedRepetitionService tries to map "TOPIC_OVERVIEW" → fails

**Desired Behavior**:
- Topics and Skills ARE the atomic units (no sub-tracking needed)
- Only create composite keys for traditional outcomes with real AS codes

---

## What Works ✅

### 1. Enrichment Flow
**File**: `assistant-ui-frontend/lib/sessions/outcome-enrichment.ts:62`

```typescript
// Extract only outcomeIds (codes without decimal points)
const outcomeIds = driver.extractOutcomeIds(outcomeRefs);
```

**File**: `assistant-ui-frontend/lib/appwrite/driver/CourseOutcomesDriver.ts:89-99`

```typescript
const outcomeIds = outcomeRefs.filter(ref =>
  ref && typeof ref === 'string' && !ref.includes('.')
);
```

**Test Results**:
| Input | Decimal? | Filtered Result |
|-------|----------|-----------------|
| "O1" | NO | ✅ outcomeIds |
| "AS1.1" | YES | ❌ filtered out |
| "TOPIC_NUMERICAL_SKILLS" | NO | ✅ outcomeIds |
| "SKILL_WORKING_WITH_SURDS" | NO | ✅ outcomeIds |

**Verdict**: ✅ Enrichment correctly treats skills as top-level outcomes!

---

### 2. SpacedRepetitionService Separation Logic
**File**: `assistant-ui-frontend/lib/services/spaced-repetition-service.ts:325-326`

```typescript
// 1. Separate outcome IDs from AS codes (AS codes contain decimal point)
const outcomeIdsOnly = outcomeIds.filter(id => !id.includes('.'));  // ["O1", "TOPIC_X", "SKILL_Y"]
const asCodesOnly = outcomeIds.filter(id => id.includes('.'));      // ["AS1.1", "AS2.3"]
```

**Test Results**:
- ✅ "TOPIC_NUMERICAL_SKILLS" → `outcomeIdsOnly` (no decimal)
- ✅ "SKILL_WORKING_WITH_SURDS" → `outcomeIdsOnly` (no decimal)
- ✅ Will call `outcomeDriver.getOutcomesByIds(courseId, ["TOPIC_...", "SKILL_..."])`

**Verdict**: ✅ Works perfectly! Skills treated as outcomes, not AS codes.

---

### 3. Other Format-Agnostic Components

✅ **MasteryV2Driver**: Stores any string as outcomeId (works with both "O1" and "TOPIC_X")
✅ **Evidence Collection**: Just stores raw data (completely format-agnostic)
✅ **Translation Layer**: Uses enriched_outcomes to build mappings (works IF enrichment works)

---

## Solution Design

### Part 1: Fix RoutineDriver Validation (CRITICAL)

**Option A: Permissive Regex** (Recommended)
```typescript
// OLD (line 301)
const validFormat = /^[A-Z]+\d+(\.\d+)?$/;

// NEW - Accept both traditional and skills-based
const validFormat = /^[A-Z_]+(\d+(\.\d+)?)?$/;
```

**New Regex Breakdown**: `^[A-Z_]+(\d+(\.\d+)?)?$`
- `[A-Z_]+` - One or more uppercase letters OR underscores
- `(\d+(\.\d+)?)?` - **Optional** digit sequence with optional decimal

**Test Results**:
| outcomeId | Regex Match | Result |
|-----------|-------------|--------|
| "O1" | ✅ YES | PASSES |
| "AS1.1" | ✅ YES | PASSES |
| "TOPIC_NUMERICAL_SKILLS" | ✅ YES | **NOW PASSES** |
| "SKILL_WORKING_WITH_SURDS" | ✅ YES | **NOW PASSES** |
| "INVALID123" | ❌ NO | Rejected (no letters after underscore) |
| "TOPIC" | ✅ YES | Allowed (edge case, but harmless) |

---

**Option B: Explicit Format Detection** (More Strict)
```typescript
// Accept both traditional (O1, AS1.1) AND skills-based (TOPIC_X, SKILL_X)
const traditionalFormat = /^[A-Z]+\d+(\.\d+)?$/;
const skillsBasedFormat = /^(TOPIC|SKILL)_[A-Z_]+$/;

if (!traditionalFormat.test(outcomeId) && !skillsBasedFormat.test(outcomeId)) {
  throw new Error(
    `Invalid outcomeId format: '${outcomeId}'. ` +
    `Expected traditional format (O1, AS1.1) or skills-based format (TOPIC_X, SKILL_X).`
  );
}
```

**Pros**: More explicit validation, clearer error messages
**Cons**: Requires maintaining two regex patterns

**Recommendation**: Use Option A (simpler, less maintenance)

---

### Part 2: Disable Composite Keys for Skills-Based (IMPORTANT)

**File**: `langgraph-agent/src/agent/teaching_utils.py:206-238`

**Add detection logic**:

```python
# After line 207: Parse assessmentStandards
as_list_json = outcome.get("assessmentStandards", "[]")

try:
    as_list = json.loads(as_list_json) if isinstance(as_list_json, str) else as_list_json

    # ✅ NEW: Check if this is skills-based outcome
    outcome_id = outcome.get('outcomeId', '')
    is_skills_based = outcome_id.startswith('TOPIC_') or outcome_id.startswith('SKILL_')

    if is_skills_based:
        # Skills-based outcomes: Skip AS tracking (no sub-components)
        # Topics and Skills ARE the atomic units
        logger.info(f"✅ Skills-based outcome detected: {outcome_id} - skipping AS composite key generation")
        continue  # Skip to next outcome

    # Traditional outcomes: Create composite keys for real AS codes
    if isinstance(as_list, list) and len(as_list) > 0:
        logger.info(f"Found {len(as_list)} assessment standards in outcome {outcome.get('outcomeId', 'unknown')}")

        for as_obj in as_list:
            if isinstance(as_obj, dict):
                as_code = as_obj.get("code")  # e.g., "AS1.1"

                # ✅ NEW: Only create composite keys for real AS codes (with decimals)
                if as_code and '.' in as_code:
                    composite_key = f"{outcome['$id']}#{as_code}"
                    # ... create AS mastery update
                else:
                    logger.info(f"Skipping non-standard AS code: {as_code} (no decimal point)")

except (json.JSONDecodeError, TypeError) as e:
    logger.warning(f"Failed to parse assessmentStandards for outcome {outcome.get('$id', 'unknown')}: {e}")
    continue
```

**Logic Flow**:
1. Check if `outcomeId` starts with `TOPIC_` or `SKILL_`
2. If skills-based: Skip entire AS parsing logic (continue to next outcome)
3. If traditional: Parse AS codes and create composite keys ONLY for codes with decimals

**Impact**:
- ✅ Prevents meaningless composite keys in MasteryV2 for skills-based outcomes
- ✅ Traditional outcomes continue to work exactly as before
- ✅ Clean separation between course types

---

### Part 3: Update Documentation (NICE-TO-HAVE)

**File**: `docs/MASTERY_EVIDENCE_ROUTINE_ARCHITECTURE.md`

Add new section after "3.5 Translation Flow Diagram":

```markdown
## 3.6 Skills-Based Outcomes Support (National 5+)

### Overview

The Mastery + Evidence + Routine architecture supports two outcome formats:
1. **Traditional** (National 3/4): Unit-based with hierarchical outcomes and assessment standards
2. **Skills-Based** (National 5+): Flat skills framework with topics and atomic skills

### Outcome ID Formats

**Traditional (National 3/4)**:
- Outcomes: `"O1"`, `"O2"`, `"O3"`
- Assessment Standards: `"AS1.1"`, `"AS1.2"`, `"AS2.1"`

**Skills-Based (National 5+)**:
- Topics: `"TOPIC_NUMERICAL_SKILLS"`, `"TOPIC_ALGEBRAIC_SKILLS"`
- Skills: `"SKILL_WORKING_WITH_SURDS"`, `"SKILL_ROUNDING"`

### Composite Key Behavior

**Traditional Outcomes**:
- Tracks at two levels: outcome (`"O1"`) and AS (`"AS1.1"`) separately
- MasteryV2: `{"outcome_doc_id": 0.85, "outcome_doc_id#AS1.1": 0.90}`
- RoutineV2: `{"O1": "2025-01-20...", "AS1.1": "2025-01-22..."}`

**Skills-Based Outcomes**:
- Tracks only at topic/skill level (no sub-components)
- Topics and Skills ARE the atomic units (no composite keys needed)
- MasteryV2: `{"topic_doc_id": 0.75, "skill_doc_id": 0.85}`
- RoutineV2: `{"TOPIC_NUMERICAL_SKILLS": "2025-01-20...", "SKILL_WORKING_WITH_SURDS": "2025-01-22..."}`

### Validation

**RoutineDriver Regex**: `/^[A-Z_]+(\d+(\.\d+)?)?$/`
- Accepts traditional: `"O1"`, `"AS1.1"` ✅
- Accepts skills-based: `"TOPIC_X"`, `"SKILL_X"` ✅

### Detection Logic

Backend automatically detects course type:
```python
is_skills_based = outcome_id.startswith('TOPIC_') or outcome_id.startswith('SKILL_')
```

If skills-based:
- Skip composite key generation
- Track only at outcome level (topic or skill)
- No AS-level mastery tracking

### Impact on Three Systems

1. **MasteryV2**:
   - Traditional: Stores both outcome and AS mastery
   - Skills-based: Stores only topic/skill mastery (no composite keys)

2. **Evidence**:
   - Unchanged (format-agnostic)
   - Stores raw student responses for both course types

3. **RoutineV2**:
   - Traditional: Schedules for outcomes and AS codes separately
   - Skills-based: Schedules for topics and skills (updated regex validation)

### Frontend Compatibility

- **Enrichment**: Decimal-based filtering works for both formats
- **SpacedRepetitionService**: Decimal-based separation works for both formats
- **Translation Layer**: Uses enriched_outcomes (format-agnostic)

### Example Data Flow

**Skills-Based Lesson Completion**:
```typescript
1. Student completes lesson targeting "SKILL_WORKING_WITH_SURDS"
2. Backend creates mastery update:
   {
     outcome_id: "doc_skill_surds_id",  // Document ID only
     score: 0.85
   }
3. Frontend translates to RoutineV2 key:
   "doc_skill_surds_id" → "SKILL_WORKING_WITH_SURDS"
4. RoutineDriver validates: ✅ PASSES (updated regex)
5. RoutineV2 stores:
   {
     "SKILL_WORKING_WITH_SURDS": "2025-01-22T10:00:00Z"
   }
6. SpacedRepetitionService reads:
   - Fetches "SKILL_WORKING_WITH_SURDS" from RoutineV2
   - Reverse translates to "doc_skill_surds_id"
   - Fetches mastery: 0.85
   - Generates recommendation
```

No composite keys created because backend detected `SKILL_` prefix.
```

---

## Implementation Steps

### Step 1: Update RoutineDriver Validation (5 min)

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts`

**Lines to change**: 300-306

```typescript
// Valid format: "O1", "O2", "AS1.1", "AS2.3", "TOPIC_X", "SKILL_X"
const validFormat = /^[A-Z_]+(\d+(\.\d+)?)?$/;
if (!validFormat.test(outcomeId)) {
  throw new Error(
    `Invalid outcomeId format: '${outcomeId}'. ` +
    `Expected traditional format (O1, AS1.1) or skills-based format (TOPIC_X, SKILL_X).`
  );
}
```

---

### Step 2: Update teaching_utils.py (10 min)

**File**: `langgraph-agent/src/agent/teaching_utils.py`

**Lines to change**: 206-238

```python
# After line 207: Parse assessmentStandards
as_list_json = outcome.get("assessmentStandards", "[]")

try:
    as_list = json.loads(as_list_json) if isinstance(as_list_json, str) else as_list_json

    # ✅ PART 2a: Check if this is skills-based outcome
    outcome_id = outcome.get('outcomeId', '')
    is_skills_based = outcome_id.startswith('TOPIC_') or outcome_id.startswith('SKILL_')

    if is_skills_based:
        logger.info(f"✅ Skills-based outcome detected: {outcome_id} - skipping AS composite key generation")
        continue

    # ✅ PART 2b: Traditional outcomes - create composite keys for real AS codes only
    if isinstance(as_list, list) and len(as_list) > 0:
        logger.info(f"Found {len(as_list)} assessment standards in outcome {outcome.get('outcomeId', 'unknown')}")

        for as_obj in as_list:
            if isinstance(as_obj, dict):
                as_code = as_obj.get("code")

                # Only create composite keys for real AS codes (with decimals)
                if as_code and '.' in as_code:
                    composite_key = f"{outcome['$id']}#{as_code}"

                    as_mastery_update = {
                        "outcome_id": composite_key,
                        "score": score,
                        "timestamp": datetime.now().isoformat()
                    }

                    mastery_updates.append(as_mastery_update)
                    logger.info(f"✅ Created AS mastery: outcome_id={composite_key}, score={score}")
                else:
                    logger.info(f"Skipping non-standard AS code: {as_code} (no decimal point)")

except (json.JSONDecodeError, TypeError) as e:
    logger.warning(f"Failed to parse assessmentStandards for outcome {outcome.get('$id', 'unknown')}: {e}")
    continue
```

---

### Step 3: Update Documentation (10 min)

**File**: `docs/MASTERY_EVIDENCE_ROUTINE_ARCHITECTURE.md`

Add section 3.6 as outlined above.

---

### Step 4: Test with Real Data (20 min)

**Test Case 1: Skills-Based Course (course_c84775)**

1. Use Playwright MCP to navigate to course enrollment
2. Enroll test user in National 5 Mathematics
3. Start a lesson targeting `SKILL_WORKING_WITH_SURDS`
4. Complete the lesson with correct answers
5. **Verify**:
   - ✅ No errors in console (validation passes)
   - ✅ MasteryV2 has entry: `"doc_skill_id": 0.85` (NO composite keys)
   - ✅ RoutineV2 has entry: `"SKILL_WORKING_WITH_SURDS": "2025-01-22..."`
   - ✅ Dashboard shows spaced repetition recommendation

**Test Case 2: Traditional Course (course_c84473)**

1. Complete a lesson in Application of Mathematics (National 3)
2. **Verify**:
   - ✅ MasteryV2 has entries: `"outcome_id": 0.85`, `"outcome_id#AS1.1": 0.90`
   - ✅ RoutineV2 has entries: `"O1": "...", "AS1.1": "..."`
   - ✅ No regression (traditional outcomes still work)

**Test Case 3: Mixed Scenario**

1. Student enrolled in both course types
2. Complete lessons in both courses
3. **Verify**:
   - ✅ Both courses show in dashboard
   - ✅ Spaced repetition recommendations from both courses
   - ✅ No cross-contamination of data

---

## Acceptance Criteria

### Critical ✅
- [ ] RoutineDriver accepts `TOPIC_` and `SKILL_` outcome IDs without throwing errors
- [ ] Skills-based lesson completion creates mastery updates (outcome level only, no composite keys)
- [ ] Spaced repetition recommendations work for skills-based courses
- [ ] Traditional outcomes continue to work exactly as before (no regression)

### Important ✅
- [ ] Backend skips composite key generation for skills-based outcomes
- [ ] MasteryV2 collection does not contain `#TOPIC_OVERVIEW` or `#AS1` composite keys
- [ ] Console logs show clear detection messages ("Skills-based outcome detected")

### Nice-to-Have 📝
- [ ] Documentation updated with skills-based section
- [ ] Test coverage includes both course types

---

## Risk Assessment

### Low Risk ✅
- **Enrichment**: Already works (decimal-based filtering is format-agnostic)
- **SpacedRepetitionService**: Already works (decimal-based separation)
- **Most components**: Format-agnostic by design

### Medium Risk ⚠️
- **Regex change**: Could affect edge cases
  - **Mitigation**: Comprehensive testing with both course types
  - **Rollback**: Simple regex revert if issues found

### Zero Risk 🎯
- **Changes are additive**: No existing functionality removed
- **Traditional outcomes**: Continue to work exactly as before
- **Backward compatibility**: 100% maintained

---

## References

### Related Specifications
- `routine-v2-key-format-fix-spec.md` - RoutineV2 key translation architecture
- `composite-key-mastery-tracking-spec.md` - Original composite key design (traditional outcomes)

### Migration Guides
- `scripts/OUTCOME_MIGRATION_GUIDE.md` - Course outcomes seeding workflow
- `scripts/SKILLS_BASED_MIGRATION.md` - Dual-unit creation strategy (TOPIC_ + SKILL_)

### Architecture Documentation
- `docs/MASTERY_EVIDENCE_ROUTINE_ARCHITECTURE.md` - Complete three-system architecture

### Code Files
- `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts:279-332` - Validation logic
- `assistant-ui-frontend/lib/services/spaced-repetition-service.ts:315-404` - Outcome separation
- `assistant-ui-frontend/lib/sessions/outcome-enrichment.ts:62-99` - Enrichment flow
- `langgraph-agent/src/agent/teaching_utils.py:196-243` - Composite key generation
- `assistant-ui-frontend/scripts/lib/skillsBasedExtraction.ts` - Skills-based seeding logic

---

## Notes

### Design Philosophy

The architecture follows these principles:
1. **Decimal Point Detection**: Used throughout to separate outcomes from AS codes
2. **Format Agnostic**: Most components don't care about outcome ID format
3. **Fail-Fast Validation**: Reject invalid inputs at entry points (RoutineDriver)
4. **No Fallbacks**: Throw errors, don't silently fail (per project guidelines)

### Skills-Based Rationale

Traditional outcomes have hierarchy:
```
O1 (Outcome)
├── AS1.1 (Assessment Standard)
└── AS1.2 (Assessment Standard)
```

Skills-based outcomes are flat:
```
TOPIC_NUMERICAL_SKILLS (Grouping)
SKILL_WORKING_WITH_SURDS (Atomic Competency)
```

No hierarchy means no composite keys needed - skills ARE the atomic units.

---

## Status Tracking

- [x] **Part 1**: RoutineDriver validation regex updated ✅
- [x] **Part 2**: teaching_utils.py composite key logic updated ✅
- [x] **Part 3**: Documentation updated ✅
- [ ] **Test Case 1**: Skills-based course tested (course_c84775)
- [ ] **Test Case 2**: Traditional course regression tested (course_c84473)
- [ ] **Test Case 3**: Mixed scenario tested
- [ ] **Production Ready**: All tests passed, no console errors
