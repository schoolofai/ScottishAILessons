# Simplified Lesson Types Cleanup Plan

**Status**: ✅ COMPLETED
**Created**: 2026-01-19
**Completed**: 2026-01-19
**Priority**: HIGH

---

## ✅ Implementation Summary (2026-01-19)

All cleanup tasks completed successfully. The iterative SOW author now uses a simplified architecture:

| File | Changes Made |
|------|-------------|
| `src/tools/sow_schema_models.py` | ✅ Removed `INDEPENDENT_PRACTICE` from CardType enum |
| `src/prompts/outline_author_prompt.md` | ✅ Updated to use 5-card flow, removed deprecated references |
| `src/prompts/lesson_entry_prompt.md` | ✅ Simplified card flow, removed hard card constraints |
| `src/prompts/metadata_author_prompt.md` | ✅ Added 5-card flow guidance |
| `tests/unit/test_sow_schema_models.py` | ✅ Updated 32 tests (all pass) |
| `tests/integration/test_outline_validator_tool.py` | ✅ Updated 27 tests (all pass) |
| `tests/phases/test_phase1_outline.py` | ✅ Updated docstrings |

**Test Results**: 59 tests pass (32 unit + 27 integration)

---

## User Decisions (2026-01-19)

| Question | Decision |
|----------|----------|
| Q1: CardType Enum | **REMOVE** `INDEPENDENT_PRACTICE` from enum |
| Q2: Legacy Prompts | **SKIP** - Only update iterative author prompts |
| Q3: Mock Exam | **KEEP** current structure (instructions → question_cards) |
| Q4: Card Count | **REMOVE** hard constraints - focus on topic coverage |

---

## ⚠️ Problem Statement

The current iterative SOW author prompts and schemas still reference **deprecated pedagogical patterns** that should NOT be part of the new simplified architecture:

| Deprecated Term | Current Usage | Should Be |
|-----------------|---------------|-----------|
| `revision` | Listed as lesson_type and card concept | **REMOVED** - Not used in iterative author |
| `independent_practice` | Listed as lesson_type AND CardType enum | **REMOVED** - Handled separately outside SOW author |
| `formative_assessment` | Listed as lesson_type and card concept | **REMOVED** - Not used in iterative author |

**User Requirement**: The iterative SOW author should ONLY produce:
- **Outline**: `teach` + `mock_exam` entries only
- **Lessons**: Standard teach lessons with simple card flow, NO revision/independent_practice/formative_assessment concepts
- **Independent practice**: Handled by a SEPARATE system (not part of SOW authoring)

---

## Current State Analysis

### Files That Need Changes

#### 1. Schema Files (src/tools/)

| File | Issue | Action |
|------|-------|--------|
| `sow_schema_models.py` | `CardType` enum includes `INDEPENDENT_PRACTICE` | **REVIEW** - May need to keep for legacy |
| `sow_schema_models.py` | `LessonType` enum includes all 5 types | **KEEP** - For legacy AuthoredSOW compatibility |
| `sow_schema_models.py` | `OutlineLessonType` enum | ✅ Already correct (teach + mock_exam only) |

#### 2. Prompt Files (src/prompts/) - ITERATIVE AUTHOR

| File | Issue | Action |
|------|-------|--------|
| `outline_author_prompt.md` | References revision/independent_practice as "card types" | **UPDATE** - Remove all mentions |
| `lesson_entry_prompt.md` | Lists full I-We-You progression including independent_practice | **UPDATE** - Simplify card flow |
| `metadata_author_prompt.md` | May reference deprecated lesson types | **AUDIT** |

#### 3. Prompt Files (src/prompts/) - LEGACY AUTHOR (Lower Priority)

| File | Issue | Action |
|------|-------|--------|
| `sow_author_prompt.md` | Uses full 5 lesson types + teach-revision pairing | **SKIP** - Legacy system |
| `lesson_author_prompt.md` | Uses full 5 lesson types | **SKIP** - Legacy system |
| `unified_critic_prompt.md` | Validates teach-revision pairing | **SKIP** - Legacy system |
| Others (20+ files) | Various references | **SKIP** - Legacy system |

#### 4. Test Files

| File | Issue | Action |
|------|-------|--------|
| `test_sow_schema_models.py` | Tests already updated for OutlineLessonType | ✅ Done |
| `test_outline_validator_tool.py` | Tests already use teach + mock_exam | ✅ Done |
| `test_phase1_outline.py` | Tests already use simplified types | ✅ Done |

---

## Proposed Changes

### Phase 1: Update Outline Author Prompt

**File**: `src/prompts/outline_author_prompt.md`

**Current** (problematic):
```markdown
Other lesson types (revision, independent_practice, formative_assessment)
are pedagogical patterns embedded within lesson content as card types
```

**Updated** (clean):
```markdown
The iterative SOW author generates TWO lesson types only:
- `teach`: Standard lessons with full content delivery
- `mock_exam`: Final exam preparation (exactly 1, within last 3 lessons)

NOTE: Independent practice is handled by a SEPARATE system outside of SOW authoring.
```

### Phase 2: Update Lesson Entry Prompt

**File**: `src/prompts/lesson_entry_prompt.md`

**Current Card Flow** (Lines 95-101):
```markdown
starter → explainer → modelling → guided_practice → independent_practice → exit_ticket
```

