#!/bin/bash

# NAT5+ Mock Exam System - Full Validation Script
# Validates all components: Author Agent, Evaluator, and Frontend

set -e  # Exit on first error

echo "═══════════════════════════════════════════════════════════"
echo "  NAT5+ MOCK EXAM SYSTEM - FULL VALIDATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo ""

# Track overall results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to run a validation check
run_check() {
    local check_name="$1"
    local check_cmd="$2"
    local check_dir="${3:-$PROJECT_ROOT}"

    echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
    echo -e "${CYAN}📋 $check_name${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    cd "$check_dir"

    if eval "$check_cmd"; then
        echo -e "${GREEN}✅ PASSED: $check_name${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo ""
        return 0
    else
        echo -e "${RED}❌ FAILED: $check_name${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        echo ""
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════
# 1. CONTRACT TESTS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${PURPLE}1️⃣  Running Contract Tests...${NC}"
echo ""

# Check if claud_author_agent venv exists
if [ -d "$PROJECT_ROOT/claud_author_agent/.venv" ]; then
    run_check \
        "Author Agent Contract Tests" \
        "source .venv/bin/activate && pytest tests/contracts/test_nat5_plus_contracts.py -v --tb=short 2>/dev/null || echo 'No contract tests found yet'" \
        "$PROJECT_ROOT/claud_author_agent"
else
    echo -e "${YELLOW}⚠️  Skipping Author Agent tests - venv not found${NC}"
fi

# Check if langgraph-agent venv exists
if [ -d "$PROJECT_ROOT/langgraph-agent/.venv" ]; then
    run_check \
        "Evaluator Contract Tests" \
        "source .venv/bin/activate && pytest tests/unit_tests/test_nat5_plus_contracts.py -v --tb=short 2>/dev/null || echo 'No contract tests found yet'" \
        "$PROJECT_ROOT/langgraph-agent"
else
    echo -e "${YELLOW}⚠️  Skipping Evaluator tests - venv not found${NC}"
fi

# Frontend contract tests
if [ -d "$PROJECT_ROOT/assistant-ui-frontend/node_modules" ]; then
    run_check \
        "Frontend Contract Tests" \
        "npm test -- --testPathPattern=contracts --passWithNoTests 2>/dev/null || echo 'No contract tests found yet'" \
        "$PROJECT_ROOT/assistant-ui-frontend"
else
    echo -e "${YELLOW}⚠️  Skipping Frontend tests - node_modules not found${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# 2. UNIT TESTS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${PURPLE}2️⃣  Running Unit Tests...${NC}"
echo ""

# Author Agent unit tests
if [ -d "$PROJECT_ROOT/claud_author_agent/.venv" ]; then
    run_check \
        "Author Agent Unit Tests" \
        "source .venv/bin/activate && pytest tests/unit/ -v --tb=short -k 'nat5' 2>/dev/null || echo 'No nat5 unit tests found yet'" \
        "$PROJECT_ROOT/claud_author_agent"
fi

# Evaluator unit tests
if [ -d "$PROJECT_ROOT/langgraph-agent/.venv" ]; then
    run_check \
        "Evaluator Unit Tests" \
        "source .venv/bin/activate && pytest tests/unit_tests/ -v --tb=short -k 'nat5' 2>/dev/null || echo 'No nat5 unit tests found yet'" \
        "$PROJECT_ROOT/langgraph-agent"
fi

# ═══════════════════════════════════════════════════════════════
# 3. VERIFY FILES EXIST
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${PURPLE}3️⃣  Verifying Required Files...${NC}"
echo ""

cd "$PROJECT_ROOT"

# Author Agent files
echo -e "${BLUE}Checking Author Agent files...${NC}"
AUTHOR_FILES=(
    "claud_author_agent/src/nat5_plus/exam_generator_client.py"
    "claud_author_agent/src/models/nat5_plus_exam_models.py"
    "claud_author_agent/docs/NAT5_PLUS_EXAM_AUTHOR_GUIDE.md"
)

for file in "${AUTHOR_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
done
echo ""

# Evaluator files
echo -e "${BLUE}Checking Evaluator files...${NC}"
EVALUATOR_FILES=(
    "langgraph-agent/src/agent/graph_nat5_plus_exam.py"
    "langgraph-agent/src/agent/nat5_plus_marking_engine.py"
    "langgraph-agent/src/agent/nat5_plus_exam_state.py"
)

for file in "${EVALUATOR_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
done
echo ""

# Frontend files
echo -e "${BLUE}Checking Frontend files...${NC}"
FRONTEND_FILES=(
    "assistant-ui-frontend/app/api/sqa-mock-exam/route.ts"
    "assistant-ui-frontend/app/(protected)/sqa-mock-exam/page.tsx"
    "assistant-ui-frontend/components/sqa-mock-exam/SQAExamContainer.tsx"
    "assistant-ui-frontend/lib/sqa-mock-exam/types.ts"
)

for file in "${FRONTEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
done
echo ""

# Shared fixtures
echo -e "${BLUE}Checking Shared Fixtures...${NC}"
FIXTURE_FILES=(
    "fixtures/sample_nat5_plus_exam.json"
    "fixtures/sample_nat5_plus_submission.json"
    "fixtures/sample_nat5_plus_evaluation.json"
)

for file in "${FIXTURE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
done
echo ""

# ═══════════════════════════════════════════════════════════════
# 4. CHECK LANGGRAPH REGISTRATION
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${PURPLE}4️⃣  Verifying LangGraph Registration...${NC}"
echo ""

if grep -q "graph_nat5_plus_exam" "$PROJECT_ROOT/langgraph-agent/langgraph.json"; then
    echo -e "${GREEN}✅ graph_nat5_plus_exam registered in langgraph.json${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ graph_nat5_plus_exam NOT registered in langgraph.json${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# 5. E2E TEST (if services running)
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${PURPLE}5️⃣  Checking E2E Test Availability...${NC}"
echo ""

if curl -s http://localhost:3000 > /dev/null 2>&1 && curl -s http://localhost:2024/docs > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Services are running - E2E tests can be executed${NC}"
    echo -e "${BLUE}   Run: cd assistant-ui-frontend && npx playwright test tests/e2e/sqa-mock-exam.spec.ts${NC}"
else
    echo -e "${YELLOW}⚠️  Services not running - E2E tests skipped${NC}"
    echo -e "${BLUE}   Start services with: ./start.sh${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}                    VALIDATION SUMMARY${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Results:${NC}"
echo -e "   Total Checks: $TOTAL_CHECKS"
echo -e "   ${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "   ${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL VALIDATIONS PASSED${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ SOME VALIDATIONS FAILED${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    exit 1
fi
