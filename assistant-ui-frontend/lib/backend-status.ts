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
 * Custom error for context chat backend unavailability
 * Extends BackendUnavailableError to distinguish context chat failures
 */
export class ContextChatBackendUnavailableError extends BackendUnavailableError {
  constructor(
    message: string = "Context Chat Backend API is not available",
    details?: {
      url?: string;
      status?: number;
      error?: string;
    }
  ) {
    super(message, details);
    this.name = "ContextChatBackendUnavailableError";
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

    // LangGraph uses /ok endpoint for health checks
    const healthEndpoint = `${apiUrl}/ok`;
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
 * Check if context chat backend API is available and properly configured
 *
 * This function performs the following checks for the context chat backend:
 * 1. Validates NEXT_PUBLIC_CONTEXT_CHAT_API_URL is set
 * 2. Rejects localhost URLs in production
 * 3. Performs health check with timeout
 * 4. Throws ContextChatBackendUnavailableError on ANY failure
 *
 * @throws {ContextChatBackendUnavailableError} If context chat backend is not available or misconfigured
 */
export async function checkContextChatBackendAvailability(): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_CONTEXT_CHAT_API_URL;

  // FAIL FAST: Check if URL is configured
  if (!apiUrl) {
    logBackendError("Context chat backend URL not configured", { url: "undefined" });
    throw new ContextChatBackendUnavailableError(
      "Context chat backend URL is not configured. Set NEXT_PUBLIC_CONTEXT_CHAT_API_URL in Replit Secrets.",
      { url: "undefined", error: "Environment variable not set" }
    );
  }

  // FAIL FAST: Reject localhost URLs in production/Replit
  // This prevents deploying with dev configuration
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");

  if (isLocalhost && isProduction) {
    logBackendError("Localhost URL in production (context chat)", { url: apiUrl });
    throw new ContextChatBackendUnavailableError(
      "Cannot use localhost context chat backend URL in production. Please deploy context chat backend and update NEXT_PUBLIC_CONTEXT_CHAT_API_URL.",
      { url: apiUrl, error: "Localhost URL not allowed in production" }
    );
  }

  // Allow localhost in development
  if (isLocalhost && !isProduction) {
    console.log("ℹ️ [Backend Status] Development mode - allowing localhost context chat backend:", apiUrl);
  }

  // FAIL FAST: Perform health check
  try {
    console.log("🔍 [Backend Status] Checking context chat backend availability:", apiUrl);

    // LangGraph uses /ok endpoint for health checks
    const healthEndpoint = `${apiUrl}/ok`;
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
      logBackendError("Context chat backend health check failed", {
        url: apiUrl,
        status: response.status,
      });

      throw new ContextChatBackendUnavailableError(
        `Context chat backend API returned error status: ${response.status} ${response.statusText}`,
        {
          url: apiUrl,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      );
    }

    // Success!
    console.log("✅ [Backend Status] Context chat backend is available and responding:", apiUrl);

  } catch (error) {
    // Re-throw ContextChatBackendUnavailableError as-is
    if (error instanceof ContextChatBackendUnavailableError) {
      throw error;
    }

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      logBackendError("Context chat backend health check timeout", { url: apiUrl });
      throw new ContextChatBackendUnavailableError(
        "Context chat backend API request timed out after 5 seconds. Check if context chat backend is running and accessible.",
        {
          url: apiUrl,
          error: "Request timeout (5s)",
        }
      );
    }

    // Handle network errors
    if (error instanceof TypeError) {
      logBackendError("Network error connecting to context chat backend", {
        url: apiUrl,
        error: error.message,
      });
      throw new ContextChatBackendUnavailableError(
        "Cannot connect to context chat backend API. Network error or invalid URL.",
        {
          url: apiUrl,
          error: error.message,
        }
      );
    }

    // Handle any other errors
    logBackendError("Unexpected error checking context chat backend", {
      url: apiUrl,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ContextChatBackendUnavailableError(
      "Unexpected error while checking context chat backend availability.",
      {
        url: apiUrl,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

/**
 * Check if ALL required backends are available (main + context chat)
 * BOTH backends are REQUIRED for full functionality
 *
 * This function checks both backends in sequence and will throw on the first failure.
 * Use this when you need to ensure complete system availability.
 *
 * @throws {BackendUnavailableError | ContextChatBackendUnavailableError} If any backend is unavailable
 */
export async function checkAllBackendsAvailability(): Promise<void> {
  // Check main backend first
  await checkBackendAvailability();

  // Then check context chat backend
  await checkContextChatBackendAvailability();

  console.log("✅ [Backend Status] All backends are available and responding");
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
 * Check if ALL backends are available without throwing
 * Returns a result object instead of throwing
 * Useful for conditional rendering
 *
 * This checks BOTH main backend AND context chat backend
 */
export async function checkAllBackendsStatus(): Promise<{
  available: boolean;
  error?: BackendUnavailableError | ContextChatBackendUnavailableError;
}> {
  try {
    await checkAllBackendsAvailability();
    return { available: true };
  } catch (error) {
    if (error instanceof BackendUnavailableError || error instanceof ContextChatBackendUnavailableError) {
      return { available: false, error };
    }
    return {
      available: false,
      error: new BackendUnavailableError(
        "Unknown error checking backends",
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
