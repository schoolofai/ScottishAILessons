"""PDF Exporter for Revision Notes.

Converts revision_notes.json to PDF format with:
- Professional formatting with cover page
- Color-coded sections
- LaTeX math rendering
- SQA branding
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def export_to_pdf(
    revision_notes_path: str,
    output_path: str
) -> str:
    """Export revision notes JSON to PDF format.

    Args:
        revision_notes_path: Path to revision_notes.json file
        output_path: Path where to write PDF file

    Returns:
        Path to generated PDF file

    Raises:
        FileNotFoundError: If revision_notes.json not found
        ImportError: If weasyprint not installed

    Note:
        Requires weasyprint: pip install weasyprint
        For LaTeX rendering, consider using markdown with pandoc or similar
    """
    logger.info(f"Starting PDF export...")
    logger.info(f"  Input: {revision_notes_path}")
    logger.info(f"  Output: {output_path}")

    # Check if weasyprint is available
    try:
        from weasyprint import HTML, CSS
    except ImportError:
        logger.error("weasyprint not installed. Install with: pip install weasyprint")
        raise ImportError(
            "weasyprint is required for PDF export. Install with: pip install weasyprint"
        )

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
    # STEP 2: Build HTML Content with CSS
    # ═══════════════════════════════════════════════════════════════

    metadata = notes.get("metadata", {})
    difficulty_level = metadata.get("difficulty_level", "Unknown")
    estimated_time = metadata.get("estimated_study_time", 0)
    sqa_outcomes = metadata.get("sqa_outcome_refs", [])

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Revision Notes - {difficulty_level}</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
            @bottom-center {{
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10pt;
                color: #666;
            }}
            @bottom-right {{
                content: "SQA {', '.join(sqa_outcomes[:2])}";
                font-size: 9pt;
                color: #999;
            }}
        }}

        body {{
            font-family: 'Helvetica', 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 11pt;
        }}

        h1 {{
            color: #0066cc;
            font-size: 24pt;
            margin-top: 0;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 10px;
        }}

        h2 {{
            color: #004499;
            font-size: 18pt;
            margin-top: 30px;
            margin-bottom: 15px;
            border-bottom: 2px solid #004499;
            padding-bottom: 5px;
            page-break-after: avoid;
        }}

        h3 {{
            color: #006699;
            font-size: 14pt;
            margin-top: 20px;
            margin-bottom: 10px;
            page-break-after: avoid;
        }}

        .cover-page {{
            text-align: center;
            padding-top: 100px;
            page-break-after: always;
        }}

        .cover-title {{
            font-size: 36pt;
            color: #0066cc;
            margin-bottom: 20px;
        }}

        .cover-subtitle {{
            font-size: 18pt;
            color: #666;
            margin-bottom: 40px;
        }}

        .metadata-box {{
            background-color: #f0f7ff;
            border-left: 4px solid #0066cc;
            padding: 15px;
            margin: 20px 0;
            page-break-inside: avoid;
        }}

        .metadata-item {{
            margin: 5px 0;
        }}

        .summary-box {{
            background-color: #fff9e6;
            border-left: 4px solid #ffcc00;
            padding: 15px;
            margin: 20px 0;
            font-style: italic;
            page-break-inside: avoid;
        }}

        .key-concept {{
            background-color: #e6f3ff;
            border-left: 4px solid #0099ff;
            padding: 15px;
            margin: 20px 0;
            page-break-inside: avoid;
        }}

        .worked-example {{
            background-color: #ffe6f0;
            border-left: 4px solid #ff6699;
            padding: 15px;
            margin: 20px 0;
            page-break-inside: avoid;
        }}

        .common-mistake {{
            background-color: #ffe6e6;
            border-left: 4px solid #ff3333;
            padding: 15px;
            margin: 20px 0;
            page-break-inside: avoid;
        }}

        .quiz-question {{
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            padding: 15px;
            margin: 15px 0;
            page-break-inside: avoid;
        }}

        .memory-aid {{
            background-color: #f0fff0;
            border-left: 4px solid #33cc33;
            padding: 15px;
            margin: 20px 0;
            page-break-inside: avoid;
        }}

        .exam-tips {{
            background-color: #f5f5ff;
            border-left: 4px solid #6666ff;
            padding: 15px;
            margin: 20px 0;
        }}

        .solution-step {{
            margin: 8px 0;
            padding-left: 20px;
        }}

        .tip-badge {{
            background-color: #ffcc00;
            color: #333;
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: bold;
            font-size: 9pt;
        }}

        .answer-box {{
            background-color: #e6ffe6;
            padding: 10px;
            margin-top: 10px;
            border-radius: 5px;
        }}

        code {{
            background-color: #f4f4f4;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }}

        .latex {{
            font-style: italic;
            color: #006699;
        }}

        hr {{
            border: none;
            border-top: 1px solid #ccc;
            margin: 30px 0;
        }}

        .footer {{
            text-align: center;
            font-size: 9pt;
            color: #999;
            margin-top: 40px;
        }}
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <div class="cover-title">Revision Notes</div>
        <div class="cover-subtitle">{difficulty_level}</div>
        <div class="metadata-box">
            <div class="metadata-item"><strong>SQA Outcomes:</strong> {', '.join(sqa_outcomes)}</div>
            <div class="metadata-item"><strong>Estimated Study Time:</strong> {estimated_time} minutes</div>
            <div class="metadata-item"><strong>Generated:</strong> {datetime.now().strftime('%d %B %Y')}</div>
        </div>
    </div>

    <!-- Summary -->
    <h1>Summary</h1>
    <div class="summary-box">
        {notes.get('summary', '')}
    </div>

    <!-- Key Concepts -->
    <h1>Key Concepts</h1>
"""

    # Add key concepts
    for i, concept in enumerate(notes.get("key_concepts", []), 1):
        html_content += f"""
    <div class="key-concept">
        <h3>{i}. {concept.get('title', 'Untitled')}</h3>
        <p>{concept.get('explanation', '')}</p>
"""
        if concept.get("visual_representation"):
            # Note: For proper LaTeX rendering, you'd need MathJax or similar
            # For now, just include as code block
            html_content += f"""
        <p><strong>Visual:</strong></p>
        <code class="latex">{concept['visual_representation']}</code>
"""
        if concept.get("real_world_connection"):
            html_content += f"""
        <p><strong>🌍 Real-World Connection:</strong> {concept['real_world_connection']}</p>
"""
        html_content += "    </div>\n"

    # Add worked examples
    html_content += "    <h1>Worked Examples</h1>\n"

    for i, example in enumerate(notes.get("worked_examples", []), 1):
        html_content += f"""
    <div class="worked-example">
        <h3>Example {i}</h3>
        <p><strong>Problem:</strong> {example.get('problem', '')}</p>
        <p><strong>Solution:</strong></p>
"""
        for j, step in enumerate(example.get("solution_steps", []), 1):
            html_content += f"""        <div class="solution-step">{j}. {step}</div>\n"""

        html_content += f"""
        <p><strong>Answer:</strong> {example.get('answer', '')}</p>
        <p><strong>💡 Key Insight:</strong> {example.get('key_insight', '')}</p>
    </div>
"""

    # Add common mistakes
    html_content += "    <h1>Common Mistakes</h1>\n"

    for i, mistake in enumerate(notes.get("common_mistakes", []), 1):
        html_content += f"""
    <div class="common-mistake">
        <h3>❌ Mistake {i}</h3>
        <p><strong>Error:</strong> {mistake.get('mistake', '')}</p>
        <p><strong>Why Wrong:</strong> {mistake.get('why_wrong', '')}</p>
        <p><strong>Correction:</strong> {mistake.get('correction', '')}</p>
        <p><span class="tip-badge">TIP</span> {mistake.get('tip', '')}</p>
    </div>
"""

    # Add quick quiz
    html_content += "    <h1>Quick Quiz</h1>\n"

    for i, question in enumerate(notes.get("quick_quiz", []), 1):
        html_content += f"""
    <div class="quiz-question">
        <h3>Question {i}</h3>
        <p>{question.get('question', '')}</p>
        <div class="answer-box">
            <p><strong>Answer:</strong> {question.get('answer', '')}</p>
            <p><strong>Explanation:</strong> {question.get('explanation', '')}</p>
        </div>
    </div>
"""

    # Add memory aids
    html_content += "    <h1>Memory Aids</h1>\n"

    for i, aid in enumerate(notes.get("memory_aids", []), 1):
        aid_type = aid.get("type", "").title()
        icon_map = {
            "Mnemonic": "🧠",
            "Pattern": "🔄",
            "Trick": "✨",
            "Visual": "👁️"
        }
        icon = icon_map.get(aid_type, "💡")

        html_content += f"""
    <div class="memory-aid">
        <h3>{icon} {aid_type} {i}</h3>
        <p><strong>{aid.get('content', '')}</strong></p>
        <p><em>When to Use:</em> {aid.get('application', '')}</p>
    </div>
"""

    # Add exam tips
    html_content += "    <h1>Exam Tips</h1>\n"
    html_content += "    <div class=\"exam-tips\">\n"

    for i, tip in enumerate(notes.get("exam_tips", []), 1):
        html_content += f"        <p>{i}. ✅ {tip}</p>\n"

    html_content += "    </div>\n"

    # Footer
    html_content += f"""
    <div class="footer">
        <p>Generated by Scottish AI Lessons - Revision Notes Author</p>
        <p>SQA Outcomes: {', '.join(sqa_outcomes)}</p>
    </div>
</body>
</html>
"""

    # ═══════════════════════════════════════════════════════════════
    # STEP 3: Convert HTML to PDF
    # ═══════════════════════════════════════════════════════════════

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Converting HTML to PDF...")

    HTML(string=html_content).write_pdf(output_file)

    logger.info(f"✅ PDF export complete")
    logger.info(f"  Output file: {output_path}")

    return str(output_file)
