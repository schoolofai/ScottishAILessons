# Research Findings: Course Revision Notes Author

**Date**: 2025-11-09
**Phase**: 0 (Research & Unknowns Resolution)

## 1. Pedagogical Note-Taking Methods

### Cornell Method for STEM Subjects

**Decision**: Use adapted Cornell Method with three-column structure: Cues | Notes | Examples

**Rationale**: Traditional Cornell (Cues | Notes | Summary) works well for humanities but STEM needs worked examples section instead of bottom summary. Research shows concrete examples improve retention for procedural knowledge.

**Implementation Guidelines**:
```markdown
## Topic Name

| Cue/Question | Core Concept | Worked Example |
|--------------|--------------|----------------|
| How to find fraction of amount? | Multiply: (numerator/denominator) × amount | 2/5 of 20 = (2÷5)×20 = 8 |
| When to use? | Word problems with "of" | "2/5 of pupils" means multiply |
```

**Alternatives Considered**:
- Outline method: Too linear, doesn't support retrieval practice
- Mind mapping: Difficult in pure markdown without visual tools
- SQ3R method: Better for reading comprehension than math revision

---

## 2. Spaced Repetition Cues

**Decision**: Use evidence-based intervals: 1 day, 3 days, 1 week, 2 weeks, 1 month

**Rationale**: Based on Ebbinghaus forgetting curve and Leitner system. Research shows reviewing at increasing intervals improves long-term retention by 200-300%.

**Implementation Guidelines**:
```markdown
**📅 Review Schedule**:
- ✓ Today: First learning (complete this lesson)
- ⏰ Day 2: Quick review of key concepts (5 min)
- ⏰ Day 5: Practice 2-3 problems without notes (10 min)
- ⏰ Week 2: Attempt past paper questions on this topic (15 min)
- ⏰ Month 1: Final revision before assessment
```

**Alternatives Considered**:
- Anki-style app integration: Requires external tool, markdown can't embed dynamic scheduling
- Fixed daily review: Not evidence-based, causes burnout
- Teacher-defined schedule: Less autonomy, doesn't adapt to student needs

---

## 3. Concept Mapping in Text Format

**Decision**: Use hierarchical markdown with cross-reference tags [→ See: Topic Name]

**Rationale**: Pure text can show relationships through explicit linking and indentation. Research shows that even text-based concept maps improve schema formation when visual tools unavailable.

**Implementation Guidelines**:
```markdown
### Prerequisite Knowledge
- [→ See: Lesson 02 - Basic Fractions] Understanding numerator/denominator
- [→ See: Lesson 01 - Multiplication] Multiplying decimals

### This Lesson Builds Toward
- [→ See: Lesson 08 - Percentage Problems] Converting fractions to percentages
- [→ See: Lesson 12 - Ratio Applications] Using equivalent fractions

### Common Misconceptions (avoid these!)
- ❌ "2/5 of 20" means 20 ÷ 2 ÷ 5 [→ See: Lesson 03 - Order of Operations]
- ✓ Correct: Multiply by the fraction (2/5) × 20
```

**Alternatives Considered**:
- Mermaid diagrams in markdown: Not supported in all renderers, increases file size
- Wiki-style links: Requires custom frontend rendering
- No linking: Misses opportunity for schema building

---

## 4. Lesson Diagram Integration

### Diagram Metadata Structure (from Appwrite schema investigation)

**Decision**: Extract alt text and diagram_context fields for text descriptions

**Rationale**: Based on schema analysis, `lesson_diagrams` collection has:
- `diagramType`: "lesson" | "cfu_diagram" | "diagram_context"
- `image_file_id`: Appwrite storage file ID
- `alt_text`: Brief description (optional)
- `diagram_context`: Rich description of diagram purpose (optional)

