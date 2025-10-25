# Lesson OutcomeRef Migration Scripts

These scripts migrate existing lesson templates from using outcome **codes** (e.g., `["O1", "O2"]`) to using course_outcomes **document IDs** (e.g., `["70a1b2c3d4e5f6g7h8i9"]`).

## Prerequisites

1. ✅ **Course outcomes must be seeded** - Run `migrateCourseOutcomes.ts` first
2. ✅ **MCP config must exist** - Default: `.mcp.json` in project root
3. ✅ **Python dependencies installed** - Run from `claud_author_agent/` directory

## Scripts

### 1. `migrate_lesson_outcome_refs.py` - Single Lesson Migration

Migrate a single lesson template by ID.

#### Usage

```bash
# Dry run (preview changes)
python scripts/migrate_lesson_outcome_refs.py "67890abcdef" --dry-run

# Actual migration
python scripts/migrate_lesson_outcome_refs.py "67890abcdef"

# Custom MCP config path
python scripts/migrate_lesson_outcome_refs.py "67890abcdef" --mcp-config "/path/to/.mcp.json"
```

#### Example Output

```
2025-01-15 10:30:00 - INFO - Starting migration for lesson: 67890abcdef
2025-01-15 10:30:01 - INFO - ✓ Found lesson template: Fractions of Amounts
2025-01-15 10:30:01 - INFO -   Course ID: course_c84473
2025-01-15 10:30:01 - INFO -   Current outcomeRefs: ['O1', 'O2', 'AS1.1']
2025-01-15 10:30:01 - INFO - Step 2: Mapping outcome codes to document IDs...
2025-01-15 10:30:01 - INFO -   Looking up outcome: O1
2025-01-15 10:30:02 - INFO -   ✓ Mapped O1 → 70a1b2c3d4e5f6g7h8i9
2025-01-15 10:30:02 - INFO -   Looking up outcome: O2
2025-01-15 10:30:03 - INFO -   ✓ Mapped O2 → 70a2b3c4d5e6f7g8h9ia
2025-01-15 10:30:03 - INFO -   Looking up outcome: AS1.1
2025-01-15 10:30:04 - INFO -   ✓ Mapped AS1.1 → 70a3b4c5d6e7f8g9h0ib

================================================================================
MIGRATION SUMMARY
================================================================================
Lesson Template ID: 67890abcdef
Title: Fractions of Amounts
Course ID: course_c84473

Total outcome refs: 3
Successfully mapped: 3
Not found (kept as-is): 0

Mapped codes:
  ✓ O1 → 70a1b2c3d4e5f6g7h8i9
  ✓ O2 → 70a2b3c4d5e6f7g8h9ia
  ✓ AS1.1 → 70a3b4c5d6e7f8g9h0ib

BEFORE:
  outcomeRefs: [
    "O1",
    "O2",
    "AS1.1"
  ]

AFTER:
  outcomeRefs: [
    "70a1b2c3d4e5f6g7h8i9",
    "70a2b3c4d5e6f7g8h9ia",
    "70a3b4c5d6e7f8g9h0ib"
  ]
================================================================================

2025-01-15 10:30:04 - INFO - Step 3: Updating lesson template...
2025-01-15 10:30:05 - INFO - ✅ Successfully migrated lesson template: 67890abcdef
2025-01-15 10:30:05 - INFO -    Mapped 3 outcome codes to document IDs
```

---

### 2. `migrate_all_lesson_outcome_refs.py` - Bulk Migration

Migrate all lessons for a course or all lessons in the database.

#### Usage

```bash
# Dry run for a specific course
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473" --dry-run

# Migrate all lessons for a course
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473"

# Migrate ALL lessons in database (requires confirmation)
python scripts/migrate_all_lesson_outcome_refs.py --all

# Custom MCP config path
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473" --mcp-config "/path/to/.mcp.json"
```

#### Example Output

```
================================================================================
BULK MIGRATION [DRY RUN]
================================================================================
Target: All lessons for course course_c84473

Step 1: Fetching lesson templates...
✓ Found 12 lesson template(s)

Step 2: Migrating lessons...

[1/12] Processing: Fractions of Amounts (67890abcdef)
  🔍 Would migrate 3 outcome refs

[2/12] Processing: Percentages (67890abcdeg)
  🔍 Would migrate 2 outcome refs

[3/12] Processing: Ratios (67890abcdeh)
  ⏭️  Skipped: Already migrated (has document IDs)

[4/12] Processing: Decimals (67890abcdei)
  🔍 Would migrate 4 outcome refs
  ⚠️  1 codes not found (would keep as-is)

...

================================================================================
MIGRATION SUMMARY
================================================================================
Total lessons processed: 12
Successfully migrated: 0
Would migrate (dry-run): 9
Skipped: 3
Errors: 0

Would migrate (dry-run):
  🔍 Fractions of Amounts (67890abcdef)
    Would map: 3, Not found: 0
  🔍 Percentages (67890abcdeg)
    Would map: 2, Not found: 0
  ...

================================================================================
🔍 DRY RUN MODE: No changes were made
   Run without --dry-run to apply changes
```

