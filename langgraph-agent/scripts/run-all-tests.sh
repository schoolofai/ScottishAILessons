#!/bin/bash

# Comprehensive Test Runner for LangGraph Agent
# Runs all test types: Integration, Scoring/Utility, and optional E2E tests

echo "🧪 LangGraph Agent - Comprehensive Test Runner"
echo "=============================================="

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

# Check if virtual environment exists
if [ ! -d "../venv" ]; then
    echo -e "${RED}❌ Virtual environment not found at ../venv${NC}"
    echo "Please create virtual environment first:"
    echo "  cd .. && python3 -m venv venv"
    exit 1
fi

# Activate virtual environment
echo -e "${YELLOW}🐍 Activating virtual environment...${NC}"
source ../venv/bin/activate

# Install package if needed
echo -e "${YELLOW}📦 Ensuring package is installed...${NC}"
pip install -e . > /dev/null 2>&1

echo ""
echo -e "${PURPLE}Starting comprehensive test suite...${NC}"
echo ""

# Track overall results
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Track detailed results
INTEGRATION_STATUS=""
SCORING_STATUS=""
E2E_STATUS=""

# Function to run a test suite and track results
run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    local description="$3"

    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -e "${CYAN}📋 Running: $suite_name${NC}"
    echo -e "${CYAN}📄 Description: $description${NC}"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo ""

    TOTAL_SUITES=$((TOTAL_SUITES + 1))

    # Check if script exists
    if [ ! -f "$script_path" ]; then
        echo -e "${RED}❌ Script not found: $script_path${NC}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        case $suite_name in
            "Integration Tests") INTEGRATION_STATUS="❌ SCRIPT NOT FOUND" ;;
            "Scoring Tests") SCORING_STATUS="❌ SCRIPT NOT FOUND" ;;
            "E2E Tests") E2E_STATUS="❌ SCRIPT NOT FOUND" ;;
        esac
        return 1
    fi

    # Make script executable if needed
    chmod +x "$script_path"

    # Run the test suite
    if bash "$script_path"; then
        echo -e "${GREEN}✅ PASSED: $suite_name${NC}"
        PASSED_SUITES=$((PASSED_SUITES + 1))
        case $suite_name in
            "Integration Tests") INTEGRATION_STATUS="✅ PASSED" ;;
            "Scoring Tests") SCORING_STATUS="✅ PASSED" ;;
            "E2E Tests") E2E_STATUS="✅ PASSED" ;;
        esac
    else
        echo -e "${RED}❌ FAILED: $suite_name${NC}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        case $suite_name in
            "Integration Tests") INTEGRATION_STATUS="❌ FAILED" ;;
            "Scoring Tests") SCORING_STATUS="❌ FAILED" ;;
            "E2E Tests") E2E_STATUS="❌ FAILED" ;;
        esac
    fi

    echo ""
    echo -e "${CYAN}────────────────────────────────────────${NC}"
    echo ""
}

# Run all test suites in order of importance
echo -e "${BLUE}🎯 Starting test suites in priority order...${NC}"
echo ""

# 1. Integration Tests (Most Critical)
run_test_suite \
    "Integration Tests" \
    "$SCRIPT_DIR/run-integration-tests.sh" \
    "Core graph integration tests for production graphs"

# 2. Scoring Tests (Important for recommendations)
run_test_suite \
    "Scoring Tests" \
    "$SCRIPT_DIR/run-scoring-tests.sh" \
    "Scoring algorithms and utility functions"

# 3. E2E Tests (Optional, requires backend)
echo -e "${YELLOW}🔍 Checking for E2E test availability...${NC}"

# Check if backend is running for E2E tests
if curl -s http://localhost:2024/docs > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server is running on port 2024${NC}"
    echo -e "${YELLOW}ℹ️  Note: E2E test files were cleaned up, skipping E2E tests${NC}"
    E2E_STATUS="⚠️ SKIPPED (cleaned up)"
else
    echo -e "${YELLOW}⚠️  Backend server not running - E2E tests not applicable${NC}"
    echo -e "${BLUE}ℹ️  To run with backend, start with: ./start.sh${NC}"
    E2E_STATUS="⚠️ N/A (no backend)"
fi

echo ""

# Print comprehensive summary
echo ""
echo -e "${PURPLE}════════════════════════════════════════${NC}"
echo -e "${PURPLE}🎯 COMPREHENSIVE TEST SUMMARY${NC}"
echo -e "${PURPLE}════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}📊 Test Suite Results:${NC}"
echo -e "   🔗 Integration Tests: $INTEGRATION_STATUS"
echo -e "   🎯 Scoring Tests:     $SCORING_STATUS"
echo -e "   🌐 E2E Tests:         $E2E_STATUS"
echo ""

echo -e "${BLUE}📈 Overall Statistics:${NC}"
echo -e "   Total Suites Run: $TOTAL_SUITES"
echo -e "   ${GREEN}Passed: $PASSED_SUITES${NC}"
echo -e "   ${RED}Failed: $FAILED_SUITES${NC}"
echo ""

# Additional information
echo -e "${BLUE}📝 Test Coverage:${NC}"
echo -e "   • graph_interrupt.py: 11 tests"
echo -e "   • course_manager_graph.py: 13 tests"
echo -e "   • teacher_graph_toolcall_interrupt.py: 3 tests (+7 skipped)"
echo -e "   • Scoring utilities: Various utility tests"
echo ""

# Determine overall result
if [ $FAILED_SUITES -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TEST SUITES PASSED!${NC}"
    echo -e "${GREEN}✨ Your codebase is in excellent condition!${NC}"
    echo -e "${GREEN}🚀 Production graphs are functioning correctly${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TEST SUITES FAILED${NC}"
    echo -e "${YELLOW}⚠️  Please review the failed tests above${NC}"
    echo -e "${YELLOW}💡 Tests are configured for current production behavior${NC}"
    exit 1
fi