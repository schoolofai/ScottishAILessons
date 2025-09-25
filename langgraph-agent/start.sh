#!/bin/bash

# LangGraph Chat Application Startup Script
# This script starts both the backend and frontend servers and opens the browser

echo "🚀 Starting LangGraph Chat Application..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Store PIDs globally
BACKEND_PID=""
CONTEXT_CHAT_PID=""
FRONTEND_PID=""

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    
    # Kill backend if running
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${YELLOW}Stopping main backend server...${NC}"
        kill $BACKEND_PID 2>/dev/null
    fi

    # Kill context chat backend if running
    if [ ! -z "$CONTEXT_CHAT_PID" ] && kill -0 $CONTEXT_CHAT_PID 2>/dev/null; then
        echo -e "${YELLOW}Stopping context chat backend server...${NC}"
        kill $CONTEXT_CHAT_PID 2>/dev/null
    fi

    # Kill frontend if running
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${YELLOW}Stopping frontend server...${NC}"
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    # Also kill any remaining jobs
    kill $(jobs -p) 2>/dev/null
    
    echo -e "${GREEN}✅ All servers stopped${NC}"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.11+ first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}📁 Working directory: $SCRIPT_DIR${NC}"
echo ""

# Check if virtual environment exists
if [ ! -d "../venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    cd ..
    python3 -m venv venv
    cd "$SCRIPT_DIR"
fi

# Activate virtual environment and install backend dependencies if needed
echo -e "${GREEN}🐍 Setting up backend...${NC}"
source ../venv/bin/activate

# Check if langgraph is installed
if ! pip show langgraph-cli &> /dev/null; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    pip install -e . "langgraph-cli[inmem]" &> /dev/null
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
fi

# Check if .env file exists
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please add your API keys to .env file if needed${NC}"
fi

# Start backend server
echo -e "${GREEN}🚀 Starting LangGraph backend server...${NC}"
touch backend.log  # Create log file if it doesn't exist
langgraph dev &> backend.log &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for main backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:2024/docs &> /dev/null; then
        echo -e "${GREEN}✅ Main backend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Main backend failed to start. Check backend.log for errors.${NC}"
        exit 1
    fi
    sleep 1
done

# Set up context chat backend
echo -e "${GREEN}🧠 Setting up context chat backend...${NC}"
cd ../langgraph-generic-chat

# Check if langgraph-generic-chat directory exists
if [ ! -d "." ]; then
    echo -e "${RED}❌ langgraph-generic-chat directory not found. Please ensure it exists.${NC}"
    exit 1
fi

# Use the same virtual environment as main backend
source ../venv/bin/activate

# Check if .env file exists for context chat
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo -e "${YELLOW}Creating .env file for context chat from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please add your API keys to langgraph-generic-chat/.env file if needed${NC}"
fi

# Install context chat dependencies if needed
if ! pip show langgraph-cli &> /dev/null; then
    echo -e "${YELLOW}Installing context chat backend dependencies...${NC}"
    pip install -e . "langgraph-cli[inmem]" &> ../langgraph-agent/context-chat-install.log
    echo -e "${GREEN}✅ Context chat backend dependencies installed${NC}"
fi

# Start context chat backend server
echo -e "${GREEN}🚀 Starting context chat backend server...${NC}"
touch ../langgraph-agent/context-chat.log  # Create log file if it doesn't exist
langgraph dev --port 2700 &> ../langgraph-agent/context-chat.log &
CONTEXT_CHAT_PID=$!

# Wait for context chat backend to be ready
echo -e "${YELLOW}Waiting for context chat backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:2700/docs &> /dev/null; then
        echo -e "${GREEN}✅ Context chat backend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Context chat backend failed to start. Check context-chat.log for errors.${NC}"
        exit 1
    fi
    sleep 1
done

# Return to langgraph-agent directory for frontend setup
cd ../langgraph-agent

# Check if frontend dependencies are installed
echo -e "${GREEN}⚛️  Setting up frontend...${NC}"
cd ../assistant-ui-frontend

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install --legacy-peer-deps &> ../langgraph-agent/frontend-install.log
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
fi

# Configure frontend environment for LangGraph
echo -e "${YELLOW}Configuring frontend environment for LangGraph...${NC}"
cp .env.local.langgraph .env.local
echo -e "${GREEN}✅ LangGraph frontend configuration applied${NC}"

# Start frontend server
echo -e "${GREEN}🚀 Starting Assistant-UI frontend...${NC}"
touch ../langgraph-agent/frontend.log  # Create log file if it doesn't exist
npm run dev &> ../langgraph-agent/frontend.log &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo -e "${YELLOW}Waiting for frontend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 &> /dev/null; then
        echo -e "${GREEN}✅ Frontend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start. Check frontend.log for errors.${NC}"
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 Application is running!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}📍 Frontend (Chat UI):${NC} http://localhost:3000"
echo -e "${BLUE}📍 Main Backend API:${NC} http://localhost:2024"
echo -e "${BLUE}📍 Main API Documentation:${NC} http://localhost:2024/docs"
echo -e "${BLUE}📍 Context Chat Backend API:${NC} http://localhost:2700"
echo -e "${BLUE}📍 Context Chat API Documentation:${NC} http://localhost:2700/docs"
echo -e "${BLUE}📍 LangGraph Studio (Main):${NC} https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024"
echo -e "${BLUE}📍 LangGraph Studio (Context Chat):${NC} https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2700"
echo ""

