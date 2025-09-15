import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GetRecommendationsRequestSchema } from '../appwrite/schemas';
import { createApiHeaders } from '../middleware/auth';

export interface ValidationResult {
  success: boolean;
  courseId?: string;
  errorResponse?: NextResponse;
}

/**
 * Validates courseId parameter from API route
 */
export function validateCourseId(params: { courseId?: string }): ValidationResult {
  // Handle missing courseId early
  if (!params || !params.courseId) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Course ID is required', statusCode: 404 },
        {
          status: 404,
          headers: createApiHeaders()
        }
      )
    };
  }

  // Handle empty string courseId
  if (params.courseId === '') {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Invalid request parameters', statusCode: 400, details: [{ message: 'Course ID cannot be empty' }] },
        {
          status: 400,
          headers: createApiHeaders()
        }
      )
    };
  }

  // Validate courseId format
  try {
    GetRecommendationsRequestSchema.parse({ courseId: params.courseId });
    return {
      success: true,
      courseId: params.courseId
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errorResponse: NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.errors,
            statusCode: 400
          },
          {
            status: 400,
            headers: createApiHeaders()
          }
        )
      };
    }
    throw error;
  }
}