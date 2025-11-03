"""Markdown Exporter for Revision Notes.

Converts revision_notes.json to well-formatted Markdown with:
- LaTeX preserved for KaTeX rendering
- Collapsible sections for quiz answers
- SQA outcome references
- Scottish context highlights
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def export_to_markdown(
    revision_notes_path: str,
    output_path: str
) -> str:
    """Export revision notes JSON to Markdown format.

    Args:
        revision_notes_path: Path to revision_notes.json file
        output_path: Path where to write markdown file

    Returns:
        Path to generated markdown file

    Raises:
        FileNotFoundError: If revision_notes.json not found
    """
    logger.info(f"Starting Markdown export...")
    logger.info(f"  Input: {revision_notes_path}")
    logger.info(f"  Output: {output_path}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 1: Load Revision Notes JSON
    # ═══════════════════════════════════════════════════════════════

    notes_file = Path(revision_notes_path)
    if not notes_file.exists():
        raise FileNotFoundError(f"Revision notes file not found: {revision_notes_path}")

    with open(notes_file, 'r', encoding='utf-8') as f:
        notes = json.load(f)

    logger.info(f"✓ Loaded revision notes JSON")

    # ═══════════════════════════════════════════════════════════════
    # STEP 2: Build Markdown Content
    # ═══════════════════════════════════════════════════════════════

    markdown_lines = []

    # Header
    metadata = notes.get("metadata", {})
    difficulty_level = metadata.get("difficulty_level", "Unknown")
    estimated_time = metadata.get("estimated_study_time", 0)
    sqa_outcomes = metadata.get("sqa_outcome_refs", [])

    markdown_lines.append(f"# Revision Notes")
    markdown_lines.append("")
    markdown_lines.append(f"**Level**: {difficulty_level}")
    markdown_lines.append(f"**SQA Outcomes**: {', '.join(sqa_outcomes)}")
    markdown_lines.append(f"**Estimated Study Time**: {estimated_time} minutes")
    markdown_lines.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    markdown_lines.append("")
    markdown_lines.append("---")
    markdown_lines.append("")

    # Summary
    markdown_lines.append("## Summary")
    markdown_lines.append("")
    markdown_lines.append(notes.get("summary", ""))
    markdown_lines.append("")
    markdown_lines.append("---")
    markdown_lines.append("")

    # Key Concepts
    markdown_lines.append("## Key Concepts")
    markdown_lines.append("")

    for i, concept in enumerate(notes.get("key_concepts", []), 1):
        markdown_lines.append(f"### {i}. {concept.get('title', 'Untitled')}")
        markdown_lines.append("")
        markdown_lines.append(concept.get("explanation", ""))
        markdown_lines.append("")

        # Visual representation (LaTeX)
        if concept.get("visual_representation"):
            markdown_lines.append("**Visual**:")
            markdown_lines.append("")
            markdown_lines.append(concept["visual_representation"])
            markdown_lines.append("")

        # Real-world connection
        if concept.get("real_world_connection"):
            markdown_lines.append(f"**Real-World Connection**: {concept['real_world_connection']}")
            markdown_lines.append("")

        markdown_lines.append("---")
        markdown_lines.append("")

    # Worked Examples
    markdown_lines.append("## Worked Examples")
    markdown_lines.append("")

    for i, example in enumerate(notes.get("worked_examples", []), 1):
        markdown_lines.append(f"### Example {i}")
        markdown_lines.append("")
        markdown_lines.append(f"**Problem**: {example.get('problem', '')}")
        markdown_lines.append("")
        markdown_lines.append("**Solution**:")
        markdown_lines.append("")

        for j, step in enumerate(example.get("solution_steps", []), 1):
            markdown_lines.append(f"{j}. {step}")

        markdown_lines.append("")
        markdown_lines.append(f"**Answer**: {example.get('answer', '')}")
        markdown_lines.append("")
        markdown_lines.append(f"**Key Insight**: {example.get('key_insight', '')}")
        markdown_lines.append("")
        markdown_lines.append("---")
        markdown_lines.append("")

    # Common Mistakes
    markdown_lines.append("## Common Mistakes")
    markdown_lines.append("")

    for i, mistake in enumerate(notes.get("common_mistakes", []), 1):
        markdown_lines.append(f"### ❌ Mistake {i}: {mistake.get('mistake', '')}")
        markdown_lines.append("")
        markdown_lines.append(f"**Why Wrong**: {mistake.get('why_wrong', '')}")
        markdown_lines.append("")
        markdown_lines.append(f"**Correction**: {mistake.get('correction', '')}")
        markdown_lines.append("")
        markdown_lines.append(f"**Tip**: {mistake.get('tip', '')}")
        markdown_lines.append("")
        markdown_lines.append("---")
        markdown_lines.append("")

    # Quick Quiz (with collapsible answers)
    markdown_lines.append("## Quick Quiz")
    markdown_lines.append("")
    markdown_lines.append("Test your understanding with these questions:")
    markdown_lines.append("")

    for i, question in enumerate(notes.get("quick_quiz", []), 1):
        markdown_lines.append(f"### Question {i}")
        markdown_lines.append("")
        markdown_lines.append(question.get("question", ""))
        markdown_lines.append("")

        # Collapsible answer
        markdown_lines.append("<details>")
        markdown_lines.append(f"<summary>Show Answer</summary>")
        markdown_lines.append("")
        markdown_lines.append(f"**Answer**: {question.get('answer', '')}")
        markdown_lines.append("")
        markdown_lines.append(f"**Explanation**: {question.get('explanation', '')}")
        markdown_lines.append("")
        markdown_lines.append("</details>")
        markdown_lines.append("")

    markdown_lines.append("---")
    markdown_lines.append("")

    # Memory Aids
    markdown_lines.append("## Memory Aids")
    markdown_lines.append("")

    for i, aid in enumerate(notes.get("memory_aids", []), 1):
        aid_type = aid.get("type", "").title()
        icon_map = {
            "Mnemonic": "🧠",
            "Pattern": "🔄",
            "Trick": "✨",
            "Visual": "👁️"
        }
        icon = icon_map.get(aid_type, "💡")

        markdown_lines.append(f"### {icon} {aid_type} {i}")
        markdown_lines.append("")
        markdown_lines.append(f"**{aid.get('content', '')}**")
        markdown_lines.append("")
        markdown_lines.append(f"*When to Use*: {aid.get('application', '')}")
        markdown_lines.append("")

    markdown_lines.append("---")
    markdown_lines.append("")

    # Exam Tips
    markdown_lines.append("## Exam Tips")
    markdown_lines.append("")

    for i, tip in enumerate(notes.get("exam_tips", []), 1):
        markdown_lines.append(f"{i}. ✅ {tip}")

    markdown_lines.append("")
    markdown_lines.append("---")
    markdown_lines.append("")

    # Footer
    markdown_lines.append("*Generated by Scottish AI Lessons - Revision Notes Author*")
    markdown_lines.append("")
    markdown_lines.append(f"*SQA Outcomes: {', '.join(sqa_outcomes)}*")
    markdown_lines.append("")

    # ═══════════════════════════════════════════════════════════════
    # STEP 3: Write Markdown File
    # ═══════════════════════════════════════════════════════════════

    markdown_content = "\n".join(markdown_lines)

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

    logger.info(f"✅ Markdown export complete")
    logger.info(f"  Output file: {output_path}")
    logger.info(f"  Size: {len(markdown_content):,} bytes")

    return str(output_file)
