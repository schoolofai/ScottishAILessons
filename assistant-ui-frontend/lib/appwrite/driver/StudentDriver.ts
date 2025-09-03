import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { 
  Student, 
  Course, 
  Enrollment, 
  Session, 
  CreateStudentData,
  AppwriteResponse 
} from '../types';

/**
 * Student driver handling student data, courses, enrollments, and sessions
 */
export class StudentDriver extends BaseDriver {
  /**
   * Get or create student record for a user
   */
  async getOrCreateStudent(userId: string, name: string): Promise<Student> {
    try {
      // First try to find existing student
      const students = await this.list<Student>('students', [
        Query.equal('userId', userId)
      ]);
      
      if (students.length > 0) {
        return students[0];
      }
      
      // Create new student record if none exists
      const studentData: CreateStudentData = {
        userId,
        name,
        role: 'student'
      };
      
      const permissions = this.createUserPermissions(userId);
      return await this.create<Student>('students', studentData, permissions);
      
    } catch (error) {
      throw this.handleError(error, 'get or create student');
    }
  }

  /**
   * Get student by ID
   */
  async getStudent(studentId: string): Promise<Student> {
    try {
      return await this.get<Student>('students', studentId);
    } catch (error) {
      throw this.handleError(error, 'get student');
    }
  }

  /**
   * Get student by user ID
   */
  async getStudentByUserId(userId: string): Promise<Student | null> {
    try {
      const students = await this.list<Student>('students', [
        Query.equal('userId', userId)
      ]);
      
      return students.length > 0 ? students[0] : null;
    } catch (error) {
      throw this.handleError(error, 'get student by user ID');
    }
  }

  /**
   * Update student information
   */
  async updateStudent(studentId: string, data: Partial<Student>): Promise<Student> {
    try {
      return await this.update<Student>('students', studentId, data);
    } catch (error) {
      throw this.handleError(error, 'update student');
    }
  }

  /**
   * Get all available courses
   */
  async getCourses(): Promise<Course[]> {
    try {
      return await this.list<Course>('courses');
    } catch (error) {
      throw this.handleError(error, 'get courses');
    }
  }

  /**
   * Get course by ID
   */
  async getCourse(courseId: string): Promise<Course> {
    try {
      return await this.get<Course>('courses', courseId);
    } catch (error) {
      throw this.handleError(error, 'get course');
    }
  }

  /**
   * Get enrollments for a student
   */
  async getEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      return await this.list<Enrollment>('enrollments', [
        Query.equal('studentId', studentId)
      ]);
    } catch (error) {
      throw this.handleError(error, 'get enrollments');
    }
  }

  /**
   * Get specific enrollment
   */
  async getEnrollment(studentId: string, courseId: string): Promise<Enrollment | null> {
    try {
      const enrollments = await this.list<Enrollment>('enrollments', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]);
      
      return enrollments.length > 0 ? enrollments[0] : null;
    } catch (error) {
      throw this.handleError(error, 'get enrollment');
    }
  }

  /**
   * Enroll student in a course
   */
  async enrollStudent(studentId: string, courseId: string): Promise<Enrollment> {
    try {
      const user = await this.getCurrentUser();
      const enrollmentData = {
        studentId,
        courseId,
        enrolledAt: new Date().toISOString(),
        status: 'active'
      };
      
      const permissions = this.createUserPermissions(user.$id);
      return await this.create<Enrollment>('enrollments', enrollmentData, permissions);
      
    } catch (error) {
      throw this.handleError(error, 'enroll student');
    }
  }

  /**
   * Auto-enroll student in default course if not already enrolled
   */
  async autoEnrollStudent(studentId: string, defaultCourseId: string = 'C844 73'): Promise<Enrollment> {
    try {
      // Check if already enrolled
      const existingEnrollment = await this.getEnrollment(studentId, defaultCourseId);
      if (existingEnrollment) {
        return existingEnrollment;
      }
      
      // Create new enrollment
      return await this.enrollStudent(studentId, defaultCourseId);
      
    } catch (error) {
      throw this.handleError(error, 'auto-enroll student');
    }
  }

  /**
   * Get sessions for a student
   */
  async getSessions(studentId: string): Promise<Session[]> {
    try {
      return await this.list<Session>('sessions', [
        Query.equal('studentId', studentId)
      ]);
    } catch (error) {
      throw this.handleError(error, 'get sessions');
    }
  }

  /**
   * Get sessions with pagination
   */
  async getSessionsPaginated(
    studentId: string, 
    limit: number = 10, 
    offset: number = 0
  ): Promise<AppwriteResponse<Session>> {
    try {
      return await this.listWithTotal<Session>('sessions', [
        Query.equal('studentId', studentId),
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc('$createdAt')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get sessions paginated');
    }
  }

  /**
   * Get sessions for a specific course
   */
  async getSessionsForCourse(studentId: string, courseId: string): Promise<Session[]> {
    try {
      return await this.list<Session>('sessions', [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]);
    } catch (error) {
      throw this.handleError(error, 'get sessions for course');
    }
  }

  /**
   * Get incomplete sessions for a student
   */
  async getIncompleteSessions(studentId: string): Promise<Session[]> {
    try {
      return await this.list<Session>('sessions', [
        Query.equal('studentId', studentId),
        Query.isNull('endedAt')
      ]);
    } catch (error) {
      throw this.handleError(error, 'get incomplete sessions');
    }
  }

  /**
   * Complete student dashboard initialization
   * Combines multiple operations for dashboard loading
   */
  async initializeDashboard(userId: string, userName: string) {
    try {
      // Get or create student
      const student = await this.getOrCreateStudent(userId, userName);
      
      // Get courses
      const courses = await this.getCourses();
      
      // Auto-enroll in default course
      const enrollment = await this.autoEnrollStudent(student.$id);
      const enrollments = await this.getEnrollments(student.$id);
      
      // Get sessions
      const sessions = await this.getSessions(student.$id);
      
      return {
        student,
        courses,
        enrollments,
        sessions
      };
      
    } catch (error) {
      throw this.handleError(error, 'initialize dashboard');
    }
  }
}