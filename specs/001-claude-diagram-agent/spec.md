# Feature Specification: Claude Diagram Generation Agent

**Feature Branch**: `001-claude-diagram-agent`
**Created**: 2025-10-30
**Status**: Draft
**Input**: User description: "I want to create the functionality in the langgraph deep agent @langgraph-author-agent/src/diagram_author_agent.py the documentation for this is in @langgraph-author-agent/docs/DIAGRAM_AUTHOR_README.md in a claude agent instead - there are several claude agents aready implemented in @claud_author_agent/ i want to use the same patterns and in these. the new claude diagram agent will also have a cli wrapper like the other cluade agents - this will allow cli based operations 1. single lesson template daigram generation - this mode will take courseId and sow order and generate diagrams for the lesson - and populate the entry in collection lesson_diagram in appwrite 2. batch mode - where it takes courseId and generates diagrams for all available lessons for that courseID - in batch mode there should be a dry run option like with the @claud_author_agent/src/lesson_author_cli.py - if there is lesson_diagram entry for the lesson already it should skip generation unless --force option is provided"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Single Lesson Diagram Generation (Priority: P1)

A curriculum developer needs to generate JSXGraph visualizations for mathematical concepts in a newly authored lesson template. They provide the course identifier and lesson order number, and the system generates pedagogically appropriate diagrams that are automatically stored in the database.

**Why this priority**: This is the core value proposition - generating high-quality mathematical diagrams for individual lessons. Without this, the feature delivers no value. It's the minimum viable product.

**Independent Test**: Can be fully tested by providing a courseId and order number for an existing lesson template that contains mathematical content. Success means diagrams are generated, meet quality thresholds, and are persisted to the Appwrite lesson_diagrams collection. No batch infrastructure needed.

**Acceptance Scenarios**:

1. **Given** a valid courseId and order for a lesson template with 3 cards containing mathematical content, **When** the user runs the diagram generation command, **Then** the system generates JSXGraph diagrams for all 3 cards, validates them against quality criteria (≥0.85 threshold), and persists them to Appwrite with execution metrics reported
2. **Given** a valid courseId and order for a lesson template with no visual content needed, **When** the user runs the diagram generation command, **Then** the system analyzes all cards, determines no diagrams are needed, and reports successful completion with 0 diagrams generated
3. **Given** an invalid courseId format (not matching "course_*" pattern), **When** the user provides this input, **Then** the system throws a validation exception with a clear error message before any API calls are made
4. **Given** a courseId and order where the lesson template does not exist in Appwrite, **When** the user runs the diagram generation command, **Then** the system throws an exception indicating the lesson template cannot be found with actionable next steps

---

### User Story 2 - Batch Processing with Dry-Run Preview (Priority: P2)

A curriculum coordinator needs to generate diagrams for all lessons in a course efficiently. Before committing to the full generation process (which incurs API costs), they want to preview what would be generated and see estimated costs.

**Why this priority**: Batch processing enables scalability for courses with many lessons (10-50 lessons common). Dry-run prevents costly mistakes and provides transparency. This extends P1 functionality to production-scale use cases without replacing the core single-lesson workflow.

**Independent Test**: Can be tested by providing a courseId with multiple lesson templates. Dry-run mode should analyze all lessons, identify cards needing diagrams, calculate cost estimates, and output a JSON report without making any generation API calls. Success means accurate preview without side effects.

**Acceptance Scenarios**:

1. **Given** a courseId with 15 lesson templates where 10 contain mathematical content, **When** the user runs batch mode with --dry-run flag, **Then** the system analyzes all 15 lessons, identifies 10 requiring diagrams, calculates estimated token costs and total USD cost, and outputs a JSON report without generating any diagrams
2. **Given** a courseId with 8 lesson templates where 5 already have diagrams in the database, **When** the user runs batch mode with --dry-run (no --force), **Then** the system reports that 3 new lessons need diagrams and 5 will be skipped, with cost estimates reflecting only the 3 new generations
3. **Given** a courseId with 20 lesson templates, **When** the user runs batch mode without --dry-run, **Then** the system processes all lessons sequentially, generates diagrams for those needing them, skips those with existing diagrams, and reports final metrics including successes and any failures
4. **Given** a batch operation where 2 out of 10 lessons fail diagram generation, **When** the batch completes, **Then** the system reports partial success with 8 diagrams persisted and 2 errors logged with detailed diagnostic information

