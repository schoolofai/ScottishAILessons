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
      const requestBody = this.buildRequestBody(context);

      console.log('Calling Course Manager Graph:', {
        url: `${this.config.apiUrl}/invoke`,
        courseId: context.course?.courseId,
        studentId: context.student?.id
      });

      const response = await this.makeRequest(requestBody, headers);
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
   * Builds the request body for LangGraph
   */
  private buildRequestBody(context: any): object {
    return {
      input: {
        session_context: context,
        mode: 'course_manager'
      },
      config: {
        configurable: {
          thread_id: `course-manager-${context.student?.id}-${context.course?.courseId}`
        }
      }
    };
  }

  /**
   * Makes the HTTP request with timeout handling
   */
  private async makeRequest(
    requestBody: object,
    headers: Record<string, string>
  ): Promise<any> {
    const response = await fetch(`${this.config.apiUrl}/invoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
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