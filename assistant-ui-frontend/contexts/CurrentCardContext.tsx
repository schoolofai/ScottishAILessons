"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

/**
 * Current card data interface for context-aware chat
 */
export interface CurrentCardData {
  card_data: any;
  card_index: number;
  total_cards: number;
  interaction_state: "presenting" | "evaluating" | "completed" | "unknown";
  lesson_context?: {
    lesson_title: string;
    student_name: string;
    progress: string;
  };
  // Previous answer data for retry scenarios (Issue 2)
  previous_answer?: string;
  previous_drawing?: string;
  previous_drawing_text?: string;
}

/**
 * Context for sharing current lesson card data across components
 * This enables context-aware chat to access real-time card information
 * without depending on potentially stale main graph state during interrupts
 */
export const CurrentCardContext = createContext<{
  currentCard: CurrentCardData | null;
  setCurrentCard: (card: CurrentCardData | null) => void;
  onSessionStatusChange?: (status: 'created' | 'active' | 'completed' | 'failed') => void;
} | null>(null);

/**
 * Provider component for CurrentCardContext
 */
export interface CurrentCardProviderProps {
  children: ReactNode;
  onSessionStatusChange?: (status: 'created' | 'active' | 'completed' | 'failed') => void;
}

export function CurrentCardProvider({ children, onSessionStatusChange }: CurrentCardProviderProps) {
  const [currentCard, setCurrentCard] = useState<CurrentCardData | null>(null);

  return (
    <CurrentCardContext.Provider value={{ currentCard, setCurrentCard, onSessionStatusChange }}>
      {children}
    </CurrentCardContext.Provider>
  );
}

/**
 * Hook to access current card context
 * @returns current card data and setter function
 */
export function useCurrentCard() {
  const context = useContext(CurrentCardContext);
  if (!context) {
    throw new Error("useCurrentCard must be used within a CurrentCardProvider");
  }
  return context;
}

/**
 * Hook to get current card data (convenience hook)
 * @returns current card data or null
 */
export function useCurrentCardData(): CurrentCardData | null {
  const { currentCard } = useCurrentCard();
  return currentCard;
}

/**
 * Safe hook to access current card context (doesn't throw if outside provider)
 * @returns current card context or null if not within provider
 */
export function useSafeCurrentCard() {
  const context = useContext(CurrentCardContext);
  return context;
}