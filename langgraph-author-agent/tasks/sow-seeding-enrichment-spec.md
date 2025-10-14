# SoW Seeding Script Enrichment Specification

## Status
**Draft** | Created: 2025-10-13 | Split from: `sow-enrichment-pipeline-spec.md`

## Overview

This spec defines the **enrichment pipeline implementation** in `seedAuthoredSOW.ts`. The pipeline transforms minimal AI-generated SoW output into production-ready documents by adding metadata, enriching assessment standards with descriptions, and validating data integrity.

**Related Spec**: `sow-prompt-enrichment-spec.md` (AI prompt changes)

## Problem Statement

The current seeding workflow assumes AI generates complete SoW documents including all metadata. This creates inefficiencies:

1. **No Validation Layer**: Direct seeding of AI output means errors propagate to database
2. **Missing Enrichment**: Assessment standard codes remain as codes, requiring downstream lookups
3. **Incomplete Metadata**: Manual tracking of versions, timestamps, template references

**Impact**:
- Downstream systems (lesson author) must perform ~80-100 Course_data.txt lookups per course
- No fail-fast validation of assessment standard codes before database insertion
- Manual metadata management prone to human error

## Goals

1. **Add Validation Layer**: Fail-fast on invalid references before database operations
2. **Enrich Assessment Standards**: Transform codes into descriptive objects with full context
3. **Generate Metadata**: Add $id, version, status, timestamps, lessonTemplateRef automatically
4. **Maintain Data Integrity**: 100% validation of all references against official SQA data

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Raw AI Output (authored_sow.json)                            │
│    - Minimal pedagogical content                                │
│    - courseId, entries[].order, entries[].assessmentStandardRefs│
│    - NO metadata ($id, version, status, timestamps)             │
│    - NO lessonTemplateRef                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. seedAuthoredSOW.ts - PHASE 0.5: Enrichment (NEW)            │
│    A. Fetch Course_data from Appwrite (course_outcomes)         │
│    B. Generate Metadata Fields                                  │
│       - $id = f"csow_{courseId}"                                │
│       - version = 1                                             │
│       - status = "draft"                                        │
│       - createdAt/updatedAt = ISO timestamps                    │
│    C. Enrich Each Entry                                         │
│       - lessonTemplateRef = f"AUTO_TBD_{order}"                 │
│       - coherence.unit = lookup from outcomeRefs                │
│       - assessmentStandards = enrich codes with descriptions    │
│    D. Validate All References                                   │
│       - Fail-fast on invalid assessment standard codes          │
│       - Fail-fast on missing order field                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Enriched SoW (complete document)                             │
│    - All metadata fields populated                              │
│    - All lessonTemplateRef generated                            │
│    - All assessmentStandards enriched with descriptions         │
│    - Ready for database insertion                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Existing seedAuthoredSOW.ts Workflow                         │
│    - PHASE 1: Validate Outcome References                       │
│    - PHASE 2: Create/Update Lesson Templates                    │
│    - PHASE 3: Upsert Authored_SOW Document                      │
│    - PHASE 4: Validate Template References                      │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### Current seedAuthoredSOW.ts Structure

