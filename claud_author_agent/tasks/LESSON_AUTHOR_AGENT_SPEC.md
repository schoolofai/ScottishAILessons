# Lesson Author Agent - Claude SDK Implementation Specification

## Document Metadata
- **Created**: 2025-10-16
- **Status**: Planning
- **Architecture**: Claude Agent SDK (not LangGraph)
- **Based On**: SOW Author Agent pattern + LangGraph Lesson Author prompts

---

## Executive Summary

Create a Claude Agent SDK-based lesson authoring pipeline that:
1. Takes SOW entry as input (courseId + order)
2. Generates complete LessonTemplate via agent workflow
3. Upserts to Appwrite lesson_templates collection (Python-based, not agent)

**Key Principle**: Follow the same architecture as SOW Author Agent (`sow_author_claude_client.py`) but adapted for lesson authoring workflow.

---

## Architecture Overview

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    LESSON AUTHOR PIPELINE                        │
└─────────────────────────────────────────────────────────────────┘

1. INPUT VALIDATION (Python)
   └─ Validate courseId and order parameters
   └─ Query Appwrite for SOW document
   └─ Extract SOW entry by order field

2. PRE-PROCESSING (Python - NO AGENT)
   └─ Extract SOW entry → sow_entry_input.json
   └─ Extract SOW metadata → sow_context.json
   └─ Fetch Course_data.txt from sqa_education.sqa_current

3. AGENT EXECUTION (Claude Agent SDK)
   └─ Subagent 1: research_subagent (on-demand for additional info)
      • Use WebSearch/WebFetch for Scottish contexts, pedagogical patterns
      • Query for exemplar lesson structures, misconceptions, policy notes
      • NO pre-loaded research pack - agent gathers info as needed
   └─ Subagent 2: lesson_author (main authoring)
   └─ Subagent 3: combined_lesson_critic (validation)
   └─ Outputs: lesson_template.json, critic_result.json

4. POST-PROCESSING (Python - NO AGENT)
   └─ Load lesson_template.json from workspace
   └─ Compress cards field (gzip + base64)
   └─ Upsert to lesson_templates collection
   └─ Return document ID and metrics

5. REPORTING
   └─ Cost tracking across all subagents
   └─ Token usage summary
   └─ Success/failure status
```

---

## File Structure

```
claud_author_agent/
├── src/
│   ├── lesson_author_claude_client.py    # Main agent orchestrator (NEW)
│   ├── lesson_author_cli.py              # CLI wrapper (NEW)
│   ├── prompts/
│   │   ├── lesson_author_prompt.md       # Main lesson author (ADAPTED)
│   │   ├── research_subagent_prompt.md   # Already exists (REUSE)
│   │   └── lesson_critic_prompt.md       # Lesson critic (ADAPTED)
│   └── utils/
│       ├── lesson_upserter.py            # Lesson template upserter (NEW)
│       ├── sow_extractor.py              # SOW entry extractor (NEW)
│       ├── course_data_extractor.py      # Reuse from SOW author
│       ├── filesystem.py                 # Reuse from SOW author
│       ├── validation.py                 # Reuse from SOW author
│       ├── metrics.py                    # Reuse from SOW author
│       ├── logging_config.py             # Reuse from SOW author
│       └── appwrite_mcp.py               # Reuse from SOW author
└── tasks/
    └── LESSON_AUTHOR_AGENT_SPEC.md       # This file
