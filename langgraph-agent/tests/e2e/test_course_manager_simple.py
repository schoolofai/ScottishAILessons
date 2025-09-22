"""
Simplified Course Manager E2E isolation test using static test data.

This test validates the Course Manager subgraph works correctly with complete
scheduling context by using the seeded data we created in Appwrite.
"""

import asyncio
import os
import sys
from typing import Dict, Any
import json
from datetime import datetime, timedelta

# Add the src directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src'))

try:
    from langgraph_sdk import get_client
except ImportError:
    print("❌ LangGraph SDK not available. Install with: pip install langgraph-sdk")
    sys.exit(1)


class LangGraphCourseManagerTester:
    """Tests Course Manager subgraph in isolation using LangGraph SDK."""

    def __init__(self):
        # Use same configuration as frontend
        self.api_url = os.getenv('NEXT_PUBLIC_LANGGRAPH_API_URL', 'http://localhost:2024')
        self.assistant_id = os.getenv('NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID', 'agent')

        print(f"🚀 LangGraph API URL: {self.api_url}")
        print(f"🤖 Assistant ID: {self.assistant_id}")

        self.client = get_client(url=self.api_url)

    def get_test_scheduling_context(self) -> Dict[str, Any]:
        """
        Returns complete scheduling context using the seeded test data.

        This matches exactly what we seeded in Appwrite for MVP1 testing.
        """
        return {
            "mode": "course_manager",
            "student": {
                "id": "test-student-alex",
                "$id": "test-student-alex",
                "name": "Alex Thompson",
                "email": "alex.thompson@example.com"
            },
            "course": {
                "$id": "nat5-maths-2024",
                "courseId": "nat5-maths-2024",
                "subject": "Mathematics",
                "phase": "Senior Phase",
                "level": "National 5",
                "sqaCode": "C747 75"
            },
            "templates": [
                {
                    "$id": "lesson-overdue-fractions",
                    "templateId": "lesson-overdue-fractions",
                    "title": "Introduction to Fractions",
                    "courseId": "nat5-maths-2024",
                    "estMinutes": 45,
                    "status": "published",
                    "outcomeRefs": ["MNU 4-07a", "MNU 4-07b"]
                },
                {
                    "$id": "lesson-low-mastery-algebra",
                    "templateId": "lesson-low-mastery-algebra",
                    "title": "Basic Algebra",
                    "courseId": "nat5-maths-2024",
                    "estMinutes": 40,
                    "status": "published",
                    "outcomeRefs": ["MNU 4-08a", "MNU 4-08b"]
                }
            ],
            "mastery": [
                {
                    "templateId": "lesson-overdue-fractions",
                    "masteryLevel": 0.3  # Low mastery → +0.25 bonus
                },
                {
                    "templateId": "lesson-low-mastery-algebra",
                    "masteryLevel": 0.25  # Low mastery → +0.25 bonus
                }
            ],
            "routine": [
                {
                    "templateId": "lesson-overdue-fractions",
                    "lastSessionDate": (datetime.now() - timedelta(days=14)).isoformat(),
                    "daysSinceLastSession": 14  # Creates overdue scenario
                },
                {
                    "templateId": "lesson-low-mastery-algebra",
                    "lastSessionDate": (datetime.now() - timedelta(days=10)).isoformat(),
                    "daysSinceLastSession": 10
                }
            ],
            "sow": [
                {
                    "templateId": "lesson-overdue-fractions",
                    "week": 2,
                    "currentWeek": 3  # week < currentWeek → overdue (+0.40 bonus)
                },
                {
                    "templateId": "lesson-low-mastery-algebra",
                    "week": 5,
                    "currentWeek": 3  # week > currentWeek → not overdue
                }
            ]
        }

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
        print(f"   - Course: {context['course']['subject']}")
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

        # Debug: Print state structure for troubleshooting
        print(f"🔍 Debug - State structure:")
        print(f"   - Top level keys: {list(state.keys())}")
        if 'values' in state:
            print(f"   - Values keys: {list(state['values'].keys())}")

            # Check for errors
            if 'error' in state['values']:
                print(f"❌ Error in state: {state['values']['error']}")

            # Print all messages for debugging
            messages = state['values'].get('messages', [])
            print(f"   - Total messages: {len(messages)}")
            for i, msg in enumerate(messages):
                if isinstance(msg, dict):
                    print(f"     Message {i}: type={msg.get('type', 'unknown')}, content preview={str(msg.get('content', ''))[:100]}...")
                else:
                    print(f"     Message {i}: type={type(msg)}, content preview={str(getattr(msg, 'content', ''))[:100]}...")

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

    try:
        # 1. Initialize tester and get test context
        print("\n📊 Step 1: Prepare test context with seeded data")
        tester = LangGraphCourseManagerTester()
        context = tester.get_test_scheduling_context()

        print(f"✅ Test context prepared:")
        print(f"   - Student: {context['student']['name']}")
        print(f"   - Course: {context['course']['subject']}")
        print(f"   - Templates: {len(context['templates'])}")
        print(f"   - Fractions template: mastery={context['mastery'][0]['masteryLevel']}, overdue=True")
        print(f"   - Algebra template: mastery={context['mastery'][1]['masteryLevel']}, overdue=False")

        # 2. Test Course Manager via LangGraph SDK
        print("\n🤖 Step 2: Test Course Manager via LangGraph SDK")

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
            if happy_path_result['status'] == 'FAILED':
                print(f"Happy path error: {happy_path_result.get('error', 'Unknown')}")
            if scoring_result['status'] == 'FAILED':
                print(f"Scoring validation error: {scoring_result.get('error', 'Unknown')}")
            return False

    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)