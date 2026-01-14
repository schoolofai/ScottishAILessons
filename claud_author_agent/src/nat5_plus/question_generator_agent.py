"""
Question Generator Agent

Generates individual questions using Claude Agent SDK with structured outputs.
Key insight: Generate questions one at a time (2-3K tokens) for reliability.

Uses output_format={'type': 'json_schema'} for guaranteed valid JSON.

DESIGN PRINCIPLE: Subject-agnostic design - works for Mathematics, English,
History, or any SQA subject. Uses prompt engineering and LLM capabilities
rather than hardcoded subject-specific values.
"""

import logging
import random
from collections import Counter
from typing import Optional, List, Dict, Any
from pathlib import Path

from ..models.nat5_plus_question_generation_schema import (
    QuestionSpec,
    QuestionGeneration,
    ExamPlan,
)

logger = logging.getLogger(__name__)


# Question generation prompt template - SUBJECT-AGNOSTIC DESIGN
# Works for Mathematics, English, History, or any SQA subject
QUESTION_GENERATION_PROMPT = """You are an expert SQA exam question author for {subject} at {level} level.

## Your Task
Generate a UNIQUE exam question that is distinctly different from any questions already
generated for this exam. You must create variety through creative scenarios, different
approaches, and subject-appropriate contexts.

## Subject Context
- Subject: {subject}
- Level: {level}
- Question Position: {question_position} of 15

## Question Requirements
- Topic: {topic}
- Sub-topic Focus: {sub_topic_focus}
- Learning Outcome: {learning_outcome_id}
- Marks: {marks}
- Difficulty: {difficulty}
- Question Style: {question_style}

## Topic Details
{topic_description}

## Template Reference (for style guidance only)
The following template shows the expected SQA style for this type of question.
Use it for FORMAT inspiration only - generate COMPLETELY NEW content.
Template Pattern: {template_pattern}
Marking Structure: {marking_structure}

## Variety Instructions
1. **Create a UNIQUE scenario/context** appropriate for {subject}
   - For Mathematics: vary between abstract notation, real-world scenarios, scientific applications
   - For English: vary between poetry analysis, prose, persuasive writing, close reading
   - For History: vary between source analysis, extended response, comparison questions
   - For any subject: use your expertise to select appropriate question contexts

2. **Vary the approach** within the topic
   - Different angles on the same concept
   - Different skill demonstrations (recall vs analysis vs evaluation)
   - Different presentation styles appropriate for {subject}

3. **Variation Seed: {variation_seed}**
   Use this number to inspire unique creative choices - let it guide your variation decisions.

## MUST AVOID - Questions with these patterns already exist in this exam:
{avoid_patterns}

Generate a question that is CLEARLY DIFFERENT from the patterns above.

## SQA Marking Scheme Requirements
Your marking scheme MUST follow SQA format:
1. Generic Scheme: Process steps that earn marks (what the student must DO)
2. Illustrative Scheme: Example correct answers for each bullet

## Constraints
- Question must be academically correct for {subject}
- Marks must be achievable with clear steps
- Include LaTeX for mathematical expressions if applicable
- Difficulty must match specification: {difficulty}
- DO NOT copy past paper questions - create something original
- Ensure the question tests the specified topic and sub-topic focus

Generate the question now.
"""


