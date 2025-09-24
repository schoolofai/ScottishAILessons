# Seed Data Migration Scripts

This directory contains scripts for migrating seeded data to be compatible with the enhanced collection structures introduced in MVP1.

## migrate-seed-data.ts

### Purpose
Migrates existing seeded data from the original format to the new consolidated collection structures:
- **scheme_of_work** → **SOWV2** (consolidated per-enrollment)
- Creates initial **MasteryV2** records for all enrollments
- Validates **lesson_templates** JSON parsing compatibility
- Prepares **Evidence** collection for enhanced fields

### Prerequisites
- Server API key with read/write access to Appwrite collections
- Environment variables set:
  - `NEXT_PUBLIC_APPWRITE_ENDPOINT`
  - `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
  - `APPWRITE_API_KEY` (server key)

### Usage

```bash
# Install dependencies (if not already installed)
npm install

# Run migration
npm run migrate-seeds

# Or run directly with tsx
npx tsx scripts/migrate-seed-data.ts
```

### What It Does

1. **Validates Lesson Templates**
   - Tests JSON parsing of `outcomeRefs` and `cards` fields
   - Reports any parsing errors that would break the application

2. **Migrates SOW Data**
   - Groups individual `scheme_of_work` entries by studentId/courseId
   - Creates consolidated `SOWV2` documents with JSON entries array
   - Preserves order and scheduling information

3. **Creates Initial Mastery Records**
   - Creates empty `MasteryV2` records for all enrolled students
   - Sets up structure for EMA tracking per outcome

4. **Prepares Evidence Structure**
   - Validates that Evidence collection can handle new fields
   - Reports status of enhanced structure readiness

### Output
The script provides detailed logging of:
- Number of records migrated
- Validation results
- Any errors encountered
- Summary statistics

### Safety Features
- **Non-destructive**: Only creates new records, doesn't modify existing data
- **Idempotent**: Can be run multiple times safely (skips existing records)
- **Error handling**: Continues processing even if individual records fail
- **Detailed logging**: Full visibility into what's happening

### Example Output
```
🚀 Starting seed data migration...
=====================================
📋 Validating lesson templates...
✅ Validated 12 lesson templates
📚 Migrating SOW data to SOWV2...
  ✅ Migrated SOW for test@scottishailessons.com/course-1 (8 lessons)
  ✅ Migrated SOW for test@scottishailessons.com/course-2 (6 lessons)
✅ Migrated 2 SOW enrollments to SOWV2
🎯 Creating initial MasteryV2 records...
  ✅ Created initial MasteryV2 for test@scottishailessons.com/course-1
  ✅ Created initial MasteryV2 for test@scottishailessons.com/course-2
✅ Created 2 initial MasteryV2 records
📊 Preparing enhanced Evidence structure...
✅ Evidence collection is empty, new structure will be created on first use

📊 Migration Results
===================
SOW enrollments migrated: 2
MasteryV2 records created: 2
Lesson templates validated: 12
Errors encountered: 0

🎉 Migration completed successfully!
```

### When to Run
- **Before deployment**: After seeding the database with MVP1 data
- **During updates**: When collection structures change
- **Troubleshooting**: To diagnose seeding compatibility issues

### Integration with Deployment
Add to your deployment pipeline after database seeding:

```bash
# Seed the database
npm run seed-database

# Migrate to new structures
npm run migrate-seeds

# Start the application
npm run build && npm start
```