```

---

## Component Specifications

### 1. Main Agent Class: `LessonAuthorClaudeAgent`

**File**: `src/lesson_author_claude_client.py`

**Class Signature**:
```python
class LessonAuthorClaudeAgent:
    """Autonomous lesson template authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    0. SOW Entry Extractor → Extracts entry from Authored_SOW (Python utility)
    1. Course Data Extractor → Creates Course_data.txt from Appwrite (Python utility)

    Pipeline execution (3 subagents):
    2. Research Subagent → Answers clarifications with Scottish context (WebSearch/WebFetch)
    3. Lesson Author → Creates lesson_template.json (main authoring agent)
    4. Combined Lesson Critic → Validates across 5 dimensions (with retry)

    Post-processing (Python):
    5. Lesson Upserter → Writes to default.lesson_templates (Python utility)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        max_critic_retries: Maximum attempts for critic validation loop
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents

    Architecture Notes:
        - SOW entry extraction moved to Python (no LLM needed, saves tokens)
        - Course data extraction moved to Python (no LLM needed, saves tokens)
        - Research via on-demand research_subagent (WebSearch/WebFetch as needed)
        - NO pre-loaded research pack - agent queries for specific information
        - Upserting kept as Python (deterministic, no LLM needed)
        - Only creative/judgmental tasks use LLM agents (authoring, critique)
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        max_critic_retries: int = 10,
        log_level: str = "INFO"
    ):
        """Initialize Lesson Author agent."""
        pass

    async def execute(
        self,
        courseId: str,
        order: int
    ) -> Dict[str, Any]:
        """Execute the complete lesson authoring pipeline.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW entries

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - appwrite_document_id: str (if successful)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If courseId not found or order invalid
            FileNotFoundError: If MCP config or prompts missing
        """
        pass
```

**Key Methods**:
- `_validate_sow_entry_exists()`: Check SOW document exists and has entry at order
- `_get_subagent_definitions()`: Load 3 subagent prompts (research, author, critic)
- `_build_initial_prompt()`: Orchestration prompt for main agent
- `execute()`: Main pipeline orchestration

---

### 2. CLI Wrapper: `LessonAuthorCLI`

**File**: `src/lesson_author_cli.py`

**Interface**:
```bash
# JSON file input
python -m src.lesson_author_cli --input input.json

# Command-line arguments
python -m src.lesson_author_cli \
  --courseId course_c84874 \
  --order 0

# Interactive mode (no arguments)
python -m src.lesson_author_cli
```

**Input JSON Format**:
```json
{
  "courseId": "course_c84874",
  "order": 0
}
```

**Features**:
- Three input methods (JSON file, CLI args, interactive)
- Configuration options (--mcp-config, --max-retries, --no-persist-workspace)
- Log level control (--log-level DEBUG|INFO|WARNING|ERROR)
- User-friendly result reporting

---

### 3. SOW Entry Extractor

**File**: `src/utils/sow_extractor.py`

**Function Signature**:
```python
async def extract_sow_entry_to_workspace(
    courseId: str,
    order: int,
    mcp_config_path: str,
    workspace_path: Path
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Extract SOW entry and metadata to workspace files.

    Creates two files in workspace:
    1. sow_entry_input.json: The specific lesson entry at order
    2. sow_context.json: Course-level SOW metadata

    Args:
        courseId: Course identifier
        order: Lesson order in SOW entries
        mcp_config_path: Path to MCP config
        workspace_path: Workspace directory path

    Returns:
        Tuple of (sow_entry_dict, sow_metadata_dict)

    Raises:
        ValueError: If SOW not found or order invalid
    """
    pass
```

**Implementation**:
1. Query `Authored_SOW` collection for courseId
2. Parse entries field (JSON string → list)
3. Find entry where `entry["order"] == order`
4. Extract course-level metadata (coherence, accessibility_notes, engagement_notes)
5. Write `sow_entry_input.json` and `sow_context.json`

---

### 4. Lesson Template Upserter

**File**: `src/utils/lesson_upserter.py`

**Function Signature**:
```python
async def upsert_lesson_template(
    lesson_template_path: str,
    courseId: str,
    order: int,
    execution_id: str,
    mcp_config_path: str
) -> str:
    """Upsert lesson template to Appwrite lesson_templates collection.

    Replicates TypeScript logic from seedAuthoredLesson.ts:
    - Compresses cards field using gzip + base64
    - Queries by (courseId, sow_order) for uniqueness
    - Updates if exists, creates if new

    Args:
        lesson_template_path: Path to lesson_template.json file
        courseId: Course identifier
        order: Lesson order (stored as sow_order)
        execution_id: Unique execution identifier
        mcp_config_path: Path to MCP config

    Returns:
        Document ID (string)

    Raises:
        FileNotFoundError: If lesson_template.json missing
        ValueError: If JSON invalid or schema mismatch
    """
    pass
