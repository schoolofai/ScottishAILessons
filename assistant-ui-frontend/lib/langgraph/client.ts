/**
 * LangGraph SDK Client wrapper for direct state reading operations
 */

import { Client } from "@langchain/langgraph-sdk";
import {
  extractRecommendationsFromState,
  getThreadReadinessStatus,
  validateThreadForStateReading,
  type RecommendationsResponse,
  type ThreadReadinessStatus
} from "./state-reading-utils";

export interface LangGraphClientConfig {
  apiUrl?: string;
  timeout?: number;
}

export interface CourseRecommendationRequest {
  courseId: string;
  studentId: string;
  mode?: string;
}

export class LangGraphClient {
  private client: Client;
  private timeout: number;

  constructor(config: LangGraphClientConfig = {}) {
    this.client = new Client({
      apiUrl: config.apiUrl || "http://localhost:2024"
    });
    this.timeout = config.timeout || 5000; // 5 second timeout
  }

  /**
   * Create a new thread for course recommendations
   */
  async createThread(): Promise<{ thread_id: string }> {
    const thread = await this.client.threads.create();
    return { thread_id: thread.thread_id };
  }

  /**
   * Request course recommendations using direct state reading pattern
   */
  async requestRecommendations(
    threadId: string,
    request: CourseRecommendationRequest
  ): Promise<void> {
    const validation = validateThreadForStateReading(threadId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Start recommendations request using direct state update
    await this.client.runs.create(threadId, "agent", {
      input: {
        messages: [
          {
            role: "human",
            content: "I need course lesson recommendations"
          }
        ],
        session_context: {
          request_type: "get_recommendations",
          course: { courseId: request.courseId },
          student: { id: request.studentId }
        },
        mode: request.mode || "planning"
      }
    });
  }

  /**
   * Poll for recommendations until ready or timeout
   */
  async waitForRecommendations(threadId: string): Promise<RecommendationsResponse> {
    const maxAttempts = Math.ceil(this.timeout / 500); // 500ms polling interval
    const pollInterval = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const state = await this.client.threads.getState(threadId);

      if (state.values.recommendations_ready) {
        return extractRecommendationsFromState(state.values);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Recommendations not ready after ${this.timeout}ms timeout`);
  }

  /**
   * Get current thread readiness status
   */
  async getThreadStatus(threadId: string): Promise<ThreadReadinessStatus> {
    const validation = validateThreadForStateReading(threadId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const state = await this.client.threads.getState(threadId);
    return getThreadReadinessStatus(state.values);
  }

  /**
   * Read current state directly (for debugging/advanced use)
   */
  async getState(threadId: string): Promise<Record<string, any>> {
    const validation = validateThreadForStateReading(threadId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const state = await this.client.threads.getState(threadId);
    return state.values;
  }

  /**
   * Complete workflow: request recommendations and wait for completion
   */
  async getRecommendations(
    threadId: string,
    request: CourseRecommendationRequest
  ): Promise<RecommendationsResponse> {
    // Step 1: Request recommendations
    await this.requestRecommendations(threadId, request);

    // Step 2: Wait for completion and extract results
    return await this.waitForRecommendations(threadId);
  }

  /**
   * Request recommendations with complete scheduling context
   */
  async getRecommendationsWithContext(
    threadId: string,
    request: {
      courseId: string;
      studentId: string;
      schedulingContext: Record<string, any>;
    }
  ): Promise<RecommendationsResponse> {
    const validation = validateThreadForStateReading(threadId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Start recommendations request using complete scheduling context
    await this.client.runs.create(threadId, "agent", {
      input: {
        messages: [
          {
            role: "human",
            content: "I need course lesson recommendations"
          }
        ],
        session_context: request.schedulingContext,
        mode: "planning"
      }
    });

    // Wait for completion and extract results
    return await this.waitForRecommendations(threadId);
  }

  /**
   * Start a lesson using the lesson selection context
   */
  async startLesson(
    threadId: string,
    lessonContext: Record<string, any>
  ): Promise<void> {
    const validation = validateThreadForStateReading(threadId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    await this.client.runs.create(threadId, "agent", {
      input: {
        messages: [
          {
            role: "human",
            content: "I want to start this lesson"
          }
        ],
        session_context: lessonContext,
        mode: "teaching"
      }
    });
  }
}

/**
 * Default singleton instance for use in API routes
 */
export const langGraphClient = new LangGraphClient();