# AI Walkthrough Guide: Understanding Standards Database

## Overview

This guide explains how to use the Understanding Standards database to build AI agents that create detailed student walkthroughs for SQA exam papers. The database contains structured question papers and marking instructions optimized for AI context retrieval.

### What the Database Contains

The system stores Scottish Qualification Authority (SQA) exam papers with:

| Content Type | Description |
|--------------|-------------|
| **Question Papers** | Full exam questions with text, LaTeX math notation, and diagram references |
| **Marking Instructions** | Step-by-step marking schemes showing how marks are awarded |
| **Solutions** | Expected answers with generic processes and illustrative examples |
| **Topic Tags** | Cross-paper topic indexing for finding related questions |
| **General Principles** | Marking philosophy (positive marking, error handling, etc.) |

### Use Cases

1. **Past Paper Walkthroughs** - Generate step-by-step solution guides for specific exam questions
2. **Topic-Based Revision** - Find all questions on a topic across multiple years
3. **Mock Exam Generation** - Create new exam questions based on marking schemes
4. **Marking Simulation** - Help students understand how examiners award marks

---

## Database Schema Quick Reference

### Appwrite Configuration

| Setting | Value |
|---------|-------|
| Database ID | `sqa_education` |
| Papers Collection | `us_papers` |
| Topic Index Collection | `us_topic_index` |
| Image Storage Bucket | `us_diagrams` |

### `us_papers` Collection Structure

This is the primary collection containing full exam papers with embedded solutions.

```
Document ID Format: {subject}-{level_code}-{year}-{paper_code}
Example: mathematics-n5-2023-X847-75-01
```

> **Important:** The year is included in the document ID because SQA reuses paper codes across different exam years. This prevents collision when the same paper code appears in multiple years.

| Attribute | Type | Description |
|-----------|------|-------------|
| `subject` | string | Subject name (e.g., "Mathematics") |
| `level` | string | Full level name (e.g., "National 5", "Higher") |
| `level_code` | string | Short code: N5, NH, NAH |
| `paper_code` | string | SQA code (e.g., "X847/75/01") |
| `year` | integer | Exam year (e.g., 2023) |
| `paper_number` | integer | 1 or 2 |
| `topic_tags` | string[] | Aggregated topics from all questions |
| `total_marks` | integer | Total marks for the paper |
| `duration_minutes` | integer | Exam duration |
| `calculator_allowed` | boolean | True for Paper 2, False for Paper 1 |
| `exam_date` | string | ISO date (YYYY-MM-DD) |
| `data` | string | **JSON blob containing full UnifiedPaperDocument** |
| `catalog_version` | string | Version timestamp |
| `source_url` | string | Original PDF source URL |
| `last_modified` | datetime | Last update timestamp |

### `us_topic_index` Collection Structure

Cross-paper topic lookup enabling "find all quadratics questions" queries.

