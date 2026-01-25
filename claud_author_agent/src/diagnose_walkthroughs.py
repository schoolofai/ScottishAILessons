#!/usr/bin/env python3
"""Diagnose and Fix Walkthrough Status Issues.

This script queries walkthroughs for a specific paper and reports their status.
It can also bulk-update draft walkthroughs to published status.

Usage:
    cd claud_author_agent
    source .venv/bin/activate

    # Diagnose walkthroughs for a paper (by paper document ID)
    python -m src.diagnose_walkthroughs <paper_id>

    # Diagnose by paper URL components
    python -m src.diagnose_walkthroughs --subject applications-of-mathematics --level higher --year 2025 --paper-code "X844/76/01"

    # Fix draft walkthroughs (update to published)
    python -m src.diagnose_walkthroughs <paper_id> --fix

    # List all papers with walkthroughs
    python -m src.diagnose_walkthroughs --list-papers
"""

import argparse
import asyncio
import logging
import sys
from typing import Dict, Any, List, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
RESET = '\033[0m'


async def get_appwrite_client(mcp_config_path: str = ".mcp.json"):
    """Get Appwrite client from MCP config."""
    from .utils.appwrite_infrastructure import _get_appwrite_client
    return _get_appwrite_client(mcp_config_path)


async def find_paper_by_metadata(
    subject: str,
    level: str,
    year: int,
    paper_code: str,
    mcp_config_path: str = ".mcp.json"
) -> Optional[Dict[str, Any]]:
    """Find a paper document by its metadata."""
    from appwrite.services.databases import Databases
    from appwrite.query import Query

    client, _, _, _ = await get_appwrite_client(mcp_config_path)
    databases = Databases(client)

    result = databases.list_documents(
        database_id="sqa_education",
        collection_id="us_papers",
        queries=[
            Query.equal("subject", subject),
            Query.equal("level", level),
            Query.equal("year", year),
            Query.equal("paper_code", paper_code),
            Query.limit(1)
        ]
    )

    if result.get("documents"):
        return result["documents"][0]
    return None


async def list_walkthroughs_for_paper(
    paper_id: str,
    mcp_config_path: str = ".mcp.json",
    include_all_statuses: bool = True
) -> List[Dict[str, Any]]:
    """List all walkthroughs for a specific paper.

    Args:
        paper_id: Paper document ID
        mcp_config_path: Path to MCP config
        include_all_statuses: If True, include draft and archived walkthroughs

    Returns:
        List of walkthrough documents
    """
    from appwrite.services.databases import Databases
    from appwrite.query import Query

    client, _, _, _ = await get_appwrite_client(mcp_config_path)
    databases = Databases(client)

    queries = [
        Query.equal("paper_id", paper_id),
        Query.limit(100)  # Papers typically have fewer than 100 questions
    ]

    if not include_all_statuses:
        queries.append(Query.equal("status", "published"))

    result = databases.list_documents(
        database_id="sqa_education",
        collection_id="us_walkthroughs",
        queries=queries
    )

    return result.get("documents", [])


async def update_walkthrough_status(
    walkthrough_id: str,
    new_status: str,
    mcp_config_path: str = ".mcp.json"
) -> Dict[str, Any]:
    """Update the status of a walkthrough document.

    Args:
        walkthrough_id: Walkthrough document ID
        new_status: New status (draft, published, archived)
        mcp_config_path: Path to MCP config

    Returns:
        Updated document
    """
    from appwrite.services.databases import Databases
    from datetime import datetime, timezone

    client, _, _, _ = await get_appwrite_client(mcp_config_path)
    databases = Databases(client)

    result = databases.update_document(
        database_id="sqa_education",
        collection_id="us_walkthroughs",
        document_id=walkthrough_id,
        data={
            "status": new_status,
            "last_modified": datetime.now(timezone.utc).isoformat()
        }
    )

    return result


