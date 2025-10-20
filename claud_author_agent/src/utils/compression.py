"""Compression utilities for large JSON fields using gzip + base64.

Reduces database field sizes to fit within Appwrite's field size limits.
Supports both entries arrays and metadata objects.

Mirrors TypeScript compression.ts for consistency across Python/TypeScript code.
"""

import base64
import gzip
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Match TypeScript compression prefix for cross-platform compatibility
# TypeScript uses "gzip:" prefix to identify compressed data
COMPRESSION_PREFIX = "gzip:"


def compress_json_gzip_base64(data: Any) -> str:
    """Compress JSON data using gzip + base64 encoding.

    Format matches TypeScript compressJSON() from compression.ts.
    Adds "gzip:" prefix to identify compressed data format for cross-platform compatibility.

    Compression ratio: typically ~70% reduction for large JSON structures.

    Args:
        data: Any JSON-serializable object (dict, list, etc.)

    Returns:
        Compressed string with "gzip:" prefix + base64-encoded gzip data

    Raises:
        ValueError: If data is not JSON-serializable

    Example:
        >>> entries = [{"order": 1, "lesson": "intro"}, ...]
        >>> compressed = compress_json_gzip_base64(entries)
        >>> print(len(json.dumps(entries)), "->", len(compressed))
        >>> assert compressed.startswith("gzip:")  # Cross-platform format
    """
    try:
        # Step 1: Convert to JSON string
        json_str = json.dumps(data)

        # Step 2: Encode to UTF-8 bytes
        json_bytes = json_str.encode('utf-8')

        # Step 3: Compress with gzip
        compressed_bytes = gzip.compress(json_bytes, compresslevel=9)

        # Step 4: Base64 encode to string
        b64_encoded = base64.b64encode(compressed_bytes).decode('ascii')

        # Step 5: Add prefix to match TypeScript format (gzip:)
        return COMPRESSION_PREFIX + b64_encoded

    except (TypeError, ValueError) as e:
        raise ValueError(f"Failed to compress JSON: {e}")


def decompress_json_gzip_base64(data: str) -> Any:
    """Decompress gzip+base64 JSON data with smart format detection.

    Handles multiple compression formats for cross-platform compatibility:
    1. TypeScript format: "gzip:H4sI..." (with "gzip:" prefix)
    2. Python legacy format: "H4sI..." (raw base64, no prefix)
    3. Uncompressed format: "{...}" or "[...]" (fallback for backward compatibility)

    Args:
        data: Compressed or uncompressed JSON string

    Returns:
        Parsed JSON object/array

    Raises:
        ValueError: If decompression or parsing fails

    Example:
        >>> # TypeScript format (with prefix)
        >>> ts_compressed = compress_json_gzip_base64({"test": "data"})
        >>> original = decompress_json_gzip_base64(ts_compressed)
        >>> assert original == {"test": "data"}
    """
    if not isinstance(data, str):
        raise ValueError(f"Expected string, got {type(data).__name__}")

    try:
        # Try 1: Check for TypeScript "gzip:" prefix format
        if data.startswith(COMPRESSION_PREFIX):
            logger.debug("[compression] Detected TypeScript format (with gzip: prefix)")
            # Step 1: Remove prefix
            b64_data = data[len(COMPRESSION_PREFIX):]
            # Step 2: Base64 decode
            compressed_bytes = base64.b64decode(b64_data)
            # Step 3: Decompress gzip
            json_bytes = gzip.decompress(compressed_bytes)
            # Step 4: Decode UTF-8
            json_str = json_bytes.decode('utf-8')
            # Step 5: Parse JSON
            return json.loads(json_str)

        # Try 2: Check if looks like raw base64-gzip (Python legacy format)
        # Base64 data only contains: A-Z, a-z, 0-9, +, /, and = for padding
        if _is_likely_base64(data):
            logger.debug("[compression] Attempting raw base64-gzip decompression (Python legacy format)")
            try:
                # Step 1: Base64 decode (no prefix to strip)
                compressed_bytes = base64.b64decode(data, validate=True)
                # Step 2: Check if it looks like gzip (magic number: 1f 8b)
                if len(compressed_bytes) >= 2 and compressed_bytes[0:2] == b'\x1f\x8b':
                    # Step 3: Decompress gzip
                    json_bytes = gzip.decompress(compressed_bytes)
                    # Step 4: Decode UTF-8
                    json_str = json_bytes.decode('utf-8')
                    # Step 5: Parse JSON
                    return json.loads(json_str)
            except Exception as base64_error:
                logger.debug(f"[compression] Base64-gzip decompression failed: {base64_error}")
                # Fall through to JSON parsing

        # Try 3: Assume uncompressed JSON (backward compatibility)
        logger.debug("[compression] Attempting JSON parsing (uncompressed format)")
        return json.loads(data)

    except Exception as e:
        logger.error(f"[compression] Failed to decompress/parse JSON: {e}")
        logger.error(f"[compression] Data preview: {data[:100]}...")
        raise ValueError(f"Failed to decompress JSON: {e}")


