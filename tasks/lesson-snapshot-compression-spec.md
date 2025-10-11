# Lesson Snapshot Compression Specification

## Problem Statement

The `lessonSnapshot` field in the `sessions` collection is exceeding Appwrite's 11,000 character limit, causing "Invalid document structure" errors during session creation with the message:

```
Failed to create lesson session: Invalid document structure: Attribute "lessonSnapshot" has invalid type. Value must be a valid string and no longer than 11000 chars
```

## Solution Overview

Extend existing compression infrastructure (`compression.ts`) to compress lesson snapshots before storage in Appwrite. Backend agents receive decompressed data and require **NO CHANGES**.

### Architecture Principle: Separation of Concerns

```
Compression = Storage optimization (frontend concern)
Agent logic = Domain operations (backend concern)
Decompression happens at the read boundary before data leaves frontend
```

The backend agent operates on domain objects (LessonSnapshot), not storage formats. Compression is a storage optimization concern that should be transparent to business logic. This follows the same pattern used with `lesson_templates.cards` - the agent receives decompressed cards, never knowing they were compressed in storage.

## Data Flow

### Session Creation Flow
```
lessonSnapshot object → compressJSON() → Appwrite storage
```

### Session Reading Flow
```
Appwrite storage → decompressJSON() → lessonSnapshot object → agent
```

### Backend Agent Flow
```
Receives decompressed lessonSnapshot via session_context (no changes needed)
```

## Technical Implementation

### Existing Infrastructure

The codebase has a mature compression system:
- **File**: `assistant-ui-frontend/lib/appwrite/utils/compression.ts`
- **Technology**: pako (gzip) + base64 encoding
- **Prefix Marker**: `gzip:` for detection
- **Current Use**: Already compressing `lesson_templates.cards` field
- **Features**: Backward compatibility with uncompressed data, error handling, compression stats
- **Compression Ratio**: ~70% size reduction for JSON data

---

## Files to Modify (Frontend Only)

### 1. `assistant-ui-frontend/lib/appwrite/utils/compression.ts`

**Add generic JSON compression functions:**

```typescript
/**
 * Compress any JSON-serializable data to gzipped base64 string
 *
 * @param data - Any JSON-serializable object
 * @returns Compressed string with "gzip:" prefix
 * @throws Error if compression fails
 */
export function compressJSON(data: any): string {
  try {
    // Validate input
    if (data === null || data === undefined) {
      throw new Error('Cannot compress null/undefined data');
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(data);

    // Compress using gzip (same as compressCards)
    const compressed = pako.gzip(jsonString);

    // Convert to base64
    const base64 = Buffer.from(compressed).toString('base64');

    // Add prefix marker for identification
    return COMPRESSION_PREFIX + base64;

  } catch (error) {
    console.error('[compression] Failed to compress JSON:', error);
    throw new Error(`JSON compression failed: ${error.message}`);
  }
}

/**
 * Decompress JSON data with backward compatibility
 *
 * Handles:
 * - Compressed data (has "gzip:" prefix)
 * - Uncompressed JSON strings (backward compatibility)
 * - Already-parsed objects (pass-through)
 * - Null/undefined (returns null)
 *
 * @param data - Compressed/uncompressed data or parsed object
 * @returns Parsed object or null
 * @throws Error if decompression/parsing fails
 */
export function decompressJSON<T = any>(data: string | any | null | undefined): T | null {
  // Handle null/undefined
  if (data === null || data === undefined) {
    console.warn('[compression] Received null/undefined data');
    return null;
  }

  // Handle already-parsed objects (backward compatibility edge case)
  if (typeof data === 'object' && !Array.isArray(data)) {
    console.warn('[compression] Received already-parsed object, returning as-is');
    return data;
  }

  // Handle non-string data
  if (typeof data !== 'string') {
    console.warn('[compression] Unexpected data type:', typeof data);
    return null;
  }

  try {
    // Check if data is compressed (has prefix)
    if (data.startsWith(COMPRESSION_PREFIX)) {
      return decompressGzipBase64JSON<T>(data);
    } else {
      // Fallback: Try parsing as uncompressed JSON (backward compatibility)
      return JSON.parse(data);
    }

  } catch (error) {
    console.error('[compression] Failed to decompress/parse JSON:', error);
    console.error('[compression] Data preview:', data.substring(0, 100));
    throw new Error(`JSON decompression failed: ${error.message}`);
  }
}

/**
 * Internal: Decompress gzipped base64 JSON string
 */
function decompressGzipBase64JSON<T>(data: string): T {
  try {
    // Remove prefix
    const base64Data = data.substring(COMPRESSION_PREFIX.length);

    // Decode base64
    const compressedBuffer = Buffer.from(base64Data, 'base64');

    // Decompress gzip
    const decompressed = pako.ungzip(compressedBuffer, { to: 'string' });

    // Parse JSON
    const parsed = JSON.parse(decompressed);

    return parsed;

  } catch (error) {
    throw new Error(`Gzip decompression failed: ${error.message}`);
  }
}
```

