# Notes Author Subagent Interface Contract

**Agent**: `notes_author`
**Purpose**: Generate pedagogically-sound revision notes from SOW and lesson content
**Version**: 1.0.0

## Inputs (Workspace Files)

### Required Files

| File Path | Format | Description | Validation |
|-----------|--------|-------------|------------|
| `inputs/Authored_SOW.json` | JSON | Decompressed SOW with entries array | Must have `entries` array with order, label, outcomes |
| `inputs/Course_data.txt` | Plain text | SQA course standards | Non-empty file |
| `inputs/course_outcomes.json` | JSON | Array of outcome objects | Must have outcome_code, outcome_description |
| `inputs/lesson_templates/*.json` | JSON | One file per lesson (lesson_01.json, etc.) | Decompressed cards array |
| `inputs/lesson_diagrams/*.json` | JSON | Diagram metadata files | Must have diagramType, image_file_id |

### File Content Contracts

**Authored_SOW.json**:
```typescript
interface AuthoredSOW {
  courseId: string;
  version: string;
  status: "published";  // Only published SOWs processed
  entries: SOWEntry[];
}

interface SOWEntry {
  order: number;           // 1-indexed lesson order
  label: string;          // Lesson title
  lesson_type: "teach" | "practice" | "assess" | "review" | "mock_exam";
  estMinutes: number;
  outcomes: string[];     // Array of outcome codes (e.g., ["MTH_3_07a"])
  key_concepts?: string[];
  worked_examples?: any[];
  practice_problems?: any[];
}
```

**lesson_templates/{order}.json**:
```typescript
interface LessonTemplate {
  $id: string;
  courseId: string;
  sow_order: number;
  lessonTemplateId: string;
  lesson_type: string;
  estMinutes: number;
  cards: LessonCard[];  // MUST be decompressed array
}

interface LessonCard {
  id: string;  // card_001, card_002, ...
  type: "explainer" | "worked_example" | "practice" | "cfu";
  explainer?: string;         // Markdown with LaTeX
  explainer_plain?: string;   // Plain text version
  misconceptions?: string[];  // MISC_SUBJECT_TOPIC_NNN format
  rubric?: RubricData;
  // ... other card-specific fields
}
```

**course_outcomes.json**:
```typescript
interface CourseOutcome {
  outcome_code: string;        // E.g., "MTH_3_07a"
  outcome_description: string; // Full text description
  assessment_standards?: string[];
}
```

**lesson_diagrams/{id}.json**:
```typescript
interface LessonDiagram {
  $id: string;
  diagramType: "lesson" | "cfu_diagram" | "diagram_context";
  image_file_id: string;        // Appwrite storage file ID
  alt_text?: string;            // Brief description
  diagram_context?: string;     // Rich description of purpose
}
```

---

## Outputs (Workspace Files)

### Required Outputs

| File Path | Format | Description | Validation |
|-----------|--------|-------------|------------|
| `outputs/course_cheat_sheet.md` | Markdown | Course-level summary | Must exist, non-empty, follows structure |
| `outputs/lesson_notes_{order:02d}.md` | Markdown | Per-lesson notes (01, 02, etc.) | One file per lesson template |

### Markdown Structure Contracts

**course_cheat_sheet.md**:
```markdown
# [Course Title] - Quick Revision Guide

## Course Overview
- **Subject**: [e.g., Mathematics]
- **Level**: [e.g., National 5]
- **Total Lessons**: [count]
- **Key Assessment Standards**: [codes]

## Learning Outcomes Summary
1. [outcome_code]: [description] - Covered in Lessons [X, Y]
...

## Lessons at a Glance

### Lesson [N]: [Title]
**Key Concepts**:
- [3-5 bullet points from SOW key_concepts and lesson cards]

**Must Remember**:
- [Critical formula/rule from explainer cards]

**Common Mistake**:
- ❌ [Misconception from cards]
- ✓ [Correct understanding]

**Quick Check**:
- [1 practice question from CFU cards]

[Repeat for each lesson...]

## Quick Reference
### Formulas Sheet
[Consolidated formulas from all lessons]

### Misconceptions to Avoid
[Consolidated misconceptions from all lessons]

### Assessment Standard Checklist
- [ ] [Standard]: Practice with Lesson [X]
...
```

