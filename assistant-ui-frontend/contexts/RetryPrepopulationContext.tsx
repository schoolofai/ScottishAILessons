"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Data structure for storing student attempts
 */
export type AttemptData = {
  response: string;                    // Text answer or MCQ selection (cleaned HTML for structured_response)
  response_with_images?: string;       // Original HTML with embedded images (for structured_response retry)
  drawing_file_ids: string[];          // Phase 10: Appwrite Storage file IDs
  drawing: string | null;              // Legacy: base64 encoded drawing
  drawing_text: string;                // Text explanation accompanying drawing
  drawing_scene_data: any | null;      // Excalidraw scene data for editable restoration
  timestamp: number;                   // When attempt was made
};

/**
 * Context API for managing retry prepopulation data
 */
type RetryPrepopulationContextType = {
  storeAttempt: (cardId: string, data: AttemptData) => void;
  getAttempt: (cardId: string) => AttemptData | null;
  clearAttempt: (cardId: string) => void;
  clearAllAttempts: () => void;
};

const RetryPrepopulationContext = createContext<RetryPrepopulationContextType | undefined>(undefined);

/**
 * Provider component for retry prepopulation state
 * Scoped to session - data cleared on unmount (page refresh/navigation)
 */
export function RetryPrepopulationProvider({ children }: { children: ReactNode }) {
  // Map of cardId -> AttemptData
  const [attempts, setAttempts] = useState<Map<string, AttemptData>>(new Map());

  const storeAttempt = (cardId: string, data: AttemptData) => {
    setAttempts(prev => {
      const next = new Map(prev);
      next.set(cardId, data);
      return next;
    });
  };

  const getAttempt = (cardId: string): AttemptData | null => {
    return attempts.get(cardId) || null;
  };

  const clearAttempt = (cardId: string) => {
    setAttempts(prev => {
      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
  };

  const clearAllAttempts = () => {
    setAttempts(new Map());
  };

  return (
    <RetryPrepopulationContext.Provider
      value={{ storeAttempt, getAttempt, clearAttempt, clearAllAttempts }}
    >
      {children}
    </RetryPrepopulationContext.Provider>
  );
}

/**
 * Hook to access retry prepopulation context
 */
export function useRetryPrepopulation(): RetryPrepopulationContextType {
  const context = useContext(RetryPrepopulationContext);
  if (!context) {
    throw new Error('useRetryPrepopulation must be used within RetryPrepopulationProvider');
  }
  return context;
}
