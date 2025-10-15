#!/usr/bin/env python3
"""
Syntactical Correctness Test for Refactored Prompts

Tests that the prompt assembly functions work without errors
and that all layer files can be loaded successfully.

This ensures the prompts won't throw errors when used by
seedAuthoredSOW.ts or other scripts.
"""

import sys
from pathlib import Path

# Add src to path for imports
src_path = Path(__file__).parent / 'src'
sys.path.insert(0, str(src_path))

from sow_author_prompts import (
    assemble_sow_prompt,
    assemble_critic_prompt,
    SOW_AGENT_PROMPT_DEFAULT,
    SOW_AGENT_PROMPT_SCHEMA,
    SOW_AGENT_PROMPT_FULL,
    SOW_AGENT_PROMPT_FIRST_TIME,
    CRITIC_PROMPT_DEFAULT,
    CRITIC_PROMPT_FULL,
    CRITIC_PROMPT_DETAILED,
)


def test_file_existence():
    """Test that all layer files exist."""
    print("=" * 70)
    print("TEST 1: File Existence")
    print("=" * 70)

    base_dir = src_path

    # SOW Author layers
    sow_layers = [
        'prompts/layers/critical.md',
        'prompts/layers/core.md',
        'prompts/layers/schema_ref.md',
        'prompts/layers/quality.md',
    ]

    # Critic layers
    critic_layers = [
        'prompts/critic/critical.md',
        'prompts/critic/dimensions_core.md',
        'prompts/critic/dimensions/coverage.md',
        'prompts/critic/dimensions/sequencing.md',
        'prompts/critic/dimensions/policy.md',
        'prompts/critic/dimensions/accessibility.md',
        'prompts/critic/dimensions/authenticity.md',
    ]

    # Pattern libraries
    pattern_files = [
        'patterns/chunking.md',
        'patterns/cfu_strategies.md',
        'patterns/scottish_contexts.md',
    ]

    # Schema files
    schema_files = [
        'schemas/sow_schema.md',
        'schemas/lesson_card_schema.md',
        'schemas/research_pack_schema.md',
    ]

    all_files = sow_layers + critic_layers + pattern_files + schema_files

    missing_files = []
    for file_path in all_files:
        full_path = base_dir / file_path
        if not full_path.exists():
            missing_files.append(file_path)
            print(f"❌ MISSING: {file_path}")
        else:
            print(f"✅ EXISTS: {file_path}")

    if missing_files:
        print(f"\n❌ TEST FAILED: {len(missing_files)} file(s) missing")
        return False
    else:
        print(f"\n✅ TEST PASSED: All {len(all_files)} files exist")
        return True


def test_sow_prompt_assembly():
    """Test SOW prompt assembly functions."""
    print("\n" + "=" * 70)
    print("TEST 2: SOW Prompt Assembly")
    print("=" * 70)

    modes = ['default', 'schema', 'full', 'first_time']
    results = []

    for mode in modes:
        try:
            prompt = assemble_sow_prompt(mode=mode)

            # Verify it's a string
            assert isinstance(prompt, str), f"Prompt is not a string: {type(prompt)}"

            # Verify it's not empty
            assert len(prompt) > 0, "Prompt is empty"

            # Estimate token count (rough: words * 1.3)
            words = len(prompt.split())
            estimated_tokens = int(words * 1.3)

            print(f"✅ Mode '{mode}': {len(prompt)} chars, ~{words} words, ~{estimated_tokens} tokens")
            results.append(True)

        except Exception as e:
            print(f"❌ Mode '{mode}' FAILED: {e}")
            results.append(False)

    if all(results):
        print(f"\n✅ TEST PASSED: All {len(modes)} SOW assembly modes work")
        return True
    else:
        print(f"\n❌ TEST FAILED: {sum(not r for r in results)} mode(s) failed")
        return False


def test_critic_prompt_assembly():
    """Test Critic prompt assembly functions."""
    print("\n" + "=" * 70)
    print("TEST 3: Critic Prompt Assembly")
    print("=" * 70)

    modes = ['default', 'full', 'detailed']
    results = []

    for mode in modes:
        try:
            prompt = assemble_critic_prompt(mode=mode)

            # Verify it's a string
            assert isinstance(prompt, str), f"Prompt is not a string: {type(prompt)}"

            # Verify it's not empty
            assert len(prompt) > 0, "Prompt is empty"

            # Estimate token count
            words = len(prompt.split())
            estimated_tokens = int(words * 1.3)

            print(f"✅ Mode '{mode}': {len(prompt)} chars, ~{words} words, ~{estimated_tokens} tokens")
            results.append(True)

        except Exception as e:
            print(f"❌ Mode '{mode}' FAILED: {e}")
            results.append(False)

    if all(results):
        print(f"\n✅ TEST PASSED: All {len(modes)} Critic assembly modes work")
        return True
    else:
        print(f"\n❌ TEST FAILED: {sum(not r for r in results)} mode(s) failed")
        return False


