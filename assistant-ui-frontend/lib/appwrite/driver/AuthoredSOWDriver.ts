import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { AuthoredSOW, AuthoredSOWData } from '../types';
import { decompressJSONWithStorage } from '../utils/compression';

/**
 * Frontend AuthoredSOW driver for client-side operations
 * For seed scripts and migrations, use ServerAuthoredSOWDriver instead
 */
export class AuthoredSOWDriver extends BaseDriver {
  private readonly COLLECTION_ID = 'Authored_SOW';

  /**
   * Get published SOW for a course - DEFAULTS TO VERSION 1
   *
   * Frontend always uses version 1 as the stable/production version
   * unless explicitly requesting a different version.
   *
   * @param courseId - Course identifier
   * @param version - SOW version (default: "1")
   * @returns Published SOW data or null if not found
   */
  async getPublishedSOW(courseId: string, version: string = "1"): Promise<AuthoredSOWData | null> {
    try {
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('courseId', courseId),
        Query.equal('version', version),  // Filter by specific version
        Query.equal('status', 'published'),
        Query.limit(1)
      ]);

      if (!records.length) {
        console.log(`[AuthoredSOWDriver] No published SOW v${version} found for course ${courseId}`);
        return null;
      }

      const record = records[0];

      return {
        courseId: record.courseId,
        version: record.version,
        status: record.status,
        entries: await decompressJSONWithStorage(record.entries, this.storage),
        metadata: JSON.parse(record.metadata),
        accessibility_notes: record.accessibility_notes
      };
    } catch (error) {
      throw this.handleError(error, `get published SOW v${version} for course ${courseId}`);
    }
  }

  /**
   * Get all courseIds that have published VERSION 1 SOWs
   * Used to filter the courses catalog to only show courses with lesson structures
   * Returns a Set for O(1) lookup performance
   *
   * IMPORTANT: Only counts version 1 (stable/production) SOWs
   */
  async getPublishedCourseIds(): Promise<Set<string>> {
    try {
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('version', '1'),  // Only version 1 (production)
        Query.equal('status', 'published'),
        Query.limit(500) // Reasonable limit for production courses
      ]);

      const courseIds = new Set<string>();
      records.forEach(record => {
        if (record.courseId) {
          courseIds.add(record.courseId);
        }
      });

      console.log(`[AuthoredSOWDriver] Found ${courseIds.size} courses with published v1 SOWs`);
      return courseIds;
    } catch (error) {
      throw this.handleError(error, 'get published course IDs');
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

      // Process records with async decompression (handles storage refs)
      const results: AuthoredSOWData[] = [];
      for (const r of records) {
        results.push({
          courseId: r.courseId,
          version: r.version,
          status: r.status,
          entries: await decompressJSONWithStorage(r.entries, this.storage),
          metadata: JSON.parse(r.metadata),
          accessibility_notes: r.accessibility_notes
        });
      }
      return results;
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
        entries: await decompressJSONWithStorage(record.entries, this.storage),
        metadata: JSON.parse(record.metadata),
        accessibility_notes: record.accessibility_notes
      };
    } catch (error) {
      throw this.handleError(error, `get SOW version ${version} for course ${courseId}`);
    }
  }

  /**
   * [ADMIN] Get all SOWs with all statuses for admin review
   * Used in admin panel to display draft, review, and published SOWs
   */
  async getAllSOWsForAdmin(): Promise<Array<AuthoredSOWData & { $id: string; $createdAt?: string; $updatedAt?: string }>> {
    try {
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.orderDesc('$createdAt')
      ]);

      // Process records with async decompression (handles storage refs)
      const results: Array<AuthoredSOWData & { $id: string; $createdAt?: string; $updatedAt?: string }> = [];
      for (const r of records) {
        results.push({
          $id: r.$id,
          courseId: r.courseId,
          version: r.version,
          status: r.status,
          entries: await decompressJSONWithStorage(r.entries, this.storage),
          metadata: JSON.parse(r.metadata),
          accessibility_notes: r.accessibility_notes,
          $createdAt: r.$createdAt,
          $updatedAt: r.$updatedAt
        });
      }
      return results;
    } catch (error) {
      throw this.handleError(error, 'get all SOWs for admin');
    }
  }

  /**
   * [ADMIN] Get SOW by document ID (not courseId)
   * Used to retrieve specific SOW for detailed review
   */
  async getSOWById(sowId: string): Promise<AuthoredSOWData & { $id: string }> {
    if (!sowId || sowId.length === 0) {
      throw new Error('SOW ID is required');
    }

    try {
      const record = await this.get<AuthoredSOW>(this.COLLECTION_ID, sowId);

      return {
        $id: record.$id,
        courseId: record.courseId,
        version: record.version,
        status: record.status,
        entries: await decompressJSONWithStorage(record.entries, this.storage),
        metadata: JSON.parse(record.metadata),
        accessibility_notes: record.accessibility_notes
      };
    } catch (error) {
      throw this.handleError(error, `get SOW by ID ${sowId}`);
    }
  }

  /**
   * [ADMIN] Publish a specific SOW
   * Updates SOW status from draft/review to published
   */
  async publishSOW(sowId: string): Promise<void> {
    if (!sowId || sowId.length === 0) {
      throw new Error('SOW ID is required for publishing');
    }

    try {
      await this.update<AuthoredSOW>(this.COLLECTION_ID, sowId, { status: 'published' });
      console.info(`✅ SOW ${sowId} published successfully`);
    } catch (error) {
      console.error(`❌ Failed to publish SOW ${sowId}:`, error);
      throw this.handleError(error, `publish SOW ${sowId}`);
    }
  }

  /**
   * [ADMIN] Unpublish a specific SOW
   * Reverts SOW status from published to draft
   * FAST FAIL: Throws error immediately if operation fails
   */
  async unpublishSOW(sowId: string): Promise<void> {
    if (!sowId || sowId.length === 0) {
      throw new Error('SOW ID is required for unpublishing');
    }

    try {
      await this.update<AuthoredSOW>(this.COLLECTION_ID, sowId, { status: 'draft' });
      console.info(`✅ SOW ${sowId} unpublished successfully`);
    } catch (error) {
      console.error(`❌ Failed to unpublish SOW ${sowId}:`, error);
      throw this.handleError(error, `unpublish SOW ${sowId}`);
    }
  }
}
