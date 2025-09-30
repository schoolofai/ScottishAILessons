#!/bin/bash

# Unit Tests Runner for LangGraph Generic Chat
# Runs all unit tests without external dependencies

echo "🧪 LangGraph Generic Chat - Unit Tests Runner"
echo "============================================="

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
echo -e "${BLUE}🏃‍♂️ Running Unit Tests${NC}"
echo "========================"
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

# Run configuration tests
run_test "Configuration Tests" "python -c \"
import sys
sys.path.append('tests/unit_tests')
from test_configuration import test_context_init, test_context_init_with_env_vars, test_context_init_with_env_vars_and_passed_values
print('🔧 Testing context initialization...')
test_context_init()
print('✅ Basic context initialization passed')
test_context_init_with_env_vars()
print('✅ Environment variable initialization passed')
test_context_init_with_env_vars_and_passed_values()
print('✅ Mixed initialization passed')
print('🎉 All configuration tests passed!')
\""

# Run implementation tests
run_test "Implementation Tests" "python tests/unit_tests/test_implementation.py"

# Print summary
echo ""
echo -e "${BLUE}📊 UNIT TEST SUMMARY${NC}"
echo "===================="
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL UNIT TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME UNIT TESTS FAILED${NC}"
    exit 1
fi