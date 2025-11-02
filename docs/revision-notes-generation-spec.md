# Revision Notes Generation Feature Specification

## 1. OVERVIEW

**Goal**: Enable students to access AI-generated, concise but powerful revision notes for completed lessons, downloadable in PDF and Markdown formats.

**Key Requirements**:
- Generated per lesson template using SOW context
- Stored in Appwrite database, indexed by lesson template ID
- Uses Claude Code agent pattern (LangGraph architecture)
- Concise but comprehensive content optimized for SQA curriculum
- Available in PDF and Markdown formats

---

## 2. AGENT ARCHITECTURE

### 2.1 Graph Structure

**File**: `langgraph-agent/src/agent/revision_notes_graph.py`

**Pattern**: Single-node specialized subgraph (similar to `course_manager_graph.py`)

```python
# State extension for revision notes
class RevisionNotesState(InterruptUnifiedState):
    """Extended state for revision notes generation"""
    revision_notes_content: Optional[Dict[str, Any]] = None
    revision_notes_id: Optional[str] = None
    generation_status: Optional[str] = None  # "pending", "generating", "complete", "error"
    export_format: Optional[str] = None  # "markdown", "pdf", "both"
```

**Node Flow**:
```
entry_node (validate context)
    ↓
generate_revision_notes_node (LLM generation)
    ↓
store_revision_notes_node (Appwrite persistence)
    ↓
format_output_node (Markdown/PDF export)
```

### 2.2 Integration with Main Graph

Add new mode to `graph_interrupt.py`:

```python
# In entry_node_interrupt
elif session_context and session_context.get("mode") == "revision_notes":
    logger.info("📝 REVISION NOTES MODE DETECTED")
    mode = "revision_notes"

    return {
        "session_context": session_context,
        "mode": mode,
        "session_id": session_context.get("session_id"),
        "lesson_template_id": session_context.get("lesson_template_id"),
        "course_id": session_context.get("course_id"),
        "export_format": session_context.get("export_format", "both")
    }
```

---

## 3. PROMPT ENGINEERING STRATEGY

### 3.1 Structured Output Schema

```python
class RevisionNotes(BaseModel):
    """Structured output for revision notes generation"""

    # Core content sections
    summary: str  # 2-3 sentences - lesson essence
    key_concepts: List[KeyConcept]  # Top 3-5 concepts with explanations
    worked_examples: List[WorkedExample]  # 1-2 fully worked examples
    common_mistakes: List[Misconception]  # Top misconceptions with corrections
    quick_quiz: List[QuickCheckQuestion]  # 3-5 rapid recall questions
    memory_aids: List[MemoryAid]  # Mnemonics, tricks, patterns
    exam_tips: List[str]  # SQA-specific exam strategies

    # Metadata
    difficulty_level: str  # "National 3", "National 4", etc.
    estimated_study_time: int  # minutes
    sqa_outcome_refs: List[str]  # Outcome references covered

class KeyConcept(BaseModel):
    title: str  # e.g., "Fraction Simplification"
    explanation: str  # 30-50 words - crystal clear
    visual_representation: Optional[str]  # LaTeX or ASCII diagram
    real_world_connection: Optional[str]  # Brief example

class WorkedExample(BaseModel):
    problem: str
    solution_steps: List[str]  # Step-by-step breakdown
    answer: str
    key_insight: str  # Why this example matters

class Misconception(BaseModel):
    mistake: str  # Common error pattern
    why_wrong: str  # Explanation of misunderstanding
    correction: str  # How to fix thinking
    tip: str  # How to avoid in future

class QuickCheckQuestion(BaseModel):
    question: str
    answer: str
    explanation: str  # Brief clarification

class MemoryAid(BaseModel):
    type: str  # "mnemonic", "pattern", "trick", "visual"
    content: str
    application: str  # When to use it
```

### 3.2 System Prompt Template

