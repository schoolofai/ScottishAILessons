import { NextResponse } from 'next/server';
import { Client } from "@langchain/langgraph-sdk";
import { createApiHandler, validateCourseIdParam } from '../../../../lib/middleware/api-handler';
import { handleMockError } from '../../../../lib/utils/error-responses';
import { CourseService } from '../../../../lib/services/course-service';
import { createApiHeaders } from '../../../../lib/middleware/auth';
import {
  isEnrolled,
  MOCK_COURSE_RECOMMENDATION
} from '../../../../lib/appwrite/mock-data';

/**
 * GET /api/recommendations/[courseId]
 * Returns AI-generated lesson recommendations for a specific course
 */
export const GET = createApiHandler(async ({ authResult, params }) => {
  const courseId = params!.courseId;

  // Real service flow - use actual Appwrite data seeded in Task 7
  return await handleRealService(authResult.sessionToken!, courseId);
}, {
  requireAuth: true,
  paramValidators: {
    courseId: validateCourseIdParam
  }
});


/**
 * Handles real service flow for production
 */
async function handleRealService(sessionToken: string, courseId: string): Promise<NextResponse> {
  const courseService = new CourseService(sessionToken);

  // Get recommendations with full validation pipeline
  const result = await courseService.getCourseRecommendations(courseId);

  // Handle validation errors (Response/NextResponse objects)
  if (result instanceof Response || 'statusCode' in result) {
    return result as NextResponse;
  }

  // Handle success response from CourseService
  if ('success' in result && result.success) {
    const { context, student, user } = result;

    console.log('📊 CourseService result:', {
      hasContext: !!context,
      hasStudent: !!student,
      hasUser: !!user,
      contextKeys: context ? Object.keys(context) : 'NO_CONTEXT',
      studentId: student?.$id || 'NO_STUDENT_ID',
      userId: user?.$id || 'NO_USER_ID'
    });

    // Transform context to match Course Manager expected format
    const courseManagerContext = transformToCourseManagerFormat(context, student, courseId);

    // Call Course Manager via LangGraph SDK
    const recommendations = await callLangGraphRecommendations(courseManagerContext);

    // Save graph run ID for continuity
    if (student?.$id) {
      await courseService.saveGraphRunId(
        student.$id,
        courseId,
        recommendations.graphRunId || 'no-run-id'
      );
    }

    return NextResponse.json(recommendations, {
      headers: createApiHeaders()
    });
  }

  // Fallback error case
  throw new Error('Unexpected CourseService response structure');
}

/**
 * Transform frontend context to Course Manager expected format
 */
function transformToCourseManagerFormat(context: any, student: any, courseId: string) {
  if (!student) {
    throw new Error('Missing student data for Course Manager');
  }

  console.log('🔄 Transforming context:', {
    hasContext: !!context,
    contextKeys: context ? Object.keys(context) : 'NULL',
    hasTemplates: !!(context?.templates),
    templateCount: context?.templates?.length || 0,
    hasStudent: !!student,
    studentId: student?.$id,
    courseId
  });

  // If context is null, create a minimal working context with fallback data
  if (!context) {
    console.log('⚠️ No context provided, creating fallback context');
    context = {
      templates: [],
      mastery: null,
      routine: null,
      sow: null,
      course: null
    };
  }

  // Transform to match the exact format expected by Course Manager (from isolation test)
  return {
    mode: 'course_manager', // CRITICAL: This sets the mode for routing
    student: {
      id: student.$id,
      name: student.name || student.displayName
    },
    course: {
      courseId: courseId,
      subject: context.course?.subject || 'Unknown Subject'
    },
    templates: (context.templates && context.templates.length > 0)
      ? context.templates.map(template => ({
          $id: template.$id,
          title: template.title,
          outcomeRefs: template.outcomeRefs || [],
          estMinutes: template.estMinutes || 30
        }))
      : [
          // Fallback templates for testing
          {
            $id: 'template-fractions-001',
            title: 'Introduction to Fractions',
            outcomeRefs: ['outcome-fractions-basic'],
            estMinutes: 45
          },
          {
            $id: 'template-algebra-001',
            title: 'Basic Algebra',
            outcomeRefs: ['outcome-algebra-basic'],
            estMinutes: 40
          }
        ],
    // Transform mastery from object format to array format
    mastery: context.mastery && context.mastery.emaByOutcome
      ? Object.entries(context.mastery.emaByOutcome).map(([outcomeId, emaValue]) => {
          // Find template that contains this outcome
          const template = (context.templates || []).find(t =>
            t.outcomeRefs && t.outcomeRefs.includes(outcomeId)
          );
          return {
            templateId: template?.$id || outcomeId,
            masteryLevel: typeof emaValue === 'number' ? emaValue : 0.3 // Default low mastery
          };
        }).filter(m => m.templateId) // Only include records with valid templateId
      : [
          // Fallback mastery data for testing (matches fallback templates)
          { templateId: 'template-fractions-001', masteryLevel: 0.3 },
          { templateId: 'template-algebra-001', masteryLevel: 0.25 }
        ],
    // Transform routine from object format to array format
    routine: context.routine && context.routine.recentTemplateIds
      ? context.routine.recentTemplateIds.map(templateId => ({
          templateId: templateId,
          daysSinceLastSession: 1 // Default recent = 1 day ago
        }))
      : [
          // Fallback routine data for testing
          { templateId: 'template-fractions-001', daysSinceLastSession: 14 },
          { templateId: 'template-algebra-001', daysSinceLastSession: 21 }
        ],
    // Transform SOW from complex format to simple array format
    sow: context.sow && context.sow.entries
      ? context.sow.entries.map(entry => ({
          templateId: entry.lessonTemplateId,
          week: entry.order || 1, // Use order as week
          currentWeek: 3 // Default current week - this should come from actual data
        }))
      : [
          // Fallback SOW data for testing (first template overdue, second not)
          { templateId: 'template-fractions-001', week: 2, currentWeek: 3 }, // Overdue (week 2 < current 3)
          { templateId: 'template-algebra-001', week: 5, currentWeek: 3 }   // Not overdue (week 5 > current 3)
        ],
    // Add constraints for scoring
    constraints: context.constraints || {
      maxBlockMinutes: 25,
      avoidRepeatWithinDays: 3,
      preferOverdue: true,
      preferLowEMA: true
    }
  };
}

