import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, AuthResult } from './auth';
import { createErrorResponse } from '../utils/error-responses';
import { createApiHeaders } from './auth';

export interface ApiHandlerContext {
  authResult: AuthResult;
  request: NextRequest;
  params?: Record<string, string>;
}

export interface ApiHandlerOptions {
  requireAuth?: boolean;
  validationSchema?: z.ZodSchema;
  paramValidators?: Record<string, (value: string) => ValidationResult>;
}

export interface ValidationResult {
  success: boolean;
  value?: any;
  errorResponse?: NextResponse;
}

/**
 * Standardized API route handler wrapper
 * Handles authentication, validation, and error responses consistently
 */
export function createApiHandler<T = any>(
  handler: (context: ApiHandlerContext) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
) {
  return async (
    request: NextRequest,
    routeParams?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    try {
      const {
        requireAuth = true,
        validationSchema,
        paramValidators = {}
      } = options;

      // Extract params
      const params = routeParams?.params || {};

      // Validate parameters first (if any validators provided)
      for (const [paramName, validator] of Object.entries(paramValidators)) {
        const paramValue = params[paramName];
        const validation = validator(paramValue);

        if (!validation.success) {
          return validation.errorResponse!;
        }

        // Update param with validated value
        params[paramName] = validation.value || paramValue;
      }

      // Handle authentication
      let authResult: AuthResult = { success: true };
      if (requireAuth) {
        authResult = await authenticateRequest();
        if (!authResult.success) {
          return authResult.errorResponse!;
        }
      }

      // Validate request body (if schema provided)
      if (validationSchema && (request.method === 'POST' || request.method === 'PUT')) {
        const bodyValidation = await validateRequestBody(request, validationSchema);
        if (!bodyValidation.success) {
          return bodyValidation.errorResponse!;
        }
      }

      // Create context and call handler
      const context: ApiHandlerContext = {
        authResult,
        request,
        params
      };

      return await handler(context);

    } catch (error) {
      console.error(`API Handler Error (${request.method} ${request.url}):`, error);

      // Handle Zod validation errors specifically
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.errors,
            statusCode: 400
          },
          {
            status: 400,
            headers: createApiHeaders()
          }
        );
      }

      return createErrorResponse(error);
    }
  };
}

/**
 * Validates request body against Zod schema
 */
async function validateRequestBody(
  request: NextRequest,
  schema: z.ZodSchema
): Promise<ValidationResult> {
  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return {
        success: false,
        errorResponse: NextResponse.json(
          {
            error: 'Invalid JSON in request body',
            statusCode: 400
          },
          {
            status: 400,
            headers: createApiHeaders()
          }
        )
      };
    }

    // Validate against schema
    const validatedData = schema.parse(requestBody);
    return {
      success: true,
      value: validatedData
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errorResponse: NextResponse.json(
          {
            error: 'Invalid request parameters',
            statusCode: 400,
            details: error.errors
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

/**
 * Validates courseId parameter with proper format checking
 */
export function validateCourseIdParam(courseId: string): ValidationResult {
  // Handle missing courseId
  if (!courseId) {
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
  if (courseId === '') {
    return {
      success: false,
      errorResponse: NextResponse.json(
        {
          error: 'Invalid request parameters',
          statusCode: 400,
          details: [{ message: 'Course ID cannot be empty' }]
        },
        {
          status: 400,
          headers: createApiHeaders()
        }
      )
    };
  }

  // Validate courseId format (C844 73)
  const courseIdRegex = /^[A-Z]\d{3}\s\d{2}$/;
  if (!courseIdRegex.test(courseId)) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        {
          error: 'Invalid request parameters',
          statusCode: 400,
          details: [{
            message: 'Course ID must match format like C844 73',
            path: ['courseId'],
            code: 'invalid_format'
          }]
        },
        {
          status: 400,
          headers: createApiHeaders()
        }
      )
    };
  }

  return {
    success: true,
    value: courseId
  };
}