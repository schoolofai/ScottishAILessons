#!/bin/bash

# NAT5+ Mock Exam System - Uniqueness Checker
# Checks how many unique exam combinations remain for a course

echo "═══════════════════════════════════════════════════════════"
echo "  NAT5+ MOCK EXAM SYSTEM - UNIQUENESS CHECKER"
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

# Parse arguments
COURSE_ID=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --course-id)
            COURSE_ID="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 --course-id <id> [options]"
            echo ""
            echo "Options:"
            echo "  --course-id <id>  Course ID to check (required)"
            echo "  --verbose, -v     Show detailed information"
            echo ""
            echo "Example:"
            echo "  $0 --course-id my_course_123"
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
echo ""

# Change to author agent directory
cd "$PROJECT_ROOT/claud_author_agent"

# Check virtual environment
if [ ! -d ".venv" ]; then
    echo -e "${RED}❌ Virtual environment not found at claud_author_agent/.venv${NC}"
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Run Python script to check uniqueness
python3 << EOF
import asyncio
import sys
sys.path.insert(0, '.')

async def check_uniqueness():
    try:
        from src.nat5_plus.uniqueness_manager import UniquenessManager
        from src.nat5_plus.sow_topic_extractor import SOWTopicExtractor

        print("\\n${CYAN}────────────────────────────────────────────────────────────${NC}")
        print("${CYAN}📊 Checking uniqueness status...${NC}")
        print("${CYAN}────────────────────────────────────────────────────────────${NC}\\n")

        # Initialize managers
        uniqueness_mgr = UniquenessManager()
        sow_extractor = SOWTopicExtractor()

        # Get existing summaries
        summaries = await uniqueness_mgr.load_existing_summaries("$COURSE_ID")

        # Get available topics
        topics = await sow_extractor.extract_topics("$COURSE_ID")

        print(f"${BLUE}📋 Statistics:${NC}")
        print(f"   • Existing exams: {len(summaries)}")
        print(f"   • Available SOW topics: {len(topics)}")

        if len(summaries) > 0:
            print(f"\\n${BLUE}📝 Existing Exam Summaries:${NC}")
            for idx, summary in enumerate(summaries[:5], 1):
                exam_id = summary.get('exam_id', 'Unknown')
                topic_count = len(summary.get('topic_ids', []))
                print(f"   {idx}. {exam_id} ({topic_count} topics)")

            if len(summaries) > 5:
                print(f"   ... and {len(summaries) - 5} more")

        # Estimate remaining unique combinations
        # This is a simplified estimate - actual uniqueness depends on topic-style combinations
        used_topics = set()
        for summary in summaries:
            for topic in summary.get('topic_ids', []):
                used_topics.add(topic)

        available_topics = set(t.get('topic_id', t.get('topicId', '')) for t in topics)
        unused_topics = available_topics - used_topics

        print(f"\\n${BLUE}📈 Topic Usage:${NC}")
        print(f"   • Total unique topics: {len(available_topics)}")
        print(f"   • Topics used in exams: {len(used_topics)}")
        print(f"   • Unused topics: {len(unused_topics)}")

        # Estimate remaining capacity
        if len(available_topics) > 0:
            usage_percent = (len(used_topics) / len(available_topics)) * 100
            print(f"   • Topic usage: {usage_percent:.1f}%")

            if usage_percent < 50:
                print(f"\\n${GREEN}✅ Good capacity remaining for new unique exams${NC}")
            elif usage_percent < 80:
                print(f"\\n${YELLOW}⚠️  Moderate capacity remaining${NC}")
            else:
                print(f"\\n${RED}⚠️  Limited capacity - consider adding more topics${NC}")

    except ImportError as e:
        print(f"${YELLOW}⚠️  Module not found: {e}${NC}")
        print("${BLUE}   The uniqueness manager may not be implemented yet.${NC}")
    except Exception as e:
        print(f"${RED}❌ Error checking uniqueness: {e}${NC}")

if __name__ == "__main__":
    asyncio.run(check_uniqueness())
EOF

echo ""
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}📋 Recommendations${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""
echo -e "${BLUE}If uniqueness is exhausted, you can:${NC}"
echo "  1. Add more SOW topics to the course"
echo "  2. Archive existing exams to free up combinations"
echo "  3. Use --force-regenerate (may produce similar exams)"
echo ""
