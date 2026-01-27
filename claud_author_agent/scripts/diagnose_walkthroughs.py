#!/usr/bin/env python3
"""Diagnostic script to check walkthrough matching issues.

This script compares:
1. What question numbers are stored in us_walkthroughs
2. What question numbers the frontend expects from us_papers
3. Identifies any mismatches

Usage:
    python scripts/diagnose_walkthroughs.py --paper-id appmath-nh-2025-X844-76-01
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.paper_extractor import fetch_paper, extract_questions_from_paper


async def diagnose_walkthroughs(paper_id: str, mcp_config_path: str = ".mcp.json"):
    """Diagnose walkthrough matching issues for a paper.

    Args:
        paper_id: The paper document ID
        mcp_config_path: Path to MCP config
    """
    print(f"\n{'='*70}")
    print(f"WALKTHROUGH DIAGNOSTIC")
    print(f"{'='*70}")
    print(f"Paper ID: {paper_id}")
    print()

    # 1. Fetch the paper
    print("1. Fetching paper from Appwrite...")
    paper = await fetch_paper(paper_id, mcp_config_path)

    if not paper:
        print(f"   ❌ ERROR: Paper not found with ID: {paper_id}")
        return

    actual_paper_id = paper.get("$id")
    print(f"   ✅ Paper found")
    print(f"   Document $id: {actual_paper_id}")
    print(f"   Subject: {paper.get('subject')}")
    print(f"   Level: {paper.get('level')}")
    print(f"   Year: {paper.get('year')}")
    print(f"   Paper code: {paper.get('paper_code')}")
    print()

    # 2. Extract questions from paper
    print("2. Extracting questions from paper data...")
    paper_data_str = paper.get("data", "{}")
    if isinstance(paper_data_str, str):
        paper_data = json.loads(paper_data_str)
    else:
        paper_data = paper_data_str

    questions = extract_questions_from_paper(paper_data)
    questions_with_solutions = [q for q in questions if q.has_solution]

    print(f"   Total questions: {len(questions)}")
    print(f"   Questions with solutions: {len(questions_with_solutions)}")
    print()

    print("   Question numbers (with solutions):")
    for q in questions_with_solutions:
        print(f"      - {q.question_number} ({q.marks} marks)")
    print()

    # 3. Fetch existing walkthroughs
    print("3. Fetching walkthroughs from Appwrite...")

    from src.utils.appwrite_infrastructure import _get_appwrite_client
    from appwrite.services.databases import Databases
    from appwrite.query import Query

    client, _, _, _ = _get_appwrite_client(mcp_config_path)
    databases = Databases(client)

    # Query walkthroughs by paper_id
    result = databases.list_documents(
        database_id="sqa_education",
        collection_id="us_walkthroughs",
        queries=[
            Query.equal("paper_id", actual_paper_id),
            Query.limit(100)
        ]
    )

    walkthroughs = result.get("documents", [])
    print(f"   Found {len(walkthroughs)} walkthroughs for paper_id: {actual_paper_id}")
    print()

    if walkthroughs:
        print("   Walkthrough details:")
        for wt in walkthroughs:
            print(f"      - Q{wt['question_number']}")
            print(f"        Status: {wt.get('status')}")
            print(f"        Document ID: {wt.get('$id')}")
            print(f"        paper_id stored: {wt.get('paper_id')}")
            print()

    # 4. Compare and identify mismatches
    print("4. Analyzing mismatches...")

    expected_questions = {q.question_number for q in questions_with_solutions}
    found_questions = {wt['question_number'] for wt in walkthroughs}
    found_questions_stripped = {q.lstrip('Qq') for q in found_questions}  # Strip Q prefix

    # Also check published status
    published_questions = {
        wt['question_number'] for wt in walkthroughs
        if wt.get('status') == 'published'
    }
    published_questions_stripped = {q.lstrip('Qq') for q in published_questions}

    print(f"   Expected questions (from paper): {len(expected_questions)}")
    print(f"   Found walkthroughs (any status): {len(found_questions)}")
    print(f"   Found walkthroughs (published): {len(published_questions)}")
    print()

    # Missing walkthroughs
    missing = expected_questions - found_questions_stripped
    if missing:
        print(f"   ❌ MISSING walkthroughs ({len(missing)}):")
        for q in sorted(missing):
            print(f"      - Q{q}")
    else:
        print(f"   ✅ All questions have walkthroughs")
    print()

    # Not published walkthroughs
    not_published = found_questions_stripped - published_questions_stripped
    if not_published:
        print(f"   ⚠️  NOT PUBLISHED walkthroughs ({len(not_published)}):")
        for wt in walkthroughs:
            qnum = wt['question_number'].lstrip('Qq')
            if qnum in not_published:
                print(f"      - Q{wt['question_number']} (status: {wt.get('status')})")
    print()

    # 5. Check for Q prefix issues
    print("5. Checking Q prefix consistency...")
    has_q_prefix = [wt['question_number'] for wt in walkthroughs if wt['question_number'].upper().startswith('Q')]
    no_q_prefix = [wt['question_number'] for wt in walkthroughs if not wt['question_number'].upper().startswith('Q')]

    if has_q_prefix:
        print(f"   With Q prefix: {has_q_prefix[:5]}{'...' if len(has_q_prefix) > 5 else ''}")
    if no_q_prefix:
        print(f"   Without Q prefix: {no_q_prefix[:5]}{'...' if len(no_q_prefix) > 5 else ''}")

    if has_q_prefix and no_q_prefix:
        print(f"   ⚠️  INCONSISTENT: Mix of Q prefix and no prefix!")
    elif has_q_prefix:
        print(f"   Note: All walkthroughs use Q prefix")
    else:
        print(f"   Note: No walkthroughs use Q prefix")
    print()

    # 6. Frontend matching simulation
    print("6. Simulating frontend matching...")

    # Frontend strips Q prefix when matching
    frontend_would_find = set()
    for q in expected_questions:
        # Frontend generates question numbers without Q prefix
        # Then checks if walkthrough exists (after stripping Q from walkthrough)
        if q in found_questions_stripped:
            frontend_would_find.add(q)

    frontend_missing = expected_questions - frontend_would_find

    print(f"   Frontend would show as having walkthrough: {len(frontend_would_find)}")
    print(f"   Frontend would show as GRAYED OUT: {len(frontend_missing)}")

    if frontend_missing:
        print(f"\n   Questions that will be GRAYED OUT:")
        for q in sorted(frontend_missing):
            print(f"      - Q{q}")

    print(f"\n{'='*70}")
    print("DIAGNOSTIC COMPLETE")
    print(f"{'='*70}\n")


def main():
    parser = argparse.ArgumentParser(description="Diagnose walkthrough matching issues")
    parser.add_argument(
        "--paper-id",
        required=True,
        help="Paper document ID (e.g., 'appmath-nh-2025-X844-76-01')"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP config file (default: .mcp.json)"
    )

    args = parser.parse_args()
    asyncio.run(diagnose_walkthroughs(args.paper_id, args.mcp_config))


if __name__ == "__main__":
    main()
