/**
 * Zod schema validation for Imagen requests
 */

import { z } from 'zod';

/**
 * Image style schema
 */
const imageStyleSchema = z.object({
  type: z.enum(['realistic', 'diagram', 'illustration', 'simple']),
  colorScheme: z.enum(['full-color', 'muted', 'monochrome']).optional(),
  perspective: z.enum(['front', 'side', 'isometric', 'birds-eye']).optional()
}).optional();

/**
 * Educational context schema
 */
const educationalContextSchema = z.object({
  subject: z.enum(['mathematics', 'physics', 'chemistry', 'biology', 'general']).optional(),
  level: z.enum(['primary', 'secondary', 'higher']).optional(),
  topic: z.string().max(200).optional()
}).optional();

/**
 * Prompt schema
 */
const imagenPromptSchema = z.object({
  text: z.string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt must not exceed 2000 characters'),
  context: z.string().max(500).optional(),
  style: imageStyleSchema,
  educational: educationalContextSchema,
  negativePrompt: z.string().max(500).optional()
});

/**
 * Imagen options schema
 */
const imagenOptionsSchema = z.object({
  width: z.number().min(256).max(2048).optional(),
  height: z.number().min(256).max(2048).optional(),
  numberOfImages: z.number().min(1).max(4).optional(),
  seed: z.number().int().min(0).optional(),
  timeout: z.number().min(5000).max(120000).optional()
}).optional();

/**
 * Complete Imagen request schema
 */
export const imagenRequestSchema = z.object({
  prompt: imagenPromptSchema,
  options: imagenOptionsSchema
});

/**
 * Type inference from schema
 */
export type ValidatedImagenRequest = z.infer<typeof imagenRequestSchema>;

/**
 * Validate an Imagen request
 * @throws ZodError if validation fails
 */
export function validateImagenRequest(data: unknown): ValidatedImagenRequest {
  return imagenRequestSchema.parse(data);
}

/**
 * Safe validation that returns result object
 */
export function safeValidateImagenRequest(data: unknown): z.SafeParseReturnType<unknown, ValidatedImagenRequest> {
  return imagenRequestSchema.safeParse(data);
}