**Formatting Requirements**:
- Use `###` for lesson headings (H3 level)
- Use bullet lists for key concepts
- Use ❌ and ✓ emoji for misconceptions
- Use `**bold**` for emphasis
- Use LaTeX notation: `$...$` inline, `$$...$$` display
- Target 150-250 words per lesson summary

---

**lesson_notes_{order:02d}.md** (e.g., `lesson_notes_03.md`):
```markdown
# Lesson [N]: [Title]

## Lesson Summary
**Duration**: [X minutes] | **Type**: [teach/practice/assess]
**Prerequisites**: [→ See: Lesson M - Topic] (if applicable)
**Builds Toward**: [→ See: Lesson P - Topic] (if applicable)

## Card-by-Card Breakdown

### Card [N]: [Card Type] - [Topic/Title]

| Cue/Question | Core Concept | Worked Example |
|--------------|--------------|----------------|
| [Key question from card] | [Main concept from explainer] | [Worked example steps if available] |

**Key Learning**:
- [Main point 1 from explainer]
- [Main point 2]

[If worked example exists]:
**Worked Example**:
1. [Step 1]
2. [Step 2]
3. [Answer]

[If practice problem exists]:
**Practice**: [Problem statement]

---

[Repeat for each card in lesson...]

## Common Misconceptions

❌ **Mistake**: [misconception_id description]
✓ **Correct**: [Clarification]
**Why This Matters**: [Context from card rubric or explainer]

[Repeat for all misconceptions in lesson...]

## Checkpoint Questions

1. [CFU question 1 - from cfu cards]
2. [CFU question 2]

**Answers**:
1. [Answer to question 1]
2. [Answer to question 2]

## Visual References

📊 **Lesson Diagram**: [diagram_context text or alt_text]
📊 **CFU Diagram**: [diagram_context if available]

## Review Schedule

📅 **Spaced Repetition**:
- ✓ Today: Complete this lesson
- ⏰ Day 2: Review key concepts (5 min)
- ⏰ Day 5: Practice 2-3 problems without notes (10 min)
- ⏰ Week 2: Attempt checkpoint questions (15 min)
- ⏰ Month 1: Final revision before assessment
```

**Formatting Requirements**:
- Use `##` for main sections (H2 level)
- Use `###` for card breakdowns (H3 level)
- Use Cornell-style tables for card content
- Use ❌ and ✓ emoji for misconceptions
- Use `**bold**` for section labels (Duration, Type, etc.)
- Use `→ See: Lesson X` for cross-references
- Use 📊 and 📅 emoji for visual/schedule sections
- Target 300-600 words per lesson note

---

## Agent Behavior Contract

### Initialization

```python
# Agent receives initial prompt with:
prompt = f"""
You are generating revision notes for:
- Course ID: {courseId}
- Total Lessons: {num_lessons}

Workspace location: {workspace_path}

Input files available:
- inputs/Authored_SOW.json
- inputs/Course_data.txt
- inputs/course_outcomes.json
- inputs/lesson_templates/*.json (count: {num_lessons})
- inputs/lesson_diagrams/*.json (count: {num_diagrams})

Required outputs:
1. outputs/course_cheat_sheet.md
2. outputs/lesson_notes_01.md through lesson_notes_{num_lessons:02d}.md

Follow the structure defined in research.md and markdown contracts.
"""
```

### Processing Steps (Expected Agent Flow)

1. **Read Phase**:
   - Read `inputs/Authored_SOW.json` to get lesson order and titles
   - Read `inputs/course_outcomes.json` to map outcomes
   - For each lesson: Read `inputs/lesson_templates/lesson_{order:02d}.json`
   - Read `inputs/lesson_diagrams/*.json` for visual references

2. **Generation Phase - Course Cheat Sheet**:
   - Extract key concepts from each SOW entry
   - Consolidate misconceptions from all lesson templates
   - Create formulas sheet from explainer cards across lessons
   - Map outcomes to lessons
   - Write `outputs/course_cheat_sheet.md`

