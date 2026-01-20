"""Appwrite infrastructure management utilities.

Provides functions for creating collections, attributes, indexes, buckets,
and uploading files to Appwrite Storage. Extracted from appwrite_mcp.py
to maintain code quality standards (<500 lines per file).
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


def _get_appwrite_client(mcp_config_path: str):
    """Helper to initialize Appwrite client from MCP config.

    Args:
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Tuple of (client, endpoint, api_key, project_id)

    Raises:
        FileNotFoundError: If MCP config not found
        ValueError: If credentials missing
    """
    from appwrite.client import Client

    config_path = Path(mcp_config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

    with open(config_path) as f:
        mcp_config = json.load(f)

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
        raise ValueError(
            f"Missing Appwrite credentials in MCP config. "
            f"Found: endpoint={bool(endpoint)}, api_key={bool(api_key)}, project_id={bool(project_id)}"
        )

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    return client, endpoint, api_key, project_id


async def create_appwrite_collection(
    database_id: str,
    collection_id: str,
    name: str,
    mcp_config_path: str,
    permissions: Optional[List[str]] = None,
    document_security: bool = False
) -> Dict[str, Any]:
    """Create a new collection in Appwrite database.

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Unique collection ID (e.g., 'revision_notes')
        name: Human-readable collection name
        mcp_config_path: Path to .mcp.json configuration
        permissions: Collection-level permissions (if None, uses defaults)
        document_security: Enable document-level permissions

    Returns:
        Created collection metadata

    Raises:
        AppwriteException: If collection already exists or creation fails
    """
    logger.info(f"Creating collection: {database_id}.{collection_id}")

    try:
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_collection(
            database_id=database_id,
            collection_id=collection_id,
            name=name,
            permissions=permissions or [],
            document_security=document_security
        )

        logger.info(f"✓ Collection created: {collection_id}")
        return result

    except AppwriteException as e:
        if e.code == 409:
            logger.warning(f"Collection already exists: {collection_id}")
            raise
        logger.error(f"Failed to create collection: {e.message} (code: {e.code})")
        raise
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to create collection: {e}")
        raise


async def create_appwrite_string_attribute(
    database_id: str,
    collection_id: str,
    key: str,
    size: int,
    required: bool,
    mcp_config_path: str,
    default: Optional[str] = None
) -> Dict[str, Any]:
    """Create a string attribute in a collection.

    Args:
        database_id: Database ID
        collection_id: Collection ID
        key: Attribute key/name
        size: Maximum string length
        required: Whether attribute is required
        mcp_config_path: Path to .mcp.json
        default: Default value (if not required)

    Returns:
        Created attribute metadata
    """
    logger.info(f"Creating string attribute: {collection_id}.{key}")

    try:
        from appwrite.services.databases import Databases

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_string_attribute(
            database_id=database_id,
            collection_id=collection_id,
            key=key,
            size=size,
            required=required,
            default=default
        )

        logger.info(f"✓ String attribute created: {key}")
        return result

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create string attribute {key}: {e}")
        raise


async def create_appwrite_integer_attribute(
    database_id: str,
    collection_id: str,
    key: str,
    required: bool,
    mcp_config_path: str,
    default: Optional[int] = None,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None
) -> Dict[str, Any]:
    """Create an integer attribute in a collection."""
    logger.info(f"Creating integer attribute: {collection_id}.{key}")

    try:
        from appwrite.services.databases import Databases

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_integer_attribute(
            database_id=database_id,
            collection_id=collection_id,
            key=key,
            required=required,
            default=default,
            min=min_value,
            max=max_value
        )

        logger.info(f"✓ Integer attribute created: {key}")
        return result

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create integer attribute {key}: {e}")
        raise


async def create_appwrite_float_attribute(
    database_id: str,
    collection_id: str,
    key: str,
    required: bool,
    mcp_config_path: str,
    default: Optional[float] = None
) -> Dict[str, Any]:
    """Create a float attribute in a collection."""
    logger.info(f"Creating float attribute: {collection_id}.{key}")

    try:
        from appwrite.services.databases import Databases

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_float_attribute(
            database_id=database_id,
            collection_id=collection_id,
            key=key,
            required=required,
            default=default
        )

        logger.info(f"✓ Float attribute created: {key}")
        return result

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create float attribute {key}: {e}")
        raise


async def create_appwrite_datetime_attribute(
    database_id: str,
    collection_id: str,
    key: str,
    required: bool,
    mcp_config_path: str,
    default: Optional[str] = None
) -> Dict[str, Any]:
    """Create a datetime attribute in a collection."""
    logger.info(f"Creating datetime attribute: {collection_id}.{key}")

    try:
        from appwrite.services.databases import Databases

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_datetime_attribute(
            database_id=database_id,
            collection_id=collection_id,
            key=key,
            required=required,
            default=default
        )

        logger.info(f"✓ Datetime attribute created: {key}")
        return result

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create datetime attribute {key}: {e}")
        raise


async def create_appwrite_enum_attribute(
    database_id: str,
    collection_id: str,
    key: str,
    elements: List[str],
    required: bool,
    mcp_config_path: str,
    default: Optional[str] = None
) -> Dict[str, Any]:
    """Create an enum attribute in a collection."""
    logger.info(f"Creating enum attribute: {collection_id}.{key}")

    try:
        from appwrite.services.databases import Databases

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_enum_attribute(
            database_id=database_id,
            collection_id=collection_id,
            key=key,
            elements=elements,
            required=required,
            default=default
        )

        logger.info(f"✓ Enum attribute created: {key}")
        return result

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create enum attribute {key}: {e}")
        raise


async def create_appwrite_index(
    database_id: str,
    collection_id: str,
    key: str,
    index_type: str,
    attributes: List[str],
    mcp_config_path: str,
    orders: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Create an index on a collection.

    Args:
        database_id: Database ID
        collection_id: Collection ID
        key: Index key/name
        index_type: 'key', 'unique', or 'fulltext'
        attributes: List of attribute names to index
        mcp_config_path: Path to .mcp.json
        orders: List of sort orders ('ASC' or 'DESC') for each attribute

    Returns:
        Created index metadata
    """
    logger.info(f"Creating {index_type} index: {collection_id}.{key}")

    try:
        from appwrite.services.databases import Databases

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        databases = Databases(client)

        result = databases.create_index(
            database_id=database_id,
            collection_id=collection_id,
            key=key,
            type=index_type,
            attributes=attributes,
            orders=orders or []
        )

        logger.info(f"✓ Index created: {key}")
        return result

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create index {key}: {e}")
        raise