---

### User Story 3 - Force Regeneration for Quality Improvements (Priority: P3)

A curriculum developer notices that previously generated diagrams don't meet updated quality standards or contain errors. They need to regenerate specific diagrams without manually deleting existing entries.

**Why this priority**: Quality iteration is essential for educational content. As prompt engineering improves or visual standards evolve, educators need to update existing diagrams. This is optional enhancement - P1 and P2 handle net-new generation. Force mode enables continuous improvement workflows.

**Independent Test**: Can be tested by generating a diagram for a lesson (creating an entry in lesson_diagrams), then running the command again with --force flag. Success means the existing diagram is replaced with a newly generated one, and the database reflects updated timestamps and metrics.

**Acceptance Scenarios**:

1. **Given** a lesson that already has diagrams in the database, **When** the user runs single-lesson mode with --force flag, **Then** the system regenerates all diagrams for that lesson and overwrites existing database entries with new content and updated timestamps
2. **Given** a courseId with 10 lessons all having existing diagrams, **When** the user runs batch mode with --force, **Then** the system regenerates diagrams for all 10 lessons regardless of existing entries and updates the database
3. **Given** a lesson with existing diagrams, **When** the user runs single-lesson mode without --force, **Then** the system detects existing diagrams, skips generation, and reports that diagrams already exist with instructions to use --force if regeneration is desired

---

### User Story 4 - Multi-Method Input for Different Workflows (Priority: P4)

Different users have different operational preferences. Curriculum developers may prefer interactive prompts during exploratory work, automation scripts need JSON file inputs for reproducibility, and CI/CD pipelines require command-line arguments.

**Why this priority**: Developer experience enhancement. P1 could work with just one input method, but supporting all three removes friction and enables integration across workflows (manual exploration, scripting, automation). This mirrors established patterns in existing Claude agents.

**Independent Test**: Can be tested by invoking the CLI in three ways: (1) providing JSON file path, (2) passing CLI arguments, (3) running with no arguments to trigger interactive mode. All three should result in identical diagram generation behavior given the same courseId and order inputs.

**Acceptance Scenarios**:

1. **Given** a JSON file containing {"courseId": "course_123", "order": 2}, **When** the user runs the CLI with --input flag pointing to this file, **Then** the system loads parameters from the JSON and generates diagrams for the specified lesson
2. **Given** command-line arguments --courseId course_123 --order 2, **When** the user runs the CLI, **Then** the system uses these arguments directly and generates diagrams
3. **Given** no input method provided (no JSON file, no CLI args), **When** the user runs the CLI, **Then** the system enters interactive mode, prompts for courseId and order, and generates diagrams based on user responses
4. **Given** partial command-line arguments (only --courseId without --order), **When** the user runs the CLI, **Then** the system throws an error indicating both parameters are required when using CLI arguments

---

### Edge Cases

