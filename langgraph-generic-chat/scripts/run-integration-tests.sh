#!/bin/bash

# Integration Tests Runner for LangGraph Generic Chat
# Runs integration tests that test graph structure and components

echo "🔗 LangGraph Generic Chat - Integration Tests Runner"
echo "=================================================="

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

echo ""
echo -e "${BLUE}🏗️ Running Integration Tests${NC}"
echo "============================"
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

# Run graph structure tests
run_test "Graph Structure Tests" "python -c \"
import sys
sys.path.append('tests/integration_tests')
from test_graph import test_context_chat_agent_graph_structure, test_context_configuration, test_input_state_validation
print('🔧 Testing graph structure...')
test_context_chat_agent_graph_structure()
print('✅ Graph structure tests passed')
test_context_configuration()
print('✅ Context configuration tests passed')
test_input_state_validation()
print('✅ Input state validation tests passed')
print('🎉 All integration tests passed!')
\""

# Print summary
echo ""
echo -e "${BLUE}📊 INTEGRATION TEST SUMMARY${NC}"
echo "============================"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL INTEGRATION TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME INTEGRATION TESTS FAILED${NC}"
    exit 1
fi