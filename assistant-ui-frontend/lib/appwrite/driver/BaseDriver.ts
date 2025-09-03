import { Client, Account, Databases, ID } from 'appwrite';
import type { AppwriteResponse } from '../types';

/**
 * Base driver class providing generic CRUD operations and session management
 * All business-specific drivers extend this class
 */
export abstract class BaseDriver {
  protected client: Client;
  protected account: Account;
  protected databases: Databases;
  
  constructor(sessionToken?: string) {
    this.client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
    
    if (sessionToken) {
      this.client.setSession(sessionToken);
    }
    
    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
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
      const document = await this.databases.createDocument(
        'default',
        collectionId,
        ID.unique(),
        data,
        permissions
      );
      return document as T;
    } catch (error) {
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
   * Get current authenticated user
   */
  protected async getCurrentUser() {
    try {
      return await this.account.get();
    } catch (error) {
      throw new Error(`Failed to get current user: ${error.message}`);
    }
  }

  /**
   * Create user permissions for read/write access
   */
  protected createUserPermissions(userId: string): string[] {
    return [
      `read("user:${userId}")`,
      `write("user:${userId}")`
    ];
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