def _is_likely_base64(data: str) -> bool:
    """Check if a string looks like base64-encoded data.

    Base64 uses: A-Z, a-z, 0-9, +, /, and = for padding.

    Args:
        data: String to check

    Returns:
        True if string appears to be base64-encoded
    """
    if len(data) < 4:
        return False

    # Check if string matches base64 pattern
    import re
    base64_pattern = re.compile(r'^[A-Za-z0-9+/]*={0,2}$')
    if not base64_pattern.match(data):
        logger.debug("[compression] String does not match base64 pattern")
        return False

    # Exclude strings that look like JSON
    trimmed = data.strip()
    if trimmed.startswith(('{', '[', '"')):
        logger.debug("[compression] String looks like JSON, not compressed")
        return False

    return True


def get_compression_stats(data: Any) -> dict:
    """Calculate and return compression statistics.

    Useful for logging and debugging compression effectiveness.

    Args:
        data: JSON-serializable object

    Returns:
        Dictionary with keys:
        - original: original JSON size in characters
        - compressed: compressed size in characters
        - ratio: compression ratio as percentage string (e.g., "28.5%")
        - savings: space saved as percentage string (e.g., "71.5%")

    Example:
        >>> entries = [{"order": i, "cards": []} for i in range(20)]
        >>> stats = get_compression_stats(entries)
        >>> print(f"Compressed to {stats['ratio']} ({stats['savings']} savings)")
    """
    try:
        original_json = json.dumps(data)
        original_size = len(original_json)

        compressed_data = compress_json_gzip_base64(data)
        compressed_size = len(compressed_data)

        ratio = (compressed_size / original_size) * 100
        savings = 100 - ratio

        return {
            "original": original_size,
            "compressed": compressed_size,
            "ratio": f"{ratio:.1f}%",
            "savings": f"{savings:.1f}%"
        }

    except Exception as e:
        logger.error(f"Failed to calculate compression stats: {e}")
        return {
            "original": 0,
            "compressed": 0,
            "ratio": "error",
            "savings": "error"
        }


def is_compressed(data: str) -> bool:
    """Check if a string appears to be gzip+base64 compressed data.

    Note: This is a heuristic check. Compression is not explicitly marked
    in Python (unlike TypeScript with "gzip:" prefix).

    Args:
        data: String to check

    Returns:
        True if data looks like base64-encoded gzip (heuristic)
    """
    if not isinstance(data, str) or len(data) < 20:
        return False

    try:
        # Try to decode as base64
        decoded = base64.b64decode(data, validate=True)
        # Check if it starts with gzip magic number (1f 8b)
        return len(decoded) >= 2 and decoded[0:2] == b'\x1f\x8b'
    except Exception:
        return False
