/**
 * Imagen client for Google Gemini image generation
 *
 * Uses Google's Generative AI SDK for educational image generation
 * Optimized for Scottish National 5 Mathematics curriculum
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  ImagenRenderRequest,
  ImagenSuccessResponse,
  GeneratedImage,
  ImageStyle
} from '../../types/imagen.types';
import logger from '../../utils/logger';

/** Model to use for image generation */
const IMAGEN_MODEL = 'gemini-2.0-flash-exp';

/**
 * Client for generating educational images using Google Gemini
 */
export class ImagenClient {
  private client: GoogleGenerativeAI;
  private readonly model: string;
  private initialized: boolean = false;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('IMAGEN_NOT_CONFIGURED: GOOGLE_AI_API_KEY environment variable not set');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = IMAGEN_MODEL;
    this.initialized = true;

    logger.info('ImagenClient initialized', { model: this.model });
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate educational images based on the request
   */
  async generate(request: ImagenRenderRequest): Promise<ImagenSuccessResponse> {
    const startTime = Date.now();

    if (!this.initialized) {
      throw new Error('IMAGEN_NOT_INITIALIZED: Client not properly initialized');
    }

    // Build the full prompt with style guidance
    const fullPrompt = this.buildFullPrompt(request);

    logger.info('Imagen generation started', {
      promptLength: fullPrompt.length,
      style: request.prompt.style?.type
    });

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          // @ts-expect-error - responseModalities is valid but not in types
          responseModalities: ['Text', 'Image']
        }
      });

      const result = await model.generateContent(fullPrompt);
      const response = result.response;

      const images = this.extractImages(response);

      if (images.length === 0) {
        throw new Error('IMAGEN_NO_IMAGES: No images were generated. The model may have refused the request.');
      }

      const renderTimeMs = Date.now() - startTime;

      logger.info('Imagen generation completed', {
        imageCount: images.length,
        renderTimeMs
      });

      return {
        success: true,
        images,
        metadata: {
          tool: 'imagen',
          model: this.model,
          prompt: request.prompt.text,
          width: request.options?.width || 1024,
          height: request.options?.height || 1024,
          imageCount: images.length,
          renderTimeMs,
          timestamp: new Date().toISOString(),
          style: request.prompt.style,
          seed: request.options?.seed
        }
      };

    } catch (error) {
      const renderTimeMs = Date.now() - startTime;

      logger.error('Imagen generation failed', {
        error: error instanceof Error ? error.message : String(error),
        renderTimeMs
      });

      // Re-throw with appropriate error code
      if (error instanceof Error) {
        if (error.message.includes('SAFETY')) {
          throw new Error('IMAGEN_SAFETY_BLOCK: Content was blocked by safety filters');
        }
        if (error.message.includes('quota') || error.message.includes('rate')) {
          throw new Error('IMAGEN_RATE_LIMIT: API rate limit exceeded');
        }
        throw error;
      }

      throw new Error(`IMAGEN_ERROR: ${String(error)}`);
    }
  }

  /**
   * Build the complete prompt with all context and style guidance
   */
  private buildFullPrompt(request: ImagenRenderRequest): string {
    const parts: string[] = [];

    // Main instruction
    parts.push('Create an educational illustration for mathematics education.');

    // Main prompt
    parts.push(`Description: ${request.prompt.text}`);

    // Add context if provided
    if (request.prompt.context) {
      parts.push(`Context: ${request.prompt.context}`);
    }

    // Add educational context
    if (request.prompt.educational) {
      const edu = request.prompt.educational;
      if (edu.subject) parts.push(`Subject: ${edu.subject}`);
      if (edu.level) parts.push(`Education level: ${edu.level}`);
      if (edu.topic) parts.push(`Topic: ${edu.topic}`);
    }

    // Add style guidance
    if (request.prompt.style) {
      parts.push(`Style: ${this.buildStyleGuide(request.prompt.style)}`);
    }

    // Quality requirements
    parts.push('Requirements: Clear, unambiguous visual suitable for students. High quality, professional educational illustration. No text overlays unless specifically requested. Clean white or light background.');

    // Negative prompt
    if (request.prompt.negativePrompt) {
      parts.push(`Avoid: ${request.prompt.negativePrompt}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build style guidance string from style configuration
   */
  private buildStyleGuide(style: ImageStyle): string {
    const parts: string[] = [];

    switch (style.type) {
      case 'realistic':
        parts.push('photorealistic, detailed, accurate representation');
        break;
      case 'diagram':
        parts.push('clean technical diagram, precise lines, labeled components');
        break;
      case 'illustration':
        parts.push('educational illustration, clear and approachable, slightly stylized');
        break;
      case 'simple':
        parts.push('simple, minimalist, clean lines, basic shapes');
        break;
    }

    if (style.perspective) {
      parts.push(`${style.perspective} view`);
    }

    switch (style.colorScheme) {
      case 'muted':
        parts.push('muted colors, soft pastel tones');
        break;
      case 'monochrome':
        parts.push('black and white, grayscale');
        break;
      case 'full-color':
      default:
        parts.push('vibrant, clear colors');
        break;
    }

    return parts.join(', ');
  }

  /**
   * Extract images from the Gemini response
   */
  private extractImages(response: any): GeneratedImage[] {
    const images: GeneratedImage[] = [];

    try {
      const candidates = response.candidates || [];

      for (const candidate of candidates) {
        const content = candidate.content;
        if (!content?.parts) continue;

        for (const part of content.parts) {
          if (part.inlineData) {
            images.push({
              image: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png'
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Error extracting images from response', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return images;
  }
}

/** Singleton instance */
let clientInstance: ImagenClient | null = null;

/**
 * Initialize the Imagen client singleton
 * @returns true if initialized, false if API key not set
 */
export function initImagenClient(): boolean {
  if (clientInstance) {
    return true;
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    logger.warn('GOOGLE_AI_API_KEY not set - Imagen endpoint disabled');
    return false;
  }

  try {
    clientInstance = new ImagenClient();
    return true;
  } catch (error) {
    logger.error('Failed to initialize Imagen client', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Get the Imagen client singleton
 */
export function getImagenClient(): ImagenClient | null {
  return clientInstance;
}

/**
 * Check if Imagen is configured and available
 */
export function isImagenConfigured(): boolean {
  return clientInstance !== null && clientInstance.isInitialized();
}
