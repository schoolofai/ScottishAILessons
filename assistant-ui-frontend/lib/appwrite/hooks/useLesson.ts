'use client';

import { useState, useCallback } from 'react';
import { LessonDriver } from '../driver/LessonDriver';
import { SessionDriver } from '../driver/SessionDriver';
import { useAppwrite } from './useAppwrite';
import type { Session, LessonTemplate, LessonSnapshot } from '../types';

/**
 * Lesson hook providing lesson session operations and state management
 */
export function useLesson() {
  const { createDriver } = useAppwrite();
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [lessonSnapshot, setLessonSnapshot] = useState<LessonSnapshot | null>(null);
  const [currentCard, setCurrentCard] = useState<any>(null);
  const [progress, setProgress] = useState({ currentCard: 0, totalCards: 0, completed: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lessonDriver = createDriver(LessonDriver);
  const sessionDriver = createDriver(SessionDriver);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const sessionState = await sessionDriver.getSessionState(sessionId);
      const currentCardData = await sessionDriver.getCurrentCard(sessionId);
      
      setCurrentSession(sessionState.session);
      setLessonSnapshot(sessionState.parsedSnapshot);
      setCurrentCard(currentCardData.card);
      setProgress(sessionState.progress);
      
      return sessionState;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load session';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [sessionDriver]);

  const createSession = useCallback(async (
    studentId: string,
    courseId: string,
    lessonTemplateId: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const session = await lessonDriver.createSession(studentId, courseId, lessonTemplateId);
      await loadSession(session.$id);
      
      return session;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create session';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [lessonDriver, loadSession]);

  const updateSessionStage = useCallback(async (stage: string) => {
    if (!currentSession) throw new Error('No current session');
    
    try {
      const updatedSession = await lessonDriver.updateSessionStage(currentSession.$id, stage);
      setCurrentSession(updatedSession);
      return updatedSession;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update session stage';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [lessonDriver, currentSession]);

  const completeSession = useCallback(async () => {
    if (!currentSession) throw new Error('No current session');
    
    try {
      const completedSession = await lessonDriver.completeSession(currentSession.$id);
      setCurrentSession(completedSession);
      setProgress(prev => ({ ...prev, completed: true }));
      return completedSession;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to complete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [lessonDriver, currentSession]);

  const refreshProgress = useCallback(async () => {
    if (!currentSession) return;
    
    try {
      const sessionState = await sessionDriver.getSessionState(currentSession.$id);
      const currentCardData = await sessionDriver.getCurrentCard(currentSession.$id);
      
      setProgress(sessionState.progress);
      setCurrentCard(currentCardData.card);
      
      return sessionState.progress;
    } catch (err: any) {
      setError(err.message || 'Failed to refresh progress');
    }
  }, [sessionDriver, currentSession]);

  const canProgressToNext = useCallback(async () => {
    if (!currentSession) return false;
    
    try {
      return await sessionDriver.canProgressToNext(currentSession.$id);
    } catch (err: any) {
      setError(err.message || 'Failed to check progress');
      return false;
    }
  }, [sessionDriver, currentSession]);

  const getSessionAnalytics = useCallback(async () => {
    if (!currentSession) return null;
    
    try {
      return await sessionDriver.getSessionAnalytics(currentSession.$id);
    } catch (err: any) {
      setError(err.message || 'Failed to get analytics');
      return null;
    }
  }, [sessionDriver, currentSession]);

  const clearSession = useCallback(() => {
    setCurrentSession(null);
    setLessonSnapshot(null);
    setCurrentCard(null);
    setProgress({ currentCard: 0, totalCards: 0, completed: false });
    setError(null);
  }, []);

  return {
    // State
    currentSession,
    lessonSnapshot,
    currentCard,
    progress,
    isLoading,
    error,
    
    // Actions
    loadSession,
    createSession,
    updateSessionStage,
    completeSession,
    refreshProgress,
    canProgressToNext,
    getSessionAnalytics,
    clearSession,
    
    // Computed
    hasSession: !!currentSession,
    isCompleted: progress.completed || !!currentSession?.endedAt,
    progressPercentage: progress.totalCards > 0 ? 
      Math.round((progress.currentCard + 1) / progress.totalCards * 100) : 0,
    
    // Driver access
    lessonDriver,
    sessionDriver
  };
}