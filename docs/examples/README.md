# Examples

This directory contains example workflows demonstrating how to use the Claude Code Command Template for different types of features.

## Available Examples

### [User Authentication Example](user-authentication/)
Complete workflow for implementing a user authentication system including:
- High-level brief
- Generated PRD with clarifying questions
- Task list with TDD structure
- Sample implementation files
- Generated documentation

**Tech Stack**: Node.js, Express, JWT, bcrypt, Jest
**Complexity**: Intermediate
**Estimated Time**: 2-3 days

### [API Integration Example](api-integration/)
Workflow for integrating a third-party API service:
- External service integration brief
- PRD with error handling requirements
- Task breakdown for resilient API calls
- Implementation with retry logic
- Comprehensive testing strategy

**Tech Stack**: Node.js, Axios, Redis (caching), Jest
**Complexity**: Beginner-Intermediate
**Estimated Time**: 1-2 days

### [Real-time Features Example](realtime-features/)
Building real-time functionality with WebSockets:
- Live updates feature brief
- PRD with performance considerations
- Task list with scalability planning
- WebSocket implementation
- Load testing and monitoring

**Tech Stack**: Node.js, Socket.IO, Redis, Jest
**Complexity**: Advanced
**Estimated Time**: 3-4 days

## How to Use Examples

### 1. Study the Complete Workflow
Each example shows the entire process from brief → PRD → tasks → implementation → documentation.

### 2. Copy and Adapt
Use examples as templates for similar features in your project:
```bash
# Copy example structure
cp -r docs/examples/user-authentication tasks/my-auth-feature
# Modify the brief for your specific needs
edit tasks/my-auth-feature/brief.md
```

### 3. Learn the Patterns
Pay attention to:
- How briefs are structured
- What clarifying questions are asked
- How tasks are broken down
- TDD implementation approach
- Documentation quality

### 4. Practice the Commands
Try running the commands on the example data:
```bash
# Practice with user auth example
/create-prd docs/examples/user-authentication/brief.md
/generate-tasks docs/examples/user-authentication/
```

## Example Structure

Each example follows this structure:
```
example-name/
├── brief.md              # Original high-level brief
├── prd-example.md         # Generated PRD
├── tasks-prd-example.md   # Generated task list
├── implementation/        # Sample code files
│   ├── src/
│   ├── tests/
│   └── README.md
└── final-documentation.md # Generated docs
```

## Contributing Examples

Want to add your own example? Follow these guidelines:

### 1. Complete Workflow
Include all stages of the workflow:
- [ ] High-level brief
- [ ] Generated PRD (with clarifying Q&A)
- [ ] Task list with TDD structure
- [ ] Sample implementation
- [ ] Generated documentation

### 2. Quality Standards
- [ ] Follow TDD methodology
- [ ] Include comprehensive tests
- [ ] Use realistic scenarios
- [ ] Document any unique aspects

### 3. Different Complexity Levels
We need examples for:
- **Beginner**: Simple CRUD operations, basic integrations
- **Intermediate**: Authentication, complex business logic
- **Advanced**: Real-time features, performance optimization

### 4. Various Tech Stacks
Examples should cover different technologies:
- Frontend: React, Vue, Angular
- Backend: Node.js, Python, Go, Java
- Databases: PostgreSQL, MongoDB, Redis
- Cloud: AWS, Azure, GCP integrations

## Best Practices for Examples

### Realistic Scenarios
Use real-world problems that developers actually face:
✅ "Add two-factor authentication to existing login system"
❌ "Build a todo app"

### Progressive Complexity
Start simple and add complexity:
1. Basic feature implementation
2. Error handling and edge cases
3. Performance optimization
4. Security hardening
5. Monitoring and observability

### Educational Value
Each example should teach something specific:
- User Auth: Security best practices
- API Integration: Resilience patterns
- Real-time: Scalability considerations

### Complete Documentation
Include:
- Setup instructions
- How to run tests
- How to verify functionality
- Common pitfalls and solutions

## Learning Path

### For Beginners
1. Start with **API Integration** example
2. Study the TDD approach
3. Practice with your own simple feature

### For Intermediate Developers
1. Review **User Authentication** example
2. Focus on security patterns
3. Implement a similar auth system

### For Advanced Users
1. Examine **Real-time Features** example
2. Study scalability patterns
3. Build complex distributed features

## Feedback and Improvements

Found an issue with an example? Please:
1. Open an issue with the "example-improvement" label
2. Describe what's unclear or incorrect
3. Suggest specific improvements

Want to contribute an example?
1. Create a PR with the complete workflow
2. Follow the structure and quality guidelines
3. Include tests and documentation

---

These examples are continuously updated based on community feedback and real-world usage patterns.