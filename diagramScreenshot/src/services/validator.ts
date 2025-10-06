import { z } from 'zod';
import type { RenderRequest } from '../types/diagram';

const BoardConfigSchema = z.object({
  boundingbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  axis: z.boolean().optional(),
  grid: z.boolean().optional(),
  showCopyright: z.boolean().optional(),
  showNavigation: z.boolean().optional(),
  keepAspectRatio: z.boolean().optional(),
  pan: z.object({ enabled: z.boolean().optional() }).optional(),
  zoom: z.object({ enabled: z.boolean().optional() }).optional()
});

const DiagramElementSchema = z.object({
  type: z.string(),
  args: z.array(z.any()),
  attributes: z.record(z.any()).optional(),
  id: z.string().optional()
});

const DiagramSchema = z.object({
  board: BoardConfigSchema,
  elements: z.array(DiagramElementSchema),
  title: z.string().optional(),
  description: z.string().optional(),
  metadata: z.object({
    subject: z.string().optional(),
    difficulty: z.string().optional(),
    interactivity: z.string().optional(),
    learningObjective: z.string().optional()
  }).optional()
});

const RenderOptionsSchema = z.object({
  width: z.number().min(100).max(4000).optional(),
  height: z.number().min(100).max(4000).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(1).max(100).optional(),
  scale: z.number().min(1).max(4).optional(),
  timeout: z.number().min(1000).max(60000).optional(),
  waitForStable: z.boolean().optional(),
  backgroundColor: z.string().optional(),
  fullPage: z.boolean().optional(),
  returnFormat: z.enum(['base64', 'binary']).optional()
});

export const RenderRequestSchema = z.object({
  diagram: DiagramSchema,
  options: RenderOptionsSchema.optional()
});

export function validateRenderRequest(data: unknown): RenderRequest {
  return RenderRequestSchema.parse(data);
}
