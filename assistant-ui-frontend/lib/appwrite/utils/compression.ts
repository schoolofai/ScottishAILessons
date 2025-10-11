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
    // Check if data is compressed (has prefix)
    if (data.startsWith(COMPRESSION_PREFIX)) {
      return decompressGzipBase64(data);
    } else {
      // Fallback: Try parsing as uncompressed JSON
      return parseUncompressed(data);
    }

  } catch (error) {
    console.error('[compression] Failed to decompress/parse cards:', error);
    console.error('[compression] Data preview:', data.substring(0, 100));
    throw new Error(`Card decompression failed: ${error.message}`);
  }
}

/**
 * Decompress gzipped base64 string
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
 * - Compressed data (has "gzip:" prefix)
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
    // Check if data is compressed (has prefix)
    if (data.startsWith(COMPRESSION_PREFIX)) {
      return decompressGzipBase64JSON<T>(data);
    } else {
      // Fallback: Try parsing as uncompressed JSON (backward compatibility)
      return JSON.parse(data);
    }

  } catch (error) {
    console.error('[compression] Failed to decompress/parse JSON:', error);
    console.error('[compression] Data preview:', data.substring(0, 100));
    throw new Error(`JSON decompression failed: ${error.message}`);
  }
}

/**
 * Internal: Decompress gzipped base64 JSON string
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
