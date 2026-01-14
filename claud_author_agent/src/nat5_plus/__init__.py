"""
Nat5+ SQA Mock Exam Generator Module

This module provides the offline author agent for generating unique
National 5+ SQA mock exams using Claude Agent SDK structured outputs.

Key components:
- exam_generator_client: Main pipeline orchestrator
- question_generator_agent: Generates individual questions
- question_critic_agent: Validates question quality
- exam_assembler: Stitches questions into complete exams
- past_paper_template_extractor: Extracts templates from us_papers
- sow_topic_extractor: Extracts topics from Authored_SOW
- uniqueness_manager: Ensures exam uniqueness
- exam_upserter: Upserts to Appwrite
"""

from .exam_generator_client import generate_nat5_plus_exam

__all__ = ["generate_nat5_plus_exam"]
