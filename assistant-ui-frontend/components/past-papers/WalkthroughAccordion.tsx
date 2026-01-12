'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Lightbulb,
  Image as ImageIcon
} from 'lucide-react';

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

/**
 * Normalize LaTeX delimiters for remark-math compatibility.
 *
 * Converts:
 * - \( ... \) → $...$  (inline math)
 * - \[ ... \] → $$...$$ (display math)
 *
 * remark-math only supports $...$ and $$...$$ by default.
 */
function normalizeLatexDelimiters(text: string): string {
  if (!text) return text;

  return text
    // Convert \( ... \) to $...$
    .replace(/\\\(\s*/g, '$')
    .replace(/\s*\\\)/g, '$')
    // Convert \[ ... \] to $$...$$
    .replace(/\\\[\s*/g, '$$')
    .replace(/\s*\\\]/g, '$$');
}

/**
 * Construct Appwrite storage URL from file_id
 *
 * The file_url stored in the database may have incorrect file IDs (using content hash).
 * This function constructs the correct URL using the file_id field.
 */
function getAppwriteDiagramUrl(diagram: Diagram): string | null {
  // Prefer file_id over file_url since file_url may have incorrect IDs
  if (diagram.file_id) {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const bucketId = 'us_diagrams'; // Diagrams bucket

    if (!projectId) {
      console.error('NEXT_PUBLIC_APPWRITE_PROJECT_ID not configured');
      return null;
    }

    return `${endpoint}/storage/buckets/${bucketId}/files/${diagram.file_id}/view?project=${projectId}`;
  }

  // Fallback to file_url if file_id is not available
  return diagram.file_url || null;
}

interface WalkthroughContent {
  question_stem: string;
  question_stem_latex: string;
  topic_tags: string[];
  total_marks: number;
  steps: WalkthroughStep[];
  common_errors: CommonError[];
  examiner_summary: string;
  diagram_refs: string[];
}

interface WalkthroughAccordionProps {
  walkthrough: WalkthroughContent;
  diagrams?: Diagram[];
}

/**
 * WalkthroughAccordion - Display examiner-aligned walkthrough with expanding steps
 *
 * Key features:
 * - Question stem with LaTeX rendering (blue card)
 * - Expandable steps with bullet labels and marks
 * - Common errors panel (red theme)
 * - Examiner summary callout (amber theme)
 */
export function WalkthroughAccordion({ walkthrough, diagrams }: WalkthroughAccordionProps) {
  const [openSteps, setOpenSteps] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      {/* Question Stem - Blue Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Question
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer
              content={walkthrough.question_stem_latex || walkthrough.question_stem}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {walkthrough.topic_tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-blue-100 text-blue-800">
                {tag}
              </Badge>
            ))}
            <Badge className="bg-blue-600 text-white">
              {walkthrough.total_marks} mark{walkthrough.total_marks !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Diagrams Panel - Purple Theme */}
      {diagrams && diagrams.length > 0 && (
        <DiagramPanel diagrams={diagrams} />
      )}

      {/* Steps Accordion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Solution Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion
            type="multiple"
            value={openSteps}
            onValueChange={setOpenSteps}
            className="w-full"
          >
            {walkthrough.steps.map((step) => (
              <AccordionItem
                key={step.bullet}
                value={`step-${step.bullet}`}
                className="border rounded-lg mb-2 last:mb-0"
              >
                <AccordionTrigger className="px-4 hover:no-underline hover:bg-gray-50">
                  <div className="flex items-center gap-3 text-left">
                    <Badge
                      variant="outline"
                      className="font-mono text-sm px-2 py-0.5 bg-gray-100"
                    >
                      •{step.bullet}
                    </Badge>
                    <span className="font-medium text-gray-900">{step.label}</span>
                    <Badge className="ml-auto bg-green-100 text-green-800 hover:bg-green-100">
                      {step.marks_earned} mark{step.marks_earned !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <WalkthroughStep step={step} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Common Errors Panel - Red Theme */}
      {walkthrough.common_errors.length > 0 && (
        <CommonErrorsPanel errors={walkthrough.common_errors} />
      )}

      {/* Examiner Summary - Amber Callout */}
      {walkthrough.examiner_summary && (
        <ExaminerNotesCallout notes={walkthrough.examiner_summary} />
      )}
    </div>
  );
}

/**
 * WalkthroughStep - Individual step content
 */