**File**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`

```typescript
async function seedSingleSOW(sowFilePath: string, courseIdOverride?: string): Promise<void> {
  // Setup Appwrite client
  const client = new Client()...;
  const databases = new Databases(client);

  // Read SOW file
  const fileContent = fs.readFileSync(sowFilePath, 'utf-8');
  const sowData: SOWJSONFile = JSON.parse(fileContent);

  // PHASE 0: Validate Prerequisites
  await validatePrerequisites(databases, courseId);

  // PHASE 1: Validate Outcome References
  await validateOutcomeReferences(databases, sowData.entries, courseId);

  // PHASE 2: Create/Update Lesson Template Placeholders
  const referenceMap = await createOrUpdateLessonTemplates(...);

  // PHASE 3: Upsert Authored_SOW Document
  await upsertAuthoredSOW(databases, sowData, courseId, referenceMap);

  // PHASE 4: Validate Template References
  await validateTemplateReferences(databases, courseId, referenceMap);
}
```

### NEW: Phase 0.5 - Enrichment Pipeline

Add new phase between PHASE 0 and PHASE 1:

```typescript
async function seedSingleSOW(sowFilePath: string, courseIdOverride?: string): Promise<void> {
  // ... existing setup ...

  // Read RAW SOW file (minimal AI output)
  const rawSowData: SOWJSONFile = JSON.parse(fileContent);
  const courseId = courseIdOverride || rawSowData.courseId;

  console.log(`✅ Loaded raw SOW data: ${rawSowData.entries.length} lessons\\n`);

  // ============================================================
  // PHASE 0: Validate Prerequisites
  // ============================================================
  console.log('📦 PHASE 0: Validate Prerequisites');
  await validatePrerequisites(databases, courseId);

  // ============================================================
  // PHASE 0.5: ENRICH SOW DATA (NEW!)
  // ============================================================
  console.log('\\n📦 PHASE 0.5: Enrich SoW Data');
  console.log('=' .repeat(60));
  const enrichedSowData = await enrichSOWData(rawSowData, databases, courseId);

  // ============================================================
  // PHASE 1: Validate Outcome References
  // ============================================================
  console.log('\\n📦 PHASE 1: Validate Outcome References');
  await validateOutcomeReferences(databases, enrichedSowData.entries, courseId);

  // ... rest of workflow uses enrichedSowData ...
}
```

### Enrichment Pipeline Implementation

```typescript
/**
 * Enrich SoW data with metadata and assessment standard descriptions
 */
async function enrichSOWData(
  sowData: SOWJSONFile,
  databases: Databases,
  courseId: string
): Promise<SOWJSONFile> {
  console.log('\\n🔍 Starting enrichment pipeline...\\n');

  // ============================================================
  // STEP 1: Generate Top-Level Metadata Fields
  // ============================================================
  console.log('📋 Step 1: Generate metadata fields');

  if (!sowData.$id) {
    sowData.$id = `csow_${courseId}`;
    console.log(`  ✅ Generated $id: ${sowData.$id}`);
  }

  if (!sowData.version) {
    sowData.version = 1;
    console.log(`  ✅ Set version: ${sowData.version}`);
  }

  if (!sowData.status) {
    sowData.status = 'draft';
    console.log(`  ✅ Set status: ${sowData.status}`);
  }

  const now = new Date().toISOString();
  sowData.createdAt = sowData.createdAt || now;
  sowData.updatedAt = now;
  console.log(`  ✅ Set timestamps: ${now}`);

  // ============================================================
  // STEP 2: Fetch Course_data.txt from Appwrite
  // ============================================================
  console.log('\\n🔍 Step 2: Fetch Course_data from Appwrite');
  const courseData = await fetchCourseData(databases, courseId);
  console.log(`  ✅ Loaded ${courseData.outcomes.length} outcomes`);

  // ============================================================
  // STEP 3: Enrich Each Entry
  // ============================================================
  console.log('\\n🔧 Step 3: Enrich entries');
  console.log(`  Processing ${sowData.entries.length} entries...\\n`);

  for (let i = 0; i < sowData.entries.length; i++) {
    const entry = sowData.entries[i];
    console.log(`  [${i + 1}/${sowData.entries.length}] ${entry.label}`);

    // --------------------------------------------------------
    // 3A. Validate Order Field (AI-generated, required)
    // --------------------------------------------------------
    if (!entry.order && entry.order !== 0) {
      throw new Error(
        `❌ Entry "${entry.label}" missing required 'order' field\\n\\n` +
        `💡 This is a pedagogical field that MUST be generated by AI.\\n` +
        `   Check SoW author prompts ensure 'order' field is populated.`
      );
    }

    // --------------------------------------------------------
    // 3B. Generate lessonTemplateRef from Order
    // --------------------------------------------------------
    if (!entry.lessonTemplateRef) {
      entry.lessonTemplateRef = `AUTO_TBD_${entry.order}`;
      console.log(`    ✅ Generated lessonTemplateRef: ${entry.lessonTemplateRef}`);
    }

    // --------------------------------------------------------
    // 3C. Extract Unit from Course_data Using outcomeRefs
    // --------------------------------------------------------
    if (entry.outcomeRefs && entry.outcomeRefs.length > 0) {
      const outcomeId = entry.outcomeRefs[0];
      const unitInfo = lookupUnitForOutcome(courseData, outcomeId);

      if (unitInfo && entry.coherence) {
        entry.coherence.unit = unitInfo.title;
        console.log(`    ✅ Set unit: ${unitInfo.title}`);
      }
    }

    // --------------------------------------------------------
    // 3D. CRITICAL: Enrich Assessment Standards
    // --------------------------------------------------------
    if (entry.assessmentStandardRefs && entry.assessmentStandardRefs.length > 0) {
      entry.assessmentStandards = await enrichAssessmentStandards(
        entry.assessmentStandardRefs,
        courseData
      );

      console.log(`    ✅ Enriched ${entry.assessmentStandards.length} assessment standards`);

      // Log enriched descriptions for verification
      for (const standard of entry.assessmentStandards) {
        console.log(`       - ${standard.code}: ${standard.description.substring(0, 50)}...`);
      }
    }

    console.log(''); // Blank line between entries
  }

  console.log('\\n✅ Enrichment pipeline complete!\\n');
  console.log('=' .repeat(60));
  return sowData;
}
```

### Helper Functions

#### 1. Fetch Course Data from Appwrite

```typescript
/**
 * Fetch Course_data.txt from Appwrite course_outcomes collection
 */
