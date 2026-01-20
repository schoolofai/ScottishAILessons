import { Client, Account, Databases, Storage, ID, Permission } from 'node-appwrite';
import type { AppwriteResponse } from '@/lib/appwrite/types';

/**
 * Server-side BaseDriver for integration tests with session-based authentication
 * Uses SSR pattern with session client for proper user authentication
 */
export abstract class ServerBaseDriver {
  protected client: Client;
  protected account: Account;
  protected databases: Databases;
  protected storage: Storage;
  protected sessionUserId?: string;

  constructor(sessionClient?: { client: Client; account: Account; databases: Databases; storage?: Storage; users?: any }, sessionUserId?: string) {
    if (sessionClient) {
      // Use provided admin client (since SSR session auth is broken in node-appwrite v19.1.0)
      this.client = sessionClient.client;
      this.account = sessionClient.account;
      this.databases = sessionClient.databases;
      this.storage = sessionClient.storage || new Storage(this.client);
      this.sessionUserId = sessionUserId;
    } else {
      // Fallback: create unauthenticated client (for backward compatibility)
      this.client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      this.account = new Account(this.client);
      this.databases = new Databases(this.client);
      this.storage = new Storage(this.client);
    }
  }

  /**
   * Generic create operation for any collection
   */
  protected async create<T>(
    collectionId: string,
    data: any,
    permissions?: string[]
  ): Promise<T> {
    try {
      console.log(`[ServerBaseDriver] Creating document in ${collectionId} with permissions:`, permissions);
      console.log(`[ServerBaseDriver] Data:`, JSON.stringify(data, null, 2));

      const document = await this.databases.createDocument(
        'default',
        collectionId,
        ID.unique(),
        data,
        permissions
      );

      console.log(`[ServerBaseDriver] Successfully created document with ID: ${document.$id}`);
      return document as T;
    } catch (error) {
      console.error(`[ServerBaseDriver] Failed to create document in ${collectionId}:`, error);
      throw new Error(`Failed to create document in ${collectionId}: ${error.message}`);
    }
  }

  /**
   * Generic read operation for any collection
   */
  protected async get<T>(collectionId: string, documentId: string): Promise<T> {
    try {
      const document = await this.databases.getDocument('default', collectionId, documentId);
      return document as T;
    } catch (error) {
      throw new Error(`Failed to get document from ${collectionId}: ${error.message}`);
    }
  }

  /**
   * Generic list operation for any collection
   */
  protected async list<T>(
    collectionId: string,
    queries: string[] = []
  ): Promise<T[]> {
    try {
      const response = await this.databases.listDocuments('default', collectionId, queries);
      return response.documents as T[];
    } catch (error) {
      throw new Error(`Failed to list documents from ${collectionId}: ${error.message}`);
    }
  }

  /**
   * Generic list operation with full response (including total)
   */
  protected async listWithTotal<T>(
    collectionId: string,
    queries: string[] = []
  ): Promise<AppwriteResponse<T>> {
    try {
      const response = await this.databases.listDocuments('default', collectionId, queries);
      return {
        total: response.total,
        documents: response.documents as T[]
      };
    } catch (error) {
      throw new Error(`Failed to list documents from ${collectionId}: ${error.message}`);
    }
  }

  /**
   * Generic update operation for any collection
   */
  protected async update<T>(
    collectionId: string,
    documentId: string,
    data: any
  ): Promise<T> {
    try {
      const document = await this.databases.updateDocument(
        'default',
        collectionId,
        documentId,
        data
      );
      return document as T;
    } catch (error) {
      throw new Error(`Failed to update document in ${collectionId}: ${error.message}`);
    }
  }

  /**
   * Generic delete operation for any collection
   */
  protected async delete(collectionId: string, documentId: string): Promise<void> {
    try {
      await this.databases.deleteDocument('default', collectionId, documentId);
    } catch (error) {
      throw new Error(`Failed to delete document from ${collectionId}: ${error.message}`);
    }
  }

  /**
   * Get current authenticated user from session
   */
  protected async getCurrentUser() {
    try {
      if (!this.account) {
        throw new Error('Account instance not available - driver not properly initialized');
      }
      return await this.account.get();
    } catch (error) {
      throw new Error(`Failed to get current user: ${error.message}`);
    }
  }

  /**
   * Create user permissions for read/write access
   * When using admin client, use 'any' permissions since API keys have broad access
   */
  protected createUserPermissions(userId?: string): string[] {
    // Check if this is an admin client by looking for API key in config
    const isAdminClient = this.client.config?.key;

    if (isAdminClient) {
      console.log(`[ServerBaseDriver] Using admin client - applying 'any' permissions`);
      return []; // No document permissions needed for admin client, collection permissions handle access
    }

    const targetUserId = userId || this.sessionUserId;

    if (targetUserId) {
      console.log(`[ServerBaseDriver] Creating permissions for user: ${targetUserId}`);
      return [
        Permission.read(`user:${targetUserId}`),
        Permission.update(`user:${targetUserId}`),
        Permission.delete(`user:${targetUserId}`)
      ];
    }

    // For authenticated users with session, try no document permissions (let collection handle it)
    console.log(`[ServerBaseDriver] No specific user ID - using collection permissions only`);
    return [];
  }

  /**
   * Handle common error scenarios and provide meaningful messages
   */
  protected handleError(error: any, operation: string): Error {
    if (error.code === 401) {
      return new Error(`Authentication required for ${operation}`);
    }
    if (error.code === 403) {
      return new Error(`Permission denied for ${operation}`);
    }
    if (error.code === 404) {
      return new Error(`Resource not found for ${operation}`);
    }
    return new Error(`${operation} failed: ${error.message}`);
  }
}