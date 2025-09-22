#!/bin/bash

# E2E Test Runner for LangGraph SDK Tests
# This script starts the LangGraph backend and runs E2E tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🧪 Running LangGraph SDK E2E Tests"
echo "=================================="

# Get script directory and navigate to langgraph-agent root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LANGGRAPH_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
cd "$LANGGRAPH_DIR"

echo -e "${BLUE}📁 Working directory: $LANGGRAPH_DIR${NC}"

# Check if virtual environment exists
VENV_DIR="../venv"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${RED}❌ Virtual environment not found at $VENV_DIR${NC}"
    echo -e "${YELLOW}Please run: python3 -m venv ../venv && source ../venv/bin/activate && pip install -e . 'langgraph-cli[inmem]'${NC}"
    exit 1
fi

# Activate virtual environment
echo -e "${GREEN}🐍 Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"

# Check if required packages are installed
echo -e "${GREEN}📦 Checking dependencies...${NC}"
if ! pip show langgraph-sdk >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing langgraph-sdk...${NC}"
    pip install langgraph-sdk
fi

if ! pip show httpx >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing httpx...${NC}"
    pip install httpx
fi

if ! pip show pytest-asyncio >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing pytest-asyncio...${NC}"
    pip install pytest-asyncio
fi

# Function to check if backend is running
check_backend() {
    curl -s http://localhost:2024/health >/dev/null 2>&1
}

# Function to wait for backend
wait_for_backend() {
    echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
    for i in {1..60}; do
        if check_backend; then
            echo -e "${GREEN}✅ Backend is ready!${NC}"
            return 0
        fi
        if [ $i -eq 60 ]; then
            echo -e "${RED}❌ Backend failed to start within 60 seconds${NC}"
            return 1
        fi
        sleep 1
    done
}

# Check if backend is already running
if check_backend; then
    echo -e "${GREEN}✅ Backend already running at http://localhost:2024${NC}"
    BACKEND_ALREADY_RUNNING=true
else
    echo -e "${YELLOW}🚀 Starting LangGraph backend...${NC}"
    BACKEND_ALREADY_RUNNING=false

    # Start backend in background
    langgraph dev --host 127.0.0.1 --port 2024 > backend_e2e.log 2>&1 &
    BACKEND_PID=$!

    # Wait for backend to be ready
    if ! wait_for_backend; then
        echo -e "${RED}Backend startup failed. Check backend_e2e.log for details:${NC}"
        tail -20 backend_e2e.log
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
fi

# Function to cleanup
cleanup() {
    if [ "$BACKEND_ALREADY_RUNNING" = false ] && [ ! -z "$BACKEND_PID" ]; then
        echo -e "\n${YELLOW}🛑 Stopping backend server...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Backend stopped${NC}"
    fi
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Run E2E tests
echo -e "${GREEN}🧪 Running E2E tests...${NC}"
echo ""

# Test options
PYTEST_ARGS="-v --tb=short --asyncio-mode=auto"

# Add coverage if requested
if [ "$1" = "--coverage" ]; then
    PYTEST_ARGS="$PYTEST_ARGS --cov=src --cov-report=term-missing"
fi

# Add specific test if requested
if [ ! -z "$2" ]; then
    TEST_PATH="tests/e2e/$2"
else
    TEST_PATH="tests/e2e/"
fi

# Run the tests
echo -e "${BLUE}Running: pytest $PYTEST_ARGS $TEST_PATH${NC}"
echo ""

if pytest $PYTEST_ARGS "$TEST_PATH"; then
    echo ""
    echo -e "${GREEN}=================================="
    echo -e "🎉 All E2E tests passed!"
    echo -e "==================================${NC}"

    if [ -f "backend_e2e.log" ]; then
        echo -e "${BLUE}📄 Backend logs available in: backend_e2e.log${NC}"
    fi

    exit 0
else
    echo ""
    echo -e "${RED}=================================="
    echo -e "❌ Some E2E tests failed"
    echo -e "==================================${NC}"

    if [ -f "backend_e2e.log" ]; then
        echo -e "${YELLOW}📄 Backend logs (last 20 lines):${NC}"
        tail -20 backend_e2e.log
    fi

    exit 1
fi