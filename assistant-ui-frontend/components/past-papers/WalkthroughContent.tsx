'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SplitPanelContent } from '@/components/ui/split-panel-layout';
import { WalkthroughAccordion } from './WalkthroughAccordion';
import { SupportingResourcesPanel, SupportingResourcesDrawer, SupportingResource } from './SupportingResourcesPanel';

// Types from existing walkthrough implementation
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

interface WalkthroughContentProps {
  /** The walkthrough data (null if not loaded) */
  walkthrough: WalkthroughData | null;
  /** Current question number */
  questionNumber: string;
  /** Marks for this question */
  marks: number;
  /** Topic tags for the question */
  topicTags: string[];
  /** Diagrams for the question */
  diagrams?: Diagram[];
  /** Status of the walkthrough */
  status: 'loading' | 'published' | 'not_generated' | 'error';
  /** Error message (if status is 'error') */
  errorMessage?: string;
  /** Callback for previous question */
  onPrevious?: () => void;
  /** Callback for next question */
  onNext?: () => void;
  /** Whether there is a previous question */
  hasPrevious: boolean;
  /** Whether there is a next question */
  hasNext: boolean;
  /** Paper metadata for display */
  paperMetadata: {
    subject: string;
    level: string;
    year: number;
    paperCode: string;
  };
  /** Supporting resources for the paper (CSV files, data sheets, etc.) */
  supportingResources?: SupportingResource[];
}

/**
 * WalkthroughContent - Main content area for displaying walkthrough.
 *
 * Handles multiple states:
 * - Loading: Shows loading spinner
 * - Published: Shows full walkthrough with WalkthroughAccordion
 * - Not Generated: Shows "Coming Soon" message
 * - Error: Shows error message with retry
 */
export function WalkthroughContent({
  walkthrough,
  questionNumber,
  marks,
  topicTags,
  diagrams,
  status,
  errorMessage,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  paperMetadata,
  supportingResources,
}: WalkthroughContentProps) {
  const hasResources = supportingResources && supportingResources.length > 0;
  const [drawerOpen, setDrawerOpen] = useState(true); // Open by default

  return (
    <div className="flex w-full">
      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <SplitPanelContent maxWidth="5xl">
          {/* Question Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-xl font-mono px-4 py-2 bg-white"
                >
                  Q{questionNumber}
                </Badge>
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">
                    Question {questionNumber}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {paperMetadata.subject} {paperMetadata.level} • {paperMetadata.year}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Supporting Material Button - Desktop only, toggles drawer */}
                {hasResources && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDrawerOpen(!drawerOpen)}
                    className={cn(
                      'hidden lg:flex items-center gap-2',
                      'bg-white hover:bg-teal-50 border-teal-200 hover:border-teal-300',
                      'text-teal-700 hover:text-teal-800',
                      drawerOpen && 'bg-teal-50 border-teal-300'
                    )}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {drawerOpen ? 'Hide Material' : 'Supporting Material'}
                  </Button>
                )}

                <Badge className="bg-blue-600 text-white text-base px-4 py-1.5">
                  {marks} {marks === 1 ? 'mark' : 'marks'}
                </Badge>
              </div>
            </div>

            {/* Topic Tags */}
            {topicTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {topicTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Content based on status */}
          <div className="space-y-6">
            {status === 'loading' && <LoadingState />}
            {status === 'error' && <ErrorState message={errorMessage} />}
            {status === 'not_generated' && (
              <NotGeneratedState questionNumber={questionNumber} />
            )}
            {status === 'published' && walkthrough && (
              <WalkthroughAccordion
                walkthrough={walkthrough.content}
                diagrams={diagrams || walkthrough.diagrams}
              />
            )}
          </div>

          {/* Navigation Buttons */}
          <NavigationButtons
            onPrevious={onPrevious}
            onNext={onNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            isLoading={status === 'loading'}
          />

          {/* Supporting Resources Panel - Mobile (below content) */}
          {hasResources && (
            <div className="lg:hidden mt-6">
              <SupportingResourcesPanel
                resources={supportingResources}
                defaultOpen={false}
              />
            </div>
          )}
        </SplitPanelContent>
      </div>

      {/* Supporting Resources Drawer - Desktop, extends to viewport edge */}
      {hasResources && (
        <SupportingResourcesDrawer
          resources={supportingResources}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          className="hidden lg:block"
        />
      )}
    </div>
  );
}

/**
 * Empty state component - shown when no question is selected.
 */
export function WalkthroughEmptyState() {
  return (
    <SplitPanelContent maxWidth="4xl">
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Select a Question
        </h2>
        <p className="text-gray-500 max-w-md">
          Choose a question from the sidebar to view the examiner-aligned
          walkthrough with step-by-step solutions.
        </p>
      </div>
    </SplitPanelContent>
  );
}

/**
 * Loading state component.
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
      <p className="text-gray-600">Loading walkthrough...</p>
    </div>
  );
}

/**
 * Error state component.
 */
function ErrorState({ message }: { message?: string }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="py-12">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Error Loading Walkthrough
          </h2>
          <p className="text-red-600 max-w-md mx-auto">
            {message || 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Not generated state component.
 */
function NotGeneratedState({ questionNumber }: { questionNumber: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="py-12">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-amber-600" />
          <h2 className="text-xl font-semibold text-amber-800">
            Walkthrough Coming Soon
          </h2>
          <p className="text-amber-700 mt-2 max-w-md mx-auto">
            The examiner-aligned walkthrough for Question {questionNumber} is
            being prepared. Check back soon!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Navigation buttons component.
 */
interface NavigationButtonsProps {
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading?: boolean;
}

function NavigationButtons({
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  isLoading,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={!hasPrevious || isLoading}
        className={cn(
          'gap-2',
          !hasPrevious && 'invisible' // Keep layout but hide button
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      <Button
        variant="outline"
        onClick={onNext}
        disabled={!hasNext || isLoading}
        className={cn(
          'gap-2',
          !hasNext && 'invisible' // Keep layout but hide button
        )}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default WalkthroughContent;