3. **Generation Phase - Per-Lesson Notes**:
   - For each lesson (order 1 to N):
     - Extract card-by-card content
     - Create Cornell-style tables for each card
     - List misconceptions specific to this lesson
     - Extract CFU questions for checkpoint section
     - Find associated diagrams and extract text descriptions
     - Determine prerequisites/builds-toward from SOW sequence
     - Write `outputs/lesson_notes_{order:02d}.md`

4. **Validation Phase** (Self-Check):
   - Verify all required output files exist
   - Check word counts (cheat sheet: 150-250/lesson, lesson notes: 300-600/lesson)
   - Ensure cross-references are valid ([→ See: Lesson X] points to existing lessons)
   - Confirm LaTeX notation is properly formatted

### Tool Usage Constraints

**Allowed**:
- ✅ `Read` - Read all input files from workspace
- ✅ `Write` - Create output markdown files
- ✅ `Edit` - Revise generated markdown during self-review
- ✅ `Glob` - Find lesson_templates or diagrams files
- ✅ `Grep` - Search for specific concepts across files
- ✅ `TodoWrite` - Track progress (optional)
- ✅ `WebSearch` - ONLY for validating pedagogical note-taking methods
- ✅ `WebFetch` - ONLY for retrieving pedagogy references

**Prohibited**:
- ❌ `WebSearch` for lesson content or examples (must use provided templates)
- ❌ Generating content not present in input files
- ❌ Modifying input files
- ❌ Creating files outside `outputs/` directory

### Error Handling Contract

**Agent MUST throw errors (not fallback) for**:
- Missing required input file
- Empty or malformed JSON in input files
- Unable to parse lesson template cards (not decompressed)
- Outcome code referenced in SOW but not in course_outcomes.json
- Diagram referenced but file not found

**Error Format**:
```python
raise ValueError(
    f"VALIDATION_ERROR: {error_type}\n"
    f"Context: {context_info}\n"
    f"Expected: {expected_value}\n"
    f"Actual: {actual_value}\n"
    f"File: {file_path}"
)
```

---

## Quality Acceptance Criteria

### Course Cheat Sheet Validation

- [ ] Contains "Course Overview" section
- [ ] Lists all learning outcomes from course_outcomes.json
- [ ] Has summary for EVERY lesson in Authored_SOW entries
- [ ] Each lesson summary is 150-250 words
- [ ] Includes "Quick Reference" section with formulas
- [ ] Misconceptions section aggregates from ALL lessons
- [ ] All LaTeX notation properly formatted
- [ ] Total file size < 50KB (uncompressed)

### Per-Lesson Notes Validation

- [ ] One file exists for EACH lesson template (order 1 to N, no gaps)
- [ ] Each file has "Lesson Summary" section with duration, type
- [ ] "Card-by-Card Breakdown" includes ALL cards from template
- [ ] Misconceptions listed match those in lesson template
- [ ] Checkpoint questions use actual CFU card content
- [ ] Visual references mention diagrams (if they exist for lesson)
- [ ] Cross-references ([→ See: Lesson X]) are valid
- [ ] Each file is 300-600 words
- [ ] Cornell-style tables used for card content

### Cross-File Consistency

- [ ] Cheat sheet lesson count matches number of lesson_notes files
- [ ] Lesson titles consistent between cheat sheet and lesson notes
- [ ] Outcome codes in cheat sheet match course_outcomes.json
- [ ] Formulas in cheat sheet present in at least one lesson note
- [ ] No orphaned cross-references (all [→ See: Lesson X] point to existing lessons)

---

## Example Invocation

```python
# Orchestrator builds initial prompt
initial_prompt = build_notes_author_prompt(
    courseId="course_c84874",
    num_lessons=12,
    num_diagrams=24,
    workspace_path="/tmp/workspace_20251109_143052"
)

# Execute agent
async with ClaudeSDKClient(options) as client:
    await client.query(initial_prompt)

    async for message in client.receive_messages():
        if isinstance(message, ResultMessage):
            # Agent completed - validate outputs exist
            assert (workspace_path / "outputs/course_cheat_sheet.md").exists()
            for i in range(1, num_lessons + 1):
                assert (workspace_path / f"outputs/lesson_notes_{i:02d}.md").exists()
            break
```

---

## Versioning

**Contract Version**: 1.0.0
**Changelog**:
- 2025-11-09: Initial contract based on research.md findings
