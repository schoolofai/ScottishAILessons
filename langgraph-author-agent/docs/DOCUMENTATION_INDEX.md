# Lesson Author Agent - Documentation Index

## 📚 Documentation Overview

This directory contains complete documentation for the **Lesson Author Agent**, a LangGraph DeepAgent that generates publication-ready LessonTemplate JSON documents for Scottish secondary education.

---

## 🗂️ Documentation Structure

### For First-Time Users

1. **START HERE**: [`QUICKSTART_LESSON_AUTHOR.md`](./QUICKSTART_LESSON_AUTHOR.md)
   - 3-step quick start guide
   - Common commands cheat sheet
   - Troubleshooting quick fixes
   - **Estimated reading time**: 5 minutes

### For Developers & Power Users

2. **COMPREHENSIVE GUIDE**: [`README_LESSON_AUTHOR.md`](./README_LESSON_AUTHOR.md)
   - Architecture deep-dive (DeepAgent pattern, 8 subagents)
   - Complete input/output format specifications
   - Workflow explanations with critic thresholds
   - Advanced usage (batch processing, custom thresholds)
   - API reference
   - Integration with SoW Author Agent
   - Contributing guidelines
   - **Estimated reading time**: 30-45 minutes

### For Implementation Details

3. **IMPLEMENTATION PLAN**: [`../tasks/lesson-author-agent-implementation.md`](../tasks/lesson-author-agent-implementation.md)
   - Detailed technical specification
   - Subagent configurations
   - Prompt engineering guidelines
   - LessonTemplate schema
   - Critic evaluation criteria
   - **Estimated reading time**: 60+ minutes (technical reference)

---

## 🚀 Quick Access by Use Case

### "I just want to run the agent"

→ Go to [`QUICKSTART_LESSON_AUTHOR.md`](./QUICKSTART_LESSON_AUTHOR.md)

```bash
# 1. Start server
langgraph dev --port 2024

# 2. Run example (in new terminal)
python3 example_lesson_author.py 0

# 3. View output
cat outputs/lesson_templates/lesson_000_teach.json
```

### "I need to understand the input format"

