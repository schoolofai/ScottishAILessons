"""
Nat5+ Diagram Generator - Phase 3.5 of Exam Generation Pipeline

Orchestrates diagram generation for Nat5+ exam questions using a 3-subagent pattern:
1. Classification - Batch classify questions needing diagrams
2. Author - Generate diagrams using MCP tools
3. Critic - Validate diagram quality with iteration loop

Pipeline Position: Between Phase 3 (Question Generation) and Phase 4 (Assembly)

Usage:
    from .diagram_generator import generate_diagrams_for_exam

    diagram_map = await generate_diagrams_for_exam(questions, workspace_path)
    # Returns Dict[question_id, List[QuestionDiagram]]
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

from ..models.nat5_plus_exam_models import QuestionDiagram
from ..models.nat5_plus_question_generation_schema import QuestionGeneration, DiagramSpec
from ..tools.diagram_classifier_schema_models import (
    DiagramClassificationResult,
    QuestionClassification,
    normalize_tool_type,
    DIAGRAM_CLASSIFICATION_INPUT_FILE,
    DIAGRAM_CLASSIFICATION_OUTPUT_FILE
)

logger = logging.getLogger(__name__)

# Constants
MAX_ITERATIONS_PER_DIAGRAM = 3
PARALLEL_BATCH_SIZE = 5


@dataclass
class DiagramGenerationResult:
    """Result for a single diagram generation."""
    question_id: str
    success: bool
    iterations: int = 0
    final_score: float = 0.0
    image_path: Optional[str] = None
    diagram_type: str = ""
    error: Optional[str] = None
    critic_notes: List[str] = field(default_factory=list)


@dataclass
class DiagramPipelineResult:
    """Complete result from diagram generation pipeline."""
    success: bool
    total_questions_with_diagrams: int
    diagrams_generated: int
    diagrams_failed: int
    total_iterations: int
    diagram_map: Dict[str, List[QuestionDiagram]] = field(default_factory=dict)
    error: Optional[str] = None


def _verify_diagram_services() -> None:
    """Verify diagram rendering services are available.

    FAIL-FAST: Raises RuntimeError if services unavailable.
    No fallback pattern - per CLAUDE.md guidelines.
    """
    import httpx

    api_base = os.environ.get("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")

    try:
        # Quick health check - just verify server is responding
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{api_base}/health")
            if response.status_code != 200:
                raise RuntimeError(
                    f"Diagram service unhealthy: {api_base}/health returned {response.status_code}"
                )
        logger.info(f"   Diagram service healthy at {api_base}")
    except httpx.ConnectError:
        raise RuntimeError(
            f"Diagram service unavailable at {api_base}. "
            f"Start DiagramScreenshot service: cd diagramScreenshot && npm start"
        )
    except Exception as e:
        raise RuntimeError(f"Diagram service check failed: {e}")


def _filter_questions_needing_diagrams(
    questions: List[QuestionGeneration]
) -> List[QuestionGeneration]:
    """Filter questions that have diagram_needed=True and valid diagram_spec."""
    filtered = []
    for q in questions:
        if q.diagram_needed and q.diagram_spec:
            filtered.append(q)
            logger.debug(f"   Question {q.question_id}: diagram needed ({q.diagram_spec.diagram_type})")
        elif q.diagram_needed and not q.diagram_spec:
            logger.warning(f"   Question {q.question_id}: diagram_needed=True but no diagram_spec")
    return filtered


def _map_diagram_type_to_tool(diagram_type: str) -> str:
    """Map LLM diagram_type output to supported tool names.

    LLM may output legacy names like 'tikz' or 'geogebra' that need mapping.
    """
    type_mapping = {
        "tikz": "MATPLOTLIB",           # TikZ not supported, use matplotlib
        "geogebra": "MATPLOTLIB",       # GeoGebra deprecated, use matplotlib
        "desmos": "DESMOS",
        "matplotlib": "MATPLOTLIB",
        "jsxgraph": "JSXGRAPH",
        "plotly": "PLOTLY",
        "imagen": "IMAGE_GENERATION",
        "image_generation": "IMAGE_GENERATION",
    }

    normalized = type_mapping.get(diagram_type.lower(), "MATPLOTLIB")
    if diagram_type.lower() != normalized.lower():
        logger.info(f"   Mapped diagram_type '{diagram_type}' -> '{normalized}'")
    return normalized


def _create_classification_input(
    questions: List[QuestionGeneration],
    subject: str,
    level: str
) -> Dict[str, Any]:
    """Create classification input JSON from Nat5+ questions.

    Transforms QuestionGeneration objects into the format expected by
    the diagram classification subagent.
    """
    classification_questions = []

    for idx, q in enumerate(questions):
        classification_questions.append({
            "question_id": q.question_id or f"q{idx + 1}",
            "question_number": idx + 1,
            "question_stem": q.stem,
            "question_stem_plain": q.stem,  # Nat5+ uses stem for both
            "topic": q.topic_ids[0] if q.topic_ids else "",
            "question_type": "structured",
            "difficulty": q.difficulty,
            # Include existing diagram_spec for context
            "diagram_spec": q.diagram_spec.model_dump() if q.diagram_spec else None
        })

    return {
        "batch_mode": True,
        "exam_metadata": {
            "subject": subject,
            "level": level,
            "exam_id": "nat5_plus_exam"
        },
        "questions": classification_questions
    }


async def _classify_diagrams_batch(
    questions: List[QuestionGeneration],
    workspace_path: Path,
    subject: str,
    level: str
) -> List[QuestionClassification]:
    """Batch classify all diagram questions in a single LLM call.

    Uses the existing DiagramClassifierAgent pattern but with Nat5+ input format.

    For Nat5+, we already have diagram_spec from the LLM, so we use that
    as guidance but still run classification for tool selection.
    """
    from ..agents.diagram_classifier_agent import DiagramClassifierAgent

    # Write classification input
    input_data = _create_classification_input(questions, subject, level)
    input_path = workspace_path / DIAGRAM_CLASSIFICATION_INPUT_FILE

    with open(input_path, 'w') as f:
        json.dump(input_data, f, indent=2)

    logger.info(f"   Created {DIAGRAM_CLASSIFICATION_INPUT_FILE} with {len(questions)} questions")

    # For Nat5+, we can use the existing diagram_spec to determine tool
    # instead of running full classification (saves tokens)
    classifications = []

    for idx, q in enumerate(questions):
        qid = q.question_id or f"q{idx + 1}"

        # Map diagram_type from diagram_spec to tool
        if q.diagram_spec:
            tool = _map_diagram_type_to_tool(q.diagram_spec.diagram_type)
        else:
            tool = "MATPLOTLIB"  # Default for geometry/diagrams

        # Apply tool normalization
        tool = normalize_tool_type(tool)

        # Create QuestionClassification-compatible dict
        classification = QuestionClassification(
            question_id=qid,
            question_number=idx + 1,
            tool=tool,
            confidence="HIGH",  # We trust the LLM's diagram_spec
            reasoning={
                "selected_because": f"Based on diagram_spec.diagram_type: {q.diagram_spec.diagram_type if q.diagram_spec else 'default'}",
                "content_analysis": q.diagram_spec.description if q.diagram_spec else "No description",
                "decision_rule_applied": "Nat5+ diagram_spec mapping",
                "alternatives_rejected": "Using LLM-specified tool",
                "summary": f"Tool selected from question's diagram_spec"
            },
            visualization_focus=q.diagram_spec.description if q.diagram_spec else None,
            alternative_tool=None,
            curriculum_topic=q.topic_ids[0] if q.topic_ids else "General",
            diagram_specs={
                "key_elements": list(q.diagram_spec.parameters.get("key_elements", [])) if q.diagram_spec else [],
                "educational_purpose": q.diagram_spec.description if q.diagram_spec else "Visualize concept"
            } if q.diagram_spec else None
        )

        classifications.append(classification)
        logger.info(f"   Classified {qid}: {tool}")

    # Write classification output for reference
    output_data = {
        "batch_mode": True,
        "total_questions": len(classifications),
        "questions_needing_diagrams": len(classifications),
        "questions_no_diagram": 0,
        "classifications": [c.model_dump() for c in classifications]
    }

    output_path = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)

    return classifications


async def _generate_single_diagram(
    classification: QuestionClassification,
    question: QuestionGeneration,
    workspace_path: Path,
    diagrams_dir: Path
) -> DiagramGenerationResult:
    """Generate a single diagram using MCP tools with critic validation.

    Implements the author → critic → (refine) loop with max iterations.
    """
    from ..agents.diagram_author_agent import DiagramAuthorAgent

    question_id = classification.question_id
    tool = classification.tool

    logger.info(f"   Generating diagram for {question_id} using {tool}")

    # Build question content dict for author agent
    question_content = {
        "question_id": question_id,
        "question_number": question.question_number,
        "question_stem": question.stem,
        "question_stem_plain": question.stem,
        "diagram_spec": question.diagram_spec.model_dump() if question.diagram_spec else {},
        "topic": question.topic_ids[0] if question.topic_ids else "",
        "difficulty": question.difficulty
    }

    # Initialize author agent for this single diagram
    api_base = os.environ.get("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
    api_key = os.environ.get("DIAGRAM_SCREENSHOT_API_KEY", "")

    # Create a temporary mock_exam.json for the author agent
    # (it expects this file format)
    temp_mock_exam = {
        "sections": [{
            "questions": [question_content]
        }]
    }

    mock_exam_path = workspace_path / "mock_exam.json"
    with open(mock_exam_path, 'w') as f:
        json.dump(temp_mock_exam, f, indent=2)

    # Also write classification output for the author agent
    class_output = {
        "batch_mode": True,
        "total_questions": 1,
        "questions_needing_diagrams": 1,
        "questions_no_diagram": 0,
        "classifications": [classification.model_dump()]
    }

    class_path = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
    with open(class_path, 'w') as f:
        json.dump(class_output, f, indent=2)

    # Create sow_context.json (required by agent)
    context_path = workspace_path / "sow_context.json"
    with open(context_path, 'w') as f:
        json.dump({"subject": "mathematics", "level": "national-5"}, f)

    try:
        agent = DiagramAuthorAgent(
            workspace_path=workspace_path,
            max_iterations=MAX_ITERATIONS_PER_DIAGRAM,
            rendering_api_base=api_base,
            rendering_api_key=api_key
        )

        result = await agent.execute()

        # Extract result for this question
        if result.diagrams and len(result.diagrams) > 0:
            diagram_result = result.diagrams[0]
            return DiagramGenerationResult(
                question_id=question_id,
                success=diagram_result.success,
                iterations=diagram_result.iterations,
                final_score=diagram_result.final_score,
                image_path=diagram_result.image_path,
                diagram_type=tool.lower(),
                critic_notes=diagram_result.critic_notes,
                error=diagram_result.error
            )
        else:
            return DiagramGenerationResult(
                question_id=question_id,
                success=False,
                error="No diagram result returned from agent"
            )

    except Exception as e:
        logger.error(f"   Diagram generation failed for {question_id}: {e}")
        return DiagramGenerationResult(
            question_id=question_id,
            success=False,
            error=str(e)
        )


def _result_to_question_diagram(
    result: DiagramGenerationResult,
    question: QuestionGeneration
) -> Optional[QuestionDiagram]:
    """Convert DiagramGenerationResult to QuestionDiagram model."""
    if not result.success or not result.image_path:
        return None

    return QuestionDiagram(
        diagram_id=f"dgm_{result.question_id}",
        diagram_type=result.diagram_type or "matplotlib",
        diagram_url=result.image_path,  # Local path for now
        diagram_spec=question.diagram_spec.model_dump() if question.diagram_spec else None,
        description=question.diagram_spec.description if question.diagram_spec else ""
    )


def chunk(lst: List, size: int):
    """Split list into chunks of given size."""
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


async def generate_diagrams_for_exam(
    questions: List[QuestionGeneration],
    workspace_path: Path,
    subject: str = "Mathematics",
    level: str = "National 5"
) -> Dict[str, List[QuestionDiagram]]:
    """Main entry point for Phase 3.5 - Diagram Generation.

    Orchestrates the 3-subagent pipeline:
    1. Filter questions needing diagrams
    2. Batch classify tool selection
    3. Generate diagrams in parallel batches with critic validation

    Args:
        questions: List of generated questions from Phase 3
        workspace_path: Workspace directory for intermediate files
        subject: Subject name for context
        level: Qualification level for context

    Returns:
        Dict mapping question_id to List[QuestionDiagram]

    Raises:
        RuntimeError: If diagram services unavailable (fail-fast)
    """
    logger.info("=" * 60)
    logger.info("PHASE 3.5: DIAGRAM GENERATION")
    logger.info(f"   Total questions: {len(questions)}")
    logger.info(f"   Workspace: {workspace_path}")
    logger.info("=" * 60)

    # Step 1: Filter questions needing diagrams
    diagram_questions = _filter_questions_needing_diagrams(questions)

    if not diagram_questions:
        logger.info("   No questions need diagrams - skipping Phase 3.5")
        return {}

    logger.info(f"   Questions needing diagrams: {len(diagram_questions)}")

    # Step 2: Verify diagram services (FAIL-FAST)
    logger.info("   Checking diagram services...")
    _verify_diagram_services()

    # Step 3: Setup workspace
    workspace_path.mkdir(parents=True, exist_ok=True)
    diagrams_dir = workspace_path / "diagrams"
    diagrams_dir.mkdir(exist_ok=True)

    # Step 4: Batch classify (determines tool for each question)
    logger.info("   Classifying diagram tools...")
    classifications = await _classify_diagrams_batch(
        diagram_questions, workspace_path, subject, level
    )

    # Build lookup from question_id to question
    question_lookup = {
        q.question_id or f"q{idx + 1}": q
        for idx, q in enumerate(diagram_questions)
    }

    # Step 5: Generate diagrams in parallel batches
    logger.info(f"   Generating {len(classifications)} diagrams in batches of {PARALLEL_BATCH_SIZE}...")

    diagram_map: Dict[str, List[QuestionDiagram]] = {}
    total_iterations = 0
    successful = 0
    failed = 0

    for batch_idx, batch in enumerate(chunk(classifications, PARALLEL_BATCH_SIZE)):
        logger.info(f"   Processing batch {batch_idx + 1}...")
        batch_results = []

        # Process each classification sequentially to avoid anyio cancel scope errors
        # (Claude Agent SDK uses anyio which enforces task affinity for cancel scopes)
        for classification in batch:
            qid = classification.question_id
            question = question_lookup.get(qid)

            if not question:
                logger.warning(f"   Question {qid} not found in lookup")
                continue

            # Each question gets its own sub-workspace
            q_workspace = workspace_path / f"diagram_{qid}"
            q_workspace.mkdir(exist_ok=True)

            try:
                result = await _generate_single_diagram(
                    classification=classification,
                    question=question,
                    workspace_path=q_workspace,
                    diagrams_dir=diagrams_dir
                )
                batch_results.append(result)
            except Exception as e:
                batch_results.append(e)

        # Process results
        for i, result in enumerate(batch_results):
            if isinstance(result, Exception):
                logger.error(f"   Batch task {i} failed: {result}")
                failed += 1
                continue

            if isinstance(result, DiagramGenerationResult):
                total_iterations += result.iterations

                if result.success:
                    successful += 1
                    question = question_lookup.get(result.question_id)
                    if question:
                        diagram = _result_to_question_diagram(result, question)
                        if diagram:
                            diagram_map[result.question_id] = [diagram]
                            logger.info(f"   ✓ {result.question_id}: score={result.final_score:.2f}")
                else:
                    failed += 1
                    logger.warning(f"   ✗ {result.question_id}: {result.error}")

    logger.info("=" * 60)
    logger.info("PHASE 3.5 COMPLETE")
    logger.info(f"   Diagrams generated: {successful}")
    logger.info(f"   Diagrams failed: {failed}")
    logger.info(f"   Total iterations: {total_iterations}")
    logger.info("=" * 60)

    return diagram_map


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLE-QUESTION DIAGRAM REGENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def _load_json(path: Path) -> Dict[str, Any]:
    """Load JSON file. Raises ValueError if not found (fail-fast)."""
    if not path.exists():
        raise ValueError(f"Required file not found: {path}")
    with open(path, 'r') as f:
        return json.load(f)


def _update_diagram_manifest(workspace_path: Path, result: DiagramGenerationResult) -> None:
    """Update diagram_manifest.json with new generation result."""
    manifest_path = workspace_path / "diagram_manifest.json"

    # Load existing manifest or create new
    if manifest_path.exists():
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    else:
        manifest = {
            "total_questions": 1,
            "diagrams_generated": 0,
            "successful": 0,
            "failed": 0,
            "diagrams": []
        }

    # Update manifest with result
    manifest["diagrams"] = [{
        "question_id": result.question_id,
        "tool": result.diagram_type.upper() if result.diagram_type else "UNKNOWN",
        "success": result.success,
        "iterations": result.iterations,
        "final_score": result.final_score,
        "image_path": result.image_path,
        "error": result.error,
        "critic_notes": result.critic_notes
    }]

    manifest["diagrams_generated"] = 1
    manifest["successful"] = 1 if result.success else 0
    manifest["failed"] = 0 if result.success else 1

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    logger.info(f"   Updated manifest: {manifest_path}")


def _extract_question_from_classification(
    classification_data: Dict[str, Any],
    question_id: str
) -> Optional[QuestionClassification]:
    """Extract QuestionClassification from classification_output.json."""
    classifications = classification_data.get("classifications", [])
    for c in classifications:
        if c.get("question_id") == question_id:
            return QuestionClassification(**c)
    return None


async def regenerate_single_diagram(
    workspace_path: Path,
    question_id: str,
    max_iterations: int = 3,
    max_turns: int = 200,
    force_tool: Optional[str] = None
) -> DiagramGenerationResult:
    """Regenerate diagram for a single question from existing workspace.

    Use this to retry failed diagrams without regenerating the entire exam.
    All necessary data (question, classification) is loaded from the existing
    per-question workspace - no re-classification needed.

    Args:
        workspace_path: Root workspace path (e.g., workspaces/nat5_maths_exam_20260113_164331)
        question_id: Question to regenerate (e.g., "q8")
        max_iterations: Max critique iterations (default 3)
        max_turns: Max LLM turns per iteration (default 200)
        force_tool: Optional tool override (MATPLOTLIB, DESMOS, JSXGRAPH, PLOTLY, IMAGE_GENERATION)

    Returns:
        DiagramGenerationResult with success/failure and image path

    Raises:
        ValueError: If workspace or required files not found (fail-fast)
        RuntimeError: If diagram services unavailable
    """
    from ..agents.diagram_author_agent import DiagramAuthorAgent

    logger.info("=" * 60)
    logger.info(f"REGENERATE DIAGRAM: {question_id}")
    logger.info(f"   Root workspace: {workspace_path}")
    logger.info(f"   Max iterations: {max_iterations}")
    logger.info(f"   Max turns: {max_turns}")
    if force_tool:
        logger.info(f"   Force tool: {force_tool}")
    logger.info("=" * 60)

    # 1. Resolve question workspace path
    question_workspace = workspace_path / f"diagram_{question_id}"

    if not question_workspace.exists():
        raise ValueError(
            f"Question workspace not found: {question_workspace}\n"
            f"Available workspaces: {[d.name for d in workspace_path.iterdir() if d.is_dir() and d.name.startswith('diagram_')]}"
        )

    logger.info(f"   Question workspace: {question_workspace}")

    # 2. Load existing data (FAIL-FAST if missing)
    classification_data = _load_json(question_workspace / "classification_output.json")
    logger.info("   ✓ Loaded classification_output.json")

    # 3. Extract classification for this question
    classification = _extract_question_from_classification(classification_data, question_id)
    if not classification:
        raise ValueError(f"Classification for {question_id} not found in classification_output.json")

    # 4. Override tool if requested
    if force_tool:
        original_tool = classification.tool
        classification.tool = normalize_tool_type(force_tool)
        logger.info(f"   Tool override: {original_tool} -> {classification.tool}")

        # Update classification file with new tool
        classification_data["classifications"][0]["tool"] = classification.tool
        with open(question_workspace / "classification_output.json", 'w') as f:
            json.dump(classification_data, f, indent=2)

    logger.info(f"   Tool: {classification.tool}")

    # 5. Verify diagram services (FAIL-FAST)
    logger.info("   Checking diagram services...")
    _verify_diagram_services()

    # 6. Initialize DiagramAuthorAgent with custom limits
    api_base = os.environ.get("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
    api_key = os.environ.get("DIAGRAM_SCREENSHOT_API_KEY", "")

    agent = DiagramAuthorAgent(
        workspace_path=question_workspace,
        max_turns_per_diagram=max_turns,
        max_iterations=max_iterations,
        rendering_api_base=api_base,
        rendering_api_key=api_key
    )

    logger.info(f"   DiagramAuthorAgent initialized (max_turns={max_turns}, max_iterations={max_iterations})")

    # 7. Execute diagram generation
    logger.info("   Starting diagram generation...")
    try:
        author_result = await agent.execute()

        # Extract result for this question
        if author_result.diagrams and len(author_result.diagrams) > 0:
            diagram_data = author_result.diagrams[0]
            result = DiagramGenerationResult(
                question_id=question_id,
                success=diagram_data.success,
                iterations=diagram_data.iterations,
                final_score=diagram_data.final_score,
                image_path=diagram_data.image_path,
                diagram_type=classification.tool.lower(),
                critic_notes=diagram_data.critic_notes,
                error=diagram_data.error
            )
        else:
            result = DiagramGenerationResult(
                question_id=question_id,
                success=False,
                error="No diagram result returned from agent"
            )

    except Exception as e:
        logger.error(f"   Diagram generation failed: {e}")
        result = DiagramGenerationResult(
            question_id=question_id,
            success=False,
            error=str(e)
        )

    # 8. Update manifest with new result
    _update_diagram_manifest(question_workspace, result)

    # 9. Log result
    logger.info("=" * 60)
    if result.success:
        logger.info(f"✓ REGENERATION SUCCESSFUL")
        logger.info(f"   Image: {result.image_path}")
        logger.info(f"   Score: {result.final_score:.2f}")
        logger.info(f"   Iterations: {result.iterations}")
    else:
        logger.info(f"✗ REGENERATION FAILED")
        logger.info(f"   Error: {result.error}")
    logger.info("=" * 60)

    return result
