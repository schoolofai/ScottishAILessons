'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Loader2, BookOpen, Clock, CheckCircle } from 'lucide-react';

export interface CourseData {
  id: string;
  subject: string;
  title: string;
  progress: number;
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  nextLessonTitle?: string;
  status: 'active' | 'completed' | 'paused';
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
    <Tabs
      value={activeCourse}
      onValueChange={onCourseChange}
      className="w-full"
      data-testid="course-navigation-tabs"
    >
      <TabsList
        className="grid w-full gap-1 bg-gray-100 p-1 rounded-lg"
        style={{ gridTemplateColumns: `repeat(${courses.length}, 1fr)` }}
        role="tablist"
      >
        {courses.map((course) => (
          <TabsTrigger
            key={course.id}
            value={course.id}
            className="relative flex flex-col items-center p-3 min-h-[80px] data-[state=active]:bg-white data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-all duration-200 hover:bg-gray-50"
            data-testid={`course-tab-${course.subject}`}
            role="tab"
            tabIndex={focusedTab === course.id ? 0 : -1}
            aria-selected={activeCourse === course.id}
            onClick={() => handleTabClick(course.id)}
            onKeyDown={(e) => handleKeyDown(e, course.id)}
            onFocus={() => setFocusedTab(course.id)}
          >
            {/* Course Icon and Title */}
            <div className="flex items-center space-x-2 mb-1">
              <BookOpen className="h-4 w-4" />
              <span className="font-medium text-sm">{course.title}</span>
            </div>

            {/* Enrollment Indicator */}
            <div
              className="flex items-center space-x-1 mb-2"
              data-testid="enrollment-indicator"
            >
              {course.enrolled ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600">Enrolled</span>
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">Not Enrolled</span>
                </>
              )}
            </div>

            {/* Course Progress */}
            {course.enrolled && (
              <div
                className="w-full"
                data-testid="course-progress"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600">
                    {course.completedLessons}/{course.totalLessons} lessons
                  </span>
                  <span className="text-xs font-medium">
                    {Math.round(course.progress)}%
                  </span>
                </div>
                <Progress
                  value={course.progress}
                  className="h-1 w-full"
                />
              </div>
            )}

            {/* Status Badge */}
            <Badge
              variant={
                course.status === 'completed' ? 'default' :
                course.status === 'active' ? 'secondary' : 'outline'
              }
              className="mt-1 text-xs"
            >
              {course.status}
            </Badge>

            {/* Active Indicator */}
            {activeCourse === course.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-b" />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export default CourseNavigationTabs;