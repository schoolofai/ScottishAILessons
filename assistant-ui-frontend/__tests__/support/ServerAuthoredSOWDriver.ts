import { Query } from 'node-appwrite';
import { ServerBaseDriver } from './ServerBaseDriver';
import { compressJSON } from '../../lib/appwrite/utils/compression';

/**
 * Authored_SOW data structure from langgraph-author-agent output
 */
export interface AuthoredSOWEntry {
  order: number;
  lessonTemplateRef: string;
  label: string;
  lesson_type: string;
  coherence: string;
  policy: any;
  engagement_tags: string[];
  outcomeRefs: string[];
  assessmentStandardRefs: string[];
  pedagogical_blocks: any[];
  accessibility_profile: any;
  estMinutes: number;
  notes: string;
}

export interface AuthoredSOWMetadata {
  course_name: string;
  level: string;
  total_lessons: number;
  total_estimated_minutes: number;
  generated_at: string;
  author_agent_version: string;
  [key: string]: any;
}

export interface AuthoredSOWData {
  courseId: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  entries: AuthoredSOWEntry[];
  metadata: AuthoredSOWMetadata;
  accessibility_notes?: string;
}

export interface AuthoredSOW {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  courseId: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  entries: string; // JSON stringified
  metadata: string; // JSON stringified
  accessibility_notes: string;
}

/**
 * Server-side driver for Authored_SOW collection
 * Used for seed scripts and migration scripts with admin authentication
 */
export class ServerAuthoredSOWDriver extends ServerBaseDriver {
  private readonly COLLECTION_ID = 'Authored_SOW';

  /**
   * Create or update an Authored SOW document
   */
  async upsertAuthoredSOW(data: AuthoredSOWData): Promise<AuthoredSOW> {
    try {
      // Check if document already exists for this course and version
      const existing = await this.getByCoruseAndVersion(data.courseId, data.version);

      if (existing) {
        // Update existing document
        return await this.updateAuthoredSOW(existing.$id, data);
      }

      // Create new document
      const docData = {
        courseId: data.courseId,
        version: data.version,
        status: data.status,
        entries: compressJSON(data.entries),  // Compress using gzip+base64
        metadata: JSON.stringify(data.metadata),
        accessibility_notes: data.accessibility_notes || ''
      };

      console.log(`[ServerAuthoredSOWDriver] Creating Authored_SOW for course ${data.courseId} version ${data.version}`);

      // Admin client doesn't need permissions array
      return await this.create<AuthoredSOW>(this.COLLECTION_ID, docData, []);
    } catch (error) {
      throw this.handleError(error, `upsert Authored_SOW for course ${data.courseId}`);
    }
  }

  /**
   * Update an existing Authored SOW document
   */
  async updateAuthoredSOW(documentId: string, data: Partial<AuthoredSOWData>): Promise<AuthoredSOW> {
    try {
      const docData: any = {};

      if (data.status) docData.status = data.status;
      if (data.entries) docData.entries = compressJSON(data.entries);  // Compress using gzip+base64
      if (data.metadata) docData.metadata = JSON.stringify(data.metadata);
      if (data.accessibility_notes !== undefined) docData.accessibility_notes = data.accessibility_notes;

      console.log(`[ServerAuthoredSOWDriver] Updating Authored_SOW document ${documentId}`);

      return await this.update<AuthoredSOW>(this.COLLECTION_ID, documentId, docData);
    } catch (error) {
      throw this.handleError(error, `update Authored_SOW document ${documentId}`);
    }
  }

  /**
   * Get Authored SOW by course ID and version
   */
  async getByCoruseAndVersion(courseId: string, version: string): Promise<AuthoredSOW | null> {
    try {
      const documents = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.equal('version', version),
        Query.limit(1)
      ]);

      return documents.length > 0 ? documents[0] : null;
    } catch (error) {
      throw this.handleError(error, `get Authored_SOW for course ${courseId} version ${version}`);
    }
  }

  /**
   * Get latest published version for a course
   */
  async getLatestPublished(courseId: string): Promise<AuthoredSOW | null> {
    try {
      const documents = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.equal('status', 'published'),
        Query.orderDesc('version'),
        Query.limit(1)
      ]);

      return documents.length > 0 ? documents[0] : null;
    } catch (error) {
      throw this.handleError(error, `get latest published Authored_SOW for course ${courseId}`);
    }
  }

  /**
   * Get all versions for a course
   */
  async getAllVersions(courseId: string): Promise<AuthoredSOW[]> {
    try {
      return await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.orderDesc('version')
      ]);
    } catch (error) {
      throw this.handleError(error, `get all versions for course ${courseId}`);
    }
  }

  /**
   * Parse the entries JSON string back to objects
   */
  parseEntries(sow: AuthoredSOW): AuthoredSOWEntry[] {
    try {
      return JSON.parse(sow.entries);
    } catch (error) {
      console.error('[ServerAuthoredSOWDriver] Failed to parse entries:', error);
      return [];
    }
  }

  /**
   * Parse the metadata JSON string back to object
   */
  parseMetadata(sow: AuthoredSOW): AuthoredSOWMetadata {
    try {
      return JSON.parse(sow.metadata);
    } catch (error) {
      console.error('[ServerAuthoredSOWDriver] Failed to parse metadata:', error);
      return {} as AuthoredSOWMetadata;
    }
  }

  /**
   * Get full Authored SOW data with parsed fields
   */
  async getAuthoredSOWData(documentId: string): Promise<AuthoredSOWData | null> {
    try {
      const sow = await this.get<AuthoredSOW>(this.COLLECTION_ID, documentId);

      return {
        courseId: sow.courseId,
        version: sow.version,
        status: sow.status,
        entries: this.parseEntries(sow),
        metadata: this.parseMetadata(sow),
        accessibility_notes: sow.accessibility_notes
      };
    } catch (error) {
      throw this.handleError(error, `get Authored_SOW data for document ${documentId}`);
    }
  }
}
