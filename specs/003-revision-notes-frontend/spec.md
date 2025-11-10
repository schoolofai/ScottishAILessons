# Feature Specification: Revision Notes Frontend Integration

**Feature Branch**: `003-revision-notes-frontend`
**Created**: 2025-11-10
**Status**: Draft
**Input**: User description: "we have just added review notes per lesson and cheat sheet a course as per - @specs/002-revision-notes-author/spec.md now we need to add front end support for it. Currently each enrolled subject has a tab on /dashboard in the frontend @assistant-ui-frontend/ . the lessons are in a list format as in [Image #1]. as you can see from @specs/002-revision-notes-author/spec.md each course has one course level cheat sheet and a markdown file for that and for each lesson there is one lesson quick review note. the course level cheat sheet should be linked in the course tab at the course level - each lesson on the other hand should be accessible from the lesson item in the list rendered by a markdown renderer that has support for mermaid diagrams and general latex for maths and sciences so research a full featured markdown component. The lesson summary should also be accessible as a collapsible side panel in the lesson @assistant-ui-frontend/components/SessionChatAssistant.tsx component."

## Clarifications

### Session 2025-11-10

- Q: Which markdown rendering library stack should be used for revision notes? → A: React Markdown + KaTeX + Mermaid (battle-tested, spec-mentioned, moderate bundle)
- Q: How should modals be implemented for displaying course cheat sheets and lesson notes? → A: Radix UI Dialog or Headless UI (accessible, headless components, recommended)
- Q: What caching strategy should be used for markdown files? (Note: FR-020 says "no aggressive caching" but Assumption 8 says "acceptable" - clarification needed) → A: Fetch on open, cache in memory until modal close (balanced, good UX)
- Q: What loading state UI should display while fetching markdown files? → A: Skeleton UI matching markdown structure (recommended, modern UX, reduces perceived latency)
- Q: How should the retry mechanism behave for failed markdown fetches? (FR-016 mentions retry but doesn't specify limits) → A: Unlimited retries with exponential backoff hint (recommended, user-friendly, respects fast-fail)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Course-Level Cheat Sheet from Dashboard (Priority: P1)

A student preparing for an exam needs quick access to a comprehensive revision cheat sheet that summarizes all lessons and learning outcomes for the entire course. This cheat sheet should be easily accessible from the course tab on the dashboard before diving into individual lessons.

**Why this priority**: The course-level cheat sheet provides the highest value for exam preparation and course overview. It's the entry point for revision and helps students understand what they've learned across all lessons. This is the most critical deliverable that provides immediate value.

**Independent Test**: Can be fully tested by navigating to a course tab on the dashboard and verifying that a "Course Cheat Sheet" link is visible and clickable. Clicking the link should open a modal or dedicated page displaying the full markdown content with proper rendering of LaTeX math expressions and Mermaid diagrams.

**Acceptance Scenarios**:

1. **Given** a student is viewing their enrolled course tab on the dashboard, **When** they look at the course header section, **Then** they see a clearly labeled "Course Cheat Sheet" or "Quick Revision Guide" button/link.
2. **Given** the student clicks the course cheat sheet link, **When** the content loads, **Then** the markdown content displays properly with all sections (Course Overview, Learning Outcomes, Key Concepts, Assessment Standards, Quick Reference) rendered correctly.
3. **Given** the cheat sheet contains LaTeX math expressions (e.g., `$\frac{1}{2}$` or `$$E=mc^2$$`), **When** the content renders, **Then** all mathematical notation displays as properly formatted equations.
4. **Given** the cheat sheet contains Mermaid diagram syntax, **When** the content renders, **Then** all diagrams display as visual graphics (flowcharts, concept maps, etc.).
5. **Given** the student finishes reviewing the cheat sheet, **When** they close the modal or navigate back, **Then** they return to the course dashboard tab without losing their place.

---

### User Story 2 - Access Lesson Quick Notes from Lesson List (Priority: P2)

A student reviewing individual lessons needs quick access to concise lesson summaries that break down card content, worked examples, and key misconceptions. These notes should be accessible directly from the lesson list item in the course curriculum.

**Why this priority**: Per-lesson notes support targeted revision when students need to review specific topics. They complement the course cheat sheet by providing depth for individual lessons. This is valuable but can be delivered after P1 since the course cheat sheet provides the overview.

**Independent Test**: Can be tested independently by navigating to a course curriculum section, selecting any lesson in the list, and verifying that a "Quick Notes" or "Lesson Summary" link appears. Clicking the link should open a modal or expandable section displaying the lesson-specific markdown content.

**Acceptance Scenarios**:

1. **Given** a student is viewing the course curriculum lesson list, **When** they hover over or click a lesson item, **Then** they see a "Quick Notes" or "Lesson Summary" icon/button alongside existing lesson actions (Start Lesson, Retake Lesson, View History).
2. **Given** the student clicks the lesson quick notes button, **When** the modal or expandable section opens, **Then** the lesson-specific markdown content displays with sections for Lesson Summary, Card-by-Card Breakdown, Worked Examples, Practice Problems, Common Misconceptions, and Checkpoint Questions.
3. **Given** the lesson notes contain LaTeX expressions, **When** the content renders, **Then** all mathematical notation displays correctly.
4. **Given** the lesson notes contain Mermaid diagrams, **When** the content renders, **Then** all diagrams display as visual graphics.
5. **Given** multiple lessons exist for the course, **When** the student accesses quick notes for different lessons, **Then** each lesson displays its unique lesson-specific content (not the course cheat sheet).

---

### User Story 3 - View Lesson Summary in Side Panel During Active Session (Priority: P3)

A student actively working through a lesson needs access to the lesson quick notes without leaving the teaching interface. A collapsible side panel in the SessionChatAssistant component allows students to reference key concepts, worked examples, and misconceptions while engaging with the AI tutor.

**Why this priority**: The in-lesson side panel provides contextual support during active learning sessions. While valuable, it's less critical than dashboard-level access (P1/P2) because students can review notes before starting the lesson. This is a UX enhancement that improves the learning experience but doesn't block core revision functionality.

**Independent Test**: Can be tested by starting any lesson session and verifying that a "Lesson Notes" toggle button appears in the SessionChatAssistant UI. Clicking the toggle should expand/collapse a side panel displaying the lesson quick notes alongside the main teaching panel.

**Acceptance Scenarios**:

1. **Given** a student is in an active lesson session (SessionChatAssistant component), **When** the session loads, **Then** they see a "Lesson Notes" or "Quick Reference" toggle button in the UI (e.g., top-right corner or alongside the AI Tutor chat bubble).
2. **Given** the student clicks the lesson notes toggle button, **When** the side panel expands, **Then** the lesson quick notes markdown content displays in a resizable side panel (similar to the existing Context Chat panel).
3. **Given** the lesson notes side panel is open, **When** the student interacts with the main teaching panel (answering questions, viewing cards), **Then** the side panel remains visible and accessible without overlapping critical UI elements.
4. **Given** the lesson notes side panel is open, **When** the student drags the resize handle, **Then** the panel width adjusts between 20% and 50% of the screen width (matching Context Chat behavior).
5. **Given** the student closes the lesson notes side panel, **When** they click the toggle button again, **Then** the panel collapses and the main teaching panel expands to full width.
6. **Given** the lesson notes contain LaTeX and Mermaid content, **When** the side panel renders, **Then** all mathematical notation and diagrams display correctly in the constrained panel width.

---

### Edge Cases

- **What happens when a course has no generated cheat sheet?** The system MUST display a user-friendly message stating "Course Cheat Sheet not yet available" and disable the cheat sheet button/link (no silent failures).
- **What happens when a lesson has no quick notes generated?** The system MUST display a message stating "Lesson notes not yet available" and disable the quick notes button/link for that specific lesson.
- **How does the system handle very large markdown files (e.g., 50+ page cheat sheets)?** The markdown renderer MUST support lazy loading or virtualization to prevent UI freezing. If file size exceeds 5MB, warn the user and offer to download the file instead of rendering inline.
- **What happens if the markdown file contains malformed Mermaid syntax?** The markdown renderer MUST display an error message for the specific diagram block (e.g., "Diagram rendering failed") and continue rendering the rest of the content (no crash).
- **What happens if the markdown file contains malformed LaTeX syntax?** The markdown renderer MUST display the raw LaTeX code with a visual indicator (e.g., red highlighting) showing the malformed expression and continue rendering the rest of the content.
- **How does the system handle concurrent access to the same revision note by multiple sessions?** The system MUST fetch the latest version of the markdown file from Appwrite Storage on each access (no stale caching issues).
- **What happens if the Appwrite Storage bucket is unreachable when fetching markdown files?** The system MUST throw a detailed error message (e.g., "Failed to load revision notes: Storage service unavailable") and provide a retry button. Users may retry unlimited times (no hard limit), but if 3+ rapid retries fail within 30 seconds, the UI should display an exponential backoff hint (e.g., "Consider waiting a moment before trying again") to guide users toward successful retry patterns.
- **How does the lesson notes side panel interact with the existing Context Chat panel?** Only ONE side panel can be open at a time. Opening Lesson Notes MUST auto-collapse Context Chat, and vice versa (prevent overlapping panels).
- **What is the caching behavior for the lesson notes side panel (non-modal)?** The side panel MUST fetch markdown content when the lesson session starts (or when the side panel is first opened), cache it in memory for the duration of the lesson session, and clear the cache when the lesson session ends. This differs from modal caching (which clears on modal close) because the side panel may be toggled multiple times during a single lesson.

## Requirements *(mandatory)*

### Functional Requirements

**Constitution Alignment**: All requirements MUST follow fast-fail principles (no fallback mechanisms). Use MUST for mandatory behavior, SHOULD for recommended but optional behavior. See `.specify/memory/constitution.md`.

- **FR-001**: System MUST fetch course-level cheat sheet markdown content from Appwrite Storage using the `markdown_file_id` field in the `revision_notes` collection (filtered by `courseId` and `noteType="cheat_sheet"`).
- **FR-002**: System MUST fetch lesson-level quick notes markdown content from Appwrite Storage using the `markdown_file_id` field in the `revision_notes` collection (filtered by `courseId`, `noteType="lesson_note"`, and `lessonOrder`).
- **FR-003**: System MUST display a course cheat sheet access button/link in the course tab header on the EnhancedStudentDashboard component.
- **FR-004**: System MUST display a lesson quick notes access button/link for each lesson item in the CourseCurriculum component.
- **FR-005**: System MUST render markdown content using a full-featured markdown component that supports CommonMark syntax, LaTeX math notation (inline `$...$` and display `$$...$$`), and Mermaid diagrams.
- **FR-006**: System MUST display course cheat sheet content in a modal dialog when the user clicks the cheat sheet button (preserving dashboard context for easy return). Modal implementation MUST use Radix UI Dialog or Headless UI for accessible, ARIA-compliant modals with proper focus management.
- **FR-007**: System MUST display lesson quick notes content in a modal dialog when the user clicks the lesson notes button from the lesson list. Modal implementation MUST use the same accessible modal component as FR-006.
- **FR-008**: System MUST add a "Lesson Notes" toggle button in the SessionChatAssistant component that expands/collapses a side panel displaying the current lesson's quick notes.
- **FR-009**: Lesson notes side panel MUST use the same resizable panel pattern as the existing Context Chat panel (drag handle, width constraints 20%-50%).
- **FR-010**: System MUST ensure only one side panel is open at a time in SessionChatAssistant (Lesson Notes vs Context Chat - opening one MUST auto-collapse the other).
- **FR-011**: System MUST throw detailed exceptions when markdown files cannot be fetched from Appwrite Storage (no silent fallbacks, fast-fail with user-visible error messages).
- **FR-012**: System MUST disable cheat sheet and lesson notes buttons when the corresponding `revision_notes` document does not exist in Appwrite (display "Not yet available" message).
- **FR-013**: System MUST validate that markdown files are fetched using the correct document ID format: `revision_notes_{courseId}_cheat_sheet` for course cheat sheets, `revision_notes_{courseId}_lesson_{lessonOrder:02d}` for lesson notes.
- **FR-014**: System MUST handle malformed Mermaid diagram syntax by displaying an error message for the specific diagram block and continuing to render the rest of the content (no crash).
- **FR-015**: System MUST handle malformed LaTeX syntax by displaying the raw LaTeX code with a visual error indicator and continuing to render the rest of the content (no crash).
- **FR-016**: System MUST provide a retry mechanism when markdown file fetching fails due to network or storage errors. The retry button MUST be user-triggered (no automatic retries). Users MAY retry unlimited times (no hard limit). If multiple rapid retries fail (e.g., 3+ retries within 30 seconds), the UI SHOULD display a hint suggesting to wait before retrying (e.g., "Consider waiting a moment before trying again"). This respects fast-fail principles while supporting users with transient network issues.
- **FR-017**: System MUST use a markdown renderer that supports syntax highlighting for code blocks (optional but recommended for better pedagogical content).
- **FR-018**: System MUST ensure markdown content is responsive and readable on mobile devices (font size, scroll behavior, diagram scaling).
- **FR-021**: System MUST display a skeleton UI loading state while fetching markdown files. The skeleton MUST match the expected markdown structure (heading placeholders, paragraph blocks, code block placeholders) to reduce perceived latency and provide visual feedback that content is loading.
- **FR-019**: System SHOULD implement lazy loading or virtualization for very large markdown files (>5MB) to prevent UI freezing.
- **FR-020**: System MUST fetch the latest version of markdown files on each modal open (defined as "each access"). Markdown content MAY be cached in memory during a single viewing session (while the modal is open) for performance optimization, but the cache MUST be cleared when the modal closes to ensure fresh content on subsequent accesses.

### Key Entities

- **RevisionNoteDisplay**: Represents the rendered revision note UI component displayed in modals or side panels.
  - Attributes: courseId (string), noteType (enum: cheat_sheet | lesson_note), lessonOrder (integer, nullable), markdownContent (string), renderingStatus (enum: loading | success | error)
  - Loading State: When renderingStatus is "loading", the component MUST display a skeleton UI with placeholders for headings, paragraphs, and code blocks that match the expected markdown structure. This reduces perceived latency and provides visual feedback.
  - Relationships: Associated with a single Course via courseId; lesson notes reference a specific lesson via lessonOrder

- **MarkdownRenderer**: Represents the full-featured markdown rendering component used across all revision note displays.
  - Attributes: markdownSource (string), supportsLaTeX (boolean), supportsMermaid (boolean), supportsSyntaxHighlighting (boolean)
  - Capabilities: Renders CommonMark markdown, LaTeX math expressions (inline and display), Mermaid diagrams, syntax-highlighted code blocks

- **SidePanelState**: Represents the state management for side panels in SessionChatAssistant.
  - Attributes: activeSidePanel (enum: context_chat | lesson_notes | none), panelWidth (number, percentage), isResizing (boolean)
  - Relationships: Manages mutual exclusivity between Context Chat and Lesson Notes panels

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students can access the course cheat sheet from the dashboard in under 5 seconds (from tab selection to content display).
- **SC-002**: Students can access lesson quick notes from the lesson list in under 3 seconds (from button click to content display).
- **SC-003**: The markdown renderer successfully displays 100% of LaTeX expressions and Mermaid diagrams in generated revision notes (tested across 10+ courses).
- **SC-004**: Students rate the revision notes feature as "helpful for exam preparation" in 85% of user feedback surveys.
- **SC-005**: The lesson notes side panel in SessionChatAssistant does not interfere with the main teaching interaction (measured by task completion rates remaining above 90%).
- **SC-006**: System throws detailed error messages in 100% of cases where markdown files cannot be fetched (no silent failures).
- **SC-007**: The markdown renderer handles malformed syntax gracefully in 100% of edge cases (no UI crashes or blank screens).
- **SC-008**: Students can resize the lesson notes side panel smoothly without lag or glitches (measured by frame rate remaining above 30 FPS during resize).
- **SC-009**: Revision notes are accessible on mobile devices with readable font sizes and properly scaled diagrams in 95% of test cases.
- **SC-010**: Students reduce exam preparation time by 25% when using revision notes compared to reviewing all lesson templates manually (measured via user surveys and time tracking).

## Assumptions

1. **Backend Availability**: The revision notes generation backend (spec 002) has already populated the `revision_notes` collection in Appwrite with valid markdown files for at least one course and its lessons.

2. **Markdown Renderer Selection**: The frontend MUST use `react-markdown` with the following plugin stack: `remark-math` + `rehype-katex` for LaTeX rendering, and `rehype-mermaid` (or `remark-mermaid-simple`) for Mermaid diagram support. This provides a battle-tested, moderate bundle size solution with excellent ecosystem support. No custom markdown parser will be built from scratch.

3. **Appwrite Storage Access**: The frontend can fetch markdown files from the Appwrite Storage "documents" bucket using the Appwrite Client SDK with proper read permissions for authenticated students.

4. **Document ID Format**: The document IDs in the `revision_notes` collection follow the exact format specified in spec 002: `revision_notes_{courseId}_cheat_sheet` for course cheat sheets, `revision_notes_{courseId}_lesson_{lessonOrder:02d}` for lesson notes.

5. **UI Placement**: The course cheat sheet button will be placed in the course tab header (alongside course title and progress metrics), and lesson quick notes buttons will be placed in each lesson list item (alongside "Start Lesson" and "View History" buttons).

6. **Side Panel Behavior**: The lesson notes side panel in SessionChatAssistant will use the same implementation pattern as the existing Context Chat panel (resize handle, collapse/expand toggle, width constraints).

7. **Modal vs Inline Display**: Course cheat sheets and lesson quick notes accessed from the dashboard will display in modal dialogs using Radix UI Dialog or Headless UI (accessible, headless components with built-in focus management and ARIA patterns). These modals preserve dashboard context by overlaying the UI. The in-lesson side panel will be an inline collapsible panel (not a modal).

8. **Content Freshness**: Markdown files are relatively static (updated only when SOW or lessons change). The system will fetch markdown files from Appwrite Storage on each modal open, cache the content in memory during the viewing session, and clear the cache when the modal closes. This ensures fresh content on each access while optimizing UX performance during a single viewing session. Persistent caching (localStorage, sessionStorage) is NOT used to avoid stale content issues.

9. **Error Handling**: All markdown fetching errors will be displayed to the user with actionable retry buttons (no silent logging or fallback to empty content).

10. **LaTeX Rendering Library**: The frontend will use KaTeX (not MathJax) for LaTeX rendering due to its faster performance and smaller bundle size.

11. **Mermaid Rendering Strategy**: Mermaid diagrams will be rendered client-side using the official Mermaid library (not server-side pre-rendering) to support dynamic theme switching and responsive sizing.

12. **Accessibility**: The markdown renderer will generate semantic HTML with proper heading hierarchy, alt text for diagrams (where available), and keyboard-navigable UI controls.
