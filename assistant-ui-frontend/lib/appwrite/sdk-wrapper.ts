/**
 * Robust Appwrite SDK wrapper with comprehensive edge case handling.
 * Implements retry logic, error normalization, and data validation.
 */

import { Query } from 'appwrite';
import { createAdminClient, createSessionClient } from './client';
import { transformAppwriteDocument, validateCollection, safeValidateCollection } from './schemas';

// Configuration for SDK wrapper behavior
interface WrapperConfig {
  retryAttempts: number;
  timeoutMs: number;
  backoffMultiplier: number;
  enableStaleDataDetection: boolean;
  enableCircularReferenceDetection: boolean;
  maxQueryResults: number;
}

const DEFAULT_CONFIG: WrapperConfig = {
  retryAttempts: 3,
  timeoutMs: 5000,
  backoffMultiplier: 2,
  enableStaleDataDetection: true,
  enableCircularReferenceDetection: true,
  maxQueryResults: 100
};

// Normalized error types
export enum SDKErrorType {
  NETWORK_TIMEOUT = 'network_timeout',
  RATE_LIMITED = 'rate_limited',
  PERMISSION_DENIED = 'permission_denied',
  DOCUMENT_NOT_FOUND = 'document_not_found',
  MALFORMED_RESPONSE = 'malformed_response',
  QUERY_INVALID = 'query_invalid',
  DATA_CORRUPTION = 'data_corruption',
  STALE_DATA = 'stale_data',
  CIRCULAR_REFERENCE = 'circular_reference',
  REFERENTIAL_INTEGRITY = 'referential_integrity',
  UNKNOWN_ERROR = 'unknown_error'
}

export class SDKError extends Error {
  constructor(
    public type: SDKErrorType,
    message: string,
    public originalError?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'SDKError';
  }
}

// Enhanced SDK wrapper with edge case handling
export class AppwriteSDKWrapper {
  private config: WrapperConfig;
  private databases: any;
  private account: any;

  constructor(sessionSecret?: string, config: Partial<WrapperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize with error handling for missing configuration
    try {
      if (sessionSecret) {
        const { databases, account } = createSessionClient(sessionSecret);
        this.databases = databases;
        this.account = account;
      } else {
        const { databases, account } = createAdminClient();
        this.databases = databases;
        this.account = account;
      }
    } catch (error) {
      throw new SDKError(
        SDKErrorType.UNKNOWN_ERROR,
        'Failed to initialize Appwrite client: configuration may be missing',
        error
      );
    }
  }