```python
REVISION_NOTES_SYSTEM_PROMPT = """You are an expert Scottish SQA curriculum tutor creating **concise but powerful** revision notes for {course_level_display} {course_subject_display}.

## YOUR MISSION
Generate revision notes that maximize retention and exam performance in minimal study time. Every word must earn its place.

## CURRICULUM CONTEXT
{sqa_alignment_summary}

**SQA Outcomes Covered**:
{formatted_outcomes}

**Lesson Type**: {lesson_type_display}
**Engagement Strategies**: {engagement_tags}
**Policy**: {lesson_policy}

## QUALITY STANDARDS

### ✅ CONCISE WRITING PRINCIPLES
1. **Clarity Over Completeness**: Focus on core understanding, not exhaustive coverage
2. **Active Voice**: "Simplify fractions by..." not "Fractions can be simplified by..."
3. **Concrete Examples**: Show don't tell - worked examples > abstract theory
4. **Visual Anchors**: Use LaTeX for math, diagrams for processes
5. **SQA Exam Focus**: Align with assessment standard language and command words

### ✅ MEMORY OPTIMIZATION
- **Chunking**: Group related concepts (3-5 items per list max)
- **Dual Coding**: Combine verbal + visual representations
- **Elaboration**: Connect to real-world contexts
- **Retrieval Practice**: Quick quiz questions test key ideas
- **Spacing Cues**: Suggest study intervals

### ✅ SCOTTISH SQA ALIGNMENT
- Use official SQA terminology and command words (calculate, explain, apply)
- Reference assessment standards explicitly
- Include exam technique tips specific to SQA papers
- Highlight calculator vs non-calculator content where relevant

## CONTENT STRUCTURE REQUIREMENTS

### Summary (2-3 sentences)
- What students learned and why it matters
- Connection to prior/future learning
- SQA outcome in plain language

### Key Concepts (3-5 concepts)
- Title: Clear, specific concept name
- Explanation: 30-50 words maximum - crystal clear
- Visual: LaTeX formula or ASCII diagram when helpful
- Real-world: Brief example students can relate to

### Worked Examples (1-2 examples)
- **Example 1**: Standard application (typical exam question)
- **Example 2**: Challenge application (higher-order thinking)
- Each example: Problem → Step-by-step solution → Key insight

### Common Mistakes (Top 3-4)
- Identify actual errors from lesson evidence if available
- Explain **why** the mistake happens (misconception root cause)
- Provide clear correction strategy
- Give a tip to avoid in future

### Quick Quiz (3-5 questions)
- Mix of difficulty levels
- Cover different concepts (not repetitive)
- Answers with brief explanations
- Format suitable for self-testing

### Memory Aids (2-4 aids)
- Mnemonics for processes/formulas
- Visual patterns (e.g., "denominator down below")
- Tricks for exam efficiency
- Connections to memorable contexts

### Exam Tips (3-5 tips)
- SQA-specific strategies (e.g., "Show all working for method marks")
- Time management for this topic
- Common exam question formats
- Calculator guidance if relevant

## TONE & STYLE
- **Encouraging**: Build confidence, not anxiety
- **Direct**: Get to the point quickly
- **Student-Friendly**: Avoid jargon unless explaining it
- **Exam-Focused**: Every section serves exam preparation

## INPUT CONTEXT
You will receive:
1. **Lesson Snapshot**: Full lesson content (cards, CFUs, rubrics)
2. **SOW Context**: Broader curriculum positioning
3. **Student Evidence** (optional): Performance data to identify challenge areas
4. **Enriched Outcomes**: Full SQA assessment standards

Use this context to make notes **laser-focused** on what students need for success.
"""
```

### 3.3 User Prompt Template

