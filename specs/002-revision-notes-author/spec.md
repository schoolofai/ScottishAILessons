# Feature Specification: Course Revision Notes Author Agent

**Feature Branch**: `002-revision-notes-author`
**Created**: 2025-11-09
**Status**: Draft
**Input**: User description: "I want to create a new agent in @claud_author_agent/ using claude Agent SDK similar to the other authors - but this time it should be a course revision notes author - the goal of this author is to create quick revision notes using state of the art notes taking and pedagogical methods for a course with an SOW specified in the default database in appwrite document Authored_sow. it will take the following as input - 1. Authored_sow  2. associated lesson_templats 2. course_data.txt as with other agents like @claud_author_agent/src/sow_author_claude_client.py 3. associated course_outcome document from appwrite 4. lesson diagrams both of daigram context cfu and lesson  . It will use these inputs to  produce 1.  a course level cheat sheet - a quick revision guide for all lessons and outcomes for the courese 2. per lesson  quick notes. it will produce these as markdown files in its current working directory. the structure of the agent should be similar to other agents like @claud_author_agent/src/lesson_author_claude_client.py with pre processing , agent and post processing state. Pre processing will put all the data needed by the agent as input in the cwd . the agent will produce outputs as makdown files in cwd . the post processiong will upsert the revision notes to appwirte - revision notes in appwrite will need a data model design it and put in spec."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Course-Level Cheat Sheet (Priority: P1)

A teacher or student needs a comprehensive, single-page revision guide that summarizes the entire course across all lessons and learning outcomes. This cheat sheet consolidates key concepts, formulas, definitions, and assessment standards using evidence-based note-taking techniques.

**Why this priority**: The course-level cheat sheet is the most valuable artifact for exam preparation. It provides a bird's-eye view that helps students understand how concepts connect across lessons. This is the minimum viable product that delivers immediate value.

**Independent Test**: Can be fully tested by providing a valid courseId with existing SOW and lesson templates, and verifying that a single markdown file (course_cheat_sheet.md) is generated containing all major topics, outcomes, and key concepts from the course.

**Acceptance Scenarios**:

1. **Given** a course with published SOW and 10 lesson templates, **When** the revision notes author agent is executed with the courseId, **Then** a course_cheat_sheet.md file is created containing sections for all 10 lessons with key takeaways.
2. **Given** a course includes visual diagrams in lesson templates, **When** the course cheat sheet is generated, **Then** references to diagram concepts are included as text descriptions or diagram identifiers.
3. **Given** the course has defined learning outcomes from SQA standards, **When** the cheat sheet is created, **Then** each outcome is mapped to relevant lesson content with key points for revision.
4. **Given** generation succeeds, **When** the cheat sheet file is created, **Then** it is written to the agent's current working directory and uploaded to Appwrite revision_notes collection.

---

### User Story 2 - Generate Per-Lesson Quick Notes (Priority: P2)

Students need focused, lesson-specific revision notes that break down complex teaching content into digestible summaries. Each lesson's notes include worked examples, key misconceptions to avoid, and checkpoint questions aligned with the lesson's cards.

**Why this priority**: Per-lesson notes support targeted revision when students need to review specific topics. They complement the course cheat sheet by providing depth for individual lessons. This is valuable but can be delivered after P1.

**Independent Test**: Can be tested independently by generating notes for a single lesson (e.g., order=1 for a given courseId) and verifying that a lesson_notes_01.md file is created with sections for each card type (explainer, worked example, practice, CFU).

**Acceptance Scenarios**:

1. **Given** a lesson template with 8 cards (3 explainers, 2 worked examples, 2 practice, 1 CFU), **When** lesson notes are generated, **Then** the lesson_notes markdown includes distinct sections for each card type with summarized content.
2. **Given** a lesson includes misconceptions defined in cards, **When** lesson notes are created, **Then** a "Common Misconceptions" section lists each misconception with clarifying guidance.
3. **Given** lesson templates reference lesson diagrams, **When** per-lesson notes are generated, **Then** diagram concepts are incorporated as visual references or textual descriptions.
4. **Given** multiple lessons exist for a course, **When** the agent completes, **Then** each lesson has a separate markdown file named lesson_notes_{order:02d}.md in the workspace.

---

### User Story 3 - Autonomous Pipeline with Pre/Post Processing (Priority: P3)

The system administrator or automated workflow needs to execute the revision notes generation end-to-end without manual intervention. The pipeline extracts all required data from Appwrite, runs the Claude Agent SDK authoring subagent, and uploads the completed notes back to Appwrite.

**Why this priority**: Automation is essential for scalability and consistency, but the core value is in note generation quality (P1/P2). This priority ensures the agent fits the existing architecture pattern but can be implemented after validating note quality.

