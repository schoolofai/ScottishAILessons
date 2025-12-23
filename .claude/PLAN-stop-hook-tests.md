# Plan: Stop Hook for Automated Test Running

## Overview

Implement a Stop hook that automatically runs tests after Claude completes a request. If tests fail, the hook provides clear feedback so Claude can fix the issues before the git check runs.

## Current State

- **Existing Hook**: `~/.claude/stop-hook-git-check.sh` runs on Stop event
- **Problem**: Tests aren't run automatically, so failures may go unnoticed
- **Goal**: Run tests first, then git check. If tests fail, Claude should fix them.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Completes Request                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Stop Hook Triggered                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              1. Run Tests (stop-hook-run-tests.sh)           │
│                                                              │
│   ├─ Detect which components were modified                   │
│   ├─ Run relevant test suites:                               │
│   │   • Frontend Jest (unit tests)                           │
│   │   • langgraph-agent pytest                               │
│   │   • langgraph-generic-chat pytest                        │
│   └─ Exit with code 2 if any tests fail                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              Tests Pass          Tests Fail
                    │                   │
                    ▼                   ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│ 2. Git Check         │    │ Claude receives failure      │
│ (existing script)    │    │ output and fixes the issues  │
└──────────────────────┘    └──────────────────────────────┘
```

## Implementation Plan

### Step 1: Create Test Runner Script

**File**: `~/.claude/hooks/stop-hook-run-tests.sh`

```bash
#!/bin/bash
# Stop hook to run tests for ScottishAILessons project

set -o pipefail

# Read stdin for hook context (contains stop_hook_active flag)
input=$(cat)
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // "false"')
if [[ "$stop_hook_active" = "true" ]]; then
  exit 0
fi

# Configuration
PROJECT_ROOT="/home/user/ScottishAILessons"
FAILED_TESTS=0
TESTS_RUN=0

# Helper function
log() { echo "[test-hook] $1"; }
error() { echo "[test-hook] ❌ $1" >&2; }
success() { echo "[test-hook] ✅ $1"; }

# Skip if not in the project directory
if [[ ! -d "$PROJECT_ROOT" ]]; then
  exit 0
fi

cd "$PROJECT_ROOT"

# Detect what was modified to run targeted tests
MODIFIED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only)

# --- Frontend Tests ---
if echo "$MODIFIED_FILES" | grep -q "assistant-ui-frontend/"; then
  log "Running Frontend Jest tests..."
  TESTS_RUN=$((TESTS_RUN + 1))

  cd "$PROJECT_ROOT/assistant-ui-frontend"
  if npm run test:jest 2>&1; then
    success "Frontend tests passed"
  else
    error "Frontend tests FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  cd "$PROJECT_ROOT"
fi

# --- langgraph-agent Tests ---
if echo "$MODIFIED_FILES" | grep -q "langgraph-agent/"; then
  log "Running langgraph-agent tests..."
  TESTS_RUN=$((TESTS_RUN + 1))

  cd "$PROJECT_ROOT/langgraph-agent"
  if source .venv/bin/activate 2>/dev/null && python -m pytest tests/unit_tests/ -v --tb=short 2>&1; then
    success "langgraph-agent tests passed"
  else
    error "langgraph-agent tests FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  cd "$PROJECT_ROOT"
fi

# --- langgraph-generic-chat Tests ---
if echo "$MODIFIED_FILES" | grep -q "langgraph-generic-chat/"; then
  log "Running langgraph-generic-chat tests..."
  TESTS_RUN=$((TESTS_RUN + 1))

  cd "$PROJECT_ROOT/langgraph-generic-chat"
  if source .venv/bin/activate 2>/dev/null && python -m pytest tests/unit_tests/ -v --tb=short 2>&1; then
    success "langgraph-generic-chat tests passed"
  else
    error "langgraph-generic-chat tests FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  cd "$PROJECT_ROOT"
fi

# Summary
if [[ $TESTS_RUN -eq 0 ]]; then
  log "No tests needed for modified files"
  exit 0
fi

if [[ $FAILED_TESTS -gt 0 ]]; then
  error "=== $FAILED_TESTS test suite(s) FAILED ==="
  error "Please fix the failing tests before committing."
  exit 2
fi

success "=== All $TESTS_RUN test suite(s) passed ==="
exit 0
```

### Step 2: Create Combined Stop Hook

**File**: `~/.claude/stop-hook-combined.sh`

```bash
#!/bin/bash
# Combined stop hook: runs tests first, then git check

input=$(cat)

# Run tests first
echo "$input" | ~/.claude/hooks/stop-hook-run-tests.sh
TEST_EXIT=$?

if [[ $TEST_EXIT -ne 0 ]]; then
  # Tests failed - don't proceed to git check
  exit $TEST_EXIT
fi

# Tests passed - run git check
echo "$input" | ~/.claude/stop-hook-git-check.sh
exit $?
```

### Step 3: Update Global Settings

**File**: `~/.claude/settings.json`

```json
{
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "hooks": {
        "Stop": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/stop-hook-combined.sh"
                    }
                ]
            }
        ]
    },
    "permissions": {
        "allow": ["Skill"]
    }
}
```

## Alternative: Project-Level Hook

Instead of modifying global settings, use project-level hooks:

**File**: `/home/user/ScottishAILessons/.claude/settings.json`

```json
{
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "hooks": {
        "Stop": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": ".claude/hooks/stop-hook-run-tests.sh"
                    },
                    {
                        "type": "command",
                        "command": "~/.claude/stop-hook-git-check.sh"
                    }
                ]
            }
        ]
    }
}
```

Note: Multiple hooks in the array run in parallel, so this approach may not guarantee test-before-git-check ordering.

## Key Design Decisions

### 1. Targeted Testing
- Only run tests for modified components (detected via `git diff`)
- Reduces test time from minutes to seconds for focused changes

### 2. Unit Tests Only
- Run only unit tests in the Stop hook (fast, <30 seconds)
- Integration/E2E tests require external services and are too slow

### 3. Exit Codes
| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 2 | Tests failed - Claude should fix |

### 4. Feedback Format
- Clear prefixes: `[test-hook]`, `✅`, `❌`
- Specific error messages Claude can act on
- Test output included so Claude sees exact failures

## Considerations

### Timeout
- Default hook timeout is 60 seconds
- Unit tests should complete within this limit
- If timeout is an issue, run only critical tests

### Dependencies
- Requires `jq` for parsing JSON input
- Requires venvs to be set up in submodules
- Gracefully skips if dependencies missing

### Recursion Prevention
- Uses `stop_hook_active` flag from input
- Prevents infinite loops when Claude fixes tests

## Files to Create/Modify

1. **Create**: `~/.claude/hooks/stop-hook-run-tests.sh`
2. **Create**: `~/.claude/stop-hook-combined.sh`
3. **Modify**: `~/.claude/settings.json` (update Stop hook command)

## Testing the Hook

After implementation:

1. Make a change that breaks a test
2. Let Claude complete a response
3. Verify hook runs and reports failure
4. Verify Claude receives feedback and attempts fix
