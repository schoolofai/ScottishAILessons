/**
 * Compression utilities for lesson cards using gzip + base64
 *
 * Reduces database storage requirements by ~70% for JSON card arrays
 * while maintaining backward compatibility with uncompressed data.
 */

import pako from 'pako';

const COMPRESSION_PREFIX = 'gzip:';

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
      console.debug('[compression] Detected TypeScript format (with gzip: prefix)');
      return decompressGzipBase64(data);
    }

    // 2. Try raw base64-gzip (Python format from lesson_upserter.py)
    // Look for base64-like pattern: starts with alphanumeric and all chars are base64-valid
    if (isLikelyBase64(data)) {
      console.debug('[compression] Attempting raw base64-gzip decompression (Python format)');
      try {
        return decompressRawGzipBase64(data);
      } catch (gzipError) {
        console.debug('[compression] Raw gzip decompression failed, trying JSON parsing:', gzipError);
        // If gzip fails, fall through to JSON parsing
      }
    }

    // 3. Fallback: Try parsing as uncompressed JSON (backward compatibility)
    console.debug('[compression] Attempting JSON parsing (uncompressed format)');
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

    console.debug('[compression] Successfully decompressed raw base64-gzip data');
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
    console.debug('[compression] String does not match base64 pattern');
    return false;
  }

  // Additional check: if this looks like JSON, it's probably not compressed
  const trimmed = data.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    console.debug('[compression] String looks like JSON, not compressed');
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
      console.debug('[compression] Detected TypeScript format (with gzip: prefix)');
      return decompressGzipBase64JSON<T>(data);
    }

    // 2. Try raw base64-gzip (Python format)
    if (isLikelyBase64(data)) {
      console.debug('[compression] Attempting raw base64-gzip decompression (Python format)');
      try {
        return decompressRawGzipBase64JSON<T>(data);
      } catch (gzipError) {
        console.debug('[compression] Raw gzip decompression failed, trying JSON parsing:', gzipError);
        // If gzip fails, fall through to JSON parsing
      }
    }

    // 3. Fallback: Try parsing as uncompressed JSON (backward compatibility)
    console.debug('[compression] Attempting JSON parsing (uncompressed format)');
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

    console.debug('[compression] Successfully decompressed raw base64-gzip JSON data');
    return parsed;

  } catch (error) {
    throw new Error(`Raw gzip decompression failed: ${error.message}`);
  }
}
