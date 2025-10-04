#!/usr/bin/env ts-node

/**
 * Extract Outcomes from sqa_education.sqa_current and transform to course_outcomes structure
 *
 * This script:
 * 1. Reads SQA course data from sqa_education.sqa_current collection
 * 2. Extracts units → outcomes → assessment standards
 * 3. Transforms into new course_outcomes schema
 * 4. Generates import file for migrateCourseOutcomes.ts
 *
 * Usage:
 *   tsx scripts/extractSQAOutcomes.ts <subject> <level> <courseSqaCode> <courseId>
 *
 * Example:
 *   tsx scripts/extractSQAOutcomes.ts "applications_of_mathematics" "national_3" "C844 73" "course_c84473"
 *
 * Requirements:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT environment variable
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID environment variable
 *   - APPWRITE_API_KEY environment variable (admin API key with read access to sqa_education)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface AssessmentStandard {
  code: string;
  desc: string;
  skills_list: string[];
  marking_guidance: string;
}

interface SQAOutcome {
  id: string;
  title: string;
  assessment_standards: AssessmentStandard[];
}

interface SQAUnit {
  code: string;
  title: string;
  scqf_credits: number;
  outcomes: SQAOutcome[];
}

interface SQACourseData {
  subject: string;
  level: string;
  course_code: string;
  data: string; // JSON string containing units array
}

interface CourseOutcomeImport {
  courseId: string;
  courseSqaCode: string;
  unitCode: string;
  unitTitle: string;
  scqfCredits: number;
  outcomeId: string;
  outcomeTitle: string;
  assessmentStandards: string; // JSON string
  teacherGuidance: string;
  keywords: string[];
}

/**
 * Extract keywords from outcome title and assessment standards
 */
function extractKeywords(outcomeTitle: string, assessmentStandards: AssessmentStandard[]): string[] {
  const keywords = new Set<string>();

  // Extract from outcome title
  const titleWords = outcomeTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3); // Skip short words

  titleWords.forEach(word => keywords.add(word));

  // Extract from assessment standard descriptions
  assessmentStandards.forEach(as => {
    const descWords = as.desc
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4);

    descWords.slice(0, 3).forEach(word => keywords.add(word)); // Take top 3 words
  });

  return Array.from(keywords);
}

/**
 * Generate teacher guidance from assessment standards
 */
function generateTeacherGuidance(assessmentStandards: AssessmentStandard[]): string {
  const guidance: string[] = [];

  assessmentStandards.forEach(as => {
    let asGuidance = `**${as.code}**: ${as.desc}`;

    if (as.marking_guidance) {
      asGuidance += `\n  Marking: ${as.marking_guidance}`;
    }

    if (as.skills_list && as.skills_list.length > 0) {
      asGuidance += `\n  Skills: ${as.skills_list.join(', ')}`;
    }

    guidance.push(asGuidance);
  });

  return guidance.join('\n\n');
}