async function fetchCourseData(
  databases: Databases,
  courseId: string
): Promise<CourseData> {
  try {
    // Query course_outcomes for this course
    const outcomes = await databases.listDocuments(
      'default',
      'course_outcomes',
      [Query.equal('courseId', courseId)]
    );

    if (outcomes.documents.length === 0) {
      throw new Error(
        `No course_outcomes found for courseId: ${courseId}\\n\\n` +
        `💡 ACTION REQUIRED:\\n` +
        `   1. Run: npm run seed:courses\\n` +
        `   2. Verify course exists in Appwrite courses collection\\n` +
        `   3. Check course_outcomes seeding completed successfully`
      );
    }

    // Parse Course_data.txt structure from outcomes documents
    return parseCourseDataFromOutcomes(outcomes.documents);

  } catch (error: any) {
    throw new Error(
      `❌ Failed to fetch Course_data for ${courseId}: ${error.message}\\n\\n` +
      `💡 Ensure course_outcomes collection is populated with SQA data.`
    );
  }
}

/**
 * Parse course_outcomes documents into Course_data structure
 */
function parseCourseDataFromOutcomes(documents: any[]): CourseData {
  const outcomes = documents.map(doc => ({
    outcomeId: doc.outcomeId,
    outcomeTitle: doc.outcomeTitle || doc.title,
    unitTitle: doc.unitTitle,
    assessmentStandards: doc.assessmentStandards || []
  }));

  return { outcomes };
}
```

#### 2. Enrich Assessment Standards

```typescript
/**
 * Enrich assessment standard codes with full descriptions
 *
 * CRITICAL: This eliminates downstream lookups in lesson author prompts
 */
