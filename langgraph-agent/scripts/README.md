# LangGraph Agent Test Scripts

This directory contains automated test runners for the LangGraph Agent project.

## Available Scripts

### 🔗 `run-integration-tests.sh`
Runs core graph integration tests for the three main production graphs:
- `graph_interrupt.py` - Main orchestrator with course_manager support (11 tests)
- `course_manager_graph.py` - Lesson recommendation engine (13 tests)
- `teacher_graph_toolcall_interrupt.py` - Teaching with UI interrupts (3 tests + 7 skipped)

**Expected Results:** 27 passing, 7 skipped (due to OpenAI API requirements)

### 🎯 `run-scoring-tests.sh`
Runs utility and scoring logic tests:
- `test_course_manager_scoring.py` - Priority scoring algorithms
- `test_sow_order_penalty_scoring.py` - Scheme of Work ordering
- `test_transparent_reasoning.py` - Reasoning utilities

### 🧪 `run-all-tests.sh`
Comprehensive test runner that executes all test suites in priority order:
1. Integration tests (most critical)
2. Scoring tests (important for recommendations)
3. E2E tests (optional, requires backend)

## Usage

### Quick Start
```bash
# Make scripts executable (first time only)
chmod +x scripts/*.sh

# Run all tests
./scripts/run-all-tests.sh

# Run specific test suites
./scripts/run-integration-tests.sh
./scripts/run-scoring-tests.sh
```

### Prerequisites
- Python 3.11+
- Virtual environment at `../venv`
- Required packages installed: `pip install -e .`

### Virtual Environment Setup
If you don't have a virtual environment:
```bash
cd ..
python3 -m venv venv
source venv/bin/activate
cd langgraph-agent
pip install -e .
```

## Test Organization

### Integration Tests
Located in `tests/integration_tests/` and `tests/`:
- Focus on graph structure and node interactions
- Test without external API dependencies
- Use node-level testing to avoid LLM requirements

### Scoring Tests
Located in `tests/`:
- Test scoring algorithms and utilities
- Validate recommendation logic
- Ensure penalty calculations are correct

### E2E Tests
Currently cleaned up (deprecated tests removed):
- Would require running backend server
- Test full SDK communication if implemented

## Exit Codes

All scripts follow standard Unix exit codes:
- `0` - All tests passed
- `1` - Some tests failed

This makes them suitable for CI/CD pipelines.

## Color-Coded Output

The scripts use color coding for better readability:
- 🟢 Green - Passed tests
- 🔴 Red - Failed tests
- 🟡 Yellow - Skipped tests or warnings
- 🔵 Blue - Information
- 🟣 Purple - Section headers
- 🟦 Cyan - Dividers

## Notes

- Tests are configured to match current production behavior
- No production code is modified by tests
- Skipped tests are typically due to API key requirements
- The test suite focuses on the three core production graphs