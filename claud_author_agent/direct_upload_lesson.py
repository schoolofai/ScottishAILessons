#!/usr/bin/env python3
"""Direct lesson template upload - completely standalone with no complex imports.

This script directly implements the upload logic without importing from utils
to avoid circular dependency issues.
"""

import asyncio
import gzip
import base64
import json
import sys
from pathlib import Path
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query


def compress_json_gzip_base64(data: dict) -> str:
    """Compress JSON data using gzip + base64 encoding."""
    json_str = json.dumps(data, ensure_ascii=False)
    json_bytes = json_str.encode('utf-8')
    compressed = gzip.compress(json_bytes, compresslevel=9)
    encoded = base64.b64encode(compressed).decode('ascii')
    return f"gzip:{encoded}"


def get_compression_stats(original: dict, compressed: str) -> dict:
    """Calculate compression statistics."""
    original_size = len(json.dumps(original, ensure_ascii=False).encode('utf-8'))
    compressed_size = len(compressed.encode('utf-8'))
    ratio = compressed_size / original_size if original_size > 0 else 0
    saved = original_size - compressed_size

    return {
        "original_bytes": original_size,
        "compressed_bytes": compressed_size,
        "ratio": ratio,
        "saved_bytes": saved,
        "saved_percent": (1 - ratio) * 100
    }


async def upload_lesson_template(
    lesson_template_path: str,
    courseId: str,
    order: int,
    mcp_config_path: str = ".mcp.json"
):
    """Upload lesson template directly to Appwrite."""

    # Load MCP config for Appwrite credentials
    with open(mcp_config_path) as f:
        mcp_config = json.load(f)

    appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
    if not appwrite_config:
        raise ValueError("Appwrite configuration not found in .mcp.json")

    # Parse credentials from args array (MCP format)
    args = appwrite_config.get("args", [])
    endpoint = None
    project_id = None
    api_key = None

    for arg in args:
        if isinstance(arg, str):
            if arg.startswith("APPWRITE_ENDPOINT="):
                endpoint = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_PROJECT_ID="):
                project_id = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_API_KEY="):
                api_key = arg.split("=", 1)[1]

    # Fallback to env dict if not in args
    if not endpoint or not project_id or not api_key:
        env = appwrite_config.get("env", {})
        endpoint = endpoint or env.get("APPWRITE_ENDPOINT")
        project_id = project_id or env.get("APPWRITE_PROJECT_ID")
        api_key = api_key or env.get("APPWRITE_API_KEY")

    if not all([endpoint, project_id, api_key]):
        raise ValueError("Missing Appwrite configuration (endpoint, project_id, or api_key)")

    print(f"🔗 Connecting to Appwrite...")
    print(f"   Endpoint: {endpoint}")
    print(f"   Project: {project_id}")
    print()

    # Initialize Appwrite client
    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)

    # Load lesson template
    print(f"📄 Loading lesson template from: {lesson_template_path}")
    with open(lesson_template_path) as f:
        template = json.load(f)

    print(f"   Title: {template.get('title', 'N/A')}")
    print(f"   Type: {template.get('lesson_type', 'N/A')}")
    print(f"   Duration: {template.get('estMinutes', 'N/A')} minutes")
    print(f"   Cards: {len(template.get('cards', []))}")
    print()

    # Compress cards
    cards = template.get("cards", [])
    if cards:
        print(f"🗜️  Compressing cards...")
        compressed_cards = compress_json_gzip_base64(cards)
        stats = get_compression_stats(cards, compressed_cards)

        print(f"   Original: {stats['original_bytes']:,} bytes")
        print(f"   Compressed: {stats['compressed_bytes']:,} bytes")
        print(f"   Saved: {stats['saved_percent']:.1f}%")
        print()

        template["cards"] = compressed_cards

    # Query for existing document
    print(f"🔍 Checking for existing lesson template...")
    print(f"   Query: courseId=\"{courseId}\" AND sow_order={order}")
    print()

    try:
        existing_docs = databases.list_documents(
            database_id="default",
            collection_id="lesson_templates",
            queries=[
                Query.equal("courseId", courseId),
                Query.equal("sow_order", order)
            ]
        )

        existing_count = existing_docs.get("total", 0)
        print(f"   Found: {existing_count} existing document(s)")
        print()

    except Exception as e:
        print(f"   ⚠️  Query failed (will try create): {e}")
        existing_count = 0

    # Prepare document data
    # Convert arrays to JSON strings as needed for Appwrite schema
    outcome_refs = template.get("outcomeRefs", [])
    if isinstance(outcome_refs, list):
        outcome_refs = json.dumps(outcome_refs)

    engagement_tags = template.get("engagement_tags", [])
    if isinstance(engagement_tags, list):
        engagement_tags = json.dumps(engagement_tags)

    policy = template.get("policy", {"calculator_allowed": False})
    if isinstance(policy, dict):
        policy = json.dumps(policy)

    doc_data = {
        "courseId": template.get("courseId"),
        "title": template.get("title"),
        "outcomeRefs": outcome_refs,
        "cards": template.get("cards"),
        "estMinutes": template.get("estMinutes", 50),
        "sow_order": order,
        "lesson_type": template.get("lesson_type", "teach"),
        "engagement_tags": engagement_tags,
        "policy": policy,
        "status": template.get("status", "draft"),
        "createdBy": template.get("createdBy", "lesson_author_agent"),
        "version": template.get("version", 1)
    }

    # Add optional fields if present
    if "authored_sow_id" in template:
        doc_data["authored_sow_id"] = template["authored_sow_id"]
    if "authored_sow_version" in template:
        doc_data["authored_sow_version"] = template["authored_sow_version"]
    if "model_version" in template:
        doc_data["model_version"] = template["model_version"]

    try:
        if existing_count > 0:
            # Update existing document
            existing_doc = existing_docs["documents"][0]
            document_id = existing_doc["$id"]

            print(f"🔄 Updating existing document: {document_id}")
            print()

            result = databases.update_document(
                database_id="default",
                collection_id="lesson_templates",
                document_id=document_id,
                data=doc_data
            )

            action = "Updated"
        else:
            # Create new document
            print(f"➕ Creating new document...")
            print()

            result = databases.create_document(
                database_id="default",
                collection_id="lesson_templates",
                document_id="unique()",
                data=doc_data
            )

            action = "Created"
            document_id = result["$id"]

        return document_id, action

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Appwrite error: {error_msg}")
        raise


