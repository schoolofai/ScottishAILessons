# Seeding Data Directory

## Structure
- `input/sows/` - SOW JSON files (used by seeding script)
- `input/research_packs/` - Research pack JSON files (exists but ignored by SOW seeding)
- `output/course_outcomes_imports/` - Auto-generated course outcome import files (per-course)
- `output/logs/` - Execution logs
- `output/reports/` - Batch processing reports

## Naming Convention
Files must follow: `<subject>_<level>.json`

Examples:
- `mathematics_national-4.json`
- `application-of-mathematics_national-3.json`

## Automated Workflow
The seeding script now automatically:
1. **Phase -2**: Extracts outcomes from `sqa_education.sqa_current` (if not already extracted)
2. **Phase -1**: Populates `course_outcomes` collection (if not already populated)
3. **Phase 0-4**: Validates and seeds lesson templates and SOW data

All prerequisite steps are handled automatically with auto-skip detection for idempotent execution.

## Note
The `research_packs/` folder is not used by the SOW seeding script.
