import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { AuthoredSOW, AuthoredSOWData } from '../types';

/**
 * Frontend AuthoredSOW driver for client-side operations
 * For seed scripts and migrations, use ServerAuthoredSOWDriver instead
 */
export class AuthoredSOWDriver extends BaseDriver {
  private readonly COLLECTION_ID = 'Authored_SOW';

  /**
   * Get published SOW for a course
   */
  async getPublishedSOW(courseId: string): Promise<AuthoredSOWData | null> {
    try {
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.equal('status', 'published'),
        Query.orderDesc('version'),
        Query.limit(1)
      ]);

      if (!records.length) {
        console.log(`[AuthoredSOWDriver] No published SOW found for course ${courseId}`);
        return null;
      }

      const record = records[0];

      return {
        courseId: record.courseId,
        version: record.version,
        status: record.status,
        entries: JSON.parse(record.entries),
        metadata: JSON.parse(record.metadata),
        accessibility_notes: record.accessibility_notes
      };
    } catch (error) {
      throw this.handleError(error, `get published SOW for course ${courseId}`);
    }
  }

  /**
   * Get all versions for a course (for authoring history)
   */
  async getAllVersions(courseId: string): Promise<AuthoredSOWData[]> {
    try {
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.orderDesc('version')
      ]);

      return records.map(r => ({
        courseId: r.courseId,
        version: r.version,
        status: r.status,
        entries: JSON.parse(r.entries),
        metadata: JSON.parse(r.metadata),
        accessibility_notes: r.accessibility_notes
      }));
    } catch (error) {
      throw this.handleError(error, `get all SOW versions for course ${courseId}`);
    }
  }

  /**
   * Get specific version of SOW
   */
  async getVersion(courseId: string, version: string): Promise<AuthoredSOWData | null> {
    try {
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.equal('version', version),
        Query.limit(1)
      ]);

      if (!records.length) {
        return null;
      }

      const record = records[0];

      return {
        courseId: record.courseId,
        version: record.version,
        status: record.status,
        entries: JSON.parse(record.entries),
        metadata: JSON.parse(record.metadata),
        accessibility_notes: record.accessibility_notes
      };
    } catch (error) {
      throw this.handleError(error, `get SOW version ${version} for course ${courseId}`);
    }
  }
}
