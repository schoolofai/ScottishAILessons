'use client';

import { useState, useCallback } from 'react';
import { EvidenceDriver } from '../driver/EvidenceDriver';
import { useAppwrite } from './useAppwrite';
import type { Evidence, EvidenceData } from '../types';

/**
 * Evidence hook providing evidence recording and analytics operations
 */
export function useEvidence() {
  const { createDriver } = useAppwrite();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evidenceDriver = createDriver(EvidenceDriver);

  const recordEvidence = useCallback(async (evidenceData: EvidenceData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const evidence = await evidenceDriver.recordEvidence(evidenceData);
      return evidence;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to record evidence';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [evidenceDriver]);

  const getSessionEvidence = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      return await evidenceDriver.getSessionEvidence(sessionId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get session evidence';
      setError(errorMessage);
      return [];
    }
  }, [evidenceDriver]);

  const getItemEvidence = useCallback(async (sessionId: string, itemId: string) => {
    try {
      setError(null);
      return await evidenceDriver.getItemEvidence(sessionId, itemId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get item evidence';
      setError(errorMessage);
      return [];
    }
  }, [evidenceDriver]);

  const getLatestItemEvidence = useCallback(async (sessionId: string, itemId: string) => {
    try {
      setError(null);
      return await evidenceDriver.getLatestItemEvidence(sessionId, itemId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get latest evidence';
      setError(errorMessage);
      return null;
    }
  }, [evidenceDriver]);

  const getSessionAccuracy = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      return await evidenceDriver.getSessionAccuracy(sessionId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get session accuracy';
      setError(errorMessage);
      return 0;
    }
  }, [evidenceDriver]);

  const getStudentStats = useCallback(async (studentId: string) => {
    try {
      setError(null);
      return await evidenceDriver.getStudentEvidenceStats(studentId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get student stats';
      setError(errorMessage);
      return {
        totalSessions: 0,
        totalEvidence: 0,
        totalCorrect: 0,
        overallAccuracy: 0
      };
    }
  }, [evidenceDriver]);

  const updateEvidenceCorrectness = useCallback(async (evidenceId: string, correct: boolean) => {
    try {
      setError(null);
      return await evidenceDriver.updateEvidenceCorrectness(evidenceId, correct);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update evidence';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [evidenceDriver]);

  return {
    // State
    isSubmitting,
    error,
    
    // Actions
    recordEvidence,
    getSessionEvidence,
    getItemEvidence,
    getLatestItemEvidence,
    getSessionAccuracy,
    getStudentStats,
    updateEvidenceCorrectness,
    
    // Driver access
    evidenceDriver
  };
}