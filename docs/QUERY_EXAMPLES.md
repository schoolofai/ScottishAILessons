# Query Examples: Understanding Standards Database

This document provides runnable code examples for querying the Understanding Standards database.

## Setup

### Prerequisites

```bash
pip install appwrite>=6.0.0
```

### Initialize Client

```python
from appwrite.client import Client
from appwrite.services.tables_db import TablesDB
from appwrite.query import Query
import json
import os

# Initialize Appwrite client
client = Client()
client.set_endpoint(os.environ.get("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1"))
client.set_project(os.environ["APPWRITE_PROJECT_ID"])
client.set_key(os.environ["APPWRITE_API_KEY"])

# Initialize Tables DB service
tables_db = TablesDB(client)

# Database constants
DATABASE_ID = "sqa_education"
PAPERS_COLLECTION = "us_papers"
TOPIC_INDEX_COLLECTION = "us_topic_index"
```

### Important: Pagination

> **⚠️ Default Limit:** Appwrite's `list_rows()` returns a maximum of 25 rows by default.
> Always use `Query.limit(n)` when you need more results, or paginate with `Query.offset()`.

---

## Paper Retrieval Examples

### Example 1: Get Paper by Document ID

```python
def get_paper_by_id(paper_id: str) -> dict:
    """
    Retrieve a specific paper by its document ID.

    Args:
        paper_id: Document ID (e.g., "mathematics-n5-2023-X847-75-01")
                  Format: {subject}-{level_code}-{year}-{paper_code}

    Returns:
        Parsed UnifiedPaperDocument dict
    """
    row = tables_db.get_row(
        database_id=DATABASE_ID,
        table_id=PAPERS_COLLECTION,
        row_id=paper_id
    )
    return json.loads(row["data"])


# Usage
paper = get_paper_by_id("mathematics-n5-2023-X847-75-01")
print(f"Paper: {paper['paper_code']}")
print(f"Subject: {paper['subject']} {paper['level']}")
print(f"Year: {paper['year']}, Paper {paper['paper_number']}")
print(f"Questions: {len(paper['questions'])}")
print(f"Total Marks: {paper['total_marks']}")
```

### Example 2: List Papers with Filters

```python
def list_papers(
    subject: str = None,
    level: str = None,
    year: int = None,
    limit: int = 25
) -> list:
    """
    List papers with optional filters.

    Args:
        subject: Filter by subject (e.g., "Mathematics")
        level: Filter by level (e.g., "National 5")
        year: Filter by exam year
        limit: Maximum results to return

    Returns:
        List of paper metadata dicts
    """
    queries = []
    if subject:
        queries.append(Query.equal("subject", subject))
    if level:
        queries.append(Query.equal("level", level))
    if year:
        queries.append(Query.equal("year", year))

    # IMPORTANT: Appwrite defaults to 25 rows! Add Query.limit() for more.
    if limit > 25:
        queries = queries or []
        queries.append(Query.limit(limit))

    result = tables_db.list_rows(
        database_id=DATABASE_ID,
        table_id=PAPERS_COLLECTION,
        queries=queries if queries else None
    )

    papers = []
    for row in result.get("documents", []):
        papers.append({
            "document_id": row["$id"],
            "paper_code": row["paper_code"],
            "subject": row["subject"],
            "level": row["level"],
            "year": row["year"],
            "paper_number": row["paper_number"],
            "total_marks": row["total_marks"],
            "topic_tags": row.get("topic_tags", []),
        })
    return papers


# Usage: List all National 5 Mathematics papers
papers = list_papers(subject="Mathematics", level="National 5")
for p in papers:
    print(f"{p['paper_code']} ({p['year']}) - Paper {p['paper_number']} - {p['total_marks']} marks")
```

### Example 3: Get Paper by Components

```python
def build_document_id(subject: str, level_code: str, year: int, paper_code: str) -> str:
    """
    Build document ID from paper components.

    Args:
        subject: Subject name (e.g., "Mathematics")
        level_code: Level code (N5, NH, NAH)
        year: Exam year (e.g., 2023)
        paper_code: SQA paper code (e.g., "X847/75/01")

    Returns:
        Document ID string (e.g., "mathematics-n5-2023-X847-75-01")

    Note:
        Year is required because SQA reuses paper codes across different exam years.
    """
    subject_norm = subject.lower().replace(" ", "-")
    level_norm = level_code.lower()
    code_norm = paper_code.replace("/", "-")
    return f"{subject_norm}-{level_norm}-{year}-{code_norm}"


def get_paper(subject: str, level_code: str, year: int, paper_code: str) -> dict:
    """Retrieve paper by its component parts."""
    doc_id = build_document_id(subject, level_code, year, paper_code)
    return get_paper_by_id(doc_id)


# Usage
paper = get_paper("Mathematics", "N5", 2023, "X847/75/01")
print(f"Retrieved: {paper['paper_code']} ({paper['year']})")
```

