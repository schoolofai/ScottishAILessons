# Integration Plan: Self-Contained SOW Seeding Script

## Overview
Integrate `extractSQAOutcomes.ts` + `migrateCourseOutcomes.ts` logic into `seedAuthoredSOW.ts` to create a fully self-contained seeding script with automatic prerequisite handling.

## Directory Structure Changes

```
langgraph-author-agent/data/Seeding_Data/
├── input/
│   └── sows/
│       ├── mathematics_national-4.json
│       └── application-of-mathematics_national-3.json
└── output/
    ├── course_outcomes_imports/       ← NEW FOLDER
    │   ├── mathematics_national-4.json
    │   └── application-of-mathematics_national-3.json
    ├── logs/
    └── reports/
```

## New Phases

### Phase -2: Extract Outcomes from SQA (Auto-Skip if Import File Exists)
```typescript
async function extractOutcomesFromSQA(
  databases: Databases,
  sowData: AuthoredSOW,
  subject: string,
  level: string,
  outputDir: string
): Promise<void> {
  // Check if import file already exists
  const importFilePath = path.join(outputDir, 'course_outcomes_imports', `${subject}_${level}.json`);

  if (fs.existsSync(importFilePath)) {
    console.log(`  ✅ Import file already exists: ${subject}_${level}.json (SKIP)`);
    return;
  }

  console.log(`  🔍 Extracting outcomes from sqa_education.sqa_current...`);

  // Query SQA collection (extractSQAOutcomes.ts lines 160-168)
  const sqaResult = await databases.listDocuments(
    'sqa_education',
    'sqa_current',
    [
      Query.equal('subject', subject),
      Query.equal('level', level),
      Query.limit(10)
    ]
  );

  if (sqaResult.documents.length === 0) {
    throw new Error(`No SQA data found for ${subject} (${level})`);
  }

  const courseOutcomes: CourseOutcomeImport[] = [];

  // Process each SQA document (extractSQAOutcomes.ts lines 183-228)
  for (const doc of sqaResult.documents) {
    const data = JSON.parse(doc.data);
    const units = data.course_structure?.units || data.units || [];

    for (const unit of units) {
      for (const outcome of unit.outcomes) {
        // Extract keywords and guidance (extractSQAOutcomes.ts lines 75-122)
        const teacherGuidance = generateTeacherGuidance(outcome.assessment_standards);
        const keywords = extractKeywords(outcome.title, outcome.assessment_standards);

        courseOutcomes.push({
          courseId: sowData.courseId,
          courseSqaCode: sowData.courseSqaCode || doc.course_code,
          unitCode: unit.code,
          unitTitle: unit.title,
          scqfCredits: unit.scqf_credits,
          outcomeId: outcome.id,
          outcomeTitle: outcome.title,
          assessmentStandards: JSON.stringify(outcome.assessment_standards),
          teacherGuidance,
          keywords
        });
      }
    }
  }

  // Write to per-course import file (NEW PATH)
  fs.mkdirSync(path.dirname(importFilePath), { recursive: true });
  fs.writeFileSync(importFilePath, JSON.stringify(courseOutcomes, null, 2), 'utf-8');

  console.log(`  ✅ Extracted ${courseOutcomes.length} outcomes → ${subject}_${level}.json`);
}

// Helper functions from extractSQAOutcomes.ts
function extractKeywords(outcomeTitle: string, assessmentStandards: any[]): string[] {
  const keywords = new Set<string>();

  // Extract from title (lines 79-85)
  const titleWords = outcomeTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  titleWords.forEach(word => keywords.add(word));

  // Extract from assessment standards (lines 88-96)
  assessmentStandards.forEach(as => {
    const descWords = as.desc
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4);
    descWords.slice(0, 3).forEach(word => keywords.add(word));
  });

  return Array.from(keywords);
}

function generateTeacherGuidance(assessmentStandards: any[]): string {
  const guidance: string[] = [];

  assessmentStandards.forEach(as => {
    let asGuidance = `**${as.code}**: ${as.desc}`;
    if (as.marking_guidance) asGuidance += `\n  Marking: ${as.marking_guidance}`;
    if (as.skills_list?.length > 0) asGuidance += `\n  Skills: ${as.skills_list.join(', ')}`;
    guidance.push(asGuidance);
  });

  return guidance.join('\n\n');
}
```

