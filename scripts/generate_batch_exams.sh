#!/bin/bash

# NAT5+ Mock Exam System - Batch Exam Generator
# Generates multiple unique exams for a course

echo "═══════════════════════════════════════════════════════════"
echo "  NAT5+ MOCK EXAM SYSTEM - BATCH EXAM GENERATOR"
echo "═══════════════════════════════════════════════════════════"
echo ""

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

# Default values
COURSE_ID=""
NUM_EXAMS=3
DRY_RUN=false
TARGET_MARKS=90
TARGET_QUESTIONS=15

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --course-id)
            COURSE_ID="$2"
            shift 2
            ;;
        --count)
            NUM_EXAMS="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --target-marks)
            TARGET_MARKS="$2"
            shift 2
            ;;
        --target-questions)
            TARGET_QUESTIONS="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 --course-id <id> [options]"
            echo ""
            echo "Options:"
            echo "  --course-id <id>       Course ID (required)"
            echo "  --count <n>            Number of exams to generate (default: 3)"
            echo "  --dry-run              Generate without upserting to Appwrite"
            echo "  --target-marks <n>     Total marks per exam (default: 90)"
            echo "  --target-questions <n> Questions per exam (default: 15)"
            echo ""
            echo "Example:"
            echo "  $0 --course-id my_course_123 --count 5"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$COURSE_ID" ]; then
    echo -e "${RED}❌ Error: --course-id is required${NC}"
    echo "Run '$0 --help' for usage"
    exit 1
fi

echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo -e "${BLUE}📚 Course ID: $COURSE_ID${NC}"
echo -e "${BLUE}📝 Number of exams: $NUM_EXAMS${NC}"
echo -e "${BLUE}📊 Target marks: $TARGET_MARKS${NC}"
echo -e "${BLUE}📋 Target questions: $TARGET_QUESTIONS${NC}"
echo -e "${BLUE}🔍 Dry run: $DRY_RUN${NC}"
echo ""

# Change to author agent directory
cd "$PROJECT_ROOT/claud_author_agent"

# Check virtual environment
if [ ! -d ".venv" ]; then
    echo -e "${RED}❌ Virtual environment not found at claud_author_agent/.venv${NC}"
    echo "Please create virtual environment first"
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Create workspace directory for batch
BATCH_ID=$(date +%Y%m%d_%H%M%S)
BATCH_DIR="./workspaces/batch_${BATCH_ID}"
mkdir -p "$BATCH_DIR"

echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}📁 Batch workspace: $BATCH_DIR${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""

# Track results
TOTAL=0
SUCCESSFUL=0
FAILED=0

# Generate exams
for i in $(seq 1 $NUM_EXAMS); do
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Generating exam $i of $NUM_EXAMS${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    EXAM_DIR="${BATCH_DIR}/exam_$(printf '%03d' $i)"

    TOTAL=$((TOTAL + 1))

    # Build command
    CMD="python -m src.nat5_plus.exam_generator_client \
        --course-id \"$COURSE_ID\" \
        --workspace \"$EXAM_DIR\" \
        --target-marks $TARGET_MARKS \
        --target-questions $TARGET_QUESTIONS"

    if $DRY_RUN; then
        CMD="$CMD --dry-run"
    fi

    echo -e "${YELLOW}Running: $CMD${NC}"
    echo ""

    # Run generation
    if eval $CMD; then
        echo -e "${GREEN}✅ Exam $i generated successfully${NC}"
        SUCCESSFUL=$((SUCCESSFUL + 1))
    else
        echo -e "${RED}❌ Exam $i generation failed${NC}"
        FAILED=$((FAILED + 1))
    fi

    echo ""

    # Brief pause between generations to ensure uniqueness checks work
    if [ $i -lt $NUM_EXAMS ]; then
        echo -e "${YELLOW}Waiting 3 seconds before next generation...${NC}"
        sleep 3
    fi
done

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    BATCH GENERATION SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total attempted: $TOTAL"
echo -e "${GREEN}Successful: $SUCCESSFUL${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""
echo -e "${BLUE}📁 Output directory: $BATCH_DIR${NC}"
echo ""

# List generated exams
if [ $SUCCESSFUL -gt 0 ]; then
    echo -e "${CYAN}Generated exam workspaces:${NC}"
    ls -la "$BATCH_DIR" 2>/dev/null | grep "exam_" || echo "No exam directories found"
fi

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All exams generated successfully!${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some exams failed to generate. Check logs above.${NC}"
    exit 1
fi