async def create_appwrite_bucket(
    bucket_id: str,
    name: str,
    mcp_config_path: str,
    permissions: Optional[List[str]] = None,
    file_security: bool = True,
    enabled: bool = True,
    maximum_file_size: int = 50 * 1024 * 1024,  # 50 MB
    allowed_file_extensions: Optional[List[str]] = None,
    compression: str = "none",
    encryption: bool = True,
    antivirus: bool = True
) -> Dict[str, Any]:
    """Create a storage bucket in Appwrite.

    Args:
        bucket_id: Unique bucket ID (e.g., 'documents')
        name: Human-readable bucket name
        mcp_config_path: Path to .mcp.json
        permissions: Bucket-level permissions
        file_security: Enable file-level permissions
        enabled: Whether bucket is enabled
        maximum_file_size: Max file size in bytes (default 50MB)
        allowed_file_extensions: List of allowed extensions (e.g., ['.md', '.txt'])
        compression: Compression algorithm ('none', 'gzip', 'zstd')
        encryption: Enable at-rest encryption
        antivirus: Enable antivirus scanning

    Returns:
        Created bucket metadata
    """
    logger.info(f"Creating storage bucket: {bucket_id}")

    try:
        from appwrite.services.storage import Storage
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        storage = Storage(client)

        result = storage.create_bucket(
            bucket_id=bucket_id,
            name=name,
            permissions=permissions or [],
            file_security=file_security,
            enabled=enabled,
            maximum_file_size=maximum_file_size,
            allowed_file_extensions=allowed_file_extensions or [],
            compression=compression,
            encryption=encryption,
            antivirus=antivirus
        )

        logger.info(f"✓ Storage bucket created: {bucket_id}")
        return result

    except AppwriteException as e:
        if e.code == 409:
            logger.warning(f"Bucket already exists: {bucket_id}")
            raise
        logger.error(f"Failed to create bucket: {e.message} (code: {e.code})")
        raise
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to create bucket: {e}")
        raise


async def upload_to_appwrite_storage(
    bucket_id: str,
    file_path: Path,
    file_id: str,
    mcp_config_path: str,
    permissions: Optional[List[str]] = None,
    force: bool = False
) -> str:
    """Upload a file to Appwrite Storage.

    Args:
        bucket_id: Storage bucket ID (e.g., 'documents')
        file_path: Path to file to upload
        file_id: Unique file ID for storage
        mcp_config_path: Path to .mcp.json
        permissions: File-level permissions
        force: If True, delete existing file before upload (overwrite)

    Returns:
        File ID of uploaded file

    Raises:
        FileNotFoundError: If file doesn't exist
        AppwriteException: If upload fails
    """
    logger.info(f"Uploading file to {bucket_id}: {file_path.name}")

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    try:
        from appwrite.services.storage import Storage
        from appwrite.input_file import InputFile

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        storage = Storage(client)

        # If force mode, delete existing file first
        if force:
            try:
                storage.delete_file(bucket_id=bucket_id, file_id=file_id)
                logger.info(f"  Deleted existing file: {file_id}")
            except Exception as e:
                # File doesn't exist or other error - continue with upload
                if "not found" not in str(e).lower():
                    logger.warning(f"  Could not delete existing file: {e}")

        # Create InputFile from path
        input_file = InputFile.from_path(str(file_path))

        result = storage.create_file(
            bucket_id=bucket_id,
            file_id=file_id,
            file=input_file,
            permissions=permissions or []
        )

        uploaded_file_id = result['$id']
        logger.info(f"✓ File uploaded: {uploaded_file_id}")
        return uploaded_file_id

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise


