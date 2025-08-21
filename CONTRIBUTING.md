# Contributing to Claude Code Command Template

Thank you for your interest in contributing! This document outlines the process for contributing to this project.

## 🤝 How to Contribute

### Reporting Issues

1. **Search existing issues** to avoid duplicates
2. **Use issue templates** when available
3. **Provide detailed information**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Claude Code version)
   - Relevant command outputs or error messages

### Suggesting Features

1. **Check existing feature requests** to avoid duplicates
2. **Use the feature request template**
3. **Provide context**:
   - Use case description
   - How it fits the workflow
   - Potential implementation approach

### Code Contributions

#### Setup Development Environment

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/your-username/claude-command-template.git
   cd claude-command-template
   ```

2. **Install Claude Code** following [official documentation](https://docs.anthropic.com/en/docs/claude-code)

3. **Test the commands** work in your environment:
   ```bash
   # Test creating a sample PRD
   echo "# Test Feature\nSimple test feature" > test-brief.md
   # Then use: /create-prd test-brief.md
   ```

#### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow the project workflow**:
   - Use the existing command structure in `.claude/commands/`
   - Test your changes with real examples
   - Update documentation as needed

3. **Test your changes**:
   - Create a test feature using your modified commands
   - Verify the entire workflow works end-to-end
   - Test edge cases and error conditions

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new command functionality"
   ```

#### Pull Request Process

1. **Update documentation** if needed:
   - README.md for user-facing changes
   - Command documentation for new features
   - Add examples in docs/ directory

2. **Create pull request**:
   - Use the PR template
   - Link to related issues
   - Provide clear description of changes

3. **Address review feedback**:
   - Respond to comments promptly
   - Make requested changes
   - Update tests if applicable

## 📝 Development Guidelines

### Command Structure

When creating or modifying Claude commands:

```markdown
---
name: command-name
description: Brief description of what the command does
---

# Command Title

Brief overview of the command's purpose.

## Usage
```
/command-name <arguments>
```

## Implementation
[Detailed implementation steps]

## Output
[Description of expected output]
```

### Documentation Standards

- **Clear and concise** language
- **Step-by-step instructions** where applicable
- **Code examples** for complex concepts
- **Links to relevant resources**

### Testing Approach

- **Manual testing** of command workflows
- **End-to-end scenarios** from brief → implementation
- **Edge case validation** (missing files, invalid input)
- **Documentation accuracy** verification

## 🎯 Contribution Areas

### High Priority
- **Command improvements** - Better error handling, validation
- **Documentation** - More examples, clearer explanations
- **Workflow optimization** - Streamline the development process

### Medium Priority
- **New commands** - Additional workflow automation
- **Integration examples** - Different project types/frameworks
- **Template variations** - Specialized workflows

### Low Priority
- **Aesthetic improvements** - Better formatting, styling
- **Additional tools** - Supporting scripts and utilities

## 📋 Code Review Checklist

Before submitting a PR, ensure:

- [ ] **Commands work** as documented
- [ ] **Examples are tested** and functional
- [ ] **Documentation is updated** for any changes
- [ ] **No sensitive information** is committed
- [ ] **Follows existing patterns** in the codebase
- [ ] **Error cases are handled** gracefully

## 🐛 Bug Report Template

When reporting bugs, please include:

```markdown
**Command/Feature**: [Which command or feature]
**Environment**: [OS, Claude Code version]
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**: [What should happen]
**Actual Behavior**: [What actually happened]
**Error Messages**: [Any error output]
**Additional Context**: [Screenshots, files, etc.]
```

## 💡 Feature Request Template

When suggesting features:

```markdown
**Feature Summary**: [Brief description]
**Use Case**: [Why is this needed]
**Proposed Solution**: [How it might work]
**Alternatives Considered**: [Other options]
**Additional Context**: [Examples, mockups, etc.]
```

## 🏷️ Commit Message Convention

Use conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

Examples:
```
feat: add validation to create-prd command
fix: handle missing PRD file gracefully
docs: update workflow guide with examples
```

## 📞 Getting Help

- **GitHub Issues** - For bugs and feature requests
- **Discussions** - For questions and general discussion
- **Claude Code Docs** - For Claude Code specific help

## 🙏 Recognition

All contributors will be recognized in:
- GitHub contributors page
- Release notes for significant contributions
- Project documentation for major features

Thank you for helping make this project better! 🚀