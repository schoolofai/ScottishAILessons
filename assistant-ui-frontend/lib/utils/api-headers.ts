/**
 * Utility function to create standard API response headers.
 *
 * Provides consistent headers for all API responses.
 */
export function createApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}
