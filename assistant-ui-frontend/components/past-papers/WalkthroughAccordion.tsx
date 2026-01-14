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
  Image as ImageIcon,
  // V2 Schema icons
  BookOpen,       // Concept explanation
  Sparkles,       // Peer tip
  GraduationCap,  // Prerequisites
  ExternalLink,   // Open course link
  HelpCircle,     // Learning gap
  ChevronDown
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface WalkthroughStep {
  bullet: number;
  label: string;
  process: string;
  working: string;
  working_latex: string;
  marks_earned: number;
  examiner_notes?: string;
  // V2 Schema - Pedagogical fields
  concept_explanation?: string;  // WHY this step works mathematically
  peer_tip?: string;             // Casual student-friendly advice
  student_warning?: string;      // Exam-specific warning (ALWAYS VISIBLE)
}

interface CommonError {
  error_type: 'notation' | 'calculation' | 'concept' | 'omission';
  description: string;
  why_marks_lost: string;
  prevention_tip: string;
  // V2 Schema - Pedagogical fields
  learning_gap?: string;         // WHY students make this error
  related_topics?: string[];     // Topic tags for remediation
}

// V2 Schema - Prerequisite links for course navigation
interface PrerequisiteLink {
  topic_tag: string;
  reminder_text: string;
  lesson_refs: {
    lesson_template_id: string;
    label: string;
    sow_order: number;
  }[];
  course_fallback?: string;
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
  // V2 Schema - Prerequisite topic reminders
  prerequisite_links?: PrerequisiteLink[];
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

