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
