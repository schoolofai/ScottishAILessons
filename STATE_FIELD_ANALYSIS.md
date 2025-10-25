# LangGraph State Field Analysis Report

## Executive Summary

This report identifies state fields defined in `InterruptUnifiedState` and `UnifiedState`, and maps which fields are actually used in graph nodes, teaching subgraphs, and LLM prompts.

**Key Finding**: There is significant **bloat and unused field definitions** in the state schemas. Many fields are defined but never used in actual graph logic or prompts.

---

## 1. STATE DEFINITIONS

### 1.1 UnifiedState (shared_state.py)

**Total Fields: 22**

```python
# Main graph fields (3 fields)
messages: Annotated[list[BaseMessage], add_messages]
session_context: Optional[Dict[str, Any]]
mode: str

# Core session fields (4 fields)
session_id: str
student_id: str
lesson_snapshot: Dict[str, Any]
student_response: Optional[str]

# Teaching progression fields (11 fields)
course_id: str
lesson_template_id: str
current_card_index: int
cards_completed: List[str]
current_card: Optional[Dict[str, Any]]
is_correct: Optional[bool]
should_progress: Optional[bool]
feedback: Optional[str]
hint_level: int
attempts: int
max_attempts: int
evidence: List[Dict[str, Any]]
mastery_updates: List[Dict[str, Any]]
stage: Literal["design", "deliver", "mark", "progress", "done"]
should_exit: bool

# Enhanced completion fields (4 fields)
lesson_summary: Optional[BaseMessage]
performance_analysis: Optional[Dict[str, Any]]
retry_recommended: Optional[bool]

# Course Manager fields (3 fields)
course_recommendation: Optional[Dict[str, Any]]
recommendation_summary: Optional[Dict[str, Any]]
validation_results: Optional[Dict[str, Any]]
error: Optional[str]
```

### 1.2 InterruptUnifiedState (interrupt_state.py)

**Total Fields: 22 inherited + 15 new = 37 total**

**NEW fields added (15 fields):**

```python
# Core interrupt management (3 fields)
interrupt_response: Optional[Dict[str, Any]]
card_presentation_complete: bool
tool_response_received: bool

# Interaction tracking (3 fields)
interrupt_count: int
cards_presented_via_ui: List[str]
feedback_interactions_count: int

# Curriculum metadata (7 fields)
course_subject: Optional[str]
course_level: Optional[str]
sqa_course_code: Optional[str]
course_title: Optional[str]
lesson_type: Optional[str]
engagement_tags: Optional[List[str]]
lesson_policy: Optional[Dict[str, Any]]
sow_order: Optional[int]
est_minutes: Optional[int]

# Enriched outcome data (1 field)
enriched_outcomes: Optional[List[Dict[str, Any]]]

# Display-friendly formatted strings (3 fields)
course_subject_display: Optional[str]
course_level_display: Optional[str]
lesson_type_display: Optional[str]

# Accessibility (1 field)
use_plain_text: Optional[bool]
```

---

## 2. FIELD USAGE BY COMPONENT

### 2.1 Main Graph (graph_interrupt.py)

**ENTRY NODE USAGE:**

| Field | Used | Purpose |
|-------|------|---------|
| session_context | YES | Extracted to determine mode |
| mode | YES | Set based on session_context |
| session_id | YES | Extracted from session_context |
| student_id | YES | Extracted from session_context |
| lesson_snapshot | YES | Extracted from session_context |
| student_response | YES | Extracted from last message |
| course_id | YES | Extracted from lesson_snapshot.courseId |
| lesson_template_id | YES | Extracted from lesson_snapshot |
| current_card_index | YES | Initialized to 0 |
| cards_completed | YES | Initialized to [] |
| attempts | YES | Initialized to 0 |
| max_attempts | YES | Initialized to 3 |
| evidence | YES | Initialized to [] |
| mastery_updates | YES | Initialized to [] |
| should_exit | YES | Initialized to False |
| **Curriculum metadata (all)** | YES | Extracted and set for prompts |
| **Display strings (all)** | YES | Generated from curriculum metadata |
| interrupt_count | YES | Initialized |
| cards_presented_via_ui | YES | Initialized |
| feedback_interactions_count | YES | Initialized |
| use_plain_text | YES | Extracted from session_context |

**ROUTER NODE USAGE:**

| Field | Used | Purpose |
|-------|------|---------|
| mode | YES | Read to route to appropriate handler |
| session_context | YES | Fallback logic for mode detection |
| tool_response_received | PARTIAL | Checked for pending responses |

**CHAT NODE USAGE:**

| Field | Used | Purpose |
|-------|------|---------|
| messages | YES | Last message read for user input |

### 2.2 Teaching Graph (teaching_graph.py)

