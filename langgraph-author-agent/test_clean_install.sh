#!/bin/bash

# Test Clean Installation Script
# This script validates the README installation process

set -e  # Exit on error

echo "🧪 Testing Clean Installation Process"
echo "======================================"
echo ""

# Save current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check if venv exists and remove it for clean test
echo -e "${BLUE}Step 1: Preparing clean environment${NC}"
if [ -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Removing existing venv for clean test...${NC}"
    rm -rf venv
    echo -e "${GREEN}✓ Removed existing venv${NC}"
else
    echo -e "${GREEN}✓ No existing venv found${NC}"
fi
echo ""

# Step 2: Create virtual environment
echo -e "${BLUE}Step 2: Creating virtual environment${NC}"
python3 -m venv venv
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${RED}✗ Failed to create virtual environment${NC}"
    exit 1
fi
echo ""

# Step 3: Activate virtual environment
echo -e "${BLUE}Step 3: Activating virtual environment${NC}"
source venv/bin/activate
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Virtual environment activated${NC}"
    echo -e "  Python: $(which python)"
    echo -e "  Version: $(python --version)"
else
    echo -e "${RED}✗ Failed to activate virtual environment${NC}"
    exit 1
fi
echo ""

# Step 4: Upgrade pip (optional but recommended)
echo -e "${BLUE}Step 4: Upgrading pip${NC}"
pip install --upgrade pip > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Pip upgraded${NC}"
    echo -e "  Pip version: $(pip --version)"
else
    echo -e "${YELLOW}⚠️  Pip upgrade failed (continuing anyway)${NC}"
fi
echo ""

# Step 5: Install package in editable mode
echo -e "${BLUE}Step 5: Installing package with 'pip install -e .'${NC}"
pip install -e . > /tmp/pip_install.log 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Package installed successfully${NC}"
    echo -e "${BLUE}Installed packages:${NC}"
    pip list | grep -E "(langgraph|tavily|deepagents)" | sed 's/^/  /'
else
    echo -e "${RED}✗ Failed to install package${NC}"
    echo -e "${RED}Error log:${NC}"
    tail -20 /tmp/pip_install.log
    exit 1
fi
echo ""

# Step 6: Verify package installation
echo -e "${BLUE}Step 6: Verifying package installation${NC}"
pip show langgraph-author-agent > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Package 'langgraph-author-agent' is installed${NC}"
    pip show langgraph-author-agent | grep -E "(Name|Version|Location)" | sed 's/^/  /'
else
    echo -e "${RED}✗ Package not found${NC}"
    exit 1
fi
echo ""

# Step 7: Verify Python can import the module
echo -e "${BLUE}Step 7: Testing Python imports${NC}"
python -c "from src.prompts import SUB_RESEARCH_PROMPT, SUB_CRITIQUE_PROMPT, RESEARCH_INSTRUCTIONS; print('✓ Imports successful')" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Python imports work correctly${NC}"
else
    echo -e "${YELLOW}⚠️  Package imports failed, trying fallback import...${NC}"
    cd src
    python -c "from prompts import SUB_RESEARCH_PROMPT; print('✓ Fallback import successful')" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Fallback imports work correctly${NC}"
    else
        echo -e "${RED}✗ Both import methods failed${NC}"
        exit 1
    fi
    cd ..
fi
echo ""

# Step 8: Check .env file
echo -e "${BLUE}Step 8: Checking environment configuration${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    if grep -q "TAVILY_API_KEY" .env && grep -q "ANTHROPIC_API_KEY" .env; then
        echo -e "${GREEN}✓ Required API keys are configured${NC}"
    else
        echo -e "${YELLOW}⚠️  .env file exists but may be missing API keys${NC}"
        echo -e "${YELLOW}   Make sure to add TAVILY_API_KEY and ANTHROPIC_API_KEY${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo -e "${YELLOW}   Create .env file with your API keys before running langgraph dev${NC}"
fi
echo ""

# Step 9: Verify langgraph.json configuration
echo -e "${BLUE}Step 9: Verifying LangGraph configuration${NC}"
if [ -f "langgraph.json" ]; then
    echo -e "${GREEN}✓ langgraph.json exists${NC}"
    if grep -q "research_agent.py" langgraph.json; then
        echo -e "${GREEN}✓ Graph configuration is correct${NC}"
    else
        echo -e "${YELLOW}⚠️  langgraph.json may have incorrect graph path${NC}"
    fi
else
    echo -e "${RED}✗ langgraph.json not found${NC}"
    exit 1
fi
echo ""

# Step 10: Test langgraph CLI availability
echo -e "${BLUE}Step 10: Testing LangGraph CLI${NC}"
which langgraph > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ langgraph CLI is available${NC}"
    echo -e "  Location: $(which langgraph)"
else
    echo -e "${RED}✗ langgraph CLI not found${NC}"
    exit 1
fi
echo ""

# Step 11: Test server startup (brief test)
echo -e "${BLUE}Step 11: Testing server startup (brief)${NC}"
echo -e "${YELLOW}Starting server for 5 seconds...${NC}"

# Kill any existing process on port 2024
lsof -ti:2024 | xargs kill -9 2>/dev/null || true
sleep 1

# Start server in background
langgraph dev > /tmp/langgraph_test_startup.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 8

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Server process is running (PID: $SERVER_PID)${NC}"

    # Check if port is listening
    if lsof -ti:2024 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is listening on port 2024${NC}"

        # Try to access the API
        if curl -s http://127.0.0.1:2024/ok > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Server is responding to requests${NC}"
        else
            echo -e "${YELLOW}⚠️  Server may not be fully ready yet${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Server process running but port not listening${NC}"
    fi

    # Check logs for errors
    if grep -i "error" /tmp/langgraph_test_startup.log | grep -v "version_check" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Server logs contain errors:${NC}"
        grep -i "error" /tmp/langgraph_test_startup.log | grep -v "version_check" | tail -5 | sed 's/^/  /'
    else
        echo -e "${GREEN}✓ No errors in server logs${NC}"
    fi

    # Stop server
    echo -e "${YELLOW}Stopping test server...${NC}"
    kill $SERVER_PID 2>/dev/null
    sleep 2
    kill -9 $SERVER_PID 2>/dev/null || true
else
    echo -e "${RED}✗ Server failed to start${NC}"
    echo -e "${RED}Logs:${NC}"
    tail -30 /tmp/langgraph_test_startup.log | sed 's/^/  /'
    exit 1
fi
echo ""

# Summary
echo -e "${GREEN}======================================"
echo -e "✅ All installation steps validated!"
echo -e "======================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Make sure your .env file has valid API keys"
echo -e "2. Run: ${GREEN}langgraph dev${NC}"
echo -e "3. Open: ${GREEN}https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024${NC}"
echo ""
echo -e "${YELLOW}Note: The virtual environment is still activated.${NC}"
echo -e "${YELLOW}To deactivate, run: ${GREEN}deactivate${NC}"
echo ""