async def main():
    """Main entry point."""

    # Configuration
    workspace_path = "workspace/20251030_111447"
    courseId = "course_c84475"
    order = 12

    print("🔄 Direct Lesson Template Upload")
    print("=" * 70)
    print(f"Workspace:  {workspace_path}")
    print(f"Course ID:  {courseId}")
    print(f"Order:      {order}")
    print("=" * 70)
    print()

    # Validate workspace
    workspace = Path(workspace_path)
    if not workspace.exists():
        print(f"❌ ERROR: Workspace not found: {workspace_path}")
        sys.exit(1)

    lesson_template_path = workspace / "lesson_template.json"
    if not lesson_template_path.exists():
        print(f"❌ ERROR: lesson_template.json not found")
        sys.exit(1)

    try:
        document_id, action = await upload_lesson_template(
            lesson_template_path=str(lesson_template_path),
            courseId=courseId,
            order=order,
            mcp_config_path=".mcp.json"
        )

        print("=" * 70)
        print(f"✅ SUCCESS! {action} lesson template")
        print("=" * 70)
        print(f"Document ID:  {document_id}")
        print(f"Collection:   default.lesson_templates")
        print(f"Query:        courseId=\"{courseId}\" AND sow_order={order}")
        print()
        print("Verify in Appwrite Console:")
        print(f"  https://cloud.appwrite.io/console → default → lesson_templates")
        print()

    except Exception as e:
        print()
        print("=" * 70)
        print("❌ UPLOAD FAILED")
        print("=" * 70)
        print(f"Error: {e}")
        print()

        error_str = str(e).lower()

        if "estminutes" in error_str:
            print("📋 estMinutes validation error")
            print()
            print("The database may still have the old 5-120 constraint.")
            print("Check Appwrite Console → lesson_templates → estMinutes attribute")
            print("Update constraint to: 5-180")
            print()

        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