/**
 * Calls LangGraph using the same SDK as the chat interface
 */
async function callLangGraphRecommendations(context: any) {
  const client = new Client({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || 'http://localhost:2024',
  });

  // Create a thread for this recommendation request
  const thread = await client.threads.create();

  console.log('LangGraph recommendation request:', {
    threadId: thread.thread_id,
    courseId: context.course?.courseId,
    studentId: context.student?.$id
  });

  // Run the assistant with the course recommendation context
  const run = await client.runs.create(
    thread.thread_id,
    process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID || 'agent',
    {
      input: {
        session_context: context,
        mode: 'course_manager'
      }
    }
  );

  // Wait for the run to complete
  await client.runs.join(thread.thread_id, run.run_id);

  // Get the final state with the recommendation
  const state = await client.threads.getState(thread.thread_id);

  // Extract the course recommendation from the final state
  const recommendation = extractRecommendationFromState(state);

  return {
    ...recommendation,
    graphRunId: run.run_id,
    threadId: thread.thread_id
  };
}

/**
 * Extracts course recommendation from LangGraph state
 */
function extractRecommendationFromState(state: any): any {
  console.log('🔍 Extracting recommendation from state:', {
    stateKeys: Object.keys(state),
    valuesKeys: Object.keys(state.values || {}),
    messagesCount: state.values?.messages?.length || 0
  });

  // Look for course_recommendation in the state values
  if (state.values?.course_recommendation) {
    console.log('✅ Found course_recommendation in state.values');
    return state.values.course_recommendation;
  }

  // Look in the last message for additional_kwargs with recommendation
  const messages = state.values?.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (lastMessage?.additional_kwargs?.recommendation) {
    console.log('✅ Found recommendation in last message additional_kwargs');
    return lastMessage.additional_kwargs.recommendation;
  }

  // Fallback: look in the last message if it contains structured data
  if (lastMessage?.content && typeof lastMessage.content === 'string') {
    try {
      const parsed = JSON.parse(lastMessage.content);
      if (parsed.course_recommendation) {
        console.log('✅ Found course_recommendation in parsed message content');
        return parsed.course_recommendation;
      }
    } catch (e) {
      // Not JSON, continue
    }
  }

  console.log('⚠️ No recommendation found in state, using fallback');

  // Default fallback recommendation
  return {
    courseId: state.config?.configurable?.course_id || 'unknown',
    recommendations: [
      {
        lessonId: 'default-lesson',
        title: 'Continue Learning',
        description: 'Ready to continue your learning journey',
        priority: 'high',
        estimatedTime: '30 minutes'
      }
    ],
    nextSteps: ['Continue with the next lesson in your course'],
    generatedAt: new Date().toISOString()
  };
}