      {/* V2: Prerequisites Panel - Teal Theme */}
      {walkthrough.prerequisite_links && walkthrough.prerequisite_links.length > 0 && (
        <PrerequisitePanel prerequisites={walkthrough.prerequisite_links} />
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
                className="border rounded-lg mb-2 last:mb-0 [&:last-child]:border-b"
              >
                <AccordionTrigger className="px-4 hover:no-underline hover:bg-gray-50">
                  <div className="flex items-center gap-3 text-left">
                    <Badge
                      variant="outline"
                      className="font-mono text-sm px-2 py-0.5 bg-gray-100"
                    >
                      •{step.bullet}
                    </Badge>
                    <span className="font-medium text-gray-900">
                      {step.label.replace(/^•\d+\s*:?\s*/, '')}
                    </span>
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

      {/* Examiner Summary - Amber Callout (moved after Solution Steps) */}
      {walkthrough.examiner_summary && (
        <ExaminerNotesCallout notes={walkthrough.examiner_summary} />
      )}

      {/* Common Errors Panel - Violet Theme */}
      {walkthrough.common_errors.length > 0 && (
        <CommonErrorsPanel errors={walkthrough.common_errors} />
      )}
    </div>
  );
}

/**
 * PrerequisitePanel - V2 Schema component
 * Teal-themed panel showing prerequisite topics with course navigation
 * Collapsible but expanded by default to encourage pre-learning
 * Mobile: Full-width buttons, stacked layout
 */
function PrerequisitePanel({ prerequisites }: { prerequisites: PrerequisiteLink[] }) {
  // TEMPORARILY HIDDEN - Remove this line to re-enable "Before You Start" section
  return null;

  const [isOpen, setIsOpen] = useState(true);  // Expanded by default

  if (!prerequisites || prerequisites.length === 0) return null;

  const handleOpenCourse = (courseUrl?: string) => {
    if (courseUrl) {
      window.open(courseUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className="border-teal-200 bg-teal-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
              <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Before You Start
              </CardTitle>
              <ChevronDown
                className={`h-5 w-5 text-teal-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent className="animate-fade-in">
          <CardContent className="space-y-3 pt-0">
            {prerequisites.map((prereq, idx) => (
              <div
                key={idx}
                className="p-4 bg-white rounded-lg border border-teal-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div className="flex-1">
                  <Badge
                    variant="outline"
                    className="mb-2 bg-teal-100 text-teal-800 border-teal-200"
                  >
                    {prereq.topic_tag}
                  </Badge>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--wizard-text)', fontFamily: 'var(--font-body)' }}
                  >
                    {prereq.reminder_text}
                  </p>
                </div>
                {prereq.course_fallback && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto min-h-[44px] border-teal-300 text-teal-700 hover:bg-teal-100 hover:text-teal-800"
                    onClick={() => handleOpenCourse(prereq.course_fallback)}
                  >
                    <span className="flex items-center gap-2">
                      Open Course
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * ScoringInsightAlert - V2 Schema component
 * Soft cautionary style for "How to Score the Mark" AI coaching
 * Uses Sparkles icon and soft rose palette for approachable guidance
 * Design tokens: --scoring-insight-*
 */
function ScoringInsightAlert({ warning }: { warning: string }) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-lg border animate-fade-in"
      style={{
        backgroundColor: 'var(--scoring-insight-bg)',
        borderColor: 'var(--scoring-insight-border)',
      }}
    >
      <Sparkles
        className="h-5 w-5 flex-shrink-0 mt-0.5"
        style={{ color: 'var(--scoring-insight-accent)' }}
      />
      <div className="flex-1">
        <p
          className="font-semibold text-sm mb-1"
          style={{
            color: 'var(--scoring-insight-text)',
            fontFamily: 'var(--font-display)'
          }}
        >
          How to Score the Mark
        </p>
        <div
          className="text-sm"
          style={{
            color: 'var(--wizard-text-secondary)',
            fontFamily: 'var(--font-body)'
          }}
        >
          <MarkdownRenderer
            content={normalizeLatexDelimiters(warning)}
            className="prose-p:mb-0"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * StepPedagogicalContent - V2 Schema component
 * Collapsible section containing concept explanation and peer tip
 * Progressive disclosure with icon + text button (44px touch target for mobile)
 */
function StepPedagogicalContent({
  conceptExplanation,
  peerTip
}: {
  conceptExplanation?: string;
  peerTip?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if neither field is present
  if (!conceptExplanation && !peerTip) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mt-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full min-h-[44px] justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-200"
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--wizard-text-secondary)' }}>
            <BookOpen className="h-4 w-4" style={{ color: 'var(--wizard-blue)' }} />
            Learn more about this step
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--wizard-text-muted)' }}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="animate-fade-in">
        <div className="space-y-3 pt-3">
          {/* Concept Explanation - Blue theme */}
          {conceptExplanation && (
            <div
              className="p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: 'var(--color-info-bg)',
                borderLeftColor: 'var(--wizard-blue)'
              }}
            >
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--wizard-blue)' }} />
                <div className="flex-1">
                  <p
                    className="font-semibold text-sm mb-2"
                    style={{ color: 'var(--wizard-blue-dark)', fontFamily: 'var(--font-display)' }}
                  >
                    💡 Why does this work?
                  </p>
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--wizard-text)', fontFamily: 'var(--font-body)' }}
                  >
                    <MarkdownRenderer
                      content={normalizeLatexDelimiters(conceptExplanation)}
                      className="prose-p:mb-2 prose-p:last:mb-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Peer Tip - Purple theme (N5 level color) */}
          {peerTip && (
            <div
              className="p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: 'var(--level-n5-bg)',
                borderLeftColor: 'var(--level-n5)'
              }}
            >
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--level-n5)' }} />
                <div className="flex-1">
                  <p
                    className="font-semibold text-sm mb-2"
                    style={{ color: 'var(--level-n5-dark)', fontFamily: 'var(--font-display)' }}
                  >
                    ✨ Student tip
                  </p>
                  <div
                    className="text-sm leading-relaxed italic"
                    style={{ color: 'var(--wizard-text)', fontFamily: 'var(--font-body)' }}
                  >
                    <MarkdownRenderer
                      content={normalizeLatexDelimiters(peerTip)}
                      className="prose-p:mb-2 prose-p:last:mb-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * WalkthroughStep - Individual step content
 * Enhanced with V2 schema fields: student_warning, concept_explanation, peer_tip
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

      {/* V2: Scoring Insight - AI coaching for how to score marks */}
      {step.student_warning && (
        <ScoringInsightAlert warning={step.student_warning} />
      )}

      {/* REMOVED: examiner_notes display - not student-facing (V1 legacy data) */}

      {/* V2: Collapsible Pedagogical Content */}
      <StepPedagogicalContent
        conceptExplanation={step.concept_explanation}
        peerTip={step.peer_tip}
      />
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
 * LearningGapSection - V2 Schema component
 * Collapsible section explaining WHY students make this error
 * Helps students understand the underlying misconception
 */
function LearningGapSection({ learningGap }: { learningGap: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mt-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full min-h-[44px] justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-200"
          size="sm"
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--wizard-text-secondary)' }}>
            <HelpCircle className="h-4 w-4" style={{ color: 'var(--wizard-text-muted)' }} />
            Why do students make this mistake?
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--wizard-text-muted)' }}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="animate-fade-in">
        <div
          className="p-4 mt-2 rounded-lg"
          style={{
            backgroundColor: 'var(--wizard-bg-secondary)',
            fontFamily: 'var(--font-body)'
          }}
        >
          <div
            className="text-sm leading-relaxed"
            style={{ color: 'var(--wizard-text-secondary)' }}
          >
            <MarkdownRenderer
              content={normalizeLatexDelimiters(learningGap)}
              className="prose-p:mb-2 prose-p:last:mb-0"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * RelatedTopicsRow - V2 Schema component
 * Clickable topic chips for remediation navigation
 * Future: Could link to search/lesson pages
 */
function RelatedTopicsRow({ topics }: { topics: string[] }) {
  if (!topics || topics.length === 0) return null;

  const handleTopicClick = (topic: string) => {
    // Future: Navigate to topic search or lesson page
    // For now, just log - the click handler makes it clear these are interactive
    console.log(`Topic clicked: ${topic}`);
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p
        className="text-xs font-medium mb-2"
        style={{ color: 'var(--wizard-text-muted)' }}
      >
        Related topics:
      </p>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic, idx) => (
          <Badge
            key={idx}
            variant="outline"
            className="cursor-pointer hover:bg-gray-100 hover:scale-105 transition-all duration-150 border-gray-300 text-gray-700"
            onClick={() => handleTopicClick(topic)}
          >
            {topic}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * CommonErrorsPanel - Soft violet-themed panel showing common mistakes
 * Enhanced with V2 schema fields: learning_gap, related_topics
 * Uses AI coaching framing to feel helpful rather than punitive
 */
function CommonErrorsPanel({ errors }: { errors: CommonError[] }) {
  // Icon map for error types
  const errorIcons: Record<CommonError['error_type'], typeof AlertTriangle> = {
    notation: AlertTriangle,
    calculation: AlertTriangle,
    concept: Info,
    omission: AlertTriangle,
  };

  // Color map for error types - softer palette
  const errorColors: Record<CommonError['error_type'], string> = {
    notation: 'bg-orange-100 text-orange-800',
    calculation: 'bg-rose-100 text-rose-800',
    concept: 'bg-purple-100 text-purple-800',
    omission: 'bg-amber-100 text-amber-800',
  };

  return (
    <Card className="border-violet-200 bg-violet-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-violet-800 flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          How to Avoid Common Mistakes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors.map((error, idx) => {
          const Icon = errorIcons[error.error_type] || AlertTriangle;

          return (
            <div
              key={idx}
              className="p-4 bg-white rounded-lg border border-violet-100 space-y-2"
            >
              {/* Error Type Badge */}
              <Badge className={errorColors[error.error_type]}>
                <Icon className="h-3 w-3 mr-1" />
                {error.error_type.charAt(0).toUpperCase() + error.error_type.slice(1)}
              </Badge>

              {/* Error Description - supports LaTeX */}
              <div className="font-medium text-violet-800">
                <MarkdownRenderer
                  content={normalizeLatexDelimiters(error.description)}
                  className="prose-p:mb-0 prose-p:leading-normal"
                />
              </div>

              {/* Marks Lost - supports LaTeX */}
              <div className="text-sm text-violet-600">
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

              {/* V2: Learning Gap - Collapsible section */}
              {error.learning_gap && (
                <LearningGapSection learningGap={error.learning_gap} />
              )}

              {/* V2: Related Topics - Clickable chips */}
              {error.related_topics && error.related_topics.length > 0 && (
                <RelatedTopicsRow topics={error.related_topics} />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * ExaminerNotesCallout - Amber-themed callout for examiner marking guidance
 */
function ExaminerNotesCallout({ notes }: { notes: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 mb-1">How Examiner Will Mark This Question</p>
            <p className="text-amber-700 text-sm">{notes}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export components
export {
  DiagramPanel,
  CommonErrorsPanel,
  ExaminerNotesCallout,
  // V2 Schema component exports
  PrerequisitePanel,
  ScoringInsightAlert,
  StepPedagogicalContent,
  LearningGapSection,
  RelatedTopicsRow
};

// Export types for use in other components
export type {
  WalkthroughStep,
  CommonError,
  PrerequisiteLink,
  Diagram,
  WalkthroughContent,
  WalkthroughAccordionProps
};
