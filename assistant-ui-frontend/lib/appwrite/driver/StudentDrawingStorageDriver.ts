import { ID, Storage } from 'appwrite';
import { BaseDriver } from './BaseDriver';

/**
 * Student Drawing Storage Driver
 *
 * Handles upload, retrieval, and deletion of student drawing submissions
 * Uses Appwrite Storage to avoid document size limits in Evidence collection
 *
 * Storage Configuration:
 * - Bucket ID: 6907775a001b754c19a6 (shared images bucket with lesson diagrams)
 * - File ID format: student_draw_{sessionId}_{cardId}_{timestamp}_{uuid}.png
 * - Permissions: Should be configured for student read access only
 */
export class StudentDrawingStorageDriver extends BaseDriver {
  // Reuse the same bucket as lesson diagrams (6907775a001b754c19a6)
  // TODO: Consider separate bucket if permissions differ significantly
  private readonly STORAGE_BUCKET_ID = '6907775a001b754c19a6';
  private storage: Storage;

  constructor(sessionTokenOrDatabases?: string | any) {
    super(sessionTokenOrDatabases);

    // Detect test environment (API key presence indicates tests/server-side)
    const useNodeSDK = Boolean(process.env.APPWRITE_API_KEY);
    let storageClient: any;

    if (typeof sessionTokenOrDatabases === 'string' && sessionTokenOrDatabases) {
      // Frontend: use browser SDK with session token
      const { Client } = require('appwrite');
      storageClient = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
        .setSession(sessionTokenOrDatabases);
      this.storage = new Storage(storageClient);
    } else if (useNodeSDK) {
      // Test/server-side: use Node SDK with API key (browser SDK doesn't support setKey)
      try {
        const { Client, Storage: NodeStorage } = require('node-appwrite');
        storageClient = new Client()
          .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
          .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
          .setKey(process.env.APPWRITE_API_KEY);
        this.storage = new NodeStorage(storageClient);
      } catch (e) {
        // Node SDK not available, fall back to browser SDK without auth
        console.warn('[StudentDrawingStorageDriver] Node SDK not available, using browser SDK');
        const { Client } = require('appwrite');
        storageClient = new Client()
          .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
          .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
        this.storage = new Storage(storageClient);
      }
    } else {
      // Fallback: use BaseDriver's client
      this.storage = new Storage(this.client);
    }
  }

