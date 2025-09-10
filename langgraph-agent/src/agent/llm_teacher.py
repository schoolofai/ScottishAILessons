"""LLM-powered conversational teaching agent for Scottish AI Lessons."""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import os
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class EvaluationResponse(BaseModel):
    """Structured response for LLM-based evaluation."""
    is_correct: bool = Field(description="Whether the student response is correct")
    confidence: float = Field(description="Confidence in the evaluation (0.0-1.0)", ge=0.0, le=1.0)
    feedback: str = Field(description="Contextual feedback for the student")
    reasoning: str = Field(description="Internal reasoning for the evaluation decision")
    should_progress: bool = Field(description="Whether to move forward regardless of correctness")
    partial_credit: Optional[float] = Field(default=None, description="Partial credit score (0.0-1.0)", ge=0.0, le=1.0)


class LLMTeacher:
    """Conversational AI teacher for lesson delivery."""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Teaching prompt templates
        self.lesson_greeting_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a friendly, encouraging math tutor for Scottish National 3 students.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.
Be warm, supportive, and use everyday contexts. Keep it conversational and engaging.
Student name: {student_name}"""),
            ("human", "Start the lesson")
        ])
        
        self.card_presentation_prompt = ChatPromptTemplate.from_messages([
            ("system", """Present this math concept conversationally to a National 3 student.
Context: {card_context}
Explainer: {explainer}
Examples: {examples}
Question: {question}

Make it feel like friendly tutoring. Use real-world contexts (shopping, money, etc).
End with the question naturally in the conversation. Make sure to include the question for the student to answer.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Present this card: {card_title}")
        ])
        
        self.feedback_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're evaluating a National 3 math student's response.
Question: {question}
Expected Answer: {expected}
Student Answer: {student_response}
Attempt Number: {attempt}
Is Correct: {is_correct}

Provide encouraging, specific feedback. If incorrect, give a helpful hint for attempt 2,
more guidance for attempt 3. Always be positive and constructive."""),
            ("human", "Give feedback on this response")
        ])
        
        self.structured_evaluation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are evaluating a National 3 math student's response with structured output.

Context:
- Question Type: {question_type}
- Question: {question}
- Expected Answer: {expected}
- Student Response: {student_response}
- Current Attempt: {attempt_number}
- Maximum Attempts: {max_attempts}
- Card Context: {card_context}

Evaluation Guidelines:
1. For numeric questions: Accept reasonable approximations, alternative formats (fractions, decimals), and contextual answers
2. For MCQ questions: 
   - If expected answer is a dict with MCQ info, compare student response to correct_human_index (1-indexed)
   - Student may respond with numbers (1, 2, 3) or option text
   - Be flexible: "2" should match correct_human_index 2
   - Example: if correct_human_index is 2 and student responds "2", mark as correct
3. For open-ended: Look for conceptual understanding and key ideas
4. Consider partial credit for partially correct responses
5. CRITICAL: In feedback, DO NOT reveal the correct answer - only provide hints and guidance
6. For incorrect responses: Give conceptual hints, point to the method/process, encourage retry
7. Example good feedback: "Think about what 0.2 means - how many tenths? Can you simplify that fraction?"
8. Example bad feedback: "The answer is 1/5" or "0.2 equals 1/5"
9. Be encouraging and guide learning without giving away the solution
10. The correct answer will be revealed separately if needed after max attempts

IMPORTANT LATEX FORMATTING: When including mathematical expressions in feedback, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters.

Return your evaluation as structured output."""),
            ("human", "Evaluate this student response")
        ])
        
        self.transition_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're transitioning between lesson concepts for a National 3 student.
Just completed: {completed_card}
Next up: {next_card}
Student progress: {progress_context}

Create a smooth, encouraging transition that connects the concepts."""),
            ("human", "Transition to the next topic")
        ])
        
        self.completion_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're completing a National 3 math lesson.
Lesson: {lesson_title}
Cards completed: {completed_cards}
Student performance: {progress_summary}

Provide an encouraging summary and congratulate the student on their progress."""),
            ("human", "Complete the lesson")
        ])
        
        self.correct_answer_explanation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're explaining the correct answer to a National 3 student who has struggled with a question.

