import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Course } from '../types';

/**
 * Course driver for curriculum metadata operations
 * Provides methods to fetch course details including subject, level, and SQA codes
 */
export class CourseDriver extends BaseDriver {
  /**
   * Get course by Appwrite document ID
   */
  async getCourse(documentId: string): Promise<Course> {
    try {
      const course = await this.get<Course>('courses', documentId);
      return course;
    } catch (error) {
      throw this.handleError(error, `get course ${documentId}`);
    }
  }

  /**
   * Get course by SQA courseId field (e.g., "C844 73")
   * This queries the courseId attribute, not the Appwrite $id
   */
  async getCourseByCourseId(courseId: string): Promise<Course> {
    try {
      const courses = await this.list<Course>('courses', [
        Query.equal('courseId', courseId)
      ]);

      if (courses.length === 0) {
        throw new Error(`No course found with courseId: ${courseId}`);
      }

      return courses[0];
    } catch (error) {
      throw this.handleError(error, `get course by courseId ${courseId}`);
    }
  }

  /**
   * Get course curriculum metadata for teaching agents by SQA courseId
   * Returns only the fields needed for course-aware prompts
   *
   * @param sqaCourseId - The SQA course code (e.g., "C844 73") from lesson_snapshot.courseId
   */
  async getCourseCurriculumMetadata(sqaCourseId: string) {
    try {
      // Query by courseId field, not Appwrite $id
      const course = await this.getCourseByCourseId(sqaCourseId);

      // Extract curriculum metadata fields needed by backend agents
      return {
        course_subject: course.subject,      // e.g., "mathematics", "physics"
        course_level: course.level,          // e.g., "national-3", "national-4"
        sqa_course_code: course.courseId,    // SQA code if available
        course_title: course.title           // Full course title
      };
    } catch (error) {
      throw this.handleError(error, `get curriculum metadata for course ${sqaCourseId}`);
    }
  }

  /**
   * Check if course exists
   */
  async courseExists(courseId: string): Promise<boolean> {
    try {
      await this.getCourse(courseId);
      return true;
    } catch (error) {
      return false;
    }
  }
}
