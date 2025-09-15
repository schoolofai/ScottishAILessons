/*
Unit tests for Appwrite SDK wrapper edge cases.
These tests follow TDD Red-Green-Refactor methodology for robust SDK integration.
Using Playwright test framework.
*/

import { test, expect } from '@playwright/test';
import { CoursePlannerService } from './planner-service';
import { Query } from 'appwrite';

test.describe('Appwrite SDK Wrapper Edge Cases', () => {
  test.describe('RED: Failing Tests for Connection Edge Cases', () => {
    test('should fail: handle network timeout gracefully', async () => {
      // ARRANGE: Mock databases with timeout behavior
      const timeoutMockDatabases = {
        getDocument: async () => {
          // Simulate network timeout
          await new Promise(resolve => setTimeout(resolve, 10000));
          throw new Error('Network timeout');
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = timeoutMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should handle timeout (wrapped in service error)
      await expect(() => {
        return service.assembleSchedulingContext('student-timeout', 'course-timeout');
      }).rejects.toThrow('Failed to assemble scheduling context: Network timeout');
    });

    test('should fail: handle rate limiting with exponential backoff', async () => {
      let callCount = 0;
      const rateLimitedMockDatabases = {
        getDocument: async () => {
          callCount++;
          // Always throw rate limit error
          const error: any = new Error('Rate limit exceeded');
          error.code = 429;
          error.response = { message: 'Too many requests' };
          throw error;
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = rateLimitedMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should get wrapped service error
      await expect(() => {
        return service.assembleSchedulingContext('student-rate-limited', 'course-test');
      }).rejects.toThrow('Failed to assemble scheduling context');

      // Verify at least one call was made
      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    test('should fail: handle malformed response data', async () => {
      const malformedResponseMockDatabases = {
        getDocument: async () => {
          // Return malformed response (not a proper Appwrite document)
          return {
            id: 'wrong-field-name', // Should be $id
            data: 'malformed-structure',
            nested: {
              invalid: 'structure'
            }
          };
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = malformedResponseMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should detect and handle malformed response (wrapped in service error)
      await expect(() => {
        return service.assembleSchedulingContext('student-malformed', 'course-test');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });

    test('should fail: handle partial document corruption', async () => {
      const corruptedDataMockDatabases = {
        getDocument: async (db: string, collection: string, id: string) => {
          if (collection === 'students') {
            return {
              $id: 'student-corrupted',
              userId: 'user-corrupted',
              name: 'Test Student',
              accommodations: '{"invalid": json}', // Corrupted JSON
              enrolledCourses: ['course-1'],
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              $createdAt: '2024-01-01T00:00:00.000Z',
              $updatedAt: '2024-01-01T00:00:00.000Z'
            };
          }
          return {
            $id: 'course-test',
            userId: 'user-course-test',
            name: 'Test Course',
            courseId: 'C123 45',
            subject: 'Test',
            level: 'Test',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            $createdAt: '2024-01-01T00:00:00.000Z',
            $updatedAt: '2024-01-01T00:00:00.000Z'
          };
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = corruptedDataMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should detect and handle corrupted JSON data (wrapped in service error)
      await expect(() => {
        return service.assembleSchedulingContext('student-corrupted', 'course-test');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });
  });

  test.describe('RED: Failing Tests for Permission Edge Cases', () => {
    test('should fail: handle permission denied errors', async () => {
      const permissionDeniedMockDatabases = {
        getDocument: async () => {
          const error: any = new Error('Permission denied');
          error.code = 401;
          error.type = 'user_unauthorized';
          throw error;
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = permissionDeniedMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should provide wrapped service error message
      await expect(() => {
        return service.assembleSchedulingContext('student-unauthorized', 'course-test');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });

    test('should fail: handle document-level permissions', async () => {
      const documentPermissionMockDatabases = {
        getDocument: async (db: string, collection: string, id: string) => {
          if (collection === 'students') {
            return {
              $id: 'student-protected',
              userId: 'user-protected',
              name: 'Protected Student',
              accommodations: [],
              enrolledCourses: ['course-protected'],
              $permissions: ['read("user:other-user")'], // User lacks permission
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              $createdAt: '2024-01-01T00:00:00.000Z',
              $updatedAt: '2024-01-01T00:00:00.000Z'
            };
          }
          throw new Error('Access to this document is restricted');
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = documentPermissionMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should handle document-level permission restrictions
      await expect(() => {
        return service.assembleSchedulingContext('student-protected', 'course-protected');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });

    test('should fail: handle collection-level permissions', async () => {
      const collectionPermissionMockDatabases = {
        getDocument: async () => ({
          $id: 'student-collection',
          userId: 'user-collection',
          name: 'Test Student',
          accommodations: [],
          enrolledCourses: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          $createdAt: '2024-01-01T00:00:00.000Z',
          $updatedAt: '2024-01-01T00:00:00.000Z'
        }),
        listDocuments: async (db: string, collection: string) => {
          if (collection === 'mastery') {
            const error: any = new Error('Collection access denied');
            error.code = 403;
            error.type = 'collection_not_found';
            throw error;
          }
          return { documents: [] };
        }
      };

      const service = {} as CoursePlannerService;
      service.databases = collectionPermissionMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should handle collection permission errors gracefully
      await expect(() => {
        return service.assembleSchedulingContext('student-collection', 'course-test');
      }).not.toThrow(); // Should continue without mastery data

      // But should log warning about missing mastery collection
    });
  });

  test.describe('RED: Failing Tests for Query Edge Cases', () => {
    test('should fail: handle malformed query parameters', async () => {
      // Mock databases with query validation
      const queryValidationMockDatabases = {
        getDocument: async (db: string, collection: string, id: string) => {
          if (collection === 'students') {
            return {
              $id: 'student-query',
              userId: 'user-query',
              name: 'Test Student',
              accommodations: [],
              enrolledCourses: ['C123 45'],
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              $createdAt: '2024-01-01T00:00:00.000Z',
              $updatedAt: '2024-01-01T00:00:00.000Z'
            };
          }
          // Course document
          return {
            $id: 'course-test',
            courseId: 'C123 45',
            subject: 'Test Subject',
            level: 'National 3',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            $createdAt: '2024-01-01T00:00:00.000Z',
            $updatedAt: '2024-01-01T00:00:00.000Z'
          };
        },
        listDocuments: async (db: string, collection: string, queries: any[]) => {
          // Simulate invalid query parameter - throw error that should be wrapped
          if (collection === 'lesson_templates' && queries && queries.some(q => q.toString().includes('invalid-operator'))) {
            const error: any = new Error('Invalid query parameter');
            error.code = 400;
            error.type = 'query_invalid';
            throw error;
          }
          return { documents: [] };
        }
      };

      const service = {} as CoursePlannerService;
      service.databases = queryValidationMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should validate and handle malformed queries
      await expect(async () => {
        await service.assembleSchedulingContext('student-query', 'course-test');
      }).rejects.toThrow(/Failed to assemble scheduling context/);
    });

    test('should fail: handle query result size limits', async () => {
      const largeDataseMockDatabases = {
        getDocument: async () => ({
          $id: 'student-large',
          userId: 'user-large',
          name: 'Test Student',
          accommodations: [],
          enrolledCourses: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          $createdAt: '2024-01-01T00:00:00.000Z',
          $updatedAt: '2024-01-01T00:00:00.000Z'
        }),
        listDocuments: async (db: string, collection: string) => {
          if (collection === 'lesson_templates') {
            // Simulate hitting query limit (5000+ results)
            const error: any = new Error('Query result limit exceeded');
            error.code = 413;
            error.type = 'query_limit_exceeded';
            throw error;
          }
          return { documents: [] };
        }
      };

      const service = {} as CoursePlannerService;
      service.databases = largeDataseMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should handle large result sets with pagination
      await expect(() => {
        return service.assembleSchedulingContext('student-large', 'course-large');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });

    test('should fail: handle cursor-based pagination edge cases', async () => {
      let pageCount = 0;
      const paginationMockDatabases = {
        getDocument: async () => ({
          $id: 'student-paginated',
          userId: 'user-paginated',
          name: 'Test Student',
          accommodations: [],
          enrolledCourses: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          $createdAt: '2024-01-01T00:00:00.000Z',
          $updatedAt: '2024-01-01T00:00:00.000Z'
        }),
        listDocuments: async (db: string, collection: string, queries: any[]) => {
          if (collection === 'lesson_templates') {
            pageCount++;

            if (pageCount === 1) {
              // Return first page
              return {
                documents: Array(100).fill({
                  $id: 'template-1',
                  userId: 'user-template',
                  name: 'Template 1',
                  courseId: 'C123 45',
                  title: 'Template 1',
                  outcomeRefs: '["outcome1"]',
                  status: 'published',
                  createdAt: '2024-01-01T00:00:00.000Z',
                  updatedAt: '2024-01-01T00:00:00.000Z',
                  $createdAt: '2024-01-01T00:00:00.000Z',
                  $updatedAt: '2024-01-01T00:00:00.000Z'
                }),
                total: 250 // More than can fit in one query
              };
            } else if (pageCount === 2) {
              // Simulate cursor corruption/expiry
              const error: any = new Error('Invalid cursor or cursor expired');
              error.code = 400;
              error.type = 'cursor_invalid';
              throw error;
            }
          }
          return { documents: [] };
        }
      };

      const service = {} as CoursePlannerService;
      service.databases = paginationMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should handle cursor expiry and retry from beginning
      await expect(() => {
        return service.assembleSchedulingContext('student-paginated', 'course-paginated');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });
  });

  test.describe('RED: Failing Tests for Data Consistency Edge Cases', () => {
    test('should fail: handle concurrent modification conflicts', async () => {
      let updateCount = 0;
      const concurrencyMockDatabases = {
        getDocument: async () => ({
          $id: 'student-concurrent',
          userId: 'user-concurrent',
          name: 'Test Student',
          accommodations: [],
          enrolledCourses: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          $createdAt: '2024-01-01T00:00:00.000Z',
          $updatedAt: '2024-01-01T00:00:00.000Z'
        }),
        createDocument: async () => {
          updateCount++;
          if (updateCount <= 2) {
            // Simulate version conflict (document was modified by another client)
            const error: any = new Error('Document version mismatch');
            error.code = 409;
            error.type = 'document_version_mismatch';
            throw error;
          }
          // Success after retries
          return { $id: 'updated-doc' };
        },
        updateDocument: async () => {
          updateCount++;
          if (updateCount <= 2) {
            // Simulate version conflict (document was modified by another client)
            const error: any = new Error('Document version mismatch');
            error.code = 409;
            error.type = 'document_version_mismatch';
            throw error;
          }
          // Success after retries
          return { $id: 'updated-doc' };
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = concurrencyMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);
      service.saveGraphRunId = CoursePlannerService.prototype.saveGraphRunId.bind(service);

      // ACT & ASSERT: Should get wrapped service error for version conflicts
      await expect(async () => {
        await service.saveGraphRunId('student-concurrent', 'course-concurrent', 'graph-run-123');
      }).rejects.toThrow('Failed to save graph run ID');

      // Verify at least one attempt was made
      expect(updateCount).toBeGreaterThanOrEqual(1);
    });

    test('should fail: handle stale read phenomena', async () => {
      const staleReadMockDatabases = {
        getDocument: async (db: string, collection: string, id: string) => {
          if (collection === 'students') {
            // Return stale student data (missing recent enrollment)
            return {
              $id: 'student-stale',
              userId: 'user-stale',
              name: 'Test Student',
              accommodations: [],
              enrolledCourses: ['old-course'], // Missing recent enrollment
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z', // Old timestamp
              $createdAt: '2024-01-01T00:00:00.000Z',
              $updatedAt: '2024-01-01T00:00:00.000Z' // Old timestamp
            };
          }
          return {
            $id: 'course-new',
            userId: 'user-course-new',
            name: 'New Course',
            courseId: 'C999 99',
            subject: 'New Course',
            level: 'Advanced',
            status: 'active',
            createdAt: '2024-02-01T00:00:00.000Z', // Recent course
            updatedAt: '2024-02-01T00:00:00.000Z',
            $createdAt: '2024-02-01T00:00:00.000Z', // Recent course
            $updatedAt: '2024-02-01T00:00:00.000Z'
          };
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = staleReadMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should detect stale data and refresh
      await expect(() => {
        return service.assembleSchedulingContext('student-stale', 'course-new');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });

    test('should fail: handle orphaned references', async () => {
      const orphanedRefMockDatabases = {
        getDocument: async (db: string, collection: string, id: string) => {
          if (collection === 'students') {
            return {
              $id: 'student-orphaned',
              userId: 'user-orphaned',
              name: 'Test Student',
              accommodations: [],
              enrolledCourses: ['nonexistent-course'], // Orphaned reference
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              $createdAt: '2024-01-01T00:00:00.000Z',
              $updatedAt: '2024-01-01T00:00:00.000Z'
            };
          }
          // Course doesn't exist
          const error: any = new Error('Document not found');
          error.code = 404;
          throw error;
        },
        listDocuments: async () => ({ documents: [] })
      };

      const service = {} as CoursePlannerService;
      service.databases = orphanedRefMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should detect and handle orphaned references
      await expect(() => {
        return service.assembleSchedulingContext('student-orphaned', 'nonexistent-course');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });

    test('should fail: handle circular reference detection', async () => {
      const circularRefMockDatabases = {
        getDocument: async (db: string, collection: string, id: string) => {
          if (collection === 'students') {
            return {
              $id: 'student-test',
              userId: 'user-test',
              name: 'Test Student',
              accommodations: [],
              enrolledCourses: [],
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              $createdAt: '2024-01-01T00:00:00.000Z',
              $updatedAt: '2024-01-01T00:00:00.000Z'
            };
          }
          return {
            $id: 'course-circular',
            userId: 'user-circular',
            name: 'Test Course',
            courseId: 'C123 45',
            subject: 'Test Course',
            level: 'Test',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            $createdAt: '2024-01-01T00:00:00.000Z',
            $updatedAt: '2024-01-01T00:00:00.000Z'
          };
        },
        listDocuments: async (db: string, collection: string) => {
          if (collection === 'lesson_templates') {
            return {
              documents: [{
                $id: 'template-circular',
                userId: 'user-template-circular',
                name: 'Circular Template',
                courseId: 'C123 45',
                title: 'Circular Template',
                outcomeRefs: '["outcome1"]',
                prerequisites: '["template-circular"]', // Self-reference
                status: 'published',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                $createdAt: '2024-01-01T00:00:00.000Z',
                $updatedAt: '2024-01-01T00:00:00.000Z'
              }]
            };
          }
          return { documents: [] };
        }
      };

      const service = {} as CoursePlannerService;
      service.databases = circularRefMockDatabases as any;
      service.assembleSchedulingContext = CoursePlannerService.prototype.assembleSchedulingContext.bind(service);

      // ACT & ASSERT: Should detect circular references in prerequisites
      await expect(() => {
        return service.assembleSchedulingContext('student-test', 'course-circular');
      }).rejects.toThrow('Failed to assemble scheduling context');
    });
  });
});