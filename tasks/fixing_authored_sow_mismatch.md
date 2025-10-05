# Add Missing Metadata Fields to SOWV2 Collection

## Problem
SOWV2 documents are created from Authored_SOW templates but **critical metadata is not copied**:
- `metadata` field contains coherence policies, sequencing notes, duration (weeks, periods_per_week)
- `accessibility_notes` field contains accessibility guidance

This means when students enroll, they lose access to important curriculum context.

## Metadata Structure (from Authored_SOW)
```typescript
interface AuthoredSOWMetadata {
  coherence: {
    policy_notes: string[];        // e.g., "Calculator use policy"
    sequencing_notes: string[];    // e.g., "Spiral approach"
  };
  accessibility_notes: string[];   // e.g., "Use plain language (CEFR_B1)"
  engagement_notes: string[];      // e.g., "Scottish contexts"
  weeks: number;                   // 36
  periods_per_week: number;        // 3
}
```

## Implementation Plan

### 1. Add Fields to SOWV2 Appwrite Collection
Add two new attributes:
- `metadata` (string, max 10000 chars, default "{}")
- `accessibility_notes` (string, max 2000 chars, default "")

### 2. Update TypeScript Types
**File**: `lib/appwrite/driver/SOWDriver.ts`
Update `SOWData` interface:
```typescript
export interface SOWData {
  studentId: string;
  courseId: string;
  entries: SOWEntry[];
  createdAt: string;
  source_sow_id?: string;
  source_version?: string;
  customizations?: any;
  metadata?: any;              // ✅ ADD
  accessibility_notes?: string; // ✅ ADD
}
```

### 3. Update copyFromAuthoredSOW Method
**File**: `lib/appwrite/driver/SOWDriver.ts:427-467`
Copy metadata fields from Authored_SOW:
```typescript
const sowData: SOWData = {
  studentId,
  courseId,
  entries,
  createdAt: new Date().toISOString(),
  source_sow_id: courseId,
  source_version: authoredSOW.version,
  customizations: {},
  metadata: authoredSOW.metadata,              // ✅ ADD
  accessibility_notes: authoredSOW.accessibility_notes  // ✅ ADD
};
```

### 4. Update upsertSOW Method
**File**: `lib/appwrite/driver/SOWDriver.ts:135-186`
Handle new fields when saving:
```typescript
if (sowData.metadata !== undefined) {
  docData.metadata = JSON.stringify(sowData.metadata);
}
if (sowData.accessibility_notes !== undefined) {
  docData.accessibility_notes = sowData.accessibility_notes;
}
```

### 5. Update getSOWForEnrollment Method
**File**: `lib/appwrite/driver/SOWDriver.ts:34-65`
Return metadata when fetching SOWV2:
```typescript
return {
  studentId: record.studentId,
  courseId: record.courseId,
  entries: JSON.parse(record.entries || '[]'),
  createdAt: record.createdAt,
  metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
  accessibility_notes: record.accessibility_notes
};
```

### 6. Update Documentation
**File**: `docs/appwrite-data-model.md:586-617`
Update SOWV2 schema documentation to include new fields.

## Testing Strategy
1. Add metadata/accessibility_notes attributes to Appwrite
2. Test enrollment flow copies metadata correctly
3. Verify existing enrollments continue to work (fields are optional)
4. Check that metadata is accessible in student dashboard/planning views

## Benefits
✅ Students retain curriculum coherence context
✅ Accessibility guidance preserved for personalized SOWs
✅ Duration information available for planning
✅ Backward compatible (fields are optional)