  /**
   * Convert base64 string to Blob for upload
   *
   * Handles both raw base64 and data URI formats:
   * - "iVBORw0KGgo..." (raw base64)
   * - "data:image/png;base64,iVBORw0KGgo..." (data URI)
   */
  private base64ToBlob(base64Data: string): Blob {
    // Remove data URI prefix if present
    const base64 = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    // Decode base64 to binary
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'image/png' });
  }

  /**
   * Generate unique file ID for student drawing (max 36 chars per Appwrite limit)
   *
   * Format: sdraw_{base36_timestamp}_{uuid_8chars}
   * Example: sdraw_kl3m9n_a1b2c3d4 (~22 chars)
   *
   * Note: Session and card context is stored in Evidence document, not in file ID.
   * The short format ensures we stay well under Appwrite's 36-character limit.
   */
  private generateFileId(sessionId: string, cardId: string): string {
    // Convert timestamp to base36 for shorter representation (7-8 chars vs 13)
    const timestamp = Date.now().toString(36);

    // Use first 8 characters of Appwrite's unique ID
    const uuid = ID.unique().substring(0, 8);

    // Format: sdraw_{timestamp}_{uuid} = ~6 + 8 + 1 + 8 = 23 chars
    return `sdraw_${timestamp}_${uuid}`;
  }

  /**
   * Upload single student drawing to Appwrite Storage
   *
   * @param sessionId - Session ID for file naming and tracking
   * @param cardId - Card ID for file naming
   * @param base64Data - Base64-encoded PNG image
   * @returns Appwrite Storage file ID
   * @throws Error if upload fails or validation fails
   */
  async uploadDrawing(
    sessionId: string,
    cardId: string,
    base64Data: string
  ): Promise<string> {
    if (!sessionId || !cardId) {
      throw new Error('sessionId and cardId are required for drawing upload');
    }

    if (!base64Data) {
      throw new Error('base64Data is required for drawing upload');
    }

    try {
      // Convert base64 to Blob
      const blob = this.base64ToBlob(base64Data);

      // Validate file size (max 5MB per Appwrite default)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (blob.size > MAX_FILE_SIZE) {
        throw new Error(`Drawing exceeds maximum size of 5MB (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Generate unique file ID
      const fileId = this.generateFileId(sessionId, cardId);

      // Create File object for upload
      const file = new File([blob], `${fileId}.png`, { type: 'image/png' });

      // Upload to Appwrite Storage
      console.log(`[StudentDrawingStorageDriver] Uploading drawing: ${fileId}`);
      const uploadedFile = await this.storage.createFile(
        this.STORAGE_BUCKET_ID,
        fileId,
        file
      );

      console.log(`[StudentDrawingStorageDriver] Successfully uploaded drawing: ${uploadedFile.$id}`);
      return uploadedFile.$id;

    } catch (error) {
      console.error('[StudentDrawingStorageDriver] Upload failed:', error);
      throw new Error(`Failed to upload drawing: ${error.message}`);
    }
  }

  /**
   * Upload multiple student drawings in batch
   *
   * Processes uploads sequentially to avoid overwhelming the storage service
   * If any upload fails, throws error with details of failed uploads
   *
   * @param sessionId - Session ID for file naming
   * @param cardId - Card ID for file naming
   * @param base64Array - Array of base64-encoded PNG images
   * @returns Array of Appwrite Storage file IDs (same order as input)
   * @throws Error if any upload fails
   */
  async batchUploadDrawings(
    sessionId: string,
    cardId: string,
    base64Array: string[]
  ): Promise<string[]> {
    if (!Array.isArray(base64Array) || base64Array.length === 0) {
      throw new Error('base64Array must be a non-empty array');
    }

    const MAX_IMAGES = 5;
    if (base64Array.length > MAX_IMAGES) {
      throw new Error(`Cannot upload more than ${MAX_IMAGES} drawings at once (received ${base64Array.length})`);
    }

    const fileIds: string[] = [];
    const errors: string[] = [];

    console.log(`[StudentDrawingStorageDriver] Batch uploading ${base64Array.length} drawings`);

    for (let i = 0; i < base64Array.length; i++) {
      try {
        const fileId = await this.uploadDrawing(sessionId, cardId, base64Array[i]);
        fileIds.push(fileId);
      } catch (error) {
        const errorMsg = `Image ${i + 1} failed: ${error.message}`;
        console.error(`[StudentDrawingStorageDriver] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // If any upload failed, throw error with details
    if (errors.length > 0) {
      // Clean up successfully uploaded files before throwing
      await this.cleanupFiles(fileIds);
      throw new Error(`Batch upload failed: ${errors.join('; ')}`);
    }

    console.log(`[StudentDrawingStorageDriver] Successfully uploaded ${fileIds.length} drawings`);
    return fileIds;
  }

  /**
   * Get Appwrite Storage preview URL for a student drawing
   *
   * Constructs a simple preview URL for rendering in browser
   * Similar to DiagramDriver.getStoragePreviewUrl pattern
   *
   * @param fileId - Storage file ID (e.g., "student_draw_sess123_card_001_...")
   * @returns Full preview URL for <img> src attribute
   */
  getDrawingPreviewUrl(fileId: string): string {
    if (!fileId) {
      throw new Error('fileId is required to construct preview URL');
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      throw new Error('Missing NEXT_PUBLIC_APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    }

    // Construct simple preview URL without complex transformation parameters
    const previewUrl = `${endpoint}/storage/buckets/${this.STORAGE_BUCKET_ID}/files/${fileId}/preview?project=${projectId}`;

    return previewUrl;
  }

  /**
   * Get preview URLs for multiple drawings
   *
   * Convenience method for batch URL generation
   *
   * @param fileIds - Array of storage file IDs
   * @returns Array of preview URLs (same order as input)
   */
  getDrawingPreviewUrls(fileIds: string[]): string[] {
    if (!Array.isArray(fileIds)) {
      return [];
    }

    return fileIds.map(fileId => this.getDrawingPreviewUrl(fileId));
  }

  /**
   * Delete a student drawing from storage
   *
   * Used for cleanup operations (e.g., when evidence is deleted or upload fails)
   *
   * @param fileId - Storage file ID to delete
   * @throws Error if deletion fails
   */
  async deleteDrawing(fileId: string): Promise<void> {
    if (!fileId) {
      throw new Error('fileId is required for deletion');
    }

    try {
      console.log(`[StudentDrawingStorageDriver] Deleting drawing: ${fileId}`);
      await this.storage.deleteFile(this.STORAGE_BUCKET_ID, fileId);
      console.log(`[StudentDrawingStorageDriver] Successfully deleted drawing: ${fileId}`);
    } catch (error) {
      console.error(`[StudentDrawingStorageDriver] Delete failed for ${fileId}:`, error);
      throw new Error(`Failed to delete drawing ${fileId}: ${error.message}`);
    }
  }

  /**
   * Clean up multiple files (internal helper for batch operations)
   *
   * Attempts to delete all files, continues on errors (best-effort cleanup)
   *
   * @param fileIds - Array of file IDs to delete
   */
  private async cleanupFiles(fileIds: string[]): Promise<void> {
    if (!fileIds || fileIds.length === 0) {
      return;
    }

    console.log(`[StudentDrawingStorageDriver] Cleaning up ${fileIds.length} files`);

    for (const fileId of fileIds) {
      try {
        await this.deleteDrawing(fileId);
      } catch (error) {
        // Log error but continue cleanup
        console.error(`[StudentDrawingStorageDriver] Cleanup failed for ${fileId}:`, error.message);
      }
    }
  }

  /**
   * Delete multiple drawings in batch
   *
   * Best-effort deletion - continues even if some deletions fail
   *
   * @param fileIds - Array of storage file IDs to delete
   * @returns Object with success/failure counts
   */
  async batchDeleteDrawings(fileIds: string[]): Promise<{
    succeeded: number;
    failed: number;
    errors: string[]
  }> {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return { succeeded: 0, failed: 0, errors: [] };
    }

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    console.log(`[StudentDrawingStorageDriver] Batch deleting ${fileIds.length} drawings`);

    for (const fileId of fileIds) {
      try {
        await this.deleteDrawing(fileId);
        succeeded++;
      } catch (error) {
        failed++;
        errors.push(`${fileId}: ${error.message}`);
      }
    }

    console.log(`[StudentDrawingStorageDriver] Batch delete complete: ${succeeded} succeeded, ${failed} failed`);
    return { succeeded, failed, errors };
  }
}
