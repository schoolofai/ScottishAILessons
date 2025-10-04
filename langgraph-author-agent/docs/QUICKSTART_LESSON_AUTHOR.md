# Lesson Author Agent - Quick Start

## 🚀 Quick Start (3 steps)

### 1. Start the server

```bash
cd langgraph-author-agent
source venv/bin/activate
langgraph dev --port 2024
```

**Verify**: http://127.0.0.1:2024/ok should return `{"ok":true}`

### 2. Run the example script

```bash
# Author the first lesson (index 0)
python3 example_lesson_author.py 0

# Or author a different lesson
python3 example_lesson_author.py 5  # Sixth lesson
```

### 3. Check outputs

```bash
ls -lh outputs/lesson_templates/
cat outputs/lesson_templates/lesson_000_teach.json
```

---

## 📋 Common Commands

### Server Management

```bash
# Start server
langgraph dev --port 2024

# Start on different port
langgraph dev --port 2025

# Stop server (Ctrl+C or kill process)
lsof -ti:2024 | xargs kill -9
```

### Testing

```bash
# Test with first lesson
python3 example_lesson_author.py 0

# Test with specific lesson type
# Find formative_assessment lesson (usually index 1, 5, 9, etc.)
python3 example_lesson_author.py 1

# Batch process first 5 lessons (create your own script)
for i in {0..4}; do python3 example_lesson_author.py $i; done
```

### Viewing Results

```bash
# List all generated lessons
ls -lh outputs/lesson_templates/

# View a lesson template
cat outputs/lesson_templates/lesson_000_teach.json | jq '.'

# View critic scores
cat outputs/lesson_templates/lesson_000_critics.json | jq '.'

# Count cards in a lesson
cat outputs/lesson_templates/lesson_000_teach.json | jq '.cards | length'
```

### Debugging

```bash
# Check server logs
curl http://127.0.0.1:2024/info

# Validate input JSON
cat data/sow_authored_AOM_nat3.json | jq '.' > /dev/null && echo "✅ Valid"

# Check Appwrite MCP tools
langgraph dev --port 2024 2>&1 | grep "Appwrite MCP tools"
# Should show: "✅ Initialized 55 Appwrite MCP tools"
```

---

## 🎯 Input Format Cheat Sheet

The agent expects **TWO JSON objects separated by a comma**:

```
<SoW Entry JSON>,
<Research Pack JSON>
```

### Minimal SoW Entry Example

```json
{
  "label": "Introduction to Fractions",
  "lesson_type": "teach",
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": ["AS1.2"],
  "estMinutes": 50,
  "engagement_tags": ["fractions", "visual"],
  "accessibility_profile": {
    "dyslexia_friendly": true,
    "plain_language_level": "CEFR_A2"
  }
}
```

### Minimal Research Pack Example

```json
{
  "research_pack_version": 1,
  "subject": "Mathematics",
  "level": "National 3",
  "distilled_data": {
    "assessment_stems": [
      {"stem": "Calculate [fraction] of [quantity]"}
    ],
    "pedagogical_patterns": {
      "misconceptions": [
        {"misconception": "Students add numerators and denominators"}
      ]
    }
  }
}
```

---

## 📊 Output Files Reference

| File | Description |
|------|-------------|
| `lesson_XXX_<type>.json` | **Main output** - LessonTemplate JSON |
| `lesson_XXX_critics.json` | Critic scores summary |
| `sow_entry_input.json` | Parsed SoW entry (in state) |
| `research_pack.json` | Parsed research pack (in state) |
| `Course_data.txt` | SQA data from Appwrite (in state) |

---

## 🔍 LessonTemplate Structure Cheat Sheet

```json
{
  "$id": "unique_id",
  "title": "Lesson title",
  "lesson_type": "teach|independent_practice|formative_assessment|revision",
  "estMinutes": 50,
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": ["AS1.1"],
  "cards": [
    {
      "id": "c1",
      "title": "Card title",
      "explainer": "Detailed explanation...",
      "explainer_plain": "Short sentences. One per line.",
      "cfu": {
        "type": "numeric|mcq|short|structured",
        "stem": "Question text..."
      },
      "rubric": {
        "total_points": 2,
        "criteria": [...]
      },
      "misconceptions": [...]
    }
  ]
}
```

---

## 🐛 Troubleshooting Quick Fixes

### "Connection refused" error

```bash
# Server not running - start it:
langgraph dev --port 2024
```

### "File not found" error

```bash
# Make sure you're in the right directory:
cd langgraph-author-agent
pwd  # Should end with /langgraph-author-agent
```

### "Invalid JSON" error

```bash
# Validate your input files:
cat data/sow_authored_AOM_nat3.json | jq '.' > /dev/null
cat data/research_pack_json_AOM_nat3.txt | jq '.' > /dev/null
```

### "No lesson template generated"

Check critic results - likely missing required fields:

```bash
# View the last run's state
curl -s "http://127.0.0.1:2024/threads/<thread_id>/state" | \
  jq '.values.files["lesson_todos.json"]'
```

### UTF-8 encoding errors

```bash
# Fix encoding in prompt files
cd src
python3 << 'EOF'
for file in ['lesson_author_prompts.py']:
    with open(file, 'rb') as f:
        content = f.read()
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content.decode('windows-1252'))
EOF
```

---

## 💡 Pro Tips

1. **Use LangGraph Studio** for visual debugging: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024

2. **Check critic thresholds** before running:
   - Pedagogical: ≥0.85
   - Assessment: ≥0.90
   - Accessibility: ≥0.90
   - Scottish Context: ≥0.90
   - Coherence: ≥0.85

3. **Batch processing**: Process lessons overnight with error handling:

```python
for i in range(100):
    try:
        run_lesson_author(i)
    except Exception as e:
        print(f"Failed lesson {i}: {e}")
        continue
```

4. **Hot reload**: Server auto-reloads when you edit prompts in `src/lesson_author_prompts.py`

5. **Monitor token usage**: Check LangSmith for detailed token consumption per run

---

## 📚 Full Documentation

For comprehensive documentation, see: **README_LESSON_AUTHOR.md**

Topics covered:
- Architecture deep-dive
- All 8 subagents explained
- Advanced usage patterns
- API reference
- Batch processing
- Integration with SoW Author Agent
- Contributing guidelines

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| Server Health | http://127.0.0.1:2024/ok |
| API Docs | http://127.0.0.1:2024/docs |
| LangGraph Studio | https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024 |
| Implementation Plan | tasks/lesson-author-agent-implementation.md |

---

**Last Updated**: 2025-10-03
