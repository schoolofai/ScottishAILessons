#!/usr/bin/env python3
"""List collections in sqa_education database."""

import json
from pathlib import Path
from appwrite.client import Client
from appwrite.services.databases import Databases

# Load MCP config
with open(".mcp.json") as f:
    mcp_config = json.load(f)

args = mcp_config["mcpServers"]["appwrite"]["args"]

endpoint = None
api_key = None
project_id = None

for arg in args:
    if arg.startswith("APPWRITE_ENDPOINT="):
        endpoint = arg.split("=", 1)[1]
    elif arg.startswith("APPWRITE_API_KEY="):
        api_key = arg.split("=", 1)[1]
    elif arg.startswith("APPWRITE_PROJECT_ID="):
        project_id = arg.split("=", 1)[1]

client = Client()
client.set_endpoint(endpoint)
client.set_project(project_id)
client.set_key(api_key)

databases = Databases(client)

try:
    # List collections in sqa_education
    result = databases.list_collections(database_id="sqa_education")

    print("Collections in sqa_education database:")
    print()

    for collection in result['collections']:
        print(f"Collection ID: {collection['$id']}")
        print(f"  Name: {collection['name']}")
        print()

except Exception as e:
    print(f"Error: {e}")
