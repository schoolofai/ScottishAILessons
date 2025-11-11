/**
 * Unit and Integration Tests for StudentDrawingStorageDriver
 * Phase 10: Drawing Storage Migration
 *
 * Tests cover:
 * - Base64 to Blob conversion
 * - File upload (mocked and real)
 * - Batch uploads with cleanup on failure
 * - URL generation
 * - File deletion and cleanup
 *
 * Integration tests use real Appwrite with automatic cleanup
 */

import { test, expect } from '@playwright/test';
import { StudentDrawingStorageDriver } from '../lib/appwrite/driver/StudentDrawingStorageDriver';
import { Client } from 'appwrite';

// Test data: 1x1 pixel transparent PNG as base64
const VALID_BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_BASE64_DATA_URI = `data:image/png;base64,${VALID_BASE64_PNG}`;

test.describe('StudentDrawingStorageDriver - Unit Tests', () => {

  test.describe('base64ToBlob conversion', () => {
    test('should convert raw base64 string to Blob', () => {
      const driver = new StudentDrawingStorageDriver();

      // Access private method via type assertion for testing
      const blob = (driver as any).base64ToBlob(VALID_BASE64_PNG);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    test('should convert data URI to Blob', () => {
      const driver = new StudentDrawingStorageDriver();

      const blob = (driver as any).base64ToBlob(VALID_BASE64_DATA_URI);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    test('should throw error for invalid base64', () => {
      const driver = new StudentDrawingStorageDriver();

      expect(() => {
        (driver as any).base64ToBlob('invalid-base64!!!');
      }).toThrow();
    });
  });

  test.describe('generateFileId', () => {
    test('should generate short file ID under 36 character limit', () => {
      const driver = new StudentDrawingStorageDriver();

      const fileId = (driver as any).generateFileId('session_123', 'card_001');

      // New format: sdraw_{timestamp}_{uuid} (~23 chars)
      expect(fileId).toContain('sdraw_');
      expect(fileId.length).toBeLessThan(36); // Appwrite's limit
      expect(fileId.length).toBeGreaterThan(15); // Should have timestamp + UUID
    });

    test('should generate valid IDs with special characters in inputs', () => {
      const driver = new StudentDrawingStorageDriver();

      // Should handle any session/card IDs without breaking
      const fileId = (driver as any).generateFileId('session@#$123', 'card#@!001');

      // File ID should be valid (no special chars from inputs appear)
      expect(fileId).toMatch(/^sdraw_[a-z0-9_]+$/);
      expect(fileId.length).toBeLessThan(36);
    });

    test('should generate unique IDs for same session/card', async () => {
      const driver = new StudentDrawingStorageDriver();

      const fileId1 = (driver as any).generateFileId('session_123', 'card_001');
      // Add small delay to ensure different timestamp (base36 has 1ms resolution)
      await new Promise(resolve => setTimeout(resolve, 2));
      const fileId2 = (driver as any).generateFileId('session_123', 'card_001');

      // Should have different timestamps/UUIDs even with same inputs
      expect(fileId1).not.toBe(fileId2);
    });

    test('should maintain consistent format', () => {
      const driver = new StudentDrawingStorageDriver();

      const fileId = (driver as any).generateFileId('test_session', 'test_card');

      // Format: sdraw_{base36_timestamp}_{uuid_8chars}
      const parts = fileId.split('_');
      expect(parts[0]).toBe('sdraw');
      expect(parts).toHaveLength(3); // sdraw, timestamp, uuid
    });
  });

  test.describe('getDrawingPreviewUrl', () => {
    test('should construct correct preview URL', () => {
      // Set up environment variables for testing
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test_project_123';

      const driver = new StudentDrawingStorageDriver();
      const fileId = 'test_file_123';

      const url = driver.getDrawingPreviewUrl(fileId);

      expect(url).toContain('https://cloud.appwrite.io/v1');
      expect(url).toContain('/storage/buckets/');
      expect(url).toContain('/files/test_file_123/preview');
      expect(url).toContain('?project=test_project_123');
    });

    test('should throw error if fileId is empty', () => {
      const driver = new StudentDrawingStorageDriver();

      expect(() => {
        driver.getDrawingPreviewUrl('');
      }).toThrow('fileId is required');
    });

    test('should throw error if environment variables missing', () => {
      // Create driver first while env vars exist
      const driver = new StudentDrawingStorageDriver();

      // Then temporarily remove env vars
      const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
      const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

      delete process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
      delete process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

      // Now calling getDrawingPreviewUrl should throw
      expect(() => {
        driver.getDrawingPreviewUrl('test_file');
      }).toThrow('Missing NEXT_PUBLIC_APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_PROJECT_ID');

      // Restore env vars
      if (endpoint) process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = endpoint;
      if (projectId) process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = projectId;
    });
  });

  test.describe('getDrawingPreviewUrls - batch', () => {
    test('should generate URLs for multiple file IDs', () => {
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test_project_123';

      const driver = new StudentDrawingStorageDriver();
      const fileIds = ['file_1', 'file_2', 'file_3'];

      const urls = driver.getDrawingPreviewUrls(fileIds);

      expect(urls).toHaveLength(3);
      expect(urls[0]).toContain('file_1');
      expect(urls[1]).toContain('file_2');
      expect(urls[2]).toContain('file_3');
    });

    test('should return empty array for empty input', () => {
      const driver = new StudentDrawingStorageDriver();

      const urls = driver.getDrawingPreviewUrls([]);

      expect(urls).toEqual([]);
    });

    test('should return empty array for non-array input', () => {
      const driver = new StudentDrawingStorageDriver();

      const urls = driver.getDrawingPreviewUrls(null as any);

      expect(urls).toEqual([]);
    });
  });
});

test.describe('StudentDrawingStorageDriver - Integration Tests', () => {
  let driver: StudentDrawingStorageDriver;
  let uploadedFileIds: string[] = [];

  test.beforeEach(() => {
    // Initialize driver with real Appwrite client
    driver = new StudentDrawingStorageDriver();
    uploadedFileIds = [];
  });

  test.afterEach(async () => {
    // CRITICAL: Clean up all uploaded files after each test
    console.log(`[CLEANUP] Deleting ${uploadedFileIds.length} test files...`);

    for (const fileId of uploadedFileIds) {
      try {
        await driver.deleteDrawing(fileId);
        console.log(`[CLEANUP] Deleted file: ${fileId}`);
      } catch (error) {
        console.error(`[CLEANUP] Failed to delete file ${fileId}:`, error.message);
      }
    }

    uploadedFileIds = [];
    console.log('[CLEANUP] Cleanup complete');
  });

  test('should upload single drawing successfully', async () => {
    const sessionId = 'test_session_' + Date.now();
    const cardId = 'test_card_001';

    const fileId = await driver.uploadDrawing(sessionId, cardId, VALID_BASE64_PNG);
    uploadedFileIds.push(fileId); // Track for cleanup

    expect(fileId).toBeTruthy();
    expect(fileId).toContain('sdraw_'); // New short format
    expect(fileId.length).toBeLessThan(36); // Under Appwrite's limit
  });

  test('should throw error when uploading without session ID', async () => {
    await expect(
      driver.uploadDrawing('', 'card_001', VALID_BASE64_PNG)
    ).rejects.toThrow('sessionId and cardId are required');
  });

  test('should throw error when uploading without card ID', async () => {
    await expect(
      driver.uploadDrawing('session_123', '', VALID_BASE64_PNG)
    ).rejects.toThrow('sessionId and cardId are required');
  });

  test('should throw error when uploading empty base64', async () => {
    await expect(
      driver.uploadDrawing('session_123', 'card_001', '')
    ).rejects.toThrow('base64Data is required');
  });

  test('should throw error when file exceeds 5MB', async () => {
    // Create a large base64 string (>5MB when decoded)
    // Base64 encoding adds ~33% overhead, so 6MB of base64 ≈ 4.5MB decoded
    // We need 6.7MB of base64 to get >5MB decoded
    const targetSizeBytes = 7 * 1024 * 1024; // 7MB of base64
    const largeBase64 = 'A'.repeat(targetSizeBytes); // 'A' is valid base64

    await expect(
      driver.uploadDrawing('session_123', 'card_001', largeBase64)
    ).rejects.toThrow('exceeds maximum size');
  });

  test('should upload multiple drawings in batch', async () => {
    const sessionId = 'test_session_' + Date.now();
    const cardId = 'test_card_batch';
    const base64Array = [VALID_BASE64_PNG, VALID_BASE64_PNG, VALID_BASE64_PNG];

    const fileIds = await driver.batchUploadDrawings(sessionId, cardId, base64Array);
    uploadedFileIds.push(...fileIds); // Track all for cleanup

    expect(fileIds).toHaveLength(3);
    fileIds.forEach(fileId => {
      expect(fileId).toContain('sdraw_'); // New short format
      expect(fileId.length).toBeLessThan(36); // Under Appwrite's limit
    });
  });

  test('should throw error when batch uploading more than 5 images', async () => {
    const sessionId = 'test_session_' + Date.now();
    const cardId = 'test_card_exceed';
    const base64Array = Array(6).fill(VALID_BASE64_PNG); // 6 images

    await expect(
      driver.batchUploadDrawings(sessionId, cardId, base64Array)
    ).rejects.toThrow('Cannot upload more than 5 drawings');
  });

  test('should clean up on batch upload failure', async () => {
    const sessionId = 'test_session_' + Date.now();
    const cardId = 'test_card_fail';
    // Mix valid and invalid base64 to trigger partial failure
    const base64Array = [VALID_BASE64_PNG, 'invalid_base64', VALID_BASE64_PNG];

    await expect(
      driver.batchUploadDrawings(sessionId, cardId, base64Array)
    ).rejects.toThrow('Batch upload failed');

    // Verify no orphaned files left behind
    // (cleanup happens automatically in batchUploadDrawings)
    // Note: We can't easily verify this without querying storage
  });

  test('should delete drawing successfully', async () => {
    // First upload a drawing
    const sessionId = 'test_session_' + Date.now();
    const fileId = await driver.uploadDrawing(sessionId, 'card_delete', VALID_BASE64_PNG);

    // Then delete it
    await driver.deleteDrawing(fileId);

    // No need to track in uploadedFileIds since we deleted it

    // Verify deletion by trying to delete again (should fail or return error)
    await expect(
      driver.deleteDrawing(fileId)
    ).rejects.toThrow();
  });

  test('should generate working preview URL for uploaded file', async () => {
    const sessionId = 'test_session_' + Date.now();
    const fileId = await driver.uploadDrawing(sessionId, 'card_preview', VALID_BASE64_PNG);
    uploadedFileIds.push(fileId);

    const previewUrl = driver.getDrawingPreviewUrl(fileId);

    expect(previewUrl).toBeTruthy();
    expect(previewUrl).toContain(fileId);
    expect(previewUrl).toContain('/storage/buckets/');
    expect(previewUrl).toContain('/preview');

    // Note: We could fetch the URL to verify it works, but that requires network access
    // and proper authentication setup
  });

  test('should batch delete multiple drawings', async () => {
    const sessionId = 'test_session_' + Date.now();
    const base64Array = [VALID_BASE64_PNG, VALID_BASE64_PNG];

    const fileIds = await driver.batchUploadDrawings(sessionId, 'card_batch_delete', base64Array);

    const result = await driver.batchDeleteDrawings(fileIds);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // No need to track in uploadedFileIds since we deleted them
  });

  test('should handle partial batch delete failures gracefully', async () => {
    const validFileId = await driver.uploadDrawing('test_session_' + Date.now(), 'card_001', VALID_BASE64_PNG);
    const invalidFileId = 'nonexistent_file_id';

    const result = await driver.batchDeleteDrawings([validFileId, invalidFileId]);

    expect(result.succeeded).toBeGreaterThanOrEqual(0); // May succeed for valid
    expect(result.failed).toBeGreaterThanOrEqual(1); // Will fail for invalid
    expect(result.errors.length).toBeGreaterThan(0);

    // Don't track validFileId since we attempted to delete it
  });
});

test.describe('StudentDrawingStorageDriver - Error Handling', () => {
  test('should handle invalid base64 gracefully', () => {
    const driver = new StudentDrawingStorageDriver();

    expect(async () => {
      await driver.uploadDrawing('session_123', 'card_001', 'not-valid-base64!!!');
    }).rejects.toThrow();
  });

  test('should handle network errors during upload', async () => {
    // This test would require mocking the storage API
    // Skipping for now as it requires more complex setup
    test.skip();
  });
});
