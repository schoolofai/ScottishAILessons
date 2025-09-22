import { CourseRecommendation, CourseRecommendationSchema } from '../appwrite/schemas';

export interface LangGraphConfig {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * Service wrapper for LangGraph Course Manager interactions
 * Handles configuration, timeout, and error normalization
 */
export class LangGraphService {
  private config: Required<LangGraphConfig>;

  constructor(config: LangGraphConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || process.env.LANGGRAPH_API_URL || 'http://localhost:2024',
      apiKey: config.apiKey || process.env.LANGGRAPH_API_KEY || '',
      timeout: config.timeout || 30000 // 30 seconds
    };

    if (!this.config.apiUrl) {
      throw new Error('LANGGRAPH_API_URL environment variable not configured');
    }
  }

  /**
   * Calls the Course Manager graph with scheduling context
   */
  async getCourseRecommendations(context: any): Promise<CourseRecommendation> {
    try {
      const headers = this.buildHeaders();
      const threadId = this.generateThreadId(context);

      console.log('Calling Course Manager Graph:', {
        threadId,
        courseId: context.course?.courseId,
        studentId: context.student?.$id
      });

      // Create or use existing thread and run the assistant
      const response = await this.runAssistant(threadId, context, headers);
      const recommendation = this.extractRecommendation(response);

      return this.validateRecommendation(recommendation);

    } catch (error) {
      console.error('Course Manager Graph call failed:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Builds HTTP headers for the request
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Generates a thread ID from context
   */
  private generateThreadId(context: any): string {
    const studentId = context.student?.$id || 'unknown';
    const courseId = context.course?.courseId || 'unknown';

    // Create a valid thread ID (UUID format expected by LangGraph)
    // Convert to a deterministic UUID-like format
    const idString = `course-manager-${studentId}-${courseId}`;

    // Replace invalid characters and ensure proper format
    const cleanId = idString
      .replace(/[^a-zA-Z0-9-]/g, '-')  // Replace invalid chars with hyphens
      .replace(/-+/g, '-')             // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')           // Remove leading/trailing hyphens
      .toLowerCase();

    // For now, let's use the clean string - LangGraph might accept non-UUID thread IDs
    return cleanId;
  }

  /**
   * Runs the assistant using LangGraph threads API
   */
  private async runAssistant(
    threadId: string,
    context: any,
    headers: Record<string, string>
  ): Promise<any> {
    // First, create or get the thread
    const thread = await this.ensureThread(threadId, headers);

    // Build the run request body
    const runRequestBody = {
      assistant_id: 'agent', // From langgraph.json
      input: {
        session_context: context,
        mode: 'course_manager'
      },
      stream_mode: ['values'],
      if_not_exists: 'create'
    };

    // Make the run request
    const response = await fetch(`${this.config.apiUrl}/threads/${threadId}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(runRequestBody),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Course Manager Graph error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      throw new Error(`Course Manager request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Ensures thread exists, creates if needed
   */
  private async ensureThread(
    threadId: string,
    headers: Record<string, string>
  ): Promise<any> {
    // Try to get existing thread first
    try {
      const response = await fetch(`${this.config.apiUrl}/threads/${threadId}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // Thread doesn't exist, will create below
    }

    // Create new thread
    const createResponse = await fetch(`${this.config.apiUrl}/threads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: threadId,
        metadata: { source: 'course-manager' }
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create thread: ${createResponse.status}`);
    }

    return await createResponse.json();
  }

  /**
   * Extracts recommendation from LangGraph response
   */
  private extractRecommendation(result: any): any {
    const recommendation = result.course_recommendation || result.output?.course_recommendation;

    if (!recommendation) {
      console.error('No recommendation in LangGraph response:', result);
      throw new Error('Course Manager did not return recommendations');
    }

    return recommendation;
  }

  /**
   * Validates recommendation against schema
   */
  private validateRecommendation(recommendation: any): CourseRecommendation {
    try {
      return CourseRecommendationSchema.parse(recommendation);
    } catch (error) {
      console.error('Invalid recommendation format:', recommendation, error);
      throw new Error('Course Manager returned invalid recommendation format');
    }
  }

  /**
   * Normalizes different types of errors into consistent error messages
   */
  private normalizeError(error: any): Error {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return new Error('Course Manager request timed out');
    }

    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return new Error('Unable to connect to Course Manager service');
    }

    if (error.message?.includes('JSON')) {
      return new Error('Course Manager returned invalid response');
    }

    // Return original error if it's already a well-formed error
    if (error instanceof Error) {
      return error;
    }

    return new Error('Course Manager service error');
  }
}