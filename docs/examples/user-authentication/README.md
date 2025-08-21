# Example: User Authentication System

This is a complete example workflow demonstrating how to use the Claude Code Command Template to implement a user authentication system.

## Workflow Overview

This example shows the complete journey from initial idea to implementation:

1. **[Brief](brief.md)** - High-level description of the authentication requirements
2. **[PRD](prd-user-auth.md)** - Detailed Product Requirements Document with functional specs
3. **[Tasks](tasks-prd-user-auth.md)** - Implementation task list following TDD methodology
4. **Implementation** - Sample code files and tests
5. **Documentation** - Generated feature documentation

## Learning Objectives

By studying this example, you'll learn:

- How to write effective feature briefs
- What makes a good PRD with clear requirements
- How to break down complex features into TDD tasks
- Implementation patterns for secure authentication
- Documentation practices for feature completion

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL with user authentication schema
- **Security**: bcrypt for password hashing, JWT for sessions
- **Email**: Integration with email service for verification
- **Testing**: Jest for unit/integration tests, Supertest for API testing
- **Frontend**: React with authentication forms and protected routes

## Key Implementation Highlights

### Security Best Practices
```javascript
// Password hashing with bcrypt
const bcrypt = require('bcrypt');
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// JWT token generation
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { 
  expiresIn: '24h' 
});
```

### Test-Driven Development
```javascript
// Acceptance test drives implementation
describe('User Registration', () => {
  it('should create account and send verification email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: 'SecurePass123'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Verification email sent');
    // Verify user created in database
    // Verify email was sent
  });
});
```

### Middleware Pattern
```javascript
// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

## Project Structure

```
user-authentication/
├── brief.md                    # Original feature brief
├── prd-user-auth.md           # Generated PRD
├── tasks-prd-user-auth.md     # Generated task list
├── implementation/            # Sample implementation files
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   └── User.test.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── authController.test.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── auth.test.js
│   │   ├── services/
│   │   │   ├── emailService.js
│   │   │   ├── tokenService.js
│   │   │   └── *.test.js
│   │   └── routes/
│   │       ├── auth.js
│   │       └── auth.test.js
│   ├── database/
│   │   └── migrations/
│   │       └── 001_create_users_table.sql
│   ├── test/
│   │   └── integration/
│   │       └── auth.integration.test.js
│   └── package.json
└── README.md                  # This file
```

## Usage Instructions

### 1. Study the Workflow
Read through the files in order:
1. `brief.md` - See how the feature was initially described
2. `prd-user-auth.md` - Review the detailed requirements
3. `tasks-prd-user-auth.md` - Understand the task breakdown

### 2. Practice the Commands
Try generating these documents yourself:

```bash
# Start with the brief
/create-prd docs/examples/user-authentication/brief.md

# Generate tasks from PRD
/generate-tasks docs/examples/user-authentication/

# Process the task list
/process-task-list user-authentication
```

### 3. Implement Your Own Version
Use this as a template for your own authentication system:

```bash
# Copy the structure
mkdir tasks/my-auth-system
cp docs/examples/user-authentication/brief.md tasks/my-auth-system/
# Modify the brief for your needs
# Run the workflow commands
```

### 4. Learn the Patterns
Focus on these key patterns:
- **Outside-In TDD**: Start with acceptance tests
- **Security First**: Hash passwords, validate tokens
- **Error Handling**: Comprehensive error scenarios
- **Input Validation**: Sanitize and validate all inputs

## Common Adaptations

### Different Tech Stacks

**Python/Django**:
- Replace Express with Django REST Framework
- Use Django's built-in User model
- Implement with Django's authentication system

**Java/Spring Boot**:
- Use Spring Security for authentication
- Implement with JPA for database access
- Use Spring's validation framework

**Go**:
- Use Gin or Echo for HTTP framework
- Implement custom JWT middleware
- Use GORM for database operations

### Database Variations

**MongoDB**:
- Adapt User model for document structure
- Use MongoDB indexes for email uniqueness
- Handle ObjectID for user references

**MySQL**:
- Adjust SQL migrations for MySQL syntax
- Use appropriate charset for email fields
- Consider MySQL-specific indexing

## Testing Strategy

### Unit Tests
- Test individual functions and methods
- Mock external dependencies
- Focus on business logic validation

### Integration Tests
- Test API endpoints end-to-end
- Use test database for isolation
- Verify database state changes

### Security Tests
- Test authentication bypass attempts
- Verify password hashing strength
- Check for common vulnerabilities

## Deployment Considerations

### Environment Variables
```bash
# Required environment variables
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://user:pass@host:port/db
EMAIL_API_KEY=your-email-service-key
BCRYPT_ROUNDS=12
```

### Security Headers
```javascript
// Add security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
}));
```

### Performance Monitoring
- Monitor authentication endpoint response times
- Track registration conversion rates
- Alert on authentication failures

This example demonstrates the complete workflow and can be adapted for different tech stacks and requirements. Use it as a learning tool and reference implementation for your own authentication systems.