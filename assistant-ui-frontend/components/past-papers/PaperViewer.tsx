'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, FileText, Calculator, Clock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SplitPanelLayout,
  SplitPanelHeader,
} from '@/components/ui/split-panel-layout';
import { QuestionsSidebar, QuestionItem } from './QuestionsSidebar';
import { WalkthroughContent, WalkthroughEmptyState } from './WalkthroughContent';
import { logger } from '@/lib/logger';

// Types
interface PaperData {
  paperId: string;
  subject: string;
  level: string;
  year: number;
  paperCode: string;
  totalMarks: number;
  durationMinutes: number;
  calculatorAllowed: boolean;
  questions: QuestionItem[];
}

interface WalkthroughStep {
  bullet: number;
  label: string;
  process: string;
  working: string;
  working_latex: string;
  marks_earned: number;
  examiner_notes?: string;
}

interface CommonError {
  error_type: 'notation' | 'calculation' | 'concept' | 'omission';
  description: string;
  why_marks_lost: string;
  prevention_tip: string;
}

interface Diagram {
  id: string;
  type: string;
  description: string;
  file_id?: string;
  file_url?: string;
}

interface WalkthroughContentData {
  question_stem: string;
  question_stem_latex: string;
  topic_tags: string[];
  total_marks: number;
  steps: WalkthroughStep[];
  common_errors: CommonError[];
  examiner_summary: string;
  /** @deprecated Diagrams now fetched directly from us_papers. Kept for backward compatibility. */
  diagram_refs?: string[];
}

interface WalkthroughData {
  documentId: string;
  paperId: string;
  questionNumber: string;
  paperCode: string;
  year: number;
  subject: string;
  level: string;
  marks: number;
  content: WalkthroughContentData;
  diagrams?: Diagram[];
  modelVersion: string;
  catalogVersion: string | null;
}

interface PaperViewerProps {
  /** Paper ID for API calls */
  paperId: string;
  /** Subject name for display */
  subject: string;
  /** Level name for display */
  level: string;
  /** Year for display */
  year: number;
  /** Paper code for display */
  paperCode: string;
  /** Initial question to select (from URL param) */
  initialQuestion?: string;
  /** URL params for navigation (encoded versions) */
  urlParams: {
    subject: string;
    level: string;
    year: string;
    paperCode: string;
  };
}

type WalkthroughStatus = 'loading' | 'published' | 'not_generated' | 'error';

/**
 * PaperViewer - Main orchestrator component for the paper viewing experience.
 *
 * Manages:
 * - Selected question state
 * - Walkthrough data fetching
 * - URL synchronization (?q= query param)
 * - Viewed questions tracking
 * - Navigation between questions
 */
