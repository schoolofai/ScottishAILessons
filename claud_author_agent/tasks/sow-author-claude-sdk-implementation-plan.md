# SOW Author Implementation Plan - Claude Agent SDK

**Created:** 2025-10-15
**Status:** Planning
**Target:** Replicate LangGraph SOW author functionality using Claude Agent SDK

---

## Executive Summary

Implement a SOW (Scheme of Work) author agent using Claude Agent SDK that:
- Takes `{subject, level}` as input (matching `sqa_education.current_sqa` format)
- Generates research pack via research subagent
- Extracts SQA course data via Appwrite MCP
- Authors complete SOW following Scottish curriculum standards
- Validates via unified critic
- Upserts to Appwrite database via MCP

**Key Difference from LangGraph Version:** Fully autonomous pipeline from subject/level → authored SOW in database (no external file dependencies).

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOW Author Claude Client                      │
│                      (Main Orchestrator)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │  Isolated Filesystem  │
                │   /workspace/         │
                │   ├── research/       │
                │   ├── course_data/    │
                │   ├── authored/       │
                │   └── output/         │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Research    │    │ Course Data  │    │ SOW Author   │
│  Subagent    │───▶│  Extractor   │───▶│  Subagent    │
│              │    │  Subagent    │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │   Unified    │
                                        │   Critic     │
                                        │   Subagent   │
                                        └──────┬───────┘
                                               │
                                        [Pass? ├─No──▶ Retry
                                               │       (max 3)
                                               ├─Yes
                                               ▼
                                        ┌──────────────┐
                                        │   Upserter   │
                                        │   Subagent   │
                                        │  (Appwrite)  │
                                        └──────────────┘
```

### 1.2 Key Design Principles

1. **Filesystem-Based Context Engineering**: Each subagent reads/writes files in shared workspace to offload context
2. **Fail-Fast Validation**: Check prerequisites before execution (MCP connectivity, input schema)
3. **Comprehensive Logging**: Track execution at each stage with timestamps and costs
4. **Todo Tracking**: Use SDK TodoWrite for progress monitoring
5. **Workspace Persistence**: Keep files for debugging (controlled by flag)
6. **Cost Transparency**: Report token usage and costs per subagent

---

## 2. Input/Output Specification

### 2.1 Input Schema

```json
{
  "subject": "application_of_mathematics",
  "level": "national_3"
}
```

**Format Rules:**
- Subject: underscore-separated, matches `sqa_education.current_sqa.subject`
- Level: underscore-separated, matches `sqa_education.current_sqa.level`
- Example conversions:
  - `"Application of Mathematics"` → `"application_of_mathematics"`
  - `"National 3"` → `"national_3"`

### 2.2 Output Schema

```json
{
  "execution_id": "abc12345",
  "session_id": "session_xyz",
  "result": "success",
  "sow_document_id": "67890abc",
  "workspace": "/tmp/agent_abc12345_xyz/",
  "files": {
    "research_pack": "/workspace/research/research_pack_json",
    "course_data": "/workspace/course_data/Course_data.txt",
    "authored_sow": "/workspace/authored/authored_sow_json",
    "critic_result": "/workspace/authored/sow_critic_result_json"
  },
  "metrics": {
    "total_cost_usd": 0.45,
    "message_count": 23,
    "execution_time_sec": 125.3,
    "subagent_costs": {
      "research": 0.12,
      "course_data_extractor": 0.03,
      "sow_author": 0.20,
      "unified_critic": 0.08,
      "upserter": 0.02
    }
  },
  "todos": [
    {"content": "Research Scottish contexts", "status": "completed"},
    {"content": "Extract SQA course data", "status": "completed"},
    {"content": "Author SOW", "status": "completed"},
    {"content": "Validate with critic", "status": "completed"},
    {"content": "Upsert to Appwrite", "status": "completed"}
  ]
}
```

---

## 3. Subagent Definitions

### 3.1 Research Subagent

**Role:** Create comprehensive research pack for Scottish curriculum

**Input:**
- Subject (e.g., "application_of_mathematics")
- Level (e.g., "national_3")

**Output:**
- `research_pack_json` (v3 schema)

**Tools:**
- `WebSearch` (for Scottish curriculum resources)
- `Write` (to create research pack file)
- `TodoWrite` (progress tracking)

**Prompt Summary:**
```markdown
You are a Scottish education research specialist. Create a research pack v3 for {subject} at {level}.

Research:
1. Scottish curriculum frameworks (CfE)
2. Pedagogical patterns for this level
3. Common misconceptions
4. Scottish context hooks (£, NHS, local services)
5. Assessment stems matching SQA style
6. Accessibility strategies

Output to: /workspace/research/research_pack_json

Schema: research_pack_schema v3 (exemplars, distilled_data, guidance, citations)
```

**Success Criteria:**
- Valid research_pack_json file created
- All required fields present (v3 schema)
- At least 5 exemplars with sources
- Scottish contexts identified
- Pedagogical patterns documented

---

### 3.2 Course Data Extractor Subagent

**Role:** Fetch official SQA course data from Appwrite database

**Input:**
- Subject (normalized format)
- Level (normalized format)

**Output:**
- `Course_data.txt` (SQA course specification)

**Tools:**
- `mcp__appwrite__databases_list_documents`
- `Write`
- `TodoWrite`

**Prompt Summary:**
```markdown
You are a database specialist extracting SQA course data.

Task:
1. Query sqa_education database, current_sqa collection
2. Filters: subject={subject}, level={level}
3. Extract: course structure, units, outcomes, assessment standards
4. Format as readable text with full descriptions
5. Write to: /workspace/course_data/Course_data.txt

Handle edge cases:
- No matching documents → throw error
- Multiple documents → select most recent
- Missing fields → validate required fields present
```

**Success Criteria:**
- Course_data.txt file created
- Contains: course name, units, outcomes, assessment standards
- All descriptions fully extracted (not truncated)
- File readable by SOW author

---

### 3.3 SOW Author Subagent

**Role:** Author complete Scheme of Work following Scottish standards

**Input:**
- `research_pack_json` (from research subagent)
- `Course_data.txt` (from course data extractor)

**Output:**
- `authored_sow_json` (complete SOW)

**Tools:**
- `Read`
- `Write`
- `TodoWrite`

**Prompt:**
- Use `SOW_UNIFIED_AGENT_PROMPT` from `langgraph-author-agent/src/sow_author_prompts.py`
- Adapt for Claude SDK (remove LangGraph-specific references)

**Key Requirements:**
1. Read both input files first
2. Apply chunking strategy (2-3 standards per lesson)
3. Generate 10-20 lessons total
4. Each lesson has detailed lesson_plan with 6-12 cards
5. Enrich assessmentStandardRefs with full descriptions
6. Use Scottish contexts throughout
7. Follow mandatory teach→revision pairing
8. Include course-level requirements (independent_practice, mock_assessment)

**Success Criteria:**
- Valid authored_sow_json created
- Schema compliance (metadata, entries with all required fields)
- Lesson plans detailed (not generic)
- Enriched assessment standard references
- Scottish authenticity maintained

---

### 3.4 Unified Critic Subagent

**Role:** Validate SOW across all dimensions

**Input:**
- `authored_sow_json`
- `research_pack_json`
- `Course_data.txt`

**Output:**
- `sow_critic_result_json`

**Tools:**
- `Read`
- `Write`
- `TodoWrite`

**Prompt:**
- Use `SOW_UNIFIED_CRITIC_PROMPT` from `langgraph-author-agent/src/sow_author_prompts.py`

**Validation Dimensions:**
1. **Coverage** (≥0.90): All standards covered, lesson plans detailed
2. **Sequencing** (≥0.80): Logical order, teach→revision pairing
3. **Policy** (≥0.80): Calculator usage, timing alignment
4. **Accessibility** (≥0.90): Profile completeness, plain language
5. **Authenticity** (≥0.90): Scottish contexts, SQA terminology

**Success Criteria:**
- Valid sow_critic_result_json created
- All 5 dimensions scored
- Overall pass/fail determined
- Specific issues flagged with file locations
- Prioritized todos if failing

---

### 3.5 Upserter Subagent

**Role:** Write final SOW to Appwrite database

**Input:**
- `authored_sow_json` (validated by critic)
- Subject + level (for version determination)

**Output:**
- Appwrite document ID

**Tools:**
- `mcp__appwrite__databases_list_documents` (for version check)
- `mcp__appwrite__databases_upsert_document`
- `TodoWrite`

**Prompt Summary:**
```markdown
You are a database operations specialist.

Task:
1. Read authored_sow_json
2. Determine version:
   - Query default.Authored_SOW for existing versions with this subject/level
   - If none: version = "1.0"
   - If exists: increment minor version (1.0 → 1.1)
3. Enrich metadata:
   - Add courseId (derive from subject/level or query courses collection)
   - Add version
   - Add status: "draft"
   - Add generated_at timestamp
   - Add author_agent_version: "claude-sdk-1.0"
4. Upsert to default.Authored_SOW
5. Return document ID

Handle errors:
- Database connectivity issues
- Schema validation failures
- Duplicate key conflicts
```

**Success Criteria:**
- Document successfully created/updated in Appwrite
- Version correctly determined
- All metadata enriched
- Document ID returned

---

## 4. Implementation Pseudo-Code

### 4.1 Main Agent Class

```python
class SOWAuthorClaudeAgent:
    """
    SOW Author agent using Claude Agent SDK.

    Orchestrates 5 subagents to create publishable SOW from subject/level.
    """

    def __init__(
        self,
        mcp_config_path: Optional[str] = None,
        persist_workspace: bool = True,
        max_critic_retries: int = 3
    ):
        """Initialize agent with configuration.

        Args:
            mcp_config_path: Path to .mcp.json (defaults to project root)
            persist_workspace: Keep workspace files after execution
            max_critic_retries: Maximum retries if critic fails
        """
        self.execution_id = generate_execution_id()
        self.persist_workspace = persist_workspace
        self.max_critic_retries = max_critic_retries

        # Load MCP config for Appwrite tools
        self.mcp_config = load_mcp_config(mcp_config_path)

        # Initialize tracking
        self.filesystem: Optional[IsolatedFilesystem] = None
        self.session_id: Optional[str] = None
        self.current_todos: List[Dict[str, Any]] = []
        self.subagent_costs: Dict[str, float] = {}
        self.total_cost: float = 0.0
        self.message_count: int = 0

        logger.info(f"Initialized SOWAuthorClaudeAgent: {self.execution_id}")


    def _get_system_prompt(self) -> str:
        """Get main orchestrator system prompt."""
        return f'''You are the SOW Author Orchestrator.

Your job is to coordinate 5 specialized subagents to create a complete,
validated Scheme of Work (SOW) for Scottish secondary education.

**Execution Context:**
- Execution ID: {self.execution_id}
- Workspace: {self.filesystem.root}

**Available Subagents:**
1. research_subagent - Creates research pack from web research
2. course_data_extractor - Fetches SQA data from Appwrite
3. sow_author - Authors complete SOW
4. unified_critic - Validates SOW across 5 dimensions
5. upserter - Writes final SOW to Appwrite database

**Your Responsibilities:**
1. Validate input format (subject, level)
2. Track progress using TodoWrite
3. Delegate to subagents in sequence
4. Handle critic failures (retry up to {self.max_critic_retries} times)
5. Ensure final output in database
6. Report comprehensive metrics

**Workflow:**
1. Validate input → create todo list
2. Delegate to research_subagent → get research_pack_json
3. Delegate to course_data_extractor → get Course_data.txt
4. Delegate to sow_author → get authored_sow_json
5. Delegate to unified_critic → get sow_critic_result_json
6. If critic passes → delegate to upserter → get document ID
7. If critic fails → revise via sow_author (max retries)
8. Report final results

Use TodoWrite to track each major step.
'''


    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Define all 5 specialized subagents."""

        return {
            'research_subagent': AgentDefinition(
                description='Creates comprehensive research pack for Scottish curriculum',
                prompt=load_prompt('research_subagent_prompt.md'),
                tools=['WebSearch', 'Write', 'TodoWrite'],
                model='sonnet'
            ),

            'course_data_extractor': AgentDefinition(
                description='Fetches official SQA course data from Appwrite database',
                prompt=load_prompt('course_data_extractor_prompt.md'),
                tools=[
                    'Read',
                    'Write',
                    'TodoWrite',
                    'mcp__appwrite__databases_list_documents'
                ],
                model='sonnet'
            ),

            'sow_author': AgentDefinition(
                description='Authors complete Scheme of Work following Scottish standards',
                prompt=load_prompt('sow_author_prompt.md'),  # Adapted from LangGraph version
                tools=['Read', 'Write', 'TodoWrite'],
                model='sonnet'
            ),

            'unified_critic': AgentDefinition(
                description='Validates SOW across Coverage, Sequencing, Policy, Accessibility, Authenticity',
                prompt=load_prompt('unified_critic_prompt.md'),  # Adapted from LangGraph version
                tools=['Read', 'Write', 'TodoWrite'],
                model='sonnet'
            ),

            'upserter': AgentDefinition(
                description='Writes final validated SOW to Appwrite database',
                prompt=load_prompt('upserter_subagent_prompt.md'),
                tools=[
                    'Read',
                    'Write',
                    'TodoWrite',
                    'mcp__appwrite__databases_list_documents',
                    'mcp__appwrite__databases_upsert_document'
                ],
                model='sonnet'
            )
        }


    async def execute(
        self,
        subject: str,
        level: str,
        max_turns: int = 100
    ) -> Dict[str, Any]:
        """
        Execute SOW authoring pipeline.

        Args:
            subject: SQA subject (e.g., "application_of_mathematics")
            level: SQA level (e.g., "national_3")
            max_turns: Maximum conversation turns

        Returns:
            Execution results with workspace, costs, document ID
        """

        logger.info("=" * 80)
        logger.info("Starting SOW Author Execution (Claude SDK)")
        logger.info("=" * 80)
        logger.info(f"Subject: {subject}")
        logger.info(f"Level: {level}")

        # Validate input format
        validate_input_schema(subject, level)

        # Create isolated workspace
        with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace) as filesystem:
            self.filesystem = filesystem

            logger.info(f"Workspace: {filesystem.root}")

            # Configure agent options
            options = ClaudeAgentOptions(
                model='claude-sonnet-4-5',
                max_turns=max_turns,
                system_prompt=self._get_system_prompt(),
                agents=self._get_subagent_definitions(),
                allowed_tools=[
                    'Task',  # For delegating to subagents
                    'Read', 'Write', 'TodoWrite'
                ],
                permission_mode='acceptEdits',
                continue_conversation=True,
                mcp_servers=self.mcp_config,
                cwd=str(filesystem.root)
            )

            # Create ClaudeSDKClient
            client = ClaudeSDKClient(options=options)

            try:
                async with client:
                    await client.connect()
                    logger.info("✓ Connected to Claude")

                    # Send initial task
                    initial_prompt = f"""
Author a complete Scheme of Work for Scottish secondary education.

Input:
- Subject: {subject}
- Level: {level}

Workflow:
1. Use research_subagent to create research pack
2. Use course_data_extractor to fetch SQA course data
3. Use sow_author to author complete SOW
4. Use unified_critic to validate
5. If critic passes, use upserter to save to database
6. If critic fails, retry sow_author (max {self.max_critic_retries} attempts)

Track progress with TodoWrite at each major step.
"""

                    await client.query(initial_prompt)
                    logger.info("✓ Task submitted")

                    # Process messages
                    async for message in client.receive_messages():
                        self._process_message(message)

                        if isinstance(message, ResultMessage):
                            if message.subtype == "success":
                                logger.info("✓ Execution completed successfully")

                                # Extract results
                                result = self._extract_results(
                                    message,
                                    filesystem,
                                    subject,
                                    level
                                )

                                logger.info("=" * 80)
                                return result
                            else:
                                logger.error(f"✗ Execution failed: {message.result}")
                                raise Exception(f"Agent execution failed: {message.result}")

            except Exception as e:
                logger.error(f"✗ Error during execution: {e}")
                raise


    def _process_message(self, message: Any) -> None:
        """Process messages and track metrics."""
        self.message_count += 1

        # Track session ID
        if isinstance(message, SystemMessage):
            if hasattr(message, 'subtype') and message.subtype == "init":
                if hasattr(message, 'data') and 'session_id' in message.data:
                    self.session_id = message.data['session_id']
                    logger.info(f"Session: {self.session_id}")

        # Track todos
        if isinstance(message, AssistantMessage):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'type') and block.type == 'tool_use':
                        if hasattr(block, 'name') and block.name == 'TodoWrite':
                            if hasattr(block, 'input'):
                                self.current_todos = block.input.get('todos', [])
                                log_todo_progress(self.current_todos)

            # Track costs
            if hasattr(message, 'usage') and message.usage:
                usage = message.usage
                cost = (usage.get('total_cost_usd', 0.0)
                       if isinstance(usage, dict)
                       else getattr(usage, 'total_cost_usd', 0.0))
                self.total_cost += cost
                logger.debug(f"Message cost: ${cost:.4f} | Total: ${self.total_cost:.4f}")


    def _extract_results(
        self,
        message: ResultMessage,
        filesystem: IsolatedFilesystem,
        subject: str,
        level: str
    ) -> Dict[str, Any]:
        """Extract final results from execution."""

        # Read final files
        research_pack = read_json_file(filesystem.research_dir / "research_pack_json")
        course_data = read_text_file(filesystem.root / "course_data" / "Course_data.txt")
        authored_sow = read_json_file(filesystem.root / "authored" / "authored_sow_json")
        critic_result = read_json_file(filesystem.root / "authored" / "sow_critic_result_json")

        # Extract document ID from upserter result
        sow_document_id = extract_document_id_from_result(message.result)

        return {
            "execution_id": self.execution_id,
            "session_id": self.session_id,
            "result": "success",
            "sow_document_id": sow_document_id,
            "workspace": str(filesystem.root),
            "files": {
                "research_pack": str(filesystem.research_dir / "research_pack_json"),
                "course_data": str(filesystem.root / "course_data" / "Course_data.txt"),
                "authored_sow": str(filesystem.root / "authored" / "authored_sow_json"),
                "critic_result": str(filesystem.root / "authored" / "sow_critic_result_json")
            },
            "metrics": {
                "total_cost_usd": self.total_cost,
                "message_count": self.message_count,
                "execution_time_sec": calculate_execution_time(),
                "subagent_costs": self.subagent_costs
            },
            "todos": self.current_todos,
            "input": {
                "subject": subject,
                "level": level
            }
        }


async def main():
    """Example usage of SOW Author Claude Agent."""

    # Initialize agent
    agent = SOWAuthorClaudeAgent(
        persist_workspace=True,
        max_critic_retries=3
    )

    # Execute with subject/level
    result = await agent.execute(
        subject="application_of_mathematics",
        level="national_3",
        max_turns=100
    )

    # Display results
    print("\n" + "=" * 80)
    print("EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Execution ID: {result['execution_id']}")
    print(f"Session ID: {result['session_id']}")
    print(f"SOW Document ID: {result['sow_document_id']}")
    print(f"Workspace: {result['workspace']}")
    print(f"Total Cost: ${result['metrics']['total_cost_usd']:.4f}")
    print(f"Messages: {result['metrics']['message_count']}")
    print(f"Execution Time: {result['metrics']['execution_time_sec']:.1f}s")
    print("\nTodos:")
    for todo in result['todos']:
        status_icon = "✓" if todo['status'] == 'completed' else "○"
        print(f"  {status_icon} [{todo['status']}] {todo['content']}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
```

### 4.2 IsolatedFilesystem Class

```python
class IsolatedFilesystem:
    """
    Isolated workspace for SOW authoring execution.

    Directory structure:
    /workspace/
        ├── research/
        │   └── research_pack_json
        ├── course_data/
        │   └── Course_data.txt
        ├── authored/
        │   ├── authored_sow_json
        │   └── sow_critic_result_json
        └── output/
            └── RESULT.md
    """

    def __init__(self, execution_id: str, persist: bool = True):
        self.execution_id = execution_id
        self.persist = persist
        self.root = Path(tempfile.mkdtemp(prefix=f"sow_author_{execution_id}_"))

        # Create subdirectories
        self.research_dir = self.root / "research"
        self.course_data_dir = self.root / "course_data"
        self.authored_dir = self.root / "authored"
        self.output_dir = self.root / "output"

        logger.info(f"[IsolatedFS] Created workspace: {self.root}")
        logger.info(f"[IsolatedFS] Persistence: {'Enabled' if persist else 'Disabled'}")

    def setup(self) -> None:
        """Create directory structure and README."""
        for dir_path in [self.research_dir, self.course_data_dir,
                        self.authored_dir, self.output_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"[IsolatedFS] Created: {dir_path.name}/")

        # Write README
        readme = f"""# SOW Author Workspace

Execution ID: {self.execution_id}
Created: {datetime.now().isoformat()}

## Directory Structure

- `/research/` - Research pack from research_subagent
- `/course_data/` - SQA course data from course_data_extractor
- `/authored/` - Authored SOW and critic results
- `/output/` - Final execution summary

## Workflow

1. research_subagent → research/research_pack_json
2. course_data_extractor → course_data/Course_data.txt
3. sow_author → authored/authored_sow_json
4. unified_critic → authored/sow_critic_result_json
5. upserter → Appwrite database

All subagents share this workspace for context engineering.
"""
        (self.root / "README.md").write_text(readme)
        logger.info(f"[IsolatedFS] ✓ Workspace setup complete")

    def cleanup(self) -> None:
        """Remove workspace (only if persist is False)."""
        if not self.persist:
            if self.root.exists():
                shutil.rmtree(self.root)
                logger.info(f"[IsolatedFS] ✓ Workspace cleaned up")
        else:
            logger.info(f"[IsolatedFS] ✓ Workspace persisted at: {self.root}")

    def __enter__(self):
        self.setup()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()
```

---

## 5. Prompt Adaptation Strategy

### 5.1 Reuse from LangGraph Version

**Prompts to Adapt:**
1. `SOW_UNIFIED_AGENT_PROMPT` → `sow_author_prompt.md`
2. `SOW_UNIFIED_CRITIC_PROMPT` → `unified_critic_prompt.md`

**Adaptation Required:**
- Remove LangGraph-specific references (e.g., `state["files"]`)
- Update to filesystem-based instructions (e.g., "Read from /workspace/...")
- Remove mentions of deepagents or LangGraph
- Keep all pedagogical content, schema references, constraints intact

### 5.2 New Prompts to Create

1. **research_subagent_prompt.md**
   - Role: Scottish curriculum researcher
   - Task: Create research pack v3
   - Output: research_pack_json in /workspace/research/

2. **course_data_extractor_prompt.md**
   - Role: Database specialist
   - Task: Query Appwrite for SQA course data
   - Output: Course_data.txt in /workspace/course_data/

3. **upserter_subagent_prompt.md**
   - Role: Database operations specialist
   - Task: Upsert to Appwrite default.Authored_SOW
   - Output: Document ID

---

## 6. Error Handling Strategy

### 6.1 Input Validation

```python
def validate_input_schema(subject: str, level: str) -> None:
    """
    Validate input format matches sqa_education.current_sqa schema.

    Raises:
        ValueError: If format invalid
    """
    # Check format (underscores, lowercase)
    if not re.match(r'^[a-z_]+$', subject):
        raise ValueError(f"Invalid subject format: {subject}. Use lowercase with underscores.")

    if not re.match(r'^[a-z_0-9]+$', level):
        raise ValueError(f"Invalid level format: {level}. Use lowercase with underscores.")

    # Check against known subjects/levels (optional)
    valid_subjects = [
        "application_of_mathematics",
        "mathematics",
        "applications_of_mathematics"
    ]
    valid_levels = [
        "national_3",
        "national_4",
        "national_5",
        "higher",
        "advanced_higher"
    ]

    if subject not in valid_subjects:
        logger.warning(f"Subject '{subject}' not in known subjects: {valid_subjects}")

    if level not in valid_levels:
        logger.warning(f"Level '{level}' not in known levels: {valid_levels}")

    logger.info(f"✓ Input validation passed: {subject} / {level}")
```

### 6.2 MCP Connectivity Check

```python
async def check_mcp_connectivity(mcp_config: Dict[str, Any]) -> None:
    """
    Verify MCP servers are accessible before execution.

    Raises:
        ConnectionError: If MCP servers unreachable
    """
    logger.info("Checking MCP connectivity...")

    # Check if appwrite MCP configured
    if 'appwrite' not in mcp_config:
        raise ConnectionError("Appwrite MCP server not configured in .mcp.json")

    # Test connectivity (optional - depends on MCP implementation)
    # Could attempt a simple list databases call

    logger.info("✓ MCP connectivity verified")
```

### 6.3 Critic Retry Logic

```python
async def handle_critic_failure(
    client: ClaudeSDKClient,
    attempt: int,
    max_attempts: int,
    critic_result: Dict[str, Any]
) -> bool:
    """
    Handle critic failure with retry logic.

    Args:
        client: ClaudeSDKClient instance
        attempt: Current attempt number
        max_attempts: Maximum retries allowed
        critic_result: Critic validation result

    Returns:
        True if should retry, False if max attempts reached
    """
    if attempt >= max_attempts:
        logger.error(f"✗ Critic failed after {max_attempts} attempts")
        return False

    logger.warning(f"⚠️  Critic failed on attempt {attempt}/{max_attempts}")
    logger.info(f"Critic score: {critic_result['overall_score']:.2f}")

    # Log specific dimension failures
    for dim_name, dim_result in critic_result['dimensions'].items():
        if not dim_result['pass']:
            logger.warning(f"  ✗ {dim_name}: {dim_result['score']:.2f} (threshold: {dim_result['threshold']})")
            for issue in dim_result['issues'][:3]:  # Show top 3 issues
                logger.warning(f"    - {issue}")

    # Prepare retry prompt with critic feedback
    retry_prompt = f"""
The unified_critic has identified issues with the authored SOW.

Critic Result:
- Overall Score: {critic_result['overall_score']:.2f}
- Pass: {critic_result['pass']}

Failed Dimensions:
{format_failed_dimensions(critic_result['dimensions'])}

Please:
1. Read the critic result from /workspace/authored/sow_critic_result_json
2. Use sow_author subagent to revise the SOW addressing all issues
3. Use unified_critic subagent to re-validate

This is attempt {attempt + 1}/{max_attempts}.
"""

    await client.query(retry_prompt)
    return True
```

### 6.4 File Validation

```python
def validate_file_exists(file_path: Path, file_description: str) -> None:
    """
    Validate required file exists.

    Raises:
        FileNotFoundError: If file missing
    """
    if not file_path.exists():
        raise FileNotFoundError(f"{file_description} not found at {file_path}")

    if file_path.stat().st_size == 0:
        raise ValueError(f"{file_description} is empty at {file_path}")

    logger.info(f"✓ {file_description} validated: {file_path}")
```

---

## 7. Cost & Performance Tracking

### 7.1 Per-Subagent Cost Tracking

```python
def track_subagent_cost(
    subagent_name: str,
    usage: Union[Dict[str, Any], Any]
) -> float:
    """
    Track cost per subagent execution.

    Args:
        subagent_name: Name of subagent (e.g., "research_subagent")
        usage: Usage metrics from message

    Returns:
        Cost in USD
    """
    # Handle both dict and object formats
    if isinstance(usage, dict):
        cost = usage.get('total_cost_usd', 0.0)
    else:
        cost = getattr(usage, 'total_cost_usd', 0.0)

    logger.info(f"[Cost] {subagent_name}: ${cost:.4f}")
    return cost
```

### 7.2 Execution Timer

```python
class ExecutionTimer:
    """Track execution time with start/stop/lap functionality."""

    def __init__(self):
        self.start_time: Optional[float] = None
        self.laps: Dict[str, float] = {}

    def start(self) -> None:
        """Start timer."""
        self.start_time = time.time()
        logger.info("[Timer] ⏱️  Execution started")

    def lap(self, label: str) -> float:
        """Record lap time."""
        if self.start_time is None:
            raise ValueError("Timer not started")

        elapsed = time.time() - self.start_time
        self.laps[label] = elapsed
        logger.info(f"[Timer] {label}: {elapsed:.1f}s")
        return elapsed

    def stop(self) -> float:
        """Stop timer and return total time."""
        if self.start_time is None:
            raise ValueError("Timer not started")

        total = time.time() - self.start_time
        logger.info(f"[Timer] ⏱️  Total execution time: {total:.1f}s")
        return total
```

### 7.3 Metrics Report

```python
def generate_metrics_report(
    execution_id: str,
    total_cost: float,
    message_count: int,
    execution_time: float,
    subagent_costs: Dict[str, float],
    todos: List[Dict[str, Any]]
) -> str:
    """Generate comprehensive metrics report."""

    report = f"""
# SOW Author Execution Metrics

**Execution ID:** {execution_id}
**Timestamp:** {datetime.now().isoformat()}

## Cost Breakdown

- **Total Cost:** ${total_cost:.4f}
- **Messages:** {message_count}
- **Execution Time:** {execution_time:.1f}s

### Subagent Costs

"""

    for subagent, cost in subagent_costs.items():
        percentage = (cost / total_cost * 100) if total_cost > 0 else 0
        report += f"- **{subagent}**: ${cost:.4f} ({percentage:.1f}%)\n"

    report += f"""

## Todo Progress

Total: {len(todos)}
Completed: {sum(1 for t in todos if t['status'] == 'completed')}
Pending: {sum(1 for t in todos if t['status'] == 'pending')}

"""

    for todo in todos:
        status_icon = "✓" if todo['status'] == 'completed' else "○"
        report += f"{status_icon} [{todo['status']}] {todo['content']}\n"

    return report
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```python
# test_sow_author_claude_agent.py

import pytest
from sow_author_claude_client import (
    SOWAuthorClaudeAgent,
    validate_input_schema,
    IsolatedFilesystem
)

def test_input_validation_valid():
    """Test valid input format."""
    validate_input_schema("application_of_mathematics", "national_3")
    # Should not raise

def test_input_validation_invalid_subject():
    """Test invalid subject format."""
    with pytest.raises(ValueError):
        validate_input_schema("Application Of Mathematics", "national_3")

def test_input_validation_invalid_level():
    """Test invalid level format."""
    with pytest.raises(ValueError):
        validate_input_schema("application_of_mathematics", "National 3")

def test_isolated_filesystem_creation():
    """Test workspace creation."""
    with IsolatedFilesystem("test123", persist=False) as fs:
        assert fs.root.exists()
        assert fs.research_dir.exists()
        assert fs.course_data_dir.exists()
        assert fs.authored_dir.exists()
        assert fs.output_dir.exists()

    # Should be cleaned up
    assert not fs.root.exists()

def test_isolated_filesystem_persistence():
    """Test workspace persistence."""
    fs = IsolatedFilesystem("test456", persist=True)
    fs.setup()
    root = fs.root

    fs.cleanup()

    # Should still exist
    assert root.exists()

    # Manual cleanup
    import shutil
    shutil.rmtree(root)

@pytest.mark.asyncio
async def test_agent_initialization():
    """Test agent initialization."""
    agent = SOWAuthorClaudeAgent(persist_workspace=False)

    assert agent.execution_id is not None
    assert agent.max_critic_retries == 3
    assert agent.total_cost == 0.0
    assert agent.message_count == 0
```

### 8.2 Integration Test

```python
@pytest.mark.asyncio
@pytest.mark.integration
async def test_full_sow_authoring_pipeline():
    """
    Integration test: Full pipeline from subject/level to database.

    Requires:
    - ANTHROPIC_API_KEY set
    - .mcp.json configured with Appwrite
    - Appwrite accessible
    """

    agent = SOWAuthorClaudeAgent(
        persist_workspace=True,  # Keep for inspection
        max_critic_retries=1  # Limit retries for testing
    )

    result = await agent.execute(
        subject="application_of_mathematics",
        level="national_3",
        max_turns=50  # Limit turns for testing
    )

    # Validate results
    assert result['result'] == 'success'
    assert result['sow_document_id'] is not None
    assert result['metrics']['total_cost_usd'] > 0
    assert len(result['todos']) > 0

    # Validate files
    assert Path(result['files']['research_pack']).exists()
    assert Path(result['files']['course_data']).exists()
    assert Path(result['files']['authored_sow']).exists()
    assert Path(result['files']['critic_result']).exists()

    # Validate workspace preserved
    assert Path(result['workspace']).exists()

    # Cleanup workspace
    import shutil
    shutil.rmtree(result['workspace'])
```

### 8.3 Subagent Unit Tests

```python
@pytest.mark.asyncio
async def test_research_subagent_alone():
    """Test research subagent in isolation."""

    # Create minimal options for research only
    options = ClaudeAgentOptions(
        allowed_tools=['WebSearch', 'Write', 'TodoWrite'],
        agents={
            'research_subagent': AgentDefinition(
                description='Creates research pack',
                prompt=load_prompt('research_subagent_prompt.md'),
                tools=['WebSearch', 'Write', 'TodoWrite'],
                model='sonnet'
            )
        }
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect()

        await client.query("""
        Use research_subagent to create a research pack for:
        - Subject: application_of_mathematics
        - Level: national_3

        Output to: /tmp/test_research_pack_json
        """)

        async for message in client.receive_messages():
            if isinstance(message, ResultMessage):
                assert message.subtype == "success"
                break

    # Validate output
    assert Path("/tmp/test_research_pack_json").exists()

    # Validate schema
    pack = json.loads(Path("/tmp/test_research_pack_json").read_text())
    assert pack['research_pack_version'] == 3
    assert 'exemplars_from_sources' in pack
    assert 'distilled_data' in pack
```

---

## 9. Deployment & Operations

### 9.1 Environment Setup

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install claude-agent-sdk anyio

# 3. Set API key
export ANTHROPIC_API_KEY="your-key-here"

# 4. Configure MCP (copy from project root)
cp ../.mcp.json .

# 5. Test connectivity
python -c "from claude_agent_sdk import query; print('SDK installed')"
```

### 9.2 Configuration Files

**`.mcp.json` (Appwrite MCP Configuration)**
```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": ["-y", "@appwrite.io/mcp-server-appwrite"],
      "env": {
        "APPWRITE_ENDPOINT": "https://your-appwrite-endpoint.com/v1",
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 9.3 Running the Agent

```bash
# Run with defaults
python src/sow_author_claude_client.py

# Run with custom subject/level
python src/sow_author_claude_client.py \
  --subject application_of_mathematics \
  --level national_3

# Run with debug logging
python src/sow_author_claude_client.py \
  --subject mathematics \
  --level national_5 \
  --log-level DEBUG

# Run without workspace persistence (cleanup after)
python src/sow_author_claude_client.py \
  --subject application_of_mathematics \
  --level national_3 \
  --no-persist
```

### 9.4 Monitoring & Logging

```python
# Configure comprehensive logging
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(f'sow_author_{execution_id}.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

---

## 10. Success Criteria

### 10.1 Functional Requirements

- [ ] Agent accepts `{subject, level}` input in correct format
- [ ] Research subagent creates valid research_pack_json (v3 schema)
- [ ] Course data extractor fetches SQA data from Appwrite
- [ ] SOW author creates schema-compliant authored_sow_json
- [ ] Unified critic validates across all 5 dimensions
- [ ] Critic retry logic works (max 3 attempts)
- [ ] Upserter writes to Appwrite database successfully
- [ ] Version determination logic works (auto-increment)
- [ ] Workspace persistence controlled by flag
- [ ] All files created in proper subdirectories

### 10.2 Quality Requirements

- [ ] SOW covers all SQA units, outcomes, assessment standards
- [ ] Lesson plans detailed (6-12 cards per entry)
- [ ] Scottish contexts used throughout
- [ ] Enriched assessment standard references (not bare codes)
- [ ] Teach→revision pairing maintained
- [ ] Course-level requirements met (independent_practice, mock_assessment)
- [ ] Critic scores above thresholds (Coverage ≥0.90, etc.)

### 10.3 Performance Requirements

- [ ] Total execution time < 5 minutes (typical)
- [ ] Cost per execution < $1.00 (typical)
- [ ] Workspace size < 10 MB
- [ ] All subagent executions logged with costs
- [ ] Comprehensive metrics reported

### 10.4 Operational Requirements

- [ ] Clear error messages for all failure modes
- [ ] Workspace preserved on errors (for debugging)
- [ ] Logs comprehensive enough to debug issues
- [ ] Unit tests passing (> 80% coverage)
- [ ] Integration test passing (full pipeline)
- [ ] Documentation complete and accurate

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up project structure
- [ ] Create IsolatedFilesystem class
- [ ] Implement input validation
- [ ] Configure MCP connectivity
- [ ] Create basic agent skeleton

### Phase 2: Subagent Implementation (Week 2)
- [ ] Write research_subagent prompt and test
- [ ] Write course_data_extractor prompt and test
- [ ] Adapt sow_author prompt from LangGraph
- [ ] Adapt unified_critic prompt from LangGraph
- [ ] Write upserter prompt and test

### Phase 3: Integration (Week 3)
- [ ] Implement main orchestrator logic
- [ ] Add critic retry logic
- [ ] Implement cost tracking
- [ ] Implement metrics reporting
- [ ] Add comprehensive logging

### Phase 4: Testing & Refinement (Week 4)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Run end-to-end tests
- [ ] Fix bugs and edge cases
- [ ] Optimize prompts based on results

### Phase 5: Documentation & Deployment (Week 5)
- [ ] Complete README
- [ ] Write usage examples
- [ ] Create troubleshooting guide
- [ ] Deploy to production
- [ ] Monitor initial executions

---

## 12. Known Risks & Mitigations

### Risk 1: Research Subagent Quality
**Risk:** Web research may not provide sufficient Scottish curriculum context.

**Mitigation:**
- Provide high-quality example research packs in prompts
- Include specific URLs to Scottish curriculum resources
- Validate research pack schema strictly
- Allow manual research pack input as fallback

### Risk 2: MCP Connectivity Issues
**Risk:** Appwrite MCP may be unreliable or slow.

**Mitigation:**
- Check connectivity before execution
- Implement retry logic for MCP calls
- Provide clear error messages
- Allow manual data input as fallback

### Risk 3: Critic Never Passes
**Risk:** Unified critic may be too strict, preventing completion.

**Mitigation:**
- Limit retries (max 3)
- Log specific critic failures
- Allow manual override flag
- Refine critic thresholds if needed

### Risk 4: Cost Overruns
**Risk:** Execution may be more expensive than expected.

**Mitigation:**
- Set max_turns limit (100 default)
- Track costs in real-time
- Abort if cost exceeds threshold
- Optimize prompts to reduce token usage

### Risk 5: Prompt Adaptation Issues
**Risk:** Adapted prompts may not work as well as LangGraph versions.

**Mitigation:**
- Start with minimal adaptations
- Test with known-good examples
- Compare outputs to LangGraph version
- Iterate based on results

---

## 13. Next Steps

### Immediate (This Week)
1. Create project structure in `claud_author_agent/`
2. Copy `deep_research_agent_client.py` as template
3. Implement `IsolatedFilesystem` class
4. Write `validate_input_schema()` function
5. Create prompt files structure

### Short-term (Next 2 Weeks)
1. Implement all 5 subagent prompts
2. Test each subagent in isolation
3. Implement main orchestrator
4. Run first end-to-end test
5. Fix critical bugs

### Medium-term (Next Month)
1. Complete unit test suite
2. Complete integration test suite
3. Optimize prompts based on results
4. Document all features
5. Prepare for production deployment

---

## Appendix A: File Structure

```
claud_author_agent/
├── README.md                           # Overview and quick start
├── .mcp.json                           # MCP configuration (Appwrite)
├── requirements.txt                    # Python dependencies
├── tasks/
│   └── sow-author-claude-sdk-implementation-plan.md  # This document
├── src/
│   ├── __init__.py
│   ├── sow_author_claude_client.py    # Main agent implementation
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── filesystem.py              # IsolatedFilesystem class
│   │   ├── validation.py              # Input validation
│   │   ├── metrics.py                 # Cost & performance tracking
│   │   └── logging_config.py          # Logging setup
│   ├── prompts/
│   │   ├── research_subagent_prompt.md
│   │   ├── course_data_extractor_prompt.md
│   │   ├── sow_author_prompt.md       # Adapted from LangGraph
│   │   ├── unified_critic_prompt.md   # Adapted from LangGraph
│   │   └── upserter_subagent_prompt.md
│   └── schemas/
│       ├── input_schema.md            # {subject, level} format
│       ├── research_pack_schema.md    # v3 schema
│       ├── sow_schema.md              # authored_sow_json schema
│       └── critic_result_schema.md    # sow_critic_result_json schema
├── examples/
│   ├── run_sow_author.py              # Example usage
│   └── test_subagents.py              # Subagent testing examples
├── tests/
│   ├── __init__.py
│   ├── test_validation.py             # Input validation tests
│   ├── test_filesystem.py             # Workspace tests
│   ├── test_agent.py                  # Agent unit tests
│   └── test_integration.py            # End-to-end tests
└── docs/
    ├── ARCHITECTURE.md                # System architecture
    ├── USAGE.md                       # Usage guide
    └── TROUBLESHOOTING.md             # Common issues
```

---

## Appendix B: Pseudo-Code for Key Functions

### B.1 Main Execution Flow

```python
async def execute(subject: str, level: str) -> Dict[str, Any]:
    # 1. Validate input
    validate_input_schema(subject, level)

    # 2. Create workspace
    with IsolatedFilesystem(execution_id, persist=True) as fs:

        # 3. Connect to Claude
        async with ClaudeSDKClient(options) as client:
            await client.connect()

            # 4. Send initial task
            await client.query(create_initial_prompt(subject, level))

            # 5. Process messages
            async for message in client.receive_messages():
                process_message(message)

                if isinstance(message, ResultMessage):
                    if message.subtype == "success":
                        return extract_results(message, fs)
                    else:
                        raise ExecutionError(message.result)
```

### B.2 Critic Retry Logic

```python
async def handle_critic_validation(
    client: ClaudeSDKClient,
    filesystem: IsolatedFilesystem,
    max_retries: int = 3
) -> Dict[str, Any]:

    for attempt in range(1, max_retries + 1):
        # Read critic result
        critic_result = read_json(filesystem.authored_dir / "sow_critic_result_json")

        if critic_result['pass']:
            logger.info(f"✓ Critic passed on attempt {attempt}")
            return critic_result

        if attempt >= max_retries:
            logger.error(f"✗ Critic failed after {max_retries} attempts")
            raise CriticFailureError(critic_result)

        # Retry with feedback
        await client.query(create_retry_prompt(critic_result, attempt, max_retries))

        async for message in client.receive_messages():
            if isinstance(message, ResultMessage):
                break

    raise CriticFailureError("Max retries exceeded")
```

### B.3 Version Determination

```python
async def determine_version(
    subject: str,
    level: str,
    mcp_tools: Dict[str, Any]
) -> str:

    # Query existing SOWs for this subject/level
    existing_sows = await mcp_tools['list_documents'](
        database="default",
        collection="Authored_SOW",
        queries=[
            Query.equal('subject', subject),
            Query.equal('level', level),
            Query.orderDesc('version'),
            Query.limit(1)
        ]
    )

    if len(existing_sows) == 0:
        return "1.0"

    latest_version = existing_sows[0]['version']

    # Parse and increment
    parts = latest_version.split('.')
    if len(parts) == 2:
        major, minor = int(parts[0]), int(parts[1])
        return f"{major}.{minor + 1}"

    # Fallback
    return f"{latest_version}.1"
```

---

## Appendix C: Example Prompts

### C.1 Research Subagent Prompt (Excerpt)

```markdown
# Research Subagent - Scottish Curriculum Researcher

You are a specialized research agent focused on Scottish secondary education.

## Your Task

Create a comprehensive research pack (v3 schema) for:
- **Subject**: {subject}
- **Level**: {level}

## Research Areas

1. **Official SQA Resources**
   - Course specifications
   - Assessment exemplars
   - Marking schemes

2. **Pedagogical Patterns**
   - Lesson starters for this level
   - CFU strategies appropriate for Scottish classrooms
   - Common misconceptions

3. **Scottish Context Hooks**
   - Currency: £ (not $)
   - Services: NHS, Scottish councils
   - Contexts: Supermarkets, bus fares, local shops

4. **Accessibility Strategies**
   - Dyslexia-friendly approaches
   - Plain language guidelines
   - Extra time provisions

## Output Format

Write your research to:
**File**: `/workspace/research/research_pack_json`

**Schema**: research_pack_schema v3
- research_pack_version: 3
- subject: {subject}
- level: {level}
- exemplars_from_sources: [...]
- distilled_data: {...}
- guidance_for_author: {...}
- citations: [...]

## Quality Requirements

- At least 5 exemplars with full source content
- Canonical terms from CfE/SQA
- Authentic Scottish contexts (no Americanisms)
- Specific pedagogical patterns (not generic advice)

Use TodoWrite to track your research progress.
```

### C.2 Upserter Subagent Prompt (Excerpt)

```markdown
# Upserter Subagent - Database Operations Specialist

You are a database operations specialist with access to Appwrite MCP tools.

## Your Task

Upsert the validated SOW to Appwrite database.

## Input

Read from: `/workspace/authored/authored_sow_json`

## Process

1. **Determine Version**
   - Query default.Authored_SOW for existing SOWs
   - Filter by subject + level
   - If none exist: version = "1.0"
   - If exist: increment minor version (1.0 → 1.1)

2. **Enrich Metadata**
   - Add courseId (query from courses collection or derive)
   - Add version
   - Add status: "draft"
   - Add generated_at: ISO timestamp
   - Add author_agent_version: "claude-sdk-1.0"

3. **Upsert Document**
   - Database: "default"
   - Collection: "Authored_SOW"
   - Use mcp__appwrite__databases_upsert_document

4. **Return Document ID**

## Tools Available

- mcp__appwrite__databases_list_documents
- mcp__appwrite__databases_upsert_document
- Read
- Write
- TodoWrite

## Error Handling

- If database error: throw detailed exception
- If schema invalid: log specific validation errors
- If version conflict: use timestamp fallback

Report success with document ID.
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a SOW author agent using Claude Agent SDK that replicates and extends the LangGraph version's functionality. The key innovation is the fully autonomous pipeline from subject/level input to database output, removing external file dependencies and integrating research pack generation.

**Next Action:** Begin Phase 1 implementation with project structure setup and IsolatedFilesystem class.
