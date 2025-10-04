import { AuthoredSOWDriver } from '../appwrite/driver/AuthoredSOWDriver';
import { SOWDriver } from '../appwrite/driver/SOWDriver';
import type { Databases } from 'appwrite';

/**
 * Handle course enrollment and SOW initialization - Phase 2.3 MVP2.5
 *
 * This service orchestrates the enrollment process:
 * 1. Gets the published Authored SOW for the course
 * 2. Copies it to the student's SOWV2 record
 * 3. Tracks source and version for future reference
 *
 * @throws Error if no published SOW found for course
 */
export async function handleCourseEnrollment(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<void> {
  console.log(`[EnrollmentService] Processing enrollment for student ${studentId} in course ${courseId}`);

  // Initialize drivers
  const authoredDriver = new AuthoredSOWDriver({ databases });
  const sowDriver = new SOWDriver({ databases });

  // Get published Authored SOW for course
  const authoredSOW = await authoredDriver.getPublishedSOW(courseId);

  if (!authoredSOW) {
    const error = `No published SOW found for course ${courseId}. Cannot complete enrollment.`;
    console.error(`[EnrollmentService] ${error}`);
    throw new Error(error);
  }

  console.log(`[EnrollmentService] Found published SOW v${authoredSOW.version} with ${authoredSOW.entries.length} lessons`);

  // Check if SOW already exists for this enrollment
  const existingSOW = await sowDriver.getSOWForEnrollment(studentId, courseId);

  if (existingSOW) {
    console.log(`[EnrollmentService] SOW already exists for ${studentId}/${courseId}, skipping copy`);
    return;
  }

  // Copy to student's SOWV2
  await sowDriver.copyFromAuthoredSOW(studentId, courseId, authoredSOW);

  console.log(`[EnrollmentService] ✅ Successfully enrolled ${studentId} in ${courseId}`);
  console.log(`[EnrollmentService] Copied SOW v${authoredSOW.version} with ${authoredSOW.entries.length} lessons`);
}

/**
 * Update student's SOW customizations
 * Allows teachers/students to modify the standard SOW sequence
 */
export async function updateSOWCustomizations(
  studentId: string,
  courseId: string,
  customizations: {
    reordered_lessons?: string[];
    skipped_lessons?: string[];
    added_lessons?: Array<{ lessonTemplateId: string; position: number }>;
    notes?: string;
  },
  databases: Databases
): Promise<void> {
  console.log(`[EnrollmentService] Updating SOW customizations for ${studentId}/${courseId}`);

  const sowDriver = new SOWDriver({ databases });

  await sowDriver.updateCustomizations(studentId, courseId, customizations);

  console.log(`[EnrollmentService] ✅ Customizations updated successfully`);
}
