# Evidence Data Flow Analysis

## Complete Data Pipeline: AI Backend → Frontend → API → Database

### 1. AI Backend Creates Evidence (teaching_utils.py:290-314)

**Function**: `_create_evidence_entry()`

**Evidence Structure Generated**:
```python
evidence = {
    "timestamp": datetime.now().isoformat(),           # ✅ Valid
    "item_id": item_id,                                # ✅ Valid (mapped to itemId)
    "response": student_response,                      # ✅ Valid
    "correct": evaluation.is_correct,                  # ✅ Valid
    "should_progress": should_progress,                # ❌ NOT in Evidence schema
    "confidence": evaluation.confidence,               # ✅ Valid
    "partial_credit": evaluation.partial_credit,       # ❌ NOT in Evidence schema
    "reasoning": evaluation.reasoning,                 # ✅ Valid
    "attempts": attempts,                              # ✅ Valid
    "feedback": evaluation.feedback,                   # ✅ Valid
    "max_attempts_reached": attempts >= max_attempts   # ❌ NOT in Evidence schema
}

# Optional drawing fields (Phase 10)
if student_drawing_file_ids:
    evidence["student_drawing_file_ids"] = student_drawing_file_ids  # ✅ Valid
if student_drawing_text:
    evidence["student_drawing_text"] = student_drawing_text          # ✅ Valid
if student_drawing:
    evidence["student_drawing"] = student_drawing                    # ⚠️ Legacy field
```

**Extra Fields Not in Schema**:
- `should_progress` - Used for teaching graph logic, not for persistence
- `partial_credit` - Internal evaluation metric, not for Evidence collection
- `max_attempts_reached` - Teaching graph control flag, not for persistence

---

### 2. Frontend Receives and Maps Evidence (LessonCompletionSummaryTool.tsx:191-216)

**Function**: `persistData()` - Evidence mapping

**Type Definition** (lines 82-91):
```typescript
evidence: Array<{
  timestamp: string;
  item_id: string;              // ← Note: underscore format
  response: string;
  correct: boolean;
  attempts: number;
  confidence: number;
  reasoning: string;
  feedback: string;
  // Extra fields from AI backend NOT in type definition:
  // should_progress, partial_credit, max_attempts_reached
}>;
```

**Mapping Logic** (lines 191-216):
```typescript
const evidenceData = evidence.map((entry, index) => {
  const mapped = {
    sessionId: session_id,                    // ✅ Added by frontend (required)
    itemId: entry.item_id,                    // ✅ Converted snake_case → camelCase
    response: entry.response,                 // ✅ Pass-through
    correct: entry.correct,                   // ✅ Pass-through
    attempts: entry.attempts,                 // ✅ Pass-through
    confidence: entry.confidence,             // ✅ Pass-through
    reasoning: entry.reasoning,               // ✅ Pass-through
    feedback: entry.feedback,                 // ✅ Pass-through
    timestamp: entry.timestamp                // ✅ Pass-through
  };

  // Validate required fields (lines 209-214)
  if (!mapped.sessionId) throw new Error(`Evidence ${index + 1}: Missing sessionId`);
  if (!mapped.itemId) throw new Error(`Evidence ${index + 1}: Missing itemId`);
  if (mapped.response === undefined) throw new Error(`Evidence ${index + 1}: Missing response`);
  if (mapped.correct === undefined) throw new Error(`Evidence ${index + 1}: Missing correct flag`);

  return mapped;
});
```

**Key Insight**: The frontend mapping creates a NEW object with ONLY the 9 fields listed. The extra fields (`should_progress`, `partial_credit`, `max_attempts_reached`) are automatically filtered out by destructuring.

---

### 3. API Receives and Creates Documents (complete/route.ts:105-132)

