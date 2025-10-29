"""LLM-powered conversational teaching agent for Scottish AI Lessons."""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import os
import logging
import json
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


def parse_outcome_refs(outcome_refs_data):
    """Parse outcomeRefs - extracts titles for display in prompts"""
    if isinstance(outcome_refs_data, str):
        try:
            parsed = json.loads(outcome_refs_data)
            # If it's objects, extract titles for prompt display
            if parsed and isinstance(parsed[0], dict):
                return [ref.get('title', '') for ref in parsed]
            return parsed
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse outcomeRefs JSON: {outcome_refs_data}")
            return []
    elif isinstance(outcome_refs_data, list):
        if outcome_refs_data and isinstance(outcome_refs_data[0], dict):
            return [ref.get('title', '') for ref in outcome_refs_data]
        return outcome_refs_data
    return []


def _format_sqa_alignment_summary(enriched_outcomes: Optional[List[Dict]]) -> str:
    """Format enriched outcomes with detailed assessment standards for teaching guidance.

    Transforms generic outcome data into actionable teaching information by exposing:
    - Unit context (title and code)
    - Assessment standards with codes (e.g., 2.1, 2.2)
    - Skills being assessed
    - Marking guidance for teachers

    Args:
        enriched_outcomes: List of CourseOutcome dictionaries from course_outcomes collection

    Returns:
        Formatted multi-line string for LLM system prompts
    """
    if not enriched_outcomes:
        return ""

    lines = ["SQA Learning Outcomes:"]
    lines.append("━" * 60)

    for outcome in enriched_outcomes[:3]:  # Limit to first 3 for prompt brevity
        outcome_id = outcome.get("outcomeId", "")
        unit_code = outcome.get("unitCode", "")
        unit_title = outcome.get("unitTitle", "")

        # Show unit context for geographical orientation
        if unit_title and unit_code:
            lines.append(f"\nUnit: {unit_title} [{unit_code}]")

        # Parse assessment standards JSON (the actually useful teaching data!)
        assessment_standards_json = outcome.get("assessmentStandards", "[]")
        try:
            standards = json.loads(assessment_standards_json) if isinstance(assessment_standards_json, str) else []
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse assessmentStandards for outcome {outcome_id}")
            standards = []

        if outcome_id and standards:
            lines.append(f"\nOutcome {outcome_id} Assessment Standards:")

            for standard in standards:
                code = standard.get("code", "")
                desc = standard.get("desc", "")
                skills = standard.get("skills_list", [])
                marking = standard.get("marking_guidance", "")

                if code and desc:
                    # Main assessment standard description
                    lines.append(f"  • {code}: {desc}")

                    # Show skills being assessed (truncate if too long)
                    if skills:
                        if isinstance(skills, list):
                            skills_text = ", ".join(skills)
                        else:
                            skills_text = str(skills)

                        if len(skills_text) > 80:
                            skills_text = skills_text[:77] + "..."
                        lines.append(f"    ↳ Skills: {skills_text}")

                    # Show marking guidance (truncate if too long)
                    if marking:
                        marking_short = marking if len(marking) <= 100 else marking[:97] + "..."
                        lines.append(f"    ↳ Marking: {marking_short}")

        elif outcome_id:
            # Fallback: Show generic outcome title if no standards available
            outcome_title = outcome.get("outcomeTitle", "")
            if outcome_title:
                lines.append(f"\nOutcome {outcome_id}: {outcome_title[:80]}...")

    return "\n".join(lines)


def format_course_context_for_prompt(
    course_subject_display: Optional[str],
    course_level_display: Optional[str],
    lesson_type_display: Optional[str],
    engagement_tags: Optional[List[str]],
    lesson_policy: Optional[Dict],
    enriched_outcomes: Optional[List[Dict]]
) -> Dict[str, str]:
    """Generate human-readable course context strings for LLM prompts.

    Args:
        course_subject_display: Title-cased subject name
        course_level_display: Title-cased level name
        lesson_type_display: Title-cased lesson type
        engagement_tags: List of engagement strategy tags
        lesson_policy: Lesson policy dictionary
        enriched_outcomes: List of full outcome objects with SQA data

    Returns:
        Dictionary with formatted prompt strings:
        - tutor_role_description: "friendly, encouraging Physics tutor for Scottish National 4 students"
        - course_context_block: Multi-line course context for system prompts
        - engagement_guidance: Teaching strategies based on tags
        - policy_reminders: Lesson policy statements
        - sqa_alignment_summary: Brief SQA outcome alignment info
    """
    # Build tutor role description
    subject_str = course_subject_display or "learning"
    level_str = course_level_display or "students"
    tutor_role = f"friendly, encouraging {subject_str} tutor for Scottish {level_str} students"

    # Build course context block
    course_context_lines = []
    if course_subject_display and course_level_display:
        course_context_lines.append(f"Subject: {course_subject_display}")
        course_context_lines.append(f"Level: {course_level_display}")
    if lesson_type_display:
        course_context_lines.append(f"Lesson Type: {lesson_type_display}")

    course_context_block = "\n".join(course_context_lines) if course_context_lines else ""

    # Build engagement guidance from tags
    engagement_strategies = {
        "real_world_context": "Use everyday contexts (shopping, money, sports, real-world scenarios)",
        "scaffolding": "Break down complex concepts into smaller, manageable steps",
        "visual_aids": "Use diagrams, charts, and visual representations when explaining",
        "worked_examples": "Provide step-by-step worked examples before asking questions",
        "collaborative": "Encourage discussion and collaborative problem-solving",
        "technology": "Suggest using technology tools (calculators, apps) where appropriate"
    }

    guidance_lines = []
    if engagement_tags:
        guidance_lines.append("Teaching Strategies for This Lesson:")
        for tag in engagement_tags:
            if tag in engagement_strategies:
                guidance_lines.append(f"- {engagement_strategies[tag]}")

    engagement_guidance = "\n".join(guidance_lines) if guidance_lines else ""

    # Build policy reminders
    policy_lines = []
    if lesson_policy:
        if lesson_policy.get("calculator_allowed"):
            policy_lines.append("- Calculator use is permitted for this lesson")
        if lesson_policy.get("formula_sheet_allowed"):
            policy_lines.append("- Students may refer to formula sheets")
        # Add more policy checks as needed

    policy_reminders = "\n".join(policy_lines) if policy_lines else ""

    # Build SQA alignment summary using the enhanced formatter
    # This now shows detailed assessment standards with skills and marking guidance
    # instead of just generic outcome titles
    sqa_alignment_summary = _format_sqa_alignment_summary(enriched_outcomes)

    return {
        "tutor_role_description": tutor_role,
        "course_context_block": course_context_block,
        "engagement_guidance": engagement_guidance,
        "policy_reminders": policy_reminders,
        "sqa_alignment_summary": sqa_alignment_summary
    }


