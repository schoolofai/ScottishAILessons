# Teaching Graph Refactoring Plan: Course-Agnostic & Data Model Alignment

## Executive Summary

The current teaching graph implementation has **hardcoded National 3 Mathematics assumptions** throughout LLM prompts, while the evolved data model now supports **any SQA course** across subjects and levels. This refactoring will make the system course-agnostic by:

1. **Extracting rich curriculum metadata** from the enhanced lesson template schema
2. **Leveraging SQA-aligned course data** (subject, level, outcomes, assessment standards)
3. **Dynamically adapting prompts** based on course context
4. **Enriching state** with curriculum metadata for better teaching decisions

## Key Problems Identified

### 1. **Hardcoded Subject/Level Assumptions** (llm_teacher.py)
- Lines 55-58, 63-72, 81-90, 94-95: All prompts say "National 3 math tutor"
- Lines 212-274: Greeting prompts assume "National 3 students"
- Lines 277-302: Card presentation hardcoded to "National 3 student"

### 2. **Missing Curriculum Metadata in State** (interrupt_state.py)
- No `course_subject`, `course_level`, `sqa_course_code` fields
- No `lesson_type`, `engagement_tags`, `policy` from lesson template
- No enriched `outcomeRefs` with SQA assessment standards/teacher guidance

### 3. **Impoverished Context for Context Chat Agent** (langgraph-generic-chat)
- Static context lacks course subject/level information
- No lesson metadata (type, engagement tags, policies)
- Missing SQA curriculum alignment data

### 4. **Lost Data Model Richness**
- Lesson templates now have: `lesson_type`, `engagement_tags`, `policy`, `sow_order`
- Course outcomes have: `assessmentStandards`, `teacherGuidance`, `keywords`
- Course schema has: `subject`, `level` (with SQA mapping)
- **None of this is flowing to the teaching graph**

---

## Refactoring Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (SessionChatAssistant)                   │
│  • Fetches session with lesson snapshot                              │
│  • Enriches with course metadata (NEW: subject, level)               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MAIN GRAPH (graph_interrupt.py:entry_node)              │
│  • Receives session_context with enriched metadata                   │
│  • Extracts lesson_snapshot fields (NEW: lesson_type, tags, policy) │
│  • Queries CourseDriver for course details (NEW)                     │
│  • Queries CourseOutcomesDriver for enriched outcomes (NEW)          │
│  • Populates InterruptUnifiedState with curriculum metadata          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────────┐  ┌───────────────────────────────────────┐
│  TEACHING SUBGRAPH       │  │   CONTEXT CHAT AGENT                  │
│  (teacher_graph_...)     │  │   (langgraph-generic-chat)            │
│                          │  │                                       │
│  • design_node receives  │  │  • extract_context receives           │
│    enriched state        │  │    static_context with course data    │
│  • LLMTeacher uses       │  │  • Builds TeachingContext with        │
│    format_course_context │  │    subject, level, lesson_type        │
│  • Prompts adapt to      │  │  • Prompts adapt to course context    │
│    subject/level         │  │  • AI tutor knows specific subject    │
└──────────────────────────┘  └───────────────────────────────────────┘
```

---

## Refactoring Scope

### Phase 1: State Schema Enhancement

**File**: `langgraph-agent/src/agent/interrupt_state.py`

**Changes**: Add curriculum metadata fields to `InterruptUnifiedState`:

```python
class InterruptUnifiedState(UnifiedState, total=False):
    """Extended state schema with interrupt and curriculum metadata fields."""

    # EXISTING FIELDS (unchanged)
    interrupt_response: Optional[Dict[str, Any]]
    card_presentation_complete: bool
    tool_response_received: bool
    interrupt_count: int
    cards_presented_via_ui: List[str]
    feedback_interactions_count: int

    # NEW: Course metadata (from courses collection via courseId lookup)
    course_subject: Optional[str]        # "mathematics", "application-of-mathematics", "physics"
    course_level: Optional[str]          # "national-3", "national-4", "national-5"
    sqa_course_code: Optional[str]       # "C844 73" (if available)
    course_title: Optional[str]          # Full course title from SQA data

    # NEW: Lesson template metadata (from lesson_templates/lesson_snapshot)
    lesson_type: Optional[str]           # "teach", "independent_practice", "assessment"
    engagement_tags: Optional[List[str]] # ["real_world_context", "scaffolding", "visual_aids"]
    lesson_policy: Optional[Dict]        # {"calculator_allowed": true}
    sow_order: Optional[int]             # Position in Authored SOW sequence (1-based)

    # NEW: Enriched outcome data (from course_outcomes via outcomeRefs)
    enriched_outcomes: Optional[List[Dict]]  # Full outcome objects with:
        # {
        #   "outcomeRef": "MTH 3-01a",
        #   "outcomeTitle": "Estimate and round whole numbers...",
        #   "assessmentStandards": [
        #     {"code": "1.1", "description": "Round numbers to..."},
        #     {"code": "1.2", "description": "Estimate calculations..."}
        #   ],
        #   "teacherGuidance": "Students should be able to...",
        #   "keywords": ["estimation", "rounding", "place value"]
        # }

    # NEW: Display-friendly formatted strings for prompts
    course_subject_display: Optional[str]  # "Mathematics" (Title Case)
    course_level_display: Optional[str]    # "National 3" (Title Case)
    lesson_type_display: Optional[str]     # "Teaching Lesson" (Title Case)