---

## Migration Behavior

### Safe Migration Strategy

✅ **Graceful handling of missing outcomes**:
- If an outcome code is not found in `course_outcomes`, it is **left as-is** (not migrated)
- No errors are thrown for unfound codes
- Migration continues for other codes

✅ **Idempotent**:
- Already-migrated lessons are automatically skipped
- Safe to run multiple times

✅ **Dry-run mode**:
- Always test with `--dry-run` first
- Preview exact changes before applying

### What Gets Migrated

#### Before Migration
```json
{
  "outcomeRefs": "[\"O1\", \"O2\", \"AS1.1\"]"
}
```

#### After Migration
```json
{
  "outcomeRefs": "[\"70a1b2c3d4e5f6g7h8i9\", \"70a2b3c4d5e6f7g8h9ia\", \"70a3b4c5d6e7f8g9h0ib\"]"
}
```

### Skip Conditions

Lessons are skipped if:
1. ❌ `outcomeRefs` is empty (`[]`)
2. ❌ `outcomeRefs` already contains document IDs (detected by length > 20)
3. ❌ No outcome codes were successfully mapped
4. ❌ Missing `courseId` field

---

## Recommended Workflow

### Step 1: Test with Single Lesson (Dry Run)

```bash
# Pick a lesson template ID from your database
python scripts/migrate_lesson_outcome_refs.py "YOUR_LESSON_ID" --dry-run
```

**Review the output:**
- ✅ Are the mappings correct?
- ⚠️ Are there any "not found" codes?
- 📊 Does the BEFORE/AFTER comparison look right?

### Step 2: Migrate Single Lesson (Real)

```bash
python scripts/migrate_lesson_outcome_refs.py "YOUR_LESSON_ID"
```

### Step 3: Verify in Database

```typescript
const template = await databases.getDocument('default', 'lesson_templates', 'YOUR_LESSON_ID');
const outcomeRefs = JSON.parse(template.outcomeRefs);
console.log(outcomeRefs);
// Expected: ["70a1b2c3d4e5f6g7h8i9", ...] ✅
```

### Step 4: Bulk Migration (Dry Run)

```bash
# Test for entire course
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473" --dry-run
```

**Review the summary:**
- How many lessons would be migrated?
- How many are skipped?
- Any errors?

### Step 5: Bulk Migration (Real)

```bash
# Migrate entire course
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473"
```

### Step 6: Migrate All Courses (Optional)

```bash
# Dry run for all lessons
python scripts/migrate_all_lesson_outcome_refs.py --all --dry-run

# Actual migration (requires confirmation)
python scripts/migrate_all_lesson_outcome_refs.py --all
```

---

## Troubleshooting

### Issue: "MCP config not found"

**Solution**: Provide the correct path to `.mcp.json`:
```bash
python scripts/migrate_lesson_outcome_refs.py "LESSON_ID" --mcp-config "../.mcp.json"
```

### Issue: "Outcome 'O1' not found for course 'course_c84473'"

**Cause**: Course outcomes not seeded for this course.

**Solution**: Run outcome seeding first:
```bash
cd assistant-ui-frontend
npm run migrate:outcomes
```

### Issue: "Failed to parse outcomeRefs"

**Cause**: `outcomeRefs` field is not valid JSON.

**Solution**: Manually fix the lesson template in Appwrite console or database.

### Issue: "Already migrated (has document IDs)"

**Cause**: Lesson already has document IDs in `outcomeRefs`.

**Status**: ✅ This is expected - no action needed!

---

## Exit Codes

- **0**: Success (or dry-run completed)
- **1**: Error (migration failed or MCP config not found)

---

## Example Complete Migration

```bash
# 1. Ensure outcomes are seeded
cd assistant-ui-frontend
npm run migrate:outcomes

# 2. Test single lesson migration (dry run)
cd ../claud_author_agent
python scripts/migrate_lesson_outcome_refs.py "67890abcdef" --dry-run

# 3. Migrate single lesson
python scripts/migrate_lesson_outcome_refs.py "67890abcdef"

# 4. Test bulk migration for course (dry run)
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473" --dry-run

# 5. Migrate all lessons for course
python scripts/migrate_all_lesson_outcome_refs.py --course-id "course_c84473"

# 6. Verify in database
# Check a few lesson templates to confirm outcomeRefs now contain document IDs
```

---

## Notes

- **No Rollback**: These scripts update documents directly - always use `--dry-run` first!
- **Partial Migration**: If some codes are not found, they remain as codes (not migrated)
- **Logging**: All migration activity is logged to stdout with timestamps
- **Performance**: Bulk migration processes lessons sequentially (not parallel)

---

## See Also

- **Original implementation**: `src/utils/appwrite_mcp.py` - `map_outcome_codes_to_doc_ids()`
- **Outcome seeding**: `assistant-ui-frontend/scripts/migrateCourseOutcomes.ts`
- **Lesson upserter**: `src/utils/lesson_upserter.py` - Uses strict mapping for new lessons