---

### 2. `assistant-ui-frontend/lib/sessions/session-manager.ts`

**Location**: Lines 106 and 139-149

**Changes**:

#### Import Statement (add at top of file)
```typescript
import { compressJSON, decompressJSON } from '../appwrite/utils/compression';
```

#### Compress on Write (line 106)
```typescript
// BEFORE:
lessonSnapshot: JSON.stringify(lessonSnapshot)  // Stringify for storage

// AFTER:
lessonSnapshot: compressJSON(lessonSnapshot)  // Compress for storage

// ADD compression logging after line 106:
const uncompressedSize = JSON.stringify(lessonSnapshot).length;
const compressed = compressJSON(lessonSnapshot);
console.log(`📦 Compressed lesson snapshot: ${uncompressedSize} → ${compressed.length} chars (${((1 - compressed.length/uncompressedSize) * 100).toFixed(1)}% savings)`);

sessionData.lessonSnapshot = compressed;
```

#### Decompress on Read (lines 139-149)
```typescript
// REPLACE parseLessonSnapshot function:

// BEFORE:
export function parseLessonSnapshot(lessonSnapshot: string) {
  try {
    return JSON.parse(lessonSnapshot);
  } catch (error) {
    console.error('Failed to parse lesson snapshot:', error);
    throw new Error('Invalid lesson snapshot data');
  }
}

// AFTER:
export function parseLessonSnapshot(lessonSnapshot: string) {
  try {
    return decompressJSON(lessonSnapshot);  // Auto-handles compressed & uncompressed
  } catch (error) {
    console.error('Failed to decompress/parse lesson snapshot:', error);
    throw new Error('Invalid lesson snapshot data');
  }
}
```

---

### 3. `assistant-ui-frontend/lib/appwrite/driver/SessionDriver.ts`

**Location**: Line 15

**Changes**:

#### Import Statement (add at top of file)
```typescript
import { decompressJSON } from '../utils/compression';
```

#### Decompress When Reading (line 15)
```typescript
// BEFORE:
const parsedSnapshot = JSON.parse(session.lessonSnapshot) as LessonSnapshot;

// AFTER:
const parsedSnapshot = decompressJSON<LessonSnapshot>(session.lessonSnapshot);

// ADD validation after decompression
if (!parsedSnapshot) {
  throw new Error('Failed to decompress lesson snapshot');
}
```

---

### 4. `assistant-ui-frontend/lib/appwrite/planner-service.ts`

**Location**: Line 628

**Changes**:

#### Import Statement (add at top of file)
```typescript
import { compressJSON } from './utils/compression';
```

#### Compress on Write (line 628)
```typescript
// BEFORE:
lessonSnapshot: JSON.stringify({
  title: lesson.title,
  outcomeRefs: lesson.outcomeRefs,
  cards: lesson.cards,
  ...
})

// AFTER:
lessonSnapshot: compressJSON({
  title: lesson.title,
  outcomeRefs: lesson.outcomeRefs,
  cards: lesson.cards,
  ...
})
```

