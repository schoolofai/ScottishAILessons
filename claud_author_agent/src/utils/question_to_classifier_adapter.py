"""Question to Classifier Adapter - Transforms practice questions for diagram classification.

This adapter creates the input format expected by DiagramClassifierAgent WITHOUT
modifying the existing agent code (Open-Close Principle).

The adapter:
1. Transforms GeneratedQuestion list to classification_input.json format
2. Creates mock_exam.json and sow_context.json files expected by classifier
3. Maps classification results back to questions
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List

from ..models.practice_question_models import GeneratedQuestion
from ..tools.diagram_classifier_schema_models import DiagramClassificationResult

logger = logging.getLogger(__name__)


def strip_latex(text: str) -> str:
    """Remove LaTeX formatting from text for plain text analysis.

    Args:
        text: Text potentially containing LaTeX

    Returns:
        Plain text version
    """
    if not text:
        return ""

    # Remove display math
    text = re.sub(r'\$\$.*?\$\$', '', text, flags=re.DOTALL)
    # Remove inline math
    text = re.sub(r'\$.*?\$', '', text)
    # Remove \\frac{}{} -> (/)
    text = re.sub(r'\\frac\{([^}]*)\}\{([^}]*)\}', r'(\1/\2)', text)
    # Remove common LaTeX commands
    text = re.sub(r'\\[a-zA-Z]+\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def create_classification_input(
    questions: List[GeneratedQuestion],
    lesson_template_id: str,
    execution_id: str,
    subject: str = "mathematics",
    level: str = "national-3"
) -> Dict[str, Any]:
    """Create classification_input.json format from GeneratedQuestion list.

    This transforms our practice questions into the exact format expected
    by DiagramClassifierAgent._create_classification_input().

    Args:
        questions: List of generated practice questions
        lesson_template_id: Source lesson template ID
        execution_id: Execution ID for tracking
        subject: Course subject (default: mathematics)
        level: Course level (default: national-3)

    Returns:
        Dict in classification_input.json format
    """
    classification_questions = []

    for idx, q in enumerate(questions):
        classification_questions.append({
            "question_id": q.question_id,
            "question_number": idx + 1,
            "question_stem": q.stem,
            "question_stem_plain": strip_latex(q.stem),
            "topic": q.curriculum_topic or q.block_title,
            "question_type": _map_question_type(q.question_type),
            "difficulty": q.difficulty
        })

    return {
        "batch_mode": True,
        "exam_metadata": {
            "subject": subject,
            "level": level,
            "exam_id": f"practice_{execution_id}"
        },
        "questions": classification_questions
    }


def _map_question_type(question_type: str) -> str:
    """Map practice question type to classifier's expected types.

    Classifier expects: numeric, mcq, structured_response
    Practice uses: multiple_choice, numeric, short_answer, worked_example
    """
    mapping = {
        "multiple_choice": "mcq",
        "numeric": "numeric",
        "short_answer": "structured_response",
        "worked_example": "structured_response"
    }
    return mapping.get(question_type, "numeric")


def create_mock_exam_adapter(
    questions: List[GeneratedQuestion],
    execution_id: str
) -> Dict[str, Any]:
    """Create mock_exam.json structure expected by DiagramClassifierAgent.

    The classifier reads mock_exam.json for question metadata.

    Args:
        questions: List of generated practice questions
        execution_id: Execution ID

    Returns:
        Dict in mock_exam.json format
    """
    return {
        "examId": f"practice_{execution_id}",
        "sections": [{
            "questions": [
                {
                    "question_id": q.question_id,
                    "question_number": idx + 1,
                    "question_stem": q.stem,
                    "question_stem_plain": strip_latex(q.stem),
                    "question_type": _map_question_type(q.question_type),
                    "difficulty": q.difficulty,
                    "standards_addressed": [
                        {"description": q.curriculum_topic or q.block_title}
                    ]
                }
                for idx, q in enumerate(questions)
            ]
        }]
    }


def create_sow_context(
    subject: str = "mathematics",
    level: str = "national-3"
) -> Dict[str, Any]:
    """Create sow_context.json expected by DiagramClassifierAgent.

    Args:
        subject: Course subject
        level: Course level

    Returns:
        Dict in sow_context.json format
    """
    return {
        "subject": subject,
        "level": level
    }


def setup_classifier_workspace(
    workspace_path: Path,
    questions: List[GeneratedQuestion],
    lesson_template_id: str,
    execution_id: str,
    subject: str = "mathematics",
    level: str = "national-3"
) -> None:
    """Set up workspace files for DiagramClassifierAgent.

    Creates all input files expected by the classifier:
    - classification_input.json
    - mock_exam.json
    - sow_context.json

    Args:
        workspace_path: Path to workspace directory
        questions: List of generated practice questions
        lesson_template_id: Source lesson template ID
        execution_id: Execution ID
        subject: Course subject
        level: Course level
    """
    logger.info("Setting up classifier workspace...")

    # Create classification input
    classification_input = create_classification_input(
        questions, lesson_template_id, execution_id, subject, level
    )
    (workspace_path / "classification_input.json").write_text(
        json.dumps(classification_input, indent=2)
    )
    logger.info(f"  ✅ classification_input.json ({len(questions)} questions)")

    # Create mock_exam.json
    mock_exam = create_mock_exam_adapter(questions, execution_id)
    (workspace_path / "mock_exam.json").write_text(
        json.dumps(mock_exam, indent=2)
    )
    logger.info("  ✅ mock_exam.json")

    # Create sow_context.json
    sow_context = create_sow_context(subject, level)
    (workspace_path / "sow_context.json").write_text(
        json.dumps(sow_context, indent=2)
    )
    logger.info("  ✅ sow_context.json")


def merge_classification_results(
    questions: List[GeneratedQuestion],
    classification_result: DiagramClassificationResult
) -> List[GeneratedQuestion]:
    """Merge diagram classification results back into questions.

    Maps classification results to questions by question_id and updates
    diagram-related fields.

    Args:
        questions: Original list of generated questions
        classification_result: Result from DiagramClassifierAgent

    Returns:
        Updated questions with diagram information
    """
    # Create lookup by question_id
    classification_map = {
        c.question_id: c for c in classification_result.classifications
    }

    updated_questions = []

    for question in questions:
        classification = classification_map.get(question.question_id)

        if classification:
            # Update diagram fields based on classification
            question.diagram_needed = classification.tool != "NONE"
            question.diagram_tool = classification.tool

            logger.debug(
                f"Question {question.question_id}: "
                f"tool={classification.tool}, "
                f"confidence={classification.confidence}"
            )
        else:
            logger.warning(
                f"No classification found for question {question.question_id}"
            )

        updated_questions.append(question)

    # Log summary
    needs_diagram = sum(1 for q in updated_questions if q.diagram_needed)
    logger.info(
        f"Classification merge complete: "
        f"{needs_diagram}/{len(updated_questions)} questions need diagrams"
    )

    return updated_questions


async def process_question_diagrams(
    workspace_path: Path,
    questions: List[GeneratedQuestion],
    lesson_template_id: str,
    execution_id: str,
    subject: str = "mathematics",
    level: str = "national-3",
    run_diagram_author: bool = True,
    mcp_config_path: str = ".mcp.json"
) -> List[GeneratedQuestion]:
    """Process questions through diagram classification and optional generation.

    This is the main entry point for diagram integration. It:
    1. Sets up workspace files for classifier
    2. Runs DiagramClassifierAgent (unmodified - Open-Close Principle)
    3. Optionally runs DiagramAuthorAgent for questions needing diagrams
    4. Uploads diagrams to Appwrite Storage
    5. Merges results back into questions

    Args:
        workspace_path: Path to workspace directory
        questions: List of generated practice questions
        lesson_template_id: Source lesson template ID
        execution_id: Execution ID
        subject: Course subject
        level: Course level
        run_diagram_author: Whether to also run diagram generation
        mcp_config_path: Path to MCP config for Appwrite credentials

    Returns:
        Updated questions with diagram information
    """
    logger.info("=" * 60)
    logger.info("DIAGRAM PROCESSING - Starting")
    logger.info(f"  Questions: {len(questions)}")
    logger.info(f"  Run Author: {run_diagram_author}")
    logger.info("=" * 60)

    # Step 1: Set up workspace
    setup_classifier_workspace(
        workspace_path, questions, lesson_template_id,
        execution_id, subject, level
    )

    # Step 2: Run DiagramClassifierAgent (UNMODIFIED)
    from ..agents.diagram_classifier_agent import DiagramClassifierAgent

    classifier = DiagramClassifierAgent(workspace_path=workspace_path)
    classifier_result = await classifier.execute()

    if not classifier_result["success"]:
        raise RuntimeError("Diagram classification failed")

    classification_result = classifier_result["classification_result"]

    # Step 3: Merge classification results into questions (tool type, diagram_needed)
    questions = merge_classification_results(questions, classification_result)

    # Step 4: Optionally run DiagramAuthorAgent
    if run_diagram_author and classification_result.questions_needing_diagrams > 0:
        logger.info(
            f"Running diagram author for "
            f"{classification_result.questions_needing_diagrams} questions..."
        )

        from ..agents.diagram_author_agent import DiagramAuthorAgent

        author = DiagramAuthorAgent(workspace_path=workspace_path)
        author_result = await author.execute()

        # Step 5: Upload diagrams to Appwrite Storage
        if author_result.successful_diagrams > 0:
            logger.info("Uploading diagrams to Appwrite Storage...")
            await upload_diagrams_to_storage(
                workspace_path=workspace_path,
                mcp_config_path=mcp_config_path
            )

        # Step 6: Apply manifest with file IDs to questions
        manifest_path = workspace_path / "diagram_manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
            questions = _apply_diagram_manifest(questions, manifest)

    logger.info("=" * 60)
    logger.info("DIAGRAM PROCESSING - Complete")
    diagram_count = sum(1 for q in questions if q.diagram_file_id)
    logger.info(f"  Diagrams Generated: {diagram_count}")
    logger.info("=" * 60)

    return questions


def _apply_diagram_manifest(
    questions: List[GeneratedQuestion],
    manifest: Dict[str, Any]
) -> List[GeneratedQuestion]:
    """Apply diagram manifest data to questions.

    The manifest maps question_id to generated diagram info including
    file IDs (after Appwrite upload) and JSXGraph JSON.

    Args:
        questions: List of questions
        manifest: Diagram manifest from DiagramAuthorAgent

    Returns:
        Questions with diagram file IDs applied
    """
    # Build lookup from diagrams array
    diagram_lookup = {}
    for diagram in manifest.get("diagrams", []):
        qid = diagram.get("question_id")
        if qid:
            diagram_lookup[qid] = diagram

    for question in questions:
        entry = diagram_lookup.get(question.question_id)
        if entry and entry.get("success"):
            # Use image_file_id if uploaded, otherwise note the local path
            question.diagram_file_id = entry.get("image_file_id")
            question.diagram_json = entry.get("jsxgraph_json")
            logger.debug(
                f"Applied diagram to {question.question_id}: "
                f"file_id={question.diagram_file_id}"
            )

    return questions


async def upload_diagrams_to_storage(
    workspace_path: Path,
    mcp_config_path: str,
    bucket_id: str = "practice_content"
) -> Dict[str, str]:
    """Upload generated diagram images to Appwrite Storage.

    Reads the diagram manifest, uploads each successful diagram PNG
    to Appwrite Storage, and returns a mapping of question_id to file_id.

    Args:
        workspace_path: Path to workspace with diagrams/
        mcp_config_path: Path to MCP config for Appwrite credentials
        bucket_id: Storage bucket ID

    Returns:
        Dict mapping question_id to Appwrite file_id
    """
    from pathlib import Path as PathLib
    from appwrite.client import Client
    from appwrite.services.storage import Storage
    from appwrite.input_file import InputFile
    import hashlib

    manifest_path = workspace_path / "diagram_manifest.json"
    if not manifest_path.exists():
        logger.warning("No diagram manifest found - skipping upload")
        return {}

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Initialize Appwrite client from MCP config
    config_path = PathLib(mcp_config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

    with open(config_path) as f:
        mcp_config = json.load(f)

    appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
    args = appwrite_config.get("args", [])

    endpoint, api_key, project_id = None, None, None
    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="):
            endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_API_KEY="):
            api_key = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="):
            project_id = arg.split("=", 1)[1]

    if not all([endpoint, api_key, project_id]):
        raise ValueError("Missing Appwrite credentials in MCP config")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)
    storage = Storage(client)

    # Upload each successful diagram
    file_id_map = {}
    for diagram in manifest.get("diagrams", []):
        if not diagram.get("success"):
            continue

        question_id = diagram.get("question_id")
        image_path = diagram.get("image_path")

        if not image_path or not PathLib(image_path).exists():
            logger.warning(f"Diagram image not found for {question_id}: {image_path}")
            continue

        # Generate deterministic file ID
        file_id = hashlib.md5(f"diagram:{question_id}".encode()).hexdigest()[:36]

        try:
            # Create InputFile from path
            input_file = InputFile.from_path(image_path)

            # Try to upload
            result = storage.create_file(
                bucket_id=bucket_id,
                file_id=file_id,
                file=input_file
            )
            file_id_map[question_id] = result['$id']
            logger.info(f"  ✅ Uploaded diagram for {question_id}: {result['$id']}")

        except Exception as e:
            if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                # File already exists - use the ID
                file_id_map[question_id] = file_id
                logger.debug(f"  ⚠️ Diagram already exists for {question_id}: {file_id}")
            else:
                logger.error(f"  ❌ Failed to upload diagram for {question_id}: {e}")

    logger.info(f"Uploaded {len(file_id_map)} diagram(s) to Appwrite Storage")

    # Update manifest with file IDs
    for diagram in manifest.get("diagrams", []):
        qid = diagram.get("question_id")
        if qid in file_id_map:
            diagram["image_file_id"] = file_id_map[qid]

    # Write updated manifest
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    return file_id_map
