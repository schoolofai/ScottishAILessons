#!/bin/bash

echo "🎨 Starting Diagram Prototyping Environment..."
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Start dev server on port 3005
echo -e "${GREEN}🚀 Starting prototype server on port 3005...${NC}"
PORT=3005 npm run dev &

# Wait for server
sleep 3
echo -e "${GREEN}✅ Prototype environment ready!${NC}"
echo -e "${BLUE}📍 Local:${NC} http://localhost:3005"
echo ""

# Open browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3005
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3005
    fi
fi

wait
