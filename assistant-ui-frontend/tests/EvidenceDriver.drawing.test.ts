/**
 * Unit and Integration Tests for EvidenceDriver Drawing Methods
 * Phase 10: Drawing Storage Migration
 *
 * Tests cover:
 * - getDrawingUrls() with file IDs (new format)
 * - getDrawingUrls() with base64 strings (legacy format)
 * - getDrawingUrls() with JSON array of base64 (legacy multi-image)
 * - hasDrawings() detection
 * - base64ToDataUrl() conversion
 * - Backward compatibility
 *
 * Integration tests use real Appwrite with cleanup
 */

import { test, expect } from '@playwright/test';
import { EvidenceDriver } from '../lib/appwrite/driver/EvidenceDriver';
import { StudentDrawingStorageDriver } from '../lib/appwrite/driver/StudentDrawingStorageDriver';
import type { Evidence } from '../lib/appwrite/types';

// Test data: 1x1 pixel transparent PNG
const VALID_BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_BASE64_DATA_URI = `data:image/png;base64,${VALID_BASE64_PNG}`;

test.describe('EvidenceDriver - Drawing Methods Unit Tests', () => {

  test.describe('getDrawingUrls - NEW format (file IDs)', () => {
    test('should convert file IDs to storage preview URLs', () => {
      // Set up environment variables
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test_project';

      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing_file_ids: ['file_id_1', 'file_id_2']
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain('/storage/buckets/');
      expect(urls[0]).toContain('file_id_1');
      expect(urls[0]).toContain('/preview');
      expect(urls[1]).toContain('file_id_2');
    });

    test('should handle single file ID', () => {
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test_project';

      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing_file_ids: ['file_id_single']
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('file_id_single');
    });

    test('should return empty array for empty file IDs array', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing_file_ids: []
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toEqual([]);
    });
  });

  test.describe('getDrawingUrls - LEGACY format (base64)', () => {
    test('should convert single base64 string to data URL', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing: VALID_BASE64_PNG
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe(`data:image/png;base64,${VALID_BASE64_PNG}`);
    });

    test('should handle base64 that already has data URI prefix', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing: VALID_BASE64_DATA_URI
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe(VALID_BASE64_DATA_URI); // Should not double-prefix
    });

    test('should convert JSON array of base64 strings to data URLs', () => {
      const driver = new EvidenceDriver();
      const base64Array = [VALID_BASE64_PNG, VALID_BASE64_PNG, VALID_BASE64_PNG];
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing: JSON.stringify(base64Array)
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toHaveLength(3);
      urls.forEach(url => {
        expect(url).toContain('data:image/png;base64,');
      });
    });

    test('should handle malformed JSON gracefully (treat as single string)', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing: '{not-valid-json'
      };

      const urls = driver.getDrawingUrls(evidence);

      // Should treat as single base64 string
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('data:image/png;base64,');
    });
  });

  test.describe('Priority: File IDs over base64', () => {
    test('should prefer file IDs when both formats present', () => {
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test_project';

      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing_file_ids: ['file_id_new'],
        student_drawing: VALID_BASE64_PNG // Legacy format also present
      };

      const urls = driver.getDrawingUrls(evidence);

      // Should use new format (file IDs)
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('/storage/buckets/');
      expect(urls[0]).toContain('file_id_new');
      expect(urls[0]).not.toContain('data:image/png');
    });
  });

  test.describe('No drawings', () => {
    test('should return empty array when no drawings present', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true
        // No drawing fields
      };

      const urls = driver.getDrawingUrls(evidence);

      expect(urls).toEqual([]);
    });
  });

  test.describe('hasDrawings detection', () => {
    test('should detect file IDs', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing_file_ids: ['file_id_1']
      };

      expect(driver.hasDrawings(evidence)).toBe(true);
    });

    test('should detect base64 string', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing: VALID_BASE64_PNG
      };

      expect(driver.hasDrawings(evidence)).toBe(true);
    });

    test('should return false when no drawings', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true
      };

      expect(driver.hasDrawings(evidence)).toBe(false);
    });

    test('should return false for empty file IDs array', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing_file_ids: []
      };

      expect(driver.hasDrawings(evidence)).toBe(false);
    });

    test('should return false for empty base64 string', () => {
      const driver = new EvidenceDriver();
      const evidence: Evidence = {
        $id: 'evidence_123',
        $createdAt: '2024-01-01T00:00:00.000Z',
        $updatedAt: '2024-01-01T00:00:00.000Z',
        sessionId: 'session_123',
        itemId: 'item_001',
        response: 'Student answer',
        correct: true,
        student_drawing: ''
      };

      expect(driver.hasDrawings(evidence)).toBe(false);
    });
  });

  test.describe('base64ToDataUrl - private method', () => {
    test('should add data URI prefix to raw base64', () => {
      const driver = new EvidenceDriver();
      const dataUrl = (driver as any).base64ToDataUrl(VALID_BASE64_PNG);

      expect(dataUrl).toBe(`data:image/png;base64,${VALID_BASE64_PNG}`);
    });

    test('should not double-prefix existing data URIs', () => {
      const driver = new EvidenceDriver();
      const dataUrl = (driver as any).base64ToDataUrl(VALID_BASE64_DATA_URI);

      expect(dataUrl).toBe(VALID_BASE64_DATA_URI);
      expect(dataUrl.match(/data:image\/png;base64,/g)).toHaveLength(1); // Only one prefix
    });
  });
});

