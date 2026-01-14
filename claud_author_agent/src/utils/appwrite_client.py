"""Appwrite client utilities.

Provides simple access to Appwrite Databases and Storage services using environment variables.
"""

import os
import logging
from pathlib import Path
from typing import Optional, Tuple

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.input_file import InputFile
from appwrite.id import ID
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Singleton instances
_client: Optional[Client] = None
_databases: Optional[Databases] = None
_storage: Optional[Storage] = None

# Storage bucket for exam diagrams
EXAM_DIAGRAMS_BUCKET_ID = "exam_diagrams"


def _load_env():
    """Load environment variables from .env file."""
    # Try multiple locations for .env
    possible_paths = [
        Path(__file__).parent.parent.parent / ".env",  # claud_author_agent/.env
        Path.cwd() / ".env",  # current working directory
    ]

    for env_path in possible_paths:
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"Loaded env from: {env_path}")
            return

    logger.warning("No .env file found, using existing environment variables")


def _init_client() -> Tuple[Client, Databases]:
    """Initialize Appwrite client from environment variables.

    Returns:
        Tuple of (Client, Databases)

    Raises:
        ValueError: If required environment variables are missing
    """
    global _client, _databases

    if _client is not None and _databases is not None:
        return _client, _databases

    _load_env()

    endpoint = os.getenv("APPWRITE_ENDPOINT")
    project_id = os.getenv("APPWRITE_PROJECT_ID")
    api_key = os.getenv("APPWRITE_API_KEY")

    if not all([endpoint, project_id, api_key]):
        missing = []
        if not endpoint:
            missing.append("APPWRITE_ENDPOINT")
        if not project_id:
            missing.append("APPWRITE_PROJECT_ID")
        if not api_key:
            missing.append("APPWRITE_API_KEY")
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    _client = Client()
    _client.set_endpoint(endpoint)
    _client.set_project(project_id)
    _client.set_key(api_key)

    _databases = Databases(_client)

    logger.info(f"Initialized Appwrite client for project: {project_id}")
    return _client, _databases


def get_client() -> Client:
    """Get Appwrite Client instance.

    Returns:
        Initialized Client

    Raises:
        ValueError: If environment not configured
    """
    client, _ = _init_client()
    return client


def get_databases() -> Databases:
    """Get Appwrite Databases service.

    Returns:
        Initialized Databases service

    Raises:
        ValueError: If environment not configured
    """
    _, databases = _init_client()
    return databases


def get_storage() -> Storage:
    """Get Appwrite Storage service.

    Returns:
        Initialized Storage service

    Raises:
        ValueError: If environment not configured
    """
    global _storage
    client, _ = _init_client()
    if _storage is None:
        _storage = Storage(client)
    return _storage


def reset_client():
    """Reset client singleton (useful for testing)."""
    global _client, _databases, _storage
    _client = None
    _databases = None
    _storage = None


def ensure_bucket_exists(bucket_id: str = EXAM_DIAGRAMS_BUCKET_ID) -> bool:
    """Ensure the storage bucket exists, creating it if necessary.

    Args:
        bucket_id: The bucket ID to check/create

    Returns:
        True if bucket exists or was created successfully

    Raises:
        ValueError: If bucket creation fails
    """
    storage = get_storage()

    try:
        # Try to get the bucket
        storage.get_bucket(bucket_id=bucket_id)
        logger.info(f"Bucket '{bucket_id}' already exists")
        return True
    except Exception as e:
        if "could not be found" in str(e).lower() or "not found" in str(e).lower():
            logger.info(f"Bucket '{bucket_id}' not found, creating...")
            try:
                # Create the bucket with appropriate permissions
                # Allow any authenticated user to read files (for frontend display)
                storage.create_bucket(
                    bucket_id=bucket_id,
                    name="Exam Diagrams",
                    permissions=[
                        'read("users")',  # Any authenticated user can read
                    ],
                    file_security=False,  # Use bucket-level permissions
                    enabled=True,
                    maximum_file_size=10485760,  # 10MB max file size
                    allowed_file_extensions=["png", "jpg", "jpeg", "svg", "webp"],
                )
                logger.info(f"Created bucket '{bucket_id}' successfully")
                return True
            except Exception as create_error:
                logger.error(f"Failed to create bucket '{bucket_id}': {create_error}")
                raise ValueError(f"Failed to create storage bucket: {create_error}")
        else:
            logger.error(f"Error checking bucket '{bucket_id}': {e}")
            raise ValueError(f"Failed to check storage bucket: {e}")


def upload_diagram(
    local_path: Path,
    exam_id: str,
    question_id: str
) -> str:
    """Upload a diagram PNG to Appwrite Storage.

    Args:
        local_path: Path to the local PNG file
        exam_id: Exam identifier for organizing files
        question_id: Question identifier

    Returns:
        Public URL to access the uploaded file

    Raises:
        ValueError: If upload fails or file doesn't exist
    """
    if not local_path.exists():
        raise ValueError(f"Diagram file not found: {local_path}")

    # Ensure the storage bucket exists (creates if not)
    ensure_bucket_exists(EXAM_DIAGRAMS_BUCKET_ID)

    storage = get_storage()

    # Generate unique file ID
    file_id = ID.unique()

    # Create a descriptive filename
    filename = f"{exam_id}_{question_id}_{local_path.name}"

    try:
        # Upload the file
        result = storage.create_file(
            bucket_id=EXAM_DIAGRAMS_BUCKET_ID,
            file_id=file_id,
            file=InputFile.from_path(str(local_path)),
        )

        uploaded_file_id = result["$id"]
        logger.info(f"Uploaded diagram: {filename} -> {uploaded_file_id}")

        # Construct the public URL
        # Format: {endpoint}/storage/buckets/{bucketId}/files/{fileId}/view?project={projectId}
        endpoint = os.getenv("APPWRITE_ENDPOINT", "").rstrip("/")
        project_id = os.getenv("APPWRITE_PROJECT_ID", "")

        file_url = f"{endpoint}/storage/buckets/{EXAM_DIAGRAMS_BUCKET_ID}/files/{uploaded_file_id}/view?project={project_id}"

        return file_url

    except Exception as e:
        logger.error(f"Failed to upload diagram {local_path}: {e}")
        raise ValueError(f"Diagram upload failed: {e}")
