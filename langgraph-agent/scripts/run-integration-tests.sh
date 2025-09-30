#!/bin/bash

# Integration Tests Runner for LangGraph Agent
# Runs core graph integration tests for the three main production graphs:
# - graph_interrupt.py
# - course_manager_graph.py
# - teacher_graph_toolcall_interrupt.py

echo "🔗 LangGraph Agent - Integration Tests Runner"
echo "============================================="

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
SKIPPED_TESTS=0

# Function to run a test file and track results
run_test_file() {
    local test_name="$1"
    local test_path="$2"
    local description="$3"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🔧 Testing: $test_name${NC}"
    echo -e "${BLUE}📄 File: $test_path${NC}"
    echo -e "${BLUE}📝 Description: $description${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Run pytest with detailed output capture
    output=$(python -m pytest "$test_path" -v 2>&1)
    exit_code=$?

    # Parse test results from pytest output
    if echo "$output" | grep -q "passed"; then
        passed=$(echo "$output" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" | head -1)
        PASSED_TESTS=$((PASSED_TESTS + passed))
        TOTAL_TESTS=$((TOTAL_TESTS + passed))
        echo -e "${GREEN}✅ Passed: $passed tests${NC}"
    fi

    if echo "$output" | grep -q "failed"; then
        failed=$(echo "$output" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" | head -1)
        FAILED_TESTS=$((FAILED_TESTS + failed))
        TOTAL_TESTS=$((TOTAL_TESTS + failed))
        echo -e "${RED}❌ Failed: $failed tests${NC}"
        # Show failure details
        echo "$output" | grep -A 5 "FAILED" | head -20
    fi

    if echo "$output" | grep -q "skipped"; then
        skipped=$(echo "$output" | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" | head -1)
        SKIPPED_TESTS=$((SKIPPED_TESTS + skipped))
        echo -e "${YELLOW}⏭️  Skipped: $skipped tests (API dependencies)${NC}"
    fi

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Test file passed successfully${NC}"
    elif [ $exit_code -eq 5 ]; then
        echo -e "${YELLOW}ℹ️  No tests collected (check test discovery)${NC}"
    else
        echo -e "${RED}❌ Test file had failures${NC}"
    fi

    echo ""
}

# Run the three core integration test files
echo -e "${BLUE}🎯 Running Core Graph Integration Tests${NC}"
echo ""

# Test 1: Graph Interrupt Integration
run_test_file \
    "Graph Interrupt Integration" \
    "tests/integration_tests/test_graph_interrupt_integration.py" \
    "Tests for graph_interrupt.py - main orchestrator with course_manager support"

# Test 2: Teacher Toolcall Interrupt Integration
run_test_file \
    "Teacher Toolcall Interrupt Integration" \
    "tests/integration_tests/test_teacher_toolcall_interrupt_integration.py" \
    "Tests for teacher_graph_toolcall_interrupt.py - teaching with UI interrupts"

# Test 3: Course Manager Integration
run_test_file \
    "Course Manager Integration" \
    "tests/test_course_manager_integration.py" \
    "Tests for course_manager_graph.py - lesson recommendation engine"

# Print comprehensive summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 INTEGRATION TEST SUMMARY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}📈 Test Statistics:${NC}"
echo -e "   Total Tests Run: ${TOTAL_TESTS}"
echo -e "   ${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
echo -e "   ${RED}❌ Failed: ${FAILED_TESTS}${NC}"
echo -e "   ${YELLOW}⏭️  Skipped: ${SKIPPED_TESTS} (API dependencies)${NC}"
echo ""

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "${BLUE}📊 Pass Rate: ${PASS_RATE}%${NC}"
    echo ""
fi

# Determine overall result
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL INTEGRATION TESTS PASSED!${NC}"
    echo -e "${GREEN}✨ Core graphs are functioning correctly${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME INTEGRATION TESTS FAILED${NC}"
    echo -e "${YELLOW}⚠️  Please review the failures above${NC}"
    echo -e "${YELLOW}💡 Note: Tests expect current production behavior${NC}"
    exit 1
fi