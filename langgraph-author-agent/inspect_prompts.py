#!/usr/bin/env python3
"""CLI tool for inspecting and comparing assembled prompts.

Usage:
    python inspect_prompts.py sow              # Preview SOW author prompt
    python inspect_prompts.py critic           # Preview critic prompt
    python inspect_prompts.py compare          # Compare both prompts against legacy
    python inspect_prompts.py snapshot         # Save both prompts to snapshot files
    python inspect_prompts.py diff             # Show detailed differences
    python inspect_prompts.py stats            # Show prompt statistics
"""

import argparse
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from sow_author_prompts import (
    assemble_sow_prompt,
    assemble_critic_prompt,
    compare_prompts,
    preview_prompt,
)


def cmd_preview_sow(args):
    """Preview SOW author prompt."""
    print(f"\n{'=' * 80}")
    print("PREVIEWING SOW AUTHOR PROMPT")
    print(f"{'=' * 80}\n")
    preview_prompt('sow_author', lines=args.lines)


def cmd_preview_critic(args):
    """Preview critic prompt."""
    print(f"\n{'=' * 80}")
    print("PREVIEWING CRITIC PROMPT")
    print(f"{'=' * 80}\n")
    preview_prompt('critic', lines=args.lines)


def cmd_compare(args):
    """Compare assembled prompts against legacy versions."""
    print(f"\n{'=' * 80}")
    print("COMPARING PROMPTS: Assembled vs Legacy")
    print(f"{'=' * 80}\n")

    # Compare SOW author
    print("SOW AUTHOR PROMPT:")
    print("-" * 40)
    sow_metrics = compare_prompts('sow_author', show_diff=args.diff)
    print(f"  Assembled length: {sow_metrics['assembled_length']:,} characters")
    print(f"  Legacy length: {sow_metrics['legacy_length']:,} characters")
    print(f"  Exact match: {'✅ YES' if sow_metrics['match'] else '❌ NO'}")
    if not sow_metrics['match']:
        print(f"  Differing characters: {sow_metrics['diff_chars']:,}")
    print()

    # Compare critic
    print("CRITIC PROMPT:")
    print("-" * 40)
    critic_metrics = compare_prompts('critic', show_diff=args.diff)
    print(f"  Assembled length: {critic_metrics['assembled_length']:,} characters")
    print(f"  Legacy length: {critic_metrics['legacy_length']:,} characters")
    print(f"  Exact match: {'✅ YES' if critic_metrics['match'] else '❌ NO'}")
    if not critic_metrics['match']:
        print(f"  Differing characters: {critic_metrics['diff_chars']:,}")
    print()

    # Overall summary
    print("SUMMARY:")
    print("-" * 40)
    both_match = sow_metrics['match'] and critic_metrics['match']
    if both_match:
        print("✅ Both prompts match legacy versions exactly")
        print("✅ Refactoring preserves all content")
    else:
        print("⚠️  Prompts differ from legacy versions")
        print("⚠️  Review differences before deploying")
    print()


def cmd_snapshot(args):
    """Save both prompts to snapshot files."""
    print(f"\n{'=' * 80}")
    print("SAVING PROMPT SNAPSHOTS")
    print(f"{'=' * 80}\n")

    # Save SOW author
    print("Saving SOW author prompt...")
    sow_prompt = assemble_sow_prompt(save_snapshot=True)
    print(f"✅ SOW author snapshot saved")
    print(f"   Length: {len(sow_prompt):,} characters")
    print()

    # Save critic
    print("Saving critic prompt...")
    critic_prompt = assemble_critic_prompt(save_snapshot=True)
    print(f"✅ Critic prompt snapshot saved")
    print(f"   Length: {len(critic_prompt):,} characters")
    print()

    snapshot_dir = Path(__file__).parent / 'src' / 'prompts' / '.prompt_snapshots'
    print(f"Snapshots saved to: {snapshot_dir}")
    print()


