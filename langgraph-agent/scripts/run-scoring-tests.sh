#!/bin/bash

# Scoring and Utility Tests Runner for LangGraph Agent
# Runs utility and scoring logic tests that support the core graphs

echo "🎯 LangGraph Agent - Scoring & Utility Tests Runner"
echo "==================================================="

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
echo -e "${PURPLE}🔬 Running Scoring & Utility Tests${NC}"
echo "===================================="
echo ""

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Function to run a test file and track results
run_scoring_test() {
    local test_name="$1"
    local test_path="$2"
    local description="$3"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}🔬 Testing: $test_name${NC}"
    echo -e "${PURPLE}📄 File: $test_path${NC}"
    echo -e "${PURPLE}📝 Description: $description${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Check if test file exists
    if [ ! -f "$test_path" ]; then
        echo -e "${YELLOW}⚠️  Test file not found, skipping...${NC}"
        echo ""
        return
    fi

    # Run pytest with detailed output capture
    output=$(python -m pytest "$test_path" -v 2>&1)
    exit_code=$?

    # Parse test results from pytest output
    if echo "$output" | grep -q "passed"; then
        passed=$(echo "$output" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" | head -1)
        if [ -n "$passed" ]; then
            PASSED_TESTS=$((PASSED_TESTS + passed))
            TOTAL_TESTS=$((TOTAL_TESTS + passed))
            echo -e "${GREEN}✅ Passed: $passed tests${NC}"
        fi
    fi

    if echo "$output" | grep -q "failed"; then
        failed=$(echo "$output" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" | head -1)
        if [ -n "$failed" ]; then
            FAILED_TESTS=$((FAILED_TESTS + failed))
            TOTAL_TESTS=$((TOTAL_TESTS + failed))
            echo -e "${RED}❌ Failed: $failed tests${NC}"
            # Show failure details
            echo "$output" | grep -A 5 "FAILED" | head -20
        fi
    fi

    if echo "$output" | grep -q "skipped"; then
        skipped=$(echo "$output" | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" | head -1)
        if [ -n "$skipped" ]; then
            SKIPPED_TESTS=$((SKIPPED_TESTS + skipped))
            echo -e "${YELLOW}⏭️  Skipped: $skipped tests${NC}"
        fi
    fi

    # Check for specific scoring test patterns
    if echo "$output" | grep -q "score\|penalty\|priority\|weight"; then
        echo -e "${BLUE}📊 Scoring logic tests detected${NC}"
    fi

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Test file passed successfully${NC}"
    elif [ $exit_code -eq 5 ]; then
        echo -e "${YELLOW}ℹ️  No tests collected${NC}"
    else
        echo -e "${RED}❌ Test file had failures${NC}"
    fi

    echo ""
}

# Run the scoring and utility test files
echo -e "${PURPLE}🎯 Running Scoring Algorithm Tests${NC}"
echo ""

# Test 1: Course Manager Scoring
run_scoring_test \
    "Course Manager Scoring" \
    "tests/test_course_manager_scoring.py" \
    "Priority scoring algorithms for lesson recommendations"

# Test 2: SoW Order Penalty Scoring
run_scoring_test \
    "SoW Order Penalty Scoring" \
    "tests/test_sow_order_penalty_scoring.py" \
    "Scheme of Work ordering and penalty calculations"

# Test 3: Transparent Reasoning
run_scoring_test \
    "Transparent Reasoning Utilities" \
    "tests/test_transparent_reasoning.py" \
    "Reasoning and explanation generation utilities"

# Print comprehensive summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}📊 SCORING & UTILITY TEST SUMMARY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}📈 Test Statistics:${NC}"
echo -e "   Total Tests Run: ${TOTAL_TESTS}"
echo -e "   ${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
echo -e "   ${RED}❌ Failed: ${FAILED_TESTS}${NC}"
if [ $SKIPPED_TESTS -gt 0 ]; then
    echo -e "   ${YELLOW}⏭️  Skipped: ${SKIPPED_TESTS}${NC}"
fi
echo ""

# Calculate pass rate if tests were run
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "${BLUE}📊 Pass Rate: ${PASS_RATE}%${NC}"
    echo ""
fi

# Determine overall result
if [ $TOTAL_TESTS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No scoring tests were executed${NC}"
    echo -e "${YELLOW}ℹ️  This may be expected if utility tests are optional${NC}"
    exit 0
elif [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL SCORING TESTS PASSED!${NC}"
    echo -e "${GREEN}✨ Scoring algorithms are functioning correctly${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME SCORING TESTS FAILED${NC}"
    echo -e "${YELLOW}⚠️  Please review the failures above${NC}"
    echo -e "${YELLOW}💡 Scoring logic may need attention${NC}"
    exit 1
fi