---

## Question Access Examples

### Example 4: Get Specific Question from Paper

```python
def get_question(paper_id: str, question_number: str) -> dict:
    """
    Get a specific question from a paper.

    Args:
        paper_id: Document ID of the paper
        question_number: Question number (e.g., "1", "4", "13")

    Returns:
        Question dict with solution embedded
    """
    paper = get_paper_by_id(paper_id)

    for question in paper["questions"]:
        if question["number"] == question_number:
            return question

    raise ValueError(f"Question {question_number} not found in paper {paper_id}")


# Usage
q = get_question("mathematics-n5-2023-X847-75-01", "4")
print(f"Question {q['number']}: {q['text'][:100]}...")
print(f"Marks: {q['marks'] or 'See parts'}")
print(f"Topics: {q['topic_tags']}")
print(f"Has parts: {q['has_parts']}")
```

### Example 5: Get All Questions with Solutions

```python
def get_questions_with_solutions(paper_id: str) -> list:
    """
    Get all questions from a paper with their solutions.

    Returns list of dicts with question and solution details.
    """
    paper = get_paper_by_id(paper_id)
    results = []

    for q in paper["questions"]:
        if q["has_parts"]:
            # Questions with parts have solutions in each part
            for part in q["parts"]:
                results.append({
                    "question": f"{q['number']}({part['part']})" +
                               (f"({part['subpart']})" if part.get('subpart') else ""),
                    "text": part["text"],
                    "text_latex": part["text_latex"],
                    "marks": part["marks"],
                    "topics": part["topic_tags"],
                    "solution": part.get("solution"),
                })
        else:
            # Single question without parts
            results.append({
                "question": q["number"],
                "text": q["text"],
                "text_latex": q["text_latex"],
                "marks": q["marks"],
                "topics": q["topic_tags"],
                "solution": q.get("solution"),
            })

    return results


# Usage
questions = get_questions_with_solutions("mathematics-n5-2023-X847-75-01")
for q in questions[:5]:  # First 5
    print(f"\nQ{q['question']} ({q['marks']} marks) - Topics: {q['topics']}")
    if q['solution']:
        print(f"  Max marks: {q['solution']['max_marks']}")
        for mark in q['solution']['generic_scheme']:
            print(f"  •{mark['bullet']}: {mark['process']}")
```

---

## Topic Index Examples

### Example 6: Find Questions by Topic

```python
def find_questions_by_topic(
    topic: str,
    subject: str = "Mathematics",
    level: str = None
) -> list:
    """
    Find all questions across papers for a given topic.

    Args:
        topic: Topic tag (e.g., "quadratics", "differentiation")
        subject: Subject to search
        level: Optional level filter

    Returns:
        List of QuestionReference dicts
    """
    queries = [
        Query.equal("topic", topic),
        Query.equal("subject", subject),
    ]
    if level:
        queries.append(Query.equal("level", level))

    result = tables_db.list_rows(
        database_id=DATABASE_ID,
        table_id=TOPIC_INDEX_COLLECTION,
        queries=queries
    )

    all_questions = []
    for doc in result.get("documents", []):
        questions_data = json.loads(doc.get("questions_data", "[]"))
        for q in questions_data:
            q["level"] = doc["level"]  # Add level for context
            all_questions.append(q)

    return all_questions


# Usage: Find all quadratics questions in National 5
questions = find_questions_by_topic("quadratics", level="National 5")
print(f"Found {len(questions)} quadratics questions")
for q in questions:
    print(f"  {q['paper_code']} Q{q['question_number']} ({q['year']}) - {q['marks']} marks")
    print(f"    Preview: {q['text_preview']}")
```

### Example 7: Get All Topics for a Level

