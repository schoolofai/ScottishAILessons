/**
 * Compression utilities for lesson cards using gzip + base64
 *
 * Reduces database storage requirements by ~70% for JSON card arrays
 * while maintaining backward compatibility with uncompressed data.
 */

import pako from 'pako';
import { Storage } from 'appwrite';

const COMPRESSION_PREFIX = 'gzip:';
const STORAGE_PREFIX = 'storage:';
const STORAGE_BUCKET_ID = 'authored_sow_entries';

/**
 * Compress cards array to gzipped base64 string
 *
 * @param cards - Array of lesson card objects
 * @returns Compressed string with prefix marker
 * @throws Error if compression fails
 */
export function compressCards(cards: any[]): string {
  try {
    if (!Array.isArray(cards)) {
      throw new Error('Cards must be an array');
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(cards);

    // Compress using gzip
    const compressed = pako.gzip(jsonString);

    // Convert to base64
    const base64 = Buffer.from(compressed).toString('base64');

    // Add prefix marker for identification
    return COMPRESSION_PREFIX + base64;

  } catch (error) {
    console.error('[compression] Failed to compress cards:', error);
    throw new Error(`Card compression failed: ${error.message}`);
  }
}

/**
 * Decompress cards string to array with backward compatibility
 *
 * Handles three formats:
 * 1. TypeScript format: "gzip:" prefix + base64-encoded gzip
 * 2. Python format: raw base64-encoded gzip (no prefix) - from lesson_upserter.py
 * 3. Backward compatibility: uncompressed JSON string
 *
 * @param data - Compressed or uncompressed cards data
 * @returns Parsed cards array
 * @throws Error if decompression/parsing fails
 */
export function decompressCards(data: string | any[] | null | undefined): any[] {
  // Handle null/undefined
  if (!data) {
    console.warn('[compression] Received null/undefined cards data');
    return [];
  }

  // Handle already-parsed arrays
  if (Array.isArray(data)) {
    return data;
  }

  // Handle non-string data
  if (typeof data !== 'string') {
    console.warn('[compression] Unexpected cards data type:', typeof data);
    return [];
  }

  try {
    // Try in order of priority:

    // 1. Check if data has TypeScript compression prefix
    if (data.startsWith(COMPRESSION_PREFIX)) {
      return decompressGzipBase64(data);
    }

    // 2. Try raw base64-gzip (Python format from lesson_upserter.py)
    // Look for base64-like pattern: starts with alphanumeric and all chars are base64-valid
    if (isLikelyBase64(data)) {
      try {
        return decompressRawGzipBase64(data);
      } catch {
        // If gzip fails, fall through to JSON parsing
      }
    }

    // 3. Fallback: Try parsing as uncompressed JSON (backward compatibility)
    return parseUncompressed(data);

  } catch (error) {
    console.error('[compression] Failed to decompress/parse cards:', error);
    console.error('[compression] Data preview:', data.substring(0, Math.min(100, data.length)));
    throw new Error(`Card decompression failed: ${error.message}`);
  }
}

/**
 * Decompress gzipped base64 string (with "gzip:" prefix)
 */
function decompressGzipBase64(data: string): any[] {
  try {
    // Remove prefix
    const base64Data = data.substring(COMPRESSION_PREFIX.length);

    // Decode base64
    const compressedBuffer = Buffer.from(base64Data, 'base64');

    // Decompress gzip
    const decompressed = pako.ungzip(compressedBuffer, { to: 'string' });

    // Parse JSON
    const cards = JSON.parse(decompressed);

    if (!Array.isArray(cards)) {
      throw new Error('Decompressed data is not an array');
    }

    return cards;

  } catch (error) {
    throw new Error(`Gzip decompression failed: ${error.message}`);
  }
}

/**
 * Decompress raw gzipped base64 string (without prefix)
 * Used for Python-generated compressed data from lesson_upserter.py
 */
function decompressRawGzipBase64(data: string): any[] {
  try {
    // Decode base64 directly (no prefix to remove)
    const compressedBuffer = Buffer.from(data, 'base64');

    // Decompress gzip
    const decompressed = pako.ungzip(compressedBuffer, { to: 'string' });

    // Parse JSON
    const cards = JSON.parse(decompressed);

    if (!Array.isArray(cards)) {
      throw new Error('Decompressed data is not an array');
    }

    return cards;

  } catch (error) {
    throw new Error(`Raw gzip decompression failed: ${error.message}`);
  }
}

/**
 * Check if a string looks like base64-encoded data
 * Base64 only uses: A-Z, a-z, 0-9, +, /, and = for padding
 */
function isLikelyBase64(data: string): boolean {
  // Must be at least 4 characters (minimum valid base64)
  if (data.length < 4) return false;

  // Check if string matches base64 pattern
  // Allow optional padding at the end
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  const matches = base64Regex.test(data);

  if (!matches) {
    return false;
  }

  // Additional check: if this looks like JSON, it's probably not compressed
  const trimmed = data.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    return false;
  }

  return true;
}