```

**Rationale**:
- Separates raw data fields (kebab-case from DB) from display fields (Title Case for prompts)
- Keeps enriched outcomes as full objects for flexible prompt construction
- `lesson_policy` dict allows checking specific policies in prompts/logic

---

### Phase 2: Entry Node Enhancement

**File**: `langgraph-agent/src/agent/graph_interrupt.py`

**Location**: Lines 27-144 (entry_node_interrupt function)

**Changes**: Extract and populate curriculum metadata for teaching mode

```python
async def entry_node_interrupt(state: InterruptUnifiedState) -> InterruptUnifiedState:
    """Entry point that processes input and sets up initial state with interrupt support.

    NEW: Extracts curriculum metadata from lesson snapshot and enriches with course data.
    """
    logger.info("=== ENTRY NODE INTERRUPT START ===")
    logger.info(f"Entry node received state keys: {list(state.keys())}")

    session_context = state.get("session_context")
    logger.info(f"Session context: {session_context}")

    # Check for explicit mode in session_context
    explicit_mode = session_context.get("mode") if session_context else None
    logger.info(f"Explicit mode from session_context: {explicit_mode}")

    # Initialize interrupt-related fields - NO FALLBACK
    interrupt_init = {
        "interrupt_count": state.get("interrupt_count", 0),
        "card_presentation_complete": False,
        "tool_response_received": False,
        "cards_presented_via_ui": state.get("cards_presented_via_ui", []),
        "feedback_interactions_count": state.get("feedback_interactions_count", 0)
    }

    # Initialize teaching progression fields
    teaching_init = {
        "current_stage": "design",
        "current_card_index": 0,
        "attempts": 0,
        "max_attempts": 3,
        "evidence": [],
        "cards_completed": [],
        "hint_level": 0,
        "is_correct": None,
        "should_progress": None,
        "feedback": None,
        "mastery_updates": [],
        "should_exit": False
    }

    # Determine mode based on session context
    if explicit_mode == "course_manager":
        # ... existing course_manager logic unchanged ...
        pass

    elif session_context and isinstance(session_context, dict) and session_context.get("session_id"):
        logger.info("🎓 TEACHING MODE DETECTED (has session_id)")
        mode = "teaching"

        # Extract session context fields
        lesson_snapshot = session_context.get("lesson_snapshot", {})
        if isinstance(lesson_snapshot, str):
            lesson_snapshot = json.loads(lesson_snapshot)

        # Get the last message (student response) if available
        messages = state.get("messages", [])
        student_input = None
        if messages and len(messages) > 0:
            last_message = messages[-1]
            if isinstance(last_message, HumanMessage):
                student_input = last_message.content if hasattr(last_message, 'content') else str(last_message)

        # Extract course_id from lesson_snapshot
        course_id = lesson_snapshot.get("courseId", "") if lesson_snapshot else ""

        # ═══════════════════════════════════════════════════════════════
        # NEW: Extract curriculum metadata from lesson snapshot
        # ═══════════════════════════════════════════════════════════════

        # Extract lesson template metadata (already in lesson_snapshot)
        lesson_type = lesson_snapshot.get("lesson_type", "teach")

        engagement_tags_str = lesson_snapshot.get("engagement_tags", "[]")
        try:
            engagement_tags = json.loads(engagement_tags_str) if isinstance(engagement_tags_str, str) else engagement_tags_str
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse engagement_tags: {engagement_tags_str}")
            engagement_tags = []

        policy_str = lesson_snapshot.get("policy", "{}")
        try:
            lesson_policy = json.loads(policy_str) if isinstance(policy_str, str) else policy_str
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse policy: {policy_str}")
            lesson_policy = {}

        sow_order = lesson_snapshot.get("sow_order", 0)

        # NEW: Fetch course metadata from courses collection
        # NOTE: Requires adding CourseDriver import and database access
        course_subject = None
        course_level = None
        sqa_course_code = None
        course_title = None

        if course_id:
            try:
                # TODO: Add CourseDriver integration
                # from .drivers import CourseDriver  # Need to create or import
                # course_driver = CourseDriver()
                # course_data = await course_driver.get_course(course_id)

                # For now, extract from session_context if frontend provides it
                course_subject = session_context.get("course_subject")
                course_level = session_context.get("course_level")
                sqa_course_code = session_context.get("sqa_course_code")
                course_title = session_context.get("course_title")

                logger.info(f"Course metadata: subject={course_subject}, level={course_level}")
            except Exception as e:
                logger.error(f"Failed to fetch course metadata: {e}")

        # NEW: Enrich outcomeRefs with full outcome data from course_outcomes
        enriched_outcomes = []
        outcome_refs_str = lesson_snapshot.get("outcomeRefs", "[]")

        try:
            outcome_refs = json.loads(outcome_refs_str) if isinstance(outcome_refs_str, str) else outcome_refs_str

            if outcome_refs and course_id:
                # TODO: Add CourseOutcomesDriver integration
                # from .drivers import CourseOutcomesDriver
                # outcomes_driver = CourseOutcomesDriver()
                # enriched_outcomes = await outcomes_driver.get_outcomes_by_refs(course_id, outcome_refs)

                # For now, use basic outcome data if available
                # Frontend could pre-fetch and include in session_context
                enriched_outcomes = session_context.get("enriched_outcomes", [])

                logger.info(f"Enriched outcomes: {len(enriched_outcomes)} outcomes loaded")
        except Exception as e:
            logger.error(f"Failed to enrich outcomes: {e}")

        # NEW: Generate display-friendly strings for prompts
        course_subject_display = None
        course_level_display = None
        lesson_type_display = None

        if course_subject:
            # Convert "application-of-mathematics" -> "Application Of Mathematics"
            course_subject_display = course_subject.replace("-", " ").replace("_", " ").title()

        if course_level:
            # Convert "national-3" -> "National 3"
            course_level_display = course_level.replace("-", " ").title()

        if lesson_type:
            # Convert "independent_practice" -> "Independent Practice"
            lesson_type_display = lesson_type.replace("_", " ").title()

        logger.info(f"Display strings: {course_subject_display} ({course_level_display}), {lesson_type_display}")

        # ═══════════════════════════════════════════════════════════════
        # END NEW SECTION
        # ═══════════════════════════════════════════════════════════════

        return {
            "session_context": session_context,  # Keep for frontend compatibility
            "mode": mode,

            # EXISTING: Extract fields for teaching subgraph
            "session_id": session_context.get("session_id", ""),
            "student_id": session_context.get("student_id", ""),
            "course_id": course_id,
            "lesson_template_id": lesson_snapshot.get("lessonTemplateId", "") if lesson_snapshot else "",
            "lesson_snapshot": lesson_snapshot,
            "student_response": student_input,

            # EXISTING: Interrupt fields
            **interrupt_init,

            # EXISTING: Teaching progression fields
            **teaching_init,

            # NEW: Curriculum metadata fields
            "course_subject": course_subject,
            "course_level": course_level,
            "sqa_course_code": sqa_course_code,
            "course_title": course_title,
            "lesson_type": lesson_type,
            "engagement_tags": engagement_tags,
            "lesson_policy": lesson_policy,
            "sow_order": sow_order,
            "enriched_outcomes": enriched_outcomes,
            "course_subject_display": course_subject_display,
            "course_level_display": course_level_display,
            "lesson_type_display": lesson_type_display
        }
    else:
        # ... existing chat mode logic unchanged ...
        pass
