import { z } from 'zod';

// Security validation helpers
const sanitizeString = (str: string) => {
  // Remove potential XSS vectors and normalize unicode
  return str.replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .normalize('NFC') // Normalize unicode
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
};

const createSecureStringSchema = (minLength = 1, maxLength = 1000, fieldName = 'field') => {
  return z.string()
    .min(minLength, `${fieldName} is required`)
    .max(maxLength, `${fieldName} is too long`)
    .transform(sanitizeString)
    .refine((val) => val.length >= minLength, `${fieldName} is required after sanitization`);
};

// Base schemas for common patterns
const IdSchema = z.string()
  .min(1, 'ID cannot be empty')
  .max(50, 'ID is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID can only contain alphanumeric characters, hyphens, and underscores')
  .transform(sanitizeString);
const TimestampSchema = z.string().datetime();
const OptionalTimestampSchema = z.string().datetime().optional();

// Course schema
export const CourseSchema = z.object({
  $id: IdSchema,
  courseId: z.string()
    .regex(/^[A-Z]\d{3}\s\d{2}$/, 'Course ID must match exact format like C844 73')
    .refine((val) => !/[\t\n\r]/.test(val), 'Course ID cannot contain tab, newline, or carriage return characters')
    .refine((val) => !/<|>|script|javascript|on\w+=/i.test(val), 'Invalid characters in course ID'),
  subject: createSecureStringSchema(1, 100, 'Subject'),
  level: createSecureStringSchema(1, 50, 'Level'),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
}).strict();

// Student schema
export const StudentSchema = z.object({
  $id: IdSchema,
  userId: IdSchema,
  name: createSecureStringSchema(1, 200, 'Student name'),
  // Handle accommodations as either array or string (convert string to array)
  accommodations: z.union([
    z.array(createSecureStringSchema(1, 100, 'Accommodation')),
    z.string().transform(str => str ? str.split(',').map(s => s.trim()) : [])
  ]).default([]),
  // Handle enrolledCourses as either array or string (convert string to array)
  enrolledCourses: z.union([
    z.array(IdSchema),
    z.string().transform(str => str ? str.split(',').map(s => s.trim()) : [])
  ]).default([]),
  // Handle timestamps more flexibly
  createdAt: z.union([TimestampSchema, z.string()]).optional(),
  updatedAt: z.union([TimestampSchema, z.string()]).optional(),
  // Handle additional fields that might exist in the database
  role: z.string().optional(),
  $sequence: z.number().optional()
}).strict(false); // Allow additional fields

// Lesson template schema - designed to match actual Appwrite data structure
export const LessonTemplateSchema = z.object({
  $id: z.string(), // Remove strict IdSchema validation
  courseId: z.string(), // Allow spaces in course ID like "C844 73"
  title: createSecureStringSchema(1, 200, 'Lesson title'),

  // Handle JSON string that needs parsing (Appwrite stores as string)
  outcomeRefs: z.union([
    z.array(z.any()), // Already parsed array
    z.string().transform(str => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback to comma-separated string parsing
        return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
    })
  ]),

  // Handle JSON string for cards (Appwrite stores as string)
  cards: z.union([
    z.array(z.any()), // Already parsed array
    z.string().transform(str => {
      try {
        return JSON.parse(str);
      } catch {
        return [];
      }
    })
  ]).optional(),

  // Handle null estMinutes (Appwrite can store null)
  estMinutes: z.union([
    z.number().int().min(5).max(120),
    z.null().transform(() => 30), // Default to 30 minutes if null
    z.string().transform(str => parseInt(str, 10) || 30)
  ]).nullable().optional(),

  status: z.enum(['draft', 'published']).default('draft'), // Match Appwrite enum
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  prerequisites: z.array(z.string()).default([]), // Simplified

  // Appwrite timestamps - flexible handling
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),

  // Appwrite-specific fields that exist in the database
  version: z.number().optional(),
  createdBy: z.string().optional(),
  $sequence: z.number().optional(),
  $permissions: z.array(z.any()).optional(),
  $databaseId: z.string().optional(),
  $collectionId: z.string().optional()
}).passthrough(); // Allow any additional fields from Appwrite

// Scheme of Work entry schema
export const SchemeOfWorkEntrySchema = z.object({
  $id: IdSchema,
  courseId: z.string().regex(/^[A-Z]\d{3}\s\d{2}$/),
  lessonTemplateId: IdSchema,
  order: z.number().int().min(1, 'Order must be positive'),
  plannedAt: OptionalTimestampSchema,
  completedAt: OptionalTimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
}).strict();

// Mastery record schema
export const MasteryRecordSchema = z.object({
  $id: IdSchema,
  studentId: IdSchema,
  courseId: IdSchema.optional(), // Optional for cross-course tracking
  emaByOutcome: z.record(z.string(), z.number().min(0).max(1)),
  lastUpdated: TimestampSchema,
  createdAt: TimestampSchema
}).strict();