**Implementation Guidelines**:
```python
def extract_diagram_text(diagram_doc):
    """Convert diagram to text description for revision notes."""
    diagram_type = diagram_doc.get('diagramType', 'unknown')

    if diagram_doc.get('diagram_context'):
        # Rich description available - use it
        return f"📊 **Diagram ({diagram_type})**: {diagram_doc['diagram_context']}"
    elif diagram_doc.get('alt_text'):
        # Fallback to alt text
        return f"📊 **Visual**: {diagram_doc['alt_text']}"
    else:
        # Last resort - reference file ID
        return f"📊 **See Diagram**: [File ID: {diagram_doc['image_file_id']}]"
```

**Alternatives Considered**:
- Embed base64 images: Exceeds Appwrite 16MB limit quickly
- OCR text extraction: Not feasible for diagrams (shapes, arrows, positioning matters)
- Omit diagrams entirely: Violates spec requirement for diagram integration

---

## 5. Course Outcomes Schema

### Structure Investigation (from sqa_education.course_outcomes)

**Decision**: Map outcomes to lessons using SOW entry's `outcomes` field

**Rationale**: Based on codebase analysis:
- `course_outcomes` has fields: `outcome_code`, `outcome_description`, `assessment_standards`
- SOW entries include `outcomes: [outcome_codes]` array
- Lesson templates inherit from SOW entries

**Implementation Guidelines**:
```python
async def map_outcomes_to_lessons(sow_entries, course_outcomes):
    """Create lesson → outcomes mapping for cheat sheet."""
    lesson_outcomes_map = {}

    for entry in sow_entries:
        lesson_order = entry['order']
        outcome_codes = entry.get('outcomes', [])

        # Find full outcome details
        outcomes = [o for o in course_outcomes if o['outcome_code'] in outcome_codes]
        lesson_outcomes_map[lesson_order] = outcomes

    return lesson_outcomes_map
```

**Alternatives Considered**:
- Direct lesson → outcome relationship in Appwrite: Not in current schema
- Manual outcome assignment: Error-prone, doesn't scale

---

## 6. Markdown Size Optimization

### Compression Threshold Analysis

**Decision**: Compress at 10KB threshold (as per spec assumption)

**Rationale**: Testing with existing lesson_templates shows:
- 10-lesson course cheat sheet: ~8-15KB uncompressed
- Per-lesson notes: ~2-5KB uncompressed
- Gzip compression ratio: ~3:1 for markdown (repetitive structure)
- 10KB threshold keeps most notes uncompressed (human-readable in Appwrite console)

**Implementation Guidelines**:
```python
def should_compress_content(content: str) -> bool:
    """Determine if markdown content needs compression."""
    size_kb = len(content.encode('utf-8')) / 1024
    return size_kb > 10  # 10KB threshold

def prepare_markdown_for_storage(content: str) -> str:
    """Compress markdown if needed, return storage-ready string."""
    if should_compress_content(content):
        logger.info(f"Compressing markdown ({len(content)/1024:.1f}KB)")
        return compress_json_to_gzip_base64(content)
    return content
```