async def generate_exam_plan(
    sow_topics: List[Dict[str, Any]],
    templates: List[Dict[str, Any]],
    existing_summaries: List[Dict[str, Any]],
    target_marks: int = 90,
    target_questions: int = 15,
    subject: str = "",
    level: str = ""
) -> ExamPlan:
    """Generate an exam plan specifying which questions to create.

    DESIGN: Subject-agnostic with randomization for variety.
    Works for Mathematics, English, History, or any SQA subject.

    Args:
        sow_topics: Available topics from SOW
        templates: Past paper templates for style reference
        existing_summaries: Previously generated exam summaries
        target_marks: Total marks to achieve
        target_questions: Number of questions to generate
        subject: Subject name (e.g., "Mathematics", "English")
        level: Qualification level (e.g., "National 5", "Higher")

    Returns:
        ExamPlan with question specifications
    """
    logger.info(f"Generating exam plan: {target_marks} marks, {target_questions} questions")
    logger.info(f"Subject: {subject}, Level: {level}")

    # Calculate target marks per question
    avg_marks = target_marks / target_questions

    # Build question specifications with variety enforcement
    question_specs: List[QuestionSpec] = []
    used_spec_fingerprints: set = set()
    avoid_patterns: List[str] = []

    # CHANGE 1: Shuffle difficulties for variety (not deterministic order)
    easy_count = int(target_questions * 0.3)
    medium_count = int(target_questions * 0.5)
    hard_count = target_questions - easy_count - medium_count

    difficulties = (
        ["easy"] * easy_count +
        ["medium"] * medium_count +
        ["hard"] * hard_count
    )
    random.shuffle(difficulties)
    logger.info(f"Shuffled difficulties: {difficulties}")

    # CHANGE 2: Determine question styles from templates (subject-agnostic)
    style_distribution = _get_style_distribution_from_templates(templates)
    styles_list = _build_styles_list(style_distribution, target_questions)
    random.shuffle(styles_list)
    logger.info(f"Styles from templates: {style_distribution}")

    # Track topic usage to enforce variety
    topic_usage: Counter = Counter()

    for i in range(target_questions):
        difficulty = difficulties[i]
        style = styles_list[i] if i < len(styles_list) else "procedural"

        # CHANGE 3: Select topic with variety enforcement (avoid overuse)
        topic = _select_topic_with_variety(sow_topics, topic_usage, difficulty)
        topic_usage[topic.get("topic_id", topic.get("topic_name", ""))] += 1

        # CHANGE 4: Randomized template matching (top-3 instead of greedy)
        template = _find_matching_template_randomized(templates, topic, difficulty, style)

        # Extract sub-topic focus from learning outcomes
        learning_outcomes = topic.get("learning_outcomes", [])
        sub_topic_focus = ""
        learning_outcome_id = ""
        if learning_outcomes:
            # Pick a random learning outcome for variety
            outcome = random.choice(learning_outcomes)
            if isinstance(outcome, dict):
                sub_topic_focus = outcome.get("description", "")
                learning_outcome_id = outcome.get("outcome_id", "")
            elif isinstance(outcome, str):
                sub_topic_focus = outcome

        # Adjust marks based on difficulty
        if difficulty == "easy":
            marks = max(2, min(4, int(avg_marks * 0.7)))
        elif difficulty == "hard":
            marks = max(5, min(8, int(avg_marks * 1.3)))
        else:
            marks = max(3, min(6, int(avg_marks)))

        # CHANGE 5: Generate variation seed for uniqueness
        variation_seed = random.randint(1000, 9999)

        # Build spec with subject context and diversity fields
        spec = QuestionSpec(
            topic=topic.get("topic_name", ""),
            template_paper_id=template.get("template_id", "") if template else "",
            marks=marks,
            difficulty=difficulty,
            question_style=style,
            # Subject context for LLM
            subject=subject,
            level=level,
            # Diversity fields
            sub_topic_focus=sub_topic_focus,
            learning_outcome_id=learning_outcome_id,
            variation_seed=variation_seed,
            avoid_patterns=avoid_patterns.copy(),  # Patterns to avoid
            question_position=i + 1  # 1-indexed position
        )

        # CHANGE 6: Spec-level fingerprint to detect duplicates before generation
        spec_fingerprint = f"{subject}|{spec.topic}|{difficulty}|{style}|{sub_topic_focus}"
        if spec_fingerprint in used_spec_fingerprints:
            # Try to make spec unique by picking different sub-topic
            spec = _make_spec_unique(spec, topic, used_spec_fingerprints, subject)
            spec_fingerprint = f"{subject}|{spec.topic}|{spec.difficulty}|{spec.question_style}|{spec.sub_topic_focus}"

        used_spec_fingerprints.add(spec_fingerprint)
        question_specs.append(spec)

        # Track patterns for avoid_patterns (summary of what was used)
        avoid_patterns.append(f"Topic: {spec.topic}, Style: {style}, Focus: {sub_topic_focus[:50]}")

        logger.info(f"Spec {i+1}: {spec.topic} ({difficulty}, {style}) - seed={variation_seed}")

    # Adjust total marks
    _adjust_marks_to_target(question_specs, target_marks)

    plan = ExamPlan(
        question_specs=question_specs,
        target_total_marks=target_marks,
        section_distribution={
            "section_a": 40,
            "section_b": target_marks - 40
        }
    )

    logger.info(f"Generated plan with {len(question_specs)} question specs")
    return plan


def _get_style_distribution_from_templates(templates: List[Dict[str, Any]]) -> Dict[str, int]:
    """Extract question style distribution from past paper templates."""
    style_counts: Counter = Counter()
    for template in templates:
        style = template.get("question_style", "procedural")
        style_counts[style] += 1
    return dict(style_counts)


def _build_styles_list(style_distribution: Dict[str, int], target_count: int) -> List[str]:
    """Build a list of styles proportional to template distribution."""
    if not style_distribution:
        return ["procedural"] * target_count

    total = sum(style_distribution.values())
    styles = []
    for style, count in style_distribution.items():
        proportion = count / total
        style_count = max(1, int(target_count * proportion))
        styles.extend([style] * style_count)

    # Pad or trim to exact target
    while len(styles) < target_count:
        styles.append(random.choice(list(style_distribution.keys())))
    return styles[:target_count]