/**
 * Parse uncompressed JSON string (backward compatibility)
 */
function parseUncompressed(data: string): any[] {
  try {
    const cards = JSON.parse(data);

    if (!Array.isArray(cards)) {
      throw new Error('Parsed data is not an array');
    }

    return cards;

  } catch (error) {
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

/**
 * Check if data is compressed
 */
export function isCompressed(data: string): boolean {
  return typeof data === 'string' && data.startsWith(COMPRESSION_PREFIX);
}

/**
 * Get compression stats for debugging
 */
export function getCompressionStats(cards: any[]): {
  original: number;
  compressed: number;
  ratio: string;
  savings: string;
} {
  const originalJson = JSON.stringify(cards);
  const compressedData = compressCards(cards);

  const original = originalJson.length;
  const compressed = compressedData.length;
  const ratio = ((compressed / original) * 100).toFixed(1);
  const savings = ((1 - compressed / original) * 100).toFixed(1);

  return {
    original,
    compressed,
    ratio: `${ratio}%`,
    savings: `${savings}%`
  };
}

/**
 * Compress any JSON-serializable data to gzipped base64 string
 *
 * Generic version of compressCards for any data type.
 * Used for compressing lesson snapshots and other large JSON objects.
 *
 * @param data - Any JSON-serializable object
 * @returns Compressed string with "gzip:" prefix
 * @throws Error if compression fails
 */
export function compressJSON(data: any): string {
  try {
    // Validate input
    if (data === null || data === undefined) {
      throw new Error('Cannot compress null/undefined data');
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(data);

    // Compress using gzip (same as compressCards)
    const compressed = pako.gzip(jsonString);

    // Convert to base64
    const base64 = Buffer.from(compressed).toString('base64');

    // Add prefix marker for identification
    return COMPRESSION_PREFIX + base64;

  } catch (error) {
    console.error('[compression] Failed to compress JSON:', error);
    throw new Error(`JSON compression failed: ${error.message}`);
  }
}

/**
 * Decompress JSON data with backward compatibility
 *
 * Generic version of decompressCards for any data type.
 * Used for decompressing lesson snapshots and other large JSON objects.
 *
 * Handles:
 * - TypeScript format: "gzip:" prefix + base64-encoded gzip
 * - Python format: raw base64-encoded gzip (no prefix)
 * - Uncompressed JSON strings (backward compatibility)
 * - Already-parsed objects (pass-through)
 * - Null/undefined (returns null)
 *
 * @param data - Compressed/uncompressed data or parsed object
 * @returns Parsed object or null
 * @throws Error if decompression/parsing fails
 */
export function decompressJSON<T = any>(data: string | any | null | undefined): T | null {
  // Handle null/undefined
  if (data === null || data === undefined) {
    console.warn('[compression] Received null/undefined data');
    return null;
  }

  // Handle already-parsed objects (backward compatibility edge case)
  if (typeof data === 'object' && !Array.isArray(data)) {
    console.warn('[compression] Received already-parsed object, returning as-is');
    return data;
  }

  // Handle non-string data
  if (typeof data !== 'string') {
    console.warn('[compression] Unexpected data type:', typeof data);
    return null;
  }

  try {
    // Try in order of priority:

    // 1. Check if data has TypeScript compression prefix
    if (data.startsWith(COMPRESSION_PREFIX)) {
      return decompressGzipBase64JSON<T>(data);
    }

    // 2. Try raw base64-gzip (Python format)
    if (isLikelyBase64(data)) {
      try {
        return decompressRawGzipBase64JSON<T>(data);
      } catch {
        // If gzip fails, fall through to JSON parsing
      }
    }

    // 3. Fallback: Try parsing as uncompressed JSON (backward compatibility)
    return JSON.parse(data);

  } catch (error) {
    console.error('[compression] Failed to decompress/parse JSON:', error);
    console.error('[compression] Data preview:', data.substring(0, Math.min(100, data.length)));
    throw new Error(`JSON decompression failed: ${error.message}`);
  }
}

/**
 * Internal: Decompress gzipped base64 JSON string (with prefix)
 */
function decompressGzipBase64JSON<T>(data: string): T {
  try {
    // Remove prefix
    const base64Data = data.substring(COMPRESSION_PREFIX.length);

    // Decode base64
    const compressedBuffer = Buffer.from(base64Data, 'base64');

    // Decompress gzip
    const decompressed = pako.ungzip(compressedBuffer, { to: 'string' });

    // Parse JSON
    const parsed = JSON.parse(decompressed);

    return parsed;

  } catch (error) {
    throw new Error(`Gzip decompression failed: ${error.message}`);
  }
}

/**
 * Internal: Decompress raw gzipped base64 JSON string (without prefix)
 * Used for Python-generated compressed data
 */
function decompressRawGzipBase64JSON<T>(data: string): T {
  try {
    // Decode base64 directly (no prefix to remove)
    const compressedBuffer = Buffer.from(data, 'base64');

    // Decompress gzip
    const decompressed = pako.ungzip(compressedBuffer, { to: 'string' });

    // Parse JSON
    const parsed = JSON.parse(decompressed);

    return parsed;

  } catch (error) {
    throw new Error(`Raw gzip decompression failed: ${error.message}`);
  }
}

/**
 * Check if data is a storage bucket reference
 *
 * Storage references have the format: "storage:<file_id>"
 * where file_id is the Appwrite storage file ID.
 */
export function isStorageRef(data: string): boolean {
  return typeof data === 'string' && data.startsWith(STORAGE_PREFIX);
}

/**
 * Extract file ID from storage reference
 *
 * @param data - Storage reference string (e.g., "storage:abc123")
 * @returns File ID (e.g., "abc123")
 */
export function getStorageFileId(data: string): string {
  if (!isStorageRef(data)) {
    throw new Error('Data is not a storage reference');
  }
  return data.substring(STORAGE_PREFIX.length);
}

/**
 * Decompress JSON data with storage bucket support
 *
 * **ASYNC** version of decompressJSON that handles storage bucket references.
 * Use this when the data might be stored in Appwrite Storage (for large entries).
 *
 * Handles:
 * - Storage bucket: "storage:<file_id>" - fetches from storage, then decompresses
 * - TypeScript format: "gzip:" prefix + base64-encoded gzip
 * - Python format: raw base64-encoded gzip (no prefix)
 * - Uncompressed JSON strings (backward compatibility)
 * - Already-parsed objects (pass-through)
 * - Null/undefined (returns null)
 *
 * @param data - Compressed/uncompressed data, storage ref, or parsed object
 * @param storage - Appwrite Storage client (required for storage refs)
 * @returns Parsed object or null
 * @throws Error if decompression/parsing/fetching fails
 */
export async function decompressJSONWithStorage<T = any>(
  data: string | any | null | undefined,
  storage?: Storage
): Promise<T | null> {
  // Handle null/undefined
  if (data === null || data === undefined) {
    console.warn('[compression] Received null/undefined data');
    return null;
  }

  // Handle already-parsed objects (backward compatibility edge case)
  if (typeof data === 'object' && !Array.isArray(data)) {
    console.warn('[compression] Received already-parsed object, returning as-is');
    return data;
  }

  // Handle non-string data
  if (typeof data !== 'string') {
    console.warn('[compression] Unexpected data type:', typeof data);
    return null;
  }

  // Check for storage bucket reference FIRST
  if (isStorageRef(data)) {
    const fileId = getStorageFileId(data);
    console.log(`[compression] 📦 Fetching entries from storage: ${fileId}`);

    if (!storage) {
      throw new Error(
        'Storage client required to fetch storage-backed entries. ' +
        'Pass the Appwrite Storage client to decompressJSONWithStorage().'
      );
    }

    try {
      // Fetch file from storage bucket
      // Browser SDK returns a URL, server SDK returns bytes
      const fileResponse = storage.getFileDownload(STORAGE_BUCKET_ID, fileId);

      if (!fileResponse) {
        throw new Error(`Storage returned null/undefined for file ID: ${fileId}`);
      }

      let compressedString: string;

      // In browser SDK, getFileDownload returns a URL string
      // We need to fetch the actual content from that URL
      if (typeof fileResponse === 'string' && fileResponse.startsWith('http')) {
        console.log(`[compression] Fetching from URL: ${fileResponse.substring(0, 50)}...`);
        const response = await fetch(fileResponse);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        compressedString = await response.text();
      } else if (typeof fileResponse === 'object' && 'then' in fileResponse) {
        // Server SDK returns a Promise<ArrayBuffer>
        const buffer = await (fileResponse as Promise<ArrayBuffer>);
        compressedString = new TextDecoder().decode(buffer);
      } else if (typeof fileResponse === 'string') {
        // Direct string content
        compressedString = fileResponse;
      } else {
        throw new Error(`Unexpected response type from getFileDownload: ${typeof fileResponse}`);
      }

      console.log(`[compression] ✓ Downloaded ${compressedString.length} chars from storage`);

      // The stored data is gzip+base64 compressed (same format as inline)
      // It might have the "gzip:" prefix or be raw base64
      return decompressJSON<T>(compressedString);

    } catch (error: any) {
      console.error(`[compression] Failed to fetch from storage: ${error}`);
      throw new Error(
        `Failed to fetch entries from storage bucket '${STORAGE_BUCKET_ID}', ` +
        `file ID '${fileId}': ${error.message || error}`
      );
    }
  }

  // Not a storage ref - delegate to sync decompressJSON
  return decompressJSON<T>(data);
}

/**
 * Storage bucket constants (exported for drivers that need them)
 */
export { STORAGE_PREFIX, STORAGE_BUCKET_ID };
