#!/usr/bin/env ts-node
/**
 * Quick script to inspect SQA data for a failed course
 */

import * as path from 'path';
import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function inspectCourse(subject: string, level: string) {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
  const apiKey = process.env.APPWRITE_API_KEY!;

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  // Fetch the SQA document
  const result = await databases.listDocuments(
    'sqa_education',
    'sqa_current',
    [
      Query.equal('subject', subject),
      Query.equal('level', level),
      Query.limit(1)
    ]
  );

  if (result.documents.length === 0) {
    console.log('❌ No document found');
    return;
  }

  const doc = result.documents[0] as any;
  let parsedData = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

  console.log(`\n📋 Course: ${subject} (${level})`);
  console.log('='.repeat(60));

  console.log('\n🔑 Top-level keys in data:');
  console.log(Object.keys(parsedData));

  console.log('\n📚 Qualification data:');
  console.log(JSON.stringify(parsedData.qualification, null, 2));

  console.log('\n🎯 Looking for units in:');
  console.log('  - parsedData.units:', parsedData.units ? 'EXISTS' : 'MISSING');
  console.log('  - parsedData.course_structure?.units:', parsedData.course_structure?.units ? 'EXISTS' : 'MISSING');

  if (parsedData.units) {
    console.log('\n  Units array length:', parsedData.units.length);
    if (parsedData.units.length > 0) {
      console.log('  First unit sample:', JSON.stringify(parsedData.units[0], null, 2).substring(0, 200));
    }
  }

  if (parsedData.course_structure?.units) {
    console.log('\n  Course structure units length:', parsedData.course_structure.units.length);
    if (parsedData.course_structure.units.length > 0) {
      console.log('  First unit sample:', JSON.stringify(parsedData.course_structure.units[0], null, 2).substring(0, 200));
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Check multiple failed courses
async function checkMultiple() {
  const failedCourses = [
    ['accounting', 'higher'],
    ['dance', 'national_5'],
    ['english', 'adv_higher'],
    ['music', 'national_5'],
    ['history', 'national_5']
  ];

  for (const [subject, level] of failedCourses) {
    await inspectCourse(subject, level);
    console.log('\n\n');
  }
}

checkMultiple().catch(console.error);