async def list_all_papers_with_walkthroughs(
    mcp_config_path: str = ".mcp.json"
) -> List[Dict[str, Any]]:
    """List all unique paper_ids that have walkthroughs."""
    from appwrite.services.databases import Databases
    from appwrite.query import Query

    client, _, _, _ = await get_appwrite_client(mcp_config_path)
    databases = Databases(client)

    # Get all walkthroughs (we'll deduplicate by paper_id)
    all_walkthroughs = []
    offset = 0
    limit = 100

    while True:
        result = databases.list_documents(
            database_id="sqa_education",
            collection_id="us_walkthroughs",
            queries=[
                Query.select(["paper_id", "subject", "level", "year", "paper_code", "status"]),
                Query.limit(limit),
                Query.offset(offset)
            ]
        )

        docs = result.get("documents", [])
        all_walkthroughs.extend(docs)

        if len(docs) < limit:
            break
        offset += limit

    # Group by paper_id and count statuses
    papers: Dict[str, Dict[str, Any]] = {}
    for wt in all_walkthroughs:
        paper_id = wt.get("paper_id", "unknown")
        if paper_id not in papers:
            papers[paper_id] = {
                "paper_id": paper_id,
                "subject": wt.get("subject", ""),
                "level": wt.get("level", ""),
                "year": wt.get("year", 0),
                "paper_code": wt.get("paper_code", ""),
                "total": 0,
                "published": 0,
                "draft": 0,
                "archived": 0
            }

        papers[paper_id]["total"] += 1
        status = wt.get("status", "unknown")
        if status in papers[paper_id]:
            papers[paper_id][status] += 1

    return list(papers.values())


async def diagnose_paper_walkthroughs(
    paper_id: str,
    mcp_config_path: str = ".mcp.json",
    fix: bool = False
) -> Dict[str, Any]:
    """Diagnose walkthrough status for a paper.

    Args:
        paper_id: Paper document ID
        mcp_config_path: Path to MCP config
        fix: If True, update draft walkthroughs to published

    Returns:
        Diagnosis result
    """
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Diagnosing Walkthroughs for Paper: {paper_id}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    # Fetch all walkthroughs (including drafts)
    walkthroughs = await list_walkthroughs_for_paper(
        paper_id=paper_id,
        mcp_config_path=mcp_config_path,
        include_all_statuses=True
    )

    if not walkthroughs:
        print(f"{RED}❌ NO WALKTHROUGHS FOUND for paper: {paper_id}{RESET}")
        print(f"\n{YELLOW}Possible causes:{RESET}")
        print(f"  1. Walkthroughs have not been authored yet")
        print(f"  2. Paper ID is incorrect (check the us_papers collection)")
        print(f"\n{YELLOW}Next steps:{RESET}")
        print(f"  - Run the walkthrough author agent to generate walkthroughs")
        print(f"  - Verify the paper exists in us_papers collection")
        return {
            "paper_id": paper_id,
            "total": 0,
            "published": 0,
            "draft": 0,
            "archived": 0,
            "fixed": 0
        }

    # Categorize by status
    published = []
    draft = []
    archived = []
    other = []

    for wt in walkthroughs:
        status = wt.get("status", "unknown")
        q_num = wt.get("question_number", "?")

        if status == "published":
            published.append(wt)
        elif status == "draft":
            draft.append(wt)
        elif status == "archived":
            archived.append(wt)
        else:
            other.append(wt)

    # Print summary
    print(f"{CYAN}Summary:{RESET}")
    print(f"  Total walkthroughs: {len(walkthroughs)}")
    print(f"  {GREEN}Published:{RESET} {len(published)}")
    print(f"  {YELLOW}Draft:{RESET} {len(draft)}")
    print(f"  {RED}Archived:{RESET} {len(archived)}")
    if other:
        print(f"  {RED}Unknown status:{RESET} {len(other)}")

    # List draft walkthroughs (these are the problem)
    if draft:
        print(f"\n{YELLOW}⚠️  DRAFT WALKTHROUGHS (these appear grayed out on frontend):{RESET}")
        for wt in draft:
            q_num = wt.get("question_number", "?")
            doc_id = wt.get("$id", "?")
            print(f"  - Q{q_num} (ID: {doc_id})")

    # List published walkthroughs
    if published:
        print(f"\n{GREEN}✅ PUBLISHED WALKTHROUGHS:{RESET}")
        for wt in published:
            q_num = wt.get("question_number", "?")
            print(f"  - Q{q_num}")

    fixed_count = 0

    # Fix draft walkthroughs if requested
    if fix and draft:
        print(f"\n{BLUE}Fixing draft walkthroughs...{RESET}")
        for wt in draft:
            doc_id = wt.get("$id")
            q_num = wt.get("question_number", "?")

            try:
                await update_walkthrough_status(
                    walkthrough_id=doc_id,
                    new_status="published",
                    mcp_config_path=mcp_config_path
                )
                print(f"  {GREEN}✅ Q{q_num}: draft → published{RESET}")
                fixed_count += 1
            except Exception as e:
                print(f"  {RED}❌ Q{q_num}: Failed to update - {e}{RESET}")
    elif draft and not fix:
        print(f"\n{YELLOW}To fix these draft walkthroughs, run with --fix flag{RESET}")

    return {
        "paper_id": paper_id,
        "total": len(walkthroughs),
        "published": len(published),
        "draft": len(draft),
        "archived": len(archived),
        "fixed": fixed_count
    }


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Diagnose and fix walkthrough status issues",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Diagnose by paper document ID
    python -m src.diagnose_walkthroughs applicationsofmathematicshigher2025X8447601

    # Diagnose by metadata
    python -m src.diagnose_walkthroughs --subject applications-of-mathematics --level higher --year 2025 --paper-code "X844/76/01"

    # Fix draft walkthroughs
    python -m src.diagnose_walkthroughs <paper_id> --fix

    # List all papers
    python -m src.diagnose_walkthroughs --list-papers
