# Deprecated Scripts Migration Guide

## Overview

This document provides migration guidance for deprecated course seeding scripts. The old two-step workflow has been replaced with a modern single-step approach that is more reliable, maintainable, and feature-rich.

## ⚠️ Removed Scripts

The following scripts have been **removed** as of 2025-11-01:

1. **`extractSQAOutcomes.ts`** - ❌ REMOVED - Extracted SQA data to intermediate JSON file
2. **`migrateCourseOutcomes.ts`** - ❌ REMOVED - Imported JSON file to Appwrite database

**This document is kept for historical reference and migration guidance.**

## Why Deprecated?

The two-step workflow had several limitations:

### ❌ Problems with Old Workflow

1. **Intermediate JSON File**
   - Created unnecessary `course_outcomes_import.json` file
   - Required manual file management
   - Prone to data loss if file deleted between steps

2. **Two-Step Process**
   - Easy to forget second step after extraction
   - No validation between steps
   - Confusing error messages when steps run out of order

3. **Code Duplication**
   - Extraction logic duplicated across scripts
   - No shared libraries (violated DRY principle)
   - Difficult to maintain consistency

4. **Limited Features**
   - No automatic structure type detection
   - No idempotency guarantees
   - Manual course code and courseId mapping required

5. **Poor Error Handling**
   - Fallback mechanisms caused silent failures
   - Difficult to debug data issues
   - No fail-fast validation

## ✅ New Workflow Benefits

The new single-step scripts provide significant improvements:

### Single Command Execution

```bash
# Old workflow (2 commands, 1 intermediate file)
tsx scripts/extractSQAOutcomes.ts mathematics national_5 "C847 75" "course_c84775"
tsx scripts/migrateCourseOutcomes.ts course_c84775

# New workflow (1 command, 0 intermediate files)
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5
```

### Automatic Structure Detection

- Auto-detects **unit-based** (National 3/4) vs **skills-based** (National 5+) courses
- Applies appropriate extraction strategy automatically
- No manual structure type specification needed

### Shared Library Architecture

- **DRY Principle**: Eliminates ~300 lines of duplicated code
- **Type Safety**: Shared TypeScript interfaces across all scripts
- **Maintainability**: Single source of truth for extraction logic

### Fail-Fast Error Handling

- No fallback mechanisms (explicit over implicit)
- Detailed error messages with context
- Immediate visibility into data issues

### Enhanced Features

- **Idempotent**: Safe to re-run scripts multiple times
- **Dry-run mode**: Preview changes before committing
- **Verbose logging**: Track progress and debug issues
- **Pagination**: Bulk seeding with progress tracking
- **JSON Reports**: Detailed execution summaries

## Migration Guide

### Step 1: Identify Your Use Case

**Single Course Seeding:**
If you were running `extractSQAOutcomes.ts` + `migrateCourseOutcomes.ts` for ONE course, migrate to:
```bash
tsx scripts/seedSingleCourse.ts --subject <subject> --level <level>
```

**Bulk Course Seeding:**
If you were running the two-step workflow in a loop for multiple courses, migrate to:
```bash
tsx scripts/bulkSeedAllCourses.ts
```

### Step 2: Update Your Commands

#### Example 1: Single Course (Mathematics National 5)

**Old Workflow:**
```bash
# Step 1: Extract
tsx scripts/extractSQAOutcomes.ts mathematics national_5 "C847 75" "course_c84775"

# Step 2: Import
tsx scripts/migrateCourseOutcomes.ts course_c84775
```

**New Workflow:**
```bash
# Single command (courseId auto-generated from SQA data)
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5

# With dry-run preview
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --dry-run
```

**Key Differences:**
- ✅ No need to specify `courseSqaCode` or `courseId` manually
- ✅ Auto-extracted from SQA data in Appwrite
- ✅ No intermediate JSON file
- ✅ Single command execution

#### Example 2: Bulk Seeding

**Old Workflow:**
```bash
# Manual loop over all courses
for course in accounting spanish mathematics; do
  for level in national_3 national_4 national_5; do
    # Extract first
    tsx scripts/extractSQAOutcomes.ts $course $level "..." "..."

    # Then import
    tsx scripts/migrateCourseOutcomes.ts "..."
  done
done
```