```

**Rationale**:
- Extracts lesson metadata that already exists in lesson_snapshot
- Fetches course data (requires CourseDriver integration)
- Enriches outcomes (requires CourseOutcomesDriver integration)
- Generates display strings once for efficient prompt formatting
- Maintains backward compatibility with existing state fields

---

### Phase 3: LLM Prompt Templatization

**File**: `langgraph-agent/src/agent/llm_teacher.py`

**Changes**: Replace all hardcoded "National 3" and "math" references with dynamic curriculum context

#### 3.1 Add Prompt Formatting Utilities

Insert after `parse_outcome_refs` function (around line 31):

```python
def format_course_context_for_prompt(
    course_subject_display: Optional[str],
    course_level_display: Optional[str],
    lesson_type_display: Optional[str],
    engagement_tags: Optional[List[str]],
    lesson_policy: Optional[Dict],
    enriched_outcomes: Optional[List[Dict]]
) -> Dict[str, str]:
    """Generate human-readable course context strings for LLM prompts.

    Args:
        course_subject_display: Title-cased subject name
        course_level_display: Title-cased level name
        lesson_type_display: Title-cased lesson type
        engagement_tags: List of engagement strategy tags
        lesson_policy: Lesson policy dictionary
        enriched_outcomes: List of full outcome objects with SQA data

    Returns:
        Dictionary with formatted prompt strings:
        - tutor_role_description: "friendly, encouraging Physics tutor for Scottish National 4 students"
        - course_context_block: Multi-line course context for system prompts
        - engagement_guidance: Teaching strategies based on tags
        - policy_reminders: Lesson policy statements
        - sqa_alignment_summary: Brief SQA outcome alignment info
    """
    # Build tutor role description
    subject_str = course_subject_display or "learning"
    level_str = course_level_display or "students"
    tutor_role = f"friendly, encouraging {subject_str} tutor for Scottish {level_str} students"

    # Build course context block
    course_context_lines = []
    if course_subject_display and course_level_display:
        course_context_lines.append(f"Subject: {course_subject_display}")
        course_context_lines.append(f"Level: {course_level_display}")
    if lesson_type_display:
        course_context_lines.append(f"Lesson Type: {lesson_type_display}")

    course_context_block = "\n".join(course_context_lines) if course_context_lines else ""

    # Build engagement guidance from tags
    engagement_strategies = {
        "real_world_context": "Use everyday contexts (shopping, money, sports, real-world scenarios)",
        "scaffolding": "Break down complex concepts into smaller, manageable steps",
        "visual_aids": "Use diagrams, charts, and visual representations when explaining",
        "worked_examples": "Provide step-by-step worked examples before asking questions",
        "collaborative": "Encourage discussion and collaborative problem-solving",
        "technology": "Suggest using technology tools (calculators, apps) where appropriate"
    }

    guidance_lines = []
    if engagement_tags:
        guidance_lines.append("Teaching Strategies for This Lesson:")
        for tag in engagement_tags:
            if tag in engagement_strategies:
                guidance_lines.append(f"- {engagement_strategies[tag]}")

    engagement_guidance = "\n".join(guidance_lines) if guidance_lines else ""

    # Build policy reminders
    policy_lines = []
    if lesson_policy:
        if lesson_policy.get("calculator_allowed"):
            policy_lines.append("- Calculator use is permitted for this lesson")
        if lesson_policy.get("formula_sheet_allowed"):
            policy_lines.append("- Students may refer to formula sheets")
        # Add more policy checks as needed

    policy_reminders = "\n".join(policy_lines) if policy_lines else ""

    # Build SQA alignment summary
    sqa_lines = []
    if enriched_outcomes:
        sqa_lines.append("SQA Learning Outcomes Covered:")
        for outcome in enriched_outcomes[:3]:  # Limit to first 3 for brevity
            outcome_ref = outcome.get("outcomeRef", "")
            outcome_title = outcome.get("outcomeTitle", "")
            assessment_standards = outcome.get("assessmentStandards", [])

            if outcome_ref and outcome_title:
                sqa_lines.append(f"- {outcome_ref}: {outcome_title[:60]}...")
                if assessment_standards:
                    sqa_lines.append(f"  ({len(assessment_standards)} assessment standards)")

    sqa_alignment_summary = "\n".join(sqa_lines) if sqa_lines else ""

    return {
        "tutor_role_description": tutor_role,
        "course_context_block": course_context_block,
        "engagement_guidance": engagement_guidance,
        "policy_reminders": policy_reminders,
        "sqa_alignment_summary": sqa_alignment_summary
    }


