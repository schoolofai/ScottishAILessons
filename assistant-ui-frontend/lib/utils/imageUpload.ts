/**
 * Image Upload Utilities for Diagram Management
 *
 * Provides validation and conversion utilities for uploading
 * custom diagram images in the admin interface.
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file for diagram upload
 *
 * Checks:
 * - File type (PNG, JPG, JPEG only)
 * - File size (max 5MB)
 *
 * @param file - File object from input
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): ImageValidationResult {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only PNG and JPG images are allowed. Please select a valid image file.'
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Image must be smaller than 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
    };
  }

  return { valid: true };
}

/**
 * Convert file to base64 string
 *
 * @param file - File object to convert
 * @returns Promise resolving to base64 string (data URL format)
 * @throws Error if file reading fails
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file. Please try again.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 data URL to Blob
 *
 * @param base64 - Base64 data URL (e.g., "data:image/png;base64,...")
 * @returns Blob object suitable for upload
 * @throws Error if base64 string is invalid
 */
export function base64ToBlob(base64: string): Blob {
  try {
    // Extract content type and data
    const parts = base64.split(',');
    const contentType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const base64Data = parts[1];

    // Decode base64
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  } catch (error) {
    throw new Error('Invalid base64 string. Cannot convert to blob.');
  }
}

/**
 * Generate deterministic file ID for diagram storage
 *
 * Uses simple hashing to create consistent file IDs that match
 * the backend's diagram generation system.
 *
 * @param templateId - Lesson template ID
 * @param cardId - Card ID
 * @param context - Diagram context ('lesson' or 'cfu')
 * @returns Deterministic file ID string
 */
export function generateDiagramFileId(
  templateId: string,
  cardId: string,
  context: 'lesson' | 'cfu'
): string {
  // Simple hash function (same algorithm as backend)
  const input = `${templateId}_${cardId}_${context}`;
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive hex string (8 characters)
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);

  return `dgm_image_${hashHex}`;
}
