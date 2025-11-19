/**
 * Card Validation Utility
 *
 * Validates lesson cards and CFUs before saving to ensure data integrity.
 * Follows FAST FAIL pattern - throws exceptions for all validation failures.
 */

import type { LessonCard, CFU, MCQCFU, NumericCFU, StructuredResponseCFU, ShortTextCFU, Misconception } from '../appwrite/types';

/**
 * Validation errors object with field-specific messages
 */
export interface ValidationErrors {
  [key: string]: string;
}

/**
 * Validation result for card arrays
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate a single lesson card
 * Returns object with field-specific error messages
 */
export function validateCard(card: LessonCard): ValidationErrors {
  const errors: ValidationErrors = {};

  // Core content validation
  if (!card.id?.trim()) {
    errors.id = "Card ID is required";
  }

  if (!card.title?.trim()) {
    errors.title = "Title is required";
  }

  if (!card.explainer?.trim()) {
    errors.explainer = "Explainer content is required";
  }

  if (!card.explainer_plain?.trim()) {
    errors.explainer_plain = "Accessible explainer is required for CEFR A2-B1 readers";
  }

  // CFU validation
  if (!card.cfu) {
    errors.cfu = "Check For Understanding (CFU) is required";
  } else {
    const cfuErrors = validateCFU(card.cfu);
    Object.assign(errors, cfuErrors);
  }

  // Misconceptions validation (array should exist but can be empty)
  if (!Array.isArray(card.misconceptions)) {
    errors.misconceptions = "Misconceptions must be an array";
  } else {
    card.misconceptions.forEach((misc, idx) => {
      if (!misc.id?.trim()) {
        errors[`misconception_${idx}_id`] = `Misconception ${idx + 1}: ID is required`;
      }
      if (!misc.misconception?.trim()) {
        errors[`misconception_${idx}_text`] = `Misconception ${idx + 1}: Description is required`;
      }
      if (!misc.clarification?.trim()) {
        errors[`misconception_${idx}_clarification`] = `Misconception ${idx + 1}: Clarification is required`;
      }
    });
  }

  // Context hooks validation (optional field)
  if (card.context_hooks && !Array.isArray(card.context_hooks)) {
    errors.context_hooks = "Context hooks must be an array";
  }

  return errors;
}

/**
 * Validate CFU based on its type
 */
function validateCFU(cfu: CFU): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!cfu.type) {
    errors.cfu_type = "CFU type is required";
    return errors;
  }

  // Common validation - all CFUs need ID and stem
  if (!cfu.id?.trim()) {
    errors.cfu_id = "CFU ID is required";
  }

  if (!cfu.stem?.trim()) {
    errors.cfu_stem = "Question stem is required";
  }

  // Rubric validation (all CFUs have rubrics)
  if (!cfu.rubric) {
    errors.cfu_rubric = "CFU rubric is required";
  } else {
    if (!cfu.rubric.total_points || cfu.rubric.total_points <= 0) {
      errors.cfu_rubric_points = "Rubric total points must be greater than 0";
    }
    if (!Array.isArray(cfu.rubric.criteria) || cfu.rubric.criteria.length === 0) {
      errors.cfu_rubric_criteria = "At least one rubric criterion is required";
    } else {
      cfu.rubric.criteria.forEach((criterion, idx) => {
        if (!criterion.description?.trim()) {
          errors[`cfu_rubric_criterion_${idx}_desc`] = `Criterion ${idx + 1}: Description required`;
        }
        if (criterion.points === undefined || criterion.points < 0) {
          errors[`cfu_rubric_criterion_${idx}_points`] = `Criterion ${idx + 1}: Points required`;
        }
      });
    }
  }

  // Type-specific validation
  switch (cfu.type) {
    case 'mcq':
      const mcqErrors = validateMCQCFU(cfu as MCQCFU);
      Object.assign(errors, mcqErrors);
      break;

    case 'numeric':
      const numericErrors = validateNumericCFU(cfu as NumericCFU);
      Object.assign(errors, numericErrors);
      break;

    case 'structured_response':
      const structuredErrors = validateStructuredResponseCFU(cfu as StructuredResponseCFU);
      Object.assign(errors, structuredErrors);
      break;

    case 'short_text':
      const shortTextErrors = validateShortTextCFU(cfu as ShortTextCFU);
      Object.assign(errors, shortTextErrors);
      break;

    default:
      errors.cfu_type = `Unknown CFU type: ${(cfu as any).type}`;
  }

  return errors;
}

/**
 * Validate MCQ-specific fields
 * Supports both single-select (answerIndex) and multi-select (answerIndices) modes
 */
