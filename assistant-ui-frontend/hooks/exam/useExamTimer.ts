import { useState, useCallback, useEffect, useRef } from 'react';
import { formatTimeRemaining, getTimeStatus } from '@/lib/exam/types';

interface UseExamTimerReturn {
  timeRemaining: number;
  totalTime: number;
  isRunning: boolean;
  isPaused: boolean;
  timeStatus: 'normal' | 'warning' | 'critical';
  startTimer: () => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  formatTime: () => string;
}

/**
 * useExamTimer - Manages exam countdown timer with status indicators
 *
 * Features:
 * - Countdown from total time
 * - Warning (25% remaining) and critical (10% remaining) states
 * - Pause/resume capability
 * - Formatted display string
 */
export function useExamTimer(totalSeconds: number): UseExamTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Timer tick logic
  useEffect(() => {
    if (isRunning && !isPaused && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning, isPaused, timeRemaining]);

  const startTimer = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const pauseTimer = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    setIsPaused(false);
  }, []);

  const formatTime = useCallback(() => {
    return formatTimeRemaining(timeRemaining);
  }, [timeRemaining]);

  const timeStatus = getTimeStatus(timeRemaining, totalSeconds);

  return {
    timeRemaining,
    totalTime: totalSeconds,
    isRunning,
    isPaused,
    timeStatus,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    formatTime,
  };
}
