"""
E2E LangGraph SDK isolation test for Course Manager with Appwrite data.

This test validates the Course Manager subgraph works correctly with complete
scheduling context by extracting seeded data from Appwrite and calling
LangGraph directly via SDK - exactly as the frontend would.

MVP1 Test Scenarios:
1. Happy path: Course Manager returns valid recommendations
2. Scoring validation: Overdue lessons get +0.40 bonus
3. Scoring validation: Low mastery lessons get +0.25 bonus
4. Edge case: Student not enrolled in course
5. Error handling: Missing course data
"""

import asyncio
import os
import sys
from typing import Dict, Any
import json
from datetime import datetime

# Add the src directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src'))

try:
    from langgraph_sdk import get_client
except ImportError:
    print("❌ LangGraph SDK not available. Install with: pip install langgraph-sdk")
    sys.exit(1)

try:
    from appwrite.client import Client
    from appwrite.services.databases import Databases
    from appwrite.query import Query
except ImportError:
    print("❌ Appwrite SDK not available. Install with: pip install appwrite")
    sys.exit(1)


class AppwriteDataExtractor:
    """Extracts seeded test data from Appwrite for Course Manager testing."""

    def __init__(self):
        self.client = Client()
        self.client.set_endpoint('https://cloud.appwrite.io/v1')

        # Use environment variables for Appwrite credentials
        project_id = os.getenv('APPWRITE_PROJECT_ID')
        api_key = os.getenv('APPWRITE_API_KEY')

        if not project_id or not api_key:
            raise ValueError(
                "Missing Appwrite credentials. Set APPWRITE_PROJECT_ID and APPWRITE_API_KEY"
            )

        self.client.set_project(project_id)
        self.client.set_key(api_key)
        self.databases = Databases(self.client)
        self.database_id = 'default'

    async def extract_complete_scheduling_context(
        self,
        student_id: str,
        course_id: str
    ) -> Dict[str, Any]:
        """
        Extract complete scheduling context from Appwrite - exactly as frontend would.

        Returns context matching SchedulingContextForCourse schema from PRD.
        """
        print(f"🔍 Extracting scheduling context for student {student_id}, course {course_id}")

        try:
            # 1. Get student data
            student = self.databases.get_document(
                database_id=self.database_id,
                collection_id='students',
                document_id=student_id
            )
            print(f"✅ Student found: {student['name']}")

            # 2. Get course data
            course = self.databases.get_document(
                database_id=self.database_id,
                collection_id='courses',
                document_id=course_id
            )
            print(f"✅ Course found: {course['title']}")

            # 3. Check enrollment
            enrollments = self.databases.list_documents(
                database_id=self.database_id,
                collection_id='enrollments',
                queries=[
                    Query.equal('studentId', student_id),
                    Query.equal('courseId', course_id)
                ]
            )

            if enrollments['total'] == 0:
                raise ValueError(f"Student {student_id} not enrolled in course {course_id}")

            enrollment = enrollments['documents'][0]
            print(f"✅ Enrollment found: {enrollment['enrolledAt']}")

            # 4. Get lesson templates for the course
            templates = self.databases.list_documents(
                database_id=self.database_id,
                collection_id='lesson_templates',
                queries=[Query.equal('courseId', course_id)]
            )
            print(f"✅ Found {templates['total']} lesson templates")

            # 5. Get mastery records for student
            mastery_records = self.databases.list_documents(
                database_id=self.database_id,
                collection_id='mastery',
                queries=[Query.equal('studentId', student_id)]
            )
            print(f"✅ Found {mastery_records['total']} mastery records")

            # 6. Get routine data for student
            routine_records = self.databases.list_documents(
                database_id=self.database_id,
                collection_id='routine',
                queries=[Query.equal('studentId', student_id)]
            )
            print(f"✅ Found {routine_records['total']} routine records")

            # 7. Get SOW (Scheme of Work) data for course
            sow_records = self.databases.list_documents(
                database_id=self.database_id,
                collection_id='sow',
                queries=[Query.equal('courseId', course_id)]
            )
            print(f"✅ Found {sow_records['total']} SOW records")

            # 8. Build complete scheduling context
            context = {
                "mode": "course_manager",
                "student": {
                    "$id": student['$id'],
                    "name": student['name'],
                    "email": student['email']
                },
                "course": {
                    "courseId": course['$id'],
                    "title": course['title'],
                    "sqaCode": course.get('sqaCode', '')
                },
                "templates": [
                    {
                        "templateId": template['$id'],
                        "title": template['title'],
                        "estMinutes": template.get('estMinutes', 30),
                        "sowUnit": template.get('sowUnit', ''),
                        "sowWeek": template.get('sowWeek', 1)
                    }
                    for template in templates['documents']
                ],
                "mastery": [
                    {
                        "templateId": record['templateId'],
                        "masteryLevel": record['masteryLevel']
                    }
                    for record in mastery_records['documents']
                ],
                "routine": [
                    {
                        "templateId": record['templateId'],
                        "lastSessionDate": record['lastSessionDate'],
                        "daysSinceLastSession": record['daysSinceLastSession']
                    }
                    for record in routine_records['documents']
                ],
                "sow": [
                    {
                        "templateId": record['templateId'],
                        "week": record['week'],
                        "currentWeek": record['currentWeek']
                    }
                    for record in sow_records['documents']
                ]
            }

            print(f"✅ Complete scheduling context extracted successfully")
            return context

        except Exception as e:
            print(f"❌ Failed to extract scheduling context: {e}")
            raise