# Open browser
echo -e "${YELLOW}Opening browser...${NC}"
sleep 2

# Detect OS and open browser accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v gnome-open &> /dev/null; then
        gnome-open http://localhost:3000
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    start http://localhost:3000
fi

echo -e "${GREEN}✅ Browser opened${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo -e "${YELLOW}Logs: backend.log, context-chat.log, frontend.log${NC}"
echo ""

# Keep script running
echo -e "${GREEN}Servers are running successfully!${NC}"
echo -e "${YELLOW}To view logs in real-time, open a new terminal and run:${NC}"
echo -e "${BLUE}  tail -f backend.log${NC}         (for main backend logs)"
echo -e "${BLUE}  tail -f context-chat.log${NC}   (for context chat backend logs)"
echo -e "${BLUE}  tail -f frontend.log${NC}       (for frontend logs)"
echo ""
echo -e "${YELLOW}The application will keep running until you press Ctrl+C${NC}"
echo ""

# Optional: Show last few lines of logs
if [ -f "backend.log" ] || [ -f "context-chat.log" ] || [ -f "frontend.log" ]; then
    echo -e "${GREEN}Recent log entries:${NC}"

    if [ -f "backend.log" ]; then
        echo -e "${BLUE}--- Main Backend (last 3 lines) ---${NC}"
        tail -3 backend.log 2>/dev/null || echo "No main backend logs yet"
        echo ""
    fi

    if [ -f "context-chat.log" ]; then
        echo -e "${BLUE}--- Context Chat Backend (last 3 lines) ---${NC}"
        tail -3 context-chat.log 2>/dev/null || echo "No context chat backend logs yet"
        echo ""
    fi

    if [ -f "frontend.log" ]; then
        echo -e "${BLUE}--- Frontend (last 3 lines) ---${NC}"
        tail -3 frontend.log 2>/dev/null || echo "No frontend logs yet"
        echo ""
    fi
fi

# Keep the script running
while true; do
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Main backend server has stopped unexpectedly${NC}"
        cleanup
        exit 1
    fi
    if ! kill -0 $CONTEXT_CHAT_PID 2>/dev/null; then
        echo -e "${RED}❌ Context chat backend server has stopped unexpectedly${NC}"
        cleanup
        exit 1
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Frontend server has stopped unexpectedly${NC}"
        cleanup
        exit 1
    fi
    sleep 5
done