async function enrichAssessmentStandards(
  codes: string[],
  courseData: CourseData
): Promise<AssessmentStandard[]> {
  const enriched: AssessmentStandard[] = [];

  for (const code of codes) {
    const standardInfo = lookupAssessmentStandard(courseData, code);

    if (!standardInfo) {
      throw new Error(
        `❌ Assessment standard "${code}" not found in Course_data\\n\\n` +
        `💡 ACTION REQUIRED:\\n` +
        `   1. Verify code "${code}" exists in official SQA specifications\\n` +
        `   2. Check course_outcomes collection has correct assessment standards\\n` +
        `   3. Re-run bulk course seeding if data is missing: npm run seed:courses\\n` +
        `   4. If code is incorrect, update the AI-generated SoW file`
      );
    }

    enriched.push({
      code: code,
      description: standardInfo.desc,
      outcome: standardInfo.outcome_id,
      unit: standardInfo.unit_title
    });
  }

  return enriched;
}

/**
 * Lookup assessment standard by code in Course_data structure
 */
function lookupAssessmentStandard(
  courseData: CourseData,
  code: string
): StandardInfo | null {
  // Search through all outcomes for the assessment standard
  for (const outcome of courseData.outcomes) {
    if (!outcome.assessmentStandards) continue;

    const standard = outcome.assessmentStandards.find(
      (as: any) => as.code === code
    );

    if (standard) {
      return {
        code: standard.code,
        desc: standard.description || standard.desc,
        outcome_id: outcome.outcomeId,
        unit_title: outcome.unitTitle || outcome.outcomeTitle
      };
    }
  }

  return null;
}
```

#### 3. Lookup Unit for Outcome

```typescript
/**
 * Lookup unit information for an outcome
 */
function lookupUnitForOutcome(
  courseData: CourseData,
  outcomeId: string
): UnitInfo | null {
  const outcome = courseData.outcomes.find(
    (o: any) => o.outcomeId === outcomeId
  );

  if (outcome) {
    return {
      title: outcome.unitTitle || outcome.outcomeTitle
    };
  }

  return null;
}
```

### Type Definitions

```typescript
/**
 * Enriched assessment standard with full context
 */
interface AssessmentStandard {
  code: string;              // e.g., "AS1.1"
  description: string;        // Full SQA description
  outcome: string;            // Parent outcome code (e.g., "O1")
  unit: string;               // Unit title for context
}

/**
 * SoW entry with optional enriched assessment standards
 */
interface AuthoredSOWEntry {
  order: number;                              // REQUIRED from AI
  lessonTemplateRef?: string;                 // Generated by enrichment
  label: string;                              // From AI
  lesson_type: string;                        // From AI
  outcomeRefs?: string[];                     // From AI
  assessmentStandardRefs?: string[];          // From AI (codes only)
  assessmentStandards?: AssessmentStandard[]; // Generated by enrichment
  coherence?: {
    unit?: string;                            // Generated by enrichment
    block_name?: string;                      // From AI
    block_index?: string | number;            // From AI
    prerequisites?: string[];                 // From AI
  };
  policy?: any;                               // From AI
  engagement_tags?: string[];                 // From AI
  pedagogical_blocks?: string[];              // From AI
  accessibility_profile?: any;                // From AI
  estMinutes?: number;                        // From AI
  notes?: string;                             // From AI
}

/**
 * Complete SoW document structure
 */
interface SOWJSONFile {
  $id?: string;                               // Generated by enrichment
  courseId: string;                           // REQUIRED from AI
  version?: number;                           // Generated by enrichment
  status?: string;                            // Generated by enrichment
  metadata: {
    coherence?: {
      policy_notes?: string[];
      sequencing_notes?: string[];
    };
    accessibility_notes?: string[];
    engagement_notes?: string[];
    weeks?: number;
    periods_per_week?: number;
  };
  entries: AuthoredSOWEntry[];                // From AI, enriched by pipeline
  createdAt?: string;                         // Generated by enrichment
  updatedAt?: string;                         // Generated by enrichment
}

/**
 * Course data structure from course_outcomes collection
 */
interface CourseData {
  outcomes: Array<{
    outcomeId: string;
    outcomeTitle: string;
    unitTitle?: string;
    assessmentStandards?: Array<{
      code: string;
      description: string;
      desc?: string;  // Alternative field name
    }>;
  }>;
}

/**
 * Internal lookup result types
 */