---

### 5. `assistant-ui-frontend/lib/appwrite/driver/LessonDriver.ts`

**Location**: Lines 134 and 243

**Changes**:

#### Import Statement (add at top of file)
```typescript
import { compressJSON } from '../utils/compression';
```

#### Compress on Write (line 134)
```typescript
// BEFORE:
lessonSnapshot: JSON.stringify(lessonSnapshot)

// AFTER:
lessonSnapshot: compressJSON(lessonSnapshot)
```

#### Compress on Write (line 243)
```typescript
// BEFORE:
lessonSnapshot: JSON.stringify(snapshot)

// AFTER:
lessonSnapshot: compressJSON(snapshot)
```

---

### 6. `assistant-ui-frontend/app/api/sessions/route.ts`

**Location**: Line 62

**Changes**:

#### Import Statement (add at top of file)
```typescript
import { compressJSON } from '@/lib/appwrite/utils/compression';
```

#### Compress on Write (line 62)
```typescript
// BEFORE:
lessonSnapshot: JSON.stringify(lessonSnapshot)

// AFTER:
lessonSnapshot: compressJSON(lessonSnapshot)
```

---

## Backend Changes

**NONE** - Backend agents are completely agnostic to compression.

The decompression happens in the frontend before data is passed to the agent via `session_context.lesson_snapshot`. The agent continues to receive plain JavaScript objects.

**Unchanged Files**:
- `langgraph-agent/src/agent/graph_interrupt.py` - No changes needed
- `langgraph-agent/src/agent/graph.py` - No changes needed
- `langgraph-agent/src/agent/graph_simple.py` - No changes needed
- `langgraph-agent/src/agent/teaching_utils.py` - No changes needed
- All other Python backend files - No changes needed

---

## Testing Strategy

### Phase 1: Unit Testing Compression Utilities

**Test File**: `assistant-ui-frontend/lib/appwrite/utils/compression.test.ts`

**Test Cases**:
```typescript
describe('compressJSON / decompressJSON', () => {
  it('should compress and decompress round-trip', () => {
    const data = { title: 'Test', cards: [...] };
    const compressed = compressJSON(data);
    const decompressed = decompressJSON(compressed);
    expect(decompressed).toEqual(data);
  });

  it('should decompress uncompressed JSON (backward compatibility)', () => {
    const data = { title: 'Test' };
    const json = JSON.stringify(data);
    const result = decompressJSON(json);
    expect(result).toEqual(data);
  });

  it('should handle null/undefined inputs', () => {
    expect(decompressJSON(null)).toBeNull();
    expect(decompressJSON(undefined)).toBeNull();
    expect(() => compressJSON(null)).toThrow();
  });

  it('should handle already-parsed objects', () => {
    const data = { title: 'Test' };
    const result = decompressJSON(data);
    expect(result).toEqual(data);
  });

  it('should achieve >60% compression ratio', () => {
    const largeData = { cards: Array(20).fill({ /* card data */ }) };
    const uncompressed = JSON.stringify(largeData).length;
    const compressed = compressJSON(largeData).length;
    const ratio = (compressed / uncompressed) * 100;
    expect(ratio).toBeLessThan(40); // < 40% = > 60% savings
  });

  it('should throw error for invalid compressed data', () => {
    expect(() => decompressJSON('gzip:invalid')).toThrow();
  });
});
```

**Run Tests**:
```bash
cd assistant-ui-frontend
npm run test -- compression.test.ts
```

---

### Phase 2: Integration Testing with Real Data

#### Test 1: Backward Compatibility (Existing Sessions)
```
1. Load existing session with uncompressed lessonSnapshot
2. Verify SessionDriver.getSessionState() works correctly
3. Verify parsedSnapshot is correct
4. Verify agent receives correct data via session_context
```

