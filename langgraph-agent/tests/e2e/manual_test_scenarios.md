# Manual E2E Test Scenarios for Course Manager MVP1

## Test Environment Setup
- Frontend: http://localhost:3000
- Backend: http://localhost:2024
- Test User: test@scottishailessons.com / red12345
- Test Data: Pre-seeded in Appwrite with test-student-alex and nat5-maths-2024

## Scenario 1: Course Manager Happy Path
**Objective**: Verify Course Manager returns correct recommendations via frontend

**Pre-conditions**:
- User logged in as test@scottishailessons.com
- Test data seeded in Appwrite (completed in Task 7.12)
- LangGraph backend running on port 2024

**Test Steps**:
1. Navigate to chat interface at http://localhost:3000
2. Send message: "I want recommendations for my National 5 Mathematics course"
3. Verify routing goes to course_manager mode (check browser dev tools network tab)
4. Wait for response from Course Manager

**Expected Results**:
- Should receive 2 lesson recommendations
- Top recommendation should be "Introduction to Fractions" with high score (≥0.6)
- Should show reasons: ["overdue", "low mastery", "early order", "long lesson"]
- Second recommendation should be "Basic Algebra" with lower score (<0.3)
- Response should include transparent scoring explanation

**Current Status**: FAILING - Need to implement frontend integration

## Scenario 2: Course Manager Scoring Validation
**Objective**: Verify MVP1 scoring rubric works correctly

**Pre-conditions**: Same as Scenario 1

**Test Steps**:
1. Send course recommendation request
2. Examine returned lesson scores and reasons
3. Validate scoring against MVP1 rubric

**Expected Scoring**:
- **Fractions lesson**: Score ≈ 0.72
  - +0.40 (overdue: week 2 < current week 3)
  - +0.25 (low mastery: 0.3 < 0.5)
  - +0.12 (early order bonus)
  - -0.05 (long lesson penalty: 45min > 25min)
- **Algebra lesson**: Score ≈ 0.23
  - +0.25 (low mastery: 0.25 < 0.5)
  - +0.03 (early order bonus)
  - -0.05 (long lesson penalty: 40min > 25min)
  - No overdue bonus (week 5 > current week 3)

**Current Status**: PASSING in isolation, FAILING in frontend integration

## Scenario 3: Error Handling
**Objective**: Verify fail-fast behavior with detailed error messages

**Test Steps**:
1. Send request with invalid/missing course data
2. Verify error response with detailed explanation
3. Confirm no fallback behavior occurs

**Expected Results**:
- Clear error message explaining what went wrong
- No silent degradation or default recommendations
- Error logged with sufficient detail for debugging

**Current Status**: NOT TESTED

## Scenario 4: Multi-Course Context
**Objective**: Test Course Manager with multiple enrolled courses

**Pre-conditions**:
- Student enrolled in multiple test courses
- Each course has different lesson templates and progress

**Test Steps**:
1. Request recommendations without specifying course
2. Verify system prompts for course selection or handles multi-course scenario
3. Request recommendations for specific course
4. Verify correct course context is used

**Expected Results**:
- System should handle ambiguous course context gracefully
- When specific course selected, should return recommendations only for that course
- Cross-course contamination should not occur

**Current Status**: NOT IMPLEMENTED

## Implementation Notes
- Scenarios 1-2 are ready for frontend testing once integration is complete
- Scenario 3 can be tested by modifying seeded data to create error conditions
- Scenario 4 requires additional test data setup with multiple courses
- All scenarios should use playwright automation for repeatable testing

## Next Steps
1. Implement frontend integration to handle course_recommendation responses
2. Run Scenario 1 using Playwright MCP for automation
3. Validate scoring behavior matches LangSmith trace results
4. Create additional test data for multi-course scenarios