```python
def get_all_topics(subject: str, level: str = None, limit: int = 100) -> list:
    """
    Get summary of all indexed topics.

    Returns list of topic summaries with question counts.
    """
    queries = [Query.equal("subject", subject)]
    if level:
        queries.append(Query.equal("level", level))
    queries.append(Query.limit(limit))  # Override 25-row default

    result = tables_db.list_rows(
        database_id=DATABASE_ID,
        table_id=TOPIC_INDEX_COLLECTION,
        queries=queries
    )

    topics = []
    for doc in result.get("documents", []):
        topics.append({
            "topic": doc["topic"],
            "level": doc["level"],
            "question_count": doc["question_count"],
            "total_marks": doc["total_marks"],
            "years_covered": doc.get("years_covered", []),
        })

    # Sort by question count descending
    topics.sort(key=lambda t: t["question_count"], reverse=True)
    return topics


# Usage
topics = get_all_topics("Mathematics", "National 5")
print("Most common topics in N5 Mathematics:")
for t in topics[:10]:
    print(f"  {t['topic']}: {t['question_count']} questions, {t['total_marks']} total marks")
    print(f"    Years: {t['years_covered']}")
```

### Example 8: Cross-Paper Topic Analysis

```python
def analyze_topic_across_years(topic: str, subject: str, level: str) -> dict:
    """
    Analyze a topic's appearance across different exam years.

    Returns dict with year-by-year breakdown.
    """
    questions = find_questions_by_topic(topic, subject, level)

    # Group by year
    by_year = {}
    for q in questions:
        year = q["year"]
        if year not in by_year:
            by_year[year] = {"questions": [], "total_marks": 0}
        by_year[year]["questions"].append(q)
        by_year[year]["total_marks"] += q["marks"]

    return {
        "topic": topic,
        "total_questions": len(questions),
        "total_marks": sum(q["marks"] for q in questions),
        "by_year": by_year,
    }


# Usage
analysis = analyze_topic_across_years("quadratics", "Mathematics", "National 5")
print(f"Topic: {analysis['topic']}")
print(f"Total: {analysis['total_questions']} questions, {analysis['total_marks']} marks")
for year, data in sorted(analysis["by_year"].items()):
    print(f"  {year}: {len(data['questions'])} questions, {data['total_marks']} marks")
```

---

## Walkthrough Generation Examples

### Example 9: Build Walkthrough Context

```python
def build_walkthrough_context(paper_id: str, question_number: str) -> str:
    """
    Build a context string for AI walkthrough generation.

    Returns formatted markdown context for the AI prompt.
    """
    paper = get_paper_by_id(paper_id)
    question = get_question(paper_id, question_number)

    context = []

    # Paper metadata
    context.append(f"""# Walkthrough Context

## Paper Information
- Subject: {paper['subject']}
- Level: {paper['level']}
- Year: {paper['year']}
- Paper: {paper['paper_number']} ({'Calculator' if paper['calculator_allowed'] else 'Non-Calculator'})
""")

    # Question text
    context.append(f"""## Question {question['number']}

{question['text_latex']}

**Topics:** {', '.join(question['topic_tags'])}
""")

    # Handle parts
    if question['has_parts']:
        for part in question['parts']:
            context.append(f"""
### Part ({part['part']}){f"({part['subpart']})" if part.get('subpart') else ""} - {part['marks']} marks

{part['text_latex']}

""")
            if part.get('solution'):
                context.append(format_solution(part['solution']))
    else:
        context.append(f"\n**Total Marks:** {question['marks']}\n")
        if question.get('solution'):
            context.append(format_solution(question['solution']))

    # Add relevant general principles
    context.append("\n## Marking Principles\n")
    for principle in paper.get('general_principles', [])[:3]:
        context.append(f"- **{principle['principle']}**: {principle['description'][:150]}...\n")

    return "\n".join(context)


def format_solution(solution: dict) -> str:
    """Format a solution for the context string."""
    lines = ["**Marking Scheme:**\n"]

    lines.append("| Bullet | Process | Expected Answer |")
    lines.append("|--------|---------|-----------------|")

    for i, generic in enumerate(solution.get('generic_scheme', [])):
        illust = solution.get('illustrative_scheme', [{}])[i] if i < len(solution.get('illustrative_scheme', [])) else {}
        answer = illust.get('answer_latex', illust.get('answer', '-'))
        lines.append(f"| •{generic['bullet']} | {generic['process']} | ${answer}$ |")

    if solution.get('notes'):
        lines.append("\n**Notes:**")
        for note in solution['notes']:
            lines.append(f"- {note}")

    return "\n".join(lines)


# Usage
context = build_walkthrough_context("mathematics-n5-2023-X847-75-01", "1")
print(context)
```

