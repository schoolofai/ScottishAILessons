import { useState, useCallback, useMemo } from 'react';
import type { SubmittedAnswer, AnswerResponse } from '@/lib/exam/types';

interface AnswerEntry {
  questionId: string;
  response: AnswerResponse;
  timeSpent?: number;
  answeredAt: Date;
}

interface ExamProgress {
  answered: number;
  total: number;
  percentComplete: number;
}

interface UseExamStateReturn {
  answers: Map<string, AnswerEntry>;
  flaggedQuestions: Set<string>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  updateAnswer: (questionId: string, response: AnswerResponse) => void;
  toggleFlag: (questionId: string) => void;
  clearAnswer: (questionId: string) => void;
  getProgress: () => ExamProgress;
  getAnswersArray: () => AnswerEntry[];
  isQuestionAnswered: (questionId: string) => boolean;
}

/**
 * useExamState - Manages exam answers and navigation state
 *
 * Tracks:
 * - Student answers per question
 * - Flagged questions for review
 * - Current question navigation
 * - Progress calculations
 */
export function useExamState(totalQuestions: number): UseExamStateReturn {
  const [answers, setAnswers] = useState<Map<string, AnswerEntry>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const updateAnswer = useCallback((questionId: string, response: AnswerResponse) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      const existing = prev.get(questionId);

      newAnswers.set(questionId, {
        questionId,
        response,
        timeSpent: existing?.timeSpent || 0,
        answeredAt: new Date(),
      });

      return newAnswers;
    });
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const clearAnswer = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      newAnswers.delete(questionId);
      return newAnswers;
    });
  }, []);

  const getProgress = useCallback((): ExamProgress => {
    const answered = answers.size;
    const percentComplete = totalQuestions > 0
      ? Math.round((answered / totalQuestions) * 100)
      : 0;

    return {
      answered,
      total: totalQuestions,
      percentComplete,
    };
  }, [answers.size, totalQuestions]);

  const getAnswersArray = useCallback((): AnswerEntry[] => {
    return Array.from(answers.values());
  }, [answers]);

  const isQuestionAnswered = useCallback((questionId: string): boolean => {
    const answer = answers.get(questionId);
    if (!answer) return false;

    const { response } = answer;

    // Check if response has any meaningful content
    if (response.selected_option) return true;
    if (response.selected_options && response.selected_options.length > 0) return true;
    if (response.numeric_value !== undefined && response.numeric_value !== null) return true;
    if (response.response_text && response.response_text.trim().length > 0) return true;

    return false;
  }, [answers]);

  return {
    answers,
    flaggedQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    updateAnswer,
    toggleFlag,
    clearAnswer,
    getProgress,
    getAnswersArray,
    isQuestionAnswered,
  };
}