function WalkthroughStep({ step }: { step: WalkthroughStep }) {
  // Prepare the working content for rendering
  // If it already contains $ delimiters, use as-is; otherwise wrap pure math in $...$
  const workingContent = (() => {
    const latex = step.working_latex || step.working;
    if (!latex) return '';

    // Normalize any \( \) delimiters to $ $
    const normalized = normalizeLatexDelimiters(latex);

    // If it already has $ delimiters, use as-is
    if (normalized.includes('$')) {
      return normalized;
    }

    // Otherwise, wrap in $ for math rendering
    return `$${normalized}$`;
  })();

  return (
    <div className="space-y-3 pt-2">
      {/* Process Description */}
      <div className="flex items-start gap-2">
        <span className="text-sm font-medium text-gray-600 min-w-[80px]">Process:</span>
        <span className="text-gray-900">{step.process}</span>
      </div>

      {/* Working/Answer */}
      <div className="flex items-start gap-2">
        <span className="text-sm font-medium text-gray-600 min-w-[80px]">Working:</span>
        <div className="flex-1 bg-gray-50 rounded-lg p-3 border">
          <MarkdownRenderer content={workingContent} />
        </div>
      </div>

      {/* Examiner Notes */}
      {step.examiner_notes && (
        <div className="flex items-start gap-2 mt-2">
          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2 flex-1">
            <strong>Examiner tip:</strong>{' '}
            <MarkdownRenderer
              content={normalizeLatexDelimiters(step.examiner_notes)}
              className="inline prose-p:inline prose-p:mb-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DiagramPanel - Purple-themed panel showing question diagrams
 * Renders images from Appwrite storage with descriptions
 */
function DiagramPanel({ diagrams }: { diagrams: Diagram[] }) {
  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-purple-800 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Question Diagram{diagrams.length > 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {diagrams.map((diagram) => {
          // Construct URL from file_id (more reliable than stored file_url)
          const imageUrl = getAppwriteDiagramUrl(diagram);

          return (
            <div
              key={diagram.id}
              className="bg-white rounded-lg p-4 border border-purple-100"
            >
              {imageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={diagram.description || 'Question diagram'}
                    className="max-w-full mx-auto rounded-lg shadow-sm"
                    loading="lazy"
                  />
                  {diagram.description && (
                    <p className="text-sm text-purple-700 text-center italic">
                      {diagram.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-purple-600">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {diagram.description || 'Diagram unavailable'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * CommonErrorsPanel - Red-themed panel showing common mistakes
 */
function CommonErrorsPanel({ errors }: { errors: CommonError[] }) {
  // Icon map for error types
  const errorIcons: Record<CommonError['error_type'], typeof AlertTriangle> = {
    notation: AlertTriangle,
    calculation: XCircle,
    concept: Info,
    omission: AlertTriangle,
  };

  // Color map for error types
  const errorColors: Record<CommonError['error_type'], string> = {
    notation: 'bg-orange-100 text-orange-800',
    calculation: 'bg-red-100 text-red-800',
    concept: 'bg-purple-100 text-purple-800',
    omission: 'bg-amber-100 text-amber-800',
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-red-800 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          Common Errors to Avoid
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors.map((error, idx) => {
          const Icon = errorIcons[error.error_type] || AlertTriangle;

          return (
            <div
              key={idx}
              className="p-4 bg-white rounded-lg border border-red-100 space-y-2"
            >
              {/* Error Type Badge */}
              <Badge className={errorColors[error.error_type]}>
                <Icon className="h-3 w-3 mr-1" />
                {error.error_type.charAt(0).toUpperCase() + error.error_type.slice(1)}
              </Badge>

              {/* Error Description - supports LaTeX */}
              <div className="font-medium text-red-800">
                <MarkdownRenderer
                  content={normalizeLatexDelimiters(error.description)}
                  className="prose-p:mb-0 prose-p:leading-normal"
                />
              </div>

              {/* Marks Lost - supports LaTeX */}
              <div className="text-sm text-red-600">
                <strong>Marks lost:</strong>{' '}
                <MarkdownRenderer
                  content={normalizeLatexDelimiters(error.why_marks_lost)}
                  className="inline prose-p:inline prose-p:mb-0"
                />
              </div>

              {/* Prevention Tip - supports LaTeX */}
              <div className="flex items-start gap-2 pt-1">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-700">
                  <strong>Prevention:</strong>{' '}
                  <MarkdownRenderer
                    content={normalizeLatexDelimiters(error.prevention_tip)}
                    className="inline prose-p:inline prose-p:mb-0"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * ExaminerNotesCallout - Amber-themed callout for examiner summary
 */
function ExaminerNotesCallout({ notes }: { notes: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 mb-1">Examiner Summary</p>
            <p className="text-amber-700 text-sm">{notes}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { DiagramPanel, CommonErrorsPanel, ExaminerNotesCallout };
