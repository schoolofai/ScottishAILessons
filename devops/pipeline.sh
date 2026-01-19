#!/bin/bash
#
# Content Authoring Pipeline - Main Entry Point
#
# This script activates the Python environment and runs the pipeline orchestrator.
#
# Usage:
#   ./pipeline.sh lessons --subject mathematics --level national_5
#   ./pipeline.sh lessons --resume 20260109_143022
#   ./pipeline.sh lessons --subject physics --level higher --dry-run
#   ./pipeline.sh list
#   ./pipeline.sh help
#
# Environment Variables:
#   APPWRITE_ENDPOINT    - Appwrite database endpoint
#   APPWRITE_PROJECT_ID  - Appwrite project ID
#   APPWRITE_API_KEY     - Appwrite API key
#   LANGSMITH_API_KEY    - Optional: LangSmith tracing
#   LANGSMITH_TRACING    - Optional: Enable LangSmith (true/false)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the script directory (devops/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Content Authoring Pipeline v1.0                  ║${NC}"
echo -e "${CYAN}║         Scottish AI Lessons                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed.${NC}"
    echo "Please install Python 3.11+ first."
    exit 1
fi

# Find and activate Python virtual environment
# Priority: claud_author_agent/.venv (agent venv) > project-level venv > system python
VENV_PATH=""

# Check for claud_author_agent virtual environment (preferred for agent imports)
if [ -d "$PROJECT_ROOT/claud_author_agent/.venv" ]; then
    VENV_PATH="$PROJECT_ROOT/claud_author_agent/.venv"
    echo -e "${BLUE}Using claud_author_agent virtual environment${NC}"
elif [ -d "$PROJECT_ROOT/.venv" ]; then
    VENV_PATH="$PROJECT_ROOT/.venv"
    echo -e "${BLUE}Using project virtual environment${NC}"
elif [ -d "$PROJECT_ROOT/venv" ]; then
    VENV_PATH="$PROJECT_ROOT/venv"
    echo -e "${BLUE}Using project virtual environment (venv/)${NC}"
fi

if [ -n "$VENV_PATH" ]; then
    source "$VENV_PATH/bin/activate"
    echo -e "${GREEN}✓ Virtual environment activated${NC}"
else
    echo -e "${YELLOW}Warning: No virtual environment found, using system Python${NC}"
fi

# Check for required environment variables
check_env_var() {
    local var_name=$1
    local is_required=$2

    if [ -z "${!var_name}" ]; then
        if [ "$is_required" = "required" ]; then
            echo -e "${RED}Error: $var_name is not set${NC}"
            return 1
        else
            echo -e "${YELLOW}Warning: $var_name is not set (optional)${NC}"
        fi
    else
        # Mask the value for display
        local masked="${!var_name:0:8}..."
        echo -e "${GREEN}✓ $var_name is set ($masked)${NC}"
    fi
    return 0
}

# Load environment variables from .env files if they exist
load_env_file() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo -e "${BLUE}Loading environment from: $env_file${NC}"
        set -a
        source "$env_file"
        set +a
    fi
}

# Load environment from possible locations
load_env_file "$PROJECT_ROOT/.env"
load_env_file "$PROJECT_ROOT/claud_author_agent/.env"
load_env_file "$SCRIPT_DIR/.env"

echo ""
echo -e "${BLUE}Checking environment variables...${NC}"

# Unset ANTHROPIC_API_KEY to use subscription instead of API key
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}Unsetting ANTHROPIC_API_KEY to use subscription${NC}"
    unset ANTHROPIC_API_KEY
fi
echo -e "${GREEN}✓ Using subscription (ANTHROPIC_API_KEY unset)${NC}"

# Check optional but recommended env vars
check_env_var "APPWRITE_ENDPOINT" "optional"
check_env_var "APPWRITE_PROJECT_ID" "optional"
check_env_var "APPWRITE_API_KEY" "optional"
check_env_var "LANGSMITH_API_KEY" "optional"

echo ""

# Handle special commands before passing to Python
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "${BLUE}Running: python3 $SCRIPT_DIR/pipeline_runner.py help${NC}"
    echo ""
    python3 "$SCRIPT_DIR/pipeline_runner.py" help
    exit 0
fi

if [ -z "$1" ]; then
    echo -e "${YELLOW}No command specified.${NC}"
    echo ""
    echo "Available commands:"
    echo "  lessons    Run course creation pipeline"
    echo "  list       List all pipeline runs"
    echo "  help       Show detailed help"
    echo ""
    echo "Examples:"
    echo "  ./pipeline.sh lessons --subject mathematics --level national_5"
    echo "  ./pipeline.sh lessons --resume 20260109_143022"
    echo "  ./pipeline.sh list"
    echo ""
    exit 0
fi

# Run the Python orchestrator
echo -e "${BLUE}Running pipeline orchestrator...${NC}"
echo ""

cd "$PROJECT_ROOT"
python3 "$SCRIPT_DIR/pipeline_runner.py" "$@"
EXIT_CODE=$?

# Exit with the same code as Python
exit $EXIT_CODE
