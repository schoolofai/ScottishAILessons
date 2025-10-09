# Remove course_outcome_subagent - Cost Optimization

## Problem
The `course_outcome_subagent` uses expensive gemini_pro model to fetch SQA course data from Appwrite, adding ~1000 tokens per lesson generation.

## Solution
Pre-fetch course data in `seedAuthoredLesson.ts` using direct Appwrite queries, inject into thread state before agent execution.

## Implementation

### Frontend Changes (seedAuthoredLesson.ts)
1. Fetch course metadata from `courses` collection (subject, level)
2. Query `sqa_education.current_sqa` for matching SQA data
3. Inject `Course_data.txt` into thread state using `client.threads.updateState()`

### Backend Changes (lesson_author_agent.py)
1. Remove `course_outcome_subagent` from subagents list
2. Remove `gemini_pro` model initialization (if not used elsewhere)
3. Update agent comment: "7 subagents" instead of "8 subagents"

### Prompt Changes (lesson_author_prompts.py)
1. Remove `course_outcome_subagent` from `<subagents_available>`
2. Update `<process>` step 3: Change from "Call course_outcome_subagent" to "Verify Course_data.txt exists"
3. Update `<inputs>`: Document that Course_data.txt is pre-loaded

## Expected Benefits
- **Cost**: Eliminate ~1000 tokens per lesson (gemini_pro call)
- **Latency**: Reduce by 3-5 seconds (direct query vs. subagent)
- **Reliability**: No LLM errors during course data fetching

## Test Cases
```bash
# Test with Application of Mathematics National 4, lesson 71
npm run seed:authored-lesson course_c84474 71 ../langgraph-author-agent/data/Seeding_Data/input/research_packs/application-of-mathematics_national-4.json
```

**Expected**:
- Course data fetched from Appwrite (subject: "Application of Mathematics", level: "National 4")
- Course_data.txt injected into thread state before agent runs
- Lesson template generated with correct outcomeRefs from SQA data