def extract_curriculum_context_from_state(state: Dict) -> Dict[str, str]:
    """Extract curriculum metadata from state and format for prompts.

    This is a convenience wrapper that pulls curriculum fields from state
    and formats them using format_course_context_for_prompt.

    Args:
        state: InterruptUnifiedState or similar state dict

    Returns:
        Formatted prompt strings dictionary
    """
    return format_course_context_for_prompt(
        course_subject_display=state.get("course_subject_display"),
        course_level_display=state.get("course_level_display"),
        lesson_type_display=state.get("lesson_type_display"),
        engagement_tags=state.get("engagement_tags", []),
        lesson_policy=state.get("lesson_policy", {}),
        enriched_outcomes=state.get("enriched_outcomes", [])
    )
```

#### 3.2 Update Prompt Templates

**Example 1: lesson_greeting_prompt (lines 54-60)**

**BEFORE:**
```python
self.lesson_greeting_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a friendly, encouraging math tutor for Scottish National 3 students.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.
Be warm, supportive, and use everyday contexts. Keep it conversational and engaging.
Student name: {student_name}"""),
    ("human", "Start the lesson")
])
```

**AFTER:**
```python
self.lesson_greeting_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a {tutor_role_description}.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.

{course_context_block}

{sqa_alignment_summary}

{engagement_guidance}

{policy_reminders}

Be warm, supportive, and keep it conversational and engaging.
Student name: {student_name}"""),
    ("human", "Start the lesson")
])
```

**Example 2: card_presentation_prompt (lines 62-78)**

**BEFORE:**
```python
self.card_presentation_prompt = ChatPromptTemplate.from_messages([
    ("system", """Present this math concept conversationally to a National 3 student.
Context: {card_context}
...
Make it feel like friendly tutoring. Use real-world contexts (shopping, money, etc).
..."""),
    ("human", "Present this card: {card_title}")
])
```

**AFTER:**
```python
self.card_presentation_prompt = ChatPromptTemplate.from_messages([
    ("system", """Present this {subject_area} concept conversationally to a {level_description} student.

{course_context_block}

Context: {card_context}
Explainer: {explainer}
Examples: {examples}
Question: {question}

{engagement_guidance}

{policy_reminders}

Make it feel like friendly tutoring.
End with the question naturally in the conversation. Make sure to include the question for the student to answer.

{latex_formatting_instructions}"""),
    ("human", "Present this card: {card_title}")
])
```

**Repeat for all prompts**:
- `feedback_prompt` (lines 80-90)
- `structured_evaluation_prompt` (lines 93-128)
- `transition_prompt` (lines 131-139)
- `completion_prompt` (lines 141-149)
- `correct_answer_explanation_prompt` (lines 151-175)
- `lesson_summary_prompt` (lines 177-209)
- `greeting_with_first_card_prompt` (lines 211-236)
- `greeting_with_first_mcq_card_prompt` (lines 238-274)
- `mcq_card_presentation_prompt` (lines 276-302)

#### 3.3 Update Method Signatures to Accept State

Update all sync methods to accept full state dict and extract curriculum context:

**Example: greet_with_first_card_sync_full (lines 741-768)**

**BEFORE:**
```python
def greet_with_first_card_sync_full(self, lesson_snapshot: Dict, first_card: Dict[str, Any]):
    """Generate cohesive greeting with first card (sync version)."""
    try:
        examples = "\n".join(first_card.get("example", []))
        response = self.llm.invoke(
            self.greeting_with_first_card_prompt.format_messages(
                lesson_title=lesson_snapshot.get("title", "Math Lesson"),
                outcome_refs=", ".join(parse_outcome_refs(lesson_snapshot.get("outcomeRefs", []))),
                card_title=first_card.get("title", ""),
                card_explainer=first_card.get("explainer", ""),
                card_examples=examples,
                card_question=first_card.get("cfu", {}).get("stem", "")
            )
        )
        return response
    except Exception as e:
        # ... error handling ...