def _select_topic_with_variety(
    topics: List[Dict[str, Any]],
    topic_usage: Counter,
    difficulty: str
) -> Dict[str, Any]:
    """Select a topic ensuring variety (avoid overusing same topic)."""
    if not topics:
        raise ValueError("No topics available for question generation")

    # Find minimum usage count
    min_usage = min(topic_usage.values()) if topic_usage else 0

    # Candidates are topics at or near minimum usage
    candidates = [
        t for t in topics
        if topic_usage.get(t.get("topic_id", t.get("topic_name", "")), 0) <= min_usage + 1
    ]

    # If no candidates at min usage, allow any topic
    if not candidates:
        candidates = topics

    # Prefer topics matching difficulty if specified in topic metadata
    difficulty_matched = [
        t for t in candidates
        if t.get("difficulty_level", "medium") == difficulty
    ]
    if difficulty_matched:
        candidates = difficulty_matched

    return random.choice(candidates)


def _find_matching_template_randomized(
    templates: List[Dict[str, Any]],
    topic: Dict[str, Any],
    difficulty: str,
    style: str
) -> Optional[Dict[str, Any]]:
    """Find template with randomization (top-3 instead of greedy best match)."""
    if not templates:
        return None

    topic_tags = set(topic.get("keywords", []))
    scored_templates = []

    for template in templates:
        template_tags = set(template.get("topic_tags", []))
        score = len(topic_tags & template_tags)

        # Bonus for matching difficulty
        if template.get("difficulty_estimate") == difficulty:
            score += 2

        # Bonus for matching style
        if template.get("question_style") == style:
            score += 3

        scored_templates.append((score, template))

    # Sort by score descending
    scored_templates.sort(key=lambda x: x[0], reverse=True)

    # Pick randomly from top-3 instead of always best
    top_k = min(3, len(scored_templates))
    if top_k == 0:
        return None

    return random.choice([t[1] for t in scored_templates[:top_k]])


def _make_spec_unique(
    spec: QuestionSpec,
    topic: Dict[str, Any],
    used_fingerprints: set,
    subject: str
) -> QuestionSpec:
    """Attempt to make a spec unique by varying sub-topic or seed."""
    learning_outcomes = topic.get("learning_outcomes", [])

    # Try different learning outcomes
    for outcome in learning_outcomes:
        if isinstance(outcome, dict):
            new_focus = outcome.get("description", "")
            new_outcome_id = outcome.get("outcome_id", "")
        else:
            new_focus = str(outcome)
            new_outcome_id = ""

        new_fingerprint = f"{subject}|{spec.topic}|{spec.difficulty}|{spec.question_style}|{new_focus}"
        if new_fingerprint not in used_fingerprints:
            spec.sub_topic_focus = new_focus
            spec.learning_outcome_id = new_outcome_id
            spec.variation_seed = random.randint(1000, 9999)
            logger.info(f"Made spec unique with sub-topic: {new_focus[:50]}")
            return spec

    # If all outcomes used, just change the seed
    spec.variation_seed = random.randint(10000, 99999)
    logger.warning(f"Could not make spec fully unique, changed seed to {spec.variation_seed}")
    return spec