### Example 10: Full Walkthrough Generator

```python
def generate_walkthrough_prompt(paper_id: str, question_number: str) -> str:
    """
    Generate a complete prompt for AI walkthrough generation.

    Returns a prompt string ready to send to an LLM.
    """
    context = build_walkthrough_context(paper_id, question_number)

    prompt = f"""{context}

---

## Task

Create a step-by-step student walkthrough for this question that:

1. **Explains the Question** - Rephrase what the question is asking in simple terms
2. **Shows the Method** - Walk through each step with clear reasoning
3. **Highlights Mark Points** - Indicate where each mark is awarded using •1, •2, etc.
4. **Notes Common Mistakes** - Warn about typical errors students make
5. **Provides Final Answer** - Clearly state the final answer with correct formatting

Use LaTeX for all mathematical notation (e.g., $\\frac{{1}}{{2}}$, $x^2$).

Format the walkthrough as Markdown suitable for a student revision guide.
"""
    return prompt


# Usage
prompt = generate_walkthrough_prompt("mathematics-n5-2023-X847-75-01", "1")
print(prompt)

# Send to your AI model
# response = ai_model.generate(prompt)
```

---

## Batch Processing Examples

### Example 11: Generate Walkthroughs for All Questions in a Paper

```python
def batch_generate_paper_walkthroughs(paper_id: str) -> dict:
    """
    Generate walkthrough contexts for all questions in a paper.

    Returns dict mapping question numbers to contexts.
    """
    paper = get_paper_by_id(paper_id)
    walkthroughs = {}

    for question in paper["questions"]:
        q_num = question["number"]
        try:
            walkthroughs[q_num] = build_walkthrough_context(paper_id, q_num)
        except Exception as e:
            walkthroughs[q_num] = f"Error: {e}"

    return walkthroughs


# Usage
paper_id = "mathematics-n5-2023-X847-75-01"
all_contexts = batch_generate_paper_walkthroughs(paper_id)
print(f"Generated contexts for {len(all_contexts)} questions")
for q_num, context in all_contexts.items():
    print(f"Q{q_num}: {len(context)} characters")
```

### Example 12: Find Related Questions for a Topic

```python
def get_topic_questions_with_solutions(
    topic: str,
    subject: str = "Mathematics",
    level: str = "National 5",
    limit: int = 5
) -> list:
    """
    Get full question data for a topic, including solutions.

    Returns list of questions with their paper context.
    """
    # Get question references from topic index
    refs = find_questions_by_topic(topic, subject, level)[:limit]

    results = []
    paper_cache = {}

    for ref in refs:
        paper_id = ref["paper_id"]

        # Cache paper data
        if paper_id not in paper_cache:
            try:
                paper_cache[paper_id] = get_paper_by_id(paper_id)
            except Exception:
                continue

        paper = paper_cache[paper_id]

        # Find the question
        q_number = ref["question_number"]
        # Handle part notation (e.g., "4a" -> question "4", part "a")
        base_number = q_number.rstrip('abcdefghij')
        part_letter = q_number[len(base_number):] if len(q_number) > len(base_number) else None

        for q in paper["questions"]:
            if q["number"] == base_number:
                result = {
                    "paper_code": paper["paper_code"],
                    "year": paper["year"],
                    "question_number": q_number,
                    "marks": ref["marks"],
                    "question": q,
                    "part": None,
                }

                # If it's a part reference, find the specific part
                if part_letter and q["has_parts"]:
                    for part in q["parts"]:
                        if part["part"] == part_letter:
                            result["part"] = part
                            break

                results.append(result)
                break

    return results


# Usage
quadratic_questions = get_topic_questions_with_solutions("quadratics", limit=3)
for item in quadratic_questions:
    print(f"\n{item['paper_code']} ({item['year']}) Q{item['question_number']}")
    if item['part']:
        print(f"Text: {item['part']['text_latex'][:100]}...")
        if item['part'].get('solution'):
            print(f"Marks: {item['part']['solution']['max_marks']}")
    else:
        print(f"Text: {item['question']['text_latex'][:100]}...")
```

---

## Utility Functions

### Example 13: Paper Statistics

