#!/bin/bash

################################################################################
# Test Script for Decompression Tools
#
# This script tests both bash and python decompression scripts with sample data
################################################################################

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Testing Decompression Scripts${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"

# Sample compressed cards (a small array with 2 cards)
SAMPLE_COMPRESSED="H4sIALL/82gC/32QT0vDQBDFv8qw50Bo7CmXHkTxKio9lCLr7qS7dP/E2QlVSr67uwmNWsTj/N5j5r3ZnYWSpF/D4N+QRAurCmbCnz3mWSSWxFnKnC27iT3NrIWXoJGyI2gbDnBPUrGNIRUzfvRO2jAtFYsChD1hwsDQ5x0JYgcSTibmxeVyN2T7WVyOe/VecGL0ZdwayWATrOpmU3js53Mt7MSDdF1hj8OS99lY0mI/jhVc12yua37H/Vn07kJbuI0+J/6/5tZgALUYu6X1ybIBNghJegSNIXobJEeqwMV4hFyrqDkeUsF//WISrfr9D6tMeYiTdCghb+o1RIKmXm/EOO6/AK9rOAPeAQAA"

echo -e "${YELLOW}Sample compressed cards:${NC}"
echo -e "  ${SAMPLE_COMPRESSED}\n"

# Test 1: Bash script
echo -e "${BLUE}--- Test 1: Bash Script ---${NC}"
if command -v jq &> /dev/null; then
    if "$SCRIPT_DIR/decompress_cards.sh" "$SAMPLE_COMPRESSED" > /tmp/bash_output.txt 2>&1; then
        echo -e "${GREEN}✓ Bash script executed successfully${NC}"
        if grep -q "FORMATTED JSON" /tmp/bash_output.txt; then
            echo -e "${GREEN}✓ Output contains formatted JSON${NC}"
        else
            echo -e "${RED}✗ Output missing formatted JSON${NC}"
        fi
    else
        echo -e "${RED}✗ Bash script failed${NC}"
    fi
else
    echo -e "${YELLOW}⊘ Skipping bash test (jq not installed)${NC}"
fi

echo ""

# Test 2: Python script
echo -e "${BLUE}--- Test 2: Python Script ---${NC}"
if command -v python3 &> /dev/null; then
    if python3 "$SCRIPT_DIR/decompress_cards.py" --no-color "$SAMPLE_COMPRESSED" > /tmp/python_output.txt 2>&1; then
        echo -e "${GREEN}✓ Python script executed successfully${NC}"
        if grep -q "FORMATTED JSON" /tmp/python_output.txt; then
            echo -e "${GREEN}✓ Output contains formatted JSON${NC}"
        else
            echo -e "${RED}✗ Output missing formatted JSON${NC}"
        fi
    else
        echo -e "${RED}✗ Python script failed${NC}"
    fi
else
    echo -e "${YELLOW}⊘ Skipping python test (python3 not found)${NC}"
fi

echo ""

# Test 3: Error handling
echo -e "${BLUE}--- Test 3: Error Handling ---${NC}"

if "$SCRIPT_DIR/decompress_cards.sh" "invalid_base64!!!" > /tmp/error_test.txt 2>&1; then
    echo -e "${RED}✗ Should have failed on invalid base64${NC}"
else
    echo -e "${GREEN}✓ Correctly rejected invalid base64${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"

echo -e "Output files saved to:"
echo -e "  ${YELLOW}/tmp/bash_output.txt${NC}"
echo -e "  ${YELLOW}/tmp/python_output.txt${NC}"
echo -e "  ${YELLOW}/tmp/error_test.txt${NC}"
echo ""
echo -e "View full output:"
echo -e "  cat /tmp/bash_output.txt"
echo -e "  cat /tmp/python_output.txt"
echo ""