**Independent Test**: Can be tested by providing only a courseId as input, and verifying that all pre-processing (extraction), agent execution (note generation), and post-processing (Appwrite upsert) steps complete without errors.

**Acceptance Scenarios**:

1. **Given** a valid courseId with published SOW, **When** the agent is executed, **Then** pre-processing extracts Authored_SOW, lesson_templates, course_data.txt, course_outcomes, and lesson_diagrams into the workspace directory.
2. **Given** the agent completes markdown generation, **When** post-processing runs, **Then** the course cheat sheet and all lesson notes are uploaded to the revision_notes collection with correct metadata (courseId, lessonOrder, noteType).
3. **Given** the agent encounters missing data (e.g., no diagrams exist), **When** pre-processing validates inputs, **Then** the system throws a detailed exception explaining what is missing (no fallback mechanisms).
4. **Given** the agent completes successfully, **When** the user queries the revision_notes collection, **Then** all generated notes are retrievable by courseId with status="published".

---

### Edge Cases

- **What happens when a course has no lesson diagrams?** lesson daigrams are optional - so please generate without any digarams - feel free to use ascii art for daigrams or generate mermaid diagrams , use markdown component that can render mermaid daigrams - the agent critic should render and validate any visuals using visual screenshots.
- **What happens when a lesson template is missing content for a specific card type (e.g., no worked examples)?** The agent SHOULD generate notes for available cards only and document the gap in a "Notes Coverage" section.
- **How does the system handle very large courses (e.g., 25+ lessons)?** The course cheat sheet MUST use hierarchical structuring (unit groupings) to maintain readability and avoid exceeding markdown file size limits.
- **What happens if SOW status is "draft" instead of "published"?** The system MUST throw a validation exception requiring published SOW status before proceeding (consistent with lesson author behavior).
- **How does the system handle concurrent revision note generation for the same course?** The Appwrite upsert logic MUST use atomic document replacement to prevent race conditions (last write wins with execution_id tracking).

## Requirements *(mandatory)*

### Functional Requirements

**Constitution Alignment**: All requirements MUST follow fast-fail principles (no fallback mechanisms). Use MUST for mandatory behavior, SHOULD for recommended but optional behavior. See `.specify/memory/constitution.md`.

