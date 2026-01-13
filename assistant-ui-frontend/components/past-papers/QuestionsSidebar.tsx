'use client';

import React, { useMemo } from 'react';
import { CheckCircle, Circle, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SplitPanelSidebar } from '@/components/ui/split-panel-layout';

export interface QuestionItem {
  number: string;
  marks: number;
  topicTags: string[];
  hasSolution: boolean;
  hasWalkthrough: boolean;
}

interface QuestionsSidebarProps {
  /** List of questions in the paper */
  questions: QuestionItem[];
  /** Currently selected question number */
  selectedQuestion: string | null;
  /** Callback when a question is selected */
  onSelectQuestion: (questionNumber: string) => void;
  /** Set of question numbers that have been viewed */
  viewedQuestions: Set<string>;
  /** Paper metadata */
  paperMetadata: {
    paperCode: string;
    year: number;
    totalMarks: number;
    level: string;
    subject: string;
  };
  /** Optional loading state */
  isLoading?: boolean;
}

/**
 * QuestionsSidebar - Left panel navigation for paper questions.
 *
 * Visual structure:
 * ```
 * ┌─────────────────────┐
 * │  QUESTIONS          │  ← Sticky header
 * │  12 questions       │
 * ├─────────────────────┤
 * │  ● Q1     4 marks   │  ← Active (filled dot, blue bg)
 * │  ○ Q2     3 marks   │  ← Available (empty dot)
 * │  ◐ Q3     5 marks   │  ← Viewed (half-filled)
 * │  ○ Q4a    2 marks   │
 * │  ◌ Q5     6 marks   │  ← No walkthrough (dashed)
 * │  ...                │
 * ├─────────────────────┤
 * │  Total: 45 marks    │  ← Sticky footer
 * │  Viewed: 3/12       │
 * └─────────────────────┘
 * ```
 */
export function QuestionsSidebar({
  questions,
  selectedQuestion,
  onSelectQuestion,
  viewedQuestions,
  paperMetadata,
  isLoading = false,
}: QuestionsSidebarProps) {
  // Calculate totals
  const { totalMarks, questionsWithWalkthrough, viewedCount } = useMemo(() => {
    const total = questions.reduce((sum, q) => sum + q.marks, 0);
    const withWalkthrough = questions.filter((q) => q.hasWalkthrough).length;
    const viewed = questions.filter((q) => viewedQuestions.has(q.number)).length;
    return { totalMarks: total, questionsWithWalkthrough: withWalkthrough, viewedCount: viewed };
  }, [questions, viewedQuestions]);

  // Get level color class
  const levelColorClass = getLevelColorClass(paperMetadata.level);

  if (isLoading) {
    return (
      <SplitPanelSidebar
        header={
          <div className="p-4">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mt-2" />
          </div>
        }
        footer={
          <div className="p-4">
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          </div>
        }
      >
        <div className="p-2 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 rounded-lg animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </SplitPanelSidebar>
    );
  }

  return (
    <SplitPanelSidebar
      header={
        <div className="p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            <h2 className="font-semibold text-gray-800">Questions</h2>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {questions.length} questions
            </Badge>
            <Badge className={cn('text-xs', levelColorClass)}>
              {paperMetadata.level}
            </Badge>
          </div>
        </div>
      }
      footer={
        <div className="p-4 space-y-2">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Progress</span>
              <span>
                {viewedCount}/{questions.length}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all duration-500"
                style={{
                  width: `${questions.length > 0 ? (viewedCount / questions.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total marks</span>
            <span className="font-semibold text-gray-800">{totalMarks}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Walkthroughs</span>
            <span className="font-semibold text-green-600">
              {questionsWithWalkthrough}/{questions.length}
            </span>
          </div>
        </div>
      }
    >
      <ul className="p-2 space-y-1" role="list" aria-label="Questions list">
        {questions.map((question) => {
          const isSelected = selectedQuestion === question.number;
          const isViewed = viewedQuestions.has(question.number);
          const hasWalkthrough = question.hasWalkthrough;

          return (
            <li key={question.number}>
              <button
                onClick={() => hasWalkthrough && onSelectQuestion(question.number)}
                disabled={!hasWalkthrough}
                aria-current={isSelected ? 'page' : undefined}
                aria-label={`Question ${question.number}, ${question.marks} marks${
                  !hasWalkthrough ? ', walkthrough not available' : ''
                }${isViewed ? ', viewed' : ''}`}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                  'transition-all duration-200',
                  'text-left',
                  // Base state
                  'hover:bg-gray-100',
                  // Selected state
                  isSelected && 'bg-blue-50 border-l-3 border-blue-500 hover:bg-blue-100',
                  // Viewed state (but not selected)
                  isViewed && !isSelected && 'bg-green-50/50',
                  // Disabled state
                  !hasWalkthrough && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                )}
              >
                {/* Status indicator */}
                <QuestionStatusIcon
                  isSelected={isSelected}
                  isViewed={isViewed}
                  hasWalkthrough={hasWalkthrough}
                />

                {/* Question number */}
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    isSelected ? 'text-blue-700' : 'text-gray-800'
                  )}
                >
                  Q{question.number}
                </span>

                {/* Marks badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    'ml-auto text-xs',
                    isSelected && 'bg-blue-100 text-blue-700'
                  )}
                >
                  {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </SplitPanelSidebar>
  );
}

/**
 * QuestionStatusIcon - Visual indicator for question status.
 */
interface QuestionStatusIconProps {
  isSelected: boolean;
  isViewed: boolean;
  hasWalkthrough: boolean;
}

function QuestionStatusIcon({
  isSelected,
  isViewed,
  hasWalkthrough,
}: QuestionStatusIconProps) {
  if (!hasWalkthrough) {
    // No walkthrough - clock icon
    return <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />;
  }

  if (isSelected) {
    // Currently selected - filled blue circle
    return (
      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
      </div>
    );
  }

  if (isViewed) {
    // Viewed - green checkmark
    return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
  }

  // Available - empty circle
  return <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />;
}

/**
 * Get Tailwind classes for level-based color coding.
 */
function getLevelColorClass(level: string): string {
  const normalized = level.toLowerCase().replace(/\s+/g, '-');

  const levelColors: Record<string, string> = {
    'national-3': 'bg-green-100 text-green-800',
    'national-4': 'bg-blue-100 text-blue-800',
    'national-5': 'bg-purple-100 text-purple-800',
    higher: 'bg-orange-100 text-orange-800',
    'advanced-higher': 'bg-red-100 text-red-800',
    // Also support shortcodes
    n3: 'bg-green-100 text-green-800',
    n4: 'bg-blue-100 text-blue-800',
    n5: 'bg-purple-100 text-purple-800',
    nh: 'bg-orange-100 text-orange-800',
    nah: 'bg-red-100 text-red-800',
  };

  return levelColors[normalized] || 'bg-gray-100 text-gray-800';
}

export default QuestionsSidebar;
