# Best Practices Guide

Guidelines for effective use of the Claude Code Command Template workflow.

## PRD Best Practices

### Writing Effective Briefs

#### Be Specific About the Problem
❌ **Poor**: "Make the app better"
✅ **Good**: "Reduce user onboarding time by adding guided tutorials"

❌ **Poor**: "Add social features"
✅ **Good**: "Enable users to share their achievements with friends via social media integration"

#### Include Context
```markdown
# Good Brief Example

## Current State
Users currently have to manually configure settings each time they create a project.

## Desired State
Users should have smart defaults and template options to speed up project creation.

## Success Criteria
- Reduce project setup time from 10 minutes to 2 minutes
- 90% of users should use the template system
```

#### Avoid Solution Details
❌ **Poor**: "Use React hooks to manage state"
✅ **Good**: "Provide real-time updates when data changes"

Focus on **what** you need, not **how** to build it.

### Answering Clarifying Questions

#### Provide User Personas
Instead of: "Regular users"
Use:
```
Primary: Sarah, Product Manager
- Creates 3-5 projects per week
- Values speed and consistency
- Technical comfort: Medium

Secondary: Alex, Developer
- Creates 10+ projects per week
- Needs customization options
- Technical comfort: High
```

#### Define Success Metrics
Instead of: "Users like it"
Use:
```
Success Metrics:
- 50% reduction in support tickets about project setup
- 80% adoption rate within 3 months
- Average setup time under 2 minutes
- User satisfaction score > 4.5/5
```

#### Specify Edge Cases
```
Edge Cases to Consider:
- What happens when network is offline?
- How do we handle corrupted template files?
- What if a user has no templates available?
- How do we migrate existing projects?
```

## Task Generation Best Practices

### Parent Task Structure

#### Focus on User Value
Each parent task should deliver user-visible value:

✅ **Good Parent Tasks:**
- "Implement user registration system"
- "Add real-time notifications"
- "Create data export functionality"

❌ **Poor Parent Tasks:**
- "Set up database"
- "Configure webpack"
- "Write tests"

#### Logical Dependencies
Order tasks by dependencies:
```markdown
1.0 Set up authentication infrastructure (foundational)
2.0 Implement user registration (depends on #1)
3.0 Add login/logout functionality (depends on #1, #2)
4.0 Create user profile management (depends on #1, #2, #3)
```

### Sub-task Breakdown

#### Follow TDD Principles
Each sub-task should follow the Red-Green-Refactor cycle:

```markdown
- [ ] 2.1 Write acceptance test for user registration
- [ ] 2.2 Create registration controller with mocked user service
- [ ] 2.3 Implement user validation logic
- [ ] 2.4 Add email verification service
- [ ] 2.5 Integrate with real database
- [ ] 2.6 Add error handling and edge cases
```

#### Keep Tasks Small
✅ **Good Sub-task**: "Add email validation to registration form"
❌ **Poor Sub-task**: "Implement entire user management system"

Rule of thumb: Each sub-task should take 30 minutes to 2 hours.

#### Include Test Tasks
Every implementation task should have corresponding test tasks:
```markdown
- [ ] 3.1 Write unit tests for password hashing
- [ ] 3.2 Implement password hashing service
- [ ] 3.3 Write integration tests for login flow
- [ ] 3.4 Implement login controller
```

## TDD Implementation Best Practices

### Outside-In Approach

#### Start with Acceptance Tests
```javascript
// Good: Start with the end user perspective
describe('User Registration', () => {
  it('should create a new user account', async () => {
    await page.goto('/register');
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('#submit');
    
    await expect(page.locator('.success-message')).toBeVisible();
    // Verify user exists in database
  });
});
```

#### Mock External Dependencies
```javascript
// Good: Mock at the boundary
const mockEmailService = jest.mock('../services/emailService');
const mockDatabase = jest.mock('../database/userRepository');

describe('RegistrationController', () => {
  it('should send verification email after creating user', () => {
    // Test with mocked dependencies
  });
});
```

#### Build From Outside In
1. **E2E Test** (User perspective)
2. **Controller Test** (API layer)
3. **Service Test** (Business logic)
4. **Repository Test** (Data layer)

### Test Quality

#### Good Test Names
✅ **Good**: "should return 400 when email is invalid"
❌ **Poor**: "test email validation"

✅ **Good**: "should create user with hashed password"
❌ **Poor**: "test user creation"

#### Arrange, Act, Assert
```javascript
describe('User Service', () => {
  it('should hash password before saving user', async () => {
    // Arrange
    const userData = { email: 'test@example.com', password: 'plain' };
    const mockRepo = jest.fn();
    
    // Act
    await userService.createUser(userData);
    
    // Assert
    expect(mockRepo).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: expect.not.stringMatching('plain')
    });
  });
});
```

#### Test Behavior, Not Implementation
✅ **Good**: Test that password is hashed
❌ **Poor**: Test that bcrypt.hash() is called

## Task Execution Best Practices

### Workflow Discipline

#### One Task at a Time
- Complete current sub-task fully before starting next
- Don't work on multiple tasks in parallel
- Mark completed tasks immediately

#### Commit Frequently
```bash
# Good commit after each sub-task
git commit -m "feat: add email validation to registration form

- Implements client-side email format validation
- Adds server-side email domain verification
- Includes comprehensive test coverage

Task 2.3 completed"
```