def cmd_diff(args):
    """Show detailed diff between assembled and legacy prompts."""
    print(f"\n{'=' * 80}")
    print("DETAILED DIFF: Assembled vs Legacy")
    print(f"{'=' * 80}\n")

    # Show diff for SOW author
    print("SOW AUTHOR PROMPT DIFF:")
    print("=" * 80)
    compare_prompts('sow_author', show_diff=True)
    print()

    # Show diff for critic
    print("CRITIC PROMPT DIFF:")
    print("=" * 80)
    compare_prompts('critic', show_diff=True)
    print()


def cmd_stats(args):
    """Show prompt statistics."""
    print(f"\n{'=' * 80}")
    print("PROMPT STATISTICS")
    print(f"{'=' * 80}\n")

    # Assemble prompts
    sow_prompt = assemble_sow_prompt()
    critic_prompt = assemble_critic_prompt()

    # Calculate stats
    sow_chars = len(sow_prompt)
    sow_lines = len(sow_prompt.split('\n'))
    sow_words = len(sow_prompt.split())
    sow_tokens_est = int(sow_words * 1.3)  # Rough estimate

    critic_chars = len(critic_prompt)
    critic_lines = len(critic_prompt.split('\n'))
    critic_words = len(critic_prompt.split())
    critic_tokens_est = int(critic_words * 1.3)

    # Display stats
    print("SOW AUTHOR PROMPT:")
    print("-" * 40)
    print(f"  Characters: {sow_chars:,}")
    print(f"  Lines: {sow_lines:,}")
    print(f"  Words: {sow_words:,}")
    print(f"  Estimated tokens: ~{sow_tokens_est:,}")
    print()

    print("CRITIC PROMPT:")
    print("-" * 40)
    print(f"  Characters: {critic_chars:,}")
    print(f"  Lines: {critic_lines:,}")
    print(f"  Words: {critic_words:,}")
    print(f"  Estimated tokens: ~{critic_tokens_est:,}")
    print()

    print("COMBINED:")
    print("-" * 40)
    total_chars = sow_chars + critic_chars
    total_words = sow_words + critic_words
    total_tokens_est = sow_tokens_est + critic_tokens_est
    print(f"  Characters: {total_chars:,}")
    print(f"  Words: {total_words:,}")
    print(f"  Estimated tokens: ~{total_tokens_est:,}")
    print()


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Inspect and compare assembled SOW/Critic prompts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python inspect_prompts.py sow              # Preview SOW author prompt (50 lines)
  python inspect_prompts.py sow --lines 100  # Preview more lines
  python inspect_prompts.py critic           # Preview critic prompt
  python inspect_prompts.py compare          # Compare both against legacy
  python inspect_prompts.py diff             # Show detailed differences
  python inspect_prompts.py snapshot         # Save snapshots to files
  python inspect_prompts.py stats            # Show token/character counts
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # sow command
    sow_parser = subparsers.add_parser('sow', help='Preview SOW author prompt')
    sow_parser.add_argument('--lines', type=int, default=50, help='Number of lines to preview (default: 50)')
    sow_parser.set_defaults(func=cmd_preview_sow)

    # critic command
    critic_parser = subparsers.add_parser('critic', help='Preview critic prompt')
    critic_parser.add_argument('--lines', type=int, default=50, help='Number of lines to preview (default: 50)')
    critic_parser.set_defaults(func=cmd_preview_critic)

    # compare command
    compare_parser = subparsers.add_parser('compare', help='Compare assembled vs legacy prompts')
    compare_parser.add_argument('--diff', action='store_true', help='Show detailed character diff')
    compare_parser.set_defaults(func=cmd_compare)

    # snapshot command
    snapshot_parser = subparsers.add_parser('snapshot', help='Save prompt snapshots')
    snapshot_parser.set_defaults(func=cmd_snapshot)

    # diff command
    diff_parser = subparsers.add_parser('diff', help='Show detailed diff')
    diff_parser.set_defaults(func=cmd_diff)

    # stats command
    stats_parser = subparsers.add_parser('stats', help='Show prompt statistics')
    stats_parser.set_defaults(func=cmd_stats)

    # Parse args and run command
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        args.func(args)
    except FileNotFoundError as e:
        print(f"\n❌ ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
