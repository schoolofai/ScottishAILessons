# State Reading API Integration Guide

This guide explains how to use direct state reading with the LangGraph SDK Client instead of interrupt-based human-in-the-loop patterns for course recommendations.

## Overview

The course recommendation system has been updated to use **direct state return** instead of interrupts. This means:

- ✅ **Frontend**: Uses LangGraph SDK Client to read state directly
- ✅ **Backend**: Stores recommendations in state and completes normally
- ✅ **Performance**: Faster response, no interrupt overhead
- ✅ **Teaching Loop**: Still uses interrupts for lesson cards (where real interaction is needed)

## Frontend Integration Pattern

### 1. Basic State Reading

```typescript
import { Client } from "@langchain/langgraph-sdk";

// Initialize client
const client = new Client({
  apiUrl: "http://localhost:2024"
});

// Read current state
const state = await client.threads.getState(thread_id);
const recommendations = extractRecommendationsFromState(state.values);
```

### 2. Polling for Recommendations

```typescript
// Poll until recommendations are ready
async function waitForRecommendations(thread_id: string): Promise<any> {
  const maxAttempts = 10;
  const pollInterval = 500; // 500ms

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const state = await client.threads.getState(thread_id);

    if (state.values.recommendations_ready) {
      return extractRecommendationsFromState(state.values);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error("Recommendations not ready after timeout");
}
```

### 3. Complete Workflow Example

```typescript
// Step 1: Start recommendations request
const thread = await client.threads.create();
await client.runs.create(thread.thread_id, {
  assistant_id: "agent",
  input: {
    mode: "planning",
    session_context: {
      request_type: "get_recommendations",
      course: { courseId: "course_c84473" },
      student: { id: "stu_123" }
    }
  }
});

// Step 2: Wait for completion and read state
const recommendations = await waitForRecommendations(thread.thread_id);

// Step 3: Display recommendations to user
if (recommendations.available) {
  console.log(`Found ${recommendations.candidates.length} lessons`);
  recommendations.candidates.forEach(lesson => {
    console.log(`- ${lesson.title} (score: ${lesson.priorityScore})`);
  });
}

// Step 4: Handle lesson selection
const selectedLessonId = "lt_algebra_1"; // User selection
const lessonContext = createLessonSelectionContext(
  selectedLessonId,
  recommendations
);

// Step 5: Continue to teaching loop
await client.runs.create(thread.thread_id, {
  assistant_id: "agent",
  input: {
    session_context: lessonContext,
    mode: "teaching"
  }
});
```

## Backend Utilities

### Core Functions

#### `extract_recommendations_from_state(state)`
Extracts structured recommendations from raw LangGraph state.

```python
from src.agent.course_manager_utils import extract_recommendations_from_state

# Extract recommendations for frontend
recommendations = extract_recommendations_from_state(state)

# Returns:
{
  "available": True,
  "candidates": [
    {
      "lessonTemplateId": "lt_1",
      "title": "Linear Equations",
      "priorityScore": 0.85,
      "reasons": ["overdue", "foundational"]
    }
  ],
  "metadata": {
    "course_id": "course_c84473",
    "total_candidates": 1,
    "summary": { ... }
  },
  "thread_id": "thread_123",
  "recommendations_ready": True
}
```

#### `get_thread_readiness_status(state)`
Check what operations are available on the current thread.

```python
status = get_thread_readiness_status(state)

# Returns:
{
  "recommendations_ready": True,
  "can_select_lesson": True,
  "teaching_active": False,
  "orchestration_phase": "recommendations_ready",
  "routing_decision": "complete"
}
```

#### `create_lesson_selection_context(lesson_id, state)`
Create session context for transitioning to teaching loop.

```python
context = create_lesson_selection_context("lt_algebra_1", state)

# Returns:
{
  "lesson_selection": {
    "lessonTemplateId": "lt_algebra_1",
    "sessionId": "sess_20240115_103000",
    "metadata": {
      "title": "Linear Equations",
      "priority_score": 0.85
    }
  },
  "mode": "teaching",
  "course_id": "course_c84473"
}
```

## State Structure Reference

### Key State Fields

| Field | Type | Description |
|-------|------|-------------|
| `recommendations_ready` | `boolean` | True when recommendations available for reading |
| `course_recommendation` | `object` | Contains candidates array and metadata |
| `orchestration_phase` | `string` | Current phase: `requesting_recommendations`, `recommendations_ready`, `teaching_active` |
| `routing_decision` | `string` | Last routing decision: `course_manager`, `complete`, `teaching` |
| `thread_id` | `string` | Persistent thread identifier |

### Course Recommendation Structure

```typescript
interface CourseRecommendation {
  courseId: string;
  graphRunId: string;
  candidates: Array<{
    lessonTemplateId: string;
    title: string;
    priorityScore: number;
    reasons: string[];
  }>;
  rubric: string;
  timestamp: string;
}
```

## Thread Management

### Thread Lifecycle

1. **Create Thread**: `client.threads.create()`
2. **Request Recommendations**: Send planning mode input
3. **Poll State**: Check `recommendations_ready` flag
4. **Extract Data**: Use utility functions to parse state
5. **Select Lesson**: Create lesson selection context
6. **Start Teaching**: Send teaching mode input

### Thread ID Persistence

- **Single Thread**: Use the same thread ID throughout the user session
- **State Continuity**: All state is preserved across requests
- **No Interrupts**: Recommendations are stored and accessible until next request

## Error Handling

### Common Scenarios

```typescript
// Empty recommendations
if (!recommendations.available) {
  console.log("No lessons available for this course");
}

// Thread validation
const validation = validateThreadForStateReading(thread_id);
if (!validation.valid) {
  console.error(validation.error);
  // Create new thread or show error to user
}

// Timeout handling
try {
  const recommendations = await waitForRecommendations(thread_id);
} catch (error) {
  console.error("Failed to get recommendations:", error.message);
  // Show fallback UI or retry
}
```

### Backend Error States

- **No Candidates**: `recommendations.available = false`
- **Invalid Thread**: Utility functions return error objects
- **Missing State**: Functions handle missing fields gracefully

## Performance Considerations

- **Polling Frequency**: 500ms recommended for good UX
- **Timeout**: 5-10 seconds max wait time
- **Caching**: State is cached in LangGraph, no need for frontend caching
- **Concurrent Requests**: Each thread is isolated, supports multiple users

## Migration from Interrupts

### Before (Interrupt Pattern)
```typescript
// Old: Interrupt-based approach
await client.runs.create(thread_id, input);
// Wait for interrupt...
const interrupt = await waitForInterrupt();
// Handle interrupt payload...
```

### After (Direct State Reading)
```typescript
// New: Direct state reading
await client.runs.create(thread_id, input);
const state = await client.threads.getState(thread_id);
const recommendations = extractRecommendationsFromState(state.values);
```

## Testing

Run the state reading API tests:

```bash
cd langgraph-agent
source ../venv/bin/activate
python -m pytest tests/test_state_reading_api.py -v
```

All utilities are thoroughly tested with unit and integration tests covering:
- ✅ Valid recommendation extraction
- ✅ Empty/missing data handling
- ✅ Thread validation
- ✅ Context creation for lesson selection
- ✅ Complete workflow integration
- ✅ Error handling scenarios