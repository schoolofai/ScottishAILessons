/**
 * Hook to access LessonDriver instance
 * Provides easy access to lesson template operations in React components
 */

import { useMemo } from 'react';
import { useAppwrite } from './useAppwrite';
import { LessonDriver } from '../driver/LessonDriver';

export function useLessonDriver(): LessonDriver {
  const { createDriver } = useAppwrite();

  return useMemo(() => createDriver(LessonDriver), [createDriver]);
}