interface StandardInfo {
  code: string;
  desc: string;
  outcome_id: string;
  unit_title: string;
}

interface UnitInfo {
  title: string;
}
```

## Error Handling

### Fail-Fast Validation

```typescript
// ============================================================
// ERROR 1: Missing assessment standard code in Course_data
// ============================================================
if (!standardInfo) {
  throw new Error(
    `❌ Assessment standard "${code}" not found in Course_data\\n\\n` +
    `💡 ACTION REQUIRED:\\n` +
    `   1. Verify code exists in SQA specifications\\n` +
    `   2. Check course_outcomes collection data\\n` +
    `   3. Run: npm run seed:courses\\n` +
    `   4. If code is wrong, update AI-generated SoW file`
  );
}

// ============================================================
// ERROR 2: Missing order field (AI should have provided)
// ============================================================
if (!entry.order && entry.order !== 0) {
  throw new Error(
    `❌ Entry "${entry.label}" missing required 'order' field\\n\\n` +
    `💡 This is a pedagogical field generated by AI.\\n` +
    `   Check SoW author prompts ensure 'order' is populated.\\n` +
    `   Current entry: ${JSON.stringify(entry, null, 2)}`
  );
}

// ============================================================
// ERROR 3: Course data unavailable
// ============================================================
if (!courseData || courseData.outcomes.length === 0) {
  throw new Error(
    `❌ Could not load Course_data for courseId: "${courseId}"\\n\\n` +
    `💡 Ensure course_outcomes collection is populated:\\n` +
    `   $ npm run seed:courses\\n` +
    `   Then verify course exists in courses collection.`
  );
}