```

**AFTER:**
```python
def greet_with_first_card_sync_full(self, lesson_snapshot: Dict, first_card: Dict[str, Any], state: Optional[Dict] = None):
    """Generate cohesive greeting with first card (sync version).

    Args:
        lesson_snapshot: Lesson snapshot data
        first_card: First card data
        state: Optional full state dict with curriculum metadata
    """
    try:
        examples = "\n".join(first_card.get("example", []))

        # Extract curriculum context if state provided
        curriculum_context = {}
        if state:
            curriculum_context = extract_curriculum_context_from_state(state)
        else:
            # Fallback to default values
            curriculum_context = {
                "tutor_role_description": "friendly, encouraging tutor",
                "course_context_block": "",
                "engagement_guidance": "",
                "policy_reminders": "",
                "sqa_alignment_summary": ""
            }

        response = self.llm.invoke(
            self.greeting_with_first_card_prompt.format_messages(
                lesson_title=lesson_snapshot.get("title", "Lesson"),
                outcome_refs=", ".join(parse_outcome_refs(lesson_snapshot.get("outcomeRefs", []))),
                card_title=first_card.get("title", ""),
                card_explainer=first_card.get("explainer", ""),
                card_examples=examples,
                card_question=first_card.get("cfu", {}).get("stem", ""),
                **curriculum_context  # Unpack all formatted strings
            )
        )
        return response
    except Exception as e:
        # ... error handling ...
```

**Apply similar changes to**:
- `present_card_sync_full`
- `present_mcq_card_sync_full`
- `greet_with_first_mcq_card_sync_full`
- `transition_to_next_sync_full`
- `summarize_completed_lesson_sync_full`
- `explain_correct_answer_sync_full`
- `evaluate_response_with_structured_output`

---

### Phase 4: Teaching Graph Node Updates

**File**: `langgraph-agent/src/agent/teacher_graph_toolcall_interrupt.py`

**Changes**: Pass full state to LLMTeacher methods

#### 4.1 Update design_node (line 81)

**Location**: Lines 226-232 where `_generate_card_message` is called

**BEFORE:**
```python
message_obj = _generate_card_message(
    teacher, state[" snapshot"], current_card, current_index, cfu_type
)
```

**AFTER:**
```python
message_obj = _generate_card_message(
    teacher, state["lesson_snapshot"], current_card, current_index, cfu_type, state  # Pass full state
)
```

#### 4.2 Update _generate_card_message helper

**Location**: Lines 63-76

**BEFORE:**
```python
def _generate_card_message(teacher, lesson_snapshot: dict, current_card: dict, current_index: int, cfu_type: str):
    """Generate appropriate message based on card position and type."""
    if current_index == 0:
        # First card with greeting
        if cfu_type == "mcq":
            return teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card)
        else:
            return teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card)
    else:
        # Subsequent cards
        if cfu_type == "mcq":
            return teacher.present_mcq_card_sync_full(current_card)
        else:
            return teacher.present_card_sync_full(current_card)
```

**AFTER:**
```python
def _generate_card_message(teacher, lesson_snapshot: dict, current_card: dict, current_index: int, cfu_type: str, state: dict):
    """Generate appropriate message based on card position and type.

    Args:
        teacher: LLMTeacher instance
        lesson_snapshot: Lesson snapshot data
        current_card: Current card data
        current_index: Card index
        cfu_type: CFU type (mcq, numeric, etc.)
        state: Full InterruptUnifiedState with curriculum metadata
    """
    if current_index == 0:
        # First card with greeting - pass state for curriculum context
        if cfu_type == "mcq":
            return teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card, state)
        else:
            return teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card, state)
    else:
        # Subsequent cards - pass state for curriculum context
        if cfu_type == "mcq":
            return teacher.present_mcq_card_sync_full(current_card, state)
        else:
            return teacher.present_card_sync_full(current_card, state)
