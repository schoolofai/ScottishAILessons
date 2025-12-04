'use client';

/**
 * SOW Entry Editor Component
 *
 * Provides a collapsible accordion interface for editing individual SOW entries.
 * Each entry represents a lesson in the scheme of work.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type {
  SOWEntry,
  LessonType,
  CalculatorSection,
  CEFRLevel,
  StandardOrSkillRef,
} from '@/lib/appwrite/types/sow-schema';
import {
  LESSON_TYPE_OPTIONS,
  CALCULATOR_SECTION_OPTIONS,
  CEFR_LEVEL_OPTIONS,
  createEmptyCard,
} from '@/lib/appwrite/types/sow-schema';
import { SOWCardEditor } from './SOWCardEditor';

interface SOWEntryEditorProps {
  entry: SOWEntry;
  index: number;
  totalEntries: number;
  onChange: (entry: SOWEntry) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SOWEntryEditor({
  entry,
  index,
  totalEntries,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SOWEntryEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'cards' | 'accessibility'>('basic');

  const updateField = <K extends keyof SOWEntry>(field: K, value: SOWEntry[K]) => {
    onChange({ ...entry, [field]: value });
  };

  const updateCoherence = (field: string, value: string | string[]) => {
    onChange({
      ...entry,
      coherence: { ...entry.coherence, [field]: value },
    });
  };

  const updatePolicy = (field: string, value: string) => {
    onChange({
      ...entry,
      policy: { ...entry.policy, [field]: value },
    });
  };

  const updateAccessibility = (field: string, value: boolean | string | number | string[] | undefined) => {
    onChange({
      ...entry,
      accessibility_profile: { ...entry.accessibility_profile, [field]: value },
    });
  };

  const updateLessonPlan = (field: string, value: unknown) => {
    onChange({
      ...entry,
      lesson_plan: { ...entry.lesson_plan, [field]: value },
    });
  };

  const addCard = () => {
    const newCardNumber = entry.lesson_plan.card_structure.length + 1;
    updateLessonPlan('card_structure', [
      ...entry.lesson_plan.card_structure,
      createEmptyCard(newCardNumber),
    ]);
  };

  const addEngagementTag = () => {
    const newTag = prompt('Enter engagement tag:');
    if (newTag && newTag.trim()) {
      updateField('engagement_tags', [...entry.engagement_tags, newTag.trim()]);
    }
  };

  const removeEngagementTag = (tagIndex: number) => {
    updateField(
      'engagement_tags',
      entry.engagement_tags.filter((_, i) => i !== tagIndex)
    );
  };

  const addStandardOrSkill = () => {
    const isSkillsBased = confirm('Add a skill reference? (Cancel for assessment standard)');
    const newRef: StandardOrSkillRef = isSkillsBased
      ? { skill_name: '', description: '' }
      : { code: '', outcome: '', description: '' };
    updateField('standards_or_skills_addressed', [
      ...entry.standards_or_skills_addressed,
      newRef,
    ]);
  };

  const updateStandardOrSkill = (refIndex: number, field: string, value: string) => {
    const updated = [...entry.standards_or_skills_addressed];
    updated[refIndex] = { ...updated[refIndex], [field]: value };
    updateField('standards_or_skills_addressed', updated);
  };

  const removeStandardOrSkill = (refIndex: number) => {
    updateField(
      'standards_or_skills_addressed',
      entry.standards_or_skills_addressed.filter((_, i) => i !== refIndex)
    );
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {/* Header - Always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-gray-400">
          <GripVertical className="h-4 w-4" />
          <span className="font-mono text-sm">{entry.order}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">
              {entry.label || `Lesson ${entry.order}`}
            </span>
            <Badge variant="outline" className="capitalize text-xs">
              {(entry.lesson_type || 'teach').replace(/_/g, ' ')}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {entry.lesson_plan?.card_structure?.length || 0} cards
            </Badge>
          </div>
          {entry.coherence?.block_name && (
            <p className="text-sm text-gray-500 truncate">
              {entry.coherence.block_name} ({entry.coherence.block_index || ''})
            </p>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={index === totalEntries - 1}
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-500 hover:text-red-700"
            title="Delete entry"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t">
          {/* Tab Navigation */}
          <div className="flex border-b bg-gray-50">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'basic'
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('basic')}
            >
              Basic Info
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'cards'
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('cards')}
            >
              Cards ({entry.lesson_plan?.card_structure?.length || 0})
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'accessibility'
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('accessibility')}
            >
              Accessibility
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                {/* Core Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`label-${index}`}>Label</Label>
                    <Input
                      id={`label-${index}`}
                      value={entry.label}
                      onChange={(e) => updateField('label', e.target.value)}
                      placeholder="Enter lesson label..."
                    />
                  </div>

                  <div>
                    <Label htmlFor={`lesson-type-${index}`}>Lesson Type</Label>
                    <Select
                      value={entry.lesson_type}
                      onValueChange={(v) => updateField('lesson_type', v as LessonType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LESSON_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Coherence Fields */}
                <div className="p-3 border rounded-md bg-gray-50">
                  <h4 className="font-medium mb-3">Coherence</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`block-name-${index}`}>Block Name</Label>
                      <Input
                        id={`block-name-${index}`}
                        value={entry.coherence?.block_name || ''}
                        onChange={(e) => updateCoherence('block_name', e.target.value)}
                        placeholder="e.g., Unit 1: Forces"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`block-index-${index}`}>Block Index</Label>
                      <Input
                        id={`block-index-${index}`}
                        value={entry.coherence?.block_index || ''}
                        onChange={(e) => updateCoherence('block_index', e.target.value)}
                        placeholder="e.g., 1.1"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label>Prerequisites (comma-separated)</Label>
                    <Input
                      value={(entry.coherence?.prerequisites || []).join(', ')}
                      onChange={(e) =>
                        updateCoherence(
                          'prerequisites',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="e.g., Lesson 1, Lesson 2"
                    />
                  </div>
                </div>

                {/* Policy Fields */}
                <div className="p-3 border rounded-md bg-gray-50">
                  <h4 className="font-medium mb-3">Policy</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`calculator-${index}`}>Calculator Section</Label>
                      <Select
                        value={entry.policy?.calculator_section || 'non_calc'}
                        onValueChange={(v) => updatePolicy('calculator_section', v as CalculatorSection)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CALCULATOR_SECTION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`assessment-notes-${index}`}>Assessment Notes</Label>
                      <Input
                        id={`assessment-notes-${index}`}
                        value={entry.policy?.assessment_notes || ''}
                        onChange={(e) => updatePolicy('assessment_notes', e.target.value)}
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                </div>

                {/* Engagement Tags */}
                <div className="p-3 border rounded-md bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <Label>Engagement Tags</Label>
                    <Button variant="ghost" size="sm" onClick={addEngagementTag}>
                      <Plus className="h-3 w-3 mr-1" /> Add Tag
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(entry.engagement_tags || []).map((tag, tagIdx) => (
                      <Badge
                        key={tagIdx}
                        variant="secondary"
                        className="cursor-pointer hover:bg-red-100"
                        onClick={() => removeEngagementTag(tagIdx)}
                        title="Click to remove"
                      >
                        {tag} ×
                      </Badge>
                    ))}
                    {(!entry.engagement_tags || entry.engagement_tags.length === 0) && (
                      <span className="text-sm text-gray-400">No tags added</span>
                    )}
                  </div>
                </div>

                {/* Standards/Skills Addressed */}
                <div className="p-3 border rounded-md bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <Label>Standards/Skills Addressed</Label>
                    <Button variant="ghost" size="sm" onClick={addStandardOrSkill}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(entry.standards_or_skills_addressed || []).map((ref, refIdx) => (
                      <div key={refIdx} className="flex gap-2 items-start p-2 bg-white rounded border">
                        {ref.skill_name !== undefined ? (
                          // Skills-based
                          <>
                            <div className="flex-1">
                              <Input
                                value={ref.skill_name || ''}
                                onChange={(e) => updateStandardOrSkill(refIdx, 'skill_name', e.target.value)}
                                placeholder="Skill name..."
                                className="mb-1"
                              />
                              <Input
                                value={ref.description}
                                onChange={(e) => updateStandardOrSkill(refIdx, 'description', e.target.value)}
                                placeholder="Description..."
                              />
                            </div>
                          </>
                        ) : (
                          // Unit-based
                          <>
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <Input
                                value={ref.code || ''}
                                onChange={(e) => updateStandardOrSkill(refIdx, 'code', e.target.value)}
                                placeholder="Code (AS1.1)"
                              />
                              <Input
                                value={ref.outcome || ''}
                                onChange={(e) => updateStandardOrSkill(refIdx, 'outcome', e.target.value)}
                                placeholder="Outcome (O1)"
                              />
                              <Input
                                value={ref.description}
                                onChange={(e) => updateStandardOrSkill(refIdx, 'description', e.target.value)}
                                placeholder="Description..."
                              />
                            </div>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStandardOrSkill(refIdx)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {(!entry.standards_or_skills_addressed || entry.standards_or_skills_addressed.length === 0) && (
                      <span className="text-sm text-gray-400">No standards/skills added</span>
                    )}
                  </div>
                </div>

                {/* Lesson Instruction */}
                <div>
                  <Label htmlFor={`instruction-${index}`}>Lesson Instruction</Label>
                  <Textarea
                    id={`instruction-${index}`}
                    value={entry.lesson_instruction || ''}
                    onChange={(e) => updateField('lesson_instruction', e.target.value)}
                    placeholder="Detailed lesson instruction..."
                    rows={4}
                  />
                </div>

                {/* Lesson Plan Summary Fields */}
                <div className="p-3 border rounded-md bg-gray-50">
                  <h4 className="font-medium mb-3">Lesson Plan</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Summary</Label>
                      <Textarea
                        value={entry.lesson_plan?.summary || ''}
                        onChange={(e) => updateLessonPlan('summary', e.target.value)}
                        placeholder="Lesson summary (50-500 chars)..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Lesson Flow Summary</Label>
                      <Input
                        value={entry.lesson_plan?.lesson_flow_summary || ''}
                        onChange={(e) => updateLessonPlan('lesson_flow_summary', e.target.value)}
                        placeholder="How the lesson flows..."
                      />
                    </div>
                    <div>
                      <Label>Multi-Standard Integration Strategy</Label>
                      <Input
                        value={entry.lesson_plan?.multi_standard_integration_strategy || ''}
                        onChange={(e) => updateLessonPlan('multi_standard_integration_strategy', e.target.value)}
                        placeholder="How multiple standards are integrated..."
                      />
                    </div>
                    <div>
                      <Label>Assessment Progression</Label>
                      <Input
                        value={entry.lesson_plan?.assessment_progression || ''}
                        onChange={(e) => updateLessonPlan('assessment_progression', e.target.value)}
                        placeholder="How assessment progresses..."
                      />
                    </div>
                  </div>
                </div>

                {/* Estimated Minutes */}
                <div>
                  <Label htmlFor={`minutes-${index}`}>Estimated Minutes</Label>
                  <Input
                    id={`minutes-${index}`}
                    type="number"
                    min={1}
                    value={entry.estMinutes || ''}
                    onChange={(e) => updateField('estMinutes', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 50"
                    className="w-32"
                  />
                </div>
              </div>
            )}

            {/* Cards Tab */}
            {activeTab === 'cards' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {entry.lesson_plan?.card_structure?.length || 0} cards in this lesson
                  </p>
                  <Button variant="outline" size="sm" onClick={addCard}>
                    <Plus className="h-4 w-4 mr-2" /> Add Card
                  </Button>
                </div>

                <div className="space-y-3">
                  {(entry.lesson_plan?.card_structure || []).map((card, cardIdx) => (
                    <SOWCardEditor
                      key={cardIdx}
                      card={card}
                      index={cardIdx}
                      totalCards={entry.lesson_plan.card_structure.length}
                      onChange={(updatedCard) => {
                        const newCards = [...entry.lesson_plan.card_structure];
                        newCards[cardIdx] = updatedCard;
                        updateLessonPlan('card_structure', newCards);
                      }}
                      onDelete={() => {
                        const newCards = entry.lesson_plan.card_structure.filter((_, i) => i !== cardIdx);
                        // Re-number cards after deletion
                        const renumbered = newCards.map((c, i) => ({ ...c, card_number: i + 1 }));
                        updateLessonPlan('card_structure', renumbered);
                      }}
                      onMoveUp={() => {
                        if (cardIdx === 0) return;
                        const newCards = [...entry.lesson_plan.card_structure];
                        [newCards[cardIdx - 1], newCards[cardIdx]] = [newCards[cardIdx], newCards[cardIdx - 1]];
                        const renumbered = newCards.map((c, i) => ({ ...c, card_number: i + 1 }));
                        updateLessonPlan('card_structure', renumbered);
                      }}
                      onMoveDown={() => {
                        if (cardIdx === entry.lesson_plan.card_structure.length - 1) return;
                        const newCards = [...entry.lesson_plan.card_structure];
                        [newCards[cardIdx], newCards[cardIdx + 1]] = [newCards[cardIdx + 1], newCards[cardIdx]];
                        const renumbered = newCards.map((c, i) => ({ ...c, card_number: i + 1 }));
                        updateLessonPlan('card_structure', renumbered);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Accessibility Tab */}
            {activeTab === 'accessibility' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={entry.accessibility_profile?.dyslexia_friendly ?? false}
                    onCheckedChange={(checked) => updateAccessibility('dyslexia_friendly', checked)}
                  />
                  <Label>Dyslexia Friendly</Label>
                </div>

                <div>
                  <Label>Plain Language Level</Label>
                  <Select
                    value={entry.accessibility_profile?.plain_language_level || ''}
                    onValueChange={(v) => updateAccessibility('plain_language_level', v as CEFRLevel || undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {CEFR_LEVEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={entry.accessibility_profile?.extra_time ?? false}
                    onCheckedChange={(checked) => updateAccessibility('extra_time', checked)}
                  />
                  <Label>Extra Time Allowed</Label>
                </div>

                {entry.accessibility_profile?.extra_time && (
                  <div>
                    <Label>Extra Time Percentage</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={entry.accessibility_profile?.extra_time_percentage || ''}
                      onChange={(e) => updateAccessibility('extra_time_percentage', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="e.g., 25"
                      className="w-32"
                    />
                  </div>
                )}

                <div>
                  <Label>Visual Support Strategy</Label>
                  <Textarea
                    value={entry.accessibility_profile?.visual_support_strategy || ''}
                    onChange={(e) => updateAccessibility('visual_support_strategy', e.target.value || undefined)}
                    placeholder="Describe visual support strategies..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Key Terms Simplified (comma-separated)</Label>
                  <Input
                    value={(entry.accessibility_profile?.key_terms_simplified || []).join(', ')}
                    onChange={(e) =>
                      updateAccessibility(
                        'key_terms_simplified',
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="e.g., velocity, acceleration"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