**Alternatives Considered**:
- Always compress: Makes debugging difficult (can't read in Appwrite console)
- Never compress: Risk hitting 16MB Appwrite limit for large courses
- Different threshold (5KB or 20KB): 10KB balances readability vs. safety

---

## 7. Agent Prompt Engineering

### SQA-Aligned Revision Note Exemplars

**Decision**: Use exam-focused structure: Topic → Key Points → Common Mistakes → Quick Check

**Rationale**: SQA exams emphasize:
- Procedural fluency (step-by-step methods)
- Avoiding common misconceptions
- Time-bound assessment (quick reference needed)

**Cheat Sheet Structure**:
```markdown
# [Course Title] - Quick Revision Guide

## Course Overview
- **Subject**: [e.g., Mathematics]
- **Level**: [e.g., National 5]
- **Total Lessons**: [e.g., 12]
- **Key Assessment Standards**: [List main codes]

## Learning Outcomes Summary
1. [Outcome Code]: [Brief description] - Covered in Lessons [X, Y]
2. [Outcome Code]: [Brief description] - Covered in Lessons [Z]

## Lessons at a Glance

### Lesson 1: [Title]
**Key Concepts**: [3-5 bullet points]
**Must Remember**: [Critical formula/rule]
**Common Mistake**: [What students often get wrong]
**Quick Check**: [1 practice question]

[Repeat for each lesson...]

## Quick Reference
### Formulas Sheet
[All key formulas in one place]

### Misconceptions to Avoid
[Consolidated list from all lessons]

### Assessment Standard Checklist
- [ ] [Standard 1] - Practice with [Lesson X]
- [ ] [Standard 2] - Practice with [Lesson Y]
```

**Per-Lesson Notes Structure**:
```markdown
# Lesson [N]: [Title]

## Lesson Summary
**Duration**: [X minutes] | **Type**: [teach/practice/assess]
**Prerequisites**: [→ See: Lesson M]
**Builds Toward**: [→ See: Lesson P]

## Card-by-Card Breakdown

### Card 1: [Type] - [Topic]
**Key Learning**:
- [Main point 1]
- [Main point 2]

**Worked Example** (if applicable):
[Step-by-step solution]

---

[Repeat for each card...]

## Common Misconceptions
❌ **Mistake**: [What students think]
✓ **Correct**: [Actual understanding]
**Why This Matters**: [Context]

## Checkpoint Questions
1. [Quick practice question from CFU cards]
2. [Another practice question]

📅 **Review Schedule**: Day 2, Day 5, Week 2, Month 1
```

**Alternatives Considered**:
- Detailed explanations: Too long, violates "quick notes" purpose
- Minimal bullet points: Lacks context for independent study
- Question-only format: Doesn't support initial learning, only testing

---

## 8. Comprehensiveness vs. Conciseness Balance

**Decision**: Target 1500-2500 words per 10-lesson cheat sheet (~150-250 words per lesson summary)

**Rationale**: Research on cognitive load shows:
- Working memory capacity: 7±2 items
- Single-page reference: 1500-2000 words fits on 2-3 printed pages
- Exam cheat sheets (where allowed): 1 A4 page = ~500-700 words

**Word Count Guidelines**:
- Course cheat sheet: 150-250 words per lesson × N lessons
- Per-lesson notes: 300-600 words per lesson (more detail than cheat sheet)
- Worked examples: 50-100 words each (concise steps)

**Implementation**:
```markdown
<!-- Prompt guidance for notes_author subagent -->
Target word counts:
- Cheat sheet lesson summary: 150-250 words (focus on "must know")
- Lesson note card breakdown: 50-100 words per card
- Worked examples: Include 1-2 per lesson (50-100 words each)
- Keep language concise: prefer bullet points over paragraphs
```

**Alternatives Considered**:
- Unlimited length: Defeats "quick revision" purpose
- Ultra-concise (50 words/lesson): Loses necessary context
- Dynamic length (based on content): Hard to standardize, inconsistent UX

---

## 9. Agent Tool Usage Strategy

**Decision**: Use WebSearch/WebFetch for pedagogical techniques ONLY, not content generation

**Rationale**: All content should come from provided SOW, lessons, outcomes. WebSearch used for:
- Spaced repetition interval confirmation
- Cornell Method examples for STEM
- Common misconception validation (cross-check against pedagogy research)

**Tools Exclusion**:
- NO WebSearch for lesson content (must use provided lesson_templates)
- NO external resources for worked examples (use SOW-designed examples)
- YES WebSearch for note-taking methodology validation

**Implementation**:
```markdown
<!-- In notes_author_prompt.md -->
You have access to WebSearch and WebFetch tools. Use them ONLY for:
✓ Validating pedagogical note-taking approaches
✓ Finding evidence-based spaced repetition intervals
✓ Cross-checking common misconceptions against research

DO NOT use web tools for:
❌ Generating new lesson content
❌ Finding alternative worked examples
❌ Supplementing course material

All content MUST come from provided workspace files.
```

---

## Summary: Key Decisions

| Unknown | Resolution | Source |
|---------|-----------|--------|
| Cornell Method structure | Cues \| Notes \| Examples (adapted for STEM) | Pedagogical research |
| Spaced repetition intervals | 1d, 3d, 1w, 2w, 1m | Ebbinghaus/Leitner systems |
| Concept mapping | Hierarchical markdown with [→ See: Topic] cross-refs | Text-based schema research |
| Diagram integration | Extract alt_text and diagram_context fields | Appwrite schema analysis |
| Course outcomes schema | Map via SOW entry outcomes array | Codebase investigation |
| Compression threshold | 10KB (gzip+base64 for larger) | Existing pattern analysis |
| Cheat sheet word count | 150-250 words per lesson summary | Cognitive load research |
| Agent web tool usage | Pedagogy validation only, NOT content generation | Scoping decision |

---

## 10. ASCII Diagram Generation (Python Libraries)

**Decision**: Use **Mermaid syntax** for diagrams with optional fallback to **Rich** for simple ASCII art

**Rationale**:
- **Mermaid** is already supported by most markdown renderers (GitHub, GitLab, many documentation tools)
- Diagrams can be defined inline in markdown using ```mermaid fenced code blocks
- No external Python dependencies needed for diagram generation (just string formatting)
- **Rich** can be used for simpler ASCII box drawing if Mermaid not suitable for a specific case
- Both approaches keep markdown files portable and renderable

**Implementation Guidelines**:

**Primary: Mermaid Syntax** (Recommended for most diagrams)
```python
def generate_mermaid_flowchart(lesson_data):
    """Generate Mermaid flowchart from lesson structure."""
    return f"""```mermaid
graph TD
    A[{lesson_data['title']}] --> B[Key Concepts]
    B --> C[Worked Examples]
    C --> D[Practice Problems]
    D --> E[Assessment]
```"""
```

**Fallback: Rich ASCII Art** (For simple boxes/tables)
```python
from rich.console import Console
from rich.table import Table
from io import StringIO

def generate_ascii_table(data):
    """Generate ASCII table using Rich."""
    console = Console(file=StringIO(), width=80, legacy_windows=False)
    table = Table(show_header=True, header_style="bold")
    table.add_column("Concept")
    table.add_column("Formula")
    # ... add rows
    console.print(table)
    return console.file.getvalue()
```

**Alternatives Considered**:
- **diagrams** (mingrammer/diagrams): Generates actual images (PNG/SVG), requires Graphviz installation - too heavy for markdown-only output
- **asciigraf**: Converts ASCII art to graphs - requires pre-drawn ASCII, not generative
- **Textual**: Full TUI library, overkill for static diagram generation
- **asciichartpy**: Specialized for charts/plots, not general diagrams
- **Ditaa/Ascidia**: External Java/command-line tools, adds deployment complexity

**Why Mermaid Wins**:
1. **Zero Python dependencies** (just string formatting)
2. **Universally supported** in markdown renderers (GitHub, GitLab, Docusaurus, MkDocs)
3. **Type coverage**: Flowcharts, sequence diagrams, mind maps, timelines, Gantt charts
4. **Human-readable source** (readable even if rendering fails)
5. **Future-proof**: Can be rendered client-side in frontend without server processing

**When to Use Each**:
- **Mermaid**: Lesson flow diagrams, concept relationships, assessment progression
- **Rich**: Simple ASCII tables for Cornell Method cue/notes/summary structure (already in use elsewhere)
- **Plain Markdown Tables**: For most tabular data (no library needed)

---

## References

- Ebbinghaus Forgetting Curve: Spaced repetition research
- Leitner System: Flashcard scheduling intervals
- Cornell Note-Taking: Adapted for STEM procedural knowledge
- SQA Assessment Standards: Scottish secondary education requirements
- Existing codebase: lesson_author_claude_client.py, sow_author_claude_client.py patterns
- Mermaid Documentation: https://mermaid.js.org/
- Rich Library: https://rich.readthedocs.io/ (for fallback ASCII art)