```

**Key Logic** (ported from TypeScript):
```python
# 1. Load lesson_template.json
template = json.loads(Path(lesson_template_path).read_text())

# 2. Extract and compress cards
cards = template.get("cards", [])
compressed_cards = compress_cards_gzip_base64(cards)

# 3. Query for existing document
existing = await list_appwrite_documents(
    database_id="default",
    collection_id="lesson_templates",
    queries=[
        f'equal("courseId", "{courseId}")',
        f'equal("sow_order", {order})'
    ],
    mcp_config_path=mcp_config_path
)

# 4. Prepare document data
doc_data = {
    "courseId": courseId,
    "sow_order": order,
    "title": template["title"],
    "createdBy": "lesson_author_agent",
    "version": 1,
    "status": "draft",
    "lesson_type": template.get("lesson_type", "teach"),
    "estMinutes": template.get("estMinutes", 50),
    "outcomeRefs": json.dumps(template.get("outcomeRefs", [])),
    "engagement_tags": json.dumps(template.get("engagement_tags", [])),
    "policy": json.dumps(template.get("policy", {})),
    "cards": compressed_cards  # Compressed, not JSON string
}

# 5. Upsert
if existing:
    doc_id = existing[0]["$id"]
    await update_appwrite_document(
        database_id="default",
        collection_id="lesson_templates",
        document_id=doc_id,
        data=doc_data,
        mcp_config_path=mcp_config_path
    )
else:
    doc = await create_appwrite_document(
        database_id="default",
        collection_id="lesson_templates",
        data=doc_data,
        mcp_config_path=mcp_config_path
    )
    doc_id = doc["$id"]

return doc_id
```

**Card Compression** (port from TypeScript):
```python
import gzip
import base64

def compress_cards_gzip_base64(cards: list) -> str:
    """Compress cards using gzip + base64 (port from TypeScript)."""
    cards_json = json.dumps(cards)
    cards_bytes = cards_json.encode('utf-8')
    compressed = gzip.compress(cards_bytes)
    b64_encoded = base64.b64encode(compressed).decode('ascii')
    return b64_encoded

def get_compression_stats(cards: list) -> dict:
    """Calculate compression statistics."""
    original_json = json.dumps(cards)
    compressed = compress_cards_gzip_base64(cards)
    original_size = len(original_json)
    compressed_size = len(compressed)
    ratio = f"{(compressed_size / original_size) * 100:.1f}%"
    savings = f"{((1 - compressed_size / original_size) * 100):.1f}%"
    return {
        "original": original_size,
        "compressed": compressed_size,
        "ratio": ratio,
        "savings": savings
    }
```

---

## Prompt Adaptation Strategy

### Existing LangGraph Prompts

**Source**: `langgraph-author-agent/src/lesson_author_prompts.py`

1. **LESSON_AGENT_PROMPT**: Main lesson authoring agent
2. **COMBINED_LESSON_CRITIC_PROMPT**: Unified critic across 5 dimensions

### Adaptation Requirements

**Remove LangGraph-Specific Instructions**:
- Remove references to DeepAgents
- Remove state management instructions (`state["files"]["<name>"]`)
- Remove LangGraph-specific tool references
- Remove subagent delegation syntax (`@subagent_name`)

**Adapt for Claude Agent SDK**:
- Use filesystem-based file I/O (Read/Write tools)
- Use `research_subagent` delegation (Claude Agent SDK syntax)
- Use `combined_lesson_critic` delegation
- Keep pedagogical guidance unchanged

### New Prompt Files

**1. `src/prompts/lesson_author_prompt.md`**

**Adaptations**:
```markdown
# ORIGINAL (LangGraph)
<outputs>
You MUST write these flat files (state["files"]["<name>"] = <json/string>):
- `lesson_template.json` : Final LessonTemplate
- `critic_result.json`   : Written by Combined Lesson Critic
</outputs>

# ADAPTED (Claude SDK)
<outputs>
You MUST write these flat files using Write tool:
- Write `lesson_template.json` : Final LessonTemplate (valid JSON)
- Critic writes `critic_result.json` : Comprehensive evaluation
</outputs>

