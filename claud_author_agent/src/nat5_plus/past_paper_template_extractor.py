"""
Past Paper Template Extractor

Extracts question templates from the us_papers collection (sqa_education database).
Templates inform question style, structure, and marking scheme patterns.

Key insight: We use past papers as STYLE TEMPLATES, not to copy questions.
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# Subject mapping: course subjects -> paper subjects
# Applications of Mathematics shares question styles with Mathematics
SUBJECT_MAPPING = {
    "applications-of-mathematics": "Mathematics",
    "application-of-mathematics": "Mathematics",
    "app-maths": "Mathematics",
    "maths": "Mathematics",
    "math": "Mathematics",
}

# Level mapping: course levels -> paper levels
LEVEL_MAPPING = {
    "national-5": "National 5",
    "national-4": "National 4",
    "national-3": "National 3",
    "higher": "Higher",
    "advanced-higher": "Advanced Higher",
    "adv-higher": "Advanced Higher",
}


def _normalize_subject(subject: str) -> str:
    """Normalize subject name to match us_papers format."""
    subject_lower = subject.lower().strip()

    # Check mapping first
    if subject_lower in SUBJECT_MAPPING:
        return SUBJECT_MAPPING[subject_lower]

    # Try title case
    return subject.replace("-", " ").replace("_", " ").title()


def _normalize_level(level: str) -> str:
    """Normalize level name to match us_papers format."""
    level_lower = level.lower().strip()

    # Check mapping first
    if level_lower in LEVEL_MAPPING:
        return LEVEL_MAPPING[level_lower]

    # Try title case
    return level.replace("-", " ").replace("_", " ").title()


@dataclass
class QuestionTemplate:
    """Template extracted from a past paper question."""
    template_id: str
    paper_id: str
    question_number: str
    marks: int
    question_style: str  # procedural, application, problem_solving
    topic_tags: List[str]
    stem_pattern: str  # Abstracted pattern (e.g., "Simplify {expression}")
    marking_pattern: Dict[str, Any]  # Generic marking structure
    has_diagram: bool
    difficulty_estimate: str


@dataclass
class PaperConfig:
    """Configuration extracted from filtered papers."""
    typical_marks: int      # Average total_marks from papers
    typical_duration: int   # Average duration_minutes from papers
    calculator_allowed: bool


@dataclass
class PaperTemplates:
    """Collection of templates from past papers."""
    subject: str
    level: str
    papers_analyzed: int
    templates: List[QuestionTemplate]
    style_distribution: Dict[str, int]
    paper_config: PaperConfig  # Configuration based on filtered papers


async def extract_templates(
    subject: str,
    level: str,
    calculator_allowed: bool,
    workspace_path: Optional[Path] = None,
    max_papers: int = 5
) -> PaperTemplates:
    """Extract question templates from past papers.

    Args:
        subject: Subject name (e.g., "Mathematics" or "applications-of-mathematics")
        level: Qualification level (e.g., "National 5" or "national-5")
        calculator_allowed: Filter for calculator/non-calculator papers
        workspace_path: Optional directory to save extracted templates
        max_papers: Maximum papers to analyze

    Returns:
        PaperTemplates with extracted question structures and paper_config

    Raises:
        ValueError: If no papers found for subject/level/calculator policy
    """
    # Normalize subject and level to match us_papers format
    normalized_subject = _normalize_subject(subject)
    normalized_level = _normalize_level(level)

    calc_label = "calculator" if calculator_allowed else "non-calculator"
    logger.info(f"Extracting templates for {subject} {level} ({calc_label})")
    logger.info(f"Normalized to: {normalized_subject} / {normalized_level}")

    # Import Appwrite client
    try:
        from ..utils.appwrite_client import get_databases
    except ImportError:
        logger.error("Appwrite client not available")
        raise ValueError("Appwrite client not configured")

    databases = get_databases()

    try:
        from appwrite.query import Query

        # Query us_papers in sqa_education database with normalized values
        # Filter by calculator_allowed to get appropriate paper type
        papers = databases.list_documents(
            database_id="sqa_education",
            collection_id="us_papers",
            queries=[
                Query.equal("subject", normalized_subject),
                Query.equal("level", normalized_level),
                Query.equal("calculator_allowed", calculator_allowed),
                Query.order_desc("year"),
                Query.limit(max_papers)
            ]
        )

        if not papers["documents"]:
            raise ValueError(
                f"No {calc_label} papers found for {normalized_subject} {normalized_level} "
                f"(original: {subject} {level})"
            )

        # Extract typical marks and duration from filtered papers
        total_marks_list = [p.get("total_marks", 50) for p in papers["documents"]]
        duration_list = [p.get("duration_minutes", 90) for p in papers["documents"]]

        paper_config = PaperConfig(
            typical_marks=sum(total_marks_list) // len(total_marks_list),
            typical_duration=sum(duration_list) // len(duration_list),
            calculator_allowed=calculator_allowed
        )
        logger.info(f"Paper config: {paper_config.typical_marks} marks, {paper_config.typical_duration} min")

        templates = []
        style_counts = {"procedural": 0, "application": 0, "problem_solving": 0}

        for paper in papers["documents"]:
            paper_id = paper["$id"]
            paper_data = _parse_paper_data(paper.get("data", "{}"))

            for question in paper_data.get("questions", []):
                template = _extract_question_template(paper_id, question)
                if template:
                    templates.append(template)
                    style_counts[template.question_style] = (
                        style_counts.get(template.question_style, 0) + 1
                    )

        result = PaperTemplates(
            subject=subject,
            level=level,
            papers_analyzed=len(papers["documents"]),
            templates=templates,
            style_distribution=style_counts,
            paper_config=paper_config
        )

        if workspace_path:
            _save_templates(result, workspace_path / "templates.json")

        logger.info(f"Extracted {len(templates)} templates from {result.papers_analyzed} papers")
        return result

    except Exception as e:
        logger.error(f"Failed to extract templates: {e}")
        raise ValueError(f"Template extraction failed: {e}")


def _parse_paper_data(data_str: str) -> Dict[str, Any]:
    """Parse the compressed/JSON paper data field."""
    if not data_str:
        return {}
    try:
        if isinstance(data_str, dict):
            return data_str
        return json.loads(data_str)
    except json.JSONDecodeError:
        # Try decompression if needed
        try:
            from ..utils.compression import decompress_json
            return decompress_json(data_str) or {}
        except Exception:
            return {}


def _extract_question_template(paper_id: str, question: Dict[str, Any]) -> Optional[QuestionTemplate]:
    """Extract a template from a single question."""
    try:
        q_num = str(question.get("number", ""))
        marks = question.get("marks") or 0

        # Skip questions without solutions (can't template marking)
        if not question.get("solution") and not question.get("parts"):
            return None

        # Determine question style
        style = _classify_question_style(question)

        # Abstract the stem pattern
        stem = question.get("text", "")
        stem_pattern = _abstract_stem(stem)

        # Extract marking pattern
        marking_pattern = _extract_marking_pattern(question)

        return QuestionTemplate(
            template_id=f"{paper_id}_{q_num}",
            paper_id=paper_id,
            question_number=q_num,
            marks=marks,
            question_style=style,
            topic_tags=question.get("topic_tags", []),
            stem_pattern=stem_pattern,
            marking_pattern=marking_pattern,
            has_diagram=bool(question.get("diagrams")),
            difficulty_estimate=_estimate_difficulty(marks, style)
        )
    except Exception as e:
        logger.warning(f"Failed to extract template from question: {e}")
        return None


def _classify_question_style(question: Dict[str, Any]) -> str:
    """Classify question into procedural/application/problem_solving."""
    text = question.get("text", "").lower()
    marks = question.get("marks") or 0

    # Keywords for classification
    procedural_keywords = ["simplify", "expand", "factorise", "solve", "evaluate", "calculate"]
    application_keywords = ["find", "determine", "work out", "show that"]
    problem_keywords = ["prove", "explain", "investigate", "design", "context"]

    # Score each category
    procedural_score = sum(1 for kw in procedural_keywords if kw in text)
    application_score = sum(1 for kw in application_keywords if kw in text)
    problem_score = sum(1 for kw in problem_keywords if kw in text)

    # Higher marks often indicate problem solving
    if marks >= 5:
        problem_score += 1

    # Return highest scoring category
    if problem_score > application_score and problem_score > procedural_score:
        return "problem_solving"
    elif application_score > procedural_score:
        return "application"
    else:
        return "procedural"


def _abstract_stem(stem: str) -> str:
    """Abstract specific values from stem to create a pattern."""
    import re

    # Replace numbers with {number}
    pattern = re.sub(r'\b\d+\b', '{number}', stem)

    # Replace expressions like "2x + 3" with {expression}
    pattern = re.sub(r'\b\d*[xyz]\s*[+\-*/]\s*\d+\b', '{expression}', pattern)

    # Replace specific variable names
    pattern = re.sub(r'\b[xyz]\b', '{var}', pattern)

    return pattern[:200] if len(pattern) > 200 else pattern


def _extract_marking_pattern(question: Dict[str, Any]) -> Dict[str, Any]:
    """Extract marking scheme structure."""
    solution = question.get("solution", {})

    if not solution:
        # Check parts for solutions
        parts = question.get("parts", [])
        if parts and parts[0].get("solution"):
            solution = parts[0]["solution"]

    if not solution:
        return {"bullet_count": 0, "scheme_type": "unknown"}

    generic = solution.get("generic_scheme", [])
    illustrative = solution.get("illustrative_scheme", [])

    return {
        "bullet_count": len(generic),
        "scheme_type": "sqa_standard",
        "has_notes": bool(solution.get("notes")),
        "process_types": [g.get("process", "")[:50] for g in generic[:3]]
    }


def _estimate_difficulty(marks: int, style: str) -> str:
    """Estimate difficulty based on marks and style."""
    if marks <= 2:
        return "easy"
    elif marks <= 4:
        return "medium" if style == "procedural" else "hard"
    else:
        return "hard"


def _save_templates(templates: PaperTemplates, output_path: Path) -> None:
    """Save templates to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "subject": templates.subject,
        "level": templates.level,
        "papers_analyzed": templates.papers_analyzed,
        "style_distribution": templates.style_distribution,
        "paper_config": {
            "typical_marks": templates.paper_config.typical_marks,
            "typical_duration": templates.paper_config.typical_duration,
            "calculator_allowed": templates.paper_config.calculator_allowed
        },
        "templates": [
            {
                "template_id": t.template_id,
                "paper_id": t.paper_id,
                "question_number": t.question_number,
                "marks": t.marks,
                "question_style": t.question_style,
                "topic_tags": t.topic_tags,
                "stem_pattern": t.stem_pattern,
                "marking_pattern": t.marking_pattern,
                "has_diagram": t.has_diagram,
                "difficulty_estimate": t.difficulty_estimate
            }
            for t in templates.templates
        ]
    }

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    logger.info(f"Saved {len(templates.templates)} templates to {output_path}")