```

#### 4.3 Update progress_node

**Location**: Lines 599-607 where transition message is generated

**BEFORE:**
```python
transition_obj = teacher.transition_to_next_sync_full(
    completed_card=current_card,
    next_card=next_card,
    progress_context={
        "cards_completed": len(cards_completed),
        "total_cards": len(cards),
        "current_performance": state.get("is_correct", False)
    }
)
```

**AFTER:**
```python
transition_obj = teacher.transition_to_next_sync_full(
    completed_card=current_card,
    next_card=next_card,
    progress_context={
        "cards_completed": len(cards_completed),
        "total_cards": len(cards),
        "current_performance": state.get("is_correct", False)
    },
    state=state  # Pass full state for curriculum context
)
```

#### 4.4 Update design_node lesson completion

**Location**: Lines 153-157 where lesson summary is generated

**BEFORE:**
```python
summary_message = teacher.summarize_completed_lesson_sync_full(
    lesson_snapshot=lesson_snapshot,
    evidence=evidence,
    performance_analysis=performance_analysis
)
```

**AFTER:**
```python
summary_message = teacher.summarize_completed_lesson_sync_full(
    lesson_snapshot=lesson_snapshot,
    evidence=evidence,
    performance_analysis=performance_analysis,
    state=state  # Pass full state for curriculum context
)
```

---

### Phase 5: Context Chat Agent Enhancement

**File**: `langgraph-generic-chat/src/react_agent/state.py`

**Changes**: Add curriculum fields to TeachingContext

```python
class TeachingContext(TypedDict, total=False):
    """Static teaching session context from lesson snapshot."""

    # EXISTING FIELDS
    session_id: str
    student_id: str
    lesson_title: str
    lesson_topic: str
    current_stage: str
    lesson_snapshot: Dict[str, Any]
    student_progress: List[Dict[str, Any]]
    recent_exchanges: List[Dict[str, str]]
    cards_metadata: List[Dict[str, Any]]

    # NEW: Course metadata
    course_subject: Optional[str]        # "mathematics", "physics"
    course_level: Optional[str]          # "national-3", "national-4"
    course_subject_display: Optional[str]  # "Mathematics"
    course_level_display: Optional[str]    # "National 3"

    # NEW: Lesson metadata
    lesson_type: Optional[str]           # "teach", "independent_practice"
    lesson_type_display: Optional[str]   # "Teaching Lesson"
    engagement_tags: Optional[List[str]]
    lesson_policy: Optional[Dict]
```

**File**: `langgraph-generic-chat/src/react_agent/utils.py`

**Changes**: Extract curriculum metadata in `extract_static_context`

**Location**: Around line 50 (extract_static_context function)

**BEFORE:**
```python
def extract_static_context(static_context_data: Dict) -> TeachingContext:
    """Extract static session context from session_context."""
    lesson_snapshot = static_context_data.get("lesson_snapshot", {})

    return TeachingContext(
        session_id=static_context_data.get("session_id", ""),
        student_id=static_context_data.get("student_id", ""),
        lesson_title=lesson_snapshot.get("title", "Lesson"),
        lesson_topic=lesson_snapshot.get("topic", "Learning"),
        # ... existing fields ...
    )
```

**AFTER:**
```python
def extract_static_context(static_context_data: Dict) -> TeachingContext:
    """Extract static session context from session_context with curriculum metadata."""
    lesson_snapshot = static_context_data.get("lesson_snapshot", {})

    # Extract course metadata (passed from frontend via static_context)
    course_subject = static_context_data.get("course_subject")
    course_level = static_context_data.get("course_level")

    # Generate display strings
    course_subject_display = course_subject.replace("-", " ").title() if course_subject else None
    course_level_display = course_level.replace("-", " ").title() if course_level else None

    # Extract lesson metadata
    lesson_type = lesson_snapshot.get("lesson_type", "teach")
    lesson_type_display = lesson_type.replace("_", " ").title()

    engagement_tags_str = lesson_snapshot.get("engagement_tags", "[]")
    engagement_tags = json.loads(engagement_tags_str) if isinstance(engagement_tags_str, str) else engagement_tags_str

    policy_str = lesson_snapshot.get("policy", "{}")
    lesson_policy = json.loads(policy_str) if isinstance(policy_str, str) else policy_str

    return TeachingContext(
        session_id=static_context_data.get("session_id", ""),
        student_id=static_context_data.get("student_id", ""),
        lesson_title=lesson_snapshot.get("title", "Lesson"),
        lesson_topic=lesson_snapshot.get("topic", "Learning"),
        # ... existing fields ...

        # NEW curriculum metadata
        course_subject=course_subject,
        course_level=course_level,
        course_subject_display=course_subject_display,
        course_level_display=course_level_display,
        lesson_type=lesson_type,
        lesson_type_display=lesson_type_display,
        engagement_tags=engagement_tags,
        lesson_policy=lesson_policy
    )