"""
    )

    parser.add_argument(
        "paper_id",
        nargs="?",
        help="Paper document ID to diagnose"
    )
    parser.add_argument(
        "--subject",
        help="Paper subject (e.g., applications-of-mathematics)"
    )
    parser.add_argument(
        "--level",
        help="Paper level (e.g., higher, national-5)"
    )
    parser.add_argument(
        "--year",
        type=int,
        help="Paper year (e.g., 2025)"
    )
    parser.add_argument(
        "--paper-code",
        help="Paper code (e.g., X844/76/01)"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Update draft walkthroughs to published status"
    )
    parser.add_argument(
        "--list-papers",
        action="store_true",
        help="List all papers that have walkthroughs"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP configuration file"
    )

    return parser.parse_args()


async def main_async():
    """Async main entry point."""
    args = parse_arguments()

    # List all papers mode
    if args.list_papers:
        print(f"\n{BLUE}{'='*80}{RESET}")
        print(f"{BLUE}Papers with Walkthroughs{RESET}")
        print(f"{BLUE}{'='*80}{RESET}\n")

        papers = await list_all_papers_with_walkthroughs(args.mcp_config)

        if not papers:
            print(f"{YELLOW}No walkthroughs found in the database.{RESET}")
            return

        # Sort by subject, level, year
        papers.sort(key=lambda p: (p["subject"], p["level"], p["year"]))

        print(f"{'Paper ID':<50} {'Subject':<25} {'Level':<10} {'Year':<6} {'Total':<6} {'Published':<10} {'Draft':<6}")
        print("-" * 120)

        for p in papers:
            status_indicator = ""
            if p["draft"] > 0:
                status_indicator = f"{YELLOW}⚠{RESET}"
            elif p["published"] == p["total"]:
                status_indicator = f"{GREEN}✓{RESET}"

            print(f"{p['paper_id']:<50} {p['subject']:<25} {p['level']:<10} {p['year']:<6} {p['total']:<6} {p['published']:<10} {p['draft']:<6} {status_indicator}")

        # Summary
        total_published = sum(p["published"] for p in papers)
        total_draft = sum(p["draft"] for p in papers)
        total_all = sum(p["total"] for p in papers)

        print(f"\n{CYAN}Summary:{RESET}")
        print(f"  Total papers with walkthroughs: {len(papers)}")
        print(f"  Total walkthroughs: {total_all}")
        print(f"  {GREEN}Published:{RESET} {total_published}")
        print(f"  {YELLOW}Draft:{RESET} {total_draft}")

        if total_draft > 0:
            print(f"\n{YELLOW}⚠️  There are {total_draft} draft walkthroughs that need to be published.{RESET}")

        return

    # Find paper by metadata if provided
    paper_id = args.paper_id

    if args.subject and args.level and args.year and args.paper_code:
        print(f"{BLUE}Looking up paper by metadata...{RESET}")
        paper = await find_paper_by_metadata(
            subject=args.subject,
            level=args.level,
            year=args.year,
            paper_code=args.paper_code,
            mcp_config_path=args.mcp_config
        )

        if paper:
            paper_id = paper["$id"]
            print(f"{GREEN}Found paper: {paper_id}{RESET}")
        else:
            print(f"{RED}Paper not found with provided metadata{RESET}")
            sys.exit(1)

    if not paper_id:
        print(f"{RED}Error: Either paper_id or --subject/--level/--year/--paper-code required{RESET}")
        sys.exit(1)

    # Diagnose the paper
    result = await diagnose_paper_walkthroughs(
        paper_id=paper_id,
        mcp_config_path=args.mcp_config,
        fix=args.fix
    )

    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Diagnosis Complete{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

    if result["draft"] > 0 and not args.fix:
        print(f"\n{YELLOW}Run with --fix to update draft walkthroughs to published{RESET}")
        sys.exit(1)
    elif result["fixed"] > 0:
        print(f"\n{GREEN}✅ Fixed {result['fixed']} walkthroughs!{RESET}")
        print(f"{GREEN}Questions should no longer be grayed out on the frontend.{RESET}")


def main():
    """Main entry point."""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