def extract_curriculum_context_from_state(state: Dict) -> Dict[str, str]:
    """Extract curriculum metadata from state and format for prompts.

    This is a convenience wrapper that pulls curriculum fields from state
    and formats them using format_course_context_for_prompt.

    Args:
        state: InterruptUnifiedState or similar state dict

    Returns:
        Formatted prompt strings dictionary
    """
    return format_course_context_for_prompt(
        course_subject_display=state.get("course_subject_display"),
        course_level_display=state.get("course_level_display"),
        lesson_type_display=state.get("lesson_type_display"),
        engagement_tags=state.get("engagement_tags", []),
        lesson_policy=state.get("lesson_policy", {}),
        enriched_outcomes=state.get("enriched_outcomes", [])
    )


def get_lesson_type_pedagogy_guidance(lesson_type: str) -> str:
    """Return lesson-type-specific pedagogical guidance for LLM prompts.

    Args:
        lesson_type: One of "teach", "independent_practice", "formative_assessment", "revision"

    Returns:
        Detailed pedagogical instructions for the specific lesson type
    """
    guidance_map = {
        "teach": """
TEACHING APPROACH (Teach Lesson):
- Use the EXPLAINER o teach the concept from first principles
- Build understanding step-by-step using the provided teaching materials
- Assume minimal prior knowledge - explain thoroughly using the explainer content
- At the end of the lesson, the student should be able to answer the question themselves, so cover all the key concepts and examples in the explainer and question.""",


        "independent_practice": """
TEACHING APPROACH (Independent Practice):
- Reference the EXPLAINER content briefly as a reminder
- Work through the provided EXAMPLES to demonstrate the method
- You may create SIMILAR practice examples (different numbers/context) to show the process
- Encourage them to apply what they've learned

CRITICAL - CFU Question Handling:
- The Question/CFU is for the STUDENT to practice - DO NOT solve it
- Present the CFU question as their independent practice task
- They need to work it out themselves to build proficiency
- Provide hints if they struggle (during feedback), but don't solve it upfront""",

        "formative_assessment": """
TEACHING APPROACH (Formative Assessment):
- Minimal teaching - this is about measuring what they already know
- You may reference the EXPLAINER very briefly (1 sentence) as context only
- DO NOT work through examples - we're assessing, not teaching
- Keep all guidance extremely light

CRITICAL - CFU Question Handling:
- The Question/CFU is the ASSESSMENT - DO NOT provide any solution or hints
- Present the question cleanly and clearly
- Let their response reveal their current understanding level
- This is diagnostic - their struggle or success tells us where they are""",

        "revision": """
TEACHING APPROACH (Revision):
- Use the EXPLAINER to jog their memory with a brief (2-3 sentence) reminder
- You may reference the EXAMPLES quickly to refresh their recall
- Keep it concise - they've learned this before, just need a memory trigger
- Don't re-teach from scratch, just prompt recall

CRITICAL - CFU Question Handling:
- The Question/CFU is to CHECK retention - DO NOT solve it
- After the brief reminder, present the CFU question for them to answer
- They should be able to apply their remembered knowledge to solve it"""
    }

    # Default to "teach" if unknown lesson type
    return guidance_map.get(lesson_type, guidance_map["teach"])


class RubricCriterionResult(BaseModel):
    """Per-criterion rubric evaluation result used in structured output."""
    description: str = Field(description="Rubric criterion description")
    points_awarded: float = Field(description="Points awarded for this criterion", ge=0.0)
    max_points: float = Field(description="Maximum points for this criterion", gt=0.0)

    class Config:
        # Ensure OpenAI response_format schema has additionalProperties: false
        extra = 'forbid'


class EvaluationResponse(BaseModel):
    """Structured response for LLM-based evaluation."""
    is_correct: bool = Field(description="Whether the student response is correct")
    confidence: float = Field(description="Confidence in the evaluation (0.0-1.0)", ge=0.0, le=1.0)
    feedback: str = Field(description="Contextual feedback for the student")
    reasoning: str = Field(description="Internal reasoning for the evaluation decision")
    should_progress: bool = Field(description="Whether to move forward regardless of correctness")
    partial_credit: Optional[float] = Field(default=None, description="Partial credit score (0.0-1.0)", ge=0.0, le=1.0)
    rubric_breakdown: Optional[List[RubricCriterionResult]] = Field(
        default=None,
        description="Per-criterion evaluation breakdown with points awarded"
    )


class LLMTeacher:
    """Conversational AI teacher for lesson delivery."""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Teaching prompt templates

        # Card presentation prompt for subsequent non-MCQ cards
        self.card_presentation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a {tutor_role_description}.
You're continuing a lesson on {lesson_title} focusing on {outcome_refs}.

<Teaching Process>
Teach the lesson using the following process in markdown format:
1. Continue naturally from the previous content (DO NOT greet - student was already greeted)
2. Present the current concept/topic
3. Present Lesson based on the following guidance
   - {lesson_type_pedagogy}
   - {engagement_guidance}
   - {policy_reminders}
4. Ends saying - "Let's answer this question before moving on to the next part of the lesson." verbatim, do not generate any questions - question will be preseted by code later.

IMPORTANT CONTINUATION GUIDELINES:
- DO NOT include a greeting (student was already greeted at the start)
- Focus on teaching the current card's concept clearly
- Connect naturally to what was learned previously
</Teaching Process>

<card context>
Card Details:
- Title: {card_title}
- Explainer: {card_explainer}
- Card context: {course_context_block}
- Sqa alignment summary: {sqa_alignment_summary}
</card context>

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Present this card: {card_title}")
        ])

        self.structured_evaluation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are evaluating a {level_description} {subject_area} student's response with structured output.

