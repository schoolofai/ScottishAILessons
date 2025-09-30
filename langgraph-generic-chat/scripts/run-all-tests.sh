#!/bin/bash

# Comprehensive Test Runner for LangGraph Generic Chat
# Runs all test types: Unit, Integration, and E2E tests

echo "🧪 LangGraph Generic Chat - Comprehensive Test Runner"
echo "====================================================="

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
UNIT_STATUS=""
INTEGRATION_STATUS=""
E2E_STATUS=""

# Function to run a test suite and track results
run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    local description="$3"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}📋 Running: $suite_name${NC}"
    echo -e "${CYAN}📄 Description: $description${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    TOTAL_SUITES=$((TOTAL_SUITES + 1))

    # Check if script exists
    if [ ! -f "$script_path" ]; then
        echo -e "${RED}❌ Script not found: $script_path${NC}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        case $suite_name in
            "Unit Tests") UNIT_STATUS="❌ SCRIPT NOT FOUND" ;;
            "Integration Tests") INTEGRATION_STATUS="❌ SCRIPT NOT FOUND" ;;
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
            "Unit Tests") UNIT_STATUS="✅ PASSED" ;;
            "Integration Tests") INTEGRATION_STATUS="✅ PASSED" ;;
            "E2E Tests") E2E_STATUS="✅ PASSED" ;;
        esac
    else
        echo -e "${RED}❌ FAILED: $suite_name${NC}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        case $suite_name in
            "Unit Tests") UNIT_STATUS="❌ FAILED" ;;
            "Integration Tests") INTEGRATION_STATUS="❌ FAILED" ;;
            "E2E Tests") E2E_STATUS="❌ FAILED" ;;
        esac
    fi

    echo ""
    echo -e "${CYAN}----------------------------------------${NC}"
    echo ""
}

# Run all test suites in order
run_test_suite "Unit Tests" "$SCRIPT_DIR/run-unit-tests.sh" "Fast tests without external dependencies"

run_test_suite "Integration Tests" "$SCRIPT_DIR/run-integration-tests.sh" "Graph structure and component integration tests"

# Check if backend is running for E2E tests
echo -e "${YELLOW}🔍 Checking backend server for E2E tests...${NC}"
if curl -s http://localhost:2700/docs > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server is running on port 2700${NC}"
    echo ""
    run_test_suite "E2E Tests" "$SCRIPT_DIR/run-e2e-tests.sh" "End-to-end tests against live backend server"
else
    echo -e "${YELLOW}⚠️  Backend server not running - skipping E2E tests${NC}"
    echo -e "${BLUE}ℹ️  To run E2E tests, start the backend with: langgraph dev --port 2700${NC}"
    echo ""
    E2E_STATUS="⚠️ SKIPPED (no backend)"
    # Don't count as failed since this is expected behavior
fi

# Print comprehensive summary
echo ""
echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}🎯 COMPREHENSIVE TEST SUMMARY${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

echo -e "${BLUE}📊 Test Suite Results:${NC}"
echo -e "   🧪 Unit Tests:        $UNIT_STATUS"
echo -e "   🏗️ Integration Tests: $INTEGRATION_STATUS"
echo -e "   🌐 E2E Tests:         $E2E_STATUS"
echo ""

echo -e "${BLUE}📈 Overall Statistics:${NC}"
echo -e "   Total Suites Run: $TOTAL_SUITES"
echo -e "   ${GREEN}Passed: $PASSED_SUITES${NC}"
echo -e "   ${RED}Failed: $FAILED_SUITES${NC}"
echo ""

# Determine overall result
if [ $FAILED_SUITES -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TEST SUITES PASSED!${NC}"
    echo -e "${GREEN}✨ Your codebase is in excellent condition!${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TEST SUITES FAILED${NC}"
    echo -e "${YELLOW}⚠️  Please review the failed tests above${NC}"
    exit 1
fi