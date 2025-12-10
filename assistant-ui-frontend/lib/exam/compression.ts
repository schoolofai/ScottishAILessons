/**
 * Mock Exam Compression Utilities
 *
 * Provides functions to decompress mock exam data stored in Appwrite.
 * Re-exports and wraps the generic compression utilities for exam-specific use.
 *
 * Database Schema (mock_exams collection):
 * - examId: string - Exam identifier
 * - courseId: string - Course identifier
 * - metadata: string - JSON string with ExamMetadata
 * - sections: string - gzip compressed JSON array of Section[] (prefixed with "gzip:")
 * - status: string - 'draft' | 'published' | 'archived'
 */

import { decompressJSON } from '@/lib/appwrite/utils/compression';
import type { MockExam, ExamMetadata, Section } from './types';

/**
 * Decompress a mock exam document from Appwrite
 *
 * The database stores exam data in separate fields:
 * - metadata: JSON string of ExamMetadata
 * - sections: gzip compressed JSON array of Section[]
 *
 * This function reconstructs the full MockExam object from these fields.
 *
 * @param document - The raw document from Appwrite's mock_exams collection
 * @returns The decompressed MockExam object
 * @throws Error if decompression fails
 */
export function decompressMockExam(document: any): MockExam {
  if (!document) {
    throw new Error('Document is required for decompression');
  }

  // Extract examId and courseId from document
  const examId = document.examId;
  const courseId = document.courseId;

  if (!examId) {
    throw new Error('Document does not contain examId field');
  }
  if (!courseId) {
    throw new Error('Document does not contain courseId field');
  }

  // Parse metadata from JSON string
  const metadataStr = document.metadata;
  if (!metadataStr) {
    throw new Error('Document does not contain metadata field');
  }

  let metadata: ExamMetadata;
  try {
    metadata = typeof metadataStr === 'string' ? JSON.parse(metadataStr) : metadataStr;
  } catch (e) {
    throw new Error(`Failed to parse metadata JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Decompress sections from gzip compressed JSON
  const sectionsStr = document.sections;
  if (!sectionsStr) {
    throw new Error('Document does not contain sections field');
  }

  // Decompress the sections array
  const sections = decompressJSON<Section[]>(sectionsStr);

  if (!sections) {
    throw new Error('Failed to decompress sections - result was null');
  }

  if (!Array.isArray(sections)) {
    throw new Error('Decompressed sections is not an array');
  }

  // Construct and return the full MockExam object
  const exam: MockExam = {
    examId,
    courseId,
    metadata,
    sections,
  };

  // Validate required metadata fields
  if (!exam.metadata.title || exam.metadata.totalMarks === undefined) {
    throw new Error('Exam metadata is missing required fields (title or totalMarks)');
  }

  return exam;
}

/**
 * Re-export generic compression utilities for exam-specific use
 */
export { decompressJSON, compressJSON } from '@/lib/appwrite/utils/compression';