# ORIGINAL (LangGraph)
<subagents_available>
- `research_subagent`: Purpose: Answer clarification questions
- `combined_lesson_critic`: Evaluates all quality dimensions
</subagents_available>

# ADAPTED (Claude SDK)
<subagents_available>
Delegate to these subagents using Task tool:
- @research_subagent: Answer clarification questions with Scottish context
- @combined_lesson_critic: Validate lesson across 5 quality dimensions
</subagents_available>
```

**Key Sections to Preserve**:
- `<sow_field_usage>`: How to use SOW entry fields
- `<card_type_transformations>`: SOW card → Lesson card mapping
- `<accessibility_generation>`: Plain language CEFR guidelines
- `<lesson_template_schema>`: Database schema specification
- `<card_design_patterns>`: Lesson type structures
- `<explainer_design_by_lesson_type>`: Type-specific scaffolding
- `<cfu_design_by_lesson_type>`: Type-specific CFU design
- `<misconception_identification>`: Common error patterns
- `<process>`: Step-by-step authoring process
- `<success_criteria>`: Quality benchmarks
- `<constraints>`: Critical validation rules

**2. `src/prompts/lesson_critic_prompt.md`**

**Source**: `COMBINED_LESSON_CRITIC_PROMPT` from LangGraph

**Adaptations**:
```markdown
# ORIGINAL (LangGraph)
<outputs>
Write your comprehensive critique to `critic_result.json` with this shape:
{...}
</outputs>

<tools>
you will not use write_todos tool. You will only use the following tools:
write_file, ls, read_file
</tools>

# ADAPTED (Claude SDK)
<outputs>
Write `critic_result.json` using Write tool with this structure:
{
  "pass": true | false,
  "overall_score": 0.0-1.0,
  "dimensional_scores": {...},
  "dimensional_feedback": {...},
  "feedback": "Overall summary",
  "issues": [...]
}
</outputs>