```

**File**: `langgraph-generic-chat/src/react_agent/prompts.py`

**Changes**: Update prompts to use curriculum context

**BEFORE (SYSTEM_PROMPT_DUAL_SOURCE_FULL):**
```python
SYSTEM_PROMPT_DUAL_SOURCE_FULL = """You are a context-aware learning assistant supporting a student during their learning session.

Current Teaching Session Context:
==================================
- Session ID: {session_id}
- Student ID: {student_id}
- Current Lesson: {lesson_title}
- Topic: {lesson_topic}
...
```

**AFTER:**
```python
SYSTEM_PROMPT_DUAL_SOURCE_FULL = """You are a context-aware learning assistant supporting a student in their {course_subject_display} ({course_level_display}) lesson.

Current Teaching Session Context:
==================================
- Subject: {course_subject_display}
- Level: {course_level_display}
- Lesson Type: {lesson_type_display}
- Session ID: {session_id}
- Student ID: {student_id}
- Current Lesson: {lesson_title}
- Topic: {lesson_topic}

{engagement_strategies}

{policy_context}

...
```

**File**: `langgraph-generic-chat/src/react_agent/graph.py`

**Changes**: Format curriculum context in call_model

**Location**: Lines 186-202 (STATIC_ONLY prompt formatting)

**BEFORE:**
```python
# Format static session information
static_session_info = f"""
Session ID: {static_context.session_id}
Student ID: {static_context.student_id}
Lesson Title: {static_context.lesson_title}
Subject Area: {static_context.lesson_topic}
...
```

**AFTER:**
```python
# Format static session information with curriculum context
subject_display = static_context.get("course_subject_display", "learning")
level_display = static_context.get("course_level_display", "students")
lesson_type_display = static_context.get("lesson_type_display", "lesson")

static_session_info = f"""
Subject: {subject_display}
Level: {level_display}
Lesson Type: {lesson_type_display}
Session ID: {static_context.session_id}
Student ID: {static_context.student_id}
Lesson Title: {static_context.lesson_title}
...
```

---

### Phase 6: Frontend Integration

**File**: `assistant-ui-frontend/components/SessionChatAssistant.tsx`

**Changes**: Enrich session context with course metadata before passing to agents

**Location**: Lines 30-86 (loadSessionContext function)

**BEFORE:**
```typescript
const context: SessionContext = {
  session_id: session.$id,
  student_id: session.studentId,
  lesson_snapshot: parsedSnapshot,
};
```

**AFTER:**
```typescript
// Fetch course metadata for curriculum context
let courseSubject: string | undefined;
let courseLevel: string | undefined;
let sqaCourseCode: string | undefined;
let courseTitle: string | undefined;

if (session.courseId) {
  try {
    const courseDriver = createDriver(CourseDriver);
    const course = await courseDriver.getCourse(session.courseId);

    if (course) {
      courseSubject = course.subject;
      courseLevel = course.level;
      sqaCourseCode = course.sqaCode;
      courseTitle = course.courseTitle; // From SQA data if available

      console.log('SessionChatAssistant - Course metadata loaded:', {
        subject: courseSubject,
        level: courseLevel,
        code: sqaCourseCode
      });
    }
  } catch (error) {
    console.error('SessionChatAssistant - Failed to load course metadata:', error);
    // Continue without course metadata
  }
}

// Enrich context with curriculum metadata
const context: SessionContext = {
  session_id: session.$id,
  student_id: session.studentId,
  lesson_snapshot: parsedSnapshot,

  // NEW: Add course metadata for teaching graph
  course_subject: courseSubject,
  course_level: courseLevel,
  sqa_course_code: sqaCourseCode,
  course_title: courseTitle,
};

// Also pass to static_context for context chat agent
const staticContextForChat = {
  session_id: context.session_id,
  student_id: context.student_id,
  lesson_snapshot: context.lesson_snapshot,
  course_subject: courseSubject,
  course_level: courseLevel,
  sqa_course_code: sqaCourseCode,
  course_title: courseTitle,
};
```

**File**: `assistant-ui-frontend/lib/appwrite/drivers/CourseDriver.ts`

**Changes**: Add getCourse method if not exists

```typescript
class CourseDriver extends BaseDriver {
  // ... existing methods ...

