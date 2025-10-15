"""
Comprehensive Example: External MCP Server with Appwrite

This demonstrates advanced usage of external MCP servers including:
1. Complete database workflow (create, schema, documents)
2. CRUD operations on documents
3. Querying and filtering data
4. Error handling and validation
5. Cleanup operations
"""

import anyio
from claude_agent_sdk import query, ClaudeAgentOptions
import json
import os
from datetime import datetime


def load_mcp_config():
    """Load MCP configuration from .mcp.json"""
    mcp_config_path = ".mcp.json"

    if not os.path.exists(mcp_config_path):
        raise FileNotFoundError(f"{mcp_config_path} not found. Please create it first.")

    with open(mcp_config_path, 'r') as f:
        return json.load(f)


async def comprehensive_workflow():
    """
    Complete workflow: Database → Collection → Documents → Query
    """
    print("=" * 70)
    print("Comprehensive Appwrite Workflow")
    print("=" * 70)
    print()

    # Load MCP configuration
    mcp_config = load_mcp_config()

    # Configure agent with comprehensive Appwrite tools
    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],

        # Enable all necessary database tools
        allowed_tools=[
            # Database operations
            "mcp__appwrite__databases_list",
            "mcp__appwrite__databases_create",
            "mcp__appwrite__databases_get",
            "mcp__appwrite__databases_delete",

            # Collection operations
            "mcp__appwrite__databases_list_collections",
            "mcp__appwrite__databases_create_collection",
            "mcp__appwrite__databases_get_collection",
            "mcp__appwrite__databases_delete_collection",

            # Attribute operations
            "mcp__appwrite__databases_create_string_attribute",
            "mcp__appwrite__databases_create_integer_attribute",
            "mcp__appwrite__databases_create_boolean_attribute",
            "mcp__appwrite__databases_create_email_attribute",
            "mcp__appwrite__databases_list_attributes",

            # Document operations
            "mcp__appwrite__databases_create_document",
            "mcp__appwrite__databases_list_documents",
            "mcp__appwrite__databases_get_document",
            "mcp__appwrite__databases_update_document",
            "mcp__appwrite__databases_delete_document",

            # Index operations
            "mcp__appwrite__databases_create_index",
            "mcp__appwrite__databases_list_indexes"
        ],

        permission_mode='acceptEdits',
        system_prompt="""You are an Appwrite database expert assistant.

Your responsibilities:
- Create and manage databases, collections, and documents
- Define proper schemas with appropriate attribute types
- Perform CRUD operations efficiently
- Provide clear feedback on operations
- Handle errors gracefully

Always confirm successful operations with details.""",
        max_turns=20
    )

    # Workflow: Complete database setup
    prompt = """
    Please perform the following Appwrite operations:

    1. DATABASE SETUP:
       - Create a database with ID 'blog_db' and name 'Blog Database'

    2. COLLECTION CREATION:
       - In 'blog_db', create a collection 'posts' with document security disabled
       - Add these attributes to 'posts':
         * String attribute 'title' (required, max 200 chars)
         * String attribute 'content' (required, max 5000 chars)
         * String attribute 'author' (required, max 100 chars)
         * Boolean attribute 'published' (required, default false)
         * Integer attribute 'views' (not required, default 0)

    3. CREATE SAMPLE DOCUMENTS:
       - Create 3 blog post documents with different data:
         1. Title: "Getting Started with Appwrite", author: "Alice", published: true
         2. Title: "Advanced Database Queries", author: "Bob", published: false
         3. Title: "MCP Server Integration", author: "Charlie", published: true

    4. QUERY DOCUMENTS:
       - List all documents in the posts collection
       - Show the total count

    5. UPDATE OPERATION:
       - Update the second post to set published: true

    Please execute these steps in order and provide feedback after each operation.
    """

    print("Executing comprehensive workflow...")
    print("-" * 70)
    print()

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
            elif hasattr(message, 'subtype'):
                if message.subtype == 'success':
                    print(f"\n[Workflow completed successfully]")
    except Exception as e:
        print(f"\nError during workflow: {e}")
        import traceback
        traceback.print_exc()


