import { Query, Storage } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { LessonDiagram } from '../types';

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
    console.log('📐 DiagramDriver.getDiagramForCardByContext - Entry');
    console.log('📐 DiagramDriver - Parameters:', { lessonTemplateId, cardId, diagramContext });

    if (!lessonTemplateId || !cardId) {
      console.error('📐 DiagramDriver - ERROR: Missing required parameters');
      throw new Error('lessonTemplateId and cardId are required');
    }

    try {
      console.log('📐 DiagramDriver - Building query with:');
      console.log('  - lessonTemplateId:', lessonTemplateId);
      console.log('  - cardId:', cardId);
      console.log('  - diagram_context:', diagramContext);

      const diagrams = await this.list<LessonDiagram>('lesson_diagrams', [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('cardId', cardId),
        Query.equal('diagram_context', diagramContext),  // Filter by context
        Query.limit(1) // Only need first match
      ]);

      console.log('📐 DiagramDriver - Query returned:', diagrams.length, 'diagrams');
      if (diagrams.length > 0) {
        console.log('📐 DiagramDriver - First diagram:', diagrams[0]);
      } else {
        console.log('📐 DiagramDriver - No diagrams found with cardId="lesson", checking all diagrams for this lesson...');

        // Debug: List ALL diagrams for this lesson to see what cardIds exist
        try {
          const allDiagrams = await this.list<LessonDiagram>('lesson_diagrams', [
            Query.equal('lessonTemplateId', lessonTemplateId),
            Query.limit(100)
          ]);
          console.log('📐 DiagramDriver - All diagrams for this lesson:', allDiagrams.length);
          allDiagrams.forEach((d, idx) => {
            console.log(`📐 DiagramDriver - Diagram ${idx + 1}:`, {
              cardId: d.cardId,
              diagram_context: d.diagram_context,
              diagram_type: d.diagram_type,
              title: d.title,
              image_file_id: d.image_file_id
            });
          });
        } catch (debugError) {
          console.error('📐 DiagramDriver - Error listing all diagrams:', debugError);
        }
      }

      // Return first diagram or null if no diagrams found
      return diagrams.length > 0 ? diagrams[0] : null;

    } catch (error) {
      console.error('📐 DiagramDriver - Caught error:', error);
      console.error('📐 DiagramDriver - Error code:', error.code);
      console.error('📐 DiagramDriver - Error message:', error.message);

      // Silent fail if diagram not found - this is expected for cards without diagrams
      if (error.code === 404) {
        console.log('📐 DiagramDriver - 404 error, returning null');
        return null;
      }
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
}
