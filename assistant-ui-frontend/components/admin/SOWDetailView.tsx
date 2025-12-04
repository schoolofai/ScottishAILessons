'use client';

import { useState, useEffect } from 'react';
import { JsonViewer } from './JsonViewer';
import { MarkdownPreview } from './MarkdownPreview';
import { SOWEditor } from './SOWEditor';
import { jsonToMarkdown } from '@/lib/utils/jsonToMarkdown';
import { LessonTemplateCard } from './LessonTemplateCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Upload, Archive, Pencil } from 'lucide-react';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { toast } from 'sonner';
import type { AuthoredSOWData } from '@/lib/appwrite/types';
import type { LessonTemplate } from '@/lib/appwrite/types';
import type {
  AuthoredSOWSchema,
  SOWEntry,
  SOWMetadata,
  LessonPlan,
  SOWCard,
  Coherence,
  Policy,
  AccessibilityProfile,
} from '@/lib/appwrite/types/sow-schema';

/**
 * Convert AuthoredSOWData (from DB) to AuthoredSOWSchema (for editor).
 *
 * Handles mapping between the DB schema and the comprehensive
 * Pydantic-based schema used by the editor.
 *
 * NOTE: The actual SOW JSON has entry.lesson_plan.card_structure directly,
 * not a separate pedagogical_blocks field. We prioritize the lesson_plan structure.
 */