**Proposed Card Flow** (simplified):
```markdown
starter → explainer → modelling → guided_practice → exit_ticket
```

**Removed References**:
- Line 85: Remove "revision, independent_practice, formative_assessment are CARD TYPES"
- Line 100: Remove `independent_practice` card definition
- Line 214: Remove `independent_practice` CFU pattern

### Phase 3: Update CardType Enum (Optional)

**File**: `src/tools/sow_schema_models.py`

**Current**:
```python
class CardType(str, Enum):
    STARTER = "starter"
    EXPLAINER = "explainer"
    MODELLING = "modelling"
    GUIDED_PRACTICE = "guided_practice"
    INDEPENDENT_PRACTICE = "independent_practice"  # ← REMOVE?
    EXIT_TICKET = "exit_ticket"
```

**Decision Needed**:
- **Option A**: Remove `INDEPENDENT_PRACTICE` from CardType (breaking change for legacy)
- **Option B**: Keep for backwards compatibility, just don't use in new prompts

### Phase 4: Update Tests

Update any test fixtures that still reference the old card progression.

---

## Simplified Architecture (Target State)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ITERATIVE SOW AUTHOR (New System)                         │
│                                                                              │
│  OUTLINE (Phase 1)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ OutlineLessonType: ONLY 'teach' and 'mock_exam'                         ││
│  │                                                                          ││
│  │ outlines: [                                                              ││
│  │   {order: 1, lesson_type: "teach", ...},                                ││
│  │   {order: 2, lesson_type: "teach", ...},                                ││
│  │   ...                                                                   ││
│  │   {order: N, lesson_type: "mock_exam", ...}                             ││
│  │ ]                                                                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  LESSON CARDS (Phase 2)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ CardType: starter, explainer, modelling, guided_practice, exit_ticket   ││
│  │                                                                          ││
│  │ card_structure: [                                                        ││
│  │   {card_type: "starter", ...},           ← Prior knowledge activation   ││
│  │   {card_type: "explainer", ...},         ← Core content delivery        ││
│  │   {card_type: "modelling", ...},         ← Teacher demonstration        ││
│  │   {card_type: "guided_practice", ...},   ← Scaffolded practice          ││
│  │   {card_type: "exit_ticket", ...}        ← Formative check              ││
│  │ ]                                                                        ││
│  │                                                                          ││
│  │ NO independent_practice card - handled by SEPARATE system               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    INDEPENDENT PRACTICE (Separate System)                    │
│                                                                              │
│  Handled OUTSIDE of SOW authoring - different workflow/pipeline             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    LEGACY SOW AUTHOR (Existing System)                       │
│                                                                              │
│  Keep unchanged for backwards compatibility:                                │
│  - LessonType: teach, revision, independent_practice, formative_assessment, │
│                mock_exam                                                    │
│  - sow_author_prompt.md, lesson_author_prompt.md, etc.                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Card Type Comparison

| Card Type | In New System? | Purpose |
|-----------|----------------|---------|
| `starter` | ✅ YES | Activate prior knowledge (5 min) |
| `explainer` | ✅ YES | Core content delivery (10-15 min) |
| `modelling` | ✅ YES | Teacher demonstrates with think-aloud (5-10 min) |
| `guided_practice` | ✅ YES | Scaffolded practice with hints (10 min) |
| `independent_practice` | ❌ **NO** | Handled by separate system |
| `exit_ticket` | ✅ YES | Quick formative check (5 min) |

---

## Questions for User

Before implementing, please clarify:

### Q1: CardType Enum
Should we **remove** `INDEPENDENT_PRACTICE` from the `CardType` enum, or just not use it in prompts?
- **Remove**: Cleaner, but breaks legacy AuthoredSOW documents
- **Keep but don't use**: Backwards compatible, slightly messy

### Q2: Legacy Prompt Files
Should we update the 20+ legacy prompt files (`sow_author_prompt.md`, `lesson_author_prompt.md`, etc.)?
- **Update**: Full consistency across codebase
- **Skip**: Focus only on iterative author (faster)

### Q3: Lesson Duration
With the simplified 5-card flow (no independent_practice), estimated lesson duration is ~35-45 min instead of ~50 min. Is this acceptable?

### Q4: Mock Exam Card Structure
Should mock_exam lessons also use the simplified card flow, or keep the current `instructions → question_card → question_card` structure?

---

## Implementation Order

1. **Update `outline_author_prompt.md`** - Remove all revision/independent_practice/formative_assessment references
2. **Update `lesson_entry_prompt.md`** - Simplify card flow to 5 cards
3. **Update `metadata_author_prompt.md`** - Remove any deprecated references
4. **Update `CardType` enum** (pending decision on Q1)
5. **Update tests** - Ensure fixtures use new card flow
6. **Run full test suite** - Verify no regressions

---

## Success Criteria

- [ ] `outline_author_prompt.md` has NO mention of revision/independent_practice/formative_assessment
- [ ] `lesson_entry_prompt.md` uses 5-card flow: starter → explainer → modelling → guided_practice → exit_ticket
- [ ] All iterative author tests pass
- [ ] Generated lessons contain ONLY the 5 approved card types
- [ ] Legacy system remains functional (if keeping backwards compatibility)

---

**End of Plan**
