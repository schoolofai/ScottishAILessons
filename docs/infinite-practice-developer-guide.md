# Infinite Practice System - Developer Guide

> **Last Updated:** December 2024
> **Status:** Implementation Complete, Appwrite Integration Pending
> **Related Files:** See [File Reference](#file-reference) section

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Backend Components](#backend-components)
5. [Frontend Components](#frontend-components)
6. [State Management](#state-management)
7. [Interrupt Pattern](#interrupt-pattern)
8. [Debugging Guide](#debugging-guide)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Extending the System](#extending-the-system)
11. [File Reference](#file-reference)

---

## Overview

The Infinite Practice System provides adaptive, question-based practice for students. Unlike the standard teaching graph (`graph_interrupt.py`) which follows a structured lesson with cards, infinite practice:

- **Extracts concepts** from lesson templates into "blocks"
- **Generates questions** using LLM at varying difficulty levels
- **Adapts difficulty** based on student performance
- **Allows student control** over difficulty and progression
- **Persists sessions** for resume capability (Appwrite integration pending)

### Key Differences: Teaching vs Practice

| Aspect | Teaching (`graph_interrupt.py`) | Practice (`infinite_practice_graph.py`) |
|--------|--------------------------------|----------------------------------------|
| **Input** | Session with lesson_snapshot | Lesson template directly |
| **Content** | Pre-authored cards with CFUs | LLM-generated questions |
| **Progression** | Linear through cards | Adaptive through blocks |
| **Difficulty** | Fixed per card | Dynamic (easy → medium → hard) |
| **Questions** | Seed questions from cards | Generated on-the-fly |
| **Mastery** | Per-card evidence | Per-block with thresholds |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  /practice/[lessonId]/page.tsx                                          │
│         │                                                               │
│         ▼                                                               │
│  PracticeChatAssistant.tsx                                             │
│    - Loads lesson template                                              │
│    - Builds PracticeContext                                             │
│    - Uses assistantId: "infinite_practice"                              │
│         │                                                               │
│         ▼                                                               │
│  chatApi.ts → sendMessage({ assistantId: "infinite_practice" })        │
│         │                                                               │
├─────────┼───────────────────────────────────────────────────────────────┤
│         │                    HTTP/WebSocket                             │
├─────────┼───────────────────────────────────────────────────────────────┤
│         ▼                                                               │
│                        BACKEND (LangGraph)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  langgraph.json → "infinite_practice" graph                            │
│         │                                                               │
│         ▼                                                               │
│  infinite_practice_graph.py                                            │
│    ├── initialize_node (BlockFactory)                                   │
│    ├── select_block_node                                                │
│    ├── present_concept_node ←── INTERRUPT (Tool Call)                  │
│    ├── generate_question_node (LLM)                                     │
│    ├── present_question_node ←── INTERRUPT (Tool Call)                 │
│    ├── await_response_node ←── INTERRUPT (Wait)                        │
│    ├── mark_response_node (LLM)                                         │
│    ├── present_feedback_node ←── INTERRUPT (Tool Call)                 │
│    ├── update_progress_node                                             │
│    └── route_next_node                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA MODELS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  practice_session.py                                            │
│  ├── PracticeSession (main data model)                          │
│  ├── ConceptBlock (extracted concept unit)                      │
│  └── BlockProgress (per-block tracking)                         │
│                                                                 │
│  infinite_practice_state.py                                     │
│  └── InfinitePracticeState (LangGraph state schema)             │
│                                                                 │
│  block_factory.py                                               │
│  ├── BlockFactory (abstract interface)                          │
│  └── LessonTemplateBlockFactory (LLM-based extraction)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND TOOLS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ConceptPresentationTool.tsx                                    │
│  └── Shows block explanation + worked example                   │
│                                                                 │
│  PracticeQuestionTool.tsx                                       │
│  └── Renders MCQ / numeric / structured questions               │
│                                                                 │
│  PracticeFeedbackTool.tsx                                       │
│  └── Shows marking result + progress update                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Session Initialization

```
User navigates to /practice/{lessonTemplateId}
         │
         ▼
┌─────────────────────────────────────────┐
│  page.tsx: Load studentId from user     │
│  - Query Appwrite students collection   │
│  - Get student.$id                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  PracticeChatAssistant: Load template   │
│  - LessonDriver.getLessonTemplate()     │
│  - Build PracticeContext                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  chatApi.sendMessage()                  │
│  - assistantId: "infinite_practice"     │
│  - sessionContext: PracticeContext      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Backend: initialize_node               │
│  1. Check for existing session          │
│  2. If none: BlockFactory.extract()     │
│  3. Create PracticeSession              │
│  4. Save to Appwrite (pending)          │
└─────────────────────────────────────────┘
```

### 2. Practice Loop

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRACTICE LOOP                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  select_block ──► present_concept ──► generate_question              │
│       ▲               │                      │                       │
│       │               │ INTERRUPT            │                       │
│       │               │ (concept_presentation)                       │
│       │               ▼                      ▼                       │
│       │          [Student reads]     present_question                │
│       │               │                      │                       │
│       │               │                      │ INTERRUPT              │
│       │               │                      │ (practice_question)    │
│       │               ▼                      ▼                       │
│       │          [Continues]          await_response                 │
│       │                                      │                       │
│       │                                      │ INTERRUPT              │
│       │                                      │ (wait for answer)      │
│       │                                      ▼                       │
│       │                              mark_response (LLM)             │
│       │                                      │                       │
│       │                                      ▼                       │
│       │                              present_feedback                │
│       │                                      │                       │
│       │                                      │ INTERRUPT              │
│       │                                      │ (practice_feedback)    │
│       │                                      ▼                       │
│       │                              update_progress                 │
│       │                                      │                       │
│       │                                      ▼                       │
│       │                              route_next                      │
│       │                                      │                       │
│       └──────────────────────────────────────┤                       │
│                                              │                       │
│                     ┌────────────────────────┼────────────────┐      │
│                     │                        │                │      │
│                     ▼                        ▼                ▼      │
│              [more questions]         [next block]      [complete]   │
│                     │                        │                │      │
│                     ▼                        ▼                ▼      │
│              generate_question        select_block     session_done  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3. Interrupt Communication Pattern

```
BACKEND                                    FRONTEND
────────                                   ────────

present_concept_node
    │
    ├── Creates ToolCall {
    │     name: "concept_presentation",
    │     args: { block data, progress... }
    │   }
    │
    ├── Returns AIMessage with tool_calls
    │
    └── Calls interrupt({})  ◄──────────── Tool UI renders with args
                  │                              │
                  │                              │ User clicks "Continue"
                  │                              │
                  │                              ▼
                  │                        sendCommand({
                  │                          resume: JSON.stringify({
                  │                            action: "continue",
                  │                            difficulty_override: "medium"
                  │                          })
                  │                        })
                  │                              │
                  ▼                              │
    interrupt() returns ◄───────────────────────┘
    with parsed payload
```

---

## Backend Components

### 1. practice_session.py - Data Models

```python
# Location: langgraph-agent/src/agent/practice_session.py

class ConceptBlock(TypedDict):
    """A conceptual unit extracted from lesson content."""
    block_id: str           # "block_001"
    block_index: int        # 0-based position
    title: str              # "Finding Fractions of Amounts"
    explanation: str        # 2-3 sentence explanation
    worked_example: Dict    # {problem, solution_steps, final_answer}
    key_skills: List[str]   # ["division", "multiplication"]
    source_refs: List[str]  # ["card_001", "card_002"]

class BlockProgress(TypedDict):
    """Tracks student performance on a block."""
    block_id: str
    current_difficulty: Literal["easy", "medium", "hard"]
    questions_attempted: Dict[str, int]  # {"easy": 3, "medium": 2}
    questions_correct: Dict[str, int]    # {"easy": 2, "medium": 1}
    mastery_score: float                 # 0.0 - 1.0
    is_complete: bool

class PracticeSession(TypedDict):
    """Main session model - persisted to Appwrite."""
    session_id: str
    student_id: str
    source_type: str              # "lesson_template"
    source_id: str                # lessonTemplateId
    blocks: List[ConceptBlock]
    blocks_progress: List[BlockProgress]
    difficulty_mode: Literal["adaptive", "fixed"]
    adaptive_threshold: float     # Default 0.7
    # ... see full definition in file
```

### 2. block_factory.py - Block Extraction

```python
# Location: langgraph-agent/src/agent/block_factory.py

class BlockFactory(ABC):
    """Abstract interface for extracting blocks from various sources."""

    @abstractmethod
    async def extract_blocks(
        self,
        source_data: Dict,
        llm_client: Any
    ) -> List[ConceptBlock]:
        """Extract concept blocks using LLM."""
        pass

class LessonTemplateBlockFactory(BlockFactory):
    """Extracts blocks from lesson templates using LLM."""

    async def extract_blocks(self, source_data, llm_client):
        # 1. Summarize cards for LLM
        cards_summary = [...]

        # 2. Prompt LLM to identify conceptual groupings
        extraction_prompt = f"""Analyze this lesson and group cards..."""

        # 3. Parse LLM response into ConceptBlock format
        response = await llm_client.ainvoke(extraction_prompt)
        blocks = json.loads(response.content)

        return [ConceptBlock(...) for block in blocks]

# Registry allows adding new factories
BLOCK_FACTORY_REGISTRY = {
    "lesson_template": LessonTemplateBlockFactory,
    # Future: "outcome": OutcomeBlockFactory
}
```

### 3. infinite_practice_state.py - Graph State

```python
# Location: langgraph-agent/src/agent/infinite_practice_state.py

class InfinitePracticeState(TypedDict, total=False):
    """State schema for the LangGraph."""

    # Messages (required by LangGraph)
    messages: Annotated[list[BaseMessage], add_messages]

    # Identity
    student_id: str

    # Input
    source_type: str        # "lesson_template"
    source_data: Dict       # The lesson template

    # Session
    practice_session: Optional[PracticeSession]
    is_resuming: bool

    # Current State
    stage: PracticeStage    # "initialize", "present_concept", etc.
    current_block: Optional[ConceptBlock]
    current_block_index: int
    current_difficulty: DifficultyLevel

    # Question State
    current_question: Optional[Dict]
    student_response: Optional[str]
    marking_result: Optional[Dict]

    # Student Controls
    student_difficulty_override: Optional[DifficultyLevel]
    student_requested_advance: bool

    # Interrupt
    interrupt_response: Optional[Dict]
```

### 4. infinite_practice_graph.py - Main Graph

```python
# Location: langgraph-agent/src/agent/infinite_practice_graph.py

# Graph structure:
graph = StateGraph(InfinitePracticeState)

# Nodes (in execution order):
graph.add_node("initialize", initialize_node)        # Load/create session
graph.add_node("select_block", select_block_node)    # Pick next block
graph.add_node("present_concept", present_concept_node)  # INTERRUPT
graph.add_node("generate_question", generate_question_node)  # LLM
graph.add_node("present_question", present_question_node)    # INTERRUPT
graph.add_node("await_response", await_response_node)        # INTERRUPT
graph.add_node("mark_response", mark_response_node)          # LLM
graph.add_node("present_feedback", present_feedback_node)    # INTERRUPT
graph.add_node("update_progress", update_progress_node)
graph.add_node("route_next", route_next_node)
graph.add_node("session_complete", session_complete_node)

# Key Node: present_concept_node
async def present_concept_node(state):
    # 1. Create tool call with block data
    tool_call = ToolCall(
        id=f"concept_{block_id}",
        name="concept_presentation",
        args={
            "block_id": current_block["block_id"],
            "title": current_block["title"],
            "explanation": current_block["explanation"],
            "worked_example": current_block["worked_example"],
            "progress": progress_report
        }
    )

    # 2. Create message with tool call
    tool_message = AIMessage(content="", tool_calls=[tool_call])

    # 3. Interrupt to wait for frontend
    response = interrupt({})  # Empty payload!

    # 4. Parse response for controls
    payload = json.loads(response)
    if payload.get("difficulty_override"):
        # Student changed difficulty
        ...

    return {"messages": [tool_message], "stage": "generate_question"}
```

---

## Frontend Components

### 1. PracticeChatAssistant.tsx - Entry Component

```typescript
// Location: assistant-ui-frontend/components/PracticeChatAssistant.tsx

export function PracticeChatAssistant({
  lessonTemplateId,
  studentId,
  onThreadCreated,
}: PracticeChatAssistantProps) {

  // 1. Load lesson template
  useEffect(() => {
    const lessonDriver = createDriver(LessonDriver);
    const template = await lessonDriver.getLessonTemplate(lessonTemplateId);

    // 2. Build practice context
    const context: PracticeContext = {
      student_id: studentId,
      source_type: "lesson_template",
      source_data: { ...template, lessonTemplateId: template.$id }
    };

    setPracticeContext(context);
  }, []);

  // 3. LangGraph runtime with practice assistant
  const runtime = useLangGraphRuntime({
    stream: async (messages, { command }) => {
      return sendMessage({
        threadId,
        messages,
        command,
        sessionContext: practiceContext,
        assistantId: "infinite_practice"  // <-- KEY: Uses practice graph
      });
    }
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
      <ConceptPresentationTool />
      <PracticeQuestionTool />
      <PracticeFeedbackTool />
    </AssistantRuntimeProvider>
  );
}
```

### 2. ConceptPresentationTool.tsx

```typescript
// Location: assistant-ui-frontend/components/tools/ConceptPresentationTool.tsx

export const ConceptPresentationTool = makeAssistantToolUI<Args, unknown>({
  toolName: "concept_presentation",  // Must match backend tool name!

  render: function ConceptPresentationUI({ args }) {
    // CRITICAL: Hooks before conditionals!
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();
    const [selectedDifficulty, setSelectedDifficulty] = useState(args.current_difficulty);

    // Only render when interrupted
    if (!interrupt) return null;

    // Data comes from args (tool call), NOT interrupt.value
    const { title, explanation, worked_example, progress } = args;

    const handleContinue = () => {
      // Resume with optional difficulty override
      sendCommand({
        resume: JSON.stringify({
          action: "continue",
          difficulty_override: selectedDifficulty !== args.current_difficulty
            ? selectedDifficulty
            : undefined
        })
      });
    };

    return (
      <Card>
        <h1>{title}</h1>
        <p>{explanation}</p>
        <WorkedExample example={worked_example} />
        <ProgressBar blocks={progress.blocks} />
        <DifficultySelector
          value={selectedDifficulty}
          onChange={setSelectedDifficulty}
        />
        <Button onClick={handleContinue}>Start Practicing</Button>
      </Card>
    );
  }
});
```

### 3. PracticeQuestionTool.tsx

```typescript
// Location: assistant-ui-frontend/components/tools/PracticeQuestionTool.tsx

export const PracticeQuestionTool = makeAssistantToolUI<Args, unknown>({
  toolName: "practice_question",

  render: function PracticeQuestionUI({ args }) {
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();
    const [answer, setAnswer] = useState("");

    if (!interrupt) return null;

    const { question_type, stem, options, hints } = args;

    const handleSubmit = () => {
      sendCommand({
        resume: JSON.stringify({
          action: "submit",
          student_response: question_type === "mcq" ? selectedOption : answer
        })
      });
    };

    // Student controls
    const handleSetDifficulty = (diff) => {
      sendCommand({
        resume: JSON.stringify({ action: "set_difficulty", difficulty: diff })
      });
    };

    const handleAdvanceBlock = () => {
      sendCommand({
        resume: JSON.stringify({ action: "advance_block" })
      });
    };

    return (
      <Card>
        <QuestionStem>{stem}</QuestionStem>
        {question_type === "mcq" && <MCQOptions options={options} />}
        {question_type === "numeric" && <NumericInput />}
        {question_type === "structured_response" && <TextArea />}
        <HintsCollapsible hints={hints} />
        <Button onClick={handleSubmit}>Submit</Button>
      </Card>
    );
  }
});
```

---

## State Management

### Difficulty Progression Logic

```python
# In update_progress_node:

# Calculate accuracy at current difficulty
diff_accuracy = questions_correct[difficulty] / questions_attempted[difficulty]

# Adaptive difficulty rules:
if session["difficulty_mode"] == "adaptive":
    if diff_accuracy >= 0.8 and difficulty != "hard":
        # Advance: easy → medium, medium → hard
        next_difficulty = "medium" if difficulty == "easy" else "hard"
    elif diff_accuracy < 0.4 and difficulty != "easy":
        # Reduce: hard → medium, medium → easy
        next_difficulty = "easy" if difficulty == "medium" else "medium"
```

### Block Completion Criteria

```python
# A block is complete when:
block_complete = (
    # Mastery threshold met (default 0.7)
    mastery_score >= adaptive_threshold
    # AND at least 2 hard questions attempted
    AND questions_attempted["hard"] >= 2
) OR student_requested_advance  # Student can skip
```

### Mastery Calculation

```python
# Weighted by difficulty:
weights = {"easy": 0.2, "medium": 0.4, "hard": 0.4}

mastery_score = sum(
    (correct[diff] / attempted[diff]) * weight
    for diff, weight in weights.items()
    if attempted[diff] > 0
) / sum(weight for diff in weights if attempted[diff] > 0)
```

---

## Interrupt Pattern

### Critical Rules

1. **Data in Tool Calls, Not Interrupts**
   ```python
   # CORRECT: Data in ToolCall args
   tool_call = ToolCall(name="foo", args={"data": "here"})
   tool_message = AIMessage(content="", tool_calls=[tool_call])
   response = interrupt({})  # Empty!

   # WRONG: Data in interrupt
   response = interrupt({"data": "here"})  # DON'T DO THIS
   ```

2. **Hooks Before Conditionals**
   ```typescript
   // CORRECT
   const interrupt = useSafeLangGraphInterruptState();
   const sendCommand = useSafeLangGraphSendCommand();
   if (!interrupt) return null;  // After hooks

   // WRONG
   if (someCondition) return null;  // Before hooks - BREAKS!
   const interrupt = useSafeLangGraphInterruptState();
   ```

3. **Resume Wrapper Pattern**
   ```typescript
   // CORRECT
   sendCommand({ resume: JSON.stringify({ action: "continue" }) });

   // WRONG - missing resume wrapper
   sendCommand({ action: "continue" });
   ```

---

## Debugging Guide

### Backend Debugging

1. **Check logs for node execution:**
   ```bash
   tail -f logs/backend.log | grep "=== .* NODE ==="
   ```

2. **Verify graph is registered:**
   ```bash
   cat langgraph-agent/langgraph.json
   # Should show: "infinite_practice": "./src/agent/infinite_practice_graph.py:infinite_practice_graph"
   ```

3. **Test block extraction:**
   ```python
   # In Python REPL:
   from agent.block_factory import get_block_factory
   from langchain_anthropic import ChatAnthropic

   factory = get_block_factory("lesson_template")
   llm = ChatAnthropic(model="claude-sonnet-4-20250514")
   blocks = await factory.extract_blocks(lesson_data, llm)
   print(f"Extracted {len(blocks)} blocks")
   ```

4. **Check state at interrupts:**
   ```python
   # Add debug logging in nodes:
   logger.info(f"State before interrupt: {json.dumps(state, indent=2)}")
   ```

### Frontend Debugging

1. **Check which assistant is being used:**
   ```typescript
   // In chatApi.ts sendMessage:
   console.log('Using assistantId:', assistantId);
   ```

2. **Verify tool registration:**
   ```typescript
   // Check MyAssistant.tsx has:
   <ConceptPresentationTool />
   <PracticeQuestionTool />
   <PracticeFeedbackTool />
   ```

3. **Debug interrupt state:**
   ```typescript
   // In tool component:
   console.log('Interrupt state:', interrupt);
   console.log('Tool args:', args);
   ```

4. **Check resume payload:**
   ```typescript
   // Before sendCommand:
   const payload = { action: "continue" };
   console.log('Sending resume:', JSON.stringify(payload));
   sendCommand({ resume: JSON.stringify(payload) });
   ```

### Common Log Patterns

```bash
# Successful block extraction:
[INFO] Extracting blocks from lesson: Calculating Fractions
[INFO] Extracted 3 blocks from lesson

# Successful question generation:
[INFO] Generated medium mcq question

# Interrupt waiting:
[INFO] === PRESENT_CONCEPT NODE ===
[INFO] Presenting concept: Finding Fractions

# Response received:
[INFO] === AWAIT_RESPONSE NODE ===
[INFO] Received response: {"action": "submit", "student_response": "4"}
```

---

## Common Issues & Solutions

### Issue 1: Tool UI Not Rendering

**Symptoms:** Message appears but no interactive UI

**Causes & Fixes:**
```typescript
// 1. Tool name mismatch
// Backend:
ToolCall(name="concept_presentation", ...)
// Frontend must match:
toolName: "concept_presentation"  // NOT "conceptPresentation"!

// 2. Missing interrupt check
if (!interrupt) return null;  // Must have this

// 3. Tool not registered
// Check MyAssistant.tsx includes:
<ConceptPresentationTool />
```

### Issue 2: Infinite Loop in Graph

**Symptoms:** Graph keeps cycling without progressing

**Cause:** Stage not updating correctly

**Fix:**
```python
# Ensure stage is set in return:
return {
    "stage": "generate_question",  # Must set next stage!
    # ... other state
}
```

### Issue 3: Student Response Not Received

**Symptoms:** Graph waits indefinitely at await_response

**Cause:** Resume payload format wrong

**Fix:**
```typescript
// Ensure proper format:
sendCommand({
  resume: JSON.stringify({  // Must be string
    action: "submit",
    student_response: answer
  })
});
```

### Issue 4: Questions Not Generating

**Symptoms:** Error in generate_question_node

**Cause:** LLM response parsing failure

**Fix:**
```python
# Add robust parsing:
try:
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    question_data = json.loads(response_text.strip())
except json.JSONDecodeError:
    # Use fallback question
    question_data = {"stem": "...", "type": "structured_response"}
```

### Issue 5: Progress Not Updating

**Symptoms:** Mastery stays at 0, blocks never complete

**Cause:** Missing session update in state return

**Fix:**
```python
# In update_progress_node:
return {
    "practice_session": session,  # Must include updated session!
    "session_needs_save": True
}
```

---

## Extending the System

### Adding a New Block Factory

1. **Create factory class:**
   ```python
   # In block_factory.py:
   class OutcomeBlockFactory(BlockFactory):
       @property
       def source_type(self):
           return "outcome"

       async def extract_blocks(self, source_data, llm_client):
           # Extract from outcome data
           ...
   ```

2. **Register factory:**
   ```python
   BLOCK_FACTORY_REGISTRY["outcome"] = OutcomeBlockFactory
   ```

3. **Update frontend context:**
   ```typescript
   const context: PracticeContext = {
     student_id: studentId,
     source_type: "outcome",  // New type
     source_data: outcomeData
   };
   ```

### Adding a New Question Type

1. **Update question generation prompt:**
   ```python
   # In generate_question_node:
   question_types = {
       "easy": ["mcq", "true_false"],  # Add new type
       ...
   }
   ```

2. **Add frontend rendering:**
   ```typescript
   // In PracticeQuestionTool.tsx:
   {question_type === "true_false" && (
     <TrueFalseInput value={answer} onChange={setAnswer} />
   )}
   ```

3. **Update marking logic:**
   ```python
   # In mark_response_node:
   if question_type == "true_false":
       is_correct = student_response.lower() == question["correct_answer"].lower()
   ```

### Adding Appwrite Persistence

1. **Create collection (using MCP):**
   ```javascript
   // Collection: practice_sessions
   {
     attributes: [
       { key: "session_id", type: "string" },
       { key: "student_id", type: "string" },
       { key: "blocks", type: "string" },  // JSON
       // ... see schema in implementation
     ]
   }
   ```

2. **Implement load/save functions:**
   ```python
   # In infinite_practice_graph.py:

   async def load_session_from_appwrite(student_id, source_type, source_id):
       # Query practice_sessions collection
       result = await databases.list_documents(
           "default", "practice_sessions",
           [
               Query.equal("student_id", student_id),
               Query.equal("source_type", source_type),
               Query.equal("source_id", source_id),
               Query.equal("status", "active")
           ]
       )
       return result.documents[0] if result.documents else None

   async def save_session_to_appwrite(session):
       await databases.create_document(
           "default", "practice_sessions",
           session["session_id"],
           serialize_session(session)
       )
   ```

---

## File Reference

### Backend Files (langgraph-agent/)

| File | Purpose |
|------|---------|
| `src/agent/practice_session.py` | Data models: PracticeSession, ConceptBlock, BlockProgress |
| `src/agent/block_factory.py` | BlockFactory interface + LessonTemplateBlockFactory |
| `src/agent/infinite_practice_state.py` | LangGraph state schema |
| `src/agent/infinite_practice_graph.py` | Main graph with all nodes |
| `langgraph.json` | Graph registration |

### Frontend Files (assistant-ui-frontend/)

| File | Purpose |
|------|---------|
| `app/(protected)/practice/[lessonId]/page.tsx` | Route entry point |
| `components/PracticeChatAssistant.tsx` | Main practice component |
| `components/tools/ConceptPresentationTool.tsx` | Block explanation UI |
| `components/tools/PracticeQuestionTool.tsx` | Question rendering UI |
| `components/tools/PracticeFeedbackTool.tsx` | Feedback display UI |
| `lib/chatApi.ts` | API with assistantId support |
| `components/MyAssistant.tsx` | Tool registration |

### Related Documentation

| Doc | Topic |
|-----|-------|
| `docs/interrupt-flow-documentation.md` | Interrupt pattern details |
| `CLAUDE.md` | Project conventions |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUICK REFERENCE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  START PRACTICE:     /practice/{lessonTemplateId}               │
│  ASSISTANT ID:       "infinite_practice"                        │
│  GRAPH FILE:         infinite_practice_graph.py                 │
│                                                                 │
│  TOOL NAMES:                                                    │
│    - concept_presentation                                       │
│    - practice_question                                          │
│    - practice_feedback                                          │
│                                                                 │
│  STAGES:                                                        │
│    initialize → select_block → present_concept →                │
│    generate_question → present_question → await_response →      │
│    mark_response → present_feedback → update_progress →         │
│    route_next → (loop or complete)                              │
│                                                                 │
│  DIFFICULTY LEVELS:  easy, medium, hard                         │
│  MASTERY THRESHOLD:  0.7 (70%)                                  │
│  DIFFICULTY WEIGHTS: easy=0.2, medium=0.4, hard=0.4             │
│                                                                 │
│  DEBUG COMMANDS:                                                │
│    tail -f logs/backend.log | grep "NODE"                       │
│    console.log('interrupt:', interrupt)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