<tools>
Available tools: Read, Write, Glob, Grep
Do NOT use TodoWrite tool
</tools>
```

**Key Sections to Preserve**:
- `<evaluation_dimensions>`: 6 quality dimensions with scoring formulas
- `<process>`: Evaluation workflow
- `<dimensional_thresholds>`: Pass/fail criteria
- `<examples>`: High-quality vs needs-revision examples

---

## Agent Orchestration Prompt

**Initial Prompt Template** (`_build_initial_prompt()`):

```python
def _build_initial_prompt(
    self,
    courseId: str,
    order: int,
    workspace_path: str,
    sow_entry: Dict[str, Any]
) -> str:
    """Build the initial orchestration prompt for the main agent."""

    return f"""# Lesson Authoring Pipeline - Main Orchestrator

You are orchestrating the autonomous authoring of a Lesson Template for Scottish secondary education.

## Input Specification
- **Course ID**: {courseId}
- **SOW Order**: {order}
- **Lesson**: {sow_entry.get('label', 'N/A')}
- **Type**: {sow_entry.get('lesson_type', 'teach')}
- **Duration**: {sow_entry.get('estMinutes', 50)} minutes

## Workspace
All files will be created in: {workspace_path}

## Pre-Processing (Complete)
✅ `sow_entry_input.json` has been pre-populated by Python extraction (no subagent needed)
   - Source: default.Authored_SOW collection
   - Extracted: Specific lesson entry at order {order}
   - Location: `/workspace/sow_entry_input.json`

✅ `sow_context.json` has been pre-populated by Python extraction (no subagent needed)
   - Source: SOW document metadata
   - Extracted: Course-level coherence, accessibility, engagement notes
   - Location: `/workspace/sow_context.json`

✅ `Course_data.txt` has been pre-populated by Python extraction (no subagent needed)
   - Source: sqa_education.sqa_current collection
   - Extracted: Official SQA course structure, units, outcomes, assessment standards
   - Location: `/workspace/Course_data.txt`

## Pipeline Execution

Execute the following workflow with 3 available subagents:

### 1. Research Subagent (on-demand for additional information)
- **When to Use**: Whenever you need information beyond the pre-loaded files
- **Use Cases**:
  * Scottish pedagogical patterns and teaching approaches
  * Exemplar lesson structures for specific lesson types
  * Common student misconceptions for the subject area
  * Scottish context examples (local services, pricing, places)
  * CfE/SQA policy clarifications and terminology
  * Accessibility best practices (CEFR levels, dyslexia-friendly design)
- **Tools Available**: WebSearch, WebFetch
- **Delegation**: @research_subagent
- **Important**: DO NOT skip research when you need clarity on:
  * How to design cards for a specific lesson_type (e.g., mock_exam structure)
  * Scottish-specific contexts for CFU questions
  * Common misconceptions in the subject domain
  * Pedagogical scaffolding approaches (I-We-You progression)

### 2. Lesson Author (main authoring - YOU)
- **Task**: Author complete LessonTemplate using pre-loaded files + research
- **Pre-loaded Inputs**:
  - `/workspace/sow_entry_input.json` (SOW lesson design with rich pedagogical detail)
  - `/workspace/sow_context.json` (Course-level coherence, accessibility, engagement notes)
  - `/workspace/Course_data.txt` (Official SQA outcomes, assessment standards)
- **Additional Resources**: Use @research_subagent for any gaps
- **Output**: `/workspace/lesson_template.json`
- **Process**:
  1. Read all pre-loaded files
  2. Identify information gaps (exemplars, misconceptions, contexts)
  3. Delegate to @research_subagent for targeted queries
  4. Draft lesson_template.json with comprehensive pedagogical design
  5. Write lesson_template.json to workspace

### 2. Lesson Author Strategy
- **Start with SOW entry**: Extract card structures, worked examples, practice problems
- **Use research_subagent proactively**: Don't guess Scottish contexts or misconceptions
- **Example research queries**:
  * "Find 3 common misconceptions when students learn fractions of amounts"
  * "Suggest authentic Scottish shopping contexts for percentage discount problems"
  * "What is the I-We-You pedagogy progression for teaching mathematics?"
  * "Find exemplar National 5 mock exam question structures"

### 3. Combined Lesson Critic (with retry loop)
- **Task**: Validate lesson across 6 dimensions
- **Inputs**:
  - `/workspace/lesson_template.json` (from step 2)
  - `/workspace/sow_entry_input.json` (pre-loaded)
  - `/workspace/Course_data.txt` (optional validation)
- **Output**: `/workspace/critic_result.json`
- **Delegate to**: @combined_lesson_critic
- **Logic**:
  - If overall_pass = false and attempt < {self.max_critic_retries}:
    - Pass feedback to yourself for revision
    - Revise lesson_template.json
    - Re-run @combined_lesson_critic
  - If overall_pass = true OR max attempts reached: proceed to completion

## Cost Tracking
After each subagent execution, use TodoWrite to log:
- Subagent name
- Token usage (if available)
- Estimated cost

## Final Output
When lesson authoring and critique complete successfully, report completion.
The lesson template will be persisted to Appwrite by the orchestrating system.

Begin pipeline execution now.
"""
```

---

## Database Integration

### Appwrite Collections

**1. Source: `Authored_SOW` Collection**

Query by courseId:
```python
sow_docs = await list_appwrite_documents(
    database_id="default",
    collection_id="Authored_SOW",
    queries=[f'equal("courseId", "{courseId}")'],
    mcp_config_path=mcp_config_path
)
```

Extract entry by order:
```python
entries = json.loads(sow_doc["entries"]) if isinstance(sow_doc["entries"], str) else sow_doc["entries"]
entry = next((e for e in entries if e["order"] == order), None)
if not entry:
    raise ValueError(f"No entry found with order {order}")