// ============================================================
// ERROR 4: Malformed course_outcomes documents
// ============================================================
try {
  const courseData = parseCourseDataFromOutcomes(documents);
} catch (error: any) {
  throw new Error(
    `❌ Failed to parse course_outcomes documents: ${error.message}\\n\\n` +
    `💡 Check course_outcomes document structure matches expected format.\\n` +
    `   Expected: { outcomeId, outcomeTitle, assessmentStandards[] }\\n` +
    `   Received: ${JSON.stringify(documents[0], null, 2)}`
  );
}
```

## Testing Strategy

### Unit Tests

**File**: `assistant-ui-frontend/scripts/__tests__/enrichSOWData.test.ts`

```typescript
describe('enrichSOWData', () => {
  describe('metadata generation', () => {
    it('should generate $id from courseId if missing', async () => {
      const rawSow = { courseId: 'course_123', entries: [] };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.$id).toBe('csow_course_123');
    });

    it('should default version to 1', async () => {
      const rawSow = { courseId: 'course_123', entries: [] };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.version).toBe(1);
    });

    it('should set status to draft', async () => {
      const rawSow = { courseId: 'course_123', entries: [] };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.status).toBe('draft');
    });

    it('should generate ISO timestamps', async () => {
      const rawSow = { courseId: 'course_123', entries: [] };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.createdAt).toMatch(/\\d{4}-\\d{2}-\\d{2}T/);
      expect(enriched.updatedAt).toMatch(/\\d{4}-\\d{2}-\\d{2}T/);
    });
  });

  describe('entry enrichment', () => {
    it('should generate lessonTemplateRef from order', async () => {
      const rawSow = {
        courseId: 'course_123',
        entries: [{ order: 1, label: 'Test Lesson' }]
      };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.entries[0].lessonTemplateRef).toBe('AUTO_TBD_1');
    });

    it('should enrich assessmentStandardRefs with descriptions', async () => {
      const rawSow = {
        courseId: 'course_123',
        entries: [{
          order: 1,
          label: 'Test',
          assessmentStandardRefs: ['AS1.1']
        }]
      };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.entries[0].assessmentStandards).toHaveLength(1);
      expect(enriched.entries[0].assessmentStandards[0]).toMatchObject({
        code: 'AS1.1',
        description: expect.any(String),
        outcome: expect.any(String),
        unit: expect.any(String)
      });
    });

    it('should fail fast on invalid assessment standard code', async () => {
      const rawSow = {
        courseId: 'course_123',
        entries: [{
          order: 1,
          label: 'Test',
          assessmentStandardRefs: ['INVALID_CODE']
        }]
      };
      await expect(
        enrichSOWData(rawSow, mockDatabases, 'course_123')
      ).rejects.toThrow('Assessment standard "INVALID_CODE" not found');
    });

    it('should fail fast on missing order field', async () => {
      const rawSow = {
        courseId: 'course_123',
        entries: [{ label: 'Test Lesson' }] // Missing order
      };
      await expect(
        enrichSOWData(rawSow, mockDatabases, 'course_123')
      ).rejects.toThrow('missing required \\'order\\' field');
    });
  });

  describe('backward compatibility', () => {
    it('should preserve assessmentStandardRefs alongside enriched', async () => {
      const rawSow = {
        courseId: 'course_123',
        entries: [{
          order: 1,
          label: 'Test',
          assessmentStandardRefs: ['AS1.1']
        }]
      };
      const enriched = await enrichSOWData(rawSow, mockDatabases, 'course_123');
      expect(enriched.entries[0].assessmentStandardRefs).toEqual(['AS1.1']);
      expect(enriched.entries[0].assessmentStandards).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
describe('seedAuthoredSOW with enrichment', () => {
  it('should seed complete course with enriched data', async () => {
    const sowPath = 'data/Seeding_Data_Full/input/sows/mathematics_national-4.json';

    // Load raw SOW (minimal AI output)
    const rawSow = JSON.parse(fs.readFileSync(sowPath, 'utf-8'));

    // Verify raw SOW is minimal (no metadata)
    expect(rawSow.$id).toBeUndefined();
    expect(rawSow.version).toBeUndefined();
    expect(rawSow.entries[0].lessonTemplateRef).toBeUndefined();
    expect(rawSow.entries[0].assessmentStandards).toBeUndefined();

    // Run seeding with enrichment
    await seedSingleSOW(sowPath, 'course_mathematics_national-4');

    // Query enriched SOW from database
    const enrichedSow = await databases.getDocument(
      'default',
      'Authored_SOW',
      `csow_course_mathematics_national-4`
    );

    // Verify enrichment applied
    expect(enrichedSow.$id).toBe('csow_course_mathematics_national-4');
    expect(enrichedSow.version).toBe(1);
    expect(enrichedSow.status).toBe('draft');
    expect(enrichedSow.createdAt).toBeDefined();
    expect(enrichedSow.entries[0].lessonTemplateRef).toMatch(/AUTO_TBD_\\d+/);
    expect(enrichedSow.entries[0].assessmentStandards).toBeDefined();
    expect(enrichedSow.entries[0].assessmentStandards[0].description).toBeDefined();
  });
});
```

## Implementation Checklist

### Phase 1: Core Infrastructure (1 day)
- [ ] Define TypeScript interfaces (`AssessmentStandard`, `CourseData`, etc.)
- [ ] Implement `fetchCourseData()` from Appwrite course_outcomes
- [ ] Implement `parseCourseDataFromOutcomes()` helper
- [ ] Implement `lookupAssessmentStandard()` with fail-fast validation
- [ ] Implement `lookupUnitForOutcome()` for coherence.unit enrichment

### Phase 2: Enrichment Pipeline (1 day)
- [ ] Implement `enrichSOWData()` main function
- [ ] Add metadata field generation ($id, version, status, timestamps)
- [ ] Add entry field generation (lessonTemplateRef from order)
- [ ] Add assessment standards enrichment (CRITICAL)
- [ ] Add unit extraction (coherence.unit from outcomeRefs)
- [ ] Add order field validation (fail-fast if missing)

### Phase 3: Integration (1 day)
- [ ] Add PHASE 0.5 to `seedSingleSOW()` workflow
- [ ] Update logging to show enrichment progress
- [ ] Test with `mathematics_national-4.json`
- [ ] Verify enriched output structure in Appwrite
- [ ] Test with minimal SOW (no metadata in AI output)

### Phase 4: Testing & Validation (1 day)
- [ ] Write unit tests for helper functions
- [ ] Write integration test for full enrichment pipeline
- [ ] Test fail-fast scenarios (missing codes, malformed data, missing order)
- [ ] Test backward compatibility (legacy field preservation)
- [ ] Performance testing with large SOWs (100+ lessons)

### Phase 5: Documentation & Rollout (1 day)
- [ ] Update seedAuthoredSOW.ts inline documentation
- [ ] Add enrichment examples to README
- [ ] Document error messages and troubleshooting guide
- [ ] Create migration guide for existing SOWs
- [ ] Coordinate with AI prompt updates (see `sow-prompt-enrichment-spec.md`)

## Success Criteria

### Functional Requirements
- [ ] **Enrichment Success Rate**: 100% for valid SOW inputs
- [ ] **Validation Accuracy**: 100% of invalid assessment codes caught before database insertion
- [ ] **Backward Compatibility**: 100% of legacy fields (assessmentStandardRefs) preserved
- [ ] **Performance**: <5 seconds enrichment time for 100-lesson SOW
- [ ] **Metadata Generation**: 100% of required fields populated

### Quality Metrics
- [ ] **Description Accuracy**: 100% match with SQA official descriptions from course_outcomes
- [ ] **Data Integrity**: 0 broken references in enriched output
- [ ] **Error Messages**: 100% of failures have actionable user guidance
- [ ] **Test Coverage**: ≥90% code coverage for enrichment functions

### Downstream Impact
- [ ] **Lesson Author Lookups**: Reduced to 0 (was ~80-100 per course)
- [ ] **Database Consistency**: 0 documents with missing metadata fields
- [ ] **Seeding Reliability**: 100% success rate when Course_data exists

## Dependencies

### Prerequisites
- [ ] course_outcomes collection populated with SQA data (`npm run seed:courses`)
- [ ] AI prompts updated to remove metadata generation (see `sow-prompt-enrichment-spec.md`)
- [ ] Appwrite collections support enriched schema (assessmentStandards field)

### Coordination Required
- [ ] Test that minimal AI output + enrichment = complete SoW
- [ ] Verify lesson author can consume enriched format
- [ ] Update frontend if it displays assessment standard data

## Open Questions

1. **Enrichment Idempotency**: Should enrichment overwrite existing metadata or skip if present?
   - *Recommendation*: Always overwrite (idempotent) - ensures consistency

2. **Caching Strategy**: Should Course_data be cached to reduce Appwrite queries?
   - *Recommendation*: No caching for MVP - Course_data rarely changes
   - *Future*: Add Redis cache if performance becomes issue

3. **Partial Enrichment**: What if some codes are invalid but others are valid?
   - *Recommendation*: Fail-fast on first invalid code (current approach)
   - *Alternative*: Skip invalid with warnings (less strict, more brittle)

4. **Outcome Enrichment**: Should we also enrich `outcomeRefs` → `outcomes` with titles?
   - *Recommendation*: Yes, apply same pattern for consistency
   - *Implementation*: Add in Phase 2 after assessment standard enrichment works

5. **Migration Strategy**: How to handle existing SOWs in database?
   - *Recommendation*: Re-seed all SOWs after enrichment deployed
   - *Alternative*: Add migration script to enrich existing documents in-place

---

## References

- **Implementation File**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`
- **AI Prompt Changes**: `sow-prompt-enrichment-spec.md`
- **Sample Data**: `langgraph-author-agent/data/Seeding_Data_Full/input/sows/mathematics_national-4.json`
- **Related Spec**: `langgraph-author-agent/tasks/sow_prompt-refactor.md`

---

**Document Owner**: AI Analysis | **Status**: Draft | **Last Updated**: 2025-10-13