**New Workflow:**
```bash
# Automatic pagination and progress tracking
tsx scripts/bulkSeedAllCourses.ts

# With dry-run preview
tsx scripts/bulkSeedAllCourses.ts --dry-run --limit 10

# Small batch for testing
tsx scripts/bulkSeedAllCourses.ts --limit 10
```

**Key Differences:**
- ✅ No manual loops required
- ✅ Built-in pagination (100 courses per batch)
- ✅ Progress tracking with counts
- ✅ JSON report generation
- ✅ Graceful error handling (continues on failure)

### Step 3: Clean Up Intermediate Files

After migration, you can safely delete intermediate JSON files:

```bash
# Remove old import files (if they exist)
rm -f ../../langgraph-author-agent/data/course_outcomes_import.json
rm -f ../../langgraph-author-agent/data/course_outcomes_backup.json
```

### Step 4: Update Documentation References

If you have documentation, scripts, or CI/CD pipelines referencing the old workflow, update them to use the new commands.

**Common locations to check:**
- README files
- Shell scripts (`.sh` files)
- CI/CD configuration (`.yml`, `.yaml` files)
- Developer onboarding documentation

## Command Reference

### New Scripts

#### `seedSingleCourse.ts`

**Purpose:** Seed a single course and its outcomes

**Usage:**
```bash
tsx scripts/seedSingleCourse.ts --subject <subject> --level <level> [--dry-run]
```

**Parameters:**
- `--subject`: Subject name (e.g., `mathematics`, `spanish`, `accounting`)
  - Use underscores for multi-word subjects: `application_of_mathematics`
- `--level`: Level name (e.g., `national_3`, `national_4`, `national_5`, `higher`, `adv_higher`)
- `--dry-run`: (Optional) Preview changes without writing to database

**Examples:**
```bash
# Dry-run preview
tsx scripts/seedSingleCourse.ts --subject spanish --level national_3 --dry-run

# Live execution
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5

# Skills-based course (National 5+)
tsx scripts/seedSingleCourse.ts --subject physics --level higher
```

#### `bulkSeedAllCourses.ts`

**Purpose:** Seed all courses from SQA data with pagination

**Usage:**
```bash
tsx scripts/bulkSeedAllCourses.ts [--dry-run] [--limit N] [--offset N]
```

**Parameters:**
- `--dry-run`: (Optional) Preview changes without writing to database
- `--limit N`: (Optional) Process only N courses (default: all)
- `--offset N`: (Optional) Start from course N (for resuming)

**Examples:**
```bash
# Dry-run preview (first 5 courses)
tsx scripts/bulkSeedAllCourses.ts --dry-run --limit 5

# Small batch test (10 courses)
tsx scripts/bulkSeedAllCourses.ts --limit 10

# Full bulk run (all courses)
tsx scripts/bulkSeedAllCourses.ts

# Resume from offset 50, process 10 courses
tsx scripts/bulkSeedAllCourses.ts --offset 50 --limit 10
```

**Output:**
- Console logs with progress tracking
- JSON report saved to `reports/bulk-seed-report-{timestamp}.json`

### Deprecated Scripts (DO NOT USE)

#### `extractSQAOutcomes.ts` ⚠️ DEPRECATED

**Old Usage:**
```bash
tsx scripts/extractSQAOutcomes.ts <subject> <level> <courseSqaCode> <courseId>
```

**Replacement:**
```bash
tsx scripts/seedSingleCourse.ts --subject <subject> --level <level>
```

**Note:** The new script auto-generates `courseId` from SQA data, so you don't need to specify it manually.

#### `migrateCourseOutcomes.ts` ⚠️ DEPRECATED

**Old Usage:**
```bash
tsx scripts/migrateCourseOutcomes.ts <courseId>
```

**Replacement:**
This step is now integrated into `seedSingleCourse.ts` and `bulkSeedAllCourses.ts`. No separate import command needed.

## Troubleshooting

### Issue: "Module not found" error

**Error:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/scripts/seedSingleCourse.ts'
```

**Solution:**
Ensure you're running the command from the correct directory:

```bash
# Navigate to assistant-ui-frontend first
cd assistant-ui-frontend

