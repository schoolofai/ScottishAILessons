'use client';

/**
 * Rubric Editor Component
 * Edits rubric criteria for CFU assessment
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import type { Rubric, RubricCriterion, ValidationErrors } from '@/lib/appwrite/types';

interface RubricEditorProps {
  rubric: Rubric;
  onChange: (rubric: Rubric) => void;
  errors?: ValidationErrors;
}

export function RubricEditor({ rubric, onChange, errors = {} }: RubricEditorProps) {
  const handleAddCriterion = () => {
    const newCriterion: RubricCriterion = {
      description: '',
      points: 0
    };
    const updatedRubric = {
      ...rubric,
      criteria: [...rubric.criteria, newCriterion]
    };
    onChange(updatedRubric);
  };

  const handleRemoveCriterion = (index: number) => {
    const updatedRubric = {
      ...rubric,
      criteria: rubric.criteria.filter((_, idx) => idx !== index)
    };
    // Recalculate total points
    updatedRubric.total_points = updatedRubric.criteria.reduce(
      (sum, c) => sum + (c.points || 0),
      0
    );
    onChange(updatedRubric);
  };

  const handleCriterionChange = (
    index: number,
    field: keyof RubricCriterion,
    value: string | number
  ) => {
    const updatedCriteria = [...rubric.criteria];
    updatedCriteria[index] = { ...updatedCriteria[index], [field]: value };

    // Recalculate total points
    const total = updatedCriteria.reduce((sum, c) => sum + (c.points || 0), 0);

    onChange({
      ...rubric,
      criteria: updatedCriteria,
      total_points: total
    });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-md border">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Assessment Rubric *</Label>
        <div className="text-sm font-semibold text-blue-600">
          Total: {rubric.total_points} points
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Define scoring criteria for this question. Points are automatically summed.
      </p>

      {rubric.criteria.length === 0 ? (
        <Alert variant="destructive">
          At least one rubric criterion is required for assessment
        </Alert>
      ) : (
        <div className="space-y-3">
          {rubric.criteria.map((criterion, idx) => (
            <Card key={idx} className="p-3 bg-white">
              <div className="flex justify-between items-start mb-2">
                <Label className="font-semibold text-sm">Criterion {idx + 1}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCriterion(idx)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              <div className="space-y-2">
                <div>
                  <Label htmlFor={`criterion-desc-${idx}`} className="text-xs">
                    Description *
                  </Label>
                  <Textarea
                    id={`criterion-desc-${idx}`}
                    value={criterion.description}
                    onChange={(e) =>
                      handleCriterionChange(idx, 'description', e.target.value)
                    }
                    placeholder="What must the student demonstrate to earn these points?"
                    rows={2}
                    className="mt-1"
                  />
                  {errors[`cfu_rubric_criterion_${idx}_desc`] && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors[`cfu_rubric_criterion_${idx}_desc`]}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`criterion-points-${idx}`} className="text-xs">
                    Points *
                  </Label>
                  <Input
                    id={`criterion-points-${idx}`}
                    type="number"
                    min="0"
                    value={criterion.points}
                    onChange={(e) =>
                      handleCriterionChange(idx, 'points', parseInt(e.target.value, 10))
                    }
                    className="mt-1 w-24"
                  />
                  {errors[`cfu_rubric_criterion_${idx}_points`] && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors[`cfu_rubric_criterion_${idx}_points`]}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddCriterion}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Criterion
      </Button>

      {errors.cfu_rubric && (
        <Alert variant="destructive">{errors.cfu_rubric}</Alert>
      )}
      {errors.cfu_rubric_points && (
        <Alert variant="destructive">{errors.cfu_rubric_points}</Alert>
      )}
      {errors.cfu_rubric_criteria && (
        <Alert variant="destructive">{errors.cfu_rubric_criteria}</Alert>
      )}
    </div>
  );
}