- What happens when the DiagramScreenshot service (localhost:3001) is not running or unreachable?
- How does the system handle lesson templates with 50+ cards (large documents)?
- What happens when a card's mathematical content is ambiguous or unsuitable for visualization?
- How does the system handle network timeouts during Appwrite queries or diagram rendering?
- What happens when a diagram generation attempt produces invalid JSXGraph JSON syntax?
- How does the system handle lessons with mixed content (some cards need diagrams, others don't)?
- What happens when the visual critic subagent fails to score a diagram (malformed image data)?
- How does the system handle batch mode when Appwrite rate limits are reached mid-process?
- What happens when cost tracking fails (metrics collection error)?
- How does the system handle workspace cleanup failures (disk full, permission errors)?

## Requirements *(mandatory)*

### Functional Requirements

**Constitution Alignment**: All requirements MUST follow fast-fail principles (no fallback mechanisms). Use MUST for mandatory behavior, SHOULD for recommended but optional behavior. See `.specify/memory/constitution.md`.

#### Input & Validation

- **FR-001**: System MUST accept input via three methods: JSON file path (--input), command-line arguments (--courseId --order), or interactive prompts (no arguments)
- **FR-002**: System MUST validate courseId format before any API calls (MUST match pattern "course_*" with alphanumeric suffix)
- **FR-003**: System MUST throw ValueError with actionable error message when courseId validation fails (no silent defaults or fallbacks)
- **FR-004**: System MUST validate order is a positive integer ≥1 before any API calls
- **FR-005**: System MUST throw ValueError when both --courseId and --order are not provided together in CLI argument mode
- **FR-006**: System MUST support --force flag to override existing diagram skip logic
- **FR-007**: System MUST support --dry-run flag in batch mode to preview operations without execution
- **FR-008**: System MUST support --no-persist-workspace flag to delete workspace after execution
- **FR-009**: System MUST support --log-level argument with values DEBUG, INFO, WARNING, ERROR
- **FR-010**: System MUST support --mcp-config argument to specify custom MCP configuration file path

#### Data Fetching & Pre-processing

- **FR-011**: System MUST fetch lesson_template document from Appwrite default.lesson_templates collection using courseId and order
- **FR-012**: System MUST throw exception with clear error message when lesson_template is not found (no fallback or default lesson)
- **FR-013**: System MUST validate lesson_template structure contains required fields (lessonTemplateId, cards array) before processing
- **FR-014**: System MUST extract all cards from lesson_template that contain mathematical or visual content requiring diagrams
- **FR-015**: System MUST identify card types eligible for diagrams (teach cards with mathematical content, explain_diagram cards, practice cards with visual problems)
- **FR-016**: System MUST skip cards that explicitly do not need diagrams (explain_plain text-only cards, simple multiple choice without visual context)

#### Workspace Management

- **FR-017**: System MUST create isolated workspace using execution_id timestamp format (YYYYMMDD_HHMMSS)
- **FR-018**: System MUST create workspace subdirectory structure: workspace/{execution_id}/
- **FR-019**: System MUST write lesson_template.json to workspace before agent execution (pre-processing)
- **FR-020**: System MUST write README.md to workspace documenting file purposes and workflow
- **FR-021**: System MUST preserve workspace after execution by default (persist=True)
- **FR-022**: System MUST delete workspace when --no-persist-workspace flag is provided
- **FR-023**: System MUST throw exception when workspace creation fails due to filesystem errors (permissions, disk full)

#### Claude SDK Configuration

- **FR-024**: System MUST initialize Claude SDK client with model claude-sonnet-4-5
- **FR-025**: System MUST configure Claude SDK with bypassPermissions mode to skip permission prompts
- **FR-026**: System MUST set Claude SDK working directory (cwd) to workspace root path
- **FR-027**: System MUST register allowed tools: Read, Write, Edit, Glob, Grep, TodoWrite, Task, WebSearch, WebFetch
- **FR-028**: System MUST set max_turns to 500 to prevent infinite loops
- **FR-029**: System MUST register MCP servers for validation tools if needed (Pydantic schema validators)

#### Subagent Configuration

- **FR-030**: System MUST define Diagram Author subagent with responsibility for generating JSXGraph JSON and rendering images
- **FR-031**: System MUST define Visual Critic subagent with responsibility for analyzing rendered diagram images across 4 quality dimensions
- **FR-032**: System MUST provide Diagram Author subagent with access to render_diagram_tool (HTTP client to DiagramScreenshot service)
- **FR-033**: System MUST provide Visual Critic subagent with NO tools (pure multimodal vision analysis)
- **FR-034**: System MUST configure Diagram Author subagent with prompt containing JSXGraph pattern library references
- **FR-035**: System MUST configure Visual Critic subagent with prompt containing 4D scoring criteria (clarity, accuracy, pedagogy, aesthetics)

#### Diagram Generation Loop

- **FR-036**: System MUST process each card requiring a diagram sequentially (not parallel to preserve context)
- **FR-037**: System MUST invoke Diagram Author subagent for each card to generate JSXGraph JSON and request rendering
- **FR-038**: System MUST call DiagramScreenshot service HTTP endpoint to render JSXGraph JSON to PNG image
- **FR-039**: System MUST throw exception when DiagramScreenshot service returns HTTP 4xx or 5xx errors (no fallback)
- **FR-040**: System MUST throw exception when DiagramScreenshot service is unreachable after 30 second timeout (no retry, no fallback)
- **FR-041**: System MUST validate rendered image is non-empty base64 PNG data before proceeding

#### Quality Assessment & Refinement

- **FR-042**: System MUST invoke Visual Critic subagent to analyze each rendered diagram across 4 dimensions
- **FR-043**: System MUST extract numeric score (0.0-1.0) from Visual Critic subagent response
- **FR-044**: System MUST accept diagram if score ≥0.85 (quality threshold)
- **FR-045**: System MUST reject diagram if score <0.85 and provide feedback to Diagram Author subagent for refinement
- **FR-046**: System MUST limit refinement iterations to maximum 3 attempts per diagram
- **FR-047**: System MUST throw exception when diagram fails to meet threshold after 3 iterations (no fallback to low-quality diagram)
- **FR-048**: System MUST log critique feedback for each iteration including score and specific improvement suggestions

#### Cost Tracking & Metrics

- **FR-049**: System MUST initialize CostTracker with execution_id at agent initialization
- **FR-050**: System MUST record token usage (input and output tokens) for each subagent invocation
- **FR-051**: System MUST calculate cost in USD based on Claude model pricing (input: $3/M tokens, output: $15/M tokens for claude-sonnet-4-5)
- **FR-052**: System MUST aggregate total tokens and total cost across all subagent invocations
- **FR-053**: System MUST generate per-subagent cost breakdown in final metrics report
- **FR-054**: System MUST include execution time (start to end) in metrics report

#### Appwrite Persistence

- **FR-055**: System MUST persist each generated diagram to Appwrite default.lesson_diagrams collection
- **FR-056**: System MUST include fields in persisted document: lessonTemplateId, cardId, jsxgraph_json (string), image_base64 (string), diagram_type (string), visual_critique_score (number), critique_iterations (number)
- **FR-057**: System MUST use Appwrite SDK directly for persistence (not MCP tools - optimization)
- **FR-058**: System MUST throw exception when Appwrite persistence fails (no silent failure)
- **FR-059**: System MUST return Appwrite document $id in execution result

#### Batch Mode Behavior

- **FR-060**: System MUST query Appwrite for all lesson_templates matching provided courseId when batch mode is invoked
- **FR-061**: System MUST sort lesson_templates by order field (ascending) before processing
- **FR-062**: System MUST check for existing diagrams in lesson_diagrams collection for each lesson
- **FR-063**: System MUST skip lessons with existing diagrams unless --force flag is provided
- **FR-064**: System MUST continue processing remaining lessons when one lesson fails (partial success model)
- **FR-065**: System MUST collect all errors with lesson context (courseId, order, error message, stack trace)
- **FR-066**: System MUST report final batch summary: total lessons, diagrams generated, diagrams skipped, errors

#### Dry-Run Mode

- **FR-067**: System MUST analyze all lessons without making diagram generation API calls when --dry-run is provided
- **FR-068**: System MUST identify cards needing diagrams for each lesson
- **FR-069**: System MUST estimate token usage based on card content length and typical subagent conversation patterns
- **FR-070**: System MUST calculate estimated cost in USD based on token estimates
- **FR-071**: System MUST output JSON report with structure: {courseId, total_lessons, lessons_needing_diagrams, total_cards_with_diagrams, estimated_tokens, estimated_cost_usd, lessons_details[]}
- **FR-072**: System MUST complete dry-run in under 60 seconds for courses with up to 50 lessons

#### Error Handling & Logging

- **FR-073**: System MUST log all validation failures at ERROR level with input values and expected formats
- **FR-074**: System MUST log all Appwrite query operations at INFO level with query parameters
- **FR-075**: System MUST log all subagent invocations at INFO level with subagent name and card context
- **FR-076**: System MUST log all exceptions with full stack traces using exc_info=True
- **FR-077**: System MUST return structured error result containing: success=False, execution_id, error (string), metrics (dict)
- **FR-078**: System MUST never use try-except with pass or generic fallback values (Constitution Principle I)

#### CLI Output & Reporting

- **FR-079**: System MUST display success banner with checkmark when execution completes successfully
- **FR-080**: System MUST display execution_id, workspace_path, appwrite_document_id in success output
- **FR-081**: System MUST display total_tokens, total_cost_usd in success output
- **FR-082**: System MUST display failure banner with X mark when execution fails
- **FR-083**: System MUST display error message and partial metrics in failure output
- **FR-084**: System MUST use colored output (green for success, red for error, yellow for warnings) when terminal supports ANSI

#### Code Quality Constraints (Constitution)

- **FR-085**: CLI wrapper file MUST NOT exceed 500 lines of code (extract utilities when approaching limit)
- **FR-086**: Agent client file MUST NOT exceed 500 lines of code (extract utilities when approaching limit)
- **FR-087**: All functions MUST NOT exceed 50 lines of code (extract helper functions when approaching limit)
- **FR-088**: System MUST extract repeated logic into utility modules (e.g., validation_utils.py, appwrite_utils.py)

### Key Entities *(include if feature involves data)*

- **DiagramGenerationRequest**: Represents user input containing courseId (string), order (integer), force (boolean), dry_run (boolean), persist_workspace (boolean), log_level (string), mcp_config_path (string)

- **LessonTemplate**: Represents fetched lesson data containing lessonTemplateId (string), courseId (string), order (integer), cards (array), lesson_type (string), policy (JSON object), engagement_tags (array)

- **DiagramCard**: Represents a single card from lesson template needing visualization, containing cardId (string), cardType (string), title (string), content (string), mathematical_concepts (extracted list)

- **JSXGraphDiagram**: Represents generated diagram containing jsxgraph_json (string - serialized JSON structure), board configuration (grid, axes, bounds), elements (points, lines, curves, text), colors (Scottish palette), labels

- **RenderedImage**: Represents rendered PNG containing image_base64 (string), width (integer), height (integer), format (string - always "PNG"), file_size_bytes (integer)

- **VisualCritique**: Represents quality assessment containing overall_score (float 0.0-1.0), clarity_score (float), accuracy_score (float), pedagogy_score (float), aesthetics_score (float), feedback (array of strings), iteration_number (integer), accepted (boolean)

- **LessonDiagram**: Represents persisted Appwrite entity containing $id (string), lessonTemplateId (string - foreign key), cardId (string), jsxgraph_json (string), image_base64 (string), diagram_type (string - geometry/algebra/statistics), visual_critique_score (float), critique_iterations (integer), critique_feedback (JSON array), createdAt (datetime), updatedAt (datetime)

- **ExecutionReport**: Represents final operation result containing success (boolean), execution_id (string), workspace_path (string), appwrite_document_id (string or null), diagrams_generated (integer), diagrams_skipped (integer), errors (array), metrics (CostMetrics object)

- **CostMetrics**: Represents cost tracking data containing total_tokens (integer), input_tokens (integer), output_tokens (integer), total_cost_usd (float), subagent_breakdown (array of per-subagent metrics), execution_time_seconds (float)

- **BatchReport**: Represents batch operation summary containing courseId (string), total_lessons (integer), lessons_processed (integer), diagrams_generated (integer), diagrams_skipped (integer), errors (array of error objects with lesson context), aggregate_metrics (CostMetrics)

- **DryRunReport**: Represents preview analysis containing courseId (string), total_lessons (integer), lessons_needing_diagrams (integer), lessons_with_existing_diagrams (integer), total_cards_with_diagrams (integer), estimated_tokens (integer), estimated_cost_usd (float), lessons_details (array of per-lesson breakdowns)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate diagrams for a single lesson (3-5 cards with mathematical content) in under 5 minutes from command execution to Appwrite persistence completion
- **SC-002**: Batch mode processes 20 lessons without manual intervention, with all successes and errors reported in final summary
- **SC-003**: System achieves ≥90% diagram acceptance rate on first generation attempt (score ≥0.85 without refinement iterations)
- **SC-004**: Dry-run mode completes cost preview analysis for 50-lesson course in under 60 seconds
- **SC-005**: Error messages provide actionable next steps in 100% of validation failure cases (invalid courseId format, missing lesson template, unreachable service)
- **SC-006**: Generated diagrams meet quality threshold (≥0.85 across 4 dimensions) in 100% of accepted cases
- **SC-007**: System tracks costs with ≤5% margin of error compared to actual Claude API billing statements
- **SC-008**: Batch mode skips existing diagrams correctly, reducing redundant API costs by ≥80% on subsequent runs
- **SC-009**: Force regeneration mode successfully overwrites existing diagrams in 100% of cases where --force flag is provided
- **SC-010**: System fails fast with clear error messages in ≤2 seconds when DiagramScreenshot service is unreachable (no retries or timeouts beyond 30s)
- **SC-011**: Workspace cleanup succeeds in 100% of cases when --no-persist-workspace is provided, with no orphaned files
- **SC-012**: System completes single-lesson generation using ≤500MB memory footprint (no memory leaks from large lesson templates)
- **SC-013**: Interactive mode collects valid user input in ≤3 prompts (courseId, order, confirmation) with clear examples provided
- **SC-014**: Cost tracking reports include per-subagent breakdown showing Diagram Author vs Visual Critic token usage separately
- **SC-015**: System maintains ≤2% error rate across 1000-lesson corpus processing (partial failure model prevents cascading failures)

## Assumptions *(documented defaults)*

1. **DiagramScreenshot Service Availability**: Service runs at http://localhost:3001 with /health and /render endpoints available. If service moves to production URL, configuration change required.

2. **Appwrite Schema Pre-existence**: Collection default.lesson_diagrams already exists with appropriate attributes (lessonTemplateId string, cardId string, jsxgraph_json string, image_base64 string, diagram_type string, visual_critique_score number, critique_iterations number, critique_feedback JSON). If collection doesn't exist, system throws exception (no auto-creation).

3. **Image Storage Strategy**: Base64 images stored inline in Appwrite documents. For typical mathematical diagrams (50-200KB PNG), this fits within 5MB Appwrite document size limit. If future diagrams exceed 1MB, consider migration to cloud storage (AWS S3) with URL references.

4. **Quality Threshold Constant**: Acceptance threshold ≥0.85 is fixed based on LangGraph implementation precedent. If curriculum requirements change, threshold becomes configurable parameter.

5. **Refinement Iteration Limit**: Maximum 3 attempts per diagram is industry standard for LLM refinement loops. Prevents infinite loops while allowing reasonable improvement cycles.

6. **Cost Calculation Model**: Uses Claude Sonnet 4.5 pricing ($3/M input tokens, $15/M output tokens) as of January 2025. If model or pricing changes, CostTracker requires update.

7. **Batch Processing Scale**: System designed for courses with up to 50 lessons. For larger courses (100+ lessons), consider adding progress indicators and chunked processing.

8. **Scottish Visual Guidelines**: Diagrams use predefined color palette (Primary Blue #0066CC, Success Green #28a745, Warning Orange #FFA500, Danger Red #DC3545, Neutral Gray #6c757d) consistent with Scottish educational standards.

9. **Card Eligibility Heuristics**: System identifies diagram needs based on cardType and content keywords (mathematical terms, geometric references, data visualization mentions). If heuristics miss edge cases, manual curation required.

10. **Workspace Persistence Default**: Workspaces preserved by default (persist=True) for debugging and audit trail. Production automation should use --no-persist-workspace to avoid disk accumulation.

## Out of Scope

- Diagram editing UI for manual refinement after generation
- Batch processing parallelization (sequential processing only in MVP)
- Cloud storage integration for large images (inline base64 only)
- Diagram versioning system (overwrites only, no history)
- Real-time preview of diagrams during generation (fire-and-forget API model)
- Custom quality threshold configuration (fixed at 0.85)
- Diagram type classification beyond geometry/algebra/statistics
- Integration with LangGraph-based diagram agent (Claude-only implementation)
- Frontend component for diagram browsing/management
- Diagram export to SVG/PDF formats (PNG only)