async def generate_single_question(
    spec: QuestionSpec,
    sow_topics: List[Dict[str, Any]],
    templates: List[Dict[str, Any]],
    workspace_path: Path,
    question_index: int
) -> QuestionGeneration:
    """Generate a single question using Claude Agent SDK structured output.

    Args:
        spec: Question specification (includes subject context and diversity fields)
        sow_topics: Available topics for detail lookup
        templates: Past paper templates for style reference
        workspace_path: Directory for intermediate outputs
        question_index: Index for question ID

    Returns:
        Generated question with marking scheme
    """
    logger.info(f"Generating question: {spec.topic} ({spec.marks} marks, {spec.difficulty})")
    logger.info(f"  Subject: {spec.subject}, Level: {spec.level}, Seed: {spec.variation_seed}")

    # Find topic details
    topic_details = _find_topic_details(sow_topics, spec.topic)

    # Find template for style reference
    template = _find_template_by_id(templates, spec.template_paper_id)

    # Format avoid_patterns for prompt
    avoid_patterns_str = "\n".join([f"- {p}" for p in spec.avoid_patterns]) if spec.avoid_patterns else "None - this is the first question"

    # Build prompt with all diversity fields
    prompt = QUESTION_GENERATION_PROMPT.format(
        # Subject context
        subject=spec.subject or "the subject",
        level=spec.level or "this level",
        question_position=spec.question_position,
        # Core requirements
        topic=spec.topic,
        marks=spec.marks,
        difficulty=spec.difficulty,
        question_style=spec.question_style,
        # Diversity fields
        sub_topic_focus=spec.sub_topic_focus or "General coverage of the topic",
        learning_outcome_id=spec.learning_outcome_id or "Not specified",
        variation_seed=spec.variation_seed,
        avoid_patterns=avoid_patterns_str,
        # Reference material
        topic_description=topic_details.get("description", ""),
        template_pattern=template.get("stem_pattern", "") if template else "Standard SQA format",
        marking_structure=str(template.get("marking_pattern", {})) if template else "Standard bullet-point marking"
    )

    # Use Claude Agent SDK with structured output
    try:
        from claude_agent_sdk import ClaudeAgentOptions, query
        from ..utils.schema_sanitizer import wrap_schema_for_sdk_structured_output

        # Get sanitized schema
        sanitized_schema = wrap_schema_for_sdk_structured_output(
            QuestionGeneration.model_json_schema()
        )

        options = ClaudeAgentOptions(
            output_format={
                "type": "json_schema",
                "schema": sanitized_schema
            },
            permission_mode="bypassPermissions",
            max_turns=5
        )

        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'structured_output') and message.structured_output:
                # SDK wraps structured output in 'parameter' key - extract it
                output_data = message.structured_output
                if isinstance(output_data, dict) and 'parameter' in output_data:
                    output_data = output_data['parameter']

                question = QuestionGeneration.model_validate(output_data)
                question.question_id = f"q{question_index}"
                question.topic_ids = [topic_details.get("topic_id", "")]

                # Save to workspace
                _save_question(question, workspace_path, question_index)

                logger.info(f"Generated question {question_index}: {question.marks} marks")
                return question

        raise ValueError("No structured output received from LLM")

    except ImportError:
        logger.warning("Claude Agent SDK not available, using mock generation")
        return _mock_generate_question(spec, question_index)


def _find_topic_details(topics: List[Dict[str, Any]], topic_name: str) -> Dict[str, Any]:
    """Find topic details by name."""
    for topic in topics:
        if topic.get("topic_name", "").lower() == topic_name.lower():
            return topic
    return {"topic_name": topic_name, "description": ""}


def _find_template_by_id(templates: List[Dict[str, Any]], template_id: str) -> Optional[Dict[str, Any]]:
    """Find template by ID."""
    for template in templates:
        if template.get("template_id") == template_id:
            return template
    return None


def _adjust_marks_to_target(specs: List[QuestionSpec], target: int) -> None:
    """Adjust question marks to hit target total."""
    current_total = sum(s.marks for s in specs)
    diff = target - current_total

    if diff == 0:
        return

    # Distribute difference across questions
    per_question = diff // len(specs)
    remainder = diff % len(specs)

    for i, spec in enumerate(specs):
        adjustment = per_question + (1 if i < abs(remainder) else 0)
        if diff < 0:
            adjustment = -adjustment
        spec.marks = max(1, spec.marks + adjustment)


def _save_question(question: QuestionGeneration, workspace_path: Path, index: int) -> None:
    """Save generated question to workspace."""
    questions_dir = workspace_path / "questions"
    questions_dir.mkdir(parents=True, exist_ok=True)

    output_path = questions_dir / f"q_{index:03d}.json"
    with open(output_path, "w") as f:
        f.write(question.model_dump_json(indent=2))

    logger.info(f"Saved question to {output_path}")


def _mock_generate_question(spec: QuestionSpec, index: int) -> QuestionGeneration:
    """Generate a mock question when SDK is not available."""
    from ..models.nat5_plus_question_generation_schema import (
        MarkingSchemeGen,
        GenericSchemeBullet,
        IllustrativeAnswerGen
    )

    return QuestionGeneration(
        question_id=f"q{index}",
        question_number=str(index),
        marks=spec.marks,
        difficulty=spec.difficulty,
        stem=f"[Mock] Question about {spec.topic}",
        stem_latex=f"[Mock] Question about {spec.topic}",
        marking_scheme=MarkingSchemeGen(
            max_marks=spec.marks,
            generic_scheme=[
                GenericSchemeBullet(bullet=1, process="Step 1", marks=spec.marks)
            ],
            illustrative_scheme=[
                IllustrativeAnswerGen(bullet=1, answer="Answer")
            ],
            notes=[]
        ),
        diagram_needed=False,
        diagram_spec=None,
        topic_ids=[],
        hints=[],
        common_errors=[]
    )
