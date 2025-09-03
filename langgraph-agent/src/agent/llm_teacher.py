"""LLM-powered conversational teaching agent for Scottish AI Lessons."""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
import os
from typing import Dict, Any, Optional, List


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

Make it feel like friendly tutoring. Use real-world contexts (shopping, money, etc).
End with the question naturally in the conversation."""),
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
            # Fallback greeting
            return f"Hi {student_name}! Ready to learn about {lesson_snapshot.get('title', 'math')}? Let's get started!"

    async def present_card(self, card: Dict[str, Any]) -> str:
        """Present lesson card conversationally."""
        try:
            examples = "\n".join(card.get("example", []))
            response = await self.llm.ainvoke(
                self.card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    explainer=card.get("explainer", ""),
                    examples=examples,
                    card_title=card.get("title", "")
                )
            )
            return f"{response.content}\n\n**Your turn:** {card['cfu']['stem']}"
        except Exception as e:
            # Fallback presentation
            title = card.get("title", "Let's practice")
            explainer = card.get("explainer", "")
            examples = card.get("example", [])
            question = card.get("cfu", {}).get("stem", "What do you think?")
            
            content = f"**{title}**\n\n{explainer}"
            if examples:
                content += "\n\n**Examples:**\n" + "\n".join(f"- {ex}" for ex in examples)
            content += f"\n\n**Your turn:** {question}"
            return content

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
            # Fallback feedback
            if is_correct:
                return "✓ Correct! Well done."
            else:
                if attempt_number == 1:
                    return "Not quite. Give it another try!"
                elif attempt_number == 2:
                    return f"Hint: The answer should be close to {expected_answer}. Try again."
                else:
                    return f"The correct answer is {expected_answer}. Let's move on."

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
            # Fallback transition
            return f"Great work! Now let's move on to {next_card.get('title', 'the next topic')}."

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
            # Fallback completion
            return "🎉 Lesson complete! Great job working through all the problems!"
    
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
            # Fallback greeting
            return f"Hi {student_name}! Ready to learn about {lesson_snapshot.get('title', 'math')}? Let's get started!"

    def present_card_sync(self, card: Dict[str, Any]) -> str:
        """Present lesson card conversationally (sync version)."""
        try:
            examples = "\n".join(card.get("example", []))
            response = self.llm.invoke(
                self.card_presentation_prompt.format_messages(
                    card_context=card.get("title", ""),
                    explainer=card.get("explainer", ""),
                    examples=examples,
                    card_title=card.get("title", "")
                )
            )
            return f"{response.content}\n\n**Your turn:** {card['cfu']['stem']}"
        except Exception as e:
            # Fallback presentation
            title = card.get("title", "Let's practice")
            explainer = card.get("explainer", "")
            examples = card.get("example", [])
            question = card.get("cfu", {}).get("stem", "What do you think?")
            
            content = f"**{title}**\n\n{explainer}"
            if examples:
                content += "\n\n**Examples:**\n" + "\n".join(f"- {ex}" for ex in examples)
            content += f"\n\n**Your turn:** {question}"
            return content

    def evaluate_response_sync(
        self, 
        student_response: str,
        expected_answer: Any,
        card_context: Dict,
        attempt_number: int,
        is_correct: bool
    ) -> str:
        """Generate contextual feedback for student response (sync version)."""
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
            # Fallback feedback
            if is_correct:
                return "✓ Correct! Well done."
            else:
                if attempt_number == 1:
                    return "Not quite. Give it another try!"
                elif attempt_number == 2:
                    return f"Hint: The answer should be close to {expected_answer}. Try again."
                else:
                    return f"The correct answer is {expected_answer}. Let's move on."

    def transition_to_next_sync(
        self, 
        completed_card: Dict, 
        next_card: Optional[Dict],
        progress_context: Dict
    ) -> str:
        """Generate transition between lesson cards (sync version)."""
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
            # Fallback transition
            return f"Great work! Now let's move on to {next_card.get('title', 'the next topic')}."

    def complete_lesson_sync(self, lesson_snapshot: Dict, progress_context: Dict) -> str:
        """Generate lesson completion message (sync version)."""
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
            # Fallback completion
            return "🎉 Lesson complete! Great job working through all the problems!"