export function PaperViewer({
  paperId,
  subject,
  level,
  year,
  paperCode,
  initialQuestion,
  urlParams,
}: PaperViewerProps) {
  const router = useRouter();

  // Track if initial question selection has been applied (one-time only)
  const initialSelectionApplied = useRef(false);

  // Paper data state
  const [paper, setPaper] = useState<PaperData | null>(null);
  const [paperLoading, setPaperLoading] = useState(true);
  const [paperError, setPaperError] = useState<string | null>(null);

  // Selected question state
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(
    initialQuestion || null
  );

  // Walkthrough data state
  const [walkthrough, setWalkthrough] = useState<WalkthroughData | null>(null);
  const [walkthroughStatus, setWalkthroughStatus] =
    useState<WalkthroughStatus>('loading');
  const [walkthroughError, setWalkthroughError] = useState<string | null>(null);

  // Viewed questions tracking (persisted in session)
  const [viewedQuestions, setViewedQuestions] = useState<Set<string>>(
    new Set()
  );

  // Mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch paper data - only depends on paperId, NOT initialQuestion
  // This prevents re-fetching when URL query param changes
  useEffect(() => {
    async function fetchPaper() {
      try {
        setPaperLoading(true);
        setPaperError(null);

        const response = await fetch(
          `/api/past-papers/${encodeURIComponent(paperId)}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch paper');
        }

        const data = await response.json();
        setPaper(data.paper);
        logger.info('Loaded paper', {
          paperId,
          questionCount: data.paper?.questions?.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setPaperError(message);
        logger.error('Failed to load paper', { error: message });
      } finally {
        setPaperLoading(false);
      }
    }

    fetchPaper();
  }, [paperId]);

  // Apply initial question selection once paper is loaded (one-time only)
  // This effect handles the ?q= URL parameter on initial page load
  useEffect(() => {
    if (paper && initialQuestion && !initialSelectionApplied.current) {
      const questionExists = paper.questions.some(
        (q: QuestionItem) => q.number === initialQuestion
      );
      if (questionExists) {
        setSelectedQuestion(initialQuestion);
        logger.info('Applied initial question selection', { initialQuestion });
      }
      initialSelectionApplied.current = true;
    }
  }, [paper, initialQuestion]);

  // Fetch walkthrough when question is selected
  useEffect(() => {
    if (!selectedQuestion || !paper) {
      setWalkthrough(null);
      return;
    }

    async function fetchWalkthrough() {
      try {
        setWalkthroughStatus('loading');
        setWalkthroughError(null);

        const url = `/api/past-papers/${encodeURIComponent(
          paperId
        )}/questions/${encodeURIComponent(selectedQuestion!)}/walkthrough`;

        const response = await fetch(url);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch walkthrough');
        }

        const data = await response.json();

        if (data.status === 'not_generated') {
          setWalkthroughStatus('not_generated');
          setWalkthrough(null);
        } else {
          setWalkthroughStatus('published');
          setWalkthrough(data.walkthrough);
        }

        // Mark as viewed
        setViewedQuestions((prev) => new Set([...prev, selectedQuestion!]));

        logger.info('Loaded walkthrough', {
          paperId,
          questionNumber: selectedQuestion,
          status: data.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setWalkthroughStatus('error');
        setWalkthroughError(message);
        logger.error('Failed to load walkthrough', { error: message });
      }
    }

    fetchWalkthrough();
  }, [selectedQuestion, paperId, paper]);

  // Sync selected question to URL using native History API
  // This prevents triggering React/Next.js router state changes which would
  // cause the parent component to re-render with new searchParams
  useEffect(() => {
    if (!paper || typeof window === 'undefined') return;

    // Get current URL query param
    const currentUrl = new URL(window.location.href);
    const currentQ = currentUrl.searchParams.get('q');

    if (selectedQuestion && selectedQuestion !== currentQ) {
      // Update URL with new question
      const newUrl = `/past-papers/${urlParams.subject}/${urlParams.level}/${urlParams.year}/${urlParams.paperCode}?q=${encodeURIComponent(selectedQuestion)}`;
      window.history.replaceState(null, '', newUrl);
    } else if (!selectedQuestion && currentQ) {
      // Remove question from URL
      const newUrl = `/past-papers/${urlParams.subject}/${urlParams.level}/${urlParams.year}/${urlParams.paperCode}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [selectedQuestion, urlParams, paper]);

  // Handle question selection
  const handleSelectQuestion = useCallback((questionNumber: string) => {
    setSelectedQuestion(questionNumber);
    setDrawerOpen(false); // Close mobile drawer on selection
  }, []);

  // Navigation handlers
  const { hasPrevious, hasNext, goToPrevious, goToNext, currentQuestion } =
    useMemo(() => {
      if (!paper || !selectedQuestion) {
        return {
          hasPrevious: false,
          hasNext: false,
          goToPrevious: () => {},
          goToNext: () => {},
          currentQuestion: null,
        };
      }

      const questions = paper.questions.filter((q) => q.hasWalkthrough);
      const currentIndex = questions.findIndex(
        (q) => q.number === selectedQuestion
      );

      return {
        hasPrevious: currentIndex > 0,
        hasNext: currentIndex < questions.length - 1,
        goToPrevious: () => {
          if (currentIndex > 0) {
            setSelectedQuestion(questions[currentIndex - 1].number);
          }
        },
        goToNext: () => {
          if (currentIndex < questions.length - 1) {
            setSelectedQuestion(questions[currentIndex + 1].number);
          }
        },
        currentQuestion: paper.questions.find(
          (q) => q.number === selectedQuestion
        ),
      };
    }, [paper, selectedQuestion]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.push(
      `/past-papers/${urlParams.subject}/${urlParams.level}`
    );
  }, [router, urlParams]);

  // Paper metadata for components
  const paperMetadata = useMemo(
    () => ({
      subject,
      level,
      year,
      paperCode,
      totalMarks: paper?.totalMarks || 0,
    }),
    [subject, level, year, paperCode, paper]
  );

  // Loading state for entire viewer
  if (paperLoading) {
    return (
      <SplitPanelLayout
        header={
          <SplitPanelHeader
            left={
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
            }
          />
        }
        sidebar={
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        }
        content={
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600">Loading paper...</p>
            </div>
          </div>
        }
      />
    );
  }

  // Error state
  if (paperError || !paper) {
    return (
      <SplitPanelLayout
        header={
          <SplitPanelHeader
            left={
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back to Papers
              </Button>
            }
          />
        }
        sidebar={<div />}
        content={
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Error Loading Paper
              </h2>
              <p className="text-gray-600 mb-4">{paperError}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <SplitPanelLayout
      header={
        <SplitPanelHeader
          left={
            <>
              <Button
                variant="ghost"
                onClick={handleBack}
                className="gap-2 -ml-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-gray-600 flex-shrink-0" />
                <span className="font-semibold text-gray-800 truncate">
                  {subject} {level}
                </span>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {year}
                </Badge>
              </div>
            </>
          }
          right={
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="hidden md:flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{paper.questions.length} Qs</span>
              </div>
              <div className="hidden md:flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{paper.totalMarks} marks</span>
              </div>
              {paper.calculatorAllowed && (
                <Badge
                  variant="secondary"
                  className="hidden md:inline-flex gap-1 bg-green-100 text-green-700"
                >
                  <Calculator className="h-3 w-3" />
                  Calculator
                </Badge>
              )}
            </div>
          }
        />
      }
      sidebar={
        <QuestionsSidebar
          questions={paper.questions}
          selectedQuestion={selectedQuestion}
          onSelectQuestion={handleSelectQuestion}
          viewedQuestions={viewedQuestions}
          paperMetadata={paperMetadata}
        />
      }
      content={
        selectedQuestion && currentQuestion ? (
          <WalkthroughContent
            walkthrough={walkthrough}
            questionNumber={selectedQuestion}
            marks={currentQuestion.marks}
            topicTags={currentQuestion.topicTags}
            diagrams={walkthrough?.diagrams}
            status={walkthroughStatus}
            errorMessage={walkthroughError || undefined}
            onPrevious={goToPrevious}
            onNext={goToNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            paperMetadata={paperMetadata}
          />
        ) : (
          <WalkthroughEmptyState />
        )
      }
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
    />
  );
}

export default PaperViewer;
