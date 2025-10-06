#!/bin/bash

# DiagramScreenshot - Simple Render Script
# Usage: ./render-diagram.sh <input.json> [output.png]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${DIAGRAM_SERVICE_URL:-http://localhost:3001/api/v1/render}"
API_KEY="${DIAGRAM_API_KEY:-dev-api-key-change-in-production}"

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Missing input file${NC}"
    echo ""
    echo "Usage: $0 <input.json> [output.png]"
    echo ""
    echo "Examples:"
    echo "  $0 diagram.json                    # Saves to diagram.png"
    echo "  $0 diagram.json custom-name.png    # Saves to custom-name.png"
    echo ""
    echo "Environment Variables:"
    echo "  DIAGRAM_SERVICE_URL  - API endpoint (default: http://localhost:3001/api/v1/render)"
    echo "  DIAGRAM_API_KEY      - API key (default: dev-api-key-change-in-production)"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-${INPUT_FILE%.json}.png}"

# Validate input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}Error: Input file not found: $INPUT_FILE${NC}"
    exit 1
fi

# Validate JSON
if ! jq empty "$INPUT_FILE" 2>/dev/null; then
    echo -e "${RED}Error: Invalid JSON in input file${NC}"
    exit 1
fi

echo -e "${BLUE}🎨 DiagramScreenshot Renderer${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Input:  ${YELLOW}$INPUT_FILE${NC}"
echo -e "Output: ${YELLOW}$OUTPUT_FILE${NC}"
echo -e "API:    ${YELLOW}$API_URL${NC}"
echo ""

# Make API request
echo -e "${BLUE}📤 Sending render request...${NC}"

RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d @"$INPUT_FILE")

# Check if request was successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
    echo -e "${RED}❌ Render failed${NC}"
    ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')
    echo -e "${RED}Error: $ERROR_MESSAGE${NC}"
    exit 1
fi

# Extract metadata
FORMAT=$(echo "$RESPONSE" | jq -r '.metadata.format // "unknown"')
WIDTH=$(echo "$RESPONSE" | jq -r '.metadata.width // 0')
HEIGHT=$(echo "$RESPONSE" | jq -r '.metadata.height // 0')
SIZE_BYTES=$(echo "$RESPONSE" | jq -r '.metadata.sizeBytes // 0')
RENDER_TIME=$(echo "$RESPONSE" | jq -r '.metadata.renderTimeMs // 0')
ELEMENT_COUNT=$(echo "$RESPONSE" | jq -r '.metadata.elementCount // 0')

echo -e "${GREEN}✅ Render completed in ${RENDER_TIME}ms${NC}"
echo ""
echo -e "${BLUE}📊 Image Details:${NC}"
echo -e "  Format:   $FORMAT"
echo -e "  Size:     ${WIDTH}×${HEIGHT} pixels"
echo -e "  File:     $(numfmt --to=iec-i --suffix=B $SIZE_BYTES 2>/dev/null || echo "${SIZE_BYTES} bytes")"
echo -e "  Elements: $ELEMENT_COUNT"
echo ""

# Decode and save image
echo -e "${BLUE}💾 Saving image...${NC}"
echo "$RESPONSE" | jq -r '.image' | base64 -d > "$OUTPUT_FILE"

# Verify output file
if [ -f "$OUTPUT_FILE" ]; then
    ACTUAL_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
    echo -e "${GREEN}✅ Image saved successfully!${NC}"
    echo -e "   ${GREEN}→ $OUTPUT_FILE${NC} ($(numfmt --to=iec-i --suffix=B $ACTUAL_SIZE 2>/dev/null || echo "${ACTUAL_SIZE} bytes"))"

    # Try to display file info
    FILE_INFO=$(file "$OUTPUT_FILE" 2>/dev/null || echo "")
    if [ ! -z "$FILE_INFO" ]; then
        echo -e "   ${BLUE}ℹ️  $FILE_INFO${NC}"
    fi
else
    echo -e "${RED}❌ Failed to save image${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Done!${NC}"
