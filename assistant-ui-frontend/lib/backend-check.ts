/**
 * Backend availability check utility
 *
 * Checks if the LangGraph backend is available before starting a session.
 */

const BACKEND_CHECK_TIMEOUT = 5000;

export class BackendUnavailableError extends Error {
  constructor(message: string = "Practice backend is unavailable") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export interface BackendCheckResult {
  available: boolean;
  message?: string;
}

/**
 * Check if the LangGraph practice backend is available
 * Pings the backend health endpoint or threads endpoint
 */
export async function checkBackendAvailable(): Promise<BackendCheckResult> {
  const backendUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_CHECK_TIMEOUT);

    // Try to reach the backend's OpenAPI docs endpoint (always available)
    const response = await fetch(`${backendUrl}/docs`, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok || response.status === 200 || response.status === 405) {
      // 405 Method Not Allowed is fine - it means the endpoint exists
      return { available: true };
    }

    return {
      available: false,
      message: `Backend returned status ${response.status}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        available: false,
        message: "Backend connection timed out",
      };
    }

    return {
      available: false,
      message: error instanceof Error ? error.message : "Failed to connect to backend",
    };
  }
}
