#!/usr/bin/env python3
"""List all storage buckets in Appwrite to find the correct bucket ID for diagram images."""

import asyncio
import json
from pathlib import Path
from appwrite.client import Client
from appwrite.services.storage import Storage


async def list_buckets():
    """List all storage buckets."""
    # Load MCP config
    config_path = Path(__file__).parent.parent / ".mcp.json"
    with open(config_path) as f:
        config = json.load(f)

    # Extract Appwrite config
    appwrite_config = config["mcpServers"]["appwrite"]
    args = appwrite_config["args"]

    endpoint = None
    project_id = None
    api_key = None

    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="):
            endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="):
            project_id = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_API_KEY="):
            api_key = arg.split("=", 1)[1]

    # Create Appwrite client
    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    storage = Storage(client)

    try:
        result = storage.list_buckets()
        print("Available Storage Buckets:")
        print("=" * 60)
        for bucket in result['buckets']:
            bucket_id = bucket.get('$id', 'N/A')
            bucket_name = bucket.get('name', 'N/A')
            enabled = bucket.get('enabled', False)
            print(f"  • Bucket ID: {bucket_id}")
            print(f"    Name: {bucket_name}")
            print(f"    Enabled: {enabled}")
            print()
    except Exception as e:
        print(f"Error listing buckets: {e}")


if __name__ == "__main__":
    asyncio.run(list_buckets())