{course_context_block}

Context:
- Question Type: {question_type}
- Question: {question}
- Expected Answer: {expected}
- Student Response: {student_response}
- Current Attempt: {attempt_number}
- Maximum Attempts: {max_attempts}
- Card Context: {card_context}

Rubric for Evaluation:
{rubric_text}

When evaluating:
1. Apply each rubric criterion independently
2. Award points based on CONCEPTUAL UNDERSTANDING, not formatting/explanation detail
3. Provide criterion-specific reasoning
4. Sum points from all criteria for partial_credit score (0.0-1.0 scale)

CRITICAL EVALUATION THRESHOLD:
5. Set is_correct=true if partial_credit ≥ 0.6 (60% threshold for passing)
   - ≥60%: Student demonstrates sufficient understanding → is_correct=true, should_progress=true
   - <60%: Needs more work → is_correct=false, should_progress depends on attempt_number

6. Rubric Interpretation Philosophy:
   - Focus on WHETHER student identified correct concepts (yes/no)
   - Accept minimal reasoning - even 2-3 words counts as "explanation"
   - "Identifies X as irrelevant" = Award points if they mention X AT ALL
   - "With brief explanation" = Accept ANY reasoning phrase, don't require full sentences
   - Partial lists are OK - if rubric says "identify at least two" and they identify one, give 0.5 points

7. Be LENIENT with formatting, phrasing, and explanation detail:
   - "voltage is relevant" = sufficient explanation
   - "size not needed" = sufficient explanation
   - Bullet points, fragments, shorthand = all acceptable
   - Focus on whether core concept is understood, not how it's expressed

8. **MANDATORY FEEDBACK STRUCTURE - You MUST use this exact format**:

   Start your feedback with:
   "**Assessment Summary:**
   Overall Score: [X]/[Y] points ([Z]%)

   Rubric Breakdown:
   * [Criterion 1 name]: [awarded]/[max] points [status emoji: ✓ Complete / ⚠ Partial / ✗ Not Met]
   * [Criterion 2 name]: [awarded]/[max] points [status]
   * ...

   **What You Did Well:**
   - [Specific strength related to criteria where they scored full/high points]
   - [Another strength if applicable]

   **Areas for Improvement:**
   - **[Criterion name where points lost]**: [Concrete suggestion WITHOUT revealing answer - guide toward method/concept]
   - [Another area if applicable]

   **Next Steps:**
   - [1-2 actionable hints to improve on weak criteria without giving away solution]"

   EXAMPLE for 60% threshold pass (3/5 points):
   "**Assessment Summary:**
   Overall Score: 3/5 points (60%)

   Rubric Breakdown:
   * Identifying relevant factors: 2/2 points ✓ Complete
   * Explaining why factors are relevant: 1/2 points ⚠ Partial
   * Identifying irrelevant factors: 0/1 point ✗ Not Met

   **What You Did Well:**
   - You correctly identified voltage and current as key factors - excellent recognition of what matters!
   - Your understanding of the relevant variables is solid

   **Areas for Improvement:**
   - **Explaining relevance**: You mentioned voltage is relevant, but adding WHY (e.g., 'higher voltage transfers more energy') would make your answer complete
   - **Irrelevant factors**: You didn't mention which factors are NOT needed - think about properties that don't affect the calculation

   **Next Steps:**
   - Consider: What property of the wire actually affects resistance? Is the wire's color scientifically relevant?
   - Try explaining the relationship between your identified factors and energy transfer"

   EXAMPLE for <60% needs improvement (2/5 points):
   "**Assessment Summary:**
   Overall Score: 2/5 points (40%)

   Rubric Breakdown:
   * Identifying relevant factors: 1/2 points ⚠ Partial
   * Explaining why factors are relevant: 1/2 points ⚠ Partial
   * Identifying irrelevant factors: 0/1 point ✗ Not Met

   **What You Did Well:**
   - You mentioned voltage, which is definitely one of the key factors - good start!

   **Areas for Improvement:**
   - **Identifying relevant factors**: You've found voltage, but there's another important factor you're missing. Think about what flows through the circuit
   - **Explaining relevance**: Try adding WHY voltage matters - what does higher voltage do to the energy transfer?
   - **Irrelevant factors**: Consider which properties of the wire don't actually affect the physics here

   **Next Steps:**
   - Review the circuit diagram - what two things are being measured that affect energy transfer?
   - Think about the equation: Power = ? × ? (what goes in those spaces?)"

   CRITICAL: Always celebrate strengths first, then guide improvements WITHOUT revealing the answer

Common Misconceptions for This Question:
{misconceptions_text}

If the student's error matches a known misconception, reference the provided clarification in your feedback.

Evaluation Guidelines:
1. For numeric questions: Accept reasonable approximations, alternative formats (fractions, decimals), and contextual answers
2. For MCQ questions:
   - If expected answer is a dict with MCQ info, compare student response to correct_human_index (1-indexed)
   - Student may respond with numbers (1, 2, 3) or option text
   - Be flexible: "2" should match correct_human_index 2
   - Example: if correct_human_index is 2 and student responds "2", mark as correct
3. For open-ended: Look for conceptual understanding and key ideas
4. Consider partial credit for partially correct responses - BE GENEROUS with partial credit
5. CRITICAL: In feedback, DO NOT reveal the correct answer - only provide hints and guidance
6. For incorrect responses (<60%): Give conceptual hints, point to the method/process, encourage retry
7. For threshold passes (≥60%): Acknowledge their understanding while gently noting areas for improvement
8. Example good feedback (≥60%): "You've identified the key information! To make your answer even stronger, you could briefly explain why X is irrelevant."
9. Example good feedback (<60%): "Think about what 0.2 means - how many tenths? Can you simplify that fraction?"
10. Example bad feedback: "The answer is 1/5" or "0.2 equals 1/5"
11. Be encouraging and guide learning without giving away the solution
12. The correct answer will be revealed separately if needed after max attempts

IMPORTANT LATEX FORMATTING: When including mathematical expressions in feedback, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters.