// Routine record schema
export const RoutineRecordSchema = z.object({
  $id: IdSchema,
  studentId: IdSchema,
  courseId: IdSchema.optional(),
  dueAtByOutcome: z.record(z.string(), TimestampSchema),
  lastTaughtAt: OptionalTimestampSchema,
  recentTemplateIds: z.array(IdSchema).max(10, 'Too many recent templates').default([]),
  lastUpdated: TimestampSchema,
  createdAt: TimestampSchema
}).strict();

// Planner thread schema (for tracking Course Manager graph runs)
export const PlannerThreadSchema = z.object({
  $id: IdSchema,
  studentId: IdSchema,
  courseId: IdSchema,
  graphRunId: createSecureStringSchema(1, 100, 'Graph run ID'),
  lastRecommendationAt: TimestampSchema,
  recommendationCount: z.number().int().min(0).default(0),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
}).strict();

// Session schema
export const SessionSchema = z.object({
  $id: IdSchema,
  studentId: IdSchema,
  threadId: IdSchema,
  contextChatThreadId: IdSchema.optional(), // Context chat thread ID for separate context-aware conversations
  lessonTemplateId: IdSchema,
  courseId: IdSchema,
  status: z.enum(['created', 'active', 'completed', 'abandoned', 'failed']).default('created'),
  startedAt: OptionalTimestampSchema,
  completedAt: OptionalTimestampSchema,
  durationMinutes: z.number().int().min(0).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
}).strict();

