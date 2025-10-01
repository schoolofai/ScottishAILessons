#!/bin/bash

# Research Agent Startup Script
# Starts the LangGraph research agent with Gemini 2.5 Pro

echo "🚀 Starting Research Agent with Gemini 2.5 Pro..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}📁 Working directory: $SCRIPT_DIR${NC}"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${GREEN}🐍 Activating virtual environment...${NC}"
source venv/bin/activate

# Check if dependencies are installed
if ! pip show langchain-google-genai &> /dev/null; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -r requirements.txt
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "${YELLOW}Please create a .env file with your API keys:${NC}"
    echo -e "${BLUE}  GOOGLE_API_KEY=your_api_key_here${NC}"
    echo -e "${BLUE}  TAVILY_API_KEY=your_api_key_here${NC}"
    exit 1
fi

# Start the server with --allow-blocking flag
echo -e "${GREEN}🚀 Starting LangGraph server with Gemini 2.5 Pro...${NC}"
echo ""
echo -e "${YELLOW}Note: Using --allow-blocking flag for Gemini compatibility${NC}"
echo ""

langgraph dev --allow-blocking --port 2025

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ Server stopped${NC}"
echo -e "${GREEN}================================================${NC}"
