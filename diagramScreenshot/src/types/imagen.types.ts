/**
 * Imagen types for AI-generated educational images
 * Uses Google Gemini's image generation capabilities
 */

import type { RenderOptions } from './common.types';

/**
 * Style configuration for generated images
 */
export interface ImageStyle {
  /** Visual style type */
  type: 'realistic' | 'diagram' | 'illustration' | 'simple';
  /** Color scheme preference */
  colorScheme?: 'full-color' | 'muted' | 'monochrome';
  /** Viewing perspective */
  perspective?: 'front' | 'side' | 'isometric' | 'birds-eye';
}

/**
 * Educational context for better image generation
 */
export interface EducationalContext {
  /** Subject area */
  subject?: 'mathematics' | 'physics' | 'chemistry' | 'biology' | 'general';
  /** Target education level */
  level?: 'primary' | 'secondary' | 'higher';
  /** Specific curriculum topic */
  topic?: string;
}

/**
 * Prompt configuration for image generation
 */
export interface ImagenPrompt {
  /** Main description of the image to generate */
  text: string;
  /** Additional context to guide generation */
  context?: string;
  /** Visual style preferences */
  style?: ImageStyle;
  /** Educational context for better results */
  educational?: EducationalContext;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
}

/**
 * Imagen-specific render options
 */
export interface ImagenOptions {
  /** Image width (default: 1024) */
  width?: number;
  /** Image height (default: 1024) */
  height?: number;
  /** Number of images to generate (1-4, default: 1) */
  numberOfImages?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Complete Imagen render request
 */
export interface ImagenRenderRequest {
  /** Prompt configuration */
  prompt: ImagenPrompt;
  /** Generation options */
  options?: ImagenOptions;
}

/**
 * Single generated image
 */
export interface GeneratedImage {
  /** Base64 encoded image data */
  image: string;
  /** MIME type (usually image/png) */
  mimeType: string;
}

/**
 * Imagen generation metadata
 */
export interface ImagenMetadata {
  tool: 'imagen';
  model: string;
  prompt: string;
  width: number;
  height: number;
  imageCount: number;
  renderTimeMs: number;
  timestamp: string;
  style?: ImageStyle;
  seed?: number;
}

/**
 * Successful Imagen response
 */
export interface ImagenSuccessResponse {
  success: true;
  images: GeneratedImage[];
  metadata: ImagenMetadata;
}

/**
 * Failed Imagen response
 */
export interface ImagenErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Union type for Imagen responses
 */
export type ImagenResponse = ImagenSuccessResponse | ImagenErrorResponse;