async def upload_bytes_to_appwrite_storage(
    bucket_id: str,
    data: bytes,
    file_id: str,
    filename: str,
    mcp_config_path: str,
    permissions: Optional[List[str]] = None,
    force: bool = False
) -> str:
    """Upload bytes directly to Appwrite Storage without creating a temp file.

    Args:
        bucket_id: Storage bucket ID (e.g., 'authored_sow_entries')
        data: Bytes data to upload
        file_id: Unique file ID for storage (use 'unique()' for auto-generated)
        filename: Filename to use in storage (e.g., 'course_123_v1.json.gz')
        mcp_config_path: Path to .mcp.json
        permissions: File-level permissions (e.g., ['read("any")'])
        force: If True, delete existing file before upload (overwrite)

    Returns:
        File ID of uploaded file

    Raises:
        ValueError: If data is empty
        AppwriteException: If upload fails
    """
    if not data:
        raise ValueError("Cannot upload empty data to storage")

    logger.info(f"📤 Uploading {len(data):,} bytes to {bucket_id}/{filename}")

    try:
        from appwrite.services.storage import Storage
        from appwrite.input_file import InputFile

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        storage = Storage(client)

        # If force mode, delete existing file first
        if force and file_id != "unique()":
            try:
                storage.delete_file(bucket_id=bucket_id, file_id=file_id)
                logger.info(f"  Deleted existing file: {file_id}")
            except Exception as e:
                if "not found" not in str(e).lower():
                    logger.warning(f"  Could not delete existing file: {e}")

        # Create InputFile from bytes
        input_file = InputFile.from_bytes(data, filename=filename)

        result = storage.create_file(
            bucket_id=bucket_id,
            file_id=file_id,
            file=input_file,
            permissions=permissions or []
        )

        uploaded_file_id = result['$id']
        logger.info(f"✓ File uploaded: {uploaded_file_id} ({len(data):,} bytes)")
        return uploaded_file_id

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to upload bytes to storage: {e}")
        raise


async def download_from_appwrite_storage(
    bucket_id: str,
    file_id: str,
    mcp_config_path: str
) -> bytes:
    """Download file bytes from Appwrite Storage.

    Args:
        bucket_id: Storage bucket ID (e.g., 'authored_sow_entries')
        file_id: File ID to download
        mcp_config_path: Path to .mcp.json

    Returns:
        File contents as bytes

    Raises:
        FileNotFoundError: If file doesn't exist
        AppwriteException: If download fails
    """
    logger.info(f"📥 Downloading from {bucket_id}/{file_id}")

    try:
        from appwrite.services.storage import Storage
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        storage = Storage(client)

        # Get file download (returns bytes)
        result = storage.get_file_download(
            bucket_id=bucket_id,
            file_id=file_id
        )

        logger.info(f"✓ Downloaded {len(result):,} bytes from {file_id}")
        return result

    except AppwriteException as e:
        if e.code == 404:
            raise FileNotFoundError(f"File not found in storage: {bucket_id}/{file_id}")
        logger.error(f"Failed to download file: {e.message} (code: {e.code})")
        raise
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to download file: {e}")
        raise


async def delete_from_appwrite_storage(
    bucket_id: str,
    file_id: str,
    mcp_config_path: str
) -> bool:
    """Delete a file from Appwrite Storage.

    Args:
        bucket_id: Storage bucket ID
        file_id: File ID to delete
        mcp_config_path: Path to .mcp.json

    Returns:
        True if deleted successfully

    Raises:
        AppwriteException: If deletion fails (except 404 which returns False)
    """
    logger.info(f"🗑️  Deleting from {bucket_id}/{file_id}")

    try:
        from appwrite.services.storage import Storage
        from appwrite.exception import AppwriteException

        client, _, _, _ = _get_appwrite_client(mcp_config_path)
        storage = Storage(client)

        storage.delete_file(bucket_id=bucket_id, file_id=file_id)
        logger.info(f"✓ Deleted file: {file_id}")
        return True

    except AppwriteException as e:
        if e.code == 404:
            logger.warning(f"File not found (already deleted?): {file_id}")
            return False
        logger.error(f"Failed to delete file: {e.message} (code: {e.code})")
        raise
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        raise
