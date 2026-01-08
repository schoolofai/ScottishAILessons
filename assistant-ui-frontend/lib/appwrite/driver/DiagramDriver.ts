import { Query, Storage, ID } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { LessonDiagram } from '../types';
import { base64ToBlob, generateDiagramFileId } from '@/lib/utils/imageUpload';

/**
 * Diagram driver handling lesson diagram fetching and Storage integration
 *
 * Provides access to:
 * - lesson_diagrams collection for diagram metadata
 * - Appwrite Storage for diagram images
 *
 * Storage Configuration:
 * - Bucket ID: 6907775a001b754c19a6 (images bucket)
 * - File ID format: dgm_image_{8-char-hash} (deterministic based on lessonTemplateId + cardId)
 */
export class DiagramDriver extends BaseDriver {
  private readonly STORAGE_BUCKET_ID = '6907775a001b754c19a6';
  private storage: Storage;

  constructor(sessionTokenOrDatabases?: string | any) {
    super(sessionTokenOrDatabases);
    // Initialize Storage service - uses same client as BaseDriver
    // Note: If initialized with Databases instance only, client may be undefined
    if (this.client) {
      this.storage = new Storage(this.client);
    } else {
      // Fallback: create new client for Storage access (should rarely happen)
      const { Client } = require('appwrite');
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      this.storage = new Storage(client);
    }
  }

  /**
   * Get diagram for a specific lesson card
   *
   * Queries lesson_diagrams collection by lessonTemplateId and cardId
   *
   * @param lessonTemplateId - Lesson template ID (e.g., "lesson_template_001")
   * @param cardId - Card ID (e.g., "card_001", "card_002")
   * @returns Lesson diagram document or null if not found
   * @throws Error if query fails
   */
  async getDiagramForCard(
    lessonTemplateId: string,
    cardId: string
  ): Promise<LessonDiagram | null> {
    if (!lessonTemplateId || !cardId) {
      throw new Error('lessonTemplateId and cardId are required');
    }

    try {
      const diagrams = await this.list<LessonDiagram>('lesson_diagrams', [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('cardId', cardId),
        Query.limit(1) // Only need first match (should be unique anyway)
      ]);

      // Return first diagram or null if no diagrams found
      return diagrams.length > 0 ? diagrams[0] : null;

    } catch (error) {
      // Silent fail if diagram not found - this is expected for cards without diagrams
      if (error.code === 404) {
        return null;
      }
      throw this.handleError(error, `get diagram for card ${cardId} in lesson ${lessonTemplateId}`);
    }
  }

  /**
   * Get diagram for a specific lesson card filtered by context
   *
   * Queries lesson_diagrams collection by lessonTemplateId, cardId, and diagram_context
   * This is useful for distinguishing between lesson diagrams (teaching) and CFU diagrams (assessment)
   *
   * @param lessonTemplateId - Lesson template ID (e.g., "lesson_template_001")
   * @param cardId - Card ID (e.g., "card_001", "card_002")
   * @param diagramContext - Filter by "lesson" (teaching content) or "cfu" (assessment questions)
   * @returns Lesson diagram document or null if not found
   * @throws Error if query fails
   */
  async getDiagramForCardByContext(
    lessonTemplateId: string,
    cardId: string,
    diagramContext: 'lesson' | 'cfu'
  ): Promise<LessonDiagram | null> {
    if (!lessonTemplateId || !cardId) {
      throw new Error('lessonTemplateId and cardId are required');
    }

    try {
      const diagrams = await this.list<LessonDiagram>('lesson_diagrams', [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('cardId', cardId),
        Query.equal('diagram_context', diagramContext),
        Query.limit(1)
      ]);

      return diagrams.length > 0 ? diagrams[0] : null;

    } catch (error) {
      // Silent fail if diagram not found - this is expected for cards without diagrams
      if (error.code === 404) {
        return null;
      }
      console.error('📐 DiagramDriver - Error fetching diagram:', error);
      throw this.handleError(error, `get ${diagramContext} diagram for card ${cardId} in lesson ${lessonTemplateId}`);
    }
  }

  /**
   * Get Appwrite Storage preview URL for a diagram image
   *
   * Constructs a simple preview URL for public bucket access
   * Avoids complex SDK parameters that can cause 400 Bad Request errors
   *
   * @param fileId - Storage file ID (e.g., "dgm_image_a1b2c3d4")
   * @returns Full preview URL for browser rendering
   */
  getStoragePreviewUrl(fileId: string): string {
    if (!fileId) {
      throw new Error('fileId is required to construct preview URL');
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      throw new Error('Missing NEXT_PUBLIC_APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    }

    // Construct simple preview URL without transformation parameters
    // Complex parameters (borderColor='', width=0, etc.) cause 400 Bad Request
    // Since bucket has public read permissions, this simple URL works fine
    const previewUrl = `${endpoint}/storage/buckets/${this.STORAGE_BUCKET_ID}/files/${fileId}/preview?project=${projectId}`;

    return previewUrl;
  }

  /**
   * Get diagram metadata and preview URL in one call
   *
   * Convenience method that combines getDiagramForCard + getStoragePreviewUrl
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @returns Object with diagram metadata and preview URL, or null if no diagram exists
   */
  async getDiagramWithPreviewUrl(
    lessonTemplateId: string,
    cardId: string
  ): Promise<{ diagram: LessonDiagram; previewUrl: string } | null> {
    try {
      const diagram = await this.getDiagramForCard(lessonTemplateId, cardId);

      if (!diagram || !diagram.image_file_id) {
        return null;
      }

      const previewUrl = this.getStoragePreviewUrl(diagram.image_file_id);

      return {
        diagram,
        previewUrl
      };

    } catch (error) {
      throw this.handleError(error, `get diagram with preview URL for ${cardId}`);
    }
  }

  /**
   * Get CFU diagram with preview URL (convenience method)
   *
   * Specifically fetches diagrams for assessment questions (CFU context).
   * Use this in lesson card presentation tools to show diagrams for practice problems.
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @returns Object with diagram metadata and preview URL, or null if no CFU diagram exists
   */
  async getCFUDiagramWithPreviewUrl(
    lessonTemplateId: string,
    cardId: string
  ): Promise<{ diagram: LessonDiagram; previewUrl: string } | null> {
    try {
      const diagram = await this.getDiagramForCardByContext(
        lessonTemplateId,
        cardId,
        'cfu'
      );

      if (!diagram || !diagram.image_file_id) {
        return null;
      }

      const previewUrl = this.getStoragePreviewUrl(diagram.image_file_id);

      return {
        diagram,
        previewUrl
      };

    } catch (error) {
      throw this.handleError(error, `get CFU diagram with preview URL for ${cardId}`);
    }
  }

  /**
   * Check if a diagram exists for a specific card
   *
   * Lightweight existence check without fetching full document
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @returns true if diagram exists, false otherwise
   */
  async hasDiagram(lessonTemplateId: string, cardId: string): Promise<boolean> {
    try {
      const diagram = await this.getDiagramForCard(lessonTemplateId, cardId);
      return diagram !== null;
    } catch (error) {
      // On error, assume no diagram exists (graceful degradation)
      return false;
    }
  }

  /**
   * Get ALL diagrams for a specific lesson card filtered by context
   *
   * Returns all diagrams sorted by diagram_index (supports multiple diagrams per context)
   *
   * @param lessonTemplateId - Lesson template ID (e.g., "lesson_template_001")
   * @param cardId - Card ID (e.g., "card_001", "card_002")
   * @param diagramContext - Filter by "lesson" (teaching content) or "cfu" (assessment questions)
   * @returns Array of lesson diagrams sorted by index (empty array if none found)
   * @throws Error if query fails
   */
  async getAllDiagramsForCardByContext(
    lessonTemplateId: string,
    cardId: string,
    diagramContext: 'lesson' | 'cfu'
  ): Promise<LessonDiagram[]> {
    if (!lessonTemplateId || !cardId) {
      throw new Error('lessonTemplateId and cardId are required');
    }

    try {
      const diagrams = await this.list<LessonDiagram>('lesson_diagrams', [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('cardId', cardId),
        Query.equal('diagram_context', diagramContext),
        Query.orderAsc('diagram_index'),
        Query.limit(100)
      ]);

      return diagrams;

    } catch (error) {
      // Silent fail if diagram not found - this is expected for cards without diagrams
      if (error.code === 404) {
        return [];
      }
      console.error('📐 DiagramDriver - Error fetching diagrams:', error);
      throw this.handleError(error, `get all ${diagramContext} diagrams for card ${cardId} in lesson ${lessonTemplateId}`);
    }
  }

  /**
   * Get ALL diagrams for a specific lesson card (all contexts, all indices)
   *
   * Returns all diagrams grouped by context, sorted by diagram_index
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @returns Object with arrays of lesson and cfu diagrams
   * @throws Error if query fails
   */
  async getAllDiagramsForCard(
    lessonTemplateId: string,
    cardId: string
  ): Promise<{ lesson: LessonDiagram[]; cfu: LessonDiagram[] }> {
    if (!lessonTemplateId || !cardId) {
      throw new Error('lessonTemplateId and cardId are required');
    }

    try {
      const [lessonDiagrams, cfuDiagrams] = await Promise.all([
        this.getAllDiagramsForCardByContext(lessonTemplateId, cardId, 'lesson'),
        this.getAllDiagramsForCardByContext(lessonTemplateId, cardId, 'cfu')
      ]);

      return {
        lesson: lessonDiagrams,
        cfu: cfuDiagrams
      };
    } catch (error) {
      throw this.handleError(error, `batch fetch all diagrams for card ${cardId}`);
    }
  }

  /**
   * Batch fetch both lesson and CFU diagrams for a card
   *
   * @deprecated Use getAllDiagramsForCard() instead for multiple diagram support
   *
   * Efficiently fetches both diagram contexts in parallel
   * Returns only the FIRST diagram of each type (backward compatible)
   * Useful for admin UI that needs to display both types
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @returns Object with lesson and cfu diagrams (either can be null)
   */
  async getDiagramsForCard(
    lessonTemplateId: string,
    cardId: string
  ): Promise<{ lesson: LessonDiagram | null; cfu: LessonDiagram | null }> {
    try {
      const [lessonDiagram, cfuDiagram] = await Promise.all([
        this.getDiagramForCardByContext(lessonTemplateId, cardId, 'lesson'),
        this.getDiagramForCardByContext(lessonTemplateId, cardId, 'cfu')
      ]);

      return {
        lesson: lessonDiagram,
        cfu: cfuDiagram
      };
    } catch (error) {
      throw this.handleError(error, `batch fetch diagrams for card ${cardId}`);
    }
  }

  /**
   * Upload custom diagram image to replace or add new diagram
   *
   * This method allows manual diagram uploads bypassing the batch generation tool.
   * Useful for edge cases where human curation is needed (accessibility, specific styling).
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @param diagramContext - Diagram context ('lesson' or 'cfu')
   * @param imageBase64 - Base64 encoded image (data URL format)
   * @returns Created/updated diagram document
   * @throws Error if upload or database operation fails
   */
  async uploadDiagram(
    lessonTemplateId: string,
    cardId: string,
    diagramContext: 'lesson' | 'cfu',
    imageBase64: string
  ): Promise<LessonDiagram> {
    if (!lessonTemplateId || !cardId || !diagramContext || !imageBase64) {
      throw new Error('All parameters (lessonTemplateId, cardId, diagramContext, imageBase64) are required');
    }

    try {
      // 1. Generate deterministic file ID (matches backend naming convention)
      const fileId = generateDiagramFileId(lessonTemplateId, cardId, diagramContext);

      // 2. Convert base64 to Blob
      const blob = base64ToBlob(imageBase64);

      // 3. Check if file already exists and delete it first
      try {
        await this.storage.deleteFile(this.STORAGE_BUCKET_ID, fileId);
      } catch (deleteError: any) {
        // File doesn't exist, which is fine
        if (deleteError?.code !== 404) {
          console.warn(`📤 DiagramDriver.uploadDiagram - Warning during file deletion:`, deleteError);
        }
      }

      // 4. Upload to Appwrite Storage bucket
      const uploadedFile = await this.storage.createFile(
        this.STORAGE_BUCKET_ID,
        fileId,
        blob
      );

      // 5. Check if diagram document already exists
      const existingDiagram = await this.getDiagramForCardByContext(
        lessonTemplateId,
        cardId,
        diagramContext
      );

      if (existingDiagram) {
        // Update existing document
        const updatedDiagram = await this.update<LessonDiagram>(
          'lesson_diagrams',
          existingDiagram.$id,
          {
            image_file_id: fileId,
            jsxgraph_json: '{}', // No JSXGraph for custom uploads
            diagram_type: 'mixed',
            visual_critique_score: null,
            critique_iterations: 0,
            critique_feedback: 'Custom uploaded image',
            execution_id: `manual_${Date.now()}`
          }
        );
        return updatedDiagram;
      } else {
        // Create new diagram document
        const newDiagram = await this.create<LessonDiagram>(
          'lesson_diagrams',
          ID.unique(),
          {
            lessonTemplateId,
            cardId,
            diagram_context: diagramContext,
            image_file_id: fileId,
            jsxgraph_json: '{}', // No JSXGraph for custom uploads
            diagram_type: 'mixed',
            visual_critique_score: null,
            critique_iterations: 0,
            critique_feedback: 'Custom uploaded image',
            execution_id: `manual_${Date.now()}`,
            title: `${diagramContext === 'lesson' ? 'Lesson' : 'CFU'} Diagram for ${cardId}`,
            failure_reason: null
          }
        );
        return newDiagram;
      }

    } catch (error: any) {
      console.error('📤 DiagramDriver.uploadDiagram - Error:', error);
      throw this.handleError(error, `upload ${diagramContext} diagram for card ${cardId}`);
    }
  }

  /**
   * Delete diagram from both storage and database
   *
   * Removes the diagram image file from Appwrite Storage and deletes
   * the metadata document from lesson_diagrams collection.
   *
   * @param lessonTemplateId - Lesson template ID
   * @param cardId - Card ID
   * @param diagramContext - Diagram context ('lesson' or 'cfu')
   * @throws Error if diagram not found or deletion fails
   */
  async deleteDiagram(
    lessonTemplateId: string,
    cardId: string,
    diagramContext: 'lesson' | 'cfu'
  ): Promise<void> {
    if (!lessonTemplateId || !cardId || !diagramContext) {
      throw new Error('All parameters (lessonTemplateId, cardId, diagramContext) are required');
    }

    try {
      // 1. Find diagram document
      const diagram = await this.getDiagramForCardByContext(
        lessonTemplateId,
        cardId,
        diagramContext
      );

      if (!diagram) {
        throw new Error(`No ${diagramContext} diagram found for card ${cardId}`);
      }

      // 2. Delete from storage bucket
      try {
        await this.storage.deleteFile(this.STORAGE_BUCKET_ID, diagram.image_file_id);
      } catch (storageError: any) {
        // Log warning but continue - file might already be deleted
        if (storageError?.code !== 404) {
          console.warn(`🗑️ DiagramDriver.deleteDiagram - Storage file deletion warning:`, storageError);
        }
      }

      // 3. Delete database document
      await this.delete('lesson_diagrams', diagram.$id);

    } catch (error: any) {
      console.error('🗑️ DiagramDriver.deleteDiagram - Error:', error);
      throw this.handleError(error, `delete ${diagramContext} diagram for card ${cardId}`);
    }
  }
}