```
Document ID Format: {topic}-{subject_abbrev}-{level_code}
Example: quadratics-math-n5
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `topic` | string | Topic tag (e.g., "quadratics", "differentiation") |
| `subject` | string | Subject name |
| `level` | string | Full level name |
| `question_count` | integer | Number of questions with this topic |
| `total_marks` | integer | Sum of marks across all questions |
| `years_covered` | integer[] | Years with questions on this topic |
| `questions_data` | string | JSON array of QuestionReference objects |
| `last_modified` | datetime | Last index update |

---

## Data Structure Deep Dive

### UnifiedPaperDocument Anatomy

The `data` field in `us_papers` contains a JSON-serialized `UnifiedPaperDocument`. Here's its structure:

```json
{
  "subject": "Mathematics",
  "level": "National 5",
  "level_code": "N5",
  "paper_code": "X847/75/01",
  "year": 2023,
  "paper_number": 1,
  "topic_tags": ["algebra", "quadratics", "graphs", "numeracy"],
  "total_marks": 40,
  "duration_minutes": 60,
  "calculator_allowed": false,
  "exam_date": "2023-05-03",

  "questions": [...],
  "formulae": [...],
  "general_principles": [...]
}
```

### Question Structure

Each question in the `questions` array has this structure:

```json
{
  "number": "4",
  "text": "The graph below shows part of a parabola with equation y = kx² + c...",
  "text_latex": "The graph below shows part of a parabola with equation $y = kx^{2} + c$...",
  "marks": null,
  "has_parts": true,
  "parts": [...],
  "topic_tags": ["quadratics", "graphs"],
  "diagrams": [...],
  "solution": null
}
```

**Key Fields:**
- `text` - Plain markdown (for display/summarization)
- `text_latex` - Contains LaTeX math notation (for rendering)
- `marks` - Total marks (null if question has parts)
- `has_parts` - True if question has (a), (b), etc.
- `solution` - Embedded marking scheme (null if question has parts with individual solutions)

### Question Parts Structure

For questions with parts:

```json
{
  "part": "a",
  "subpart": null,
  "text": "State the coordinates of the minimum turning point.",
  "text_latex": "State the coordinates of the minimum turning point.",
  "marks": 1,
  "topic_tags": ["quadratics"],
  "solution": {
    "max_marks": 1,
    "generic_scheme": [
      { "bullet": 1, "process": "state coordinates of minimum TP" }
    ],
    "illustrative_scheme": [
      { "bullet": 1, "answer": "(3, 2)", "answer_latex": "(3, 2)" }
    ],
    "notes": []
  }
}
```

### Marking Scheme Structure (EmbeddedSolution)

The `solution` field contains the marking scheme with two parallel columns:

| Field | Purpose | Example |
|-------|---------|---------|
| `generic_scheme` | What process earns the mark | "start to invert and multiply" |
| `illustrative_scheme` | Expected answer showing the process | "13/6 × 9/8" |

```json
{
  "max_marks": 2,
  "generic_scheme": [
    { "bullet": 1, "process": "convert to improper fraction and multiply by reciprocal" },
    { "bullet": 2, "process": "simplify" }
  ],
  "illustrative_scheme": [
    {
      "bullet": 1,
      "answer": "13/6 x 9/8",
      "answer_latex": "\\frac{13}{6} \\times \\frac{9}{8}",
      "condition": null,
      "alternative": null
    },
    {
      "bullet": 2,
      "answer": "39/16 = 2 7/16",
      "answer_latex": "\\frac{39}{16} = 2\\frac{7}{16}",
      "condition": "simplified",
      "alternative": "2.4375"
    }
  ],
  "notes": ["Correct answer without working: 0/2"]
}
```

**Understanding the Dual-Column Scheme:**
- `generic_scheme` tells you **WHAT** skill/process earns each mark
- `illustrative_scheme` shows **HOW** that process looks when done correctly
- Bullet numbers correspond 1:1 between the two schemes
- Each bullet typically represents 1 mark

### General Marking Principles

The `general_principles` array contains examiner guidance that applies to all questions:

```json
{
  "principle_id": "a",
  "principle": "positive_marking",
  "description": "Marks are of the 'accumulator' type, gained for demonstrating competence in answering a given question...",
  "exceptions": []
}
```

Common principles include:
- **(a) positive_marking** - Marks accumulate for showing competence
- **(b) bullet_per_mark** - Generally one bullet = one mark
- **(g) trivial_errors** - Minor errors don't lose the final mark
- **(h) arithmetic_errors** - How calculation mistakes are handled

### Formulae List

Mathematical formulas provided in the exam paper:

```json
{
  "topic": "Trigonometry",
  "formulas": ["sin A / a = sin B / b = sin C / c", "a² = b² + c² − 2bc cos A"],
  "formulas_latex": ["\\frac{\\sin A}{a} = \\frac{\\sin B}{b} = \\frac{\\sin C}{c}", "a^{2} = b^{2} + c^{2} - 2bc \\cos A"]
}
```

---

## Query Patterns for AI Agents

### Pattern 1: Retrieve a Specific Paper

```python
# Direct lookup by document ID (includes year!)
paper = tables_db.get_row(
    database_id="sqa_education",
    table_id="us_papers",
    row_id="mathematics-n5-2023-X847-75-01"  # Note: year is part of the ID
)

# Parse the data field
import json
data = json.loads(paper["data"])

# Access questions with solutions
for q in data["questions"]:
    print(f"Q{q['number']}: {q['text_latex']}")
```

### Pattern 2: List Papers by Subject/Level/Year

```python
from appwrite.query import Query

# Find all National 5 Mathematics papers from 2023
# IMPORTANT: Default limit is 25 rows! Use Query.limit() for more.
papers = tables_db.list_rows(
    database_id="sqa_education",
    table_id="us_papers",
    queries=[
        Query.equal("subject", "Mathematics"),
        Query.equal("level", "National 5"),
        Query.equal("year", 2023),
        Query.limit(100)  # Override default 25-row limit
    ]
)

