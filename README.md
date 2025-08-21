# Claude Code Command Template

A structured workflow template for product development using Claude Code AI assistant. This template provides a systematic approach to go from initial ideas to implementation through PRDs, task lists, and test-driven development.

## 🚀 Quick Start

1. **Use this template** by clicking "Use this template" on GitHub
2. **Set up Claude Code** following the [official documentation](https://docs.anthropic.com/en/docs/claude-code)
3. **Start your workflow** with a high-level brief in the `tasks/` directory

## 📋 Workflow Overview

This template implements a 5-stage development workflow:

```
High-Level Brief → PRD → Task List → Implementation → Documentation
```

### Stage 1: High-Level Brief
Create a simple markdown file describing your feature idea. Use `high-level-brief.example.md` as a template - this file helps you structure your brief with sections for feature details, testing specifications, relevant existing files, code examples, and documentation. You can work with Claude in plan mode (shift+tab in Claude REPL) to develop your ideas, then ask Claude to create a structured high-level brief based on your planning discussion.

### Stage 2: Product Requirements Document (PRD)
Use `/create-prd <brief-file>` to generate a detailed PRD with:
- Goals and user stories
- Functional requirements
- Success metrics
- Technical considerations

### Stage 3: Task Generation
Use `/generate-tasks <prd-directory>` to create implementation tasks following outside-in TDD methodology.

### Stage 4: Implementation
Use `/process-task-list <feature-name>` to execute tasks systematically with test-driven development.

### Stage 5: Documentation
Use `/create-documentation <feature-name>` to generate comprehensive feature documentation.

## 🛠️ Available Commands

| Command | Purpose | Usage |
|---------|---------|-------|
| `/create-prd` | Generate PRD from high-level brief | `/create-prd my-feature-brief.md` |
| `/generate-tasks` | Create task list from PRD | `/generate-tasks my-feature/` |
| `/process-task-list` | Execute tasks with TDD | `/process-task-list my-feature` |
| `/resume-task-list` | Continue from where you left off | `/resume-task-list my-feature` |
| `/create-documentation` | Generate feature documentation | `/create-documentation my-feature` |

## 📁 Directory Structure

```
.
├── .claude/
│   └── commands/              # Claude Code command definitions
│       ├── create-prd.md
│       ├── generate-tasks.md
│       ├── process-task-list.md
│       ├── resume-task-list.md
│       └── create-documentation.md
├── tasks/                     # Feature development workspace
│   └── [feature-name]/
│       ├── brief.md          # High-level feature description
│       ├── prd-[name].md     # Product requirements document
│       ├── tasks-prd-[name].md # Implementation task list
│       └── README.md         # Feature documentation
├── docs/                     # Project documentation
├── high-level-brief.example.md # Template for creating feature briefs
└── README.md                # This file
```

## 🎯 Getting Started Example

1. **Create a feature brief:**
   ```bash
   mkdir -p tasks/user-authentication
   echo "# User Authentication\nImplement secure user login and registration system." > tasks/user-authentication/brief.md
   ```

2. **Generate PRD:**
   ```
   /create-prd tasks/user-authentication/brief.md
   ```

3. **Create task list:**
   ```
   /generate-tasks tasks/user-authentication/
   ```

4. **Start implementation:**
   ```
   /process-task-list user-authentication
   ```

## 🧪 Test-Driven Development

This template emphasizes **Outside-In TDD** methodology:

1. **Acceptance Test (Red)** - Write failing end-to-end test
2. **Bootstrap** - Create minimal structure to compile
3. **Inner Loop** - Unit tests with mocked collaborators
4. **Cascade Inward** - Implement dependencies layer by layer
5. **Acceptance Test (Green)** - Verify end-to-end functionality
6. **Refactor** - Clean up while keeping tests green
7. **Commit** - Complete vertical slice

## 🤝 Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the workflow documented above
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📖 Documentation

- [Workflow Guide](docs/workflow-guide.md) - Detailed workflow explanation
- [Command Usage](docs/command-usage.md) - In-depth command documentation
- [Best Practices](docs/best-practices.md) - PRD and TDD best practices
- [Examples](docs/examples/) - Sample workflows and templates

## 🛡️ Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) AI assistant
- Inspired by modern software development best practices
- Test-driven development methodology guidance

---

**Happy coding with Claude! 🚀**