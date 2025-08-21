# Command Usage Guide

Detailed documentation for each Claude Code command in this template.

## Command Overview

| Command | Purpose | Input | Output |
|---------|---------|--------|--------|
| `/create-prd` | Generate PRD from brief | Brief file path | PRD in tasks/ subdirectory |
| `/generate-tasks` | Create task list from PRD | PRD directory path | Task list with TDD structure |
| `/process-task-list` | Execute tasks systematically | Feature name | Step-by-step implementation |
| `/resume-task-list` | Continue from where left off | Feature name | Resume from last incomplete task |
| `/create-documentation` | Generate feature docs | Feature name | Comprehensive README |

## `/create-prd` Command

### Purpose
Transforms a high-level brief into a detailed Product Requirements Document.

### Usage
```
/create-prd <path-to-brief-file>
```

### Example
```
/create-prd tasks/user-authentication/auth-brief.md
```

### What It Does
1. **Reads your brief** - Analyzes the high-level description
2. **Asks clarifying questions** - Gathers missing requirements
3. **Generates structured PRD** - Creates detailed specification
4. **Saves to subdirectory** - Organizes in tasks/[feature-name]/

### Clarifying Questions Categories

#### Problem Definition
- "What specific problem does this feature solve?"
- "What pain points are users experiencing?"
- "How do users currently handle this need?"

#### Target Users
- "Who is the primary user of this feature?"
- "Are there different user types with different needs?"
- "What's their technical skill level?"

#### Functional Requirements
- "What are the core actions users need to perform?"
- "What data does the feature need to handle?"
- "How should the feature integrate with existing systems?"

#### Success Criteria
- "How will we measure if this feature is successful?"
- "What are the key performance indicators?"
- "What would failure look like?"

#### Scope Boundaries
- "What should this feature NOT do?"
- "Are there features to save for later versions?"
- "What are the technical constraints?"

### PRD Output Structure
```markdown
## Introduction/Overview
Brief description and problem statement

## Goals
- Specific, measurable objectives
- Success criteria

## User Stories
- As a [user type], I want [action] so that [benefit]
- Covers main user journeys

## Functional Requirements
1. Numbered, testable requirements
2. Clear acceptance criteria
3. Edge case handling

## Non-Goals (Out of Scope)
- Explicit exclusions
- Future considerations

## Technical Considerations
- Integration points
- Performance requirements
- Security considerations

## Success Metrics
- Measurable outcomes
- Key performance indicators
```

### Best Practices
- **Be specific** in your brief - more detail leads to better questions
- **Answer thoroughly** - detailed answers create better PRDs
- **Review and iterate** - you can refine the PRD after generation

## `/generate-tasks` Command

### Purpose
Breaks down a PRD into actionable development tasks using Outside-In TDD methodology.

### Usage
```
/generate-tasks <prd-directory-path>
```

### Example
```
/generate-tasks tasks/user-authentication/
```

### Prerequisites
The directory must contain:
- High-level brief file
- PRD file (starting with `prd-`)

### Process Flow

#### Phase 1: Parent Tasks
```
You: /generate-tasks tasks/user-authentication/

Claude: I have generated the high-level tasks based on the PRD:

- [ ] 1.0 Set up authentication infrastructure
- [ ] 2.0 Implement user registration system
- [ ] 3.0 Create login/logout functionality
- [ ] 4.0 Add password reset capability
- [ ] 5.0 Build user profile management

Ready to generate the sub-tasks? Respond with 'Go' to proceed.

You: Go
```

#### Phase 2: Detailed Sub-tasks
Claude then generates specific sub-tasks for each parent task:

```markdown
- [ ] 1.0 Set up authentication infrastructure
  - [ ] 1.1 Write acceptance test for auth middleware
  - [ ] 1.2 Create auth middleware with mocked dependencies
  - [ ] 1.3 Implement JWT token service
  - [ ] 1.4 Set up user session management
  - [ ] 1.5 Configure security headers and CORS
```

### TDD Task Structure

