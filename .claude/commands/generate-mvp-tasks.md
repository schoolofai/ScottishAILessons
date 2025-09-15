# Rule: Generating a Task List from a PRD
The user provides the location for PRD Sub-Directory under @tasks/ - it contains two files - a high level brief and a prd document.
PRD Sub-Directory : $ARGUMENTS
## Goal

For claude to create a series of MVPs with incremental complexity based on the lean startup methond and then create a list of tasks for each MVP based on an existing Product Requirements Document (PRD) and the high level brief document under the tasks/ folder uder the sub-directory @ARGUMENTS . The task list under each MVP  should guide a developer through implementation incrementatlly. There should always be an MVP 0 that setup up testing and devops environment.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/tasks/$ARGUMENTS`
- **Filename:** `tasks-[prd-file-name].md` (e.g., `tasks-prd-user-profile-editing.md`)

## Detailed  Process

1.  **Receive PRD Reference and high level breif :** The user points the AI to a specific sub-directory under tasks/ directory with the name $ARGUMENTS - which contains two files 1. PRD 2.High level Brief
2.  **Analyze PRD:** The AI reads and analyzes the functional requirements, user stories, and other sections of the specified PRD.
3.  **Generate MVP Based Tasks:** Based on the PRD and high level brief analysis, create the file and Create a task list grouped by **Lean Startup–style MVPs**. For each MVP 
   - define **vertical user stories** starting with a **walking skeleton**, then iteratively add layers to build out the feature in phased slices.
   -  Each MVP should describe what the end product is going to be functionally and what capabilities it will have enabled the user with. 
   -  Then generate **high-level tasks** for each MVP in a strict **Outside-In TDD** sequence from *Growing Object-Oriented Software, Guided by Tests* — start with an end-to-end acceptance test, drive the outermost interface, and descend through collaborators with focused unit tests, faking or extracting implementations as you progress. 
   -  Each slice must deliver **visible, shippable value** to the user. 
   -  An MVP can be considered done when there is a.
    a. value delivered 
    b. with working software 
    c. all outside and unit tests are passing.
   - **MVP 0** - There should always be an MVP zero that sets up infrastructure for testing the app based on the tech stack specified in the high level brief under the $ARGUMENTS subfolder in task/ root folder. This phase should install all dependencies and tools for - e2e test (e.g. playwright), integration tests and unit tests. There should be hello world tests run to validate that the testing infra is setup. 

Here is the general format of the output of each MVP :

MVP <number>: <mvp title>:

Vertical User Story :
<claude puts a high level vertical user story here>
Outcome:
<Claude puts the overall outcome of this drop - describes feature enabled>
How to Test/ Run: 
<claude puts instructions of how user can run all the tests and use the features in this section>
Tasks:
<claude puts a list of tasks to implement the MVP here , the task list should start with writing a failing outside integration or e2e test , the intermediate tasks should be driven with unit tests and mocks using strick TDD red green refactor cycle, the last task should be making thie outer integration or e2e test pass>

**Example:**
<Example Start>
MVP 0: Testing Infrastructure Setup

  Vertical User Story:
  As a developer, I want to have a complete testing setup so that I can write reliable tests
  throughout development.

  Outcome:
  Development environment ready with all testing tools configured and verified working.

  How to Test/Run:
  npm test -- --watch
  npm run test:e2e
  npm run test:integration

  Tasks:
  - Set up project structure with package.json and dependencies
  - Install and configure Jest for unit testing
  - Install and configure Playwright for e2e testing
  - Install and configure testing utilities (testing-library, etc.)
  - Create hello world unit test and verify it passes
  - Create hello world e2e test and verify it passes
  - Set up test scripts in package.json

  MVP 1: Walking Skeleton - Basic Playlist Query

  Vertical User Story:
  As a user, I want to input a song or mood and get a placeholder playlist so that I can see the
  app's basic workflow.

  Outcome:
  A working end-to-end flow where users can input a query and receive a static playlist response.

  How to Test/Run:
  npm run dev
  # Navigate to localhost:3000, enter "chill vibes" and see placeholder playlist
  npm run test:e2e -- playlist-generation.e2e.test.ts

  Tasks:
  - Write failing e2e test for "User can input query and get playlist"
  - Create basic React form component with input field (TDD)
  - Create API route handler that returns mock playlist data (TDD)
  - Connect frontend to backend API with fetch call (TDD)
  - Style basic UI for query input and playlist display (TDD)
  - Make e2e test pass by implementing full integration

  MVP 2: Real AI Integration

  Vertical User Story:
  As a user, I want my playlist to be generated using AI so that I get personalized music
  recommendations based on my input.

  Outcome:
  Dynamic playlist generation using OpenAI/AI service with real track recommendations from music
  APIs.

  How to Test/Run:
  npm run test:integration -- ai-playlist.test.ts
  npm run dev
  # Enter any mood/genre and receive AI-generated playlist with real tracks

  Tasks:
  - Write failing integration test for "AI generates playlist from user query"
  - Create AI service client with OpenAI integration (TDD)
  - Implement music API client (Spotify/Apple Music) for track data (TDD)
  - Create playlist generation algorithm combining AI + music data (TDD)
  - Add error handling for AI/API failures with fallbacks (TDD)
  - Update frontend to handle loading states and errors (TDD)
  - Make integration test pass with full AI workflow

  MVP 3: User Personalization

  Vertical User Story:
  As a user, I want my playlists to adapt based on my preferences and listening history so that
  recommendations get better over time.

  Outcome:
  Personalized playlist generation that learns from user interactions and maintains preference
  profiles.

  How to Test/Run:
  npm run test:e2e -- personalization.e2e.test.ts
  npm run dev
  # Create account, rate songs, see improved recommendations

  Tasks:
  - Write failing e2e test for "User preferences improve playlist quality"
  - Create user authentication system (TDD)
  - Implement user preference storage (database/local) (TDD)
  - Create feedback mechanism (thumbs up/down, ratings) (TDD)
  - Update AI prompt engineering to include user preferences (TDD)
  - Implement recommendation learning algorithm (TDD)
  - Make e2e test pass with full personalization flow

  MVP 4: Advanced Playlist Features

  Vertical User Story:
  As a user, I want to save, share, and export my playlists so that I can use them across
  different platforms and share with friends.

  Outcome:
  Complete playlist management with save, share, export capabilities and social features.

  How to Test/Run:
  npm run test:e2e -- playlist-management.e2e.test.ts
  npm run dev
  # Generate playlist, save it, share link, export to Spotify

  Tasks:
  - Write failing e2e test for "User can save, share, and export playlists"
  - Implement playlist persistence and user library (TDD)
  - Create sharing functionality with unique URLs (TDD)
  - Add export integration to Spotify/Apple Music APIs (TDD)
  - Implement playlist editing (add/remove/reorder tracks) (TDD)
  - Create social features (public playlists, following) (TDD)
  - Make e2e test pass with complete playlist management

  Each MVP delivers visible value and follows Outside-In TDD: starting with failing acceptance
  tests, driving the interface design, then implementing collaborators with focused unit tests and
   mocks.
<Example Stop>
## Output Format

The generated task list _must_ follow this structure:

```markdown
## Relevant Files with examples 

- `path/to/potential/file1.e2e.test.ts` - MVP e2e tests or integration tests.
- `path/to/potential/file1.ts` - Brief description of why this file is relevant (e.g., Contains the main component for this feature).
- `path/to/file1.test.ts` - Unit tests for `file1.ts`.
- `path/to/another/file.tsx` - Brief description (e.g., API route handler for data submission).
- `path/to/another/file.test.tsx` - Unit tests for `another/file.tsx`.
- `lib/utils/helpers.ts` - Brief description (e.g., Utility functions needed for calculations).
- `lib/utils/helpers.test.ts` - Unit tests for `helpers.ts`.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).


## Target Audience

Assume the primary reader of the task list is a **junior developer** who will implement the feature.