```

**2. Target: `lesson_templates` Collection**

Schema:
```python
{
    "courseId": str,              # Course identifier
    "sow_order": int,             # Lesson order (from SOW entry)
    "title": str,                 # Lesson title
    "createdBy": str,             # "lesson_author_agent"
    "version": int,               # Template version
    "status": str,                # "draft" | "published"
    "lesson_type": str,           # "teach" | "independent_practice" | ...
    "estMinutes": int,            # Duration (5-120)
    "outcomeRefs": str,           # JSON array of outcomes + standards
    "engagement_tags": str,       # JSON array of tags
    "policy": str,                # JSON object with calculator_allowed
    "cards": str                  # COMPRESSED (gzip + base64)
}
```

Uniqueness: `(courseId, sow_order)` pair

---

## Error Handling Strategy

### Validation Points

**1. Input Validation** (Pre-processing):
- Course ID must exist in default.courses
- SOW document must exist for courseId
- Order must be valid within entries array

**2. Agent Execution** (Runtime):
- Subagent failures logged and re-attempted
- Critic failures trigger revision loop (max 10 attempts)
- File I/O errors caught and reported

**3. Database Upsertion** (Post-processing):
- JSON validation before upsert
- Schema compliance checks
- Compression errors caught
- Appwrite API errors reported

### Fast-Fail Principles

**NO FALLBACKS** - Always throw exceptions:
```python
# ✅ GOOD - Fast fail with clear error
if not sow_doc:
    raise ValueError(f"No SOW found for courseId '{courseId}'")

# ❌ BAD - Silent fallback (ANTI-PATTERN)
if not sow_doc:
    sow_doc = {}  # Silent failure
```

---

## Testing Strategy

### Unit Tests

**1. SOW Entry Extraction**:
```python
# Test valid extraction
result = await extract_sow_entry_to_workspace(
    courseId="course_c84874",
    order=0,
    mcp_config_path=".mcp.json",
    workspace_path=Path("/tmp/test")
)
assert result[0]["order"] == 0

# Test invalid order
with pytest.raises(ValueError, match="No entry found with order"):
    await extract_sow_entry_to_workspace(
        courseId="course_c84874",
        order=999,
        mcp_config_path=".mcp.json",
        workspace_path=Path("/tmp/test")
    )
```

**2. Lesson Template Upsert**:
```python
# Test compression
cards = [{"id": "c1", "title": "Test Card"}]
compressed = compress_cards_gzip_base64(cards)
assert len(compressed) < len(json.dumps(cards))

# Test upsert logic
doc_id = await upsert_lesson_template(
    lesson_template_path="/tmp/lesson_template.json",
    courseId="course_c84874",
    order=0,
    execution_id="test_123",
    mcp_config_path=".mcp.json"
)
assert doc_id.startswith("lt_")
```

### Integration Tests

**End-to-End Agent Execution**:
```bash
# Test with existing SOW
python -m src.lesson_author_cli \
  --courseId course_c84874 \
  --order 0 \
  --log-level DEBUG

