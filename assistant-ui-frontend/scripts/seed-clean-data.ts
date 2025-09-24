/**
 * Clean Seed Script - Deletes and recreates all data with proper references
 *
 * Data Model Architecture:
 * - course_outcomes: Source of truth for all outcomes (document IDs used as references)
 * - lesson_templates: References course_outcome document IDs in outcomeRefs array
 * - MasteryV2: Uses course_outcome document IDs as keys in emaByOutcome
 * - SOWV2: References lesson template IDs (which reference outcomes)
 * - Routine: Uses course_outcome document IDs in dueAtByOutcome
 */

import { Client, Databases, ID, Query } from 'node-appwrite';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'default';

// Debug environment variables
console.log('🔧 Environment check:');
console.log('- Endpoint:', process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT);
console.log('- Project ID:', process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
console.log('- Database ID:', DATABASE_ID);
console.log('- Has API Key:', !!process.env.APPWRITE_API_KEY);
console.log('');

// Type definitions for our data structures
interface Course {
  courseId: string;
  subject: string;
  level: string;
  status: 'active' | 'inactive';
}

interface CourseOutcome {
  courseId: string;
  outcomeRef: string;
  title: string;
  description: string;
  tags: string[];
}

interface LessonTemplate {
  courseId: string;
  title: string;
  outcomeRefs: string[]; // Will store course_outcome document IDs
  cards: any[];
  estMinutes: number;
  status: 'published' | 'draft';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// Course definitions
const COURSES: Course[] = [
  {
    courseId: 'C844 73',
    subject: 'Computing Science',
    level: 'National 5',
    status: 'active'
  },
  {
    courseId: 'H225 73',
    subject: 'Mathematics',
    level: 'National 5',
    status: 'active'
  },
  {
    courseId: 'H224 74',
    subject: 'Mathematics',
    level: 'Higher',
    status: 'active'
  }
];

// Outcome definitions with proper structure
const COURSE_OUTCOMES: CourseOutcome[] = [
  // Computing Science (C844 73) - 6 outcomes
  {
    courseId: 'C844 73',
    outcomeRef: 'C844_73_O1',
    title: 'Understanding Computer Systems',
    description: 'I can describe the structure and operation of contemporary computer systems',
    tags: ['hardware', 'systems', 'architecture']
  },
  {
    courseId: 'C844 73',
    outcomeRef: 'C844_73_O2',
    title: 'Data Representation',
    description: 'I can explain how computers represent and process different types of data',
    tags: ['binary', 'data', 'representation']
  },
  {
    courseId: 'C844 73',
    outcomeRef: 'C844_73_O3',
    title: 'Programming Constructs',
    description: 'I can implement programs using selection, iteration and complex data structures',
    tags: ['programming', 'algorithms', 'data-structures']
  },
  {
    courseId: 'C844 73',
    outcomeRef: 'C844_73_O4',
    title: 'Software Development',
    description: 'I can apply software development methodologies and testing strategies',
    tags: ['development', 'testing', 'methodologies']
  },
  {
    courseId: 'C844 73',
    outcomeRef: 'C844_73_O5',
    title: 'Database Design',
    description: 'I can design and implement relational databases',
    tags: ['database', 'sql', 'design']
  },
  {
    courseId: 'C844 73',
    outcomeRef: 'C844_73_O6',
    title: 'Web Development',
    description: 'I can create interactive web applications using HTML, CSS and JavaScript',
    tags: ['web', 'html', 'css', 'javascript']
  },

  // N5 Mathematics (H225 73) - 6 outcomes
  {
    courseId: 'H225 73',
    outcomeRef: 'H225_73_O1',
    title: 'Number Operations',
    description: 'I can perform calculations involving fractions, decimals and percentages',
    tags: ['numbers', 'calculations', 'percentages']
  },
  {
    courseId: 'H225 73',
    outcomeRef: 'H225_73_O2',
    title: 'Algebraic Expressions',
    description: 'I can simplify and factorize algebraic expressions',
    tags: ['algebra', 'expressions', 'factorization']
  },
  {
    courseId: 'H225 73',
    outcomeRef: 'H225_73_O3',
    title: 'Equations and Inequalities',
    description: 'I can solve linear and quadratic equations and inequalities',
    tags: ['equations', 'inequalities', 'solving']
  },
  {
    courseId: 'H225 73',
    outcomeRef: 'H225_73_O4',
    title: 'Geometry and Trigonometry',
    description: 'I can apply Pythagoras theorem and basic trigonometry',
    tags: ['geometry', 'trigonometry', 'pythagoras']
  },
  {
    courseId: 'H225 73',
    outcomeRef: 'H225_73_O5',
    title: 'Statistics',
    description: 'I can analyze and interpret statistical data and graphs',
    tags: ['statistics', 'data', 'graphs']
  },
  {
    courseId: 'H225 73',
    outcomeRef: 'H225_73_O6',
    title: 'Relationships',
    description: 'I can work with linear relationships and graphs',
    tags: ['graphs', 'linear', 'relationships']
  },

  // Higher Mathematics (H224 74) - 6 outcomes
  {
    courseId: 'H224 74',
    outcomeRef: 'H224_74_O1',
    title: 'Differentiation',
    description: 'I can differentiate functions and apply differentiation to optimization problems',
    tags: ['calculus', 'differentiation', 'optimization']
  },
  {
    courseId: 'H224 74',
    outcomeRef: 'H224_74_O2',
    title: 'Integration',
    description: 'I can integrate functions and calculate areas under curves',
    tags: ['calculus', 'integration', 'areas']
  },
  {
    courseId: 'H224 74',
    outcomeRef: 'H224_74_O3',
    title: 'Vectors',
    description: 'I can perform vector operations in 2D and 3D',
    tags: ['vectors', 'geometry', '3d']
  },
  {
    courseId: 'H224 74',
    outcomeRef: 'H224_74_O4',
    title: 'Complex Algebra',
    description: 'I can manipulate complex algebraic expressions and solve equations',
    tags: ['algebra', 'complex', 'equations']
  },
  {
    courseId: 'H224 74',
    outcomeRef: 'H224_74_O5',
    title: 'Polynomials',
    description: 'I can work with polynomials and apply the remainder theorem',
    tags: ['polynomials', 'remainder', 'factorization']
  },
  {
    courseId: 'H224 74',
    outcomeRef: 'H224_74_O6',
    title: 'Trigonometric Functions',
    description: 'I can solve problems involving trigonometric functions and identities',
    tags: ['trigonometry', 'functions', 'identities']
  }
];

// Store outcome document IDs for reference when creating templates
const outcomeIdMap: Map<string, string> = new Map();

async function deleteAllDocuments(collectionId: string) {
  console.log(`🗑️  Deleting all documents from ${collectionId}...`);
  try {
    let hasMore = true;
    let deletedCount = 0;

    while (hasMore) {
      const response = await databases.listDocuments(
        DATABASE_ID,
        collectionId,
        [Query.limit(100)]
      );

      if (response.documents.length === 0) {
        hasMore = false;
      } else {
        for (const doc of response.documents) {
          await databases.deleteDocument(DATABASE_ID, collectionId, doc.$id);
          deletedCount++;
        }
      }
    }

    console.log(`   ✅ Deleted ${deletedCount} documents from ${collectionId}`);
  } catch (error) {
    console.error(`   ❌ Error deleting from ${collectionId}:`, error);
  }
}

async function seedCourses() {
  console.log('📚 Seeding courses...');

  for (const course of COURSES) {
    try {
      const doc = await databases.createDocument(
        DATABASE_ID,
        'courses',
        ID.unique(),
        course
      );
      console.log(`   ✅ Created course: ${course.courseId} - ${course.subject}`);
    } catch (error) {
      console.error(`   ❌ Error creating course ${course.courseId}:`, error);
    }
  }
}

async function seedCourseOutcomes() {
  console.log('🎯 Seeding course outcomes (source of truth)...');

  for (const outcome of COURSE_OUTCOMES) {
    try {
      const doc = await databases.createDocument(
        DATABASE_ID,
        'course_outcomes',
        ID.unique(),
        outcome
      );

      // Store the document ID for later reference
      outcomeIdMap.set(outcome.outcomeRef, doc.$id);

      console.log(`   ✅ Created outcome: ${outcome.outcomeRef} (ID: ${doc.$id})`);
    } catch (error) {
      console.error(`   ❌ Error creating outcome ${outcome.outcomeRef}:`, error);
    }
  }

  console.log(`   📋 Outcome ID mapping created with ${outcomeIdMap.size} entries`);
}

async function seedLessonTemplates() {
  console.log('📝 Seeding lesson templates with proper outcome references...');

  // Templates for each course (2 per course for simplicity)
  const templates: LessonTemplate[] = [
    // Computing Science templates
    {
      courseId: 'C844 73',
      title: 'Introduction to Binary Numbers',
      outcomeRefs: [
        outcomeIdMap.get('C844_73_O1')!,
        outcomeIdMap.get('C844_73_O2')!
      ],
      cards: [
        {
          type: 'text',
          content: 'Understanding how computers represent data in binary'
        },
        {
          type: 'exercise',
          content: 'Convert decimal numbers to binary'
        }
      ],
      estMinutes: 45,
      status: 'published',
      difficulty: 'beginner'
    },
    {
      courseId: 'C844 73',
      title: 'Python Functions and Lists',
      outcomeRefs: [
        outcomeIdMap.get('C844_73_O3')!,
        outcomeIdMap.get('C844_73_O4')!
      ],
      cards: [
        {
          type: 'text',
          content: 'Creating and using functions in Python'
        },
        {
          type: 'code',
          content: 'def calculate_average(numbers):\n    return sum(numbers) / len(numbers)'
        }
      ],
      estMinutes: 50,
      status: 'published',
      difficulty: 'intermediate'
    },

    // N5 Mathematics templates
    {
      courseId: 'H225 73',
      title: 'Fractions and Percentages',
      outcomeRefs: [
        outcomeIdMap.get('H225_73_O1')!
      ],
      cards: [
        {
          type: 'text',
          content: 'Converting between fractions, decimals and percentages'
        },
        {
          type: 'exercise',
          content: 'Convert 3/4 to a percentage'
        }
      ],
      estMinutes: 40,
      status: 'published',
      difficulty: 'beginner'
    },
    {
      courseId: 'H225 73',
      title: 'Solving Quadratic Equations',
      outcomeRefs: [
        outcomeIdMap.get('H225_73_O2')!,
        outcomeIdMap.get('H225_73_O3')!
      ],
      cards: [
        {
          type: 'text',
          content: 'Using the quadratic formula to solve equations'
        },
        {
          type: 'formula',
          content: 'x = (-b ± √(b² - 4ac)) / 2a'
        }
      ],
      estMinutes: 55,
      status: 'published',
      difficulty: 'intermediate'
    },

    // Higher Mathematics templates
    {
      courseId: 'H224 74',
      title: 'Introduction to Differentiation',
      outcomeRefs: [
        outcomeIdMap.get('H224_74_O1')!
      ],
      cards: [
        {
          type: 'text',
          content: 'Finding derivatives using first principles'
        },
        {
          type: 'exercise',
          content: 'Differentiate f(x) = x³ + 2x² - 5x + 3'
        }
      ],
      estMinutes: 60,
      status: 'published',
      difficulty: 'advanced'
    },
    {
      courseId: 'H224 74',
      title: 'Vector Operations in 3D',
      outcomeRefs: [
        outcomeIdMap.get('H224_74_O3')!
      ],
      cards: [
        {
          type: 'text',
          content: 'Calculating dot and cross products of vectors'
        },
        {
          type: 'formula',
          content: 'a · b = |a||b|cos(θ)'
        }
      ],
      estMinutes: 50,
      status: 'published',
      difficulty: 'advanced'
    }
  ];

  for (const template of templates) {
    try {
      // Ensure outcomeRefs is stored as JSON string (Appwrite requirement)
      const doc = await databases.createDocument(
        DATABASE_ID,
        'lesson_templates',
        ID.unique(),
        {
          ...template,
          outcomeRefs: JSON.stringify(template.outcomeRefs),
          cards: JSON.stringify(template.cards)
        }
      );

      console.log(`   ✅ Created template: ${template.title} (Outcomes: ${template.outcomeRefs.length})`);
    } catch (error) {
      console.error(`   ❌ Error creating template ${template.title}:`, error);
    }
  }
}

async function seedInitialMasteryV2() {
  console.log('📊 Seeding initial MasteryV2 records for test student...');

  // Create sample mastery data for test student
  const testStudentId = '68b812bb0009d9755b35'; // Test Student with enrolledCourses

  for (const course of COURSES) {
    try {
      // Get all outcomes for this course
      const courseOutcomes = COURSE_OUTCOMES.filter(o => o.courseId === course.courseId);

      // Create emaByOutcome using document IDs as keys
      const emaByOutcome: { [key: string]: number } = {};
      courseOutcomes.forEach(outcome => {
        const docId = outcomeIdMap.get(outcome.outcomeRef);
        if (docId) {
          // Assign varying mastery levels for testing
          const masteryLevel = 0.3 + Math.random() * 0.5; // Random between 0.3 and 0.8
          emaByOutcome[docId] = Math.round(masteryLevel * 100) / 100;
        }
      });

      const doc = await databases.createDocument(
        DATABASE_ID,
        'MasteryV2',
        ID.unique(),
        {
          studentId: testStudentId,
          courseId: course.courseId,
          emaByOutcome: JSON.stringify(emaByOutcome),
          updatedAt: new Date().toISOString()
        }
      );

      console.log(`   ✅ Created MasteryV2 for course ${course.courseId} with ${Object.keys(emaByOutcome).length} outcomes`);
    } catch (error) {
      console.error(`   ❌ Error creating MasteryV2 for course ${course.courseId}:`, error);
    }
  }
}

async function seedInitialRoutine() {
  console.log('📅 Seeding initial Routine records for test student...');

  const testStudentId = '68b812bb0009d9755b35'; // Test Student with enrolledCourses

  for (const course of COURSES) {
    try {
      // Get all outcomes for this course
      const courseOutcomes = COURSE_OUTCOMES.filter(o => o.courseId === course.courseId);

      // Create dueAtByOutcome using document IDs as keys
      const dueAtByOutcome: { [key: string]: string } = {};
      courseOutcomes.forEach((outcome, index) => {
        const docId = outcomeIdMap.get(outcome.outcomeRef);
        if (docId) {
          // Stagger due dates for testing
          const daysOffset = 7 + (index * 3); // Due in 7, 10, 13, 16... days
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + daysOffset);
          dueAtByOutcome[docId] = dueDate.toISOString();
        }
      });

      const doc = await databases.createDocument(
        DATABASE_ID,
        'routine',
        ID.unique(),
        {
          studentId: testStudentId,
          courseId: course.courseId,
          dueAtByOutcome: JSON.stringify(dueAtByOutcome),
          recentTemplateIds: JSON.stringify([]),
          lastUpdated: new Date().toISOString()
        }
      );

      console.log(`   ✅ Created Routine for course ${course.courseId} with ${Object.keys(dueAtByOutcome).length} scheduled outcomes`);
    } catch (error) {
      console.error(`   ❌ Error creating Routine for course ${course.courseId}:`, error);
    }
  }
}

async function main() {
  console.log('🚀 Starting clean data seed process...');
  console.log('================================================');

  try {
    // Step 1: Delete all existing documents
    console.log('\n📦 Step 1: Cleaning existing data...');
    await deleteAllDocuments('courses');
    await deleteAllDocuments('course_outcomes');
    await deleteAllDocuments('lesson_templates');
    await deleteAllDocuments('MasteryV2');
    await deleteAllDocuments('routine');
    await deleteAllDocuments('SOWV2');

    // Step 2: Seed courses
    console.log('\n📦 Step 2: Seeding courses...');
    await seedCourses();

    // Step 3: Seed course outcomes (must be before templates)
    console.log('\n📦 Step 3: Seeding course outcomes...');
    await seedCourseOutcomes();

    // Step 4: Seed lesson templates with outcome references
    console.log('\n📦 Step 4: Seeding lesson templates...');
    await seedLessonTemplates();

    // Step 5: Seed initial mastery data
    console.log('\n📦 Step 5: Seeding initial mastery data...');
    await seedInitialMasteryV2();

    // Step 6: Seed initial routine data
    console.log('\n📦 Step 6: Seeding initial routine data...');
    await seedInitialRoutine();

    console.log('\n================================================');
    console.log('✅ Clean data seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - ${COURSES.length} courses created`);
    console.log(`   - ${COURSE_OUTCOMES.length} outcomes created`);
    console.log(`   - ${outcomeIdMap.size} outcome IDs mapped`);
    console.log(`   - Lesson templates linked to outcome document IDs`);
    console.log(`   - MasteryV2 uses outcome document IDs as keys`);
    console.log(`   - Routine uses outcome document IDs for scheduling`);

  } catch (error) {
    console.error('❌ Seed process failed:', error);
    process.exit(1);
  }
}

// Run the seed script
main();