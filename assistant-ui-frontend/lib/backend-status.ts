/**
 * Backend Availability Checker
 *
 * This module provides fail-fast error handling for backend connectivity.
 * Following the project's anti-pattern policy: NO FALLBACK MECHANISMS
 *
 * Instead of silently degrading or using mock data, we:
 * 1. Check if backend is properly configured
 * 2. Verify backend is reachable
 * 3. Throw detailed errors immediately on failure
 * 4. Log all errors with context for debugging
 *
 * This forces proper deployment workflow and prevents silent failures.
 */

/**
 * Custom error for backend unavailability
 * Includes detailed context for debugging and user messaging
 */
export class BackendUnavailableError extends Error {
  public readonly details?: {
    url?: string;
    status?: number;
    error?: string;
    timestamp?: string;
  };

  constructor(
    message: string = "Backend API is not available",
    details?: {
      url?: string;
      status?: number;
      error?: string;
    }
  ) {
    super(message);
    this.name = "BackendUnavailableError";
    this.details = {
      ...details,
      timestamp: new Date().toISOString(),
    };

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BackendUnavailableError);
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * Get technical details for debugging
   */
  getTechnicalDetails(): string {
    if (!this.details) return "No additional details available";

    const parts: string[] = [];
    if (this.details.url) parts.push(`URL: ${this.details.url}`);
    if (this.details.status) parts.push(`Status: ${this.details.status}`);
    if (this.details.error) parts.push(`Error: ${this.details.error}`);
    if (this.details.timestamp) parts.push(`Time: ${this.details.timestamp}`);

    return parts.join("\n");
  }
}

/**
 * Check if backend API is available and properly configured
 *
 * This function performs the following checks:
 * 1. Validates NEXT_PUBLIC_LANGGRAPH_API_URL is set
 * 2. Rejects localhost URLs in production
 * 3. Performs health check with timeout
 * 4. Throws BackendUnavailableError on ANY failure
 *
 * @throws {BackendUnavailableError} If backend is not available or misconfigured
 */
export async function checkBackendAvailability(): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL;

  // FAIL FAST: Check if URL is configured
  if (!apiUrl) {
    logBackendError("Backend URL not configured", { url: "undefined" });
    throw new BackendUnavailableError(
      "Backend URL is not configured. Set NEXT_PUBLIC_LANGGRAPH_API_URL in Replit Secrets.",
      { url: "undefined", error: "Environment variable not set" }
    );
  }

  // FAIL FAST: Reject localhost URLs in production/Replit
  // This prevents deploying with dev configuration
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");

  if (isLocalhost && isProduction) {
    logBackendError("Localhost URL in production", { url: apiUrl });
    throw new BackendUnavailableError(
      "Cannot use localhost backend URL in production. Please deploy backend and update NEXT_PUBLIC_LANGGRAPH_API_URL.",
      { url: apiUrl, error: "Localhost URL not allowed in production" }
    );
  }

  // Allow localhost in development
  if (isLocalhost && !isProduction) {
    console.log("ℹ️ [Backend Status] Development mode - allowing localhost backend:", apiUrl);
  }

  // FAIL FAST: Perform health check
  try {
    console.log("🔍 [Backend Status] Checking backend availability:", apiUrl);

    const healthEndpoint = `${apiUrl}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(healthEndpoint, {
      method: "GET",
      signal: controller.signal,
      // Add headers to help with CORS
      headers: {
        "Accept": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logBackendError("Backend health check failed", {
        url: apiUrl,
        status: response.status,
      });

      throw new BackendUnavailableError(
        `Backend API returned error status: ${response.status} ${response.statusText}`,
        {
          url: apiUrl,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      );
    }

    // Success!
    console.log("✅ [Backend Status] Backend is available and responding:", apiUrl);

  } catch (error) {
    // Re-throw BackendUnavailableError as-is
    if (error instanceof BackendUnavailableError) {
      throw error;
    }

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      logBackendError("Backend health check timeout", { url: apiUrl });
      throw new BackendUnavailableError(
        "Backend API request timed out after 5 seconds. Check if backend is running and accessible.",
        {
          url: apiUrl,
          error: "Request timeout (5s)",
        }
      );
    }

    // Handle network errors
    if (error instanceof TypeError) {
      logBackendError("Network error connecting to backend", {
        url: apiUrl,
        error: error.message,
      });
      throw new BackendUnavailableError(
        "Cannot connect to backend API. Network error or invalid URL.",
        {
          url: apiUrl,
          error: error.message,
        }
      );
    }

    // Handle any other errors
    logBackendError("Unexpected error checking backend", {
      url: apiUrl,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new BackendUnavailableError(
      "Unexpected error while checking backend availability.",
      {
        url: apiUrl,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

/**
 * Check if backend is available without throwing
 * Returns a result object instead of throwing
 * Useful for conditional rendering
 */
export async function checkBackendStatus(): Promise<{
  available: boolean;
  error?: BackendUnavailableError;
}> {
  try {
    await checkBackendAvailability();
    return { available: true };
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return { available: false, error };
    }
    return {
      available: false,
      error: new BackendUnavailableError(
        "Unknown error checking backend",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      ),
    };
  }
}

/**
 * Log backend errors with consistent formatting
 * Makes errors easy to find in logs
 */
function logBackendError(
  message: string,
  details?: { url?: string; status?: number; error?: string }
): void {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("❌ BACKEND UNAVAILABLE ERROR");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("Message:", message);
  if (details?.url) console.error("URL:", details.url);
  if (details?.status) console.error("Status:", details.status);
  if (details?.error) console.error("Error:", details.error);
  console.error("Timestamp:", new Date().toISOString());
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

/**
 * Get backend URL from environment
 * Returns undefined if not configured
 */
export function getBackendUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_LANGGRAPH_API_URL;
}

/**
 * Check if running in development mode with localhost backend
 */
export function isDevelopmentBackend(): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL;
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = apiUrl?.includes("localhost") || apiUrl?.includes("127.0.0.1");

  return !isProduction && (isLocalhost ?? false);
}
