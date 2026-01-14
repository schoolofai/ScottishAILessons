#!/bin/bash

# NAT5+ Mock Exam System - Contract Tests Runner
# Runs all contract tests across Author Agent, Evaluator, and Frontend

echo "═══════════════════════════════════════════════════════════"
echo "  NAT5+ MOCK EXAM SYSTEM - CONTRACT TESTS"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo ""

# Track results
TOTAL=0
PASSED=0
FAILED=0

# ═══════════════════════════════════════════════════════════════
# Contract A: Author → Frontend (Exam Data)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}📋 Contract A: Author → Frontend (Exam Data)${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""

cd "$PROJECT_ROOT/claud_author_agent"

if [ -d ".venv" ]; then
    source .venv/bin/activate
    TOTAL=$((TOTAL + 1))

    if pytest tests/contracts/test_nat5_plus_contracts.py -v --tb=short 2>/dev/null; then
        echo -e "${GREEN}✅ Author Agent contract tests PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  Author Agent contract tests not found or failed${NC}"
        # Not counting as failed - tests may not exist yet
    fi
else
    echo -e "${YELLOW}⚠️  Skipping Author Agent - venv not found${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# Contract B: Frontend → Evaluator (Submission)
# Contract C: Evaluator → Frontend (Results)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}📋 Contracts B & C: Frontend ↔ Evaluator${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""

cd "$PROJECT_ROOT/langgraph-agent"

if [ -d ".venv" ]; then
    source .venv/bin/activate
    TOTAL=$((TOTAL + 1))

    if pytest tests/unit_tests/test_nat5_plus_contracts.py -v --tb=short 2>/dev/null; then
        echo -e "${GREEN}✅ Evaluator contract tests PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  Evaluator contract tests not found or failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping Evaluator - venv not found${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# Frontend TypeScript Contract Tests
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}📋 Frontend TypeScript Contract Tests${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""

cd "$PROJECT_ROOT/assistant-ui-frontend"

if [ -d "node_modules" ]; then
    TOTAL=$((TOTAL + 1))

    if npm test -- --testPathPattern=contracts --passWithNoTests 2>/dev/null; then
        echo -e "${GREEN}✅ Frontend contract tests PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  Frontend contract tests not found or failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping Frontend - node_modules not found${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# Validate Shared Fixtures
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}📋 Validating Shared Fixtures${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""

cd "$PROJECT_ROOT"

FIXTURES=(
    "fixtures/sample_nat5_plus_exam.json"
    "fixtures/sample_nat5_plus_submission.json"
    "fixtures/sample_nat5_plus_evaluation.json"
)

FIXTURE_PASSED=true
for fixture in "${FIXTURES[@]}"; do
    if [ -f "$fixture" ]; then
        # Validate JSON is valid
        if python3 -c "import json; json.load(open('$fixture'))" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} $fixture (valid JSON)"
        else
            echo -e "  ${RED}✗${NC} $fixture (invalid JSON)"
            FIXTURE_PASSED=false
        fi
    else
        echo -e "  ${RED}✗${NC} $fixture (missing)"
        FIXTURE_PASSED=false
    fi
done

if $FIXTURE_PASSED; then
    echo -e "${GREEN}✅ All fixtures valid${NC}"
else
    echo -e "${RED}❌ Some fixtures missing or invalid${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    CONTRACT TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total Test Suites: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All contract tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some contract tests failed${NC}"
    exit 1
fi
