import { test, expect } from '@playwright/test';
import {
  CourseSchema,
  StudentSchema,
  LessonTemplateSchema,
  SessionStartRequestSchema,
  SessionResponseSchema,
  GetRecommendationsRequestSchema,
  LessonCandidateSchema,
  CourseRecommendationSchema,
  CreateSessionRequestSchema,
  CreateSessionResponseSchema,
  SchedulingConstraintsSchema,
  SchedulingContextSchema
} from '../../lib/appwrite/schemas';

/**
 * Schema Validation Edge Cases Tests (RED PHASE)
 *
 * This test suite covers boundary conditions, malformed data, and security
 * vulnerabilities in our Zod schemas. These tests should initially fail to
 * identify gaps in our validation logic.
 *
 * Test Categories:
 * 1. Boundary Value Testing
 * 2. Malformed Data Injection
 * 3. Type Coercion Edge Cases
 * 4. Security Validation (XSS, SQL Injection patterns)
 * 5. Unicode and Encoding Edge Cases
 */

test.test.describe('Schema Validation Edge Cases (RED)', () => {

  test.test.describe('CourseSchema Edge Cases', () => {
    test('should fail: empty strings in required fields', () => {
      const invalidData = {
        $id: '',
        courseId: 'C844 73',
        subject: '',
        level: '',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(() => CourseSchema.parse(invalidData)).toThrow();
    });

    test('should fail: invalid courseId formats', () => {
      const testCases = [
        'c844 73', // lowercase
        'C84473', // no space
        'C844  73', // double space
        'C844-73', // hyphen instead of space
        'C 844 73', // space before number
        'C84 73', // too few digits
        'C8444 73', // too many digits
        'C844 734', // too many final digits
        'C844 7', // too few final digits
        'CC844 73', // too many letters
        '844 73', // missing letter
        'C844', // incomplete
        'C844 ', // trailing space
        ' C844 73', // leading space
        'C844\t73', // tab instead of space
        'C844\n73', // newline
        '', // empty
        'SELECT * FROM courses' // SQL injection attempt
      ];

      testCases.forEach(courseId => {
        const invalidData = {
          $id: 'course-123',
          courseId,
          subject: 'Test Subject',
          level: 'Test Level',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        expect(() => CourseSchema.parse(invalidData),
          `Should reject courseId: "${courseId}"`).toThrow();
      });
    });

    test('should fail: invalid status enum values', () => {
      const invalidStatuses = ['ACTIVE', 'disabled', 'deleted', '', null, 123, true];

      invalidStatuses.forEach(status => {
        const invalidData = {
          $id: 'course-123',
          courseId: 'C844 73',
          subject: 'Test Subject',
          level: 'Test Level',
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        expect(() => CourseSchema.parse(invalidData),
          `Should reject status: ${status}`).toThrow();
      });
    });

    test('should fail: invalid timestamp formats', () => {
      const invalidTimestamps = [
        '2024-01-01', // Date only
        '2024-01-01 10:00:00', // Space instead of T
        '2024-13-01T10:00:00Z', // Invalid month
        '2024-01-32T10:00:00Z', // Invalid day
        '2024-01-01T25:00:00Z', // Invalid hour
        '2024-01-01T10:60:00Z', // Invalid minute
        '2024-01-01T10:00:60Z', // Invalid second
        'invalid-date',
        '1234567890', // Unix timestamp
        '',
        null,
        undefined
      ];

      invalidTimestamps.forEach(timestamp => {
        const invalidData = {
          $id: 'course-123',
          courseId: 'C844 73',
          subject: 'Test Subject',
          level: 'Test Level',
          status: 'active' as const,
          createdAt: timestamp,
          updatedAt: new Date().toISOString()
        };

        expect(() => CourseSchema.parse(invalidData),
          `Should reject timestamp: ${timestamp}`).toThrow();
      });
    });

    test('should sanitize XSS injection attempts in text fields', () => {
      const xssPayloads = [
        'Math <script>alert("xss")</script>',
        'Physics javascript:alert()',
        'Chemistry <img src="x" onerror="alert(1)">',
        'Biology "><script>alert("xss")</script>',
        'English <svg onload="alert(1)">',
        'History ${alert("xss")}',
        'Science {{alert("xss")}}',
        'Geography <iframe src="javascript:alert(1)">'
      ];

      xssPayloads.forEach(payload => {
        const testData = {
          $id: 'course-123',
          courseId: 'C844 73',
          subject: payload,
          level: payload,
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Schema should sanitize the input and succeed
        const result = CourseSchema.parse(testData);

        // Verify that dangerous content has been removed
        expect(result.subject).not.toContain('<script');
        expect(result.subject).not.toContain('javascript:');
        expect(result.subject).not.toContain('onerror=');
        expect(result.subject).not.toContain('onload=');
        expect(result.level).not.toContain('<script');
        expect(result.level).not.toContain('javascript:');
      });
    });
  });

  test.describe('StudentSchema Edge Cases', () => {
    test('should fail: extremely long student names', () => {
      const longName = 'A'.repeat(1000); // 1000 characters

      const invalidData = {
        $id: 'student-123',
        userId: 'user-123',
        name: longName,
        accommodations: [],
        enrolledCourses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(() => StudentSchema.parse(invalidData)).toThrow();
    });

    test('should fail: invalid array structures', () => {
      const invalidData = {
        $id: 'student-123',
        userId: 'user-123',
        name: 'Test Student',
        accommodations: 'not-an-array', // Should be array
        enrolledCourses: 'not-an-array', // Should be array
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(() => StudentSchema.parse(invalidData)).toThrow();
    });

    test('should fail: array with invalid element types', () => {
      const invalidData = {
        $id: 'student-123',
        userId: 'user-123',
        name: 'Test Student',
        accommodations: [123, true, null, {}], // Should be strings
        enrolledCourses: ['valid-id', 123, null], // Should be strings
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(() => StudentSchema.parse(invalidData)).toThrow();
    });

    test('should fail: empty or invalid IDs', () => {
      const invalidIds = ['', '   ', '\t', '\n', null, undefined, 123, true, {}];

      invalidIds.forEach(id => {
        const invalidData = {
          $id: id,
          userId: 'user-123',
          name: 'Test Student',
          accommodations: [],
          enrolledCourses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        expect(() => StudentSchema.parse(invalidData),
          `Should reject ID: ${id}`).toThrow();
      });
    });
  });

  test.describe('LessonTemplateSchema Edge Cases', () => {
    test('should fail: title length boundary violations', () => {
      const tooLongTitle = 'A'.repeat(201); // Exceeds 200 char limit

      const invalidData = {
        $id: 'lesson-123',
        courseId: 'C844 73',
        title: tooLongTitle,
        outcomeRefs: ['AOM3.1'],
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(() => LessonTemplateSchema.parse(invalidData)).toThrow();
    });

    test('should fail: duration boundary violations', () => {
      const invalidDurations = [
        4, // Below minimum
        121, // Above maximum
        -1, // Negative
        0, // Zero
        3.5, // Decimal
        'string', // Wrong type
        null,
        Infinity,
        -Infinity,
        NaN
      ];

      invalidDurations.forEach(duration => {
        const invalidData = {
          $id: 'lesson-123',
          courseId: 'C844 73',
          title: 'Test Lesson',
          outcomeRefs: ['AOM3.1'],
          estMinutes: duration,
          status: 'draft' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        expect(() => LessonTemplateSchema.parse(invalidData),
          `Should reject duration: ${duration}`).toThrow();
      });
    });

    test('should fail: empty outcomeRefs array', () => {
      const invalidData = {
        $id: 'lesson-123',
        courseId: 'C844 73',
        title: 'Test Lesson',
        outcomeRefs: [], // Should have at least one
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(() => LessonTemplateSchema.parse(invalidData)).toThrow();
    });

    test('should fail: invalid difficulty enum values', () => {
      const invalidDifficulties = ['easy', 'hard', 'expert', '', null, 123];

      invalidDifficulties.forEach(difficulty => {
        const invalidData = {
          $id: 'lesson-123',
          courseId: 'C844 73',
          title: 'Test Lesson',
          outcomeRefs: ['AOM3.1'],
          difficulty,
          status: 'draft' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        expect(() => LessonTemplateSchema.parse(invalidData),
          `Should reject difficulty: ${difficulty}`).toThrow();
      });
    });
  });

  test.describe('SessionStartRequestSchema Edge Cases', () => {
    test('should fail: invalid email formats', () => {
      const invalidEmails = [
        'plainaddress',
        '@missingdomain.com',
        'missing@.com',
        'missing@domain',
        'spaces in@email.com',
        'email@',
        '@domain.com',
        'email@domain',
        'email.domain.com',
        'email@domain..com',
        'email@.domain.com',
        'email@domain.com.',
        'a'.repeat(255) + '@domain.com', // Too long
        '',
        null,
        undefined,
        123,
        true,
        'SELECT * FROM users WHERE email=\'test@test.com\'' // SQL injection
      ];

      invalidEmails.forEach(email => {
        const invalidData = {
          email,
          password: 'validpassword'
        };

        expect(() => SessionStartRequestSchema.parse(invalidData),
          `Should reject email: ${email}`).toThrow();
      });
    });

    test('should fail: password validation edge cases', () => {
      const invalidPasswords = [
        '', // Empty
        '   ', // Whitespace only
        '\t\n', // Tabs and newlines only
        'ab', // Too short (less than 4 chars)
        'a'.repeat(129), // Too long (more than 128 chars)
        null,
        undefined,
        123,
        true,
        '    valid    ' // Should fail because trimmed length check
      ];

      invalidPasswords.forEach(password => {
        const invalidData = {
          email: 'test@example.com',
          password
        };

        expect(() => SessionStartRequestSchema.parse(invalidData),
          `Should reject password: ${password}`).toThrow();
      });
    });

    test('should fail: SQL injection attempts in credentials', () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "' OR 1=1 --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --"
      ];

      sqlInjectionPayloads.forEach(payload => {
        const invalidData = {
          email: `test${payload}@example.com`,
          password: `password${payload}`
        };

        // Note: Our schema should detect and reject SQL injection patterns
        expect(() => SessionStartRequestSchema.parse(invalidData),
          `Should reject SQL injection: ${payload}`).toThrow();
      });
    });
  });

  test.describe('GetRecommendationsRequestSchema Edge Cases', () => {
    test('should fail: courseId validation bypasses', () => {
      const bypassAttempts = [
        '../C844 73', // Path traversal
        'C844 73; DROP TABLE courses;', // SQL injection
        'C84473', // Missing space
        'c844 73', // Lowercase
        'C844  73', // Double space
        'C844-73', // Wrong separator
        'C8448 73', // Wrong digit count
        'C84 73', // Wrong digit count
        'CC844 73', // Too many letters
        '1844 73', // Number instead of letter
        'C844 731' // Too many final digits
      ];

      bypassAttempts.forEach(courseId => {
        const invalidData = { courseId };

        expect(() => GetRecommendationsRequestSchema.parse(invalidData),
          `Should reject bypass attempt: ${courseId}`).toThrow();
      });
    });
  });

  test.describe('LessonCandidateSchema Edge Cases', () => {
    test('should fail: priority score boundary violations', () => {
      const invalidScores = [
        -0.1, // Below minimum
        1.1, // Above maximum
        -1,
        2,
        Infinity,
        -Infinity,
        NaN,
        'string',
        null,
        undefined
      ];

      invalidScores.forEach(score => {
        const invalidData = {
          lessonTemplateId: 'lesson-123',
          title: 'Test Lesson',
          targetOutcomeIds: ['AOM3.1'],
          priorityScore: score,
          reasons: ['overdue'],
          flags: []
        };

        expect(() => LessonCandidateSchema.parse(invalidData),
          `Should reject priority score: ${score}`).toThrow();
      });
    });

    test('should fail: invalid reason enum values', () => {
      const invalidReasons = [
        ['invalid-reason'],
        ['overdue', 'invalid'],
        [''],
        [null],
        [undefined],
        [123],
        ['OVERDUE'], // Wrong case
        ['over due'], // Space in enum
        'overdue' // Not an array
      ];

      invalidReasons.forEach(reasons => {
        const invalidData = {
          lessonTemplateId: 'lesson-123',
          title: 'Test Lesson',
          targetOutcomeIds: ['AOM3.1'],
          priorityScore: 0.5,
          reasons,
          flags: []
        };

        expect(() => LessonCandidateSchema.parse(invalidData),
          `Should reject reasons: ${JSON.stringify(reasons)}`).toThrow();
      });
    });

    test('should fail: empty targetOutcomeIds array', () => {
      const invalidData = {
        lessonTemplateId: 'lesson-123',
        title: 'Test Lesson',
        targetOutcomeIds: [], // Should have at least one
        priorityScore: 0.5,
        reasons: ['overdue'],
        flags: []
      };

      expect(() => LessonCandidateSchema.parse(invalidData)).toThrow();
    });
  });

  test.describe('CourseRecommendationSchema Edge Cases', () => {
    test('should fail: candidates array size violations', () => {
      const emptyCandidates = {
        courseId: 'C844 73',
        generatedAt: new Date().toISOString(),
        graphRunId: 'run-123',
        candidates: [], // Should have at least 1
        rubric: 'Test rubric'
      };

      expect(() => CourseRecommendationSchema.parse(emptyCandidates)).toThrow();

      // Create 6 candidates (exceeds max of 5)
      const tooManyCandidates = {
        courseId: 'C844 73',
        generatedAt: new Date().toISOString(),
        graphRunId: 'run-123',
        candidates: Array(6).fill({
          lessonTemplateId: 'lesson-123',
          title: 'Test Lesson',
          targetOutcomeIds: ['AOM3.1'],
          priorityScore: 0.5,
          reasons: ['overdue'],
          flags: []
        }),
        rubric: 'Test rubric'
      };

      expect(() => CourseRecommendationSchema.parse(tooManyCandidates)).toThrow();
    });

    test('should fail: empty rubric string', () => {
      const invalidData = {
        courseId: 'C844 73',
        generatedAt: new Date().toISOString(),
        graphRunId: 'run-123',
        candidates: [{
          lessonTemplateId: 'lesson-123',
          title: 'Test Lesson',
          targetOutcomeIds: ['AOM3.1'],
          priorityScore: 0.5,
          reasons: ['overdue'],
          flags: []
        }],
        rubric: '' // Should not be empty
      };

      expect(() => CourseRecommendationSchema.parse(invalidData)).toThrow();
    });
  });

  test.describe('SchedulingConstraintsSchema Edge Cases', () => {
    test('should fail: constraint boundary violations', () => {
      const invalidConstraints = [
        { maxBlockMinutes: 4 }, // Below minimum
        { maxBlockMinutes: 121 }, // Above maximum
        { avoidRepeatWithinDays: -1 }, // Below minimum
        { avoidRepeatWithinDays: 31 }, // Above maximum
        { maxBlockMinutes: 25.5 }, // Not integer
        { preferOverdue: 'yes' }, // Not boolean
        { preferLowEMA: 1 } // Not boolean
      ];

      invalidConstraints.forEach(constraints => {
        expect(() => SchedulingConstraintsSchema.parse(constraints),
          `Should reject constraints: ${JSON.stringify(constraints)}`).toThrow();
      });
    });
  });

  test.describe('Unicode and Special Character Edge Cases', () => {
    test('should fail: unicode normalization attacks', () => {
      const unicodeAttacks = [
        'C8\u0034\u00344 73', // Unicode normalization
        'C84４ 73', // Full-width digit
        'Ⅽ844 73', // Roman numeral C
        'С844 73', // Cyrillic C
        'C844\uFE0E 73', // Variation selector
        'C844\u180E73', // Mongolian vowel separator
        'C‌844 73', // Zero-width non-joiner
        'C\u200D844 73' // Zero-width joiner
      ];

      unicodeAttacks.forEach(courseId => {
        const invalidData = { courseId };

        expect(() => GetRecommendationsRequestSchema.parse(invalidData),
          `Should reject unicode attack: ${courseId}`).toThrow();
      });
    });

    test('should fail: control character injection', () => {
      const controlChars = [
        'C844\x0073', // Null
        'C844\x0173', // Start of heading
        'C844\x0273', // Start of text
        'C844\x0373', // End of text
        'C844\x0773', // Bell
        'C844\x0873', // Backspace
        'C844\x1B73', // Escape
        'C844\x7F73'  // Delete
      ];

      controlChars.forEach(courseId => {
        const invalidData = { courseId };

        expect(() => GetRecommendationsRequestSchema.parse(invalidData),
          `Should reject control character: ${courseId}`).toThrow();
      });
    });
  });

  test.describe('Type Coercion and Prototype Pollution Edge Cases', () => {
    test('should fail: prototype pollution attempts', () => {
      const pollutionAttempts = [
        { extraProperty: 'should-be-rejected' },
        { constructor: 'pollution-attempt' },
        { 'prototype.polluted': true },
        { admin: true },
        { isAdmin: true },
        { unauthorized: 'access' },
        { maliciousField: 'attack' }
      ];

      pollutionAttempts.forEach((attempt, index) => {
        const testData = {
          $id: 'course-123',
          courseId: 'C844 73',
          subject: 'Test',
          level: 'Test',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...attempt
        };

        expect(() => CourseSchema.parse(testData),
          `Should reject pollution attempt ${index}: ${JSON.stringify(attempt)}`).toThrow();
      });
    });

    test('should fail: type confusion attacks', () => {
      const typeConfusion = [
        { $id: ['array-instead-of-string'] },
        { $id: { object: 'instead-of-string' } },
        { $id: function() { return 'function'; } },
        { $id: Symbol('symbol') },
        { status: ['active'] }, // Array instead of string
        { createdAt: 1234567890 }, // Number instead of ISO string
        { enrolledCourses: 'string-instead-of-array' }
      ];

      typeConfusion.forEach(confusion => {
        expect(() => CourseSchema.parse({
          $id: 'course-123',
          courseId: 'C844 73',
          subject: 'Test',
          level: 'Test',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...confusion
        }), `Should reject type confusion: ${JSON.stringify(confusion)}`).toThrow();
      });
    });
  });
});