```python
REVISION_NOTES_USER_PROMPT = """Generate revision notes for this completed lesson:

## LESSON DETAILS
**Title**: {lesson_title}
**Type**: {lesson_type}
**Estimated Time**: {est_minutes} minutes
**SOW Order**: {sow_order}

## LESSON CONTENT
{formatted_cards}

## SQA OUTCOMES
{formatted_outcomes_detail}

## STUDENT PERFORMANCE CONTEXT (if available)
{performance_summary}

## SCHEME OF WORK CONTEXT
{sow_context}

---

**Generate concise but powerful revision notes following the structured schema.**

Focus on:
1. Distilling complex explanations into memorable key concepts
2. Selecting the MOST representative worked examples
3. Highlighting misconceptions that actually appeared in student evidence
4. Creating quick quiz questions that test understanding, not just recall
5. Providing memory aids that leverage visual/verbal dual coding
6. Giving exam tips specific to SQA assessment standards

Remember: These notes should enable effective revision in {recommended_study_time} minutes while ensuring exam readiness.
"""
```

---

## 4. DATABASE SCHEMA

### 4.1 New Collection: `revision_notes`

**Purpose**: Store generated revision notes indexed by lesson template

```typescript
interface RevisionNotesDocument {
  $id: string;  // Auto-generated
  $createdAt: string;
  $updatedAt: string;

  // Indexing fields
  lessonTemplateId: string;  // PRIMARY INDEX
  courseId: string;          // INDEX (for course-level queries)

  // Content
  contentVersion: string;     // "1.0" (for future schema changes)
  notesContent: string;       // JSON compressed (RevisionNotes schema)
  notesContentPlain: string;  // JSON compressed (accessible version)

  // Generation metadata
  generatedAt: string;        // ISO timestamp
  generatedBy: string;        // "claude-sonnet-4-5" model version
  generationContext: string;  // JSON with SOW refs, outcomes used

  // Performance context (optional)
  basedOnEvidence: boolean;   // Whether student evidence informed generation
  evidenceSummary?: string;   // JSON with performance metrics

  // Export tracking
  downloadCount: number;      // Track popularity
  lastDownloadedAt?: string;

  // Quality metadata
  wordCount: number;
  estimatedStudyMinutes: number;
  sqaOutcomeRefs: string;     // JSON array of outcome IDs
}
```

**Indexes**:
```javascript
// Primary lookup
lessonTemplateId (unique)

// Course-level queries
courseId

// Recent generations
generatedAt (desc)

// Compound for student-specific queries
[courseId, lessonTemplateId]
```

### 4.2 Enhanced Session Schema

Add optional reference to revision notes:

```typescript
interface SessionDocument {
  // ... existing fields ...

  // New field
  revisionNotesId?: string;  // Reference to revision_notes.$id
  revisionNotesGeneratedAt?: string;
}
```

---

## 5. IMPLEMENTATION PLAN

### Phase 1: Core Agent Implementation

**Files to Create**:

1. **`langgraph-agent/src/agent/revision_notes_state.py`**
   - Extend `InterruptUnifiedState` with revision-specific fields
   - Define structured output schemas (Pydantic models)

2. **`langgraph-agent/src/agent/revision_notes_prompts.py`**
   - System prompt template
   - User prompt template
   - Helper functions for context formatting

3. **`langgraph-agent/src/agent/revision_notes_generator.py`**
   - `RevisionNotesGenerator` class (similar to `LLMTeacher`)
   - LLM integration with structured output
   - Prompt assembly logic

4. **`langgraph-agent/src/agent/revision_notes_graph.py`**
   - Main graph implementation
   - Nodes: validate → generate → store → format
   - Compiled graph export

5. **`langgraph-agent/src/agent/revision_notes_utils.py`**
   - Parse lesson snapshot for notes context
   - Format SOW context
   - Extract performance metrics from evidence
   - Markdown/PDF export utilities

**Integration**:
- Update `graph_interrupt.py` to add "revision_notes" mode routing
- Add conditional edge to revision_notes subgraph

### Phase 2: Database & Storage

**Files to Create**:

1. **`assistant-ui-frontend/lib/drivers/RevisionNotesDriver.ts`**
   - CRUD operations for revision_notes collection
   - Fetch by lesson template ID
   - Store generated notes
   - Track downloads