function convertToSOWSchema(sow: AuthoredSOWData & { $id: string }): AuthoredSOWSchema {
  // Convert entries from AuthoredSOWEntry[] to SOWEntry[]
  const convertedEntries: SOWEntry[] = sow.entries.map((entry: any) => {
    // Convert coherence - DB has 'unit' field, schema does not
    const coherence: Coherence = {
      block_name: entry.coherence?.block_name || '',
      block_index: entry.coherence?.block_index || '',
      prerequisites: entry.coherence?.prerequisites || [],
    };

    // Convert policy - map from DB structure to schema
    const policy: Policy = {
      calculator_section: (entry.policy?.calculator_section as Policy['calculator_section']) || 'non_calc',
      assessment_notes: entry.policy?.assessment_notes,
    };

    // Convert accessibility profile - support both nested and direct structures
    const accessibilityProfile: AccessibilityProfile = {
      dyslexia_friendly: entry.accessibility_profile?.dyslexia_friendly ?? false,
      plain_language_level: entry.accessibility_profile?.plain_language_level,
      extra_time: entry.accessibility_profile?.extra_time,
      extra_time_percentage: entry.accessibility_profile?.extra_time_percentage,
      key_terms_simplified: entry.accessibility_profile?.key_terms_simplified,
      visual_support_strategy: entry.accessibility_profile?.visual_support_strategy,
    };

    // PRIORITY 1: Use lesson_plan.card_structure directly if it exists (actual JSON structure)
    // PRIORITY 2: Fall back to pedagogical_blocks for legacy data
    let cardStructure: SOWCard[] = [];

    if (entry.lesson_plan?.card_structure && Array.isArray(entry.lesson_plan.card_structure)) {
      // Direct lesson_plan.card_structure - the actual format in JSON
      cardStructure = entry.lesson_plan.card_structure.map((card: any) => ({
        card_number: card.card_number || 1,
        card_type: card.card_type || 'explainer',
        title: card.title || '',
        purpose: card.purpose || '',
        standards_addressed: card.standards_addressed || [],
        pedagogical_approach: card.pedagogical_approach || '',
        key_concepts: card.key_concepts,
        worked_example: card.worked_example,
        practice_problems: card.practice_problems,
        cfu_strategy: card.cfu_strategy || '',
        misconceptions_addressed: card.misconceptions_addressed,
        rubric_guidance: card.rubric_guidance,
        estimated_minutes: card.estimated_minutes,
      }));
    } else if (entry.pedagogical_blocks && Array.isArray(entry.pedagogical_blocks)) {
      // Legacy pedagogical_blocks format
      cardStructure = entry.pedagogical_blocks.map((block: any, idx: number) => ({
        card_number: idx + 1,
        card_type: block.card_type || 'explainer',
        title: block.title || '',
        purpose: block.purpose || '',
        standards_addressed: block.standards_addressed || [],
        pedagogical_approach: block.pedagogical_approach || '',
        key_concepts: block.key_concepts,
        worked_example: block.worked_example,
        practice_problems: block.practice_problems,
        cfu_strategy: block.cfu_strategy || '',
        misconceptions_addressed: block.misconceptions_addressed,
        rubric_guidance: block.rubric_guidance,
        estimated_minutes: block.estimated_minutes,
      }));
    }

    // Build lesson plan - use existing data or defaults
    const lessonPlan: LessonPlan = {
      summary: entry.lesson_plan?.summary || '',
      card_structure: cardStructure,
      lesson_flow_summary: entry.lesson_plan?.lesson_flow_summary || '',
      multi_standard_integration_strategy: entry.lesson_plan?.multi_standard_integration_strategy || '',
      misconceptions_embedded_in_cards: entry.lesson_plan?.misconceptions_embedded_in_cards || [],
      assessment_progression: entry.lesson_plan?.assessment_progression || '',
    };

    // Convert standards_or_skills_addressed if it exists, otherwise build from outcomeRefs/assessmentStandardRefs
    let standardsOrSkills = entry.standards_or_skills_addressed || [];
    if (standardsOrSkills.length === 0 && entry.assessmentStandardRefs) {
      // Use assessmentStandardRefs which has full objects with code, description, outcome
      standardsOrSkills = entry.assessmentStandardRefs.map((ref: any) =>
        typeof ref === 'string'
          ? { code: ref, description: '', outcome: '' }
          : { code: ref.code || '', description: ref.description || '', outcome: ref.outcome || '' }
      );
    } else if (standardsOrSkills.length === 0 && entry.outcomeRefs) {
      // Fall back to outcomeRefs
      standardsOrSkills = entry.outcomeRefs.map((ref: string) => ({
        code: ref,
        description: '',
      }));
    }

    return {
      order: entry.order,
      label: entry.label,
      lesson_type: entry.lesson_type as SOWEntry['lesson_type'],
      coherence,
      policy,
      engagement_tags: entry.engagement_tags || [],
      standards_or_skills_addressed: standardsOrSkills,
      outcomeRefs: entry.outcomeRefs,
      assessmentStandardRefs: entry.assessmentStandardRefs?.map((ref: any) =>
        typeof ref === 'string'
          ? { code: ref, description: '', outcome: '' }
          : ref
      ),
      lesson_plan: lessonPlan,
      accessibility_profile: accessibilityProfile,
      estMinutes: entry.estMinutes,
      lesson_instruction: entry.lesson_instruction || entry.notes || '',
    };
  });

  // Convert metadata
  const convertedMetadata: SOWMetadata = {
    coherence: {
      policy_notes: sow.metadata.coherence?.policy_notes || [],
      sequencing_notes: sow.metadata.coherence?.sequencing_notes || [],
    },
    accessibility_notes: [],
    engagement_notes: [],
    weeks: sow.metadata.weeks,
    periods_per_week: sow.metadata.periods_per_week,
    course_name: sow.metadata.course_name,
    level: sow.metadata.level,
    total_lessons: sow.metadata.total_lessons,
    total_estimated_minutes: sow.metadata.total_estimated_minutes,
    generated_at: sow.metadata.generated_at,
    author_agent_version: sow.metadata.author_agent_version,
  };

  return {
    $id: sow.$id,
    courseId: sow.courseId,
    version: sow.version,
    status: sow.status,
    metadata: convertedMetadata,
    entries: convertedEntries,
    accessibility_notes: sow.accessibility_notes,
  };
}

interface SOWDetailViewProps {
  sowId: string;
}

/**
 * SOWDetailView displays a single SOW with JSON and markdown preview
 * Also shows associated lesson templates
 *
 * Uses server API endpoints for all operations (no client SDK)
 */