#### Ask Before Proceeding
Wait for explicit approval before starting next task:
```
Claude: Task 2.3 completed ✅
Added email validation with client and server-side checks.
All tests passing.

Ready for task 2.4: Add email verification service? (y/n)
```

### Code Quality

#### Follow Project Conventions
Before implementing, check:
- Existing code style and patterns
- Framework and library choices
- File organization structure
- Naming conventions

#### Security Best Practices
```javascript
// Good: Secure password handling
const bcrypt = require('bcrypt');

async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Good: Input validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
```

#### Error Handling
```javascript
// Good: Comprehensive error handling
try {
  const user = await userService.createUser(userData);
  res.status(201).json({ id: user.id, email: user.email });
} catch (error) {
  if (error.code === 'DUPLICATE_EMAIL') {
    return res.status(409).json({ error: 'Email already exists' });
  }
  if (error.code === 'VALIDATION_ERROR') {
    return res.status(400).json({ error: error.message });
  }
  // Log unexpected errors
  logger.error('User creation failed', { error, userData: userData.email });
  res.status(500).json({ error: 'Internal server error' });
}
```

## Documentation Best Practices

### Feature Documentation

#### Include Real Examples
```markdown
## Testing Instructions

### User Registration Test
1. Navigate to `http://localhost:3000/register`
2. Enter email: `test@example.com`
3. Enter password: `SecurePass123!`
4. Click "Create Account"
5. **Expected**: Success message appears and verification email sent
6. **Verify**: Check `users` table has new record with hashed password
```

#### Provide Troubleshooting
```markdown
## Common Issues

### Registration Fails with 500 Error
**Cause**: Email service not configured
**Solution**: Set `EMAIL_API_KEY` environment variable
**Test**: `curl -X POST /api/test-email`

### Password Validation Too Strict
**Cause**: Default password policy requires 12+ characters
**Config**: Update `MIN_PASSWORD_LENGTH` in config/security.js
```

#### Document Architecture Decisions
```markdown
## Architecture Changes

### Database Schema
Added `users` table with:
- `id` (UUID primary key)
- `email` (unique, indexed)
- `password_hash` (bcrypt, 12 rounds)
- `email_verified` (boolean, default false)
- `created_at`, `updated_at` (timestamps)

**Decision**: Used UUID for privacy and to prevent enumeration attacks
**Alternative**: Auto-increment integer (rejected for security reasons)
```

### Code Review Guidelines

#### Review Checklist
```markdown
## Code Review Checklist

### Security
- [ ] Passwords are hashed, never stored plain text
- [ ] Input validation on all user inputs
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS prevention (output encoding)

### Testing
- [ ] All new code has test coverage
- [ ] Tests cover happy path and edge cases
- [ ] Integration tests verify end-to-end flow
- [ ] Tests are deterministic (no flaky tests)

### Performance
- [ ] Database queries are efficient
- [ ] No N+1 query problems
- [ ] Appropriate caching where needed
- [ ] Error handling doesn't leak sensitive info
```

## Common Anti-Patterns

### PRD Anti-Patterns

❌ **Solution-focused requirements**
"Use JWT tokens for authentication"
✅ **Problem-focused requirements**
"Users need secure, stateless authentication that works across devices"

❌ **Vague acceptance criteria**
"Authentication should work"
✅ **Specific acceptance criteria**
"User remains logged in for 24 hours unless explicitly logged out"

### Task Generation Anti-Patterns

❌ **Implementation-first tasks**
```markdown
- [ ] Set up JWT library
- [ ] Configure middleware
- [ ] Write authentication logic
```

✅ **Behavior-first tasks**
```markdown
- [ ] Write test for protected route access
- [ ] Implement authentication middleware
- [ ] Add JWT token validation
```

### Implementation Anti-Patterns

❌ **Working on multiple tasks**
Don't juggle multiple sub-tasks simultaneously

❌ **Skipping tests**
Don't implement without following TDD

❌ **Large commits**
Don't combine multiple sub-tasks in one commit

❌ **Not updating task list**
Don't forget to mark completed tasks

## Scaling the Workflow

### Team Adoption

#### Start Small
- Begin with one feature team
- Use for new feature development
- Refine process based on feedback

#### Establish Standards
```markdown
Team Standards:
- All features must have PRDs
- Task lists required before implementation
- TDD is mandatory for business logic
- Documentation generated before PR
```

#### Tool Integration
- Integrate with existing project management tools
- Set up CI/CD to validate task completion
- Create templates for common feature types

### Process Optimization

#### Custom Commands
Create team-specific commands:
```markdown
# .claude/commands/deploy-feature.md
Deploy completed feature to staging environment
```

#### Automated Validation
```yaml
# .github/workflows/feature-validation.yml
- name: Validate Feature Completion
  run: |
    # Check all tasks marked complete
    # Verify tests pass
    # Confirm documentation exists
```

#### Metrics and Improvement
Track:
- Time from brief to implementation
- Defect rates by feature
- Test coverage percentages
- Documentation quality scores

Use data to continuously improve the process.

---

Following these best practices will help you get the most value from the Claude Code Command Template workflow while maintaining high code quality and team productivity.