2. **Database migration script** (if needed)
   - Create `revision_notes` collection
   - Set up indexes
   - Add permissions

### Phase 3: Export Functionality

**Files to Create**:

1. **`langgraph-agent/src/agent/export/markdown_exporter.py`**
   - Convert structured notes to Markdown
   - Format LaTeX for PDF rendering
   - Add metadata header/footer

2. **`langgraph-agent/src/agent/export/pdf_exporter.py`**
   - Use library like `weasyprint` or `reportlab`
   - Convert Markdown to PDF
   - Include SQA branding/formatting
   - Handle LaTeX math rendering

3. **`assistant-ui-frontend/lib/export/revisionNotesExport.ts`**
   - Client-side download triggers
   - Format selection (MD/PDF)
   - Browser download handling

### Phase 4: Frontend UI

**Files to Create/Modify**:

1. **`assistant-ui-frontend/components/tools/RevisionNotesTool.tsx`**
   - Display revision notes in Assistant UI
   - Tool call integration pattern
   - Export buttons (Download MD / Download PDF)

2. **`assistant-ui-frontend/components/course/RevisionNotesPanel.tsx`**
   - Standalone revision notes viewer
   - Accessible from lesson history
   - Search/filter by course/lesson

3. **Update Course Manager/Session UI**
   - Add "Generate Revision Notes" button to completed lessons
   - Show existing notes if already generated
   - Indicate when notes are being generated

### Phase 5: Testing & Validation

**Test Files**:

1. **`langgraph-agent/tests/test_revision_notes_generator.py`**
   - Test prompt assembly
   - Test LLM structured output parsing
   - Test content quality (word count, structure)

2. **`langgraph-agent/tests/test_revision_notes_graph.py`**
   - Test graph execution
   - Test state transitions
   - Test error handling

3. **E2E Playwright Tests**
   - Complete lesson → Generate notes → Download PDF/MD
   - Test with different lesson types
   - Test accessibility features

---

## 6. PROMPT DESIGN RATIONALE

### Why This Prompt Structure Works

**1. Conciseness Through Constraints**
- Explicit word limits per section (e.g., "30-50 words")
- Forces prioritization of core concepts
- Prevents LLM verbosity

**2. Power Through Structure**
- Dual coding (verbal + visual) maximizes retention
- Worked examples provide concrete anchors
- Quick quiz enables retrieval practice (proven learning strategy)

**3. SQA Alignment**
- Uses assessment standard language
- Focuses on exam-relevant skills
- Incorporates Scottish curriculum terminology

**4. Evidence-Informed**
- Uses student performance data when available
- Highlights actual misconceptions encountered
- Personalizes to challenge areas

**5. Cognitive Science Principles**
- Chunking (3-5 items per list)
- Elaboration (real-world connections)
- Spacing (estimated study time)
- Interleaving (mixed quiz questions)

### Example Output Quality

**Bad (verbose, unfocused)**:
```
Summary: In this lesson, students learned about fractions and how to simplify them
by finding common factors. This is an important skill that will help them in many
areas of mathematics and is particularly relevant for the National 3 curriculum...
```

**Good (concise, powerful)**:
```
Summary: You learned to simplify fractions by dividing numerator and denominator by
their highest common factor (HCF). This skill is essential for National 3 algebra
and appears in 60% of SQA exam papers.
```

---

## 7. TECHNICAL CONSIDERATIONS

### 7.1 Performance Optimization

**Caching Strategy**:
- Check if notes exist before generating (lookup by `lessonTemplateId`)
- Regenerate only if:
  - Lesson template updated since last generation
  - Student evidence added (optional: evidence-informed refresh)
  - Manual regeneration requested

**Async Generation**:
- Generate notes asynchronously after lesson completion
- Show "Generating..." status in UI
- Notify when ready (or silently appear in lesson card)

### 7.2 Accessibility