Return your evaluation as structured output."""),
            ("human", "Evaluate this student response")
        ])
        
        self.transition_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're transitioning between lesson concepts for a {level_description} {subject_area} student.

{course_context_block}

Just completed: {completed_card}
Next up: {next_card}
Student progress: {progress_context}

{assessment_feedback}

TRANSITION GUIDELINES:
1. **Acknowledge Assessment Performance** (if feedback provided):
   - **MANDATORY**: Name 1-2 specific criteria from the Rubric Breakdown (use the exact criterion names)
   - Include the point score for those criteria (e.g., "1/1 points" or "2/2 points")
   - Celebrate what they mastered by referencing the actual rubric criterion name
   - Keep it brief (1-2 sentences) - don't repeat entire rubric breakdown
   - Example criterion references: "identifying renewable energy sources (1/1 points)", "explaining why coal is non-renewable (2/2 points)"

2. **Connect to Next Topic:**
   - Show how completed concept relates to upcoming content
   - Build confidence by linking their demonstrated skills to what's next

3. **Maintain Momentum:**
   - Keep transition concise and forward-looking
   - Focus on learning progression, not just completion

EXAMPLE with assessment feedback (FOLLOW THIS PATTERN):
"Excellent work on energy sources! You nailed identifying renewable energy sources (1/1 points) and explaining why coal is non-renewable (2/2 points) - that precision shows solid understanding. Those identification and explanation skills will be crucial as we explore Scotland's real-world energy applications. You'll see how the same analysis you just mastered applies to actual Scottish power stations. Ready to connect theory to practice?"

EXAMPLE without assessment feedback (skipped/first card):
"Great progress on energy sources! Now let's build on that foundation as we explore Scotland's energy applications - you'll see these concepts in action..."

Create a smooth, encouraging transition that celebrates their learning and builds excitement for the next topic.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Transition to the next topic")
        ])
        
        self.completion_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're completing a {level_description} {subject_area} lesson.

{course_context_block}

Lesson: {lesson_title}
Cards completed: {completed_cards}
Student performance: {progress_summary}

Provide an encouraging summary and congratulate the student on their progress."""),
            ("human", "Complete the lesson")
        ])
        
        self.correct_answer_explanation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're explaining the correct answer to a {level_description} {subject_area} student who has struggled with a question.

{course_context_block}

Card Context: {card_context}
Question: {question}
Expected Answer: {expected_answer}
Student Attempts: {student_attempts}

The student has tried their best but hasn't got the correct answer. Now provide a clear, encouraging explanation that:
0. Always start with thanking for effort followed by phrase like "Let's look at the correct approach:"
1. Shows the correct answer
2. Explains the step-by-step method to solve it
3. Helps them understand where they went wrong
4. Uses encouraging language - they tried hard!
5. Connects to the real-world context if applicable

Be supportive and educational - this is a learning moment, not a failure.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Explain the correct answer")
        ])
        
        self.lesson_summary_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are analyzing a completed Scottish {level_description} {subject_area} lesson to provide comprehensive feedback and guidance.

{course_context_block}

{sqa_alignment_summary}

Lesson Details:
- Title: {lesson_title}
- Outcome References: {outcome_refs}
- Total Cards: {total_cards}
- Cards Completed: {cards_completed}

Performance Analysis:
{performance_analysis}

Evidence Summary:
{evidence_summary}

Your task is to:
1. Congratulate the student on completing the lesson
2. Analyze their overall performance and learning patterns
3. Highlight their strengths and areas they mastered well
4. Identify areas that may need more practice
5. Provide specific, actionable recommendations
6. Decide whether they should retry this lesson or are ready to progress
7. End with encouraging next steps

Be supportive, specific, and educational. Focus on growth and learning rather than just correctness.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Analyze this completed lesson and provide comprehensive feedback")
        ])
        
        self.greeting_with_first_card_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a {tutor_role_description}.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.

<Teaching Process>
Teach the lesson using the following process in markdown format:
1. Welcomes the student warmly
2. Introduces the lesson topic naturally
3. Present Lesson based on the following guidance  
   - {lesson_type_pedagogy}
   - {engagement_guidance}
   - {policy_reminders}
4. Ends saying - "Let's answer this question before moving on to the next part of the lesson." verbatim, do not generate any questions - question will be preseted by code later.
</Teaching Process>

<card context>
Card Details:
- Title: {card_title}
- Explainer: {card_explainer}
- Card context: {course_context_block}
- Sqa alignment summary: {sqa_alignment_summary}
</card context>

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Start the lesson with the first card")
        ])
        
        self.greeting_with_first_mcq_card_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a {tutor_role_description}.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.

<Teaching Process>
Teach the lesson using the following process in markdown format:
1. Welcomes the student warmly
2. Introduces the lesson topic naturally
3. Present Lesson based on the following guidance - use <card context> to create lesson content. 
   - {lesson_type_pedagogy}
   - {engagement_guidance}
   - {policy_reminders}
4. Ends saying - "Let's answer this question before moving on to the next part of the lesson." verbatim, do not generate any questions - question will be preseted by code later.
</Teaching Process>

<card context>
Card Details:
- Title: {card_title}
- Explainer: {card_explainer}
- Card context: {course_context_block}
- Sqa alignment summary: {sqa_alignment_summary}
</card context>


IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Start the lesson with the first MCQ card")
        ])
        
        self.mcq_card_presentation_prompt = ChatPromptTemplate.from_messages([
            ("system", """Present this multiple choice question conversationally to a {level_description} {subject_area} student.

<Teaching Process>

Teach the lesson using the following process in markdown format:
1. Start the lesson by showing progress like - "Let's move to part {card_number} of {total_cards}" or "Now for part {card_number}..."
2. Introduces the lesson topic naturally
3. Present Lesson based on the following guidance  
   - {lesson_type_pedagogy}
   - {engagement_guidance}
   - {policy_reminders}
4. Ends saying - "Let's answer this question before moving on to the next part of the lesson." verbatim, do not generate any questions - question will be preseted by code later.
IMPORTANT CONTINUATION GUIDELINES:
- DO NOT include a greeting (student was already greeted at the start)
</Teaching Process>

<card context>
Card Details:
- Title: {card_title}
- Explainer: {card_explainer}
- Card context: {course_context_block}
- Sqa alignment summary: {sqa_alignment_summary}
</card context>


IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Present this MCQ card: {card_title}")
        ])





    
    # Synchronous versions for LangGraph compatibility



    def evaluate_response_sync_full(
        self, 
        student_response: str,
        expected_answer: Any,
        card_context: Dict,
        attempt_number: int,
        is_correct: bool
    ):
        """Generate contextual feedback for student response (sync version) - returns full response object."""
        try:
            response = self.llm.invoke(
                self.feedback_prompt.format_messages(
                    question=card_context["cfu"]["stem"],
                    expected=str(expected_answer),
                    student_response=student_response,
                    attempt=attempt_number,
                    is_correct=is_correct
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in evaluate_response_sync_full: {e}",
                extra={
                    "student_response": student_response,
                    "expected_answer": expected_answer,
                    "attempt_number": attempt_number,
                    "is_correct": is_correct,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate feedback for student response: {str(e)}"
            ) from e


    def transition_to_next_sync_full(
        self,
        completed_card: Dict,
        next_card: Optional[Dict],
        progress_context: Dict,
        state: Optional[Dict] = None
    ):
        """Generate transition between lesson cards (sync version) - returns full response object.

        Args:
            completed_card: Completed card data
            next_card: Next card data (None if lesson complete)
            progress_context: Progress summary dict
            state: Optional full state dict with curriculum metadata
        """
        if not next_card:
            return self.complete_lesson_sync_full(completed_card, progress_context, state)

        try:
            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
                subject_area = state.get("course_subject_display", "learning")
                level_description = state.get("course_level_display", "")
            else:
                curriculum_context = {
                    "course_context_block": ""
                }
                subject_area = "learning"
                level_description = ""

            # Extract and format assessment feedback from progress_context if present
            assessment_feedback_text = ""
            if isinstance(progress_context, dict) and progress_context.get("assessment_feedback"):
                feedback = progress_context["assessment_feedback"]
                # Format feedback for transition prompt
                assessment_feedback_text = f"""
**Previous Question Assessment:**
{feedback}

Use this assessment to acknowledge specific strengths in your transition.
"""
            else:
                assessment_feedback_text = "(No assessment feedback - student may have skipped or this is first card)"

            # Remove feedback from progress_context string representation (keep stats separate)
            progress_stats = {k: v for k, v in progress_context.items() if k != "assessment_feedback"} if isinstance(progress_context, dict) else progress_context

            response = self.llm.invoke(
                self.transition_prompt.format_messages(
                    completed_card=completed_card.get("title", "previous topic"),
                    next_card=next_card.get("title", "next topic"),
                    progress_context=str(progress_stats),
                    assessment_feedback=assessment_feedback_text,  # NEW parameter
                    subject_area=subject_area,
                    level_description=level_description,
                    **curriculum_context
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in transition_to_next_sync_full: {e}",
                extra={
                    "completed_card_title": completed_card.get("title", "unknown"),
                    "next_card_title": next_card.get("title", "unknown") if next_card else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate transition between lesson cards: {str(e)}"
            ) from e


    def complete_lesson_sync_full(self, lesson_snapshot: Dict, progress_context: Dict, state: Optional[Dict] = None):
        """Generate lesson completion message (sync version) - returns full response object.

        Args:
            lesson_snapshot: Lesson snapshot data
            progress_context: Progress summary dict
            state: Optional full state dict with curriculum metadata
        """
        try:
            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
                subject_area = state.get("course_subject_display", "learning")
                level_description = state.get("course_level_display", "")
            else:
                curriculum_context = {
                    "course_context_block": ""
                }
                subject_area = "learning"
                level_description = ""

            response = self.llm.invoke(
                self.completion_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "the lesson"),
                    completed_cards=progress_context.get("cards_completed", 0),
                    progress_summary=str(progress_context),
                    subject_area=subject_area,
                    level_description=level_description,
                    **curriculum_context
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in complete_lesson_sync_full: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "cards_completed": progress_context.get("cards_completed", 0),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate lesson completion message: {str(e)}"
            ) from e

    def present_card_sync_full(self, card: Dict[str, Any], lesson_snapshot: Dict, state: Optional[Dict] = None, card_index: int = 0, total_cards: int = 1):
        """Present lesson card conversationally (sync version) - returns full response object.

        Args:
            card: Card data
            lesson_snapshot: Lesson snapshot data containing lesson metadata
            state: Optional full state dict with curriculum metadata
            card_index: Zero-indexed position of current card (default: 0)
            total_cards: Total number of cards in lesson (default: 1)
        """
        try:
            # Extract lesson metadata
            lesson_title = lesson_snapshot.get("title", "Lesson")
            outcome_refs = ", ".join(parse_outcome_refs(lesson_snapshot.get("outcomeRefs", [])))

            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
            else:
                # Fallback to default values if no state
                curriculum_context = {
                    "tutor_role_description": "friendly, encouraging tutor",
                    "course_context_block": "",
                    "engagement_guidance": "",
                    "policy_reminders": "",
                    "sqa_alignment_summary": ""
                }

            # Extract lesson_type and generate pedagogy guidance
            lesson_type = state.get("lesson_type", "teach") if state else "teach"
            lesson_type_pedagogy = get_lesson_type_pedagogy_guidance(lesson_type)

            # Choose explainer based on accessibility mode
            use_plain_text = state.get("use_plain_text", False) if state else False
            explainer_text = card.get("explainer_plain" if use_plain_text else "explainer", "")

            response = self.llm.invoke(
                self.card_presentation_prompt.format_messages(
                    lesson_title=lesson_title,
                    outcome_refs=outcome_refs,
                    card_title=card.get("title", ""),
                    card_explainer=explainer_text,
                    lesson_type_pedagogy=lesson_type_pedagogy,
                    **curriculum_context  # Includes: tutor_role_description, course_context_block,
                                         # engagement_guidance, policy_reminders, sqa_alignment_summary
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in present_card_sync_full: {e}",
                extra={
                    "card_title": card.get("title", "unknown"),
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "has_explainer": bool(card.get("explainer")),
                    "has_examples": bool(card.get("example")),
                    "has_question": bool(card.get("cfu", {}).get("stem")),
                    "card_index": card_index,
                    "total_cards": total_cards,
                    "lesson_type": state.get("lesson_type") if state else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to present lesson card '{card.get('title', 'unknown')}' for lesson '{lesson_snapshot.get('title', 'unknown')}': {str(e)}"
            ) from e


    def greet_with_first_card_sync_full(self, lesson_snapshot: Dict, first_card: Dict[str, Any], state: Optional[Dict] = None):
        """Generate cohesive greeting with first card (sync version) - returns full response object.

        Args:
            lesson_snapshot: Lesson snapshot data
            first_card: First card data
            state: Optional full state dict with curriculum metadata
        """
        try:
            examples = "\n".join(first_card.get("example", []))

            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
            else:
                # Fallback to default values if no state
                curriculum_context = {
                    "tutor_role_description": "friendly, encouraging tutor",
                    "course_context_block": "",
                    "engagement_guidance": "",
                    "policy_reminders": "",
                    "sqa_alignment_summary": ""
                }

            # Extract lesson_type and generate pedagogy guidance
            lesson_type = state.get("lesson_type", "teach") if state else "teach"
            lesson_type_pedagogy = get_lesson_type_pedagogy_guidance(lesson_type)

            # Choose explainer based on accessibility mode
            use_plain_text = state.get("use_plain_text", False) if state else False
            first_explainer = first_card.get("explainer_plain" if use_plain_text else "explainer", "")

            response = self.llm.invoke(
                self.greeting_with_first_card_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Lesson"),
                    outcome_refs=", ".join(parse_outcome_refs(lesson_snapshot.get("outcomeRefs", []))),
                    card_title=first_card.get("title", ""),
                    card_explainer=first_explainer,
                    card_examples=examples,
                    card_question=first_card.get("cfu", {}).get("stem", ""),
                    lesson_type_pedagogy=lesson_type_pedagogy,  # Add pedagogy guidance
                    **curriculum_context  # Unpack all formatted strings
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in greet_with_first_card_sync_full: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "card_title": first_card.get("title", "unknown"),
                    "has_outcome_refs": bool(lesson_snapshot.get("outcomeRefs")),
                    "lesson_type": state.get("lesson_type") if state else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate greeting with first lesson card: {str(e)}"
            ) from e
    def _format_mcq_options(self, options: List[str]) -> str:
        """Helper to format MCQ options consistently as numbered list."""
        formatted_options = []
        for i, option in enumerate(options, 1):
            formatted_options.append(f"{i}. {option}")
        return "\n".join(formatted_options)

    def greet_with_first_mcq_card_sync_full(self, lesson_snapshot: Dict, first_card: Dict[str, Any], state: Optional[Dict] = None):
        """Generate cohesive greeting with first MCQ card (sync version) - returns full response object.

        Args:
            lesson_snapshot: Lesson snapshot data
            first_card: First MCQ card data
            state: Optional full state dict with curriculum metadata
        """
        try:
            cfu = first_card.get("cfu", {})
            options = cfu.get("options", [])
            question = cfu.get("stem", "") or cfu.get("question", "")

            examples = "\n".join(first_card.get("example", []))
            # Choose explainer based on accessibility mode
            use_plain_text = state.get("use_plain_text", False) if state else False
            first_explainer = first_card.get("explainer_plain" if use_plain_text else "explainer", "")
            formatted_options = self._format_mcq_options(options)

            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
            else:
                # Fallback to default values if no state
                curriculum_context = {
                    "tutor_role_description": "friendly, encouraging tutor",
                    "course_context_block": "",
                    "engagement_guidance": "",
                    "policy_reminders": "",
                    "sqa_alignment_summary": ""
                }

            # Extract lesson_type and generate pedagogy guidance
            lesson_type = state.get("lesson_type", "teach") if state else "teach"
            lesson_type_pedagogy = get_lesson_type_pedagogy_guidance(lesson_type)

            response = self.llm.invoke(
                self.greeting_with_first_mcq_card_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Lesson"),
                    outcome_refs=", ".join(parse_outcome_refs(lesson_snapshot.get("outcomeRefs", []))),
                    card_title=first_card.get("title", ""),
                    card_explainer=first_explainer,
                    card_examples=examples,
                    mcq_question=question,
                    mcq_options=formatted_options,
                    lesson_type_pedagogy=lesson_type_pedagogy,  # Add pedagogy guidance
                    **curriculum_context  # Unpack all formatted strings
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in greet_with_first_mcq_card_sync_full: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "card_title": first_card.get("title", "unknown"),
                    "has_outcome_refs": bool(lesson_snapshot.get("outcomeRefs")),
                    "cfu_type": first_card.get("cfu", {}).get("type", "unknown"),
                    "lesson_type": state.get("lesson_type") if state else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate MCQ greeting with first lesson card: {str(e)}"
            ) from e

    def present_mcq_card_sync_full(self, card: Dict[str, Any], state: Optional[Dict] = None, card_index: int = 0, total_cards: int = 1):
        """Present MCQ card with structured format (sync version) - returns full response object.

        Args:
            card: MCQ card data
            state: Optional full state dict with curriculum metadata
            card_index: Zero-indexed position of current card (default: 0)
            total_cards: Total number of cards in lesson (default: 1)
        """
        try:
            cfu = card.get("cfu", {})
            options = cfu.get("options", [])
            question = cfu.get("stem", "") or cfu.get("question", "")

            examples = "\n".join(card.get("example", []))
            # Choose explainer based on accessibility mode
            use_plain_text = state.get("use_plain_text", False) if state else False
            explainer_text = card.get("explainer_plain" if use_plain_text else "explainer", "")
            formatted_options = self._format_mcq_options(options)

            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
                # Also extract subject_area and level_description
                subject_area = state.get("course_subject_display", "learning")
                level_description = state.get("course_level_display", "")
            else:
                # Fallback to default values if no state
                curriculum_context = {
                    "course_context_block": "",
                    "engagement_guidance": ""
                }
                subject_area = "learning"
                level_description = ""

            # Extract lesson_type and generate pedagogy guidance
            lesson_type = state.get("lesson_type", "teach") if state else "teach"
            lesson_type_pedagogy = get_lesson_type_pedagogy_guidance(lesson_type)

            response = self.llm.invoke(
                self.mcq_card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    card_explainer=explainer_text,
                    examples=examples,
                    mcq_question=question,
                    mcq_options=formatted_options,
                    card_title=card.get("title", ""),
                    card_number=card_index + 1,  # Convert to 1-indexed for display
                    total_cards=total_cards,
                    lesson_type_pedagogy=lesson_type_pedagogy,  # Add pedagogy guidance
                    subject_area=subject_area,
                    level_description=level_description,
                    **curriculum_context
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in present_mcq_card_sync_full: {e}",
                extra={
                    "card_title": card.get("title", "unknown"),
                    "has_explainer": bool(card.get("explainer")),
                    "has_examples": bool(card.get("example")),
                    "cfu_type": card.get("cfu", {}).get("type", "unknown"),
                    "num_options": len(card.get("cfu", {}).get("options", [])),
                    "card_index": card_index,
                    "total_cards": total_cards,
                    "lesson_type": state.get("lesson_type") if state else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to present MCQ lesson card: {str(e)}"
            ) from e

    def evaluate_response_with_structured_output(
        self,
        student_response: str,
        expected_answer: Any,
        card_context: Dict,
        attempt_number: int,
        max_attempts: int = 3,
        state: Optional[Dict] = None
    ) -> EvaluationResponse:
        """Generate structured evaluation with LLM reasoning (sync version).

        Args:
            student_response: Student's response string
            expected_answer: Expected answer
            card_context: Card context dict
            attempt_number: Current attempt number
            max_attempts: Maximum allowed attempts
            state: Optional full state dict with curriculum metadata
        """
        try:
            # Set up structured output with the Pydantic model
            structured_llm = self.llm.with_structured_output(EvaluationResponse)

            # Extract question details
            cfu = card_context.get("cfu", {})
            question_type = cfu.get("type", "unknown")
            question_text = cfu.get("stem", "") or cfu.get("question", "")

            # Format card context for the prompt
            context_summary = f"Title: {card_context.get('title', 'Unknown')}"
            if card_context.get("explainer"):
                context_summary += f", Explainer: {card_context['explainer'][:100]}..."

            # Extract rubric from CFU
            rubric = cfu.get("rubric", {})
            rubric_text = self._format_rubric_for_prompt(rubric)

            # Extract misconceptions from card
            misconceptions = card_context.get("misconceptions", [])
            misconceptions_text = self._format_misconceptions_for_prompt(misconceptions)

            # Extract curriculum context if state provided
            if state:
                subject_area = state.get("course_subject_display", "learning")
                level_description = state.get("course_level_display", "")
                curriculum_context = extract_curriculum_context_from_state(state)
            else:
                subject_area = "learning"
                level_description = ""
                curriculum_context = {"course_context_block": ""}

            print(f"[DEBUG] About to invoke structured LLM with tags")
            response = structured_llm.invoke(
                self.structured_evaluation_prompt.format_messages(
                    question_type=question_type,
                    question=question_text,
                    expected=str(expected_answer),
                    student_response=student_response,
                    attempt_number=attempt_number,
                    max_attempts=max_attempts,
                    card_context=context_summary,
                    rubric_text=rubric_text,
                    misconceptions_text=misconceptions_text,
                    subject_area=subject_area,
                    level_description=level_description,
                    **curriculum_context
                ),
                config={"tags": ["json"], "run_name": "structured_evaluation"}
            )
            print(f"[DEBUG] Structured LLM response received, type: {type(response)}")
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in evaluate_response_with_structured_output: {e}",
                extra={
                    "student_response": student_response,
                    "expected_answer": expected_answer,
                    "attempt_number": attempt_number,
                    "max_attempts": max_attempts,
                    "question_type": card_context.get("cfu", {}).get("type", "unknown"),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate structured evaluation: {str(e)}"
            ) from e
    
    def explain_correct_answer_sync_full(self, current_card: Dict, student_attempts: List[str], state: Optional[Dict] = None):
        """Generate explanation showing correct answer after max failed attempts (sync version) - returns full response object.

        Args:
            current_card: Current card data
            student_attempts: List of student attempt strings
            state: Optional full state dict with curriculum metadata
        """
        try:
            cfu = current_card.get("cfu", {})
            card_context = f"Title: {current_card.get('title', '')}, Explainer: {current_card.get('explainer', '')[:100]}..."

            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
                subject_area = state.get("course_subject_display", "learning")
                level_description = state.get("course_level_display", "")
            else:
                curriculum_context = {
                    "course_context_block": ""
                }
                subject_area = "learning"
                level_description = ""

            response = self.llm.invoke(
                self.correct_answer_explanation_prompt.format_messages(
                    card_context=card_context,
                    question=cfu.get("stem", ""),
                    expected_answer=str(cfu.get("expected", "")),
                    student_attempts=", ".join(student_attempts) if student_attempts else "No attempts recorded",
                    subject_area=subject_area,
                    level_description=level_description,
                    **curriculum_context
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in explain_correct_answer_sync_full: {e}",
                extra={
                    "card_title": current_card.get("title", "unknown"),
                    "question_type": current_card.get("cfu", {}).get("type", "unknown"),
                    "num_attempts": len(student_attempts) if student_attempts else 0,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate correct answer explanation: {str(e)}"
            ) from e

    def summarize_completed_lesson_sync_full(self, lesson_snapshot: Dict, evidence: List[Dict], performance_analysis: Dict, state: Optional[Dict] = None):
        """Generate comprehensive lesson summary with LLM analysis (sync version) - returns full response object.

        Args:
            lesson_snapshot: Lesson snapshot data
            evidence: List of evidence dicts
            performance_analysis: Performance analysis dict
            state: Optional full state dict with curriculum metadata
        """
        try:
            # Format lesson details
            lesson_title = lesson_snapshot.get("title", "Lesson")
            outcome_refs = ", ".join(parse_outcome_refs(lesson_snapshot.get("outcomeRefs", [])))
            cards = lesson_snapshot.get("cards", [])
            total_cards = len(cards)
            cards_completed = len([card for card in cards])

            # Format performance analysis
            performance_text = self._format_performance_analysis(performance_analysis)

            # Format evidence summary
            evidence_text = self._format_evidence_summary(evidence)

            # Extract curriculum context if state provided
            curriculum_context = {}
            if state:
                curriculum_context = extract_curriculum_context_from_state(state)
                subject_area = state.get("course_subject_display", "learning")
                level_description = state.get("course_level_display", "")
            else:
                curriculum_context = {
                    "course_context_block": "",
                    "sqa_alignment_summary": ""
                }
                subject_area = "learning"
                level_description = ""

            response = self.llm.invoke(
                self.lesson_summary_prompt.format_messages(
                    lesson_title=lesson_title,
                    outcome_refs=outcome_refs,
                    total_cards=total_cards,
                    cards_completed=cards_completed,
                    performance_analysis=performance_text,
                    evidence_summary=evidence_text,
                    subject_area=subject_area,
                    level_description=level_description,
                    **curriculum_context
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in summarize_completed_lesson_sync_full: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "total_cards": len(lesson_snapshot.get("cards", [])),
                    "evidence_entries": len(evidence),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate lesson summary: {str(e)}"
            ) from e

    def _format_rubric_for_prompt(self, rubric: Dict) -> str:
        """Format rubric criteria for LLM prompt."""
        if not rubric or not rubric.get("criteria"):
            return "No specific rubric provided. Evaluate holistically."
        
        total_points = rubric.get("total_points", 1)
        criteria = rubric.get("criteria", [])
        
        lines = [f"Total Points: {total_points}"]
        for i, criterion in enumerate(criteria, 1):
            desc = criterion.get("description", "")
            points = criterion.get("points", 1)
            lines.append(f"{i}. [{points} pts] {desc}")
        
        return "\n".join(lines)

    def _format_misconceptions_for_prompt(self, misconceptions: List[Dict]) -> str:
        """Format misconceptions for LLM prompt."""
        if not misconceptions:
            return "No specific misconceptions documented for this question."
        
        lines = []
        for i, misc in enumerate(misconceptions, 1):
            misconception_text = misc.get("misconception", "")
            clarification = misc.get("clarification", "")
            lines.append(f"{i}. Misconception: {misconception_text}")
            lines.append(f"   Clarification: {clarification}")
        
        return "\n".join(lines)

    def _format_performance_analysis(self, analysis: Dict) -> str:
        """Helper to format performance analysis for LLM prompt."""
        lines = []
        
        if "overall_accuracy" in analysis:
            lines.append(f"Overall Accuracy: {analysis['overall_accuracy']:.1%}")
        
        if "first_attempt_success" in analysis:
            lines.append(f"First Attempt Success Rate: {analysis['first_attempt_success']:.1%}")
        
        if "average_attempts" in analysis:
            lines.append(f"Average Attempts per Question: {analysis['average_attempts']:.1f}")
        
        if "strong_areas" in analysis and analysis["strong_areas"]:
            lines.append(f"Areas of Strength: {', '.join(analysis['strong_areas'])}")
        
        if "challenge_areas" in analysis and analysis["challenge_areas"]:
            lines.append(f"Areas for Improvement: {', '.join(analysis['challenge_areas'])}")
        
        if "retry_recommended" in analysis:
            recommendation = "Yes" if analysis["retry_recommended"] else "No"
            lines.append(f"Retry Recommended: {recommendation}")
        
        return "\n".join(lines) if lines else "No performance data available."

    def _format_evidence_summary(self, evidence: List[Dict]) -> str:
        """Helper to format evidence entries for LLM prompt."""
        if not evidence:
            return "No evidence recorded."
        
        lines = []
        correct_count = sum(1 for entry in evidence if entry.get("correct", False))
        total_count = len(evidence)
        
        lines.append(f"Total Questions: {total_count}")
        lines.append(f"Correct Answers: {correct_count}")
        lines.append(f"Accuracy: {correct_count/total_count:.1%}")
        
        # Group by attempts
        attempts_summary = {}
        for entry in evidence:
            attempts = entry.get("attempts", 1)
            if attempts not in attempts_summary:
                attempts_summary[attempts] = {"correct": 0, "total": 0}
            attempts_summary[attempts]["total"] += 1
            if entry.get("correct", False):
                attempts_summary[attempts]["correct"] += 1
        
        lines.append("\nBreakdown by attempts:")
        for attempts in sorted(attempts_summary.keys()):
            data = attempts_summary[attempts]
            lines.append(f"  {attempts} attempt(s): {data['correct']}/{data['total']} correct")
        
        # Show recent performance pattern
        if len(evidence) > 1:
            recent_evidence = evidence[-min(5, len(evidence)):]
            recent_pattern = [entry.get("correct", False) for entry in recent_evidence]
            pattern_text = ", ".join("✓" if correct else "✗" for correct in recent_pattern)
            lines.append(f"\nRecent Performance Pattern: {pattern_text}")
        
        return "\n".join(lines)

    def generate_hint_sync_full(
        self,
        current_card: Dict,
        student_response: str,
        attempt_number: int,
        state: Optional[Dict] = None
    ) -> str:
        """Generate LLM hint when authored hints exhausted.
        
        Args:
            current_card: Current card data
            student_response: Student's incorrect response
            attempt_number: Current attempt number
            state: Optional full state dict with curriculum metadata
            
        Returns:
            Generated hint string
        """
        try:
            hint_prompt = ChatPromptTemplate.from_messages([
                ("system", """Generate a helpful hint for a {level_description} {subject_area} student.
                
{course_context_block}

Card Context: {card_context}
Question: {question}
Student's Response: {student_response}
Attempt Number: {attempt_number}

Provide a progressive hint that:
1. Does NOT reveal the answer
2. Guides them toward the correct method
3. Is encouraging and supportive
4. References their specific error pattern

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math."""),
                ("human", "Generate a hint")
            ])
            
            # Extract context
            curriculum_context = extract_curriculum_context_from_state(state) if state else {}
            
            response = self.llm.invoke(
                hint_prompt.format_messages(
                    card_context=current_card.get("title", ""),
                    question=current_card.get("cfu", {}).get("stem", ""),
                    student_response=student_response,
                    attempt_number=attempt_number,
                    subject_area=state.get("course_subject_display", "learning") if state else "learning",
                    level_description=state.get("course_level_display", "") if state else "",
                    **curriculum_context
                )
            )
            return response.content
        except Exception as e:
            logger.error(f"LLM hint generation failed: {e}")
            return "Try reviewing the explanation and examples above, then attempt the question again."

