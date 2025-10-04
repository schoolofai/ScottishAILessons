# Troubleshooting Guide

> **Common errors, solutions, and debugging strategies**

## Table of Contents

- [Environment & Configuration Errors](#environment--configuration-errors)
- [Data File Errors](#data-file-errors)
- [Validation Errors](#validation-errors)
- [Database Errors](#database-errors)
- [Permission Errors](#permission-errors)
- [Debugging Strategies](#debugging-strategies)

## Environment & Configuration Errors

### Error: Missing Environment Variables

**Symptom**:
```
❌ Missing required environment variables:
  - NEXT_PUBLIC_APPWRITE_ENDPOINT
  - NEXT_PUBLIC_APPWRITE_PROJECT_ID
  - APPWRITE_API_KEY
```

**Cause**: `.env.local` file missing or incomplete.

**Solution**:

1. Create `.env.local` in `assistant-ui-frontend/`:
```bash
cd assistant-ui-frontend
cp .env.example .env.local  # If .env.example exists
```

2. Add required variables:
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_API_KEY=your_admin_api_key_here
```

3. Verify API key has admin permissions:
```
Appwrite Console → Overview → API Keys → Check Scopes
Required scopes: databases.read, databases.write
```

### Error: Invalid API Key

**Symptom**:
```
❌ Failed to create Authored_SOW:
AppwriteException: User (role: guest) is missing scope (databases.write)
```

**Cause**: API key doesn't have required permissions or is expired.

**Solution**:

1. Generate new admin API key:
```
Appwrite Console → Overview → API Keys → Create API Key
Name: "Seeding Scripts Admin"
Scopes: Select ALL scopes (or at minimum: databases.read, databases.write)
```

2. Update `.env.local` with new key

3. Verify key works:
```bash
curl -X GET \
  https://cloud.appwrite.io/v1/databases \
  -H "X-Appwrite-Project: your_project_id" \
  -H "X-Appwrite-Key: your_api_key"
```

### Error: Wrong Project ID

**Symptom**:
```
AppwriteException: Project with the requested ID could not be found
```

**Cause**: `NEXT_PUBLIC_APPWRITE_PROJECT_ID` doesn't match actual project.

**Solution**:

1. Get correct project ID:
```
Appwrite Console → Project Settings → Project ID
```

2. Update `.env.local`:
```env
NEXT_PUBLIC_APPWRITE_PROJECT_ID=correct_project_id_here
```

## Data File Errors

### Error: SOW JSON File Not Found

**Symptom**:
```
❌ File not found: /path/to/langgraph-author-agent/data/sow_authored_AOM_nat3.json
   Looking for: /path/to/sow_authored_AOM_nat3.json
```

**Cause**: SOW JSON file doesn't exist at expected location.

**Solution**:

1. Verify file exists:
```bash
ls -la langgraph-author-agent/data/sow_authored_AOM_nat3.json
```

2. If missing, generate with SOW author agent:
```bash
cd langgraph-author-agent
python3 run_sow_author.py course_c84473
```

3. Alternatively, update script to point to correct file:
```typescript
// In seedAuthoredSOW.ts, line 409
const jsonFilePath = path.join(
  __dirname,
  '../../langgraph-author-agent/data/sow_authored_YOUR_COURSE.json'
);
```

### Error: Invalid JSON Format

**Symptom**:
```
SyntaxError: Unexpected token } in JSON at position 1234
```

**Cause**: SOW JSON file has syntax errors.

**Solution**:

1. Validate JSON:
```bash
cat langgraph-author-agent/data/sow_authored_AOM_nat3.json | jq .
```

2. If validation fails, check for:
- Trailing commas
- Missing quotes
- Unclosed brackets

3. Re-generate SOW with fresh agent run

### Error: Missing Required Fields

**Symptom**:
```
TypeError: Cannot read property 'outcomeRefs' of undefined
```

**Cause**: SOW JSON missing required fields.

**Solution**:

1. Verify JSON structure has all required fields:
```typescript
{
  "$id": string,
  "courseId": string,
  "version": number,
  "status": "draft" | "published" | "archived",
  "metadata": {...},
  "entries": [
    {
      "order": number,
      "lessonTemplateRef": string,
      "label": string,
      "lesson_type": string,
      "outcomeRefs": string[],      // REQUIRED
      "assessmentStandardRefs": string[],
      "estMinutes": number,
      ...
    }
  ]
}
```

2. Re-generate SOW if fields missing

## Validation Errors

### Error: Invalid Outcome References

**Symptom**:
```
❌ Invalid outcome references found:
  - O5
  - O7

💡 Please ensure course_outcomes collection has been populated with migrateCourseOutcomes.ts
```

**Cause**: SOW references outcomes that don't exist in `course_outcomes` collection.

**Solution**:

1. Run course outcomes migration first:
```bash
tsx scripts/migrateCourseOutcomes.ts course_c84473
```

2. Verify outcomes exist:
```typescript
// Query course_outcomes
const outcomes = await databases.listDocuments('default', 'course_outcomes', [
  Query.equal('courseId', 'course_c84473')
]);

console.log(`Found ${outcomes.total} outcomes`);
outcomes.documents.forEach(doc => {
  console.log(`  - ${doc.outcomeId}: ${doc.outcomeTitle}`);
});
```

3. If outcomes still missing, verify SQA import file:
```bash
cat langgraph-author-agent/data/course_outcomes_import.json | jq '.[] | select(.courseId=="course_c84473")'
```

### Error: Duplicate Template IDs

**Symptom**:
```
❌ Duplicate template references found:
  - 6745abc123def...
```

**Cause**: Multiple SOW entries reference the same template (data corruption).

**Solution**:

1. Identify duplicates in SOW JSON:
```bash
cat langgraph-author-agent/data/sow_authored_AOM_nat3.json | \
  jq '.entries[] | .lessonTemplateRef' | \
  sort | uniq -d
```

2. Fix by regenerating SOW with fresh agent run

3. Or manually edit JSON to ensure unique `order` values

### Error: Title Mismatches (Warning)

**Symptom**:
```
⚠️  Title mismatch #5: "Practice: Money Calculations" (SOW) vs "Practice: Calculating Money" (template)
```

**Cause**: Template title updated independently of SOW entry label.

**Impact**: Non-critical (warning only), doesn't break functionality.

**Solution** (optional):

1. Update template title to match SOW:
```typescript
await databases.updateDocument(
  'default',
  'lesson_templates',
  templateId,
  { title: sowEntry.label }
);
```

2. Or update SOW JSON to match template

## Database Errors

### Error: Collection Not Found

**Symptom**:
```
AppwriteException: Collection with the requested ID could not be found
```

**Cause**: Required collections don't exist in database.

**Solution**:

1. Verify collections exist:
```
Appwrite Console → Databases → default → Collections

Required:
- Authored_SOW
- lesson_templates
- course_outcomes
```

2. Create missing collections via Appwrite Console or migration scripts

### Error: Document Already Exists

**Symptom**:
```
AppwriteException: Document with the requested ID already exists
```

**Cause**: Trying to create document with duplicate ID (rare, usually from manual intervention).

**Solution**:

1. Scripts use `ID.unique()` which prevents this
2. If occurs, delete existing document:
```typescript
await databases.deleteDocument('default', 'lesson_templates', duplicateId);
```

3. Re-run seeding

### Error: Query Limit Exceeded

**Symptom**:
```
AppwriteException: Query limit exceeded
```

**Cause**: Too many queries in a short time (rate limiting).

**Solution**:

1. Wait 60 seconds and retry
2. For large datasets, add delays between operations:
```typescript
await new Promise(resolve => setTimeout(resolve, 100));  // 100ms delay
```

## Permission Errors

### Error: User Missing Scope

**Symptom**:
```
AppwriteException: User (role: guest) is missing scope (databases.write)
```

**Cause**: Using client SDK instead of admin API key.

**Solution**:

1. Verify using `node-appwrite` (not `appwrite`):
```typescript
import { Client } from 'node-appwrite';  // ✅ Correct
// NOT: import { Client } from 'appwrite';  // ❌ Wrong
```

2. Ensure API key set:
```typescript
const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);  // ✅ API key, not session
```

3. No permissions array needed for admin:
```typescript
await databases.createDocument(
  'default',
  'lesson_templates',
  ID.unique(),
  data
  // NO permissions parameter - admin has full access
);
```

### Error: Cannot Read Property of Null

**Symptom**:
```
TypeError: Cannot read property '$id' of null
```

**Cause**: Document not found in query result.

**Solution**:

1. Add existence check:
```typescript
const result = await databases.listDocuments(...);

if (result.documents.length === 0) {
  throw new Error('Document not found');
}

const doc = result.documents[0];  // Safe access
```

2. Verify query parameters are correct

## Debugging Strategies

### Enable Verbose Logging

Add detailed logs to track execution:

```typescript
// At start of each phase
console.log('\n' + '='.repeat(60));
console.log(`PHASE 1: Template Creation`);
console.log('='.repeat(60));

// Before queries
console.log(`Querying for: courseId=${courseId}, sow_order=${order}`);

// After queries
console.log(`Found ${result.documents.length} documents`);
if (result.documents.length > 0) {
  console.log(`Document ID: ${result.documents[0].$id}`);
}
```

### Inspect State at Breakpoints

Add manual breakpoints to inspect data:

```typescript
// After Phase 1
console.log('\n📊 Reference Map Contents:');
for (const [oldRef, newRef] of referenceMap.entries()) {
  console.log(`  ${oldRef} → ${newRef}`);
}

// After Phase 2
console.log('\n📊 Updated Entry Sample:');
console.log(JSON.stringify(updatedEntries[0], null, 2));
```

### Verify Each Step Independently

Test individual functions:

```typescript
// Test outcome validation only
async function testOutcomeValidation() {
  const databases = new Databases(adminClient);
  const entries = [{ outcomeRefs: ['O1', 'O2'] }];

  try {
    await validateOutcomeReferences(databases, entries, 'course_c84473');
    console.log('✅ Validation passed');
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}
```

### Check Database State Directly

Query Appwrite directly to verify state:

```bash
# List all lesson_templates for course
curl -X GET \
  "https://cloud.appwrite.io/v1/databases/default/collections/lesson_templates/documents?queries[]=equal('courseId','course_c84473')" \
  -H "X-Appwrite-Project: your_project_id" \
  -H "X-Appwrite-Key: your_api_key"
```

### Dry-Run Mode (Future Enhancement)

Add flag to preview without writes:

```typescript
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!DRY_RUN) {
  await databases.createDocument(...);
} else {
  console.log('[DRY RUN] Would create document:', data);
}
```

Run with:
```bash
DRY_RUN=true npm run seed:authored-sow
```

### Compare Before/After State

```bash
# Before seeding
curl ... > before.json

# Run seeding
npm run seed:authored-sow

# After seeding
curl ... > after.json

# Compare
diff before.json after.json
```

---

## Quick Reference: Common Fixes

| Error | Quick Fix |
|-------|-----------|
| Missing env vars | Create `.env.local` with API key |
| File not found | Generate SOW with `run_sow_author.py` |
| Invalid outcomes | Run `migrateCourseOutcomes.ts` first |
| Permission denied | Use admin API key, not session |
| JSON parse error | Validate with `jq`, regenerate if needed |
| Duplicate templates | Check SOW JSON for duplicate `order` values |
| Collection not found | Create collections in Appwrite Console |

---

**Support**: For issues not covered here, check [architecture.md](./architecture.md) for design context or [seeding-scripts-reference.md](./seeding-scripts-reference.md) for detailed API documentation.
