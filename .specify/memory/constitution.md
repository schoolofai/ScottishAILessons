<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================

  Version Change: INITIAL → 1.0.0

  Constitution Status: INITIAL CREATION

  Modified Principles:
    - NEW: I. Fast-Fail Error Handling (Core Architecture Principle)
    - NEW: II. Code Quality & Maintainability (Prevents Technical Debt)
    - NEW: III. Documentation-First Development (Ensures Knowledge Transfer)
    - NEW: IV. Clean Testing Practices (Quality Gates)
    - NEW: V. Dual Implementation Strategy (Architecture Pattern)

  Added Sections:
    - Core Principles (5 principles covering architecture, quality, docs, testing, deployment)
    - Development Workflow (Lifecycle management)
    - Governance (Amendment process and versioning)

  Removed Sections: None (initial creation)

  Templates Requiring Updates:
    ✅ UPDATED: .specify/templates/plan-template.md
        - Added "Constitution Check" section referencing fast-fail and code quality principles
    ✅ UPDATED: .specify/templates/spec-template.md
        - Verified "Requirements" section enforces MUST/SHOULD distinction
    ✅ UPDATED: .specify/templates/tasks-template.md
        - Verified task structure supports independent testing and error logging requirements
    ⚠ PENDING: None - all templates validated for constitution compliance

  Follow-up TODOs:
    - Original ratification date unknown - marked as TODO for historical record
    - Consider adding principle for frontend/backend separation patterns (currently implicit)
    - Monitor 500-line file limit in practice; adjust if causes excessive fragmentation

  ============================================================================
-->

# ScottishAILessons Constitution

## Core Principles

### I. Fast-Fail Error Handling

**RULE**: Never use fallback mechanisms or silent error handling. All errors MUST throw exceptions with detailed logging.

**RATIONALE**: Silent failures cause debugging nightmares. Fast-fail patterns ensure problems surface immediately during development, not in production. This is NON-NEGOTIABLE for AI-powered educational systems where reliability is critical.

**EXAMPLES**:
- ❌ BAD: `try: data = fetch() except: data = {}`
- ✅ GOOD: `if not data: raise ValueError(f"Failed to fetch {resource_id}")`
- ❌ BAD: Default values masking missing configuration
- ✅ GOOD: Explicit validation with actionable error messages

### II. Code Quality & Maintainability

**RULE**:
- Files MUST NOT exceed 500 lines of code
- Functions MUST NOT exceed 50 lines of code
- When limits are exceeded, extract utility files or helper functions

**RATIONALE**: Large files and functions become unmaintainable. This forces modular design, improves testability, and makes code reviews effective. Cognitive load matters for team velocity.

**ENFORCEMENT**:
- Refactor immediately when approaching limits (450 lines, 45 lines)
- Use descriptive helper function names that self-document intent
- Place utility functions in dedicated files with clear naming (e.g., `lesson_validators.py`, `string_helpers.py`)

### III. Documentation-First Development

**RULE**: Always update PRD, brief, and task list files when using them. Documentation changes are part of the definition of "done".

**RATIONALE**: Stale documentation is worse than no documentation. Educational software requires knowledge transfer. CLAUDE.md patterns demonstrate this project's commitment to living documentation.

**REQUIREMENTS**:
- CLAUDE.md: Architecture decisions, startup scripts, gotchas
- README.md: Quick start, API reference, deployment guides
- Inline comments: WHY (not what) - explain non-obvious decisions
- Task files: Update completion status immediately after work

### IV. Clean Testing Practices

**RULE**:
- Manual testing MUST use Playwright MCP tool after every code change
- Test user credentials: `test@scottishailessons.com` / `red12345`
- Restart servers using `langgraph-agent/stop.sh` then `start.sh` (no port checking)

**RATIONALE**: Port conflicts and stale processes waste time. Automated restart scripts prevent "works on my machine" issues. Manual testing catches UX problems automated tests miss in educational interfaces.

**TEST PHILOSOPHY**:
- Focus on functional testing over linting/type checking (project convention)
- Integration tests for LangGraph agent graphs
- Playwright for end-to-end user flows (authentication, lesson delivery)
- Hot reload for rapid iteration

### V. Dual Implementation Strategy

**RULE**: Maintain compatibility between Official LangGraph and Aegra (self-hosted) backends with shared frontend.

**RATIONALE**: Provides deployment flexibility (cloud vs on-premise) without duplicating UI code. Critical for educational institutions with varying infrastructure requirements.

**ARCHITECTURE CONSTRAINTS**:
- Frontend (`assistant-ui-frontend/`): Environment-based switching (`.env.local.*` templates)
- Shared agent logic (`agents/`): Core business logic with system-specific wrappers
- Backend agnostic: Both must pass same functional tests
- Interrupt patterns: Tool calls for data, interrupts for flow control (see `docs/interrupt-flow-documentation.md`)

## Development Workflow

### Planning Mode
- MUST show pseudo-code of proposed plan or changes
- Use `graph_interrupt.py` as entry point (verify via `langgraph.json`)
- Never assume file locations - read `langgraph.json` configuration

### Task Execution
- Update task files immediately after completion (never batch)
- Use `TodoWrite` tool for complex multi-step tasks
- Mark tasks complete ONLY when fully accomplished (no partial completion)

### Code Changes
- Extract functions when approaching 50-line limit
- Refactor to utility files when approaching 500-line limit
- No fallback patterns - throw exceptions with detailed context
- Import helper methods to keep files modular

## Governance

### Amendment Process

1. **Proposal**: Document why existing principles block progress
2. **Review**: Validate simpler alternatives were exhausted
3. **Versioning**: Bump constitution version according to semantic rules
4. **Propagation**: Update affected templates and documentation
5. **Approval**: Document in Sync Impact Report

### Versioning Policy

Constitution follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward incompatible changes (e.g., removing fast-fail principle)
- **MINOR**: New principles added or materially expanded guidance (e.g., adding new architecture pattern)
- **PATCH**: Clarifications, wording improvements, typo fixes (e.g., improving examples)

### Compliance Review

- All PRs MUST verify constitution compliance
- Complexity violations MUST be justified in task planning documents
- Constitution supersedes all other practices when conflicts arise
- Use CLAUDE.md for runtime development guidance (constitution derivative)

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): Determine original adoption date from project history | **Last Amended**: 2025-10-30