test.describe('EvidenceDriver - Drawing Integration Tests', () => {
  let evidenceDriver: EvidenceDriver;
  let storageDriver: StudentDrawingStorageDriver;
  let createdEvidenceIds: string[] = [];
  let uploadedFileIds: string[] = [];

  test.beforeEach(() => {
    evidenceDriver = new EvidenceDriver();
    storageDriver = new StudentDrawingStorageDriver();
    createdEvidenceIds = [];
    uploadedFileIds = [];
  });

  test.afterEach(async () => {
    // CRITICAL: Clean up test data
    console.log(`[CLEANUP] Deleting ${createdEvidenceIds.length} evidence records...`);

    for (const evidenceId of createdEvidenceIds) {
      try {
        await evidenceDriver.deleteEvidence(evidenceId);
        console.log(`[CLEANUP] Deleted evidence: ${evidenceId}`);
      } catch (error) {
        console.error(`[CLEANUP] Failed to delete evidence ${evidenceId}:`, error.message);
      }
    }

    console.log(`[CLEANUP] Deleting ${uploadedFileIds.length} storage files...`);

    for (const fileId of uploadedFileIds) {
      try {
        await storageDriver.deleteDrawing(fileId);
        console.log(`[CLEANUP] Deleted file: ${fileId}`);
      } catch (error) {
        console.error(`[CLEANUP] Failed to delete file ${fileId}:`, error.message);
      }
    }

    createdEvidenceIds = [];
    uploadedFileIds = [];
    console.log('[CLEANUP] Cleanup complete');
  });

  test('should store and retrieve evidence with file IDs (NEW format)', async () => {
    const sessionId = 'test_session_' + Date.now();
    const cardId = 'test_card_001';

    // Upload drawing to storage
    const fileId = await storageDriver.uploadDrawing(sessionId, cardId, VALID_BASE64_PNG);
    uploadedFileIds.push(fileId);

    // Create evidence with file ID
    const evidence = await evidenceDriver.recordEvidence({
      sessionId,
      itemId: cardId,
      response: 'Test answer',
      correct: true,
      student_drawing_file_ids: [fileId]
    });
    createdEvidenceIds.push(evidence.$id);

    // Retrieve and verify
    const retrieved = await evidenceDriver.getEvidence(evidence.$id);

    expect(retrieved.student_drawing_file_ids).toEqual([fileId]);

    // Get drawing URLs
    const urls = evidenceDriver.getDrawingUrls(retrieved);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(fileId);
    expect(urls[0]).toContain('/storage/buckets/');
  });

  test('should store and retrieve evidence with base64 (LEGACY format)', async () => {
    const sessionId = 'test_session_' + Date.now();

    // Create evidence with legacy base64
    const evidence = await evidenceDriver.recordEvidence({
      sessionId,
      itemId: 'card_legacy',
      response: 'Test answer',
      correct: true,
      student_drawing: VALID_BASE64_PNG
    });
    createdEvidenceIds.push(evidence.$id);

    // Retrieve and verify
    const retrieved = await evidenceDriver.getEvidence(evidence.$id);

    expect(retrieved.student_drawing).toBe(VALID_BASE64_PNG);

    // Get drawing URLs (should convert to data URL)
    const urls = evidenceDriver.getDrawingUrls(retrieved);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(`data:image/png;base64,${VALID_BASE64_PNG}`);
  });

  test('should retrieve session evidence and convert all drawing formats', async () => {
    const sessionId = 'test_session_' + Date.now();

    // Create evidence with NEW format (file IDs)
    const fileId = await storageDriver.uploadDrawing(sessionId, 'card_001', VALID_BASE64_PNG);
    uploadedFileIds.push(fileId);

    const evidence1 = await evidenceDriver.recordEvidence({
      sessionId,
      itemId: 'card_001',
      response: 'Answer 1',
      correct: true,
      student_drawing_file_ids: [fileId]
    });
    createdEvidenceIds.push(evidence1.$id);

    // Create evidence with LEGACY format (base64)
    const evidence2 = await evidenceDriver.recordEvidence({
      sessionId,
      itemId: 'card_002',
      response: 'Answer 2',
      correct: false,
      student_drawing: VALID_BASE64_PNG
    });
    createdEvidenceIds.push(evidence2.$id);

    // Retrieve all evidence for session
    const allEvidence = await evidenceDriver.getSessionEvidence(sessionId);

    expect(allEvidence).toHaveLength(2);

    // Verify NEW format
    const urls1 = evidenceDriver.getDrawingUrls(allEvidence[0]);
    expect(urls1).toHaveLength(1);
    expect(urls1[0]).toContain('/storage/buckets/');

    // Verify LEGACY format
    const urls2 = evidenceDriver.getDrawingUrls(allEvidence[1]);
    expect(urls2).toHaveLength(1);
    expect(urls2[0]).toContain('data:image/png;base64,');
  });

  test('should handle evidence with no drawings', async () => {
    const sessionId = 'test_session_' + Date.now();

    const evidence = await evidenceDriver.recordEvidence({
      sessionId,
      itemId: 'card_no_drawing',
      response: 'Text answer only',
      correct: true
    });
    createdEvidenceIds.push(evidence.$id);

    const urls = evidenceDriver.getDrawingUrls(evidence);

    expect(urls).toEqual([]);
    expect(evidenceDriver.hasDrawings(evidence)).toBe(false);
  });
});
