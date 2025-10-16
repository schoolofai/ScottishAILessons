"""Appwrite MCP utility functions for direct database access.

Provides Python wrappers around Appwrite MCP server operations
for use in validation and other non-agent operations.
"""

import json
import logging
import subprocess
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


async def get_appwrite_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    mcp_config_path: str
) -> Optional[Dict[str, Any]]:
    """Get a single document from Appwrite via MCP.

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Collection ID (e.g., 'courses')
        document_id: Document ID (e.g., 'course_c84474')
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Document data as dictionary, or None if not found

    Raises:
        Exception: If MCP server fails or document query fails
    """
    logger.info(f"MCP Query: Getting document {document_id} from {database_id}.{collection_id}")

    # Build MCP command to invoke get_document
    # Note: This is a simplified approach - in production you'd use the MCP SDK
    # For now, we'll use the Appwrite SDK directly since MCP is for Claude agents

    try:
        # Import Appwrite SDK for Python
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        # Load MCP config to get credentials
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract Appwrite credentials from MCP config
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

        # Parse environment variables from args
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

        if not all([endpoint, api_key, project_id]):
            raise ValueError(
                f"Missing Appwrite credentials in MCP config. "
                f"Found: endpoint={bool(endpoint)}, api_key={bool(api_key)}, project_id={bool(project_id)}"
            )

        # Initialize Appwrite client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)

        # Get document
        try:
            result = databases.get_document(
                database_id=database_id,
                collection_id=collection_id,
                document_id=document_id
            )

            logger.info(f"✓ Document found: {document_id}")
            return result

        except AppwriteException as e:
            if e.code == 404:
                logger.warning(f"Document not found: {document_id}")
                return None
            else:
                logger.error(f"Appwrite error: {e.message} (code: {e.code})")
                raise

    except ImportError:
        raise ImportError(
            "Appwrite Python SDK not installed. Run: pip install appwrite"
        )
    except Exception as e:
        logger.error(f"Failed to get document: {e}")
        raise


async def list_appwrite_documents(
    database_id: str,
    collection_id: str,
    queries: Optional[List[str]] = None,
    mcp_config_path: str = ".mcp.json"
) -> List[Dict[str, Any]]:
    """List documents from Appwrite via MCP with optional filters.

    Args:
        database_id: Database ID (e.g., 'sqa_education')
        collection_id: Collection ID (e.g., 'current_sqa')
        queries: Optional list of query strings (e.g., ['equal("subject", "mathematics")'])
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        List of document dictionaries

    Raises:
        Exception: If MCP server fails or query fails
    """
    logger.info(f"MCP Query: Listing documents from {database_id}.{collection_id}")
    if queries:
        logger.info(f"  Filters: {queries}")

    try:
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.query import Query
        from appwrite.exception import AppwriteException

        # Load MCP config
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract credentials
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

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

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)

        # Convert query strings to Query objects
        query_objects = []
        if queries:
            for query_str in queries:
                # Parse query string like 'equal("subject", "mathematics")' or 'equal("sow_order", 1)'
                # This parser handles both string and numeric values
                if 'equal(' in query_str:
                    # Extract field and value
                    parts = query_str.replace('equal(', '').replace(')', '').split(',')
                    if len(parts) == 2:
                        field = parts[0].strip().strip('"')
                        value_str = parts[1].strip()

                        # Detect if value is quoted (string) or unquoted (numeric)
                        if value_str.startswith('"') and value_str.endswith('"'):
                            value = value_str.strip('"')  # String value
                        else:
                            # Try to parse as numeric (int first, then float)
                            try:
                                value = int(value_str)
                            except ValueError:
                                try:
                                    value = float(value_str)
                                except ValueError:
                                    value = value_str  # Keep as string if not numeric

                        query_objects.append(Query.equal(field, [value]))

        # List documents
        try:
            result = databases.list_documents(
                database_id=database_id,
                collection_id=collection_id,
                queries=query_objects if query_objects else []
            )

            documents = result['documents']
            logger.info(f"✓ Found {len(documents)} document(s)")
            return documents

        except AppwriteException as e:
            logger.error(f"Appwrite error: {e.message} (code: {e.code})")
            raise

    except ImportError:
        raise ImportError(
            "Appwrite Python SDK not installed. Run: pip install appwrite"
        )
    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        raise


async def create_appwrite_document(
    database_id: str,
    collection_id: str,
    data: Dict[str, Any],
    mcp_config_path: str,
    document_id: Optional[str] = None,
    permissions: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Create a new document in Appwrite.

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Collection ID (e.g., 'Authored_SOW')
        data: Document data as dictionary
        mcp_config_path: Path to .mcp.json configuration
        document_id: Document ID to create (if None, Appwrite auto-generates)
        permissions: List of permission strings (if None, uses default permissions)

    Returns:
        Created document data including $id, $createdAt, etc.

    Raises:
        AppwriteException: If document ID already exists or other error
    """
    logger.info(f"MCP Create: Creating document in {database_id}.{collection_id}")
    if document_id:
        logger.info(f"  Using provided document_id: {document_id}")
    else:
        logger.info(f"  Using auto-generated document_id")

    try:
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.id import ID
        from appwrite.exception import AppwriteException

        # Load MCP config
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract credentials
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

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

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)

        # Auto-generate document ID if not provided
        if document_id is None:
            document_id = ID.unique()

        # Use empty permissions array if not provided (server-side default)
        if permissions is None:
            permissions = []

        # Create document
        try:
            result = databases.create_document(
                database_id=database_id,
                collection_id=collection_id,
                document_id=document_id,
                data=data,
                permissions=permissions
            )

            logger.info(f"✓ Document created: {result['$id']}")
            return result

        except AppwriteException as e:
            if e.code == 409:
                logger.error(f"Document ID already exists: {document_id}")
            logger.error(f"Appwrite error: {e.message} (code: {e.code})")
            raise

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to create document: {e}")
        raise


async def update_appwrite_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    data: Dict[str, Any],
    mcp_config_path: str
) -> Dict[str, Any]:
    """Update an existing document in Appwrite.

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Collection ID (e.g., 'lesson_templates')
        document_id: Document ID to update
        data: Document data to update (partial or full)
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Updated document data including $id, $updatedAt, etc.

    Raises:
        AppwriteException: If document doesn't exist or other error
    """
    logger.info(f"MCP Update: Updating document {document_id} in {database_id}.{collection_id}")

    try:
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        # Load MCP config
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract credentials
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

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

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)

        # Update document
        try:
            result = databases.update_document(
                database_id=database_id,
                collection_id=collection_id,
                document_id=document_id,
                data=data
            )

            logger.info(f"✓ Document updated: {document_id}")
            return result

        except AppwriteException as e:
            if e.code == 404:
                logger.error(f"Document not found: {document_id}")
            logger.error(f"Appwrite error: {e.message} (code: {e.code})")
            raise

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to update document: {e}")
        raise


async def delete_appwrite_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    mcp_config_path: str
) -> None:
    """Delete a document from Appwrite.

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Collection ID (e.g., 'Authored_SOW')
        document_id: Document ID to delete
        mcp_config_path: Path to .mcp.json

    Raises:
        AppwriteException: If document doesn't exist or other error
    """
    logger.info(f"MCP Delete: Deleting document {document_id} from {database_id}.{collection_id}")

    try:
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        # Load credentials (same pattern as get_document)
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract Appwrite credentials
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

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

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)

        # Delete document
        databases.delete_document(
            database_id=database_id,
            collection_id=collection_id,
            document_id=document_id
        )

        logger.info(f"✓ Document deleted: {document_id}")

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise
