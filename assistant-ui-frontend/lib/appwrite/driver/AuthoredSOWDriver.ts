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
   * Get published SOW for a course - uses LATEST PUBLISHED VERSION by default
   *
   * If no version is specified, fetches the highest version number that is published.
   * This supports the progressive versioning model where newer versions supersede older ones.
   *
   * @param courseId - Course identifier
   * @param version - SOW version (optional - defaults to latest published)
   * @returns Published SOW data or null if not found
   */
  async getPublishedSOW(courseId: string, version?: string): Promise<AuthoredSOWData | null> {
    try {
      let record: AuthoredSOW | null = null;

      if (version) {
        // Specific version requested
        const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
          Query.equal('courseId', courseId),
          Query.equal('version', version),
          Query.equal('status', 'published'),
          Query.limit(1)
        ]);
        record = records.length ? records[0] : null;
      } else {
        // No version specified - get latest published version
        const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
          Query.equal('courseId', courseId),
          Query.equal('status', 'published'),
          Query.limit(100) // Get all published versions
        ]);

        if (records.length > 0) {
          // Find the highest version number
          record = records.reduce((latest, current) => {
            const latestVersion = parseInt(latest.version, 10) || 0;
            const currentVersion = parseInt(current.version, 10) || 0;
            return currentVersion > latestVersion ? current : latest;
          });
        }
      }

      if (!record) {
        const versionStr = version ? `v${version}` : 'latest';
        console.log(`[AuthoredSOWDriver] No published SOW (${versionStr}) found for course ${courseId}`);
        return null;
      }

      console.log(`[AuthoredSOWDriver] Using SOW v${record.version} for course ${courseId}`);

      return {
        courseId: record.courseId,
        version: record.version,
        status: record.status,
        entries: await decompressJSONWithStorage(record.entries, this.storage),
        metadata: JSON.parse(record.metadata),
        accessibility_notes: record.accessibility_notes
      };
    } catch (error) {
      const versionStr = version ? `v${version}` : 'latest';
      throw this.handleError(error, `get published SOW (${versionStr}) for course ${courseId}`);
    }
  }

  /**
   * Get all courseIds that have any published SOWs (latest version logic)
   * Used to filter the courses catalog to only show courses with lesson structures
   * Returns a Set for O(1) lookup performance
   *
   * Uses "latest published version" approach - includes courses with any
   * published version (v1, v2, v3, etc.) rather than restricting to v1 only
   */
  async getPublishedCourseIds(): Promise<Set<string>> {
    try {
      // Get ALL published SOWs regardless of version
      const records = await this.list<AuthoredSOW>(this.COLLECTION_ID, [
        Query.equal('status', 'published'),
        Query.limit(500) // Reasonable limit for production courses
      ]);

      // Track courseIds and their highest published version (for logging)
      const courseVersionMap = new Map<string, number>();
      records.forEach(record => {
        if (record.courseId) {
          const version = parseInt(record.version, 10) || 1;
          const currentMax = courseVersionMap.get(record.courseId) || 0;
          if (version > currentMax) {
            courseVersionMap.set(record.courseId, version);
          }
        }
      });

      const courseIds = new Set<string>(courseVersionMap.keys());
      console.log(`[AuthoredSOWDriver] Found ${courseIds.size} courses with published SOWs (latest version logic)`);

      // Log version breakdown for debugging
      const versionCounts: Record<string, number> = {};
      courseVersionMap.forEach((version) => {
        const key = `v${version}`;
        versionCounts[key] = (versionCounts[key] || 0) + 1;
      });
      console.log(`[AuthoredSOWDriver] Version breakdown:`, versionCounts);

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