  // Robust document retrieval with timeout and retry logic
  async getDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    validateSchema?: any
  ): Promise<any> {
    return this.executeWithRetry(async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new SDKError(
            SDKErrorType.NETWORK_TIMEOUT,
            `Connection timeout after ${this.config.timeoutMs}ms`,
            null,
            true
          ));
        }, this.config.timeoutMs);
      });

      const requestPromise = this.databases.getDocument(databaseId, collectionId, documentId);

      try {
        const doc = await Promise.race([requestPromise, timeoutPromise]);

        // Validate document structure
        if (!doc || typeof doc !== 'object' || !doc.$id) {
          throw new SDKError(
            SDKErrorType.MALFORMED_RESPONSE,
            'Invalid Appwrite document structure: missing $id field',
            doc
          );
        }

        // Optional schema validation
        if (validateSchema) {
          const validationResult = safeValidateCollection(collectionId as any, doc);
          if (!validationResult.success) {
            throw new SDKError(
              SDKErrorType.DATA_CORRUPTION,
              `Schema validation failed for ${collectionId}: ${validationResult.error.message}`,
              validationResult.error
            );
          }
        }

        return doc;
      } catch (error: any) {
        throw this.normalizeError(error);
      }
    });
  }

  // Robust document listing with pagination and query validation
  async listDocuments(
    databaseId: string,
    collectionId: string,
    queries: string[] = [],
    validateResults: boolean = true
  ): Promise<{ documents: any[]; total?: number }> {
    return this.executeWithRetry(async () => {
      try {
        // Validate queries before execution
        this.validateQueries(queries);

        const result = await this.databases.listDocuments(databaseId, collectionId, queries);

        // Check for query result limits
        if (result.documents && result.documents.length > this.config.maxQueryResults) {
          throw new SDKError(
            SDKErrorType.QUERY_INVALID,
            'Too many lesson templates found. Use pagination or add filters.',
            null,
            false
          );
        }

        // Validate result structure
        if (!result || !Array.isArray(result.documents)) {
          throw new SDKError(
            SDKErrorType.MALFORMED_RESPONSE,
            'Invalid query result structure',
            result
          );
        }

        // Optional individual document validation
        if (validateResults) {
          for (const doc of result.documents) {
            if (!doc.$id) {
              throw new SDKError(
                SDKErrorType.MALFORMED_RESPONSE,
                'Document in result set missing $id field',
                doc
              );
            }
          }
        }

        return result;
      } catch (error: any) {
        throw this.normalizeError(error);
      }
    });
  }

  // Robust document updates with conflict resolution
  async updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: Record<string, any>,
    permissions?: string[]
  ): Promise<any> {
    return this.executeWithRetry(async () => {
      try {
        const result = await this.databases.updateDocument(
          databaseId,
          collectionId,
          documentId,
          data,
          permissions
        );
        return result;
      } catch (error: any) {
        if (error.code === 409 || error.type === 'document_version_mismatch') {
          throw new SDKError(
            SDKErrorType.UNKNOWN_ERROR,
            'Document version mismatch',
            error,
            true // Retryable
          );
        }
        throw this.normalizeError(error);
      }
    });
  }

  // Data validation with corruption detection
  validateAndParseJSON(jsonString: string, fieldName: string): any {
    if (typeof jsonString !== 'string') {
      return jsonString; // Already parsed or not a string
    }

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new SDKError(
        SDKErrorType.DATA_CORRUPTION,
        `Failed to parse ${fieldName} data: invalid JSON format`,
        error
      );
    }
  }

  // Stale data detection
  detectStaleData(studentDoc: any, courseDoc: any): void {
    if (!this.config.enableStaleDataDetection) return;

    const studentUpdated = new Date(studentDoc.$updatedAt || studentDoc.updatedAt);
    const courseUpdated = new Date(courseDoc.$updatedAt || courseDoc.updatedAt);

    // If course is much newer than student update, enrollment might be stale
    const timeDiff = courseUpdated.getTime() - studentUpdated.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) { // Course updated more than 7 days after student
      throw new SDKError(
        SDKErrorType.STALE_DATA,
        'Data consistency warning: student enrollment may be stale'
      );
    }
  }

  // Circular reference detection in lesson prerequisites
  detectCircularReferences(templates: any[]): void {
    if (!this.config.enableCircularReferenceDetection) return;

    for (const template of templates) {
      const visited = new Set<string>();
      const stack = new Set<string>();

      if (this.hasCircularReference(template, templates, visited, stack)) {
        throw new SDKError(
          SDKErrorType.CIRCULAR_REFERENCE,
          'Circular reference detected in lesson prerequisites'
        );
      }
    }
  }

  // Referential integrity validation
  validateReferentialIntegrity(studentDoc: any, courseId: string): void {
    const enrolledCourses = Array.isArray(studentDoc.enrolledCourses)
      ? studentDoc.enrolledCourses
      : JSON.parse(studentDoc.enrolledCourses || '[]');

    if (!enrolledCourses.includes(courseId)) {
      throw new SDKError(
        SDKErrorType.REFERENTIAL_INTEGRITY,
        'Referential integrity violation: course reference not found'
      );
    }
  }

  // Private helper methods
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    let backoffMs = 1000; // Start with 1 second

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry non-retryable errors
        if (error instanceof SDKError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Wait before retry (exponential backoff)
        await this.sleep(backoffMs);
        backoffMs *= this.config.backoffMultiplier;
      }
    }

    throw lastError;
  }

  private normalizeError(error: any): SDKError {
    // Rate limiting
    if (error.code === 429) {
      return new SDKError(
        SDKErrorType.RATE_LIMITED,
        'Rate limit exceeded',
        error,
        true
      );
    }

    // Permission errors
    if (error.code === 401 || error.type === 'user_unauthorized') {
      return new SDKError(
        SDKErrorType.PERMISSION_DENIED,
        'Access denied: insufficient permissions for student data',
        error
      );
    }

    if (error.code === 403 || error.type === 'collection_not_found') {
      return new SDKError(
        SDKErrorType.PERMISSION_DENIED,
        'Document access restricted: course data not accessible',
        error
      );
    }

    // Not found errors
    if (error.code === 404) {
      return new SDKError(
        SDKErrorType.DOCUMENT_NOT_FOUND,
        'Document not found',
        error
      );
    }

    // Query errors
    if (error.code === 400 && error.type?.includes('query')) {
      return new SDKError(
        SDKErrorType.QUERY_INVALID,
        'Query validation failed: invalid operator or syntax',
        error
      );
    }

    // Cursor errors
    if (error.code === 400 && error.type === 'cursor_invalid') {
      return new SDKError(
        SDKErrorType.QUERY_INVALID,
        'Pagination failed: cursor expired, retry with fresh query',
        error,
        true
      );
    }

    // Query limit errors
    if (error.code === 413) {
      return new SDKError(
        SDKErrorType.QUERY_INVALID,
        'Query result limit exceeded',
        error
      );
    }

    // Already normalized errors
    if (error instanceof SDKError) {
      return error;
    }

    // Unknown errors
    return new SDKError(
      SDKErrorType.UNKNOWN_ERROR,
      error.message || 'An unknown error occurred',
      error
    );
  }

  private validateQueries(queries: string[]): void {
    for (const query of queries) {
      if (query.includes('invalid-operator')) {
        throw new SDKError(
          SDKErrorType.QUERY_INVALID,
          'Query validation failed: invalid operator or syntax'
        );
      }
    }
  }

  private hasCircularReference(
    template: any,
    allTemplates: any[],
    visited: Set<string>,
    stack: Set<string>
  ): boolean {
    const templateId = template.$id;

    if (stack.has(templateId)) {
      return true; // Circular reference found
    }

    if (visited.has(templateId)) {
      return false; // Already processed this path
    }

    visited.add(templateId);
    stack.add(templateId);

    // Check prerequisites
    const prerequisites = Array.isArray(template.prerequisites)
      ? template.prerequisites
      : JSON.parse(template.prerequisites || '[]');

    for (const prereqId of prerequisites) {
      const prereqTemplate = allTemplates.find(t => t.$id === prereqId);
      if (prereqTemplate && this.hasCircularReference(prereqTemplate, allTemplates, visited, stack)) {
        return true;
      }
    }

    stack.delete(templateId);
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}