# Then run the script
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5
```

The scripts use relative paths to load `.env.local`, so working directory matters.

### Issue: Environment variables not found

**Error:**
```
❌ Missing required environment variables:
  - NEXT_PUBLIC_APPWRITE_ENDPOINT
  - NEXT_PUBLIC_APPWRITE_PROJECT_ID
  - APPWRITE_API_KEY
```

**Solution:**
Ensure `.env.local` exists in `assistant-ui-frontend/` with required variables:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_admin_api_key
```

### Issue: Course already exists (idempotency)

**Console Output:**
```
⚠️  Course already exists, skipping creation
```

**Explanation:**
This is **expected behavior**. The new scripts are idempotent, meaning they skip existing courses/outcomes. This is a feature, not a bug.

**To force re-creation:**
1. Delete the existing course from Appwrite Console
2. Re-run the script

### Issue: "No units found" for skills-based course

**Error:**
```
❌ No units found in course data
```

**Solution:**
This error indicates a skills-based course (National 5+) is missing required structure. The new scripts auto-detect skills-based courses and extract from `skills_framework` and `topic_areas` instead of `units`.

**Verify SQA data has:**
- `data.course_structure.structure_type: "skills_based"`
- `data.course_structure.skills_framework`
- `data.course_structure.topic_areas`

If missing, the SQA data may be incomplete or malformed.

## Timeline

### Phase 1: Deprecation Warnings

**Status:** ✅ COMPLETED (2025-11-01)

- Deprecation warnings added to script headers
- Runtime warnings with 3-second delay
- Documentation updated with migration guide
- Verified no active dependencies

### Phase 2: Immediate Removal

**Status:** ✅ COMPLETED (2025-11-01)

- ❌ Deleted `extractSQAOutcomes.ts`
- ❌ Deleted `migrateCourseOutcomes.ts`
- Updated all documentation references
- DEPRECATED.md kept for historical reference

**Reason for immediate removal:**
- No active production dependencies found
- No workflows or CI/CD pipelines using them
- Only documentation references in old/test files
- Clean break preferred over gradual deprecation

## Getting Help

### Documentation

- **README_PHASE1.md** - Complete Phase 1 documentation
- **SKILLS_BASED_MIGRATION.md** - Skills-based course extraction details
- **PHASE1A_TESTING.md** - Single course seeding test guide
- **PHASE1B_TESTING.md** - Bulk seeding test guide

### Support

If you encounter issues during migration:

1. **Check Prerequisites:**
   - Environment variables configured in `.env.local`
   - `sqa_education.sqa_current` collection populated
   - Admin API key has write permissions

2. **Use Dry-Run Mode:**
   ```bash
   tsx scripts/seedSingleCourse.ts --subject <subject> --level <level> --dry-run
   ```
   This previews changes without writing to database.

3. **Check Logs:**
   - Scripts provide verbose logging by default
   - Look for specific error messages and context

4. **Review SQA Data:**
   - Verify course data exists in Appwrite Console
   - Check data structure matches expected schema

## Summary

### Quick Migration Checklist

- [ ] Identify use case: single course or bulk seeding
- [ ] Update commands to use new scripts
- [ ] Test with `--dry-run` flag first
- [ ] Run live migration
- [ ] Verify results in Appwrite Console
- [ ] Clean up intermediate JSON files
- [ ] Update documentation references
- [ ] Delete old scripts from local workflows

### Key Takeaways

**Old Workflow:**
```bash
extractSQAOutcomes.ts → course_outcomes_import.json → migrateCourseOutcomes.ts
```

**New Workflow:**
```bash
seedSingleCourse.ts --subject X --level Y → Appwrite (direct write)
```

**Benefits:**
- ✅ Single command
- ✅ No intermediate files
- ✅ Auto-detects structure type
- ✅ Idempotent and safe
- ✅ Better error handling
- ✅ Shared libraries (DRY)

---

**Last Updated:** 2025-11-01

**Status:** ✅ Scripts Removed (2025-11-01)

**Note:** This document is kept for historical reference and to help users who may have old workflows referencing these scripts.
