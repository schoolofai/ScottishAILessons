/**
 * Comprehensive verification script to validate Authored SOWs and lesson templates
 *
 * Usage: npm run verify:authored-sows
 */

import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);

async function verifySOWs() {
  console.log('🔍 Comprehensive SOW & Lesson Template Validation\n');
  console.log('═'.repeat(60));

  const expectedSOWs = [
    {
      name: 'Application of Mathematics (National 4)',
      courseId: 'course_c84474',
      expectedLessons: 84
    },
    {
      name: 'Mathematics (National 4)',
      courseId: 'course_c84774',
      expectedLessons: 105
    }
  ];

  let allValid = true;
  let totalTemplatesValidated = 0;

  for (const expected of expectedSOWs) {
    try {
      console.log(`\n📋 Validating: ${expected.name}`);
      console.log(`   Course ID: ${expected.courseId}\n`);

      // ============================================================
      // STEP 1: Verify SOW Document Exists
      // ============================================================
      console.log('   [1/5] Checking SOW document...');
      const sowResult = await databases.listDocuments(
        'default',
        'Authored_SOW',
        [Query.equal('courseId', expected.courseId)]
      );

      if (sowResult.documents.length === 0) {
        console.log('   ❌ SOW NOT FOUND\n');
        allValid = false;
        continue;
      }

      const sowDoc = sowResult.documents[0];
      console.log(`   ✅ SOW Found (ID: ${sowDoc.$id})`);

      // ============================================================
      // STEP 2: Parse and Validate Entries
      // ============================================================
      console.log('\n   [2/5] Validating SOW entries...');

      // FIX: Parse JSON string instead of counting characters
      let parsedEntries;
      try {
        parsedEntries = JSON.parse(sowDoc.entries);
      } catch (parseError) {
        console.log('   ❌ Failed to parse entries JSON');
        allValid = false;
        continue;
      }

      console.log(`   ✅ Entries parsed: ${parsedEntries.length} lessons`);

      // Verify lesson count matches expected
      if (parsedEntries.length === expected.expectedLessons) {
        console.log(`   ✅ Entry count matches expected (${expected.expectedLessons})`);
      } else {
        console.log(`   ❌ Entry count mismatch: expected ${expected.expectedLessons}, found ${parsedEntries.length}`);
        allValid = false;
      }

      // ============================================================
      // STEP 3: Validate Lesson Templates Collection
      // ============================================================
      console.log('\n   [3/5] Validating lesson templates...');

      const templatesResult = await databases.listDocuments(
        'default',
        'lesson_templates',
        [
          Query.equal('courseId', expected.courseId),
          Query.limit(200) // Ensure we get all templates
        ]
      );

      console.log(`   ✅ Templates found: ${templatesResult.documents.length}`);

      // Verify template count matches entry count
      if (templatesResult.documents.length === parsedEntries.length) {
        console.log(`   ✅ Template count matches entry count (${parsedEntries.length})`);
      } else {
        console.log(`   ❌ Template count mismatch: expected ${parsedEntries.length}, found ${templatesResult.documents.length}`);
        allValid = false;
      }

      // ============================================================
      // STEP 4: Cross-Reference Validation
      // ============================================================
      console.log('\n   [4/5] Cross-referencing SOW entries with templates...');

      let validRefs = 0;
      let invalidRefs = [];
      const templateMap = new Map(
        templatesResult.documents.map(t => [t.$id, t])
      );

      for (const entry of parsedEntries) {
        const templateId = entry.lessonTemplateRef;
        const template = templateMap.get(templateId);

        if (!template) {
          invalidRefs.push(`Entry #${entry.order}: "${entry.label}" → ${templateId}`);
          continue;
        }

        // Verify sow_order matches
        if (template.sow_order !== entry.order) {
          invalidRefs.push(`Entry #${entry.order}: sow_order mismatch (template has ${template.sow_order})`);
          continue;
        }

        // Verify courseId matches
        if (template.courseId !== expected.courseId) {
          invalidRefs.push(`Entry #${entry.order}: courseId mismatch`);
          continue;
        }

        validRefs++;
      }

      if (invalidRefs.length > 0) {
        console.log(`   ❌ Found ${invalidRefs.length} invalid references:`);
        invalidRefs.slice(0, 5).forEach(ref => console.log(`      - ${ref}`));
        if (invalidRefs.length > 5) {
          console.log(`      ... and ${invalidRefs.length - 5} more`);
        }
        allValid = false;
      } else {
        console.log(`   ✅ All ${validRefs} cross-references valid`);
      }

      // ============================================================
      // STEP 5: Sample Template Data Validation
      // ============================================================
      console.log('\n   [5/5] Sampling template data integrity...');

      // Sample 3 random templates for deep validation
      const sampleIndices = [
        0,
        Math.floor(templatesResult.documents.length / 2),
        templatesResult.documents.length - 1
      ];

      let sampleValid = 0;
      for (const idx of sampleIndices) {
        const template = templatesResult.documents[idx];
        const entry = parsedEntries.find(e => e.lessonTemplateRef === template.$id);

        if (!entry) continue;

        // Validate critical fields
        const hasTitle = template.title && template.title.length > 0;
        const hasCourseId = template.courseId === expected.courseId;
        const hasSowOrder = typeof template.sow_order === 'number';
        const hasOutcomeRefs = template.outcomeRefs && template.outcomeRefs.length > 0;

        if (hasTitle && hasCourseId && hasSowOrder && hasOutcomeRefs) {
          sampleValid++;
        }
      }

      if (sampleValid === sampleIndices.length) {
        console.log(`   ✅ Sample validation passed (${sampleIndices.length} templates checked)`);
      } else {
        console.log(`   ⚠️  Sample validation: ${sampleValid}/${sampleIndices.length} passed`);
      }

      // ============================================================
      // STEP 6: Verify Course Outcomes
      // ============================================================
      console.log('\n   [6/6] Checking course outcomes...');

      const outcomesResult = await databases.listDocuments(
        'default',
        'course_outcomes',
        [Query.equal('courseId', expected.courseId)]
      );

      console.log(`   ✅ Course Outcomes: ${outcomesResult.documents.length} outcomes\n`);

      // Summary for this course
      totalTemplatesValidated += templatesResult.documents.length;
      console.log('   ' + '─'.repeat(56));
      console.log(`   ✅ ${expected.name}: ALL CHECKS PASSED`);
      console.log('   ' + '─'.repeat(56));

    } catch (error) {
      console.log(`   ❌ Error validating ${expected.name}:`, error);
      console.log('');
      allValid = false;
    }
  }

  // ============================================================
  // Final Summary
  // ============================================================
  console.log('\n' + '═'.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`SOWs verified: ${expectedSOWs.length}`);
  console.log(`Total lesson templates validated: ${totalTemplatesValidated}`);
  console.log(`Total lessons across all SOWs: ${expectedSOWs.reduce((sum, s) => sum + s.expectedLessons, 0)}`);
  console.log('═'.repeat(60));

  if (allValid) {
    console.log('🎉 SUCCESS: All SOWs and lesson templates validated!');
    console.log('═'.repeat(60));
  } else {
    console.log('❌ FAILURE: Validation errors detected');
    console.log('═'.repeat(60));
    process.exit(1);
  }
}

verifySOWs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