**Plain Text Version**:
- Generate both standard and CEFR A2-B1 accessible version
- Store in `notesContentPlain` field
- Use simpler vocabulary, shorter sentences
- Avoid complex LaTeX in plain version

**Screen Reader Support**:
- Alt text for visual diagrams
- Structured headings for navigation
- MathML alternative to LaTeX (for PDF)

### 7.3 Quality Assurance

**Validation Checks**:
```python
def validate_revision_notes(notes: RevisionNotes) -> ValidationResult:
    """Validate generated notes meet quality standards"""
    errors = []
    warnings = []

    # Summary length check
    summary_words = len(notes.summary.split())
    if summary_words > 60:
        warnings.append(f"Summary too long: {summary_words} words (target: 40-60)")

    # Key concepts count
    if len(notes.key_concepts) < 3 or len(notes.key_concepts) > 5:
        errors.append(f"Key concepts should be 3-5, got {len(notes.key_concepts)}")

    # Worked examples presence
    if len(notes.worked_examples) < 1:
        errors.append("Must include at least 1 worked example")

    # SQA outcome alignment
    if not notes.sqa_outcome_refs:
        errors.append("Must reference at least 1 SQA outcome")

    # Total word count (target: 500-800 words)
    total_words = calculate_total_words(notes)
    if total_words > 1000:
        warnings.append(f"Notes too verbose: {total_words} words (target: 500-800)")

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )
```

### 7.4 Export Format Details

**Markdown Structure**:
```markdown
# Revision Notes: {Lesson Title}

**Course**: {Course Subject} ({Course Level})
**SQA Outcomes**: {Outcome References}
**Estimated Study Time**: {X} minutes

---

## Summary
{2-3 sentence summary}

## Key Concepts

### 1. {Concept Title}
{Explanation}

**Visual**:
```latex
{LaTeX representation}
```

**Real-World Connection**: {Example}

---

### 2. {Concept Title}
...

## Worked Examples

### Example 1: {Problem Title}
**Problem**: {Problem statement}

**Solution**:
1. {Step 1}
2. {Step 2}
...

**Answer**: {Final answer}

**Key Insight**: {Why this matters}

---

## Common Mistakes

### ❌ Mistake: {Error description}
**Why Wrong**: {Explanation}
**Correction**: {How to fix}
**Tip**: {How to avoid}

---

## Quick Quiz

1. **Q**: {Question}
   **A**: {Answer}
   **Explanation**: {Brief clarification}

---

## Memory Aids

### 🧠 {Type}: {Title}
{Content}
**Application**: {When to use}

---

## Exam Tips

- ✅ {Tip 1}
- ✅ {Tip 2}
...

---

*Generated by Scottish AI Lessons | SQA-Aligned Revision Support*
```

**PDF Enhancements**:
- Cover page with course branding
- Table of contents with page numbers
- Color-coded sections (concepts = blue, mistakes = red, tips = green)
- LaTeX math properly rendered
- Footer with SQA outcome references

---

## 8. SUCCESS METRICS

### Quality Metrics
- **Conciseness**: 500-800 words per lesson (target)
- **Coverage**: 100% of lesson SQA outcomes referenced
- **Structure**: All required sections present (validated)
- **Accessibility**: CEFR A2-B1 readability for plain text version

### Usage Metrics
- **Adoption**: % of students downloading notes post-lesson
- **Format Preference**: PDF vs Markdown download ratio
- **Timing**: When students access (immediately vs pre-exam)

### Impact Metrics
- **Correlation**: Revision note downloads vs exam performance
- **Feedback**: Student ratings of note quality
- **Efficiency**: Study time reduction (survey-based)

---

## 9. FUTURE ENHANCEMENTS

### Phase 2 Features
1. **Personalized Notes**: Incorporate student mastery data to emphasize weak areas
2. **Spaced Repetition**: Suggest optimal review intervals based on Ebbinghaus curve
3. **Flashcard Export**: Generate Anki/Quizlet decks from quick quiz
4. **Audio Version**: Text-to-speech for auditory learners
5. **Collaborative Annotations**: Allow students to add personal notes