  async getCourse(courseId: string): Promise<Course | null> {
    try {
      const document = await this.databases.getDocument(
        this.databaseId,
        'courses',
        courseId
      );

      return {
        $id: document.$id,
        courseId: document.courseId,
        subject: document.subject,
        level: document.level,
        sqaCode: document.sqaCode,
        courseTitle: document.courseTitle,
        schema_version: document.schema_version
      };
    } catch (error) {
      console.error('Failed to fetch course:', error);
      return null;
    }
  }
}
```

---

## Testing Checklist

### Test Scenarios

1. **National 3 Mathematics (Existing)**
   - ✅ Verify prompts say "National 3" and "Mathematics"
   - ✅ Check engagement strategies appear if tags present
   - ✅ Verify calculator policy appears if allowed

2. **National 4 Physics (New Course)**
   - ✅ Verify prompts say "National 4" and "Physics"
   - ✅ Check subject-specific language (not math-specific)
   - ✅ Verify SQA outcomes displayed correctly

3. **National 5 Application of Mathematics (New Course)**
   - ✅ Verify prompts say "National 5" and "Application Of Mathematics"
   - ✅ Check lesson type appears (teach vs practice)
   - ✅ Verify different engagement strategies

4. **Context Chat Agent**
   - ✅ Verify AI tutor knows current subject/level
   - ✅ Check responses reference correct course context
   - ✅ Verify lesson type awareness (teaching vs practice)

5. **Backward Compatibility**
   - ✅ Old sessions without course metadata still work
   - ✅ Fallback to generic "tutor" if metadata missing
   - ✅ No crashes on missing fields

### Validation Criteria

- ✅ **No hardcoded "National 3"** in any LLM prompt
- ✅ **No hardcoded "math"** unless from actual course subject
- ✅ **Dynamic course context** in all teacher responses
- ✅ **Engagement tags** influence teaching style
- ✅ **Lesson policies** mentioned when relevant
- ✅ **SQA outcomes** referenced in summaries
- ✅ **Context chat** course-aware

---

## Implementation Priority

### High Priority (Must Have)
1. ✅ Phase 1: State schema enhancement
2. ✅ Phase 2: Entry node curriculum extraction
3. ✅ Phase 3.1-3.2: Core prompt template updates

### Medium Priority (Should Have)
4. ✅ Phase 3.3: Method signature updates
5. ✅ Phase 4: Teaching graph node updates
6. ✅ Phase 6: Frontend course metadata fetching

### Low Priority (Nice to Have)
7. ✅ Phase 5: Context chat agent enhancement
8. ✅ Full SQA outcome enrichment (requires CourseOutcomesDriver)
9. ✅ Advanced engagement strategy guidance

---

## Risk Mitigation

### Breaking Changes Risk: **MEDIUM**
- **Mitigation**: Add optional `state` parameter to all LLMTeacher methods
- **Fallback**: Default curriculum context values if state not provided
- **Testing**: Run existing test suite to ensure backward compatibility

### Database Query Performance Risk: **LOW**
- **Issue**: Additional CourseDriver.getCourse() call in frontend
- **Mitigation**: Cache course metadata in session state
- **Alternative**: Pre-fetch in dashboard, pass through URL params

### Prompt Token Length Risk: **LOW**
- **Issue**: Curriculum context adds ~200-500 tokens per prompt
- **Mitigation**: Limit SQA outcome display to top 3
- **Mitigation**: Make engagement guidance concise

---

## Success Metrics

### Functional Metrics
- ✅ System supports **5+ different courses** (Nat3 Math, Nat4 Math, Nat4 Physics, Nat5 Math, Nat5 App Math)
- ✅ **0 hardcoded subject/level references** in production prompts
- ✅ **100% of curriculum metadata** flows from database to prompts

### Quality Metrics
- ✅ Prompts are **contextually appropriate** for each course
- ✅ Teacher responses use **subject-specific terminology**
- ✅ Context chat agent provides **course-aware assistance**

### Technical Metrics
- ✅ **No regressions** in existing National 3 Math lessons
- ✅ **< 10% increase** in average prompt token count
- ✅ **< 100ms added latency** for course metadata fetching

---

## Next Steps

1. **Review this spec** with team for approval
2. **Create detailed task specs** for each phase (separate .md files)
3. **Implement Phase 1** (state schema) as foundation
4. **Test Phase 1** with existing sessions
5. **Implement Phases 2-3** (entry node + prompts)
6. **Integration test** with multiple courses
7. **Implement Phases 4-6** (graph updates + frontend)
8. **Full system test** across all supported courses

---

## Appendix: Example Prompt Transformations

### Before (Hardcoded National 3 Math)
```
You are a friendly, encouraging math tutor for Scottish National 3 students.
You're starting a lesson on Simplifying Fractions focusing on MTH 3-01a.
Be warm, supportive, and use everyday contexts. Keep it conversational and engaging.
```

### After (Dynamic Curriculum Context)
```
You are a friendly, encouraging Mathematics tutor for Scottish National 3 students.
You're starting a lesson on Simplifying Fractions focusing on MTH 3-01a.

Subject: Mathematics
Level: National 3
Lesson Type: Teaching Lesson

SQA Learning Outcomes Covered:
- MTH 3-01a: Estimate and round whole numbers... (3 assessment standards)

Teaching Strategies for This Lesson:
- Use everyday contexts (shopping, money, sports, real-world scenarios)
- Break down complex concepts into smaller, manageable steps

Lesson Policies:
- Calculator use is permitted for this lesson

Be warm, supportive, and keep it conversational and engaging.
```

### Example for Different Course (National 4 Physics)
```
You are a friendly, encouraging Physics tutor for Scottish National 4 students.
You're starting a lesson on Forces and Motion focusing on SCN 4-07a.

Subject: Physics
Level: National 4
Lesson Type: Independent Practice

SQA Learning Outcomes Covered:
- SCN 4-07a: By investigating the forces on objects... (4 assessment standards)

Teaching Strategies for This Lesson:
- Use diagrams, charts, and visual representations when explaining
- Provide step-by-step worked examples before asking questions

Be warm, supportive, and keep it conversational and engaging.
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-07
**Status**: Draft - Awaiting Review