Each sub-task follows the Outside-In TDD pattern:

1. **Acceptance Test** - End-to-end test that describes the behavior
2. **Minimal Implementation** - Just enough to make it compile
3. **Unit Tests** - Test individual components with mocks
4. **Implementation** - Build the actual functionality
5. **Integration** - Connect real dependencies
6. **Refactor** - Clean up while keeping tests green

### Output Files
- **Location**: `tasks/[feature-name]/tasks-prd-[feature-name].md`
- **Structure**: Markdown checklist format
- **Includes**: Relevant files section with test files

### Relevant Files Section
Lists all files that will be created or modified:
```markdown
## Relevant Files

- `src/middleware/auth.ts` - Authentication middleware
- `src/middleware/auth.test.ts` - Tests for auth middleware
- `src/services/user.ts` - User service interface
- `src/services/user.test.ts` - User service tests
```

## `/process-task-list` Command

### Purpose
Executes the task list systematically, one sub-task at a time, using TDD methodology.

### Usage
```
/process-task-list <feature-name>
```

### Example
```
/process-task-list user-authentication
```

### Execution Rules

#### Sequential Processing
- **One sub-task at a time** - No parallel task execution
- **Complete before continuing** - Finish current task completely
- **User approval required** - Ask permission before next task

#### Task Completion Protocol
1. **Implement the sub-task** using TDD
2. **Mark as completed** - Change `[ ]` to `[x]`
3. **Check parent task** - Mark parent as complete if all sub-tasks done
4. **Update task file** - Save progress immediately
5. **Ask for permission** - Wait for user to approve next task

#### TDD Implementation Process
For each sub-task:

1. **Red Phase**
   - Write failing test first
   - Ensure test fails for the right reason
   - Keep implementation minimal

2. **Green Phase**
   - Write simplest code to make test pass
   - Don't worry about elegance yet
   - Focus on making it work

3. **Refactor Phase**
   - Clean up code while tests stay green
   - Improve naming and structure
   - Remove duplication

### Example Session
```
You: /process-task-list user-authentication

Claude: Starting with task 1.1: Write acceptance test for auth middleware

[Implements acceptance test]

// test/auth.integration.test.ts
describe('Authentication Middleware', () => {
  it('should protect routes requiring authentication', async () => {
    const response = await request(app)
      .get('/api/protected')
      .expect(401);
    
    expect(response.body.error).toBe('Unauthorized');
  });
});

Task 1.1 completed ✅. Ready for task 1.2? (y/n)

You: y

Claude: Starting task 1.2: Create auth middleware with mocked dependencies
[Continues with next implementation]
```

### Progress Tracking
- **Real-time updates** - Task list updated after each completion
- **Visual progress** - Checkmarks show what's done
- **Parent task tracking** - Parent tasks marked complete when all sub-tasks done

### Error Handling
If a task can't be completed:
- **Keep as in-progress** - Don't mark as complete
- **Create blocking task** - Add new task for the blocker
- **Document the issue** - Note what needs to be resolved

## `/resume-task-list` Command

### Purpose
Continue implementation from where you previously left off.

### Usage
```
/resume-task-list <feature-name> [additional-instructions]
```

### Example
```
/resume-task-list user-authentication
/resume-task-list user-authentication "focus on error handling"
```

### What It Does
1. **Reads task list** - Analyzes current progress
2. **Identifies next task** - Finds first incomplete sub-task
3. **Provides context** - Shows what was last completed
4. **Confirms plan** - Asks user to verify next steps

### Example Session
```
You: /resume-task-list user-authentication

Claude: I found the task list for user-authentication.

Progress Summary:
✅ 1.0 Set up authentication infrastructure (completed)
✅ 2.0 Implement user registration system (completed)
⏳ 3.0 Create login/logout functionality (in progress)
  ✅ 3.1 Write login acceptance test
  ✅ 3.2 Create login controller with mocks
  ⏯️  3.3 Implement password hashing service

Next: Continue with task 3.3 - Implement password hashing service

This task involves creating a secure password hashing service using bcrypt.
Ready to continue? (y/n)

You: y
```

