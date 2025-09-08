#!/bin/bash

# LangGraph Chat Application Stop Script
# This script stops all servers started by start.sh

echo "🛑 Stopping LangGraph Chat Application..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to find and kill process by port
kill_by_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}Stopping $service_name (port $port)...${NC}"
        echo $pids | xargs kill -TERM 2>/dev/null
        sleep 2
        # Force kill if still running
        echo $pids | xargs kill -KILL 2>/dev/null
        echo -e "${GREEN}✅ $service_name stopped${NC}"
    else
        echo -e "${BLUE}ℹ️  $service_name is not running (port $port)${NC}"
    fi
}

# Function to find and kill processes by name
kill_by_name() {
    local process_name=$1
    local service_name=$2
    
    local pids=$(pgrep -f "$process_name" 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}Stopping $service_name processes...${NC}"
        echo $pids | xargs kill -TERM 2>/dev/null
        sleep 2
        # Force kill if still running
        echo $pids | xargs kill -KILL 2>/dev/null
        echo -e "${GREEN}✅ $service_name processes stopped${NC}"
    else
        echo -e "${BLUE}ℹ️  No $service_name processes found${NC}"
    fi
}

echo -e "${YELLOW}Stopping services...${NC}"
echo ""

# Stop frontend server (port 3000)
kill_by_port 3000 "Frontend server"

# Stop backend server (port 2024)
kill_by_port 2024 "LangGraph backend server"

# Stop any remaining langgraph processes
kill_by_name "langgraph" "LangGraph"

# Stop any remaining npm processes related to the frontend
kill_by_name "npm.*dev" "NPM dev server"
kill_by_name "next.*dev" "Next.js dev server"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}🎉 All services stopped successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Clean up log files if they exist
if [ -f "backend.log" ] || [ -f "frontend.log" ]; then
    echo -e "${YELLOW}Log files available:${NC}"
    [ -f "backend.log" ] && echo -e "${BLUE}  📄 backend.log${NC}"
    [ -f "frontend.log" ] && echo -e "${BLUE}  📄 frontend.log${NC}"
    echo ""
    echo -e "${YELLOW}To clean up logs, run: rm -f *.log${NC}"
fi