### Advanced Features
1. **Cross-Lesson Synthesis**: Generate topic-level notes spanning multiple lessons
2. **Exam Paper Integration**: Link to past SQA papers covering same outcomes
3. **Video Micro-Lessons**: 2-3 minute video summaries for each key concept
4. **Peer Comparison**: Anonymized insights on how others approached same content

---

## 10. DEVELOPMENT TIMELINE

**Week 1**: Core agent implementation
- Day 1-2: State, prompts, generator class
- Day 3-4: Graph implementation and integration
- Day 5: Testing and refinement

**Week 2**: Database and export
- Day 1-2: Database schema, RevisionNotesDriver
- Day 3-4: Markdown/PDF export utilities
- Day 5: Export testing

**Week 3**: Frontend and E2E
- Day 1-2: RevisionNotesTool, UI components
- Day 3-4: Integration with Course Manager
- Day 5: Playwright E2E tests

**Week 4**: Polish and launch
- Day 1-2: Accessibility review and plain text version
- Day 3: Quality validation and metrics
- Day 4-5: Beta testing with real lessons

---

## APPENDIX: CODE SKELETON

### A. Revision Notes Generator

```python
# langgraph-agent/src/agent/revision_notes_generator.py

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class KeyConcept(BaseModel):
    title: str
    explanation: str
    visual_representation: Optional[str] = None
    real_world_connection: Optional[str] = None

class WorkedExample(BaseModel):
    problem: str
    solution_steps: List[str]
    answer: str
    key_insight: str

class Misconception(BaseModel):
    mistake: str
    why_wrong: str
    correction: str
    tip: str

class QuickCheckQuestion(BaseModel):
    question: str
    answer: str
    explanation: str

class MemoryAid(BaseModel):
    type: str  # "mnemonic", "pattern", "trick", "visual"
    content: str
    application: str

class RevisionNotes(BaseModel):
    summary: str
    key_concepts: List[KeyConcept]
    worked_examples: List[WorkedExample]
    common_mistakes: List[Misconception]
    quick_quiz: List[QuickCheckQuestion]
    memory_aids: List[MemoryAid]
    exam_tips: List[str]
    difficulty_level: str
    estimated_study_time: int
    sqa_outcome_refs: List[str]

class RevisionNotesGenerator:
    """Generates concise but powerful revision notes using Claude"""

    def __init__(self, model: str = "claude-sonnet-4-5"):
        self.llm = ChatOpenAI(
            model=model,
            temperature=0.3,  # Lower temp for consistency
            model_kwargs={"response_format": {"type": "json_object"}}
        )

    async def generate_notes(
        self,
        lesson_snapshot: Dict[str, Any],
        sow_context: Optional[str] = None,
        enriched_outcomes: Optional[List[Dict]] = None,
        evidence_summary: Optional[Dict] = None,
        curriculum_context: Optional[Dict] = None
    ) -> RevisionNotes:
        """Generate revision notes for a lesson"""

        # Build prompts
        system_prompt = self._build_system_prompt(curriculum_context)
        user_prompt = self._build_user_prompt(
            lesson_snapshot,
            sow_context,
            enriched_outcomes,
            evidence_summary
        )

        # Call LLM
        logger.info(f"Generating revision notes for: {lesson_snapshot.get('title')}")
        response = await self.llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])

        # Parse structured output
        notes = RevisionNotes.model_validate_json(response.content)

        # Validate quality
        self._validate_notes(notes)

        return notes

    def _build_system_prompt(self, curriculum_context: Optional[Dict]) -> str:
        """Build system prompt with curriculum context"""
        # Implementation using REVISION_NOTES_SYSTEM_PROMPT template
        pass

    def _build_user_prompt(
        self,
        lesson_snapshot: Dict,
        sow_context: Optional[str],
        enriched_outcomes: Optional[List[Dict]],
        evidence_summary: Optional[Dict]
    ) -> str:
        """Build user prompt with lesson details"""
        # Implementation using REVISION_NOTES_USER_PROMPT template
        pass

    def _validate_notes(self, notes: RevisionNotes):
        """Validate generated notes meet quality standards"""
        # Implementation of validation logic
        pass
```

