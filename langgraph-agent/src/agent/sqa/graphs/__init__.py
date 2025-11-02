"""SQA Main Graphs

Contains the two main graphs for SQA question practice and exam assessment:
- QuestionPracticeGraph: Rapid-fire question practice
- ExamAssessmentGraph: Full mock exam generation and marking
"""

from .question_practice import question_practice_graph
from .exam_assessment import exam_assessment_graph

__all__ = [
    "question_practice_graph",
    "exam_assessment_graph",
]
