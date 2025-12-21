"""Unit tests for Compression Utilities.

Tests gzip + base64 compression/decompression for:
- compress_json_gzip_base64
- decompress_json_gzip_base64
- get_compression_stats
- is_compressed
- Cross-platform format compatibility (TypeScript "gzip:" prefix)
"""

import pytest
import json
import base64
import gzip

import sys
from pathlib import Path

# Add src/utils directly to bypass __init__.py which has SDK dependencies
src_utils_path = Path(__file__).parent.parent / "src" / "utils"
sys.path.insert(0, str(src_utils_path))

from compression import (
    compress_json_gzip_base64,
    decompress_json_gzip_base64,
    get_compression_stats,
    is_compressed,
    COMPRESSION_PREFIX,
    _is_likely_base64
)


# =============================================================================
# compress_json_gzip_base64 Tests
# =============================================================================

class TestCompressJsonGzipBase64:
    """Tests for compress_json_gzip_base64 function."""

    def test_compress_simple_dict(self):
        """Test compressing a simple dictionary."""
        data = {"key": "value", "number": 42}
        compressed = compress_json_gzip_base64(data)

        assert isinstance(compressed, str)
        assert compressed.startswith(COMPRESSION_PREFIX)
        assert len(compressed) > 0

    def test_compress_list(self):
        """Test compressing a list."""
        data = [1, 2, 3, "four", {"five": 5}]
        compressed = compress_json_gzip_base64(data)

        assert compressed.startswith(COMPRESSION_PREFIX)

    def test_compress_large_data_reduces_size(self):
        """Test that compression reduces size for large data."""
        # Create large repetitive data (compresses well)
        data = {"entries": [{"order": i, "content": "x" * 100} for i in range(50)]}

        original_size = len(json.dumps(data))
        compressed = compress_json_gzip_base64(data)
        compressed_size = len(compressed)

        # Compressed should be smaller
        assert compressed_size < original_size

    def test_compress_empty_dict(self):
        """Test compressing empty dictionary."""
        data = {}
        compressed = compress_json_gzip_base64(data)

        assert compressed.startswith(COMPRESSION_PREFIX)

    def test_compress_nested_structure(self):
        """Test compressing nested structures."""
        data = {
            "level1": {
                "level2": {
                    "level3": {
                        "data": [1, 2, 3]
                    }
                }
            }
        }
        compressed = compress_json_gzip_base64(data)

        assert compressed.startswith(COMPRESSION_PREFIX)

    def test_compress_unicode_data(self):
        """Test compressing data with unicode characters."""
        data = {"message": "Hello £€¥ 日本語", "emoji": "🎉"}
        compressed = compress_json_gzip_base64(data)

        # Should be able to decompress and get back the same data
        decompressed = decompress_json_gzip_base64(compressed)
        assert decompressed == data

    def test_compress_non_serializable_raises_error(self):
        """Test that non-JSON-serializable data raises error."""
        data = {"function": lambda x: x}  # Functions aren't JSON serializable

        with pytest.raises(ValueError) as exc_info:
            compress_json_gzip_base64(data)
        assert "Failed to compress JSON" in str(exc_info.value)


# =============================================================================
# decompress_json_gzip_base64 Tests
# =============================================================================

class TestDecompressJsonGzipBase64:
    """Tests for decompress_json_gzip_base64 function."""

    def test_decompress_typescript_format(self):
        """Test decompressing TypeScript format (with gzip: prefix)."""
        original = {"test": "data", "number": 123}
        compressed = compress_json_gzip_base64(original)

        decompressed = decompress_json_gzip_base64(compressed)

        assert decompressed == original

    def test_decompress_python_legacy_format(self):
        """Test decompressing Python legacy format (raw base64, no prefix)."""
        original = {"test": "legacy", "value": 456}

        # Create legacy format manually (no prefix)
        json_str = json.dumps(original)
        json_bytes = json_str.encode('utf-8')
        compressed_bytes = gzip.compress(json_bytes)
        legacy_compressed = base64.b64encode(compressed_bytes).decode('ascii')

        # Should not have prefix
        assert not legacy_compressed.startswith(COMPRESSION_PREFIX)

        # Should still decompress correctly
        decompressed = decompress_json_gzip_base64(legacy_compressed)
        assert decompressed == original

    def test_decompress_uncompressed_json_object(self):
        """Test that uncompressed JSON object string is parsed correctly."""
        json_str = '{"uncompressed": true}'

        result = decompress_json_gzip_base64(json_str)

        assert result == {"uncompressed": True}

    def test_decompress_uncompressed_json_array(self):
        """Test that uncompressed JSON array string is parsed correctly."""
        json_str = '[1, 2, 3]'

        result = decompress_json_gzip_base64(json_str)

        assert result == [1, 2, 3]

    def test_decompress_roundtrip(self):
        """Test compress-decompress roundtrip preserves data."""
        original = {
            "entries": [
                {"order": 1, "label": "Lesson 1", "type": "teach"},
                {"order": 2, "label": "Lesson 2", "type": "revision"}
            ],
            "metadata": {
                "subject": "mathematics",
                "level": "national-4"
            }
        }

        compressed = compress_json_gzip_base64(original)
        decompressed = decompress_json_gzip_base64(compressed)

        assert decompressed == original

    def test_decompress_non_string_raises_error(self):
        """Test that non-string input raises error."""
        with pytest.raises(ValueError) as exc_info:
            decompress_json_gzip_base64(123)  # Not a string
        assert "Expected string" in str(exc_info.value)

    def test_decompress_invalid_base64_with_json_fallback(self):
        """Test that invalid base64 falls back to JSON parsing."""
        # This looks like it could be base64 but isn't valid
        invalid = "NotValidBase64!!!"

        with pytest.raises(ValueError):
            decompress_json_gzip_base64(invalid)

    def test_decompress_corrupted_gzip_raises_error(self):
        """Test that corrupted gzip data raises error."""
        # Valid base64 but not valid gzip
        corrupted = COMPRESSION_PREFIX + base64.b64encode(b"not gzip data").decode('ascii')

        with pytest.raises(ValueError) as exc_info:
            decompress_json_gzip_base64(corrupted)
        assert "Failed to decompress" in str(exc_info.value)


