#!/bin/bash

# E2E Tests Runner for LangGraph Generic Chat
# Runs end-to-end tests against live backend server

echo "🌐 LangGraph Generic Chat - E2E Tests Runner"
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if backend server is running
echo -e "${YELLOW}🔍 Checking if backend server is running...${NC}"
if ! curl -s http://localhost:2700/docs > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend server is not running on port 2700${NC}"
    echo ""
    echo -e "${YELLOW}To start the backend server, run:${NC}"
    echo "  cd $PROJECT_ROOT"
    echo "  source ../venv/bin/activate"
    echo "  langgraph dev --port 2700"
    echo ""
    echo -e "${YELLOW}Or use the background option:${NC}"
    echo "  langgraph dev --port 2700 &"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Backend server is running on port 2700${NC}"
echo ""

echo -e "${BLUE}🌐 Running E2E Tests${NC}"
echo "==================="
echo ""

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -e "${BLUE}🔧 Running: $test_name${NC}"
    echo "   Command: $test_command"
    echo ""

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if eval "$test_command"; then
        echo ""
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo ""
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    echo ""
    echo "----------------------------------------"
    echo ""
}

# Run E2E tests against live server
run_test "Context Chat Agent E2E Tests" "python tests/e2e_tests/test_context_chat_agent_only.py"

# Print summary
echo ""
echo -e "${BLUE}📊 E2E TEST SUMMARY${NC}"
echo "=================="
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL E2E TESTS PASSED!${NC}"
    echo -e "${BLUE}ℹ️  Backend server on port 2700 is still running${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME E2E TESTS FAILED${NC}"
    echo -e "${BLUE}ℹ️  Backend server on port 2700 is still running${NC}"
    exit 1
fi