**Evidence Processing**:
```typescript
if (evidence && evidence.length > 0) {
  console.log(`[API] Creating ${evidence.length} Evidence records...`);

  for (const evidenceData of evidence) {
    try {
      // Line 110: Logs exact data being sent to Appwrite
      console.log(`[API] Evidence data being created:`, JSON.stringify(evidenceData));

      // Lines 112-119: Direct pass-through to Appwrite
      const evidenceDoc = await databases.createDocument(
        'default',
        'evidence',
        ID.unique(),
        evidenceData,  // ← NO MODIFICATION - passes exactly what frontend sent
        // No permissions - documentSecurity: false
      );

      createdEvidence.push(evidenceDoc);
      console.log(`[API] Evidence created: ${evidenceDoc.$id}`);
    } catch (error: any) {
      // Lines 123-127: Detailed error logging
      console.error(`[API] Failed to create evidence record:`, error.message);
      console.error(`[API] Evidence data that failed:`, JSON.stringify(evidenceData));
      console.error(`[API] Full error:`, JSON.stringify(error, null, 2));
      throw error; // FAIL-FAST - Don't silently fail
    }
  }
}
```

**Key Insight**: The API passes `evidenceData` directly to Appwrite without modification. If Appwrite rejects it, the error is logged with full details.

---

### 4. Appwrite Evidence Schema (from schema inspection)

**Required Fields**:
- `sessionId`: string (size: 50)
- `itemId`: string (size: 50)
- `response`: string (size: 100000)
- `correct`: boolean

**Optional Fields**:
- `attempts`: integer (default: 1)
- `confidence`: double (default: 0)
- `reasoning`: string
- `feedback`: string
- `timestamp`: datetime
- `attemptIndex`: integer (default: 0)
- `score`: double (default: 0)
- `outcomeScores`: string (default: "{}")
- `submittedAt`: datetime
- `student_drawing_file_ids`: string[]
- `student_drawing_text`: string

**Document Security**: false (no row-level permissions needed)

---

## Potential Failure Points

### Hypothesis 1: Field Size Violation ⚠️
**Likelihood**: HIGH

**Issue**: The `response` field has max size of 100,000 characters. If a student's response (including any teacher feedback or explanations) exceeds this, Appwrite will reject it.

**Evidence from Code**:
- teaching_utils.py line 293: `"response": student_response`
- student_response can contain ANY student input
- For drawing CFUs, line 713 uses: `student_drawing_text or "[Drawing submitted]"`
- No size validation before sending to API

**Fix**: Add validation in frontend mapping:
```typescript
// Validate response size (max 100000 chars)
if (mapped.response && mapped.response.length > 100000) {
  console.warn(`Evidence ${index + 1}: Response truncated from ${mapped.response.length} to 100000 chars`);
  mapped.response = mapped.response.substring(0, 100000) + '... [truncated]';
}
```

---

### Hypothesis 2: Invalid Datetime Format ⚠️
**Likelihood**: MEDIUM

**Issue**: Appwrite expects ISO 8601 datetime format. Python's `datetime.now().isoformat()` should be compatible, but timezone info might cause issues.

**Evidence from Code**:
- teaching_utils.py line 291: `"timestamp": datetime.now().isoformat()`
- Python datetime.isoformat() produces: `"2025-01-21T14:30:00.123456"`
- Appwrite datetime expects: `"2025-01-21T14:30:00.000Z"` (with timezone)

**Potential Issue**: Missing timezone (Z suffix)

**Fix**: Update teaching_utils.py:
```python
from datetime import datetime, timezone

# Line 291:
"timestamp": datetime.now(timezone.utc).isoformat()  # Adds 'Z' suffix
```

---

### Hypothesis 3: Confidence Value Out of Range ⚠️
**Likelihood**: LOW

**Issue**: Appwrite `double` type has limits. If confidence somehow exceeds 1.0 or is NaN/Infinity, it might fail.

**Evidence from Code**:
- teaching_utils.py line 296: `"confidence": evaluation.confidence`
- Confidence comes from LLM evaluation (should be 0.0-1.0)
- No validation before sending

**Fix**: Add validation in teaching_utils.py:
```python
"confidence": max(0.0, min(1.0, evaluation.confidence)),  # Clamp to [0, 1]
```

---

### Hypothesis 4: sessionId or itemId Format Issues ⚠️
**Likelihood**: LOW

**Issue**: Appwrite string fields have size limits (50 chars). If IDs are too long, creation fails.