### B. Revision Notes Graph

```python
# langgraph-agent/src/agent/revision_notes_graph.py

from langgraph.graph import StateGraph
from typing import Dict, Any
import logging

from .revision_notes_state import RevisionNotesState
from .revision_notes_generator import RevisionNotesGenerator
from .revision_notes_utils import (
    extract_lesson_context,
    format_notes_for_storage,
    export_to_markdown,
    export_to_pdf
)

logger = logging.getLogger(__name__)

async def validate_context_node(state: RevisionNotesState) -> RevisionNotesState:
    """Validate required context is present"""
    lesson_template_id = state.get("lesson_template_id")
    lesson_snapshot = state.get("lesson_snapshot")

    if not lesson_template_id or not lesson_snapshot:
        return {
            "generation_status": "error",
            "error_message": "Missing required lesson context"
        }

    return {"generation_status": "validated"}

async def generate_notes_node(state: RevisionNotesState) -> RevisionNotesState:
    """Generate revision notes using LLM"""
    logger.info("Starting revision notes generation")

    generator = RevisionNotesGenerator()

    try:
        notes = await generator.generate_notes(
            lesson_snapshot=state.get("lesson_snapshot"),
            sow_context=state.get("sow_context"),
            enriched_outcomes=state.get("enriched_outcomes"),
            evidence_summary=state.get("evidence_summary"),
            curriculum_context=extract_lesson_context(state)
        )

        return {
            "revision_notes_content": notes.model_dump(),
            "generation_status": "complete"
        }
    except Exception as e:
        logger.error(f"Revision notes generation failed: {e}")
        return {
            "generation_status": "error",
            "error_message": str(e)
        }

async def store_notes_node(state: RevisionNotesState) -> RevisionNotesState:
    """Store revision notes in Appwrite database"""
    # Implementation: RevisionNotesDriver.create()
    pass

async def format_output_node(state: RevisionNotesState) -> RevisionNotesState:
    """Format notes for export (Markdown/PDF)"""
    export_format = state.get("export_format", "both")
    notes_content = state.get("revision_notes_content")

    if export_format in ["markdown", "both"]:
        markdown_content = export_to_markdown(notes_content)
        # Store or return markdown

    if export_format in ["pdf", "both"]:
        pdf_content = export_to_pdf(notes_content)
        # Store or return PDF

    return {"generation_status": "exported"}

# Build graph
revision_notes_graph = StateGraph(RevisionNotesState)
revision_notes_graph.add_node("validate_context", validate_context_node)
revision_notes_graph.add_node("generate_notes", generate_notes_node)
revision_notes_graph.add_node("store_notes", store_notes_node)
revision_notes_graph.add_node("format_output", format_output_node)

revision_notes_graph.add_edge("__start__", "validate_context")
revision_notes_graph.add_edge("validate_context", "generate_notes")
revision_notes_graph.add_edge("generate_notes", "store_notes")
revision_notes_graph.add_edge("store_notes", "format_output")

compiled_revision_notes_graph = revision_notes_graph.compile()
```

---

## CONCLUSION

This design provides a **concise but powerful** revision notes generation system that:

✅ Follows existing LangGraph agent patterns
✅ Uses evidence-based prompt engineering for quality
✅ Integrates seamlessly with current architecture
✅ Supports SQA curriculum alignment
✅ Enables PDF/Markdown export
✅ Optimizes for student exam success

The prompt design balances **conciseness** (word limits, focused sections) with **power** (dual coding, worked examples, retrieval practice) to maximize learning efficiency.

**Next Steps**: Begin Phase 1 implementation with core agent files.