function validateMCQCFU(cfu: MCQCFU): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!cfu.options || !Array.isArray(cfu.options)) {
    errors.cfu_options = "Options array is required for MCQ";
    return errors;
  }

  if (cfu.options.length < 2) {
    errors.cfu_options = "At least 2 options are required for MCQ";
  }

  // Check for empty options
  const emptyOptions = cfu.options.filter(opt => !opt?.trim());
  if (emptyOptions.length > 0) {
    errors.cfu_options_empty = "All options must have content";
  }

  // Validate answer based on single/multi-select mode
  if (cfu.multiSelect) {
    // Multi-select mode: validate answerIndices array
    if (!cfu.answerIndices || !Array.isArray(cfu.answerIndices) || cfu.answerIndices.length === 0) {
      errors.cfu_answer = "Multi-select MCQ requires at least one correct answer in answerIndices";
    } else {
      // Validate all indices are in range
      const invalidIndices = cfu.answerIndices.filter(idx => idx < 0 || idx >= cfu.options.length);
      if (invalidIndices.length > 0) {
        errors.cfu_answer = `Answer indices ${invalidIndices.join(', ')} are out of range (0-${cfu.options.length - 1})`;
      }
    }
  } else {
    // Single-select mode: validate answerIndex
    if (cfu.answerIndex === undefined || cfu.answerIndex === null) {
      errors.cfu_answer = "Correct answer index is required";
    } else if (cfu.answerIndex < 0 || cfu.answerIndex >= cfu.options.length) {
      errors.cfu_answer = `Answer index (${cfu.answerIndex}) is out of range (0-${cfu.options.length - 1})`;
    }
  }

  return errors;
}

/**
 * Validate Numeric CFU fields
 */
function validateNumericCFU(cfu: NumericCFU): ValidationErrors {
  const errors: ValidationErrors = {};

  if (cfu.expected === undefined || cfu.expected === null) {
    errors.cfu_expected = "Expected numeric answer is required";
  } else if (typeof cfu.expected !== 'number' || isNaN(cfu.expected)) {
    errors.cfu_expected = "Expected answer must be a valid number";
  }

  if (cfu.tolerance === undefined || cfu.tolerance === null) {
    errors.cfu_tolerance = "Tolerance value is required";
  } else if (typeof cfu.tolerance !== 'number' || isNaN(cfu.tolerance) || cfu.tolerance < 0) {
    errors.cfu_tolerance = "Tolerance must be a non-negative number";
  }

  // Validate hints if present (optional)
  if (cfu.hints && !Array.isArray(cfu.hints)) {
    errors.cfu_hints = "Hints must be an array";
  }

  return errors;
}

/**
 * Validate Structured Response CFU
 */
function validateStructuredResponseCFU(cfu: StructuredResponseCFU): ValidationErrors {
  const errors: ValidationErrors = {};

  // Structured response only has basic fields in the current schema
  // Additional validation can be added when parts are implemented

  return errors;
}

/**
 * Validate Short Text CFU
 */
function validateShortTextCFU(cfu: ShortTextCFU): ValidationErrors {
  const errors: ValidationErrors = {};

  // Short text only has basic fields in the current schema
  // Additional validation can be added when expected keywords are implemented

  return errors;
}

/**
 * Validate an array of cards
 * Returns aggregated validation result
 */
export function validateCardArray(cards: LessonCard[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(cards)) {
    errors.push("Cards must be an array");
    return { isValid: false, errors };
  }

  if (cards.length === 0) {
    errors.push("At least one card is required");
    return { isValid: false, errors };
  }

  // Validate each card
  cards.forEach((card, index) => {
    const cardErrors = validateCard(card);

    // Convert field-specific errors to readable messages
    Object.entries(cardErrors).forEach(([field, message]) => {
      const cardTitle = card.title || 'Untitled';
      errors.push(`Card ${index + 1} (${cardTitle}): ${field} - ${message}`);
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if a card has any validation errors
 * Useful for UI state management
 */
export function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Create empty CFU structure for given type
 * Used when changing CFU type in editor
 */
export function createEmptyCFU(type: CFU['type']): CFU {
  const baseId = `cfu_${Date.now()}`;
  const emptyRubric = {
    total_points: 0,
    criteria: []
  };

  switch (type) {
    case 'mcq':
      return {
        type: 'mcq',
        id: baseId,
        stem: '',
        options: ['', ''],
        answerIndex: 0,
        multiSelect: false,  // Default to single-select (radio buttons)
        rubric: emptyRubric
      };

    case 'numeric':
      return {
        type: 'numeric',
        id: baseId,
        stem: '',
        expected: 0,
        tolerance: 0,
        rubric: emptyRubric
      };

    case 'structured_response':
      return {
        type: 'structured_response',
        id: baseId,
        stem: '',
        rubric: emptyRubric
      };

    case 'short_text':
      return {
        type: 'short_text',
        id: baseId,
        stem: '',
        rubric: emptyRubric
      };

    default:
      throw new Error(`Unknown CFU type: ${type}`);
  }
}

/**
 * Create empty card structure
 * Used when adding new cards
 */
export function createEmptyCard(): LessonCard {
  return {
    id: `card_${Date.now()}`,
    title: 'New Card',
    explainer: '',
    explainer_plain: '',
    cfu: createEmptyCFU('mcq'),
    misconceptions: [],
    context_hooks: []
  };
}
