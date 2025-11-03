#!/usr/bin/env python3
"""Investigation script for SOW duplication and versioning issues.

This script analyzes the current state of Authored_SOW documents for a given
course ID, showing all versions, lesson template linkages, and identifying
potential issues.

Usage:
    python investigate_sow_duplicates.py --course-id course_c84474
    python investigate_sow_duplicates.py --course-id course_c84474 --detailed
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Import utility directly without loading full module
import importlib.util
utils_path = Path(__file__).parent / "src" / "utils" / "appwrite_mcp.py"
spec = importlib.util.spec_from_file_location("appwrite_mcp", utils_path)
appwrite_mcp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(appwrite_mcp)
list_appwrite_documents = appwrite_mcp.list_appwrite_documents


async def investigate_sow_duplicates(
    course_id: str,
    mcp_config_path: str = ".mcp.json",
    detailed: bool = False
) -> Dict[str, Any]:
    """Investigate SOW documents and lesson template linkage for a course.

    Args:
        course_id: Course identifier to investigate
        mcp_config_path: Path to MCP configuration
        detailed: If True, show detailed information about each document

    Returns:
        Investigation report dictionary
    """
    print("=" * 80)
    print(f"SOW Investigation Report for Course: {course_id}")
    print("=" * 80)
    print()

    # Query all SOWs for this course (all versions)
    print("📊 Querying Authored_SOW collection...")
    try:
        sows = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[f'equal("courseId", "{course_id}")'],
            mcp_config_path=mcp_config_path
        )
    except Exception as e:
        print(f"❌ Failed to query Authored_SOW: {e}")
        return {"success": False, "error": str(e)}

    print(f"Found {len(sows)} SOW document(s)\n")

    if len(sows) == 0:
        print("⚠️  No SOW documents found for this course")
        return {
            "success": True,
            "course_id": course_id,
            "sow_count": 0,
            "sows": []
        }

    # Analyze each SOW
    sow_analysis = []

    for idx, sow in enumerate(sows, 1):
        sow_id = sow.get("$id", "UNKNOWN")
        version = sow.get("version", "MISSING")
        status = sow.get("status", "UNKNOWN")
        created_at = sow.get("$createdAt", "UNKNOWN")
        updated_at = sow.get("$updatedAt", "UNKNOWN")

        print(f"━━━ SOW #{idx} ━━━")
        print(f"  Document ID:   {sow_id}")
        print(f"  Version:       {version}")
        print(f"  Status:        {status}")
        print(f"  Created:       {created_at}")
        print(f"  Updated:       {updated_at}")

        # Query lesson templates linked to this SOW
        print(f"  Querying lesson templates...")
        try:
            templates = await list_appwrite_documents(
                database_id="default",
                collection_id="lesson_templates",
                queries=[f'equal("authored_sow_id", "{sow_id}")'],
                mcp_config_path=mcp_config_path
            )
            template_count = len(templates)
            print(f"  Linked Templates: {template_count}")

            if detailed and template_count > 0:
                print(f"  Template Details:")
                for t in templates[:5]:  # Show first 5
                    t_id = t.get("$id", "?")
                    t_title = t.get("title", "?")
                    t_sow_order = t.get("sow_order", "?")
                    print(f"    - {t_id[:12]}... | Order: {t_sow_order} | {t_title}")
                if template_count > 5:
                    print(f"    ... and {template_count - 5} more")

        except Exception as e:
            template_count = -1
            templates = []
            print(f"  ⚠️  Failed to query templates: {e}")

        # Parse metadata if available
        metadata_str = sow.get("metadata", "{}")
        try:
            if isinstance(metadata_str, str):
                metadata = json.loads(metadata_str)
            else:
                metadata = metadata_str

            course_name = metadata.get("course_name", "N/A")
            total_lessons = metadata.get("total_lessons", "?")
            total_minutes = metadata.get("total_estimated_minutes", "?")
            agent_version = metadata.get("author_agent_version", "?")

            print(f"  Course Name:   {course_name}")
            print(f"  SOW Lessons:   {total_lessons}")
            print(f"  Est. Minutes:  {total_minutes}")
            print(f"  Agent Version: {agent_version}")

        except Exception as e:
            print(f"  ⚠️  Failed to parse metadata: {e}")
            metadata = {}

        print()

        # Store analysis
        sow_analysis.append({
            "sow_id": sow_id,
            "version": version,
            "status": status,
            "created_at": created_at,
            "updated_at": updated_at,
            "template_count": template_count,
            "metadata": metadata,
            "templates": [t.get("$id") for t in templates] if detailed else []
        })

    # Summary and recommendations
    print("=" * 80)
    print("📋 SUMMARY")
    print("=" * 80)
    print()

    print(f"Total SOW documents: {len(sows)}")
    print()

    # Check for version issues
    version_map = {}
    for analysis in sow_analysis:
        v = analysis["version"]
        if v not in version_map:
            version_map[v] = []
        version_map[v].append(analysis["sow_id"])

    print("Version Distribution:")
    for version in sorted(version_map.keys(), key=lambda x: x if isinstance(x, str) else ""):
        sow_ids = version_map[version]
        print(f"  Version {version}: {len(sow_ids)} SOW(s)")
        for sow_id in sow_ids:
            # Find analysis for this SOW
            analysis = next(a for a in sow_analysis if a["sow_id"] == sow_id)
            print(f"    - {sow_id} ({analysis['template_count']} templates, status={analysis['status']})")
    print()

    # Identify issues
    issues = []

    # Issue 1: Multiple SOWs with same version
    for version, sow_ids in version_map.items():
        if len(sow_ids) > 1:
            issues.append(
                f"DATA CORRUPTION: {len(sow_ids)} SOWs have version '{version}'. "
                f"Each version should be unique per course."
            )

    # Issue 2: Missing version field
    if "MISSING" in version_map:
        issues.append(
            f"MISSING VERSION: {len(version_map['MISSING'])} SOW(s) have no version field. "
            f"This needs to be fixed."
        )

    # Issue 3: SOWs with 0 lesson templates
    for analysis in sow_analysis:
        if analysis["template_count"] == 0:
            issues.append(
                f"ORPHANED SOW: {analysis['sow_id']} (v{analysis['version']}) "
                f"has no lesson templates linked."
            )

    if issues:
        print("⚠️  ISSUES DETECTED:")
        for i, issue in enumerate(issues, 1):
            print(f"{i}. {issue}")
        print()
    else:
        print("✅ No issues detected")
        print()

    # Recommendations
    print("=" * 80)
    print("💡 RECOMMENDATIONS")
    print("=" * 80)
    print()

    if len(sows) == 1:
        analysis = sow_analysis[0]
        print(f"✓ Single SOW found: {analysis['sow_id']}")
        print(f"  Version: {analysis['version']}")
        print(f"  Templates: {analysis['template_count']}")
        print()
        print("This is the expected state. No action needed.")

    elif len(sows) > 1:
        print(f"Multiple SOWs found ({len(sows)}). Expected behavior for versioning.")
        print()

        # Find version 1
        version_1_sows = version_map.get("1", [])
        if len(version_1_sows) == 0:
            print("⚠️  No version 1 SOW found!")
            print("   Action: Assign version 1 to the SOW that should be the default")
            print()
        elif len(version_1_sows) == 1:
            v1_analysis = next(a for a in sow_analysis if a["sow_id"] == version_1_sows[0])
            print(f"✓ Version 1 SOW: {version_1_sows[0]}")
            print(f"  Templates: {v1_analysis['template_count']}")
            print(f"  Status: {v1_analysis['status']}")
            print()
            print("  Frontend will use this version by default.")
            print()
        else:
            print(f"❌ Multiple version 1 SOWs found: {len(version_1_sows)}")
            print("   Action: This is data corruption. Keep only one version 1.")
            print()

        # Other versions
        for version in sorted(version_map.keys()):
            if version not in ["1", "MISSING"]:
                v_sows = version_map[version]
                if len(v_sows) == 1:
                    v_analysis = next(a for a in sow_analysis if a["sow_id"] == v_sows[0])
                    print(f"Version {version}: {v_sows[0]}")
                    print(f"  Templates: {v_analysis['template_count']}")
                    print(f"  Status: {v_analysis['status']}")
                    print(f"  Purpose: Development/testing version")
                    print()

    print("=" * 80)

    return {
        "success": True,
        "course_id": course_id,
        "sow_count": len(sows),
        "sows": sow_analysis,
        "version_map": version_map,
        "issues": issues
    }


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Investigate SOW documents and lesson template linkage",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--course-id',
        type=str,
        required=True,
        help='Course ID to investigate (e.g., course_c84474)'
    )

    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        help='Path to MCP config file (default: .mcp.json)'
    )

    parser.add_argument(
        '--detailed',
        action='store_true',
        help='Show detailed information about each document'
    )

    return parser.parse_args()


async def main():
    """Main entry point."""
    args = parse_args()

    result = await investigate_sow_duplicates(
        course_id=args.course_id,
        mcp_config_path=args.mcp_config,
        detailed=args.detailed
    )

    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
