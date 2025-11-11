"use client";

/**
 * Fake SessionHeader Component for Testing
 *
 * Displays lesson metadata without backend dependencies.
 */

import { SessionContext } from '../MyAssistant';

interface FakeSessionHeaderProps {
  sessionContext?: SessionContext;
}

export function FakeSessionHeader({ sessionContext }: FakeSessionHeaderProps) {
  if (!sessionContext) {
    return (
      <div className="px-6 py-4 bg-gray-100 border-b">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  const { lesson_snapshot, course_subject, course_level, course_title } = sessionContext;

  return (
    <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white border-b shadow-md">
      {/* Fake Mode Banner */}
      <div className="mb-2 flex items-center gap-2 text-sm bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full w-fit">
        <span>⚠️</span>
        <span className="font-semibold">TESTING MODE - No Backend Connection</span>
      </div>

      {/* Lesson Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lesson_snapshot?.title || 'Untitled Lesson'}</h1>

          {/* Course Info */}
          {course_title && (
            <div className="mt-2 flex items-center gap-4 text-sm text-blue-100">
              <span className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span>{course_title}</span>
              </span>

              {course_subject && (
                <span className="flex items-center gap-1">
                  <span>📚</span>
                  <span className="capitalize">
                    {course_subject.replace(/-/g, ' ')}
                  </span>
                </span>
              )}

              {course_level && (
                <span className="flex items-center gap-1">
                  <span>🎯</span>
                  <span className="capitalize">
                    {course_level.replace(/-/g, ' ')}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Lesson Metadata */}
          {lesson_snapshot && (
            <div className="mt-2 flex items-center gap-4 text-sm text-blue-100">
              <span className="flex items-center gap-1">
                <span>📝</span>
                <span>
                  {lesson_snapshot.cards?.length || 0} Cards
                </span>
              </span>

              <span className="flex items-center gap-1">
                <span>⏱️</span>
                <span>{lesson_snapshot.estMinutes || 50} minutes</span>
              </span>

              <span className="flex items-center gap-1">
                <span>🎓</span>
                <span className="capitalize">
                  {lesson_snapshot.lesson_type?.replace(/_/g, ' ') || 'Teaching'}
                </span>
              </span>
            </div>
          )}

          {/* Outcomes */}
          {lesson_snapshot?.outcomeRefs && lesson_snapshot.outcomeRefs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {lesson_snapshot.outcomeRefs.map((ref, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-white/20 rounded-md text-xs backdrop-blur-sm"
                >
                  {ref.label || `${ref.unit} - ${ref.outcome}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side - Actions/Info */}
        <div className="flex flex-col items-end gap-2">
          <div className="px-3 py-1 bg-white/20 rounded-full text-xs backdrop-blur-sm">
            Session: {sessionContext.session_id?.substring(0, 8)}...
          </div>
          <div className="px-3 py-1 bg-green-400/30 rounded-full text-xs backdrop-blur-sm">
            ● Active
          </div>
        </div>
      </div>
    </div>
  );
}
