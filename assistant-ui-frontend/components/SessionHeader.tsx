"use client";

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SessionContext } from './MyAssistant';

interface SessionHeaderProps {
  sessionContext?: SessionContext;
}

export function SessionHeader({ sessionContext }: SessionHeaderProps) {
  if (!sessionContext) {
    return (
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900">Assistant</h1>
      </div>
    );
  }

  const { lesson_snapshot, course_level, course_subject } = sessionContext;

  // Format course level and subject for display
  const formatCourseLevel = (level?: string) => {
    if (!level) return null;
    // Convert "national-3" to "National 3"
    return level.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatCourseSubject = (subject?: string) => {
    if (!subject) return null;
    // Convert "application-of-mathematics" to "Application Of Mathematics"
    return subject.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const displayLevel = formatCourseLevel(course_level);
  const displaySubject = formatCourseSubject(course_subject);

  return (
    <div className="flex items-center space-x-3 flex-1">
      <Link
        href="/dashboard"
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        Dashboard
      </Link>

      <div className="text-gray-400">→</div>

      <div className="flex-1">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          {displayLevel && (
            <>
              <span>{displayLevel}</span>
              <span>•</span>
            </>
          )}
          {displaySubject && (
            <>
              <span>{displaySubject}</span>
              <span>•</span>
            </>
          )}
          <span className="font-medium text-gray-900">
            {lesson_snapshot?.title || 'Lesson'}
          </span>
        </div>
      </div>
    </div>
  );
}