export function SOWDetailView({ sowId }: SOWDetailViewProps) {
  const [sow, setSOW] = useState<AuthoredSOWData & { $id: string } | null>(null);
  const [templates, setTemplates] = useState<LessonTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [unpublishingAll, setUnpublishingAll] = useState(false);
  const [showPublishAllConfirm, setShowPublishAllConfirm] = useState(false);
  const [showUnpublishAllConfirm, setShowUnpublishAllConfirm] = useState(false);
  const [unpublishingSOW, setUnpublishingSOW] = useState(false);
  const [showUnpublishSOWConfirm, setShowUnpublishSOWConfirm] = useState(false);

  useEffect(() => {
    fetchData();
  }, [sowId]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      console.log('[SOWDetailView] Fetching SOW and templates via server API...');

      // Fetch SOW data via server API
      const sowResponse = await fetch(`/api/admin/sows/${sowId}`, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!sowResponse.ok) {
        if (sowResponse.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }

        const errorData = await sowResponse.json().catch(() => ({ error: 'Failed to fetch SOW' }));
        throw new Error(errorData.error || 'Failed to fetch SOW');
      }

      const sowResult = await sowResponse.json();

      if (!sowResult.success) {
        throw new Error(sowResult.error || 'Failed to fetch SOW');
      }

      // Fetch templates via server API
      const templatesResponse = await fetch(`/api/admin/sows/${sowId}/templates`, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!templatesResponse.ok) {
        if (templatesResponse.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }

        const errorData = await templatesResponse.json().catch(() => ({ error: 'Failed to fetch templates' }));
        throw new Error(errorData.error || 'Failed to fetch templates');
      }

      const templatesResult = await templatesResponse.json();

      if (!templatesResult.success) {
        throw new Error(templatesResult.error || 'Failed to fetch templates');
      }

      console.log(`[SOWDetailView] ✅ Fetched SOW and ${templatesResult.templates.length} templates`);

      setSOW(sowResult.sow);
      setTemplates(templatesResult.templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load SOW details';
      setError(message);
      console.error('[SOWDetailView] Error fetching data:', err);
      // Fast fail - error logged and displayed, don't throw in React component
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishAllConfirm() {
    try {
      setPublishingAll(true);
      setError(null);

      console.log('[SOWDetailView] Publishing all templates via server API...');

      // Use server API endpoint instead of client SDK
      const response = await fetch(`/api/admin/sows/${sowId}/templates/publish-all`, {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }

        const errorData = await response.json().catch(() => ({ error: 'Failed to publish all lessons' }));
        throw new Error(errorData.error || 'Failed to publish all lessons');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to publish all lessons');
      }

      console.log('[SOWDetailView] ✅ All templates published');
      toast.success('All lessons published successfully!');
      setShowPublishAllConfirm(false);
      await fetchData(); // Refresh the list
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish all lessons';
      setError(message);
      toast.error(message);
      console.error('[SOWDetailView] Error publishing all:', err);
      throw err; // Fast fail
    } finally {
      setPublishingAll(false);
    }
  }

  async function handleUnpublishAllConfirm() {
    try {
      setUnpublishingAll(true);
      setError(null);

      console.log('[SOWDetailView] Unpublishing all templates via server API...');

      // Use server API endpoint instead of client SDK
      const response = await fetch(`/api/admin/sows/${sowId}/templates/unpublish-all`, {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }

        const errorData = await response.json().catch(() => ({ error: 'Failed to unpublish all lessons' }));
        throw new Error(errorData.error || 'Failed to unpublish all lessons');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to unpublish all lessons');
      }

      console.log('[SOWDetailView] ✅ All templates unpublished');
      toast.success('All lessons unpublished successfully!');
      setShowUnpublishAllConfirm(false);
      await fetchData(); // Refresh the list
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpublish all lessons';
      setError(message);
      toast.error(message);
      console.error('[SOWDetailView] Error unpublishing all:', err);
      throw err; // Fast fail
    } finally {
      setUnpublishingAll(false);
    }
  }

  async function handleUnpublishSOWConfirm() {
    try {
      setUnpublishingSOW(true);
      setError(null);

      console.log('[SOWDetailView] Unpublishing SOW via server API...');

      // Use server API endpoint instead of client SDK
      const response = await fetch(`/api/admin/sows/${sowId}/unpublish`, {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }

        const errorData = await response.json().catch(() => ({ error: 'Failed to unpublish SOW' }));
        throw new Error(errorData.error || 'Failed to unpublish SOW');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to unpublish SOW');
      }

      console.log('[SOWDetailView] ✅ SOW unpublished');
      toast.success('SOW unpublished successfully!');
      setShowUnpublishSOWConfirm(false);
      await fetchData(); // Refresh to update status
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpublish SOW';
      setError(message);
      toast.error(message);
      console.error('[SOWDetailView] Error unpublishing SOW:', err);
      throw err; // Fast fail
    } finally {
      setUnpublishingSOW(false);
    }
  }

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading SOW</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!sow) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">SOW not found</p>
      </div>
    );
  }

  const sowMarkdown = jsonToMarkdown(sow);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">{sow.metadata.course_name}</h2>
          <p className="text-gray-600 mt-1">v{sow.version} | Course ID: {sow.courseId}</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex gap-2 items-center">
            <Badge variant={getStatusVariant(sow.status)} className="text-lg px-3 py-1">
              {sow.status}
            </Badge>

            {/* SOW Unpublish Button */}
            {sow.status === 'published' && (
              <Button
                onClick={() => setShowUnpublishSOWConfirm(true)}
                disabled={unpublishingSOW}
                variant="outline"
                size="sm"
              >
                <Archive className="h-4 w-4 mr-2" />
                {unpublishingSOW ? 'Unpublishing...' : 'Unpublish SOW'}
              </Button>
            )}
          </div>

          {/* Bulk Lesson Publishing Controls */}
          <div className="flex gap-2 border-l pl-3">
            <Button
              onClick={() => setShowPublishAllConfirm(true)}
              disabled={publishingAll || templates.length === 0}
              variant="secondary"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              {publishingAll ? 'Publishing All...' : 'Publish All Lessons'}
            </Button>

            <Button
              onClick={() => setShowUnpublishAllConfirm(true)}
              disabled={unpublishingAll || templates.length === 0}
              variant="outline"
              size="sm"
            >
              <Archive className="h-4 w-4 mr-2" />
              {unpublishingAll ? 'Unpublishing All...' : 'Unpublish All Lessons'}
            </Button>
          </div>
        </div>
      </div>

      {/* SOW Metadata Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-600">Lessons</p>
          <p className="text-2xl font-bold">{sow.metadata.total_lessons}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Total Duration</p>
          <p className="text-2xl font-bold">{sow.metadata.total_estimated_minutes}m</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Weeks</p>
          <p className="text-2xl font-bold">{sow.metadata.weeks || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Generated</p>
          <p className="text-sm font-medium">{sow.metadata.author_agent_version}</p>
        </div>
      </div>

      {/* SOW Tabs */}
      <div className="bg-white">
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="border-b">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="p-0 pt-6">
            <SOWEditor
              sowId={sowId}
              initialData={convertToSOWSchema(sow)}
              onSaveSuccess={fetchData}
            />
          </TabsContent>

          <TabsContent value="json" className="p-0 pt-6">
            <JsonViewer data={sow} title="SOW JSON Structure" />
          </TabsContent>

          <TabsContent value="markdown" className="p-0 pt-6">
            <MarkdownPreview markdown={sowMarkdown} title="SOW Markdown Preview" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Associated Lesson Templates */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">
            Associated Lesson Templates ({templates.length})
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            These templates are referenced in this SOW
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No lesson templates found for this SOW</div>
        ) : (
          <div className="grid gap-3">
            {templates.map(template => (
              <LessonTemplateCard
                key={template.$id}
                template={template}
                onPublish={fetchData}
                onUnpublish={fetchData}
                onDelete={fetchData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk Publish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showPublishAllConfirm}
        title="Publish All Lessons?"
        message={`This will publish all ${templates.length} lessons in this SOW and make them visible to students.`}
        confirmText="Publish All"
        cancelText="Cancel"
        variant="default"
        onConfirm={handlePublishAllConfirm}
        onCancel={() => setShowPublishAllConfirm(false)}
        icon={<Upload className="h-5 w-5 text-green-600" />}
      />

      {/* Bulk Unpublish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showUnpublishAllConfirm}
        title="Unpublish All Lessons?"
        message={`This will unpublish all published lessons in this SOW and revert them to draft status. Students will no longer see these lessons.`}
        confirmText="Unpublish All"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleUnpublishAllConfirm}
        onCancel={() => setShowUnpublishAllConfirm(false)}
        icon={<Archive className="h-5 w-5 text-amber-600" />}
      />

      {/* SOW Unpublish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showUnpublishSOWConfirm}
        title="Unpublish SOW?"
        message={`This will unpublish the entire "${sow?.metadata.course_name}" SOW and revert it to draft status. The course will no longer appear in the catalog for students.`}
        confirmText="Unpublish SOW"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleUnpublishSOWConfirm}
        onCancel={() => setShowUnpublishSOWConfirm(false)}
        icon={<Archive className="h-5 w-5 text-amber-600" />}
      />
    </div>
  );
}