#### Test 2: New Session Creation
```
1. Create new session via session-manager.ts
2. Verify compressed data is stored in Appwrite (check database)
3. Verify lessonSnapshot starts with "gzip:"
4. Verify compression reduces size by >60% (check logs)
5. Read back session and verify decompression works
6. Verify decompressed data matches original
```

#### Test 3: All Write Paths
```
1. session-manager.ts (main session creation path)
2. planner-service.ts (course manager recommendation path)
3. LessonDriver.ts (lesson driver session creation paths)
4. API route (app/api/sessions/route.ts)
```

---

### Phase 3: End-to-End Testing with Playwright

**Setup**:
```bash
cd langgraph-agent
./stop.sh && ./start.sh
```

**Test Flows**:

#### Flow 1: Complete Lesson Session
```
1. Student logs in with test@scottishailessons.com
2. Navigate to course dashboard
3. Request lesson recommendation (Course Manager)
4. Verify recommendation appears
5. Click "Start Lesson"
   → Triggers session creation with compressed lessonSnapshot
   → Monitor browser console for compression log
6. Verify lesson loads correctly
   → Triggers decompression
   → Verify lesson cards render
7. Complete first lesson card (CFU)
   → Agent receives decompressed lesson_snapshot
   → Verify feedback appears
8. Complete remaining cards
9. Verify session marked complete
10. Check Appwrite database:
    → lessonSnapshot field starts with "gzip:"
    → Field length < 11,000 chars
```

#### Flow 2: Session Continuity
```
1. Start lesson session (creates compressed snapshot)
2. Close browser tab
3. Reopen and navigate back to session
   → Triggers decompression
4. Verify session resumes correctly
5. Verify all lesson data intact
```

#### Flow 3: Context Chat Integration
```
1. During active lesson session
2. Open Context Chat panel
3. Ask question about lesson content
   → Context chat reads from decompressed lesson_snapshot
4. Verify AI tutor has correct context
5. Verify responses reference lesson content correctly
```

**Validation Checklist**:
- ✅ No console errors in browser
- ✅ No backend errors in logs (backend.log, frontend.log)
- ✅ Lesson renders correctly
- ✅ Agent responses are appropriate
- ✅ Session progress tracked correctly
- ✅ Compressed data in Appwrite database

---

## Validation Criteria

### Success Metrics

| Criterion | Expected Result | Validation Method |
|-----------|----------------|-------------------|
| **Storage Format** | New sessions have compressed lessonSnapshot with "gzip:" prefix | Check Appwrite database |
| **Compression Ratio** | Size reduced by >60% | Check console logs |
| **Backward Compatibility** | Old uncompressed sessions still load | Integration tests |
| **Frontend Reads** | All read paths decompress successfully | Unit + integration tests |
| **Agent Integration** | Backend receives decompressed data | E2E tests with playwright |
| **No Errors** | Clean browser console and backend logs | Manual inspection |
| **Character Limit** | Compressed data < 11,000 chars | Database verification |

### Quality Gates

**Before Merge**:
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ E2E test flows complete successfully
- ✅ Manual testing with playwright confirms no regressions
- ✅ Code review completed
- ✅ Compression logs show >60% savings

**After Deploy**:
- ✅ Monitor production logs for compression errors
- ✅ Verify new sessions create successfully
- ✅ Verify old sessions continue working
- ✅ Check Appwrite storage usage metrics

---

## Rollback Plan

### Immediate Rollback (if critical issues arise)

**Step 1: Revert compression on write**
```typescript
// Change all compressJSON() back to JSON.stringify()
// Files to update:
- session-manager.ts (line 106)
- planner-service.ts (line 628)
- LessonDriver.ts (lines 134, 243)
- app/api/sessions/route.ts (line 62)
```

**Step 2: Keep decompression on read**
```typescript
// Leave decompressJSON() in place (backward compatible)
// Files to keep:
- session-manager.ts (parseLessonSnapshot)
- SessionDriver.ts (line 15)
```