for paper in papers["rows"]:  # Note: 'rows' not 'documents' in TablesDB
    print(f"{paper['paper_code']} - Paper {paper['paper_number']}")
```

> **Pagination Note:** The Appwrite API returns a maximum of 25 rows by default. Always use `Query.limit(n)` when you need more results, or paginate using `Query.offset()`.

### Pattern 3: Find Questions by Topic

```python
# Get topic index entry
topic_entry = tables_db.list_rows(
    database_id="sqa_education",
    table_id="us_topic_index",
    queries=[
        Query.equal("topic", "quadratics"),
        Query.equal("subject", "Mathematics"),
        Query.equal("level", "National 5")
    ]
)

if topic_entry["documents"]:
    questions_data = json.loads(topic_entry["documents"][0]["questions_data"])

    for ref in questions_data:
        print(f"Paper: {ref['paper_code']}, Q{ref['question_number']} ({ref['year']})")
        print(f"  Marks: {ref['marks']}")
        print(f"  Preview: {ref['text_preview']}")
```

### Pattern 4: Get All Topics for a Level

```python
# List all indexed topics
topics = tables_db.list_rows(
    database_id="sqa_education",
    table_id="us_topic_index",
    queries=[
        Query.equal("subject", "Mathematics"),
        Query.equal("level", "National 5")
    ]
)

for t in topics["documents"]:
    print(f"{t['topic']}: {t['question_count']} questions, {t['total_marks']} marks")
    print(f"  Years: {t['years_covered']}")
```

---

## Building Effective Walkthroughs

### Recommended Prompt Structure

When using the database content to generate walkthroughs, structure your prompt like this:

```markdown
## Context
You are creating a step-by-step walkthrough for a student studying for their SQA National 5 Mathematics exam.

## Question
[Insert question text_latex here]

## Marking Scheme
The examiner awards marks for:
[For each bullet in generic_scheme:]
- Bullet {bullet}: {process}

## Expected Solution
[For each bullet in illustrative_scheme:]
Step {bullet}: {answer_latex}

## General Principles
[Include relevant general_principles, especially:]
- Positive marking: marks accumulate for showing competence
- [Any relevant principle for this question type]

## Task
Create a student-friendly walkthrough that:
1. Explains the question in plain language
2. Shows each step of the solution with reasoning
3. Highlights where marks are awarded
4. Notes common mistakes to avoid
```

### Example: Converting Database Content to Walkthrough

**From Database:**
```json
{
  "number": "1",
  "text_latex": "Evaluate $2\\frac{1}{6} \\div \\frac{8}{9}$",
  "marks": 2,
  "solution": {
    "max_marks": 2,
    "generic_scheme": [
      { "bullet": 1, "process": "convert to improper fraction and multiply by reciprocal" },
      { "bullet": 2, "process": "simplify" }
    ],
    "illustrative_scheme": [
      { "bullet": 1, "answer_latex": "\\frac{13}{6} \\times \\frac{9}{8}" },
      { "bullet": 2, "answer_latex": "\\frac{39}{16} = 2\\frac{7}{16}" }
    ],
    "notes": ["Correct answer without working: 0/2"]
  }
}
```

**Generated Walkthrough:**

---

### Question 1 (2 marks)

**Evaluate** $2\frac{1}{6} \div \frac{8}{9}$

#### Step-by-Step Solution

**Step 1: Convert and Flip (1 mark)**

First, convert the mixed number to an improper fraction:
$$2\frac{1}{6} = \frac{13}{6}$$

Then remember: *dividing by a fraction = multiplying by its reciprocal*

So we flip $\frac{8}{9}$ to get $\frac{9}{8}$:
$$\frac{13}{6} \times \frac{9}{8}$$

**Step 2: Simplify (1 mark)**

Multiply numerators: $13 \times 9 = 117$
Multiply denominators: $6 \times 8 = 48$

$$\frac{117}{48} = \frac{39}{16} = 2\frac{7}{16}$$

#### Examiner Note
The final answer without any working shown scores **0 marks**. Always show your method!

---

### Handling Diagrams and Visual Content

Questions may reference diagrams stored in Appwrite Storage:

```json
{
  "diagrams": [
    {
      "id": "diag-n5-2023-p1-q4",
      "type": "graph",
      "description": "Parabola graph with vertex at (3,2) and point P on y-axis",
      "filename": "page_005_graphic_00.png",
      "file_id": "65a1b2c3d4e5f6789012",
      "file_url": "https://cloud.appwrite.io/v1/storage/buckets/us_diagrams/files/65a1b2c3d4e5f6789012/view"
    }
  ]
}
```

**Usage in Walkthrough:**
```markdown
![{description}]({file_url})