def test_pre_assembled_prompts():
    """Test pre-assembled prompt constants."""
    print("\n" + "=" * 70)
    print("TEST 4: Pre-Assembled Prompt Constants")
    print("=" * 70)

    prompts = {
        'SOW_AGENT_PROMPT_DEFAULT': SOW_AGENT_PROMPT_DEFAULT,
        'SOW_AGENT_PROMPT_SCHEMA': SOW_AGENT_PROMPT_SCHEMA,
        'SOW_AGENT_PROMPT_FULL': SOW_AGENT_PROMPT_FULL,
        'SOW_AGENT_PROMPT_FIRST_TIME': SOW_AGENT_PROMPT_FIRST_TIME,
        'CRITIC_PROMPT_DEFAULT': CRITIC_PROMPT_DEFAULT,
        'CRITIC_PROMPT_FULL': CRITIC_PROMPT_FULL,
        'CRITIC_PROMPT_DETAILED': CRITIC_PROMPT_DETAILED,
    }

    results = []

    for name, prompt in prompts.items():
        try:
            # Verify it's a string
            assert isinstance(prompt, str), f"Prompt is not a string: {type(prompt)}"

            # Verify it's not empty
            assert len(prompt) > 0, "Prompt is empty"

            # Estimate token count
            words = len(prompt.split())
            estimated_tokens = int(words * 1.3)

            print(f"✅ {name}: {len(prompt)} chars, ~{words} words, ~{estimated_tokens} tokens")
            results.append(True)

        except Exception as e:
            print(f"❌ {name} FAILED: {e}")
            results.append(False)

    if all(results):
        print(f"\n✅ TEST PASSED: All {len(prompts)} pre-assembled prompts valid")
        return True
    else:
        print(f"\n❌ TEST FAILED: {sum(not r for r in results)} prompt(s) failed")
        return False


def test_prompt_content_sanity():
    """Sanity check: verify prompts contain expected keywords."""
    print("\n" + "=" * 70)
    print("TEST 5: Prompt Content Sanity Checks")
    print("=" * 70)

    results = []

    # Test SOW prompt contains critical keywords
    sow_prompt = SOW_AGENT_PROMPT_DEFAULT
    sow_keywords = [
        'SoW Author',
        'research_pack_json',
        'Course_data.txt',
        'authored_sow_json',
        'fail-fast',
        'chunking',
        'enrich',  # Check for "enrich" (covers enrichment, enriched, etc.)
    ]

    print("\nSOW Author Prompt Keywords:")
    for keyword in sow_keywords:
        if keyword.lower() in sow_prompt.lower():
            print(f"  ✅ Contains '{keyword}'")
            results.append(True)
        else:
            print(f"  ❌ Missing '{keyword}'")
            results.append(False)

    # Test Critic prompt contains critical keywords
    critic_prompt = CRITIC_PROMPT_DEFAULT
    critic_keywords = [
        'Unified SoW Critic',
        'Coverage',
        'Sequencing',
        'Policy',
        'Accessibility',
        'Authenticity',
        'threshold',
        'sow_critic_result_json',
    ]

    print("\nCritic Prompt Keywords:")
    for keyword in critic_keywords:
        if keyword.lower() in critic_prompt.lower():
            print(f"  ✅ Contains '{keyword}'")
            results.append(True)
        else:
            print(f"  ❌ Missing '{keyword}'")
            results.append(False)

    if all(results):
        print(f"\n✅ TEST PASSED: All expected keywords found")
        return True
    else:
        print(f"\n❌ TEST FAILED: {sum(not r for r in results)} keyword(s) missing")
        return False


def main():
    """Run all syntactical correctness tests."""
    print("\n" + "=" * 70)
    print("REFACTORED PROMPTS - SYNTACTICAL CORRECTNESS TEST")
    print("=" * 70)
    print("Purpose: Ensure prompts can be loaded without errors")
    print("Scope: File existence, assembly functions, pre-assembled constants")
    print("=" * 70 + "\n")

    test_results = []

    # Run all tests
    test_results.append(("File Existence", test_file_existence()))
    test_results.append(("SOW Prompt Assembly", test_sow_prompt_assembly()))
    test_results.append(("Critic Prompt Assembly", test_critic_prompt_assembly()))
    test_results.append(("Pre-Assembled Prompts", test_pre_assembled_prompts()))
    test_results.append(("Content Sanity Checks", test_prompt_content_sanity()))

    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    for test_name, passed in test_results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")

    all_passed = all(result for _, result in test_results)

    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 ALL TESTS PASSED - Prompts are syntactically correct!")
        print("=" * 70)
        print("\nThe refactored prompts are ready for use in seedAuthoredSOW.ts")
        return 0
    else:
        failed_count = sum(not result for _, result in test_results)
        print(f"❌ {failed_count} TEST(S) FAILED - Please fix errors above")
        print("=" * 70)
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