### Benefits
- **No context loss** - Pick up exactly where you left off
- **Clear progress** - See what's been accomplished
- **Smart resumption** - Understands the current state
- **Flexible continuation** - Can adjust approach with additional instructions

## `/create-documentation` Command

### Purpose
Generate comprehensive feature documentation after implementation is complete.

### Usage
```
/create-documentation <feature-name>
```

### Example
```
/create-documentation user-authentication
```

### Prerequisites
- Completed or substantially complete task list
- Implementation files in place
- Git repository with changes to analyze

### What It Analyzes
1. **Task completion status** - Which tasks were finished
2. **Code changes** - Files modified or created
3. **Git diff** - Actual implementation details
4. **Test files** - What tests were added
5. **Configuration changes** - Dependencies, settings, etc.

### Generated Documentation Structure

#### Feature Overview
- Summary from PRD and spec
- Key objectives achieved
- High-level architecture

#### New Functionality Added
- List of implemented features
- Technical components created
- API endpoints added

#### Testing Instructions
- Prerequisites for testing
- Step-by-step test scenarios
- Expected outcomes
- Test data requirements

#### Code Review Guide
For each modified file:
- Purpose of changes made
- Key implementation details
- Integration points
- Review checklist items

#### Architecture Changes
- Database schema updates
- New API endpoints
- State management changes
- Dependencies added
- Configuration modifications

### Example Output
```markdown
# Feature: User Authentication System

## Overview
Secure user authentication system with registration, login, and profile management.

## New Functionality Added
- JWT-based authentication middleware
- User registration with email verification
- Secure password hashing with bcrypt
- Login/logout with session management
- Password reset functionality
- User profile CRUD operations

## Testing Instructions

### Prerequisites
- Node.js 18+ installed
- Test database configured
- Email service configured for verification

### Test Cases
1. **User Registration**
   - Navigate to `/register`
   - Enter valid email and password
   - Verify email verification sent
   - Check user created in database

2. **Login Flow**
   - Use registered credentials
   - Verify JWT token returned
   - Check protected routes accessible
...
```

### Usage Tips
- **Run after implementation** - Works best with completed features
- **Clean git state** - Commit your changes before running
- **Review and edit** - Generated docs are a starting point
- **Add examples** - Include specific usage examples

## Command Customization

### Modifying Commands
Commands are stored in `.claude/commands/` as markdown files. You can:

1. **Edit existing commands** - Modify the process or output format
2. **Add new commands** - Create new workflow steps
3. **Customize for your stack** - Adapt file paths and frameworks

### Command Structure
```markdown
---
name: command-name
description: Brief description
---

# Command Title

Brief overview.

## Usage
/command-name <arguments>

## Implementation
[Step-by-step process]

## Output
[Expected results]
```

### Environment Variables
Commands can reference:
- `$ARGUMENTS` - Command line arguments
- File paths and project structure
- Team-specific conventions

## Troubleshooting

### Common Issues

#### PRD Generation
- **Vague questions** - Provide more detail in your brief
- **Wrong directory** - Check file path is correct
- **Missing brief** - Ensure brief file exists

#### Task Generation
- **No PRD found** - Verify PRD file exists with `prd-` prefix
- **Incomplete generation** - Make sure you responded with "Go"
- **Missing dependencies** - Check PRD has sufficient technical detail

#### Task Execution
- **Can't find task list** - Verify feature name matches directory
- **Tests failing** - Follow TDD methodology strictly
- **Stuck on task** - Break down into smaller sub-tasks

#### Documentation Generation
- **Empty documentation** - Ensure files are committed to git
- **Missing sections** - Check if implementation is complete
- **Incorrect file paths** - Verify project structure matches expectations

### Getting Help
- Check the [troubleshooting guide](troubleshooting.md)
- Review [examples](examples/) for reference implementations
- Open an issue using the bug report template