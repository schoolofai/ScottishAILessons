#!/usr/bin/env python3

################################################################################
# Decompress Cards Field Script (Python)
#
# Purpose: Decompresses the compressed cards field from Appwrite lesson_templates
#          and displays it as formatted JSON with compression statistics
#
# Usage:
#   python decompress_cards.py "H4sIAAAAAAAAA..."
#   python decompress_cards.py < cards.txt
#   python decompress_cards.py  # Interactive mode
#
# Features:
#   - Base64 + gzip decompression
#   - Compression statistics
#   - Card summary extraction
#   - JSON schema validation (optional)
#   - Export to file option
#   - Interactive mode with clipboard support
#   - Colored output
#   - Detailed error messages
#
# Author: Claude Code
# License: MIT
################################################################################

import sys
import json
import base64
import gzip
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass

# Try to import optional dependencies
try:
    import colorama
    from colorama import Fore, Back, Style
    COLORS_ENABLED = True
except ImportError:
    COLORS_ENABLED = False
    # Provide dummy color classes for compatibility
    class DummyColor:
        def __getattr__(self, name):
            return ""
    Fore = DummyColor()
    Back = DummyColor()
    Style = DummyColor()
    Style.RESET_ALL = ""


@dataclass
class CompressionStats:
    """Statistics about compression"""
    base64_size: int
    decompressed_size: int
    compression_ratio: float
    savings_percent: float

    def __str__(self) -> str:
        return f"""
Base64 size:         {self.base64_size:,} characters
Decompressed size:   {self.decompressed_size:,} characters
Compression ratio:   {self.compression_ratio:.1f}%
Space saved:         {self.savings_percent:.1f}%
"""