→ Go to [`README_LESSON_AUTHOR.md#input-format`](./README_LESSON_AUTHOR.md#input-format)

Key sections:
- **SoW Entry Structure**: Lines 70-110
- **Research Pack Structure**: Lines 112-145
- **Example Workflow**: Lines 450-520

### "I want to customize the agent"

→ Go to [`README_LESSON_AUTHOR.md#advanced-usage`](./README_LESSON_AUTHOR.md#advanced-usage)

Key topics:
- Adding new subagents
- Modifying prompts
- Changing LLM model
- Custom critic thresholds
- Batch processing

### "I'm debugging an error"

→ Go to [`QUICKSTART_LESSON_AUTHOR.md#troubleshooting-quick-fixes`](./QUICKSTART_LESSON_AUTHOR.md#troubleshooting-quick-fixes)

Common issues:
- Connection refused
- Invalid JSON
- UTF-8 encoding errors
- Missing lesson templates
- Appwrite MCP tools not available

### "I need to integrate with existing systems"

→ Go to [`README_LESSON_AUTHOR.md#integration-with-sow-author-agent`](./README_LESSON_AUTHOR.md#integration-with-sow-author-agent)

Integration patterns:
- SoW → Lesson workflow
- Updating SoW with lesson template IDs
- Batch processing complete SoWs

---

## 📁 File Structure

```
langgraph-author-agent/
├── docs/                            # 📚 Documentation directory
│   ├── DOCUMENTATION_INDEX.md       # This file - documentation hub
│   ├── README_LESSON_AUTHOR.md      # Comprehensive documentation
│   └── QUICKSTART_LESSON_AUTHOR.md  # Quick start guide
│
├── example_lesson_author.py         # Runnable example script
│
├── src/
│   ├── lesson_author_agent.py       # Main agent implementation
│   ├── lesson_author_prompts.py     # All 7 prompt templates
│   └── lesson_author_state.py       # Custom state schema
│
├── data/
│   ├── sow_authored_AOM_nat3.json   # Example SoW document
│   ├── research_pack_json_AOM_nat3.txt   # Example research pack
│   └── ...                          # Other data files
│
├── outputs/
│   └── lesson_templates/            # Generated lesson templates
│       ├── lesson_000_teach.json
│       ├── lesson_000_critics.json
│       └── ...
│
├── tasks/
│   └── lesson-author-agent-implementation.md   # Implementation plan
│
└── langgraph.json                   # Graph configuration
```

---

## 🎯 Core Concepts Summary

### What is the Lesson Author Agent?

A **LangGraph DeepAgent** that:
- Takes a single SoW entry + research pack as input
- Orchestrates 8 specialized subagents
- Produces a publication-ready LessonTemplate JSON
- Ensures Scottish CfE/SQA alignment

### 8 Subagents

1. **research_subagent** - Clarification questions
2. **course_outcome_subagent** - Fetch SQA data
3. **lesson_author_subagent** - Draft lesson template
4. **pedagogical_design_critic** - I-We-You progression (≥0.85)
5. **assessment_design_critic** - CFU/rubric quality (≥0.90)
6. **accessibility_critic** - Plain language, dyslexia-friendly (≥0.90)
7. **scottish_context_critic** - £, local examples, SQA terms (≥0.90)
8. **coherence_critic** - SoW alignment (≥0.85)

### Input Format

**Dual JSON**: `<SoW Entry>,\n<Research Pack>`

### Output Format

**LessonTemplate JSON** with:
- Metadata (title, lesson_type, estMinutes)
- 3-5 pedagogical cards
- CFUs (numeric, MCQ, short, structured)
- Rubrics with point allocations
- Misconception identification

---

## 🔗 External Resources

| Resource | Link |
|----------|------|
| LangGraph Documentation | https://langchain-ai.github.io/langgraph/ |
| DeepAgents Pattern | https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#deep-agents |
| Gemini 2.5-pro | https://ai.google.dev/gemini-api/docs |
| Scottish CfE | https://education.gov.scot/curriculum-for-excellence/ |
| SQA National 3 | https://www.sqa.org.uk/sqa/47911.html |
| Appwrite MCP | https://appwrite.io/ |

---

## 📊 Documentation Coverage Matrix

| Topic | Quickstart | README | Implementation Plan |
|-------|:----------:|:------:|:-------------------:|
| **Installation** | ✅ | ✅ | ❌ |
| **Quick Start** | ✅ | ✅ | ❌ |
| **Input Format** | ⚠️ Basic | ✅ Complete | ✅ Schema |
| **Output Format** | ⚠️ Basic | ✅ Complete | ✅ Schema |
| **Architecture** | ❌ | ✅ | ✅ |
| **Subagents** | ❌ | ✅ | ✅ |
| **Workflow** | ❌ | ✅ | ✅ |
| **API Reference** | ❌ | ✅ | ❌ |
| **Troubleshooting** | ✅ | ✅ | ❌ |
| **Advanced Usage** | ❌ | ✅ | ⚠️ Partial |
| **Integration** | ❌ | ✅ | ⚠️ Partial |
| **Contributing** | ❌ | ✅ | ❌ |

**Legend**: ✅ Full coverage, ⚠️ Partial coverage, ❌ Not covered

---

## 🛠️ Maintenance

### When to Update Documentation

1. **After adding a new subagent**:
   - Update README_LESSON_AUTHOR.md § Architecture
   - Update implementation plan
   - Add example usage

2. **After changing input/output format**:
   - Update README_LESSON_AUTHOR.md § Input/Output Format
   - Update QUICKSTART cheat sheet
   - Update example_lesson_author.py

3. **After fixing a common bug**:
   - Add to QUICKSTART § Troubleshooting
   - Update README_LESSON_AUTHOR.md § Troubleshooting

4. **After adding a new feature**:
   - Document in README_LESSON_AUTHOR.md § Advanced Usage
   - Add example to example_lesson_author.py if applicable
   - Update this index

### Documentation Standards

- **Markdown format**: Use GitHub-flavored markdown
- **Code blocks**: Always specify language (```bash, ```python, ```json)
- **Headings**: Use proper hierarchy (# → ## → ###)
- **Examples**: Prefer complete, runnable examples over snippets
- **Links**: Use relative links for internal docs, absolute for external

---

## 📝 Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-03 | 1.0 | Initial documentation suite created |
|  |  | - README_LESSON_AUTHOR.md (comprehensive guide) |
|  |  | - QUICKSTART_LESSON_AUTHOR.md (quick reference) |
|  |  | - DOCUMENTATION_INDEX.md (this file) |
|  |  | - example_lesson_author.py (runnable example) |

---

## 🤝 Contributing

Found a typo or want to improve the documentation?

1. Edit the relevant file
2. Test any code examples
3. Ensure markdown renders correctly
4. Update this index if needed
5. Commit with descriptive message

---

## 📞 Support

- **Issues**: https://github.com/schoolofai/ScottishAILessons/issues
- **Implementation Questions**: See implementation plan
- **Usage Questions**: Start with QUICKSTART, then README

---

**Last Updated**: 2025-10-03
**Documentation Version**: 1.0
**Agent Version**: 1.0
