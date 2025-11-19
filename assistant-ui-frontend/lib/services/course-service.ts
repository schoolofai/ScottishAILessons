import { NextResponse } from 'next/server';
import { CoursePlannerService } from '../appwrite/planner-service';
import { CourseRecommendationSchema, CourseSchema } from '../appwrite/schemas';
import { createApiHeaders } from '../utils/api-headers';
import { z } from 'zod';

export interface UserValidationResult {
  success: boolean;
  user?: any;
  student?: any;
  errorResponse?: NextResponse;
}

export interface EnrollmentValidationResult {
  success: boolean;
  errorResponse?: NextResponse;
}

/**
 * Service layer wrapper for course-related operations
 * Provides standardized error handling and validation
 */
export class CourseService {
  private plannerService: CoursePlannerService;

  constructor(sessionToken: string) {
    this.plannerService = new CoursePlannerService(sessionToken);
  }

  /**
   * Validates user session and retrieves student profile
   */
  async validateUserAndStudent(): Promise<UserValidationResult> {
    try {
      // Get current user (catch invalid session errors)
      let user;
      try {
        console.log('[CourseService Debug] Attempting to get current user...');
        user = await this.plannerService.getCurrentUser();
        console.log('[CourseService Debug] Successfully got user:', {
          hasUser: !!user,
          userId: user?.$id || 'NO_USER_ID',
          userName: user?.name || 'NO_NAME'
        });
      } catch (error) {
        console.log('[CourseService Debug] Error getting current user:', {
          errorType: error.constructor.name,
          errorMessage: error.message,
          errorCode: error.code || 'NO_CODE'
        });

        // Check for invalid session errors
        if (this.isAuthenticationError(error)) {
          console.log('[CourseService Debug] Authentication error detected, returning 401');
          return {
            success: false,
            errorResponse: NextResponse.json(
              { error: 'User not found', statusCode: 401 },
              {
                status: 401,
                headers: createApiHeaders()
              }
            )
          };
        }
        console.log('[CourseService Debug] Non-authentication error, re-throwing');
        throw error; // Re-throw other errors
      }

      if (!user) {
        return {
          success: false,
          errorResponse: NextResponse.json(
            { error: 'User not found', statusCode: 401 },
            {
              status: 401,
              headers: createApiHeaders()
            }
          )
        };
      }

      // Get student profile
      const student = await this.plannerService.getStudentByUserId(user.$id);
      if (!student) {
        return {
          success: false,
          errorResponse: NextResponse.json(
            { error: 'Student profile not found', statusCode: 404 },
            {
              status: 404,
              headers: createApiHeaders()
            }
          )
        };
      }

      return {
        success: true,
        user,
        student
      };

    } catch (error) {
      console.error('User validation error:', error);
      throw error;
    }
  }

  /**
   * Validates course enrollment for a student
   */
  async validateEnrollment(
    studentId: string,
    courseId: string
  ): Promise<EnrollmentValidationResult> {
    try {
      const enrollmentStatus = await this.plannerService.verifyEnrollment(
        studentId,
        courseId
      );

      if (!enrollmentStatus) {
        return {
          success: false,
          errorResponse: NextResponse.json(
            { error: 'Not enrolled in this course', statusCode: 403 },
            {
              status: 403,
              headers: createApiHeaders()
            }
          )
        };
      }

      return { success: true };

    } catch (error) {
      console.error('Enrollment validation error:', error);
      throw error;
    }
  }

  /**
   * Gets course recommendations with full validation pipeline
   */
  async getCourseRecommendations(courseId: string) {
    // Validate user and student
    const userValidation = await this.validateUserAndStudent();
    if (!userValidation.success) {
      return userValidation.errorResponse!;
    }

    const { user, student } = userValidation;

    // Validate enrollment
    const enrollmentValidation = await this.validateEnrollment(
      student.$id,
      courseId
    );
    if (!enrollmentValidation.success) {
      return enrollmentValidation.errorResponse!;
    }

    // Assemble scheduling context
    const context = await this.plannerService.assembleSchedulingContext(
      student.$id,
      courseId
    );

    return {
      success: true,
      context,
      student,
      user
    };
  }

  /**
   * Gets enrolled courses for a student
   */
  async getEnrolledCourses() {
    // Validate user and student
    const userValidation = await this.validateUserAndStudent();
    if (!userValidation.success) {
      return userValidation.errorResponse!;
    }

    const { student } = userValidation;

    // Get enrolled courses
    const courses = await this.plannerService.getEnrolledCourses(student.$id);

    return NextResponse.json(
      { courses },
      { headers: createApiHeaders() }
    );
  }

  /**
   * Handles mock session flow for courses
   */
  static handleMockCoursesSession(mockSession: any): NextResponse {
    const { student } = mockSession;

    // Handle no student scenario
    if (!student) {
      return NextResponse.json(
        { error: 'Student profile not found', statusCode: 404 },
        {
          status: 404,
          headers: createApiHeaders()
        }
      );
    }

    // Handle no courses scenario
    if (!student.enrolledCourses || student.enrolledCourses.length === 0) {
      return NextResponse.json(
        { courses: [] },
        { headers: createApiHeaders() }
      );
    }

    // Return mock courses based on enrolled courses
    const mockCourses = [
      {
        $id: 'course-math-123',
        courseId: 'C844 73',
        subject: 'Applications of Mathematics',
        level: 'National 3',
        status: 'active'
      },
      {
        $id: 'course-physics-456',
        courseId: 'C845 73',
        subject: 'Physics',
        level: 'National 3',
        status: 'active'
      },
      {
        $id: 'course-english-789',
        courseId: 'C846 73',
        subject: 'English',
        level: 'National 3',
        status: 'active'
      }
    ];

    return NextResponse.json(
      { courses: mockCourses },
      { headers: createApiHeaders() }
    );
  }

  /**
   * Saves graph run ID for continuity
   */
  async saveGraphRunId(
    studentId: string,
    courseId: string,
    graphRunId: string
  ): Promise<void> {
    if (graphRunId) {
      await this.plannerService.saveGraphRunId(
        studentId,
        courseId,
        graphRunId
      );
    }
  }

  /**
   * Checks if error is authentication-related
   */
  private isAuthenticationError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('missing scopes') ||
      errorMessage.includes('guests') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid session') ||
      errorMessage.includes('authentication')
    );
  }
}