async function extractSQAOutcomes(subject: string, level: string, courseSqaCode: string, courseId: string) {
  console.log('🔍 SQA Outcomes Extraction Script');
  console.log('=' .repeat(60));
  console.log(`  Subject: ${subject}`);
  console.log(`  Level: ${level}`);
  console.log(`  SQA Course Code: ${courseSqaCode}`);
  console.log(`  Internal Course ID: ${courseId}`);
  console.log('=' .repeat(60) + '\n');

  // Validate environment variables
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    console.error('❌ Missing required environment variables:');
    if (!endpoint) console.error('  - NEXT_PUBLIC_APPWRITE_ENDPOINT');
    if (!projectId) console.error('  - NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    if (!apiKey) console.error('  - APPWRITE_API_KEY');
    process.exit(1);
  }

  console.log('✅ Environment variables validated\n');

  // Create admin client
  const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(adminClient);

  try {
    // Query sqa_current for the specific course by subject and level
    console.log(`📖 Querying sqa_education.sqa_current for ${subject} (${level})...\n`);

    const result = await databases.listDocuments(
      'sqa_education',
      'sqa_current',
      [
        Query.equal('subject', subject),
        Query.equal('level', level),
        Query.limit(10)
      ]
    );

    if (result.documents.length === 0) {
      console.error(`❌ No documents found for subject: ${subject}, level: ${level}`);
      console.error(`   Please verify the subject and level are correct.`);
      process.exit(1);
    }

    console.log(`✅ Found ${result.documents.length} document(s)\n`);

    const courseOutcomes: CourseOutcomeImport[] = [];
    let totalUnits = 0;
    let totalOutcomes = 0;

    // Process each document (usually there's one per course)
    for (const doc of result.documents) {
      const courseData = doc as unknown as SQACourseData;

      console.log(`📚 Processing: ${courseData.subject} - ${courseData.level}`);

      // Parse the data field
      const data = JSON.parse(courseData.data);
      const units: SQAUnit[] = data.course_structure?.units || data.units || [];

      totalUnits += units.length;
      console.log(`   Found ${units.length} units\n`);

      // Process each unit
      for (const unit of units) {
        console.log(`  📦 Unit: ${unit.code} - ${unit.title}`);
        console.log(`     Outcomes: ${unit.outcomes.length}`);

        totalOutcomes += unit.outcomes.length;

        // Process each outcome in the unit
        for (const outcome of unit.outcomes) {
          console.log(`     → ${outcome.id}: ${outcome.title}`);

          // Generate teacher guidance and keywords
          const teacherGuidance = generateTeacherGuidance(outcome.assessment_standards);
          const keywords = extractKeywords(outcome.title, outcome.assessment_standards);

          // Create course_outcomes import record
          const outcomeImport: CourseOutcomeImport = {
            courseId: courseId,
            courseSqaCode: courseSqaCode,
            unitCode: unit.code,
            unitTitle: unit.title,
            scqfCredits: unit.scqf_credits,
            outcomeId: outcome.id,
            outcomeTitle: outcome.title,
            assessmentStandards: JSON.stringify(outcome.assessment_standards),
            teacherGuidance: teacherGuidance,
            keywords: keywords
          };

          courseOutcomes.push(outcomeImport);
        }

        console.log('');
      }
    }

    console.log('=' .repeat(60));
    console.log('📊 Extraction Summary:');
    console.log('=' .repeat(60));
    console.log(`  Total units processed: ${totalUnits}`);
    console.log(`  Total outcomes extracted: ${totalOutcomes}`);
    console.log(`  Course outcomes records: ${courseOutcomes.length}`);
    console.log('');

    // Write to import file
    const outputPath = path.join(__dirname, '../../langgraph-author-agent/data/course_outcomes_import.json');

    fs.writeFileSync(
      outputPath,
      JSON.stringify(courseOutcomes, null, 2),
      'utf-8'
    );

    console.log(`✅ Import file written to:`);
    console.log(`   ${outputPath}\n`);

    // Show sample record
    if (courseOutcomes.length > 0) {
      console.log('📝 Sample outcome record:');
      console.log('=' .repeat(60));
      const sample = courseOutcomes[0];
      console.log(`  Course ID: ${sample.courseId}`);
      console.log(`  Unit: ${sample.unitCode} - ${sample.unitTitle}`);
      console.log(`  Outcome: ${sample.outcomeId} - ${sample.outcomeTitle}`);
      console.log(`  Keywords: ${sample.keywords.join(', ')}`);
      console.log(`  Assessment Standards: ${JSON.parse(sample.assessmentStandards).length} standards`);
      console.log('=' .repeat(60) + '\n');
    }

    console.log('🎉 Extraction complete!');
    console.log('   Next step: Run migrateCourseOutcomes.ts to import into course_outcomes collection\n');

  } catch (error: any) {
    console.error('\n❌ Extraction failed:');
    console.error(error);
    if (error.code === 401) {
      console.error('\n💡 Tip: Ensure your APPWRITE_API_KEY has read access to sqa_education database');
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 4) {
  console.error('Usage: tsx scripts/extractSQAOutcomes.ts <subject> <level> <courseSqaCode> <courseId>');
  console.error('Example: tsx scripts/extractSQAOutcomes.ts "applications_of_mathematics" "national_3" "C844 73" "course_c84473"');
  process.exit(1);
}

const [subject, level, courseSqaCode, courseId] = args;

// Run extraction
extractSQAOutcomes(subject, level, courseSqaCode, courseId)
  .then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:');
    console.error(error);
    process.exit(1);
  });