Card Context: {card_context}
Question: {question}
Expected Answer: {expected_answer}
Student Attempts: {student_attempts}

The student has tried their best but hasn't got the correct answer. Now provide a clear, encouraging explanation that:
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
            ("system", """You are analyzing a completed Scottish National 3 math lesson to provide comprehensive feedback and guidance.

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
            ("system", """You are a friendly, encouraging math tutor for Scottish National 3 students.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.

Create a cohesive greeting that:
1. Welcomes the student warmly
2. Introduces the lesson topic naturally
3. Seamlessly transitions into presenting the first card
4. Incorporates the card's explainer and examples if provided
5. Ends with the card's question

Card Details:
- Title: {card_title}
- Explainer: {card_explainer}
- Examples: {card_examples}
- Question: {card_question}

Make it feel like one natural conversation flow, not separate sections.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Start the lesson with the first card")
        ])
        
        self.greeting_with_first_mcq_card_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a friendly, encouraging math tutor for Scottish National 3 students.
You're starting a lesson on {lesson_title} focusing on {outcome_refs}.

Create a cohesive greeting that:
1. Welcomes the student warmly
2. Introduces the lesson topic naturally
3. Seamlessly transitions into presenting the first card
4. Incorporates the card's explainer and examples if provided
5. Ends with a properly formatted multiple choice question

Card Details:
- Title: {card_title}
- Explainer: {card_explainer}
- Examples: {card_examples}
- Question: {mcq_question}
- Options: {mcq_options}

Format the multiple choice question as:
**Question**: {mcq_question}

1. [First option]
2. [Second option]
3. [Third option]
etc.

Please respond with the number of your choice (1, 2, 3, etc.).

