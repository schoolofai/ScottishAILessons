# Manual Verification: Mastery and Evidence Persistence

## Overview
This document provides steps to manually verify that the mastery and evidence persistence system works correctly.

## Test Data Expected from Backend

### Evidence Array (from lesson_completion_summary tool call)
```javascript
evidence: [
  {
    timestamp: "2024-01-01T10:00:00Z",
    item_id: "card_1",
    response: "Student's answer to question 1",
    correct: true,
    attempts: 1,
    confidence: 0.95,
    reasoning: "Clear understanding of concept",
    feedback: "Excellent work!"
  },
  {
    timestamp: "2024-01-01T10:05:00Z",
    item_id: "card_2",
    response: "Student's answer to question 2",
    correct: false,
    attempts: 2,
    confidence: 0.3,
    reasoning: "Struggled with application",
    feedback: "Try reviewing the examples again"
  }
]
```

### Mastery Updates Array (from lesson_completion_summary tool call)
```javascript
mastery_updates: [
  {
    outcome_id: "H225_73_Outcome_1",
    score: 1.0,  // First attempt correct
    timestamp: "2024-01-01T10:00:00Z"
  },
  {
    outcome_id: "H225_73_Outcome_2",
    score: 0.7,  // Correct on second attempt
    timestamp: "2024-01-01T10:05:00Z"
  }
]
```

## Manual Testing Steps

### 1. Complete a Lesson Session
1. Start the application: `cd langgraph-agent && ./start.sh`
2. Navigate to a lesson and complete it fully
3. Wait for the lesson completion UI to appear
4. Open browser developer tools → Console tab
5. Click "Mark as Complete" button

### 2. Verify Console Logs
Look for these console messages:
```
🚀 Starting lesson completion persistence...
Evidence records: X, Mastery updates: Y
📝 Persisting evidence records...
✅ Persisted X evidence records
🎯 Persisting mastery updates...
✅ Persisted Y mastery updates
📊 Updating session status...
✅ All lesson completion data persisted successfully
```

### 3. Check Database (if using Appwrite Console)
1. Log into Appwrite console
2. Navigate to Databases → default → evidence collection
3. Verify new evidence records contain:
   - sessionId, itemId, response, correct
   - attempts, confidence, reasoning, feedback, timestamp
4. Navigate to mastery collection
5. Verify new mastery records contain:
   - studentId, outcomeRef, level, confidence, lastUpdated

### 4. Verify Error Handling
1. Disconnect internet or break Appwrite connection
2. Complete a lesson
3. Click "Mark as Complete"
4. Should see error alert with specific error message
5. Should still navigate to dashboard (graceful degradation)

## Expected Behavior

### Success Path
- All evidence records saved with complete data
- All mastery scores saved/updated based on backend calculation
- Session marked as complete with endedAt timestamp
- User navigated to dashboard
- No error messages

### Error Path
- Clear error message shown to user
- User warned about potential data loss
- User still able to continue (graceful degradation)
- Error logged to console for debugging

## Performance Verification

### Batch Operations
- Evidence: Processed in batches of 10 records
- Mastery: Processed in batches of 10 records
- Should complete within 2-3 seconds for typical lesson (5-10 cards)

### Large Lessons (20+ cards)
- Should still complete without timeout
- Progress logged to console
- No UI blocking during persistence

## Data Integrity Checks

### Evidence Records
- Each student response should create exactly one evidence record
- No duplicate evidence for same sessionId + itemId
- All backend fields preserved (attempts, confidence, etc.)

### Mastery Records
- Each outcome should have one mastery record per student
- Existing records updated, new records created as needed
- Scores match backend calculation (1.0, 0.7, or 0.3)
- EMA (Exponential Moving Average) properly calculated

### Session Completion
- Session stage updated to "done"
- endedAt timestamp set
- No orphaned sessions