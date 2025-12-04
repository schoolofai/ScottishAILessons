'use client';

/**
 * SOW Card Editor Component
 *
 * Provides editing interface for individual cards within a lesson plan.
 * Cards are the atomic units of lesson content.
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
import type {
  SOWCard,
  CardType,
  StandardOrSkillRef,
  MisconceptionAddressed,
  RubricCriterion,
} from '@/lib/appwrite/types/sow-schema';
import { CARD_TYPE_OPTIONS } from '@/lib/appwrite/types/sow-schema';

interface SOWCardEditorProps {
  card: SOWCard;
  index: number;
  totalCards: number;
  onChange: (card: SOWCard) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SOWCardEditor({
  card,
  index,
  totalCards,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SOWCardEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = <K extends keyof SOWCard>(field: K, value: SOWCard[K]) => {
    onChange({ ...card, [field]: value });
  };

  // Key concepts handlers
  const addKeyConcept = () => {
    const concept = prompt('Enter key concept:');
    if (concept && concept.trim()) {
      updateField('key_concepts', [...(card.key_concepts || []), concept.trim()]);
    }
  };

  const removeKeyConcept = (conceptIdx: number) => {
    updateField(
      'key_concepts',
      (card.key_concepts || []).filter((_, i) => i !== conceptIdx)
    );
  };

  // Practice problems handlers
  const addPracticeProblem = () => {
    const problem = prompt('Enter practice problem:');
    if (problem && problem.trim()) {
      updateField('practice_problems', [...(card.practice_problems || []), problem.trim()]);
    }
  };

  const updatePracticeProblem = (problemIdx: number, value: string) => {
    const updated = [...(card.practice_problems || [])];
    updated[problemIdx] = value;
    updateField('practice_problems', updated);
  };

  const removePracticeProblem = (problemIdx: number) => {
    updateField(
      'practice_problems',
      (card.practice_problems || []).filter((_, i) => i !== problemIdx)
    );
  };

  // Misconceptions handlers
  const addMisconception = () => {
    const newMisc: MisconceptionAddressed = { misconception: '', remediation: '' };
    updateField('misconceptions_addressed', [...(card.misconceptions_addressed || []), newMisc]);
  };

  const updateMisconception = (miscIdx: number, field: keyof MisconceptionAddressed, value: string) => {
    const updated = [...(card.misconceptions_addressed || [])];
    updated[miscIdx] = { ...updated[miscIdx], [field]: value };
    updateField('misconceptions_addressed', updated);
  };

  const removeMisconception = (miscIdx: number) => {
    updateField(
      'misconceptions_addressed',
      (card.misconceptions_addressed || []).filter((_, i) => i !== miscIdx)
    );
  };

  // Standards handlers
  const addStandard = () => {
    const isSkillsBased = confirm('Add a skill reference? (Cancel for assessment standard)');
    const newRef: StandardOrSkillRef = isSkillsBased
      ? { skill_name: '', description: '' }
      : { code: '', outcome: '', description: '' };
    updateField('standards_addressed', [...card.standards_addressed, newRef]);
  };

  const updateStandard = (refIdx: number, field: string, value: string) => {
    const updated = [...card.standards_addressed];
    updated[refIdx] = { ...updated[refIdx], [field]: value };
    updateField('standards_addressed', updated);
  };

  const removeStandard = (refIdx: number) => {
    updateField(
      'standards_addressed',
      card.standards_addressed.filter((_, i) => i !== refIdx)
    );
  };

  // Rubric handlers
  const initRubric = () => {
    updateField('rubric_guidance', {
      total_points: 1,
      criteria: [{ description: '', points: 1 }],
    });
  };

  const addRubricCriterion = () => {
    if (!card.rubric_guidance) return;
    const newCriterion: RubricCriterion = { description: '', points: 1 };
    updateField('rubric_guidance', {
      ...card.rubric_guidance,
      criteria: [...card.rubric_guidance.criteria, newCriterion],
    });
  };

  const updateRubricCriterion = (critIdx: number, field: keyof RubricCriterion, value: string | number) => {
    if (!card.rubric_guidance) return;
    const updated = [...card.rubric_guidance.criteria];
    updated[critIdx] = { ...updated[critIdx], [field]: value };
    // Recalculate total points
    const total = updated.reduce((sum, c) => sum + c.points, 0);
    updateField('rubric_guidance', {
      total_points: total,
      criteria: updated,
    });
  };

  const removeRubricCriterion = (critIdx: number) => {
    if (!card.rubric_guidance) return;
    const updated = card.rubric_guidance.criteria.filter((_, i) => i !== critIdx);
    const total = updated.reduce((sum, c) => sum + c.points, 0);
    updateField('rubric_guidance', {
      total_points: total,
      criteria: updated,
    });
  };

  const cardTypeLabel = CARD_TYPE_OPTIONS.find((o) => o.value === card.card_type)?.label || card.card_type;

  return (
    <div className="border rounded-md bg-gray-50">
      {/* Header */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="font-mono text-sm text-gray-500">{card.card_number}</span>

        <Badge variant="outline" className="text-xs">
          {cardTypeLabel}
        </Badge>

        <span className="flex-1 truncate text-sm font-medium">
          {card.title || 'Untitled Card'}
        </span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={onMoveUp} disabled={index === 0}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onMoveDown} disabled={index === totalCards - 1}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t p-4 bg-white space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input
                value={card.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Card title..."
              />
            </div>
            <div>
              <Label>Card Type</Label>
              <Select
                value={card.card_type}
                onValueChange={(v) => updateField('card_type', v as CardType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Purpose</Label>
            <Textarea
              value={card.purpose}
              onChange={(e) => updateField('purpose', e.target.value)}
              placeholder="What is the purpose of this card?"
              rows={2}
            />
          </div>

          <div>
            <Label>Pedagogical Approach</Label>
            <Textarea
              value={card.pedagogical_approach}
              onChange={(e) => updateField('pedagogical_approach', e.target.value)}
              placeholder="Describe the pedagogical approach..."
              rows={2}
            />
          </div>

          <div>
            <Label>CFU Strategy</Label>
            <Input
              value={card.cfu_strategy}
              onChange={(e) => updateField('cfu_strategy', e.target.value)}
              placeholder="Check for understanding strategy..."
            />
          </div>

          {/* Key Concepts */}
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <Label>Key Concepts</Label>
              <Button variant="ghost" size="sm" onClick={addKeyConcept}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(card.key_concepts || []).map((concept, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="cursor-pointer hover:bg-red-100"
                  onClick={() => removeKeyConcept(idx)}
                >
                  {concept} ×
                </Badge>
              ))}
              {(!card.key_concepts || card.key_concepts.length === 0) && (
                <span className="text-sm text-gray-400">No key concepts</span>
              )}
            </div>
          </div>

          {/* Worked Example */}
          <div>
            <Label>Worked Example (optional)</Label>
            <Textarea
              value={card.worked_example || ''}
              onChange={(e) => updateField('worked_example', e.target.value || undefined)}
              placeholder="Provide a worked example..."
              rows={3}
            />
          </div>

          {/* Practice Problems */}
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <Label>Practice Problems</Label>
              <Button variant="ghost" size="sm" onClick={addPracticeProblem}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {(card.practice_problems || []).map((problem, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={problem}
                    onChange={(e) => updatePracticeProblem(idx, e.target.value)}
                    placeholder="Practice problem..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePracticeProblem(idx)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {(!card.practice_problems || card.practice_problems.length === 0) && (
                <span className="text-sm text-gray-400">No practice problems</span>
              )}
            </div>
          </div>

          {/* Standards Addressed */}
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <Label>Standards Addressed</Label>
              <Button variant="ghost" size="sm" onClick={addStandard}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {card.standards_addressed.map((ref, idx) => (
                <div key={idx} className="flex gap-2 items-start p-2 bg-white rounded border">
                  {ref.skill_name !== undefined ? (
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={ref.skill_name || ''}
                        onChange={(e) => updateStandard(idx, 'skill_name', e.target.value)}
                        placeholder="Skill name"
                      />
                      <Input
                        value={ref.description}
                        onChange={(e) => updateStandard(idx, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <Input
                        value={ref.code || ''}
                        onChange={(e) => updateStandard(idx, 'code', e.target.value)}
                        placeholder="Code"
                      />
                      <Input
                        value={ref.outcome || ''}
                        onChange={(e) => updateStandard(idx, 'outcome', e.target.value)}
                        placeholder="Outcome"
                      />
                      <Input
                        value={ref.description}
                        onChange={(e) => updateStandard(idx, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStandard(idx)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {card.standards_addressed.length === 0 && (
                <span className="text-sm text-gray-400">No standards</span>
              )}
            </div>
          </div>

          {/* Misconceptions */}
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <Label>Misconceptions Addressed</Label>
              <Button variant="ghost" size="sm" onClick={addMisconception}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {(card.misconceptions_addressed || []).map((misc, idx) => (
                <div key={idx} className="p-2 bg-white rounded border space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={misc.misconception}
                        onChange={(e) => updateMisconception(idx, 'misconception', e.target.value)}
                        placeholder="Misconception..."
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMisconception(idx)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={misc.remediation}
                    onChange={(e) => updateMisconception(idx, 'remediation', e.target.value)}
                    placeholder="Remediation strategy..."
                  />
                </div>
              ))}
              {(!card.misconceptions_addressed || card.misconceptions_addressed.length === 0) && (
                <span className="text-sm text-gray-400">No misconceptions</span>
              )}
            </div>
          </div>

          {/* Rubric Guidance */}
          <div className="p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <Label>Rubric Guidance</Label>
              {!card.rubric_guidance ? (
                <Button variant="ghost" size="sm" onClick={initRubric}>
                  <Plus className="h-3 w-3 mr-1" /> Add Rubric
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={addRubricCriterion}>
                  <Plus className="h-3 w-3 mr-1" /> Add Criterion
                </Button>
              )}
            </div>
            {card.rubric_guidance ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Total Points:</span>
                  <Badge>{card.rubric_guidance.total_points}</Badge>
                </div>
                {card.rubric_guidance.criteria.map((crit, idx) => (
                  <div key={idx} className="flex gap-2 items-center p-2 bg-white rounded border">
                    <Input
                      value={crit.description}
                      onChange={(e) => updateRubricCriterion(idx, 'description', e.target.value)}
                      placeholder="Criterion description..."
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={crit.points}
                      onChange={(e) => updateRubricCriterion(idx, 'points', parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">pts</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRubricCriterion(idx)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400">No rubric defined</span>
            )}
          </div>

          {/* Estimated Minutes */}
          <div>
            <Label>Estimated Minutes (optional)</Label>
            <Input
              type="number"
              min={1}
              value={card.estimated_minutes || ''}
              onChange={(e) => updateField('estimated_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 10"
              className="w-32"
            />
          </div>
        </div>
      )}
    </div>
  );
}