Looking at the graph, we can see that the parabola has its minimum turning point at (3, 2).
```

---

## Example: Complete Walkthrough Generation Code

```python
import json
from typing import Optional

def generate_walkthrough(paper_id: str, question_number: str) -> str:
    """Generate a student walkthrough for a specific question."""

    # 1. Retrieve the paper
    paper = tables_db.get_row(
        database_id="sqa_education",
        table_id="us_papers",
        row_id=paper_id
    )

    data = json.loads(paper["data"])

    # 2. Find the question
    question = None
    for q in data["questions"]:
        if q["number"] == question_number:
            question = q
            break

    if not question:
        raise ValueError(f"Question {question_number} not found")

    # 3. Build the walkthrough context
    context = build_walkthrough_context(
        question=question,
        paper_metadata={
            "subject": data["subject"],
            "level": data["level"],
            "year": data["year"],
            "paper_number": data["paper_number"],
        },
        general_principles=data["general_principles"],
        formulae=data.get("formulae", [])
    )

    # 4. Generate walkthrough using AI
    walkthrough = ai_generate(context)

    return walkthrough


def build_walkthrough_context(
    question: dict,
    paper_metadata: dict,
    general_principles: list,
    formulae: list
) -> str:
    """Build context string for AI walkthrough generation."""

    context_parts = []

    # Paper context
    context_parts.append(f"""
## Exam Context
- Subject: {paper_metadata['subject']}
- Level: {paper_metadata['level']}
- Year: {paper_metadata['year']}
- Paper: {paper_metadata['paper_number']}
""")

    # Question text
    context_parts.append(f"""
## Question {question['number']}
{question['text_latex']}
""")

    # Handle questions with parts
    if question['has_parts']:
        for part in question['parts']:
            context_parts.append(f"""
### Part ({part['part']}){f"({part['subpart']})" if part.get('subpart') else ""} [{part['marks']} marks]
{part['text_latex']}

**Marking Scheme:**
""")
            if part.get('solution'):
                add_solution_context(context_parts, part['solution'])
    else:
        # Single question without parts
        context_parts.append(f"\n**Total Marks: {question['marks']}**\n")
        if question.get('solution'):
            add_solution_context(context_parts, question['solution'])

    # Relevant formulas
    relevant_topics = question.get('topic_tags', [])
    for formula_set in formulae:
        if any(topic.lower() in formula_set['topic'].lower() for topic in relevant_topics):
            context_parts.append(f"""
## Relevant Formulas ({formula_set['topic']})
""")
            for f in formula_set.get('formulas_latex', formula_set['formulas']):
                context_parts.append(f"- ${f}$\n")

    # General principles
    context_parts.append("""
## Marking Principles
""")
    for principle in general_principles[:3]:  # Include top 3 principles
        context_parts.append(f"- **{principle['principle']}**: {principle['description'][:200]}...\n")

    return "\n".join(context_parts)


def add_solution_context(context_parts: list, solution: dict) -> None:
    """Add marking scheme details to context."""

    context_parts.append("**Generic Scheme (Process):**\n")
    for mark in solution.get('generic_scheme', []):
        context_parts.append(f"- •{mark['bullet']}: {mark['process']}\n")

    context_parts.append("\n**Illustrative Scheme (Expected Answer):**\n")
    for mark in solution.get('illustrative_scheme', []):
        answer = mark.get('answer_latex', mark.get('answer', ''))
        context_parts.append(f"- •{mark['bullet']}: ${answer}$\n")
        if mark.get('alternative'):
            context_parts.append(f"  - Alternative: ${mark.get('alternative_latex', mark['alternative'])}$\n")

    if solution.get('notes'):
        context_parts.append("\n**Examiner Notes:**\n")
        for note in solution['notes']:
            context_parts.append(f"- {note}\n")
```

---

## Best Practices

### 1. When to Use Topic Index vs Direct Paper Access

| Use Case | Approach |
|----------|----------|
| Generate walkthrough for specific paper | Direct paper access by document ID |
| Find all questions on a topic | Use `us_topic_index` first, then fetch papers |
| Browse available papers | Query `us_papers` with filters |
| Show topic coverage stats | Query `us_topic_index` only (no need for full papers) |

### 2. Caching Strategies

```python
# Cache frequently accessed papers in memory
paper_cache = {}

