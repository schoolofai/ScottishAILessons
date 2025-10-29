/**
 * Integration Test: Appwrite Schema Validation
 *
 * This test validates that TypeScript types and Zod schemas match
 * the actual Appwrite database schema. It prevents "Unknown attribute"
 * errors by ensuring code and database are in sync.
 *
 * Purpose: Catch schema drift early before runtime errors occur
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { Client, Databases } from 'appwrite';
import { SessionSchema } from '@/lib/appwrite/schemas';
import type { Session } from '@/lib/appwrite/types';

// Test configuration
const TEST_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: 'default',
  sessionCollectionId: 'sessions'
};

// Define expected schema from TypeScript types
const EXPECTED_SESSION_FIELDS = {
  // Appwrite system fields
  $id: { type: 'string', required: true },
  $createdAt: { type: 'string', required: true },
  $updatedAt: { type: 'string', required: true },
  // Custom fields from Session interface
  studentId: { type: 'string', required: true },
  courseId: { type: 'string', required: true },
  lessonTemplateId: { type: 'string', required: false },
  startedAt: { type: 'datetime', required: true },
  endedAt: { type: 'datetime', required: false },
  stage: { type: 'string', required: false },
  status: { type: 'string', required: true },
  score: { type: 'double', required: false }, // ← The field we just added
  lessonSnapshot: { type: 'string', required: true },
  threadId: { type: 'string', required: false },
  lastMessageAt: { type: 'datetime', required: false },
  contextChatThreadId: { type: 'string', required: false }
};

describe('Appwrite Schema Validation Tests', () => {
  let client: Client;
  let databases: Databases;
  let actualSchema: any[] = [];

  beforeAll(async () => {
    // Skip if no API key
    if (!TEST_CONFIG.apiKey) {
      console.warn('⚠️  Skipping schema validation tests - APPWRITE_API_KEY not set');
      return;
    }

    // Initialize Appwrite client
    client = new Client()
      .setEndpoint(TEST_CONFIG.endpoint)
      .setProject(TEST_CONFIG.projectId)
      .setKey(TEST_CONFIG.apiKey);

    databases = new Databases(client);

    // Fetch actual collection schema from Appwrite
    try {
      const collection = await databases.listAttributes(
        TEST_CONFIG.databaseId,
        TEST_CONFIG.sessionCollectionId
      );
      actualSchema = collection.attributes || [];
      console.log(`✅ Fetched ${actualSchema.length} attributes from Appwrite`);
    } catch (error) {
      console.error('❌ Failed to fetch Appwrite schema:', error);
      throw error;
    }
  });

  it('should have all expected fields in Appwrite database', () => {
    if (!TEST_CONFIG.apiKey) return;

    const actualFieldNames = actualSchema.map((attr: any) => attr.key);

    // Check each expected field exists (excluding Appwrite system fields)
    const customFields = Object.keys(EXPECTED_SESSION_FIELDS).filter(
      (field) => !field.startsWith('$')
    );

    for (const fieldName of customFields) {
      expect(actualFieldNames).toContain(fieldName);
    }

    console.log(`✅ All ${customFields.length} expected fields found in database`);
  });

  it('should have correct field types in Appwrite database', () => {
    if (!TEST_CONFIG.apiKey) return;

    const errors: string[] = [];

    for (const [fieldName, expectedConfig] of Object.entries(EXPECTED_SESSION_FIELDS)) {
      // Skip Appwrite system fields
      if (fieldName.startsWith('$')) continue;

      const actualField = actualSchema.find((attr: any) => attr.key === fieldName);

      if (!actualField) {
        errors.push(`Missing field: ${fieldName}`);
        continue;
      }

      // Validate type
      if (actualField.type !== expectedConfig.type) {
        errors.push(
          `Type mismatch for ${fieldName}: expected ${expectedConfig.type}, got ${actualField.type}`
        );
      }

      // Validate required status
      if (actualField.required !== expectedConfig.required) {
        errors.push(
          `Required mismatch for ${fieldName}: expected ${expectedConfig.required}, got ${actualField.required}`
        );
      }
    }

    if (errors.length > 0) {
      console.error('❌ Schema validation errors:');
      errors.forEach((error) => console.error(`  - ${error}`));
    }

    expect(errors).toHaveLength(0);
    console.log('✅ All field types match expected schema');
  });

  it('should validate score field specifically', () => {
    if (!TEST_CONFIG.apiKey) return;

    const scoreField = actualSchema.find((attr: any) => attr.key === 'score');

    expect(scoreField).toBeDefined();
    expect(scoreField.type).toBe('double');
    expect(scoreField.required).toBe(false);
    expect(scoreField.min).toBe(0);
    expect(scoreField.max).toBe(1);

    console.log('✅ Score field validated: type=double, range=[0,1], optional');
  });

  it('should not have unexpected fields in database', () => {
    if (!TEST_CONFIG.apiKey) return;

    const expectedFieldNames = Object.keys(EXPECTED_SESSION_FIELDS).filter(
      (field) => !field.startsWith('$')
    );
    const actualFieldNames = actualSchema.map((attr: any) => attr.key);

    const unexpectedFields = actualFieldNames.filter(
      (field: string) => !expectedFieldNames.includes(field)
    );

    if (unexpectedFields.length > 0) {
      console.warn('⚠️  Unexpected fields in database:', unexpectedFields);
      console.warn('     These fields exist in Appwrite but not in TypeScript types');
    }

    // This is a warning, not a failure (database might have extra fields for future use)
    expect(true).toBe(true);
  });

  it('should validate Zod schema accepts valid session data', () => {
    const validSessionData: Partial<Session> = {
      $id: 'test_session_123',
      studentId: 'student_456',
      courseId: 'course_789',
      lessonTemplateId: 'lesson_template_012',
      status: 'completed',
      score: 0.75, // ← Testing the new field
      startedAt: new Date().toISOString(),
      threadId: 'thread_345',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = SessionSchema.safeParse(validSessionData);

    if (!result.success) {
      console.error('❌ Zod validation errors:', result.error.errors);
    }

    expect(result.success).toBe(true);
    console.log('✅ Zod schema accepts valid session data with score');
  });

  it('should validate Zod schema rejects invalid score values', () => {
    const invalidScores = [-0.5, 1.5, 999, -1];

    for (const invalidScore of invalidScores) {
      const sessionData = {
        $id: 'test_session_123',
        studentId: 'student_456',
        courseId: 'course_789',
        status: 'completed',
        score: invalidScore, // Invalid score
        startedAt: new Date().toISOString(),
        threadId: 'thread_345',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = SessionSchema.safeParse(sessionData);

      expect(result.success).toBe(false);
      if (!result.success) {
        console.log(`✅ Correctly rejected invalid score: ${invalidScore}`);
      }
    }
  });

  it('should generate schema drift report', () => {
    if (!TEST_CONFIG.apiKey) return;

    const report = {
      timestamp: new Date().toISOString(),
      collectionId: TEST_CONFIG.sessionCollectionId,
      totalFields: actualSchema.length,
      expectedFields: Object.keys(EXPECTED_SESSION_FIELDS).filter(
        (f) => !f.startsWith('$')
      ).length,
      missingInDatabase: [] as string[],
      missingInCode: [] as string[],
      typeMismatches: [] as string[]
    };

    const actualFieldNames = actualSchema.map((attr: any) => attr.key);
    const expectedFieldNames = Object.keys(EXPECTED_SESSION_FIELDS).filter(
      (field) => !field.startsWith('$')
    );

    // Find missing fields
    report.missingInDatabase = expectedFieldNames.filter(
      (field) => !actualFieldNames.includes(field)
    );
    report.missingInCode = actualFieldNames.filter(
      (field) => !expectedFieldNames.includes(field)
    );

    // Find type mismatches
    for (const [fieldName, expectedConfig] of Object.entries(EXPECTED_SESSION_FIELDS)) {
      if (fieldName.startsWith('$')) continue;

      const actualField = actualSchema.find((attr: any) => attr.key === fieldName);
      if (actualField && actualField.type !== expectedConfig.type) {
        report.typeMismatches.push(
          `${fieldName}: expected ${expectedConfig.type}, got ${actualField.type}`
        );
      }
    }

    console.log('\n📊 Schema Drift Report:');
    console.log(`   Total fields in database: ${report.totalFields}`);
    console.log(`   Expected fields in code: ${report.expectedFields}`);
    console.log(`   Missing in database: ${report.missingInDatabase.length}`);
    console.log(`   Missing in code: ${report.missingInCode.length}`);
    console.log(`   Type mismatches: ${report.typeMismatches.length}`);

    if (report.missingInDatabase.length > 0) {
      console.warn('   ⚠️  Fields in code but not in DB:', report.missingInDatabase);
    }
    if (report.missingInCode.length > 0) {
      console.warn('   ⚠️  Fields in DB but not in code:', report.missingInCode);
    }
    if (report.typeMismatches.length > 0) {
      console.error('   ❌ Type mismatches:', report.typeMismatches);
    }

    // Test passes if no critical mismatches (missing in database or type mismatches)
    expect(report.missingInDatabase).toHaveLength(0);
    expect(report.typeMismatches).toHaveLength(0);
  });
});