**Evidence from Code**:
- sessionId comes from session context (Appwrite generates 20-char IDs)
- itemId comes from cfu.id or card.id (should also be Appwrite IDs)
- Max size is 50 chars - should be fine for Appwrite IDs

**Unlikely to be the issue**, but could validate:
```typescript
if (mapped.sessionId.length > 50) throw new Error('sessionId too long');
if (mapped.itemId.length > 50) throw new Error('itemId too long');
```

---

## Test Evidence Creation Script Results

**Script**: `/scripts/test-evidence-creation.ts`

**Test Data Used**:
```typescript
{
  sessionId: 'test_session_123',
  itemId: 'card_001',
  response: 'Test answer: 2+2=4',
  correct: true,
  attempts: 1,
  confidence: 0.8,
  reasoning: 'Simple arithmetic',
  feedback: 'Correct answer!',
  timestamp: new Date().toISOString()
}
```

**Results**: ✅ All 4 tests passed
- Schema verification
- Full evidence record creation
- Minimal required fields
- Frontend format data

**Conclusion**: Evidence schema works perfectly with properly formatted data. The Server Error 500 must be caused by:
1. Invalid field values (size, format, range)
2. NOT by field name mismatches or schema issues

---

## Recommended Next Steps

### Step 1: Add Field Validation in Frontend Mapping

Update `LessonCompletionSummaryTool.tsx` lines 191-216 to add validation:

```typescript
const evidenceData = evidence.map((entry, index) => {
  let mapped = {
    sessionId: session_id,
    itemId: entry.item_id,
    response: entry.response,
    correct: entry.correct,
    attempts: entry.attempts,
    confidence: entry.confidence,
    reasoning: entry.reasoning,
    feedback: entry.feedback,
    timestamp: entry.timestamp
  };

  // Validate and sanitize values

  // 1. Truncate response if too long (max 100000 chars)
  if (mapped.response && mapped.response.length > 100000) {
    console.warn(`Evidence ${index + 1}: Response truncated from ${mapped.response.length} chars`);
    mapped.response = mapped.response.substring(0, 99950) + '... [truncated for database limit]';
  }

  // 2. Clamp confidence to valid range [0, 1]
  if (typeof mapped.confidence === 'number') {
    if (isNaN(mapped.confidence) || !isFinite(mapped.confidence)) {
      console.warn(`Evidence ${index + 1}: Invalid confidence ${mapped.confidence}, defaulting to 0`);
      mapped.confidence = 0;
    } else {
      mapped.confidence = Math.max(0, Math.min(1, mapped.confidence));
    }
  }

  // 3. Validate required fields (existing logic)
  if (!mapped.sessionId) throw new Error(`Evidence ${index + 1}: Missing sessionId`);
  if (!mapped.itemId) throw new Error(`Evidence ${index + 1}: Missing itemId`);
  if (mapped.response === undefined) throw new Error(`Evidence ${index + 1}: Missing response`);
  if (mapped.correct === undefined) throw new Error(`Evidence ${index + 1}: Missing correct flag`);

  return mapped;
});
```

### Step 2: Fix Datetime Format in AI Backend

Update `langgraph-agent/src/agent/teaching_utils.py` line 291:

```python
from datetime import datetime, timezone

# Line 291:
"timestamp": datetime.now(timezone.utc).isoformat(),
```

### Step 3: Retry Lesson Completion with Enhanced Logging

After implementing fixes, retry a lesson completion and check the detailed logs:
- Frontend console: Look for `[Evidence Debug] Entry X:` logs
- API logs: Look for `[API] Evidence data being created:` logs
- If failure occurs, the detailed error will show exact field and value that failed

---

## Summary

**Current Status**:
- ✅ Evidence schema is correct
- ✅ Frontend mapping filters extra fields correctly
- ✅ API passes data directly to Appwrite
- ✅ Database creation works with properly formatted data

**Most Likely Root Cause**: Field size violation (response > 100000 chars)

**Second Most Likely**: Datetime format missing timezone

**Next Action**: Implement validation fixes and retry lesson completion to capture detailed error logs.