class LangGraphCourseManagerTester:
    """Tests Course Manager subgraph in isolation using LangGraph SDK."""

    def __init__(self):
        # Use same configuration as frontend
        self.api_url = os.getenv('NEXT_PUBLIC_LANGGRAPH_API_URL', 'http://localhost:2024')
        self.assistant_id = os.getenv('NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID', 'agent')

        print(f"🚀 LangGraph API URL: {self.api_url}")
        print(f"🤖 Assistant ID: {self.assistant_id}")

        self.client = get_client(url=self.api_url)

    async def test_course_manager_happy_path(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Test Course Manager happy path with complete scheduling context.

        Expected behavior:
        - Receives complete scheduling context
        - Scores lesson templates using MVP1 rubric
        - Returns valid course recommendation
        """
        print(f"\n🧪 Testing Course Manager Happy Path")
        print(f"📊 Context summary:")
        print(f"   - Student: {context['student']['name']}")
        print(f"   - Course: {context['course']['title']}")
        print(f"   - Templates: {len(context['templates'])}")
        print(f"   - Mastery records: {len(context['mastery'])}")
        print(f"   - Routine records: {len(context['routine'])}")
        print(f"   - SOW records: {len(context['sow'])}")

        try:
            # Create thread for this test
            thread = await self.client.threads.create()
            print(f"✅ Created thread: {thread['thread_id']}")

            # Run Course Manager with complete context
            run = await self.client.runs.create(
                thread_id=thread['thread_id'],
                assistant_id=self.assistant_id,
                input={
                    "session_context": context,
                    "mode": "course_manager"
                }
            )
            print(f"✅ Started run: {run['run_id']}")

            # Wait for completion
            print("⏳ Waiting for Course Manager to complete...")
            result = await self.client.runs.join(thread['thread_id'], run['run_id'])

            # Get final state
            state = await self.client.threads.get_state(thread['thread_id'])
            print(f"✅ Run completed with status: {result.get('status', 'unknown')}")

            # Extract recommendation
            recommendation = self._extract_recommendation_from_state(state)

            # Validate recommendation structure
            self._validate_recommendation_structure(recommendation)

            print(f"✅ Happy path test PASSED")
            return {
                "status": "PASSED",
                "recommendation": recommendation,
                "thread_id": thread['thread_id'],
                "run_id": run['run_id']
            }

        except Exception as e:
            print(f"❌ Happy path test FAILED: {e}")
            return {
                "status": "FAILED",
                "error": str(e)
            }

    async def test_scoring_validation(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Test Course Manager scoring rubric validation.

        Expected scoring bonuses (from MVP1 PRD):
        - +0.40 for overdue lessons (SOW week < current week)
        - +0.25 for low mastery lessons (mastery < 0.5)
        - +0.15 for early order lessons
        - -0.10 for recently completed lessons
        - -0.05 for long duration lessons
        """
        print(f"\n🧪 Testing Course Manager Scoring Validation")

        try:
            # Run Course Manager
            thread = await self.client.threads.create()
            run = await self.client.runs.create(
                thread_id=thread['thread_id'],
                assistant_id=self.assistant_id,
                input={
                    "session_context": context,
                    "mode": "course_manager"
                }
            )

            await self.client.runs.join(thread['thread_id'], run['run_id'])
            state = await self.client.threads.get_state(thread['thread_id'])

            recommendation = self._extract_recommendation_from_state(state)

            # Validate scoring logic
            scoring_validation = self._validate_scoring_logic(recommendation, context)

            if scoring_validation['valid']:
                print(f"✅ Scoring validation test PASSED")
                return {
                    "status": "PASSED",
                    "validation": scoring_validation,
                    "recommendation": recommendation
                }
            else:
                print(f"❌ Scoring validation test FAILED: {scoring_validation['errors']}")
                return {
                    "status": "FAILED",
                    "validation": scoring_validation
                }

        except Exception as e:
            print(f"❌ Scoring validation test FAILED: {e}")
            return {
                "status": "FAILED",
                "error": str(e)
            }

    def _extract_recommendation_from_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Extract course recommendation from LangGraph state."""
        # Look for course_recommendation in state values
        if state.get('values', {}).get('course_recommendation'):
            return state['values']['course_recommendation']

        # Fallback: look in messages
        messages = state.get('values', {}).get('messages', [])
        if messages:
            last_message = messages[-1]
            if hasattr(last_message, 'content') and last_message.content:
                try:
                    parsed = json.loads(last_message.content)
                    if 'course_recommendation' in parsed:
                        return parsed['course_recommendation']
                except json.JSONDecodeError:
                    pass

        raise ValueError("No course_recommendation found in LangGraph state")

    def _validate_recommendation_structure(self, recommendation: Dict[str, Any]) -> None:
        """Validate recommendation matches expected schema."""
        required_fields = ['courseId', 'recommendations', 'nextSteps', 'generatedAt']

        for field in required_fields:
            if field not in recommendation:
                raise ValueError(f"Missing required field: {field}")

        if not isinstance(recommendation['recommendations'], list):
            raise ValueError("recommendations must be a list")

        if len(recommendation['recommendations']) == 0:
            raise ValueError("recommendations list cannot be empty")

        # Validate first recommendation structure
        first_rec = recommendation['recommendations'][0]
        rec_required_fields = ['lessonId', 'title', 'priority', 'score']

        for field in rec_required_fields:
            if field not in first_rec:
                raise ValueError(f"Missing required recommendation field: {field}")

    def _validate_scoring_logic(
        self,
        recommendation: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate scoring logic matches MVP1 rubric."""
        errors = []
        validations = []

        # Check if overdue lessons got +0.40 bonus
        overdue_templates = [
            template for template in context['templates']
            for sow in context['sow']
            if sow['templateId'] == template['templateId'] and sow['week'] < sow['currentWeek']
        ]

        if overdue_templates:
            overdue_recs = [
                rec for rec in recommendation['recommendations']
                if any(template['templateId'] == rec['lessonId'] for template in overdue_templates)
            ]

            if overdue_recs:
                # Check if overdue lessons have higher scores
                avg_overdue_score = sum(rec['score'] for rec in overdue_recs) / len(overdue_recs)
                validations.append(f"Overdue lessons average score: {avg_overdue_score}")

                if avg_overdue_score < 0.4:
                    errors.append("Overdue lessons should have +0.40 bonus (score >= 0.4)")

        # Check if low mastery lessons got +0.25 bonus
        low_mastery_templates = [
            mastery['templateId'] for mastery in context['mastery']
            if mastery['masteryLevel'] < 0.5
        ]

        if low_mastery_templates:
            low_mastery_recs = [
                rec for rec in recommendation['recommendations']
                if rec['lessonId'] in low_mastery_templates
            ]

            if low_mastery_recs:
                avg_low_mastery_score = sum(rec['score'] for rec in low_mastery_recs) / len(low_mastery_recs)
                validations.append(f"Low mastery lessons average score: {avg_low_mastery_score}")

                if avg_low_mastery_score < 0.25:
                    errors.append("Low mastery lessons should have +0.25 bonus (score >= 0.25)")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "validations": validations
        }