| Field | Used | Purpose |
|-------|------|---------|
| lesson_snapshot | YES | Access card data |
| current_card_index | YES | Track position |
| cards_completed | YES | Track completed cards |
| stage | YES | Determine routing |
| student_response | YES | Evaluate student answer |
| evidence | YES | Record student answers |
| mastery_updates | YES | Update mastery |
| should_exit | YES | Determine termination |
| is_correct | YES | Track evaluation result |
| should_progress | YES | Determine next stage |
| feedback | YES | Store feedback text |
| attempts | YES | Track attempt count |
| max_attempts | YES | Limit retry attempts |
| current_card | YES | Evaluate against CFU |
| hint_level | YES | Track hint progression |

### 2.3 Teaching Graph with Interrupts (teacher_graph_toolcall_interrupt.py)

**ADDITIONAL fields used beyond teaching_graph.py:**

| Field | Used | Purpose |
|-------|------|---------|
| interrupt_response | YES | Receive interrupt payloads |
| current_card_index | YES | Generate tool call IDs |
| lesson_snapshot | YES | Get total card count |
| session_id | YES | Populate lesson completion tool call |
| student_id | YES | Populate tool call args |
| course_id | YES | Populate tool call args |
| est_minutes | YES | Log estimated duration |
| **Curriculum metadata (all)** | YES | Pass to LLMTeacher for prompts |

### 2.4 LLMTeacher Methods

**Methods that accept state parameter:**

| Method | State Fields Used |
|--------|------------------|
| `greet_with_first_card_sync_full()` | course_subject_display, course_level_display, lesson_type_display, engagement_tags, lesson_policy, enriched_outcomes, use_plain_text |
| `present_card_sync_full()` | course_subject_display, course_level_display, engagement_tags, lesson_policy, enriched_outcomes, use_plain_text |
| `present_mcq_card_sync_full()` | course_subject_display, course_level_display, engagement_tags, lesson_policy, enriched_outcomes, use_plain_text |
| `evaluate_response_with_structured_output()` | course_subject_display, course_level_display, engagement_tags, lesson_policy, enriched_outcomes |
| `explain_correct_answer_sync_full()` | course_subject_display, course_level_display, engagement_tags, lesson_policy, enriched_outcomes |
| `transition_to_next_sync_full()` | course_subject_display, course_level_display, engagement_tags, lesson_policy, enriched_outcomes |
| `summarize_completed_lesson_sync_full()` | course_subject_display, course_level_display, sqa_course_code, engagement_tags, lesson_policy, enriched_outcomes |
| `generate_hint_sync_full()` | course_subject_display, course_level_display, engagement_tags, lesson_policy, enriched_outcomes |

---

## 3. UNUSED FIELDS ANALYSIS

### 3.1 Fields Defined but NEVER Used

| Field | State | Reason | Impact |
|-------|-------|--------|--------|
| lesson_summary | UnifiedState | Backend generates AIMessage, frontend never uses this field | LOW - Message goes to messages[] |
| performance_analysis | UnifiedState | Calculated but not returned to state | LOW - Data in tool call args |
| retry_recommended | UnifiedState | Calculated but not exposed | LOW - In performance_analysis |
| course_recommendation | UnifiedState | Course Manager only, never set | HIGH - Dead code |
| recommendation_summary | UnifiedState | Course Manager only, never set | HIGH - Dead code |
| validation_results | UnifiedState | Course Manager only, never set | HIGH - Dead code |
| error | UnifiedState | Course Manager only, never set | HIGH - Dead code |
| lesson_template_id | Both | Extracted but never used in teaching | LOW - Metadata only |
| hint_level | Both | Initialized but never incremented | MEDIUM - Feature incomplete |
| pending_tool_call_id | InterruptState | Set in design_node but never read | LOW - Informational only |
| card_presentation_complete | InterruptState | Set but never read | LOW - Boolean tracking unused |
| skip_reason | InterruptState | Set in design_node but never used | LOW - Informational only |
| explanation | InterruptState | Set in mark_node, used in retry_node, then cleared | MEDIUM - Temporary transit field |
| fallback_to_messages | InterruptState | Referenced in interrupt_tools but never actually used in nodes | MEDIUM - Feature flag |
| user_interaction_response | InterruptState | Set in interrupt_tools but never read | LOW - Duplicate of interrupt_response |
| last_interrupt_type | InterruptState | Set in interrupt_tools but never read | LOW - Telemetry only |

### 3.2 Course Manager Fields (Incomplete Implementation)

The following fields are defined but Course Manager graph is incomplete:
- `course_recommendation`
- `recommendation_summary`
- `validation_results`
- `error`

Current status: `course_manager_graph` exists but these fields are never populated by it.

### 3.3 State Fields with Inconsistent Usage

| Field | Issue |
|-------|-------|
| `stage` | Renamed to `current_stage` in simple_teaching_state.py but still `stage` in main graphs |
| `interrupt_count` | Only incremented in interrupt_tools.py functions, never in actual node code |
| `cards_presented_via_ui` | Initialized but not appended to in actual code |
| `feedback_interactions_count` | Initialized but not actually incremented |