Make it feel like one natural conversation flow with a clear, structured question at the end.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Start the lesson with the first MCQ card")
        ])
        
        self.mcq_card_presentation_prompt = ChatPromptTemplate.from_messages([
            ("system", """Present this multiple choice question conversationally to a National 3 student.
Context: {card_context}
Explainer: {explainer}
Examples: {examples}
Question: {mcq_question}
Options: {mcq_options}

Create a smooth transition and explanation, then format the question as:
**Question**: {mcq_question}

1. [First option]
2. [Second option]
3. [Third option]
etc.

Please respond with the number of your choice (1, 2, 3, etc.).

Make it feel like friendly tutoring with a clearly structured question.

IMPORTANT LATEX FORMATTING: When including mathematical expressions, use these exact formats:
- Inline math: $\\frac{{2}}{{10}} = \\frac{{1}}{{5}}$
- Display math: $$\\frac{{2}}{{10}} = \\frac{{1}}{{5}} = 0.2$$  
- Mixed text: The fraction $\\frac{{1}}{{4}}$ equals 0.25 or 25%.
Always use $ for inline and $$ for display math. Never use other LaTeX delimiters."""),
            ("human", "Present this MCQ card: {card_title}")
        ])

    async def greet_student(self, lesson_snapshot: Dict, student_name: str = "there") -> str:
        """Generate welcoming lesson introduction."""
        try:
            response = await self.llm.ainvoke(
                self.lesson_greeting_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Math Lesson"),
                    outcome_refs=", ".join([ref["label"] for ref in lesson_snapshot.get("outcomeRefs", [])]),
                    student_name=student_name
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in greet_student: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "student_name": student_name,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate lesson greeting: {str(e)}"
            ) from e

    async def present_card(self, card: Dict[str, Any]) -> str:
        """Present lesson card conversationally."""
        try:
            examples = "\n".join(card.get("example", []))
            question = card.get("cfu", {}).get("stem", "What do you think?")
            response = await self.llm.ainvoke(
                self.card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    explainer=card.get("explainer", ""),
                    examples=examples,
                    question=question,
                    card_title=card.get("title", "")
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in present_card: {e}",
                extra={
                    "card_title": card.get("title", "unknown"),
                    "has_content": bool(card),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to present lesson card: {str(e)}"
            ) from e

    async def evaluate_response(
        self, 
        student_response: str,
        expected_answer: Any,
        card_context: Dict,
        attempt_number: int,
        is_correct: bool
    ) -> str:
        """Generate contextual feedback for student response."""
        try:
            response = await self.llm.ainvoke(
                self.feedback_prompt.format_messages(
                    question=card_context["cfu"]["stem"],
                    expected=str(expected_answer),
                    student_response=student_response,
                    attempt=attempt_number,
                    is_correct=is_correct
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in evaluate_response: {e}",
                extra={
                    "student_response": student_response,
                    "expected_answer": expected_answer,
                    "attempt_number": attempt_number,
                    "is_correct": is_correct,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate feedback: {str(e)}"
            ) from e

    async def transition_to_next(
        self, 
        completed_card: Dict, 
        next_card: Optional[Dict],
        progress_context: Dict
    ) -> str:
        """Generate transition between lesson cards."""
        if not next_card:
            return await self.complete_lesson(completed_card, progress_context)
            
        try:
            response = await self.llm.ainvoke(
                self.transition_prompt.format_messages(
                    completed_card=completed_card.get("title", "previous topic"),
                    next_card=next_card.get("title", "next topic"),
                    progress_context=str(progress_context)
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in transition_to_next: {e}",
                extra={
                    "completed_card_title": completed_card.get("title", "unknown"),
                    "next_card_title": next_card.get("title", "unknown") if next_card else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate transition: {str(e)}"
            ) from e

    async def complete_lesson(self, lesson_snapshot: Dict, progress_context: Dict) -> str:
        """Generate lesson completion message."""
        try:
            response = await self.llm.ainvoke(
                self.completion_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "the lesson"),
                    completed_cards=progress_context.get("cards_completed", 0),
                    progress_summary=str(progress_context)
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in complete_lesson: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "cards_completed": progress_context.get("cards_completed", 0),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate lesson completion message: {str(e)}"
            ) from e
    
    # Synchronous versions for LangGraph compatibility
    def greet_student_sync(self, lesson_snapshot: Dict, student_name: str = "there") -> str:
        """Generate welcoming lesson introduction (sync version)."""
        try:
            response = self.llm.invoke(
                self.lesson_greeting_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Math Lesson"),
                    outcome_refs=", ".join([ref["label"] for ref in lesson_snapshot.get("outcomeRefs", [])]),
                    student_name=student_name
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in greet_student_sync: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "student_name": student_name,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate lesson greeting: {str(e)}"
            ) from e

    def present_card_sync(self, card: Dict[str, Any]) -> str:
        """Present lesson card conversationally (sync version)."""
        try:
            examples = "\n".join(card.get("example", []))
            question = card.get("cfu", {}).get("stem", "What do you think?")
            response = self.llm.invoke(
                self.card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    explainer=card.get("explainer", ""),
                    examples=examples,
                    question=question,
                    card_title=card.get("title", "")
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in present_card_sync: {e}",
                extra={
                    "card_title": card.get("title", "unknown"),
                    "has_content": bool(card),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to present lesson card: {str(e)}"
            ) from e

    def evaluate_response_sync(
        self, 
        student_response: str,
        expected_answer: Any,
        card_context: Dict,
        attempt_number: int,
        is_correct: bool
    ) -> str:
        """Generate contextual feedback for student response (sync version) - returns content only."""
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
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in evaluate_response_sync: {e}",
                extra={
                    "student_response": student_response,
                    "expected_answer": expected_answer,
                    "attempt_number": attempt_number,
                    "is_correct": is_correct,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate feedback: {str(e)}"
            ) from e

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

    def transition_to_next_sync(
        self, 
        completed_card: Dict, 
        next_card: Optional[Dict],
        progress_context: Dict
    ) -> str:
        """Generate transition between lesson cards (sync version) - returns content only."""
        if not next_card:
            return self.complete_lesson_sync(completed_card, progress_context)
            
        try:
            response = self.llm.invoke(
                self.transition_prompt.format_messages(
                    completed_card=completed_card.get("title", "previous topic"),
                    next_card=next_card.get("title", "next topic"),
                    progress_context=str(progress_context)
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in transition_to_next_sync: {e}",
                extra={
                    "completed_card_title": completed_card.get("title", "unknown"),
                    "next_card_title": next_card.get("title", "unknown") if next_card else None,
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate transition: {str(e)}"
            ) from e

    def transition_to_next_sync_full(
        self, 
        completed_card: Dict, 
        next_card: Optional[Dict],
        progress_context: Dict
    ):
        """Generate transition between lesson cards (sync version) - returns full response object."""
        if not next_card:
            return self.complete_lesson_sync_full(completed_card, progress_context)
            
        try:
            response = self.llm.invoke(
                self.transition_prompt.format_messages(
                    completed_card=completed_card.get("title", "previous topic"),
                    next_card=next_card.get("title", "next topic"),
                    progress_context=str(progress_context)
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

    def complete_lesson_sync(self, lesson_snapshot: Dict, progress_context: Dict) -> str:
        """Generate lesson completion message (sync version) - returns content only."""
        try:
            response = self.llm.invoke(
                self.completion_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "the lesson"),
                    completed_cards=progress_context.get("cards_completed", 0),
                    progress_summary=str(progress_context)
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in complete_lesson_sync: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "cards_completed": progress_context.get("cards_completed", 0),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate lesson completion message: {str(e)}"
            ) from e

    def complete_lesson_sync_full(self, lesson_snapshot: Dict, progress_context: Dict):
        """Generate lesson completion message (sync version) - returns full response object."""
        try:
            response = self.llm.invoke(
                self.completion_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "the lesson"),
                    completed_cards=progress_context.get("cards_completed", 0),
                    progress_summary=str(progress_context)
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

    def present_card_sync_full(self, card: Dict[str, Any]):
        """Present lesson card conversationally (sync version) - returns full response object."""
        try:
            examples = "\n".join(card.get("example", []))
            question = card.get("cfu", {}).get("stem", "What do you think?")
            response = self.llm.invoke(
                self.card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    explainer=card.get("explainer", ""),
                    examples=examples,
                    question=question,
                    card_title=card.get("title", "")
                )
            )
            return response
        except Exception as e:
            logger.error(
                f"LLM call failed in present_card_sync_full: {e}",
                extra={
                    "card_title": card.get("title", "unknown"),
                    "has_explainer": bool(card.get("explainer")),
                    "has_examples": bool(card.get("example")),
                    "has_question": bool(card.get("cfu", {}).get("stem")),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to present lesson card: {str(e)}"
            ) from e

    def greet_with_first_card_sync(self, lesson_snapshot: Dict, first_card: Dict[str, Any]) -> str:
        """Generate cohesive greeting with first card (sync version) - returns content only."""
        try:
            examples = "\n".join(first_card.get("example", []))
            response = self.llm.invoke(
                self.greeting_with_first_card_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Math Lesson"),
                    outcome_refs=", ".join([ref["label"] for ref in lesson_snapshot.get("outcomeRefs", [])]),
                    card_title=first_card.get("title", ""),
                    card_explainer=first_card.get("explainer", ""),
                    card_examples=examples,
                    card_question=first_card.get("cfu", {}).get("stem", "")
                )
            )
            return response.content
        except Exception as e:
            logger.error(
                f"LLM call failed in greet_with_first_card_sync: {e}",
                extra={
                    "lesson_title": lesson_snapshot.get("title", "unknown"),
                    "card_title": first_card.get("title", "unknown"),
                    "has_outcome_refs": bool(lesson_snapshot.get("outcomeRefs")),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate greeting with first lesson card: {str(e)}"
            ) from e

    def greet_with_first_card_sync_full(self, lesson_snapshot: Dict, first_card: Dict[str, Any]):
        """Generate cohesive greeting with first card (sync version) - returns full response object."""
        try:
            examples = "\n".join(first_card.get("example", []))
            response = self.llm.invoke(
                self.greeting_with_first_card_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Math Lesson"),
                    outcome_refs=", ".join([ref["label"] for ref in lesson_snapshot.get("outcomeRefs", [])]),
                    card_title=first_card.get("title", ""),
                    card_explainer=first_card.get("explainer", ""),
                    card_examples=examples,
                    card_question=first_card.get("cfu", {}).get("stem", "")
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

    def greet_with_first_mcq_card_sync_full(self, lesson_snapshot: Dict, first_card: Dict[str, Any]):
        """Generate cohesive greeting with first MCQ card (sync version) - returns full response object."""
        try:
            cfu = first_card.get("cfu", {})
            options = cfu.get("options", [])
            question = cfu.get("stem", "") or cfu.get("question", "")
            
            examples = "\n".join(first_card.get("example", []))
            formatted_options = self._format_mcq_options(options)
            
            response = self.llm.invoke(
                self.greeting_with_first_mcq_card_prompt.format_messages(
                    lesson_title=lesson_snapshot.get("title", "Math Lesson"),
                    outcome_refs=", ".join([ref["label"] for ref in lesson_snapshot.get("outcomeRefs", [])]),
                    card_title=first_card.get("title", ""),
                    card_explainer=first_card.get("explainer", ""),
                    card_examples=examples,
                    mcq_question=question,
                    mcq_options=formatted_options
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
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(
                f"Failed to generate MCQ greeting with first lesson card: {str(e)}"
            ) from e

    def present_mcq_card_sync_full(self, card: Dict[str, Any]):
        """Present MCQ card with structured format (sync version) - returns full response object."""
        try:
            cfu = card.get("cfu", {})
            options = cfu.get("options", [])
            question = cfu.get("stem", "") or cfu.get("question", "")
            
            examples = "\n".join(card.get("example", []))
            formatted_options = self._format_mcq_options(options)
            
            response = self.llm.invoke(
                self.mcq_card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    explainer=card.get("explainer", ""),
                    examples=examples,
                    mcq_question=question,
                    mcq_options=formatted_options,
                    card_title=card.get("title", "")
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
        max_attempts: int = 3
    ) -> EvaluationResponse:
        """Generate structured evaluation with LLM reasoning (sync version)."""
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
            
            print(f"[DEBUG] About to invoke structured LLM with tags")
            response = structured_llm.invoke(
                self.structured_evaluation_prompt.format_messages(
                    question_type=question_type,
                    question=question_text,
                    expected=str(expected_answer),
                    student_response=student_response,
                    attempt_number=attempt_number,
                    max_attempts=max_attempts,
                    card_context=context_summary
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
    
    def explain_correct_answer_sync_full(self, current_card: Dict, student_attempts: List[str]):
        """Generate explanation showing correct answer after max failed attempts (sync version) - returns full response object."""
        try:
            cfu = current_card.get("cfu", {})
            card_context = f"Title: {current_card.get('title', '')}, Explainer: {current_card.get('explainer', '')[:100]}..."
            
            response = self.llm.invoke(
                self.correct_answer_explanation_prompt.format_messages(
                    card_context=card_context,
                    question=cfu.get("stem", ""),
                    expected_answer=str(cfu.get("expected", "")),
                    student_attempts=", ".join(student_attempts) if student_attempts else "No attempts recorded"
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

    def summarize_completed_lesson_sync_full(self, lesson_snapshot: Dict, evidence: List[Dict], performance_analysis: Dict):
        """Generate comprehensive lesson summary with LLM analysis (sync version) - returns full response object."""
        try:
            # Format lesson details
            lesson_title = lesson_snapshot.get("title", "Math Lesson")
            outcome_refs = ", ".join([ref["label"] for ref in lesson_snapshot.get("outcomeRefs", [])])
            cards = lesson_snapshot.get("cards", [])
            total_cards = len(cards)
            cards_completed = len([card for card in cards])
            
            # Format performance analysis
            performance_text = self._format_performance_analysis(performance_analysis)
            
            # Format evidence summary
            evidence_text = self._format_evidence_summary(evidence)
            
            response = self.llm.invoke(
                self.lesson_summary_prompt.format_messages(
                    lesson_title=lesson_title,
                    outcome_refs=outcome_refs,
                    total_cards=total_cards,
                    cards_completed=cards_completed,
                    performance_analysis=performance_text,
                    evidence_summary=evidence_text
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