### Phase -1: Populate course_outcomes Collection (Auto-Skip if Already Populated)
```typescript
async function populateCourseOutcomes(
  databases: Databases,
  courseId: string,
  subject: string,
  level: string,
  outputDir: string
): Promise<void> {
  // Check if outcomes already populated
  const existingCheck = await databases.listDocuments(
    'default',
    'course_outcomes',
    [
      Query.equal('courseId', courseId),
      Query.limit(1)
    ]
  );

  if (existingCheck.documents.length > 0) {
    console.log(`  ✅ course_outcomes already populated for ${courseId} (SKIP)`);
    return;
  }

  console.log(`  📥 Populating course_outcomes collection...`);

  // Read import file
  const importFilePath = path.join(outputDir, 'course_outcomes_imports', `${subject}_${level}.json`);

  if (!fs.existsSync(importFilePath)) {
    throw new Error(`Import file not found: ${subject}_${level}.json (run Phase -2 first)`);
  }

  const importData: CourseOutcomeImport[] = JSON.parse(fs.readFileSync(importFilePath, 'utf-8'));
  const courseData = importData.filter(item => item.courseId === courseId);

  if (courseData.length === 0) {
    throw new Error(`No import data for courseId ${courseId} in ${subject}_${level}.json`);
  }

  // Create documents (migrateCourseOutcomes.ts lines 163-195)
  let createdCount = 0;
  for (const outcomeData of courseData) {
    const docData = {
      courseId: outcomeData.courseId,
      courseSqaCode: outcomeData.courseSqaCode,
      unitCode: outcomeData.unitCode,
      unitTitle: outcomeData.unitTitle,
      scqfCredits: outcomeData.scqfCredits,
      outcomeId: outcomeData.outcomeId,
      outcomeTitle: outcomeData.outcomeTitle,
      assessmentStandards: outcomeData.assessmentStandards,
      teacherGuidance: outcomeData.teacherGuidance,
      keywords: JSON.stringify(outcomeData.keywords)
    };

    await databases.createDocument('default', 'course_outcomes', ID.unique(), docData);
    createdCount++;
  }

  console.log(`  ✅ Created ${createdCount} course_outcomes documents`);
}
```

### Modified Main Execution Flow
```typescript
async function seedSOWFromFile(filePath: string, inputDir: string) {
  // Parse subject/level from filename (e.g., "mathematics_national-4.json")
  const fileName = path.basename(filePath, '.json');
  const [subject, level] = fileName.split('_');

  // Derive output directory
  const outputDir = path.join(inputDir, 'output');

  // Read SOW file
  const sowData: AuthoredSOW = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`\n🔄 Processing: ${fileName}`);
  console.log(`   Course ID: ${sowData.courseId}`);
  console.log(`   Entries: ${sowData.entries.length}`);
  console.log('');

  try {
    // PHASE -2: Extract outcomes from SQA (auto-skip if import file exists)
    console.log('📦 PHASE -2: Extract Outcomes from SQA');
    await extractOutcomesFromSQA(databases, sowData, subject, level, outputDir);
    console.log('');

    // PHASE -1: Populate course_outcomes (auto-skip if already populated)
    console.log('📦 PHASE -1: Populate course_outcomes Collection');
    await populateCourseOutcomes(databases, sowData.courseId, subject, level, outputDir);
    console.log('');

    // PHASE 0: Validate outcome references
    console.log('📦 PHASE 0: Validate Outcome References');
    await validateOutcomeReferences(databases, sowData.entries, sowData.courseId);
    console.log('');

    // PHASE 1-4: Existing seeding pipeline
    // ... (no changes to existing logic)

  } catch (error) {
    // NO FALLBACK - fail fast with detailed error
    throw new Error(`Failed to seed ${fileName}: ${error.message}`);
  }
}
```