# Verify output
assert lesson_templates collection has new document
assert document has compressed cards
assert document has correct sow_order
assert research_subagent was called for additional information
```

---

## Cost Optimization

### Token Reduction Strategies

**1. Python Pre-processing** (0 tokens):
- SOW entry extraction
- Course data extraction
- File preparation

**2. On-demand Research** (targeted tokens):
- Only use research_subagent when needed
- Specific queries vs broad exploration
- Cache research results in workspace

**3. Python Post-processing** (0 tokens):
- Deterministic upsert logic
- Compression algorithm
- Database operations

### Estimated Token Usage

| Stage                    | Tokens (Estimate) | Notes                          |
|--------------------------|-------------------|--------------------------------|
| Pre-processing           | 0                 | Python-only                    |
| Research (if used)       | 5,000-10,000      | On-demand, not always needed   |
| Lesson Author            | 20,000-40,000     | Main authoring + SOW content   |
| Lesson Critic (per pass) | 10,000-15,000     | Comprehensive evaluation       |
| Post-processing          | 0                 | Python-only                    |
| **Total (no research)**  | **30,000-55,000** | Per lesson                     |
| **Total (with research)**| **35,000-65,000** | Per lesson with clarifications |

**Comparison to LangGraph**:
- LangGraph: ~50,000-80,000 tokens (includes state management overhead)
- Claude SDK: ~30,000-65,000 tokens (38-52% reduction)

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `lesson_author_claude_client.py` with class skeleton
- [ ] Create `lesson_author_cli.py` with argument parsing
- [ ] Create `sow_extractor.py` utility
- [ ] Create `lesson_upserter.py` utility with compression
- [ ] Test SOW extraction with existing courses
- [ ] Test compression/decompression roundtrip

### Phase 2: Prompt Adaptation
- [ ] Adapt `lesson_author_prompt.md` for Claude SDK
- [ ] Adapt `lesson_critic_prompt.md` for Claude SDK
- [ ] Copy `research_subagent_prompt.md` (reuse existing)
- [ ] Test prompts with mock workspace files
- [ ] Validate prompt length and complexity

### Phase 3: Agent Integration
- [ ] Implement `_get_subagent_definitions()`
- [ ] Implement `_build_initial_prompt()`
- [ ] Implement main agent orchestration loop
- [ ] Implement critic retry logic
- [ ] Test with single lesson (order 0)

### Phase 4: Database Integration
- [ ] Implement lesson template upserter
- [ ] Test upsert with mock data
- [ ] Test update existing lesson
- [ ] Verify compression in database
- [ ] Test card decompression on read

### Phase 5: End-to-End Testing
- [ ] Test full pipeline: SOW → Agent → Database
- [ ] Test with multiple lesson types (teach, independent_practice, formative_assessment)
- [ ] Test research_subagent invocation (verify it's called for information gaps)
- [ ] Test critic retry loop (force initial failure)
- [ ] Verify cost tracking accuracy

### Phase 6: Production Readiness
- [ ] Add comprehensive logging
- [ ] Add error recovery mechanisms
- [ ] Add workspace persistence option
- [ ] Add CLI help documentation
- [ ] Add example input files
- [ ] Update main README with usage examples

---

## Success Criteria

### Functional Requirements
- ✅ Agent generates valid LessonTemplate matching schema
- ✅ Agent handles all lesson types (teach, independent_practice, formative_assessment, revision, mock_exam)
- ✅ Agent validates across 6 quality dimensions (score ≥0.88)
- ✅ Upsert correctly handles create vs update logic
- ✅ Cards field compressed using gzip + base64
- ✅ All input validation fast-fails with clear errors

### Non-Functional Requirements
- ✅ Token usage: 30,000-65,000 per lesson (competitive with LangGraph)
- ✅ Execution time: 2-5 minutes per lesson (comparable to LangGraph)
- ✅ Cost: $0.50-$1.50 per lesson at Claude Sonnet 4.5 pricing
- ✅ Workspace persistence for debugging
- ✅ Comprehensive logging to files

### Quality Requirements
- ✅ Pedagogical fidelity: SOW card transformations preserved
- ✅ Scottish authenticity: £ currency, SQA terminology, local contexts
- ✅ Accessibility: CEFR-compliant plain language
- ✅ Coherence: Outcome mapping, timing, policy alignment
- ✅ Assessment design: CFU variety, rubrics, misconceptions

---

## Future Enhancements

### Phase 2: Batch Processing
- [ ] Batch lesson generation for entire SOW
- [ ] Parallel processing for independent lessons
- [ ] Progress tracking and resume capability

### Phase 3: Quality Improvements
- [ ] Integration with LangSmith for tracing
- [ ] A/B testing different model versions
- [ ] Human-in-the-loop review workflow

### Phase 4: Advanced Features
- [ ] Adaptive lesson generation based on student performance
- [ ] Multi-language support (Gaelic, Polish)
- [ ] Lesson template versioning and history

---

## References

### Source Files
- SOW Author: `claud_author_agent/src/sow_author_claude_client.py`
- SOW CLI: `claud_author_agent/src/sow_author_cli.py`
- LangGraph Lesson Author: `langgraph-author-agent/src/lesson_author_agent.py`
- LangGraph Prompts: `langgraph-author-agent/src/lesson_author_prompts.py`
- Seeding Script: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

### Documentation
- Claude Agent SDK: https://github.com/anthropics/claude-agent-sdk
- LangGraph: https://langchain-ai.github.io/langgraph/
- Appwrite: https://appwrite.io/docs

---

## Appendix A: Key Differences from SOW Author

| Aspect                  | SOW Author                              | Lesson Author                          |
|-------------------------|-----------------------------------------|----------------------------------------|
| **Input Source**        | Subject + Level + courseId              | courseId + order                       |
| **Input Data**          | SQA course data (structured)            | SOW entry (rich pedagogical design)    |
| **Pre-processing**      | Course data extraction                  | SOW entry + Course data + metadata     |
| **Subagents**           | 2 (SOW Author, Unified Critic)          | 3 (Research, Lesson Author, Critic)    |
| **Output Schema**       | Authored_SOW (entries array)            | lesson_templates (compressed cards)    |
| **Compression**         | None (JSON string)                      | gzip + base64 (cards field)            |
| **Research**            | On-demand WebSearch/WebFetch            | Research subagent + WebSearch/WebFetch |
| **Validation**          | 5 dimensions                            | 6 dimensions (+ SOW fidelity)          |
| **Token Usage**         | 50,000-80,000 per SOW                   | 30,000-65,000 per lesson               |
| **Uniqueness**          | (courseId) single doc                   | (courseId, sow_order) pair             |

---

## Appendix B: Prompt Comparison Matrix

| Prompt Section                     | LangGraph Version                       | Claude SDK Adaptation                  |
|------------------------------------|-----------------------------------------|----------------------------------------|
| `<role>`                           | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<inputs>`                         | ✅ Keep structure                       | 🔄 Adapt file access syntax            |
| `<sow_field_usage>`                | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<card_type_transformations>`      | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<accessibility_generation>`       | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<outputs>`                        | 🔄 `state["files"]` syntax              | 🔄 Write tool syntax                   |
| `<tools>`                          | 🔄 LangGraph-specific tools             | 🔄 Claude SDK tools (Read/Write/etc)   |
| `<subagents_available>`            | 🔄 DeepAgents delegation syntax         | 🔄 Task tool delegation syntax         |
| `<tools_available>`                | ✅ Keep Tavily + Appwrite MCP           | ✅ Keep WebSearch/WebFetch + Appwrite  |
| `<lesson_template_schema>`         | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<card_design_patterns>`           | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<explainer_design_by_lesson_type>`| ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<cfu_design_by_lesson_type>`      | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<misconception_identification>`   | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<process>`                        | 🔄 Adapt file I/O references            | 🔄 Adapt to filesystem-based I/O       |
| `<success_criteria>`               | ✅ Keep unchanged                       | ✅ Keep unchanged                      |
| `<constraints>`                    | ✅ Keep unchanged                       | ✅ Keep unchanged                      |