# =============================================================================
# get_compression_stats Tests
# =============================================================================

class TestGetCompressionStats:
    """Tests for get_compression_stats function."""

    def test_compression_stats_structure(self):
        """Test that stats have correct structure."""
        data = {"test": "data"}
        stats = get_compression_stats(data)

        assert "original" in stats
        assert "compressed" in stats
        assert "ratio" in stats
        assert "savings" in stats

    def test_compression_stats_values(self):
        """Test that stats values are reasonable."""
        # Large repetitive data compresses well
        data = {"entries": [{"content": "x" * 100} for _ in range(20)]}
        stats = get_compression_stats(data)

        assert stats["original"] > stats["compressed"]
        assert isinstance(stats["original"], int)
        assert isinstance(stats["compressed"], int)

    def test_compression_stats_format(self):
        """Test that ratio and savings are formatted as percentages."""
        data = {"test": "data"}
        stats = get_compression_stats(data)

        assert stats["ratio"].endswith("%")
        assert stats["savings"].endswith("%")


# =============================================================================
# is_compressed Tests
# =============================================================================

class TestIsCompressed:
    """Tests for is_compressed function."""

    def test_is_compressed_true_for_compressed_data(self):
        """Test that compressed data returns True."""
        data = {"test": "data"}
        compressed = compress_json_gzip_base64(data)

        # Remove prefix for the legacy check
        legacy_format = compressed[len(COMPRESSION_PREFIX):]

        assert is_compressed(legacy_format) is True

    def test_is_compressed_false_for_json_string(self):
        """Test that JSON string returns False."""
        json_str = '{"not": "compressed"}'

        assert is_compressed(json_str) is False

    def test_is_compressed_false_for_short_string(self):
        """Test that short strings return False."""
        assert is_compressed("short") is False
        assert is_compressed("") is False

    def test_is_compressed_false_for_non_string(self):
        """Test that non-strings return False."""
        assert is_compressed(123) is False
        assert is_compressed(None) is False


# =============================================================================
# _is_likely_base64 Tests
# =============================================================================

class TestIsLikelyBase64:
    """Tests for _is_likely_base64 helper function."""

    def test_is_likely_base64_true_for_valid_base64(self):
        """Test that valid base64 returns True."""
        valid_b64 = base64.b64encode(b"test data").decode('ascii')
        assert _is_likely_base64(valid_b64) is True

    def test_is_likely_base64_false_for_json(self):
        """Test that JSON-looking strings return False."""
        assert _is_likely_base64('{"json": true}') is False
        assert _is_likely_base64('[1, 2, 3]') is False
        assert _is_likely_base64('"string"') is False

    def test_is_likely_base64_false_for_short_strings(self):
        """Test that short strings return False."""
        assert _is_likely_base64("abc") is False
        assert _is_likely_base64("") is False

    def test_is_likely_base64_false_for_invalid_chars(self):
        """Test that strings with invalid base64 chars return False."""
        assert _is_likely_base64("contains spaces") is False
        assert _is_likely_base64("special!@#$") is False


# =============================================================================
# Cross-Platform Compatibility Tests
# =============================================================================

class TestCrossPlatformCompatibility:
    """Tests for cross-platform format compatibility."""

    def test_compression_prefix_matches_typescript(self):
        """Test that compression prefix matches TypeScript format."""
        assert COMPRESSION_PREFIX == "gzip:"

    def test_typescript_format_roundtrip(self):
        """Test that Python can handle TypeScript-compressed data."""
        # Simulate TypeScript compression output
        original = {"from": "typescript", "test": True}
        json_str = json.dumps(original)
        json_bytes = json_str.encode('utf-8')
        compressed_bytes = gzip.compress(json_bytes)
        b64_encoded = base64.b64encode(compressed_bytes).decode('ascii')
        typescript_format = "gzip:" + b64_encoded

        # Python should decompress it correctly
        result = decompress_json_gzip_base64(typescript_format)
        assert result == original

    def test_python_output_compatible_with_typescript(self):
        """Test that Python output can be read by TypeScript (format check)."""
        data = {"from": "python", "test": True}
        compressed = compress_json_gzip_base64(data)

        # Should have correct prefix
        assert compressed.startswith("gzip:")

        # After removing prefix, should be valid base64
        b64_part = compressed[len("gzip:"):]
        try:
            decoded = base64.b64decode(b64_part)
            # Should be valid gzip
            decompressed = gzip.decompress(decoded)
            # Should be valid JSON
            parsed = json.loads(decompressed.decode('utf-8'))
            assert parsed == data
        except Exception as e:
            pytest.fail(f"Output not compatible: {e}")