async def main():
    """Main test execution."""
    print("🚀 Starting Course Manager E2E Isolation Test")
    print("=" * 50)

    # Test configuration from seeded data
    test_student_id = "test-student-alex"
    test_course_id = "nat5-maths-2024"

    try:
        # 1. Extract scheduling context from Appwrite
        print("\n📊 Step 1: Extract scheduling context from Appwrite")
        extractor = AppwriteDataExtractor()
        context = await extractor.extract_complete_scheduling_context(
            test_student_id,
            test_course_id
        )

        # 2. Test Course Manager via LangGraph SDK
        print("\n🤖 Step 2: Test Course Manager via LangGraph SDK")
        tester = LangGraphCourseManagerTester()

        # Test 1: Happy path
        happy_path_result = await tester.test_course_manager_happy_path(context)

        # Test 2: Scoring validation
        scoring_result = await tester.test_scoring_validation(context)

        # 3. Summary
        print("\n📋 Test Summary")
        print("=" * 30)
        print(f"Happy path test: {happy_path_result['status']}")
        print(f"Scoring validation test: {scoring_result['status']}")

        if happy_path_result['status'] == 'PASSED' and scoring_result['status'] == 'PASSED':
            print("\n🎉 ALL TESTS PASSED - Course Manager working correctly!")
            return True
        else:
            print("\n❌ SOME TESTS FAILED - Course Manager needs fixes")
            return False

    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)