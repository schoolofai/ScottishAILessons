# Lesson Author Agent Documentation

Welcome to the **Lesson Author Agent** documentation! This directory contains comprehensive guides for using and developing with the Lesson Author Agent.

## 🚀 Getting Started

### New to the Lesson Author Agent?

**Start here**: [`QUICKSTART_LESSON_AUTHOR.md`](./QUICKSTART_LESSON_AUTHOR.md)

Get running in 3 steps:
```bash
# 1. Start server
langgraph dev --port 2024

# 2. Run example (in new terminal)
python3 example_lesson_author.py 0

# 3. View output
cat outputs/lesson_templates/lesson_000_teach.json
```

---

## 📚 Documentation

### Quick Reference

📖 **[QUICKSTART_LESSON_AUTHOR.md](./QUICKSTART_LESSON_AUTHOR.md)** (6KB)
- 3-step quick start
- Common commands cheat sheet
- Troubleshooting quick fixes
- **Read time**: 5 minutes

### Comprehensive Guide

📖 **[README_LESSON_AUTHOR.md](./README_LESSON_AUTHOR.md)** (25KB)
- Architecture deep-dive (DeepAgent pattern, 8 subagents)
- Complete input/output format specifications
- Workflow explanations with critic thresholds
- Advanced usage (batch processing, custom thresholds)
- API reference
- Integration with SoW Author Agent
- Contributing guidelines
- **Read time**: 30-45 minutes

### Navigation Hub

📖 **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** (8KB)
- Documentation overview
- Quick access by use case
- File structure
- Coverage matrix
- Maintenance guide

---

## 🎯 What is the Lesson Author Agent?

The **Lesson Author Agent** is a LangGraph DeepAgent that orchestrates 8 specialized subagents to produce publication-ready **LessonTemplate JSON documents** for Scottish secondary education.

### Key Features

- ✅ **8 Subagents**: Research (1), Data fetching (1), Authoring (1), Critics (5)
- ✅ **LLM-Driven Orchestration**: Gemini 2.5-pro dynamically chooses workflow
- ✅ **Multi-Iteration Critique Loop**: Up to 3 rounds with quality thresholds
- ✅ **Scottish Authenticity**: £ currency, local contexts, SQA terminology
- ✅ **Accessibility**: CEFR plain language levels, dyslexia-friendly design
- ✅ **Dual JSON Input**: SoW entry + research pack

### Input → Output

**Input**: SoW Entry + Research Pack (dual JSON)

**Output**: LessonTemplate JSON with:
- 3-5 pedagogical cards
- Checks for Understanding (CFUs)
- Rubrics with point allocations
- Misconception identification
- Scottish CfE/SQA alignment

---

## 🗺️ Quick Navigation

| I want to... | Go to |
|-------------|-------|
| **Get started quickly** | [QUICKSTART](./QUICKSTART_LESSON_AUTHOR.md) |
| **Understand the architecture** | [README § Architecture](./README_LESSON_AUTHOR.md#architecture) |
| **See input format** | [README § Input Format](./README_LESSON_AUTHOR.md#input-format) |
| **Run the example** | `../example_lesson_author.py 0` |
| **Debug an error** | [QUICKSTART § Troubleshooting](./QUICKSTART_LESSON_AUTHOR.md#troubleshooting-quick-fixes) |
| **Customize the agent** | [README § Advanced Usage](./README_LESSON_AUTHOR.md#advanced-usage) |
| **Integrate with systems** | [README § Integration](./README_LESSON_AUTHOR.md#integration-with-sow-author-agent) |
| **Navigate all docs** | [DOCUMENTATION_INDEX](./DOCUMENTATION_INDEX.md) |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Lesson Author Agent                            │
│                   (Gemini 2.5-pro)                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Research   │   │Course Outcome│   │Lesson Author │
│  Subagent    │   │  Subagent    │   │  Subagent    │
│ (Tavily +    │   │ (Appwrite)   │   │ (Tavily +    │
│  Appwrite)   │   │              │   │  Appwrite)   │
└──────────────┘   └──────────────┘   └──────────────┘
                                              │
                           ┌──────────────────┴────────────────┐
                           │          5 Critic Subagents        │
                           ├──────────────────┬─────────────────┤
                           │ Pedagogical (≥0.85)                │
                           │ Assessment (≥0.90)                 │
                           │ Accessibility (≥0.90)              │
                           │ Scottish Context (≥0.90)           │
                           │ Coherence (≥0.85)                  │
                           └────────────────────────────────────┘
                                              │
                                              ▼
                                   ┌─────────────────┐
                                   │ LessonTemplate  │
                                   │      JSON       │
                                   └─────────────────┘
```

---

## 🔗 External Resources

- **LangGraph Documentation**: https://langchain-ai.github.io/langgraph/
- **DeepAgents Pattern**: https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#deep-agents
- **Gemini 2.5-pro**: https://ai.google.dev/gemini-api/docs
- **Scottish CfE**: https://education.gov.scot/curriculum-for-excellence/
- **SQA National 3**: https://www.sqa.org.uk/sqa/47911.html

---

## 📞 Support

- **Quick Questions**: Start with [QUICKSTART](./QUICKSTART_LESSON_AUTHOR.md)
- **Deep Dive**: See [README_LESSON_AUTHOR](./README_LESSON_AUTHOR.md)
- **Issues**: https://github.com/schoolofai/ScottishAILessons/issues
- **Implementation Details**: `../tasks/lesson-author-agent-implementation.md`

---

**Last Updated**: 2025-10-03
**Documentation Version**: 1.0
**Agent Version**: 1.0