**Legend**:
- ✅ Keep unchanged: Copy directly from LangGraph
- 🔄 Adapt: Modify syntax/references for Claude SDK

---

## Appendix C: Database Schema Comparison

### TypeScript (seedAuthoredLesson.ts)
```typescript
const docData = {
  courseId,
  sow_order: sowOrder,
  title: template.title,
  createdBy: 'lesson_author_agent',
  version: 1,
  status: 'draft',
  lesson_type: template.lesson_type || 'teach',
  estMinutes: template.estMinutes || 50,
  outcomeRefs: JSON.stringify(template.outcomeRefs || []),
  engagement_tags: JSON.stringify(template.engagement_tags || []),
  policy: JSON.stringify(template.policy || {}),
  cards: compressedCards  // Compressed, not JSON string
};
```

### Python (lesson_upserter.py)
```python
doc_data = {
    "courseId": courseId,
    "sow_order": order,
    "title": template["title"],
    "createdBy": "lesson_author_agent",
    "version": 1,
    "status": "draft",
    "lesson_type": template.get("lesson_type", "teach"),
    "estMinutes": template.get("estMinutes", 50),
    "outcomeRefs": json.dumps(template.get("outcomeRefs", [])),
    "engagement_tags": json.dumps(template.get("engagement_tags", [])),
    "policy": json.dumps(template.get("policy", {})),
    "cards": compressed_cards  # Compressed, not JSON string
}
```

**Exact field mapping preserved** for database compatibility.

---

## Document Version History

- **v1.1** (2025-10-16): Removed research_pack.json dependency
  - Removed research_pack.json as input file
  - Removed research_pack_path CLI parameter
  - Strengthened research_subagent prompting with use cases
  - Added example research queries for common scenarios
  - Updated validation to remove research pack checks

- **v1.0** (2025-10-16): Initial specification
  - Architecture overview
  - File structure
  - Component specifications
  - Prompt adaptation strategy
  - Database integration
  - Implementation checklist

---

**END OF SPECIFICATION**