- **FR-001**: System MUST accept courseId as the only required input parameter for revision note generation.
- **FR-002**: System MUST validate that the courseId exists in default.courses collection before proceeding (fail-fast).
- **FR-003**: System MUST validate that a published Authored_SOW document exists for the courseId (status="published") before proceeding.
- **FR-004**: System MUST extract and validate that at least one lesson_template document exists for the courseId.
- **FR-005**: System MUST extract course_data.txt from sqa_education.sqa_current collection based on course subject and level.
- **FR-006**: System MUST extract course_outcomes document(s) from sqa_education.course_outcomes collection based on course metadata.
- **FR-007**: System MUST extract lesson_diagrams (lesson, cfu_diagram, diagram_context types) associated with each lesson template.
- **FR-008**: System MUST throw detailed exceptions with context when required data is missing (no silent fallbacks).
- **FR-009**: System MUST create an isolated workspace directory for the execution using the same IsolatedFilesystem pattern as lesson_author_claude_client.py.
- **FR-010**: Pre-processing MUST write all extracted data into the workspace as files: Authored_SOW.json, lesson_templates/*.json, Course_data.txt, course_outcomes.json, lesson_diagrams/*.json.
- **FR-011**: System MUST configure Claude Agent SDK with the same permission_mode='bypassPermissions' and allowed_tools list as existing agents (Read, Write, Edit, Glob, Grep, TodoWrite, Task, WebSearch, WebFetch).
- **FR-012**: System MUST define a notes_author subagent using Claude Agent SDK's AgentDefinition with a prompt template loaded from prompts/notes_author_prompt.md.
- **FR-013**: Notes author subagent MUST generate a course_cheat_sheet.md file in the workspace containing course-level summaries.
- **FR-014**: Notes author subagent MUST generate per-lesson notes as separate markdown files: lesson_notes_01.md, lesson_notes_02.md, etc.
- **FR-015**: Course cheat sheet MUST include sections for: Course Overview, Learning Outcomes Summary, Key Concepts by Lesson, Assessment Standards, and Quick Reference.
- **FR-016**: Per-lesson notes MUST include sections for: Lesson Summary, Card-by-Card Breakdown, Worked Examples, Practice Problems, Common Misconceptions, and Checkpoint Questions.
- **FR-017**: Notes MUST incorporate pedagogical note-taking methods (e.g., Cornell Method headers, spaced repetition cues, concept mapping indicators).
- **FR-018**: System MUST incorporate lesson diagram content into notes using textual descriptions when diagrams are of type "lesson" or "cfu_diagram".
- **FR-019**: Post-processing MUST upsert all generated markdown files to a new Appwrite collection named revision_notes in the default database.
- **FR-020**: Each revision note document MUST include metadata: courseId, noteType (cheat_sheet or lesson_note), lessonOrder (null for cheat sheets, order number for lesson notes), status (draft or published), execution_id, markdown_file_id (Appwrite Storage file reference).
- **FR-021**: System MUST upload markdown content to Appwrite Storage bucket named "documents" and store the returned file ID in the revision note document's markdown_file_id field.
- **FR-022**: System MUST create the "documents" storage bucket in Appwrite as a one-time setup step using Appwrite MCP (if bucket does not already exist).
- **FR-023**: System MUST support versioning for revision notes (tracking updates when SOW or lessons are modified).
- **FR-024**: System MUST log detailed execution metrics: token usage, cost per subagent, total execution time.
- **FR-025**: System MUST provide a CLI interface matching the pattern of sow_author_cli.py and lesson_author_cli.py (--courseId, --mcp-config, --persist-workspace, --log-level flags).
- **FR-026**: System MUST persist workspace files when persist_workspace=True for debugging purposes.

### Key Entities

- **RevisionNote**: Represents a generated revision note document stored in Appwrite.
  - Attributes: courseId (string), noteType (enum: cheat_sheet | lesson_note), lessonOrder (integer, nullable), status (enum: draft | published), execution_id (string), markdown_file_id (string, Appwrite Storage file reference), created_at (datetime), updated_at (datetime)
  - Relationships: Associated with a single Course via courseId; lesson notes reference a specific lesson via lessonOrder; markdown content stored in Appwrite Storage "documents" bucket

- **NotesGenerationWorkspace**: Represents the isolated filesystem workspace created during execution.
  - Attributes: workspace_path (directory path), execution_id (string), input files (Authored_SOW.json, lesson_templates/, Course_data.txt, course_outcomes.json, lesson_diagrams/), output files (course_cheat_sheet.md, lesson_notes_*.md)
  - Relationships: Created per execution; cleaned up unless persist_workspace=True

- **NotesAuthorSubagent**: Represents the Claude Agent SDK subagent responsible for markdown generation.
  - Attributes: subagent_name ("notes_author"), prompt_template_path (prompts/notes_author_prompt.md), tools_available (Read, Write, WebSearch, WebFetch, etc.)
  - Relationships: Consumes workspace input files; produces workspace output markdown files

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Teachers can generate a complete course cheat sheet (covering 100% of lessons) in under 5 minutes from courseId input to Appwrite upload.
- **SC-002**: Generated cheat sheets include at least 90% of learning outcomes defined in the course_outcomes collection.
- **SC-003**: Per-lesson notes accurately reflect at least 95% of card content from the lesson template (measured by concept coverage).
- **SC-004**: Students rate the revision notes as "helpful for exam preparation" in 80% of user feedback surveys.
- **SC-005**: System completes end-to-end pipeline (pre-processing, agent execution, post-processing) without manual intervention in 100% of test cases with valid inputs.
- **SC-006**: System throws detailed exceptions (no silent failures) in 100% of test cases with invalid or missing data.
- **SC-007**: Generated markdown files are readable and well-formatted (pass linting checks) in 95% of executions.
- **SC-008**: Revision notes incorporate visual diagram content as textual descriptions in 100% of cases where diagrams exist.
- **SC-009**: Token usage per execution remains below 60,000 tokens for typical courses (10-15 lessons), keeping cost under $2.00.
- **SC-010**: Course cheat sheets reduce student revision time by 30% compared to manually reviewing all lesson templates.

## Assumptions

1. **Pedagogical Methods**: The notes author subagent will use evidence-based note-taking frameworks including Cornell Method structure (cues, notes, summary sections), spaced repetition indicators (review timing suggestions), and concept mapping (relationship indicators between topics).

2. **Diagram Handling**: Lesson diagrams stored in Appwrite contain textual metadata (alt text or descriptions) that can be extracted and incorporated into markdown notes. If diagrams lack text metadata, the agent will reference the diagram by file ID.

3. **Storage Strategy**: Markdown content will be uploaded to Appwrite Storage in the "documents" bucket as plain text files (no compression needed as Storage handles large files efficiently). The database will only store the file ID reference.

4. **SOW Status**: Only published SOWs (status="published") are valid for revision note generation, consistent with the lesson_author agent validation logic.

5. **Markdown Format**: Generated markdown will use standard CommonMark syntax with support for LaTeX math notation (enclosed in $ or $$) for mathematical expressions.

6. **Execution Environment**: The agent runs in an isolated workspace with the same security and permission model as existing agents (bypassPermissions mode for Claude Agent SDK).

7. **Concurrent Execution**: If multiple revision note generation jobs run concurrently for the same course, Appwrite document upserts use atomic replacement with execution_id tracking to ensure data consistency.

8. **Lesson Order**: Lesson order values in SOW entries are 1-indexed (starting from 1), matching the convention used by lesson_author agent.

9. **Course Outcomes Format**: Course outcomes are stored in sqa_education.course_outcomes with a structure that includes outcome codes, descriptions, and assessment standard mappings.

10. **CLI Compatibility**: The revision notes author CLI will follow the same argument patterns as sow_author_cli.py and lesson_author_cli.py for consistency in user experience.

## Data Model: revision_notes Collection

The `revision_notes` collection in the `default` database will store generated revision notes with the following attributes:

### Required Attributes

| Attribute | Type | Size/Constraint | Description | Example |
| --------- | ---- | --------------- | ----------- | ------- |
| courseId | String | 50 chars, required | Course identifier linking to default.courses | "course_c84874" |
| noteType | String (enum) | 20 chars, required | Type of note: "cheat_sheet" or "lesson_note" | "cheat_sheet" |
| lessonOrder | Integer | nullable | Lesson order number (null for cheat sheets, 1-based for lesson notes) | 3 |
| status | String (enum) | 20 chars, required | Publication status: "draft" or "published" | "published" |
| execution_id | String | 50 chars, required | Unique execution identifier for traceability | "20251109_143052" |
| markdown_file_id | String | 50 chars, required | Appwrite Storage file ID referencing markdown content in "documents" bucket | "file_abc123xyz" |
| version | String | 10 chars, default="1" | Version number for tracking updates | "1" |
| sow_version | String | 10 chars, nullable | Version of the SOW used for generation | "1" |

### Optional Metadata Attributes

| Attribute | Type | Size/Constraint | Description |
| --------- | ---- | --------------- | ----------- |
| token_usage | Integer | nullable | Total tokens used for generation |
| cost_usd | Float | nullable | Estimated cost in USD |
| workspace_path | String | 200 chars, nullable | Path to workspace (if persisted) |
| generation_timestamp | Datetime | required | When the note was generated |

### Indexes

- Primary: `$id` (Appwrite auto-generated)
- Unique composite: `(courseId, noteType, lessonOrder)` - prevents duplicate notes for the same course/lesson
- Query index: `courseId` - for fetching all notes for a course
- Query index: `(courseId, noteType)` - for fetching course cheat sheet vs lesson notes

### Permissions

- Read: Any authenticated user (students and teachers)
- Create/Update: Admin users and the authoring agent service account
- Delete: Admin users only

### Relationships

- `courseId` → `default.courses.courseId` (many-to-one: multiple revision notes per course)
- For lesson notes: implicit relationship to `default.lesson_templates` via `(courseId, lessonOrder)`
- `markdown_file_id` → Appwrite Storage "documents" bucket (one-to-one: each revision note references one markdown file)

### Document ID Format

- Course cheat sheet: `revision_notes_{courseId}_cheat_sheet`
- Lesson notes: `revision_notes_{courseId}_lesson_{lessonOrder:02d}`

Example: `revision_notes_course_c84874_lesson_03`

## Storage Bucket: documents

The `documents` storage bucket will store markdown content files with the following configuration:

### Bucket Configuration

| Property | Value | Description |
| -------- | ----- | ----------- |
| Bucket ID | "documents" | Unique identifier for the bucket |
| Name | "Documents" | Human-readable name |
| Permissions | Read: Any authenticated user; Create/Update/Delete: Admin and service accounts | Matches security model of images bucket |
| File Size Limit | 50 MB | Maximum file size (markdown files typically <1 MB) |
| Allowed Extensions | .md, .txt | Only markdown and text files |
| Encryption | Enabled | At-rest encryption for stored files |
| Antivirus | Enabled | Scan files on upload |

### File Naming Convention

Markdown files uploaded to storage will use the same naming pattern as document IDs:

- Course cheat sheet: `revision_notes_{courseId}_cheat_sheet.md`
- Lesson notes: `revision_notes_{courseId}_lesson_{lessonOrder:02d}.md`

Example: `revision_notes_course_c84874_lesson_03.md`

### One-Time Setup

The "documents" bucket MUST be created using Appwrite MCP before the first revision notes generation. The setup script will:

1. Check if "documents" bucket exists
2. If not, create bucket with configuration above
3. Set appropriate permissions for read/write access
4. Enable encryption and antivirus scanning

This is analogous to the "images" bucket used for lesson diagrams.