---

## 4. CRITICAL PATH - Fields Actually Required for Core Function

### Minimum viable InterruptUnifiedState for teaching flow:

```python
# CORE (must-have)
messages: Annotated[list[BaseMessage], add_messages]
session_context: Optional[Dict[str, Any]]
mode: str
session_id: str
student_id: str
lesson_snapshot: Dict[str, Any]
student_response: Optional[str]
current_card_index: int
current_card: Optional[Dict[str, Any]]
cards_completed: List[str]
stage: str
should_exit: bool
evidence: List[Dict[str, Any]]
mastery_updates: List[Dict[str, Any]]
is_correct: Optional[bool]
should_progress: Optional[bool]
attempts: int
max_attempts: int

# CURRICULUM (for LLM prompts - actually used)
course_subject_display: Optional[str]
course_level_display: Optional[str]
lesson_type_display: Optional[str]
engagement_tags: Optional[List[str]]
lesson_policy: Optional[Dict[str, Any]]
enriched_outcomes: Optional[List[Dict[str, Any]]]
use_plain_text: Optional[bool]

# INTERRUPT CORE (for interrupt system)
interrupt_response: Optional[Dict[str, Any]]
tool_response_received: bool

# OPTIONAL (telemetry/tracking)
interrupt_count: int
feedback_interactions_count: int
cards_presented_via_ui: List[str]
```

That's **33 fields** of the **37 total** actually needed.

**Unused (4 fields):**
- `course_id` - Extracted but never used
- `lesson_template_id` - Extracted but never used
- `sqa_course_code` - Set but never used in prompts
- `course_title` - Set but never used

**Dead Code (4 fields):**
- `course_recommendation`
- `recommendation_summary`
- `validation_results`
- `error`

---

## 5. RECOMMENDATIONS

### 5.1 Clean up unused fields

**Remove from InterruptUnifiedState:**
- `course_id` - Not used after entry node
- `lesson_template_id` - Not used after entry node
- `sqa_course_code` - Metadata not used in prompts
- `course_title` - Metadata not used in prompts

**Remove from UnifiedState (Course Manager incomplete):**
- `course_recommendation`
- `recommendation_summary`
- `validation_results`
- `error`

### 5.2 Fix inconsistent fields

- Rename `stage` → `current_stage` everywhere OR standardize to `stage`
- Move `explanation` field usage - it's currently a temporary transit field (set in mark_node, used in retry_node, cleared)
- Actually increment `interrupt_count`, `feedback_interactions_count`, `cards_presented_via_ui` in node code (or remove these metric fields)

### 5.3 Complete Course Manager implementation

Either complete the Course Manager graph with proper state population, or remove the unused fields entirely.

### 5.4 Document state field lifecycle

Create clear documentation of:
- Which fields are initialized in entry_node
- Which fields are mutated in each node
- Which fields are read-only reference data
- Which fields are for telemetry only

---

## 6. FIELD USAGE HEATMAP

**Actively Used (in core teaching loop):**
- messages, session_context, mode, session_id, student_id, lesson_snapshot, student_response
- current_card_index, current_card, cards_completed, stage, should_exit
- evidence, mastery_updates, is_correct, should_progress, attempts, max_attempts
- feedback, hint_level
- ALL curriculum metadata display fields (used in every LLM call)
- interrupt_response, tool_response_received

**Sometimes Used (non-core features):**
- feedback_interactions_count, interrupt_count
- enriched_outcomes (only if populated)
- lesson_policy (only if calculator/formula policies set)

**Unused (but harmless):**
- course_id, lesson_template_id
- sqa_course_code, course_title
- card_presentation_complete, cards_presented_via_ui
- pending_tool_call_id, skip_reason
- explanation (temporary transit - could be moved to local variable)

**Unused (dead code):**
- course_recommendation, recommendation_summary, validation_results, error

---

## Relevant Code Locations

| Component | File Path |
|-----------|-----------|
| UnifiedState definition | `/home/user/ScottishAILessons/langgraph-agent/src/agent/shared_state.py` |
| InterruptUnifiedState definition | `/home/user/ScottishAILessons/langgraph-agent/src/agent/interrupt_state.py` |
| Main graph entry/router | `/home/user/ScottishAILessons/langgraph-agent/src/agent/graph_interrupt.py` |
| Teaching graph nodes | `/home/user/ScottishAILessons/langgraph-agent/src/agent/teaching_graph.py` |
| Teaching with interrupts | `/home/user/ScottishAILessons/langgraph-agent/src/agent/teacher_graph_toolcall_interrupt.py` |
| LLM prompt generation | `/home/user/ScottishAILessons/langgraph-agent/src/agent/llm_teacher.py` |
| Teaching utilities | `/home/user/ScottishAILessons/langgraph-agent/src/agent/teaching_utils.py` |
| Interrupt helpers | `/home/user/ScottishAILessons/langgraph-agent/src/agent/interrupt_tools.py` |

