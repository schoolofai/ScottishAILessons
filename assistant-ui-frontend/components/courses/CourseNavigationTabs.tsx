'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../ui/badge';
import { Loader2 } from 'lucide-react';

export interface CourseData {
  id: string;
  subject: string;
  level: string;
  title: string;
  progress: number;
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  nextLessonTitle?: string;
  status: 'active' | 'completed' | 'paused';
  overdueLessons?: number;
}

export interface CourseNavigationTabsProps {
  courses: CourseData[];
  activeCourse: string;
  onCourseChange: (courseId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function CourseNavigationTabs({
  courses,
  activeCourse,
  onCourseChange,
  loading = false,
  error = null
}: CourseNavigationTabsProps) {
  const [focusedTab, setFocusedTab] = useState<string>(activeCourse);

  // Update focused tab when active course changes
  useEffect(() => {
    setFocusedTab(activeCourse);
  }, [activeCourse]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, courseId: string) => {
    const currentIndex = courses.findIndex(course => course.id === courseId);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (currentIndex + 1) % courses.length;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex === 0 ? courses.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = courses.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onCourseChange(courseId);
        return;
      default:
        return;
    }

    const newCourse = courses[newIndex];
    if (newCourse) {
      setFocusedTab(newCourse.id);
      // Focus the new tab
      const newTabElement = document.querySelector(`[data-testid="course-tab-${newCourse.subject}"]`) as HTMLElement;
      if (newTabElement) {
        newTabElement.focus();
      }
    }
  }, [courses, onCourseChange]);

  // Handle tab click
  const handleTabClick = useCallback((courseId: string) => {
    onCourseChange(courseId);
  }, [onCourseChange]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-4"
        data-testid="course-navigation-loading"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading courses...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-red-600 p-4 bg-red-50 rounded-md"
        data-testid="courses-error"
      >
        {error}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div
        className="text-gray-500 p-4 text-center"
        data-testid="empty-courses-state"
      >
        <p>No courses available</p>
        <p className="text-sm mt-1">Please check your enrollment status or contact support.</p>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="course-navigation-tabs">
      <div className="flex gap-1 border-b border-gray-200">
        {courses.map((course) => (
          <button
            key={course.id}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors relative ${
              activeCourse === course.id
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid={`course-tab-${course.subject}`}
            role="tab"
            tabIndex={focusedTab === course.id ? 0 : -1}
            aria-selected={activeCourse === course.id}
            onClick={() => handleTabClick(course.id)}
            onKeyDown={(e) => handleKeyDown(e, course.id)}
            onFocus={() => setFocusedTab(course.id)}
          >
            <div className="flex items-center gap-2">
              <span className="capitalize">
                {course.subject.replace(/-/g, ' ')} - {course.level.replace(/-/g, ' ')}
              </span>
              {course.overdueLessons && course.overdueLessons > 0 && (
                <Badge
                  variant="destructive"
                  className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full"
                >
                  {course.overdueLessons}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CourseNavigationTabs;