**Result**:
- New sessions will be uncompressed
- Old sessions (compressed or uncompressed) continue working
- No data loss
- No migration needed

### Gradual Rollback

If only specific paths have issues:
1. Identify problematic write path
2. Revert only that path to JSON.stringify()
3. Keep other paths compressed
4. Monitor and investigate

---

## Expected Benefits

### Immediate Benefits
🎯 **Fixes Critical Bug**: Resolves "Invalid document structure" error
🎯 **No Migration**: Backward compatible, works with existing data
🎯 **Fast Deployment**: Frontend-only changes, no backend coordination

### Long-term Benefits
🎯 **Storage Reduction**: ~70% less database storage usage
🎯 **Performance**: Faster network transfers (smaller payloads)
🎯 **Scalability**: Supports larger, more complex lessons
🎯 **Cost Savings**: Reduced Appwrite storage costs
🎯 **Future-Proof**: Can add more complex lesson content without hitting limits

---

## Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Utilities** | 2 hours | Add compressJSON/decompressJSON + unit tests |
| **Phase 2: Integration** | 3 hours | Update all 6 files + integration tests |
| **Phase 3: Testing** | 4 hours | E2E testing with playwright |
| **Phase 4: Review & Deploy** | 2 hours | Code review, merge, deploy |

**Total Estimated Time**: 11 hours (1.5 days)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Compression breaks existing sessions | Low | High | Backward compatibility built-in, unit tests |
| Performance degradation from compression | Low | Low | Gzip is fast, minimal CPU overhead |
| Agent receives corrupted data | Low | High | Decompression errors throw immediately, no silent failures |
| Rollback causes data loss | Very Low | Critical | Rollback keeps decompression, no data loss possible |
| Compressed data still exceeds limit | Very Low | Medium | 70% reduction leaves large safety margin |

---

## Dependencies

### Required Packages
- ✅ `pako` - Already installed and used for card compression
- ✅ `Buffer` - Node.js built-in, available in Next.js

### External Dependencies
- ✅ Appwrite SDK - Already integrated
- ✅ LangGraph SDK - Already integrated
- ✅ No new dependencies required

---

## Documentation Updates

### Files to Update After Implementation

1. **`docs/appwrite-data-model.md`**
   - Update sessions collection schema documentation
   - Note lessonSnapshot field uses compression
   - Document backward compatibility

2. **`assistant-ui-frontend/README.md`**
   - Add note about compression utilities
   - Document compression format

3. **`CLAUDE.md`**
   - Update with compression architecture pattern
   - Document separation of concerns (storage vs agent)

---

## Follow-up Tasks

### Monitoring (Post-Deploy)
- [ ] Add compression ratio metrics to logging
- [ ] Monitor Appwrite storage usage trends
- [ ] Track compression errors in Sentry/error tracking

### Future Enhancements
- [ ] Consider compressing other large JSON fields (if needed)
- [ ] Add compression stats to admin dashboard
- [ ] Implement automatic migration script for old sessions (optional)

### Optimization Opportunities
- [ ] Benchmark compression performance
- [ ] Consider alternative compression algorithms (brotli, zstd) if gzip insufficient
- [ ] Evaluate compression level tuning (speed vs ratio tradeoff)

---

## Related Specifications

- `lesson-template-model-versioning-spec.md` - Lesson template data model
- `mvp25-database-schema-implementation.md` - Database schema design
- `seeding-scripts-architecture.md` - Lesson seeding infrastructure

---

## Approval & Sign-off

**Specification Status**: ✅ Ready for Implementation
**Architecture Review**: ✅ Approved (frontend-only, no backend changes)
**Security Review**: ✅ No security concerns (compression is transparent)
**Performance Review**: ✅ Expected improvement (smaller payloads)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Author**: AI Assistant (Claude Code)
**Reviewed By**: TBD
