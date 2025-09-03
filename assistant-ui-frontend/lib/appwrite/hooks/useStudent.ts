'use client';

import { useState, useCallback, useEffect } from 'react';
import { StudentDriver } from '../driver/StudentDriver';
import { useAppwrite } from './useAppwrite';
import type { Student, Course, Enrollment, Session } from '../types';

/**
 * Student hook providing student data operations and dashboard state
 */
export function useStudent() {
  const { createDriver, isAuthenticated } = useAppwrite();
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentDriver = createDriver(StudentDriver);

  const initializeDashboard = useCallback(async (userId: string, userName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const dashboardData = await studentDriver.initializeDashboard(userId, userName);
      
      setStudent(dashboardData.student);
      setCourses(dashboardData.courses);
      setEnrollments(dashboardData.enrollments);
      setSessions(dashboardData.sessions);
      
      return dashboardData;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initialize dashboard';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [studentDriver]);

  const refreshSessions = useCallback(async () => {
    if (!student) return;
    
    try {
      const updatedSessions = await studentDriver.getSessions(student.$id);
      setSessions(updatedSessions);
      return updatedSessions;
    } catch (err: any) {
      setError(err.message || 'Failed to refresh sessions');
    }
  }, [studentDriver, student]);

  const enrollInCourse = useCallback(async (courseId: string) => {
    if (!student) throw new Error('No student found');
    
    try {
      const enrollment = await studentDriver.enrollStudent(student.$id, courseId);
      setEnrollments(prev => [...prev, enrollment]);
      return enrollment;
    } catch (err: any) {
      const errorMessage = err.message || 'Enrollment failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [studentDriver, student]);

  const getIncompleteSessions = useCallback(async () => {
    if (!student) return [];
    
    try {
      const incompleteSessions = await studentDriver.getIncompleteSessions(student.$id);
      return incompleteSessions;
    } catch (err: any) {
      setError(err.message || 'Failed to get incomplete sessions');
      return [];
    }
  }, [studentDriver, student]);

  // Clear state when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setStudent(null);
      setCourses([]);
      setEnrollments([]);
      setSessions([]);
      setError(null);
    }
  }, [isAuthenticated]);

  return {
    // State
    student,
    courses,
    enrollments,
    sessions,
    isLoading,
    error,
    
    // Actions
    initializeDashboard,
    refreshSessions,
    enrollInCourse,
    getIncompleteSessions,
    
    // Computed
    hasStudent: !!student,
    activeCourses: enrollments.filter(e => e.status === 'active').map(e => 
      courses.find(c => c.$id === e.courseId)
    ).filter(Boolean),
    
    // Driver access
    studentDriver
  };
}