## Key Implementation Details

### 1. Filename-to-Subject-Level Parsing
```typescript
// Input: "mathematics_national-4.json"
// Output: subject = "mathematics", level = "national-4"
const [subject, level] = path.basename(filePath, '.json').split('_');
```

### 2. Auto-Skip Detection
- **Phase -2**: Skip if `output/course_outcomes_imports/<subject>_<level>.json` exists
- **Phase -1**: Skip if `course_outcomes` collection has documents for `courseId`

### 3. SQA Query Mapping
```typescript
// SOW file subject/level → SQA collection query
// mathematics_national-4 → Query.equal('subject', 'mathematics'), Query.equal('level', 'national-4')
```

### 4. courseSqaCode Extraction
```typescript
// Priority:
// 1. sowData.courseSqaCode (if present in SOW file)
// 2. doc.course_code (from SQA document)
const courseSqaCode = sowData.courseSqaCode || sqaDoc.course_code;
```

## Files to Modify

1. **`assistant-ui-frontend/scripts/seedAuthoredSOW.ts`**
   - Add CourseOutcomeImport interface
   - Add extractKeywords() helper
   - Add generateTeacherGuidance() helper
   - Add extractOutcomesFromSQA() phase
   - Add populateCourseOutcomes() phase
   - Add subject/level parsing from filename
   - Update seedSOWFromFile() to include new phases

2. **`langgraph-author-agent/data/Seeding_Data/.gitignore`**
   - Add: `output/course_outcomes_imports/*.json`

3. **`langgraph-author-agent/data/Seeding_Data/README.md`**
   - Update structure documentation
   - Add note about auto-generated course_outcomes_imports

## Validation Strategy

### Test Scenarios
1. **Full Integration (Cold Start)**
   - Delete all course_outcomes for course_c84774
   - Delete mathematics_national-4.json import file
   - Run: `tsx seedAuthoredSOW.ts mathematics_national-4`
   - Verify: Phase -2 extracts, Phase -1 populates, Phase 0-4 succeed

2. **Partial Skip (Import Exists)**
   - Keep mathematics_national-4.json import file
   - Delete course_outcomes for course_c84774
   - Run: `tsx seedAuthoredSOW.ts mathematics_national-4`
   - Verify: Phase -2 skips, Phase -1 populates, Phase 0-4 succeed

3. **Full Skip (Already Seeded)**
   - Keep import file and course_outcomes
   - Run: `tsx seedAuthoredSOW.ts mathematics_national-4`
   - Verify: Phase -2 skips, Phase -1 skips, Phase 0-4 succeed

4. **Batch Mode**
   - Run: `tsx seedAuthoredSOW.ts --batch`
   - Verify: Each file gets its own import file created
   - Verify: Continue-on-error works with new phases

## Error Handling (Fail-Fast)

```typescript
// NO FALLBACK PATTERN - throw exceptions immediately

// Phase -2 errors
if (sqaResult.documents.length === 0) {
  throw new Error(`No SQA data found for ${subject} (${level}). Verify subject/level are correct.`);
}

// Phase -1 errors
if (!fs.existsSync(importFilePath)) {
  throw new Error(`Import file not found: ${subject}_${level}.json. Phase -2 may have failed.`);
}

// Phase 0 errors (existing)
if (invalidRefs.length > 0) {
  throw new Error(`Invalid outcome references: ${invalidRefs.join(', ')}`);
}
```

## Benefits

1. **Single Command Execution**: Only need to run seedAuthoredSOW.ts
2. **Automatic Prerequisite Handling**: No manual script chaining
3. **Idempotent**: Can re-run safely (auto-skips completed phases)
4. **Per-Course Isolation**: Each SOW file generates its own import file
5. **Batch Processing Support**: Works seamlessly with existing batch mode
6. **Fail-Fast Design**: No silent failures, detailed error messages