```python
def get_paper_statistics(paper_id: str) -> dict:
    """Calculate statistics for a paper."""
    paper = get_paper_by_id(paper_id)

    total_questions = len(paper["questions"])
    total_parts = sum(len(q["parts"]) for q in paper["questions"])
    questions_with_diagrams = sum(1 for q in paper["questions"] if q["diagrams"])

    all_topics = set()
    for q in paper["questions"]:
        all_topics.update(q.get("topic_tags", []))
        for part in q.get("parts", []):
            all_topics.update(part.get("topic_tags", []))

    return {
        "paper_code": paper["paper_code"],
        "year": paper["year"],
        "total_questions": total_questions,
        "total_parts": total_parts,
        "total_marks": paper["total_marks"],
        "questions_with_diagrams": questions_with_diagrams,
        "unique_topics": list(all_topics),
        "topic_count": len(all_topics),
        "has_formulae": len(paper.get("formulae", [])) > 0,
        "principle_count": len(paper.get("general_principles", [])),
    }


# Usage
stats = get_paper_statistics("mathematics-n5-2023-X847-75-01")
print(f"Paper: {stats['paper_code']} ({stats['year']})")
print(f"Questions: {stats['total_questions']} ({stats['total_parts']} parts)")
print(f"Total Marks: {stats['total_marks']}")
print(f"Topics Covered: {stats['topic_count']}")
print(f"Questions with Diagrams: {stats['questions_with_diagrams']}")
```

### Example 14: Validate Paper Data

```python
def validate_paper(paper_id: str) -> dict:
    """
    Validate paper data integrity.

    Returns dict with validation results.
    """
    paper = get_paper_by_id(paper_id)
    issues = []

    # Check marks sum
    calculated_marks = 0
    for q in paper["questions"]:
        if q["has_parts"]:
            calculated_marks += sum(p["marks"] for p in q["parts"])
        else:
            calculated_marks += q["marks"] or 0

    if calculated_marks != paper["total_marks"]:
        issues.append(f"Marks mismatch: calculated {calculated_marks}, stated {paper['total_marks']}")

    # Check solutions exist
    questions_missing_solutions = []
    for q in paper["questions"]:
        if q["has_parts"]:
            for part in q["parts"]:
                if not part.get("solution"):
                    questions_missing_solutions.append(f"{q['number']}({part['part']})")
        else:
            if not q.get("solution"):
                questions_missing_solutions.append(q["number"])

    if questions_missing_solutions:
        issues.append(f"Missing solutions: {questions_missing_solutions}")

    # Check topic tags
    questions_without_topics = [
        q["number"] for q in paper["questions"]
        if not q.get("topic_tags")
    ]
    if questions_without_topics:
        issues.append(f"No topic tags: {questions_without_topics}")

    return {
        "paper_id": paper_id,
        "valid": len(issues) == 0,
        "issues": issues,
    }


# Usage
validation = validate_paper("mathematics-n5-2023-X847-75-01")
if validation["valid"]:
    print("Paper data is valid!")
else:
    print("Issues found:")
    for issue in validation["issues"]:
        print(f"  - {issue}")
```

---

## Error Handling Patterns

### Example 15: Robust Paper Retrieval

```python
from appwrite.exception import AppwriteException
from typing import Optional

def safe_get_paper(paper_id: str) -> Optional[dict]:
    """
    Safely retrieve a paper with proper error handling.

    Returns paper data or None if not found.
    Raises for other errors.
    """
    try:
        row = tables_db.get_row(
            database_id=DATABASE_ID,
            table_id=PAPERS_COLLECTION,
            row_id=paper_id
        )
        return json.loads(row["data"])
    except AppwriteException as e:
        if e.code == 404:
            return None  # Paper not found
        raise  # Re-raise other Appwrite errors
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in paper {paper_id}: {e}")


def require_paper(paper_id: str) -> dict:
    """
    Get paper or raise descriptive error.
    """
    paper = safe_get_paper(paper_id)
    if paper is None:
        raise ValueError(
            f"Paper not found: {paper_id}. "
            f"Check the document ID format: {{subject}}-{{level_code}}-{{year}}-{{paper_code}}"
        )
    return paper


# Usage
try:
    paper = require_paper("mathematics-n5-2023-X847-75-01")
    print(f"Found: {paper['paper_code']}")
except ValueError as e:
    print(f"Error: {e}")
```

---

## See Also

- [AI_WALKTHROUGH_GUIDE.md](./AI_WALKTHROUGH_GUIDE.md) - Comprehensive guide to the database structure
- [Understanding Standards Uploader](../../../understanding_std_uploader/) - Source code for upload pipeline
- [Understanding Standards Extractor](../../../understanding_std_extractor/) - Source code for extraction pipeline
