'use client';

import { use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PaperViewer } from '@/components/past-papers/PaperViewer';

interface Props {
  params: Promise<{
    subject: string;
    level: string;
    year: string;
    paperCode: string;
  }>;
}

/**
 * Paper Viewer Page - Split-panel layout for viewing paper questions and walkthroughs.
 *
 * Route: /past-papers/[subject]/[level]/[year]/[paperCode]
 * Query: ?q=[questionNumber] - Optional, selects a specific question
 *
 * Features:
 * - Left sidebar with questions list
 * - Main content area with walkthrough display
 * - URL sync for deep linking to specific questions
 * - Mobile-responsive with drawer navigation
 */
export default function PaperQuestionsPage({ params }: Props) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaperViewerWrapper params={params} />
    </Suspense>
  );
}

/**
 * Wrapper component that handles params and search params.
 * Wrapped in Suspense because useSearchParams requires it.
 */
function PaperViewerWrapper({ params }: Props) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();

  // Decode URL params for display
  const subject = decodeURIComponent(resolvedParams.subject);
  const level = decodeURIComponent(resolvedParams.level);
  const year = parseInt(resolvedParams.year, 10);
  const paperCode = decodeURIComponent(resolvedParams.paperCode);

  // Get initial question from URL
  const initialQuestion = searchParams.get('q') || undefined;

  // Build paper ID for API calls
  const paperId = buildPaperId(subject, level, year, paperCode);

  return (
    <PaperViewer
      paperId={paperId}
      subject={subject}
      level={level}
      year={year}
      paperCode={paperCode}
      initialQuestion={initialQuestion}
      urlParams={{
        subject: resolvedParams.subject,
        level: resolvedParams.level,
        year: resolvedParams.year,
        paperCode: resolvedParams.paperCode,
      }}
    />
  );
}

/**
 * Loading fallback for Suspense boundary.
 */
function LoadingFallback() {
  return (
    <div className="h-dvh flex flex-col bg-gradient-to-br from-slate-50 via-cyan-50/30 to-emerald-50/30">
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading paper...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Build paper ID from components.
 * Format: {subject}-{level_code}-{year}-{paper_code_normalized}
 */
function buildPaperId(
  subject: string,
  level: string,
  year: number,
  paperCode: string
): string {
  // Normalize subject
  const subjectNormalized = subject.toLowerCase().replace(/ /g, '-');

  // Convert level to code
  const levelCode = levelToCode(level);

  // Normalize paper code
  const paperCodeNormalized = paperCode.replace(/\//g, '-');

  return `${subjectNormalized}-${levelCode}-${year}-${paperCodeNormalized}`;
}

/**
 * Convert level display name to code.
 */
function levelToCode(level: string): string {
  const levelMap: Record<string, string> = {
    'National 3': 'n3',
    'National 4': 'n4',
    'National 5': 'n5',
    Higher: 'nh',
    'Advanced Higher': 'nah',
    // URL format mappings
    'national-3': 'n3',
    'national-4': 'n4',
    'national-5': 'n5',
    higher: 'nh',
    'advanced-higher': 'nah',
  };
  return levelMap[level] || level.toLowerCase().replace(/ /g, '-');
}
