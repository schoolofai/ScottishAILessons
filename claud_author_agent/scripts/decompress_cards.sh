#!/bin/bash

#################################################################################
# Decompress Cards Field Script
#
# Purpose: Decompresses the compressed cards field from Appwrite lesson_templates
#          and displays it as formatted JSON with compression statistics
#
# Usage:
#   ./decompress_cards.sh "H4sIAAAAAAAAA..."
#   ./decompress_cards.sh < cards.txt
#
# Requirements:
#   - base64 (GNU or BSD)
#   - gunzip (gzip)
#   - jq (for JSON formatting)
#   - cut, wc, awk (standard Unix utils)
#
# Author: Claude Code
# License: MIT
#################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INDENT="  "
SEPARATOR="═════════════════════════════════════════════════════"

#################################################################################
# Functions
#################################################################################

print_header() {
    echo -e "\n${CYAN}${SEPARATOR}${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}${SEPARATOR}${NC}\n"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

show_usage() {
    cat << EOF
${CYAN}Decompress Cards Field Script${NC}

${GREEN}Usage:${NC}
  $(basename "$0") "<base64_compressed_string>"
  echo "<base64_string>" | $(basename "$0")
  $(basename "$0") < cards.txt

${GREEN}Examples:${NC}
  # From command-line argument
  $(basename "$0") "H4sIAAAAAAAAA..."

  # From file
  $(basename "$0") < compressed_cards.txt

  # Piped input
  cat compressed_cards.txt | $(basename "$0")

${GREEN}Output:${NC}
  - Compression statistics
  - Card count and summary
  - Formatted JSON (pretty-printed with indentation)

${GREEN}Requirements:${NC}
  - base64, gunzip, jq, cut, wc
  - On macOS: install jq with 'brew install jq'
  - On Linux: usually pre-installed

${GREEN}Exit Codes:${NC}
  0 = Success
  1 = Invalid input or decompression error
  2 = Missing dependencies

EOF
}

check_dependencies() {
    local missing_deps=()

    # Check for required commands
    for cmd in base64 gunzip jq cut wc awk; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_info "Install missing tools:"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  brew install jq"
        else
            echo "  sudo apt-get install jq  # Ubuntu/Debian"
            echo "  sudo yum install jq      # RedHat/CentOS"
        fi
        return 2
    fi

    return 0
}

validate_base64() {
    local input=$1

    # Check if string looks like base64 (alphanumeric + / + + + =)
    if ! echo "$input" | grep -qE '^[A-Za-z0-9+/=]+$'; then
        print_error "Input does not look like valid base64"
        print_info "Base64 strings contain only: A-Z, a-z, 0-9, +, /, ="
        return 1
    fi

    # Check padding (should be multiple of 4, allowing up to 2 = at end)
    local len=${#input}
    if (( len % 4 != 0 )); then
        print_error "Base64 length invalid (not multiple of 4)"
        return 1
    fi

    return 0
}

decompress_cards() {
    local compressed=$1

    # Step 1: Validate base64
    if ! validate_base64 "$compressed"; then
        return 1
    fi

    # Step 2: Try to decompress
    local decompressed
    decompressed=$(echo "$compressed" | base64 -d 2>/dev/null | gunzip 2>/dev/null) || {
        print_error "Failed to decompress data (invalid gzip or corrupted)"
        return 1
    }

    # Step 3: Validate JSON
    if ! echo "$decompressed" | jq . > /dev/null 2>&1; then
        print_error "Decompressed data is not valid JSON"
        return 1
    fi

    echo "$decompressed"
    return 0
}

calculate_compression_stats() {
    local compressed=$1
    local decompressed=$2

    local compressed_size=${#compressed}
    local decompressed_size=${#decompressed}

    # Calculate ratio
    local ratio=$(awk "BEGIN {printf \"%.1f\", ($compressed_size / $decompressed_size) * 100}")
    local savings=$(awk "BEGIN {printf \"%.1f\", (1 - $compressed_size / $decompressed_size) * 100}")

    cat << EOF
Base64 size:         $compressed_size characters
Decompressed size:   $decompressed_size characters (approx)
Compression ratio:   ${ratio}%
Space saved:         ${savings}%
EOF
}

extract_card_summary() {
    local cards_json=$1

    # Count cards
    local card_count=$(echo "$cards_json" | jq 'length')
    print_success "Total cards: $card_count"

    # Get unique card types
    local card_types=$(echo "$cards_json" | jq -r '.[] | .card_type' | sort -u | paste -sd "," -)
    print_success "Card types: $card_types"

    # Get card titles
    echo ""
    print_info "Card titles:"
    echo "$cards_json" | jq -r '.[] | "\($ENV.INDENT)(\(.card_number // .card_type)) \(.title // "Untitled")"' | \
        sed 's/^/'"$INDENT"'/'
}

#################################################################################
# Main Script
#################################################################################

main() {
    # Check dependencies
    if ! check_dependencies; then
        return 2
    fi

    # Get input
    local compressed_input=""

    if [ $# -gt 0 ]; then
        # From command line argument
        compressed_input="$1"
    elif ! [ -t 0 ]; then
        # From stdin (piped or redirected)
        compressed_input=$(cat)
    else
        # No input provided
        print_error "No input provided"
        show_usage
        return 1
    fi

    # Trim whitespace
    compressed_input=$(echo "$compressed_input" | xargs)

    if [ -z "$compressed_input" ]; then
        print_error "Empty input"
        return 1
    fi

    print_header "CARDS DECOMPRESSION TOOL"

    # Show input info
    echo -e "${INDENT}Input length: ${#compressed_input} characters"
    echo ""

    # Decompress
    print_section "DECOMPRESSING"

    local decompressed
    if ! decompressed=$(decompress_cards "$compressed_input"); then
        return 1
    fi
    print_success "Decompression successful"

    # Calculate statistics
    print_section "COMPRESSION STATISTICS"
    calculate_compression_stats "$compressed_input" "$decompressed" | sed "s/^/$INDENT/"

    # Extract summary
    print_section "CARDS SUMMARY"
    extract_card_summary "$decompressed"

    # Display formatted JSON
    print_section "FORMATTED JSON"
    echo "$decompressed" | jq . | sed "s/^/$INDENT/"

    # Final summary
    print_section "COMPLETION"
    print_success "Successfully decompressed and formatted cards"
    echo ""

    return 0
}

# Handle help flag
if [ $# -gt 0 ] && { [ "$1" = "-h" ] || [ "$1" = "--help" ]; }; then
    show_usage
    exit 0
fi

# Run main function
main "$@"
exit $?
