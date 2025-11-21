# Evidence Validation Fixes - Summary

## Overview

Implemented comprehensive validation and error logging for evidence data to prevent Server Error 500 during lesson completion. All fixes include detailed logging to help diagnose issues.

**Status**: ✅ All 3 fixes implemented with comprehensive error logging

---

## Fix 1: Response Size Validation (Frontend)

**Location**: `LessonCompletionSummaryTool.tsx:216-239`

**Problem**: Evidence `response` field has max size of 100,000 characters in Appwrite. If student response + feedback exceeds this, creation fails with Server Error 500.

**Solution**: Auto-truncate responses exceeding limit with clear marker.

**Implementation**:
```typescript
if (mapped.response && typeof mapped.response === 'string') {
  const originalLength = mapped.response.length;

  if (originalLength > 100000) {
    console.error(`❌ [Evidence ${entryNum}] Response exceeds database limit!`);
    console.error(`   Original length: ${originalLength} characters`);
    console.error(`   Database limit: 100,000 characters`);
    console.error(`   Item ID: ${mapped.itemId}`);
    console.error(`   First 200 chars: ${mapped.response.substring(0, 200)}`);

    // Truncate with clear marker
    mapped.response = mapped.response.substring(0, 99950) + '\n\n[Response truncated due to database size limit]';

    console.warn(`⚠️ [Evidence ${entryNum}] Response truncated to 100,000 chars`);
  } else {
    console.log(`✅ [Evidence ${entryNum}] Response size OK: ${originalLength} chars`);
  }
}
```

**Error Logging**:
- ❌ Original length logged when exceeding limit
- ❌ First 200 chars logged for debugging
- ⚠️ Warning when truncation occurs
- ✅ Confirmation when size is valid

---

## Fix 2: Confidence Value Validation (Frontend)

**Location**: `LessonCompletionSummaryTool.tsx:241-276`

**Problem**: Confidence values must be in range [0, 1] with no NaN or Infinity. LLM evaluations could produce invalid values causing database rejection.

**Solution**: Validate type, check for NaN/Infinity, clamp to valid range [0, 1].

**Implementation**:
```typescript
if (mapped.confidence !== undefined && mapped.confidence !== null) {
  const originalConfidence = mapped.confidence;

  if (typeof mapped.confidence !== 'number') {
    console.error(`❌ [Evidence ${entryNum}] Confidence is not a number!`);
    console.error(`   Type: ${typeof mapped.confidence}`);
    console.error(`   Value: ${mapped.confidence}`);
    mapped.confidence = 0;
  } else if (isNaN(mapped.confidence)) {
    console.error(`❌ [Evidence ${entryNum}] Confidence is NaN!`);
    console.error(`   Item ID: ${mapped.itemId}`);
    mapped.confidence = 0;
  } else if (!isFinite(mapped.confidence)) {
    console.error(`❌ [Evidence ${entryNum}] Confidence is Infinity!`);
    console.error(`   Value: ${mapped.confidence}`);
    console.error(`   Item ID: ${mapped.itemId}`);
    mapped.confidence = 0;
  } else if (mapped.confidence < 0 || mapped.confidence > 1) {
    console.error(`❌ [Evidence ${entryNum}] Confidence out of range [0, 1]!`);
    console.error(`   Original value: ${originalConfidence}`);
    console.error(`   Item ID: ${mapped.itemId}`);

    // Clamp to valid range
    mapped.confidence = Math.max(0, Math.min(1, mapped.confidence));

    console.warn(`⚠️ [Evidence ${entryNum}] Confidence clamped to: ${mapped.confidence}`);
  } else {
    console.log(`✅ [Evidence ${entryNum}] Confidence OK: ${mapped.confidence}`);
  }
}
```

**Error Logging**:
- ❌ Type errors logged with actual type and value
- ❌ NaN/Infinity errors logged with item ID context
- ❌ Out-of-range errors logged with original value
- ⚠️ Warning when clamping occurs
- ✅ Confirmation when value is valid

---

## Fix 3: Attempts Value Validation (Frontend)

**Location**: `LessonCompletionSummaryTool.tsx:278-293`

**Problem**: Attempts must be a positive integer (>= 1). Invalid values could cause database type errors.

**Solution**: Validate type and range, default to 1 if invalid.

**Implementation**:
```typescript
if (mapped.attempts !== undefined && mapped.attempts !== null) {
  if (typeof mapped.attempts !== 'number' || mapped.attempts < 1) {
    console.error(`❌ [Evidence ${entryNum}] Invalid attempts value!`);
    console.error(`   Value: ${mapped.attempts}`);
    console.error(`   Type: ${typeof mapped.attempts}`);
    mapped.attempts = 1;
  } else {
    console.log(`✅ [Evidence ${entryNum}] Attempts OK: ${mapped.attempts}`);
  }
} else {
  console.warn(`⚠️ [Evidence ${entryNum}] Attempts missing, defaulting to 1`);
  mapped.attempts = 1;
}
```

**Error Logging**:
- ❌ Invalid type/value logged with details
- ⚠️ Warning when defaulting to 1
- ✅ Confirmation when value is valid

---

## Fix 4: Datetime Format Fix (AI Backend)

**Location**: `teaching_utils.py:9, 138, 241, 291, 293, 310-313`

**Problem**: Appwrite datetime fields expect ISO 8601 format with timezone. Python's `datetime.now().isoformat()` produces format without timezone suffix, potentially causing parsing errors.

**Solution**: Use `datetime.now(timezone.utc).isoformat()` to generate UTC timestamps with 'Z' suffix.

**Implementation**:
```python
from datetime import datetime, timezone

# In _create_evidence_entry (line 291-293):
utc_timestamp = datetime.now(timezone.utc).isoformat()

logger.info(f"Creating evidence entry for item {item_id}: correct={evaluation.is_correct}, attempts={attempts}, timestamp={utc_timestamp}")

evidence = {
    "timestamp": utc_timestamp,  # UTC timezone for Appwrite datetime fields
    # ... rest of fields
}

# In _create_mastery_update (line 138):
"timestamp": datetime.now(timezone.utc).isoformat()  # UTC timezone for Appwrite compatibility

# In _update_mastery_scores for AS updates (line 241):
"timestamp": datetime.now(timezone.utc).isoformat()  # UTC timezone for Appwrite compatibility
```

**Error Logging** (lines 310-313):
```python
# Log response length for debugging size issues
response_length = len(student_response) if student_response else 0
if response_length > 90000:
    logger.warning(f"⚠️ Evidence response is very long ({response_length} chars) - may exceed database limit of 100,000")
logger.info(f"Evidence response length: {response_length} characters")
```

**Before**: `"2025-01-21T14:30:00.123456"` (no timezone)
**After**: `"2025-01-21T14:30:00.123456+00:00"` (UTC timezone)

---

## Comprehensive Logging Strategy

### Frontend Validation Logs

**Per-Evidence-Entry Logs**:
1. `[Evidence Validation] Processing entry X/Y` - Processing start
2. `[Evidence Debug] Entry X original data:` - Input data inspection
3. Validation results for each field (✅/❌/⚠️)
4. `[Evidence Debug] Entry X final mapped data:` - Output data inspection
5. `✅ [Evidence X] Validation complete - all fields valid` - Success confirmation

**Batch Summary**:
- `✅ All X evidence records validated successfully` - Final confirmation

### Backend Evidence Creation Logs

**In teaching_utils.py** (lines 293, 310-313):
```python
logger.info(f"Creating evidence entry for item {item_id}: correct={evaluation.is_correct}, attempts={attempts}, timestamp={utc_timestamp}")

# Log response length for debugging size issues
response_length = len(student_response) if student_response else 0
if response_length > 90000:
    logger.warning(f"⚠️ Evidence response is very long ({response_length} chars) - may exceed database limit of 100,000")
logger.info(f"Evidence response length: {response_length} characters")
```

### API Evidence Creation Logs

**In complete/route.ts** (lines 110, 123-127):
```typescript
console.log(`[API] Evidence data being created:`, JSON.stringify(evidenceData));

// On error:
console.error(`[API] Failed to create evidence record:`, error.message);
console.error(`[API] Evidence data that failed:`, JSON.stringify(evidenceData));
console.error(`[API] Full error:`, JSON.stringify(error, null, 2));
```

---

## Error Detection Flow

When an evidence validation error occurs, logs will show:

1. **Frontend Console** (Browser DevTools):
   ```
   [Evidence Validation] Processing entry 3/5
   [Evidence Debug] Entry 3 original data: {...}
   ❌ [Evidence 3] Response exceeds database limit!
      Original length: 125000 characters
      Database limit: 100,000 characters
      Item ID: card_abc123
      First 200 chars: [response preview]
   ⚠️ [Evidence 3] Response truncated to 100,000 chars
   [Evidence Debug] Entry 3 final mapped data: {...}
   ✅ [Evidence 3] Validation complete - all fields valid
   ```

2. **Backend Logs** (langgraph-agent):
   ```
   INFO:agent.teaching_utils:Creating evidence entry for item card_abc123: correct=True, attempts=2, timestamp=2025-01-21T14:30:00.123456+00:00
   WARNING:agent.teaching_utils:⚠️ Evidence response is very long (98000 chars) - may exceed database limit of 100,000
   INFO:agent.teaching_utils:Evidence response length: 98000 characters
   ```

3. **API Logs** (complete/route.ts):
   ```
   [API] Evidence data being created: {"sessionId":"...", "itemId":"card_abc123", "response":"[truncated]", ...}
   ✅ Evidence created: doc_xyz789
   ```

4. **On Failure**:
   ```
   [API] Failed to create evidence record: [error message]
   [API] Evidence data that failed: {"sessionId":"...", ...}
   [API] Full error: {detailed error object}
   ```

---

## Testing Checklist

Before retrying lesson completion:

- [x] Response size validation implemented (max 100,000 chars)
- [x] Confidence value validation implemented (0-1, no NaN/Infinity)
- [x] Attempts value validation implemented (>= 1)
- [x] Datetime format fixed (UTC timezone)
- [x] Response length warning in backend (> 90,000 chars)
- [x] Comprehensive error logging in frontend
- [x] Comprehensive error logging in backend
- [x] Comprehensive error logging in API

## Next Steps

1. **Retry lesson completion** with validation fixes in place
2. **Monitor frontend console** for validation warnings/errors
3. **Check backend logs** for response length warnings
4. **Review API logs** for creation success/failure details

If Server Error 500 still occurs:
- Frontend logs will show EXACT field that failed validation
- Backend logs will show response length warnings
- API logs will show EXACT error from Appwrite

This comprehensive logging will pinpoint the exact cause if any issues remain.

---

## Related Documentation

- `/docs/EVIDENCE_DATA_FLOW_ANALYSIS.md` - Complete data pipeline analysis
- `/docs/COMPLETION_API_DEBUG_PLAN.md` - Original debug plan
- `/scripts/test-evidence-creation.ts` - Evidence schema verification script