async def document_crud_example():
    """
    Demonstrate document CRUD operations.
    """
    print()
    print("=" * 70)
    print("Document CRUD Operations Example")
    print("=" * 70)
    print()

    mcp_config = load_mcp_config()

    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_create_document",
            "mcp__appwrite__databases_get_document",
            "mcp__appwrite__databases_update_document",
            "mcp__appwrite__databases_delete_document",
            "mcp__appwrite__databases_list_documents"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    Using the 'blog_db' database and 'posts' collection:

    1. CREATE: Add a new post with ID 'post_4':
       - title: "Real-time Database Features"
       - content: "Exploring Appwrite's real-time capabilities..."
       - author: "David"
       - published: true
       - views: 0

    2. READ: Get the document we just created

    3. UPDATE: Increment the views to 42

    4. LIST: Show all documents with published = true

    5. DELETE: Remove the document we created

    6. VERIFY: List all documents to confirm deletion
    """

    print("Executing CRUD operations...")
    print("-" * 70)
    print()

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")


async def schema_management_example():
    """
    Demonstrate schema management with attributes and indexes.
    """
    print()
    print("=" * 70)
    print("Schema Management Example")
    print("=" * 70)
    print()

    mcp_config = load_mcp_config()

    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_create_collection",
            "mcp__appwrite__databases_create_string_attribute",
            "mcp__appwrite__databases_create_integer_attribute",
            "mcp__appwrite__databases_create_email_attribute",
            "mcp__appwrite__databases_create_datetime_attribute",
            "mcp__appwrite__databases_list_attributes",
            "mcp__appwrite__databases_create_index",
            "mcp__appwrite__databases_list_indexes"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    In database 'blog_db', create a new collection 'comments':

    1. Create collection 'comments' with document security enabled

    2. Add attributes:
       - String 'content' (required, max 1000 chars)
       - String 'post_id' (required, max 50 chars)
       - Email 'author_email' (required)
       - Datetime 'created_at' (required)
       - Integer 'likes' (not required, default 0)

    3. Create indexes for performance:
       - Index on 'post_id' (for querying comments by post)
       - Index on 'created_at' (for sorting by date)

    4. List all attributes and indexes to verify
    """

    print("Setting up collection schema...")
    print("-" * 70)
    print()

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")


async def cleanup_example():
    """
    Clean up created resources.
    """
    print()
    print("=" * 70)
    print("Cleanup Operations")
    print("=" * 70)
    print()

    mcp_config = load_mcp_config()

    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_list",
            "mcp__appwrite__databases_list_collections",
            "mcp__appwrite__databases_delete_collection",
            "mcp__appwrite__databases_delete"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    Clean up the demo resources:

    1. List all collections in database 'blog_db'
    2. Delete the 'posts' collection
    3. Delete the 'comments' collection
    4. Delete the 'blog_db' database
    5. List all databases to confirm deletion

    Please confirm each deletion.
    """

    print("Cleaning up resources...")
    print("-" * 70)
    print()

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")


async def error_handling_example():
    """
    Demonstrate error handling with external MCP servers.
    """
    print()
    print("=" * 70)
    print("Error Handling Example")
    print("=" * 70)
    print()

    mcp_config = load_mcp_config()

    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_get",
            "mcp__appwrite__databases_create"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    Test error handling:

    1. Try to get a database with ID 'nonexistent_db' (should fail)
    2. Try to create a database with an invalid ID format (should fail)
    3. Handle errors gracefully and report what went wrong

    For each error, explain what happened and why.
    """

    print("Testing error handling...")
    print("-" * 70)
    print()

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Expected error for demonstration: {e}")


async def main():
    """Main entry point."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 12 + "Comprehensive External MCP Server Example" + " " * 15 + "║")
    print("║" + " " * 20 + "Appwrite Full Workflow" + " " * 26 + "║")
    print("╚" + "=" * 68 + "╝")
    print()
    print("This example demonstrates:")
    print("  • Complete database workflow")
    print("  • Document CRUD operations")
    print("  • Schema management with attributes and indexes")
    print("  • Error handling")
    print("  • Resource cleanup")
    print()

    try:
        # Run comprehensive workflow
        await comprehensive_workflow()

        # Uncomment to run additional examples:
        # await document_crud_example()
        # await schema_management_example()

        # IMPORTANT: Only run cleanup if you want to delete demo resources
        # await cleanup_example()

        # await error_handling_example()

        print()
        print("=" * 70)
        print("Comprehensive examples completed!")
        print("=" * 70)
        print()
        print("Key Learnings:")
        print("  ✓ External MCP servers enable integration with external services")
        print("  ✓ Full CRUD operations are supported")
        print("  ✓ Schema management is flexible and powerful")
        print("  ✓ Error handling works seamlessly")
        print("  ✓ Complex workflows can be automated with natural language")
        print()

    except Exception as e:
        print(f"\nError: {e}")
        print("\nTroubleshooting:")
        print("  1. Check .mcp.json configuration")
        print("  2. Verify Appwrite credentials")
        print("  3. Ensure mcp-server-appwrite is installed")
        print("  4. Check network connectivity to Appwrite endpoint")


if __name__ == "__main__":
    anyio.run(main)