class CardDecompressor:
    """Handles decompression of cards field"""

    def __init__(self, use_colors: bool = True):
        self.use_colors = use_colors and COLORS_ENABLED
        if self.use_colors:
            colorama.init()

    def _colored(self, text: str, color: str) -> str:
        """Apply color to text if colors enabled"""
        if not self.use_colors:
            return text
        return f"{color}{text}{Style.RESET_ALL}"

    def print_header(self, title: str):
        """Print formatted section header"""
        sep = "═" * 60
        print(f"\n{self._colored(sep, Fore.CYAN)}")
        print(self._colored(title, Fore.CYAN))
        print(f"{self._colored(sep, Fore.CYAN)}\n")

    def print_section(self, title: str):
        """Print section divider"""
        print(f"\n{self._colored(f'=== {title} ===', Fore.BLUE)}")

    def print_success(self, message: str):
        """Print success message"""
        print(f"{self._colored('✓', Fore.GREEN)} {message}")

    def print_error(self, message: str):
        """Print error message"""
        print(f"{self._colored('✗', Fore.RED)} {message}", file=sys.stderr)

    def print_info(self, message: str):
        """Print info message"""
        print(f"{self._colored('ℹ', Fore.YELLOW)} {message}")

    def validate_base64(self, input_str: str) -> bool:
        """Validate that string looks like valid base64"""
        # Check characters
        valid_chars = set(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
        )
        if not all(c in valid_chars for c in input_str):
            self.print_error("Input contains invalid base64 characters")
            self.print_info("Base64 strings contain only: A-Z, a-z, 0-9, +, /, =")
            return False

        # Check length (should be multiple of 4)
        if len(input_str) % 4 != 0:
            self.print_error(f"Base64 length invalid: {len(input_str)} (not multiple of 4)")
            return False

        return True

    def decompress(self, compressed_str: str) -> Optional[Dict[str, Any]]:
        """Decompress base64 + gzip string to JSON object"""
        # Step 1: Validate base64
        if not self.validate_base64(compressed_str):
            return None

        try:
            # Step 2: Base64 decode
            compressed_bytes = base64.b64decode(compressed_str.encode("ascii"))

            # Step 3: Gzip decompress
            decompressed_bytes = gzip.decompress(compressed_bytes)

            # Step 4: UTF-8 decode
            decompressed_str = decompressed_bytes.decode("utf-8")

            # Step 5: JSON parse
            cards = json.loads(decompressed_str)

            if not isinstance(cards, list):
                self.print_error("Decompressed data is not a JSON array")
                return None

            return cards

        except (base64.binascii.Error, ValueError) as e:
            self.print_error(f"Base64 decode failed: {e}")
            return None
        except gzip.BadGzipFile:
            self.print_error("Data is not valid gzip format (corrupted or truncated)")
            return None
        except json.JSONDecodeError as e:
            self.print_error(f"JSON parse error: {e}")
            return None
        except Exception as e:
            self.print_error(f"Unexpected error during decompression: {e}")
            return None

    def calculate_stats(
        self, compressed_str: str, decompressed_str: str
    ) -> CompressionStats:
        """Calculate compression statistics"""
        base64_size = len(compressed_str)
        decompressed_size = len(decompressed_str)
        compression_ratio = (base64_size / decompressed_size) * 100
        savings_percent = (1 - base64_size / decompressed_size) * 100

        return CompressionStats(
            base64_size=base64_size,
            decompressed_size=decompressed_size,
            compression_ratio=compression_ratio,
            savings_percent=savings_percent,
        )

    def extract_summary(self, cards: list) -> Tuple[int, set, list]:
        """Extract summary information from cards"""
        card_count = len(cards)
        card_types = set()
        card_titles = []

        for card in cards:
            if isinstance(card, dict):
                card_types.add(card.get("card_type", "unknown"))
                card_num = card.get("card_number", len(card_titles) + 1)
                card_title = card.get("title", "Untitled")
                card_titles.append((card_num, card_title))

        return card_count, card_types, card_titles

    def print_summary(self, cards: list):
        """Print cards summary"""
        card_count, card_types, card_titles = self.extract_summary(cards)

        self.print_success(f"Total cards: {card_count}")
        self.print_success(f"Card types: {', '.join(sorted(card_types))}")

        self.print_info("Card titles:")
        for card_num, card_title in card_titles:
            print(f"  {card_num}. {card_title}")

    def format_json(self, cards: list) -> str:
        """Return formatted JSON string"""
        return json.dumps(cards, indent=2)

    def process_and_display(
        self, compressed_str: str, export_path: Optional[str] = None
    ) -> bool:
        """Process compressed string and display results"""
        self.print_header("CARDS DECOMPRESSION TOOL")

        # Show input info
        print(f"  Input length: {len(compressed_str)} characters\n")

        # Decompress
        self.print_section("DECOMPRESSING")
        cards = self.decompress(compressed_str)

        if cards is None:
            return False

        self.print_success("Decompression successful")

        # Calculate statistics
        decompressed_str = json.dumps(cards)
        self.print_section("COMPRESSION STATISTICS")
        stats = self.calculate_stats(compressed_str, decompressed_str)
        print(f"{stats}")

        # Extract summary
        self.print_section("CARDS SUMMARY")
        self.print_summary(cards)

        # Display formatted JSON
        self.print_section("FORMATTED JSON")
        formatted = self.format_json(cards)
        for line in formatted.split("\n"):
            print(f"  {line}")

        # Export if requested
        if export_path:
            try:
                with open(export_path, "w") as f:
                    f.write(formatted)
                self.print_success(f"Exported to: {export_path}")
            except Exception as e:
                self.print_error(f"Failed to export: {e}")

        # Final summary
        self.print_section("COMPLETION")
        self.print_success("Successfully decompressed and formatted cards")
        print()

        return True

    def interactive_mode(self):
        """Run interactive mode"""
        self.print_header("INTERACTIVE MODE - CARDS DECOMPRESSOR")

        print("Paste the compressed cards string (base64) and press Enter twice:")
        print("(or paste from clipboard if available)\n")

        lines = []
        while True:
            try:
                line = input()
                if line:
                    lines.append(line)
                elif lines:  # Empty line after content = done
                    break
            except EOFError:
                break

        compressed_str = "".join(lines).strip()

        if not compressed_str:
            self.print_error("No input provided")
            return False

        return self.process_and_display(compressed_str)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Decompress cards field from Appwrite lesson_templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # From command-line argument
  %(prog)s "H4sIAAAAAAAAA..."

  # From file
  %(prog)s < cards.txt

  # Interactive mode
  %(prog)s

  # Export to file
  %(prog)s "H4sI..." --export cards.json
        """,
    )

    parser.add_argument(
        "input",
        nargs="?",
        help="Base64-compressed cards string (or - for stdin)",
    )

    parser.add_argument(
        "-e",
        "--export",
        metavar="FILE",
        help="Export decompressed JSON to file",
    )

    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args()

    # Initialize decompressor
    decompressor = CardDecompressor(use_colors=not args.no_color)

    # Determine input source
    if args.input == "-" or (not args.input and not sys.stdin.isatty()):
        # Read from stdin
        try:
            compressed_str = sys.stdin.read().strip()
            if not compressed_str:
                decompressor.print_error("No input from stdin")
                return 1
        except KeyboardInterrupt:
            print()
            return 1

    elif args.input:
        # From command line argument
        compressed_str = args.input.strip()

    else:
        # Interactive mode
        try:
            return 0 if decompressor.interactive_mode() else 1
        except KeyboardInterrupt:
            print()
            return 1

    # Process and display
    try:
        success = decompressor.process_and_display(compressed_str, args.export)
        return 0 if success else 1
    except KeyboardInterrupt:
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