// API request/response schemas
export const GetRecommendationsRequestSchema = z.object({
  courseId: z.string()
    .regex(/^[A-Z]\d{3}\s\d{2}$/, 'Course ID must match exact format like C844 73')
    .refine((val) => val.length === 7, 'Course ID must be exactly 7 characters')
    .refine((val) => !/<|>|script|javascript|'|\"|;|--/i.test(val), 'Invalid characters in course ID')
}).strict();

export const LessonCandidateSchema = z.object({
  lessonTemplateId: IdSchema,
  title: createSecureStringSchema(1, 200, 'Title'),
  targetOutcomeIds: z.array(createSecureStringSchema(1, 100, 'Target outcome ID')).min(1),
  estimatedMinutes: z.number().int().min(5).max(120).optional(),
  priorityScore: z.number().min(0).max(1),
  reasons: z.array(z.enum(['overdue', 'low mastery', 'early order', 'recent', 'long lesson', 'short win'])),
  flags: z.array(createSecureStringSchema(1, 50, 'Flag')).default([])
}).strict();

export const CourseRecommendationSchema = z.object({
  courseId: z.string().regex(/^[A-Z]\d{3}\s\d{2}$/),
  generatedAt: TimestampSchema,
  graphRunId: createSecureStringSchema(1, 100, 'Graph run ID'),
  candidates: z.array(LessonCandidateSchema).min(1, 'At least one candidate required').max(5, 'Maximum 5 candidates'),
  rubric: createSecureStringSchema(1, 2000, 'Rubric explanation')
}).strict();

export const CreateSessionRequestSchema = z.object({
  lessonTemplateId: IdSchema,
  courseId: z.string()
    .min(1, 'Course ID is required')
    .max(20, 'Course ID is too long')
    .regex(/^[A-Z]\d{3}\s\d{2}$/, 'Course ID must match format like C844 73')
    .transform(sanitizeString)
}).strict();

export const CreateSessionResponseSchema = z.object({
  sessionId: IdSchema,
  threadId: IdSchema,
  lessonTemplateId: IdSchema,
  status: z.enum(['created']),
  createdAt: TimestampSchema
}).strict();

// Scheduling context schema
export const SchedulingConstraintsSchema = z.object({
  maxBlockMinutes: z.number().int().min(5).max(120).default(25),
  avoidRepeatWithinDays: z.number().int().min(0).max(30).default(3),
  preferOverdue: z.boolean().default(true),
  preferLowEMA: z.boolean().default(true)
}).strict();

export const SchedulingContextSchema = z.object({
  student: z.object({
    id: IdSchema,
    displayName: z.string().max(200, 'Display name too long').transform(sanitizeString).optional(),
    accommodations: z.array(createSecureStringSchema(1, 100, 'Accommodation')).default([])
  }).strict(),
  course: CourseSchema,
  sow: z.object({
    entries: z.array(z.object({
      order: z.number().int().min(1),
      lessonTemplateId: IdSchema,
      plannedAt: OptionalTimestampSchema
    }).strict())
  }).strict(),
  templates: z.array(LessonTemplateSchema.omit({ createdAt: true, updatedAt: true })),
  mastery: z.object({
    emaByOutcome: z.record(z.string(), z.number().min(0).max(1))
  }).strict().optional(),
  routine: z.object({
    dueAtByOutcome: z.record(z.string(), TimestampSchema),
    lastTaughtAt: OptionalTimestampSchema,
    recentTemplateIds: z.array(IdSchema).default([])
  }).strict().optional(),
  constraints: SchedulingConstraintsSchema.optional(),
  graphRunId: z.string().max(100, 'Graph run ID too long').transform(sanitizeString).optional()
}).strict();

// Error schemas
export const APIErrorSchema = z.object({
  error: createSecureStringSchema(1, 500, 'Error message'),
  details: z.string().max(1000, 'Error details too long').transform(sanitizeString).optional(),
  statusCode: z.number().int().min(400).max(599)
}).strict();

// Collection validation schemas (for database operations)
export const DatabaseCollections = {
  courses: CourseSchema,
  students: StudentSchema,
  lesson_templates: LessonTemplateSchema,
  scheme_of_work: SchemeOfWorkEntrySchema,
  mastery: MasteryRecordSchema,
  routine: RoutineRecordSchema,
  planner_threads: PlannerThreadSchema,
  sessions: SessionSchema
} as const;

// Export types inferred from schemas
export type Course = z.infer<typeof CourseSchema>;
export type Student = z.infer<typeof StudentSchema>;
export type LessonTemplate = z.infer<typeof LessonTemplateSchema>;
export type SchemeOfWorkEntry = z.infer<typeof SchemeOfWorkEntrySchema>;
export type MasteryRecord = z.infer<typeof MasteryRecordSchema>;
export type RoutineRecord = z.infer<typeof RoutineRecordSchema>;
export type PlannerThread = z.infer<typeof PlannerThreadSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type LessonCandidate = z.infer<typeof LessonCandidateSchema>;
export type CourseRecommendation = z.infer<typeof CourseRecommendationSchema>;
export type SchedulingContext = z.infer<typeof SchedulingContextSchema>;
export type SchedulingConstraints = z.infer<typeof SchedulingConstraintsSchema>;
export type APIError = z.infer<typeof APIErrorSchema>;

// Validation helper functions
export const validateCollection = <T extends keyof typeof DatabaseCollections>(
  collection: T,
  data: unknown
): z.infer<typeof DatabaseCollections[T]> => {
  return DatabaseCollections[collection].parse(data);
};

export const safeValidateCollection = <T extends keyof typeof DatabaseCollections>(
  collection: T,
  data: unknown
): { success: true; data: z.infer<typeof DatabaseCollections[T]> } | { success: false; error: z.ZodError } => {
  const result = DatabaseCollections[collection].safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

// Schema transformation helpers
export const transformAppwriteDocument = <T>(doc: any, schema: z.ZodSchema<T>): T => {
  // Remove Appwrite-specific fields and validate
  const cleaned = {
    ...doc,
    // Ensure timestamps are in ISO format with fallback to current time if missing
    createdAt: doc.$createdAt || doc.createdAt || new Date().toISOString(),
    updatedAt: doc.$updatedAt || doc.updatedAt || new Date().toISOString()
  };

  // Remove Appwrite metadata fields
  delete cleaned.$createdAt;
  delete cleaned.$updatedAt;
  delete cleaned.$permissions;
  delete cleaned.$databaseId;
  delete cleaned.$collectionId;

  return schema.parse(cleaned);
};

export const prepareForAppwrite = (data: Record<string, any>): Record<string, any> => {
  const prepared = { ...data };

  // Remove schema-generated fields that Appwrite manages
  delete prepared.$id;
  delete prepared.createdAt;
  delete prepared.updatedAt;

  // Convert arrays to JSON strings for Appwrite storage if needed
  if (prepared.outcomeRefs && Array.isArray(prepared.outcomeRefs)) {
    prepared.outcomeRefs = JSON.stringify(prepared.outcomeRefs);
  }
  if (prepared.accommodations && Array.isArray(prepared.accommodations)) {
    prepared.accommodations = JSON.stringify(prepared.accommodations);
  }
  if (prepared.enrolledCourses && Array.isArray(prepared.enrolledCourses)) {
    prepared.enrolledCourses = JSON.stringify(prepared.enrolledCourses);
  }
  if (prepared.recentTemplateIds && Array.isArray(prepared.recentTemplateIds)) {
    prepared.recentTemplateIds = JSON.stringify(prepared.recentTemplateIds);
  }

  return prepared;
};

// Session management schemas
export const SessionStartRequestSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(254, 'Email too long')
    .transform(sanitizeString)
    .refine((val) => !/<|>|script|javascript|'|"|;|--/i.test(val), 'Invalid characters in email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .refine(val => val.trim().length > 0, 'Password cannot be empty or whitespace only')
    .refine(val => val === val.trim(), 'Password cannot have leading or trailing whitespace')
    .refine((val) => !/[\u0000-\u001F\u007F-\u009F]/.test(val), 'Password contains invalid control characters')
    .refine((val) => !/'|"|;|--|\/\*|\*\/|xp_|sp_/.test(val), 'Password contains potentially dangerous characters')
}).strict();

export type SessionStartRequest = z.infer<typeof SessionStartRequestSchema>;

export const SessionResponseSchema = z.object({
  session: z.object({
    userId: IdSchema,
    sessionId: IdSchema,
    expiresAt: TimestampSchema
  }).strict(),
  user: z.object({
    $id: IdSchema,
    email: z.string().email().transform(sanitizeString),
    name: createSecureStringSchema(1, 200, 'User name')
  }).strict(),
  student: z.object({
    $id: IdSchema,
    userId: IdSchema,
    name: createSecureStringSchema(1, 200, 'Student name')
  }).strict()
}).strict();

export type SessionResponse = z.infer<typeof SessionResponseSchema>;