def get_paper_cached(paper_id: str) -> dict:
    if paper_id not in paper_cache:
        paper = tables_db.get_row(
            database_id="sqa_education",
            table_id="us_papers",
            row_id=paper_id
        )
        paper_cache[paper_id] = json.loads(paper["data"])
    return paper_cache[paper_id]
```

### 3. Error Handling

```python
from appwrite.exception import AppwriteException

def safe_get_paper(paper_id: str) -> Optional[dict]:
    """Retrieve paper with proper error handling."""
    try:
        paper = tables_db.get_row(
            database_id="sqa_education",
            table_id="us_papers",
            row_id=paper_id
        )
        return json.loads(paper["data"])
    except AppwriteException as e:
        if e.code == 404:
            return None  # Paper not found
        raise  # Re-raise other errors
```

### 4. LaTeX Rendering

The `text_latex` and `answer_latex` fields contain LaTeX notation for mathematical expressions:

| LaTeX | Renders As |
|-------|------------|
| `\\frac{3}{4}` | $\frac{3}{4}$ |
| `x^{2}` | $x^2$ |
| `\\sqrt{x}` | $\sqrt{x}$ |
| `\\pi` | $\pi$ |
| `30^{\\circ}` | $30°$ |

Note: Backslashes are escaped in JSON (`\\` instead of `\`).

### 5. Building Document IDs

```python
def build_paper_id(subject: str, level_code: str, year: int, paper_code: str) -> str:
    """Build document ID from components.

    Args:
        subject: "Mathematics"
        level_code: "N5", "NH", "NAH"
        year: 2023 (exam year)
        paper_code: "X847/75/01"

    Returns:
        Document ID like "mathematics-n5-2023-X847-75-01"
    """
    subject_norm = subject.lower().replace(" ", "-")
    level_norm = level_code.lower()
    code_norm = paper_code.replace("/", "-")
    return f"{subject_norm}-{level_norm}-{year}-{code_norm}"
```

> **Why year is required:** SQA reuses paper codes across different exam years. Including the year in the document ID prevents collisions when the same paper code appears in 2022, 2023, 2024, etc.

### 6. Level Code Reference

| Level Name | Level Code | Example Document ID (2023) |
|------------|------------|----------------------------|
| National 5 | N5 | `mathematics-n5-2023-X847-75-01` |
| Higher | NH | `mathematics-nh-2023-X847-76-11` |
| Advanced Higher | NAH | `mathematics-nah-2023-X747-77-01` |

---

## Appendix: Complete Data Model Reference

### UnifiedPaperDocument Fields

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Subject name |
| `level` | string | Full level name |
| `level_code` | string | N5, NH, NAH |
| `paper_code` | string | SQA paper code |
| `year` | integer | Exam year |
| `paper_number` | integer | 1 or 2 |
| `topic_tags` | string[] | All topics in paper |
| `total_marks` | integer | Total marks |
| `duration_minutes` | integer | Exam duration |
| `calculator_allowed` | boolean | Calculator permitted |
| `exam_date` | string | ISO date |
| `questions` | UnifiedQuestion[] | All questions |
| `formulae` | FormulaSet[] | Formula sheets |
| `general_principles` | GeneralPrinciple[] | Marking principles |

### UnifiedQuestion Fields

| Field | Type | Description |
|-------|------|-------------|
| `number` | string | Question number ("1", "2", etc.) |
| `text` | string | Question text (markdown) |
| `text_latex` | string | Question text with LaTeX |
| `marks` | integer | Total marks (null if has_parts) |
| `has_parts` | boolean | Has (a), (b) parts |
| `parts` | QuestionPart[] | Sub-parts with solutions |
| `topic_tags` | string[] | Topics for this question |
| `diagrams` | DiagramRef[] | Referenced images |
| `solution` | EmbeddedSolution | Marking scheme |

### EmbeddedSolution Fields

| Field | Type | Description |
|-------|------|-------------|
| `max_marks` | integer | Maximum marks available |
| `generic_scheme` | GenericMark[] | Process descriptions |
| `illustrative_scheme` | IllustrativeMark[] | Expected answers |
| `notes` | string[] | Examiner notes |

---

## Next Steps

For code examples and query patterns, see [QUERY_EXAMPLES.md](./QUERY_EXAMPLES.md).
