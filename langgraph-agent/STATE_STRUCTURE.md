# Main Teaching Graph State Structure

This document captures the actual state structure from the main teaching graph (`langgraph-agent`) as extracted on 2025-09-24.

## Key Findings

### State Hierarchy
The main state is in `state.values` with these key fields:

```json
{
  "values": {
    // Core message flow
    "messages": [...],

    // Original input context (preserved for frontend compatibility)
    "session_context": {
      "session_id": "string",
      "student_id": "string",
      "lesson_snapshot": {...}
    },

    // Extracted flat fields for teaching subgraph
    "mode": "teaching",
    "session_id": "string",
    "student_id": "string",
    "course_id": "string",  // Extracted from lesson_snapshot.courseId
    "lesson_snapshot": {...},
    "student_response": "string",

    // Interrupt-specific fields
    "card_presentation_complete": false,
    "interrupt_count": 0,
    "interrupt_history": [],
    "tool_response_received": false,
    "cards_presented_via_ui": [],
    "feedback_interactions_count": 0,
    "can_resume_from_interrupt": true
  }
}
```

### Lesson Snapshot Structure
```json
{
  "courseId": "math-fractions-101",
  "title": "Introduction to Fractions",
  "topic": "Mathematics - Fractions",
  "objectives": [
    "Understand numerator and denominator",
    "Compare simple fractions",
    "Recognize equivalent fractions"
  ],
  "cards": [
    {
      "id": "card-1",
      "content": "What is 2/10 simplified?",
      "cfu": {
        "type": "text",
        "answer": "1/5"
      }
    },
    {
      "id": "card-2",
      "content": "Which is larger: 3/4 or 2/3?",
      "cfu": {
        "type": "mcq",
        "options": ["3/4", "2/3"],
        "correct": 0
      }
    }
  ]
}
```

### Message Structure
```json
{
  "content": "Let's start the lesson",
  "additional_kwargs": {},
  "response_metadata": {},
  "type": "human",
  "name": null,
  "id": "ee2399ac-21ab-4e89-b68b-97998e01da5a",
  "example": false
}
```

## Missing Fields for Context Chat

The current state does NOT include several fields that would be helpful for context-aware chat:

### Student Progress Fields
- `current_card_index` - Which card the student is on
- `cards_completed` - Array of completed card IDs
- `current_card` - The active card object
- `attempts` - Number of attempts on current question
- `hint_level` - Current hint level
- `is_correct` - Whether last answer was correct
- `should_progress` - Whether to move to next card
- `feedback` - Current feedback message
- `stage` - Teaching stage ("design", "deliver", "mark", "progress", "done")
- `evidence` - Performance evidence array
- `mastery_updates` - Mastery scoring updates

### Student Progress Details
- `student_progress.difficulty_level` - Not present
- `student_progress.understanding_level` - Not present
- `student_progress.completed_steps` - Not present
- `student_progress.current_step` - Not present
- `student_progress.struggles` - Not present

## Context Chat Requirements

Based on the failing integration tests, the context chat needs:

1. **Main Graph State Snapshot**: The complete teaching state at the time of context chat request
2. **Student Progress Context**: Current difficulty level, understanding level, progress tracking
3. **Recent Teaching Exchanges**: Last few messages between teacher and student
4. **Current Teaching Position**: Which card, stage, attempts, performance

## Recommended Context Structure for Context Chat

```json
{
  // Original session context (for compatibility)
  "session_context": {
    "session_id": "string",
    "student_id": "string",
    "lesson_snapshot": {...}
  },

  // Full main graph state snapshot
  "main_graph_state": {
    // Copy of actual state.values from main graph
    "messages": [...],
    "mode": "teaching",
    "session_id": "string",
    "student_id": "string",
    "course_id": "string",
    "lesson_snapshot": {...},
    "student_response": "string",
    "card_presentation_complete": false,
    "interrupt_count": 0,
    // ... all other main graph fields
  }
}
```

## Implementation Plan

1. **Frontend**: Extract full `state.values` from main graph and send as `main_graph_state`
2. **Context Chat**: Process `main_graph_state` to extract teaching context
3. **Tests**: Update fixtures to use actual main graph state structure
4. **Prompts**: Use actual field names and values for context awareness

## Critical Fields for Context Awareness

- `course_id` - Extracted from `lesson_snapshot.courseId`
- `lesson_snapshot.title` - For lesson topic awareness
- `lesson_snapshot.topic` - For subject/topic context
- `lesson_snapshot.objectives` - For learning goal awareness
- `messages` - For recent exchange context
- `student_response` - Last student input
- `lesson_snapshot.cards` - For current content awareness

The main graph does **extract and flatten** key fields from `session_context` into individual state fields, which makes them easier to access for teaching logic.